// Sends what the content scripts read to the person's own Owned Map account. The token is the pairing secret made in the app (Settings, Connect the extension).
// Requests go from here, not from the LinkedIn page, so the page never sees the token.
const DEFAULT_BASE = 'https://ownedmap.com';

async function post(body) {
  const { token, base } = await chrome.storage.local.get(['token', 'base']);
  if (!token) return { ok: false, error: 'not_paired' };
  const origin = String(base || DEFAULT_BASE).replace(/\/$/, '');
  if (!/^https:\/\/|^http:\/\/localhost[:/]/.test(origin)) return { ok: false, error: 'bad_base' };
  try {
    const res = await fetch(`${origin}/api/ingest`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    const stats = await chrome.storage.local.get({ saved: 0, scanned: 0, placed: 0 });
    if (res.ok) await chrome.storage.local.set({ saved: stats.saved + (data.saved || 0), scanned: stats.scanned + (data.scanned || 0), placed: stats.placed + (data.placed || 0), last: new Date().toISOString(), lastError: '' });
    else await chrome.storage.local.set({ lastError: data.error || `error ${res.status}` });
    return { ok: res.ok, ...data };
  } catch { await chrome.storage.local.set({ lastError: 'network' }); return { ok: false, error: 'network' }; }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false; // only our own scripts
  if (msg?.type === 'posts' && Array.isArray(msg.items)) post({ items: msg.items.slice(0, 20) }).then(reply);
  else if (msg?.type === 'profile' && msg.profile) post({ profile: msg.profile }).then(reply);
  else return false;
  return true; // the answer is asynchronous
});

/* ------------------------------------------------------------------ outreach: the leads the person queued in the app, one at a time */
const DAY_MAX = 25, PAUSE = [60_000, 150_000], STALE = 4 * 60_000;
const today = () => new Date().toISOString().slice(0, 10);
const norm = u => { try { const x = new URL(u); return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '').toLowerCase(); } catch { return ''; } };
const get = () => chrome.storage.local.get({ queue: [], current: null, nextAt: 0, day: '', sent: 0, cap: 15, auto: false });
async function state() { const s = await get(); if (s.day !== today()) { s.day = today(); s.sent = 0; await chrome.storage.local.set({ day: s.day, sent: 0 }); } return s; }
const view = s => ({ queued: s.queue.length + (s.current ? 1 : 0), sentToday: s.sent, cap: Math.min(s.cap, DAY_MAX), auto: s.auto, version: chrome.runtime.getManifest().version });

async function enqueue(items) {
  const s = await state(), have = new Set([...s.queue.map(j => norm(j.url)), s.current ? norm(s.current.url) : '']);
  for (const i of items) {
    const url = String(i.url || '');
    if (!/^https:\/\/([a-z]+\.)?linkedin\.com\/in\//i.test(url) || have.has(norm(url))) continue;
    const text = String(i.text || '').trim().slice(0, 1900), note = String(i.note || '').trim().slice(0, 200);
    if (!text || !note) continue;
    have.add(norm(url)); s.queue.push({ id: String(i.id || '').slice(0, 80), url, text, note });
  }
  await chrome.storage.local.set({ queue: s.queue.slice(0, 100) });
  await chrome.alarms.create('tick', { periodInMinutes: 1 }); tick();
  return view(await state());
}
async function finish(s, verdict) {
  const cur = s.current;
  await chrome.storage.local.set({ current: null, nextAt: Date.now() + PAUSE[0] + Math.random() * (PAUSE[1] - PAUSE[0]), sent: s.sent + (verdict.result === 'failed' ? 0 : 1), lastOutreach: verdict.result + (verdict.reason ? ':' + verdict.reason : '') });
  if (verdict.result === 'sent' && cur) post({ outreach: { url: cur.url, kind: verdict.kind } });
}
async function tick() {
  const s = await state();
  if (s.current) { if (Date.now() - s.current.started > STALE) await finish(s, { result: 'failed', reason: 'timeout' }); return; }
  if (!s.queue.length || Date.now() < s.nextAt || s.sent >= Math.min(s.cap, DAY_MAX)) return;
  const job = { ...s.queue[0], started: Date.now() };
  await chrome.storage.local.set({ queue: s.queue.slice(1), current: job });
  chrome.tabs.create({ url: job.url, active: !s.auto }); // when the person presses Send themselves, the tab is in front
}
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tick') tick(); });
chrome.runtime.onStartup.addListener(() => tick());
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (msg?.type === 'status') state().then(s => reply(view(s)));
  else if (msg?.type === 'queue' && Array.isArray(msg.items)) enqueue(msg.items).then(reply);
  else if (msg?.type === 'job') state().then(s => reply(s.current && norm(s.current.url) === norm(msg.url) ? { job: s.current, auto: s.auto } : {}));
  else if (msg?.type === 'result') state().then(async s => { if (s.current && s.current.id === msg.id) await finish(s, msg); if (msg.result === 'sent' && sender.tab?.id) setTimeout(() => chrome.tabs.remove(sender.tab.id).catch(() => {}), 4000); reply({}); });
  else return false;
  return true;
});
