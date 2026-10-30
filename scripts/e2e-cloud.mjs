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
const PW = 'correct-horse-9';
const OWNER = 'carlosmartinezhold@gmail.com', OWNER_PW = 'e2e-owner-pw';
const makeUser = email => fetch(`${mock.origin}/__user?email=${encodeURIComponent(email)}&password=${PW}`);
const fillLogin = (email, pw) => ev(`(()=>{document.getElementById('auth-email').value=${JSON.stringify(email)}; document.getElementById('auth-password').value=${JSON.stringify(pw)}; document.getElementById('auth-form').requestSubmit();})()`);
const signIn = async email => {
  await makeUser(email);
  await goto(`${mock.origin}/app.html`);
  await until(`!document.getElementById('auth').hidden`, 'sign-in screen');
  await fillLogin(email, PW);
  await until(`!document.getElementById('shell').hidden`, 'dashboard');
  await ev(`document.getElementById('modal').open && document.querySelector('.wizard .modal-x')?.click()`);
};

await step('signed out visitor sees the sign-in screen, invalid email is rejected locally', async () => {
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth');
  await ev(`(()=>{document.getElementById('auth-email').value='nope'; document.getElementById('auth-form').requestSubmit();})()`);
  await until(`/valid email/i.test(document.getElementById('auth-err').textContent)`, 'validation message');
});
await step('wrong password and unknown email get the same message; nobody can sign up', async () => {
  await makeUser('ana@example.com');
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth');
  await fillLogin('ana@example.com', 'wrong'); await until(`/Incorrect email or password/.test(document.getElementById('auth-err').textContent)`, 'wrong password message');
  await fillLogin('stranger@example.com', PW); await until(`/Incorrect email or password/.test(document.getElementById('auth-err').textContent)`, 'unknown email message');
  if (!(await ev(`document.getElementById('auth').hidden === false`))) throw new Error('left the sign-in screen');
});
await step('the owner signs in with the fixed password without any Supabase setup, and becomes Super admin', async () => {
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth');
  await fillLogin(OWNER, OWNER_PW); await until(`!document.getElementById('shell').hidden`, 'dashboard');
  await until(`document.getElementById('side-foot').textContent.includes('Super admin')`, 'super admin label');
  await ev(`localStorage.clear()`);
});
await step('password signs in; account email shown', async () => {
  await signIn('ana@example.com');
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
  await ev(`[...document.querySelectorAll('.extras .xt-h .mini-btn')].find(b => b.textContent.includes('+ Add reminder')).click()`); await until(`document.getElementById('r-due')`, 'reminder form');
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
const asset = async name => (await rows()).find(x => x.name === name);
await step('shared ownership and monthly figures: the form stores yearly amounts, the share and the owner', async () => {
  await tab('Map'); await click('#add-asset-btn'); await until(`document.getElementById('modal').open`, 'modal');
  await ev(`(()=>{document.querySelector('.type-card').click(); const set=(id,v)=>{document.getElementById(id).value=v;};
    set('f-name','Shared Flat'); set('f-place','Austin, TX'); set('f-value','400000'); set('f-cost','300000'); set('f-gross','1000'); set('f-expenses','200'); set('f-debt','100000'); set('f-debtpay','900'); set('f-own','50'); set('f-owner','Acme LLC');
    if (document.getElementById('f-period').value !== 'month') throw new Error('new assets should default to monthly entry'); document.querySelector('.asset-form').requestSubmit();})()`);
  await until(`!document.getElementById('modal').open`, 'saved');
  const r = await asset('Shared Flat'); if (r.gross !== 12000 || r.expenses !== 2400 || r.ownership !== 50 || r.owner !== 'Acme LLC' || r.debt !== 100000) throw new Error(JSON.stringify(r));
  await until(`/You own 50% of \\$400,000/.test(document.getElementById('hero-sel').textContent)`, 'share shown on the card');
});
await step('switching the form to per year converts what was typed and edit shows yearly figures', async () => {
  await btn('Edit', 'document'); await until(`document.getElementById('f-name')?.value === 'Shared Flat'`, 'edit form');
  const v = await ev(`({period: document.getElementById('f-period').value, gross: document.getElementById('f-gross').value, own: document.getElementById('f-own').value})`);
  if (v.period !== 'year' || v.gross !== '12000' || v.own !== '50') throw new Error(JSON.stringify(v));
  await ev(`document.getElementById('f-period').value='month'; document.getElementById('f-period').dispatchEvent(new Event('change'))`);
  if ((await ev(`document.getElementById('f-gross').value`)) !== '1000') throw new Error('did not convert to monthly');
  await ev(`document.querySelector('.modal-x').click()`); await until(`!document.getElementById('modal').open`, 'closed');
});
await step('quick update value: saves value and debt, adds history, and sets the monthly reminder', async () => {
  await fetch(`${mock.origin}/__age?days=40`); await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'reloaded');
  await tab('Map'); await until(`/Shared Flat/.test(document.getElementById('hero-sel').textContent) || true`, 'map'); await ev(`window.__noop = 1`);
  await ev(`[...document.querySelectorAll('.tab-btn, .nav-btn')].filter(b=>b.offsetParent).find(b=>b.textContent.trim()==='Assets').click()`); await until(`[...document.querySelectorAll('.app-tbl tbody tr')].length`, 'table'); await ev(`[...document.querySelectorAll('.app-tbl tbody tr .rowbtn')].find(b=>/Shared Flat/.test(b.textContent)).click()`);
  await btn('Update value', 'document'); await until(`document.getElementById('q-value')`, 'quick modal');
  await ev(`document.getElementById('q-value').value='440000'; document.getElementById('q-debt').value='90000'; document.getElementById('q-remind').checked = true; document.querySelector('.asset-form').requestSubmit()`);
  await until(`!document.getElementById('modal').open`, 'saved'); await until(`/Value updated \\(\\+10\\.0%\\)/.test(document.getElementById('toast').textContent)`, 'toast with the change');
  const r = await asset('Shared Flat'); const last = r.history.at(-1);
  if (r.value !== 440000 || r.debt !== 90000 || last.v !== 440000 || last.b !== 90000 || r.history.length < 2) throw new Error(JSON.stringify(r));
  const x = await extrasState(); const rem = x.rems.find(q => q.title === 'Update estimated value'); if (!rem || rem.repeat !== 'monthly') throw new Error(JSON.stringify(x.rems));
  await btn('Update value', 'document'); await until(`document.getElementById('q-value')`, 'again');
  if (!/monthly reminder to update this value is due/.test(await ev(`document.querySelector('.asset-form').textContent`))) throw new Error('should show the existing reminder instead of a second checkbox');
  await ev(`document.getElementById('q-value').value='-3'; document.querySelector('.asset-form').requestSubmit()`); await until(`document.querySelector('.asset-form .err:not(:empty)')`, 'validation');
  await ev(`document.querySelector('.modal-x').click()`);
});
await step('performance shows the portfolio net worth chart with Net worth, Value and Debt', async () => {
  await tab('Performance'); await until(`document.querySelector('.pf-card svg.fc')`, 'portfolio chart');
  const kp = await ev(`document.querySelector('.pf-kpis').textContent`); if (!/Net worth/.test(kp) || !/Debt/.test(kp)) throw new Error(kp);
  await btn('Debt', 'document.querySelector(".pf-card")'); await until(`document.querySelector('.pf-card button.on')?.textContent === 'Debt' && document.querySelector('.pf-card svg.fc')`, 'debt chart');
  await btn('Value', 'document.querySelector(".pf-card")'); await until(`document.querySelector('.pf-card button.on')?.textContent === 'Value'`, 'value chart');
});
await step('cash flow tab: monthly income, expenses and loan payments follow the ownership share', async () => {
  await tab('Cash flow'); await until(`document.querySelector('.cf-tbl')`, 'table');
  const row = await ev(`[...document.querySelectorAll('.cf-tbl tbody tr')].find(r => /Shared Flat/.test(r.textContent))?.textContent`);
  // 50% of 1000 income, 200 expenses and 900 loan payment per month: 500 - 100 - 450 = -50
  if (!row || !/\$500/.test(row) || !/\$100/.test(row) || !/\$450/.test(row) || !/-\$50/.test(row)) throw new Error('row: ' + row);
  if (!/Net cash flow per month/.test(await ev(`document.querySelector('#view-cashflow .perf-kpis').textContent`))) throw new Error('no kpi');
});
await step('asset activity timeline shows value increases and debt reduction', async () => {
  await tab('Assets'); await btn('Documents', 'document'); await until(`document.querySelector('.extras .tl')`, 'timeline');
  const t = await ev(`document.querySelector('.extras .tl').textContent`); if (!/Value increased/.test(t) || !/Debt reduced/.test(t) || !/Added to Owned Map/.test(t)) throw new Error(t);
  await ev(`document.querySelector('.modal-x').click()`); await until(`!document.getElementById('modal').open`, 'closed');
});
await step('delete hides the asset at once, Undo brings it back, and without Undo it is really deleted with its files', async () => {
  await tab('Assets'); await btn('Documents', 'document'); await until(`document.querySelector('.extras')`, 'modal');
  await setFile('#d-file', 'deed.pdf', '%PDF-1.4 deed', 'application/pdf'); await ev(`[...document.querySelectorAll('.extras .upload-row button')].find(b=>/Upload/.test(b.textContent)).click()`);
  await until(`document.querySelector('.doc-row')`, 'uploaded'); await ev(`document.querySelector('.modal-x').click()`); await until(`!document.getElementById('modal').open`, 'closed');
  const before = await extrasState(); if (!before.files.length) throw new Error('no file to delete');
  const name = await ev(`document.querySelector('.detail .ac-top b').textContent`);
  await ev(`[...document.querySelectorAll('.detail-actions button')].find(b=>/^Delete/.test(b.textContent)).click()`);
  await until(`/deleted\\./.test(document.getElementById('toast').textContent) && document.querySelector('.toast-act')`, 'undo toast');
  if (await ev(`[...document.querySelectorAll('#view-assets .app-tbl tbody tr')].some(r => r.textContent.includes(${JSON.stringify(name)}))`)) throw new Error('asset still listed right after deleting: ' + await ev(`JSON.stringify({name: ${JSON.stringify(name)}, rows: [...document.querySelectorAll('#view-assets .app-tbl tbody tr')].map(r => r.textContent.slice(0, 40)), toast: document.getElementById('toast').textContent, view: document.querySelector('.app-view:not([hidden])')?.id})`));
  if (!(await asset(name))) throw new Error('it must not be deleted before the undo window ends');
  await ev(`document.querySelector('.toast-act').click()`); await until(`[...document.querySelectorAll('#view-assets .app-tbl tbody tr')].some(r => r.textContent.includes(${JSON.stringify(name)}))`, 'restored');
  await sleep(9500); if (!(await asset(name))) throw new Error('undone delete was executed anyway');
  await ev(`[...document.querySelectorAll('.detail-actions button')].find(b=>/^Delete/.test(b.textContent)).click()`); await until(`document.querySelector('.toast-act')`, 'toast again');
  for (let i = 0; i < 40 && (await asset(name)); i++) await sleep(300);
  if (await asset(name)) throw new Error('asset was not deleted after the undo window');
  const after = await extrasState(); if (after.files.length || after.docs.length) throw new Error('files remain');
});
await step('share: create a read-only link, open it without signing in, no edit controls, notes never exposed, then revoke', async () => {
  await tab('Map'); await click('#share-btn'); await until(`document.getElementById('sh-label')`, 'share modal');
  await ev(`document.getElementById('sh-label').value='My accountant'; document.querySelector('.share-form').requestSubmit()`);
  await until(`document.querySelector('.share-url input')`, 'link created'); const url = await ev(`document.querySelector('.share-url input').value`);
  if (!/\/share\.html#t=[A-Za-z0-9_-]{43}$/.test(url)) throw new Error(url);
  const stored = (await extrasState()).shares[0]; if (!stored || /[A-Za-z0-9_-]{43}/.test(JSON.stringify(stored)) && JSON.stringify(stored).includes(url.split('#t=')[1])) throw new Error('the secret must not be stored: ' + JSON.stringify(stored));
  const savedSession = await ev(`localStorage.getItem('atlas.session.v1')`);
  await ev(`localStorage.removeItem('atlas.session.v1')`); // the viewer is not signed in
  await goto(url); await until(`!document.getElementById('shell').hidden`, 'shared dashboard');
  if (await ev(`!!document.getElementById('add-asset-btn') || !!document.getElementById('import-btn') || !!document.getElementById('share-btn')`)) throw new Error('shared view must be read only');
  if (!/Read-only view shared with/.test(await ev(`document.getElementById('app-banner').textContent`))) throw new Error('no read-only banner');
  await until(`/Portfolio value/.test(document.getElementById('hero-value').textContent)`, 'figures');
  const api = await ev(`fetch('/api/share', {headers: {'x-share-token': ${JSON.stringify(url.split('#t=')[1])}}}).then(r => r.text())`); if (/"notes"/.test(api)) throw new Error('notes leaked');
  // back as the owner to revoke
  await ev(`localStorage.setItem('atlas.session.v1', ${JSON.stringify(savedSession)})`);
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'owner back'); await ev(`document.getElementById('modal').open && document.querySelector('.modal-x').click()`);
  await click('#share-btn'); await until(`document.querySelector('.sh-row')`, 'list'); await btn('Revoke', 'document'); await until(`document.querySelector('.sh-st.revoked')`, 'revoked');
  await goto(url); await until(`/no longer works/.test(document.getElementById('boot').textContent)`, 'revoked link rejected');
  await ev(`localStorage.setItem('atlas.session.v1', ${JSON.stringify(savedSession)})`);
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'owner again'); await ev(`document.getElementById('modal').open && document.querySelector('.modal-x')?.click()`);
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
await step('document autofill: a deed fills the form, the pin and the numbers can be edited, and the file is kept with the asset', async () => {
  await ev(`localStorage.clear()`); await signIn('dora@example.com');
  await ev(`document.getElementById('modal').open && document.querySelector('.wizard .modal-x')?.click()`);
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^\s*Add asset\s*$|Add your first asset/.test(x.textContent)); if(!b) throw new Error('no add button'); b.click(); return true;})()`);
  await until(`document.getElementById('af-file')`, 'autofill block');
  await ev(`(()=>{const dt=new DataTransfer(); dt.items.add(new File(['%PDF-1.4 test deed'], 'deed.pdf', {type:'application/pdf'})); const i=document.getElementById('af-file'); i.files=dt.files; i.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(`/Filled from deed.pdf/.test(document.querySelector('.af-status')?.textContent||'')`, 'filled message');
  const got = await ev(`JSON.stringify({name:document.getElementById('f-name').value, cost:document.getElementById('f-cost').value, value:document.getElementById('f-value').value, debt:document.getElementById('f-debt').value, lat:document.getElementById('f-lat').value, lon:document.getElementById('f-lon').value, place:document.getElementById('f-placename').value, country:document.getElementById('f-country').value, type:document.querySelector('.type-card.on')?.textContent, acq:document.getElementById('f-acq').value, hi:document.querySelectorAll('.autofilled').length})`);
  const g = JSON.parse(got);
  if (g.name !== 'Lakeview Cottage' || g.cost !== '640000' || g.value !== '640000' || g.debt !== '250000' || g.lat !== '40.4168' || g.country !== 'ES' || g.type !== 'House or apartment' || g.acq !== '2020-06-01' || g.hi < 6) throw new Error('form not filled as expected: ' + got);
  await ev(`(()=>{const e=document.getElementById('f-value'); e.value='700000'; e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  if (await ev(`document.getElementById('f-value').classList.contains('autofilled')`)) throw new Error('edited field still marked as autofilled');
  await ev(`document.querySelector('.asset-form').requestSubmit()`);
  await until(`document.body.textContent.includes('Lakeview Cottage')`, 'asset added');
  const saved = (await rows()).find(r => r.name === 'Lakeview Cottage');
  if (!saved || Number(saved.value) !== 700000 || Number(saved.cost) !== 640000) throw new Error('saved values wrong: ' + JSON.stringify(saved));
  await until(`true`, 'tick'); await new Promise(r => setTimeout(r, 400));
  const ex = await (await fetch(`${mock.origin}/__extras`)).json();
  if (!ex.docs.some(d => d.name === 'deed.pdf' && d.asset_id === saved.id)) throw new Error('deed was not kept with the asset');
  const log = await (await fetch(`${mock.origin}/__log`)).json();
  if (!log.some(l => l[0] === 'model' && l[1] === 'claude-opus-5-5' && l[2] === 'document')) throw new Error('model was not asked with a document');
});
await step('currency, loan calculator, sale simulator, insights, usual reminders, VIN and emergency contacts', async () => {
  await ev(`localStorage.clear()`); await signIn('erin@example.com');
  await ev(`document.getElementById('modal').open && document.querySelector('.wizard .modal-x')?.click()`);
  // exchange rates: 1 US dollar buys 0.5 euros, so one euro is two dollars
  const today = new Date().toISOString().slice(0, 10);
  await ev(`localStorage.setItem('atlas.fx.v1', JSON.stringify({ date: '${today}', rates: { EUR: 0.5, GBP: 0.8 }, fetchedOn: '${today}' }))`);
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'dashboard');
  await ev(`document.getElementById('modal').open && document.querySelector('.wizard .modal-x')?.click()`);
  await tab('Map'); await click('#add-asset-btn'); await until(`document.getElementById('f-currency')`, 'currency field');
  await ev(`(()=>{document.querySelector('.type-card').click(); const set=(id,v)=>{document.getElementById(id).value=v;};
    set('f-name','Euro Flat'); set('f-place','Austin, TX'); document.getElementById('f-currency').value='EUR'; set('f-value','200000'); set('f-cost','100000'); set('f-debt','50000'); set('f-debtpay','500'); set('f-debtrate','5'); set('f-annual','3');
    document.querySelector('.asset-form').requestSubmit();})()`);
  await until(`!document.getElementById('modal').open`, 'saved');
  const r = await asset('Euro Flat');
  if (r.currency !== 'EUR' || Number(r.debt_rate) !== 5 || Number(r.annual_change) !== 3 || Number(r.value) !== 200000) throw new Error('stored wrongly: ' + JSON.stringify(r));
  await until(`/Entered in EUR: €200,000/.test(document.getElementById('hero-sel').textContent) && /\\$400,000/.test(document.getElementById('hero-sel').textContent)`, 'card shows dollars and the euro amount');
  if (!(await ev(`/moves \\+3% a year/.test(document.getElementById('hero-sel').textContent)`))) throw new Error('yearly change not shown');
  // loan calculator
  await btn('Loan', 'document'); await until(`document.getElementById('l-bal')`, 'loan dialog');
  await until(`/Debt-free in/.test(document.querySelector('.calc-out').textContent)`, 'payoff shown');
  await ev(`(()=>{const i=document.getElementById('l-extra'); i.value='200'; i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(`/finish sooner by/.test(document.querySelector('.calc-out').textContent) && /Interest you save/.test(document.querySelector('.calc-out').textContent)`, 'extra payment effect');
  await ev(`(()=>{const i=document.getElementById('l-pay'); i.value='100'; i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(`/does not even cover/.test(document.querySelector('.calc-out').textContent)`, 'payment too low is explained');
  await ev(`(()=>{const i=document.getElementById('l-pay'); i.value='900'; i.dispatchEvent(new Event('input',{bubbles:true})); [...document.querySelectorAll('#modal button')].find(b=>/Save rate/.test(b.textContent)).click();})()`);
  await until(`!document.getElementById('modal').open`, 'loan saved');
  if (Number((await asset('Euro Flat')).debt_payment) !== 900) throw new Error('loan payment not saved');
  // sale simulator
  await btn('If sold', 'document'); await until(`document.getElementById('s-price')`, 'sale dialog');
  await until(`/What you keep/.test(document.querySelector('.calc-out').textContent) && /After the sale/.test(document.querySelector('.calc-out').textContent)`, 'sale result');
  await ev(`document.getElementById('modal').close()`);
  // insights: goal, projections, concentration
  await tab('Insights'); await until(`document.getElementById('i-goal')`, 'insights view');
  await ev(`(()=>{document.getElementById('i-goal').value='1,000,000'; [...document.querySelectorAll('#view-insights button')].find(b=>/Save goal/.test(b.textContent)).click();})()`);
  await until(`/of \\$1,000,000/.test(document.getElementById('view-insights').textContent) && document.querySelector('.goal-bar')`, 'goal progress');
  if (!(await ev(`/In 10 years/.test(document.getElementById('view-insights').textContent) && /Returns by asset/.test(document.getElementById('view-insights').textContent)`))) throw new Error('projections or returns missing');
  if (!(await ev(`/about \\d+ years?/.test(document.getElementById('view-insights').textContent)`))) throw new Error('years to goal not shown');
  const st = await (await fetch(`${mock.origin}/__settings`)).json(); if (!st.some(s => s.data.goal.target === 1000000)) throw new Error('goal not stored in the account');
  // the usual reminders
  await tab('Map'); await btn('Documents', 'document'); await until(`document.querySelector('.xt-btns')`, 'documents dialog');
  await btn('Add the usual ones', 'document'); await until(`document.querySelectorAll('.std-row').length >= 3`, 'list of usual reminders');
  await btn('Add the selected ones', 'document'); await until(`!document.querySelector('.std-row') && document.querySelectorAll('.rem-row').length >= 3`, 'reminders added and back on the asset');
  await ev(`document.getElementById('modal').close()`);
  const rems = (await (await fetch(`${mock.origin}/__extras`)).json()).rems.filter(x => x.repeat === 'yearly');
  if (rems.length < 3 || !rems.some(x => /Property tax/.test(x.title))) throw new Error('usual reminders missing: ' + JSON.stringify(rems.map(x => x.title)));
  // VIN lookup for a car
  await click('#add-asset-btn'); await until(`document.getElementById('f-vin')`, 'form');
  if (!(await ev(`document.querySelector('.vin-box').hidden`))) throw new Error('VIN box should be hidden until a vehicle type is chosen');
  await ev(`[...document.querySelectorAll('.type-card')].find(b=>/^Car/.test(b.textContent)).click()`);
  await until(`!document.querySelector('.vin-box').hidden`, 'VIN box for cars');
  await ev(`document.getElementById('f-vin').value='1HGCM82633A004352'; [...document.querySelectorAll('.vin-box button')].find(b=>/Look up/.test(b.textContent)).click()`);
  await until(`document.getElementById('f-name').value === '2003 Honda Accord' && /VIN 1HGCM82633A004352/.test(document.getElementById('f-notes').value)`, 'VIN fills the name and notes');
  await ev(`document.getElementById('modal').close()`);
  // emergency contacts
  await tab('Reports'); await btn('Emergency contacts', 'document'); await until(`document.querySelector('.contact-row')`, 'contacts dialog');
  await ev(`(()=>{const r=document.querySelector('.contact-row').querySelectorAll('input'); r[0].value='Lawyer'; r[1].value='Ana Ruiz'; r[2].value='+34 600 000 000'; document.querySelector('#modal textarea').value='Keys are with the notary'; [...document.querySelectorAll('#modal button')].find(b=>/^Save$/.test(b.textContent)).click();})()`);
  await until(`!document.getElementById('modal').open`, 'contacts saved');
  const st2 = await (await fetch(`${mock.origin}/__settings`)).json();
  if (!st2.some(s => s.data.contacts[0]?.name === 'Ana Ruiz' && s.data.emergencyNote === 'Keys are with the notary' && s.data.goal.target === 1000000)) throw new Error('contacts not stored, or the goal was lost: ' + JSON.stringify(st2));
});
await step('map drill-down: country -> region -> city -> assets, with counts, breadcrumb and a way back', async () => {
  await ev(`localStorage.clear()`); await signIn('fran@example.com');
  await ev(`document.getElementById('modal').open && document.querySelector('.wizard .modal-x')?.click()`);
  const lines = ['name,type,location,value,cost'];
  for (let i = 1; i <= 4; i++) lines.push(`NY House ${i},house,"New York, NY",${500000 + i},400000`);
  for (let i = 1; i <= 3; i++) lines.push(`Austin House ${i},house,"Austin, TX",${300000 + i},250000`);
  for (let i = 1; i <= 3; i++) lines.push(`SA House ${i},house,"San Antonio, TX",${200000 + i},150000`);
  for (let i = 1; i <= 2; i++) lines.push(`London Flat ${i},house,"London, UK",${700000 + i},600000`);
  lines.push('Barcelona Flat,house,"Barcelona, ES",400000,300000', 'Barcelona Car 1,car,"Barcelona, ES",40000,50000', 'Barcelona Car 2,car,"Barcelona, ES",30000,45000');
  await tab('Map'); await click('#import-btn'); await until(`document.getElementById('modal').open`, 'import modal');
  await setFile('#imp-file', 'portfolio.csv', lines.join('\n'), 'text/csv');
  await until(`/Import 15 assets/.test(document.querySelector('.modal-actions .btn-primary')?.textContent || '')`, 'all 15 ready');
  await btn('Import 15', 'document'); await until(`!document.getElementById('modal').open`, 'imported');
  const geoBtn = t => ev(`(()=>{const b=[...document.querySelectorAll('.geo-toggle button, .geo-chips button, .geo-crumbs button, .geo-card')].filter(x=>x.offsetParent).find(x=>x.textContent.trim().startsWith(${JSON.stringify(t)})); if(!b) throw new Error('no ${t}'); b.click(); return true;})()`);
  const cards = () => ev(`[...document.querySelectorAll('.geo-card')].map(x => x.querySelector('span').textContent + ':' + x.querySelector('em').textContent).join(',')`);
  const crumbs = () => ev(`document.querySelector('.geo-crumbs')?.hidden ? '' : [...document.querySelectorAll('.geo-crumbs > *:not(i)')].map(x => x.textContent).join('>')`);
  await geoBtn('Country'); await until(`document.querySelectorAll('.geo-chips button').length >= 3`, 'country chips');
  await geoBtn('United States'); await until(`document.querySelectorAll('.geo-card').length === 2`, 'two states');
  let c = await cards(); if (!/New York:4/.test(c) || !/Texas:6/.test(c)) throw new Error('state cards: ' + c);
  if (!(await ev(`/United States/.test(document.getElementById('hero-value').textContent)`))) throw new Error('title should name the country');
  await geoBtn('Texas'); await until(`document.querySelectorAll('.geo-card').length === 2 && /Texas/.test(document.querySelector('.geo-crumbs')?.textContent || '')`, 'two cities in Texas');
  c = await cards(); if (!/Austin:3/.test(c) || !/San Antonio:3/.test(c)) throw new Error('city cards: ' + c);
  if ((await crumbs()) !== 'World>United States>Texas') throw new Error('breadcrumb: ' + await crumbs());
  await until(`/Texas, United States/.test(document.getElementById('hero-value').textContent) && /\\$1,\\d{3},\\d{3}/.test(document.getElementById('hero-value').textContent)`, 'value of Texas only');
  await geoBtn('San Antonio'); await until(`document.querySelectorAll('.geo-assets button[data-id]').length === 3`, 'three assets in San Antonio');
  if ((await crumbs()) !== 'World>United States>Texas>San Antonio') throw new Error('breadcrumb: ' + await crumbs());
  await ev(`document.querySelector('.geo-assets button[data-id]').click()`); await until(`/SA House/.test(document.getElementById('hero-sel').textContent)`, 'asset picked in the city');
  await geoBtn('Texas'); await until(`document.querySelectorAll('.geo-card').length === 2`, 'back to Texas cities');
  await geoBtn('United States'); await until(`document.querySelectorAll('.geo-card').length === 2 && !/Texas/.test(document.querySelector('.geo-crumbs')?.textContent || 'x') || document.querySelector('.geo-crumbs')?.hidden`, 'back to the states');
  // another country: Spain has autonomous communities, the UK has regions
  await until(`!document.querySelector('.geo-crumbs') || document.querySelector('.geo-crumbs').hidden`, 'country level shows the countries again');
  await geoBtn('Spain'); await until(`/Cataluña:3/.test([...document.querySelectorAll('.geo-card')].map(x => x.querySelector('span').textContent + ':' + x.querySelector('em').textContent).join(','))`, 'Cataluña holds 3');
  await geoBtn('United Kingdom'); await until(`/Greater London:2/.test([...document.querySelectorAll('.geo-card')].map(x => x.querySelector('span').textContent + ':' + x.querySelector('em').textContent).join(','))`, 'Greater London holds 2');
  await geoBtn('Spain'); await until(`document.querySelectorAll('.geo-card').length === 1`, 'one community in Spain'); await geoBtn('Cataluña'); await until(`/Barcelona:3/.test([...document.querySelectorAll('.geo-card')].map(x => x.querySelector('span').textContent + ':' + x.querySelector('em').textContent).join(','))`, 'Barcelona holds 3 (flat + 2 cars)');
  await ev(`document.getElementById('hero-map').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await until(`document.querySelectorAll('.geo-card').length === 1 && !/Barcelona/.test(document.querySelector('.geo-card span')?.textContent || '')`, 'Escape goes one level up');
  await geoBtn('Globe'); await until(`!document.getElementById('hero-map').classList.contains('geo-country')`, 'back to the globe');
});
await step('household access: an editor and a viewer join by invitation link; the database keeps the viewer read only; removing access works', async () => {
  const HOST = 'host.h@example.com', PARTNER = 'partner.h@example.com', VIEWER = 'viewer.h@example.com';
  await ev(`localStorage.clear()`); await makeUser(VIEWER); // the viewer already has an account, the partner does not
  await signIn(HOST);
  const csv = ['name,type,location,value,cost', 'Shared Flat,house,"Madrid, ES",300000,250000', 'Shared Car,car,"Madrid, ES",20000,25000'].join('\n');
  await tab('Map'); await click('#import-btn'); await until(`document.getElementById('modal').open`, 'import modal');
  await setFile('#imp-file', 'shared.csv', csv, 'text/csv');
  await until(`/Import 2 assets/.test(document.querySelector('.modal-actions .btn-primary')?.textContent || '')`, 'two ready');
  await btn('Import 2', 'document'); await until(`!document.getElementById('modal').open`, 'imported');
  await tab('Reports'); await until(`document.getElementById('members-btn')`, 'household access button'); await click('#members-btn');
  await until(`document.getElementById('hm-email')`, 'invite form');
  const invite = async (email, role) => {
    await ev(`(()=>{document.getElementById('hm-email').value=${JSON.stringify(email)}; document.getElementById('hm-role').value=${JSON.stringify(role)}; document.querySelector('.share-form').requestSubmit();})()`);
    await until(`document.querySelector('.share-new input')?.value.includes('#invite=') && /${email.split('@')[0]}/.test(document.querySelector('.share-new b').textContent)`, 'invitation link for ' + email);
    return ev(`document.querySelector('.share-new input').value`);
  };
  const linkP = await invite(PARTNER, 'edit'), linkV = await invite(VIEWER, 'view');
  if ((await ev(`document.getElementById('modal').textContent.includes('Waiting')`)) !== true) throw new Error('pending invitations not listed');
  const stored = await (await fetch(`${mock.origin}/__members`)).json();
  if (stored.length !== 2 || stored.some(m => m.invite_hash === linkP.split('=')[1] || m.invite_hash === linkV.split('=')[1])) throw new Error('only a hash of the secret may be stored');
  await ev(`document.getElementById('hm-email').value='nope'; document.querySelector('.share-form').requestSubmit();`);
  await until(`/valid email/i.test(document.querySelector('.share-form .form-err').textContent)`, 'email validation');
  await ev(`document.getElementById('hm-email').value=${JSON.stringify(PARTNER)}; document.querySelector('.share-form').requestSubmit();`);
  await until(`/already has an invitation/.test(document.querySelector('.share-form .form-err').textContent)`, 'duplicate invitation refused');

  // a link that is not valid says so and does not reveal why
  await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html#invite=${'A'.repeat(43)}`);
  await until(`/not valid/.test(document.getElementById('invite').textContent)`, 'invalid invitation message');

  // the partner has no account: chooses a password and lands in the host's portfolio, able to make changes
  await goto(linkP); await until(`/You are invited/.test(document.getElementById('invite').textContent)`, 'invitation screen');
  if (!(await ev(`document.getElementById('invite').textContent.includes('${HOST}')`))) throw new Error('inviter not named');
  await ev(`(()=>{document.getElementById('inv-pw').value='short'; document.getElementById('inv-pw2').value='short'; document.querySelector('#invite-card form').requestSubmit();})()`);
  await until(`/at least 10/.test(document.getElementById('invite-err').textContent)`, 'weak password refused');
  await ev(`(()=>{document.getElementById('inv-pw').value='partner-pass-123'; document.getElementById('inv-pw2').value='partner-pass-123'; document.querySelector('#invite-card form').requestSubmit();})()`);
  await until(`!document.getElementById('shell').hidden`, 'dashboard of the invited partner');
  await until(`/looking at ${HOST}/.test(document.getElementById('app-banner').textContent) && /make changes/.test(document.getElementById('app-banner').textContent)`, 'banner names the shared portfolio');
  await tab('Assets'); await until(`document.body.textContent.includes('Shared Flat') && document.body.textContent.includes('Shared Car')`, 'the host assets');
  if (!(await ev(`!!document.getElementById('add-asset-btn')`))) throw new Error('an editor should be able to add');
  if (await ev(`!!document.getElementById('share-btn') || !!document.getElementById('members-btn')`)) throw new Error('an editor must not manage sharing');
  await tab('Map'); await click('#import-btn'); await until(`document.getElementById('modal').open`, 'import modal');
  await setFile('#imp-file', 'boat.csv', 'name,type,location,value,cost\nPartner Boat,yacht,"Lisbon, PT",90000,80000', 'text/csv');
  await until(`/Import 1 asset/.test(document.querySelector('.modal-actions .btn-primary')?.textContent || '')`, 'one ready');
  await btn('Import 1', 'document'); await until(`!document.getElementById('modal').open`, 'partner imported');
  const all = await rows(), flat = all.find(r => r.name === 'Shared Flat'), boat = all.find(r => r.name === 'Partner Boat');
  if (!boat || boat.user_id !== flat.user_id) throw new Error('the partner asset must belong to the host account: ' + JSON.stringify(boat));

  // the viewer already has an account: the password form falls through to signing in
  await ev(`localStorage.clear()`); await goto(linkV); await until(`/You are invited/.test(document.getElementById('invite').textContent)`, 'viewer invitation');
  await ev(`(()=>{document.getElementById('inv-pw').value='some-long-password'; document.getElementById('inv-pw2').value='some-long-password'; document.querySelector('#invite-card form').requestSubmit();})()`);
  await until(`/already have an account/.test(document.getElementById('invite').textContent)`, 'asked to sign in instead');
  await ev(`(()=>{document.getElementById('inv-pass').value=${JSON.stringify(PW)}; document.querySelector('#invite-card form').requestSubmit();})()`);
  await until(`!document.getElementById('shell').hidden && /read only/.test(document.getElementById('app-banner').textContent)`, 'viewer dashboard, read only');
  await tab('Assets'); await until(`document.body.textContent.includes('Partner Boat')`, 'viewer sees all three');
  const noControls = await ev(`!document.getElementById('add-asset-btn') && !document.getElementById('import-btn') && ![...document.querySelectorAll('button')].some(b => /^(Edit|Delete|Update value)$/.test(b.textContent.trim()))`);
  if (!noControls) throw new Error('a viewer must not see edit controls');
  // even calling the database directly, the viewer cannot change anything
  const hit = await ev(`(async()=>{ const t = JSON.parse(localStorage.getItem('atlas.session.v1')).access_token, h = { authorization: 'Bearer ' + t, apikey: 'mock-anon-key', 'content-type': 'application/json', prefer: 'return=representation' };
    const a = await fetch('/rest/v1/assets?id=eq.${flat.id}', { method: 'PATCH', headers: h, body: JSON.stringify({ value: 1 }) }).then(r => r.json());
    const b = await fetch('/rest/v1/assets', { method: 'POST', headers: h, body: JSON.stringify({ user_id: '${flat.user_id}', name: 'Hack', type: 'house', place: 'x', country: 'ES', lat: 1, lon: 1, value: 1, cost: 1 }) }).then(r => r.status);
    const c = await fetch('/rest/v1/assets?id=eq.${flat.id}', { method: 'DELETE', headers: h }).then(r => r.status);
    return JSON.stringify({ patched: a.length, created: b, deleted: c }); })()`);
  const after = (await rows()).find(r => r.id === flat.id);
  if (!after || after.value !== 300000 || !/"patched":0/.test(hit) || !/"created":403/.test(hit)) throw new Error('viewer could write: ' + hit + ' value ' + after?.value);
  // the viewer can go back to their own (empty) portfolio and come back
  await ev(`(()=>{const s=document.querySelector('.sf-account'); s.value=''; s.dispatchEvent(new Event('change'));})()`);
  await until(`!document.getElementById('shell').hidden && !/looking at/.test(document.getElementById('app-banner').textContent)`, 'own portfolio');

  // the host can see who has access, change a role, and remove access
  await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth'); await fillLogin(HOST, PW);
  await until(`!document.getElementById('shell').hidden`, 'host dashboard');
  await ev(`document.getElementById('modal').open && document.querySelector('.wizard .modal-x')?.click()`);
  await tab('Reports'); await click('#members-btn'); await until(`document.querySelectorAll('.sh-row').length === 2 && document.getElementById('modal').textContent.includes('Has joined')`, 'both joined');
  await ev(`(()=>{const s=document.querySelector('.sh-row .mini-sel[aria-label*="${VIEWER}"]'); s.value='edit'; s.dispatchEvent(new Event('change'));})()`);
  await sleep(400);
  if ((await (await fetch(`${mock.origin}/__members`)).json()).find(m => m.email === VIEWER).role !== 'edit') throw new Error('role not stored');
  await ev(`[...document.querySelectorAll('.sh-row')].find(r => r.textContent.includes('${PARTNER}')).querySelector('.mini-btn.danger').click()`);
  await until(`document.querySelectorAll('.sh-row').length === 1`, 'partner removed');
  // the removed partner is out at once
  await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth'); await fillLogin(PARTNER, 'partner-pass-123');
  await until(`!document.getElementById('shell').hidden`, 'partner own dashboard');
  if (await ev(`!!document.querySelector('.sf-account') || /Shared Flat/.test(document.body.textContent)`)) throw new Error('removed partner still sees the host portfolio');
});
await step('trusted person: a private link that opens only after the owner is away or releases it, closes again on a visit, and can be paused, renewed and removed', async () => {
  const OWNER_T = 'owner.t@example.com';
  await ev(`localStorage.clear()`); await signIn(OWNER_T);
  await tab('Map'); await click('#import-btn'); await until(`document.getElementById('modal').open`, 'import modal');
  await setFile('#imp-file', 'heir.csv', 'name,type,location,value,cost\nHeir Flat,house,"Madrid, ES",410000,300000', 'text/csv');
  await until(`/Import 1 asset/.test(document.querySelector('.modal-actions .btn-primary')?.textContent || '')`, 'one ready');
  await btn('Import 1', 'document'); await until(`!document.getElementById('modal').open`, 'imported');
  const mbtn = t => ev(`(()=>{const b=[...document.querySelectorAll('#modal button')].find(b=>b.textContent.trim()===${JSON.stringify(t)}); if(!b) throw new Error('no ${t}'); b.click(); return true;})()`);
  const modalHas = re => ev(`${re}.test(document.getElementById('modal').textContent)`);
  const lockedPage = async () => { await ev(`localStorage.clear()`); };
  const openLink = async link => { await goto(link); await until(`document.getElementById('heir') && !document.getElementById('heir').hidden || /not open yet|does not work|incomplete|could not/i.test(document.getElementById('boot').textContent)`, 'heir page'); };

  await tab('Reports'); await until(`document.getElementById('heir-btn')`, 'trusted person button'); await click('#heir-btn');
  await until(`document.getElementById('hr-name')`, 'form');
  if (!(await modalHas(`/never the files/`))) throw new Error('what is shared is not explained');
  // consent first
  await ev(`document.getElementById('hr-name').value='Maria'; document.querySelector('.share-form').requestSubmit();`);
  await until(`/understand/.test(document.querySelector('.share-form .form-err').textContent)`, 'consent required');
  await ev(`document.getElementById('hr-email').value='not-an-email'; document.getElementById('hr-consent').checked=true; document.querySelector('.share-form').requestSubmit();`);
  await until(`/does not look right/.test(document.querySelector('.share-form .form-err').textContent)`, 'email checked');
  await ev(`document.getElementById('hr-email').value='maria@x.test'; document.getElementById('hr-days').value='30'; document.querySelector('.share-form').requestSubmit();`);
  await until(`document.querySelector('.share-new input')?.value.includes('heir.html#t=')`, 'private link');
  const link = await ev(`document.querySelector('.share-new input').value`);
  await until(`/Closed\\. It would open on/.test(document.getElementById('modal').textContent)`, 'status says closed');
  const stored = await (await fetch(`${mock.origin}/__heirs`)).json();
  if (stored.length !== 1 || stored[0].token_hash.length !== 64 || link.includes(stored[0].token_hash) || stored[0].inactive_days !== 30) throw new Error('only the hash is stored: ' + JSON.stringify(stored));

  // closed: the link says so and shows nothing
  await ev(`localStorage.clear()`); await openLink(link);
  if (!(await ev(`/not open yet/.test(document.getElementById('boot').textContent) && !document.body.textContent.includes('Heir Flat')`))) throw new Error('a closed sheet must show nothing');

  // 31 days without a visit: it opens
  await fetch(`${mock.origin}/__heir_age?days=31`); await openLink(link);
  await until(`document.getElementById('heir-frame').srcdoc.includes('Heir Flat')`, 'sheet content');
  const sheet = await ev(`document.getElementById('heir-frame').srcdoc`);
  if (!/Emergency sheet/.test(sheet) || !sheet.includes('410,000') || /secret|token/i.test(sheet)) throw new Error('unexpected sheet content');
  if (!(await ev(`/owner\\.t@example\\.com/.test(document.getElementById('heir-title').textContent) && /not signed in/.test(document.getElementById('heir-sub').textContent)`))) throw new Error('page does not say who and why');
  await sleep(300);
  if ((await (await fetch(`${mock.origin}/__heirs`)).json())[0].opened_count !== 1) throw new Error('the visit was not recorded');

  // the owner comes back: told about the visit, and the sheet closes again
  await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth'); await fillLogin(OWNER_T, PW);
  await until(`!document.getElementById('shell').hidden`, 'owner dashboard');
  await until(`/Your trusted person \\(Maria\\) opened your emergency sheet/.test(document.getElementById('app-banner').textContent)`, 'owner is told');
  await ev(`document.getElementById('modal').open && document.querySelector('.wizard .modal-x')?.click()`);
  await openLink(link);
  if (!(await ev(`/not open yet/.test(document.getElementById('boot').textContent)`))) throw new Error('a visit of the owner must close it again');

  // release now, close again, pause, resume, new link, remove
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'owner again');
  await ev(`document.getElementById('modal').open && document.querySelector('.wizard .modal-x')?.click()`);
  await tab('Reports'); await click('#heir-btn'); await until(`document.getElementById('hr-name')?.value === 'Maria'`, 'saved person');
  await mbtn('Release it now'); await until(`/Open now: you released it/.test(document.getElementById('modal').textContent)`, 'released');
  await openLink(link); await until(`document.getElementById('heir-frame').srcdoc.includes('Heir Flat')`, 'open after release');
  if (!(await ev(`/released it for you/.test(document.getElementById('heir-sub').textContent)`))) throw new Error('reason not shown');
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'owner back');
  await tab('Reports'); await click('#heir-btn'); await until(`document.getElementById('hr-name')`, 'modal');
  await mbtn('Close it again'); await until(`/Closed\\./.test(document.getElementById('modal').textContent)`, 'closed again');
  await mbtn('Pause'); await until(`/Paused/.test(document.getElementById('modal').textContent) && [...document.querySelectorAll('#modal button')].some(b => b.textContent.trim() === 'Resume')`, 'paused');
  await fetch(`${mock.origin}/__heir_age?days=400`); await openLink(link);
  if (!(await ev(`/does not work/.test(document.getElementById('boot').textContent)`))) throw new Error('a paused link must look like any dead link');
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'owner back 2');
  await tab('Reports'); await click('#heir-btn'); await until(`document.getElementById('hr-name')`, 'modal 2');
  await mbtn('Resume'); await until(`[...document.querySelectorAll('#modal button')].some(b => b.textContent.trim() === 'Pause')`, 'resumed');
  await mbtn('New link'); await until(`document.querySelector('.share-new input')?.value.includes('heir.html#t=') && document.querySelector('.share-new input').value !== ${JSON.stringify(link)}`, 'new link');
  const link2 = await ev(`document.querySelector('.share-new input').value`);
  await openLink(link); if (!(await ev(`/does not work/.test(document.getElementById('boot').textContent)`))) throw new Error('the old link must stop working');
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'owner back 3');
  await tab('Reports'); await click('#heir-btn'); await until(`document.getElementById('hr-name')`, 'modal 3');
  await mbtn('Remove'); await until(`!document.querySelector('.hr-status')`, 'removed');
  if ((await (await fetch(`${mock.origin}/__heirs`)).json()).length !== 0) throw new Error('row not removed');
  await openLink(link2); if (!(await ev(`/does not work/.test(document.getElementById('boot').textContent)`))) throw new Error('a removed link must stop working');
});
await step('billing: limits stop extra assets without a plan; the free trial starts through checkout; a bigger plan, the portal and a cancelled plan behave; the super admin is never limited', async () => {
  const U = 'billing.u@example.com';
  await ev(`localStorage.clear()`); await signIn(U);
  const importRows = async names => {
    const csv = ['name,type,location,value,cost', ...names.map(n => `${n},house,"Madrid, ES",100000,90000`)].join('\n');
    await tab('Map'); await click('#import-btn'); await until(`document.getElementById('modal').open`, 'import modal');
    await setFile('#imp-file', 'b.csv', csv, 'text/csv');
    await until(`/Import ${names.length} asset/.test(document.querySelector('.modal-actions .btn-primary')?.textContent || '')`, 'ready to import');
    await btn(`Import ${names.length}`, 'document');
    await until(`!document.getElementById('modal').open || /plan has no room/.test(document.querySelector('#modal .imp-out + .err, #modal .err')?.textContent || '')`, 'import result');
    const blocked = await ev(`document.getElementById('modal').open && /plan has no room/.test(document.getElementById('modal').textContent)`);
    if (await ev(`document.getElementById('modal').open`)) await ev(`document.getElementById('modal').close()`);
    return blocked ? 'blocked' : 'ok';
  };
  const mbtn = t => ev(`(()=>{const b=[...document.querySelectorAll('#modal button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(t)})); if(!b) throw new Error('no ${t}'); b.click(); return true;})()`);
  const subs = async () => (await fetch(`${mock.origin}/__subs`)).json();
  const slide = n => ev(`(()=>{const r=document.getElementById('bl-range'); r.value=${n}; r.dispatchEvent(new Event('input'));})()`);

  if ((await importRows(['A1'])) !== 'ok') throw new Error('limits must be off until they are switched on');
  await fetch(`${mock.origin}/__enforce?on=1`);
  if ((await importRows(['A2'])) !== 'blocked') throw new Error('no plan, limits on: adding must be refused');
  await until(`/No plan yet/.test(document.getElementById('plan-btn').textContent)`, 'plan button says no plan');

  // the free trial for 5 assets, through (pretend) Stripe checkout
  await click('#plan-btn'); await until(`document.getElementById('bl-range')`, 'plan screen');
  await slide(5); await until(`/\\$77 a month/.test(document.getElementById('bl-price').textContent)`, 'price follows the slider ($47 + 2 x $15)');
  await mbtn('Start 14-day free trial');
  await until(`/Trial/.test(document.getElementById('plan-btn')?.textContent || '')`, 'trial started after coming back from checkout', 20000);
  const [row] = await subs();
  if (row.status !== 'trialing' || row.assets_allowed !== 5) throw new Error('plan not saved from the webhook: ' + JSON.stringify(row));
  const sent = (await (await fetch(`${mock.origin}/__log`)).json()).find(l => l[0] === 'stripe-checkout');
  if (!sent || !/ownedmap_base_monthly","1"/.test(sent[1]) || !/ownedmap_extra_asset_monthly","2"/.test(sent[1]) || !/"trial":"14"/.test(sent[1])) throw new Error('checkout was not what was chosen: ' + (sent && sent[1]));

  // inside the plan, and the edge of it
  if ((await importRows(['A2', 'A3'])) !== 'ok') throw new Error('1 + 2 assets fit a 5-asset plan');
  if ((await importRows(['A4', 'A5', 'A6'])) !== 'blocked') throw new Error('3 + 3 assets do not fit a 5-asset plan');
  const total = (await rows()).filter(r => /^A\d$/.test(r.name)).length; if (total !== 3) throw new Error('a refused import must add nothing, found ' + total);

  // a bigger plan
  await click('#plan-btn'); await until(`document.getElementById('bl-range') && /Using 3 of 5/.test(document.getElementById('modal').textContent)`, 'usage shown');
  await slide(8); await mbtn('Update plan'); await until(`/Plan updated/.test(document.getElementById('toast').textContent)`, 'plan updated');
  if ((await subs())[0].assets_allowed !== 8) throw new Error('the change did not reach the plan');
  if ((await importRows(['A4', 'A5', 'A6'])) !== 'ok') throw new Error('the bigger plan should have room');

  // the customer portal (Stripe hosts it)
  await click('#plan-btn'); await until(`document.getElementById('bl-range')`, 'plan screen again'); await mbtn('Add a card');
  await until(`/__stripe_portal/.test(location.href)`, 'portal opened', 10000);

  // the plan ends: nothing is deleted, nothing more can be added
  await fetch(`${mock.origin}/__stripe_cancel?email=${encodeURIComponent(U)}`);
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'dashboard after the plan ended');
  await until(`/No active plan/.test(document.getElementById('plan-btn').textContent)`, 'plan button says ended');
  if ((await rows()).filter(r => /^A\d$/.test(r.name)).length !== 6) throw new Error('assets must stay when a plan ends');
  if ((await importRows(['Z1'])) !== 'blocked') throw new Error('an ended plan cannot add');

  // the super admin is never limited
  await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth'); await fillLogin(OWNER, OWNER_PW);
  await until(`!document.getElementById('shell').hidden`, 'owner dashboard'); await ev(`document.getElementById('modal').open && document.querySelector('.wizard .modal-x')?.click()`);
  await until(`/Super admin/.test(document.getElementById('plan-btn').textContent)`, 'super admin label');
  if ((await importRows(['S1', 'S2', 'S3', 'S4', 'S5'])) !== 'ok') throw new Error('the super admin has no limit');
  await fetch(`${mock.origin}/__enforce?on=0`);
});
await step('first-minute guide: a new user is guided through what they own, the first asset and reminders', async () => {
  await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth');
  await makeUser('cara@example.com'); await fillLogin('cara@example.com', PW);
  await until(`document.querySelector('.wizard h2')?.textContent === 'What do you own?'`, 'guide opens by itself');
  await ev(`[...document.querySelectorAll('.wz-types .type-card')].filter(b => /House|Car/.test(b.textContent)).forEach(b => b.click())`);
  await until(`/Continue with 2/.test(document.querySelector('.wizard .btn-primary').textContent)`, 'two picked'); await btn('Continue with 2', 'document');
  await until(`document.querySelector('.wizard h2')?.textContent === 'Add your first one'`, 'step 2'); await btn('Add your house', 'document');
  await until(`document.getElementById('f-name')`, 'form'); if ((await ev(`document.querySelector('.type-card.on')?.textContent`)) !== 'House or apartment') throw new Error('type was not preselected');
  await ev(`(()=>{const set=(id,v)=>{document.getElementById(id).value=v;}; set('f-name','Guided House'); set('f-place','Austin, TX'); set('f-value','500000'); set('f-cost','400000'); document.querySelector('.asset-form').requestSubmit();})()`);
  await until(`document.querySelector('.wizard h2')?.textContent === 'Never miss a date'`, 'step 3');
  const d = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  await ev(`document.querySelector('.wz-rem input[type=date]').value = ${JSON.stringify(d)}`); await btn('Finish setup', 'document');
  await until(`!document.getElementById('modal').open`, 'finished');
  const x = await extrasState(); const mine = x.rems.map(r => r.title);
  if (!mine.includes('Insurance renewal') || !mine.includes('Update estimated value')) throw new Error(JSON.stringify(mine));
  const cara = (await rows()).filter(r => r.name === 'Guided House'); if (cara.length !== 1) throw new Error('asset missing');
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'again'); await sleep(400);
  if (await ev(`document.getElementById('modal').open`)) throw new Error('the guide must not reopen');
});
await step('no uncaught script errors during the whole run', async () => { if (errors.length) throw new Error(errors.slice(0, 3).join(' | ')); });

console.log(failed ? `\n${failed} step(s) failed` : '\nAll end-to-end steps passed');
done(failed ? 1 : 0);
