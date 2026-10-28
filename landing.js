import { h, s, clear } from './src/dom.js';
import { fmtPct, fmtSigned, tone, toCsv } from './src/calc.js';
import {
  ASSETS, CATEGORIES, VALUATION_DATE, WESTLAKE_MONTHS, WESTLAKE_INCOME, WESTLAKE_EXPENSES,
  WESTLAKE_VALUATIONS, COUNTRIES, portfolio, byId,
} from './src/demo-data.js';
import { validateLead } from './src/lead.js';
import { createGlobe } from './src/globe.js';

document.documentElement.classList.add('js');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const P = portfolio();
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const USDc = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const money = n => USD0.format(n);
const compact = n => USDc.format(n);
function pct1(n) { return n == null ? '—' : (n * 100).toFixed(1) + '%'; }
const FEATURED = byId('austin');
// Sample data is stamped with the visitor's current date, so the "as of" labels are never stale.
const TODAY = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/* ------------------------------------------------------------------ analytics */
// Provider-agnostic. Nothing is sent unless (a) a consent banner has set window.atlasConsent = true
// and (b) a provider (Plausible or gtag) is present on the page. Never pass financial data as props.
const analytics = {
  track(name, props = {}) {
    if (window.atlasConsent !== true) return;
    try {
      if (typeof window.plausible === 'function') window.plausible(name, { props });
      else if (typeof window.gtag === 'function') window.gtag('event', name, props);
    } catch { /* analytics must never break the page */ }
  },
};
analytics.track('landing_page_view');

/* ------------------------------------------------------------ headline variants */
// Default stays Variant A. `?hv=B` or `?hv=C` previews a variant for QA / future testing.
const HEADLINES = {
  A: ['Every asset.', 'One intelligent view.'],
  B: ['Your entire asset portfolio.', 'One clear view.'],
  C: ['See the full picture of', 'everything you own.'],
};
{
  const v = new URLSearchParams(location.search).get('hv');
  if (v && v !== 'A' && HEADLINES[v]) {
    document.querySelector('[data-variant-slot="hero-headline"]').replaceChildren(HEADLINES[v][0] + ' ', h('span', {}, HEADLINES[v][1]));
  }
}

/* --------------------------------------------------------------------- icons */
const ICON = {
  residential: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-6h6v6',
  commercial: 'M4 21V5l8-2v18M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2',
  land: 'M3 18l5-8 4 5 3-4 6 7z',
  vehicle: 'M3 16V9h11v7M14 11h4l3 3v2h-3M5 18.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M16 18.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0',
  vessel: 'M3 15h18l-3 5H6zM12 3v12M12 4l6 9h-6',
  aircraft: 'M12 2l2 7 8 4v2l-8-2v5l3 2v1l-5-1-5 1v-1l3-2v-5l-8 2v-2l8-4z',
  equipment: 'M4 19h12M6 19v-4h8v4M10 15V9l6-5M16 4l3 6',
};
const icon = (key, size = 22) => s('svg', { viewBox: '0 0 24 24', width: size, height: size, class: 'ico', 'aria-hidden': 'true' }, s('path', { d: ICON[key] }));

/* ---------------------------------------------------------- shared UI pieces */
const Delta = (n, text) => {
  const t = tone(n, 0.5);
  return h('span', { class: `delta ${t}` }, h('span', { 'aria-hidden': 'true' }, t === 'pos' ? '▲' : t === 'neg' ? '▼' : '■'), text ?? fmtSigned(n),
    h('span', { class: 'sr' }, t === 'pos' ? ' (gain)' : t === 'neg' ? ' (loss)' : ''));
};
const statusDot = st => h('span', { class: 'st st-' + ({ Occupied: 'ok', Leased: 'ok', 'In service': 'ok', Vacant: 'warn' }[st] || 'idle') }, st);

function assetCard(a) {
  return h('div', { class: 'asset-card' },
    h('div', { class: 'ac-top' }, h('span', { class: 'ac-ico' }, icon(a.category, 18)), h('div', {}, h('b', {}, a.name), h('span', {}, `${a.place} · ${a.kind}`)), statusDot(a.status)),
    h('dl', { class: 'ac-grid' },
      h('div', {}, h('dt', {}, 'Estimated value'), h('dd', {}, money(a.value))),
      h('div', {}, h('dt', {}, 'Acquisition cost'), h('dd', {}, money(a.cost))),
      a.earning
        ? h('div', {}, h('dt', {}, 'NOI yield'), h('dd', {}, pct1(a.noiYield)))
        : h('div', {}, h('dt', {}, 'Annual expenses'), h('dd', {}, money(a.expenses))),
      h('div', {}, h('dt', {}, 'Vs. cost'), h('dd', {}, Delta(a.appreciation, fmtPct(a.appreciationPct, { sign: true }))))));
}

function sparkline(host, series) {
  clear(host);
  const W = 260, H = 64, m = 4;
  const ys = series.map(p => p.v), lo = Math.min(...ys), hi = Math.max(...ys);
  const X = i => m + (i / (series.length - 1)) * (W - 2 * m), Y = v => H - m - ((v - lo) / (hi - lo || 1)) * (H - 2 * m);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  host.append(s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'spark', role: 'img', 'aria-label': `Westlake Residence estimated value, ${series[0].label} ${money(series[0].v)} to ${series.at(-1).label} ${money(series.at(-1).v)}` },
    s('path', { d: `${line}L${X(series.length - 1)} ${H}L${X(0)} ${H}Z`, class: 'ar' }), s('path', { d: line, class: 'ln' }),
    s('circle', { cx: X(series.length - 1), cy: Y(ys.at(-1)), r: 4, class: 'pt' })));
}

