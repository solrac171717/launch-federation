// Illustrative sample portfolio used by the marketing site's product previews and the app's "load sample data".
// It is NOT customer data. Every derived figure (NOI, yield, totals) is computed here,
// so related numbers on the page can never disagree with each other.

import { enrich, portfolio as portfolioOf, allocation as allocationOf } from './portfolio.js';
import { CATEGORIES } from './types.js';
import { COUNTRIES } from './places.js';
export { CATEGORIES, COUNTRIES };

export const CITIES = {
  austin: [30.27, -97.74], miami: [25.76, -80.19], chicago: [41.88, -87.63], seattle: [47.61, -122.33],
  denver: [39.74, -104.99], nashville: [36.16, -86.78], teterboro: [40.85, -74.06],
  sttropez: [43.27, 6.64], sydney: [-33.87, 151.21], london: [51.51, -0.13], scottsdale: [33.49, -111.93], boston: [42.36, -71.06],
  columbus: [39.96, -83.0], moab: [38.57, -109.55], sturgis: [44.41, -103.51], newport: [41.49, -71.31], keywest: [24.56, -81.78],
};


// Monthly operating figures for the featured asset (Westlake Residence), Oct 2025 – Sep 2026.
export const WESTLAKE_MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
export const WESTLAKE_INCOME = Array(12).fill(5100);
export const WESTLAKE_EXPENSES = [1290, 1310, 1180, 1520, 2640, 1210, 1290, 1350, 1180, 1480, 1390, 1520];

// Appraisal / estimate history for the featured asset. The first point is the acquisition cost.
export const WESTLAKE_VALUATIONS = [
  ['Mar 2022', 520000], ['Sep 2022', 548000], ['Mar 2023', 571000], ['Sep 2023', 590000],
  ['Mar 2024', 612000], ['Sep 2024', 633000], ['Mar 2025', 651000], ['Sep 2025', 662000],
  ['Mar 2026', 674000], ['Sep 2026', 685000],
].map(([label, v]) => ({ label, v }));

const sum = a => a.reduce((s, x) => s + x, 0);

const RAW = [
  { id: 'austin', name: 'Westlake Residence', place: 'Austin, TX', category: 'residential', kind: 'Single-family rental',
    value: 685000, cost: 520000, gross: sum(WESTLAKE_INCOME), expenses: sum(WESTLAKE_EXPENSES), debt: 310000, debtPayment: 2150, status: 'Occupied' },
  { id: 'miami', name: 'Brickell Condo 14C', place: 'Miami, FL', category: 'residential', kind: 'Condominium',
    value: 912000, cost: 760000, gross: 58800, expenses: 19440, debt: 540000, debtPayment: 3480, status: 'Occupied' },
  { id: 'chicago', name: 'Lakeshore Loft', place: 'Chicago, IL', category: 'residential', kind: 'Apartment',
    value: 428000, cost: 395000, gross: 33600, expenses: 9180, debt: 230000, debtPayment: 1620, status: 'Vacant' },
  { id: 'london', name: 'Fitzroy Office Suite', place: 'London, UK', category: 'commercial', kind: 'Office',
    value: 1480000, cost: 1210000, gross: 84000, expenses: 21500, debt: 700000, debtPayment: 4100, status: 'Leased' },
  { id: 'seattle', name: 'Cascade Land Parcel', place: 'Seattle, WA', category: 'land', kind: '3.2 acres',
    value: 540000, cost: 410000, gross: 0, expenses: 2400, status: 'Held' },
  { id: 'denver', name: 'CAT 320 Excavator', place: 'Denver, CO', category: 'equipment', kind: 'Heavy equipment',
    value: 214000, cost: 268000, gross: 0, expenses: 6800, status: 'In service' },
  { id: 'scottsdale', name: 'Porsche 911 Carrera', place: 'Scottsdale, AZ', category: 'vehicle', kind: 'Automobile',
    value: 142000, cost: 126000, gross: 0, expenses: 4100, status: 'Garaged' },
  { id: 'nashville', name: 'Freightliner Cascadia', place: 'Nashville, TN', category: 'vehicle', kind: 'Commercial truck',
    value: 98000, cost: 124000, gross: 0, expenses: 5200, status: 'In service' },
  { id: 'teterboro', name: 'Citation M2', place: 'Teterboro, NJ', category: 'aircraft', kind: 'Light jet',
    value: 3150000, cost: 3400000, gross: 0, expenses: 148000, debt: 1500000, debtPayment: 9800, status: 'Hangared' },
  { id: 'boston', name: 'Back Bay Parking Space', place: 'Boston, MA', category: 'commercial', kind: 'Parking space',
    value: 74000, cost: 62000, gross: 7200, expenses: 1150, status: 'Leased' },
  { id: 'columbus', name: 'Eastside Warehouse', place: 'Columbus, OH', category: 'commercial', kind: 'Industrial warehouse',
    value: 2350000, cost: 1980000, gross: 168000, expenses: 41000, debt: 1200000, debtPayment: 7300, status: 'Leased' },
  { id: 'moab', name: 'Roamer RV 24', place: 'Moab, UT', category: 'vehicle', kind: 'Motorhome',
    value: 64000, cost: 78000, gross: 0, expenses: 3200, status: 'Garaged' },
  { id: 'sturgis', name: 'Heritage Cruiser', place: 'Sturgis, SD', category: 'vehicle', kind: 'Motorcycle',
    value: 18500, cost: 21000, gross: 0, expenses: 900, status: 'Garaged' },
  { id: 'newport', name: 'Marlin 34 Sloop', place: 'Newport, RI', category: 'vessel', kind: 'Sailboat',
    value: 86000, cost: 79000, gross: 0, expenses: 5400, status: 'Moored' },
  { id: 'keywest', name: 'Wave Runner 130', place: 'Key West, FL', category: 'vessel', kind: 'Jet ski',
    value: 11200, cost: 12800, gross: 0, expenses: 600, status: 'Stored' },
  { id: 'sttropez', name: 'Sea Atlas 52', place: 'Saint-Tropez, FR', category: 'vessel', kind: 'Motor yacht',
    value: 1120000, cost: 980000, gross: 0, expenses: 38500, status: 'Moored' },
  { id: 'sydney', name: 'Bondi Beach House', place: 'Sydney, AU', category: 'residential', kind: 'Beachfront house',
    value: 2400000, cost: 1900000, gross: 96000, expenses: 24000, debt: 1100000, debtPayment: 6500, status: 'Occupied' },
];

