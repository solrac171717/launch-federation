// Persistence: holdings + recorded value snapshots live in localStorage.
const KEY = 'atlas.v1';

const empty = () => ({ holdings: [], snapshots: [], priceLog: {} });

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || !Array.isArray(raw.holdings)) return empty();
    return { ...empty(), ...raw };
  } catch { return empty(); }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

/** Record a real price observation for a holding (one per day, latest wins). */
export function logPrice(state, id, price) {
  if (!Number.isFinite(price)) return;
  const log = (state.priceLog[id] ||= []);
  const d = day();
  const last = log[log.length - 1];
  if (last && last.d === d) last.v = price; else log.push({ d, v: price });
}

/** Record total portfolio value (one per day). */
export function snapshot(state, value) {
  if (!Number.isFinite(value) || state.holdings.length === 0) return;
  const d = day();
  const last = state.snapshots[state.snapshots.length - 1];
  if (last && last.d === d) last.v = value; else state.snapshots.push({ d, v: value });
}

export function exportJson(state) {
  return JSON.stringify({ app: 'atlas', version: 1, ...state }, null, 2);
}

export function parseImport(text) {
  const data = JSON.parse(text);
  if (!data || data.app !== 'atlas' || !Array.isArray(data.holdings)) throw new Error('Not an ATLAS export file');
  const ok = data.holdings.every(h => h && typeof h.name === 'string' && h.quantity > 0 && h.costPerUnit >= 0 && h.countryId && h.class);
  if (!ok) throw new Error('Export file contains invalid holdings');
  return {
    holdings: data.holdings.map(h => ({ ...h, id: h.id || newId() })),
    snapshots: Array.isArray(data.snapshots) ? data.snapshots : [],
    priceLog: data.priceLog && typeof data.priceLog === 'object' ? data.priceLog : {},
  };
}