/* ------------------------------------------------------------------ globe / country mode (shared) */
const FLAG_GEO = {
  US: () => [
    s('rect', { width: 22, height: 15, fill: '#fff' }),
    ...[0, 1, 2, 3, 4, 5, 6].map(i => s('rect', { y: +(i * 2.3077).toFixed(2), width: 22, height: 1.1538, fill: '#B22234' })),
    s('rect', { width: 9.2, height: 8.1, fill: '#3C3B6E' }),
    ...[0, 1, 2].flatMap(i => [0, 1, 2].map(j => s('circle', { cx: 1.9 + i * 2.7, cy: 1.7 + j * 2.4, r: 0.5, fill: '#fff' })))],
  GB: () => [
    s('rect', { width: 22, height: 15, fill: '#012169' }),
    s('path', { d: 'M0 0L22 15M22 0L0 15', stroke: '#fff', 'stroke-width': 3 }), s('path', { d: 'M0 0L22 15M22 0L0 15', stroke: '#C8102E', 'stroke-width': 1.1 }),
    s('path', { d: 'M11 0v15M0 7.5h22', stroke: '#fff', 'stroke-width': 5 }), s('path', { d: 'M11 0v15M0 7.5h22', stroke: '#C8102E', 'stroke-width': 3 })],
  PT: () => [
    s('rect', { width: 22, height: 15, fill: '#DA291C' }), s('rect', { width: 8.6, height: 15, fill: '#046A38' }),
    s('circle', { cx: 8.6, cy: 7.5, r: 3.1, fill: '#FFE000' }), s('circle', { cx: 8.6, cy: 7.5, r: 1.9, fill: '#fff', stroke: '#DA291C', 'stroke-width': 0.9 })],
};
const flag = code => s('svg', { viewBox: '0 0 22 15', width: 22, height: 15, class: 'flag', 'aria-hidden': 'true' },
  s('defs', {}, s('clipPath', { id: 'fl-' + code }, s('rect', { width: 22, height: 15, rx: 2.5 }))), s('g', { 'clip-path': `url(#fl-${code})` }, ...(FLAG_GEO[code] || FLAG_GEO.US)()));
const GLOBE_ICO = 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2.5 2 2.5 10 0 12M8 2c-2.5 2-2.5 10 0 12';
const PIN_ICO = 'M8 14.2s4.8-4 4.8-7.6a4.8 4.8 0 1 0-9.6 0C3.2 10.200 8 14.200 8 14.200zM8 7.600m-1.500 0a1.500 1.500 0 1 0 3 0 1.500 1.500 0 1 0-3 0';

