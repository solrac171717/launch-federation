import { h, s, clear, money, compact, pct1, TODAY, ICON, icon, thumb, Delta, statusDot, assetCard, valuationChart, trackHover, analytics } from './src/ui.js';
import { fmtPct, fmtSigned, tone } from './src/calc.js';
import {
  ASSETS, CATEGORIES, WESTLAKE_MONTHS, WESTLAKE_INCOME, WESTLAKE_EXPENSES,
  WESTLAKE_VALUATIONS, portfolio, byId,
} from './src/demo-data.js';
import { createGlobe } from './src/globe.js';
import { attachGeo } from './src/geoui.js';
import { mountDashboard } from './src/dashboard.js';
import { mountAutofillDemo } from './src/autofill-demo.js';

document.documentElement.classList.add('js');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FEATURED = byId('austin');
const P = portfolio(ASSETS);
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
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

/* ------------------------------------------------------------------ hero dashboard (the same dashboard the app uses, on sample data) */
mountDashboard({ getAssets: () => ASSETS, sample: true, csvName: 'owned-map-sample-assets.csv', globeLabel: 'Rotating 3D globe of sample assets' });

/* ---------------------------------------------------------- globe section */
{
  const state = { sel: 'austin', filter: null };
  const card = document.getElementById('globe-card'), list = document.getElementById('globe-list'), filterHost = document.getElementById('map-filter');
  const visible = () => ASSETS.filter(a => !state.filter || a.category === state.filter);
  const globe = createGlobe(document.getElementById('globe-main'), { assets: ASSETS, icons: ICON, selectedId: state.sel, startLon: -96, tilt: 22, countryPadV: 70,
    label: 'Rotating 3D globe of sample asset locations', onSelect: id => select(id, true) });
  const geo = attachGeo(document.getElementById('globe-main'), globe, { visible, all: () => ASSETS, lookup: byId, selected: () => state.sel, onPick: (id, f) => select(id, f), onChange: () => render() });
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
    h('div', { class: 'pp-top' }, h('div', { class: 'pp-brand' }, h('i', {}), 'OWNED MAP'), h('span', {}, 'Portfolio summary')),
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
    h('div', { class: 'xl-top' }, h('span', { class: 'xl-logo' }, 'X'), h('b', {}, 'owned-map-assets.xlsx'), h('span', { class: 'xl-saved' }, 'Sample data')),
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

/* ------------------------------------------------- document autofill demo */
{
  const root = document.getElementById('af-demo');
  if (root) mountAutofillDemo(root, { reduceMotion });
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
  const targets = document.querySelectorAll('.sec-head, .globe-stage, .fin, .collection, .reports, .quote-card, .af-demo');
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
{
  const BASE = 47, INCLUDED = 3, EXTRA = 15;
  const range = document.getElementById('px-range');
  if (range) {
    const total = document.getElementById('px-total'), count = document.getElementById('px-count');
    const mqr = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let shown = BASE, raf = 0;
    const price = n => BASE + Math.max(0, n - INCLUDED) * EXTRA;
    const paint = v => { total.textContent = USD0.format(Math.round(v)); };
    const update = () => {
      const n = +range.value, p = price(n);
      const go = document.querySelector('.px-btn'); if (go) go.setAttribute('href', n === INCLUDED ? '/api/start' : `/api/start?assets=${n}`); // the button opens checkout for the number of assets on the slider
      const pct = ((n - range.min) / (range.max - range.min)) * 100; range.style.setProperty('--p', `${pct}%`);
      const bub = document.getElementById('px-bubble'); bub.style.setProperty('--q', pct.toFixed(2)); bub.textContent = String(n);
      range.setAttribute('aria-valuetext', `${n} assets, ${USD0.format(p)} per month`);
      count.textContent = String(n); document.getElementById('px-feat-n').textContent = String(n); document.getElementById('px-unit').textContent = n === 1 ? 'asset' : 'assets';
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
