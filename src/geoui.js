// Globe / Country switcher: pill toggle, country chips with flags, and the selected country's assets.
import { h, s } from './dom.js';
import { icon, thumb, compact } from './ui.js';
import { COUNTRIES } from './places.js';

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
  CA: () => [s('rect', { width: 22, height: 15, fill: '#fff' }), s('rect', { width: 5.5, height: 15, fill: '#D52B1E' }), s('rect', { x: 16.5, width: 5.5, height: 15, fill: '#D52B1E' }),
    s('path', { d: 'M11 3l1.5 3 2.5-.5-1.500 3 2 1.500H12v3h-2v-3H6.500l2-1.500L7 5.500 9.500 6z', fill: '#D52B1E' })],
  MX: () => [s('rect', { width: 22, height: 15, fill: '#fff' }), s('rect', { width: 7.3, height: 15, fill: '#006847' }), s('rect', { x: 14.7, width: 7.3, height: 15, fill: '#CE1126' }), s('circle', { cx: 11, cy: 7.5, r: 2, fill: '#8B6B3A', opacity: .85 })],
  BR: () => [s('rect', { width: 22, height: 15, fill: '#009C3B' }), s('path', { d: 'M11 1.5L20 7.5L11 13.5L2 7.5z', fill: '#FFDF00' }), s('circle', { cx: 11, cy: 7.5, r: 3.2, fill: '#002776' }), s('path', { d: 'M8 7q3-1 6 1', stroke: '#fff', 'stroke-width': .6, fill: 'none' })],
  IE: () => [s('rect', { width: 22, height: 15, fill: '#fff' }), s('rect', { width: 7.3, height: 15, fill: '#169B62' }), s('rect', { x: 14.7, width: 7.3, height: 15, fill: '#FF883E' })],
  FR: () => [s('rect', { width: 22, height: 15, fill: '#fff' }), s('rect', { width: 7.3, height: 15, fill: '#0055A4' }), s('rect', { x: 14.7, width: 7.3, height: 15, fill: '#EF4135' })],
  DE: () => [s('rect', { width: 22, height: 5, fill: '#000' }), s('rect', { y: 5, width: 22, height: 5, fill: '#DD0000' }), s('rect', { y: 10, width: 22, height: 5, fill: '#FFCE00' })],
  ES: () => [s('rect', { width: 22, height: 15, fill: '#AA151B' }), s('rect', { y: 3.75, width: 22, height: 7.5, fill: '#F1BF00' })],
  IT: () => [s('rect', { width: 22, height: 15, fill: '#fff' }), s('rect', { width: 7.3, height: 15, fill: '#009246' }), s('rect', { x: 14.7, width: 7.3, height: 15, fill: '#CE2B37' })],
  NL: () => [s('rect', { width: 22, height: 5, fill: '#AE1C28' }), s('rect', { y: 5, width: 22, height: 5, fill: '#fff' }), s('rect', { y: 10, width: 22, height: 5, fill: '#21468B' })],
  CH: () => [s('rect', { width: 22, height: 15, fill: '#D52B1E' }), s('rect', { x: 9.2, y: 3.5, width: 3.6, height: 8, fill: '#fff' }), s('rect', { x: 6.5, y: 5.8, width: 9, height: 3.4, fill: '#fff' })],
  AE: () => [s('rect', { width: 22, height: 15, fill: '#fff' }), s('rect', { x: 5.5, width: 16.5, height: 5, fill: '#00732F' }), s('rect', { x: 5.5, y: 10, width: 16.5, height: 5, fill: '#000' }), s('rect', { width: 5.5, height: 15, fill: '#FF0000' })],
  AU: () => [s('rect', { width: 22, height: 15, fill: '#00008B' }), s('rect', { width: 11, height: 7.5, fill: '#012169' }), s('path', { d: 'M0 0L11 7.500M11 0L0 7.500', stroke: '#fff', 'stroke-width': 1.600 }), s('path', { d: 'M5.500 0v7.500M0 3.750h11', stroke: '#fff', 'stroke-width': 2.500 }), s('path', { d: 'M5.500 0v7.500M0 3.750h11', stroke: '#C8102E', 'stroke-width': 1.300 }),
    ...[[16.500, 3], [14, 8], [19, 8.500], [16.500, 12.500], [5.500, 12]].map(([x, y]) => s('circle', { cx: x, cy: y, r: 1, fill: '#fff' }))],
  NZ: () => [s('rect', { width: 22, height: 15, fill: '#00247D' }), s('rect', { width: 11, height: 7.5, fill: '#012169' }), s('path', { d: 'M0 0L11 7.500M11 0L0 7.500', stroke: '#fff', 'stroke-width': 1.600 }), s('path', { d: 'M5.500 0v7.500M0 3.750h11', stroke: '#fff', 'stroke-width': 2.500 }), s('path', { d: 'M5.500 0v7.500M0 3.750h11', stroke: '#CC142B', 'stroke-width': 1.300 }),
    ...[[17, 3.500], [14.500, 7], [19, 7.500], [16.500, 11.500]].map(([x, y]) => s('circle', { cx: x, cy: y, r: 1, fill: '#CC142B', stroke: '#fff', 'stroke-width': .4 }))],
  JP: () => [s('rect', { width: 22, height: 15, fill: '#fff' }), s('circle', { cx: 11, cy: 7.5, r: 4.2, fill: '#BC002D' })],
};
const FLAG_FALLBACK = () => [s('rect', { width: 22, height: 15, fill: '#E3EAF7' }), s('circle', { cx: 11, cy: 7.5, r: 4.500, fill: 'none', stroke: '#7B8BA8', 'stroke-width': 1 }), s('path', { d: 'M6.500 7.500h9M11 3v9', stroke: '#7B8BA8', 'stroke-width': .8 })];

