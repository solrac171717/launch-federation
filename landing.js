// Owned Map website. The preview and the globe run the same code as the app, on invented sample leads, and nothing here is stored or sent.
import { h, s, clear, ICON, analytics } from './src/ui.js';
import { createGlobe } from './src/globe.js';
import { attachGeo } from './src/geoui.js';
import { sampleLeads } from './src/leads-demo.js';
import { toView, stats, INTENTS, SOURCES, STATUSES, HIGH_SCORE } from './src/leads-core.js';
import { leadCard, funnelBars, scorePill, sourceIcon, snippet } from './src/leads-view.js';

document.documentElement.classList.add('js');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
analytics.track('landing_page_view');

// the sample leads as the app would hold them: located, with a history, each one flagged as a sample
const LEADS = sampleLeads().map((l, i) => toView({ ...l, id: `s${i + 1}`, history: [{ d: l.signalAt.slice(0, 10), e: 'found' }], isSample: true, createdAt: l.signalAt }));
const byId = id => LEADS.find(l => l.id === id);
const BEST = LEADS.slice().sort((a, b) => b.score - a.score)[0];

/* ------------------------------------------------------------------ headline variants */
// Default stays Variant A. `?hv=B` or `?hv=C` previews a variant for QA / future testing.
const HEADLINES = {
  A: ['Who is asking for what you sell?', 'See them on a map.'],
  B: ['Your next customers are already asking.', 'Find them today.'],
  C: ['Stop guessing who wants it.', 'See who is asking.'],
};
{
  const v = new URLSearchParams(location.search).get('hv');
  if (v && v !== 'A' && HEADLINES[v]) document.querySelector('[data-variant-slot="hero-headline"]').replaceChildren(HEADLINES[v][0] + ' ', h('span', {}, HEADLINES[v][1]));
}

