// Import assets from a CSV (e.g. exported from Excel or Google Sheets). Every row goes through the same
// validation as the add-asset form, so imported data can never be worse than typed data.
import { currencies, hasRates } from './fx.js';
import { validateAsset } from './asset-store.js';
import { ASSET_TYPES, TYPE_BY_KEY, ALL_STATUSES } from './types.js';
import { COUNTRIES } from './places.js';

/** RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes, and comma / semicolon / tab delimiters. */
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] || '';
  const count = ch => { let n = 0, q = false; for (const c of first) { if (c === '"') q = !q; else if (!q && c === ch) n++; } return n; };
  const delim = [',', ';', '	'].map(d => [d, count(d)]).sort((x, y) => y[1] - x[1])[0];
  const sep = delim[1] ? delim[0] : ',';
  const rows = []; let row = [], cell = '', q = false, i = 0, line = 1, start = 1;
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); if (row.some(c => c.trim() !== '')) rows.push({ line: start, cells: row }); row = []; start = line + 1; };
  while (i < src.length) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else { if (c === '\n') line++; cell += c; }
    } else if (c === '"' && cell === '') q = true;
    else if (c === sep) endCell();
    else if (c === '\n') { endRow(); line++; start = line; }
    else if (c !== '\r') cell += c;
    i++;
  }
  if (cell !== '' || row.length) endRow();
  return { delimiter: sep, rows };
}

const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const ALIASES = {
  name: ['name', 'asset', 'asset name', 'title'],
  type: ['type', 'asset type', 'category', 'kind'],
  place: ['place', 'location', 'city', 'address'],
  country: ['country', 'country code'],
  lat: ['lat', 'latitude'], lon: ['lon', 'lng', 'long', 'longitude'],
  value: ['value', 'estimated value', 'current value', 'market value'],
  cost: ['cost', 'acquisition cost', 'purchase price', 'purchase cost', 'price paid'],
  gross: ['income', 'annual income', 'gross income', 'yearly income', 'rent', 'revenue'],
  expenses: ['expenses', 'annual expenses', 'yearly expenses', 'costs per year'],
  grossM: ['monthly income', 'income per month', 'monthly rent', 'rent per month', 'monthly revenue'],
  expensesM: ['monthly expenses', 'expenses per month', 'monthly costs'],
  ownership: ['ownership', 'ownership percent', 'share', 'my share', 'owned', 'percent owned', 'ownership share'],
  currency: ['currency', 'currency code', 'ccy', 'moneda', 'divisa'],
  debtRate: ['interest rate', 'loan rate', 'mortgage rate', 'debt rate', 'rate'],
  annualChange: ['yearly change', 'annual change', 'value change', 'appreciation rate', 'depreciation rate'],
  owner: ['owner', 'legal owner', 'held by', 'title holder', 'titleholder', 'owned by'],
  debt: ['debt', 'loan', 'mortgage', 'outstanding debt', 'loan balance', 'mortgage balance', 'amount owed'],
  debtPayment: ['monthly payment', 'debt payment', 'loan payment', 'mortgage payment'],
  status: ['status'], acquiredOn: ['acquired', 'acquired on', 'purchase date', 'date acquired', 'bought'], notes: ['notes', 'note', 'comments'],
};
const FIELD_OF = Object.fromEntries(Object.entries(ALIASES).flatMap(([k, list]) => list.map(a => [a, k])));

const TYPE_WORDS = {
  house: ['house', 'apartment', 'condo', 'condominium', 'home', 'residential', 'flat', 'villa', 'house or apartment', 'single family'],
  office: ['office', 'commercial', 'retail', 'shop', 'store', 'commercial building'], warehouse: ['warehouse', 'industrial', 'industrial unit', 'factory'],
  parking: ['parking', 'parking space', 'garage'], land: ['land', 'lot', 'plot', 'parcel'],
  car: ['car', 'auto', 'automobile', 'vehicle', 'sedan', 'suv'], truck: ['truck', 'van', 'lorry'], motorcycle: ['motorcycle', 'motorbike', 'bike', 'moto'],
  rv: ['rv', 'motorhome', 'camper', 'campervan', 'caravan'], yacht: ['yacht', 'boat', 'motor yacht', 'powerboat'], sailboat: ['sailboat', 'sailing boat', 'sailing yacht', 'sloop'],
  jetski: ['jet ski', 'jetski', 'personal watercraft', 'pwc', 'jet-ski'], aircraft: ['aircraft', 'plane', 'jet', 'airplane', 'helicopter'],
  equipment: ['equipment', 'machinery', 'excavator', 'tractor', 'heavy equipment'],
};
const TYPE_LOOKUP = new Map();
for (const t of ASSET_TYPES) { TYPE_LOOKUP.set(norm(t.key), t.key); TYPE_LOOKUP.set(norm(t.label), t.key); }
for (const [k, list] of Object.entries(TYPE_WORDS)) for (const w of list) if (!TYPE_LOOKUP.has(norm(w))) TYPE_LOOKUP.set(norm(w), k);

