// Shared UI pieces used by the marketing preview and by the real app, so both look and behave identically.
import { h, s, clear } from './dom.js';
import { fmtPct, fmtSigned, tone } from './calc.js';
import { TYPE_BY_KEY, STATUS_TONE } from './types.js';
import { formatIn } from './fx.js';

export { h, s, clear };
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const USDc = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
export const money = n => USD0.format(n);
export const compact = n => USDc.format(n);
export function pct1(n) { return n == null ? '–' : (n * 100).toFixed(1) + '%'; }
// Stamped with the viewer's current date so "as of" labels are never stale.
export const TODAY = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Provider-agnostic. Nothing is sent unless (a) a consent banner has set window.atlasConsent = true
// and (b) a provider (Plausible or gtag) is present on the page. Never pass financial data as props.
export const analytics = {
  track(name, props = {}) {
    if (window.atlasConsent !== true) return;
    try {
      if (typeof window.plausible === 'function') window.plausible(name, { props });
      else if (typeof window.gtag === 'function') window.gtag('event', name, props);
    } catch { /* analytics must never break the page */ }
  },
};

export const ICON = {
  residential: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-6h6v6',
  commercial: 'M4 21V5l8-2v18M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2',
  land: 'M3 18l5-8 4 5 3-4 6 7z',
  vehicle: 'M3 16V9h11v7M14 11h4l3 3v2h-3M5 18.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M16 18.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0',
  vessel: 'M3 15h18l-3 5H6zM12 3v12M12 4l6 9h-6',
  aircraft: 'M12 2l2 7 8 4v2l-8-2v5l3 2v1l-5-1-5 1v-1l3-2v-5l-8 2v-2l8-4z',
  equipment: 'M4 19h12M6 19v-4h8v4M10 15V9l6-5M16 4l3 6',
};
export const icon = (key, size = 22) => s('svg', { viewBox: '0 0 24 24', width: size, height: size, class: 'ico', 'aria-hidden': 'true' }, s('path', { d: ICON[key] }));
export const ASSET_IMG = { austin: 'house', miami: 'house', chicago: 'house', london: 'commercial', seattle: 'land', scottsdale: 'porsche', nashville: 'truck', teterboro: 'jet',
  sttropez: 'yacht', sydney: 'house', denver: 'excavator', boston: 'parking', columbus: 'industrial', moab: 'rv', sturgis: 'moto', newport: 'sail', keywest: 'jetski' };
/** 3D illustration of the asset (by its type, or by id for the sample portfolio), otherwise the category icon. */
export const thumb = (a, size = 22) => {
  const img = (a.type && TYPE_BY_KEY[a.type]?.img) || ASSET_IMG[a.id];
  return img
    ? h('img', { class: 'thumb', src: `assets/collection/thumb/${img}.jpg`, width: size, height: size, alt: '', loading: 'lazy', decoding: 'async' })
    : icon(a.category, Math.round(size * 0.62));
};

export const Delta = (n, text) => {
  const t = tone(n, 0.5);
  return h('span', { class: `delta ${t}` }, h('span', { 'aria-hidden': 'true' }, t === 'pos' ? '▲' : t === 'neg' ? '▼' : '■'), text ?? fmtSigned(n),
    h('span', { class: 'sr' }, t === 'pos' ? ' (gain)' : t === 'neg' ? ' (loss)' : ''));
};
export const statusDot = st => h('span', { class: 'st st-' + (STATUS_TONE[st] || 'idle') }, st);

export function assetCard(a) {
  return h('div', { class: 'asset-card' },
    h('div', { class: 'ac-top' }, h('span', { class: 'ac-ico' }, thumb(a, 34)), h('div', {}, h('b', {}, a.name), h('span', {}, `${a.place} · ${a.kind}`)), statusDot(a.status)),
    (a.shared || a.owner) ? h('p', { class: 'ac-own' }, a.shared ? `You own ${a.ownership}% of ${money(a.fullValue)}` : 'Owner', a.owner ? ` · ${a.owner}` : '') : null,
    (a.currency && a.currency !== 'USD') || a.annualChange ? h('p', { class: 'ac-own ac-cur' }, a.currency && a.currency !== 'USD' ? (a.fxMissing ? `Entered in ${a.currency} (no exchange rate available)` : `Entered in ${a.currency}: ${formatIn(a.localValue, a.currency)}`) : '', a.currency && a.currency !== 'USD' && a.annualChange ? ' · ' : '', a.annualChange ? `moves ${a.annualChange > 0 ? '+' : ''}${a.annualChange}% a year` : '') : null,
    h('dl', { class: 'ac-grid' },
      h('div', {}, h('dt', {}, a.shared ? 'Your share of value' : 'Estimated value'), h('dd', {}, money(a.value))),
      h('div', {}, h('dt', {}, 'Acquisition cost'), h('dd', {}, money(a.cost))),
      a.earning
        ? h('div', {}, h('dt', {}, 'NOI yield'), h('dd', {}, pct1(a.noiYield)))
        : h('div', {}, h('dt', {}, 'Annual expenses'), h('dd', {}, money(a.expenses))),
      h('div', {}, h('dt', {}, 'Vs. cost'), h('dd', {}, Delta(a.appreciation, fmtPct(a.appreciationPct, { sign: true }))))));
}

export function sparkline(host, series, name = 'Asset') {
  clear(host);
  const W = 260, H = 64, m = 4;
  const ys = series.map(p => p.v), lo = Math.min(...ys), hi = Math.max(...ys);
  const X = i => m + (i / (series.length - 1)) * (W - 2 * m), Y = v => H - m - ((v - lo) / (hi - lo || 1)) * (H - 2 * m);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  host.append(s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'spark', role: 'img', 'aria-label': `${name} estimated value, ${series[0].label} ${money(series[0].v)} to ${series.at(-1).label} ${money(series.at(-1).v)}` },
    s('path', { d: `${line}L${X(series.length - 1)} ${H}L${X(0)} ${H}Z`, class: 'ar' }), s('path', { d: line, class: 'ln' }),
    s('circle', { cx: X(series.length - 1), cy: Y(ys.at(-1)), r: 4, class: 'pt' })));
}

/* Hover that glides along a line chart (eased cursor), while the readout still snaps to real data points. */
export function trackHover(svg, { W, H, m, series, X, Y, guide, dot, tip, onPoint, onLeave }) {
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

export function valuationChart(host, series, { label, absDelta = false }) {
  clear(host);
  const W = 640, H = 270, m = { t: 16, r: 18, b: 28, l: 58 };
  const ys = series.map(p => p.v);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const allPositive = lo >= 0, pad = (hi - lo) * 0.15 || hi * 0.05; lo -= pad; hi += pad; if (allPositive) lo = Math.max(0, lo);
  const X = i => m.l + (series.length === 1 ? 0 : (i / (series.length - 1)) * (W - m.l - m.r));
  const Y = v => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  const read = h('div', { class: 'fc-read' });
  const setRead = p => read.replaceChildren(h('b', {}, money(p.v)), Delta(p.v - series[0].v, `${series[0].v && !absDelta ? fmtPct((p.v - series[0].v) / series[0].v, { sign: true }) : fmtSigned(p.v - series[0].v, { compact: true })} since ${series[0].label}`), h('span', { class: 'when' }, p.label));
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

