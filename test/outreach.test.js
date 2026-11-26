import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitNote, localTime, inWorkHours, capsFor, sequenceRows, approvePatch, followDue, planSends, outreachStats, MIN_GAP_MS } from '../src/outreach-core.js';
import { createUnipile, ProviderError, configured } from '../src/providers/unipile.js';
import { runTick, scanForUser, signUser, verifySig, attachAccount } from '../src/outreach-engine.js';
import { runLinkedin } from '../api/linkedin.js';
import { tick } from '../api/tick.js';
import { createFakeDb } from './fake-db.js';

const MON_10 = Date.parse('2026-11-30T10:00:00Z'); // a Monday
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', SUPABASE_ANON_KEY: 'anon', OPENAI_API_KEY: 'k', OPENAI_BASE_URL: 'https://ai.test', UNIPILE_DSN: 'api9.unipile.test:1', UNIPILE_API_KEY: 'uk', CRON_SECRET: 'cron-secret-value', SITE_URL: 'https://ownedmap.test' };

/* ------------------------------------------------------------------ the rules */
test('a note is cut to what LinkedIn accepts: whole sentences, else a word', () => {
  assert.equal(fitNote('Short one.'), 'Short one.');
  assert.equal(fitNote('First sentence is fine. ' + 'Second sentence '.repeat(20) + 'ends here.'), 'First sentence is fine.');
  const n = fitNote('word '.repeat(80)); assert.ok(n.length <= 200 && !n.endsWith(' '));
});

test('working hours are the person’s own, on weekdays', () => {
  assert.deepEqual(localTime(MON_10, 'UTC'), { hour: 10, weekday: 1 });
  assert.equal(inWorkHours(MON_10, 'UTC'), true);
  assert.equal(inWorkHours(Date.parse('2026-12-05T10:00:00Z'), 'UTC'), false, 'a Saturday');
  assert.equal(inWorkHours(Date.parse('2026-11-30T19:00:00Z'), 'UTC'), false, 'after six');
  assert.equal(inWorkHours(Date.parse('2026-11-30T14:00:00Z'), 'America/New_York'), true, '09:00 in New York');
  assert.equal(inWorkHours(Date.parse('2026-11-30T12:00:00Z'), 'America/New_York'), false, '07:00 in New York');
  assert.equal(inWorkHours(MON_10, 'Not/AZone'), true, 'an unknown zone falls back to UTC');
});

test('the caps never go above the hard limits, whatever the settings say', () => {
  assert.deepEqual(capsFor({ inviteCap: 50 }), { invites: 20, messages: 40 });
  assert.deepEqual(capsFor({ invite_cap: 8 }), { invites: 8, messages: 40 });
  assert.equal(capsFor({}).invites, 15); assert.equal(capsFor({ inviteCap: 0 }).invites, 15);
});

test('a sequence is three rows: the invitation may go now only if the person turned automatic sending on', () => {
  const d = { invite: 'Hi Eve, saw your comment. ' + 'x'.repeat(300), follow1: 'Thanks for connecting.', follow2: 'One more idea.' };
  const manual = sequenceRows({ lead: { id: 'l1' }, drafts: d, accountId: 'a1', now: MON_10 });
  assert.deepEqual(manual.map(r => [r.step, r.status, r.due_at]), [['invite', 'draft', null], ['follow1', 'draft', null], ['follow2', 'draft', null]]);
  assert.ok(manual[0].text.length <= 200);
  const auto = sequenceRows({ lead: { id: 'l1' }, drafts: d, auto: true, now: MON_10 });
  assert.deepEqual(auto.map(r => [r.status, r.due_at]), [['approved', new Date(MON_10).toISOString()], ['approved', null], ['approved', null]]);
  assert.deepEqual(approvePatch('follow1', MON_10), { status: 'approved', due_at: null });
  assert.equal(approvePatch('invite', MON_10).due_at, new Date(MON_10).toISOString());
  const f1 = Date.parse(followDue('follow1', new Date(MON_10).toISOString(), () => 0)), f2 = Date.parse(followDue('follow2', new Date(MON_10).toISOString(), () => 0.99));
  assert.equal(f1 - MON_10, 86400_000); assert.ok(f2 - MON_10 >= 4 * 86400_000 && f2 - MON_10 < 4 * 86400_000 + 3 * 3600_000);
});

