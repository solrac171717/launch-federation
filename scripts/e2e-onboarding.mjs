// Onboarding (first-minute guide) end to end in a real headless Chrome, desktop and phone, including the ways a new user can wander off the happy path.
//   node scripts/e2e-onboarding.mjs           (set CHROME=... if Chrome is not in the default place)
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startMock } from './mock-supabase.mjs';

const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!CHROME) { console.error('Chrome not found. Set CHROME=path'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mock = await startMock({ port: 4182, root: '.' });
const PORT = 9900 + Math.floor(Math.random() * 500);
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
const extrasState = async () => (await fetch(`${mock.origin}/__extras`)).json();
const btn = (txt, sel = 'body') => ev(`(()=>{const b=[...document.querySelector(${JSON.stringify(sel)}).querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(txt)})); if(!b) throw new Error('no button ${txt}'); b.click(); return true;})()`);
const fillLogin = (email, pw) => ev(`(()=>{document.getElementById('auth-email').value=${JSON.stringify(email)}; document.getElementById('auth-password').value=${JSON.stringify(pw)}; document.getElementById('auth-form').requestSubmit();})()`);
const modalOpen = () => ev(`document.getElementById('modal').open`);
const wiz = t => `document.querySelector('.wizard h2')?.textContent === ${JSON.stringify(t)}`;
// the way a new person arrives: a fresh account signs in and the guide opens by itself
let u = 0;
const arrive = async () => {
  const email = `newbie${++u}@example.com`;
  await makeUser(email);
  await goto(`${mock.origin}/app.html`); await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'auth');
  await fillLogin(email, PW);
  await until(wiz('What do you own?'), 'the guide opens by itself');
  return email;
};
// a real finger or mouse can reach it: it sits inside the screen and nothing is on top of it
const reachable = (text, root = '.wizard') => ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(root + ' button')})].find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)})); if(!b) return 'missing ${text}'; b.scrollIntoView({block:'nearest'});
  const r=b.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
  if(r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight) return 'outside the screen: '+JSON.stringify([r.left,r.top,r.right,r.bottom,innerWidth,innerHeight]);
  const top=document.elementFromPoint(x,y); return b.contains(top)||top===b ? 'ok' : 'covered by '+(top&&top.tagName+'.'+top.className);})()`);
const mustReach = async (text, root) => { const v = await reachable(text, root); if (v !== 'ok') throw new Error(`"${text}": ${v}`); };
const goodDate = () => new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
const fillForm = name => ev(`(()=>{const set=(id,v)=>{document.getElementById(id).value=v;}; set('f-name',${JSON.stringify(name)}); set('f-place','Austin, TX'); set('f-value','500000'); set('f-cost','400000'); document.querySelector('.asset-form').requestSubmit();})()`);
const pickHouse = () => ev(`[...document.querySelectorAll('.wz-types .type-card')].find(b => /House/.test(b.textContent)).click()`);
const toStep3 = async name => {
  await arrive(); await pickHouse(); await btn('Continue with 1', '.wizard'); await btn('Add your house', '.wizard');
  await until(`document.getElementById('f-name')`, 'form'); await fillForm(name); await until(wiz('Never miss a date'), 'step 3');
};
await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

await step('Escape closes the guide, it does not come back on reload, and "Guided setup" reopens it', async () => {
  await arrive();
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await until(`!document.getElementById('modal').open`, 'closed with Escape');
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'dashboard again'); await sleep(500);
  if (await modalOpen()) throw new Error('the guide came back by itself');
  await ev(`[...document.querySelectorAll('button')].find(b => /Guided setup/.test(b.textContent)).click()`);
  await until(wiz('What do you own?'), 'reopened by the button');
  await ev(`document.querySelector('.wizard .modal-x').click()`); await until(`!document.getElementById('modal').open`, 'closed with the X');
});
await step('step 1: pick nothing and continue, go Back and the picks are kept, Skip closes', async () => {
  await arrive();
  await btn('Continue', '.wizard'); await until(wiz('Add your first one'), 'step 2 without picks');
  if (!(await ev(`/Add an asset/.test(document.querySelector('.wizard .wz-opt.primary').textContent)`))) throw new Error('generic "Add an asset" expected');
  await btn('Back', '.wizard'); await until(wiz('What do you own?'), 'back to step 1');
  await ev(`[...document.querySelectorAll('.wz-types .type-card')].find(b => /Yacht|Boat/i.test(b.textContent)).click()`);
  await btn('Continue with 1', '.wizard'); await until(wiz('Add your first one'), 'step 2');
  await btn('Back', '.wizard'); await until(wiz('What do you own?'), 'step 1 again');
  if ((await ev(`document.querySelectorAll('.wz-types .type-card.on').length`)) !== 1) throw new Error('the pick was lost on Back');
  await btn('Skip for now', '.wizard'); await until(`!document.getElementById('modal').open`, 'skipped');
});
await step('step 2: cancel the asset form halfway, nothing is saved and the dashboard still works', async () => {
  await arrive(); await btn('Continue', '.wizard'); await btn('Add an asset', '.wizard');
  await until(`document.getElementById('f-name')`, 'form'); await ev(`document.getElementById('f-name').value='Half done'`);
  await ev(`document.querySelector('#modal .modal-x').click()`); await until(`!document.getElementById('modal').open`, 'form closed');
  if ((await rows()).some(r => r.name === 'Half done')) throw new Error('saved by mistake');
  await until(`!document.getElementById('shell').hidden`, 'dashboard still there');
});
await step('step 2: an invalid asset shows the errors in the form and the guide continues after the fix', async () => {
  await arrive(); await btn('Continue', '.wizard'); await btn('Add an asset', '.wizard'); await until(`document.getElementById('f-name')`, 'form');
  await ev(`document.querySelector('.asset-form').requestSubmit()`);
  await until(`[...document.querySelectorAll('.asset-form .err')].some(e => e.textContent.trim())`, 'validation messages');
  if (!(await ev(`/kind of asset/i.test([...document.querySelectorAll('.asset-form .err')].map(e => e.textContent).join(' '))`))) throw new Error('the missing type is not explained');
  await ev(`document.querySelector('.asset-form .type-card').click()`);
  await fillForm('Fixed House'); await until(wiz('Never miss a date'), 'step 3 after the fix');
  await ev(`document.querySelector('.wizard .modal-x').click()`);
});
await step('step 2: "Look around with sample data" loads the sample, shows the banner', async () => {
  await arrive(); await btn('Continue', '.wizard'); await btn('Look around with sample data', '.wizard');
  await until(`!document.getElementById('modal').open`, 'guide closed');
  await until(`(document.body.textContent||'').toLowerCase().includes('sample')`, 'sample banner', 15000);
  if ((await rows()).length < 5) throw new Error('sample rows were not stored');
});
await step('step 3: "Finish setup" straight away works with the defaults and adds the monthly update reminder', async () => {
  await toStep3('Defaults House');
  await btn('Finish setup', '.wizard');
  await until(`!document.getElementById('modal').open`, 'finished without any error message');
  const mine = (await extrasState()).rems.map(r => r.title);
  if (!mine.includes('Update estimated value')) throw new Error(JSON.stringify(mine));
});
await step('step 3: choosing a date ticks that reminder by itself; ticking one without a date is explained', async () => {
  await toStep3('Dated House');
  await ev(`(()=>{const d=document.querySelectorAll('.wz-rem input[type=date]')[2]; d.value=${JSON.stringify(goodDate())}; d.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  if (!(await ev(`document.querySelectorAll('.wz-rem input[type=checkbox]')[2].checked`))) throw new Error('picking a date did not tick the reminder');
  await ev(`document.querySelectorAll('.wz-rem input[type=checkbox]')[0].click()`);
  await btn('Finish setup', '.wizard'); await until(`/Pick a date/.test(document.querySelector('.wizard .form-err')?.textContent||'')`, 'explains the missing date');
  await ev(`document.querySelectorAll('.wz-rem input[type=checkbox]')[0].click()`);
  await btn('Finish setup', '.wizard'); await until(`!document.getElementById('modal').open`, 'finished');
  const mine = (await extrasState()).rems.map(r => r.title);
  if (!mine.includes('Inspection or service') || mine.includes('Insurance renewal')) throw new Error(JSON.stringify(mine));
});
await step('step 3: a double click on Finish creates each reminder once', async () => {
  await toStep3('Twice House');
  const before = (await extrasState()).rems.length;
  await ev(`(()=>{const b=[...document.querySelectorAll('.wizard button')].find(b=>b.textContent.trim().startsWith('Finish setup')); b.click(); b.click();})()`);
  await until(`!document.getElementById('modal').open`, 'finished'); await sleep(300);
  const added = (await extrasState()).rems.length - before; if (added !== 1) throw new Error(`${added} reminders were created, expected 1`);
});
await step('step 3: Skip leaves the asset saved and adds no reminders', async () => {
  await toStep3('Skipper House');
  const before = (await extrasState()).rems.length; await btn('Skip', '.wizard'); await until(`!document.getElementById('modal').open`, 'skipped');
  if ((await rows()).filter(r => r.name === 'Skipper House').length !== 1) throw new Error('asset missing');
  if ((await extrasState()).rems.length !== before) throw new Error('reminders were added');
});
await step('step 2: import a CSV from the guide, then step 3 follows', async () => {
  await arrive(); await btn('Continue', '.wizard'); await btn('Import a spreadsheet', '.wizard'); await until(`document.getElementById('imp-file')`, 'import dialog');
  const csv = 'name,type,location,value,cost\nCsv House,house,"Austin, TX",300000,250000\nCsv Car,car,"Austin, TX",20000,25000\n';
  const { writeFileSync } = await import('node:fs'); const path = join(tmpdir(), 'onboarding-import.csv'); writeFileSync(path, csv);
  await send('DOM.enable'); const doc = (await send('DOM.getDocument')).result.root.nodeId; const node = (await send('DOM.querySelector', { nodeId: doc, selector: '#imp-file' })).result.nodeId;
  await send('DOM.setFileInputFiles', { nodeId: node, files: [path] });
  await until(`/2 ready/.test(document.querySelector('.imp-sum')?.textContent||'')`, 'preview of 2 ready rows');
  await btn('Import 2', '#modal'); await until(wiz('Never miss a date'), 'step 3 after the import', 15000);
  await btn('Finish setup', '.wizard'); await until(`!document.getElementById('modal').open`, 'finished');
  if ((await rows()).filter(r => /^Csv /.test(r.name)).length !== 2) throw new Error('rows missing');
});

