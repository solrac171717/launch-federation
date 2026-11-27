// Globo oscuro de puntos con conexiones entre ciudades y avisos de «la IA recomienda a otra empresa».
// Es una ilustración: no representa datos reales. Se anima solo mientras está en pantalla.
import { GLOBE_POINTS } from '../assets/globe-points.js';

const RAD = Math.PI / 180, N = GLOBE_POINTS.length / 2;
const PLAT = new Float32Array(N), PLON = new Float32Array(N);
for (let i = 0; i < N; i++) { PLAT[i] = GLOBE_POINTS[2 * i] * RAD; PLON[i] = GLOBE_POINTS[2 * i + 1] * RAD; }

export const CITIES = [
  { n: 'Madrid', lat: 40.4, lon: -3.7 }, { n: 'Barcelona', lat: 41.4, lon: 2.2 }, { n: 'Ciudad de México', lat: 19.4, lon: -99.1 },
  { n: 'Miami', lat: 25.8, lon: -80.2 }, { n: 'Los Ángeles', lat: 34.1, lon: -118.2 }, { n: 'Bogotá', lat: 4.7, lon: -74.1 },
  { n: 'Lima', lat: -12.0, lon: -77.0 }, { n: 'Santiago', lat: -33.4, lon: -70.7 }, { n: 'Buenos Aires', lat: -34.6, lon: -58.4 },
  { n: 'Houston', lat: 29.8, lon: -95.4 }, { n: 'Nueva York', lat: 40.7, lon: -74.0 }, { n: 'Sevilla', lat: 37.4, lon: -6.0 },
];
const LINKS = [[0, 3], [0, 2], [1, 5], [3, 5], [2, 4], [3, 10], [5, 6], [6, 7], [7, 8], [8, 0], [9, 2], [11, 8], [10, 0], [4, 9], [3, 8]];

const vec = (lat, lon) => { const la = lat * RAD, lo = lon * RAD; return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]; };
const slerp = (a, b, t) => { const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), om = Math.acos(d), so = Math.sin(om) || 1, k1 = Math.sin((1 - t) * om) / so, k2 = Math.sin(t * om) / so; return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2]; };