/* ------------------------------------------------------------------ hero: the app's map view, on sample leads */
{
  const $ = id => document.getElementById(id);
  const TABS = [['Map', 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2.5 2 2.5 10 0 12M8 2c-2.5 2-2.5 10 0 12'], ['Leads', 'M2 4h12M2 8h12M2 12h8'], ['Activity', 'M2 13l4-5 3 3 5-7'], ['Settings', 'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 1v2M8 13v2M1 8h2M13 8h2']];
  const tab = (cls, [label, d], on) => h('button', { type: 'button', class: `${cls}${on ? ' on' : ''}`, tabindex: -1, 'aria-hidden': 'true' }, s('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' }, s('path', { d })), label);
  clear($('app-nav')).append(...TABS.map((t, i) => h('li', {}, tab('nav-btn', t, i === 0))));
  clear($('view-tabs')).append(...TABS.map((t, i) => tab('tab-btn', t, i === 0)));
  const st = { sel: BEST.id, source: 'all' };
  const visible = () => LEADS.filter(l => st.source === 'all' || l.source === st.source);
  const stt = () => stats(visible());
  const globe = createGlobe($('hero-map'), { assets: LEADS, icons: ICON, selectedId: st.sel, startLon: -30, tilt: 22, countryPadV: 70, label: 'Rotating 3D globe of sample leads', onSelect: id => select(id, true) });
  const geo = attachGeo($('hero-map'), globe, { visible, all: () => LEADS, lookup: byId, selected: () => st.sel, onPick: (id, f) => select(id, f), onChange: () => render(), toggleAfter: $('view-title'), fmt: v => `${Math.round(v)}`, fmtGroup: () => '' });
  const render = () => {
    const v = byId(st.sel), k = stt();
    clear($('hero-sel')).append(v ? leadCard(v) : h('div', {}));
    clear($('hero-value')).append(h('span', {}, 'Leads found'), h('b', {}, String(k.total)), h('em', { class: 'muted' }, `${k.high} with a score of ${HIGH_SCORE} or more · ${k.located} on the map`));
    clear($('hero-pair')).append(h('div', { class: 'kpi' }, h('span', {}, 'Average score'), h('b', {}, String(k.avgScore)), h('em', {}, 'Out of 100')), h('div', { class: 'kpi' }, h('span', {}, 'Sources'), h('b', {}, String(Object.keys(k.bySource).length)), h('em', {}, Object.keys(k.bySource).map(x => SOURCES[x].label).join(' · '))));
    clear($('hero-chart')).append(h('div', { class: 'mc-h' }, h('span', {}, 'From signal to customer')), funnelBars(visible()));
    clear($('app-filter')).append(...[['all', 'All'], ...Object.keys(SOURCES).map(k2 => [k2, SOURCES[k2].label])].map(([k2, label]) => h('button', { type: 'button', class: st.source === k2 ? 'on' : '', 'aria-pressed': String(st.source === k2), onclick: () => { st.source = k2; globe.setFilter(k2 === 'all' ? null : [k2]); if (!visible().some(l => l.id === st.sel)) select(visible()[0].id, true); else render(); } }, label)));
  };
  function select(id, focus) { st.sel = id; globe.setSelected(id); if (focus) globe.focus(id); render(); geo.sync(); }
  render();
}

/* ------------------------------------------------------------------ the globe section: the same leads, with a list beside it */
{
  const state = { sel: BEST.id, filter: null };
  const card = document.getElementById('globe-card'), list = document.getElementById('globe-list'), filterHost = document.getElementById('map-filter');
  const visible = () => LEADS.filter(l => !state.filter || l.source === state.filter);
  const globe = createGlobe(document.getElementById('globe-main'), { assets: LEADS, icons: ICON, selectedId: state.sel, startLon: 10, tilt: 22, countryPadV: 70, label: 'Rotating 3D globe of sample leads', onSelect: id => select(id, true) });
  const geo = attachGeo(document.getElementById('globe-main'), globe, { visible, all: () => LEADS, lookup: byId, selected: () => state.sel, onPick: (id, f) => select(id, f), onChange: () => render(), fmt: v => `${Math.round(v)}`, fmtGroup: () => '' });
  const shown = () => visible().filter(l => !geo.country() || l.country === geo.country());
  const render = () => {
    clear(card).append(leadCard(byId(state.sel)));
    clear(list).append(...shown().sort((a, b) => b.score - a.score).map(l => h('li', {}, h('button', { type: 'button', class: l.id === state.sel ? 'on' : '', 'aria-pressed': String(l.id === state.sel), onclick: () => select(l.id, true) },
      h('span', { class: 'ac-ico src' }, sourceIcon(l.source, 18)), h('span', {}, h('b', {}, l.name), h('em', {}, snippet(l.text, 52))), h('strong', {}, String(l.score))))));
    filterHost.querySelectorAll('button').forEach(b => { const on = (b.dataset.k || null) === state.filter; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  };
  function select(id, focus) { state.sel = id; globe.setSelected(id); if (focus) globe.focus(id); render(); geo.sync(); }
  const setFilter = k => { state.filter = k; globe.setFilter(k ? [k] : null); if (!visible().some(l => l.id === state.sel)) select(visible()[0].id, true); else { render(); geo.sync(); } };
  filterHost.append(h('button', { type: 'button', class: 'on', 'aria-pressed': 'true', onclick: () => setFilter(null) }, 'All'),
    ...Object.entries(SOURCES).map(([k, v]) => h('button', { type: 'button', 'data-k': k, 'aria-pressed': 'false', onclick: () => setFilter(k) }, v.label)));
  render();
}

/* ------------------------------------------------------------------ signals: one lead in full, and the five kinds of intent */
{
  const v = BEST, host = document.getElementById('lead-feature');
  clear(host).append(
    h('div', { class: 'lf-col' }, h('p', { class: 'lf-h' }, 'What they wrote'),
      h('blockquote', { class: 'ld-quote' }, v.text),
      h('div', { class: 'ld-meta' }, scorePill(v), h('span', {}, v.intentLabel), h('span', { class: 'ld-src' }, sourceIcon(v.source), v.kind), h('span', {}, v.place)),
      h('p', { class: 'ld-who' }, [v.authorRole, v.authorCompany].filter(Boolean).join(' · '))),
    h('div', { class: 'lf-col' }, h('p', { class: 'lf-h' }, 'A reply in your voice'),
      h('div', { class: 'lf-draft' }, v.draft),
      h('div', { class: 'ld-steps', 'aria-hidden': 'true' }, ...Object.values(STATUSES).map((t, i) => h('span', { class: `step${i === 0 ? ' on' : ''}` }, t))),
      h('p', { class: 'hint' }, 'You edit it, you copy it, you send it. Nothing is posted for you.')));
  const items = Object.entries(INTENTS).map(([k, label]) => { const l = LEADS.find(x => x.intent === k); return h('li', { class: 'intent-card' }, h('b', {}, label), l ? h('p', {}, `“${snippet(l.text, 120)}”`) : null); });
  clear(document.getElementById('intents')).append(...items);
  const trust = [['Public posts only', 'We read what people chose to post in public. We do not log in to anything for you, and we do not buy contact lists.'], ['You send every reply', 'Each lead comes with a draft. You edit it and send it yourself, where the conversation is. Nothing is ever posted, sent or clicked for you.'], ['Your leads are yours', 'Export them as a CSV whenever you like, remove any of them in one click, and keep what you learn about your own buyers.']];
  clear(document.getElementById('trust-grid')).append(...trust.map(([t, p]) => h('li', { class: 'intent-card' }, h('b', {}, t), h('p', {}, p))));
}

/* ------------------------------------------------- how to start: the same globe, spinning */
{
  const host = document.getElementById('how-globe');
  if (host) createGlobe(host, { assets: LEADS, icons: ICON, startLon: -30, tilt: 18, label: 'Rotating 3D globe of sample leads around the world' });
}

/* ------------------------------------------------- header, CTA tracking, motion */
{
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-cta]');
    if (c) analytics.track(c.dataset.cta === 'primary' ? 'primary_cta_click' : 'secondary_cta_click', { where: c.dataset.where || '' });
  });
  const targets = document.querySelectorAll('.sec-head, .globe-stage, .lead-feature, .intent-grid, .how-steps, .how-cta');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(t => { t.setAttribute('data-reveal', ''); io.observe(t); });
  }
}

