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
function pct1(n) { return n == null ? '–' : (n * 100).toFixed(1) + '%'; }
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
const ASSET_IMG = { austin: 'house', miami: 'house', chicago: 'house', london: 'commercial', seattle: 'land', scottsdale: 'porsche', nashville: 'truck', teterboro: 'jet',
  lisbon: 'yacht', denver: 'excavator', boston: 'parking', columbus: 'industrial', moab: 'rv', sturgis: 'moto', newport: 'sail', keywest: 'jetski' };
/** 3D illustration of the asset when we have one, otherwise the category icon. */
const thumb = (a, size = 22) => ASSET_IMG[a.id]
  ? h('img', { class: 'thumb', src: `assets/collection/thumb/${ASSET_IMG[a.id]}.jpg`, width: size, height: size, alt: '', loading: 'lazy', decoding: 'async' })
  : icon(a.category, Math.round(size * 0.62));

/* ---------------------------------------------------------- shared UI pieces */
const Delta = (n, text) => {
  const t = tone(n, 0.5);
  return h('span', { class: `delta ${t}` }, h('span', { 'aria-hidden': 'true' }, t === 'pos' ? '▲' : t === 'neg' ? '▼' : '■'), text ?? fmtSigned(n),
    h('span', { class: 'sr' }, t === 'pos' ? ' (gain)' : t === 'neg' ? ' (loss)' : ''));
};
const statusDot = st => h('span', { class: 'st st-' + ({ Occupied: 'ok', Leased: 'ok', 'In service': 'ok', Vacant: 'warn' }[st] || 'idle') }, st);