test('planSends: caps, hours, one send per account per run, the least used account first, follow-ups from their own account', () => {
  const row = (id, step, extra = {}) => ({ id, lead_id: `L${id}`, step, status: 'approved', due_at: new Date(MON_10 - 60_000).toISOString(), account_id: null, ...extra });
  const accounts = [{ id: 'a1', status: 'connected' }, { id: 'a2', status: 'connected' }, { id: 'a3', status: 'needs_attention' }];
  const profile = { inviteCap: 2, tz: 'UTC' }, calm = () => 0;
  let p = planSends({ rows: [row(1, 'invite'), row(2, 'invite'), row(3, 'invite')], accounts, today: { a1: { invites: 1, messages: 0 } }, profile, now: MON_10, rand: calm });
  assert.deepEqual(p.map(x => [x.row.id, x.accountId]), [[1, 'a2'], [2, 'a1']], 'a2 is the least used; a3 is not connected; one each; the third waits for the next run');
  assert.deepEqual(planSends({ rows: [row(1, 'invite')], accounts, today: { a1: { invites: 2, messages: 0 }, a2: { invites: 2, messages: 0 } }, profile, now: MON_10, rand: calm }), [], 'both accounts reached today’s cap');
  assert.deepEqual(planSends({ rows: [row(1, 'invite')], accounts, profile, now: Date.parse('2026-12-05T10:00:00Z'), rand: calm }), [], 'a Saturday');
  p = planSends({ rows: [row(1, 'follow1', { account_id: 'a1' })], accounts, today: { a1: { invites: 0, messages: 0 } }, profile, now: MON_10, rand: calm });
  assert.equal(p[0].accountId, 'a1', 'a follow-up goes from the account that sent the invitation');
  assert.deepEqual(planSends({ rows: [row(1, 'follow1', { account_id: 'a1' })], accounts: [accounts[1]], profile, now: MON_10, rand: calm }), [], 'and from no other');
  assert.deepEqual(planSends({ rows: [row(1, 'invite')], accounts: [accounts[0]], last: { a1: new Date(MON_10 - 60_000).toISOString() }, profile, now: MON_10, rand: calm }), [], 'a pause after the last send');
  assert.equal(planSends({ rows: [row(1, 'invite')], accounts: [accounts[0]], last: { a1: new Date(MON_10 - 3 * MIN_GAP_MS).toISOString() }, profile, now: MON_10, rand: calm }).length, 1);
  assert.deepEqual(planSends({ rows: [row(1, 'invite', { due_at: new Date(MON_10 + 3600_000).toISOString() }), row(2, 'follow1', { due_at: null, account_id: 'a1' })], accounts, profile, now: MON_10, rand: calm }), [], 'not due yet, and a follow-up waits for the acceptance');
});

test('the funnel of the outreach rows', () => {
  const rows = [{ lead_id: 'a', step: 'invite', status: 'sent' }, { lead_id: 'b', step: 'invite', status: 'sent' }, { lead_id: 'c', step: 'invite', status: 'draft' }, { lead_id: 'a', step: 'follow1', status: 'sent' }];
  const leads = [{ id: 'a', connected_at: '2026-11-30', status: 'replied' }, { id: 'b', connected_at: null, status: 'contacted' }];
  assert.deepEqual(outreachStats(rows, leads), { waiting: 1, sent: 2, accepted: 1, replied: 1 });
});

