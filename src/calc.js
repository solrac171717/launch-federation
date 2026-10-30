// Pure portfolio maths. No DOM, no network — everything here is unit-tested.

export const CLASSES = {
  equity: 'Equities',
  crypto: 'Crypto',
  commodity: 'Commodities',
  realestate: 'Real estate',
  bond: 'Bonds',
  cash: 'Cash',
};

/** Value, cost and P&L of one holding. `price` null means "not priced yet". */
export function positionMetrics(h) {
  const cost = h.quantity * h.costPerUnit;
  const priced = Number.isFinite(h.price);
  const value = priced ? h.quantity * h.price : null;
  const pnl = priced ? value - cost : null;
  const pnlPct = priced && cost > 0 ? pnl / cost : null;
  return { cost, value, pnl, pnlPct, priced };
}

/** Portfolio totals. Unpriced holdings are carried at cost and flagged, never silently dropped. */
export function portfolioTotals(holdings) {
  let value = 0, cost = 0, unpriced = 0;
  for (const h of holdings) {
    const m = positionMetrics(h);
    cost += m.cost;
    if (m.priced) value += m.value; else { value += m.cost; unpriced++; }
  }
  const pnl = value - cost;
  return { value, cost, pnl, pnlPct: cost > 0 ? pnl / cost : null, unpriced, count: holdings.length };
}

function valueOf(h) {
  const m = positionMetrics(h);
  return m.priced ? m.value : m.cost;
}

/** Group holdings by a key function; returns [{key, value, share, count}] sorted by value desc. */
export function groupBy(holdings, keyFn) {
  const total = holdings.reduce((s, h) => s + valueOf(h), 0);
  const map = new Map();
  for (const h of holdings) {
    const k = keyFn(h);
    const g = map.get(k) || { key: k, value: 0, count: 0 };
    g.value += valueOf(h);
    g.count++;
    map.set(k, g);
  }
  return [...map.values()]
    .map(g => ({ ...g, share: total > 0 ? g.value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

export const byClass = hs => groupBy(hs, h => h.class);
export const byCountry = hs => groupBy(hs, h => h.countryId);

/** Sign of a financial figure: 'pos' | 'neg' | 'neu'. Tiny values count as neutral. */
export function tone(n, eps = 0.005) {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < eps) return 'neu';
  return n > 0 ? 'pos' : 'neg';
}

export function fmtMoney(n, { compact = false } = {}) {
  if (n == null || !Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : Math.abs(n) >= 1 ? 2 : 6,
  }).format(n);
}

export function fmtPct(n, { sign = false } = {}) {
  if (n == null || !Number.isFinite(n)) return '-';
  const s = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(Math.abs(n));
  if (!sign) return n < 0 ? '−' + s : s;
  return (n > 0 ? '+' : n < 0 ? '−' : '') + s;
}

export function fmtSigned(n, opts) {
  if (n == null || !Number.isFinite(n)) return '-';
  return (n > 0 ? '+' : n < 0 ? '−' : '') + fmtMoney(Math.abs(n), opts);
}

/** Change between first and last point of a [{t, v}] series. */
export function seriesChange(series) {
  if (!series || series.length < 2) return null;
  const a = series[0].v, b = series[series.length - 1].v;
  return { abs: b - a, pct: a !== 0 ? (b - a) / a : null };
}

/** Validate a holding form; returns {ok, errors, value}. */
export function validateHolding(raw) {
  const errors = {};
  const name = String(raw.name || '').trim();
  const quantity = Number(raw.quantity);
  const costPerUnit = Number(raw.costPerUnit);
  const price = raw.price === '' || raw.price == null ? null : Number(raw.price);
  if (!name) errors.name = 'Name is required';
  if (!(raw.class in CLASSES)) errors.class = 'Choose an asset class';
  if (!raw.countryId) errors.countryId = 'Choose a country';
  if (!(quantity > 0)) errors.quantity = 'Quantity must be greater than 0';
  if (!(costPerUnit >= 0) || raw.costPerUnit === '') errors.costPerUnit = 'Enter the cost per unit (0 or more)';
  if (price != null && !(price >= 0)) errors.price = 'Price must be 0 or more';
  const ok = Object.keys(errors).length === 0;
  return {
    ok, errors,
    value: ok ? {
      name, symbol: String(raw.symbol || '').trim().toUpperCase(), class: raw.class,
      countryId: String(raw.countryId), quantity, costPerUnit, price,
      coingeckoId: String(raw.coingeckoId || '').trim().toLowerCase() || null,
    } : null,
  };
}

/** RFC-4180-ish CSV with injection guard for spreadsheet formulas. */
export function toCsv(rows, columns) {
  const esc = v => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [columns.map(c => esc(c.label)).join(','),
    ...rows.map(r => columns.map(c => esc(c.get(r))).join(','))].join('\r\n');
}
