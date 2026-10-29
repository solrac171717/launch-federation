import test from 'node:test';
import assert from 'node:assert/strict';
import { setRates, toUsd, loadRates, formatIn, currencies } from '../src/fx.js';
import { amortize, paymentFor, balanceAfter, driftFactor, projectAsset, projectPortfolio, concentration, breaches, yieldRows, goalStatus, saleSim } from '../src/finance.js';
import { enrich } from '../src/portfolio.js';
import { validateAsset, toView, fromDb, quickValues } from '../src/asset-store.js';
import { standardFor, validateReminder } from '../src/reminders.js';
import { cleanSettings, createLocalSettings, DEFAULTS } from '../src/settings-store.js';
import { isVin, fromNhtsa } from '../src/vin.js';
import { runVin } from '../api/vin.js';
import { emergencyHtml } from '../src/emergency.js';
import { runShare } from '../api/share.js';
import { normalizeExtraction } from '../src/extract-core.js';

const RATES = { date: '2026-10-28', rates: { EUR: 0.5, GBP: 0.8, JPY: 100 } };
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const asset = (o = {}) => ({ id: 'a', name: 'A', type: 'house', place: 'Austin, TX', country: 'US', lat: 30, lon: -97, value: 400000, cost: 300000, gross: 24000, expenses: 6000, debt: 0, debtPayment: 0, ownership: 100, owner: '', status: 'Held', history: [], createdAt: '2026-01-01T00:00:00Z', ...o });

test('fx: dollars per unit, USD is always 1, unknown currencies have no rate', () => {
  setRates(RATES);
  assert.equal(toUsd('USD'), 1); assert.equal(toUsd('EUR'), 2); assert.equal(toUsd('JPY'), 0.01); assert.equal(toUsd('XYZ'), null);
  assert.deepEqual(currencies(), ['USD', 'EUR', 'GBP', 'JPY']);
  assert.equal(formatIn(450000, 'EUR'), '€450,000'); assert.equal(formatIn(-1200, 'USD'), '-$1,200'); assert.equal(formatIn(5, 'SEK'), 'SEK 5');
});

test('fx: fetches once a day, caches, and falls back to the cache without inventing rates', async () => {
  const st = mem(); let calls = 0;
  const ok = async () => { calls++; return { ok: true, json: async () => ({ date: '2026-10-28', rates: { EUR: 0.9, bad: 1, USD: 0 } }) }; };
  const now = Date.parse('2026-10-29T10:00:00Z');
  setRates({ rates: {} });
  const a = await loadRates({ fetchImpl: ok, storage: st, now });
  assert.equal(a.ok, true); assert.equal(a.stale, false); assert.equal(toUsd('EUR'), 1 / 0.9); assert.equal(calls, 1);
  const b = await loadRates({ fetchImpl: ok, storage: st, now }); assert.equal(b.source, 'cache'); assert.equal(calls, 1, 'second load the same day does not fetch');
  const down = async () => { throw new Error('offline'); };
  const c = await loadRates({ fetchImpl: down, storage: st, now: now + 3 * 86400000 }); // a later day, network down
  assert.equal(c.ok, true); assert.equal(c.stale, true); assert.equal(toUsd('EUR'), 1 / 0.9);
  setRates({ rates: {} });
  const d = await loadRates({ fetchImpl: down, storage: mem(), now }); assert.equal(d.ok, false); assert.equal(toUsd('EUR'), null);
  setRates(RATES);
});

test('enrich: other currencies are converted, shares and drift are applied, a missing rate is flagged', () => {
  setRates(RATES);
  const e = enrich(asset({ currency: 'EUR', value: 100000, cost: 80000, debt: 20000, gross: 6000, ownership: 50 }));
  assert.equal(e.value, 100000 * 2 * 0.5); assert.equal(e.cost, 80000); assert.equal(e.debt, 20000); assert.equal(e.gross, 6000); assert.equal(e.currency, 'EUR'); assert.equal(e.localValue, 50000);
  assert.equal(enrich(asset({ currency: 'XYZ' })).fxMissing, true);
  assert.equal(enrich(asset({ currency: 'XYZ' })).value, 400000, 'without a rate nothing is silently rescaled');
  const car = enrich(asset({ value: 50000, annualChange: -10, valueAsOf: '2025-10-29', today: '2026-10-29' }));
  assert.ok(Math.abs(car.value - 45000) < 1, String(car.value)); assert.ok(car.drift < 1);
  assert.equal(enrich(asset({ value: 50000, annualChange: -10 })).value, 50000, 'no date, no drift');
});

