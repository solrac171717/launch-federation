// The leads app end to end in a real headless Chrome: sign in, describe a business, watch leads arrive, work one, pair the extension.
// Supabase, the model, Hacker News and the geocoder are all stand-ins (see scripts/mock-supabase.mjs); nothing leaves this machine.
//   node scripts/e2e-leads.mjs           (set CHROME=... if Chrome is not in the default place; SHOTS=dir to keep screenshots)
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startMock } from './mock-supabase.mjs';

const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!CHROME) { console.error('Chrome not found. Set CHROME=path'); process.exit(2); }
const SHOTS = process.env.SHOTS || ''; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// pretend Hacker News, Hacker News profiles and OpenStreetMap; everything else (the mock Supabase, the mock model) goes through
const realFetch = globalThis.fetch;
const HITS = [
  ['101', 'maria_ops', 'We are moving off QuickBooks, anything simpler for invoicing a team of five?'],
  ['102', 'sam_dev', 'Any recommendation for invoicing software that does not need an accountant to set up?'],
  ['103', 'weather_fan', 'Lovely weather this week, going out for a long walk by the river with the dog'],
  ['104', 'cfo_jane', 'Our bookkeeping tool keeps double counting invoices at month end, looking around'],
].map(([id, author, text], i) => ({ objectID: id, author, comment_text: `<p>${text}`, created_at: `2026-11-2${i}T10:00:00Z` }));
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('hn.algolia.com')) return new Response(JSON.stringify({ hits: HITS }), { headers: { 'content-type': 'application/json' } });
  if (u.includes('hacker-news.firebaseio.com')) return new Response('null', { headers: { 'content-type': 'application/json' } });
  if (u.includes('nominatim')) return new Response('[]', { headers: { 'content-type': 'application/json' } });
  return realFetch(url, init);
};

const mock = await startMock({ port: 4184, root: '.' });
const PORT = 9900 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'leads-e2e-'))}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
const done = code => { try { chrome.kill(); } catch {} mock.close(); process.exit(code); };
let target; for (let i = 0; i < 50 && !target; i++) { try { target = (await (await realFetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page'); } catch { await sleep(200); } }
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
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
const until = async (expr, what, ms = 9000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return; } catch {} await sleep(100); } throw new Error(`timeout waiting for ${what}`); };
const goto = async url => { await send('Page.navigate', { url: 'about:blank' }); await sleep(150); await send('Page.navigate', { url }); await sleep(300); };
const shot = async name => { if (!SHOTS) return; const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

let n = 0, failed = 0;
const step = async (name, fn) => { try { await fn(); console.log(`ok   ${++n}. ${name}`); } catch (e) { failed++; console.log(`FAIL ${++n}. ${name}\n       ${e.message}`); } };
const store = async () => (await realFetch(`${mock.origin}/__leads`)).json();
const click = sel => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('no ${sel}'); e.click(); return true;})()`);
const text = sel => ev(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent||''`);
const tab = name => ev(`[...document.querySelectorAll('#view-tabs button')].find(b => b.textContent.trim() === ${JSON.stringify(name)}).click()`);
const PW = 'correct-horse-9', EMAIL = 'seller@example.com';

