import { h, s, clear } from './src/dom.js';
import { fmtMoney, fmtPct, fmtSigned, tone } from './src/calc.js';
import {
  ASSETS, CATEGORIES, VALUATION_DATE, WESTLAKE_MONTHS, WESTLAKE_INCOME, WESTLAKE_EXPENSES,
  WESTLAKE_VALUATIONS, portfolio, byId,
} from './src/demo-data.js';
import { validateLead, PORTFOLIO_SIZES, ASSET_TYPES, INVESTOR_TYPES } from './src/lead.js';
import { WORLD_MAP } from './assets/world-map.js';

document.documentElement.classList.add('js');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const P = portfolio();
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money = n => USD0.format(n);
const compact = n => fmtMoney(n, { compact: true });
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
  A: ['Your entire asset portfolio.', 'One clear view.'],
  B: ['See the full picture of', 'everything you own.'],
  C: ['One clear view of your', 'real-world assets.'],
};
{
  const v = new URLSearchParams(location.search).get('hv');
  if (v && v !== 'A' && HEADLINES[v]) {
    const el = document.querySelector('[data-variant-slot="hero-headline"]');
    el.replaceChildren(HEADLINES[v][0] + ' ', h('span', {}, HEADLINES[v][1]));
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

/* ------------------------------------------------------------------ dot map */
function dotMap(host, { selectedId, onSelect, interactive = false, filter = null, label }) {
  clear(host);
  const { w, h: ht, dots, markers } = WORLD_MAP;
  const svg = s('svg', { viewBox: `0 0 ${w} ${ht}`, class: 'dotmap', role: interactive ? 'group' : 'img', 'aria-label': label });
  svg.append(s('path', { d: dots, class: 'dots' }));
  const layer = s('g');
  const shown = ASSETS.filter(a => !filter || a.category === filter);
  // Draw the selected marker last so it sits on top.
  [...shown].sort((a, b) => (a.id === selectedId) - (b.id === selectedId)).forEach(a => {
    const [x, y] = markers[a.id];
    const sel = a.id === selectedId;
    const g = s('g', {
      class: 'mk' + (sel ? ' sel' : ''), transform: `translate(${x} ${y})`,
      ...(interactive ? { tabindex: 0, role: 'button', 'aria-pressed': String(sel), 'aria-label': `${a.name}, ${a.place}, ${compact(a.value)}` } : {}),
    },
    sel && s('circle', { r: 17, class: 'halo' }),
    s('circle', { r: 11, class: 'pin' }),
    s('g', { transform: 'translate(-6.5 -6.5) scale(.54)', class: 'glyph' }, s('path', { d: ICON[a.category] })));
    if (interactive) {
      g.addEventListener('click', () => onSelect(a.id));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(a.id); } });
    }
    layer.append(g);
  });
  svg.append(layer);
  host.append(svg);
}

/* ---------------------------------------------------------- shared UI pieces */
const Delta = (n, text) => {
  const t = tone(n, 0.5);
  return h('span', { class: `delta ${t}` }, h('span', { 'aria-hidden': 'true' }, t === 'pos' ? '▲' : t === 'neg' ? '▼' : '■'), text ?? fmtSigned(n),
    h('span', { class: 'sr' }, t === 'pos' ? ' (gain)' : t === 'neg' ? ' (loss)' : ''));
};
const statusDot = st => h('span', { class: 'st st-' + ({ Occupied: 'ok', Leased: 'ok', 'In service': 'ok', Vacant: 'warn' }[st] || 'idle') }, st);