/** Globe ⇄ Country switcher: pill toggle, country chips with flags, and the selected country's assets. */
function attachGeo(host, globe, { visible, selected, onPick, onChange = () => {} }) {
  const st = { mode: 'globe', cc: null, key: '' };
  const ico = d => s('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': 'true', class: 'gi' }, s('path', { d }));
  const toggle = h('div', { class: 'geo-toggle', role: 'group', 'aria-label': 'Map view', 'data-mode': 'globe' }, h('i', { class: 'geo-thumb', 'aria-hidden': 'true' }),
    h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => setMode('globe') }, ico(GLOBE_ICO), 'Globe'),
    h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setMode('country') }, ico(PIN_ICO), 'Country'));
  const chips = h('ul', { class: 'geo-chips', 'aria-label': 'Countries' }), row = h('div', { class: 'geo-assets', role: 'group', 'aria-label': 'Assets in this country' });
  host.append(h('div', { class: 'geo-ui' }, toggle, chips), row);

  const countryOf = id => byId(id)?.country;
  function build() {
    const vis = visible(), key = [st.mode, st.cc, vis.map(a => a.id).join()].join('|');
    if (key !== st.key) {
      st.key = key;
      chips.replaceChildren(...Object.entries(COUNTRIES).map(([c, info], i) => {
        const n = vis.filter(a => a.country === c).length;
        return h('li', { style: `--i:${i}` }, h('button', { type: 'button', disabled: n === 0, 'data-c': c, onclick: () => setCountry(c) }, flag(c), h('span', {}, info.name), h('em', {}, String(n))));
      }));
      const keep = row.scrollLeft;
      row.replaceChildren(...vis.filter(a => a.country === st.cc).map((a, i) => h('button', { type: 'button', 'data-id': a.id, style: `--i:${i}`, onclick: () => onPick(a.id, false) },
        icon(a.category, 16), h('span', {}, a.name), h('b', {}, compact(a.value)))));
      row.scrollLeft = keep;
    }
    chips.querySelectorAll('button').forEach(b => { const on = b.dataset.c === st.cc; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const sel = selected();
    row.querySelectorAll('button').forEach(b => { const on = b.dataset.id === sel; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    row.querySelector('button.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function setMode(m) {
    if (m === st.mode) return;
    st.mode = m; toggle.dataset.mode = m; host.classList.toggle('geo-country', m === 'country');
    toggle.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String((i === 1) === (m === 'country'))));
    if (m === 'country') {
      const vis = visible(), a = byId(selected());
      st.cc = (a && vis.includes(a) ? a.country : vis[0]?.country) || 'US';
      globe.flyTo(st.cc);
    } else { st.cc = null; globe.flyTo(null); }
    build(); onChange(st.mode, st.cc);
  }
  function setCountry(c) {
    if (c === st.cc) return;
    st.cc = c; globe.flyTo(c);
    const first = visible().find(a => a.country === c);
    if (first) onPick(first.id, false);
    build(); onChange(st.mode, st.cc);
  }
  return {
    mode: () => st.mode, country: () => st.cc,
    /** Call after the selection or the filter changed from outside. */
    sync() {
      if (st.mode === 'country') {
        const vis = visible(), id = selected(), c = countryOf(id);
        if (!vis.some(a => a.country === st.cc)) { const alt = vis[0]?.country; if (alt) { st.cc = alt; globe.flyTo(alt); onChange(st.mode, st.cc); } }
        else if (c && c !== st.cc && vis.some(a => a.id === id)) { st.cc = c; globe.flyTo(c); onChange(st.mode, st.cc); }
      }
      build();
    },
  };
}

/* ------------------------------------------------------------------ hero dashboard (fully interactive) */
{
  const GROUPS = {
    all: { label: 'All', cats: null },
    re: { label: 'Real estate', cats: ['residential', 'commercial', 'land'] },
    veh: { label: 'Vehicles', cats: ['vehicle', 'equipment'] },
    ves: { label: 'Vessels', cats: ['vessel'] },
    air: { label: 'Aircraft', cats: ['aircraft'] },
  };
  const NAV = [
    ['map', 'Map', 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2.5 2 2.5 10 0 12M8 2c-2.5 2-2.5 10 0 12'],
    ['assets', 'Assets', 'M2 13V6l6-4 6 4v7zM6 13V9h4v4'],
    ['perf', 'Performance', 'M2 13l4-5 3 3 5-7'],
    ['reports', 'Reports', 'M4 2h6l3 3v9H4zM10 2v3h3'],
  ];
  const state = { view: 'map', group: 'all', sel: 'austin', sort: { key: 'value', dir: -1 } };
  const $ = id => document.getElementById(id);
  const scope = () => ASSETS.filter(a => !GROUPS[state.group].cats || GROUPS[state.group].cats.includes(a.category));
  const historyFor = a => (a.id === 'austin' ? WESTLAKE_VALUATIONS : null);
  const views = { map: $('view-map'), assets: $('view-assets'), perf: $('view-perf'), reports: $('view-reports') };

  const globe = createGlobe($('hero-map'), { assets: ASSETS, icons: ICON, selectedId: state.sel, startLon: -88, tilt: 24, countryPadV: 70,
    label: 'Rotating 3D globe of sample assets', onSelect: id => select(id, true) });
  const geo = attachGeo($('hero-map'), globe, { visible: scope, selected: () => state.sel, onPick: (id, f) => select(id, f), onChange: () => { renderMap(); } });
  const mapScope = () => scope().filter(a => !geo.country() || a.country === geo.country());

  function select(id, focus) {
    state.sel = id; globe.setSelected(id); if (focus) globe.focus(id);
    renderMap(); if (state.view === 'assets') renderAssets(); if (state.view === 'perf') renderPerf();
    geo.sync();
  }

  /* navigation + filters */
  function renderNav() {
    const mk = (cls) => NAV.map(([k, label, d]) => h('button', { type: 'button', class: cls + (state.view === k ? ' on' : ''), 'aria-current': state.view === k ? 'page' : null, onclick: () => setView(k) },
      s('svg', { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': 'true', class: 'ni' }, s('path', { d })), label));
    clear($('app-nav')).append(...mk('nav-btn').map(b => h('li', {}, b)));
    clear($('view-tabs')).append(...mk('tab-btn'));
  }
  function renderFilter() {
    clear($('app-filter')).append(...Object.entries(GROUPS).map(([k, g]) => h('button', { type: 'button', class: state.group === k ? 'on' : '', 'aria-pressed': String(state.group === k), onclick: () => setGroup(k) }, g.label)));
  }
  function setView(v) {
    state.view = v;
    for (const [k, el] of Object.entries(views)) el.hidden = k !== v;
    $('app-url').textContent = `atlas.app / portfolio / ${v}`;
    $('view-title').textContent = NAV.find(n => n[0] === v)[1];
    renderNav();
    ({ map: renderMap, assets: renderAssets, perf: renderPerf, reports: renderReports })[v]();
    analytics.track('dashboard_view', { view: v });
  }
  function setGroup(g) {
    state.group = g; globe.setFilter(GROUPS[g].cats);
    if (!scope().some(a => a.id === state.sel)) { state.sel = scope()[0].id; globe.setSelected(state.sel); }
    if (GROUPS[g].cats) globe.focus(state.sel);
    renderFilter(); geo.sync(); setView(state.view);
  }

  /* shared bits */
  const costVsValue = a => {
    const mx = Math.max(a.cost, a.value);
    const bar = (label, v, cls) => h('div', { class: 'cv-row' }, h('span', {}, label), h('i', { class: cls, style: `width:${(v / mx) * 100}%` }), h('b', {}, compact(v)));
    return h('div', { class: 'cv' }, bar('Acquisition cost', a.cost, 'c'), bar('Estimated value', a.value, 'v'));
  };
  const empty = (t, d) => h('div', { class: 'app-empty' }, h('b', {}, t), h('span', {}, d));

  /* MAP view */
  function renderMap() {
    const a = byId(state.sel), sc = mapScope(), p = portfolio(sc), where = geo.country() ? COUNTRIES[geo.country()].name : (state.group === 'all' ? '' : GROUPS[state.group].label);
    clear($('hero-sel')).append(assetCard(a));
    clear($('hero-value')).append(h('span', {}, `Portfolio value${where ? ' · ' + where : ''}`), h('b', {}, money(p.value)),
      Delta(p.appreciation, `${fmtSigned(p.appreciation, { compact: true })} · ${fmtPct(p.appreciationPct, { sign: true })} vs. cost`));
    const k = (l, v, sub) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, v), h('em', {}, sub));
    clear($('hero-pair')).append(k('Net operating income', p.earningCount ? compact(p.noi) : '—', p.earningCount ? 'Annual' : 'No income assets'),
      k('NOI yield', pct1(p.noiYield), p.earningCount ? `${p.earningCount} income asset${p.earningCount > 1 ? 's' : ''}` : 'Income assets only'));
    const mc = clear($('hero-chart')), hist = historyFor(a);
    if (hist) {
      const ch = a.value - hist[0].v;
      mc.append(h('div', { class: 'mc-h' }, h('span', {}, a.name), Delta(ch, `${fmtPct(ch / hist[0].v, { sign: true })} since ${hist[0].label}`)), h('div', {}));
      sparkline(mc.lastChild, hist);
    } else {
      mc.append(h('div', { class: 'mc-h' }, h('span', {}, a.name), Delta(a.appreciation, `${fmtPct(a.appreciationPct, { sign: true })} vs. cost`)), costVsValue(a));
    }
  }

  /* ASSETS view */
  function renderAssets() {
    const host = clear(views.assets), sc = scope(), k = state.sort.key, d = state.sort.dir;
    const val = { name: a => a.name, place: a => a.place, value: a => a.value, chg: a => a.appreciationPct, status: a => a.status };
    const rows = [...sc].sort((x, y) => (val[k](x) > val[k](y) ? 1 : val[k](x) < val[k](y) ? -1 : 0) * d);
    const th = (key, label, cls = '') => h('th', { class: cls, 'aria-sort': k === key ? (d > 0 ? 'ascending' : 'descending') : 'none' },
      h('button', { type: 'button', onclick: () => { state.sort = { key, dir: k === key ? -d : (key === 'name' || key === 'place' ? 1 : -1) }; renderAssets(); } }, label, k === key ? (d > 0 ? ' ↑' : ' ↓') : ''));
    const a = byId(state.sel);
    host.append(h('div', { class: 'assets-grid' },
      h('div', { class: 'tbl-card' }, h('table', { class: 'app-tbl' },
        h('thead', {}, h('tr', {}, th('name', 'Asset'), th('place', 'Location'), th('value', 'Value', 'r'), th('chg', 'vs. cost', 'r'), th('status', 'Status'))),
        h('tbody', {}, rows.map(r => h('tr', { class: r.id === state.sel ? 'on' : '' },
          h('td', {}, h('button', { type: 'button', class: 'rowbtn', 'aria-pressed': String(r.id === state.sel), onclick: () => select(r.id, true) }, icon(r.category, 16), r.name)),
          h('td', {}, r.place), h('td', { class: 'r' }, compact(r.value)), h('td', { class: 'r' }, Delta(r.appreciation, fmtPct(r.appreciationPct, { sign: true }))), h('td', {}, statusDot(r.status))))))),
      h('div', { class: 'detail' }, assetCard(a), costVsValue(a),
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => { setView('map'); globe.focus(state.sel); } }, 'Show on map'))));
  }

  /* PERFORMANCE view */
  function renderPerf() {
    const host = clear(views.perf), a = byId(state.sel), sc = scope(), hist = historyFor(a);
    const chart = h('div', { class: 'chart-host' });
    const rank = [...sc].sort((x, y) => y.appreciationPct - x.appreciationPct), mx = Math.max(...rank.map(r => Math.abs(r.appreciationPct)), 0.0001);
    host.append(h('div', { class: 'perf-grid' },
      h('div', { class: 'tbl-card pad' }, h('div', { class: 'chart-t' }, h('b', {}, `${a.name} · estimated value`), hist ? h('span', {}, `${hist[0].label} – ${hist.at(-1).label}`) : h('span', {}, 'Sample data')),
        hist ? chart : h('div', {}, empty('Valuation history not recorded', 'Only one valuation exists for this asset in the sample, so ATLAS shows cost vs. estimated value instead.'), costVsValue(a))),
      h('div', { class: 'tbl-card pad' }, h('div', { class: 'chart-t' }, h('b', {}, 'Value vs. acquisition cost'), h('span', {}, `${sc.length} asset${sc.length > 1 ? 's' : ''}`)),
        h('ul', { class: 'rank' }, rank.map(r => { const t = tone(r.appreciationPct, 1e-6);
          return h('li', { class: r.id === state.sel ? 'on' : '' }, h('button', { type: 'button', onclick: () => select(r.id, true) },
            h('span', { class: 'rn' }, r.name), h('span', { class: 'rb', 'aria-hidden': 'true' }, h('i', { class: t, style: `width:${(Math.abs(r.appreciationPct) / mx) * 50}%;${r.appreciationPct < 0 ? 'right' : 'left'}:50%` })),
            h('b', { class: t }, fmtPct(r.appreciationPct, { sign: true })))); })))));
    if (hist) valuationChart(chart, hist, { label: `Estimated value of ${a.name}` });
  }

  /* REPORTS view */
  function renderReports() {
    const host = clear(views.reports), sc = scope(), p = portfolio(sc);
    const alloc = Object.entries(sc.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + x.value), m), {})).sort((x, y) => y[1] - x[1]);
    const csv = () => {
      const text = toCsv(sc, [
        { label: 'Asset', get: x => x.name }, { label: 'Category', get: x => CATEGORIES[x.category] }, { label: 'Location', get: x => x.place }, { label: 'Status', get: x => x.status },
        { label: 'Acquisition cost (USD)', get: x => x.cost }, { label: 'Estimated value (USD)', get: x => x.value }, { label: 'Change vs. cost', get: x => x.appreciationPct.toFixed(4) }, { label: 'NOI (USD)', get: x => (x.earning ? x.noi : '') },
      ]);
      const a = h('a', { href: URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' })), download: 'atlas-sample-assets.csv' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      analytics.track('dashboard_csv_download');
    };
    host.append(h('div', { class: 'rep-grid' },
      h('div', { class: 'tbl-card pad' }, h('div', { class: 'chart-t' }, h('b', {}, `Portfolio summary${state.group === 'all' ? '' : ' · ' + GROUPS[state.group].label}`), h('span', {}, `As of ${TODAY}`)),
        h('div', { class: 'rep-kpis' },
          h('div', {}, h('em', {}, 'Value'), h('b', {}, compact(p.value))), h('div', {}, h('em', {}, 'Cost'), h('b', {}, compact(p.cost))),
          h('div', {}, h('em', {}, 'NOI'), h('b', {}, p.earningCount ? compact(p.noi) : '—')), h('div', {}, h('em', {}, 'NOI yield'), h('b', {}, pct1(p.noiYield)))),
        h('ul', { class: 'rep-alloc' }, alloc.map(([c, v]) => h('li', {}, h('span', {}, CATEGORIES[c]), h('i', { style: `width:${(v / alloc[0][1]) * 100}%` }), h('b', {}, pct1(v / p.value)))))),
      h('div', { class: 'tbl-card pad dl' }, h('b', {}, 'Export'), h('p', {}, `${sc.length} asset${sc.length > 1 ? 's' : ''} in the current view, with cost, value, change and NOI.`),
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: csv }, 'Download CSV'),
        h('small', {}, 'PDF and Excel exports are in development.'))));
  }

  renderFilter(); setView('map');
}

