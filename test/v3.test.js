import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { enrich, portfolio } from '../src/portfolio.js';
import { validateAsset, quickValues, toView, nextHistory, fromDb } from '../src/asset-store.js';
import { previewImport } from '../src/csv-import.js';
import { makeToken, sha256Hex, shareState, shareUrl } from '../src/app-share.js';
import { ASSETS, sampleRows } from '../src/demo-data.js';
import { buildExcel, ownerRows, reportHtml } from '../src/report.js';

/* ------------------------------------------------ shared ownership */
test('owning half of an asset halves every figure, so net worth is not inflated', () => {
  const a = enrich({ value: 200000, cost: 100000, gross: 12000, expenses: 2000, debt: 100000, debtPayment: 800, ownership: 50, owner: 'Lake House LLC' });
  assert.equal(a.value, 100000); assert.equal(a.cost, 50000); assert.equal(a.debt, 50000); assert.equal(a.debtPayment, 400); assert.equal(a.noi, 5000); assert.equal(a.equity, 50000);
  assert.equal(a.fullValue, 200000); assert.equal(a.shared, true); assert.equal(a.owner, 'Lake House LLC');
  assert.equal(a.noiYield, 0.05, 'ratios do not change with the share');
  const p = portfolio([a, enrich({ value: 100000, cost: 90000 })]); assert.equal(p.value, 200000); assert.equal(p.netWorth, 150000);
  assert.equal(enrich({ value: 10, cost: 5 }).ownership, 100); assert.equal(enrich({ value: 10, cost: 5, ownership: 0 }).ownership, 100, 'zero is treated as unset, never as nothing');
});
test('ownership and owner are validated', () => {
  const base = { type: 'house', name: 'x', place: 'Austin, TX', value: '10', cost: '10', status: 'Occupied' };
  assert.equal(validateAsset(base).value.ownership, 100); assert.equal(validateAsset({ ...base, ownership: '33.5%' }).value.ownership, 33.5);
  for (const bad of ['0', '101', '-5', 'abc']) assert.ok(validateAsset({ ...base, ownership: bad }).errors.ownership, bad);
  assert.ok(validateAsset({ ...base, owner: 'x'.repeat(61) }).errors.owner);
  assert.equal(validateAsset({ ...base, owner: '  My LLC ' }).value.owner, 'My LLC');
});
test('the value chart of a shared asset follows the owner share', () => {
  const v = toView({ id: 'a', name: 'x', type: 'house', place: 'p', country: 'US', lat: 0, lon: 0, value: 200, cost: 100, gross: 0, expenses: 0, ownership: 50, history: [{ d: '2022-01-01', v: 100 }, { d: '2026-01-01', v: 200 }] });
  assert.deepEqual(v.series.map(p => p.v), [50, 100]); assert.equal(v.value, 100);
});
test('owner rows add up net worth by legal owner', () => {
  const rows = ownerRows([enrich({ value: 300, cost: 1, debt: 100, owner: 'Me' }), enrich({ value: 200, cost: 1, owner: 'Acme LLC' }), enrich({ value: 100, cost: 1 })]);
  assert.deepEqual(rows.map(r => [r.label, r.net]), [['Me', 200], ['Acme LLC', 200], ['No owner set', 100]]);
  assert.deepEqual(ownerRows([enrich({ value: 1, cost: 1 })]), [], 'nothing to group when no asset has an owner');
});

