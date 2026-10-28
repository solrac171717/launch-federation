// Portfolio value, debt and net worth over time, built from each asset's own history.
// Every point is { d, v: estimated value, b: debt balance } at the owner's full-asset scale; the owner's share is applied here.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayLabel = d => { const [y, m, day] = d.split('-'); return `${MONTHS[+m - 1]} ${+day}, ${y}`; };
const share = a => (Number(a.ownership) > 0 ? Math.min(100, Number(a.ownership)) : 100) / 100;

function pointsOf(a, today) {
  const h = (a.history || []).filter(p => p && p.d && Number.isFinite(Number(p.v)))
    .map(p => ({ d: p.d, v: Number(p.v), b: p.b == null ? undefined : Number(p.b) })).sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0));
  if (h.length) return h;
  const k = share(a); return [{ d: String(a.createdAt || today).slice(0, 10), v: a.value / k, b: a.debt / k }];
}

/** @returns {Array<{ d: string, label: string, value: number, debt: number, net: number }>} oldest first, ending at today's real totals */
export function portfolioTimeline(assets, { today = new Date().toISOString().slice(0, 10), maxPoints = 72 } = {}) {
  if (!assets.length) return [];
  const pts = assets.map(a => ({ a, k: share(a), p: pointsOf(a, today) }));
  const dates = [...new Set([...pts.flatMap(x => x.p.map(q => q.d)), today])].filter(d => d <= today).sort();
  const out = dates.map(t => {
    let value = 0, debt = 0;
    for (const { a, k, p } of pts) {
      if (t < p[0].d) continue; // not owned yet
      let cur = p[0]; for (const q of p) { if (q.d <= t) cur = q; else break; }
      const known = [...p].reverse().find(q => q.d <= t && q.b !== undefined) || p.find(q => q.b !== undefined);
      value += cur.v * k; debt += (known ? known.b : a.debt / k) * k;
    }
    return { d: t, label: dayLabel(t), value, debt, net: value - debt };
  });
  // the last point is exactly what the dashboard shows today
  const value = assets.reduce((n, a) => n + a.value, 0), debt = assets.reduce((n, a) => n + (a.debt || 0), 0);
  out[out.length - 1] = { d: today, label: dayLabel(today), value, debt, net: value - debt };
  if (out.length <= maxPoints) return out;
  const step = (out.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => out[Math.round(i * step)]);
}