test('toView: the chart follows currency and share, and adds a point when the value has drifted', () => {
  setRates(RATES);
  const v = toView(asset({ currency: 'EUR', value: 100000, history: [{ d: '2026-01-01', v: 90000 }, { d: '2026-02-01', v: 100000 }] }));
  assert.equal(v.series[0].v, 180000); assert.equal(v.series[1].v, 200000);
  const old = toView(asset({ value: 1000, annualChange: -50, history: [{ d: '2024-01-01', v: 1000 }, { d: '2024-06-01', v: 1000 }] }));
  assert.equal(old.series.length, 3); assert.ok(old.series[2].v < 1000);
});

test('validateAsset: currency, loan rate and yearly change', () => {
  const base = { type: 'car', name: 'Car', customPlace: true, placeName: 'Madrid', country: 'ES', lat: 40, lon: -3, value: 20000, cost: 25000, status: 'Garaged' };
  const ok = validateAsset({ ...base, currency: 'eur', debtRate: '4.5', annualChange: '-12' });
  assert.equal(ok.ok, true); assert.equal(ok.value.currency, 'EUR'); assert.equal(ok.value.debtRate, 4.5); assert.equal(ok.value.annualChange, -12);
  assert.equal(validateAsset(base).value.currency, 'USD');
  assert.ok(validateAsset({ ...base, currency: 'euros' }).errors.currency);
  assert.ok(validateAsset({ ...base, debtRate: '150' }).errors.debtRate); assert.ok(validateAsset({ ...base, annualChange: '-95' }).errors.annualChange); assert.ok(validateAsset({ ...base, annualChange: 'abc' }).errors.annualChange);
});

test('rows: the new columns round-trip, and quickValues keeps them (and can set the loan terms)', () => {
  const row = fromDb({ id: '1', name: 'x', type: 'house', value: 1, cost: 1, gross: 0, expenses: 0, currency: 'GBP', debt_rate: 3.2, annual_change: 2 });
  assert.equal(row.currency, 'GBP'); assert.equal(row.debtRate, 3.2); assert.equal(row.annualChange, 2); assert.equal(fromDb({ id: '2', name: 'y', type: 'car', value: 1, cost: 1, gross: 0, expenses: 0 }).currency, 'USD');
  const q = quickValues(row, { value: 5, debt: 2, debtPayment: 100, debtRate: 6 });
  assert.equal(q.ok, true); assert.equal(q.value.currency, 'GBP'); assert.equal(q.value.annualChange, 2); assert.equal(q.value.debtPayment, 100); assert.equal(q.value.debtRate, 6);
  assert.equal(quickValues(row, { value: 5, debt: 2 }).value.debtRate, 3.2);
  assert.ok(quickValues(row, { value: 5, debt: 2, debtRate: 500 }).errors.debtRate);
});

test('loans: payment, payoff date, interest, extra payments, and loans that never end', () => {
  assert.ok(Math.abs(paymentFor(200000, 6, 360) - 1199.1) < 0.1);
  const base = amortize({ balance: 200000, annualRatePct: 6, payment: 1199.1, today: '2026-01-15' });
  assert.equal(base.ok, true); assert.ok(Math.abs(base.months - 360) <= 1); assert.ok(Math.abs(base.totalInterest - 231676) < 400); assert.equal(base.payoff.slice(0, 4), '2056');
  const fast = amortize({ balance: 200000, annualRatePct: 6, payment: 1199.1, extra: 300, today: '2026-01-15' });
  assert.ok(fast.months < 280 && fast.totalInterest < base.totalInterest - 60000);
  assert.equal(amortize({ balance: 100000, annualRatePct: 12, payment: 900 }).reason, 'too-low');
  assert.equal(amortize({ balance: 1000, annualRatePct: 0, payment: 250 }).months, 4);
  assert.equal(amortize({ balance: 0, payment: 10 }).months, 0); assert.equal(amortize({ balance: 10, payment: 0 }).reason, 'no-payment');
  assert.ok(Math.abs(balanceAfter({ balance: 200000, annualRatePct: 6, payment: 1199.1 }, 12) - 197544) < 60);
  assert.equal(balanceAfter({ balance: 1000, annualRatePct: 0, payment: 100 }, 3), 700);
  assert.equal(balanceAfter({ balance: 1000, annualRatePct: 5, payment: 0 }, 12), 1000, 'no payment known: the balance is not guessed');
});

