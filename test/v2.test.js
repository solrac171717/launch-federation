import test from 'node:test';
import assert from 'node:assert/strict';
import { enrich, portfolio } from '../src/portfolio.js';
import { validateAsset } from '../src/asset-store.js';
import { parseCsv, previewImport, TEMPLATE_CSV } from '../src/csv-import.js';
import { buildXlsx, zip } from '../src/xlsx.js';
import { buildExcel, reportHtml } from '../src/report.js';
import { ASSETS, sampleRows } from '../src/demo-data.js';
import { statusOf, daysUntil, nextDue, validateReminder, shouldNotify, digestEmail, whenText } from '../src/reminders.js';
import { validateFile, safeName, completionPatch, createCloudExtras } from '../src/extras-store.js';
import { runReminders } from '../api/send-reminders.js';
import { runShare } from '../api/share.js';
import { portfolioTimeline } from '../src/networth.js';
import { activityFor } from '../src/activity.js';
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
  const p = portfolio(ASSETS); assert.equal(p.value, 11372700); assert.equal(p.debt, 4480000); assert.equal(p.netWorth, p.value - p.debt);
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
  assert.match(x, /Net worth \(value minus debt\)/); assert.match(x, /<v>6892700<\/v>/); assert.match(x, /Illustrative sample data/);
  const html = reportHtml(ASSETS, { today: '2026-10-28', sample: true, owner: 'a@b.co' });
  assert.match(html, /\$6,892,700/); assert.match(html, /Illustrative sample data/); assert.match(html, /a@b\.co/); assert.ok(!html.includes('—'));
  assert.match(reportHtml([], { today: '2026-10-28' }), /\$0/);
});

/* ------------------------------------------------ reminders */
test('reminder dates: days, status, repeat rolls forward with month-end clamping', () => {
  assert.equal(daysUntil('2026-11-04', '2026-10-28'), 7); assert.equal(daysUntil('2026-10-20', '2026-10-28'), -8);
  const r = { dueOn: '2026-11-10', notifyDays: 14, done: false };
  assert.equal(statusOf(r, '2026-10-28'), 'soon'); assert.equal(statusOf(r, '2026-09-01'), 'upcoming'); assert.equal(statusOf(r, '2026-11-11'), 'overdue'); assert.equal(statusOf({ ...r, done: true }, '2026-11-11'), 'done');
  assert.equal(nextDue('2026-01-31', 'monthly'), '2026-02-28'); assert.equal(nextDue('2024-02-29', 'yearly'), '2025-02-28'); assert.equal(nextDue('2026-11-30', 'quarterly'), '2027-02-28'); assert.equal(nextDue('2026-01-01', 'none'), '2026-01-01');
  assert.equal(whenText({ dueOn: '2026-10-29' }, '2026-10-28'), 'Due tomorrow');
});
test('reminder validation and the done/renew patch', () => {
  assert.equal(validateReminder({ kind: 'insurance', title: '', dueOn: '2026-12-01', repeat: 'yearly', notifyDays: '' }).value.title, 'Insurance renewal');
  assert.deepEqual(Object.keys(validateReminder({ kind: 'x', dueOn: 'soon', repeat: 'daily', notifyDays: '99' }).errors).sort(), ['dueOn', 'kind', 'notifyDays', 'repeat', 'title']);
  assert.deepEqual(completionPatch({ dueOn: '2026-12-01', repeat: 'yearly' }), { dueOn: '2027-12-01', done: false, lastNotifiedOn: null });
  assert.deepEqual(completionPatch({ dueOn: '2026-12-01', repeat: 'none' }), { done: true });
});
test('email rule: once when entering the window, once on the due date, weekly while overdue', () => {
  const r = { dueOn: '2026-11-10', notifyDays: 14, done: false, lastNotifiedOn: null };
  assert.equal(shouldNotify(r, '2026-10-20'), false, 'outside the window');
  assert.equal(shouldNotify(r, '2026-10-27'), true);
  assert.equal(shouldNotify({ ...r, lastNotifiedOn: '2026-10-27' }, '2026-10-28'), false, 'already told');
  assert.equal(shouldNotify({ ...r, lastNotifiedOn: '2026-10-27' }, '2026-11-10'), true, 'due today');
  assert.equal(shouldNotify({ ...r, lastNotifiedOn: '2026-11-10' }, '2026-11-12'), false);
  assert.equal(shouldNotify({ ...r, lastNotifiedOn: '2026-11-10' }, '2026-11-17'), true, 'a week overdue');
  assert.equal(shouldNotify({ ...r, done: true }, '2026-11-10'), false);
  const m = digestEmail([{ title: 'Insurance renewal', assetName: 'Lake <House>', dueOn: '2026-11-10' }], { today: '2026-11-12', appUrl: 'https://x.test/app.html' });
  assert.match(m.subject, /overdue/); assert.match(m.text, /overdue by 2 days/); assert.match(m.html, /Lake &lt;House&gt;/);
});
test('daily email job: needs config, groups per person, marks only what was sent, survives failures', async () => {
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', RESEND_API_KEY: 're_1', REMINDER_FROM: 'Owned Map <a@x.test>' };
  assert.equal((await runReminders({ env: {}, fetchImpl: async () => { throw new Error('no network'); } })).status, 503);
  const rows = [
    { id: 'r1', user_id: 'u1', title: 'Insurance', kind: 'insurance', due_on: '2026-11-01', notify_days: 14, last_notified_on: null, assets: { name: 'House' } },
    { id: 'r2', user_id: 'u1', title: 'Tax', kind: 'tax', due_on: '2026-11-05', notify_days: 14, last_notified_on: null, assets: { name: 'Car' } },
    { id: 'r3', user_id: 'u2', title: 'Survey', kind: 'inspection', due_on: '2026-11-02', notify_days: 14, last_notified_on: null, assets: { name: 'Boat' } },
    { id: 'r4', user_id: 'u1', title: 'Later', kind: 'other', due_on: '2027-05-01', notify_days: 14, last_notified_on: null, assets: { name: 'House' } },
  ];
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    const ok = b => ({ ok: true, json: async () => b });
    if (url.includes('/rest/v1/asset_reminders?done=eq.false')) return ok(rows);
    if (url.includes('/auth/v1/admin/users/u1')) return ok({ email: 'one@x.test' });
    if (url.includes('/auth/v1/admin/users/u2')) return ok({ email: 'two@x.test' });
    if (url === 'https://api.resend.com/emails') return JSON.parse(init.body).to[0] === 'two@x.test' ? { ok: false, json: async () => ({}) } : ok({ id: 'm' });
    if (init.method === 'PATCH') return ok(null);
    return { ok: false, json: async () => ({}) };
  };
  const r = await runReminders({ env, fetchImpl: f, today: '2026-10-28' });
  assert.deepEqual(r.body, { ok: true, reminders: 3, people: 2, emails: 1, failed: 1 });
  const mails = calls.filter(c => c.url === 'https://api.resend.com/emails'); assert.equal(mails.length, 2);
  assert.match(JSON.parse(mails[0].body).text, /Insurance \(House\)/); assert.match(JSON.parse(mails[0].body).text, /Tax \(Car\)/);
  const patches = calls.filter(c => c.method === 'PATCH'); assert.equal(patches.length, 1); assert.match(patches[0].url, /id=in\.\(r1,r2\)/);
});

