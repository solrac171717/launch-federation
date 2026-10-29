import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { heirStatus, warningEmail, openNotice, DAY, WARN_DAYS } from '../src/heir-core.js';
import { runHeir } from '../api/heir.js';
import { runHeirCheck } from '../api/heir-check.js';
import { daysText, SHARED_LIST } from '../src/app-heir.js';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const TOKEN = 'B'.repeat(43), HASH = createHash('sha256').update(TOKEN).digest('hex');
const row = (over = {}) => ({ user_id: 'u1', contact_name: 'Maria', contact_email: 'maria@x.test', inactive_days: 90, enabled: true, token_hash: HASH, last_seen_at: new Date(NOW - 10 * DAY).toISOString(), warned_at: null, released_at: null, notified_at: null, opened_at: null, opened_count: 0, ...over });

test('the sheet stays closed while the owner keeps visiting, and opens exactly when the chosen time has passed', () => {
  assert.equal(heirStatus(null, NOW).state, 'none');
  const waiting = heirStatus(row(), NOW);
  assert.equal(waiting.state, 'waiting'); assert.equal(waiting.daysLeft, 80); assert.equal(waiting.warn, false);
  assert.equal(heirStatus(row({ last_seen_at: new Date(NOW - 89 * DAY).toISOString() }), NOW).state, 'waiting');
  const open = heirStatus(row({ last_seen_at: new Date(NOW - 90 * DAY).toISOString() }), NOW);
  assert.equal(open.state, 'open'); assert.equal(open.reason, 'inactive');
});

test('the owner is warned during the last 14 days before it opens', () => {
  assert.equal(heirStatus(row({ last_seen_at: new Date(NOW - (90 - WARN_DAYS - 1) * DAY).toISOString() }), NOW).warn, false);
  assert.equal(heirStatus(row({ last_seen_at: new Date(NOW - (90 - WARN_DAYS) * DAY).toISOString() }), NOW).warn, true);
});

test('releasing opens it at once; pausing closes it whatever else is true', () => {
  assert.deepEqual([heirStatus(row({ released_at: '2026-11-01T00:00:00Z' }), NOW).state, heirStatus(row({ released_at: '2026-11-01T00:00:00Z' }), NOW).reason], ['open', 'owner']);
  assert.equal(heirStatus(row({ enabled: false, released_at: '2026-11-01T00:00:00Z', last_seen_at: new Date(NOW - 400 * DAY).toISOString() }), NOW).state, 'paused');
});

/* ----------------------------------------------------------------- api/heir.js */
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
function fake(r) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); calls.push({ path: u.pathname + u.search, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    const ok = data => ({ ok: true, status: 200, json: async () => data });
    if (u.pathname === '/rest/v1/emergency_access' && (init.method || 'GET') === 'GET') return ok(u.search.includes(HASH) && r ? [r] : []);
    if (u.pathname === '/rest/v1/emergency_access') return ok([]);
    if (u.pathname === '/rest/v1/assets') return ok([{ id: 'a1', user_id: 'u1', name: 'Flat', type: 'house', place: 'Madrid, ES', country: 'ES', lat: 40.4, lon: -3.7, value: 300000, cost: 250000, debt: 100000, notes: 'door code 1234', history: [] }]);
    if (u.pathname === '/rest/v1/asset_documents') return ok([{ asset_id: 'a1', name: 'deed.pdf', kind: 'deed', path: 'u1/a1/secret-path.pdf', user_id: 'u1' }]);
    if (u.pathname === '/rest/v1/asset_reminders') return ok([{ asset_id: 'a1', title: 'Insurance', due_on: '2026-12-01', done: false, user_id: 'u1' }]);
    if (u.pathname === '/rest/v1/user_settings') return ok([{ data: { contacts: [{ role: 'Lawyer', name: 'Ana', phone: '+34 600', email: 'ana@x.test' }], emergencyNote: 'Start with the lawyer.', goal: { target: 5e6 } } }]);
    if (u.pathname.startsWith('/auth/v1/admin/users/')) return ok({ id: 'u1', email: 'owner@x.test' });
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, calls };
}
const stale = () => row({ last_seen_at: new Date(NOW - 120 * DAY).toISOString() });

test('a closed sheet answers "locked" and reads none of the owner data', async () => {
  const { fetchImpl, calls } = fake(row());
  const r = await runHeir({ env: ENV, fetchImpl, token: TOKEN, now: NOW });
  assert.equal(r.status, 403); assert.deepEqual(r.body, { error: 'locked' });
  assert.ok(!calls.some(c => /assets|documents|reminders|user_settings/.test(c.path)));
});

test('unknown, malformed and paused links all answer the same 404', async () => {
  const same = { status: 404, body: { error: 'not_found' } };
  assert.deepEqual(await runHeir({ env: ENV, fetchImpl: fake(stale()).fetchImpl, token: 'nope', now: NOW }), same);
  assert.deepEqual(await runHeir({ env: ENV, fetchImpl: fake(null).fetchImpl, token: TOKEN, now: NOW }), same);
  assert.deepEqual(await runHeir({ env: ENV, fetchImpl: fake(row({ enabled: false, released_at: '2026-01-01T00:00:00Z' })).fetchImpl, token: TOKEN, now: NOW }), same);
});

