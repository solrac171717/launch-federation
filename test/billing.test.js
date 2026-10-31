import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN, priceCents, quote, priceKey, priceDefs, cleanAssets, cleanInterval, usd, priceText, allowedFromItems, billingView } from '../src/billing-core.js';
import { formEncode, verifySignature, signPayload, ensurePrices, subscriptionRow, stripeClient } from '../api/_stripe.js';
import { runBilling } from '../api/billing.js';
import { runWebhook } from '../api/stripe-webhook.js';

/* ----------------------------------------------------------------- the plan */
const OWN = priceKey('owner', 'month'), FAM = priceKey('family', 'month'), EXT = priceKey('extra', 'month');
test('the plan is chosen from the number of assets: Owner to 10, Family to 40, $9 for each one beyond what the plan includes', () => {
  assert.equal(priceCents(1), 4700); assert.equal(priceCents(10), 4700);
  assert.equal(priceCents(11), 4700 + 900); assert.equal(priceCents(18), 11900, 'Owner plus 8 extras costs the same as Family: the smaller plan stays');
  assert.equal(quote(18).tier, 'owner'); assert.equal(quote(19).tier, 'family'); assert.equal(priceCents(19), 11900);
  assert.equal(priceCents(40), 11900); assert.equal(priceCents(41), 11900 + 900); assert.equal(priceCents(100), 11900 + 60 * 900);
  assert.deepEqual([quote(5).allowed, quote(25).allowed, quote(45).allowed], [10, 40, 45], 'the plan covers at least what was asked');
  assert.equal(usd(4700), '$47'); assert.equal(usd(6250), '$62.50');
});
test('yearly is ten months for twelve, on every plan and on the extra assets', () => {
  for (const t of PLAN.tiers) assert.equal(t.cents.year, t.cents.month * 10);
  assert.equal(PLAN.extra.cents.year, PLAN.extra.cents.month * 10);
  assert.equal(priceCents(10, 'year'), 47000); assert.equal(priceCents(25, 'year'), 119000); assert.equal(priceCents(45, 'year'), 119000 + 5 * 9000);
  assert.equal(quote(10, 'year').monthlyCents, 3917); assert.equal(priceText(10, 'year'), '$470 a year'); assert.equal(priceText(10), '$47 a month');
  assert.equal(cleanInterval('year'), 'year'); assert.equal(cleanInterval('weekly'), 'month'); assert.equal(cleanInterval(undefined), 'month');
});
test('every price the plans need is defined once, with a unique lookup key and the right interval', () => {
  const defs = priceDefs();
  assert.equal(defs.length, 6); assert.equal(new Set(defs.map(d => d.key)).size, 6);
  assert.deepEqual(defs.filter(d => d.interval === 'year').map(d => [d.kind, d.cents]), [['owner', 47000], ['family', 119000], ['extra', 9000]]);
  assert.ok(defs.every(d => /^ownedmap_v2_(owner|family|extra)_(month|year)$/.test(d.key)));
});
test('what a person types is clamped to what the plans allow', () => {
  assert.equal(cleanAssets('7'), 7); assert.equal(cleanAssets(0), 1); assert.equal(cleanAssets(999), 100); assert.equal(cleanAssets('abc'), null); assert.equal(cleanAssets(7.6), 8);
});
test('assets paid for come from the plan plus the extra items, in either period, and only from ours', () => {
  assert.equal(allowedFromItems([{ lookup_key: OWN, quantity: 1 }]), 10);
  assert.equal(allowedFromItems([{ lookup_key: OWN, quantity: 1 }, { lookup_key: EXT, quantity: 7 }]), 17);
  assert.equal(allowedFromItems([{ lookup_key: FAM, quantity: 1 }]), 40);
  assert.equal(allowedFromItems([{ lookup_key: priceKey('family', 'year'), quantity: 1 }, { lookup_key: priceKey('extra', 'year'), quantity: 5 }]), 45);
  assert.equal(allowedFromItems([{ lookup_key: EXT, quantity: 7 }]), 0, 'extras without a plan give nothing');
  assert.equal(allowedFromItems([{ lookup_key: 'something_else', quantity: 5 }]), 0);
  assert.equal(allowedFromItems([{ lookup_key: 'ownedmap_base_monthly', quantity: 1 }, { lookup_key: 'ownedmap_extra_asset_monthly', quantity: 2 }]), 5, 'the first version of the plan still counts');
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
  const sub = { id: 'sub_1', customer: 'cus_1', status: 'trialing', trial_end: 1_800_000_000, cancel_at_period_end: false, items: { data: [{ quantity: 1, price: { lookup_key: OWN }, current_period_end: 1_802_000_000 }, { quantity: 2, price: { lookup_key: EXT } }] } };
  const row = subscriptionRow(sub, 'u1', 123);
  assert.equal(row.assets_allowed, 12); assert.equal(row.status, 'trialing'); assert.equal(row.stripe_customer_id, 'cus_1');
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
      if (p === '/v1/prices') { const pr = { id: `price_${form.lookup_key}`, lookup_key: form.lookup_key, active: true }; state.prices.push(pr); state.priceForms = [...(state.priceForms || []), form]; return json(pr); }
      if (p === '/v1/customers') return json({ id: 'cus_new' });
      if (p === '/v1/checkout/sessions') return json({ id: 'cs_1', url: 'https://checkout.test/cs_1' });
      if (p === '/v1/billing_portal/configurations' && method === 'GET') return json({ data: state.portalCfg ? [state.portalCfg] : [] });
      if (p === '/v1/billing_portal/configurations') { state.portalCfg = { id: 'bpc_1', metadata: { app: 'owned-map' } }; return json(state.portalCfg); }
      if (p === '/v1/billing_portal/sessions') return state.needPortalCfg && !form.configuration ? json({ error: { message: 'No configuration provided and your live mode default configuration has not been created.' } }, false, 400) : json({ url: 'https://portal.test/x' });
      const m = /^\/v1\/subscriptions\/(.+)$/.exec(p);
      if (m) {
        if (method === 'POST') {
          const s = state.subs.get(m[1]), ops = []; for (let i = 0; form[`items[${i}][id]`] !== undefined || form[`items[${i}][price]`] !== undefined; i++) ops.push({ id: form[`items[${i}][id]`], price: form[`items[${i}][price]`], quantity: form[`items[${i}][quantity]`], deleted: form[`items[${i}][deleted]`] });
          state.lastUpdate = { ops, proration: form.proration_behavior };
          const keyOf = id => id.replace(/^price_/, '');
          for (const o of ops) {
            if (o.id && o.deleted) s.items.data = s.items.data.filter(x => x.id !== o.id);
            else if (o.id) { const it = s.items.data.find(x => x.id === o.id); if (o.price) it.price = { lookup_key: keyOf(o.price) }; if (o.quantity !== undefined) it.quantity = Number(o.quantity); }
            else s.items.data.push({ id: `si_${keyOf(o.price)}`, quantity: Number(o.quantity), price: { lookup_key: keyOf(o.price) } });
          }
        }
        return json(state.subs.get(m[1]));
      }
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
const PRICES = priceDefs().map(d => ({ id: `price_${d.key}`, lookup_key: d.key, active: true }));
const run = (w, body, token = 'good') => runBilling({ env: ENV, fetchImpl: w.fetchImpl, token, body });

test('the first checkout creates the product and all six prices; the next ones reuse them', async () => {
  const w = world();
  await run(w, { action: 'checkout', assets: 5 });
  assert.deepEqual(w.calls.filter(c => c.method === 'POST' && /products/.test(c.p)).map(c => c.p), ['/v1/products']);
  const made = w.calls.filter(c => c.p === '/v1/prices' && c.method === 'POST').map(c => [c.form.lookup_key, c.form.unit_amount, c.form.currency, c.form['recurring[interval]']]);
  assert.deepEqual(made, [
    ['ownedmap_v2_owner_month', '4700', 'usd', 'month'], ['ownedmap_v2_family_month', '11900', 'usd', 'month'], ['ownedmap_v2_extra_month', '900', 'usd', 'month'],
    ['ownedmap_v2_owner_year', '47000', 'usd', 'year'], ['ownedmap_v2_family_year', '119000', 'usd', 'year'], ['ownedmap_v2_extra_year', '9000', 'usd', 'year'],
  ]);
  const w2 = world({ prices: PRICES });
  await run(w2, { action: 'checkout', assets: 5 });
  assert.ok(!w2.calls.some(c => c.method === 'POST' && /prices|products/.test(c.p)));
});
test('checkout: the plan that covers the assets, plus extras only past what it includes, the user in the metadata, a free trial, and a card up front', async () => {
  const w = world({ prices: PRICES });
  const r = await run(w, { action: 'checkout', assets: 14 });
  assert.equal(r.status, 200); assert.equal(r.body.url, 'https://checkout.test/cs_1');
  const f = w.calls.find(c => c.p === '/v1/checkout/sessions').form;
  assert.equal(f.mode, 'subscription'); assert.equal(f.client_reference_id, 'u1'); assert.equal(f.customer, 'cus_new');
  assert.equal(f['line_items[0][price]'], `price_${OWN}`); assert.equal(f['line_items[0][quantity]'], '1'); assert.equal(f['line_items[1][price]'], `price_${EXT}`); assert.equal(f['line_items[1][quantity]'], '4');
  assert.equal(f['subscription_data[metadata][user_id]'], 'u1'); assert.equal(f['subscription_data[trial_period_days]'], String(PLAN.trialDays));
  assert.ok(!Object.keys(f).some(k => k.includes('trial_settings')), 'no "cancel without a card" rule: the card is taken up front'); assert.equal(f.payment_method_collection, 'always');
  assert.equal(PLAN.trialDays, 7);
  assert.equal(f.success_url, 'https://site.test/app.html?billing=success');
});
test('checkout: 25 assets is the Family plan alone, and yearly uses the yearly prices', async () => {
  const w = world({ prices: PRICES });
  await run(w, { action: 'checkout', assets: 25 });
  let f = w.calls.find(c => c.p === '/v1/checkout/sessions').form;
  assert.equal(f['line_items[0][price]'], `price_${FAM}`); assert.ok(!('line_items[1][price]' in f));
  const y = world({ prices: PRICES });
  await run(y, { action: 'checkout', assets: 45, interval: 'year' });
  f = y.calls.find(c => c.p === '/v1/checkout/sessions').form;
  assert.equal(f['line_items[0][price]'], 'price_ownedmap_v2_family_year'); assert.equal(f['line_items[1][price]'], 'price_ownedmap_v2_extra_year'); assert.equal(f['line_items[1][quantity]'], '5');
});
test('with assets inside the plan there is no extra line, and a returning customer is not given a second trial', async () => {
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
test('changing the number of assets moves between plans and extras, prorated, and saves the result', async () => {
  const sub = (plan, extra, ek = EXT) => ({ id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { user_id: 'u1' }, items: { data: [{ id: 'si_b', quantity: 1, price: { lookup_key: plan } }, ...(extra ? [{ id: 'si_e', quantity: extra, price: { lookup_key: ek } }] : [])] } });
  const row = { user_id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active', assets_allowed: 10 };
  const world1 = s0 => { const w = world({ prices: PRICES, subRow: row }); w.state.subs.set('sub_1', s0); return w; };
  let w = world1(sub(OWN, 0)), r = await run(w, { action: 'change', assets: 15 });
  assert.equal(r.body.assetsAllowed, 15); assert.deepEqual(w.state.lastUpdate.ops, [{ id: undefined, price: `price_${EXT}`, quantity: '5', deleted: undefined }]); assert.equal(w.state.lastUpdate.proration, 'create_prorations');
  w = world1(sub(OWN, 5)); r = await run(w, { action: 'change', assets: 12 });
  assert.equal(r.body.assetsAllowed, 12); assert.deepEqual(w.state.lastUpdate.ops, [{ id: 'si_e', price: undefined, quantity: '2', deleted: undefined }]);
  w = world1(sub(OWN, 5)); r = await run(w, { action: 'change', assets: 30 });
  assert.equal(r.body.assetsAllowed, 40); assert.equal(r.body.tier, 'family');
  assert.deepEqual(w.state.lastUpdate.ops, [{ id: 'si_b', price: `price_${FAM}`, quantity: '1', deleted: undefined }, { id: 'si_e', price: undefined, quantity: undefined, deleted: 'true' }], 'the plan item changes price and the extras are dropped');
  w = world1(sub(FAM, 0)); r = await run(w, { action: 'change', assets: 4 });
  assert.equal(r.body.assetsAllowed, 10); assert.equal(w.state.lastUpdate.ops[0].price, `price_${OWN}`); assert.equal(w.state.lastUpdate.ops.length, 1);
  w = world1(sub(OWN, 0)); r = await run(w, { action: 'change', assets: 10 }); assert.equal(r.body.assetsAllowed, 10); assert.equal(w.state.lastUpdate, undefined, 'nothing to change, nothing sent');
  w = world({ prices: PRICES, subRow: { ...row, status: 'canceled' } });
  assert.equal((await run(w, { action: 'change', assets: 6 })).status, 409);
});
test('a plan can move from monthly to yearly, and the current period can be read back', async () => {
  const row = { user_id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active', assets_allowed: 12 };
  const w = world({ prices: PRICES, subRow: row });
  w.state.subs.set('sub_1', { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { user_id: 'u1' }, items: { data: [{ id: 'si_b', quantity: 1, price: { lookup_key: OWN } }, { id: 'si_e', quantity: 2, price: { lookup_key: EXT } }] } });
  assert.deepEqual((await run(w, { action: 'plan' })).body, { interval: 'month', tier: 'owner', assetsAllowed: 12 });
  const r = await run(w, { action: 'change', assets: 12, interval: 'year' });
  assert.equal(r.body.interval, 'year'); assert.equal(r.body.assetsAllowed, 12);
  assert.deepEqual(w.state.lastUpdate.ops.map(o => [o.id, o.price]), [['si_b', 'price_ownedmap_v2_owner_year'], ['si_e', 'price_ownedmap_v2_extra_year']]);
  assert.equal((await run(w, { action: 'plan' })).body.interval, 'year');
  assert.equal((await run(world({ prices: PRICES }), { action: 'plan' })).status, 409);
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
const subObj = (over = {}) => ({ id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { user_id: 'u1' }, cancel_at_period_end: false, items: { data: [{ quantity: 1, price: { lookup_key: OWN }, current_period_end: 1_802_000_000 }, { quantity: 4, price: { lookup_key: EXT } }] }, ...over });
const hit = (w, raw, secret = 'whsec_t', now = 1_800_000_100) => runWebhook({ env: WH, fetchImpl: w.fetchImpl, raw, signature: signPayload(raw, secret, now), now });

test('webhook: a bad signature is refused and nothing is saved', async () => {
  const w = world(), raw = event('customer.subscription.updated', subObj());
  assert.equal((await hit(w, raw, 'whsec_wrong')).status, 400); assert.equal(w.saved.length, 0);
  assert.equal((await runWebhook({ env: { ...WH, STRIPE_WEBHOOK_SECRET: '' }, fetchImpl: w.fetchImpl, raw, signature: '' })).status, 503);
});
test('webhook: a subscription event saves the plan for the user named in its metadata', async () => {
  const w = world();
  const r = await hit(w, event('customer.subscription.updated', subObj()));
  assert.equal(r.status, 200); assert.equal(w.saved[0].user_id, 'u1'); assert.equal(w.saved[0].assets_allowed, 14); assert.equal(w.saved[0].status, 'active'); assert.equal(w.saved[0].stripe_subscription_id, 'sub_1');
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
  assert.equal(r.status, 200); assert.equal(w.saved[0].user_id, 'u7'); assert.equal(w.saved[0].assets_allowed, 14);
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
  const w = world({ prices: [PRICES[0], PRICES[2]] }); w.state.products.push({ id: 'prod_9', metadata: { app: 'owned-map' } });
  const call = stripeClient({ env: ENV, fetchImpl: w.fetchImpl }), got = await ensurePrices(call);
  assert.equal(got[OWN], `price_${OWN}`); assert.equal(got[priceKey('family', 'year')], `price_${priceKey('family', 'year')}`);
  assert.equal(Object.keys(got).length, 6);
  assert.ok(!w.calls.some(c => c.p === '/v1/products' && c.method === 'POST'), 'the product is reused'); assert.equal(w.calls.filter(c => c.p === '/v1/prices' && c.method === 'POST').length, 4);
});
test('the portal: an account with no portal configuration gets ours created once, with cancel and invoices, then it opens', async () => {
  const w = world({ prices: PRICES, subRow: { user_id: 'u1', stripe_customer_id: 'cus_1', status: 'trialing' } }); w.state.needPortalCfg = true;
  assert.equal((await run(w, { action: 'portal' })).body.url, 'https://portal.test/x');
  const made = w.calls.find(c => c.p === '/v1/billing_portal/configurations' && c.method === 'POST').form;
  assert.equal(made['features[subscription_cancel][enabled]'], 'true'); assert.equal(made['features[subscription_cancel][mode]'], 'at_period_end'); assert.equal(made['features[invoice_history][enabled]'], 'true');
  assert.equal(w.calls.at(-1).form.configuration, 'bpc_1');
  await run(w, { action: 'portal' });
  assert.equal(w.calls.filter(c => c.p === '/v1/billing_portal/configurations' && c.method === 'POST').length, 1, 'the second time it is found, not made again');
});
