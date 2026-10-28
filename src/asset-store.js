// Where the user's assets live: Supabase when the site is configured for it, otherwise this device (localStorage).
// Both stores expose the same async interface, so the app never cares which one it is talking to.
import { enrich } from './portfolio.js';
import { TYPE_BY_KEY, ALL_STATUSES } from './types.js';
import { COUNTRIES, findCity } from './places.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isoDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const label = d => { const [y, m] = d.split('-'); return `${MONTHS[+m - 1]} ${y}`; };
export const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);

/** Validates and normalises the add/edit form. Returns { ok, errors, value }. */
export function validateAsset(input, { today = isoDay() } = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  if (!name) errors.name = 'Give the asset a name.'; else if (name.length > 80) errors.name = 'Keep the name under 80 characters.';
  const type = TYPE_BY_KEY[input.type];
  if (!type) errors.type = 'Choose what kind of asset this is.';

  const num = (k, { min = 0, required = true, gt = false } = {}) => {
    const raw = input[k];
    if (raw === '' || raw == null) { if (required) errors[k] = 'Enter an amount.'; return required ? NaN : 0; }
    const n = Number(String(raw).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(n)) { errors[k] = 'Enter a number.'; return NaN; }
    if (gt ? n <= min : n < min) { errors[k] = gt ? 'Must be greater than zero.' : 'Cannot be negative.'; return NaN; }
    if (n > 1e12) { errors[k] = 'That amount is too large.'; return NaN; }
    return n;
  };
  const value = num('value'), cost = num('cost', { gt: true }), gross = num('gross', { required: false }), expenses = num('expenses', { required: false });
  const debt = num('debt', { required: false }), debtPayment = num('debtPayment', { required: false });

  // Location: a city from the built-in list, or a custom place with country and coordinates.
  let place = '', country = '', lat = null, lon = null;
  if (input.customPlace) {
    place = String(input.placeName || '').trim(); country = String(input.country || '');
    lat = Number(input.lat); lon = Number(input.lon);
    if (!place) errors.place = 'Enter the city or place name.';
    if (!COUNTRIES[country]) errors.country = 'Choose a country.';
    if (input.lat === '' || input.lat == null || !Number.isFinite(lat) || lat < -90 || lat > 90) errors.lat = 'Latitude must be between -90 and 90.';
    if (input.lon === '' || input.lon == null || !Number.isFinite(lon) || lon < -180 || lon > 180) errors.lon = 'Longitude must be between -180 and 180.';
    if (place && COUNTRIES[country]) place = `${place}, ${COUNTRIES[country].short}`;
  } else {
    const c = findCity(input.place);
    if (!c) errors.place = 'Pick a city from the list, or choose "My city isn\'t listed".';
    else { place = `${c[0]}, ${c[1]}`; country = c[2]; lat = c[3]; lon = c[4]; }
  }

  const status = String(input.status || (type ? type.statuses[0] : ''));
  if (!ALL_STATUSES.includes(status)) errors.status = 'Choose a status.';
  const acquiredOn = String(input.acquiredOn || '');
  if (acquiredOn && (!/^\d{4}-\d{2}-\d{2}$/.test(acquiredOn) || acquiredOn > today)) errors.acquiredOn = 'Use a date that is not in the future.';
  const notes = String(input.notes || '').trim();
  if (notes.length > 500) errors.notes = 'Keep notes under 500 characters.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, errors, value: { name, type: type.key, place, country, lat, lon, value, cost, gross, expenses, debt, debtPayment, status, acquiredOn: acquiredOn || null, notes: notes || null } };
}

/** History after saving: starts at acquisition, then one point each time the estimated value changes. */
export function nextHistory(prev, { value, cost, acquiredOn }, { today = isoDay(), isNew = false } = {}) {
  let h = Array.isArray(prev) ? prev.filter(p => p && p.d && Number.isFinite(p.v)) : [];
  if (isNew || !h.length) {
    h = [];
    if (acquiredOn && acquiredOn < today) h.push({ d: acquiredOn, v: cost });
    h.push({ d: today, v: value });
    return h;
  }
  const last = h[h.length - 1];
  if (last.v !== value) {
    if (last.d === today) h[h.length - 1] = { d: today, v: value }; else h.push({ d: today, v: value });
  }
  return h;
}

