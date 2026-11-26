const $ = id => document.getElementById(id);
async function paint() {
  const s = await chrome.storage.local.get({ token: '', base: '', saved: 0, scanned: 0, placed: 0, last: '', lastError: '', cap: 15, auto: false, queue: [], sent: 0 });
  $('cap').value = s.cap; $('auto').checked = !!s.auto; $('today').textContent = 'Queued: ' + s.queue.length + '. Done today: ' + s.sent + '.';
  $('base').value = s.base || '';
  const box = $('status'); box.className = '';
  if (!s.token) { box.textContent = 'Not connected yet.'; return; }
  const when = s.last ? new Date(s.last).toLocaleString() : 'nothing sent yet';
  box.textContent = `Connected. Read ${s.scanned} posts, saved ${s.saved} leads, placed ${s.placed} on the map. Last: ${when}.`;
  if (s.lastError) { box.classList.add('err'); box.textContent += ` Last problem: ${s.lastError}.`; }
}
$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({ cap: Math.min(25, Math.max(1, Number($('cap').value) || 15)), auto: $('auto').checked });
  if (!$('token').value.trim()) { paint(); return; }
  const token = $('token').value.trim(), base = $('base').value.trim().replace(/\/$/, '');
  if (token.length < 20) { $('status').className = 'err'; $('status').textContent = 'Paste the pairing code from the app (Settings, Connect the extension).'; return; }
  if (base && !/^https:\/\/|^http:\/\/localhost[:/]/.test(base)) { $('status').className = 'err'; $('status').textContent = 'The address must start with https://.'; return; }
  await chrome.storage.local.set({ token, base, lastError: '' }); $('token').value = ''; paint();
});
$('off').addEventListener('click', async () => { await chrome.storage.local.remove(['token', 'saved', 'scanned', 'placed', 'last', 'lastError']); paint(); });
paint();