const COUNTRY_LOOKUP = new Map();
for (const [code, c] of Object.entries(COUNTRIES)) { COUNTRY_LOOKUP.set(norm(code), code); COUNTRY_LOOKUP.set(norm(c.name), code); COUNTRY_LOOKUP.set(norm(c.short), code); }
COUNTRY_LOOKUP.set('usa', 'US'); COUNTRY_LOOKUP.set('united states', 'US'); COUNTRY_LOOKUP.set('uk', 'GB'); COUNTRY_LOOKUP.set('england', 'GB');
const STATUS_LOOKUP = new Map(ALL_STATUSES.map(x => [norm(x), x]));

function toIsoDate(v) {
  const s = String(v || '').trim(); if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // US order: month/day/year
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : s;
}

export const TEMPLATE_HEADERS = ['name', 'type', 'location', 'value', 'cost', 'annual income', 'annual expenses', 'debt', 'monthly payment', 'ownership', 'owner', 'status', 'acquired on', 'notes'];
export const TEMPLATE_CSV = [TEMPLATE_HEADERS.join(','),
  'Lake House,house,"Austin, TX",685000,520000,61200,17360,310000,2150,50,Lake House LLC,Occupied,2022-03-01,Rented since 2023',
  'Porsche 911,car,"Scottsdale, AZ",142000,126000,0,4100,0,0,100,Me,Garaged,2024-06-15,'].join('\n') + '\n';

/**
 * @returns {{ ok: boolean, error?: string, rows: Array<{ line: number, name: string, ok: boolean, errors: string[], value?: object, dupe?: boolean }>, delimiter?: string }}
 */
export function previewImport(text, { today = new Date().toISOString().slice(0, 10), existing = [], maxRows = 500 } = {}) {
  const { rows: raw, delimiter } = parseCsv(text);
  if (raw.length < 2) return { ok: false, error: 'The file needs a header row and at least one asset.', rows: [] };
  if (raw.length - 1 > maxRows) return { ok: false, error: `That file has ${raw.length - 1} rows. Import up to ${maxRows} at a time.`, rows: [] };
  const header = raw[0].cells.map(c => FIELD_OF[norm(c)] || null);
  const missing = ['name', 'type', 'value', 'cost'].filter(k => !header.includes(k));
  if (!header.includes('place') && !(header.includes('country') && header.includes('lat') && header.includes('lon'))) missing.push('location');
  if (missing.length) return { ok: false, error: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template to see the expected columns.`, rows: [] };

  const known = new Set(existing.map(a => `${norm(a.name)}|${norm(a.place)}`));
  const seen = new Set();
  const rows = raw.slice(1).map(({ line, cells }) => {
    const r = {}; header.forEach((k, i) => { if (k && r[k] === undefined) r[k] = (cells[i] ?? '').trim(); });
    const errors = [];
    const typeKey = TYPE_LOOKUP.get(norm(r.type)) || (TYPE_BY_KEY[r.type] ? r.type : '');
    if (!typeKey) errors.push(`Unknown type “${r.type || ''}”. Use one of: ${ASSET_TYPES.map(t => t.key).join(', ')}.`);
    const t = TYPE_BY_KEY[typeKey];
    let status = r.status ? (STATUS_LOOKUP.get(norm(r.status)) || r.status) : (t ? t.statuses[0] : '');
    const countryCode = r.country ? (COUNTRY_LOOKUP.get(norm(r.country)) || '') : '';
    const hasCoords = r.lat !== undefined && r.lat !== '' && r.lon !== undefined && r.lon !== '';
    const yearly = (y, m) => (y !== undefined && y !== '' ? y : (m !== undefined && m !== '' && Number.isFinite(Number(String(m).replace(/[$,\s]/g, ''))) ? String(Number(String(m).replace(/[$,\s]/g, '')) * 12) : y));
    const input = { type: typeKey, name: r.name, value: r.value, cost: r.cost, gross: yearly(r.gross, r.grossM), expenses: yearly(r.expenses, r.expensesM), ownership: r.ownership, owner: r.owner, debt: r.debt, debtPayment: r.debtPayment, currency: r.currency, debtRate: r.debtRate, annualChange: r.annualChange, status, acquiredOn: toIsoDate(r.acquiredOn), notes: r.notes, place: r.place };
    let v = validateAsset(input, { today });
    if (!v.ok && v.errors.place && hasCoords) { // not a listed city: use the coordinates from the file
      v = validateAsset({ ...input, customPlace: true, placeName: r.place, country: countryCode || r.country, lat: r.lat, lon: r.lon }, { today });
    }
    if (!v.ok) errors.push(...Object.entries(v.errors).filter(([k, m]) => !errors.includes(m) && !(!typeKey && (k === 'type' || k === 'status'))).map(([, m]) => m));
    else if (v.value.currency !== 'USD' && hasRates() && !currencies().includes(v.value.currency)) errors.push(`The currency ${v.value.currency} is not supported. Use USD or one of: ${currencies().filter(c => c !== 'USD').join(', ')}.`);
    else if (typeKey && !errors.length) {
      const key = `${norm(v.value.name)}|${norm(v.value.place)}`;
      const dupe = known.has(key) || seen.has(key); seen.add(key);
      return { line, name: v.value.name, ok: true, errors: [], value: v.value, dupe };
    }
    return { line, name: r.name || `(row ${line})`, ok: false, errors };
  });
  return { ok: true, rows, delimiter };
}
