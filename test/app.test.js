import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAsset, nextHistory, toView, createLocalStore, createCloudStore } from '../src/asset-store.js';
import { createCloud, CloudError } from '../src/cloud.js';
import { enrich, portfolio } from '../src/portfolio.js';
import { sampleRows } from '../src/demo-data.js';

const memStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const good = { type: 'house', name: ' Lake House ', place: 'Austin, TX', customPlace: false, value: '685,000', cost: '$520,000', gross: '61200', expenses: '17360', status: 'Occupied', acquiredOn: '2022-03-01', notes: '' };

test('validateAsset normalises a good form', () => {
  const r = validateAsset(good, { today: '2026-10-28' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { name: 'Lake House', type: 'house', place: 'Austin, TX', country: 'US', lat: 30.27, lon: -97.74, value: 685000, cost: 520000, gross: 61200, expenses: 17360, debt: 0, debtPayment: 0, ownership: 100, owner: '', status: 'Occupied', acquiredOn: '2022-03-01', notes: null });
});

test('validateAsset reports every problem and rejects bad numbers', () => {
  const r = validateAsset({ type: '', name: '', place: 'Nowhere', value: '-5', cost: '0', gross: 'abc', expenses: '-1', status: 'Nope', acquiredOn: '2999-01-01' }, { today: '2026-10-28' });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['acquiredOn', 'cost', 'expenses', 'gross', 'name', 'place', 'status', 'type', 'value']);
});

test('custom places need a country and real coordinates', () => {
  const base = { ...good, customPlace: true, placeName: 'Hallstatt', country: 'XX', lat: '95', lon: '' };
  assert.deepEqual(Object.keys(validateAsset(base).errors).sort(), ['country', 'lat', 'lon']);
  const ok = validateAsset({ ...base, country: 'AU', lat: '-33.87', lon: '151.21' });
  assert.equal(ok.ok, true); assert.equal(ok.value.place, 'Hallstatt, AU'); assert.equal(ok.value.country, 'AU');
});

test('value history starts at acquisition and records each change once per day', () => {
  const v = { value: 685000, cost: 520000, acquiredOn: '2022-03-01' };
  let h = nextHistory([], v, { today: '2026-10-28', isNew: true });
  assert.deepEqual(h, [{ d: '2022-03-01', v: 520000 }, { d: '2026-10-28', v: 685000, b: 0 }]);
  assert.deepEqual(nextHistory(h, { ...v, value: 685000 }, { today: '2026-10-29' }), h, 'unchanged value adds nothing');
  h = nextHistory(h, { ...v, value: 700000 }, { today: '2026-10-29' });
  assert.equal(h.length, 3);
  h = nextHistory(h, { ...v, value: 710000 }, { today: '2026-10-29' });
  assert.equal(h.length, 3, 'same-day edits replace the point'); assert.equal(h.at(-1).v, 710000);
});

test('toView derives metrics and a chart series only when there is a history', () => {
  const row = { id: 'a', name: 'x', type: 'house', place: 'Austin, TX', country: 'US', lat: 30, lon: -97, value: 150, cost: 100, gross: 20, expenses: 5, status: 'Occupied', history: [{ d: '2022-03-01', v: 100 }, { d: '2026-01-01', v: 150 }] };
  const v = toView(row);
  assert.equal(v.appreciation, 50); assert.equal(v.noi, 15); assert.equal(v.category, 'residential'); assert.equal(v.kind, 'House or apartment');
  assert.deepEqual(v.series.map(p => p.label), ['Mar 2022', 'Jan 2026']);
  assert.equal(toView({ ...row, history: [{ d: '2026-01-01', v: 150 }] }).series, null);
});

test('portfolio math never divides by zero on an empty list', () => {
  const p = portfolio([]);
  assert.equal(p.value, 0); assert.equal(p.appreciationPct, 0); assert.equal(p.noiYield, null);
  assert.equal(enrich({ value: 10, cost: 0 }).appreciationPct, 0);
});