function assetCard(a, { compactCard = false } = {}) {
  return h('div', { class: 'asset-card' },
    h('div', { class: 'ac-top' }, h('span', { class: 'ac-ico' }, icon(a.category, 18)), h('div', {}, h('b', {}, a.name), h('span', {}, a.place))),
    h('dl', { class: 'ac-grid' },
      h('div', {}, h('dt', {}, 'Estimated value'), h('dd', {}, money(a.value))),
      h('div', {}, h('dt', {}, 'Acquisition cost'), h('dd', {}, money(a.cost))),
      a.earning
        ? h('div', {}, h('dt', {}, 'NOI yield'), h('dd', {}, pct1(a.noiYield)))
        : h('div', {}, h('dt', {}, 'Vs. cost'), h('dd', {}, Delta(a.appreciation, fmtPct(a.appreciationPct, { sign: true })))),
      h('div', {}, h('dt', {}, 'Status'), h('dd', {}, statusDot(a.status)))),
    !compactCard && h('p', { class: 'ac-foot' }, `Valued ${VALUATION_DATE} · user-entered estimate`));
}
function pct1(n) { return n == null ? '—' : (n * 100).toFixed(1) + '%'; }

/* ----------------------------------------------------------------- hero */
{
  const k = (label, value, sub) => h('div', { class: 'kpi' }, h('span', {}, label), h('b', {}, value), sub && h('em', {}, sub));
  clear(document.getElementById('hero-kpis')).append(
    k('Portfolio value', compact(P.value), Delta(P.appreciation, `${fmtPct(P.appreciationPct, { sign: true })} vs. cost`)),
    k('Acquisition cost', compact(P.cost), `${P.count} assets`),
    k('Net operating income', compact(P.noi), `Annual · ${P.earningCount} income assets`),
    k('Portfolio NOI yield', pct1(P.noiYield), 'NOI ÷ est. value of income assets'));
  dotMap(document.getElementById('hero-map'), { selectedId: 'austin', label: 'Sample portfolio map' });
  const a = FEATURED;
  clear(document.getElementById('hero-sel')).append(assetCard(a, { compactCard: true }));
  clear(document.getElementById('hero-list')).append(
    h('div', { class: 'lh' }, h('b', {}, 'Assets'), h('span', {}, 'Value')),
    ...ASSETS.filter(x => x.earning || x.id === 'teterboro').slice(0, 5).map(x => h('div', { class: 'li' + (x.id === 'austin' ? ' on' : '') },
      icon(x.category, 15), h('span', {}, x.name), h('b', {}, compact(x.value)))));
}

/* -------------------------------------------------------------- problem */
{
  const u = clear(document.getElementById('unified'));
  u.append(h('div', { class: 'u-head' }, h('b', {}, 'ATLAS'), h('span', {}, 'Unified view')),
    h('div', { class: 'u-kpi' }, h('span', {}, 'Portfolio value'), h('b', {}, money(P.value))),
    ...ASSETS.slice(0, 3).map(x => h('div', { class: 'u-row' }, icon(x.category, 14), h('span', {}, x.name), h('b', {}, compact(x.value)))));
  const lt = document.getElementById('layer-top');
  lt.textContent = `${compact(P.value)} · ${pct1(P.noiYield)} NOI yield`;
  const base = document.querySelector('.layer.base b');
  base.textContent = `${P.count} assets · ${new Set(ASSETS.map(x => x.category)).size} categories`;
}

