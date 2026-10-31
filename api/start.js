// GET /api/start?assets=N&interval=month|year: the "Start for Free" button. It needs no account: it creates a Stripe Checkout session for N assets (10 by default)
// and sends the visitor straight to it. There they type their email and card; the 7-day trial starts, and the price is charged when it ends
// unless they cancel first. The account is created afterwards, from the email typed there (see api/stripe-webhook.js and api/welcome.js).
// Env: STRIPE_SECRET_KEY, optional SITE_URL.
import { PLAN, cleanAssets, cleanInterval, priceText } from '../src/billing-core.js';
import { stripeClient, ensurePrices, planItems, StripeError } from './_stripe.js';

const page = (res, status, title, text) => {
  res.statusCode = status; res.setHeader('content-type', 'text/html; charset=utf-8'); res.setHeader('cache-control', 'no-store');
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 20px;color:#0B1736"><h1 style="font-size:1.4rem">${title}</h1><p>${text}</p><p><a href="/">Back to Owned Map</a></p>`);
};

// a visitor cannot create more than a few sessions a minute (this memory is per server instance: a brake, not a guarantee)
const seen = new Map();
export function allowed(ip, now = Date.now(), limit = 12) {
  const recent = (seen.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= limit) { seen.set(ip, recent); return false; }
  seen.set(ip, [...recent, now]); if (seen.size > 5000) seen.clear(); return true;
}

export async function runStart({ env, fetchImpl = fetch, assets, interval, siteUrl }) {
  let stripe; try { stripe = stripeClient({ env, fetchImpl }); } catch { return { status: 503, title: 'Not available yet', text: 'Sign-up is not open yet. Please try again soon.' }; }
  const site = String(siteUrl || env.SITE_URL || '').replace(/\/$/, '');
  const n = cleanAssets(assets ?? PLAN.tiers[0].included) ?? PLAN.tiers[0].included, iv = cleanInterval(interval);
  try {
    const { items } = planItems(await ensurePrices(stripe), n, iv);
    const session = await stripe('POST', '/v1/checkout/sessions', {
      mode: 'subscription', allow_promotion_codes: true, payment_method_collection: 'always', billing_address_collection: 'auto',
      line_items: items,
      success_url: `${site}/welcome.html?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${site}/`,
      metadata: { source: 'landing', assets: String(n), interval: iv },
      subscription_data: { metadata: { source: 'landing' }, ...(PLAN.trialDays > 0 ? { trial_period_days: PLAN.trialDays } : {}) },
      custom_text: { submit: { message: `${PLAN.trialDays > 0 ? `After your ${PLAN.trialDays}-day free trial your card is charged ${priceText(n, iv)} unless you cancel before it ends. ` : ''}By continuing you agree to the [Terms](${site}/terms.html) and the [Privacy Policy](${site}/privacy.html).` } },
    });
    return { status: 303, location: session.url };
  } catch (e) {
    console.error('start error', e instanceof StripeError ? e.message : e);
    return { status: 502, title: 'We could not open the payment page', text: 'Please try again in a moment.' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('allow', 'GET'); return page(res, 405, 'Not allowed', 'Use the Start for Free button.'); }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (!allowed(ip)) return page(res, 429, 'Too many tries', 'Please wait a minute and try again.');
  const q = new URL(req.url, 'http://x').searchParams;
  const r = await runStart({ env: process.env, assets: q.get('assets'), interval: q.get('interval'), siteUrl: process.env.SITE_URL || `https://${req.headers.host}` });
  if (r.location) { res.statusCode = 303; res.setHeader('location', r.location); res.setHeader('cache-control', 'no-store'); return res.end(); }
  return page(res, r.status, r.title, r.text);
}
