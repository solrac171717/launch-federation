// Country -> region -> city. Which region (state, province, autonomous community...) an asset is in, found from its coordinates
// against the region outlines in assets/regions/<CC>.js, and the grouping of assets into regions and cities.
// Pure functions except loadRegions (dynamic import, cached).
const cache = new Map();
/** Region outlines of a country: [{ n: name, b: [w,s,e,n], c: [lat,lon], r: [flat rings [lon,lat,...]] }], or null when we do not have them. */
export async function loadRegions(cc) {
  if (!/^[A-Z]{2}$/.test(cc || '')) return null;
  if (!cache.has(cc)) cache.set(cc, Promise.all([import(`../assets/regions/${cc}.js`), import('../assets/regions/cities.js').catch(() => ({ default: {} }))]).then(([m, c]) => { const data = m.default; data.exact = c.default; return data; }).catch(() => null));
  return cache.get(cc);
}

/** Even-odd test of a point against one flat ring [lon, lat, lon, lat...]. */
export function inRing(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const segDist2 = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  const qx = ax + t * dx - px, qy = ay + t * dy - py; return qx * qx + qy * qy;
};

/**
 * Index of the region that holds the point. Outlines are simplified, so a point on the coast can fall just outside every one:
 * then the nearest outline wins, as long as it is within about 1.5 degrees (otherwise -1).
 */
export function locate(regions, lat, lon) {
  if (!regions || !Number.isFinite(lat) || !Number.isFinite(lon)) return -1;
  const known = regions.exact?.[`${lat.toFixed(2)},${lon.toFixed(2)}`]; // a built-in city: placed exactly at build time
  if (known) { const k = regions.findIndex(r => r.n === known); if (k >= 0) return k; }
  for (let k = 0; k < regions.length; k++) {
    const b = regions[k].b; if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    if (regions[k].r.some(r => inRing(r, lon, lat))) return k;
  }
  const kx = Math.cos((lat * Math.PI) / 180) || 1; let best = -1, bd = 2.25;
  regions.forEach((reg, k) => {
    for (const r of reg.r) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const d = segDist2(lon * kx, lat, r[j] * kx, r[j + 1], r[i] * kx, r[i + 1]);
      if (d < bd) { bd = d; best = k; }
    }
  });
  return best;
}

/** The city part of a place label: "Austin, TX" -> Austin; "12 Calle Mayor, Madrid, ES" -> Madrid. */
export function cityOf(place) {
  const parts = String(place || '').split(',').map(x => x.trim()).filter(Boolean);
  if (parts.length > 1 && /^[A-Z]{2,3}$/.test(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1] || String(place || '').trim() || 'Unknown';
}

const mean = xs => xs.reduce((n, x) => n + x, 0) / (xs.length || 1);
const boxOf = (pts, pad) => { const la = pts.map(p => p[0]), lo = pts.map(p => p[1]); return [Math.min(...lo) - pad, Math.min(...la) - pad, Math.max(...lo) + pad, Math.max(...la) + pad]; };

/**
 * Groups assets (with .lat/.lon) by region and, inside each, by city. Only regions that hold assets are returned, biggest value first.
 * @returns {{ regions: Array<{ idx, name, assets, count, value, lat, lon, cities: Array<{ key, name, assets, count, value, lat, lon, bbox }> }>, loose: any[] }}
 */
export function buildTree(regions, assets) {
  const byRegion = new Map(), loose = [];
  for (const a of assets) {
    const k = locate(regions, a.lat, a.lon);
    if (k < 0) { loose.push(a); continue; }
    (byRegion.get(k) || byRegion.set(k, []).get(k)).push(a);
  }
  const out = [...byRegion].map(([idx, list]) => {
    const cities = new Map();
    for (const a of list) { const name = cityOf(a.place), key = name.toLowerCase(); (cities.get(key) || cities.set(key, { key, name, assets: [] }).get(key)).assets.push(a); }
    const cs = [...cities.values()].map(c => ({ ...c, count: c.assets.length, value: c.assets.reduce((n, a) => n + a.value, 0), lat: mean(c.assets.map(a => a.lat)), lon: mean(c.assets.map(a => a.lon)), bbox: boxOf(c.assets.map(a => [a.lat, a.lon]), 0.06) }))
      .sort((a, b) => b.value - a.value);
    return { idx, name: regions[idx].n, assets: list, count: list.length, value: list.reduce((n, a) => n + a.value, 0), lat: mean(list.map(a => a.lat)), lon: mean(list.map(a => a.lon)), cities: cs };
  }).sort((a, b) => b.value - a.value);
  return { regions: out, loose };
}