/* ---------------------------------------------------------- map demo */
{
  const state = { sel: 'austin', filter: null, view: 'map' };
  const mapHost = document.getElementById('demo-map'), listHost = document.getElementById('demo-list');
  const panel = document.getElementById('demo-panel'), filterHost = document.getElementById('map-filter');
  const visible = () => ASSETS.filter(a => !state.filter || a.category === state.filter);

  const renderPanel = () => {
    const a = byId(state.sel);
    clear(panel).append(
      h('div', { class: 'pn-h' }, h('span', { class: 'ac-ico' }, icon(a.category, 18)), h('div', {}, h('b', {}, a.name), h('span', {}, `${a.place} · ${a.kind}`))),
      h('dl', { class: 'pn-grid' },
        h('div', {}, h('dt', {}, 'Estimated value'), h('dd', {}, money(a.value))),
        h('div', {}, h('dt', {}, 'Acquisition cost'), h('dd', {}, money(a.cost))),
        h('div', {}, h('dt', {}, 'Vs. cost'), h('dd', {}, Delta(a.appreciation, `${fmtSigned(a.appreciation, { compact: true })} · ${fmtPct(a.appreciationPct, { sign: true })}`))),
        h('div', {}, h('dt', {}, a.earning ? 'NOI yield' : 'Annual expenses'), h('dd', {}, a.earning ? pct1(a.noiYield) : money(a.expenses))),
        h('div', {}, h('dt', {}, 'Status'), h('dd', {}, statusDot(a.status)))),
      h('p', { class: 'ac-foot' }, `Valued ${VALUATION_DATE} · sample data`));
  };
  const select = id => { state.sel = id; render(); };
  const render = () => {
    if (!visible().some(a => a.id === state.sel)) state.sel = visible()[0]?.id ?? state.sel;
    dotMap(mapHost, { selectedId: state.sel, onSelect: select, interactive: true, filter: state.filter, label: 'Interactive sample portfolio map. Select a marker to view an asset.' });
    clear(listHost).append(h('ul', { class: 'rows' }, visible().map(a => h('li', {}, h('button', {
      type: 'button', class: a.id === state.sel ? 'on' : '', 'aria-pressed': String(a.id === state.sel), onclick: () => select(a.id),
    }, icon(a.category, 18), h('span', {}, h('b', {}, a.name), h('em', {}, a.place)), h('strong', {}, compact(a.value)))))));
    renderPanel();
    filterHost.querySelectorAll('button').forEach(b => { const on = (b.dataset.k || null) === state.filter; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  };
  const cats = [...new Set(ASSETS.map(a => a.category))];
  filterHost.append(h('button', { type: 'button', class: 'on', 'aria-pressed': 'true', onclick: () => { state.filter = null; render(); } }, 'All'),
    ...cats.map(c => h('button', { type: 'button', 'data-k': c, 'aria-pressed': 'false', onclick: () => { state.filter = c; render(); } }, CATEGORIES[c])));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    document.querySelectorAll('[data-view]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    mapHost.hidden = state.view !== 'map'; listHost.hidden = state.view !== 'list';
  }));
  render();
}

