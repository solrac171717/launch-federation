import test from 'node:test';
import assert from 'node:assert/strict';
import {
  positionMetrics, portfolioTotals, groupBy, byClass, tone, fmtPct, fmtMoney,
  fmtSigned, seriesChange, validateHolding, toCsv,
} from '../src/calc.js';

const H = (o) => ({ quantity: 1, costPerUnit: 100, price: 150, class: 'equity', countryId: '840', ...o });

test('positionMetrics computes value, cost and pnl', () => {
  const m = positionMetrics(H({ quantity: 10, costPerUnit: 100, price: 120 }));
  assert.equal(m.cost, 1000);
  assert.equal(m.value, 1200);
  assert.equal(m.pnl, 200);
  assert.equal(m.pnlPct, 0.2);
});

test('unpriced holding has null value and is flagged', () => {
  const m = positionMetrics(H({ price: null }));
  assert.equal(m.value, null);
  assert.equal(m.priced, false);
});

test('portfolioTotals carries unpriced holdings at cost and counts them', () => {
  const t = portfolioTotals([H({ quantity: 2, price: 150 }), H({ price: null, costPerUnit: 50 })]);
  assert.equal(t.value, 300 + 50);
  assert.equal(t.cost, 200 + 50);
  assert.equal(t.unpriced, 1);
  assert.equal(t.pnl, 100);
});

test('portfolioTotals on empty portfolio is zeroed with null pct', () => {
  const t = portfolioTotals([]);
  assert.deepEqual([t.value, t.cost, t.pnl, t.pnlPct], [0, 0, 0, null]);
});

test('groupBy shares sum to 1 and sort descending', () => {
  const g = byClass([H({ price: 100 }), H({ class: 'crypto', price: 300 })]);
  assert.equal(g[0].key, 'crypto');
  assert.ok(Math.abs(g.reduce((s, x) => s + x.share, 0) - 1) < 1e-12);
  assert.equal(groupBy([], h => h.class).length, 0);
});

test('tone classifies sign with neutral band', () => {
  assert.equal(tone(5), 'pos');
  assert.equal(tone(-5), 'neg');
  assert.equal(tone(0), 'neu');
  assert.equal(tone(null), 'neu');
});

test('formatters', () => {
  assert.equal(fmtPct(0.1234, { sign: true }), '+12.34%');
  assert.equal(fmtPct(-0.05, { sign: true }), '−5%');
  assert.equal(fmtMoney(1234.5), '$1,234.50');
  assert.equal(fmtMoney(null), '-');
  assert.equal(fmtSigned(-10), '−$10.00');
});

test('seriesChange', () => {
  assert.equal(seriesChange([{ t: 1, v: 100 }]), null);
  const c = seriesChange([{ t: 1, v: 100 }, { t: 2, v: 125 }]);
  assert.equal(c.abs, 25);
  assert.equal(c.pct, 0.25);
});

test('validateHolding accepts good input and rejects bad', () => {
  const good = validateHolding({ name: ' Apple ', symbol: 'aapl', class: 'equity', countryId: '840', quantity: '3', costPerUnit: '10', price: '' });
  assert.ok(good.ok);
  assert.equal(good.value.symbol, 'AAPL');
  assert.equal(good.value.price, null);
  const bad = validateHolding({ name: '', class: 'x', countryId: '', quantity: '0', costPerUnit: '' });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['class', 'costPerUnit', 'countryId', 'name', 'quantity']);
});

test('toCsv escapes quotes, commas and formula injection', () => {
  const cols = [{ label: 'A', get: r => r.a }, { label: 'B', get: r => r.b }];
  const csv = toCsv([{ a: 'x,"y"', b: '=SUM(A1)' }, { a: 1, b: null }], cols);
  assert.equal(csv, ['A,B', '"x,""y""",\'=SUM(A1)', '1,'].join('\r\n'));
});