/* ------------------------------------------------ history with debt, quick update, timeline */
test('history records the debt balance and a change in either value or debt adds a point', () => {
  let h = nextHistory([], { value: 100, cost: 80, acquiredOn: '2022-01-01', debt: 60 }, { today: '2026-01-10', isNew: true });
  assert.deepEqual(h, [{ d: '2022-01-01', v: 80 }, { d: '2026-01-10', v: 100, b: 60 }]);
  assert.equal(nextHistory(h, { value: 100, debt: 60 }, { today: '2026-02-01' }).length, 2, 'nothing changed');
  assert.equal(nextHistory(h, { value: 100, debt: 55 }, { today: '2026-02-01' }).length, 3, 'only the debt changed');
});
test('quick update validates and keeps every other field', () => {
  const row = { id: 'a', name: 'Flat', type: 'house', place: 'Austin, TX', country: 'US', lat: 1, lon: 2, value: 100, cost: 80, gross: 5, expenses: 1, debt: 50, debtPayment: 3, ownership: 50, owner: 'Me', status: 'Occupied', acquiredOn: '2022-01-01', notes: 'n' };
  const r = quickValues(row, { value: '$120,000', debt: '45,000' });
  assert.equal(r.ok, true); assert.equal(r.value.value, 120000); assert.equal(r.value.debt, 45000); assert.equal(r.value.ownership, 50); assert.equal(r.value.name, 'Flat'); assert.equal(r.value.notes, 'n');
  assert.deepEqual(Object.keys(quickValues(row, { value: '', debt: '-1' }).errors).sort(), ['debt', 'value']);
  assert.equal(quickValues(row, { value: '10', debt: '' }).value.debt, 0, 'an empty debt means paid off');
});
test('sample histories are storable and consistent with the sample totals', () => {
  for (const a of ASSETS) { assert.equal(a.history.at(-1).v, a.fullValue); assert.ok(a.history.length >= 2); assert.ok(a.series.length === a.history.length); }
  assert.equal(sampleRows('2026-10-28')[3].history.length, ASSETS[3].history.length);
});

/* ------------------------------------------------ activity */
test('CSV import understands ownership, owner and monthly income and expenses', () => {
  const csv = 'name,type,location,value,cost,monthly income,monthly expenses,ownership,owner\nFlat,house,"Austin, TX",100000,80000,"$1,000",200,50%,Acme LLC';
  const r = previewImport(csv, { today: '2026-10-28' }); assert.equal(r.rows[0].ok, true, r.rows[0].errors.join());
  assert.deepEqual([r.rows[0].value.gross, r.rows[0].value.expenses, r.rows[0].value.ownership, r.rows[0].value.owner], [12000, 2400, 50, 'Acme LLC']);
  assert.equal(previewImport(csv.replace('50%', '150'), { today: '2026-10-28' }).rows[0].ok, false);
});
test('exports carry owner and ownership and say the figures follow the share', () => {
  const a = [enrich({ id: 'a', name: 'Flat', type: 'house', place: 'Austin, TX', kind: 'House', category: 'residential', status: 'Occupied', value: 200, cost: 100, ownership: 50, owner: 'Acme LLC' })];
  const x = new TextDecoder().decode(buildExcel(a, { today: '2026-10-28' }));
  assert.match(x, /Acme LLC/); assert.match(x, /<v>0\.5<\/v>/); assert.match(x, /Net worth by owner/); assert.match(x, /ownership share/);
  const html = reportHtml(a, { today: '2026-10-28' }); assert.match(html, /you own 50%/); assert.match(html, /Acme LLC/);
});

/* ------------------------------------------------ share links */
test('share secrets: 43 url-safe characters, stored only as a SHA-256 hash that matches the server', async () => {
  const t = makeToken(); assert.match(t, /^[A-Za-z0-9_-]{43}$/); assert.notEqual(t, makeToken());
  assert.equal(await sha256Hex(t), createHash('sha256').update(t).digest('hex'));
  assert.equal(shareUrl('abc', 'https://x.test'), 'https://x.test/share.html#t=abc');
  const now = Date.parse('2026-10-28T00:00:00Z');
  assert.equal(shareState({ revoked: true }, now), 'revoked'); assert.equal(shareState({ expiresAt: '2026-10-27T00:00:00Z' }, now), 'expired'); assert.equal(shareState({ expiresAt: null }, now), 'active');
});