/* ---------------------------------------------------------- globe section */
{
  const state = { sel: 'austin', filter: null };
  const card = document.getElementById('globe-card'), list = document.getElementById('globe-list'), filterHost = document.getElementById('map-filter');
  const visible = () => ASSETS.filter(a => !state.filter || a.category === state.filter);
  const globe = createGlobe(document.getElementById('globe-main'), { assets: ASSETS, icons: ICON, selectedId: state.sel, startLon: -96, tilt: 22, countryPadV: 70,
    label: 'Rotating 3D globe of sample asset locations', onSelect: id => select(id, true) });
  const geo = attachGeo(document.getElementById('globe-main'), globe, { visible, selected: () => state.sel, onPick: (id, f) => select(id, f), onChange: () => render() });
  const shown = () => visible().filter(a => !geo.country() || a.country === geo.country());
  const render = () => {
    clear(card).append(assetCard(byId(state.sel)));
    clear(list).append(...shown().map(a => h('li', {}, h('button', {
      type: 'button', class: a.id === state.sel ? 'on' : '', 'aria-pressed': String(a.id === state.sel), onclick: () => select(a.id, true),
    }, icon(a.category, 18), h('span', {}, h('b', {}, a.name), h('em', {}, a.place)), h('strong', {}, compact(a.value))))));
    filterHost.querySelectorAll('button').forEach(b => { const on = (b.dataset.k || null) === state.filter; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  };
  function select(id, focus) { state.sel = id; globe.setSelected(id); if (focus) globe.focus(id); render(); geo.sync(); }
  const setFilter = c => {
    state.filter = c; globe.setFilter(c);
    if (!visible().some(a => a.id === state.sel)) select(visible()[0].id, true); else { render(); geo.sync(); }
  };
  const cats = [...new Set(ASSETS.map(a => a.category))];
  filterHost.append(h('button', { type: 'button', class: 'on', 'aria-pressed': 'true', onclick: () => setFilter(null) }, 'All'),
    ...cats.map(c => h('button', { type: 'button', 'data-k': c, 'aria-pressed': 'false', onclick: () => setFilter(c) }, CATEGORIES[c])));
  render();
}

/* ------------------------------------------------------------- charts */
function valuationChart(host, series, { label }) {
  clear(host);
  const W = 640, H = 240, m = { t: 14, r: 16, b: 28, l: 58 };
  const ys = series.map(p => p.v);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = (hi - lo) * 0.15 || hi * 0.05; lo -= pad; hi += pad;
  const X = i => m.l + (series.length === 1 ? 0 : (i / (series.length - 1)) * (W - m.l - m.r));
  const Y = v => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lc', role: 'img', tabindex: 0,
    'aria-label': `${label}: ${series[0].label} ${money(series[0].v)} to ${series.at(-1).label} ${money(series.at(-1).v)}. Use arrow keys to inspect points.` });
  [0, 1, 2, 3].forEach(i => {
    const v = lo + ((hi - lo) * i) / 3;
    svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: m.l - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, compact(v)));
  });
  [0, Math.floor((series.length - 1) / 2), series.length - 1].forEach(i => svg.append(s('text', { x: X(i), y: H - 8, class: 'ax', 'text-anchor': i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle' }, series[i].label)));
  svg.append(s('path', { d: `${line}L${X(series.length - 1)} ${H - m.b}L${X(0)} ${H - m.b}Z`, class: 'ar' }), s('path', { d: line, class: 'ln' }));
  const dot = s('circle', { r: 5, class: 'pt', visibility: 'hidden' }), tip = h('div', { class: 'tip', hidden: true, role: 'status' });
  svg.append(dot);
  let idx = series.length - 1;
  const show = i => {
    idx = Math.max(0, Math.min(series.length - 1, i));
    dot.setAttribute('cx', X(idx)); dot.setAttribute('cy', Y(series[idx].v)); dot.removeAttribute('visibility');
    tip.hidden = false; tip.replaceChildren(h('b', {}, money(series[idx].v)), h('span', {}, series[idx].label));
    tip.style.left = `${Math.min(88, Math.max(12, (X(idx) / W) * 100))}%`;
  };
  const hide = () => { dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  svg.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; show(Math.round(((px - m.l) / (W - m.l - m.r)) * (series.length - 1))); });
  svg.addEventListener('pointerleave', hide); svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); } else if (e.key === 'Escape') hide(); });
  host.append(svg, tip);
}

