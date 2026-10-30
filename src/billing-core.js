// Plans and billing rules, in one place. Pure functions: the app, the server (api/billing.js, api/stripe-webhook.js) and the tests share them.
// The price is the one shown on the website: a base plan with 3 assets, plus a fixed amount for each extra asset.
export const PLAN = {
  name: 'Owned Map', currency: 'usd', interval: 'month',
  baseCents: 4700, included: 3, extraCents: 1500, maxAssets: 50,
  trialDays: 14,                                   // free, no card; 0 turns the trial off
  keys: { base: 'ownedmap_base_monthly', extra: 'ownedmap_extra_asset_monthly' }, // Stripe lookup keys: the prices are found (or created) by these
};

/** Number of assets a person chose, clamped to what the plan allows; null when it is not a number. */
export const cleanAssets = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(PLAN.maxAssets, Math.max(PLAN.included, n)) : null; };
export const extraQty = n => Math.max(0, (cleanAssets(n) ?? PLAN.included) - PLAN.included);
export const priceCents = n => PLAN.baseCents + extraQty(n) * PLAN.extraCents;
export const usd = cents => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** How many assets a subscription pays for, from its items [{ lookup_key, quantity }]. 0 when there is no base plan. */
export function allowedFromItems(items = []) {
  let base = 0, extra = 0;
  for (const it of items) {
    const q = Number(it.quantity) || 0;
    if (it.lookup_key === PLAN.keys.base) base += q; else if (it.lookup_key === PLAN.keys.extra) extra += q;
  }
  return base > 0 ? base * PLAN.included + extra : 0;
}

export const LIVE = ['trialing', 'active', 'past_due']; // statuses that give access (past_due: the payment is being retried)
const DAY = 86400000;
const dayOf = iso => (iso ? String(iso).slice(0, 10) : '');

/**
 * What the screen shows about a stored subscription row (or null).
 * state: none | trial | active | past_due | ended | comped. canAdd says whether the plan has room for `used` + 1 assets.
 */
export function billingView(sub, { used = 0, superadmin = false, now = Date.now() } = {}) {
  if (superadmin || sub?.status === 'comped') return { state: 'comped', allowed: Infinity, used, canAdd: true, label: superadmin ? 'Super admin · unlimited' : 'Unlimited access' };
  if (!sub || !LIVE.includes(sub.status)) {
    const trialUsed = Boolean(sub?.trial_end ?? sub?.trialEnd);
    return { state: sub && sub.status !== 'none' ? 'ended' : 'none', allowed: 0, used, canAdd: false, trialAvailable: PLAN.trialDays > 0 && !trialUsed, label: sub && sub.status !== 'none' ? 'No active plan' : 'No plan yet' };
  }
  const allowed = Number(sub.assets_allowed ?? sub.assetsAllowed) || 0, trialEnd = sub.trial_end ?? sub.trialEnd, end = sub.current_period_end ?? sub.currentPeriodEnd;
  const cancel = Boolean(sub.cancel_at_period_end ?? sub.cancelAtPeriodEnd);
  const trialLeft = sub.status === 'trialing' && trialEnd ? Math.max(0, Math.ceil((Date.parse(trialEnd) - now) / DAY)) : null;
  const state = sub.status === 'trialing' ? 'trial' : sub.status === 'past_due' ? 'past_due' : 'active';
  return {
    state, allowed, used, canAdd: used < allowed, cancelAtEnd: cancel, trialDaysLeft: trialLeft, renews: dayOf(trialLeft !== null ? trialEnd : end),
    label: state === 'trial' ? `Trial · ${trialLeft} day${trialLeft === 1 ? '' : 's'} left` : state === 'past_due' ? 'Payment failed' : cancel ? `Ends ${dayOf(end)}` : `${allowed} assets`,
  };
}