/* ------------------------------------------------------------- charts */
function valuationChart(host, series, { label }) {
  clear(host);
  const W = 640, H = 250, m = { t: 14, r: 16, b: 28, l: 60 };
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
  const idxs = series.length > 4 ? [0, Math.floor((series.length - 1) / 2), series.length - 1] : series.map((_, i) => i);
  idxs.forEach(i => svg.append(s('text', { x: X(i), y: H - 8, class: 'ax', 'text-anchor': i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle' }, series[i].label)));
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
  const W = 640, H = 250, m = { t: 14, r: 12, b: 28, l: 52 };
  const max = Math.max(...WESTLAKE_INCOME, ...WESTLAKE_EXPENSES) * 1.1;
  const Y = v => H - m.b - (v / max) * (H - m.t - m.b);
  const slot = (W - m.l - m.r) / 12, bw = slot * 0.3;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lc', role: 'img',
    'aria-label': `Monthly rental income versus operating expenses, ${WESTLAKE_MONTHS[0]} to ${WESTLAKE_MONTHS.at(-1)}. Income is ${money(WESTLAKE_INCOME[0])} each month; expenses range from ${money(Math.min(...WESTLAKE_EXPENSES))} to ${money(Math.max(...WESTLAKE_EXPENSES))}.` });
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
  const chartHost = h('div', { class: 'chart-host' });
  const host = clear(document.getElementById('fin'));
  host.append(
    h('div', { class: 'fin-main' },
      h('div', { class: 'fin-head' }, h('div', {}, h('b', {}, a.name), h('span', {}, `${a.place} · ${a.kind}`)), h('span', { class: 'chip' }, 'Sample data')),
      h('div', { class: 'tiles' },
        tile('Estimated value', money(a.value), `Valued ${VALUATION_DATE}`, 'hero'),
        tile('Acquisition cost', money(a.cost), 'Purchase price'),
        tile('Appreciation', Delta(a.appreciation, fmtSigned(a.appreciation)), `${fmtPct(a.appreciationPct, { sign: true })} vs. cost`, 'pos-t'),
        tile('Gross rental income', money(a.gross), 'Last 12 months'),
        tile('Operating expenses', money(a.expenses), 'Last 12 months'),
        tile('Net operating income', money(a.noi), 'Income − expenses'),
        tile('NOI yield', pct1(a.noiYield), 'NOI ÷ estimated value', 'blue'),
        tile('Gross yield', pct1(a.grossYield), 'Gross income ÷ estimated value (before expenses)', 'gy')),
      h('div', { class: 'chart-card' }, h('div', { class: 'chart-t' }, h('b', {}, 'Valuation history'), h('span', {}, 'Estimated value over time')), chartHost)),
    h('aside', { class: 'defs' }, h('h3', {}, 'Metrics, defined'),
      h('dl', {},
        h('dt', {}, 'Appreciation'), h('dd', {}, 'Estimated value minus acquisition cost. A change in value, not income.'),
        h('dt', {}, 'Net operating income'), h('dd', {}, 'Gross income minus operating expenses, before financing and taxes.'),
        h('dt', {}, 'NOI yield'), h('dd', {}, 'NOI divided by estimated value.'),
        h('dt', {}, 'Gross yield'), h('dd', {}, 'Gross income divided by estimated value, before expenses.')),
      h('p', { class: 'fine' }, 'Cash-on-cash and total return require financing and sale data, so they are shown separately—never mixed with yield.')));
  valuationChart(chartHost, WESTLAKE_VALUATIONS, { label: 'Valuation history for Westlake Residence' });
}

/* -------------------------------------------------------- performance */
{
  const host = clear(document.getElementById('perf'));
  const ranges = { '1Y': 3, '3Y': 7, All: WESTLAKE_VALUATIONS.length };
  const chartHost = h('div', { class: 'chart-host' }), flowHost = h('div', { class: 'chart-host' });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Time period' });
  const summary = h('span', { class: 'sum' });
  const setRange = k => {
    const pts = WESTLAKE_VALUATIONS.slice(-ranges[k]);
    valuationChart(chartHost, pts, { label: `Valuation history, ${k}` });
    const ch = pts.at(-1).v - pts[0].v;
    summary.replaceChildren(Delta(ch, `${fmtSigned(ch)} (${fmtPct(ch / pts[0].v, { sign: true })})`), ` since ${pts[0].label}`);
    seg.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.textContent === k); b.setAttribute('aria-pressed', String(b.textContent === k)); });
  };
  Object.keys(ranges).forEach(k => seg.append(h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setRange(k) }, k)));
  flowChart(flowHost);
  const rank = [...ASSETS].sort((x, y) => y.appreciationPct - x.appreciationPct);
  const maxAbs = Math.max(...rank.map(r => Math.abs(r.appreciationPct)));
  const net = ASSETS.find(x => x.id === 'austin').noi;
  host.append(
    h('div', { class: 'chart-card wide' }, h('div', { class: 'chart-t' }, h('div', {}, h('b', {}, 'Valuation history'), h('span', {}, 'Westlake Residence · estimated value')), seg), summary, chartHost),
    h('div', { class: 'chart-card' }, h('div', { class: 'chart-t' }, h('div', {}, h('b', {}, 'Income vs. expenses'), h('span', {}, `Westlake Residence · NOI ${money(net)} over 12 months`))),
      h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'li-inc' }), 'Rental income'), h('span', {}, h('i', { class: 'li-exp' }), 'Operating expenses')), flowHost,
      h('p', { class: 'fine' }, 'February includes a one-time repair, shown as a spike in expenses.')),
    h('div', { class: 'chart-card' }, h('div', { class: 'chart-t' }, h('div', {}, h('b', {}, 'Performance by asset'), h('span', {}, 'Estimated value vs. acquisition cost'))),
      h('ul', { class: 'rank' }, rank.map(r => {
        const t = tone(r.appreciationPct, 1e-6);
        return h('li', {}, h('span', { class: 'rn' }, r.name), h('span', { class: 'rb', 'aria-hidden': 'true' }, h('i', { class: t, style: `width:${(Math.abs(r.appreciationPct) / maxAbs) * 50}%;${r.appreciationPct < 0 ? 'right' : 'left'}:50%` })),
          h('b', { class: t }, fmtPct(r.appreciationPct, { sign: true })));
      }))));
  setRange('All');
}