export const VALUATION_DATE = 'Sep 30, 2026';

const TYPE_OF = { austin: 'house', miami: 'house', chicago: 'house', london: 'office', seattle: 'land', denver: 'equipment', scottsdale: 'car', nashville: 'truck',
  teterboro: 'aircraft', sttropez: 'yacht', sydney: 'house', boston: 'parking', columbus: 'warehouse', moab: 'rv', sturgis: 'motorcycle', newport: 'sailboat', keywest: 'jetski' };
const COUNTRY_OF = { london: 'GB', sttropez: 'FR', sydney: 'AU' };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NUM = Object.fromEntries(MON.map((m, i) => [m, String(i + 1).padStart(2, '0')]));
const monthDate = n => { const t = 2026 * 12 + 8 - n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`; }; // n months before Sep 2026
const labelOf = d => `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

/** Illustrative value (and debt) history for the sample portfolio. Westlake keeps its real-looking appraisals; the others get a
 *  smooth, deterministic path from cost to today's value, so the net-worth chart has something honest-looking to draw. */
function sampleHistory(a, i) {
  if (a.id === 'austin') {
    const debtAt = j => Math.round(a.debt * (1 + 0.032 * (WESTLAKE_VALUATIONS.length - 1 - j) / 2));
    return WESTLAKE_VALUATIONS.map((p, j) => { const [m, y] = p.label.split(' '); return { d: `${y}-${MONTH_NUM[m]}-01`, v: p.v, b: j === 0 ? undefined : debtAt(j) }; });
  }
  const n = 4 + (i % 4), span = 18 + ((i * 7) % 30); // number of points, months since purchase
  return Array.from({ length: n + 1 }, (_, j) => {
    const f = j / n, ease = f * f * (3 - 2 * f), wobble = j === 0 || j === n ? 0 : Math.sin((i + 1) * (j + 2)) * 0.012 * Math.abs(a.value - a.cost);
    const v = j === n ? a.value : Math.round((a.cost + (a.value - a.cost) * ease + wobble) / 100) * 100;
    const yearsBefore = ((n - j) / n) * (span / 12), b = a.debt > 0 && j > 0 ? (j === n ? a.debt : Math.round(a.debt * (1 + 0.035 * yearsBefore))) : undefined;
    return { d: monthDate(Math.round(span * (1 - f))), v, ...(b !== undefined ? { b } : {}) };
  });
}

export const ASSETS = RAW.map((a, i) => {
  const history = sampleHistory(enrich(a), i);
  return {
    ...enrich(a),
    country: COUNTRY_OF[a.id] || 'US',
    type: TYPE_OF[a.id],
    lat: CITIES[a.id][0], lon: CITIES[a.id][1],
    history,
    series: history.map(p => ({ label: labelOf(p.d), v: p.v })),
  };
});

export const portfolio = (assets = ASSETS) => portfolioOf(assets);
export const allocation = (assets = ASSETS) => allocationOf(assets);
export const byId = id => ASSETS.find(a => a.id === id);

/** The sample portfolio as storable rows (used by the app's "Load sample data"). */
export const sampleRows = (today = new Date().toISOString().slice(0, 10)) => ASSETS.map(a => ({
  name: a.name, type: a.type, place: a.place, country: a.country, lat: a.lat, lon: a.lon, value: a.value, cost: a.cost, gross: a.gross, expenses: a.expenses, debt: a.debt, debtPayment: a.debtPayment,
  status: a.status, acquiredOn: null, notes: null, isSample: true,
  history: a.history.map(p => ({ ...p })),
}));
