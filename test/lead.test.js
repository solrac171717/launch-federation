import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLead } from '../src/lead.js';
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

test('validateLead needs only email and consent', () => {
  const r = validateLead({ email: 'a@b.co', consent: true });
  assert.ok(r.ok);
  assert.equal(r.value.first_name, null);
  assert.deepEqual(r.value.asset_types, []);
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
