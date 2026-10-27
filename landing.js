import { h, s, clear } from './src/dom.js';
import { fmtPct, fmtSigned, tone } from './src/calc.js';
import {
  ASSETS, CATEGORIES, VALUATION_DATE, WESTLAKE_MONTHS, WESTLAKE_INCOME, WESTLAKE_EXPENSES,
  WESTLAKE_VALUATIONS, portfolio, byId,
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

/* ------------------------------------------------------------------ hero */
{
  const host = document.getElementById('hero-map'), sel = document.getElementById('hero-sel');
  let cur = 'austin';
  const globe = createGlobe(host, { assets: ASSETS, icons: ICON, selectedId: cur, label: 'Rotating 3D globe of sample assets', startLon: -88, tilt: 24,
    onSelect: id => { cur = id; globe.setSelected(id); globe.focus(id); clear(sel).append(assetCard(byId(id))); } });
  clear(sel).append(assetCard(byId(cur)));
  const ch = FEATURED.value - WESTLAKE_VALUATIONS[0].v;
  clear(document.getElementById('hero-value')).append(h('span', {}, 'Portfolio value'), h('b', {}, money(P.value)), Delta(P.appreciation, `${fmtSigned(P.appreciation, { compact: true })} · ${fmtPct(P.appreciationPct, { sign: true })} vs. cost`));
  const k = (l, v, sub) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, v), h('em', {}, sub));
  clear(document.getElementById('hero-pair')).append(k('Net operating income', compact(P.noi), 'Annual'), k('NOI yield', pct1(P.noiYield), `${P.earningCount} income assets`));
  const mc = document.getElementById('hero-chart');
  mc.append(h('div', { class: 'mc-h' }, h('span', {}, 'Westlake Residence'), Delta(ch, `${fmtPct(ch / WESTLAKE_VALUATIONS[0].v, { sign: true })} since ${WESTLAKE_VALUATIONS[0].label}`)), h('div', {}));
  sparkline(mc.lastChild, WESTLAKE_VALUATIONS);
  // floating highlights (computed from the same sample data)
  const fa = byId('lisbon'), fb = byId('austin');
  document.getElementById('float-a').append(h('span', { class: 'ac-ico' }, icon(fa.category, 18)), h('div', {}, h('b', {}, fa.name), h('span', {}, fa.place)), Delta(fa.appreciation, fmtPct(fa.appreciationPct, { sign: true })));
  document.getElementById('float-b').append(h('div', {}, h('span', {}, 'NOI yield'), h('b', {}, pct1(fb.noiYield))), h('em', {}, fb.name));
}