await step('sign in: a new account lands on the first question, not on an empty dashboard', async () => {
  await realFetch(`${mock.origin}/__user?email=${EMAIL}&password=${PW}`);
  await goto(`${mock.origin}/app.html`); await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html`);
  await until(`!document.getElementById('auth').hidden`, 'sign in');
  await ev(`(()=>{document.getElementById('auth-email').value=${JSON.stringify(EMAIL)}; document.getElementById('auth-password').value=${JSON.stringify(PW)}; document.getElementById('auth-form').requestSubmit();})()`);
  await until(`!document.getElementById('shell').hidden && document.querySelector('.onb')`, 'onboarding');
  if (!/Who is looking for what you sell/.test(await text('.onb'))) throw new Error('wrong first screen');
  await shot('1-onboarding');
});
await step('the globe is there from the start, and the page has no horizontal scroll', async () => {
  if (!(await ev(`!!document.querySelector('#hero-map canvas.globe-canvas')`))) throw new Error('no globe canvas');
  if (await ev(`document.documentElement.scrollWidth > innerWidth + 1`)) throw new Error('horizontal scroll');
});
await step('describing the business fills the globe: profile saved, leads scored, noise dropped, places found', async () => {
  await ev(`document.getElementById('onb-text').value = 'We sell simple invoicing software for small teams who are tired of QuickBooks.'`);
  const t0 = Date.now(); await click('#onb-go');
  try { await until(`document.querySelectorAll('#hero-sel .lead-card').length === 1`, 'the first lead card', 15000); }
  catch (e) { const st = await store(); throw new Error(`${e.message}. onboarding error: "${await text('.onb .err')}"; toast: "${await text('#toast')}"; profiles ${st.business_profiles.length}, leads ${st.leads.length}; page errors: ${errors.slice(0, 3).join(' | ')}`); }
  const rows = await store();
  if (rows.business_profiles.length !== 1 || !rows.business_profiles[0].queries.length) throw new Error('profile not saved');
  if (rows.leads.length < 2) throw new Error(`expected leads, got ${rows.leads.length}`);
  if (rows.leads.some(l => l.author_name === 'weather_fan')) throw new Error('the off-topic post became a lead');
  if (!rows.leads.every(l => l.user_id === rows.business_profiles[0].user_id && l.history.length === 1)) throw new Error('rows are wrong');
  if (!rows.leads.some(l => l.lat != null && l.country)) throw new Error('nobody was placed on the map');
  console.log(`       first lead on screen ${Date.now() - t0} ms after pressing the button (stand-in model)`);
  await sleep(1200); await shot('2-globe-with-leads');
});
await step('the side panel counts the leads and the globe cards are readable', async () => {
  const k = await text('#hero-value'); if (!/Leads found/.test(k) || !/\d/.test(k)) throw new Error(k);
  if (!/Average score/.test(await text('#hero-pair'))) throw new Error('no average score');
  if (!(await ev(`document.querySelectorAll('#hero-chart .fn-row').length === 4`))) throw new Error('no funnel');
});
await step('searching again never duplicates a signal', async () => {
  const before = (await store()).leads.length; await click('#find-btn');
  await until(`!document.getElementById('find-btn').disabled`, 'search finished'); await sleep(400);
  if ((await store()).leads.length !== before) throw new Error('duplicates were saved');
});
await step('the leads list: filter, sort, open a lead, see the draft, copy it', async () => {
  await tab('Leads'); await until(`document.querySelectorAll('.lt tbody tr').length >= 2`, 'rows');
  await shot('3-list');
  await ev(`(()=>{const q=document.querySelector('.tbl-q'); q.value='quickbooks'; q.dispatchEvent(new Event('input'));})()`);
  await until(`document.querySelectorAll('.lt tbody tr').length >= 1 && /of \\d+ leads/.test(document.querySelector('.tbl-count').textContent)`, 'filtered');
  await ev(`(()=>{const q=document.querySelector('.tbl-q'); q.value=''; q.dispatchEvent(new Event('input'));})()`);
  await click('.lt tbody tr'); await until(`document.getElementById('modal').open && document.getElementById('lead-draft')`, 'the lead');
  if (!/Happy to help/.test(await ev(`document.getElementById('lead-draft').value`))) throw new Error('no draft');
  if (!(await ev(`!!document.querySelector('.lead-detail .ld-quote') && !!document.querySelector('.lead-detail a[href^="https://news.ycombinator.com"]')`))) throw new Error('quote or link missing');
  if (!(await ev(`document.querySelector('.lead-detail a[target=_blank]').rel.includes('noopener')`))) throw new Error('external link without noopener');
  await shot('4-lead');
});
await step('working a lead: the status moves, the history records it, and it survives a reload', async () => {
  await ev(`[...document.querySelectorAll('.ld-steps .step')].find(b => b.textContent === 'Contacted').click()`);
  await until(`document.querySelector('.ld-steps .step.on')?.textContent === 'Contacted'`, 'status shown');
  const rows = (await store()).leads; const moved = rows.find(l => l.status === 'contacted');
  if (!moved || moved.history.length !== 2 || moved.history[1].e !== 'contacted') throw new Error('not recorded');
  await ev(`document.querySelector('#modal .modal-x').click()`);
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'back'); await tab('Leads');
  await until(`[...document.querySelectorAll('.lt tbody tr td:nth-child(6)')].some(td => td.textContent === 'Contacted')`, 'status after reload');
});
await step('activity shows the funnel, the month and the recent events', async () => {
  await tab('Activity'); await until(`document.querySelectorAll('#view-activity .fn-row').length === 4`, 'funnel');
  const t = await text('#view-activity'); if (!/Leads this month/.test(t) || !/Marked as contacted/.test(t)) throw new Error('missing parts');
  await shot('5-activity');
});
await step('settings: the business is editable, the extension pairs with a secret that is stored only as a hash', async () => {
  await tab('Settings'); await until(`document.getElementById('pf-queries')`, 'form');
  if (!/alternative to quickbooks/.test(await ev(`document.getElementById('pf-queries').value`))) throw new Error('queries missing');
  await ev(`document.getElementById('pf-queries').value = 'alternative to quickbooks\\nsimple invoicing for freelancers'`);
  await ev(`document.querySelector('.profile-form').requestSubmit()`);
  await until(`document.querySelector('.toast.show')?.textContent.includes('Saved')`, 'saved');
  if ((await store()).business_profiles[0].queries.length !== 2) throw new Error('profile not updated');
  await click('#view-settings .btn.btn-dark.btn-sm:not([onclick])'.replace(':not([onclick])', '')); // first dark button of the column is "Connect the extension"
});
await step('the extension secret is shown once and only its hash is stored', async () => {
  await ev(`[...document.querySelectorAll('#view-settings button')].find(b => b.textContent === 'Connect the extension').click()`);
  await until(`document.querySelector('.ext-token')`, 'token shown');
  const tok = await text('.ext-token'); if (tok.length < 40) throw new Error('short token');
  const rows = (await store()).ingest_tokens; if (rows.length !== 1 || rows[0].token_hash.length !== 64 || JSON.stringify(rows).includes(tok)) throw new Error('the secret was stored');
  await shot('6-settings');
});
await step('sample leads can be added and removed in one click each', async () => {
  await ev(`[...document.querySelectorAll('#view-settings button')].find(b => b.textContent === 'Add sample leads').click()`);
  await until(`[...document.querySelectorAll('#view-settings button')].some(b => /Remove \\d+ sample leads/.test(b.textContent))`, 'samples added');
  const withSamples = (await store()).leads.length;
  await tab('Map'); await sleep(600); await shot('7-map-with-samples');
  await tab('Settings'); await ev(`[...document.querySelectorAll('#view-settings button')].find(b => /Remove \\d+ sample leads/.test(b.textContent)).click()`);
  await until(`[...document.querySelectorAll('#view-settings button')].some(b => b.textContent === 'Add sample leads')`, 'samples removed');
  if ((await store()).leads.length >= withSamples) throw new Error('samples not removed');
});
await step('another account sees none of these leads (row isolation)', async () => {
  const other = 'other@example.com'; await realFetch(`${mock.origin}/__user?email=${other}&password=${PW}`);
  await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'sign in');
  await ev(`(()=>{document.getElementById('auth-email').value=${JSON.stringify(other)}; document.getElementById('auth-password').value=${JSON.stringify(PW)}; document.getElementById('auth-form').requestSubmit();})()`);
  await until(`!document.getElementById('shell').hidden && document.querySelector('.onb')`, 'their own empty start');
});
await step('phone: the first screen and the globe fit, with no horizontal scroll', async () => {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 2, mobile: true });
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'app on the phone'); await sleep(500);
  if (await ev(`document.documentElement.scrollWidth > innerWidth + 1`)) throw new Error('horizontal scroll');
  await shot('8-phone');
});
await step('no uncaught script errors during the whole run', async () => { if (errors.length) throw new Error(errors.slice(0, 4).join(' | ')); });

console.log(failed ? `\n${failed} step(s) failed` : '\nAll leads steps passed');
done(failed ? 1 : 0);