/** Stored row -> the object the dashboard renders (derived metrics + chart series). */
export function toView(row) {
  const t = TYPE_BY_KEY[row.type] || { category: 'residential', label: 'Asset' };
  const hist = (row.history || []).filter(p => p && p.d).sort((a, b) => (a.d < b.d ? -1 : 1));
  return {
    ...enrich({ ...row, gross: row.gross, expenses: row.expenses }),
    category: t.category, kind: t.label,
    status: row.status || 'Held',
    series: hist.length >= 2 ? hist.map(p => ({ label: label(p.d), v: Number(p.v) })) : null,
  };
}

// Zero debt is the column default, so it is left out: accounts keep working even before the debt columns exist in the database.
const toRow = v => ({ ...v, acquired_on: v.acquiredOn, acquiredOn: undefined, debt: v.debt > 0 ? v.debt : undefined, debt_payment: v.debtPayment > 0 ? v.debtPayment : undefined, debtPayment: undefined });
const fromDb = r => ({
  id: r.id, name: r.name, type: r.type, place: r.place, country: r.country, lat: r.lat, lon: r.lon,
  value: Number(r.value), cost: Number(r.cost), gross: Number(r.gross), expenses: Number(r.expenses), debt: Number(r.debt || 0), debtPayment: Number(r.debt_payment || 0),
  status: r.status, acquiredOn: r.acquired_on, notes: r.notes, history: r.history || [], isSample: !!r.is_sample, createdAt: r.created_at,
});

/* ------------------------------------------------------------------ this device */
export function createLocalStore(storage = globalThis.localStorage, key = 'atlas.assets.v1') {
  const read = () => { try { const v = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = list => { try { storage.setItem(key, JSON.stringify(list)); } catch { throw new Error('This browser cannot save data (storage is full or blocked).'); } };
  return {
    kind: 'device',
    async list() { return read().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); },
    async add(v, extra = {}) {
      const row = { id: newId(), ...v, history: nextHistory([], v, { isNew: true }), isSample: false, createdAt: new Date().toISOString(), ...extra };
      write([...read(), row]); return row;
    },
    async addMany(rows) { const stamped = rows.map(r => ({ id: newId(), isSample: false, createdAt: new Date().toISOString(), ...r, history: r.history || nextHistory([], r, { isNew: true }) })); write([...read(), ...stamped]); return stamped; },
    async update(id, v) {
      const list = read(), i = list.findIndex(r => r.id === id);
      if (i < 0) throw new Error('That asset no longer exists.');
      list[i] = { ...list[i], ...v, history: nextHistory(list[i].history, v, {}), isSample: false }; write(list); return list[i];
    },
    async remove(id) { write(read().filter(r => r.id !== id)); },
    async removeSample() { write(read().filter(r => !r.isSample)); },
  };
}

/* ------------------------------------------------------------------ Supabase */
export function createCloudStore(cloud) {
  const sel = 'select=*&order=created_at.asc';
  return {
    kind: 'cloud',
    async list() { return (await cloud.rest('GET', `/assets?${sel}`)).map(fromDb); },
    async add(v, extra = {}) {
      const body = { ...toRow(v), history: nextHistory([], v, { isNew: true }), is_sample: false, ...extra };
      const [r] = await cloud.rest('POST', '/assets', body, { prefer: 'return=representation' }); return fromDb(r);
    },
    async addMany(rows) {
      const body = rows.map(r => { const { isSample, createdAt, id, ...rest } = r; return { ...toRow(rest), history: r.history || nextHistory([], r, { isNew: true }), is_sample: !!isSample }; });
      return (await cloud.rest('POST', '/assets', body, { prefer: 'return=representation' })).map(fromDb);
    },
    async update(id, v, { hadDebt = false } = {}) {
      const cur = (await cloud.rest('GET', `/assets?id=eq.${encodeURIComponent(id)}&select=history`))[0];
      if (!cur) throw new Error('That asset no longer exists.');
      // paying a debt off must overwrite the stored value with 0 (zero is normally omitted, see toRow)
      const zero = hadDebt ? { ...(v.debt > 0 ? {} : { debt: 0 }), ...(v.debtPayment > 0 ? {} : { debt_payment: 0 }) } : {};
      const body = { ...toRow(v), ...zero, history: nextHistory(cur.history, v, {}), is_sample: false, updated_at: new Date().toISOString() };
      const [r] = await cloud.rest('PATCH', `/assets?id=eq.${encodeURIComponent(id)}`, body, { prefer: 'return=representation' });
      if (!r) throw new Error('That asset no longer exists.');
      return fromDb(r);
    },
    async remove(id) { await cloud.rest('DELETE', `/assets?id=eq.${encodeURIComponent(id)}`); },
    async removeSample() { await cloud.rest('DELETE', '/assets?is_sample=eq.true'); },
  };
}