test('local store: add, update (history), remove, samples', async () => {
  const s = createLocalStore(memStorage());
  const a = await s.add(validateAsset(good, { today: '2026-10-28' }).value);
  assert.equal((await s.list()).length, 1); assert.equal(a.history.length >= 1, true);
  const b = await s.update(a.id, { ...validateAsset(good).value, value: 720000 });
  assert.equal(b.value, 720000); assert.equal(b.history.at(-1).v, 720000);
  await s.addMany(sampleRows('2026-10-28'));
  assert.equal((await s.list()).length, 17);
  await s.removeSample(); assert.equal((await s.list()).length, 1);
  await s.remove(a.id); assert.equal((await s.list()).length, 0);
  await assert.rejects(() => s.update('nope', {}), /no longer exists/);
});

/* ---------------------------------------------------------------- Supabase client against a scripted fake */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = new URL(url); calls.push({ url: u.pathname + u.search, method: init.method || 'GET', headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    for (const r of routes) if (r.test(u, init)) { const out = await r.reply(u, init, calls.length); return { ok: out.status < 400, status: out.status, text: async () => (out.body === undefined ? '' : JSON.stringify(out.body)) }; }
    return { ok: false, status: 404, text: async () => '{"message":"not found"}' };
  };
  fn.calls = calls; return fn;
}
const cfg = { url: 'https://x.supabase.co', anonKey: 'anon-key' };

test('password sign-in sends the lowercased email and password, and stores the session', async () => {
  const f = fakeFetch([{ test: u => u.pathname === '/auth/v1/token', reply: () => ({ status: 200, body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'u1', email: 'ana@example.com' } } }) }]);
  const st = memStorage();
  const c = createCloud({ ...cfg, storage: st, fetchImpl: f });
  await c.signInWithPassword(' Ana@Example.com ', 'secret-pw');
  const call = f.calls[0];
  assert.equal(call.url, '/auth/v1/token?grant_type=password');
  assert.equal(call.body.email, 'ana@example.com'); assert.equal(call.body.password, 'secret-pw'); assert.equal(call.headers.apikey, 'anon-key');
  assert.equal(c.user().email, 'ana@example.com');
});

test('wrong credentials and rate limits become readable messages', async () => {
  const bad = fakeFetch([{ test: () => true, reply: () => ({ status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }) }]);
  await assert.rejects(() => createCloud({ ...cfg, storage: memStorage(), fetchImpl: bad }).signInWithPassword('a@b.co', 'x'), e => e instanceof CloudError && /Incorrect email or password/.test(e.message));
  const f = fakeFetch([{ test: () => true, reply: () => ({ status: 429, body: { error_code: 'over_request_rate_limit', msg: 'x' } }) }]);
  await assert.rejects(() => createCloud({ ...cfg, storage: memStorage(), fetchImpl: f }).signInWithPassword('a@b.co', 'x'), e => e instanceof CloudError && /Too many attempts/.test(e.message));
});

test('magic-link return: session is read from the URL hash, saved, and the URL cleaned', async () => {
  const f = fakeFetch([{ test: u => u.pathname === '/auth/v1/user', reply: () => ({ status: 200, body: { id: 'u1', email: 'ana@example.com' } }) }]);
  const loc = { hash: '#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer&type=magiclink', pathname: '/app.html', search: '' };
  let cleaned = null; const history = { replaceState: (_a, _b, url) => { cleaned = url; } };
  const st = memStorage();
  const c = createCloud({ ...cfg, storage: st, fetchImpl: f, location: loc, history });
  assert.deepEqual(await c.consumeRedirect(), { signedIn: true });
  assert.equal(c.user().email, 'ana@example.com'); assert.equal(cleaned, '/app.html');
  assert.equal(JSON.parse(st.getItem('atlas.session.v1')).refresh_token, 'RT');
  const again = createCloud({ ...cfg, storage: st, fetchImpl: f, location: { hash: '', pathname: '/', search: '' }, history });
  assert.equal(again.session().access_token, 'AT', 'session survives a reload');
});

