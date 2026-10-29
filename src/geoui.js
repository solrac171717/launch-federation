// Globe / Country switcher: pill toggle, country chips with flags, and the selected country's assets.
import { h, s } from './dom.js';
import { icon, thumb, compact } from './ui.js';
import { COUNTRIES } from './places.js';
import { loadRegions, buildTree } from './regions.js';

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

/**
 * Globe / Country switcher with a drill-down inside Country: country -> region (state, province, autonomous community) -> city -> assets.
 * The globe draws the outlines and the count bubbles; this module owns where you are, the breadcrumb, the cards and the camera moves.
 */
export function attachGeo(host, globe, { visible, all = visible, selected, lookup, onPick, onChange = () => {}, toggleAfter = null }) {
  const st = { mode: 'globe', cc: null, key: '', level: 'country', rid: null, city: null, data: null, tree: null, token: 0, pushed: '' };
  const ico = d => s('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': 'true', class: 'gi' }, s('path', { d }));
  const toggle = h('div', { class: 'geo-toggle', role: 'group', 'aria-label': 'Map view', 'data-mode': 'globe' }, h('i', { class: 'geo-thumb', 'aria-hidden': 'true' }),
    h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => setMode('globe') }, ico(GLOBE_ICO), 'Globe'),
    h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setMode('country') }, ico(PIN_ICO), 'Country'));
  const chips = h('ul', { class: 'geo-chips', 'aria-label': 'Countries' }), crumbs = h('nav', { class: 'geo-crumbs', 'aria-label': 'Where you are on the map' });
  const row = h('div', { class: 'geo-assets', role: 'group', 'aria-label': 'Places and assets here' });
  const ui = h('div', { class: 'geo-ui' }, ...(toggleAfter ? [] : [toggle]), chips, crumbs);
  if (toggleAfter) toggleAfter.after(toggle);
  host.append(ui, row);

  const countryOf = id => lookup(id)?.country;
  const here = () => visible().filter(a => a.country === st.cc);
  const regionOfAsset = id => (st.tree ? st.tree.regions.find(r => r.assets.some(a => a.id === id)) : null);
  const curRegion = () => (st.tree && st.rid != null ? st.tree.regions.find(r => r.idx === st.rid) : null);
  const curCity = () => curRegion()?.cities.find(c => c.key === st.city) || null;
  const boxG = (b, c) => ({ bbox: b, center: c || [(b[1] + b[3]) / 2, (b[0] + b[2]) / 2] });
  const sig = () => (st.tree ? st.tree.regions.map(r => `${r.idx}:${r.assets.map(a => a.id).join('.')}`).join('|') : '');

  /* ---- what the globe shows for the current level */
  function push(flyIn) {
    const reg = curRegion(), city = curCity();
    if (!st.tree) { globe.setRegions([], -1); globe.setClusters([]); globe.setLayers({ regions: 0, cl: 0, assets: 1, dim: 0 }); return; }
    const counts = new Map(st.tree.regions.map(r => [r.idx, r.count]));
    globe.setRegions(st.data.map((r, i) => ({ n: r.n, b: r.b, c: r.c, r: r.r, count: counts.get(i) || 0 })), st.level === 'country' ? -1 : st.rid ?? -1);
    if (st.level === 'country') {
      globe.setClusters(st.tree.regions.map(r => ({ id: `r:${r.idx}`, lat: r.lat, lon: r.lon, count: r.count, label: r.name })));
      globe.setLayers({ regions: 1, cl: 1, assets: 0, dim: 0 });
    } else if (st.level === 'region' && reg) {
      globe.setClusters(reg.cities.map(c => ({ id: `c:${c.key}`, lat: c.lat, lon: c.lon, count: c.count, label: c.name })));
      globe.setLayers({ regions: 1, cl: 1, assets: 0, dim: 1 });
      if (flyIn) globe.flyToBox(boxG(st.data[reg.idx].b, st.data[reg.idx].c), { max: 40, arc: 0.1, shrink: 0.84 });
    } else if (st.level === 'city' && city) {
      globe.setClusters([]);
      globe.setLayers({ regions: 1, cl: 0, assets: 1, dim: 1 });
      if (flyIn) globe.flyToBox(boxG(city.bbox, [city.lat, city.lon]), { max: 90, arc: 0.12 });
    }
  }

  async function loadCountry(cc) {
    const tok = ++st.token;
    st.data = null; st.tree = null; st.level = 'country'; st.rid = null; st.city = null;
    const data = await loadRegions(cc);
    if (tok !== st.token || st.cc !== cc || st.mode !== 'country') return;
    st.data = data; retree(); push(false); st.key = ''; build();
  }
  function retree() { st.tree = st.data ? buildTree(st.data, here()) : null; st.pushed = sig(); }

  /* ---- moving between levels */
  function toCountry(fly = true) {
    st.level = 'country'; st.rid = null; st.city = null; push(false);
    if (fly && st.cc) globe.flyTo(st.cc).then(() => { if (st.level === 'country') { push(false); } });
    st.key = ''; build(); onChange(st.mode, st.cc);
  }
  function toRegion(idx, { quiet = false } = {}) {
    const r = st.tree?.regions.find(x => x.idx === idx); if (!r) return;
    st.level = 'region'; st.rid = idx; st.city = null; push(true);
    if (!quiet && r.assets.length && !r.assets.some(a => a.id === selected())) onPick(r.assets[0].id, false);
    st.key = ''; build(); onChange(st.mode, st.cc);
  }
  function toCity(key, { quiet = false } = {}) {
    const c = curRegion()?.cities.find(x => x.key === key); if (!c) return;
    st.level = 'city'; st.city = key; push(true);
    if (!quiet && !c.assets.some(a => a.id === selected())) onPick(c.assets[0].id, false);
    st.key = ''; build(); onChange(st.mode, st.cc);
  }
  function up() {
    if (st.mode !== 'country') return;
    if (st.level === 'city') { st.level = 'region'; st.city = null; push(true); st.key = ''; build(); onChange(st.mode, st.cc); }
    else if (st.level === 'region') toCountry(true);
    else setMode('globe');
  }

  /* ---- breadcrumb + cards */
  const crumb = (label, fn) => (fn ? h('button', { type: 'button', onclick: fn }, label) : h('b', { 'aria-current': 'location' }, label));
  function drawCrumbs() {
    const reg = curRegion(), city = curCity(), c = COUNTRIES[st.cc]?.name || st.cc, parts = [];
    parts.push(crumb('World', () => setMode('globe')), crumb(c, st.level === 'country' ? null : () => toCountry(true)));
    if (reg) parts.push(crumb(reg.name, st.level === 'region' ? null : () => toRegion(reg.idx, { quiet: true })));
    if (city && st.level === 'city') parts.push(crumb(city.name, null));
    crumbs.replaceChildren(...parts.flatMap((p, i) => (i ? [h('i', { 'aria-hidden': 'true' }, '›'), p] : [p])));
    // one row on top: the countries while you look at the whole country, the breadcrumb once you are inside a region or city
    const deep = st.mode === 'country' && !!st.tree && st.level !== 'country';
    crumbs.hidden = !deep; ui.classList.toggle('deep', deep);
  }
  const card = (label, n, value, fn, i) => h('button', { type: 'button', style: `--i:${i}`, class: 'geo-card', onclick: fn }, h('span', {}, label), h('em', {}, String(n)), h('b', {}, compact(value)));
  function drawRow() {
    const keep = row.scrollLeft, vis = here(), sel = selected();
    let kids;
    if (st.tree && st.level === 'country') kids = [...st.tree.regions.map((r, i) => card(r.name, r.count, r.value, () => toRegion(r.idx), i)), ...st.tree.loose.map((a, i) => assetBtn(a, i))];
    else if (st.tree && st.level === 'region') kids = (curRegion()?.cities || []).map((c, i) => card(c.name, c.count, c.value, () => toCity(c.key), i));
    else if (st.tree && st.level === 'city') kids = (curCity()?.assets || []).map(assetBtn);
    else kids = vis.map(assetBtn);
    row.replaceChildren(...kids); row.scrollLeft = keep;
    row.querySelectorAll('button[data-id]').forEach(b => { const on = b.dataset.id === sel; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  }
  const assetBtn = (a, i) => h('button', { type: 'button', 'data-id': a.id, style: `--i:${i}`, onclick: () => onPick(a.id, false) }, thumb(a, 24), h('span', {}, a.name), h('b', {}, compact(a.value)));

  function build() {
    const vis = visible(), key = [st.mode, st.cc, st.level, st.rid, st.city, vis.map(a => a.id).join(), st.tree ? 1 : 0].join('|');
    if (key !== st.key) {
      st.key = key;
      const cs = [...new Set(all().map(a => a.country))];
      chips.replaceChildren(...cs.map((c, i) => {
        const info = COUNTRIES[c] || { name: c };
        const n = vis.filter(a => a.country === c).length;
        return h('li', { style: `--i:${i}` }, h('button', { type: 'button', disabled: n === 0, 'data-c': c, onclick: () => setCountry(c) }, flag(c), h('span', {}, info.name), h('em', {}, String(n))));
      }));
      drawCrumbs(); drawRow();
    }
    chips.querySelectorAll('button').forEach(b => { const on = b.dataset.c === st.cc; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const sel = selected();
    row.querySelectorAll('button[data-id]').forEach(b => { const on = b.dataset.id === sel; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    row.querySelector('button.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function setMode(m) {
    if (m === st.mode) return;
    st.mode = m; toggle.dataset.mode = m; host.classList.toggle('geo-country', m === 'country');
    toggle.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String((i === 1) === (m === 'country'))));
    if (m === 'country') {
      const vis = visible(), a = lookup(selected());
      st.cc = (a && vis.includes(a) ? a.country : vis[0]?.country) || all()[0]?.country || 'US';
      globe.flyTo(st.cc); loadCountry(st.cc);
    } else { st.token++; st.cc = null; st.tree = null; st.data = null; st.level = 'country'; st.rid = null; st.city = null; globe.flyTo(null); globe.setLayers({ regions: 0, cl: 0, assets: 1, dim: 0 }); }
    st.key = ''; build(); onChange(st.mode, st.cc);
  }
  function setCountry(c) {
    if (c === st.cc && st.level === 'country') return;
    const same = c === st.cc;
    st.cc = c;
    if (same) { toCountry(true); return; }
    globe.flyTo(c); loadCountry(c);
    const first = visible().find(a => a.country === c);
    if (first) onPick(first.id, false);
    st.key = ''; build(); onChange(st.mode, st.cc);
  }

  // the globe tells us what was clicked
  globe.setHandlers?.({
    onRegion: idx => toRegion(idx),
    onCluster: id => { if (id.startsWith('r:')) toRegion(Number(id.slice(2))); else if (id.startsWith('c:')) toCity(id.slice(2)); },
  });
  host.addEventListener('keydown', e => { if (e.key === 'Escape' && st.mode === 'country' && st.tree && st.level !== 'country') { e.preventDefault(); up(); } });

  return {
    mode: () => st.mode, country: () => st.cc, level: () => st.level, toggle, up,
    /** Is this asset inside the place currently shown (country, region or city)? */
    inScope(a) {
      if (st.mode !== 'country' || !st.cc) return true;
      if (a.country !== st.cc) return false;
      if (st.level === 'region') return curRegion()?.assets.some(x => x.id === a.id) ?? true;
      if (st.level === 'city') return curCity()?.assets.some(x => x.id === a.id) ?? true;
      return true;
    },
    /** Name of the place currently shown, for titles. */
    placeName() {
      if (st.mode !== 'country' || !st.cc) return '';
      return st.level === 'city' && curCity() ? `${curCity().name}, ${curRegion().name}` : st.level === 'region' && curRegion() ? `${curRegion().name}, ${COUNTRIES[st.cc]?.name || st.cc}` : (COUNTRIES[st.cc]?.name || st.cc);
    },
    /** Call after the selection or the filter changed from outside. */
    sync() {
      if (st.mode === 'country') {
        const vis = visible(), id = selected(), c = countryOf(id);
        if (!vis.some(a => a.country === st.cc)) { const alt = vis[0]?.country; if (alt) { st.cc = alt; globe.flyTo(alt); loadCountry(alt); onChange(st.mode, st.cc); } }
        else if (c && c !== st.cc && vis.some(a => a.id === id)) { st.cc = c; globe.flyTo(c); loadCountry(c); onChange(st.mode, st.cc); }
        else if (st.data) {
          // assets were added, edited or removed: regroup, and step back up if where we are no longer exists
          const before = st.pushed; retree();
          if (before !== st.pushed) {
            if (st.level !== 'country' && !curRegion()) { st.level = 'country'; st.rid = null; st.city = null; globe.flyTo(st.cc).then(() => push(false)); }
            else if (st.level === 'city' && !curCity()) { st.level = 'region'; st.city = null; }
            push(st.level !== 'country'); st.key = '';
          }
          // choosing an asset elsewhere (from the list or the Assets tab) follows it, but only if we are already zoomed in
          const r = regionOfAsset(id);
          if (st.level !== 'country' && r && vis.some(a => a.id === id)) {
            const ct = r.cities.find(x => x.assets.some(a => a.id === id));
            if (r.idx !== st.rid) { if (st.level === 'city' && ct) { st.rid = r.idx; toCity(ct.key, { quiet: true }); } else toRegion(r.idx, { quiet: true }); }
            else if (st.level === 'city' && ct && ct.key !== st.city) toCity(ct.key, { quiet: true });
          }
        }
      }
      build();
    },
  };
}
