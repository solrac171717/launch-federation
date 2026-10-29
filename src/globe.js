// Rotating 3D dot-globe on a 2D canvas (orthographic projection of real land points).
// No WebGL, no dependencies. Drag to rotate, click a marker to select it, arrow keys rotate.
import { GLOBE_POINTS } from '../assets/globe-points.js';
import { CITIES } from './demo-data.js';
import { inRing } from './regions.js';

const RAD = Math.PI / 180;
const N = GLOBE_POINTS.length / 2;
const PLAT = new Float32Array(N), PLON = new Float32Array(N), PCOS = new Float32Array(N), PSIN = new Float32Array(N);
for (let i = 0; i < N; i++) {
  PLAT[i] = GLOBE_POINTS[2 * i] * RAD; PLON[i] = GLOBE_POINTS[2 * i + 1] * RAD;
  PCOS[i] = Math.cos(PLAT[i]); PSIN[i] = Math.sin(PLAT[i]);
}
const norm = d => ((d + 540) % 360) - 180;
const shortest = (from, to) => norm(to - from);
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let geoPromise = null;
const loadGeo = () => (geoPromise ||= import('../assets/countries.js').then(m => m.COUNTRY_GEO));

/**
 * @param {HTMLElement} host
 * @param {{assets: any[], icons: Record<string,string>, selectedId?: string, onSelect?: (id:string)=>void,
 *          label?: string, startLon?: number, tilt?: number, autoRotate?: boolean}} opts
 */