/* ------------------------------------------------------------------ the provider client */
test('Unipile client: the calls it makes, what it reads, and how it names failures', async () => {
  const seen = [];
  const reply = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
  const fetchImpl = async (url, init) => {
    const u = new URL(url); seen.push([init.method, u.pathname, u.search, init.headers['X-API-KEY'], init.body]);
    if (u.pathname === '/api/v1/hosted/accounts/link') return reply(201, { url: 'https://account.unipile.test/abc' });
    if (u.pathname === '/api/v1/linkedin/search') return reply(200, { items: [{ id: 'p1', text: 'Anyone know a CRM for a team of five? We are tired of spreadsheets.', author: { id: 'M1', name: 'Eve Hart', headline: 'COO at Zed', public_identifier: 'eve-hart' }, share_url: 'https://www.linkedin.com/feed/update/p1' }, { id: 'p2', text: 'short' }] });
    if (u.pathname === '/api/v1/users/eve-hart') return reply(200, { provider_id: 'M1', first_name: 'Eve', last_name: 'Hart', headline: 'COO', location: 'Austin, Texas, United States', network_distance: 'DISTANCE_2' });
    if (u.pathname === '/api/v1/users/invite') return reply(201, {});
    if (u.pathname === '/api/v1/chats') return reply(201, {});
    if (u.pathname === '/api/v1/users/relations') return reply(200, { items: [{ member_id: 'M1' }, { member_id: 'M2' }] });
    if (u.pathname === '/api/v1/messages') return reply(200, { items: [{ sender_id: 'M1', text: 'Sure, tell me more', is_sender: 0, timestamp: '2026-11-30T10:00:00Z' }, { sender_id: 'ME', text: 'mine', is_sender: 1 }] });
    if (u.pathname === '/api/v1/accounts/bad') return reply(401, { title: 'Unauthorized' });
    if (u.pathname === '/api/v1/accounts/slow') return reply(429, {});
    if (u.pathname === '/api/v1/accounts/gone') return reply(404, {});
    if (u.pathname === '/api/v1/accounts/ok') return reply(200, { name: 'Acme', sources: [{ status: 'OK' }] });
    throw new Error('network down');
  };
  const p = createUnipile({ env, fetchImpl });
  assert.equal(configured(env), true); assert.equal(configured({}), false);
  assert.equal(await p.hostedLink({ name: 'u1', successUrl: 's', failureUrl: 'f', notifyUrl: 'n' }), 'https://account.unipile.test/abc');
  const link = JSON.parse(seen[0][4]); assert.deepEqual([link.type, link.providers, link.name, link.notify_url, link.api_url], ['create', ['LINKEDIN'], 'u1', 'n', 'https://api9.unipile.test:1']);
  assert.equal(seen[0][3], 'uk', 'the key goes in a header');
  const found = await p.search({ accountId: 'A1', keywords: 'crm' });
  assert.equal(found.length, 1, 'a post with too little text is dropped');
  assert.deepEqual([found[0].authorName, found[0].authorRole, found[0].providerId, found[0].authorUrl, found[0].signalKind], ['Eve Hart', 'COO at Zed', 'M1', 'https://www.linkedin.com/in/eve-hart', 'post']);
  assert.equal(new URL(`https://x${seen[1][2]}`).searchParams.get('account_id'), 'A1');
  assert.deepEqual(await p.profile({ accountId: 'A1', url: 'https://www.linkedin.com/in/eve-hart/' }), { providerId: 'M1', name: 'Eve Hart', headline: 'COO', location: 'Austin, Texas, United States', distance: 'DISTANCE_2' });
  await p.invite({ accountId: 'A1', providerId: 'M1', note: 'x'.repeat(300) });
  const inv = seen.find(s => s[1] === '/api/v1/users/invite'); assert.deepEqual([JSON.parse(inv[4]).provider_id, JSON.parse(inv[4]).message.length], ['M1', 200]);
  await p.message({ accountId: 'A1', providerId: 'M1', text: 'Hello' });
  const msg = seen.find(s => s[1] === '/api/v1/chats'); assert.ok(msg[4] instanceof FormData); assert.equal(msg[4].get('attendees_ids'), 'M1'); assert.equal(msg[4].get('text'), 'Hello');
  assert.deepEqual(await p.connections({ accountId: 'A1' }), ['M1', 'M2']);
  assert.deepEqual(await p.incoming({ accountId: 'A1', since: '2026-11-30T09:00:00Z' }), [{ senderId: 'M1', text: 'Sure, tell me more', at: '2026-11-30T10:00:00Z' }], 'only what others wrote to the person');
  assert.deepEqual(await p.account('ok'), { ok: true, name: 'Acme' });
  for (const [id, kind] of [['bad', 'auth'], ['slow', 'limit'], ['gone', 'invalid']]) await assert.rejects(p.account(id), e => e instanceof ProviderError && e.kind === kind);
  await assert.rejects(p.profile({ accountId: 'A1', url: 'https://www.linkedin.com/in/zzz' }).then(() => { throw new ProviderError('x', { kind: 'network' }); }), e => e.kind === 'network');
});

