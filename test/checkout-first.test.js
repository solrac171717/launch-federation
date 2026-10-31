import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN } from '../src/billing-core.js';
import { stripeClient, signPayload } from '../api/_stripe.js';
import { runStart, allowed } from '../api/start.js';
import { runWelcome } from '../api/welcome.js';
import { runWebhook } from '../api/stripe-webhook.js';
import { provisionFromSession, SESSION_ID } from '../api/_provision.js';

const PRICES = [{ id: 'price_b', lookup_key: PLAN.keys.base, active: true }, { id: 'price_e', lookup_key: PLAN.keys.extra, active: true }];
const SENV = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_API_BASE: 'https://stripe.test', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', SITE_URL: 'https://site.test' };
const NOW = 1_800_000_500;

/** A fake Stripe + Supabase for the checkout-first flow. `existing` maps email -> user id; `rows` maps user id -> its subscription row. */
function shop({ existing = {}, session = {}, rows = {} } = {}) {
  const calls = [], created = [], saved = [], cancelled = [], claims = new Map(), passwords = [], subRows = new Map(Object.entries(rows));
  const SID = 'cs_test_abc123def456';
  const sess = { id: SID, status: 'complete', mode: 'subscription', subscription: 'sub_9', customer: 'cus_9', customer_details: { email: 'Buyer@X.test' }, created: 1_800_000_000, ...session };
  const sub = { id: 'sub_9', customer: 'cus_9', status: 'trialing', trial_end: 1_800_700_000, items: { data: [{ quantity: 1, price: { lookup_key: PLAN.keys.base }, current_period_end: 1_802_000_000 }, { quantity: 2, price: { lookup_key: PLAN.keys.extra } }] } };
  const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url), method = init.method || 'GET', raw = init.body || '';
    const body = raw.startsWith('{') ? JSON.parse(raw) : null, form = raw && !body ? Object.fromEntries(new URLSearchParams(raw)) : null;
    calls.push({ path: u.pathname, method, body, form });
    if (u.hostname === 'stripe.test') {
      if (u.pathname === `/v1/checkout/sessions/${SID}`) return json(sess);
      if (u.pathname === '/v1/subscriptions/sub_9') { if (method === 'DELETE') { cancelled.push('sub_9'); sub.status = 'canceled'; } return json(sub); }
      if (u.pathname === '/v1/checkout/sessions' && method === 'POST') return json({ id: 'cs_test_new', url: 'https://checkout.stripe.test/c/pay' });
      if (u.pathname === '/v1/prices') return json({ data: PRICES });
      return json({}, 404);
    }
    if (u.pathname === '/rest/v1/rpc/user_id_by_email') return json(existing[body.mail] || null);
    if (u.pathname === '/auth/v1/admin/users' && method === 'POST') { const id = `new-${created.length + 1}`; created.push({ ...body, id }); existing[body.email] = id; return json({ id }); }
    if (u.pathname.startsWith('/auth/v1/admin/users/') && method === 'PUT') { passwords.push(body.password); return json({}); }
    if (u.pathname === '/rest/v1/subscriptions') {
      const uid = u.search.match(/user_id=eq\.([^&]+)/)?.[1];
      if (method === 'GET') return json(subRows.has(uid) ? [subRows.get(uid)] : []);
      saved.push(body); return json({}, 201);
    }
    if (u.pathname === '/rest/v1/checkout_claims') {
      if (method === 'POST') { if (!claims.has(body.session_id)) claims.set(body.session_id, { claimed_at: null, ...body }); return json({}, 201); }
      const id = u.search.match(/session_id=eq\.([^&]+)/)?.[1], row = claims.get(id);
      if (method === 'GET') return json(row ? [row] : []);
      if (method === 'PATCH') { if (!row) return json([]); if (/claimed_at=is\.null/.test(u.search) && row.claimed_at) return json([]); Object.assign(row, body); return json([row]); }
    }
    return json({}, 404);
  };
  const sb = (path, init = {}) => fetchImpl(`https://x.supabase.co${path}`, init);
  return { fetchImpl, sb, calls, created, saved, cancelled, claims, passwords, SID };
}
const provision = async s => { const stripe = stripeClient({ env: SENV, fetchImpl: s.fetchImpl }); return provisionFromSession({ env: SENV, sb: s.sb, stripe, fetchImpl: s.fetchImpl, session: await stripe('GET', `/v1/checkout/sessions/${s.SID}`), at: NOW }); };

