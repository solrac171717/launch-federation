// What happens on the server every ten minutes for every connected LinkedIn account: notice who accepted, notice who replied, send what is approved and due
// (inside the caps and the working hours), and, every few hours, look for new people (watched pages and the business' phrases) and draft their messages.
// Every network call is injected (database, provider, model, geocoder), so the tests run all of it against fakes.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { scoreCandidates, draftSequence, geocodePlace, locateLeads } from './leads-engine.js';
import { toRow, nextHistory } from './leads-core.js';
import { planSends, sequenceRows, followDue, approvePatch, capsFor, inWorkHours } from './outreach-core.js';
import { ProviderError } from './providers/unipile.js';

export const MIN_SCORE = 30;       // below this a post is noise and is not even saved
export const CONTACT_SCORE = 70;   // below this a person is never contacted
export const SCAN_EVERY_MS = 6 * 3600_000;
export const POLL_EVERY_MS = 15 * 60_000;
const MAX_DRAFTS_PER_RUN = 10;

/** The database through the service key. */
export const restFor = (env, fetchImpl) => async (method, path, body, prefer) => {
  const res = await fetchImpl(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/rest/v1${path}`, {
    method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`database ${res.status} ${method} ${path.split('?')[0]}`);
  const t = await res.text(); return t ? JSON.parse(t) : null;
};
const inList = ids => `in.(${ids.map(encodeURIComponent).join(',')})`;
const iso = t => new Date(t).toISOString();

/* ------------------------------------------------------------------ connecting an account */
/** The notify URL carries who it is for and a signature, so only our own link can attach an account to a user. */
export const signUser = (userId, secret) => createHmac('sha256', String(secret)).update(String(userId)).digest('hex');
export function verifySig(userId, sig, secret) {
  if (!secret || !userId || !sig) return false;
  const a = Buffer.from(signUser(userId, secret)), b = Buffer.from(String(sig));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Unipile says an account was created: keep its id for that user, after asking Unipile whether the account really exists in our workspace. */
export async function attachAccount({ env, fetchImpl, provider, userId, accountId, now = Date.now() }) {
  const db = restFor(env, fetchImpl);
  const info = await provider.account(accountId); // throws if the id is not an account of ours
  const mine = await db('GET', `/linkedin_accounts?provider_account_id=eq.${encodeURIComponent(accountId)}&select=id,user_id`);
  if (mine?.length) { if (mine[0].user_id !== userId) throw new Error('account_taken'); await db('PATCH', `/linkedin_accounts?id=eq.${mine[0].id}`, { status: 'connected', name: info.name || null }, 'return=minimal'); return mine[0].id; }
  const made = await db('POST', '/linkedin_accounts', { user_id: userId, provider_account_id: accountId, name: info.name || null, status: 'connected', last_poll: iso(now) }, 'return=representation');
  return made?.[0]?.id;
}

/* ------------------------------------------------------------------ finding people */
const cleanProfile = p => ({
  name: p.name || '', niche: p.niche || '', audience: p.audience || '', problem: p.problem || '', tone: p.tone || '',
  competitors: p.competitors || [], queries: p.queries || [], watch: p.watch || [],
});

/**
 * One scan for one user: the people who reacted to or commented on the pages they watch, and the posts that match their phrases, scored; the ones worth contacting get
 * their place and LinkedIn id read and their sequence drafted. Returns { saved, drafted }.
 */
export async function scanForUser({ env, fetchImpl, provider, profileRow, accounts, now = Date.now(), max = MAX_DRAFTS_PER_RUN }) {
  const db = restFor(env, fetchImpl), account = accounts.find(a => a.status === 'connected');
  if (!account) return { saved: 0, drafted: 0 };
  const profile = cleanProfile(profileRow);
  const found = [];
  const phrases = profile.queries.slice(0, 3), pages = profile.watch.slice(0, 3);
  const tries = [...pages.map(p => () => provider.engagers({ accountId: account.provider_account_id, pageUrl: p })), ...phrases.map(q => () => provider.search({ accountId: account.provider_account_id, keywords: q }))];
  for (const t of tries) { try { found.push(...await t()); } catch (e) { if (e instanceof ProviderError && e.kind === 'auth') { await db('PATCH', `/linkedin_accounts?id=eq.${account.id}`, { status: 'needs_attention' }, 'return=minimal'); break; } /* one failing phrase must not stop the others */ } }
  const seen = new Set(); const fresh = found.filter(c => c.externalId && !seen.has(c.externalId) && seen.add(c.externalId)).slice(0, 40);
  if (!fresh.length) return { saved: 0, drafted: 0 };
  const known = new Set((await db('GET', `/leads?user_id=eq.${profileRow.user_id}&source=eq.linkedin&external_id=${inList(fresh.map(c => c.externalId))}&select=external_id`) || []).map(r => r.external_id));
  const candidates = fresh.filter(c => !known.has(c.externalId));
  if (!candidates.length) return { saved: 0, drafted: 0 };
  const scored = (await scoreCandidates({ env, fetchImpl, profile, candidates })).filter(l => l.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
  // the model's validated lead drops fields it does not know; carry the provider's ones across by external id
  const byId = new Map(candidates.map(c => [c.externalId, c]));
  for (const l of scored) { const c = byId.get(l.externalId); if (c) { l.providerId = c.providerId || ''; l.signalKind = c.signalKind || 'post'; } }
  // place and LinkedIn id for the best ones (one profile read each)
  for (const l of scored.filter(x => x.score >= CONTACT_SCORE).slice(0, max)) {
    try {
      const p = l.authorUrl ? await provider.profile({ accountId: account.provider_account_id, url: l.authorUrl }) : null;
      if (p) {
        l.providerId = p.providerId || l.providerId; l.authorRole = l.authorRole || p.headline;
        l.connectedNow = /DISTANCE_1|FIRST/i.test(p.distance || '');
        if (p.location && !l.place) { const g = await geocodePlace({ place: p.location.replace(/ (Metropolitan )?Area$/i, '').replace(/^Greater /i, ''), env, fetchImpl }); if (g) Object.assign(l, { place: g.place, country: g.country, lat: g.lat, lon: g.lon }); }
      }
    } catch { /* the lead is still worth keeping without a place */ }
  }
  await locateLeads(scored, { env, fetchImpl }); // a place the post or the profile states becomes coordinates for the globe
  const saved = await db('POST', '/leads?on_conflict=user_id,source,external_id', scored.map(v => ({ ...toRow(v), user_id: profileRow.user_id, history: nextHistory([], 'found'), is_sample: false, connected_at: v.connectedNow ? iso(now) : null })), 'resolution=ignore-duplicates,return=representation') || [];
  let drafted = 0;
  const rows = [];
  for (const row of saved.filter(r => r.score >= CONTACT_SCORE).sort((a, b) => b.score - a.score).slice(0, max)) {
    try {
      const lead = { ...scored.find(s => s.externalId === row.external_id), id: row.id };
      const d = await draftSequence({ env, fetchImpl, profile, lead });
      rows.push(...sequenceRows({ lead: { id: row.id }, drafts: d, accountId: account.id, auto: !!profileRow.auto_send, now }).map(r => ({ ...r, user_id: profileRow.user_id })));
      await db('PATCH', `/leads?id=eq.${row.id}`, { draft: d.follow1 || d.invite, updated_at: iso(now) }, 'return=minimal');
      drafted++;
    } catch { /* a failed draft leaves the lead without messages; the next scan does not retry it, the person can still write one */ }
  }
  if (rows.length) await db('POST', '/outreach?on_conflict=lead_id,step', rows, 'resolution=ignore-duplicates,return=minimal');
  return { saved: saved.length, drafted };
}

/* ------------------------------------------------------------------ one tick */
export async function runTick({ env, fetchImpl = fetch, provider, now = Date.now(), rand = Math.random }) {
  const db = restFor(env, fetchImpl), out = { users: 0, sent: 0, failed: 0, accepted: 0, replied: 0, scanned: 0 };
  const accounts = await db('GET', '/linkedin_accounts?select=*') || [];
  const byUser = new Map(); for (const a of accounts) { if (!byUser.has(a.user_id)) byUser.set(a.user_id, []); byUser.get(a.user_id).push(a); }
  for (const [userId, list] of byUser) {
    out.users++;
    try { Object.assign(out, sum(out, await tickUser({ env, fetchImpl, provider, db, userId, accounts: list, now, rand }))); }
    catch (e) { console.error('tick user failed', userId, e?.message); }
  }
  return out;
}
const sum = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, k === 'users' ? a[k] : a[k] + (b[k] || 0)]));

async function tickUser({ env, fetchImpl, provider, db, userId, accounts, now, rand }) {
  const res = { sent: 0, failed: 0, accepted: 0, replied: 0, scanned: 0 };
  const profileRow = (await db('GET', `/business_profiles?user_id=eq.${userId}&select=*`))?.[0]; if (!profileRow) return res;
  const live = accounts.filter(a => a.status === 'connected'); if (!live.length) return res;
  const markAuth = async a => { a.status = 'needs_attention'; await db('PATCH', `/linkedin_accounts?id=eq.${a.id}`, { status: 'needs_attention' }, 'return=minimal'); };

  // 1. who accepted, who replied (each account every fifteen minutes)
  const waiting = await db('GET', `/outreach?user_id=eq.${userId}&step=eq.invite&status=eq.sent&select=lead_id`) || [];
  const invitedLeads = waiting.length ? await db('GET', `/leads?id=${inList(waiting.map(r => r.lead_id))}&select=id,provider_id,connected_at,status,history`) : [];
  const allLeads = await db('GET', `/leads?user_id=eq.${userId}&provider_id=not.is.null&select=id,provider_id,connected_at,status,history&limit=500`) || [];
  for (const a of live) {
    if (now - Date.parse(a.last_poll || 0) < POLL_EVERY_MS) continue;
    try {
      const pending = invitedLeads.filter(l => !l.connected_at && l.provider_id);
      if (pending.length) {
        const friends = new Set(await provider.connections({ accountId: a.provider_account_id }));
        for (const l of pending.filter(x => friends.has(x.provider_id))) {
          await db('PATCH', `/leads?id=eq.${l.id}`, { connected_at: iso(now), history: nextHistory(l.history, 'connected'), updated_at: iso(now) }, 'return=minimal'); l.connected_at = iso(now); res.accepted++;
          await db('PATCH', `/outreach?lead_id=eq.${l.id}&step=eq.follow1&status=eq.approved&due_at=is.null`, { due_at: followDue('follow1', iso(now), rand) }, 'return=minimal');
        }
      }
      const incoming = await provider.incoming({ accountId: a.provider_account_id, since: a.last_poll });
      const mine = new Map(allLeads.map(l => [l.provider_id, l]));
      for (const m of incoming) {
        const l = mine.get(m.senderId); if (!l || l.status === 'replied' || l.status === 'customer') continue;
        await db('PATCH', `/leads?id=eq.${l.id}`, { status: 'replied', history: nextHistory(l.history, 'replied'), updated_at: iso(now) }, 'return=minimal'); l.status = 'replied'; res.replied++;
        await db('PATCH', `/outreach?lead_id=eq.${l.id}&status=in.(draft,approved)`, { status: 'stopped' }, 'return=minimal'); // the person answered: the sequence ends here
      }
      await db('PATCH', `/linkedin_accounts?id=eq.${a.id}`, { last_poll: iso(now) }, 'return=minimal'); a.last_poll = iso(now);
    } catch (e) { if (e instanceof ProviderError && e.kind === 'auth') await markAuth(a); }
  }

  // 2. send what is approved and due
  const rows = await db('GET', `/outreach?user_id=eq.${userId}&status=eq.approved&due_at=lte.${encodeURIComponent(iso(now))}&select=*&limit=50`) || [];
  if (rows.length) {
    const sentToday = await db('GET', `/outreach?user_id=eq.${userId}&status=eq.sent&sent_at=gte.${encodeURIComponent(iso(now - 86400_000))}&select=account_id,step,sent_at`) || [];
    const today = {}, last = {};
    for (const r of sentToday) { if (!r.account_id) continue; const t = (today[r.account_id] ||= { invites: 0, messages: 0 }); t[r.step === 'invite' ? 'invites' : 'messages']++; if (!last[r.account_id] || r.sent_at > last[r.account_id]) last[r.account_id] = r.sent_at; }
    const plan = planSends({ rows, accounts: live.filter(a => a.status === 'connected'), today, last, profile: { inviteCap: profileRow.invite_cap, tz: profileRow.tz }, now, rand });
    const leads = plan.length ? await db('GET', `/leads?id=${inList(plan.map(p => p.row.lead_id))}&select=*`) : [];
    for (const { row, accountId } of plan) {
      const acct = live.find(a => a.id === accountId), lead = leads.find(l => l.id === row.lead_id); if (!acct || !lead) continue;
      try {
        let providerId = lead.provider_id;
        if (!providerId) { const p = await provider.profile({ accountId: acct.provider_account_id, url: lead.author_url }); providerId = p?.providerId; if (p?.providerId) await db('PATCH', `/leads?id=eq.${lead.id}`, { provider_id: p.providerId }, 'return=minimal'); if (/DISTANCE_1|FIRST/i.test(p?.distance || '')) lead.connected_at ||= iso(now); }
        if (!providerId) throw new ProviderError('no_profile', { kind: 'invalid' });
        if (row.step === 'invite' && lead.connected_at) { // already connected: no invitation needed, the first follow-up takes its place
          await db('PATCH', `/outreach?id=eq.${row.id}`, { status: 'skipped', error: 'already_connected' }, 'return=minimal');
          await db('PATCH', `/outreach?lead_id=eq.${lead.id}&step=eq.follow1&status=eq.approved&due_at=is.null`, { due_at: iso(now) }, 'return=minimal'); continue;
        }
        if (row.step === 'invite') await provider.invite({ accountId: acct.provider_account_id, providerId, note: row.text });
        else await provider.message({ accountId: acct.provider_account_id, providerId, text: row.text });
        await db('PATCH', `/outreach?id=eq.${row.id}`, { status: 'sent', sent_at: iso(now), account_id: acct.id, error: null }, 'return=minimal');
        await db('PATCH', `/leads?id=eq.${lead.id}`, { status: lead.status === 'new' ? 'contacted' : lead.status, history: nextHistory(lead.history, row.step === 'invite' ? 'invited' : 'messaged'), updated_at: iso(now) }, 'return=minimal');
        if (row.step === 'follow1') await db('PATCH', `/outreach?lead_id=eq.${lead.id}&step=eq.follow2&status=eq.approved&due_at=is.null`, { due_at: followDue('follow2', iso(now), rand) }, 'return=minimal');
        res.sent++;
      } catch (e) {
        if (e instanceof ProviderError && e.kind === 'auth') { await markAuth(acct); continue; }
        if (e instanceof ProviderError && (e.kind === 'limit' || e.kind === 'network')) continue; // LinkedIn or the network says not now: it stays approved and is tried again later
        await db('PATCH', `/outreach?id=eq.${row.id}`, { status: 'failed', error: String(e.message || 'failed').slice(0, 200) }, 'return=minimal'); res.failed++;
      }
    }
  }

  // 3. look for new people every few hours
  if (now - Date.parse(profileRow.last_scan || 0) >= SCAN_EVERY_MS && (profileRow.watch?.length || profileRow.queries?.length)) {
    await db('PATCH', `/business_profiles?user_id=eq.${userId}`, { last_scan: iso(now) }, 'return=minimal');
    try { const r = await scanForUser({ env, fetchImpl, provider, profileRow, accounts: live, now }); res.scanned += r.saved; } catch (e) { console.error('scan failed', e?.message); }
  }
  return res;
}

/** The same scan, on demand, for the button in the app. */
export async function scanNow({ env, fetchImpl = fetch, provider, userId, now = Date.now() }) {
  const db = restFor(env, fetchImpl);
  const profileRow = (await db('GET', `/business_profiles?user_id=eq.${userId}&select=*`))?.[0];
  const accounts = await db('GET', `/linkedin_accounts?user_id=eq.${userId}&select=*`) || [];
  if (!profileRow) return { error: 'no_profile' };
  if (!accounts.some(a => a.status === 'connected')) return { error: 'no_account' };
  await db('PATCH', `/business_profiles?user_id=eq.${userId}`, { last_scan: iso(now) }, 'return=minimal');
  return scanForUser({ env, fetchImpl, provider, profileRow, accounts, now });
}

export { approvePatch, capsFor, inWorkHours };