function flowChart(host) {
  clear(host);
  const W = 640, H = 240, m = { t: 14, r: 12, b: 28, l: 50 };
  const max = Math.max(...WESTLAKE_INCOME, ...WESTLAKE_EXPENSES) * 1.1;
  const Y = v => H - m.b - (v / max) * (H - m.t - m.b);
  const slot = (W - m.l - m.r) / 12, bw = slot * 0.3;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lc', role: 'img',
    'aria-label': `Monthly rental income versus operating expenses. Income is ${money(WESTLAKE_INCOME[0])} each month; expenses range from ${money(Math.min(...WESTLAKE_EXPENSES))} to ${money(Math.max(...WESTLAKE_EXPENSES))}.` });
  [0, 1, 2, 3].forEach(i => { const v = (max * i) / 3; svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: m.l - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, compact(v))); });
  WESTLAKE_MONTHS.forEach((mo, i) => {
    const cx = m.l + slot * i + slot / 2;
    svg.append(
      s('rect', { x: cx - bw - 1, y: Y(WESTLAKE_INCOME[i]), width: bw, height: H - m.b - Y(WESTLAKE_INCOME[i]), rx: 2, class: 'b-inc' }, s('title', {}, `${mo}: income ${money(WESTLAKE_INCOME[i])}`)),
      s('rect', { x: cx + 1, y: Y(WESTLAKE_EXPENSES[i]), width: bw, height: H - m.b - Y(WESTLAKE_EXPENSES[i]), rx: 2, class: 'b-exp' }, s('title', {}, `${mo}: expenses ${money(WESTLAKE_EXPENSES[i])}`)),
      s('text', { x: cx, y: H - 8, class: 'ax', 'text-anchor': 'middle' }, mo));
  });
  host.append(svg);
}

