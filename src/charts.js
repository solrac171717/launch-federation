import { h, s, clear } from './dom.js';
import { fmtMoney, fmtPct, tone } from './calc.js';

const fmtDate = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

/**
 * Line/area chart over real [{t, v}] points with a pointer + keyboard crosshair.
 * Returns false (and draws nothing) when there are fewer than two points.
 */
export function lineChart(host, series, opts = {}) {
  host._ro?.disconnect();
  clear(host);
  if (!series || series.length < 2) return false;
  let lastW = 0;
  host._ro = new ResizeObserver(() => {
    const w = Math.round(host.clientWidth);
    if (w && Math.abs(w - lastW) > 24) draw(w);
  });
  host._ro.observe(host);
  draw(Math.round(host.clientWidth) || 720);
  return true;

  function draw(W) {
    lastW = W;
    renderLine(host, series, W, opts);
  }
}

function renderLine(host, series, W, { label = 'Value over time', height = 240 } = {}) {
  clear(host);
  const H = height, m = { t: 12, r: 12, b: 26, l: 64 };
  const xs = series.map(p => p.t), ys = series.map(p => p.v);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.12 || Math.abs(y1) * 0.05 || 1;
  y0 -= pad; y1 += pad;
  const X = t => m.l + ((t - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
  const Y = v => H - m.b - ((v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);
  const dir = tone(ys[ys.length - 1] - ys[0], 1e-12);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${X(x1)},${H - m.b}L${X(x0)},${H - m.b}Z`;
  const gid = 'g' + Math.random().toString(36).slice(2, 8);

  const grid = [0, 1, 2, 3].map(i => {
    const v = y0 + ((y1 - y0) * i) / 3, y = Y(v);
    return [s('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'grid' }),
      s('text', { x: m.l - 8, y: y + 4, class: 'axis', 'text-anchor': 'end' }, fmtMoney(v, { compact: true }))];
  });
  const ticks = [0, 0.5, 1].map(f => {
    const t = x0 + (x1 - x0) * f;
    return s('text', { x: X(t), y: H - 6, class: 'axis', 'text-anchor': f === 0 ? 'start' : f === 1 ? 'end' : 'middle' }, fmtDate(t));
  });

  const dot = s('circle', { r: 4.5, class: 'dot', visibility: 'hidden' });
  const cross = s('line', { y1: m.t, y2: H - m.b, class: 'cross', visibility: 'hidden' });
  const tip = h('div', { class: 'chart-tip', hidden: true, role: 'status' });
  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`, class: `chart line ${dir}`, role: 'img', tabindex: 0,
    'aria-label': `${label}: from ${fmtMoney(ys[0])} to ${fmtMoney(ys[ys.length - 1])}. Use left and right arrow keys to inspect points.`,
  },
  s('defs', {}, s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
    s('stop', { offset: '0%', 'stop-color': 'currentColor', 'stop-opacity': 0.28 }),
    s('stop', { offset: '100%', 'stop-color': 'currentColor', 'stop-opacity': 0 }))),
  grid, ticks,
  s('path', { d: area, fill: `url(#${gid})`, class: 'area' }),
  s('path', { d: line, class: 'stroke' }),
  cross, dot);

  let idx = series.length - 1;
  const show = i => {
    idx = Math.max(0, Math.min(series.length - 1, i));
    const p = series[idx], cx = X(p.t), cy = Y(p.v);
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.removeAttribute('visibility');
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.removeAttribute('visibility');
    tip.hidden = false;
    tip.replaceChildren(h('strong', {}, fmtMoney(p.v)), h('span', {}, fmtDate(p.t)));
    tip.style.left = `${Math.min(88, Math.max(12, (cx / W) * 100))}%`;
  };
  const hide = () => { dot.setAttribute('visibility', 'hidden'); cross.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  svg.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect();
    const t = x0 + ((((e.clientX - r.left) / r.width) * W - m.l) / (W - m.l - m.r)) * (x1 - x0);
    let best = 0;
    series.forEach((p, i) => { if (Math.abs(p.t - t) < Math.abs(series[best].t - t)) best = i; });
    show(best);
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
    else if (e.key === 'Escape') hide();
  });
  host.append(svg, tip);
}

/** Donut of {key, value, share} with a legend. */
export function donut(host, groups, { labelOf = k => k, colorOf, centre } = {}) {
  clear(host);
  const R = 70, r = 46, C = 90;
  const svg = s('svg', {
    viewBox: '0 0 180 180', class: 'chart donut', role: 'img',
    'aria-label': 'Allocation: ' + groups.map(g => `${labelOf(g.key)} ${fmtPct(g.share)}`).join(', '),
  });
  let a = -Math.PI / 2;
  groups.forEach(g => {
    const sweep = Math.min(g.share, 0.9999) * Math.PI * 2, b = a + sweep, big = sweep > Math.PI ? 1 : 0;
    const p = (rad, ang) => `${(C + rad * Math.cos(ang)).toFixed(2)},${(C + rad * Math.sin(ang)).toFixed(2)}`;
    svg.append(s('path', {
      d: `M${p(R, a)}A${R},${R} 0 ${big} 1 ${p(R, b)}L${p(r, b)}A${r},${r} 0 ${big} 0 ${p(r, a)}Z`,
      fill: colorOf(g.key), class: 'seg',
    }, s('title', {}, `${labelOf(g.key)} — ${fmtPct(g.share)}`)));
    a = b;
  });
  if (centre) svg.append(
    s('text', { x: C, y: C - 2, class: 'donut-v', 'text-anchor': 'middle' }, centre.value),
    s('text', { x: C, y: C + 16, class: 'donut-l', 'text-anchor': 'middle' }, centre.label));
  const legend = h('ul', { class: 'legend' }, groups.map(g => h('li', {},
    h('i', { style: `background:${colorOf(g.key)}`, 'aria-hidden': 'true' }),
    h('span', {}, labelOf(g.key)), h('b', {}, fmtPct(g.share)))));
  host.append(svg, legend);
}

/** Ranked horizontal bars of {key, share}. */
export function bars(host, groups, { labelOf = k => k, limit = 8, onPick } = {}) {
  clear(host);
  const top = groups.slice(0, limit), max = Math.max(...top.map(g => g.share), 0.0001);
  host.append(h('ul', { class: 'bars' }, top.map(g => {
    const row = [h('span', { class: 'bar-label' }, labelOf(g.key)),
      h('span', { class: 'bar-track', 'aria-hidden': 'true' }, h('span', { class: 'bar-fill', style: `width:${(g.share / max) * 100}%` })),
      h('b', { class: 'num' }, fmtPct(g.share))];
    return h('li', {}, onPick ? h('button', { type: 'button', onclick: () => onPick(g.key), class: 'bar-btn' }, row) : row);
  })));
}
