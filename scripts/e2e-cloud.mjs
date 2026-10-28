// End-to-end check of the signed-in app in a real (headless) Chrome against the local mock Supabase.
//   node scripts/e2e-cloud.mjs            (set CHROME=... if Chrome is not in the default place)
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startMock } from './mock-supabase.mjs';

const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!CHROME) { console.error('Chrome not found. Set CHROME=path'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mock = await startMock({ port: 4181, root: '.' });
const PORT = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'atlas-e2e-'))}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
const done = code => { try { chrome.kill(); } catch {} mock.close(); process.exit(code); };

let target; for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page'); } catch { await sleep(200); } }
if (!target) { console.error('could not attach to Chrome'); done(2); }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed'); return r.result.result.value; };
const until = async (expr, what, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return; } catch {} await sleep(100); } throw new Error('timeout waiting for: ' + what); };
const goto = async url => { await send('Page.navigate', { url: 'about:blank' }); await sleep(150); await send('Page.navigate', { url }); await sleep(300); };
await send('Runtime.enable'); await send('Page.enable');

let n = 0, failed = 0;
const step = async (name, fn) => { try { await fn(); console.log(`ok   ${++n}. ${name}`); } catch (e) { failed++; console.log(`FAIL ${++n}. ${name}\n       ${e.message}`); } };
const rows = async () => (await fetch(`${mock.origin}/__rows`)).json();
const click = sel => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('no ${sel}'); e.click(); return true;})()`);
const signIn = async email => {
  await goto(`${mock.origin}/app.html`);
  await until(`!document.getElementById('auth').hidden`, 'sign-in screen');
  await ev(`(()=>{const i=document.getElementById('auth-email'); i.value=${JSON.stringify(email)}; document.getElementById('auth-form').requestSubmit();})()`);
  await until(`!document.getElementById('auth-ok').hidden`, 'check-your-inbox message');
  const { url } = await (await fetch(`${mock.origin}/__link?email=${encodeURIComponent(email)}`)).json();
  await goto(url); await until(`!document.getElementById('shell').hidden`, 'dashboard');
};

await step('signed out visitor sees the sign-in screen, invalid email is rejected locally', async () => {
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth');
  await ev(`(()=>{document.getElementById('auth-email').value='nope'; document.getElementById('auth-form').requestSubmit();})()`);
  await until(`/valid email/i.test(document.getElementById('auth-err').textContent)`, 'validation message');
});
await step('magic link signs in; URL hash is cleaned; account email shown', async () => {
  await signIn('ana@example.com');
  if (await ev('location.hash')) throw new Error('hash not cleaned');
  await until(`document.getElementById('side-foot').textContent.includes('ana@example.com')`, 'email in sidebar');
  if (!(await ev(`document.getElementById('side-foot').textContent.includes('Synced')`))) throw new Error('no sync label');
});
await step('empty account shows the empty state with both actions', async () => {
  await until(`document.body.textContent.includes('Add your first asset')`, 'empty state');
  await until(`document.body.textContent.includes('Load sample data')`, 'sample button');
});
await step('"Load sample data" stores 16 sample rows for this user and shows the banner', async () => {
  await ev(`[...document.querySelectorAll('button')].find(b=>/Load sample data/.test(b.textContent)).click()`);
  await until(`!document.getElementById('app-banner').hidden`, 'sample banner');
  const r = await rows(); if (r.length !== 16 || !r.every(x => x.is_sample)) throw new Error('rows: ' + r.length);
});
await step('add an asset through the form (validation first, then save)', async () => {
  await click('#add-asset-btn'); await until(`document.getElementById('modal').open`, 'modal');
  await ev(`document.querySelector('.asset-form').requestSubmit()`);
  await until(`document.querySelectorAll('.asset-form .err:not(:empty)').length>=3`, 'validation errors');
  await ev(`(()=>{const f=document.querySelector('.asset-form'); document.querySelector('.type-card').click();
    const set=(id,v)=>{const e=document.getElementById(id); e.value=v;};
    set('f-name','Test Lake House'); set('f-place','Austin, TX'); set('f-value','685,000'); set('f-cost','520000'); set('f-gross','61200'); set('f-expenses','17360'); f.requestSubmit();})()`);
  await until(`!document.getElementById('modal').open`, 'modal closes');
  const r = (await rows()).find(x => x.name === 'Test Lake House');
  if (!r || r.is_sample || r.type !== 'house' || r.country !== 'US' || r.history.length < 1) throw new Error(JSON.stringify(r));
});
await step('edit after the access token expired: client refreshes once and the value history grows', async () => {
  await fetch(`${mock.origin}/__expire`);
  await ev(`[...document.querySelectorAll('.ac-actions .mini-btn')].find(b=>b.textContent.trim()==='Edit')?.click()`);
  // open edit through the assets table row action if the card did not offer one
  if (!(await ev(`document.getElementById('modal').open`))) {
    await ev(`[...document.querySelectorAll('[role=tab],.view-tabs button')].find(b=>/Assets/.test(b.textContent)).click()`);
    await until(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Edit')`, 'edit button');
    await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Edit').click()`);
  }
  await until(`document.getElementById('modal').open`, 'edit modal');
  const name = await ev(`document.getElementById('f-name').value`);
  await ev(`(()=>{document.getElementById('f-value').value='900000'; document.querySelector('.asset-form').requestSubmit();})()`);
  await until(`!document.getElementById('modal').open`, 'edit saved');
  const log = await (await fetch(`${mock.origin}/__log`)).json();
  if (!log.some(l => l[0] === 'refresh')) throw new Error('no token refresh happened');
  const r = (await rows()).find(x => x.name === name); if (r.value !== 900000) throw new Error('value not saved: ' + r.value);
});
const extrasState = async () => (await fetch(`${mock.origin}/__extras`)).json();
const setFile = (sel, name, text, type = 'text/plain') => ev(`(()=>{const i=document.querySelector(${JSON.stringify(sel)}); const dt=new DataTransfer(); dt.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)}, {type:${JSON.stringify(type)}})); i.files=dt.files; i.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const tab = name => ev(`[...document.querySelectorAll('.view-tabs button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(name)})).click()`);
const btn = (txt, root = 'document') => ev(`(()=>{const b=[...${root}.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(txt)})); if(!b) throw new Error('no button ${txt}'); b.click(); return true;})()`);

await step('debt: an asset with a mortgage shows net worth after debt on the map', async () => {
  await tab('Map');
  await click('#add-asset-btn'); await until(`document.getElementById('modal').open`, 'modal');
  await ev(`(()=>{document.querySelector('.type-card').click(); const set=(id,v)=>{document.getElementById(id).value=v;};
    set('f-name','Mortgaged Flat'); set('f-place','Austin, TX'); set('f-value','400000'); set('f-cost','300000'); set('f-debt','250000'); set('f-debtpay','1900'); document.querySelector('.asset-form').requestSubmit();})()`);
  await until(`!document.getElementById('modal').open`, 'saved');
  const r = (await rows()).find(x => x.name === 'Mortgaged Flat'); if (r.debt !== 250000 || r.debt_payment !== 1900) throw new Error(JSON.stringify(r));
  await until(`/Net worth .* after .* of debt/.test(document.getElementById('hero-value').textContent)`, 'net worth line');
});
await step('import CSV: preview shows ready, fixable and duplicate rows, then imports only the good ones', async () => {
  await click('#import-btn'); await until(`document.getElementById('modal').open`, 'import modal');
  const csv = 'name,type,location,value,cost,debt\nImported Loft,house,"Chicago, IL",300000,250000,120000\nImported Truck,truck,"Nashville, TN",60000,80000,0\nBroken,spaceship,"Austin, TX",1,1,0\nMortgaged Flat,house,"Austin, TX",400000,300000,250000';
  await setFile('#imp-file', 'assets.csv', csv, 'text/csv');
  await until(`document.querySelector('.imp-sum')`, 'preview');
  const sum = await ev(`document.querySelector('.imp-sum').textContent`);
  if (!/3 ready/.test(sum) || !/1 need fixes/.test(sum) || !/1 possible duplicate/.test(sum)) throw new Error('summary: ' + sum);
  await until(`/Import 2 assets/.test(document.querySelector('.modal-actions .btn-primary').textContent)`, 'import button counts only non-duplicates');
  await btn('Import 2', 'document'); await until(`!document.getElementById('modal').open`, 'import done');
  const r = await rows(); if (!r.some(x => x.name === 'Imported Loft' && x.debt === 120000 && x.history.length)) throw new Error('loft missing'); if (r.filter(x => x.name === 'Mortgaged Flat').length !== 1) throw new Error('duplicate was imported');
});
await step('documents: upload to the private bucket under the user folder, open via signed link, delete', async () => {
  await tab('Assets'); await until(`[...document.querySelectorAll('.detail-actions button')].some(b=>/^Documents/.test(b.textContent))`, 'documents button');
  await btn('Documents', 'document'); await until(`document.querySelector('.extras')`, 'extras modal');
  await setFile('#d-file', 'insurance-2026.pdf', '%PDF-1.4 test', 'application/pdf'); await ev(`document.getElementById('d-kind').value='insurance'`);
  await ev(`[...document.querySelectorAll('.extras .upload-row button')].find(b=>/Upload/.test(b.textContent)).click()`);
  await until(`document.querySelector('.doc-row')`, 'document listed');
  const x = await extrasState(); const doc = x.docs[0]; if (!doc || doc.kind !== 'insurance' || !x.files.includes(doc.path)) throw new Error(JSON.stringify(x));
  const uid = (await rows())[0].user_id; if (!doc.path.startsWith(uid + '/' + doc.asset_id + '/')) throw new Error('wrong folder ' + doc.path);
  const signed = await ev(`fetch('/storage/v1/object/sign/asset-docs/${doc.path.split('/').map(encodeURIComponent).join('/')}?token=signed-${doc.path}').then(r=>r.text())`);
  if (!/%PDF/.test(signed)) throw new Error('signed link did not return the file');
  const noToken = await ev(`fetch('/storage/v1/object/sign/asset-docs/${doc.path.split('/').map(encodeURIComponent).join('/')}').then(r=>r.status)`); if (noToken !== 401) throw new Error('unsigned link worked: ' + noToken);
  await ev(`window.confirm = () => true`); await ev(`[...document.querySelectorAll('.doc-row .mini-btn.danger')][0].click()`);
  await until(`!document.querySelector('.doc-row')`, 'document removed'); const y = await extrasState(); if (y.docs.length || y.files.length) throw new Error('file not deleted');
});
await step('reminders: add, show in the tab with a badge, mark done renews a repeating one', async () => {
  await ev(`[...document.querySelectorAll('.extras .xt-h .mini-btn')][0].click()`); await until(`document.getElementById('r-due')`, 'reminder form');
  const d = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  await ev(`(()=>{document.getElementById('r-kind').value='insurance'; document.getElementById('r-due').value=${JSON.stringify(d)}; document.getElementById('r-repeat').value='yearly'; document.querySelector('.asset-form').requestSubmit();})()`);
  await until(`document.querySelector('.rem-row')`, 'back on the asset with the reminder');
  let x = await extrasState(); if (x.rems.length !== 1 || x.rems[0].title !== 'Insurance renewal' || x.rems[0].repeat !== 'yearly') throw new Error(JSON.stringify(x.rems));
  await ev(`document.querySelector('.modal-x').click()`); await until(`!document.getElementById('modal').open`, 'closed');
  await until(`document.querySelector('.nav-badge')`, 'badge on the Reminders tab'); await until(`/reminder.* need/.test(document.getElementById('app-banner').textContent)`, 'banner');
  await tab('Reminders'); await until(`document.querySelector('.rem-chip.soon b')?.textContent === '1'`, 'one due soon');
  await btn('Done, renew', 'document'); await until(`document.querySelector('.rem-chip.upcoming b')?.textContent === '1'`, 'renewed to next year');
  x = await extrasState(); if (!x.rems[0].due_on.startsWith(String(new Date().getFullYear() + (new Date(x.rems[0].due_on).getTime() > Date.now() + 300 * 86400000 ? 0 : 1)).slice(0, 4)) && x.rems[0].done) throw new Error(JSON.stringify(x.rems));
  if (x.rems[0].done) throw new Error('a repeating reminder must not stay done');
});
await step('reports: Excel is a real .xlsx download and the PDF report opens with the net worth', async () => {
  await tab('Reports'); await until(`document.querySelector('.dl-btns')`, 'report buttons');
  await ev(`window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = b => { window.__blobs.push(b); return o(b); }`);
  await btn('Excel', 'document'); await until(`window.__blobs.length === 1`, 'xlsx blob');
  const info = await ev(`(async()=>{const b=window.__blobs[0]; const u=new Uint8Array(await b.arrayBuffer()); return {size:b.size, sig:String.fromCharCode(u[0],u[1]), type:b.type};})()`);
  if (info.sig !== 'PK' || info.size < 2000 || !/spreadsheetml/.test(info.type)) throw new Error(JSON.stringify(info));
  await btn('PDF report', 'document'); await until(`document.querySelector('iframe[title=Report]')`, 'pdf frame');
  const html = await ev(`document.querySelector('iframe[title=Report]').srcdoc`); if (!/Portfolio report/.test(html) || !/Net worth/.test(html)) throw new Error('report html');
});
await step('deleting an asset also deletes its documents and reminders', async () => {
  await tab('Assets'); await btn('Documents', 'document'); await until(`document.querySelector('.extras')`, 'modal');
  await setFile('#d-file', 'deed.pdf', '%PDF-1.4 deed', 'application/pdf'); await ev(`[...document.querySelectorAll('.extras .upload-row button')].find(b=>/Upload/.test(b.textContent)).click()`);
  await until(`document.querySelector('.doc-row')`, 'uploaded'); await ev(`document.querySelector('.modal-x').click()`); await until(`!document.getElementById('modal').open`, 'closed');
  const before = await extrasState(); if (!before.files.length) throw new Error('no file to delete');
  await ev(`[...document.querySelectorAll('.detail-actions button')].find(b=>/^Delete/.test(b.textContent)).click()`); await until(`document.getElementById('modal').open`, 'confirm');
  await ev(`document.querySelector('.danger-fill').click()`); await until(`/Asset deleted/.test(document.getElementById('toast').textContent)`, 'deleted');
  const after = await extrasState(); if (after.files.length || after.docs.length) throw new Error('files remain; toast says: ' + await ev(`document.getElementById('toast').textContent`));
});
await step('remove sample data keeps only the user\'s own asset', async () => {
  await click('#app-banner .mini-btn'); await until(`document.getElementById('app-banner').hidden`, 'banner hides');
  const r = await rows(); if (r.some(x => x.is_sample)) throw new Error('samples remain');
});
await step('another user cannot see these assets (row isolation)', async () => {
  await ev(`localStorage.clear()`);
  await signIn('bob@example.com');
  await until(`document.body.textContent.includes('Add your first asset')`, 'bob has an empty workspace');
});
await step('sign out returns to the sign-in screen and clears the session', async () => {
  await ev(`[...document.querySelectorAll('#side-foot button')].find(b=>/Sign out/.test(b.textContent)).click()`);
  await until(`!document.getElementById('auth').hidden`, 'auth after sign out');
  if (await ev(`localStorage.getItem('atlas.session.v1')`)) throw new Error('session still stored');
});
await step('no uncaught script errors during the whole run', async () => { if (errors.length) throw new Error(errors.slice(0, 3).join(' | ')); });

console.log(failed ? `\n${failed} step(s) failed` : '\nAll end-to-end steps passed');
done(failed ? 1 : 0);