test('projections: a yearly rate moves the value, a modelled loan is paid down, and the rest stays put', () => {
  assert.ok(Math.abs(driftFactor(10, 365) - 1.1) < 1e-9); assert.equal(driftFactor(0, 500), 1);
  const a = { value: 100000, debt: 50000, debtPayment: 500, debtRate: 5, annualChange: 3 };
  const p = projectAsset(a, 5); assert.ok(Math.abs(p.value - 100000 * 1.03 ** 5) < 1); assert.ok(p.debt < 50000 && p.debt > 0);
  const flat = projectAsset({ value: 10, debt: 5, debtPayment: 0 }, 10); assert.deepEqual(flat, { value: 10, debt: 5, net: 5 });
  const t = projectPortfolio([a, { value: 10, debt: 0 }], 1); assert.ok(t.net > 0 && t.value > 100010);
});

test('concentration: shares, the warning level, and a lone asset is not flagged', () => {
  const list = [asset({ id: 'a', name: 'Big', value: 800000 }), asset({ id: 'b', name: 'Small', value: 200000, country: 'ES' })].map(a => enrich({ ...a, category: 'residential' })).map(a => ({ ...a, category: 'residential' }));
  const c = concentration(list);
  assert.equal(c.asset[0].share, 0.8); assert.equal(c.country[0].label, 'United States');
  const hot = breaches(c, 40); assert.ok(hot.some(x => x.by === 'asset' && x.label === 'Big')); assert.ok(hot.some(x => x.by === 'country' && x.label === 'United States')); assert.ok(!hot.some(x => x.by === 'category'), 'a single kind of asset is not a spread to warn about');
  assert.deepEqual(breaches(concentration([list[0]]), 40), []); assert.deepEqual(breaches(c, 95), []);
});

test('returns: net yield ranking, cash flow after loan payments, payback', () => {
  const rows = yieldRows([enrich(asset({ id: 'a', name: 'A', value: 400000, cost: 300000, gross: 24000, expenses: 6000, debtPayment: 500 })), enrich(asset({ id: 'b', name: 'B', gross: 0 })), enrich(asset({ id: 'c', name: 'C', value: 100000, cost: 100000, gross: 10000, expenses: 0 }))]);
  assert.deepEqual(rows.map(r => r.id), ['c', 'a', 'b']);
  const a = rows[1]; assert.equal(a.netYield, 18000 / 400000); assert.equal(a.cashFlow, 18000 - 6000); assert.equal(a.payback, 300000 / 18000); assert.equal(rows[2].netYield, null);
});

test('goal: progress, years to reach it from the rates entered, and the date check', () => {
  const list = [enrich(asset({ value: 500000, debt: 100000, annualChange: 5 }))];
  const g = goalStatus(list, { target: 800000, date: '' }, { today: '2026-10-29' });
  assert.equal(g.now, 400000); assert.equal(g.pct, 0.5); assert.equal(g.remaining, 400000); assert.ok(g.yearsToReach > 8 && g.yearsToReach < 16, String(g.yearsToReach));
  assert.equal(goalStatus(list, { target: 300000 }).reached, true); assert.equal(goalStatus(list, { target: null }), null);
  const flat = goalStatus([enrich(asset({ value: 500000, debt: 100000 }))], { target: 800000, date: '2028-10-29' }, { today: '2026-10-29' });
  assert.equal(flat.modelled, false); assert.equal(flat.yearsToReach, null); assert.equal(flat.onTrack, null); assert.ok(flat.neededPerMonth > 0);
  assert.equal(goalStatus(list, { target: 420000, date: '2027-10-29' }, { today: '2026-10-29' }).onTrack, true);
});

test('sale simulator: costs, tax only on a gain, loan payoff, net worth effect', () => {
  const a = enrich(asset({ value: 400000, cost: 300000, debt: 100000 }));
  const r = saleSim(a, { costsPct: 5, taxPct: 20 });
  assert.equal(r.costs, 20000); assert.equal(r.gain, 80000); assert.equal(r.tax, 16000); assert.equal(r.net, 400000 - 20000 - 16000 - 100000); assert.equal(r.netWorthChange, -36000);
  const loss = saleSim(a, { price: 250000, costsPct: 5, taxPct: 20 }); assert.equal(loss.tax, 0); assert.equal(loss.gain < 0, true);
  assert.equal(saleSim(enrich(asset({ value: 100000, debt: 200000 })), { costsPct: 0, taxPct: 0 }).underwater, true);
});