/* ------------------------------------------------------------- FAQ accordion + final CTA */
{
  const items = [...document.querySelectorAll('[data-faq]')];
  items.forEach(item => {
    const btn = item.querySelector('.faq-q');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      items.forEach(o => { const b = o.querySelector('.faq-q'), on = o === item && open; b.setAttribute('aria-expanded', String(on)); o.classList.toggle('open', on); });
      if (open) analytics.track('faq_open', { q: btn.textContent.trim() });
    });
  });
}

/* ------------------------------------------------------------- pricing */
// The charge is the same plan as before, counted in packs of 25 leads: the slider moves in packs (3 to 100) and shows leads. Keep in step with PLAN in src/billing-core.js.
{
  const BASE = 47, INCLUDED = 3, OFF = 0.30, TIERS = [[10, 15], [25, 10], [100, 5]]; // [up to this pack, dollars each]
  const PACK = 25; // leads in a pack
  const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const range = document.getElementById('px-range');
  if (range) {
    const total = document.getElementById('px-total'), count = document.getElementById('px-count'), per = document.getElementById('px-per'), save = document.getElementById('px-save'), freeEl = document.getElementById('px-free');
    const mqr = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const USD2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmt = v => (Number.isInteger(Math.round(v * 100) / 100) ? USD0 : USD2).format(v);
    const leads = n => (n * PACK).toLocaleString('en-US');
    let interval = 'month', shown = BASE, raf = 0;
    const yr = c => Math.round(c * 12 * (1 - OFF) * 100) / 100;
    const extras = n => { let from = INCLUDED; return TIERS.map(([upTo, d]) => { const q = Math.max(0, Math.min(n, upTo) - from); from = Math.max(from, upTo); return [q, d]; }); };
    const price = (n, iv = interval) => { const unit = d => (iv === 'year' ? yr(d) : d); return unit(BASE) + extras(n).reduce((sum, [q, d]) => sum + q * unit(d), 0); };
    const freeCount = n => Math.floor(extras(n).reduce((sum, [q, d]) => sum + q * (TIERS[0][1] - d), 0) / TIERS[0][1]);
    const paint = (v, exact) => { total.textContent = exact ? fmt(v) : USD0.format(Math.round(v)); };
    const update = () => {
      const n = +range.value, p = price(n);
      const go = document.querySelector('.px-btn'); if (go) { const q = []; if (n !== INCLUDED) q.push(`assets=${n}`); if (interval === 'year') q.push('billing=year'); go.setAttribute('href', q.length ? `/api/start?${q.join('&')}` : '/api/start'); } // the checkout still counts packs in its `assets` field
      const pct = ((n - range.min) / (range.max - range.min)) * 100; range.style.setProperty('--p', `${pct}%`);
      const bub = document.getElementById('px-bubble'); bub.style.setProperty('--q', pct.toFixed(2)); bub.textContent = leads(n);
      range.setAttribute('aria-valuetext', `${leads(n)} leads a month, ${fmt(p)} per ${interval}`);
      count.textContent = leads(n); document.getElementById('px-feat-n').textContent = leads(n); document.getElementById('px-unit').textContent = 'leads';
      per.textContent = interval;
      const f = freeCount(n); freeEl.hidden = f === 0; freeEl.textContent = `of which ${(f * PACK).toLocaleString('en-US')} leads are free`; save.classList.toggle('plus', f > 0); freeEl.title = `Past ${TIERS[0][0] * PACK} leads each pack costs less. What that saves you is worth ${(f * PACK).toLocaleString('en-US')} of your ${leads(n)} leads.`;
      if (interval === 'year') { save.hidden = false; save.textContent = `You save ${fmt(price(n, 'month') * 12 - p)}`; } else save.hidden = true;
      cancelAnimationFrame(raf);
      if (mqr) { shown = p; paint(p, true); return; }
      const from = shown, t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / 380), e = 1 - Math.pow(1 - k, 3); shown = from + (p - from) * e; paint(shown, k === 1); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    };
    range.addEventListener('input', update); update();
    document.querySelectorAll('[data-per]').forEach(b => b.addEventListener('click', () => {
      interval = b.dataset.per === 'year' ? 'year' : 'month';
      document.querySelectorAll('[data-per]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      update(); analytics.track('pricing_period', { period: interval });
    }));
    range.addEventListener('change', () => analytics.track('pricing_slider', { packs: +range.value, price: price(+range.value), period: interval }));
  }
}
