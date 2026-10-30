// From a paid (or trial-started) Stripe Checkout session to an Owned Map account: find or create the user for the email typed at checkout,
// attach the subscription, and remember whether this checkout created the account (only then may its payer choose the first password).
// Idempotent: the webhook and the page shown after paying both call it, in any order, any number of times.
import { randomBytes } from 'node:crypto';
import { LIVE } from '../src/billing-core.js';
import { subscriptionRow, saveSubscription, StripeError } from './_stripe.js';

export const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{6,200}$/;

export async function provisionFromSession({ env, sb, stripe, fetchImpl = fetch, session, at = Math.floor(Date.now() / 1000) }) {
  const email = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
  if (!email || session.mode !== 'subscription' || !session.subscription) throw new StripeError('This checkout has no subscription or email.', 400, 'bad_session');
  const base = String(env.SUPABASE_URL).replace(/\/$/, '');
  const admin = (path, init = {}) => fetchImpl(`${base}/auth/v1/admin${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' } });
  const lookup = async () => { const r = await sb('/rest/v1/rpc/user_id_by_email', { method: 'POST', body: JSON.stringify({ mail: email }) }); return r.ok ? (await r.json()) || null : null; };

  let userId = await lookup(), created = false;
  if (!userId) {
    // the account exists, but nobody knows its password yet: the payer chooses it on the next page, or asks for a reset by email
    const made = await admin('/users', { method: 'POST', body: JSON.stringify({ email, password: `${randomBytes(24).toString('base64url')}Aa1!`, email_confirm: true }) });
    if (made.ok) { const j = await made.json(); userId = j.id || j.user?.id; created = Boolean(userId); }
    else userId = await lookup(); // someone else created it a moment ago
    if (!userId) throw new StripeError('Could not create the account.', 502, 'create_failed');
  }

  const prev = await sb(`/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=status,stripe_subscription_id`);
  const had = prev.ok ? (await prev.json())[0] : null;
  const sub = await stripe('GET', `/v1/subscriptions/${encodeURIComponent(session.subscription)}`);
  // somebody who already has a live plan (or who typed another person's email) must not replace it, and must not be billed twice: the new
  // subscription is cancelled at once (it is only a trial, nothing has been charged yet). Running this again finds it already cancelled.
  const duplicate = Boolean(had && LIVE.includes(had.status) && had.stripe_subscription_id !== sub.id);
  if (duplicate) { if (LIVE.includes(sub.status)) await stripe('DELETE', `/v1/subscriptions/${encodeURIComponent(sub.id)}`); }
  else await saveSubscription(sb, subscriptionRow(sub, userId, at));

  await sb('/rest/v1/checkout_claims?on_conflict=session_id', { method: 'POST', body: JSON.stringify({ session_id: session.id, user_id: userId, claimable: created }), headers: { prefer: 'resolution=ignore-duplicates,return=minimal' } });
  return { userId, email, created, duplicate };
}
