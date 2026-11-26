// share.html: the read-only view behind a share link: the leads on the globe and in a list. No sign-in, no editing, and the owner can revoke it.
import { h, clear, ICON } from './ui.js';
import { createGlobe } from './globe.js';
import { attachGeo } from './geoui.js';
import { fromDb, toView, stats, HIGH_SCORE } from './leads-core.js';
import { leadCard, funnelBars, scorePill, sourceIcon, snippet } from './leads-view.js';

document.documentElement.classList.add('js');
const $ = id => document.getElementById(id);

function fail(title, text) {
  $('boot').replaceChildren(h('b', {}, title), ' ', text, ' ', h('a', { href: 'index.html' }, 'Go to Owned Map'));
}

async function start() {
  const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('t');
  if (!token) return fail('This link is incomplete.', 'Ask the person who shared it for a new one.');
  let data;
  try {
    const r = await fetch('/api/share', { headers: { 'x-share-token': token }, cache: 'no-store' });
    if (r.status === 404) return fail('This link no longer works.', 'It may have expired or been turned off. Ask the person who shared it for a new one.');
    if (!r.ok) return fail('We could not open these leads.', 'Please try again in a moment.');
    data = await r.json();
  } catch { return fail('We could not reach Owned Map.', 'Check your connection and try again.'); }

  const views = data.leads.map(fromDb).map(toView), located = views.filter(v => v.located), byId = id => views.find(v => v.id === id);
  $('boot').hidden = true; $('shell').hidden = false;
  clear($('app-nav')).append(h('li', { class: 'on' }, 'Map'));
  const st = { sel: (located.slice().sort((a, b) => b.score - a.score)[0] || views[0])?.id || null };
  const globe = createGlobe($('hero-map'), { assets: located, icons: ICON, selectedId: st.sel, startLon: -30, tilt: 22, countryPadV: 70, label: 'Rotating 3D globe of the shared leads', onSelect: id => select(id, true) });
  const geo = attachGeo($('hero-map'), globe, { visible: () => located, all: () => located, selected: () => st.sel, lookup: byId, onPick: (id, f) => select(id, f), onChange: () => render(), toggleAfter: $('view-title'), fmt: v => `${Math.round(v)}`, fmtGroup: () => '' });
  const render = () => {
    const v = byId(st.sel), k = stats(views);
    clear($('hero-sel')).append(v ? leadCard(v) : h('div', { class: 'app-empty' }, h('b', {}, 'Nothing on the map yet'), h('span', {}, 'These leads have no location.')));
    clear($('hero-value')).append(h('span', {}, 'Leads'), h('b', {}, String(k.total)), h('em', { class: 'muted' }, `${k.high} with a score of ${HIGH_SCORE} or more · ${k.located} on the map`));
    clear($('hero-pair')).append(h('div', { class: 'kpi' }, h('span', {}, 'Average score'), h('b', {}, String(k.avgScore)), h('em', {}, 'Out of 100')));
    clear($('hero-chart')).append(h('div', { class: 'mc-h' }, h('span', {}, 'From signal to customer')), funnelBars(views));
    const list = views.slice().sort((a, b) => b.score - a.score).slice(0, 40);
    clear($('view-reports')).append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'lt' }, h('thead', {}, h('tr', {}, ['Score', 'Who', 'What they said', 'Status'].map(t => h('th', {}, t)))),
      h('tbody', {}, ...list.map(l => h('tr', { onclick: () => select(l.id, true) }, h('td', {}, scorePill(l)), h('td', { class: 'lt-who' }, h('b', {}, l.name), h('span', {}, l.place || '')), h('td', { class: 'lt-sig' }, snippet(l.text, 140)), h('td', {}, l.statusLabel)))))));
  };
  function select(id, focus) { st.sel = id; globe.setSelected(id); if (focus) globe.focus(id); render(); geo.sync(); }
  render();
  const b = $('app-banner'); b.hidden = false;
  b.append(h('div', { class: 'banner-row' }, h('span', {}, `Read-only view shared with “${data.label || 'you'}”. Scores come from a language model and are a guide${data.includeDrafts ? '' : '; the owner’s draft replies are not shared'}.`)));
}
start();