/** host: contenedor con <canvas> y una capa para los avisos. cfg.onNote(city) devuelve un nodo del aviso. */
export function createNetGlobe(host, { canvas, notes, makeNote, reduceMotion }) {
  const ctx = canvas.getContext('2d');
  let W = 0, Hh = 0, dpr = 1, lon0 = -1.1, running = false, raf = 0, last = 0, t = 0;
  const TILT = 0.34, cT = Math.cos(TILT), sT = Math.sin(TILT);
  const cityVec = CITIES.map(c => vec(c.lat, c.lon));
  const arcs = LINKS.map(([a, b], i) => ({ a: cityVec[a], b: cityVec[b], pts: Array.from({ length: 41 }, (_, k) => { const tt = k / 40, p = slerp(cityVec[a], cityVec[b], tt), lift = 1 + 0.22 * Math.sin(Math.PI * tt); return [p[0] * lift, p[1] * lift, p[2] * lift, p]; }), off: i * 0.173 }));
  const live = [];
  let nextNote = 0, noteIdx = 0;

  // vista: gira alrededor del eje Y (longitud) y se inclina en X
  const rot = ([x, y, z]) => { const c = Math.cos(lon0), s = Math.sin(lon0); const x1 = x * c - z * s, z1 = x * s + z * c; return [x1, y * cT - z1 * sT, y * sT + z1 * cT]; };

  function resize() {
    const r = host.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(240, r.width); Hh = Math.max(240, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr); canvas.style.width = W + 'px'; canvas.style.height = Hh + 'px';
  }
  const screen = (p, R, cx, cy) => [cx + p[0] * R, cy - p[1] * R];

  function draw(now) {
    const R = Math.min(W, Hh) * 0.4, cx = W / 2, cy = Hh / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
    // resplandor y esfera
    const glow = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.22); glow.addColorStop(0, 'rgba(37,99,235,.34)'); glow.addColorStop(1, 'rgba(37,99,235,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, 7); ctx.fill();
    const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R); body.addColorStop(0, '#13296B'); body.addColorStop(0.6, '#0A1745'); body.addColorStop(1, '#050D2B');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    // puntos de tierra
    ctx.fillStyle = 'rgba(125,180,255,.62)'; ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const la = PLAT[i], lo = PLON[i], cl = Math.cos(la), p = rot([cl * Math.sin(lo), Math.sin(la), cl * Math.cos(lo)]);
      if (p[2] <= 0.02) continue; const x = cx + p[0] * R, y = cy - p[1] * R, r = 0.9 + 0.9 * p[2]; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 7);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(125,180,255,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    // conexiones
    for (const arc of arcs) {
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(96,165,250,.55)'; ctx.beginPath(); let pen = false;
      for (const q of arc.pts) { const base = rot(q[3]), v = rot([q[0], q[1], q[2]]); if (base[2] < 0.0) { pen = false; continue; } const [x, y] = screen(v, R, cx, cy); if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y); }
      ctx.stroke();
      // pulso que viaja por el arco
      const k = ((t * 0.18 + arc.off) % 1), idx = Math.min(arc.pts.length - 1, Math.floor(k * (arc.pts.length - 1))), q = arc.pts[idx], base = rot(q[3]);
      if (base[2] > 0) { const v = rot([q[0], q[1], q[2]]), [x, y] = screen(v, R, cx, cy); const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, 'rgba(125,180,255,.7)'); g.addColorStop(1, 'rgba(37,99,235,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); }
    }
    // ciudades
    CITIES.forEach((c, i) => {
      const p = rot(cityVec[i]); if (p[2] <= 0.05) return; const [x, y] = screen(p, R, cx, cy), ph = (t * 0.9 + i * 0.7) % 3, a = Math.max(0, 1 - ph / 3);
      ctx.strokeStyle = `rgba(125,180,255,${(0.55 * a).toFixed(3)})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 4 + ph * 7, 0, 7); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); ctx.fillStyle = '#3B82F6'; ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 7); ctx.fill();
    });
    // avisos: siguen a su ciudad mientras viven
    for (const n of live) {
      const p = rot(cityVec[n.i]), [x, y] = screen(p, R, cx, cy), age = now - n.t0, vis = p[2] > 0.12, k = age < 350 ? age / 350 : age > n.life - 450 ? Math.max(0, (n.life - age) / 450) : 1;
      n.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-12px, calc(-100% - 14px))`; n.el.style.opacity = vis ? String(k) : '0';
    }
    for (let i = live.length - 1; i >= 0; i--) if (now - live[i].t0 > live[i].life) { live[i].el.remove(); live.splice(i, 1); }
  }

  function maybeNote(now) {
    if (now < nextNote || live.length >= 3) return; nextNote = now + 1700 + Math.random() * 900;
    const order = [...CITIES.keys()].map(i => ({ i, z: rot(cityVec[i])[2] })).filter(o => o.z > 0.35 && !live.some(l => l.i === o.i));
    if (!order.length) return; const pick = order[Math.floor(Math.random() * order.length)].i, el = makeNote(CITIES[pick], noteIdx++); notes.append(el); live.push({ i: pick, el, t0: now, life: 3600 });
  }

  function loop(now) {
    if (!running) return; const dt = Math.min(64, now - (last || now)); last = now; t += dt / 1000; if (!reduceMotion) lon0 += dt * 0.00011;
    maybeNote(now); draw(now); raf = requestAnimationFrame(loop);
  }
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(performance.now()); }); ro.observe(host); resize(); draw(performance.now());
  return { start() { if (running || reduceMotion) return; running = true; last = 0; raf = requestAnimationFrame(loop); }, stop() { running = false; cancelAnimationFrame(raf); } };
}
