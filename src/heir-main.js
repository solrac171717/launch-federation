// heir.html: what the trusted person sees. No sign-in: the private link is the key, and the server decides whether the sheet is open yet.
import { h } from './dom.js';
import { toView, fromDb } from './asset-store.js';
import { emergencyHtml } from './emergency.js';
import { loadRates } from './fx.js';

document.documentElement.classList.add('js');
const $ = id => document.getElementById(id);

function say(title, text) {
  $('boot').replaceChildren(h('b', {}, title), ' ', text, ' ', h('a', { href: 'index.html' }, 'Go to Owned Map'));
}

async function start() {
  const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('t');
  if (!token) return say('This link is incomplete.', 'Ask the person who gave it to you for the full link.');
  let data;
  try {
    const r = await fetch('/api/heir', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }), cache: 'no-store' });
    if (r.status === 404) return say('This link does not work.', 'It may have been replaced, paused or removed by the person who gave it to you.');
    if (r.status === 403) return say('This sheet is not open yet.', 'It opens only if the person who set it up has not been seen for a long time, or chooses to release it. If this is an emergency, try to reach them or the people close to them first.');
    if (!r.ok) return say('We could not open the sheet.', 'Please try again in a moment.');
    data = await r.json();
  } catch { return say('We could not reach Owned Map.', 'Check your connection and try again.'); }

  await loadRates();
  const assets = data.assets.map(fromDb).map(toView);
  const docs = data.docs.map(d => ({ assetId: d.asset_id, name: d.name, kind: d.kind }));
  const reminders = data.reminders.map(x => ({ assetId: x.asset_id, title: x.title, dueOn: x.due_on, done: !!x.done }));
  const html = emergencyHtml({ assets, docs, reminders, settings: data.settings, owner: data.ownerEmail || '' });
  $('boot').hidden = true; $('heir').hidden = false;
  $('heir-title').textContent = `Emergency sheet of ${data.ownerEmail || 'the owner'}`;
  $('heir-sub').textContent = data.reason === 'owner' ? 'They released it for you.' : 'It opened because they have not signed in for a long time.';
  $('heir-note').textContent = 'This page is private. Values are estimates entered by the owner. You can read it but not change anything. Print it or save it as a PDF if you need to keep it.';
  const frame = $('heir-frame'); frame.srcdoc = html;
  $('heir-print').addEventListener('click', () => { frame.contentWindow.focus(); frame.contentWindow.print(); });
}
start();
