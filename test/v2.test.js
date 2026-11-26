import test from 'node:test';
import assert from 'node:assert/strict';
import { enrich, portfolio } from '../src/portfolio.js';
import { validateAsset } from '../src/asset-store.js';
import { parseCsv, previewImport, TEMPLATE_CSV } from '../src/csv-import.js';
import { buildXlsx, zip } from '../src/xlsx.js';
import { buildExcel, reportHtml } from '../src/report.js';
import { ASSETS, sampleRows } from '../src/demo-data.js';
import { quickValues, toView, nextHistory } from '../src/asset-store.js';
import { makeToken, sha256Hex, shareState } from '../src/app-share.js';
import { createHash } from 'node:crypto';

/* ------------------------------------------------ debt and net worth */
test('debt gives equity, loan-to-value and a portfolio net worth', () => {
  const a = enrich({ value: 685000, cost: 520000, debt: 310000, debtPayment: 2150 });
  assert.equal(a.equity, 375000); assert.ok(Math.abs(a.ltv - 310000 / 685000) < 1e-9);
  const under = enrich({ value: 100, cost: 100, debt: 150 }); assert.equal(under.equity, -50, 'underwater equity is negative, not hidden');
  const p = portfolio([a, under, enrich({ value: 50, cost: 40 })]);
  assert.equal(p.value, 685150); assert.equal(p.debt, 310150); assert.equal(p.netWorth, 375000); assert.equal(p.indebtedCount, 2);
  assert.equal(portfolio([]).netWorth, 0); assert.equal(portfolio([]).ltv, null);
});
test('sample portfolio carries illustrative debt and reconciles', () => {
  const p = portfolio(ASSETS); assert.equal(p.value, 13772700); assert.equal(p.debt, 5580000); assert.equal(p.netWorth, p.value - p.debt);
});
test('debt must be a non-negative number', () => {
  const base = { type: 'house', name: 'x', place: 'Austin, TX', value: '10', cost: '10', status: 'Occupied' };
  assert.equal(validateAsset({ ...base, debt: '5,000', debtPayment: '120' }).value.debt, 5000);
  assert.ok(validateAsset({ ...base, debt: '-1' }).errors.debt); assert.ok(validateAsset({ ...base, debtPayment: 'abc' }).errors.debtPayment);
});

/* ------------------------------------------------ CSV import */
test('CSV parser handles quotes, embedded commas and newlines, semicolons and BOM', () => {
  assert.deepEqual(parseCsv('﻿a,b\n"x,1","he said ""hi"""\n').rows.map(r => r.cells), [['a', 'b'], ['x,1', 'he said "hi"']]);
  assert.deepEqual(parseCsv('a;b\n1;"two\nlines"\n').rows.map(r => r.cells), [['a', 'b'], ['1', 'two\nlines']]);
});
test('the template imports cleanly and keeps debt', () => {
  const r = previewImport(TEMPLATE_CSV, { today: '2026-10-28' });
  assert.equal(r.ok, true); assert.equal(r.rows.length, 2); assert.ok(r.rows.every(x => x.ok));
  assert.equal(r.rows[0].value.debt, 310000); assert.equal(r.rows[0].value.type, 'house'); assert.equal(r.rows[1].value.country, 'US');
});
test('import maps friendly headers and types, custom places, and reports row problems', () => {
  const csv = 'Asset,Category,City,Latitude,Longitude,Country,Current Value,Purchase Price,Mortgage\nCasa Alpina,Apartment,Hallstatt,47.56,13.65,Austria,"$500,000",300000,100000\nBad row,spaceship,Austin TX,,,,1,1,\nNo cost,car,"Austin, TX",,,,5000,,\nCasa Sydney,apartment,Bondi,-33.89,151.27,Australia,900000,700000,200000';
  const r = previewImport(csv, { today: '2026-10-28' });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.rows.length, 4);
  assert.equal(r.rows[0].ok, false, 'Austria is not a supported country, so the row is rejected with a reason');
  assert.ok(r.rows[1].errors.some(e => /Unknown type/.test(e))); assert.ok(r.rows[2].errors.length);
  assert.equal(r.rows[3].ok, true); assert.equal(r.rows[3].value.country, 'AU'); assert.equal(r.rows[3].value.debt, 200000); assert.equal(r.rows[3].value.type, 'house');
});
test('import flags missing columns, empty files, oversize files and duplicates', () => {
  assert.match(previewImport('name,value\nA,1').error, /Missing columns?: .*type.*cost/);
  assert.equal(previewImport('').ok, false);
  assert.match(previewImport('a\n' + '1\n'.repeat(5), { maxRows: 3 }).error, /Import up to 3/);
  const r = previewImport(TEMPLATE_CSV, { today: '2026-10-28', existing: [{ name: 'lake house', place: 'Austin, TX' }] });
  assert.equal(r.rows[0].dupe, true); assert.equal(r.rows[1].dupe, false);
});
test('a US-format date and a status in any case are accepted', () => {
  const ok = previewImport('name,type,location,value,cost,acquired,status\nA,house,"Austin, TX",10,10,3/9/2022,occupied', { today: '2026-10-28' });
  assert.equal(ok.rows[0].value.acquiredOn, '2022-03-09'); assert.equal(ok.rows[0].value.status, 'Occupied');
});

