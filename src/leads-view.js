// The small pieces of the leads screens that the app and the website both draw, so the preview on the landing page is the real thing, not a picture of it.
import { h, s as svg } from './dom.js';
import { ICON } from './ui.js';
import { funnel } from './leads-core.js';

export const ago = iso => { const d = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400_000)); return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
export const snippet = (t, n = 110) => (t.length > n ? `${t.slice(0, n).trim()}…` : t);
export const sourceIcon = (key, size = 16) => svg('svg', { viewBox: '0 0 24 24', width: size, height: size, class: 'ico', 'aria-hidden': 'true' }, svg('path', { d: ICON[key] }));
export const scorePill = v => h('span', { class: `score-pill ${v.tier}`, title: `Intent score ${v.score} of 100` }, String(v.score));

/** The card that follows the selected point on the globe. `actions` are extra buttons (the app adds "Open lead and reply"). */
export function leadCard(v, { actions = [] } = {}) {
  return h('div', { class: 'asset-card lead-card' },
    h('div', { class: 'ac-top' }, h('span', { class: 'ac-ico src' }, sourceIcon(v.source, 18)), h('div', {}, h('b', {}, v.name), h('span', {}, [v.authorRole, v.authorCompany].filter(Boolean).join(' · ') || v.kind)), scorePill(v)),
    h('p', { class: 'lc-quote' }, `“${snippet(v.text, 190)}”`),
    h('div', { class: 'lc-meta' }, h('span', {}, v.intentLabel), h('span', {}, v.place || 'Location unknown'), h('span', {}, ago(v.signalAt)), h('span', { class: `st st-${v.status === 'customer' ? 'ok' : v.status === 'new' ? 'idle' : 'warn'}` }, v.statusLabel)),
    actions.length ? h('div', { class: 'ac-actions' }, ...actions) : null);
}

/** From signal to customer: four bars. */
export function funnelBars(list) {
  const f = funnel(list), top = Math.max(f[0][1], 1);
  return h('div', { class: 'funnel' }, ...f.map(([label, n]) => h('div', { class: 'fn-row' }, h('span', {}, label), h('i', { style: `width:${Math.max(3, (n / top) * 100)}%` }), h('b', {}, String(n)))));
}
