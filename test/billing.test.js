import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN, priceCents, extraQty, cleanAssets, usd, allowedFromItems, billingView } from '../src/billing-core.js';
import { formEncode, verifySignature, signPayload, ensurePrices, subscriptionRow, stripeClient } from '../api/_stripe.js';
import { runBilling } from '../api/billing.js';
import { runWebhook } from '../api/stripe-webhook.js';

/* ----------------------------------------------------------------- the plan */
test('the price is the one on the website: $47 with 3 assets, then $15 for each extra', () => {
  assert.equal(priceCents(1), 4700); assert.equal(priceCents(3), 4700);
  assert.equal(priceCents(4), 6200); assert.equal(priceCents(10), 4700 + 7 * 1500); assert.equal(priceCents(50), 4700 + 47 * 1500);
  assert.equal(usd(4700), '$47'); assert.equal(usd(6250), '$62.50');
});
test('what a person types is clamped to what the plan allows', () => {
  assert.equal(cleanAssets('7'), 7); assert.equal(cleanAssets(0), 3); assert.equal(cleanAssets(999), 50); assert.equal(cleanAssets('abc'), null); assert.equal(cleanAssets(7.6), 8);
  assert.equal(extraQty(3), 0); assert.equal(extraQty(10), 7);
});
test('assets paid for come from the base plan plus the extra items, and only from ours', () => {
  const b = PLAN.keys.base, e = PLAN.keys.extra;
  assert.equal(allowedFromItems([{ lookup_key: b, quantity: 1 }]), 3);
  assert.equal(allowedFromItems([{ lookup_key: b, quantity: 1 }, { lookup_key: e, quantity: 7 }]), 10);
  assert.equal(allowedFromItems([{ lookup_key: e, quantity: 7 }]), 0, 'extras without the base plan give nothing');
  assert.equal(allowedFromItems([{ lookup_key: 'something_else', quantity: 5 }]), 0);
});
test('the screen state: none, trial, active, past due, ending, ended, unlimited', () => {
  const now = Date.parse('2026-11-10T00:00:00Z'), row = over => ({ status: 'active', assets_allowed: 5, current_period_end: '2026-12-01T00:00:00Z', trial_end: null, cancel_at_period_end: false, ...over });
  assert.equal(billingView(null, { now }).state, 'none'); assert.equal(billingView(null, { now }).trialAvailable, true);
  assert.equal(billingView(row({ status: 'trialing', trial_end: '2026-11-15T00:00:00Z' }), { now, used: 2 }).trialDaysLeft, 5);
  assert.equal(billingView(row(), { now, used: 5 }).canAdd, false); assert.equal(billingView(row(), { now, used: 4 }).canAdd, true);
  assert.equal(billingView(row({ status: 'past_due' }), { now }).state, 'past_due');
  assert.match(billingView(row({ cancel_at_period_end: true }), { now }).label, /Ends 2026-12-01/);
  const ended = billingView(row({ status: 'canceled', trial_end: '2026-10-01T00:00:00Z' }), { now });
  assert.equal(ended.state, 'ended'); assert.equal(ended.trialAvailable, false, 'one free trial per person');
  assert.equal(billingView(null, { superadmin: true }).state, 'comped'); assert.equal(billingView(row({ status: 'comped' })).state, 'comped');
});