function assetCard(a) {
  return h('div', { class: 'asset-card' },
    h('div', { class: 'ac-top' }, h('span', { class: 'ac-ico' }, thumb(a, 34)), h('div', {}, h('b', {}, a.name), h('span', {}, `${a.place} · ${a.kind}`)), statusDot(a.status)),
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
function attachGeo(host, globe, { visible, selected, onPick, onChange = () => {}, toggleAfter = null }) {
  const st = { mode: 'globe', cc: null, key: '' };
  const ico = d => s('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': 'true', class: 'gi' }, s('path', { d }));
  const toggle = h('div', { class: 'geo-toggle', role: 'group', 'aria-label': 'Map view', 'data-mode': 'globe' }, h('i', { class: 'geo-thumb', 'aria-hidden': 'true' }),
    h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => setMode('globe') }, ico(GLOBE_ICO), 'Globe'),
    h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setMode('country') }, ico(PIN_ICO), 'Country'));
  const chips = h('ul', { class: 'geo-chips', 'aria-label': 'Countries' }), row = h('div', { class: 'geo-assets', role: 'group', 'aria-label': 'Assets in this country' });
  if (toggleAfter) { toggleAfter.after(toggle); host.append(h('div', { class: 'geo-ui' }, chips), row); } else host.append(h('div', { class: 'geo-ui' }, toggle, chips), row);

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
        thumb(a, 24), h('span', {}, a.name), h('b', {}, compact(a.value)))));
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
    mode: () => st.mode, country: () => st.cc, toggle,
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
  const state = { view: 'map', group: 'all', sel: 'austin', sort: { key: 'value', dir: -1 }, q: '' };
  const $ = id => document.getElementById(id);
  const scope = () => ASSETS.filter(a => !GROUPS[state.group].cats || GROUPS[state.group].cats.includes(a.category));
  const historyFor = a => (a.id === 'austin' ? WESTLAKE_VALUATIONS : null);
  const views = { map: $('view-map'), assets: $('view-assets'), perf: $('view-perf'), reports: $('view-reports') };

  const globe = createGlobe($('hero-map'), { assets: ASSETS, icons: ICON, selectedId: state.sel, startLon: -88, tilt: 24, countryPadV: 70,
    label: 'Rotating 3D globe of sample assets', onSelect: id => select(id, true) });
  const geo = attachGeo($('hero-map'), globe, { visible: scope, selected: () => state.sel, onPick: (id, f) => select(id, f), onChange: () => { renderMap(); }, toggleAfter: $('view-title') });
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
    state.view = v; geo.toggle.hidden = v !== 'map';
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
    clear($('hero-pair')).append(k('Net operating income', p.earningCount ? compact(p.noi) : '–', p.earningCount ? 'Annual' : 'No income assets'),
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
    const total = sc.reduce((n, x) => n + x.value, 0) || 1, maxAbs = Math.max(...sc.map(x => Math.abs(x.appreciationPct)), 0.0001);
    const val = { name: a => a.name, place: a => a.place, value: a => a.value, share: a => a.value, chg: a => a.appreciationPct, status: a => a.status };
    const th = (key, label, cls = '') => h('th', { class: cls, 'aria-sort': k === key ? (d > 0 ? 'ascending' : 'descending') : 'none' },
      h('button', { type: 'button', onclick: () => { state.sort = { key, dir: k === key ? -d : (key === 'name' || key === 'place' || key === 'status' ? 1 : -1) }; renderAssets(); } }, label, h('span', { class: 'sort', 'aria-hidden': 'true' }, k === key ? (d > 0 ? '↑' : '↓') : '')));
    const tbody = h('tbody', {}), foot = h('div', { class: 'tbl-foot' }), count = h('span', { class: 'tbl-count' });
    const draw = () => {
      const q = state.q.trim().toLowerCase();
      const rows = sc.filter(x => !q || `${x.name} ${x.place} ${x.kind} ${x.status}`.toLowerCase().includes(q)).sort((x, y) => (val[k](x) > val[k](y) ? 1 : val[k](x) < val[k](y) ? -1 : 0) * d);
      count.textContent = `${rows.length} of ${sc.length} asset${sc.length === 1 ? '' : 's'}`;
      tbody.replaceChildren(...(rows.length ? rows.map((r, i) => {
        const t = tone(r.appreciationPct, 1e-6);
        return h('tr', { class: r.id === state.sel ? 'on' : '', style: `--i:${Math.min(i, 14)}` },
          h('td', {}, h('button', { type: 'button', class: 'rowbtn two', 'aria-pressed': String(r.id === state.sel), onclick: () => select(r.id, true) },
            h('span', { class: 'rico' }, thumb(r, 44)), h('span', { class: 'rtx' }, h('b', {}, r.name), h("em", {}, r.place)))),
          h('td', { class: 'r' }, compact(r.value)),
          h('td', {}, h('span', { class: 'share' }, h('i', { style: `width:${(r.value / total) * 100}%` }), h('b', {}, `${((r.value / total) * 100).toFixed(1)}%`))),
          h('td', { class: 'r' }, Delta(r.appreciation, fmtPct(r.appreciationPct, { sign: true })), h('span', { class: 'mb', 'aria-hidden': 'true' }, h('i', { class: t, style: `width:${(Math.abs(r.appreciationPct) / maxAbs) * 100}%` }))),
          h('td', {}, statusDot(r.status)));
      }) : [h('tr', {}, h('td', { colspan: 5, class: 'none' }, `No assets match “${state.q}”.`))]));
      const p = rows.length ? portfolio(rows) : null;
      foot.replaceChildren(h('span', {}, 'Total value ', h('b', {}, p ? money(p.value) : '–')), h('span', {}, 'Gain vs. cost ', p ? Delta(p.appreciation, `${fmtSigned(p.appreciation, { compact: true })} · ${fmtPct(p.appreciationPct, { sign: true })}`) : h('b', {}, '–')));
    };
    const search = h('input', { type: 'search', class: 'tbl-search', placeholder: 'Search assets, places, status', 'aria-label': 'Search assets', value: state.q, oninput: e => { state.q = e.target.value; draw(); } });
    const a = byId(state.sel), share = a.value / total;
    host.append(h('div', { class: 'assets-grid' },
      h('div', { class: 'tbl-card tbl-flex' },
        h('div', { class: 'tbl-bar' }, h('label', { class: 'tbl-sw' }, s('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true' }, s('circle', { cx: 7, cy: 7, r: 4.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }), s('path', { d: 'M10.5 10.5L14 14', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })), search), count),
        h('div', { class: 'tbl-scroll' }, h('table', { class: 'app-tbl' },
          h('thead', {}, h('tr', {}, th('name', 'Asset'), th('value', 'Value', 'r'), th('share', 'Share'), th('chg', 'vs. cost', 'r'), th('status', 'Status'))), tbody)),
        foot),
      h('div', { class: 'detail' }, assetCard(a), costVsValue(a),
        h('div', { class: 'share-card' }, h('div', {}, h('span', {}, 'Share of ' + (state.group === 'all' ? 'portfolio' : GROUPS[state.group].label.toLowerCase())), h('b', {}, `${(share * 100).toFixed(1)}%`)),
          h('div', { class: 'share-bar' }, h('i', { style: `width:${Math.max(2, share * 100)}%` }))),
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => { setView('map'); globe.focus(state.sel); } }, 'Show on map'))));
    draw();
  }

  /* PERFORMANCE view */
  function renderPerf() {
    const host = clear(views.perf), a = byId(state.sel), sc = scope(), p = portfolio(sc), hist = historyFor(a);
    const chart = h('div', { class: 'chart-host' });
    const rank = [...sc].sort((x, y) => y.appreciationPct - x.appreciationPct), mx = Math.max(...rank.map(r => Math.abs(r.appreciationPct)), 0.0001);
    const best = rank[0], worst = rank.at(-1), up = rank.filter(r => r.appreciationPct > 0).length, down = rank.filter(r => r.appreciationPct < 0).length;
    const kpi = (cls, l, v, sub, extra) => h('div', { class: 'pk ' + cls }, h('span', {}, l), h('b', {}, v), h('em', {}, sub), extra);
    const pick = r => select(r.id, true);
    host.append(
      h('div', { class: 'perf-kpis' },
        kpi('', 'Total return', Delta(p.appreciation, fmtSigned(p.appreciation, { compact: true })), `${fmtPct(p.appreciationPct, { sign: true })} on ${compact(p.cost)} invested`),
        kpi('click', 'Best performer', h('span', { class: 'pos' }, fmtPct(best.appreciationPct, { sign: true })), best.name, null),
        kpi('click', 'Weakest performer', h('span', { class: tone(worst.appreciationPct, 1e-6) }, fmtPct(worst.appreciationPct, { sign: true })), worst.name, null),
        kpi('', 'Winners / losers', `${up} up · ${down} down`, `${sc.length} asset${sc.length === 1 ? '' : 's'} in view`, h('span', { class: 'split', 'aria-hidden': 'true' }, h('i', { class: 'pos', style: `flex:${up || 0.001}` }), h('i', { class: 'neg', style: `flex:${down || 0.001}` })))),
      h('div', { class: 'perf-grid' },
        h('div', { class: 'tbl-card pad' }, h('div', { class: 'chart-t' }, h('div', {}, h('b', {}, a.name), h('span', {}, 'Estimated value over time')), hist ? h('span', { class: 'rng' }, `${hist[0].label} – ${hist.at(-1).label}`) : h('span', { class: 'rng' }, 'Sample data')),
          hist ? chart : h('div', {}, empty('Valuation history not recorded', 'Only one valuation exists for this asset in the sample, so ATLAS shows cost vs. estimated value instead.'), costVsValue(a)),
          h('div', { class: 'pstats' }, h('div', {}, h('span', {}, 'Acquisition cost'), h('b', {}, money(a.cost))), h('div', {}, h('span', {}, 'Estimated value'), h('b', {}, money(a.value))),
            h('div', {}, h('span', {}, 'Gain vs. cost'), h('b', { class: tone(a.appreciation, 0.5) }, `${fmtSigned(a.appreciation, { compact: true })}`)))),
        h('div', { class: 'tbl-card pad' }, h('div', { class: 'chart-t' }, h('div', {}, h('b', {}, 'Ranking by return'), h('span', {}, `${sc.length} asset${sc.length > 1 ? 's' : ''} · value vs. acquisition cost`))),
          h('ul', { class: 'rank' }, rank.map((r, i) => { const t = tone(r.appreciationPct, 1e-6), w = (Math.abs(r.appreciationPct) / mx) * 50;
            return h('li', { class: r.id === state.sel ? 'on' : '', style: `--i:${Math.min(i, 14)}` }, h('button', { type: 'button', onclick: () => pick(r) },
              h('span', { class: 'rn' }, h('em', { class: 'rk' }, String(i + 1)), r.name),
              h('span', { class: 'rb', 'aria-hidden': 'true' }, h('i', { class: t, style: `width:${w}%;${r.appreciationPct < 0 ? 'right' : 'left'}:50%` })),
              h('b', { class: t }, fmtPct(r.appreciationPct, { sign: true })))); })))));
    host.querySelectorAll('.pk.click').forEach((el, i) => { el.tabIndex = 0; el.setAttribute('role', 'button'); const r = i ? worst : best; el.addEventListener('click', () => pick(r)); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r); } }); });
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
          h('div', {}, h('em', {}, 'NOI'), h('b', {}, p.earningCount ? compact(p.noi) : '–')), h('div', {}, h('em', {}, 'NOI yield'), h('b', {}, pct1(p.noiYield)))),
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
    }, thumb(a, 32), h('span', {}, h('b', {}, a.name), h('em', {}, a.place)), h('strong', {}, compact(a.value))))));
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
/* Hover that glides along a line chart (eased cursor), while the readout still snaps to real data points. */
function trackHover(svg, { W, H, m, series, X, Y, guide, dot, tip, onPoint, onLeave }) {
  const n = series.length - 1, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = n, cur = n, shown = -1, raf = 0, active = false;
  const draw = t => {
    const i = Math.min(n - 1, Math.max(0, Math.floor(t))), f = t - i, v = series[i].v + (series[i + 1].v - series[i].v) * f, x = X(t), y = Y(v);
    guide.setAttribute('x1', x); guide.setAttribute('x2', x); dot.setAttribute('cx', x); dot.setAttribute('cy', y);
    tip.style.left = `${Math.min(88, Math.max(12, (x / W) * 100))}%`; tip.style.top = `${(y / H) * 100 - 14}%`;
    const k = Math.round(t);
    if (k !== shown) { shown = k; tip.replaceChildren(h('b', {}, money(series[k].v)), h('span', {}, series[k].label)); onPoint(series[k]); }
  };
  const step = () => { cur += (target - cur) * 0.2; if (Math.abs(target - cur) < 0.002) cur = target; draw(cur); raf = cur === target ? 0 : requestAnimationFrame(step); };
  const go = t => {
    target = Math.max(0, Math.min(n, t));
    if (!active) { active = true; cur = target; guide.removeAttribute('visibility'); dot.removeAttribute('visibility'); tip.hidden = false; draw(cur); return; }
    if (reduce) { cur = target; draw(cur); } else if (!raf) raf = requestAnimationFrame(step);
  };
  const leave = () => {
    active = false; cancelAnimationFrame(raf); raf = 0; shown = -1;
    guide.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; onLeave();
  };
  svg.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; go(((px - m.l) / (W - m.l - m.r)) * n); });
  svg.addEventListener('pointerleave', leave); svg.addEventListener('blur', leave);
  svg.addEventListener('keydown', e => {
    const cursor = Math.round(active ? target : n);
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cursor - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(cursor + 1); } else if (e.key === 'Escape') leave();
  });
}