// ---- the same walk on a phone: every button must be reachable
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
const noSideScroll = () => ev(`document.documentElement.scrollWidth <= innerWidth`);
await step('phone: every button of the three steps is inside the screen and clickable', async () => {
  await arrive();
  await mustReach('Skip for now'); await mustReach('Continue'); await pickHouse(); await mustReach('Continue with 1');
  const closeOk = await ev(`(()=>{const b=document.querySelector('.wizard .modal-x'); const r=b.getBoundingClientRect(); const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return (b.contains(t)||t===b) && r.left>=0 && r.right<=innerWidth;})()`);
  if (!closeOk) throw new Error('the close button is covered or outside the screen');
  await btn('Continue with 1', '.wizard'); await until(wiz('Add your first one'), 'step 2');
  await mustReach('Add your house'); await mustReach('Import a spreadsheet'); await mustReach('Look around'); await mustReach('Back');
  await btn('Add your house', '.wizard'); await until(`document.getElementById('f-name')`, 'form on the phone');
  if (!(await noSideScroll())) throw new Error('the form is wider than the phone');
  await mustReach('Add asset', '#modal');
  await fillForm('Phone House'); await until(wiz('Never miss a date'), 'step 3');
  await mustReach('Skip'); await mustReach('Finish setup');
  if (!(await noSideScroll())) throw new Error('horizontal scroll on the phone');
  await btn('Finish setup', '.wizard'); await until(`!document.getElementById('modal').open`, 'finished on the phone');
});
await step('phone: the dashboard after the guide has no horizontal scroll and the new asset is listed', async () => {
  await sleep(300);
  if (!(await noSideScroll())) throw new Error('horizontal scroll');
  if (!(await ev(`(document.body.textContent||'').includes('Phone House')`))) throw new Error('asset not shown');
});
await step('no uncaught script errors during the whole run', async () => { if (errors.length) throw new Error(errors.slice(0, 4).join(' | ')); });

console.log(failed ? `\n${failed} step(s) failed` : '\nAll onboarding steps passed');
done(failed ? 1 : 0);