/* ---------------------------------------------------------- financial */
{
  const a = FEATURED, mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const counters = [];
  const num = (to, fmt) => { const el = h('span', { class: 'num' }, fmt(to)); counters.push({ el, to, fmt }); return el; };
  const tile = (label, value, sub, cls = '', extra) => h('div', { class: 'tile ' + cls }, extra, h('span', {}, label), h('b', {}, value), sub && h('em', {}, sub));

  const spark = (() => {
    const W = 160, H = 54, ys = WESTLAKE_VALUATIONS.map(p => p.v), lo = Math.min(...ys), hi = Math.max(...ys);
    const pts = ys.map((v, i) => [(i / (ys.length - 1)) * W, H - 6 - ((v - lo) / (hi - lo)) * (H - 14)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    return h('div', { class: 'tile-spark', 'aria-hidden': 'true' },
      s('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' }, s('path', { d: `${d}L${W} ${H}L0 ${H}Z`, class: 'ts-ar' }), s('path', { d, class: 'ts-ln', pathLength: 1 })),
      h('i', { class: 'ts-end', style: `top:${((pts.at(-1)[1] / H) * 100).toFixed(1)}%` }));
  })();

  const tiles = h('div', { class: 'tiles' },
    tile('Estimated value', num(a.value, v => money(Math.round(v))), `Valued ${TODAY}`, 'dark', spark),
    tile('Appreciation', Delta(a.appreciation, num(a.appreciation, v => fmtSigned(v))), h('span', {}, num(a.appreciationPct, v => fmtPct(v, { sign: true })), ` vs. ${money(a.cost)} cost`)),
    tile('Rental income', num(a.gross, v => money(Math.round(v))), 'Last 12 months'),
    tile('Operating expenses', num(a.expenses, v => money(Math.round(v))), 'Last 12 months'),
    tile('Net yield (NOI)', num(a.noiYield, v => pct1(v)), `${money(a.noi)} NOI ÷ est. value`, 'blue'));
  [...tiles.children].forEach((t, i) => t.style.setProperty('--i', i));

  /* --- estimated value: ranges, crosshair, live readout */
  const vRead = h('div', { class: 'fc-read', 'aria-live': 'off' }), vHost = h('div', { class: 'chart-host' }), vSpan = h('span', {});
  const ALL = WESTLAKE_VALUATIONS, RANGES = [['1Y', 3], ['3Y', 7], ['All', ALL.length]];
  let rng = 2, vIdx = ALL.length - 1;
  const pills = h('div', { class: 'fc-pills', role: 'group', 'aria-label': 'Time range' },
    ...RANGES.map(([l], i) => h('button', { type: 'button', 'aria-pressed': String(i === rng), onclick: () => { rng = i; [...pills.children].forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); drawValue(); } }, l)));
  const setRead = p => {
    vRead.replaceChildren(h('b', {}, money(p.v)), Delta(p.v - a.cost, `${fmtPct((p.v - a.cost) / a.cost, { sign: true })} vs. cost`), h('span', { class: 'when' }, p.label));
  };
  function drawValue() {
    const series = ALL.slice(ALL.length - RANGES[rng][1]);
    clear(vHost);
    vSpan.textContent = `${series[0].label} – ${series.at(-1).label}`;
    const W = 640, H = 250, m = { t: 16, r: 18, b: 28, l: 58 };
    const ys = series.map(p => p.v).concat(a.cost);
    let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
    const X = i => m.l + (i / (series.length - 1)) * (W - m.l - m.r), Y = v => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
    const d = series.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fc', role: 'img', tabindex: 0,
      'aria-label': `Estimated value of ${a.name}: ${series[0].label} ${money(series[0].v)} to ${series.at(-1).label} ${money(series.at(-1).v)}. Use arrow keys to inspect points.` },
      s('defs', {}, s('linearGradient', { id: 'fcg', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0', 'stop-color': '#2563EB', 'stop-opacity': '.28' }), s('stop', { offset: '1', 'stop-color': '#2563EB', 'stop-opacity': '0' }))));
    [0, 1, 2, 3].forEach(i => { const v = lo + ((hi - lo) * i) / 3; svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: m.l - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, compact(v))); });
    const ticks = series.length <= 4 ? series.map((_, i) => i) : [0, Math.floor((series.length - 1) / 2), series.length - 1];
    ticks.forEach(i => svg.append(s('text', { x: X(i), y: H - 8, class: 'ax', 'text-anchor': i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle' }, series[i].label)));
    svg.append(
      s('line', { x1: m.l, x2: W - m.r, y1: Y(a.cost), y2: Y(a.cost), class: 'cost' }), s('text', { x: W - m.r, y: Y(a.cost) - 6, class: 'ax cost-t', 'text-anchor': 'end' }, `Purchase cost ${compact(a.cost)}`),
      s('path', { d: `${d}L${X(series.length - 1)} ${H - m.b}L${X(0)} ${H - m.b}Z`, class: 'ar' }), s('path', { d, class: 'ln', pathLength: 1 }));
    series.forEach((p, i) => svg.append(s('circle', { cx: X(i), cy: Y(p.v), r: 3.2, class: 'dt', style: `--d:${0.5 + i * 0.07}s` })));
    const ex = X(series.length - 1), ey = Y(series.at(-1).v);
    svg.append(s('circle', { cx: ex, cy: ey, r: 6, class: 'ring' }), s('circle', { cx: ex, cy: ey, r: 5.5, class: 'pt' }));
    const guide = s('line', { y1: m.t, y2: H - m.b, class: 'guide', visibility: 'hidden' }), dot = s('circle', { r: 6.5, class: 'pt hov', visibility: 'hidden' }), tip = h('div', { class: 'tip', hidden: true, role: 'status' });
    svg.append(guide, dot);
    const show = i => {
      vIdx = Math.max(0, Math.min(series.length - 1, i)); const p = series[vIdx];
      guide.setAttribute('x1', X(vIdx)); guide.setAttribute('x2', X(vIdx)); guide.removeAttribute('visibility');
      dot.setAttribute('cx', X(vIdx)); dot.setAttribute('cy', Y(p.v)); dot.removeAttribute('visibility');
      tip.hidden = false; tip.replaceChildren(h('b', {}, money(p.v)), h('span', {}, p.label));
      tip.style.left = `${Math.min(88, Math.max(12, (X(vIdx) / W) * 100))}%`; tip.style.top = `${(Y(p.v) / H) * 100 - 14}%`;
      setRead(p);
    };
    const hide = () => { guide.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; setRead(series.at(-1)); };
    svg.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; show(Math.round(((px - m.l) / (W - m.l - m.r)) * (series.length - 1))); });
    svg.addEventListener('pointerleave', hide); svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); show(vIdx - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); show(vIdx + 1); } else if (e.key === 'Escape') hide(); });
    vHost.append(svg, tip); setRead(series.at(-1));
  }

  /* --- income vs. expenses: staggered bars, hover a month */
  const fRead = h('div', { class: 'fc-read', 'aria-live': 'off' }), fHost = h('div', { class: 'chart-host' });
  const net = WESTLAKE_INCOME.map((v, i) => v - WESTLAKE_EXPENSES[i]);
  const fDefault = () => fRead.replaceChildren(h('b', {}, money(a.noi)), h('span', { class: 'when' }, 'Net operating income · last 12 months'));
  function drawFlow() {
    clear(fHost);
    const W = 640, H = 250, m = { t: 16, r: 12, b: 28, l: 50 };
    const max = Math.max(...WESTLAKE_INCOME, ...WESTLAKE_EXPENSES) * 1.1, Y = v => H - m.b - (v / max) * (H - m.t - m.b);
    const slot = (W - m.l - m.r) / 12, bw = slot * 0.3;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fc', role: 'img',
      'aria-label': `Monthly rental income versus operating expenses. Income is ${money(WESTLAKE_INCOME[0])} each month; expenses range from ${money(Math.min(...WESTLAKE_EXPENSES))} to ${money(Math.max(...WESTLAKE_EXPENSES))}.` });
    [0, 1, 2, 3].forEach(i => { const v = (max * i) / 3; svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: m.l - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, compact(v))); });
    const cols = WESTLAKE_MONTHS.map((mo, i) => {
      const cx = m.l + slot * i + slot / 2;
      const g = s('g', { class: 'col', style: `--i:${i}` },
        s('rect', { x: cx - slot / 2, y: m.t, width: slot, height: H - m.t - m.b, rx: 8, class: 'hl' }),
        s('rect', { x: cx - bw - 1, y: Y(WESTLAKE_INCOME[i]), width: bw, height: H - m.b - Y(WESTLAKE_INCOME[i]), rx: 3, class: 'b-inc' }),
        s('rect', { x: cx + 1, y: Y(WESTLAKE_EXPENSES[i]), width: bw, height: H - m.b - Y(WESTLAKE_EXPENSES[i]), rx: 3, class: 'b-exp' }),
        s('text', { x: cx, y: H - 8, class: 'ax', 'text-anchor': 'middle' }, mo));
      const on = () => {
        cols.forEach(c => c.classList.toggle('on', c === g)); svg.classList.add('hovering');
        fRead.replaceChildren(h('b', {}, money(net[i])), h('span', { class: 'when' }, `${mo} · income ${money(WESTLAKE_INCOME[i])} · expenses ${money(WESTLAKE_EXPENSES[i])}`));
      };
      g.addEventListener('pointerenter', on);
      return g;
    });
    svg.addEventListener('pointerleave', () => { cols.forEach(c => c.classList.remove('on')); svg.classList.remove('hovering'); fDefault(); });
    svg.append(...cols); fHost.append(svg); fDefault();
  }

  const fin = clear(document.getElementById('fin'));
  fin.append(
    h('div', { class: 'fin-title' }, h('b', {}, a.name), h('span', {}, `${a.place} · ${a.kind}`), h('span', { class: 'chip' }, 'Sample data')),
    tiles,
    h('div', { class: 'charts' },
      h('div', { class: 'chart-card' }, h('div', { class: 'chart-t' }, h('div', {}, h('b', {}, 'Estimated value'), vSpan), pills), vRead, vHost),
      h('div', { class: 'chart-card' }, h('div', { class: 'chart-t' }, h('div', {}, h('b', {}, 'Income vs. expenses'), h('span', {}, 'Oct – Sep')),
        h('span', { class: 'legend' }, h('span', {}, h('i', { class: 'li-inc' }), 'Income'), h('span', {}, h('i', { class: 'li-exp' }), 'Expenses'))), fRead, fHost)));
  drawValue(); drawFlow();

  const run = () => {
    fin.classList.add('play');
    counters.forEach(({ el, to, fmt }) => {
      if (mq.matches) return;
      const t0 = performance.now(), dur = 1400;
      const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(to); };
      el.textContent = fmt(0); requestAnimationFrame(step);
    });
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); run(); } }, { threshold: 0.2 });
    io.observe(fin);
  } else run();
}

