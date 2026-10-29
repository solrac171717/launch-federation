// Derived figures for any list of assets (demo or real). Every ratio is computed here,
// so the numbers shown in different places of the product can never disagree.
import { toUsd } from './fx.js';
import { driftFactor, daysBetween } from './finance.js';
const sum = a => a.reduce((s, x) => s + x, 0);

/** Adds the derived fields to a raw asset ({ value, cost, gross, expenses, ... }). */
export function enrich(a) {
  // Figures are entered for the whole asset. When the owner holds only a share of it (50% of a flat, a stake in a company),
  // every figure the product shows and adds up is that share, so totals and net worth are never inflated.
  const own = Number(a.ownership) > 0 ? Math.min(100, Number(a.ownership)) : 100, k0 = own / 100;
  // An asset can be entered in its own currency; everything shown and added up is in US dollars.
  const currency = String(a.currency || 'USD').toUpperCase(), known = toUsd(currency), fxRate = known ?? 1, k = k0 * fxRate;
  // A value that moves on its own (for example -12% a year for a car) keeps moving from the day it was last confirmed.
  const days = a.valueAsOf && a.today ? daysBetween(a.valueAsOf, a.today) : 0, drift = driftFactor(a.annualChange, days);
  const gross = (Number(a.gross) || 0) * k, expenses = (Number(a.expenses) || 0) * k, value = (Number(a.value) || 0) * k * drift, cost = (Number(a.cost) || 0) * k;
  const debt = (Number(a.debt) || 0) * k, debtPayment = (Number(a.debtPayment) || 0) * k;
  const noi = gross - expenses, earning = gross > 0;
  return {
    ...a, value, cost, gross, expenses, noi, earning,
    ownership: own, fullValue: (Number(a.value) || 0) * fxRate * drift, shared: own < 100, owner: a.owner || '',
    currency, fxRate, fxMissing: known == null, drift, localValue: (Number(a.value) || 0) * k0 * drift, annualChange: Number(a.annualChange) || 0, debtRate: a.debtRate === undefined ? undefined : Number(a.debtRate) || 0,
    // Debt is the outstanding balance of the mortgage or loan secured on the asset. Equity can be negative (underwater).
    debt, debtPayment, equity: value - debt, ltv: value > 0 && debt > 0 ? debt / value : null,
    appreciation: value - cost,
    appreciationPct: cost > 0 ? (value - cost) / cost : 0,
    grossYield: earning && value > 0 ? gross / value : null,
    noiYield: earning && value > 0 ? noi / value : null,
  };
}

export function portfolio(assets) {
  const value = sum(assets.map(a => a.value));
  const cost = sum(assets.map(a => a.cost));
  const earning = assets.filter(a => a.earning);
  const noi = sum(earning.map(a => a.noi));
  const earningValue = sum(earning.map(a => a.value));
  const debt = sum(assets.map(a => a.debt || 0));
  const debtPayment = sum(assets.map(a => a.debtPayment || 0));
  return {
    value, cost, noi, count: assets.length,
    // Net worth = what everything is worth minus what is still owed on it.
    debt, debtPayment, netWorth: value - debt, ltv: value > 0 && debt > 0 ? debt / value : null,
    indebtedCount: assets.filter(a => (a.debt || 0) > 0).length,
    appreciation: value - cost,
    appreciationPct: cost > 0 ? (value - cost) / cost : 0,
    // NOI divided by the estimated value of the income-producing assets only.
    noiYield: earningValue > 0 ? noi / earningValue : null,
    earningCount: earning.length,
  };
}

export function allocation(assets) {
  const total = sum(assets.map(a => a.value));
  const m = new Map();
  for (const a of assets) m.set(a.category, (m.get(a.category) || 0) + a.value);
  return [...m].map(([key, value]) => ({ key, value, share: total ? value / total : 0 })).sort((a, b) => b.value - a.value);
}
