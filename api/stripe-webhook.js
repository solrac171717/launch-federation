// POST /api/stripe-webhook: Stripe tells us what happened to a subscription, and this keeps the `subscriptions` table in step.
// In the Stripe dashboard (Developers, Webhooks) the endpoint must be  https://<your site>/api/stripe-webhook  with these events:
//   checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted
// The signature is checked against the RAW body, so the body is not parsed here. Anything that fails answers an error, so Stripe retries.
// Env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { stripeClient, verifySignature, subscriptionRow, supabaseClient, saveSubscription } from './_stripe.js';

export const config = { api: { bodyParser: false } };

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
};

export async function runWebhook({ env, fetchImpl = fetch, raw, signature, now = Math.floor(Date.now() / 1000) }) {
  if (!env.STRIPE_WEBHOOK_SECRET) return { status: 503, body: { error: 'not_configured' } };
  if (!verifySignature(raw, signature, env.STRIPE_WEBHOOK_SECRET, now)) return { status: 400, body: { error: 'bad_signature' } };
  let event; try { event = JSON.parse(raw); } catch { return { status: 400, body: { error: 'bad_payload' } }; }
  const obj = event.data?.object, at = Number(event.created) || now;
  const sb = supabaseClient(env, fetchImpl);

  // which of our users does this subscription belong to? We put it in the metadata; fall back to the customer we stored.
  const userOf = async sub => {
    if (sub.metadata?.user_id) return sub.metadata.user_id;
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    const r = await sb(`/rest/v1/subscriptions?stripe_customer_id=eq.${encodeURIComponent(customer)}&select=user_id`);
    return r.ok ? (await r.json())[0]?.user_id || null : null;
  };

  if (event.type === 'checkout.session.completed') {
    if (obj.mode !== 'subscription' || !obj.subscription || !obj.client_reference_id) return { status: 200, body: { received: true, ignored: true } };
    const sub = await stripeClient({ env, fetchImpl })('GET', `/v1/subscriptions/${encodeURIComponent(obj.subscription)}`);
    await saveSubscription(sb, subscriptionRow(sub, obj.client_reference_id, at));
    return { status: 200, body: { received: true } };
  }
  if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    const userId = await userOf(obj);
    if (!userId) return { status: 200, body: { received: true, ignored: true } }; // not one of ours
    await saveSubscription(sb, subscriptionRow(event.type.endsWith('deleted') ? { ...obj, status: 'canceled' } : obj, userId, at));
    return { status: 200, body: { received: true } };
  }
  return { status: 200, body: { received: true, ignored: true } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const { status, body } = await runWebhook({ env: process.env, raw: Buffer.concat(chunks).toString('utf8'), signature: req.headers['stripe-signature'] });
    return send(res, status, body);
  } catch (e) { console.error('stripe webhook error', e); return send(res, 500, { error: 'server_error' }); }
}