/* ---------------------------------------------------------- collection */
{
  const IMG = { residential: ['house', 626, 501], car: ['porsche', 1000, 800], truck: ['truck', 1000, 800], vessel: ['yacht', 1000, 800], aircraft: ['jet', 1000, 800] };
  const picks = [['austin', 'residential', 'lg'], ['scottsdale', 'car', ''], ['nashville', 'truck', ''], ['lisbon', 'vessel', ''], ['teterboro', 'aircraft', '']];
  clear(document.getElementById('collection')).append(...picks.map(([id, art, size]) => {
    const a = byId(id), [file, w, hgt] = IMG[art];
    const svg = h('img', { class: 'art', src: `assets/collection/${file}.jpg`, width: w, height: hgt, loading: 'lazy', decoding: 'async', alt: `${a.name}, ${a.kind.toLowerCase()} (illustrative image)` });
    return h('li', { class: 'col-card ' + size }, svg,
      h('div', { class: 'col-meta' }, h('div', {}, h('b', {}, a.name), h('span', {}, a.place)), h('div', { class: 'col-val' }, h('b', {}, compact(a.value)), Delta(a.appreciation, fmtPct(a.appreciationPct, { sign: true })))));
  }));
}

/* ------------------------------------------------------------- reports */
{
  const host = clear(document.getElementById('reports'));
  const alloc = Object.entries(ASSETS.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + x.value), m), {})).sort((p, q) => q[1] - p[1]);
  const shades = ['#0B1736', '#2563EB', '#60A5FA', '#93C5FD', '#BFD7FB', '#DCE8FB', '#EEF3FC'];
  const top = [...ASSETS].sort((x, y) => y.value - x.value).slice(0, 6);
  const maxV = top[0].value;

  // donut (real allocation shares)
  const donut = (() => {
    const R = 44, r = 30, C = 50; let ang = -Math.PI / 2;
    const arcs = alloc.map(([k, v], i) => {
      const sw = Math.min(v / P.value, 0.9999) * Math.PI * 2, b2 = ang + sw, big = sw > Math.PI ? 1 : 0;
      const pt = (rad, t) => `${(C + rad * Math.cos(t)).toFixed(2)},${(C + rad * Math.sin(t)).toFixed(2)}`;
      const d = `M${pt(R, ang)}A${R},${R} 0 ${big} 1 ${pt(R, b2)}L${pt(r, b2)}A${r},${r} 0 ${big} 0 ${pt(r, ang)}Z`;
      ang = b2; return s('path', { d, fill: shades[i % shades.length] });
    });
    return s('svg', { viewBox: '0 0 100 100', class: 'pp-donut', 'aria-hidden': 'true' }, ...arcs,
      s('text', { x: 50, y: 49, 'text-anchor': 'middle', class: 'dv' }, compact(P.value)), s('text', { x: 50, y: 60, 'text-anchor': 'middle', class: 'dl' }, 'TOTAL'));
  })();

  const pdf = h('div', { class: 'doc doc-pdf', role: 'img', 'aria-label': 'Preview of a portfolio summary report page with sample data' },
    h('div', { class: 'pp-top' }, h('div', { class: 'pp-brand' }, h('i', {}), 'ATLAS'), h('span', {}, 'Portfolio summary')),
    h('div', { class: 'pp-title' }, h('b', {}, 'Monthly portfolio report'), h('span', {}, `As of ${TODAY} · USD · sample data`)),
    h('div', { class: 'pp-kpis' },
      h('div', {}, h('em', {}, 'Portfolio value'), h('b', {}, compact(P.value)), Delta(P.appreciation, fmtPct(P.appreciationPct, { sign: true }))),
      h('div', {}, h('em', {}, 'Acquisition cost'), h('b', {}, compact(P.cost)), h('small', {}, `${P.count} assets`)),
      h('div', {}, h('em', {}, 'Net operating income'), h('b', {}, compact(P.noi)), h('small', {}, 'Annual')),
      h('div', {}, h('em', {}, 'NOI yield'), h('b', {}, pct1(P.noiYield)), h('small', {}, `${P.earningCount} income assets`))),
    h('div', { class: 'pp-row' },
      h('div', { class: 'pp-card' }, h('h4', {}, 'Allocation by category'),
        h('div', { class: 'pp-alloc-row' }, donut, h('ul', { class: 'pp-leg' }, alloc.slice(0, 5).map(([k, v], i) => h('li', {}, h('i', { style: `background:${shades[i]}` }), CATEGORIES[k], h('b', {}, pct1(v / P.value))))))),
      h('div', { class: 'pp-card' }, h('h4', {}, 'Largest holdings'),
        h('ul', { class: 'pp-bars' }, top.slice(0, 4).map(x => h('li', {}, h('span', {}, x.name), h('i', { style: `width:${(x.value / maxV) * 100}%` }), h('b', {}, compact(x.value))))))),
    h('table', {}, h('thead', {}, h('tr', {}, ['Asset', 'Location', 'Value', 'vs. cost'].map((t, i) => h('th', { class: i > 1 ? 'r' : '' }, t)))),
      h('tbody', {}, top.map(x => h('tr', {}, h('td', {}, h('b', {}, x.name)), h('td', {}, x.place), h('td', { class: 'r' }, compact(x.value)), h('td', { class: 'r' }, Delta(x.appreciation, fmtPct(x.appreciationPct, { sign: true }))))))),
    h('div', { class: 'pp-foot' }, h('span', {}, 'Illustrative sample data'), h('span', {}, 'Page 1 of 3')));

  const hdr = ['Asset', 'Category', 'Cost', 'Value', 'Δ vs. cost', 'NOI'];
  const L = 'ABCDEF';
  const sheet = h('div', { class: 'doc doc-xls', role: 'img', 'aria-label': 'Preview of a spreadsheet export with sample data' },
    h('div', { class: 'xl-top' }, h('span', { class: 'xl-logo' }, 'X'), h('b', {}, 'atlas-assets.xlsx'), h('span', { class: 'xl-saved' }, 'Sample data')),
    h('div', { class: 'xl-ribbon' }, ['Home', 'Insert', 'Formulas', 'Data'].map((t, i) => h('span', { class: i === 0 ? 'on' : '' }, t))),
    h('div', { class: 'xl-fx' }, h('span', { class: 'xl-name' }, 'E12'), h('i', {}, 'fx'), h('span', { class: 'xl-f' }, `=SUM(E2:E${ASSETS.length + 1})`)),
    h('div', { class: 'xl-grid' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', { class: 'corner' }), L.split('').map(c => h('th', {}, c)))),
      h('tbody', {},
        h('tr', { class: 'hdr' }, h('th', {}, 1), hdr.map((t, i) => h('td', { class: i > 1 ? 'r' : '' }, t))),
        ASSETS.map((x, i) => h('tr', {}, h('th', {}, i + 2), h('td', {}, x.name), h('td', {}, CATEGORIES[x.category]), h('td', { class: 'r' }, x.cost.toLocaleString('en-US')), h('td', { class: 'r' }, x.value.toLocaleString('en-US')),
          h('td', { class: 'r ' + tone(x.appreciation) }, fmtPct(x.appreciationPct, { sign: true })), h('td', { class: 'r' }, x.earning ? x.noi.toLocaleString('en-US') : '—'))),
        h('tr', { class: 'tot' }, h('th', {}, ASSETS.length + 2), h('td', {}, 'Total'), h('td', {}, ''), h('td', { class: 'r' }, P.cost.toLocaleString('en-US')), h('td', { class: 'r sel' }, P.value.toLocaleString('en-US')),
          h('td', { class: 'r ' + tone(P.appreciation) }, fmtPct(P.appreciationPct, { sign: true })), h('td', { class: 'r' }, P.noi.toLocaleString('en-US')))))),
    h('div', { class: 'xl-tabs' }, ['Assets', 'Income', 'Valuations'].map((t, i) => h('span', { class: i === 0 ? 'on' : '' }, t))));

  const stage = h('div', { class: 'rep-stage', 'data-front': 'pdf' }, pdf, sheet);
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Report format' });
  const pick = k => {
    stage.dataset.front = k;
    seg.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.k === k); b.setAttribute('aria-pressed', String(b.dataset.k === k)); });
  };
  seg.append(h('button', { type: 'button', 'data-k': 'pdf', onclick: () => pick('pdf') }, 'PDF summary'), h('button', { type: 'button', 'data-k': 'xlsx', onclick: () => pick('xlsx') }, 'Spreadsheet'));
  pdf.addEventListener('click', () => pick('pdf')); sheet.addEventListener('click', () => pick('xlsx'));
  host.append(seg, stage, h('p', { class: 'fine' }, 'Preview of planned report layouts. CSV export is available today in the app preview; PDF and Excel are in development.'));
  pick('pdf');
}