test('the usual reminders: per kind of asset, skipping what exists, dates in the future, all valid', () => {
  const car = standardFor('car', [], '2026-10-29');
  assert.ok(car.length >= 4 && car.some(r => r.kind === 'inspection') && car.every(r => r.repeat === 'yearly' && r.dueOn > '2026-10-29'));
  assert.ok(car.every(r => validateReminder({ ...r, notifyDays: 14 }, { today: '2026-10-29' }).ok));
  assert.ok(standardFor('house', []).some(r => r.kind === 'tax')); assert.ok(standardFor('aircraft', []).some(r => /Annual inspection/.test(r.title))); assert.ok(standardFor('sailboat', []).some(r => /survey/i.test(r.title)));
  const left = standardFor('car', [{ title: 'vehicle insurance renewal' }]); assert.equal(left.length, car.length - 1);
  assert.deepEqual(standardFor('unknown', []), []);
});

test('settings are cleaned: limits, goal, contacts, and nothing unknown gets through', () => {
  const s = cleanSettings({ concentrationLimit: '55', goal: { target: '$5,000,000', date: '2030-01-01' }, sale: { costsPct: 7, taxPct: 99 }, contacts: [{ role: 'Lawyer', name: ' Ana ', phone: '1', email: 'a@b.co', evil: 1 }, { role: 'x' }], emergencyNote: 'Keys in the safe', admin: true });
  assert.equal(s.concentrationLimit, 55); assert.equal(s.goal.target, 5000000); assert.equal(s.sale.costsPct, 7); assert.equal(s.sale.taxPct, DEFAULTS.sale.taxPct, 'out of range falls back');
  assert.deepEqual(s.contacts, [{ role: 'Lawyer', name: 'Ana', phone: '1', email: 'a@b.co' }]); assert.equal(s.admin, undefined);
  assert.deepEqual(cleanSettings(null).goal, { target: null, date: '' }); assert.equal(cleanSettings({ concentrationLimit: 2 }).concentrationLimit, 40);
  assert.equal(cleanSettings({ contacts: Array.from({ length: 30 }, (_, i) => ({ name: 'n' + i })) }).contacts.length, 12);
});

test('settings on this device persist between loads', async () => {
  const st = mem(), a = createLocalSettings(st);
  await a.save({ goal: { target: 1000000, date: '' } });
  assert.equal((await createLocalSettings(st).get()).goal.target, 1000000);
  await a.save({ concentrationLimit: 30 }); const s = await a.get(); assert.equal(s.concentrationLimit, 30); assert.equal(s.goal.target, 1000000, 'saving one thing keeps the rest');
});

test('VIN: validation and the decoder answer', async () => {
  assert.equal(isVin('1HGCM82633A004352'), true); assert.equal(isVin(' 1hgcm82633a004352 '), true); assert.equal(isVin('1HGCM82633A00435I'), false); assert.equal(isVin('123'), false);
  const d = fromNhtsa({ Make: 'HONDA', Model: 'Accord', ModelYear: '2003', Trim: 'EX', VehicleType: 'PASSENGER CAR', BodyClass: 'Coupe', ErrorCode: '0', PlantCountry: 'UNITED STATES (USA)' }, '1HGCM82633A004352');
  assert.equal(d.name, '2003 Honda Accord'); assert.equal(d.type, 'car'); assert.equal(d.checkDigitOk, true); assert.ok(d.details.includes('Built in United States'));
  assert.equal(fromNhtsa({ Make: 'X', Model: 'Y', ErrorCode: '1' }, 'v').checkDigitOk, false); assert.equal(fromNhtsa({ Make: '' }, 'v'), null);
  assert.equal(fromNhtsa({ Make: 'YAMAHA', Model: 'R1', VehicleType: 'MOTORCYCLE', ErrorCode: '0' }, 'v').type, 'motorcycle');
  assert.equal((await runVin({ vin: 'bad' })).status, 400);
  const fake = async url => ({ ok: true, json: async () => ({ Results: [{ Make: 'FORD', Model: 'F-150', ModelYear: '2020', VehicleType: 'TRUCK', ErrorCode: '0' }] }), url });
  const r = await runVin({ vin: '1FTEW1EP5LFA12345', fetchImpl: fake }); assert.equal(r.status, 200); assert.equal(r.body.type, 'truck'); assert.equal(r.body.name, '2020 Ford F-150');
  assert.equal((await runVin({ vin: '1FTEW1EP5LFA12345', fetchImpl: async () => ({ ok: true, json: async () => ({ Results: [{ Make: '' }] }) }) })).status, 404);
  assert.equal((await runVin({ vin: '1FTEW1EP5LFA12345', fetchImpl: async () => { throw new Error('x'); } })).status, 502);
});

