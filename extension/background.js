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