export function createGlobe(host, opts) {
  let { assets } = opts;
  const { icons, onSelect = () => {}, label = 'Rotating 3D globe of asset locations' } = opts;
  const baseCoords = a => (a.lat != null && a.lon != null ? [a.lat, a.lon] : CITIES[a.id]);
  // assets that share a spot (several flats picked from the same city) fan out a little, so each stays visible and clickable when zoomed in
  let spread = new Map();
  const computeSpread = () => {
    spread = new Map(); const groups = new Map();
    for (const a of assets) { const c = baseCoords(a); if (!c) continue; const k = `${c[0].toFixed(4)},${c[1].toFixed(4)}`; (groups.get(k) || groups.set(k, []).get(k)).push([a, c]); }
    for (const g of groups.values()) if (g.length > 1) g.forEach(([a, c], i) => { const ang = i * 2.39996, r = 0.0045 * Math.sqrt(i + 0.5); spread.set(a.id, [c[0] + r * Math.sin(ang), c[1] + (r * Math.cos(ang)) / Math.max(0.3, Math.cos(c[0] * RAD))]); });
  };
  const coords = a => spread.get(a.id) || baseCoords(a);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'globe-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${label}. Drag to rotate; use the asset list to select an asset.`);
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  const glyphs = Object.fromEntries(Object.entries(icons).map(([k, d]) => [k, new Path2D(d)]));
  computeSpread();

  const st = {
    lon: opts.startLon ?? -92, lat: opts.tilt ?? 22, tLon: null, tLat: null,
    zoom: 1, zFit: 1, cc: null, cam: null, locked: false, vLon: 0, drag: null, idleUntil: 0, selected: opts.selectedId ?? null, filter: null,
    auto: opts.autoRotate !== false && !reduceMotion, visible: true, hits: [], w: 0, h: 0, dpr: 1,
    // drill-down: region outlines, bubbles (regions or cities), and how visible each layer is (they cross-fade)
    view: null, rg: { list: [], sel: -1, hover: -1 }, cl: [], chits: [], last: null, clHover: null,
    lay: { regions: 0, assets: 1, dim: 0, cl: 0 }, layT: { regions: 0, assets: 1, dim: 0, cl: 0 },
  };

  let geo = null;
  const H = { onCluster: opts.onCluster, onRegion: opts.onRegion };
  const baseR = () => Math.min(st.w, st.h) * 0.455;
  function fitZoom(g, max = 16) {
    const R0 = baseR(), [w, s, e, n] = g.bbox;
    const hx = ((e - w) / 2) * Math.cos(g.center[0] * RAD) * RAD, hy = ((n - s) / 2) * RAD;
    return Math.max(1.4, Math.min(max, Math.min((0.42 * st.w) / (R0 * Math.sin(Math.min(hx, 1.4))), (0.42 * Math.max(40, st.h - 2 * (opts.countryPadV || 0))) / (R0 * Math.sin(Math.min(hy, 1.4))))));
  }
  const resize = () => {
    const r = host.getBoundingClientRect();
    st.dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.w = Math.max(1, Math.round(r.width)); st.h = Math.max(1, Math.round(r.height));
    canvas.width = st.w * st.dpr; canvas.height = st.h * st.dpr;
    canvas.style.width = st.w + 'px'; canvas.style.height = st.h + 'px';
    if (st.locked && geo && st.cc) { st.zFit = fitZoom(geo[st.cc]); if (!st.cam) st.zoom = st.view ? fitZoom(st.view.g, st.view.max) * (st.view.shrink || 1) : st.zFit; }
    if (reduceMotion) frame(performance.now());
  };
  const ro = new ResizeObserver(resize); ro.observe(host);

  function project(latR, lonR, cosLat, sinLat, lon0R, cosT, sinT) {
    const dl = lonR - lon0R, cl = Math.cos(dl);
    return [cosLat * Math.sin(dl), cosT * sinLat - sinT * cosLat * cl, sinT * sinLat + cosT * cosLat * cl];
  }

  let last = performance.now(), t0 = last;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    { const k = Math.min(1, dt * 5.5); for (const n of Object.keys(st.lay)) st.lay[n] += (st.layT[n] - st.lay[n]) * k; }
    // motion
    if (st.cam) {
      const c = st.cam, k = clamp01((now - c.t0) / c.dur), e = ease(k);
      st.lon = norm(c.from.lon + shortest(c.from.lon, c.to.lon) * e); st.lat = c.from.lat + (c.to.lat - c.from.lat) * e;
      st.zoom = Math.exp(Math.log(c.from.z) + (Math.log(c.to.z) - Math.log(c.from.z)) * e - c.arc * Math.sin(Math.PI * k));
      if (c.code && (st.cc == null || k >= 0.5)) st.cc = c.code;
      if (k >= 1) { st.cam = null; if (!c.code) st.cc = null; }
    } else if (st.drag == null) {
      if (st.tLon != null) {
        const dLon = shortest(st.lon, st.tLon), dLat = st.tLat - st.lat;
        st.lon = norm(st.lon + dLon * Math.min(1, dt * 4)); st.lat += dLat * Math.min(1, dt * 4);
        if (Math.abs(dLon) < 0.2 && Math.abs(dLat) < 0.2) st.tLon = null;
      } else if (Math.abs(st.vLon) > 0.02) { st.lon = norm(st.lon + st.vLon * dt); st.vLon *= Math.pow(0.04, dt); }
      else if (st.auto && !st.locked && now > st.idleUntil) st.lon = norm(st.lon - 7 * dt);
    }

    const { w, h, dpr } = st;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const R0 = Math.min(w, h) * 0.455, R = R0 * st.zoom, cx = w / 2, cy = h / 2;
    const gC = st.cc && geo ? geo[st.cc] : null;
    const cm = gC ? smooth((Math.log(st.zoom) - 0.2) / Math.max(0.2, Math.log(st.zFit) - 0.2)) : 0;
    const lon0 = st.lon * RAD, tilt = st.lat * RAD, cosT = Math.cos(tilt), sinT = Math.sin(tilt);
    st.last = { cx, cy, R, lon0, cosT, sinT };

    // outer glow
    const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.45);
    glow.addColorStop(0, 'rgba(59,130,246,.22)'); glow.addColorStop(1, 'rgba(59,130,246,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.45, 0, 7); ctx.fill();

    // sphere body
    const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    body.addColorStop(0, '#FFFFFF'); body.addColorStop(0.6, '#EEF4FF'); body.addColorStop(1, '#D7E5FB');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();

    // graticule (very faint)
    ctx.strokeStyle = 'rgba(37,99,235,.07)'; ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath(); let pen = false;
      for (let lo = -180; lo <= 180; lo += 4) {
        const la = lat * RAD, p = project(la, lo * RAD, Math.cos(la), Math.sin(la), lon0, cosT, sinT);
        if (p[2] > 0) { const x = cx + R * p[0], y = cy - R * p[1]; pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false;
      }
      ctx.stroke();
    }

    if (cm > 0.02 && st.zoom < 10) {
      ctx.strokeStyle = `rgba(37,99,235,${0.09 * cm})`;
      const line = (fixed, isLat) => {
        ctx.beginPath(); let pen = false;
        for (let v = isLat ? -180 : -85; v <= (isLat ? 180 : 85); v += 1.5) {
          const la = (isLat ? fixed : v) * RAD, lo = (isLat ? v : fixed) * RAD, p = project(la, lo, Math.cos(la), Math.sin(la), lon0, cosT, sinT);
          const x = cx + R * p[0], y = cy - R * p[1];
          if (p[2] > 0 && x > -40 && x < w + 40 && y > -40 && y < h + 40) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false;
        }
        ctx.stroke();
      };
      const sp = st.zoom > 4 ? 2 : 5;
      for (let la = -80; la <= 80; la += sp) line(la, true);
      for (let lo = -180; lo < 180; lo += sp) line(lo, false);
    }

    // land dots: far side (faint, gives depth) then near side in 3 depth buckets
    const far = [], bucket = [[], [], []];
    for (let i = 0; i < N; i++) {
      const p = project(PLAT[i], PLON[i], PCOS[i], PSIN[i], lon0, cosT, sinT);
      if (p[2] <= 0) far.push(cx + R * p[0], cy - R * p[1]);
      else bucket[p[2] < 0.35 ? 0 : p[2] < 0.7 ? 1 : 2].push(cx + R * p[0], cy - R * p[1], p[2]);
    }
    ctx.globalAlpha = 1 - cm;
    ctx.fillStyle = 'rgba(37,99,235,.10)'; ctx.beginPath();
    for (let i = 0; i < far.length; i += 2) { ctx.moveTo(far[i] + 1, far[i + 1]); ctx.arc(far[i], far[i + 1], 1, 0, 7); }
    ctx.fill();
    const colors = ['rgba(96,130,190,.55)', 'rgba(60,100,175,.78)', 'rgba(30,64,150,.95)'];
    const base = Math.max(1.05, R / 190);
    bucket.forEach((b, k) => {
      ctx.fillStyle = colors[k]; ctx.beginPath();
      for (let i = 0; i < b.length; i += 3) { const r = base * (0.75 + 0.55 * b[i + 2]); ctx.moveTo(b[i] + r, b[i + 1]); ctx.arc(b[i], b[i + 1], r, 0, 7); }
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // country layer: outline + dense dot matrix, fades in as the camera closes on the country
    if (gC && cm > 0.01) {
      ctx.globalAlpha = cm;
      ctx.beginPath();
      for (const ring of gC.rings) {
        let pen = false, first = null;
        for (let i = 0; i < ring.length; i += 2) {
          const la = ring[i + 1] * RAD, p = project(la, ring[i] * RAD, Math.cos(la), Math.sin(la), lon0, cosT, sinT);
          if (p[2] > 0.02) { const x = cx + R * p[0], y = cy - R * p[1]; if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); first = [x, y]; } pen = true; } else pen = false;
        }
        if (pen && first) ctx.closePath();
      }
      ctx.fillStyle = 'rgba(37,99,235,.07)'; ctx.fill();
      ctx.strokeStyle = 'rgba(37,99,235,.55)'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
      // region outlines: regions that hold assets are tinted; when one is chosen the others step back
      if (st.rg.list.length && st.lay.regions > 0.01) {
        st.rg.list.forEach((r, i) => {
          const sel = i === st.rg.sel, hov = i === st.rg.hover, has = r.count > 0, back = st.rg.sel >= 0 && !sel ? st.lay.dim : 0;
          ctx.beginPath();
          for (const ring of r.r) {
            let pen = false, first = null;
            for (let q = 0; q < ring.length; q += 2) {
              const la = ring[q + 1] * RAD, p = project(la, ring[q] * RAD, Math.cos(la), Math.sin(la), lon0, cosT, sinT);
              if (p[2] > 0.02) { const x = cx + R * p[0], y = cy - R * p[1]; if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); first = [x, y]; } pen = true; } else pen = false;
            }
            if (pen && first) ctx.closePath();
          }
          ctx.globalAlpha = cm * st.lay.regions * (1 - 0.72 * back);
          if (has || hov) { ctx.fillStyle = `rgba(37,99,235,${sel ? 0.2 : hov ? 0.2 : 0.1})`; ctx.fill(); }
          ctx.strokeStyle = sel ? 'rgba(37,99,235,.95)' : hov && has ? 'rgba(37,99,235,.8)' : 'rgba(37,99,235,.36)'; ctx.lineWidth = sel ? 2.2 : hov && has ? 1.6 : 1; ctx.stroke();
        });
        ctx.globalAlpha = cm;
      }
      const dr = Math.max(0.9, Math.min(3.4, gC.step * RAD * R * 0.17));
      ctx.fillStyle = 'rgba(30,64,150,.72)'; ctx.beginPath();
      for (let i = 0; i < gC.dots.length; i += 2) {
        const la = gC.dots[i] * RAD, p = project(la, gC.dots[i + 1] * RAD, Math.cos(la), Math.sin(la), lon0, cosT, sinT);
        if (p[2] <= 0.02) continue;
        const x = cx + R * p[0], y = cy - R * p[1];
        if (x < -6 || x > w + 6 || y < -6 || y > h + 6) continue;
        ctx.moveTo(x + dr, y); ctx.arc(x, y, dr, 0, 7);
      }
      ctx.fill(); ctx.globalAlpha = 1;
    }

    // rim light
    const rim = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
    rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(37,99,235,.16)');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(37,99,235,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();

    // markers
    const pulse = (Math.sin((now - t0) / 500) + 1) / 2;
    const items = [];
    for (const a of assets) {
      const c = coords(a); if (!c) continue;
      const la = c[0] * RAD, p = project(la, c[1] * RAD, Math.cos(la), Math.sin(la), lon0, cosT, sinT);
      if (p[2] > 0.08) items.push({ a, x: cx + R * p[0], y: cy - R * p[1], z: p[2] });
    }
    items.sort((m, n) => (m.a.id === st.selected) - (n.a.id === st.selected) || m.z - n.z);
    st.hits = [];
    const ms = Math.max(0.8, R0 / 230) * (1 + (Math.min(st.zoom, 6) - 1) * 0.16);

    // bubbles: one per region (country level) or per city (region level), with how many assets are inside
    st.chits = [];
    if (st.cl.length && st.lay.cl > 0.02) {
      const cs = Math.max(0.9, R0 / 250), boxes = [];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [...st.cl].sort((a, b) => b.count - a.count).forEach(c => {
        const la = c.lat * RAD, p = project(la, c.lon * RAD, Math.cos(la), Math.sin(la), lon0, cosT, sinT);
        if (p[2] < 0.12) return;
        const x = cx + R * p[0], y = cy - R * p[1], r = (14 + Math.min(13, Math.sqrt(c.count) * 4.2)) * cs, hov = st.clHover === c.id;
        ctx.globalAlpha = st.lay.cl * Math.min(1, (p[2] - 0.12) * 4);
        if (hov) { ctx.fillStyle = 'rgba(37,99,235,.2)'; ctx.beginPath(); ctx.arc(x, y, r + 9 * cs, 0, 7); ctx.fill(); }
        ctx.shadowColor = 'rgba(11,23,54,.35)'; ctx.shadowBlur = 10 * cs; ctx.shadowOffsetY = 3 * cs;
        ctx.fillStyle = hov ? '#1D4ED8' : '#2563EB'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4 * cs; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(14 * cs)}px Inter, system-ui, sans-serif`; ctx.fillText(String(c.count), x, y + 0.5);
        if (c.label) {
          ctx.font = `600 ${Math.round(12 * cs)}px Inter, system-ui, sans-serif`;
          const tw = ctx.measureText(c.label).width + 18 * cs, ph = 22 * cs, bx = x - tw / 2, by = y + r + 6 * cs;
          if (!boxes.some(b => bx < b[2] && bx + tw > b[0] && by < b[3] && by + ph > b[1])) {
            boxes.push([bx, by, bx + tw, by + ph]);
            ctx.shadowColor = 'rgba(11,23,54,.22)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3; ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.roundRect(bx, by, tw, ph, ph / 2); ctx.fill();
            ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = '#0B1736'; ctx.fillText(c.label, x, by + ph / 2 + 0.5);
          }
        }
        ctx.globalAlpha = 1;
        if (st.lay.cl > 0.5) st.chits.push({ id: c.id, x, y, r: r + 4 });
      });
      ctx.textAlign = 'start';
    }
    for (const m of items) {
      const dim = st.filter && !st.filter.includes(m.a.category), sel = m.a.id === st.selected;
      const alpha = (dim ? 0.18 : 1) * Math.min(1, (m.z - 0.08) * 4) * st.lay.assets;
      ctx.globalAlpha = alpha;
      if (sel) {
        ctx.fillStyle = 'rgba(37,99,235,.18)'; ctx.beginPath(); ctx.arc(m.x, m.y, (15 + 12 * pulse) * ms, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(37,99,235,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(m.x, m.y, (20 + 8 * pulse) * ms, 0, 7); ctx.stroke();
      }
      ctx.shadowColor = 'rgba(11,23,54,.35)'; ctx.shadowBlur = 8 * ms; ctx.shadowOffsetY = 2 * ms;
      ctx.fillStyle = sel ? '#2563EB' : '#0B1736'; ctx.beginPath(); ctx.arc(m.x, m.y, 11 * ms, 0, 7); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * ms; ctx.stroke();
      ctx.save(); ctx.translate(m.x - 6 * ms, m.y - 6 * ms); ctx.scale(0.5 * ms, 0.5 * ms);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(glyphs[m.a.category]); ctx.restore();
      ctx.globalAlpha = 1;
      if (!dim && (sel ? st.lay.assets > 0.5 : st.lay.assets > 0.5)) st.hits.push({ id: m.a.id, x: m.x, y: m.y, r: 16 * ms });
      if (sel && cm > 0.5 && st.lay.assets > 0.5) {
        ctx.globalAlpha = (cm - 0.5) * 2 * ((st.lay.assets - 0.5) * 2); ctx.font = `600 ${Math.round(12.5 * Math.min(1.2, ms))}px Inter, system-ui, sans-serif`;
        const tw = ctx.measureText(m.a.name).width, px = 10, ph = 26 * Math.min(1.2, ms), bx = m.x + 18 * ms, by = m.y - ph / 2;
        ctx.shadowColor = 'rgba(11,23,54,.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.roundRect(bx, by, tw + px * 2, ph, ph / 2); ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = '#0B1736'; ctx.textBaseline = 'middle'; ctx.fillText(m.a.name, bx + px, m.y + 0.5);
        ctx.globalAlpha = 1;
      }
    }
    if (st.visible && !reduceMotion) raf = requestAnimationFrame(frame);
  }

  let raf = requestAnimationFrame(frame);
  const io = new IntersectionObserver(es => {
    st.visible = es[0].isIntersecting;
    if (st.visible && !reduceMotion) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  });
  io.observe(host);

  // screen point -> [lat, lon] on the sphere (inverse of the orthographic projection), then the region under it
  function unproject(px, py) {
    const L = st.last; if (!L) return null;
    const X = (px - L.cx) / L.R, Y = -(py - L.cy) / L.R, d = 1 - X * X - Y * Y; if (d <= 0) return null;
    const Z = Math.sqrt(d), sinLat = Y * L.cosT + Z * L.sinT, cosLat = Math.sqrt(Math.max(1e-9, 1 - sinLat * sinLat));
    const dl = Math.atan2(X, (Z - L.sinT * sinLat) / L.cosT / 1);
    return [Math.asin(Math.max(-1, Math.min(1, sinLat))) / RAD, norm(L.lon0 / RAD + dl / RAD)];
  }
  function regionAt(px, py) {
    if (!st.rg.list.length || st.lay.regions < 0.3) return -1;
    const ll = unproject(px, py); if (!ll) return -1;
    const [lat, lon] = ll;
    return st.rg.list.findIndex(r => lon >= r.b[0] && lon <= r.b[2] && lat >= r.b[1] && lat <= r.b[3] && r.r.some(ring => inRing(ring, lon, lat)));
  }

  // interaction
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    st.drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() }; if (!st.locked) { st.tLon = null; st.vLon = 0; }
  });
  canvas.addEventListener('pointermove', e => {
    const [px, py] = pos(e);
    if (!st.drag) {
      const ch = st.chits.find(m => Math.hypot(m.x - px, m.y - py) < m.r), rh = ch || st.hits.some(m => Math.hypot(m.x - px, m.y - py) < m.r) ? -1 : regionAt(px, py);
      if ((ch ? ch.id : null) !== st.clHover) { st.clHover = ch ? ch.id : null; if (reduceMotion) frame(performance.now()); }
      if (rh !== st.rg.hover) { st.rg.hover = rh; if (reduceMotion) frame(performance.now()); }
      canvas.style.cursor = ch || st.hits.some(m => Math.hypot(m.x - px, m.y - py) < m.r) || (rh >= 0 && st.rg.list[rh].count > 0) ? 'pointer' : st.locked ? 'default' : 'grab'; return;
    }
    const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
    st.drag.x = e.clientX; st.drag.y = e.clientY; st.drag.moved += Math.abs(dx) + Math.abs(dy);
    if (st.locked || st.cam) return;
    const k = 180 / (Math.min(st.w, st.h) * 0.455 * Math.PI);
    st.lon = norm(st.lon - dx * k * 1.1); st.lat = Math.max(-55, Math.min(60, st.lat + dy * k));
    st.vLon = -dx * k * 1.1 * 60; canvas.style.cursor = 'grabbing';
  });
  const end = e => {
    if (!st.drag) return;
    const moved = st.drag.moved; st.drag = null; st.idleUntil = performance.now() + 4000;
    if (moved < 5) {
      const [px, py] = pos(e);
      const hit = st.hits.slice().reverse().find(m => Math.hypot(m.x - px, m.y - py) < m.r);
      if (hit) { onSelect(hit.id); return; }
      const ch = st.chits.find(m => Math.hypot(m.x - px, m.y - py) < m.r);
      if (ch) { H.onCluster?.(ch.id); return; }
      const ri = regionAt(px, py);
      if (ri >= 0 && st.rg.list[ri].count > 0) H.onRegion?.(ri);
    }
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', () => { st.drag = null; });
  canvas.addEventListener('keydown', e => {
    if (st.locked || st.cam) return;
    const step = e.key === 'ArrowLeft' ? -12 : e.key === 'ArrowRight' ? 12 : 0;
    if (step) { e.preventDefault(); st.lon = norm(st.lon + step); st.idleUntil = performance.now() + 4000; if (reduceMotion) frame(performance.now()); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); st.lat = Math.max(-55, Math.min(60, st.lat + (e.key === 'ArrowUp' ? -8 : 8))); if (reduceMotion) frame(performance.now()); }
  });

  return {
    focus(id) {
      const a = assets.find(x => x.id === id), c = a && coords(a); if (!c || st.locked || st.cam) return;
      st.tLon = c[1]; st.tLat = Math.max(8, Math.min(40, c[0] * 0.55)); st.idleUntil = performance.now() + 6000;
      if (reduceMotion) { st.lon = st.tLon; st.lat = st.tLat; st.tLon = null; frame(performance.now()); }
    },
    /** Fly into a country (code) or back out to the globe (null). */
    async flyTo(code) {
      const now = performance.now();
      st.view = null; st.rg = { list: [], sel: -1, hover: -1 }; st.cl = []; st.chits = []; st.clHover = null;
      if (!code) {
        st.locked = false; st.idleUntil = now + 2500;
        if (reduceMotion) { st.zoom = 1; st.cc = null; st.lat = opts.tilt ?? 22; frame(now); return; }
        st.cam = { t0: now, dur: 1300, from: { lon: st.lon, lat: st.lat, z: st.zoom }, to: { lon: st.lon, lat: opts.tilt ?? 22, z: 1 }, arc: 0, code: null };
        return;
      }
      geo = await loadGeo();
      let g = geo[code];
      if (!g) { // no outline for this country: still fly to it, framed around its assets
        const pts = assets.filter(x => x.country === code).map(coords).filter(Boolean);
        if (!pts.length) return;
        const la = pts.map(p => p[0]), lo = pts.map(p => p[1]), pad = 2.5;
        const bb = [Math.min(...lo) - pad, Math.min(...la) - pad, Math.max(...lo) + pad, Math.max(...la) + pad];
        g = geo[code] = { bbox: bb, center: [(bb[1] + bb[3]) / 2, (bb[0] + bb[2]) / 2], step: 1, rings: [], dots: [] };
      }
      st.locked = true; st.zFit = fitZoom(g);
      if (reduceMotion) { st.cc = code; st.zoom = st.zFit; st.lon = g.center[1]; st.lat = g.center[0]; frame(now); return; }
      const jump = st.cc && st.cc !== code && st.zoom > 1.2;
      st.cam = { t0: now, dur: jump ? 1500 : 1300, from: { lon: st.lon, lat: st.lat, z: st.zoom }, to: { lon: g.center[1], lat: g.center[0], z: st.zFit }, arc: jump ? 0.7 : 0, code };
    },
    /** Region outlines of the current country: [{ n, b, c, r, count }]; `sel` is the chosen one (-1 for none). */
    setRegions(list, sel = -1) { st.rg = { list: list || [], sel, hover: -1 }; if (reduceMotion) frame(performance.now()); },
    /** Who to tell when a region outline or a bubble is clicked. */
    setHandlers(h) { Object.assign(H, h); },
    setRegionSel(sel) { st.rg.sel = sel; if (reduceMotion) frame(performance.now()); },
    /** Bubbles with a count: [{ id, lat, lon, count, label }]. */
    setClusters(list) { st.cl = list || []; st.clHover = null; if (reduceMotion) frame(performance.now()); },
    /** Target visibility (0..1) of the layers; they cross-fade. */
    setLayers(t) { Object.assign(st.layT, t); if (reduceMotion) { Object.assign(st.lay, st.layT); frame(performance.now()); } },
    /** Fly to a box inside the country: g = { bbox: [w, s, e, n], center: [lat, lon] }. */
    flyToBox(g, { max = 70, arc = 0.12, dur = 1250, shrink = 1 } = {}) {
      const now = performance.now(); st.view = { g, max, shrink }; const z = fitZoom(g, max) * shrink;
      if (reduceMotion || !st.locked) { st.zoom = z; st.lon = g.center[1]; st.lat = g.center[0]; frame(now); return; }
      st.cam = { t0: now, dur, from: { lon: st.lon, lat: st.lat, z: st.zoom }, to: { lon: g.center[1], lat: g.center[0], z }, arc, code: st.cc };
    },
    setAssets(list) { assets = list; computeSpread(); if (reduceMotion) frame(performance.now()); },
    setSelected(id) { st.selected = id; if (reduceMotion) frame(performance.now()); },
    setFilter(cat) { st.filter = cat ? [].concat(cat) : null; if (reduceMotion) frame(performance.now()); },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); canvas.remove(); },
  };
}
