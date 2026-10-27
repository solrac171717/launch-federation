// World map: choropleth of portfolio exposure by country, with zoom/pan, tooltip and keyboard access.
// Geometry is real Natural Earth data via world-atlas (loaded from a CDN); d3 + topojson are UMD globals.
import { h, clear } from './dom.js';
import { fmtMoney, fmtPct } from './calc.js';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';

export async function loadWorld() {
  const r = await fetch(TOPO_URL);
  if (!r.ok) throw new Error(`Map data failed to load (${r.status})`);
  const topo = await r.json();
  const features = topojson.feature(topo, topo.objects.countries).features
    .filter(f => f.properties?.name && f.properties.name !== 'Antarctica');
  return features;
}

export function createMap(host, features, { onPick }) {
  clear(host);
  const W = 960, H = 500;
  const projection = d3.geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'FeatureCollection', features });
  const path = d3.geoPath(projection);
  const svg = d3.select(host).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`).attr('class', 'world')
    .attr('role', 'group').attr('aria-label', 'World map of portfolio exposure by country');
  const g = svg.append('g');
  g.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));
  g.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule10()));

  const tip = h('div', { class: 'map-tip', hidden: true, role: 'status' });
  host.append(tip);
  let data = new Map(), selected = null;

  const label = f => {
    const d = data.get(String(f.id));
    return d ? `${f.properties.name}: ${fmtMoney(d.value, { compact: true })}, ${fmtPct(d.share)} of portfolio, ${d.count} holding${d.count > 1 ? 's' : ''}`
      : `${f.properties.name}: no holdings`;
  };
  const show = (e, f) => {
    const d = data.get(String(f.id)), r = host.getBoundingClientRect();
    tip.hidden = false;
    tip.replaceChildren(h('strong', {}, f.properties.name),
      h('span', {}, d ? `${fmtMoney(d.value, { compact: true })} · ${fmtPct(d.share)}` : 'No holdings'));
    const x = e.clientX != null ? e.clientX - r.left : r.width / 2, y = e.clientY != null ? e.clientY - r.top : r.height / 2;
    tip.style.left = `${Math.min(Math.max(x, 70), r.width - 70)}px`;
    tip.style.top = `${Math.max(y - 12, 8)}px`;
  };

  const countries = g.append('g').selectAll('path').data(features).join('path')
    .attr('class', 'country').attr('d', path)
    .on('pointermove', (e, f) => show(e, f))
    .on('pointerleave', () => { tip.hidden = true; })
    .on('click', (e, f) => { if (data.has(String(f.id))) onPick(String(f.id)); });

  const zoom = d3.zoom().scaleExtent([1, 8]).translateExtent([[0, 0], [W, H]]).extent([[0, 0], [W, H]])
    .on('zoom', e => { g.attr('transform', e.transform); g.attr('style', `--k:${e.transform.k}`); });
  svg.call(zoom);

  const ctl = h('div', { class: 'map-ctl', role: 'group', 'aria-label': 'Map zoom' },
    h('button', { type: 'button', 'aria-label': 'Zoom in', onclick: () => svg.transition().duration(250).call(zoom.scaleBy, 1.6) }, '+'),
    h('button', { type: 'button', 'aria-label': 'Zoom out', onclick: () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6) }, '−'),
    h('button', { type: 'button', 'aria-label': 'Reset map view', onclick: () => svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity) }, '⟲'));
  host.append(ctl);

  return {
    /** groups: [{key: countryId, value, share, count}] */
    update(groups, sel) {
      data = new Map(groups.map(x => [String(x.key), x]));
      selected = sel;
      const max = Math.max(...groups.map(x => x.share), 0.0001);
      countries
        .attr('class', f => 'country' + (data.has(String(f.id)) ? ' has' : '') + (String(f.id) === selected ? ' sel' : ''))
        .style('--i', f => (data.has(String(f.id)) ? 0.25 + 0.75 * (data.get(String(f.id)).share / max) : 0))
        .attr('tabindex', f => (data.has(String(f.id)) ? 0 : null))
        .attr('role', f => (data.has(String(f.id)) ? 'button' : null))
        .attr('aria-pressed', f => (data.has(String(f.id)) ? String(String(f.id) === selected) : null))
        .attr('aria-label', f => (data.has(String(f.id)) ? label(f) : null))
        .on('keydown', (e, f) => {
          if (data.has(String(f.id)) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(String(f.id)); }
        })
        .on('focus', (e, f) => show({}, f))
        .on('blur', () => { tip.hidden = true; });
    },
  };
}
