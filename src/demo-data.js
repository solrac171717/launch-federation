// Illustrative sample portfolio used by the marketing site's product previews.
// It is NOT customer data. Every derived figure (NOI, yield, totals) is computed here,
// so related numbers on the page can never disagree with each other.

export const CITIES = {
  austin: [30.27, -97.74], miami: [25.76, -80.19], chicago: [41.88, -87.63], seattle: [47.61, -122.33],
  denver: [39.74, -104.99], nashville: [36.16, -86.78], teterboro: [40.85, -74.06],
  lisbon: [38.72, -9.14], london: [51.51, -0.13], scottsdale: [33.49, -111.93],
};

export const CATEGORIES = {
  residential: 'Residential',
  commercial: 'Commercial',
  land: 'Land',
  vehicle: 'Vehicles',
  vessel: 'Vessels',
  aircraft: 'Aircraft',
  equipment: 'Equipment',
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
    value: 685000, cost: 520000, gross: sum(WESTLAKE_INCOME), expenses: sum(WESTLAKE_EXPENSES), status: 'Occupied' },
  { id: 'miami', name: 'Brickell Condo 14C', place: 'Miami, FL', category: 'residential', kind: 'Condominium',
    value: 912000, cost: 760000, gross: 58800, expenses: 19440, status: 'Occupied' },
  { id: 'chicago', name: 'Lakeshore Loft', place: 'Chicago, IL', category: 'residential', kind: 'Apartment',
    value: 428000, cost: 395000, gross: 33600, expenses: 9180, status: 'Vacant' },
  { id: 'london', name: 'Fitzroy Office Suite', place: 'London, UK', category: 'commercial', kind: 'Office',
    value: 1480000, cost: 1210000, gross: 84000, expenses: 21500, status: 'Leased' },
  { id: 'seattle', name: 'Cascade Land Parcel', place: 'Seattle, WA', category: 'land', kind: '3.2 acres',
    value: 540000, cost: 410000, gross: 0, expenses: 2400, status: 'Held' },
  { id: 'denver', name: 'CAT 320 Excavator', place: 'Denver, CO', category: 'equipment', kind: 'Heavy equipment',
    value: 214000, cost: 268000, gross: 0, expenses: 6800, status: 'In service' },
  { id: 'scottsdale', name: 'Porsche 911 Carrera', place: 'Scottsdale, AZ', category: 'vehicle', kind: 'Automobile',
    value: 142000, cost: 126000, gross: 0, expenses: 4100, status: 'Garaged' },
  { id: 'nashville', name: 'Freightliner Cascadia', place: 'Nashville, TN', category: 'vehicle', kind: 'Commercial truck',
    value: 98000, cost: 124000, gross: 0, expenses: 5200, status: 'In service' },
  { id: 'teterboro', name: 'Citation M2', place: 'Teterboro, NJ', category: 'aircraft', kind: 'Light jet',
    value: 3150000, cost: 3400000, gross: 0, expenses: 148000, status: 'Hangared' },
  { id: 'lisbon', name: 'Sea Atlas 52', place: 'Lisbon, PT', category: 'vessel', kind: 'Motor yacht',
    value: 1120000, cost: 980000, gross: 0, expenses: 38500, status: 'Moored' },
];

export const VALUATION_DATE = 'Sep 30, 2026';

export const ASSETS = RAW.map(a => {
  const noi = a.gross - a.expenses;
  const earning = a.gross > 0;
  return {
    ...a,
    noi,
    earning,
    appreciation: a.value - a.cost,
    appreciationPct: (a.value - a.cost) / a.cost,
    grossYield: earning ? a.gross / a.value : null,
    noiYield: earning ? noi / a.value : null,
  };
});

export function portfolio(assets = ASSETS) {
  const value = sum(assets.map(a => a.value));
  const cost = sum(assets.map(a => a.cost));
  const earning = assets.filter(a => a.earning);
  const noi = sum(earning.map(a => a.noi));
  const earningValue = sum(earning.map(a => a.value));
  return {
    value, cost, noi, count: assets.length,
    appreciation: value - cost,
    appreciationPct: (value - cost) / cost,
    // NOI divided by the estimated value of the income-producing assets only.
    noiYield: earningValue > 0 ? noi / earningValue : null,
    earningCount: earning.length,
  };
}

export function allocation(assets = ASSETS) {
  const total = sum(assets.map(a => a.value));
  const m = new Map();
  for (const a of assets) m.set(a.category, (m.get(a.category) || 0) + a.value);
  return [...m].map(([key, value]) => ({ key, value, share: value / total })).sort((a, b) => b.value - a.value);
}

export const byId = id => ASSETS.find(a => a.id === id);