/* ------------------------------------------------------------------ the server side */
const openai = (log = []) => async (url, init) => {
  const b = JSON.parse(init.body), name = b.response_format.json_schema.name; log.push(name);
  const content = name === 'lead_scores'
    ? { items: b.messages[1].content.split('\n\n').map((blk, i) => ({ id: String(i + 1), score: /CRM/i.test(blk) ? 88 : 12, intent: 'alternative', role: '', company: '', place: '', country: '', draft: '' })) }
    : { invite: 'Hi Eve, I saw your note about spreadsheets and CRMs. Would be glad to connect.', follow1: 'Thanks for connecting, Eve. We help small teams drop the spreadsheet. Is that still a pain for you?', follow2: 'One more thought: most teams of five start with just the pipeline view. Happy to show it, or no worries if not.' };
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: 'stop' }] }), text: async () => '' };
};
const world = (initial = {}, extra = {}) => {
  const log = [], ai = openai(log);
  const db = createFakeDb({
    business_profiles: [{ user_id: 'u1', name: 'Acme CRM', niche: 'CRM for small teams', audience: 'founders', problem: 'spreadsheets', tone: 'friendly', competitors: [], queries: [], watch: [], auto_send: false, invite_cap: 15, tz: 'UTC', last_scan: null }],
    linkedin_accounts: [{ id: 'a1', user_id: 'u1', provider_account_id: 'ACC1', name: 'Eve', status: 'connected', last_poll: new Date(MON_10 - 3600_000).toISOString() }],
    ...initial,
  }, { fallback: async (url, init) => { if (String(url).includes('/auth/v1/user')) return { ok: init.headers.authorization === 'Bearer good', status: 200, json: async () => ({ id: 'u1' }), text: async () => '' }; return ai(url, init); } });
  const calls = [];
  const provider = {
    candidates: [], friends: [], inbox: [], profileOf: { providerId: 'P9', headline: 'Founder', location: 'Austin, TX', distance: 'DISTANCE_2' }, failWith: null,
    async search(a) { calls.push(['search', a.keywords]); return this.candidates; }, async engagers(a) { calls.push(['engagers', a.pageUrl]); return this.candidates; },
    async profile() { return this.profileOf; },
    async invite(a) { if (this.failWith) throw this.failWith; calls.push(['invite', a.providerId, a.note]); return { ok: true }; },
    async message(a) { if (this.failWith) throw this.failWith; calls.push(['message', a.providerId, a.text]); return { ok: true }; },
    async connections() { calls.push(['connections']); return this.friends; }, async incoming() { calls.push(['incoming']); return this.inbox; },
    async account(id) { if (id === 'BAD') throw new ProviderError('nope', { kind: 'invalid' }); return { ok: true, name: 'Eve' }; },
    async disconnect(id) { calls.push(['disconnect', id]); }, async hostedLink(a) { calls.push(['hostedLink', a]); return 'https://account.unipile.test/x'; },
    ...extra,
  };
  return { ...db, provider, calls, log };
};
const lead = (o = {}) => ({ id: 'L1', user_id: 'u1', source: 'linkedin', external_id: 'x1', score: 88, status: 'new', signal_text: 'Need a CRM', author_name: 'Eve Hart', author_url: 'https://www.linkedin.com/in/eve-hart', provider_id: 'P1', connected_at: null, history: [], ...o });
const row = (step, o = {}) => ({ id: `${step}-1`, user_id: 'u1', lead_id: 'L1', account_id: 'a1', step, text: `${step} text`, status: 'approved', due_at: step === 'invite' ? new Date(MON_10 - 1000).toISOString() : null, ...o });