function valuationChart(host, series, { label }) {
  clear(host);
  const W = 640, H = 270, m = { t: 16, r: 18, b: 28, l: 58 };
  const ys = series.map(p => p.v);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = (hi - lo) * 0.15 || hi * 0.05; lo -= pad; hi += pad;
  const X = i => m.l + (series.length === 1 ? 0 : (i / (series.length - 1)) * (W - m.l - m.r));
  const Y = v => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  const read = h('div', { class: 'fc-read' });
  const setRead = p => read.replaceChildren(h('b', {}, money(p.v)), Delta(p.v - series[0].v, `${fmtPct((p.v - series[0].v) / series[0].v, { sign: true })} since ${series[0].label}`), h('span', { class: 'when' }, p.label));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fc', role: 'img', tabindex: 0,
    'aria-label': `${label}: ${series[0].label} ${money(series[0].v)} to ${series.at(-1).label} ${money(series.at(-1).v)}. Use arrow keys to inspect points.` },
    s('defs', {}, s('linearGradient', { id: 'fcg-p', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0', 'stop-color': '#2563EB', 'stop-opacity': '.26' }), s('stop', { offset: '1', 'stop-color': '#2563EB', 'stop-opacity': '0' }))));
  [0, 1, 2, 3].forEach(i => {
    const v = lo + ((hi - lo) * i) / 3;
    svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: m.l - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, compact(v)));
  });
  [0, Math.floor((series.length - 1) / 2), series.length - 1].forEach(i => svg.append(s('text', { x: X(i), y: H - 8, class: 'ax', 'text-anchor': i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle' }, series[i].label)));
  svg.append(s('path', { d: `${line}L${X(series.length - 1)} ${H - m.b}L${X(0)} ${H - m.b}Z`, class: 'ar', style: 'fill:url(#fcg-p)' }), s('path', { d: line, class: 'ln', pathLength: 1 }));
  const ex = X(series.length - 1), ey = Y(series.at(-1).v);
  svg.append(s('circle', { cx: ex, cy: ey, r: 6, class: 'ring' }), s('circle', { cx: ex, cy: ey, r: 5.5, class: 'pt' }));
  const guide = s('line', { y1: m.t, y2: H - m.b, class: 'guide', visibility: 'hidden' }), dot = s('circle', { r: 6.5, class: 'pt hov', visibility: 'hidden' }), tip = h('div', { class: 'tip', hidden: true, role: 'status' });
  svg.append(guide, dot);
  trackHover(svg, { W, H, m, series, X, Y, guide, dot, tip, onPoint: setRead, onLeave: () => setRead(series.at(-1)) });
  setRead(series.at(-1));
  host.append(read, svg, tip);
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

  const tiles = h('div', { class: 'tiles' },
    tile('Estimated value', num(a.value, v => money(Math.round(v))), `Valued ${TODAY}`, 'dark'),
    tile('Appreciation', Delta(a.appreciation, num(a.appreciation, v => fmtSigned(v))), h('span', {}, num(a.appreciationPct, v => fmtPct(v, { sign: true })), ` vs. ${money(a.cost)} cost`)),
    tile('Rental income', num(a.gross, v => money(Math.round(v))), 'Last 12 months'),
    tile('Operating expenses', num(a.expenses, v => money(Math.round(v))), 'Last 12 months'),
    tile('Net yield (NOI)', num(a.noiYield, v => pct1(v)), `${money(a.noi)} NOI ÷ est. value`, 'blue'));
  [...tiles.children].forEach((t, i) => t.style.setProperty('--i', i));

  /* --- estimated value: ranges, crosshair, live readout */
  const vRead = h('div', { class: 'fc-read', 'aria-live': 'off' }), vHost = h('div', { class: 'chart-host' }), vSpan = h('span', {});
  const ALL = WESTLAKE_VALUATIONS, RANGES = [['1Y', 3], ['3Y', 7], ['All', ALL.length]];
  let rng = 2;
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
    const ex = X(series.length - 1), ey = Y(series.at(-1).v);
    svg.append(s('circle', { cx: ex, cy: ey, r: 6, class: 'ring' }), s('circle', { cx: ex, cy: ey, r: 5.5, class: 'pt' }));
    const guide = s('line', { y1: m.t, y2: H - m.b, class: 'guide', visibility: 'hidden' }), dot = s('circle', { r: 6.5, class: 'pt hov', visibility: 'hidden' }), tip = h('div', { class: 'tip', hidden: true, role: 'status' });
    svg.append(guide, dot);
    trackHover(svg, { W, H, m, series, X, Y, guide, dot, tip, onPoint: setRead, onLeave: () => setRead(series.at(-1)) });
    vHost.append(svg, tip); setRead(series.at(-1));
  }

  /* --- income vs. expenses: staggered bars, hover a month */
  const fRead = h('div', { class: 'fc-read', 'aria-live': 'off' }), fHost = h('div', { class: 'chart-host' });
  const net = WESTLAKE_INCOME.map((v, i) => v - WESTLAKE_EXPENSES[i]);
  const fDefault = () => fRead.replaceChildren(h('b', {}, money(a.noi)), h('span', { class: 'when' }, 'Net operating income · last 12 months'));
  let fMode = 'columns';
  const fPills = h('div', { class: 'fc-pills', role: 'group', 'aria-label': 'Chart type' },
    ...[['columns', 'Columns'], ['lines', 'Lines']].map(([k, l]) => h('button', { type: 'button', 'data-k': k, 'aria-pressed': String(k === fMode), onclick: () => {
      fMode = k; [...fPills.children].forEach(x => x.setAttribute('aria-pressed', String(x.dataset.k === k))); drawFlow();
    } }, l)));
  function drawFlow() {
    clear(fHost);
    const W = 640, H = 250, m = { t: 16, r: 12, b: 28, l: 50 };
    const max = Math.max(...WESTLAKE_INCOME, ...WESTLAKE_EXPENSES) * 1.1, Y = v => H - m.b - (v / max) * (H - m.t - m.b);
    const slot = (W - m.l - m.r) / 12, bw = slot * 0.3, lines = fMode === 'lines';
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fc' + (lines ? ' lines' : ''), role: 'img',
      'aria-label': `Monthly rental income versus operating expenses. Income is ${money(WESTLAKE_INCOME[0])} each month; expenses range from ${money(Math.min(...WESTLAKE_EXPENSES))} to ${money(Math.max(...WESTLAKE_EXPENSES))}.` },
      s('defs', {}, s('linearGradient', { id: 'fcg2', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0', 'stop-color': '#2563EB', 'stop-opacity': '.22' }), s('stop', { offset: '1', 'stop-color': '#2563EB', 'stop-opacity': '0' }))));
    [0, 1, 2, 3].forEach(i => { const v = (max * i) / 3; svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: m.l - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, compact(v))); });
    const cx = i => m.l + slot * i + slot / 2;
    if (lines) {
      const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
      svg.append(
        s('path', { d: `${path(WESTLAKE_INCOME)}L${cx(11)} ${H - m.b}L${cx(0)} ${H - m.b}Z`, class: 'ar', style: 'fill:url(#fcg2)' }),
        s('path', { d: path(WESTLAKE_EXPENSES), class: 'ln exp', pathLength: 1 }), s('path', { d: path(WESTLAKE_INCOME), class: 'ln', pathLength: 1 }));
    }
    const cols = WESTLAKE_MONTHS.map((mo, i) => {
      const x = cx(i);
      const g = s('g', { class: 'col', style: `--i:${i}` },
        s('rect', { x: x - slot / 2, y: m.t, width: slot, height: H - m.t - m.b, rx: 8, class: 'hl' }),
        ...(lines
          ? [s('circle', { cx: x, cy: Y(WESTLAKE_EXPENSES[i]), r: 3.4, class: 'dt g', style: `--d:${0.5 + i * 0.06}s` }), s('circle', { cx: x, cy: Y(WESTLAKE_INCOME[i]), r: 3.4, class: 'dt', style: `--d:${0.55 + i * 0.06}s` })]
          : [s('rect', { x: x - bw - 1, y: Y(WESTLAKE_INCOME[i]), width: bw, height: H - m.b - Y(WESTLAKE_INCOME[i]), rx: 3, class: 'b-inc' }),
             s('rect', { x: x + 1, y: Y(WESTLAKE_EXPENSES[i]), width: bw, height: H - m.b - Y(WESTLAKE_EXPENSES[i]), rx: 3, class: 'b-exp' })]),
        s('text', { x, y: H - 8, class: 'ax', 'text-anchor': 'middle' }, mo));
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
        h('div', { class: 'chart-ctl' }, h('span', { class: 'legend' }, h('span', {}, h('i', { class: 'li-inc' }), 'Income'), h('span', {}, h('i', { class: 'li-exp' }), 'Expenses')), fPills)), fRead, fHost)));
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
  const IMG = {
    residential: ['house', 626, 501], car: ['porsche', 1000, 800], truck: ['truck', 1000, 800], vessel: ['yacht', 1000, 800], aircraft: ['jet', 1000, 800],
    land: ['land', 1000, 800], commercial: ['commercial', 1000, 800], parking: ['parking', 1000, 800],
    industrial: ['industrial', 1000, 800], excavator: ['excavator', 1000, 800], rv: ['rv', 1000, 800], moto: ['moto', 1000, 800], sail: ['sail', 1000, 800], jetski: ['jetski', 1000, 800],
  };
  const card = ([id, art, size], i) => {
    const a = byId(id), [file, w, hgt] = IMG[art];
    const img = h('img', { class: 'art', src: `assets/collection/${file}.jpg`, width: w, height: hgt, loading: 'lazy', decoding: 'async', alt: `${a.name}, ${a.kind.toLowerCase()} (illustrative image)` });
    return h('li', { class: 'col-card ' + size, style: `--i:${i}` }, img,
      h('div', { class: 'col-meta' }, h('div', {}, h('b', {}, a.name), h('span', {}, a.place)), h('div', { class: 'col-val' }, h('b', {}, compact(a.value)), Delta(a.appreciation, fmtPct(a.appreciationPct, { sign: true })))));
  };
  clear(document.getElementById('collection')).append(...[['austin', 'residential', 'lg'], ['scottsdale', 'car', ''], ['nashville', 'truck', ''], ['lisbon', 'vessel', ''], ['teterboro', 'aircraft', '']].map(card));
  const more = [['seattle', 'land', ''], ['london', 'commercial', ''], ['boston', 'parking', ''], ['columbus', 'industrial', ''], ['denver', 'excavator', ''], ['moab', 'rv', ''], ['sturgis', 'moto', ''], ['newport', 'sail', ''], ['keywest', 'jetski', '']];
  clear(document.getElementById('collection-more')).append(...more.map(card));
  const btn = document.getElementById('more-btn'), wrap = document.getElementById('more-wrap'), label = btn.querySelector('span');
  const preload = () => more.forEach(([, art]) => { new Image().src = `assets/collection/${IMG[art][0]}.jpg`; });
  btn.addEventListener('pointerenter', preload, { once: true }); btn.addEventListener('focus', preload, { once: true });
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open)); wrap.classList.toggle('open', open); label.textContent = open ? 'View less' : 'View more';
    analytics.track('collection_view_more', { open });
  });
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
          h('td', { class: 'r ' + tone(x.appreciation) }, fmtPct(x.appreciationPct, { sign: true })), h('td', { class: 'r' }, x.earning ? x.noi.toLocaleString('en-US') : '–'))),
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
        : 'We couldn’t save your request. Nothing was submitted. Please try again in a moment.';
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
  const targets = document.querySelectorAll('.sec-head, .globe-stage, .fin, .collection, .reports, .quote-card');
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
  document.querySelector('[data-focus-email]')?.addEventListener('click', () => setTimeout(() => document.getElementById('f-email')?.focus({ preventScroll: true }), 700));
}

