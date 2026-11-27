// Creates the three agency plans in Stripe (products, monthly and yearly prices, payment links) once, and prints the links.
// It never runs by itself and it is not part of the build or of the asset billing code.
//
//   node scripts/stripe-agency-plans.mjs                                           # shows what it would create (no key needed)
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-agency-plans.mjs --apply    # creates it (safe to repeat: prices are found by lookup key)
//
// Prices are in euros and exclude VAT (tax_behavior: exclusive). Yearly = 12 months with 30% off, rounded to the euro, as shown on the website.
const KEY = process.env.STRIPE_SECRET_KEY, APPLY = process.argv.includes('--apply');
const PLANS = [
  { id: 'inicial', name: 'Owned Map Inicial: agencia de SEO con IA', month: 997 },
  { id: 'crecimiento', name: 'Owned Map Crecimiento: agencia de SEO con IA', month: 2999 },
  { id: 'dominio', name: 'Owned Map Dominio: agencia de SEO con IA', month: 10000 },
];
const cents = (plan, per) => (per === 'year' ? Math.round(plan.month * 12 * 0.7) : plan.month) * 100;

if (!KEY && APPLY) { console.error('Set STRIPE_SECRET_KEY first.'); process.exit(1); }
const form = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? form(v, p ? `${p}[${k}]` : k) : [[p ? `${p}[${k}]` : k, String(v)]]));
const call = async (method, path, body) => {
  const r = await fetch('https://api.stripe.com/v1' + path, { method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: body ? new URLSearchParams(form(body)) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(`${method} ${path}: ${j.error?.message || r.status}`); return j;
};

for (const plan of PLANS) {
  const prices = {};
  for (const per of ['month', 'year']) console.log(`${plan.id} ${per}: ${(cents(plan, per) / 100).toLocaleString('es-ES')} EUR`);
  if (!APPLY) continue;
  let product;
  const found = await call('GET', `/prices?lookup_keys[]=agencia_${plan.id}_month&expand[]=data.product`);
  if (found.data[0]) product = found.data[0].product.id;
  else product = (await call('POST', '/products', { name: plan.name, metadata: { agency_plan: plan.id } })).id;
  for (const per of ['month', 'year']) {
    const key = `agencia_${plan.id}_${per}`, have = await call('GET', `/prices?lookup_keys[]=${key}`);
    prices[per] = have.data[0] || await call('POST', '/prices', { product, currency: 'eur', unit_amount: cents(plan, per), tax_behavior: 'exclusive', lookup_key: key, recurring: { interval: per } });
    const link = await call('POST', '/payment_links', { line_items: { 0: { price: prices[per].id, quantity: 1 } }, metadata: { agency_plan: plan.id, period: per } });
    console.log(`  ${key}: ${link.url}`);
  }
}
if (!APPLY) console.log('\nNothing was created. Run again with --apply to create the products, prices and payment links.');
