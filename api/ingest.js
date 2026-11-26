// POST /api/ingest: what the browser extension sends. It authenticates with a pairing token the person made in the app (only its SHA-256 hash is stored).
//   { items: [{ externalId, authorName, authorRole, authorUrl, text, url, postedAt }] }  posts the person was looking at on LinkedIn:
//       scored against their business, drafted, and saved as leads.
//   { profile: { url, location } }  a profile page the person opened: the leads of that author get a place on the map.
// The extension reads only what the person has on screen. It never sends a message, an invitation or a click on their behalf.
// Env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Test hooks: OPENAI_BASE_URL, NOMINATIM_URL.
import { createHash } from 'node:crypto';
import { scoreCandidates, locateLeads, geocodePlace } from '../src/leads-engine.js';
import { toRow, nextHistory } from '../src/leads-core.js';
import { send, readJson, limiter } from './_leads-http.js';

const allowed = limiter(40);
const MAX_ITEMS = 20;
export const MIN_SCORE = 30;

const rest = (env, fetchImpl) => async (method, path, body, prefer) => {
  const res = await fetchImpl(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/rest/v1${path}`, {
    method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`database ${res.status}`);
  const t = await res.text(); return t ? JSON.parse(t) : null;
};

export async function runIngest({ env, fetchImpl = fetch, token, body, now = Date.now() }) {
  if (!env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 503, body: { error: 'not_configured' } };
  if (!token || token.length < 20) return { status: 401, body: { error: 'bad_token' } };
  const db = rest(env, fetchImpl);
  const hash = createHash('sha256').update(token).digest('hex');
  const found = await db('GET', `/ingest_tokens?token_hash=eq.${hash}&revoked=eq.false&select=id,user_id`).catch(() => null);
  const row = found?.[0];
  if (!row) return { status: 401, body: { error: 'bad_token' } };
  if (!allowed(row.user_id, now)) return { status: 429, body: { error: 'rate_limited' } };
  db('PATCH', `/ingest_tokens?id=eq.${row.id}`, { last_used: new Date(now).toISOString() }).catch(() => {});

  // a profile page the person opened: give its author's leads a place
  if (body?.profile) {
    const url = String(body.profile.url || '').split('?')[0].replace(/\/$/, '').slice(0, 300), loc = String(body.profile.location || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!/^https:\/\/([a-z]+\.)?linkedin\.com\/in\//i.test(url) || !loc) return { status: 400, body: { error: 'bad_profile' } };
    const g = await geocodePlace({ place: loc.replace(/ (Metropolitan )?Area$/i, '').replace(/^Greater /i, ''), env, fetchImpl });
    if (!g) return { status: 200, body: { placed: 0 } };
    const upd = await db('PATCH', `/leads?user_id=eq.${row.user_id}&author_url=like.${encodeURIComponent(`${url}*`)}&lat=is.null`, { place: g.place, country: g.country, lat: g.lat, lon: g.lon, updated_at: new Date(now).toISOString() }, 'return=representation');
    return { status: 200, body: { placed: (upd || []).length } };
  }

  const items = (Array.isArray(body?.items) ? body.items : []).slice(0, MAX_ITEMS).map(i => ({
    source: 'linkedin', externalId: String(i.externalId || '').slice(0, 120), authorName: String(i.authorName || '').slice(0, 120), authorRole: String(i.authorRole || '').slice(0, 160),
    authorUrl: String(i.authorUrl || '').split('?')[0].slice(0, 300), text: String(i.text || '').replace(/\s+/g, ' ').trim().slice(0, 1500), url: String(i.url || '').slice(0, 500), signalAt: i.postedAt,
  })).filter(i => i.externalId && i.text.length >= 25);
  if (!items.length) return { status: 200, body: { saved: 0, scanned: 0 } };
  const prof = (await db('GET', `/business_profiles?user_id=eq.${row.user_id}&select=*`).catch(() => null))?.[0];
  if (!prof) return { status: 409, body: { error: 'no_profile', message: 'Describe your business in the app first.' } };
  const profile = { name: prof.name || '', niche: prof.niche || '', audience: prof.audience || '', problem: prof.problem || '', tone: prof.tone || '', competitors: prof.competitors || [], queries: prof.queries || [] };
  try {
    const scored = (await scoreCandidates({ env, fetchImpl, profile, candidates: items })).filter(l => l.score >= MIN_SCORE);
    await locateLeads(scored, { env, fetchImpl });
    if (!scored.length) return { status: 200, body: { saved: 0, scanned: items.length } };
    const saved = await db('POST', '/leads?on_conflict=user_id,source,external_id', scored.map(v => ({ ...toRow(v), user_id: row.user_id, history: nextHistory([], 'found'), is_sample: false })), 'resolution=ignore-duplicates,return=representation');
    return { status: 200, body: { saved: (saved || []).length, scanned: items.length } };
  } catch (e) {
    console.error('ingest error', e?.status, e?.message);
    return { status: 502, body: { error: 'model_unavailable' } };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    const { status, body } = await runIngest({ env: process.env, token: String(req.headers.authorization || '').replace(/^Bearer /, ''), body: await readJson(req) });
    return send(res, status, body);
  } catch (e) { console.error('ingest error', e); return send(res, e.status === 413 ? 413 : 500, { error: 'server_error' }); }
}
