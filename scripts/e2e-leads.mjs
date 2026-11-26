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
await step('settings: the business is editable, with the pages to watch and the daily cap', async () => {
  await tab('Settings'); await until(`document.getElementById('pf-queries')`, 'form');
  if (!/alternative to quickbooks/.test(await ev(`document.getElementById('pf-queries').value`))) throw new Error('queries missing');
  await ev(`document.getElementById('pf-queries').value = 'alternative to quickbooks\\nsimple invoicing for freelancers'`);
  await ev(`document.getElementById('pf-watch').value = 'https://www.linkedin.com/company/quickbooks\\nnot-a-linkedin-address.com'`);
  await ev(`document.getElementById('pf-cap').value = '12'`); await ev(`document.getElementById('pf-tz').value = 'UTC'`);
  await ev(`document.querySelector('.profile-form').requestSubmit()`);
  await until(`document.querySelector('.toast.show')?.textContent.includes('Saved')`, 'saved');
  const p = (await store()).business_profiles[0];
  if (p.queries.length !== 2) throw new Error('profile not updated');
  if (JSON.stringify(p.watch) !== JSON.stringify(['https://www.linkedin.com/company/quickbooks'])) throw new Error('watch list: ' + JSON.stringify(p.watch));
  if (p.invite_cap !== 12 || p.auto_send !== false) throw new Error('caps: ' + p.invite_cap + ' ' + p.auto_send);
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
await step('plan and billing speak about leads, not assets, and the plan picker opens', async () => {
  await tab('Map'); await click('#profile-btn'); await until(`document.getElementById('modal').open && document.querySelector('.acct-modal')`, 'account menu');
  const t = await text('.acct-modal'); if (!/Plan and billing/.test(t)) throw new Error('no plan section');
  if (/\bassets?\b/i.test(t)) throw new Error(`the account menu still says assets: ${t.slice(0, 200)}`);
  await click('#plan-btn'); await until(`document.getElementById('bl-range')`, 'plan picker');
  const b = await text('.bl'); if (/\bassets?\b/i.test(b)) throw new Error(`the plan picker still says assets: ${b.slice(0, 300)}`);
  if (!/How many leads a month do you want/.test(b) || !/75 leads/.test(b)) throw new Error(`unexpected picker text: ${b.slice(0, 300)}`);
  await shot('9-plan'); await ev(`document.querySelector('#modal .modal-x').click()`);
});
await step('sharing: a private link shows the leads read-only, and the drafts only when the owner allows them', async () => {
  await tab('Map'); await click('#share-btn'); await until(`document.getElementById('sh-label')`, 'share form');
  await ev(`(()=>{document.getElementById('sh-label').value='My salesperson'; document.getElementById('sh-debt').checked=false; document.querySelector('.share-form').requestSubmit();})()`);
  await until(`document.querySelector('.share-url input')`, 'the link');
  const link = await ev(`document.querySelector('.share-url input').value`); if (!/\/share\.html#t=[A-Za-z0-9_-]{43}$/.test(link)) throw new Error(`odd link ${link}`);
  const token = link.split('#t=')[1];
  const api = await ev(`fetch('/api/share', { headers: { 'x-share-token': ${JSON.stringify(token)} } }).then(r => r.json())`);
  if (!api.leads?.length || api.leads.some(l => l.draft) || api.includeDrafts !== false) throw new Error('drafts were shared');
  if (api.leads.some(l => 'user_id' in l || 'author_url' in l || 'external_id' in l)) throw new Error('private columns leaked');
  await goto(link); await until(`!document.getElementById('shell').hidden && /Leads/.test(document.getElementById('hero-value').textContent)`, 'the shared view');
  if (!/not shared/.test(await text('#app-banner'))) throw new Error('the banner does not say drafts are not shared');
  if (!(await ev(`document.querySelectorAll('#view-reports .lt tbody tr').length >= 2`))) throw new Error('no list');
  await shot('10-shared');
  const bad = await ev(`fetch('/api/share', { headers: { 'x-share-token': 'A'.repeat(43) } }).then(r => r.status)`); if (bad !== 404) throw new Error(`a wrong link answered ${bad}`);
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'back in the app');
});
await step('the website: same globe and card, no invented proof, the pricing slider counts leads', async () => {
  await goto(`${mock.origin}/index.html`); await until(`document.querySelector('#hero-map canvas.globe-canvas') && document.querySelector('#hero-sel .lead-card')`, 'hero preview', 12000);
  const page = await ev(`document.body.innerText`);
  if (/4\.9\/5|1653|customers? (trust|love)|Daniel R/i.test(page)) throw new Error('invented social proof is still on the page');
  if (/\bassets?\b/i.test(page.replace(/Assets/g, ''))) throw new Error(`the page still talks about assets: ${(page.match(/.{40}\bassets?\b.{40}/i) || [''])[0]}`);
  if ((await ev(`document.querySelectorAll('.faq-item').length`)) !== 9) throw new Error('faq count');
  await ev(`(()=>{const r=document.getElementById('px-range'); r.value='10'; r.dispatchEvent(new Event('input'));})()`);
  await sleep(700);
  if ((await text('#px-count')) !== '250' || !/\$152/.test(await text('#px-total'))) throw new Error(`pricing: ${await text('#px-count')} leads, ${await text('#px-total')}`);
  if (!/assets=10/.test(await ev(`document.querySelector('.px-btn').getAttribute('href')`))) throw new Error('checkout link does not carry the chosen packs');
  if (await ev(`document.documentElement.scrollWidth > innerWidth + 1`)) throw new Error('horizontal scroll');
  await shot('11-landing');
  await ev(`window.scrollTo(0, document.getElementById('signals').offsetTop - 80)`); await sleep(900); await shot('12-landing-signals');
});
const monday = (() => { const d = new Date(Date.now() + 2 * 86400_000); d.setUTCHours(10, 0, 0, 0); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); return d.getTime(); })();
const tickAt = async (t, label) => { const r = await realFetch(`${mock.origin}/api/tick`, { method: 'POST', headers: { 'x-cron-secret': 'mock-cron-secret-value', 'x-test-now': String(t) } }); if (r.status !== 200) throw new Error(`tick ${label}: ${r.status} ${await r.text()}`); return r.json(); };
const li = async q => (await realFetch(`${mock.origin}/__unipile${q || ''}`)).json();
await step('connect LinkedIn: the person logs in on the provider page and comes back with an account', async () => {
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'the app');
  await tab('Outreach'); await until(`document.getElementById('li-connect')`, 'the connect button');
  if (!/Connect your LinkedIn account/.test(await text('.out-queue'))) throw new Error('the empty queue does not say to connect');
  await click('#li-connect');
  await until(`location.search === '' && document.querySelector('#view-outreach .sh-row')`, 'back from the provider with an account', 12000);
  const rows = (await store()).linkedin_accounts;
  if (rows.length !== 1 || rows[0].status !== 'connected' || !/^MOCKACC-/.test(rows[0].provider_account_id)) throw new Error('account: ' + JSON.stringify(rows));
  if (JSON.stringify(rows).match(/password|cookie|li_at/i)) throw new Error('something secret was stored');
  await shot('9-outreach-connected');
});
await step('looking for people uses the person’s own account: scored leads, messages written, all waiting for approval', async () => {
  await click('#li-scan');
  try { await until(`document.querySelectorAll('.out-card').length >= 1`, 'a message sequence waiting', 15000); }
  catch (e) { const st = await store(); throw new Error(`${e.message}. toast: "${await text('#toast')}"; linkedin leads ${st.leads.filter(l => l.source === 'linkedin').length}; outreach ${st.outreach.length}; profile ${JSON.stringify(st.business_profiles[0]?.queries)} ${JSON.stringify(st.business_profiles[0]?.watch)}`); }
  const st = await store(); const mine = st.leads.filter(l => l.source === 'linkedin');
  if (mine.length < 1 || mine.some(l => l.author_name === 'Sam Doe')) throw new Error('linkedin leads: ' + mine.map(l => l.author_name));
  if (!mine.every(l => l.provider_id && l.lat != null)) throw new Error('missing LinkedIn id or place: ' + JSON.stringify(mine.map(l => [l.author_name, l.provider_id, l.lat, l.place, l.is_sample])));
  const rows = st.outreach.filter(r => r.status === 'draft');
  if (rows.length !== 3 * mine.length || !rows.every(r => !r.due_at)) throw new Error('drafts: ' + JSON.stringify(rows.map(r => [r.step, r.status, r.due_at])));
  if (!(await ev(`document.querySelectorAll('.out-card').length === ${mine.length} && document.querySelectorAll('.out-card textarea').length === ${3 * mine.length}`))) throw new Error('the messages are not editable on screen');
  await shot('10-outreach-queue');
});
await step('nothing is sent until the person approves, then the invitation goes out from their account within the rules', async () => {
  let r = await tickAt(monday, 'before approval'); if (r.sent !== 0 || (await li()).log.length) throw new Error('something was sent without approval');
  const before = await ev(`document.querySelectorAll('.out-card').length`);
  await ev(`(()=>{const c=[...document.querySelectorAll('.out-card')].find(x=>/Dana/.test(x.textContent)); c.querySelector('textarea').value = 'Hi Dana, saw your question about invoicing tools. Happy to connect.'; c.querySelector('.out-approve').click();})()`);
  await until(`document.querySelectorAll('.out-card').length === ${before - 1}`, 'the card to leave the queue');
  const dana = (await store()).leads.find(l => l.provider_id === 'MEMBER-1'); const rows = (await store()).outreach.filter(x => x.lead_id === dana.id); const inv = rows.find(x => x.step === 'invite');
  if (inv.status !== 'approved' || inv.text !== 'Hi Dana, saw your question about invoicing tools. Happy to connect.') throw new Error('invite: ' + JSON.stringify(inv));
  if (rows.filter(x => x.step !== 'invite').some(x => x.status !== 'approved' || x.due_at)) throw new Error('follow-ups must wait for the acceptance');
  r = await tickAt(monday + 60_000, 'send'); if (r.sent !== 1) throw new Error('sent ' + r.sent);
  const log = (await li()).log; if (log.length !== 1 || log[0][0] !== 'invite' || log[0][1] !== 'MEMBER-1' || !/Hi Dana/.test(log[0][2])) throw new Error(JSON.stringify(log));
  const lead = (await store()).leads.find(l => l.provider_id === 'MEMBER-1'); if (lead.status !== 'contacted') throw new Error('status ' + lead.status);
  r = await tickAt(monday + 2 * 3600_000, 'again'); if (r.sent !== 0) throw new Error('a second send with nothing due');
});
await step('they accept, the follow-up goes a day later; a reply ends the sequence and marks the lead', async () => {
  await li('?friends=MEMBER-1');
  let r = await tickAt(monday + 3 * 3600_000, 'accepted'); if (r.accepted !== 1) throw new Error('accepted ' + r.accepted);
  const dana = (await store()).leads.find(l => l.provider_id === 'MEMBER-1'); const f1 = (await store()).outreach.find(x => x.step === 'follow1' && x.lead_id === dana.id); if (!f1.due_at || Date.parse(f1.due_at) - (monday + 3 * 3600_000) < 86400_000) throw new Error('follow-up due ' + f1.due_at);
  r = await tickAt(monday + 3 * 3600_000 + 86400_000 + 4 * 3600_000, 'follow-up'); if (r.sent !== 1) throw new Error('follow-up sent ' + r.sent);
  if ((await li()).log.at(-1)[0] !== 'message') throw new Error('no message was sent');
  await li('?inbox=MEMBER-1');
  r = await tickAt(monday + 3 * 3600_000 + 86400_000 + 6 * 3600_000, 'reply'); if (r.replied !== 1) throw new Error('replied ' + r.replied);
  const st = await store(); if (st.leads.find(l => l.provider_id === 'MEMBER-1').status !== 'replied') throw new Error('lead not marked');
  if (st.outreach.some(x => x.step === 'follow2' && x.lead_id === dana.id && x.status !== 'stopped')) throw new Error('the second follow-up was not stopped');
  await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('shell').hidden`, 'reload'); await tab('Outreach');
  await until(`/Invitations sent/.test(document.getElementById('view-outreach').textContent)`, 'stats'); await shot('11-outreach-progress');
  const t = await text('#view-outreach'); if (!/Accepted/.test(t) || !/Replied/.test(t)) throw new Error(t.slice(0, 300));
});
await step('the scheduler rejects a wrong secret, and the browser cannot attach an account itself', async () => {
  const bad = await realFetch(`${mock.origin}/api/tick`, { method: 'POST', headers: { 'x-cron-secret': 'nope' } }); if (bad.status !== 401) throw new Error('tick without the secret: ' + bad.status);
  const r = await ev(`(async()=>{ const s = JSON.parse(localStorage.getItem('atlas.session.v1')); const res = await fetch('/rest/v1/linkedin_accounts', { method: 'POST', headers: { apikey: 'mock-anon-key', authorization: 'Bearer ' + s.access_token, 'content-type': 'application/json' }, body: JSON.stringify({ provider_account_id: 'STOLEN-1', name: 'x' }) }); return res.status; })()`);
  if (r !== 403) throw new Error('an account could be created from the browser: ' + r);
});
await step('another account sees none of these leads (row isolation)', async () => {
  const other = 'other@example.com'; await realFetch(`${mock.origin}/__user?email=${other}&password=${PW}`);
  await goto(`${mock.origin}/app.html`); await ev(`localStorage.clear()`); await goto(`${mock.origin}/app.html`); await until(`!document.getElementById('auth').hidden`, 'sign in');
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