/* ------------------------------------------------------------- pricing */
{
  const BASE = 47, INCLUDED = 3, EXTRA = 15;
  const range = document.getElementById('px-range');
  if (range) {
    const total = document.getElementById('px-total'), count = document.getElementById('px-count'), extra = document.getElementById('px-extra'), extraN = document.getElementById('px-extra-n'), extraV = document.getElementById('px-extra-v');
    const mqr = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let shown = BASE, raf = 0;
    const price = n => BASE + Math.max(0, n - INCLUDED) * EXTRA;
    const paint = v => { total.textContent = USD0.format(Math.round(v)); };
    const update = () => {
      const n = +range.value, p = price(n), more = Math.max(0, n - INCLUDED);
      const pct = ((n - range.min) / (range.max - range.min)) * 100; range.style.setProperty('--p', `${pct}%`);
      const bub = document.getElementById('px-bubble'); bub.style.setProperty('--q', pct.toFixed(2)); bub.textContent = String(n);
      range.setAttribute('aria-valuetext', `${n} assets, ${USD0.format(p)} per month`);
      count.textContent = String(n); document.getElementById('px-feat-n').textContent = String(n); document.getElementById('px-unit').textContent = n === 1 ? 'asset' : 'assets';
      extra.hidden = more === 0; extraN.textContent = `${more} extra asset${more === 1 ? '' : 's'} × ${USD0.format(EXTRA)}`; extraV.textContent = `+${USD0.format(more * EXTRA)}`;
      cancelAnimationFrame(raf);
      if (mqr) { shown = p; paint(p); return; }
      const from = shown, t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / 380), e = 1 - Math.pow(1 - k, 3); shown = from + (p - from) * e; paint(shown); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    };
    range.addEventListener('input', update); update();
    document.querySelectorAll('[data-px]').forEach(b => b.addEventListener('click', () => { range.value = b.dataset.px; update(); analytics.track('pricing_preset', { assets: +b.dataset.px }); }));
    range.addEventListener('change', () => analytics.track('pricing_slider', { assets: +range.value, price: price(+range.value) }));
  }
}
