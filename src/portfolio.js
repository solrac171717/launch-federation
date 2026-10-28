// Derived figures for any list of assets (demo or real). Every ratio is computed here,
// so the numbers shown in different places of the product can never disagree.
const sum = a => a.reduce((s, x) => s + x, 0);

/** Adds the derived fields to a raw asset ({ value, cost, gross, expenses, ... }). */
export function enrich(a) {
  const gross = Number(a.gross) || 0, expenses = Number(a.expenses) || 0, value = Number(a.value) || 0, cost = Number(a.cost) || 0;
  const noi = gross - expenses, earning = gross > 0;
  return {
    ...a, value, cost, gross, expenses, noi, earning,
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
  return {
    value, cost, noi, count: assets.length,
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