test('tick: sends an approved invitation, notices the acceptance, then sends the follow-up, and a reply ends the sequence', async () => {
  const w = world({ leads: [lead()], outreach: [row('invite'), row('follow1'), row('follow2')] });
  const rand = () => 0;
  let r = await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10, rand });
  assert.equal(r.sent, 1); assert.deepEqual(w.calls.filter(c => c[0] === 'invite'), [['invite', 'P1', 'invite text']]);
  const inv = w.tables.outreach.find(x => x.step === 'invite'); assert.equal(inv.status, 'sent'); assert.ok(inv.sent_at);
  assert.equal(w.tables.leads[0].status, 'contacted'); assert.deepEqual(w.tables.leads[0].history.at(-1).e, 'invited');
  assert.equal(w.tables.outreach.find(x => x.step === 'follow1').due_at, null, 'the follow-up waits for the acceptance');

  // ten minutes later nothing is due and nothing is sent twice
  r = await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10 + 10 * 60_000, rand });
  assert.equal(r.sent, 0);

  // they accept (the account is polled every fifteen minutes)
  w.provider.friends = ['P1'];
  r = await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10 + 20 * 60_000, rand });
  assert.equal(r.accepted, 1); assert.ok(w.tables.leads[0].connected_at);
  const due = Date.parse(w.tables.outreach.find(x => x.step === 'follow1').due_at); assert.equal(due - (MON_10 + 20 * 60_000), 86400_000, 'a day after the acceptance');
  assert.equal(w.calls.filter(c => c[0] === 'message').length, 0, 'not before it is due');

  // the next working day the follow-up goes
  r = await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: due + 60_000, rand });
  assert.equal(r.sent, 1); assert.deepEqual(w.calls.filter(c => c[0] === 'message'), [['message', 'P1', 'follow1 text']]);
  assert.ok(w.tables.outreach.find(x => x.step === 'follow2').due_at, 'and the second follow-up is scheduled');

  // they reply: everything that was left stops, and the lead is marked
  w.provider.inbox = [{ senderId: 'P1', text: 'Sure', at: 'x' }];
  r = await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: due + 3 * 3600_000, rand });
  assert.equal(r.replied, 1); assert.equal(w.tables.leads[0].status, 'replied'); assert.equal(w.tables.outreach.find(x => x.step === 'follow2').status, 'stopped');
});

test('tick: nothing leaves without approval, outside working hours, or above the daily cap', async () => {
  let w = world({ leads: [lead()], outreach: [row('invite', { status: 'draft' })] });
  assert.equal((await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10, rand: () => 0 })).sent, 0, 'a draft is never sent');
  w = world({ leads: [lead()], outreach: [row('invite')] });
  assert.equal((await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: Date.parse('2026-12-05T10:00:00Z'), rand: () => 0 })).sent, 0, 'a Saturday');
  const sentToday = Array.from({ length: 15 }, (_, i) => ({ id: `s${i}`, user_id: 'u1', lead_id: `S${i}`, account_id: 'a1', step: 'invite', status: 'sent', sent_at: new Date(MON_10 - 3600_000 - i * 1000).toISOString() }));
  w = world({ leads: [lead()], outreach: [row('invite'), ...sentToday] });
  assert.equal((await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10, rand: () => 0 })).sent, 0, 'the person’s cap of 15 is reached');
});