/* ------------------------------------------------------------- profile */
{
  const a = FEATURED, host = clear(document.getElementById('profile'));
  const house = s('svg', { viewBox: '0 0 400 220', class: 'house', role: 'img', 'aria-label': 'Illustration of a single-family residence' },
    s('rect', { width: 400, height: 220, fill: '#EFF6FF' }), s('path', { d: 'M0 186h400v34H0z', fill: '#DBEAFE' }),
    s('path', { d: 'M70 186V96l90-52 90 52v90z', fill: '#fff', stroke: '#0B1736', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
    s('path', { d: 'M52 104L160 42l108 62', fill: 'none', stroke: '#2563EB', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    s('path', { d: 'M250 186V120h80v66', fill: '#fff', stroke: '#0B1736', 'stroke-width': 2.5 }), s('path', { d: 'M240 120l50-30 50 30', fill: 'none', stroke: '#2563EB', 'stroke-width': 4, 'stroke-linecap': 'round' }),
    s('rect', { x: 128, y: 130, width: 34, height: 56, fill: '#BFDBFE', stroke: '#0B1736', 'stroke-width': 2 }),
    s('rect', { x: 90, y: 104, width: 26, height: 26, fill: '#DBEAFE', stroke: '#0B1736', 'stroke-width': 2 }), s('rect', { x: 188, y: 104, width: 26, height: 26, fill: '#DBEAFE', stroke: '#0B1736', 'stroke-width': 2 }),
    s('rect', { x: 262, y: 138, width: 24, height: 24, fill: '#DBEAFE', stroke: '#0B1736', 'stroke-width': 2 }), s('path', { d: 'M20 186h360', stroke: '#0B1736', 'stroke-width': 2.5 }));
  const docs = ['Purchase agreement', 'Lease — current tenant', 'Insurance policy', 'Appraisal — Sep 2026'];
  host.append(
    h('article', { class: 'prof-main' },
      h('div', { class: 'prof-img' }, house, h('span', { class: 'chip' }, 'Illustration')),
      h('div', { class: 'prof-body' },
        h('div', { class: 'prof-head' }, h('div', {}, h('h3', {}, a.name), h('p', {}, `${a.place} · ${a.kind}`)), statusDot(a.status)),
        h('dl', { class: 'prof-grid' },
          h('div', {}, h('dt', {}, 'Estimated value'), h('dd', {}, money(a.value))), h('div', {}, h('dt', {}, 'Acquisition cost'), h('dd', {}, money(a.cost))),
          h('div', {}, h('dt', {}, 'Rental income'), h('dd', {}, `${money(a.gross)}/yr`)), h('div', {}, h('dt', {}, 'Operating expenses'), h('dd', {}, `${money(a.expenses)}/yr`)),
          h('div', {}, h('dt', {}, 'NOI yield'), h('dd', {}, pct1(a.noiYield))), h('div', {}, h('dt', {}, 'Owner'), h('dd', {}, 'Westlake Holdings LLC'))),
        h('div', { class: 'docs' }, h('b', {}, 'Documents'), h('ul', {}, docs.map(d => h('li', {}, s('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true', class: 'ico' }, s('path', { d: 'M4 1.500h5l3 3V14.500H4zM9 1.500v3h3' })), d)))))),
    h('div', { class: 'prof-side' },
      h('p', { class: 'mini' }, 'Other asset types, same structure'),
      ...['lisbon', 'nashville', 'teterboro'].map(id => assetCard(byId(id), { compactCard: true }))));
}

/* ------------------------------------------------------------- reports */
{
  const host = clear(document.getElementById('reports'));
  const top = [...ASSETS].sort((x, y) => y.value - x.value).slice(0, 5);
  const alloc = Object.entries(ASSETS.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + x.value), m), {})).sort((p, q) => q[1] - p[1]);
  host.append(
    h('div', { class: 'paper', role: 'img', 'aria-label': 'Preview of a portfolio summary report page with sample data' },
      h('div', { class: 'pp-h' }, h('b', {}, 'ATLAS'), h('span', {}, `Portfolio summary · ${VALUATION_DATE}`)),
      h('div', { class: 'pp-kpis' }, h('div', {}, h('em', {}, 'Value'), h('b', {}, compact(P.value))), h('div', {}, h('em', {}, 'Cost'), h('b', {}, compact(P.cost))), h('div', {}, h('em', {}, 'NOI'), h('b', {}, compact(P.noi))), h('div', {}, h('em', {}, 'NOI yield'), h('b', {}, pct1(P.noiYield)))),
      h('div', { class: 'pp-alloc' }, alloc.map(([k, v]) => h('span', { style: `flex:${v}`, title: `${CATEGORIES[k]} ${pct1(v / P.value)}` }))),
      h('ul', { class: 'pp-leg' }, alloc.slice(0, 4).map(([k, v]) => h('li', {}, CATEGORIES[k], h('b', {}, pct1(v / P.value))))),
      h('table', {}, h('thead', {}, h('tr', {}, ['Asset', 'Location', 'Value'].map(t => h('th', {}, t)))), h('tbody', {}, top.map(x => h('tr', {}, h('td', {}, x.name), h('td', {}, x.place), h('td', {}, compact(x.value))))))),
    h('div', { class: 'sheet', role: 'img', 'aria-label': 'Preview of a spreadsheet export with sample data' },
      h('div', { class: 'sh-bar' }, h('i', {}), h('span', {}, 'atlas-assets.xlsx')),
      h('table', {}, h('thead', {}, h('tr', {}, ['', 'A · Asset', 'B · Cost', 'C · Value', 'D · NOI'].map(t => h('th', {}, t)))),
        h('tbody', {}, ASSETS.slice(0, 7).map((x, i) => h('tr', {}, h('th', {}, i + 1), h('td', {}, x.name), h('td', { class: 'r' }, x.cost.toLocaleString('en-US')), h('td', { class: 'r' }, x.value.toLocaleString('en-US')), h('td', { class: 'r' }, x.earning ? x.noi.toLocaleString('en-US') : '—')))))),
    h('p', { class: 'fine rep-note' }, 'Preview of planned report layouts. The current app preview exports portfolio data as CSV and JSON; PDF and Excel reports are on the roadmap. Reports are for your own analysis and are not tax, audit, or accounting documents.'));
}