test('start: the button goes straight to Stripe for the chosen assets, with the trial and a clear charge notice, and needs no account', async () => {
  const s = shop();
  const r = await runStart({ env: SENV, fetchImpl: s.fetchImpl, assets: '6', siteUrl: 'https://site.test' });
  assert.equal(r.status, 303); assert.equal(r.location, 'https://checkout.stripe.test/c/pay');
  const f = s.calls.find(c => c.path === '/v1/checkout/sessions' && c.method === 'POST').form;
  assert.equal(f.mode, 'subscription'); assert.ok(!('customer' in f) && !('client_reference_id' in f), 'no account is needed');
  assert.equal(f['line_items[0][quantity]'], '1'); assert.equal(f['line_items[1][quantity]'], '3');
  assert.equal(f['subscription_data[trial_period_days]'], '7'); assert.equal(f.payment_method_collection, 'always');
  assert.equal(f.success_url, 'https://site.test/welcome.html?session_id={CHECKOUT_SESSION_ID}'); assert.equal(f.cancel_url, 'https://site.test/');
  assert.match(f['custom_text[submit][message]'], /\$92 a month unless you cancel before it ends/); assert.match(f['custom_text[submit][message]'], /terms\.html/);
});
test('start: with no number of assets it is the base plan, with no extra line', async () => {
  const s = shop(); await runStart({ env: SENV, fetchImpl: s.fetchImpl, siteUrl: 'https://site.test' });
  const f = s.calls.find(c => c.path === '/v1/checkout/sessions' && c.method === 'POST').form;
  assert.equal(f['line_items[0][price]'], 'price_b'); assert.ok(!('line_items[1][price]' in f));
});
test('start: without Stripe it says so, and a visitor cannot open sessions in a loop', async () => {
  assert.equal((await runStart({ env: {}, fetchImpl: shop().fetchImpl, siteUrl: 'https://site.test' })).status, 503);
  const t = 1_000_000; let ok = 0; for (let i = 0; i < 20; i++) if (allowed('1.2.3.4', t + i)) ok++;
  assert.equal(ok, 12); assert.equal(allowed('1.2.3.4', t + 61000), true, 'a minute later it works again');
});

test('provision: a new email gets an account with an unknown password, the plan, and a claim its payer may use once', async () => {
  const s = shop(), r = await provision(s);
  assert.deepEqual([r.email, r.created], ['buyer@x.test', true]);
  assert.equal(s.created.length, 1); assert.equal(s.created[0].email_confirm, true); assert.ok(s.created[0].password.length >= 30);
  assert.equal(s.saved[0].user_id, 'new-1'); assert.equal(s.saved[0].assets_allowed, 5); assert.equal(s.saved[0].status, 'trialing');
  assert.equal(s.claims.get(s.SID).claimable, true);
  await provision(s);
  assert.equal(s.created.length, 1, 'running it twice (the webhook and the page) creates one account'); assert.equal(s.claims.get(s.SID).claimable, true, 'the claim keeps what the first run decided');
});
test('provision: an email that already has an account is never claimable, and its live plan is not replaced', async () => {
  const s = shop({ existing: { 'buyer@x.test': 'u-old' }, rows: { 'u-old': { user_id: 'u-old', status: 'active' } } }), r = await provision(s);
  assert.equal(r.created, false); assert.equal(s.created.length, 0); assert.equal(s.claims.get(s.SID).claimable, false);
  assert.equal(s.saved.length, 0, 'typing a stranger\'s email at checkout must not overwrite the stranger\'s plan');
});
test('provision: a second trial for somebody who already has a live plan is cancelled so nobody is billed twice, and running it again is harmless', async () => {
  const s = shop({ existing: { 'buyer@x.test': 'u-old' }, rows: { 'u-old': { user_id: 'u-old', status: 'trialing', stripe_subscription_id: 'sub_first' } } });
  const r = await provision(s);
  assert.equal(r.duplicate, true); assert.deepEqual(s.cancelled, ['sub_9']); assert.equal(s.saved.length, 0, 'the first plan stays as it was');
  await provision(s); assert.deepEqual(s.cancelled, ['sub_9'], 'already cancelled: not cancelled twice');
});
test('provision: the same subscription arriving twice (webhook and page) is not a duplicate and is never cancelled', async () => {
  const s = shop({ existing: { 'buyer@x.test': 'u-old' }, rows: { 'u-old': { user_id: 'u-old', status: 'trialing', stripe_subscription_id: 'sub_9' } } });
  const r = await provision(s); assert.equal(r.duplicate, false); assert.equal(s.cancelled.length, 0);
});
test('session ids have the shape of Stripe ones only', () => {
  assert.ok(SESSION_ID.test('cs_test_abc123def456') && SESSION_ID.test('cs_live_a1B2c3D4e5'));
  assert.ok(!SESSION_ID.test('cs_x') && !SESSION_ID.test('../etc/passwd') && !SESSION_ID.test('cs_test_'));
});