test('tick: when LinkedIn says not now it waits; when the login expired the account asks for attention; a refused invitation is recorded', async () => {
  let w = world({ leads: [lead()], outreach: [row('invite')] }); w.provider.failWith = new ProviderError('slow down', { kind: 'limit' });
  await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10, rand: () => 0 });
  assert.equal(w.tables.outreach[0].status, 'approved', 'tried again later'); assert.equal(w.tables.linkedin_accounts[0].status, 'connected');
  w = world({ leads: [lead()], outreach: [row('invite')] }); w.provider.failWith = new ProviderError('login', { kind: 'auth' });
  await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10, rand: () => 0 });
  assert.equal(w.tables.linkedin_accounts[0].status, 'needs_attention'); assert.equal(w.tables.outreach[0].status, 'approved');
  const again = await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10 + 20 * 60_000, rand: () => 0 });
  assert.equal(again.users, 1); assert.equal(again.sent, 0, 'an account that needs attention sends nothing');
  w = world({ leads: [lead()], outreach: [row('invite')] }); w.provider.failWith = new ProviderError('Cannot invite this person', { kind: 'invalid' });
  const r = await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10, rand: () => 0 });
  assert.equal(r.failed, 1); assert.equal(w.tables.outreach[0].status, 'failed'); assert.match(w.tables.outreach[0].error, /Cannot invite/);
});

test('tick: a person who is already connected skips the invitation and gets the first follow-up', async () => {
  const w = world({ leads: [lead({ connected_at: '2026-11-01T00:00:00Z' })], outreach: [row('invite'), row('follow1')] });
  await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10, rand: () => 0 });
  assert.equal(w.calls.filter(c => c[0] === 'invite').length, 0); assert.equal(w.tables.outreach.find(x => x.step === 'invite').status, 'skipped');
  assert.equal(w.tables.outreach.find(x => x.step === 'follow1').due_at, new Date(MON_10).toISOString());
});

const cand = (id, text, extra = {}) => ({ source: 'linkedin', externalId: id, signalKind: 'comment', authorName: 'Eve Hart', authorRole: 'COO at Zed', authorUrl: 'https://www.linkedin.com/in/eve-hart', providerId: 'P9', text, url: 'https://www.linkedin.com/feed/update/x', ...extra });

test('scan: watched pages and phrases become scored leads; only 70+ get messages, which wait for approval', async () => {
  const profile = { user_id: 'u1', name: 'Acme CRM', niche: 'CRM for small teams', audience: 'founders', problem: 'spreadsheets', tone: 'friendly', competitors: [], queries: ['crm'], watch: ['https://www.linkedin.com/company/rival'], auto_send: false, invite_cap: 15, tz: 'UTC' };
  const w = world({ business_profiles: [profile] });
  w.provider.candidates = [cand('c1', 'Commented on a post by rival: we need a CRM, spreadsheets are killing us'), cand('c2', 'Commented on a post by rival: nice weather today', { authorName: 'Bob', authorUrl: 'https://www.linkedin.com/in/bob' })];
  const accounts = w.tables.linkedin_accounts;
  const r = await scanForUser({ env, fetchImpl: w.fetchImpl, provider: w.provider, profileRow: profile, accounts, now: MON_10 });
  assert.deepEqual(r, { saved: 1, drafted: 1 }, 'the weather comment scored 12 and is dropped');
  assert.ok(w.calls.some(c => c[0] === 'engagers' && /rival/.test(c[1])) && w.calls.some(c => c[0] === 'search' && c[1] === 'crm'), 'both the watched page and the phrase were searched, from the person’s own account');
  const lead1 = w.tables.leads[0]; assert.deepEqual([lead1.user_id, lead1.provider_id, lead1.signal_kind, lead1.score >= 70], ['u1', 'P9', 'comment', true]);
  assert.deepEqual([lead1.place, lead1.country].map(Boolean), [true, true], 'the place comes from the LinkedIn profile and is geocoded');
  const rows = w.tables.outreach; assert.deepEqual(rows.map(x => [x.step, x.status, x.due_at]).sort(), [['follow1', 'draft', null], ['follow2', 'draft', null], ['invite', 'draft', null]].sort());
  assert.ok(rows.find(x => x.step === 'invite').text.length <= 200);
  // looking again never duplicates the lead or its messages
  const again = await scanForUser({ env, fetchImpl: w.fetchImpl, provider: w.provider, profileRow: profile, accounts, now: MON_10 + 3600_000 });
  assert.deepEqual(again, { saved: 0, drafted: 0 }); assert.equal(w.tables.leads.length, 1); assert.equal(w.tables.outreach.length, 3);
});