/* ----------------------------------------------------------- categories */
{
  const names = { residential: 'Residential real estate', commercial: 'Commercial real estate', vehicle: 'Vehicles', vessel: 'Boats & yachts', aircraft: 'Aircraft', equipment: 'Equipment' };
  const blurb = { residential: 'Homes, condos, and rentals', commercial: 'Offices and retail space', vehicle: 'Cars and commercial trucks', vessel: 'Motor and sailing yachts', aircraft: 'Jets and light aircraft', equipment: 'Heavy and industrial equipment' };
  clear(document.getElementById('cats')).append(...Object.keys(names).map(k => {
    const n = ASSETS.filter(a => a.category === k);
    return h('li', {}, icon(k, 30), h('b', {}, names[k]), h('span', {}, blurb[k]), h('em', {}, `${n.length} in sample · ${compact(n.reduce((t, x) => t + x.value, 0))}`));
  }));
}

/* ------------------------------------------------------------ how steps */
{
  const a = FEATURED;
  clear(document.getElementById('step-numbers')).append(
    h('div', { class: 'f-row' }, h('span', {}, 'Estimated value'), h('em', {}, money(a.value))), h('div', { class: 'f-row' }, h('span', {}, 'NOI'), h('em', {}, money(a.noi))), h('div', { class: 'f-row' }, h('span', {}, 'NOI yield'), h('em', {}, pct1(a.noiYield))));
  const peers = ASSETS.filter(x => x.earning), mx = Math.max(...peers.map(x => x.noiYield));
  clear(document.getElementById('step-compare')).append(h('div', { class: 'f-cap' }, 'NOI yield by income asset'),
    ...peers.map(x => h('div', { class: 'f-bar' }, h('span', {}, x.name), h('i', { style: `width:${(x.noiYield / mx) * 100}%` }), h('b', {}, pct1(x.noiYield)))));
}