test('expired magic link is reported, not thrown', async () => {
  const loc = { hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', pathname: '/app.html', search: '' };
  const c = createCloud({ ...cfg, storage: memStorage(), fetchImpl: fakeFetch([]), location: loc, history: { replaceState() {} } });
  const r = await c.consumeRedirect();
  assert.equal(r.signedIn, false); assert.match(r.error, /expired/);
});

test('REST calls carry the user token; an expired token is refreshed once and retried', async () => {
  let n = 0;
  const f = fakeFetch([
    { test: u => u.pathname === '/auth/v1/token', reply: () => ({ status: 200, body: { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600, user: { id: 'u1' } } }) },
    { test: u => u.pathname === '/rest/v1/assets', reply: (u, init) => (++n === 1 ? { status: 401, body: { message: 'JWT expired' } } : { status: 200, body: [{ id: '1' }] }) },
  ]);
  const st = memStorage(); st.setItem('atlas.session.v1', JSON.stringify({ access_token: 'AT1', refresh_token: 'RT1', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1' } }));
  const c = createCloud({ ...cfg, storage: st, fetchImpl: f });
  const rows = await c.rest('GET', '/assets?select=*');
  assert.deepEqual(rows, [{ id: '1' }]);
  const rest = f.calls.filter(x => x.url.startsWith('/rest/v1'));
  assert.equal(rest[0].headers.authorization, 'Bearer AT1'); assert.equal(rest[1].headers.authorization, 'Bearer AT2');
  assert.equal(JSON.parse(st.getItem('atlas.session.v1')).refresh_token, 'RT2');
});

test('cloud store maps rows both ways and scopes deletes by id', async () => {
  const table = [];
  const f = fakeFetch([
    { test: (u, i) => u.pathname === '/rest/v1/assets' && (i.method || 'GET') === 'POST', reply: (u, i) => { const b = JSON.parse(i.body); const rows = (Array.isArray(b) ? b : [b]).map((r, k) => ({ id: `id${table.length + k}`, created_at: 't', ...r })); table.push(...rows); return { status: 201, body: rows }; } },
    { test: (u, i) => u.pathname === '/rest/v1/assets' && (i.method || 'GET') === 'GET', reply: u => ({ status: 200, body: u.searchParams.get('id') ? table.filter(r => `eq.${r.id}` === u.searchParams.get('id')).map(r => ({ history: r.history })) : table }) },
    { test: (u, i) => i.method === 'PATCH', reply: (u, i) => ({ status: 200, body: [{ ...table[0], ...JSON.parse(i.body) }] }) },
    { test: (u, i) => i.method === 'DELETE', reply: () => ({ status: 204 }) },
  ]);
  const st = memStorage(); st.setItem('atlas.session.v1', JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1' } }));
  const s = createCloudStore(createCloud({ ...cfg, storage: st, fetchImpl: f }));
  const added = await s.add(validateAsset(good, { today: '2026-10-28' }).value);
  const post = f.calls.find(c => c.method === 'POST');
  assert.equal(post.body.acquired_on, '2022-03-01'); assert.equal(post.body.is_sample, false); assert.equal('acquiredOn' in post.body, false);
  assert.equal(added.acquiredOn, '2022-03-01'); assert.equal(added.value, 685000);
  const upd = await s.update(added.id, { ...validateAsset(good).value, value: 700000 });
  assert.equal(upd.value, 700000);
  assert.ok(f.calls.some(c => c.method === 'PATCH' && c.url.includes(`id=eq.${added.id}`)));
  await s.remove(added.id);
  assert.ok(f.calls.some(c => c.method === 'DELETE' && c.url.includes(`id=eq.${added.id}`)));
  await s.removeSample();
  assert.ok(f.calls.some(c => c.method === 'DELETE' && c.url.includes('is_sample=eq.true')));
});