/* ------------------------------------------------ documents */
test('file rules and safe storage names', () => {
  assert.equal(validateFile({ name: 'deed.pdf', size: 1000 }), null);
  assert.match(validateFile({ name: 'big.pdf', size: 11 * 1024 * 1024 }), /10 MB/); assert.match(validateFile({ name: 'run.exe', size: 5 }), /PDF, image/); assert.match(validateFile({ name: 'a.pdf', size: 0 }), /empty/); assert.ok(validateFile(null));
  assert.equal(safeName('../../Seguro Casa (2026).pdf'), 'Seguro-Casa-2026.pdf');
});
test('cloud documents: upload goes to the user folder, row is written, failed row removes the file', async () => {
  const calls = []; let failRow = false;
  const cloud = {
    user: () => ({ id: 'u1' }),
    upload: async (b, p, f, m) => { calls.push(['upload', b, p, m]); },
    removeObject: async (b, p) => { calls.push(['remove', b, p]); },
    signedUrl: async (b, p) => `https://x/${b}/${p}?t=1`,
    rest: async (m, path, body) => { calls.push([m, path, body]); if (failRow && m === 'POST') throw new Error('db down'); return m === 'POST' ? [{ id: 'd1', asset_id: body.asset_id, name: body.name, kind: body.kind, path: body.path, size: body.size, mime: body.mime, created_at: 't' }] : []; },
  };
  const ex = createCloudExtras(cloud);
  const d = await ex.addDoc('a1', { name: 'Seguro 2026.pdf', size: 2048, type: 'application/pdf' }, 'insurance');
  assert.match(d.path, /^u1\/a1\/.+-Seguro-2026\.pdf$/); assert.equal(calls[0][1], 'asset-docs'); assert.equal(calls[1][2].kind, 'insurance');
  assert.match(await ex.docUrl(d), /^https:\/\/x\/asset-docs\/u1\/a1\//);
  failRow = true; calls.length = 0;
  await assert.rejects(() => ex.addDoc('a1', { name: 'x.pdf', size: 5, type: 'application/pdf' }), /db down/);
  assert.equal(calls.at(-1)[0], 'remove', 'orphaned file is cleaned up');
  calls.length = 0; await ex.removeDoc(d); assert.equal(calls[0][0], 'DELETE'); assert.equal(calls[1][0], 'remove');
});
test('sample rows are storable with debt', () => { const r = sampleRows('2026-10-28')[0]; assert.equal(r.debt, 310000); assert.equal(r.debtPayment, 2150); });

test('cloud update: paying a debt off writes zero, an asset that never had debt does not touch the debt columns', async () => {
  const { createCloudStore } = await import('../src/asset-store.js');
  const bodies = [];
  const cloud = { rest: async (m, p, b) => { if (m === 'GET') return [{ history: [{ d: '2022-01-01', v: 1 }] }]; bodies.push(b); return [{ id: 'x', name: 'n', type: 'house', place: 'p', country: 'US', lat: 0, lon: 0, value: 1, cost: 1, gross: 0, expenses: 0, status: 'Held', history: [] }]; } };
  const s = createCloudStore(cloud); const v = { name: 'n', type: 'house', place: 'p', country: 'US', lat: 0, lon: 0, value: 1, cost: 1, gross: 0, expenses: 0, debt: 0, debtPayment: 0, status: 'Held', acquiredOn: null, notes: null };
  await s.update('x', v, { prev: { debt: 5000, debtPayment: 100, ownership: 100, owner: '' } }); assert.equal(bodies[0].debt, 0); assert.equal(bodies[0].debt_payment, 0);
  await s.update('x', v, { prev: { debt: 0, debtPayment: 0, ownership: 100, owner: '' } }); assert.ok(!('debt' in JSON.parse(JSON.stringify(bodies[1]))) && !('debt_payment' in JSON.parse(JSON.stringify(bodies[1]))));
});