/* --------------------------------------------------------------- form */
{
  const form = document.getElementById('ea-form'), status = document.getElementById('ea-status'), btn = document.getElementById('ea-submit');
  let started = false, inflight = false;
  form.addEventListener('focusin', () => { if (!started) { started = true; analytics.track('early_access_form_start'); } });

  const showErrors = errors => {
    ['email', 'consent'].forEach(k => {
      document.getElementById('e-' + k).textContent = errors[k] || '';
      const n = form.elements[k];
      if (errors[k]) n.setAttribute('aria-invalid', 'true'); else n.removeAttribute('aria-invalid');
    });
    const first = ['email', 'consent'].find(k => errors[k]);
    if (first) form.elements[first].focus();
  };
  const setBusy = on => { inflight = on; btn.disabled = on; btn.setAttribute('aria-busy', String(on)); btn.classList.toggle('busy', on); btn.querySelector('.lbl').textContent = on ? 'Submitting…' : 'Get early access'; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (inflight) return;
    status.textContent = ''; status.className = 'form-status';
    const fd = new FormData(form);
    const raw = { email: fd.get('email'), consent: fd.get('consent') === 'on', website: fd.get('website'), source: 'landing' };
    const v = validateLead(raw);
    showErrors(v.errors);
    if (!v.ok) { analytics.track('early_access_form_error', { reason: 'validation' }); return; }
    setBusy(true);
    analytics.track('early_access_form_submit');
    try {
      const r = await fetch('/api/early-access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(raw) });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.ok) {
        analytics.track('early_access_form_success');
        form.replaceChildren(h('div', { class: 'done', tabindex: -1, role: 'status' }, h('div', { class: 'tick', 'aria-hidden': 'true' }, '✓'), h('h3', {}, 'You’re on the list.'),
          h('p', {}, 'We’ve recorded your request and will email you when ATLAS opens.')));
        form.querySelector('.done').focus();
        return;
      }
      if (r.status === 422 && data.errors) { showErrors(data.errors); analytics.track('early_access_form_error', { reason: 'validation' }); return; }
      status.textContent = r.status === 503 ? 'Early-access sign-up isn’t available yet because the server isn’t configured. Nothing was saved. Please try again later.'
        : 'We couldn’t save your request. Nothing was submitted—please try again in a moment.';
      status.classList.add('bad');
      analytics.track('early_access_form_error', { reason: String(r.status) });
    } catch {
      status.textContent = 'We couldn’t reach the server. Check your connection and try again. Nothing was submitted.'; status.classList.add('bad');
      analytics.track('early_access_form_error', { reason: 'network' });
    } finally { if (form.contains(btn)) setBusy(false); }
  });
}

/* ------------------------------------------------- header, CTA tracking, motion */
{
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-cta]');
    if (c) analytics.track(c.dataset.cta === 'primary' ? 'primary_cta_click' : 'secondary_cta_click', { where: c.dataset.where || '' });
    if (c && c.getAttribute('href') === '#early-access') setTimeout(() => document.getElementById('f-email')?.focus({ preventScroll: true }), reduceMotion ? 0 : 600);
  });
  const targets = document.querySelectorAll('.sec-head, .globe-stage, .fin, .collection, .reports');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(t => { t.setAttribute('data-reveal', ''); io.observe(t); });
  }
}
