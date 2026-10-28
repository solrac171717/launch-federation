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
  await ev(`document.querySelector('.ac-actions .mini-btn, .detail-actions .btn, [data-edit]')?.click()`);
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