test('scan: with automatic sending on the messages are approved at once; a failing source does not stop the others; no account, no scan', async () => {
  const profile = { user_id: 'u1', name: 'Acme', niche: 'CRM', audience: 'founders', problem: 'spreadsheets', tone: '', competitors: [], queries: ['crm', 'pipeline'], watch: [], auto_send: true, invite_cap: 15, tz: 'UTC' };
  const w = world({ business_profiles: [profile] });
  let n = 0; w.provider.search = async () => { if (++n === 1) throw new ProviderError('boom', { kind: 'unknown' }); return [cand('c9', 'Looking for a CRM for our small team, any ideas?', { signalKind: 'post' })]; };
  const r = await scanForUser({ env, fetchImpl: w.fetchImpl, provider: w.provider, profileRow: profile, accounts: w.tables.linkedin_accounts, now: MON_10 });
  assert.equal(r.saved, 1);
  assert.deepEqual(w.tables.outreach.map(x => [x.step, x.status, Boolean(x.due_at)]).sort(), [['follow1', 'approved', false], ['follow2', 'approved', false], ['invite', 'approved', true]].sort());
  assert.deepEqual(await scanForUser({ env, fetchImpl: w.fetchImpl, provider: w.provider, profileRow: profile, accounts: [{ ...w.tables.linkedin_accounts[0], status: 'needs_attention' }], now: MON_10 }), { saved: 0, drafted: 0 });
});

test('tick: the scan runs every six hours, not every ten minutes', async () => {
  const profile = { user_id: 'u1', name: 'Acme', niche: 'CRM', audience: 'founders', problem: 'x', tone: '', competitors: [], queries: ['crm'], watch: [], auto_send: false, invite_cap: 15, tz: 'UTC', last_scan: null };
  const w = world({ business_profiles: [profile] }); w.provider.candidates = [cand('c1', 'We need a CRM, spreadsheets are killing us', { signalKind: 'post' })];
  await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10, rand: () => 0 });
  assert.equal(w.calls.filter(c => c[0] === 'search').length, 1); assert.equal(w.tables.leads.length, 1);
  await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10 + 10 * 60_000, rand: () => 0 });
  assert.equal(w.calls.filter(c => c[0] === 'search').length, 1, 'not again after ten minutes');
  await runTick({ env, fetchImpl: w.fetchImpl, provider: w.provider, now: MON_10 + 7 * 3600_000, rand: () => 0 });
  assert.equal(w.calls.filter(c => c[0] === 'search').length, 2, 'again after six hours');
});

