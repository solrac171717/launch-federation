// Stripe without the SDK: a small client (form-encoded requests, like the REST API expects), webhook signature check, and the sync of a Stripe
// subscription into the `subscriptions` table. Used by api/billing.js and api/stripe-webhook.js. The leading underscore keeps Vercel from serving it as a route.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PLAN, allowedFromItems, priceDefs, priceKey, quote } from '../src/billing-core.js';

export class StripeError extends Error {
  constructor(message, status = 502, code = '') { super(message); this.name = 'StripeError'; this.status = status; this.code = code; }
}

/** { a: 1, b: { c: [x, y] } } -> a=1&b[c][0]=x&b[c][1]=y */
export function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (x !== null && typeof x === 'object' ? formEncode(x, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(x)}`)));
    else if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}

export function stripeClient({ env, fetchImpl = fetch }) {
  const key = env.STRIPE_SECRET_KEY, base = String(env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');
  if (!key) throw new StripeError('Stripe is not configured.', 503, 'not_configured');
  return async function call(method, path, params) {
    const get = method === 'GET', q = params ? formEncode(params) : '';
    const res = await fetchImpl(`${base}${path}${get && q ? `?${q}` : ''}`, { method, headers: { authorization: `Bearer ${key}`, ...(get ? {} : { 'content-type': 'application/x-www-form-urlencoded' }) }, body: get || !q ? undefined : q });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new StripeError(data?.error?.message || `Stripe answered ${res.status}`, res.status >= 500 ? 502 : 400, data?.error?.code || '');
    return data;
  };
}

/**
 * Checks the `Stripe-Signature` header ("t=...,v1=...") against the raw request body. Rejects anything older than the tolerance.
 * Pure: `now` is in seconds.
 */
export function verifySignature(raw, header, secret, now = Math.floor(Date.now() / 1000), tolerance = 300) {
  if (!raw || !header || !secret) return false;
  const parts = String(header).split(',').map(p => p.split('=')), t = Number(parts.find(p => p[0] === 't')?.[1]), sigs = parts.filter(p => p[0] === 'v1').map(p => p[1]);
  if (!Number.isFinite(t) || !sigs.length || Math.abs(now - t) > tolerance) return false;
  const want = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return sigs.some(s => s.length === want.length && timingSafeEqual(Buffer.from(s), Buffer.from(want)));
}
/** For tests and the local mock: a header that verifySignature accepts. */
export const signPayload = (raw, secret, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;

/** Every price of the plans, found by lookup key and created (with their product) the first time, in whichever mode the key belongs to. Returns { lookupKey: priceId }. */
export async function ensurePrices(stripe) {
  const defs = priceDefs(), want = defs.map(d => d.key);
  const found = await stripe('GET', '/v1/prices', { lookup_keys: want, active: true, limit: 100 });
  const byKey = Object.fromEntries((found.data || []).map(p => [p.lookup_key, p.id]));
  if (want.every(k => byKey[k])) return byKey;
  const products = await stripe('GET', '/v1/products', { active: true, limit: 100 });
  let product = (products.data || []).find(p => p.metadata?.app === 'owned-map')?.id;
  if (!product) product = (await stripe('POST', '/v1/products', { name: PLAN.name, description: 'Track everything you own on one map. Plans by number of assets, billed monthly or yearly.', metadata: { app: 'owned-map' } })).id;
  for (const d of defs) {
    if (byKey[d.key]) continue;
    byKey[d.key] = (await stripe('POST', '/v1/prices', { product, currency: PLAN.currency, unit_amount: d.cents, recurring: { interval: d.interval }, lookup_key: d.key, transfer_lookup_key: true, nickname: d.nickname, metadata: { app: 'owned-map' } })).id;
  }
  return byKey;
}

/** The Checkout / subscription line items for a number of assets: the plan once, plus the extra assets. Returns { items: [{ price, quantity }], quote }. */
export function planItems(prices, assets, interval) {
  const q = quote(assets, interval);
  return { quote: q, items: [{ price: prices[priceKey(q.tier, q.interval)], quantity: 1 }, ...(q.extra ? [{ price: prices[priceKey('extra', q.interval)], quantity: q.extra }] : [])] };
}

const iso = s => (s ? new Date(Number(s) * 1000).toISOString() : null);
/**
 * The customer portal needs a configuration in the Stripe account (Settings, Billing, Customer portal). When the account has none yet, Stripe refuses
 * to open it; this finds ours (by metadata) or creates it, so nobody has to set it up by hand: card, invoices, cancel at the end of the period.
 * Changing the number of assets is done inside the app, not in the portal.
 */
export async function ensurePortalConfig(stripe, site) {
  const list = await stripe('GET', '/v1/billing_portal/configurations', { active: true, limit: 20 });
  const mine = (list?.data || []).find(x => x?.metadata?.app === 'owned-map');
  if (mine) return mine;
  return stripe('POST', '/v1/billing_portal/configurations', {
    metadata: { app: 'owned-map' },
    business_profile: { headline: 'Manage your Owned Map plan', privacy_policy_url: `${site}/privacy.html`, terms_of_service_url: `${site}/terms.html` },
    default_return_url: `${site}/app.html`,
    features: {
      customer_update: { enabled: true, allowed_updates: ['email'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'] } },
    },
  });
}

/** A Stripe subscription -> the row we store. */
export function subscriptionRow(sub, userId, eventAt = 0) {
  const items = sub.items?.data || [];
  const end = sub.current_period_end ?? items[0]?.current_period_end;
  return {
    user_id: userId, stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id, stripe_subscription_id: sub.id, status: sub.status,
    assets_allowed: allowedFromItems(items.map(i => ({ lookup_key: i.price?.lookup_key, quantity: i.quantity }))),
    current_period_end: iso(end), trial_end: iso(sub.trial_end), cancel_at_period_end: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    last_event_at: eventAt, updated_at: new Date().toISOString(),
  };
}

export function supabaseClient(env, fetchImpl = fetch) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new StripeError('The database is not configured.', 503, 'not_configured');
  return (path, init = {}) => fetchImpl(`${base}${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers || {}) } });
}

/** Writes a subscription row, unless a newer event already did (Stripe does not promise delivery order). */
export async function saveSubscription(sb, row) {
  const cur = await sb(`/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(row.user_id)}&select=last_event_at`);
  if (cur.ok) { const prev = (await cur.json())[0]; if (prev && Number(prev.last_event_at) > Number(row.last_event_at) && Number(row.last_event_at) > 0) return false; }
  const r = await sb('/rest/v1/subscriptions?on_conflict=user_id', { method: 'POST', body: JSON.stringify(row), headers: { prefer: 'resolution=merge-duplicates,return=minimal' } });
  if (!r.ok) throw new StripeError('Could not save the subscription.', 502, 'save_failed');
  return true;
}