export const flag = code => s('svg', { viewBox: '0 0 22 15', width: 22, height: 15, class: 'flag', 'aria-hidden': 'true' },
  s('defs', {}, s('clipPath', { id: 'fl-' + code }, s('rect', { width: 22, height: 15, rx: 2.5 }))), s('g', { 'clip-path': `url(#fl-${code})` }, ...(FLAG_GEO[code] || FLAG_FALLBACK)()));
const GLOBE_ICO = 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2.5 2 2.5 10 0 12M8 2c-2.5 2-2.5 10 0 12';
const PIN_ICO = 'M8 14.2s4.8-4 4.8-7.6a4.8 4.8 0 1 0-9.6 0C3.2 10.200 8 14.200 8 14.200zM8 7.600m-1.500 0a1.500 1.500 0 1 0 3 0 1.500 1.500 0 1 0-3 0';

/** Globe ⇄ Country switcher: pill toggle, country chips with flags, and the selected country's assets. */
export function attachGeo(host, globe, { visible, all = visible, selected, lookup, onPick, onChange = () => {}, toggleAfter = null }) {
  const st = { mode: 'globe', cc: null, key: '' };
  const ico = d => s('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': 'true', class: 'gi' }, s('path', { d }));
  const toggle = h('div', { class: 'geo-toggle', role: 'group', 'aria-label': 'Map view', 'data-mode': 'globe' }, h('i', { class: 'geo-thumb', 'aria-hidden': 'true' }),
    h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => setMode('globe') }, ico(GLOBE_ICO), 'Globe'),
    h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setMode('country') }, ico(PIN_ICO), 'Country'));
  const chips = h('ul', { class: 'geo-chips', 'aria-label': 'Countries' }), row = h('div', { class: 'geo-assets', role: 'group', 'aria-label': 'Assets in this country' });
  if (toggleAfter) { toggleAfter.after(toggle); host.append(h('div', { class: 'geo-ui' }, chips), row); } else host.append(h('div', { class: 'geo-ui' }, toggle, chips), row);

  const countryOf = id => lookup(id)?.country;
  function build() {
    const vis = visible(), key = [st.mode, st.cc, vis.map(a => a.id).join()].join('|');
    if (key !== st.key) {
      st.key = key;
      const cs = [...new Set(all().map(a => a.country))];
      chips.replaceChildren(...cs.map((c, i) => {
        const info = COUNTRIES[c] || { name: c };
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
      const vis = visible(), a = lookup(selected());
      st.cc = (a && vis.includes(a) ? a.country : vis[0]?.country) || all()[0]?.country || 'US';
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