test('an open sheet returns assets, document NAMES only, open reminders and the contacts, and records the visit', async () => {
  const { fetchImpl, calls } = fake(stale());
  const r = await runHeir({ env: ENV, fetchImpl, token: TOKEN, now: NOW });
  assert.equal(r.status, 200); assert.equal(r.body.reason, 'inactive'); assert.equal(r.body.ownerEmail, 'owner@x.test'); assert.equal(r.body.contactName, 'Maria');
  assert.equal(r.body.assets[0].name, 'Flat'); assert.equal(r.body.assets[0].debt, 100000);
  assert.ok(!('user_id' in r.body.assets[0]), 'no internal ids of the owner');
  assert.deepEqual(r.body.docs, [{ asset_id: 'a1', name: 'deed.pdf', kind: 'deed' }]);
  assert.ok(!JSON.stringify(r.body).includes('secret-path'), 'file locations never leave the server');
  assert.deepEqual(r.body.settings.contacts.map(c => c.name), ['Ana']);
  assert.ok(!('goal' in r.body.settings), 'only the emergency part of the settings');
  const visit = calls.find(c => c.method === 'PATCH');
  assert.equal(visit.body.opened_count, 1); assert.ok(visit.body.opened_at);
});

test('a released sheet opens even though the owner visited today', async () => {
  const r = await runHeir({ env: ENV, fetchImpl: fake(row({ released_at: '2026-11-09T00:00:00Z' })).fetchImpl, token: TOKEN, now: NOW });
  assert.equal(r.status, 200); assert.equal(r.body.reason, 'owner');
});

test('without the service key the endpoint is off', async () => {
  assert.equal((await runHeir({ env: {}, fetchImpl: fake(stale()).fetchImpl, token: TOKEN, now: NOW })).status, 503);
});

/* ----------------------------------------------------------------- api/heir-check.js */
function job(rows, { resendOk = true } = {}) {
  const mails = [], patches = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === 'api.resend.com') { mails.push(JSON.parse(init.body)); return { ok: resendOk, status: resendOk ? 200 : 500 }; }
    if (u.pathname === '/rest/v1/emergency_access' && (init.method || 'GET') === 'GET') return { ok: true, status: 200, json: async () => rows };
    if (u.pathname === '/rest/v1/emergency_access') { patches.push({ q: u.search, body: JSON.parse(init.body) }); return { ok: true, status: 204, json: async () => ({}) }; }
    if (u.pathname.startsWith('/auth/v1/admin/users/')) return { ok: true, status: 200, json: async () => ({ email: 'owner@x.test' }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, mails, patches };
}
const CHECK_ENV = { ...ENV, RESEND_API_KEY: 're_1', REMINDER_FROM: 'Owned Map <a@x.test>', SITE_URL: 'https://x.test' };

test('the owner is warned once, in the last 14 days, and the email says when it opens', async () => {
  const soon = row({ last_seen_at: new Date(NOW - 80 * DAY).toISOString() });
  const j = job([soon]);
  const r = await runHeirCheck({ env: CHECK_ENV, fetchImpl: j.fetchImpl, now: NOW });
  assert.deepEqual(r.body, { ok: true, warned: 1, notified: 0, failed: 0 });
  assert.deepEqual(j.mails[0].to, ['owner@x.test']); assert.match(j.mails[0].text, /2026-11-20/); assert.match(j.mails[0].text, /Maria/);
  assert.ok(j.patches[0].body.warned_at);
  const again = job([{ ...soon, warned_at: '2026-11-09T00:00:00Z' }]);
  assert.equal((await runHeirCheck({ env: CHECK_ENV, fetchImpl: again.fetchImpl, now: NOW })).body.warned, 0);
});

test('when it opens, the trusted person is told once, and the email never carries the link', async () => {
  const open = stale();
  const j = job([open]);
  const r = await runHeirCheck({ env: CHECK_ENV, fetchImpl: j.fetchImpl, now: NOW });
  assert.equal(r.body.notified, 1); assert.deepEqual(j.mails[0].to, ['maria@x.test']);
  assert.ok(!/heir\.html|#t=/.test(j.mails[0].text + j.mails[0].html));
  assert.equal((await runHeirCheck({ env: CHECK_ENV, fetchImpl: job([{ ...open, notified_at: '2026-11-01T00:00:00Z' }]).fetchImpl, now: NOW })).body.notified, 0);
  assert.equal((await runHeirCheck({ env: CHECK_ENV, fetchImpl: job([{ ...open, contact_email: null }]).fetchImpl, now: NOW })).body.notified, 0);
});

test('a mark is only written after the email was accepted', async () => {
  const j = job([row({ last_seen_at: new Date(NOW - 80 * DAY).toISOString() })], { resendOk: false });
  const r = await runHeirCheck({ env: CHECK_ENV, fetchImpl: j.fetchImpl, now: NOW });
  assert.equal(r.body.warned, 0); assert.equal(r.body.failed, 1); assert.equal(j.patches.length, 0);
});

test('nothing is sent without email configuration, and a closed, far-away sheet sends nothing', async () => {
  assert.equal((await runHeirCheck({ env: ENV, fetchImpl: job([]).fetchImpl, now: NOW })).status, 503);
  const j = job([row()]);
  assert.deepEqual((await runHeirCheck({ env: CHECK_ENV, fetchImpl: j.fetchImpl, now: NOW })).body, { ok: true, warned: 0, notified: 0, failed: 0 });
  assert.equal(j.mails.length, 0);
});

test('the wording is plain, honest and has no em dashes', () => {
  const w = warningEmail({ contactName: 'Maria', opensAt: NOW, days: 90, appUrl: 'https://x.test/' }), o = openNotice({ ownerEmail: 'owner@x.test', contactName: 'Maria' });
  for (const m of [w, o]) { assert.ok(!/—/.test(m.subject + m.text + m.html)); assert.ok(m.subject.length < 90); }
  assert.match(w.text, /https:\/\/x\.test\/app\.html/);
  assert.equal(daysText(365), '1 year'); assert.equal(daysText(90), '90 days');
  assert.ok(SHARED_LIST.some(t => /never the files/.test(t)), 'the owner is told that files are not shared');
});