test('welcome: the payer chooses the first password once, and only within a day', async () => {
  const s = shop();
  const go = (extra = {}, now = NOW) => runWelcome({ env: SENV, fetchImpl: s.fetchImpl, sessionId: s.SID, now, ...extra });
  assert.deepEqual((await go({ action: 'preview' })).body, { email: 'buyer@x.test', canChoosePassword: true, claimed: false, duplicate: false });
  assert.equal((await go({ action: 'claim', password: 'short' })).body.error, 'weak_password'); assert.equal(s.passwords.length, 0);
  assert.equal((await go({ action: 'claim', password: 'a-good-password' })).status, 200); assert.deepEqual(s.passwords, ['a-good-password']);
  const again = await go({ action: 'claim', password: 'another-password' });
  assert.equal(again.status, 409); assert.equal(again.body.error, 'already_claimed'); assert.deepEqual(s.passwords, ['a-good-password'], 'the password cannot be taken over');
  assert.equal((await go({ action: 'preview' })).body.claimed, true);
  assert.equal((await go({ action: 'preview' }, NOW + 90_000)).status, 404, 'a day later the page no longer works');
});
test('welcome: a stranger who typed an existing email cannot set that account\'s password', async () => {
  const s = shop({ existing: { 'buyer@x.test': 'u-old' } });
  const r = await runWelcome({ env: SENV, fetchImpl: s.fetchImpl, action: 'claim', sessionId: s.SID, password: 'attacker-password', now: NOW });
  assert.equal(r.status, 409); assert.equal(r.body.error, 'account_exists'); assert.equal(s.passwords.length, 0);
  assert.equal((await runWelcome({ env: SENV, fetchImpl: s.fetchImpl, action: 'preview', sessionId: s.SID, now: NOW })).body.canChoosePassword, false);
});
test('welcome: an unfinished or malformed checkout is simply not found', async () => {
  const open = shop({ session: { status: 'open' } });
  assert.equal((await runWelcome({ env: SENV, fetchImpl: open.fetchImpl, action: 'preview', sessionId: open.SID, now: NOW })).status, 404);
  assert.equal((await runWelcome({ env: SENV, fetchImpl: open.fetchImpl, action: 'preview', sessionId: '../x', now: NOW })).status, 404);
  assert.equal((await runWelcome({ env: {}, fetchImpl: open.fetchImpl, action: 'preview', sessionId: open.SID, now: NOW })).status, 503);
});
test('webhook: a payment without an account makes the account from the email typed at checkout', async () => {
  const s = shop(), raw = JSON.stringify({ id: 'evt_9', type: 'checkout.session.completed', created: NOW, data: { object: { id: s.SID, mode: 'subscription', subscription: 'sub_9', customer: 'cus_9', client_reference_id: null, customer_details: { email: 'Buyer@X.test' } } } });
  const r = await runWebhook({ env: { ...SENV, STRIPE_WEBHOOK_SECRET: 'whsec_t' }, fetchImpl: s.fetchImpl, raw, signature: signPayload(raw, 'whsec_t', NOW), now: NOW });
  assert.equal(r.status, 200); assert.equal(r.body.provisioned, true); assert.equal(s.created[0].email, 'buyer@x.test'); assert.equal(s.saved[0].assets_allowed, 5);
});