/* ----------------------------------------------------------------- FAQ */
{
  const QA = [
    ['What is ATLAS?', 'ATLAS is a platform for organizing, visualizing, and analyzing physical asset portfolios in one place.'],
    ['What types of assets can I track?', 'ATLAS is designed to support real estate and other tangible assets, including vehicles, vessels, aircraft, and equipment. Available fields and analytical capabilities may vary by asset category.'],
    ['Can I see my assets on a global map?', 'The platform is designed to provide a geographic view of your assets, helping you explore their locations and understand how your portfolio is distributed.'],
    ['Can I track income and expenses?', 'ATLAS is designed to organize asset-related income and expenses and use available financial records to calculate portfolio metrics.'],
    ['Can I track changes in asset value?', 'You can organize valuation records and review valuation history. The reliability of an estimated value depends on its source, date, and supporting information.'],
    ['Can I export my portfolio data?', 'The current app preview can export portfolio data as CSV and as a JSON backup. PDF and Excel reports are planned but not yet available.'],
    ['Is ATLAS only for real estate investors?', 'No. The platform is designed to support diversified portfolios of tangible assets, with a strong initial focus on real estate.'],
    ['Is ATLAS suitable for family offices?', 'ATLAS is designed with multi-asset portfolio visibility in mind. Suitability for specific family-office workflows depends on the organization’s reporting, permissions, and operational requirements.'],
    ['Does ATLAS automatically determine market values?', 'Estimated values depend on the data and valuation sources available. ATLAS should distinguish user-entered valuations, imported data, third-party estimates, and calculated metrics. It does not guarantee the accuracy of any estimate.'],
    ['How can I get access?', 'Submit the early-access form to express your interest and receive information about availability.'],
  ];
  const host = clear(document.getElementById('faq-list'));
  QA.forEach(([q, a], i) => {
    const btn = h('button', { type: 'button', class: 'q', id: `q${i}`, 'aria-expanded': 'false', 'aria-controls': `a${i}` }, h('span', {}, q), h('i', { 'aria-hidden': 'true' }));
    const panel = h('div', { class: 'a', id: `a${i}`, role: 'region', 'aria-labelledby': `q${i}`, hidden: true }, h('p', {}, a));
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open)); panel.hidden = open;
      if (!open) analytics.track('faq_expand', { question_index: i });
    });
    btn.addEventListener('keydown', e => {
      const all = [...host.querySelectorAll('.q')], at = all.indexOf(btn);
      const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : null;
      if (to != null) { e.preventDefault(); all[(to + all.length) % all.length].focus(); }
    });
    host.append(h('div', { class: 'qa' }, h('h3', {}, btn), panel));
  });
}