/* ---------------------------------------------------------- globe section */
{
  const state = { sel: 'austin', filter: null };
  const card = document.getElementById('globe-card'), list = document.getElementById('globe-list'), filterHost = document.getElementById('map-filter');
  const visible = () => ASSETS.filter(a => !state.filter || a.category === state.filter);
  const globe = createGlobe(document.getElementById('globe-main'), { assets: ASSETS, icons: ICON, selectedId: state.sel, startLon: -96, tilt: 22,
    label: 'Rotating 3D globe of sample asset locations', onSelect: id => select(id, true) });
  const render = () => {
    clear(card).append(assetCard(byId(state.sel)));
    clear(list).append(...visible().map(a => h('li', {}, h('button', {
      type: 'button', class: a.id === state.sel ? 'on' : '', 'aria-pressed': String(a.id === state.sel), onclick: () => select(a.id, true),
    }, icon(a.category, 18), h('span', {}, h('b', {}, a.name), h('em', {}, a.place)), h('strong', {}, compact(a.value))))));
    filterHost.querySelectorAll('button').forEach(b => { const on = (b.dataset.k || null) === state.filter; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  };
  function select(id, focus) { state.sel = id; globe.setSelected(id); if (focus) globe.focus(id); render(); }
  const setFilter = c => {
    state.filter = c; globe.setFilter(c);
    if (!visible().some(a => a.id === state.sel)) select(visible()[0].id, true); else render();
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
  const a = FEATURED;
  const tile = (label, value, sub, cls = '') => h('div', { class: 'tile ' + cls }, h('span', {}, label), h('b', {}, value), sub && h('em', {}, sub));
  const vHost = h('div', { class: 'chart-host' }), fHost = h('div', { class: 'chart-host' });
  clear(document.getElementById('fin')).append(
    h('div', { class: 'fin-title' }, h('b', {}, a.name), h('span', {}, `${a.place} · ${a.kind}`), h('span', { class: 'chip' }, 'Sample data')),
    h('div', { class: 'tiles' },
      tile('Estimated value', money(a.value), `Valued ${VALUATION_DATE}`, 'dark'),
      tile('Appreciation', Delta(a.appreciation, fmtSigned(a.appreciation)), `${fmtPct(a.appreciationPct, { sign: true })} vs. ${money(a.cost)} cost`),
      tile('Rental income', money(a.gross), 'Last 12 months'),
      tile('Operating expenses', money(a.expenses), 'Last 12 months'),
      tile('Net yield (NOI)', pct1(a.noiYield), `${money(a.noi)} NOI ÷ est. value`, 'blue')),
    h('div', { class: 'charts' },
      h('div', { class: 'chart-card' }, h('div', { class: 'chart-t' }, h('b', {}, 'Estimated value'), h('span', {}, 'Mar 2022 – Sep 2026')), vHost),
      h('div', { class: 'chart-card' }, h('div', { class: 'chart-t' }, h('b', {}, 'Income vs. expenses'),
        h('span', { class: 'legend' }, h('span', {}, h('i', { class: 'li-inc' }), 'Income'), h('span', {}, h('i', { class: 'li-exp' }), 'Expenses'))), fHost)));
  valuationChart(vHost, WESTLAKE_VALUATIONS, { label: 'Estimated value of Westlake Residence' });
  flowChart(fHost);
}

/* ---------------------------------------------------------- collection */
{
  const stroke = { stroke: '#0B1736', 'stroke-width': 2.5, 'stroke-linejoin': 'round' };
  const wheel = (cx, cy, r) => s('g', {}, s('circle', { cx, cy, r, fill: '#0B1736' }), s('circle', { cx, cy, r: r * 0.42, fill: '#fff' }));
  const ART = {
    residential: () => [
      s('path', { d: 'M70 196V106l90-52 90 52v90z', fill: '#fff', ...stroke }),
      s('path', { d: 'M52 114L160 52l108 62', fill: 'none', stroke: '#2563EB', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      s('path', { d: 'M250 196v-66h80v66', fill: '#fff', ...stroke }), s('path', { d: 'M240 130l50-30 50 30', fill: 'none', stroke: '#2563EB', 'stroke-width': 4, 'stroke-linecap': 'round' }),
      s('rect', { x: 128, y: 140, width: 34, height: 56, fill: '#BFDBFE', ...stroke }),
      s('rect', { x: 90, y: 114, width: 26, height: 26, fill: '#DBEAFE', ...stroke }), s('rect', { x: 188, y: 114, width: 26, height: 26, fill: '#DBEAFE', ...stroke }),
      s('rect', { x: 262, y: 148, width: 24, height: 24, fill: '#DBEAFE', ...stroke })],
    car: () => [
      s('path', { d: 'M44 186l14-30q8-16 30-20l56-8q26-24 62-24h48q32 4 48 30l34 12q16 6 16 22v18z', fill: '#fff', ...stroke }),
      s('path', { d: 'M170 130q22-18 50-18h40q22 4 34 24z', fill: '#BFDBFE', ...stroke, 'stroke-width': 2 }),
      s('path', { d: 'M60 160h282', stroke: '#2563EB', 'stroke-width': 4, 'stroke-linecap': 'round' }), wheel(110, 190, 25), wheel(296, 190, 25)],
    truck: () => [
      s('rect', { x: 170, y: 76, width: 200, height: 104, rx: 5, fill: '#fff', ...stroke }), s('rect', { x: 170, y: 122, width: 200, height: 14, fill: '#2563EB' }),
      s('path', { d: 'M44 190V112q0-14 14-14h58l26 34h16v58z', fill: '#fff', ...stroke }), s('path', { d: 'M96 108h22l16 24H96z', fill: '#BFDBFE', ...stroke, 'stroke-width': 2 }),
      wheel(84, 194, 20), wheel(214, 194, 20), wheel(306, 194, 20)],
    vessel: () => [
      s('path', { d: 'M110 170v-30h170l34 30z', fill: '#fff', ...stroke }), s('path', { d: 'M150 140v-28h96l24 28z', fill: '#fff', ...stroke }),
      s('path', { d: 'M164 130v-12h74l10 12z', fill: '#BFDBFE' }), s('path', { d: 'M28 170h344l-34 38H70z', fill: '#0B1736' }), s('path', { d: 'M52 182h296', stroke: '#2563EB', 'stroke-width': 3 }),
      s('path', { d: 'M20 218q20-10 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0', fill: 'none', stroke: '#93C5FD', 'stroke-width': 3, 'stroke-linecap': 'round' })],
    aircraft: () => [
      s('path', { d: 'M30 150q30-24 100-24h170q54 2 72 24-18 24-72 26H130q-70 0-100-26z', fill: '#fff', ...stroke }),
      s('path', { d: 'M62 138L44 84h46l34 50z', fill: '#2563EB', ...stroke }), s('path', { d: 'M196 156l56 46h24l-34-46z', fill: '#DBEAFE', ...stroke }),
      s('ellipse', { cx: 112, cy: 122, rx: 28, ry: 9, fill: '#fff', ...stroke }), s('path', { d: 'M318 142q22 0 40 8-18 4-40 4z', fill: '#BFDBFE' }),
      ...[170, 200, 230, 260].map(x => s('rect', { x, y: 138, width: 14, height: 10, rx: 3, fill: '#BFDBFE', stroke: '#0B1736', 'stroke-width': 1.5 }))],
  };
  const picks = [['austin', 'residential', 'lg'], ['scottsdale', 'car', ''], ['nashville', 'truck', ''], ['lisbon', 'vessel', ''], ['teterboro', 'aircraft', '']];
  clear(document.getElementById('collection')).append(...picks.map(([id, art, size]) => {
    const a = byId(id), ground = art !== 'vessel' && art !== 'aircraft';
    const svg = s('svg', { viewBox: '0 0 400 260', preserveAspectRatio: 'xMidYMid slice', class: 'art', role: 'img', 'aria-label': `Illustration of ${a.kind.toLowerCase()}` },
      s('defs', {}, s('linearGradient', { id: 'bg-' + id, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0', 'stop-color': '#F3F8FF' }), s('stop', { offset: '1', 'stop-color': '#DBEAFE' }))),
      s('rect', { width: 400, height: 260, fill: `url(#bg-${id})` }),
      ground && s('path', { d: 'M0 214h400v46H0z', fill: '#CFE0FA' }), ground && s('path', { d: 'M14 214h372', stroke: '#0B1736', 'stroke-width': 2 }),
      ...ART[art]());
    return h('li', { class: 'col-card ' + size }, svg,
      h('div', { class: 'col-meta' }, h('div', {}, h('b', {}, a.name), h('span', {}, a.place)), h('div', { class: 'col-val' }, h('b', {}, compact(a.value)), Delta(a.appreciation, fmtPct(a.appreciationPct, { sign: true })))));
  }));
}

/* ------------------------------------------------------------- reports */
{
  const host = clear(document.getElementById('reports'));
  const top = [...ASSETS].sort((x, y) => y.value - x.value).slice(0, 6);
  const alloc = Object.entries(ASSETS.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + x.value), m), {})).sort((p, q) => q[1] - p[1]);
  const pdf = h('div', { class: 'paper', role: 'img', 'aria-label': 'Preview of a portfolio summary report with sample data' },
    h('div', { class: 'pp-h' }, h('b', {}, 'ATLAS'), h('span', {}, `Portfolio summary · ${VALUATION_DATE}`)),
    h('div', { class: 'pp-kpis' }, h('div', {}, h('em', {}, 'Value'), h('b', {}, compact(P.value))), h('div', {}, h('em', {}, 'Cost'), h('b', {}, compact(P.cost))), h('div', {}, h('em', {}, 'NOI'), h('b', {}, compact(P.noi))), h('div', {}, h('em', {}, 'NOI yield'), h('b', {}, pct1(P.noiYield)))),
    h('div', { class: 'pp-alloc' }, alloc.map(([k, v]) => h('span', { style: `flex:${v}`, title: `${CATEGORIES[k]} ${pct1(v / P.value)}` }))),
    h('ul', { class: 'pp-leg' }, alloc.slice(0, 4).map(([k, v]) => h('li', {}, CATEGORIES[k], h('b', {}, pct1(v / P.value))))),
    h('table', {}, h('thead', {}, h('tr', {}, ['Asset', 'Location', 'Value'].map(t => h('th', {}, t)))), h('tbody', {}, top.map(x => h('tr', {}, h('td', {}, x.name), h('td', {}, x.place), h('td', {}, compact(x.value)))))));
  const sheet = h('div', { class: 'sheet', role: 'img', 'aria-label': 'Preview of a spreadsheet export with sample data' },
    h('div', { class: 'sh-bar' }, h('i', {}), h('span', {}, 'atlas-assets.xlsx')),
    h('table', {}, h('thead', {}, h('tr', {}, ['', 'Asset', 'Cost', 'Value', 'NOI'].map(t => h('th', {}, t)))),
      h('tbody', {}, ASSETS.slice(0, 8).map((x, i) => h('tr', {}, h('th', {}, i + 1), h('td', {}, x.name), h('td', { class: 'r' }, x.cost.toLocaleString('en-US')), h('td', { class: 'r' }, x.value.toLocaleString('en-US')), h('td', { class: 'r' }, x.earning ? x.noi.toLocaleString('en-US') : '—'))))));
  const frame = h('div', { class: 'rep-frame' }, pdf);
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Report format' });
  const pick = k => {
    frame.replaceChildren(k === 'pdf' ? pdf : sheet);
    seg.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.k === k); b.setAttribute('aria-pressed', String(b.dataset.k === k)); });
  };
  seg.append(h('button', { type: 'button', 'data-k': 'pdf', onclick: () => pick('pdf') }, 'PDF summary'), h('button', { type: 'button', 'data-k': 'xlsx', onclick: () => pick('xlsx') }, 'Spreadsheet'));
  host.append(seg, frame, h('p', { class: 'fine' }, 'Preview of planned report layouts. CSV export is available today in the app preview; PDF and Excel are in development.'));
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
