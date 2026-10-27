import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLead } from '../src/lead.js';
import handler from '../api/early-access.js';
import { ASSETS, portfolio, byId, WESTLAKE_INCOME, WESTLAKE_EXPENSES } from '../src/demo-data.js';

const good = { email: ' Ana@Example.com ', firstName: 'Ana', portfolioSize: '1m-5m', assetTypes: ['residential', 'vessels'], investorType: '', consent: true };

test('validateLead normalizes valid input', () => {
  const r = validateLead(good);
  assert.ok(r.ok);
  assert.equal(r.value.email, 'ana@example.com');
  assert.equal(r.value.investor_type, null);
});

test('validateLead rejects bad email, missing consent, unknown category', () => {
  const r = validateLead({ ...good, email: 'nope', consent: false, assetTypes: ['yachts'], portfolioSize: 'x' });
  assert.deepEqual(Object.keys(r.errors).sort(), ['assetTypes', 'consent', 'email', 'portfolioSize']);
});

function call(body, method = 'POST') {
  return new Promise(resolve => {
    const res = {
      statusCode: 0, headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(t) { resolve({ status: this.statusCode, body: JSON.parse(t) }); },
    };
    handler({ method, body }, res);
  });
}

test('API: 503 when storage is not configured (never fakes success)', async () => {
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await call(good);
  assert.equal(r.status, 503);
  assert.notEqual(r.body.ok, true);
});

test('API: validation errors return 422, wrong method 405, honeypot is silent', async () => {
  assert.equal((await call({ ...good, email: 'x' })).status, 422);
  assert.equal((await call(good, 'GET')).status, 405);
  assert.equal((await call({ ...good, website: 'spam.com' })).body.ok, true);
});

test('API: stores a lead when configured, reports storage failure honestly', async () => {
  process.env.SUPABASE_URL = 'https://db.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  let sent;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent = { url, init }; return { ok: true, status: 201, text: async () => '' }; };
  try {
    const r = await call(good);
    assert.equal(r.status, 200);
    assert.match(sent.url, /\/rest\/v1\/early_access_leads\?on_conflict=email$/);
    const row = JSON.parse(sent.init.body);
    assert.equal(row.email, 'ana@example.com');
    assert.ok(row.consent_at && row.consent_text);
    globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
    assert.equal((await call(good)).status, 502);
  } finally {
    globalThis.fetch = real;
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

test('demo data is internally coherent', () => {
  const a = byId('austin');
  assert.equal(a.gross, WESTLAKE_INCOME.reduce((x, y) => x + y, 0));
  assert.equal(a.expenses, WESTLAKE_EXPENSES.reduce((x, y) => x + y, 0));
  assert.equal(a.noi, a.gross - a.expenses);
  assert.equal(a.noi, 43840);
  assert.equal(Math.round(a.noiYield * 1000) / 10, 6.4);
  const p = portfolio();
  assert.equal(p.value, ASSETS.reduce((s, x) => s + x.value, 0));
  assert.equal(p.noi, ASSETS.filter(x => x.earning).reduce((s, x) => s + x.noi, 0));
});
