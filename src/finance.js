// Pure money maths for the Insights view and the loan / sale tools. No DOM, no storage: everything takes enriched assets
// (see portfolio.js enrich: every figure is already in US dollars and already the owner's share) and returns plain numbers.
import { CATEGORIES } from './types.js';
import { COUNTRIES } from './places.js';

const addMonths = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const DAY = 86400000;

/** Growth factor of a value that moves by `annualPct` a year, after `days`. */
export const driftFactor = (annualPct, days) => (Number(annualPct) && days > 0 ? Math.pow(1 + Number(annualPct) / 100, days / 365) : 1);
export const daysBetween = (fromIso, toIso) => Math.floor((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY);

/* ------------------------------------------------------------------ loans */
/** Monthly payment that repays `balance` in `months` at `annualRatePct`. */
export function paymentFor(balance, annualRatePct, months) {
  const r = Number(annualRatePct) / 1200;
  if (!(balance > 0) || !(months > 0)) return 0;
  return r === 0 ? balance / months : (balance * r) / (1 - Math.pow(1 + r, -months));
}

/**
 * Pays a loan down month by month.
 * @returns {{ ok: boolean, reason?: string, months: number, totalInterest: number, totalPaid: number, payoff: string|null }}
 */
export function amortize({ balance, annualRatePct = 0, payment, extra = 0, today = new Date().toISOString().slice(0, 10), maxMonths = 1200 }) {
  const r = Number(annualRatePct) / 1200, pay = Number(payment) + Number(extra || 0);
  if (!(balance > 0)) return { ok: true, months: 0, totalInterest: 0, totalPaid: 0, payoff: today };
  if (!(pay > 0)) return { ok: false, reason: 'no-payment', months: 0, totalInterest: 0, totalPaid: 0, payoff: null };
  if (pay <= balance * r + 1e-9) return { ok: false, reason: 'too-low', months: 0, totalInterest: 0, totalPaid: 0, payoff: null };
  let bal = balance, interest = 0, paid = 0, m = 0;
  while (bal > 0.005 && m < maxMonths) {
    const i = bal * r, p = Math.min(pay, bal + i);
    interest += i; paid += p; bal = bal + i - p; m++;
  }
  if (bal > 0.005) return { ok: false, reason: 'too-long', months: m, totalInterest: interest, totalPaid: paid, payoff: null };
  return { ok: true, months: m, totalInterest: interest, totalPaid: paid, payoff: addMonths(today, m) };
}

/** Balance left after `months` of payments (stays flat when we cannot model the loan). */
export function balanceAfter({ balance, annualRatePct, payment }, months) {
  const r = Number(annualRatePct) / 1200;
  if (!(balance > 0)) return 0;
  if (!(payment > 0) || !(Number(annualRatePct) > 0)) return payment > 0 && !(Number(annualRatePct) > 0) ? Math.max(0, balance - payment * months) : balance;
  let bal = balance;
  for (let i = 0; i < months && bal > 0.005; i++) bal = Math.max(0, bal + bal * r - payment);
  return bal;
}

/* ------------------------------------------------------------------ projections */
/** Where one asset is expected to be in `years`, using its yearly rate and its loan terms when known. */
export function projectAsset(a, years) {
  const value = a.value * Math.pow(1 + (Number(a.annualChange) || 0) / 100, years);
  const modelled = a.debt > 0 && a.debtPayment > 0 && Number(a.debtRate) >= 0 && a.debtRate !== undefined;
  const debt = modelled ? balanceAfter({ balance: a.debt, annualRatePct: a.debtRate, payment: a.debtPayment }, Math.round(years * 12)) : (a.debt || 0);
  return { value, debt, net: value - debt };
}
export function projectPortfolio(assets, years) {
  return assets.reduce((t, a) => { const p = projectAsset(a, years); return { value: t.value + p.value, debt: t.debt + p.debt, net: t.net + p.net }; }, { value: 0, debt: 0, net: 0 });
}
/** True when at least one asset has a yearly rate or a loan we can model, so a projection says something. */
export const hasModel = assets => assets.some(a => Number(a.annualChange) || (a.debt > 0 && a.debtPayment > 0 && a.debtRate !== undefined && Number(a.debtRate) >= 0));

/* ------------------------------------------------------------------ concentration */
function group(assets, keyOf, labelOf) {
  const total = assets.reduce((n, a) => n + a.value, 0), m = new Map();
  for (const a of assets) { const k = keyOf(a); const cur = m.get(k) || { key: k, label: labelOf(a, k), value: 0 }; cur.value += a.value; m.set(k, cur); }
  return [...m.values()].map(x => ({ ...x, share: total > 0 ? x.value / total : 0 })).sort((p, q) => q.value - p.value);
}
/** Share of total value by asset, by kind of asset and by country. */
export function concentration(assets) {
  return {
    asset: group(assets, a => a.id, a => a.name),
    category: group(assets, a => a.category, (_, k) => CATEGORIES[k] || k),
    country: group(assets, a => a.country || '??', (a, k) => COUNTRIES[k]?.name || k),
  };
}
/** Everything above `limitPct` percent, most concentrated first. A single asset portfolio is not "concentrated", it is just small. */
export function breaches(conc, limitPct) {
  const lim = Number(limitPct) / 100, out = [];
  if (!(lim > 0)) return out;
  for (const [by, list] of Object.entries(conc)) { if (list.length < 2) continue; for (const x of list) if (x.share > lim) out.push({ by, ...x }); }
  return out.sort((a, b) => b.share - a.share);
}

/* ------------------------------------------------------------------ returns */
/** One row per asset with the income and return figures, best net yield first. */
export function yieldRows(assets) {
  const rows = assets.map(a => {
    const noi = a.gross - a.expenses, loan = (a.debtPayment || 0) * 12;
    return {
      id: a.id, name: a.name, kind: a.kind, value: a.value, cost: a.cost, earning: a.gross > 0,
      grossYield: a.gross > 0 && a.value > 0 ? a.gross / a.value : null,
      netYield: a.gross > 0 && a.value > 0 ? noi / a.value : null,
      yieldOnCost: a.gross > 0 && a.cost > 0 ? noi / a.cost : null,
      cashFlow: a.gross > 0 ? noi - loan : null,
      payback: a.gross > 0 && noi > 0 && a.cost > 0 ? a.cost / noi : null,
    };
  });
  return rows.sort((x, y) => (y.netYield ?? -Infinity) - (x.netYield ?? -Infinity));
}

/* ------------------------------------------------------------------ goal */
/** Progress towards a net-worth target, and when the current rates would get there (looking up to 40 years ahead). */
export function goalStatus(assets, goal, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const target = Number(goal?.target);
  if (!(target > 0)) return null;
  const now = assets.reduce((n, a) => n + a.value - (a.debt || 0), 0);
  const out = { target, now, pct: Math.max(0, Math.min(1, now / target)), remaining: Math.max(0, target - now), reached: now >= target, date: goal.date || null, yearsToReach: null, onTrack: null, modelled: hasModel(assets) };
  if (out.reached) { out.yearsToReach = 0; return out; }
  if (out.modelled) for (let q = 1; q <= 160; q++) if (projectPortfolio(assets, q / 4).net >= target) { out.yearsToReach = q / 4; break; }
  if (goal.date && /^\d{4}-\d{2}-\d{2}$/.test(goal.date)) {
    const yrs = daysBetween(today, goal.date) / 365;
    out.daysLeft = daysBetween(today, goal.date);
    if (yrs > 0) { out.onTrack = out.modelled ? projectPortfolio(assets, yrs).net >= target : null; out.neededPerMonth = out.remaining / Math.max(1, yrs * 12); }
  }
  return out;
}

/* ------------------------------------------------------------------ selling */
/** What is left in your pocket if you sell your share of an asset. All amounts in dollars. */
export function saleSim(a, { price = a.value, costsPct = 5, taxPct = 15 } = {}) {
  const p = Number(price), c = Math.max(0, Number(costsPct) || 0) / 100, t = Math.max(0, Number(taxPct) || 0) / 100;
  const costs = p * c, gain = p - costs - a.cost, tax = Math.max(0, gain) * t, debt = a.debt || 0;
  const net = p - costs - tax - debt;
  return { price: p, costs, gain, tax, debt, net, equityBefore: a.equity, netWorthChange: net - a.equity, underwater: net < 0 };
}