/* ----------------------------------------------------------------- Stripe plumbing */
test('forms are encoded the way Stripe expects, with brackets and indexes', () => {
  const s = decodeURIComponent(formEncode({ mode: 'subscription', line_items: [{ price: 'p1', quantity: 1 }, { price: 'p2', quantity: 4 }], subscription_data: { metadata: { user_id: 'u1' } }, skip: undefined, no: null }));
  assert.equal(s, 'mode=subscription&line_items[0][price]=p1&line_items[0][quantity]=1&line_items[1][price]=p2&line_items[1][quantity]=4&subscription_data[metadata][user_id]=u1');
  assert.equal(decodeURIComponent(formEncode({ lookup_keys: ['a', 'b'] })), 'lookup_keys[0]=a&lookup_keys[1]=b');
});
test('webhook signatures: valid, tampered, wrong secret, too old, missing', () => {
  const raw = '{"id":"evt_1"}', secret = 'whsec_x', now = 1_800_000_000, good = signPayload(raw, secret, now);
  assert.equal(verifySignature(raw, good, secret, now), true);
  assert.equal(verifySignature(raw + ' ', good, secret, now), false);
  assert.equal(verifySignature(raw, good, 'whsec_other', now), false);
  assert.equal(verifySignature(raw, good, secret, now + 301), false);
  assert.equal(verifySignature(raw, '', secret, now), false); assert.equal(verifySignature(raw, 't=abc,v1=zz', secret, now), false);
  assert.equal(verifySignature(raw, `${good},v1=00`, secret, now), true, 'any matching v1 is enough (Stripe rotates secrets)');
});
test('a subscription becomes our row, with the right number of assets and dates', () => {
  const sub = { id: 'sub_1', customer: 'cus_1', status: 'trialing', trial_end: 1_800_000_000, cancel_at_period_end: false, items: { data: [{ quantity: 1, price: { lookup_key: PLAN.keys.base }, current_period_end: 1_802_000_000 }, { quantity: 2, price: { lookup_key: PLAN.keys.extra } }] } };
  const row = subscriptionRow(sub, 'u1', 123);
  assert.equal(row.assets_allowed, 5); assert.equal(row.status, 'trialing'); assert.equal(row.stripe_customer_id, 'cus_1');
  assert.equal(row.trial_end, new Date(1_800_000_000_000).toISOString()); assert.equal(row.current_period_end, new Date(1_802_000_000_000).toISOString()); assert.equal(row.last_event_at, 123);
});

/* ----------------------------------------------------------------- a fake Stripe and a fake database */
function world({ subRow = null, user = { id: 'u1', email: 'a@x.test' }, prices = [] } = {}) {
  const calls = [], saved = [], state = { prices: [...prices], products: [], subRow, subs: new Map() };
  const json = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url), method = init.method || 'GET', form = init.body && !String(init.body).startsWith('{') ? Object.fromEntries(new URLSearchParams(init.body)) : null;
    if (u.hostname === 'stripe.test') {
      const p = u.pathname; calls.push({ method, p, form, q: Object.fromEntries(u.searchParams) });
      if (init.headers.authorization !== 'Bearer sk_test_x') return json({ error: { message: 'bad key' } }, false, 401);
      if (p === '/v1/prices' && method === 'GET') return json({ data: state.prices.filter(x => x.active) });
      if (p === '/v1/products' && method === 'GET') return json({ data: state.products });
      if (p === '/v1/products') { const pr = { id: 'prod_1', metadata: { app: 'owned-map' } }; state.products.push(pr); return json(pr); }
      if (p === '/v1/prices') { const pr = { id: `price_${form.lookup_key}`, lookup_key: form.lookup_key, active: true }; state.prices.push(pr); return json(pr); }
      if (p === '/v1/customers') return json({ id: 'cus_new' });
      if (p === '/v1/checkout/sessions') return json({ id: 'cs_1', url: 'https://checkout.test/cs_1' });
      if (p === '/v1/billing_portal/sessions') return json({ url: 'https://portal.test/x' });
      const m = /^\/v1\/subscriptions\/(.+)$/.exec(p);
      if (m) { if (method === 'POST') { const it = Object.keys(form).filter(k => k.startsWith('items[0]')); state.lastUpdate = { it: Object.fromEntries(it.map(k => [k, form[k]])), proration: form.proration_behavior }; const s = state.subs.get(m[1]); if (form['items[0][deleted]']) s.items.data = s.items.data.filter(x => x.id !== form['items[0][id]']); else if (form['items[0][id]']) s.items.data.find(x => x.id === form['items[0][id]']).quantity = Number(form['items[0][quantity]']); else s.items.data.push({ id: 'si_new', quantity: Number(form['items[0][quantity]']), price: { lookup_key: PLAN.keys.extra } }); } return json(state.subs.get(m[1])); }
      return json({}, false, 404);
    }
    if (u.pathname === '/auth/v1/user') return init.headers.authorization === 'Bearer good' ? json(user) : json({}, false, 401);
    if (u.pathname === '/rest/v1/subscriptions') {
      if (method === 'GET') return json(state.subRow ? [state.subRow] : []);
      saved.push(JSON.parse(init.body)); if (method === 'POST') state.subRow = { ...(state.subRow || {}), ...JSON.parse(init.body) }; return json({}, true, 201);
    }
    return json({}, false, 404);
  };
  return { fetchImpl, calls, saved, state };
}
const ENV = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_API_BASE: 'https://stripe.test', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', SITE_URL: 'https://site.test' };
const PRICES = [{ id: 'price_b', lookup_key: PLAN.keys.base, active: true }, { id: 'price_e', lookup_key: PLAN.keys.extra, active: true }];
const run = (w, body, token = 'good') => runBilling({ env: ENV, fetchImpl: w.fetchImpl, token, body });