/* --------------------------------------------------------------- form */
{
  const form = document.getElementById('ea-form'), status = document.getElementById('ea-status'), btn = document.getElementById('ea-submit');
  const sel = (id, map, first) => document.getElementById(id).replaceChildren(h('option', { value: '' }, first), ...Object.entries(map).map(([k, v]) => h('option', { value: k }, v)));
  sel('f-size', PORTFOLIO_SIZES, 'Select a range'); sel('f-inv', INVESTOR_TYPES, 'Select (optional)');
  document.getElementById('f-types').append(...Object.entries(ASSET_TYPES).map(([k, v]) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', name: 'assetTypes', value: k }), h('span', {}, v))));

  let started = false, inflight = false;
  form.addEventListener('focusin', () => { if (!started) { started = true; analytics.track('early_access_form_start'); } });

  const showErrors = errors => {
    ['email', 'firstName', 'portfolioSize', 'assetTypes', 'consent'].forEach(k => {
      const el = document.getElementById('e-' + k); el.textContent = errors[k] || '';
      const input = form.elements[k]; const nodes = input instanceof RadioNodeList ? [...input] : input ? [input] : [];
      nodes.forEach(n => (errors[k] ? n.setAttribute('aria-invalid', 'true') : n.removeAttribute('aria-invalid')));
    });
    const firstKey = Object.keys(errors)[0];
    if (firstKey) { const f = form.elements[firstKey]; (f instanceof RadioNodeList ? f[0] : f)?.focus(); }
  };
  const setBusy = on => { inflight = on; btn.disabled = on; btn.setAttribute('aria-busy', String(on)); btn.classList.toggle('busy', on); btn.querySelector('.lbl').textContent = on ? 'Submitting…' : 'Get Early Access'; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (inflight) return;
    status.textContent = ''; status.className = 'form-status';
    const fd = new FormData(form);
    const raw = { email: fd.get('email'), firstName: fd.get('firstName'), portfolioSize: fd.get('portfolioSize'), assetTypes: fd.getAll('assetTypes'),
      investorType: fd.get('investorType'), consent: fd.get('consent') === 'on', website: fd.get('website'), source: 'landing' };
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
        form.replaceChildren(h('div', { class: 'done', tabindex: -1, role: 'status' }, h('div', { class: 'tick', 'aria-hidden': 'true' }, '✓'), h('h3', {}, `Thanks, ${v.value.first_name}. You’re on the list.`),
          h('p', {}, 'We’ve recorded your request. We’ll email you at the address you provided when we have information about early-access availability.')));
        form.querySelector('.done').focus();
        return;
      }
      if (r.status === 422 && data.errors) { showErrors(data.errors); analytics.track('early_access_form_error', { reason: 'validation' }); return; }
      const msg = r.status === 503 ? 'Early-access sign-up isn’t available yet because the server isn’t configured. Nothing was saved. Please try again later.'
        : 'We couldn’t save your request. Nothing was submitted—please try again in a moment.';
      status.textContent = msg; status.classList.add('bad');
      analytics.track('early_access_form_error', { reason: String(r.status) });
    } catch {
      status.textContent = 'We couldn’t reach the server. Check your connection and try again. Nothing was submitted.'; status.classList.add('bad');
      analytics.track('early_access_form_error', { reason: 'network' });
    } finally { if (form.contains(btn)) setBusy(false); }
  });
}

/* ------------------------------------------------- nav, CTA tracking, motion */
{
  const header = document.querySelector('.site-header'), nav = document.getElementById('nav'), mb = document.getElementById('menu-btn');
  const setMenu = open => {
    nav.classList.toggle('open', open); mb.setAttribute('aria-expanded', String(open)); mb.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('lock', open);
    if (open) nav.querySelector('a').focus(); else if (document.activeElement && nav.contains(document.activeElement)) mb.focus();
  };
  mb.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => {
    if (!nav.classList.contains('open')) return;
    if (e.key === 'Escape') { setMenu(false); mb.focus(); return; }
    if (e.key === 'Tab') {
      const f = [mb, ...nav.querySelectorAll('a')], i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  matchMedia('(min-width: 900px)').addEventListener('change', q => { if (q.matches) setMenu(false); });
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-cta]');
    if (c) analytics.track(c.dataset.cta === 'primary' ? 'primary_cta_click' : 'secondary_cta_click', { where: c.dataset.where || '' });
    if (c && c.getAttribute('href') === '#early-access') setTimeout(() => document.getElementById('f-email')?.focus({ preventScroll: true }), reduceMotion ? 0 : 600);
  });

  const targets = document.querySelectorAll('.sec-head, .demo-card, .fin, .perf, .profile, .reports, .cats, .steps, .aud, .compare, .faq, .layers, .converge, .narrow > *');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(t => { t.setAttribute('data-reveal', ''); io.observe(t); });
  }
}
