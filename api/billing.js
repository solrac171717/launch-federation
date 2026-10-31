// POST /api/billing: what a signed-in user can do about their plan. The body says which: { action, assets }.
//   checkout  -> a Stripe Checkout page for the chosen number of assets (a free trial first, with a card, when the person has not had one)
//   change    -> change the number of assets on an existing subscription (prorated by Stripe)
//   portal    -> Stripe's customer portal: card, invoices, cancel
// The prices are found, or created the first time, by lookup key (see ensurePrices). The subscription row itself is written by the webhook
// (and right after a change), never by the browser. Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (optional), SITE_URL (optional).
import { PLAN, cleanAssets, extraQty, LIVE } from '../src/billing-core.js';
import { stripeClient, ensurePrices, ensurePortalConfig, subscriptionRow, supabaseClient, saveSubscription, StripeError } from './_stripe.js';

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
};
const fail = (status, error, message = '') => ({ status, body: { error, ...(message ? { message } : {}) } });

export async function runBilling({ env, fetchImpl = fetch, token, body, siteUrl }) {
  let stripe, sb;
  try { stripe = stripeClient({ env, fetchImpl }); sb = supabaseClient(env, fetchImpl); } catch (e) { return fail(503, 'not_configured'); }
  const base = String(env.SUPABASE_URL).replace(/\/$/, '');
  const who = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token || ''}` } }).catch(() => null);
  const user = who?.ok ? await who.json().catch(() => null) : null;
  if (!user?.id) return fail(401, 'unauthorized');
  const site = String(siteUrl || env.SITE_URL || '').replace(/\/$/, '');
  if (!site) return fail(500, 'no_site_url');

  const row = async () => { const r = await sb(`/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=*`); return r.ok ? (await r.json())[0] || null : null; };
  try {
    const cur = await row();
    const action = body?.action;

    if (action === 'checkout') {
      const assets = cleanAssets(body.assets); if (assets === null) return fail(400, 'bad_assets');
      if (cur && LIVE.includes(cur.status)) return fail(409, 'already_subscribed');
      let customer = cur?.stripe_customer_id;
      if (!customer) {
        customer = (await stripe('POST', '/v1/customers', { email: user.email, metadata: { user_id: user.id } })).id;
        const saved = await sb('/rest/v1/subscriptions?on_conflict=user_id', { method: 'POST', body: JSON.stringify({ user_id: user.id, stripe_customer_id: customer, status: 'none', assets_allowed: 0 }), headers: { prefer: 'resolution=merge-duplicates,return=minimal' } });
        if (!saved.ok) return fail(502, 'save_failed');
      }
      const prices = await ensurePrices(stripe), extra = extraQty(assets);
      const trial = PLAN.trialDays > 0 && !cur?.trial_end; // one free trial per person
      const session = await stripe('POST', '/v1/checkout/sessions', {
        mode: 'subscription', customer, client_reference_id: user.id, allow_promotion_codes: true,
        line_items: [{ price: prices.base, quantity: 1 }, ...(extra ? [{ price: prices.extra, quantity: extra }] : [])],
        success_url: `${site}/app.html?billing=success`, cancel_url: `${site}/app.html?billing=cancel`,
        payment_method_collection: 'always', // the trial needs a card: it is charged when the trial ends, unless the person cancels first
        subscription_data: { metadata: { user_id: user.id }, ...(trial ? { trial_period_days: PLAN.trialDays } : {}) },
      });
      return { status: 200, body: { url: session.url } };
    }

    if (action === 'change') {
      const assets = cleanAssets(body.assets); if (assets === null) return fail(400, 'bad_assets');
      if (!cur?.stripe_subscription_id || !LIVE.includes(cur.status)) return fail(409, 'no_subscription');
      const sub = await stripe('GET', `/v1/subscriptions/${encodeURIComponent(cur.stripe_subscription_id)}`);
      const prices = await ensurePrices(stripe), want = extraQty(assets), have = (sub.items?.data || []).find(i => i.price?.lookup_key === PLAN.keys.extra);
      const items = have ? [want ? { id: have.id, quantity: want } : { id: have.id, deleted: true }] : want ? [{ price: prices.extra, quantity: want }] : [];
      const updated = items.length ? await stripe('POST', `/v1/subscriptions/${encodeURIComponent(sub.id)}`, { items, proration_behavior: 'create_prorations' }) : sub;
      const next = subscriptionRow(updated, user.id, Math.floor(Date.now() / 1000));
      await saveSubscription(sb, next);
      return { status: 200, body: { ok: true, assetsAllowed: next.assets_allowed } };
    }

    if (action === 'portal') {
      if (!cur?.stripe_customer_id) return fail(404, 'no_customer');
      const open = configuration => stripe('POST', '/v1/billing_portal/sessions', { customer: cur.stripe_customer_id, return_url: `${site}/app.html`, ...(configuration ? { configuration } : {}) });
      let s;
      try { s = await open(env.STRIPE_PORTAL_CONFIG); }
      catch (e) { // an account that never set up its portal: make ours once, then open it
        if (!(e instanceof StripeError) || env.STRIPE_PORTAL_CONFIG || !/configuration/i.test(e.message)) throw e;
        s = await open((await ensurePortalConfig(stripe, site)).id);
      }
      return { status: 200, body: { url: s.url } };
    }
    return fail(400, 'bad_request');
  } catch (e) {
    if (e instanceof StripeError) return fail(e.status === 503 ? 503 : 502, 'stripe_error', e.message);
    console.error('billing error', e); return fail(500, 'server_error');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b);
    if (!b) { const chunks = []; for await (const c of req) chunks.push(c); b = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const { status, body } = await runBilling({ env: process.env, token, body: b, siteUrl: process.env.SITE_URL || `https://${req.headers.host}` });
    return send(res, status, body);
  } catch (e) { console.error('billing handler error', e); return send(res, 500, { error: 'server_error' }); }
}
