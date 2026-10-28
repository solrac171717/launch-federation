// Derived figures for any list of assets (demo or real). Every ratio is computed here,
// so the numbers shown in different places of the product can never disagree.
const sum = a => a.reduce((s, x) => s + x, 0);

/** Adds the derived fields to a raw asset ({ value, cost, gross, expenses, ... }). */
export function enrich(a) {
  // Figures are entered for the whole asset. When the owner holds only a share of it (50% of a flat, a stake in a company),
  // every figure the product shows and adds up is that share, so totals and net worth are never inflated.
  const own = Number(a.ownership) > 0 ? Math.min(100, Number(a.ownership)) : 100, k = own / 100;
  const gross = (Number(a.gross) || 0) * k, expenses = (Number(a.expenses) || 0) * k, value = (Number(a.value) || 0) * k, cost = (Number(a.cost) || 0) * k;
  const debt = (Number(a.debt) || 0) * k, debtPayment = (Number(a.debtPayment) || 0) * k;
  const noi = gross - expenses, earning = gross > 0;
  return {
    ...a, value, cost, gross, expenses, noi, earning,
    ownership: own, fullValue: (Number(a.value) || 0), shared: own < 100, owner: a.owner || '',
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
