// share.html: the read-only view behind a share link. No sign-in, no editing: the owner decides what is shared and can revoke it.
import { h } from './dom.js';
import { toView, fromDb } from './asset-store.js';
import { mountDashboard } from './dashboard.js';

document.documentElement.classList.add('js');
const $ = id => document.getElementById(id);

function fail(title, text) {
  $('boot').replaceChildren(h('b', {}, title), ' ', text, ' ', h('a', { href: 'index.html' }, 'Go to ATLAS'));
}

async function start() {
  const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('t');
  if (!token) return fail('This link is incomplete.', 'Ask the person who shared it for a new one.');
  let data;
  try {
    const r = await fetch('/api/share', { headers: { 'x-share-token': token }, cache: 'no-store' });
    if (r.status === 404) return fail('This link no longer works.', 'It may have expired or been turned off. Ask the person who shared it for a new one.');
    if (!r.ok) return fail('We could not open this portfolio.', 'Please try again in a moment.');
    data = await r.json();
  } catch { return fail('We could not reach ATLAS.', 'Check your connection and try again.'); }

  const views = data.assets.map(fromDb).map(toView);
  $('boot').hidden = true; $('shell').hidden = false;
  mountDashboard({ getAssets: () => views, csvName: 'atlas-shared-assets.csv', globeLabel: 'Rotating 3D globe of the shared assets', owner: `Shared by ${data.label || 'the owner'}`, cashflow: true });
  const b = $('app-banner'); b.hidden = false;
  b.append(h('div', { class: 'banner-row' }, h('span', {}, `Read-only view shared with “${data.label || 'you'}”. Figures are estimates entered by the owner${data.includeDebt ? '' : ', and debt is not included'}.`)));
}
start();