/* ------------------------------------------------------------------ the endpoints */
test('/api/linkedin: only a signed-in person, a signed notify address, only their own account', async () => {
  const w = world();
  const call = (body, over = {}) => runLinkedin({ env, fetchImpl: w.fetchImpl, provider: w.provider, token: 'good', body, now: MON_10, ...over });
  assert.equal((await runLinkedin({ env: { ...env, UNIPILE_API_KEY: '' }, fetchImpl: w.fetchImpl, token: 'good', body: { action: 'link' } })).status, 503);
  assert.equal((await call({ action: 'link' }, { token: 'bad' })).status, 401);
  const l = await call({ action: 'link' }); assert.equal(l.status, 200); assert.equal(l.body.url, 'https://account.unipile.test/x');
  const asked = w.calls.find(c => c[0] === 'hostedLink')[1];
  assert.equal(asked.name, 'u1'); assert.match(asked.notifyUrl, /^https:\/\/ownedmap\.test\/api\/linkedin\?notify=1&u=u1&sig=[0-9a-f]{64}$/); assert.match(asked.successUrl, /linkedin=connected/);
  const sig = new URL(asked.notifyUrl).searchParams.get('sig');
  assert.equal(verifySig('u1', sig, env.CRON_SECRET), true); assert.equal(verifySig('u2', sig, env.CRON_SECRET), false, 'a signature is for one user only');
  // the provider's server calls back
  const q = { notify: '1', u: 'u1', sig };
  assert.equal((await call({ status: 'CREATION_SUCCESS', account_id: 'ACC2' }, { query: { ...q, sig: 'f'.repeat(64) }, token: '' })).status, 401);
  assert.equal((await call({ status: 'CREATION_SUCCESS', account_id: 'ACC2' }, { query: q, token: '' })).status, 200);
  assert.deepEqual(w.tables.linkedin_accounts.map(a => [a.user_id, a.provider_account_id]).sort(), [['u1', 'ACC1'], ['u1', 'ACC2']]);
  assert.equal((await call({ status: 'CREATION_SUCCESS', account_id: 'BAD' }, { query: q, token: '' })).status, 400, 'an id the provider does not know is refused');
  await assert.rejects(attachAccount({ env, fetchImpl: w.fetchImpl, provider: w.provider, userId: 'u9', accountId: 'ACC2' }), /account_taken/);
  // disconnecting
  w.tables.outreach.push(row('invite'), row('follow1', { account_id: 'a1' }));
  assert.equal((await call({ action: 'disconnect', id: 'nope' })).status, 404);
  assert.equal((await call({ action: 'disconnect', id: 'a1' })).status, 200);
  assert.deepEqual(w.calls.find(c => c[0] === 'disconnect'), ['disconnect', 'ACC1']); assert.equal(w.tables.linkedin_accounts.some(a => a.id === 'a1'), false);
  assert.ok(w.tables.outreach.every(x => x.status === 'stopped'), 'what was waiting for that account stops');
});

test('/api/linkedin scan: needs a connected account and a described business', async () => {
  const none = world({ linkedin_accounts: [] });
  assert.equal((await runLinkedin({ env, fetchImpl: none.fetchImpl, provider: none.provider, token: 'good', body: { action: 'scan' }, now: MON_10 })).status, 409);
  const noProfile = world({ business_profiles: [] });
  assert.equal((await runLinkedin({ env, fetchImpl: noProfile.fetchImpl, provider: noProfile.provider, token: 'good', body: { action: 'scan' }, now: MON_10 })).body.error, 'no_profile');
});

test('/api/tick: only the scheduler, with the secret', async () => {
  const w = world();
  assert.equal((await tick({ env, fetchImpl: w.fetchImpl, provider: w.provider, secret: '' })).status, 401);
  assert.equal((await tick({ env, fetchImpl: w.fetchImpl, provider: w.provider, secret: 'wrong-secret-value' })).status, 401);
  assert.equal((await tick({ env: { ...env, CRON_SECRET: '' }, fetchImpl: w.fetchImpl, provider: w.provider, secret: '' })).status, 503);
  const ok = await tick({ env, fetchImpl: w.fetchImpl, provider: w.provider, secret: env.CRON_SECRET, now: MON_10 });
  assert.equal(ok.status, 200); assert.equal(ok.body.users, 1);
});