/* ------------------------------------------------ Excel and PDF */
function unzipNames(u8) { // reads the central directory of a stored zip
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); const i = u8.length - 22; assert.equal(dv.getUint32(i, true), 0x06054b50);
  const n = dv.getUint16(i + 10, true); let o = dv.getUint32(i + 16, true); const out = [];
  for (let k = 0; k < n; k++) { const nl = dv.getUint16(o + 28, true); out.push(new TextDecoder().decode(u8.slice(o + 46, o + 46 + nl))); o += 46 + nl; }
  return out;
}
test('xlsx is a valid zip with the required parts, numbers stay numbers, text is escaped', () => {
  const u = buildXlsx([{ name: 'A/B', rows: [[{ v: 'H & <x>', s: 'head' }], [12.5, { v: 0.1, s: 'pct' }, 'ok']] }]);
  const names = unzipNames(u); for (const n of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) assert.ok(names.includes(n), n);
  const txt = new TextDecoder().decode(u);
  assert.match(txt, /<v>12\.5<\/v>/); assert.match(txt, /H &amp; &lt;x&gt;/); assert.match(txt, /name="A B"/);
  assert.equal(zip([{ name: 'a.txt', data: new TextEncoder().encode('hi') }]).length, 30 + 5 + 2 + 46 + 5 + 22);
});
test('the portfolio workbook and PDF report reconcile with portfolio()', () => {
  const x = new TextDecoder().decode(buildExcel(ASSETS, { today: '2026-10-28', sample: true }));
  assert.match(x, /Net worth \(value minus debt\)/); assert.match(x, /<v>8192700<\/v>/); assert.match(x, /Illustrative sample data/);
  const html = reportHtml(ASSETS, { today: '2026-10-28', sample: true, owner: 'a@b.co' });
  assert.match(html, /\$8,192,700/); assert.match(html, /Illustrative sample data/); assert.match(html, /a@b\.co/); assert.ok(!html.includes('—'));
  assert.match(reportHtml([], { today: '2026-10-28' }), /\$0/);
});

/* ------------------------------------------------ reminders */
test('sample rows are storable with debt', () => { const r = sampleRows('2026-10-28')[0]; assert.equal(r.debt, 310000); assert.equal(r.debtPayment, 2150); });

test('cloud update: paying a debt off writes zero, an asset that never had debt does not touch the debt columns', async () => {
  const { createCloudStore } = await import('../src/asset-store.js');
  const bodies = [];
  const cloud = { rest: async (m, p, b) => { if (m === 'GET') return [{ history: [{ d: '2022-01-01', v: 1 }] }]; bodies.push(b); return [{ id: 'x', name: 'n', type: 'house', place: 'p', country: 'US', lat: 0, lon: 0, value: 1, cost: 1, gross: 0, expenses: 0, status: 'Held', history: [] }]; } };
  const s = createCloudStore(cloud); const v = { name: 'n', type: 'house', place: 'p', country: 'US', lat: 0, lon: 0, value: 1, cost: 1, gross: 0, expenses: 0, debt: 0, debtPayment: 0, status: 'Held', acquiredOn: null, notes: null };
  await s.update('x', v, { prev: { debt: 5000, debtPayment: 100, ownership: 100, owner: '' } }); assert.equal(bodies[0].debt, 0); assert.equal(bodies[0].debt_payment, 0);
  await s.update('x', v, { prev: { debt: 0, debtPayment: 0, ownership: 100, owner: '' } }); assert.ok(!('debt' in JSON.parse(JSON.stringify(bodies[1]))) && !('debt_payment' in JSON.parse(JSON.stringify(bodies[1]))));
});