test('the first checkout creates the product and both prices; the next ones reuse them', async () => {
  const w = world();
  await run(w, { action: 'checkout', assets: 5 });
  assert.deepEqual(w.calls.filter(c => c.method === 'POST' && /prices|products/.test(c.p)).map(c => c.p), ['/v1/products', '/v1/prices', '/v1/prices']);
  const made = w.calls.filter(c => c.p === '/v1/prices' && c.method === 'POST').map(c => [c.form.lookup_key, c.form.unit_amount, c.form.currency, c.form['recurring[interval]']]);
  assert.deepEqual(made, [[PLAN.keys.base, '4700', 'usd', 'month'], [PLAN.keys.extra, '1500', 'usd', 'month']]);
  const w2 = world({ prices: PRICES });
  await run(w2, { action: 'checkout', assets: 5 });
  assert.ok(!w2.calls.some(c => c.method === 'POST' && /prices|products/.test(c.p)));
});
test('checkout: base plan plus the extras, the user in the metadata, a free trial, and no card needed', async () => {
  const w = world({ prices: PRICES });
  const r = await run(w, { action: 'checkout', assets: 8 });
  assert.equal(r.status, 200); assert.equal(r.body.url, 'https://checkout.test/cs_1');
  const f = w.calls.find(c => c.p === '/v1/checkout/sessions').form;
  assert.equal(f.mode, 'subscription'); assert.equal(f.client_reference_id, 'u1'); assert.equal(f.customer, 'cus_new');
  assert.equal(f['line_items[0][price]'], 'price_b'); assert.equal(f['line_items[0][quantity]'], '1'); assert.equal(f['line_items[1][price]'], 'price_e'); assert.equal(f['line_items[1][quantity]'], '5');
  assert.equal(f['subscription_data[metadata][user_id]'], 'u1'); assert.equal(f['subscription_data[trial_period_days]'], String(PLAN.trialDays));
  assert.ok(!Object.keys(f).some(k => k.includes('trial_settings')), 'no "cancel without a card" rule: the card is taken up front'); assert.equal(f.payment_method_collection, 'always');
  assert.equal(PLAN.trialDays, 7);
  assert.equal(f.success_url, 'https://site.test/app.html?billing=success');
});
test('with exactly the included assets there is no extra line, and a returning customer is not given a second trial', async () => {
  const w = world({ prices: PRICES, subRow: { user_id: 'u1', stripe_customer_id: 'cus_old', status: 'canceled', trial_end: '2026-01-01T00:00:00Z' } });
  await run(w, { action: 'checkout', assets: 3 });
  const f = w.calls.find(c => c.p === '/v1/checkout/sessions').form;
  assert.equal(f.customer, 'cus_old'); assert.ok(!('line_items[1][price]' in f)); assert.ok(!('subscription_data[trial_period_days]' in f));
  assert.ok(!w.calls.some(c => c.p === '/v1/customers'), 'the customer is reused');
});
test('someone who already has a plan is sent to change it, not to pay twice', async () => {
  const w = world({ prices: PRICES, subRow: { user_id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active' } });
  const r = await run(w, { action: 'checkout', assets: 5 });
  assert.equal(r.status, 409); assert.equal(r.body.error, 'already_subscribed');
});
test('only a signed-in user, with a sane request, gets anything', async () => {
  const w = world({ prices: PRICES });
  assert.equal((await run(w, { action: 'checkout', assets: 5 }, 'nope')).status, 401);
  assert.equal((await run(w, { action: 'checkout', assets: 'lots' })).status, 400);
  assert.equal((await run(w, { action: 'what' })).status, 400);
  assert.equal((await runBilling({ env: {}, fetchImpl: w.fetchImpl, token: 'good', body: {} })).status, 503);
  assert.ok(!w.calls.some(c => c.p === '/v1/checkout/sessions'));
});
test('changing the number of assets adds, updates or removes only the extra item, prorated, and saves the result', async () => {
  const sub = (extra) => ({ id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { user_id: 'u1' }, items: { data: [{ id: 'si_b', quantity: 1, price: { lookup_key: PLAN.keys.base } }, ...(extra ? [{ id: 'si_e', quantity: extra, price: { lookup_key: PLAN.keys.extra } }] : [])] } });
  const row = { user_id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active', assets_allowed: 3 };
  let w = world({ prices: PRICES, subRow: row }); w.state.subs.set('sub_1', sub(0));
  let r = await run(w, { action: 'change', assets: 10 });
  assert.equal(r.body.assetsAllowed, 10); assert.equal(w.state.lastUpdate.it['items[0][price]'], 'price_e'); assert.equal(w.state.lastUpdate.it['items[0][quantity]'], '7'); assert.equal(w.state.lastUpdate.proration, 'create_prorations');
  w = world({ prices: PRICES, subRow: row }); w.state.subs.set('sub_1', sub(7));
  r = await run(w, { action: 'change', assets: 6 }); assert.equal(r.body.assetsAllowed, 6); assert.equal(w.state.lastUpdate.it['items[0][id]'], 'si_e'); assert.equal(w.state.lastUpdate.it['items[0][quantity]'], '3');
  w = world({ prices: PRICES, subRow: row }); w.state.subs.set('sub_1', sub(7));
  r = await run(w, { action: 'change', assets: 3 }); assert.equal(r.body.assetsAllowed, 3); assert.equal(w.state.lastUpdate.it['items[0][deleted]'], 'true');
  w = world({ prices: PRICES, subRow: { ...row, status: 'canceled' } });
  assert.equal((await run(w, { action: 'change', assets: 6 })).status, 409);
});
test('the portal needs a customer; a Stripe error is passed on in plain words and not as a crash', async () => {
  let w = world({ prices: PRICES, subRow: { user_id: 'u1', stripe_customer_id: 'cus_1', status: 'active' } });
  assert.equal((await run(w, { action: 'portal' })).body.url, 'https://portal.test/x');
  assert.equal((await run(world(), { action: 'portal' })).status, 404);
  const bad = world({ prices: PRICES }); const r = await runBilling({ env: { ...ENV, STRIPE_SECRET_KEY: 'sk_test_wrong' }, fetchImpl: bad.fetchImpl, token: 'good', body: { action: 'checkout', assets: 4 } });
  assert.equal(r.status, 502); assert.equal(r.body.error, 'stripe_error'); assert.match(r.body.message, /bad key/);
});

/* ----------------------------------------------------------------- the webhook */
const WH = { ...ENV, STRIPE_WEBHOOK_SECRET: 'whsec_t' };
const event = (type, object, created = 1_800_000_100) => JSON.stringify({ id: 'evt_1', type, created, data: { object } });
const subObj = (over = {}) => ({ id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { user_id: 'u1' }, cancel_at_period_end: false, items: { data: [{ quantity: 1, price: { lookup_key: PLAN.keys.base }, current_period_end: 1_802_000_000 }, { quantity: 4, price: { lookup_key: PLAN.keys.extra } }] }, ...over });
const hit = (w, raw, secret = 'whsec_t', now = 1_800_000_100) => runWebhook({ env: WH, fetchImpl: w.fetchImpl, raw, signature: signPayload(raw, secret, now), now });

test('webhook: a bad signature is refused and nothing is saved', async () => {
  const w = world(), raw = event('customer.subscription.updated', subObj());
  assert.equal((await hit(w, raw, 'whsec_wrong')).status, 400); assert.equal(w.saved.length, 0);
  assert.equal((await runWebhook({ env: { ...WH, STRIPE_WEBHOOK_SECRET: '' }, fetchImpl: w.fetchImpl, raw, signature: '' })).status, 503);
});
test('webhook: a subscription event saves the plan for the user named in its metadata', async () => {
  const w = world();
  const r = await hit(w, event('customer.subscription.updated', subObj()));
  assert.equal(r.status, 200); assert.equal(w.saved[0].user_id, 'u1'); assert.equal(w.saved[0].assets_allowed, 7); assert.equal(w.saved[0].status, 'active'); assert.equal(w.saved[0].stripe_subscription_id, 'sub_1');
});
test('webhook: a deleted subscription becomes canceled; one that is not ours is ignored', async () => {
  let w = world(); await hit(w, event('customer.subscription.deleted', subObj({ status: 'active' }))); assert.equal(w.saved[0].status, 'canceled');
  w = world(); const r = await hit(w, event('customer.subscription.updated', subObj({ metadata: {} })));
  assert.equal(r.status, 200); assert.equal(w.saved.length, 0);
});
test('webhook: without metadata the stored customer identifies the user', async () => {
  const w = world({ subRow: { user_id: 'u9', stripe_customer_id: 'cus_1' } });
  await hit(w, event('customer.subscription.updated', subObj({ metadata: {} }))); assert.equal(w.saved[0].user_id, 'u9');
});
test('webhook: checkout completed fetches the subscription and links it to the user who paid', async () => {
  const w = world(); w.state.subs.set('sub_1', subObj({ metadata: {} }));
  const r = await hit(w, event('checkout.session.completed', { id: 'cs_1', mode: 'subscription', subscription: 'sub_1', client_reference_id: 'u7', customer: 'cus_1' }));
  assert.equal(r.status, 200); assert.equal(w.saved[0].user_id, 'u7'); assert.equal(w.saved[0].assets_allowed, 7);
});
test('webhook: an older event never overwrites a newer one (Stripe does not promise order)', async () => {
  const w = world({ subRow: { user_id: 'u1', last_event_at: 1_800_000_500 } });
  await hit(w, event('customer.subscription.updated', subObj(), 1_800_000_100)); assert.equal(w.saved.length, 0);
  await hit(w, event('customer.subscription.updated', subObj(), 1_800_000_900), 'whsec_t', 1_800_000_900); assert.equal(w.saved.length, 1);
});
test('webhook: other events are acknowledged and ignored', async () => {
  const w = world(); const r = await hit(w, event('invoice.paid', { id: 'in_1' })); assert.equal(r.status, 200); assert.equal(w.saved.length, 0);
});
test('the client refuses to run without a key', () => { assert.throws(() => stripeClient({ env: {} }), /not configured/); });
test('ensurePrices keeps what exists and only creates what is missing', async () => {
  const w = world({ prices: [PRICES[0]] }); w.state.products.push({ id: 'prod_9', metadata: { app: 'owned-map' } });
  const call = stripeClient({ env: ENV, fetchImpl: w.fetchImpl }), got = await ensurePrices(call);
  assert.equal(got.base, 'price_b'); assert.equal(got.extra, `price_${PLAN.keys.extra}`);
  assert.ok(!w.calls.some(c => c.p === '/v1/products' && c.method === 'POST'), 'the product is reused'); assert.equal(w.calls.filter(c => c.p === '/v1/prices' && c.method === 'POST').length, 1);
});