test('emergency sheet: lists assets, places, papers and contacts, and escapes what people typed', () => {
  setRates(RATES);
  const a = enrich({ ...asset({ id: 'h', name: 'Lake <House>', currency: 'EUR', value: 200000, debt: 50000, debtPayment: 900, owner: 'Acme & Co', notes: 'Spare keys at the notary' }), category: 'residential', kind: 'House or apartment' });
  const html = emergencyHtml({ assets: [{ ...a, kind: 'House or apartment' }], docs: [{ assetId: 'h', name: 'deed.pdf', kind: 'deed' }], reminders: [{ assetId: 'h', title: 'Insurance renewal', dueOn: '2026-12-01', done: false }, { assetId: 'h', title: 'Old', dueOn: '2025-01-01', done: true }],
    settings: { contacts: [{ role: 'Lawyer', name: 'Ana <b>', phone: '+34 600', email: 'ana@x.es' }], emergencyNote: 'Start with the lawyer' }, today: '2026-10-29', owner: 'carlos@x.es' });
  assert.ok(html.includes('Lake &lt;House&gt;') && !html.includes('Lake <House>')); assert.ok(html.includes('Ana &lt;b&gt;')); assert.ok(html.includes('deed.pdf') && html.includes('Deed or title'));
  assert.ok(html.includes('Insurance renewal') && !html.includes('>Old<')); assert.ok(html.includes('Start with the lawyer') && html.includes('+34 600') && html.includes('Acme &amp; Co'));
  assert.ok(html.includes('€200,000'), 'shows the amount as entered'); assert.ok(html.includes('30.0000, -97.0000'));
  assert.ok(emergencyHtml({ assets: [], settings: {} }).includes('No contacts added yet'));
});

test('share API: returns only public columns, including the new ones, and works before the migration', async () => {
  const row = { id: 'a', user_id: 'SECRET', name: 'x', type: 'house', value: 1, cost: 1, currency: 'EUR', debt_rate: 4, annual_change: 2, debt: 5, debt_payment: 1, history: [{ d: '2026-01-01', v: 1, b: 5 }], password_hash: 'no' };
  const calls = [];
  const fetchImpl = async url => { calls.push(String(url)); if (String(url).includes('asset_shares')) return { ok: true, json: async () => [{ id: 's', user_id: 'u', label: 'Acct', include_debt: false, expires_at: null, revoked: false }] }; if (String(url).includes('/assets')) return { ok: true, json: async () => [row] }; return { ok: true, json: async () => [] }; };
  const r = await runShare({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }, fetchImpl, token: 'a'.repeat(43) });
  assert.equal(r.status, 200); const x = r.body.assets[0];
  assert.equal(x.currency, 'EUR'); assert.equal(x.annual_change, 2); assert.equal(x.user_id, undefined); assert.equal(x.password_hash, undefined);
  assert.equal(x.debt, 0); assert.equal(x.debt_rate, 0); assert.equal(x.history[0].b, undefined, 'debt hidden when the owner chose so');
  assert.ok(calls.some(u => u.includes('select=*')), 'does not name columns that may not exist yet');
});

test('autofill sets the currency, and rates are not applied twice', () => {
  const r = normalizeExtraction({ documentKind: 'purchase_deed', assetType: 'house', name: 'Flat', addressLine: 'Calle 1', city: 'Madrid', countryCode: 'ES', currency: 'eur', purchasePrice: 300000, confidence: 'high' }, null);
  assert.equal(r.fields.currency, 'EUR'); assert.equal(r.fields.cost, 300000);
});
