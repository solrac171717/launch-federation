// Plans and billing rules, in one place. Pure functions: the app, the server (api/billing.js, api/stripe-webhook.js) and the tests share them.
// The price is the one shown on the website: a base plan with 3 assets, plus an amount for each extra asset that gets lower as the portfolio grows.
export const PLAN = {
  name: 'Owned Map', currency: 'usd', interval: 'month',
  baseCents: 4700, included: 3, maxAssets: 100, yearlyOff: 0.30, // paying a year at once takes 30% off twelve months
  // Extra assets get cheaper as the portfolio grows. Each band prices the assets inside it: the 4th to the 10th cost $15, the 11th to the 25th $10, the 26th onwards $5.
  tiers: [{ upTo: 10, cents: 1500 }, { upTo: 25, cents: 1000 }, { upTo: 100, cents: 500 }],
  trialDays: 7,                                    // free, but a card is required (charged when the trial ends); 0 turns the trial off
  // Stripe lookup keys: the prices are found (or created) by these. `extra` and `extraYear` are the first band and kept as they were, so existing subscriptions stay valid.
  keys: {
    base: 'ownedmap_base_monthly', baseYear: 'ownedmap_base_yearly',
    extra: 'ownedmap_extra_asset_monthly', extraYear: 'ownedmap_extra_asset_yearly',
    extra2: 'ownedmap_extra_asset_tier2_monthly', extra2Year: 'ownedmap_extra_asset_tier2_yearly',
    extra3: 'ownedmap_extra_asset_tier3_monthly', extra3Year: 'ownedmap_extra_asset_tier3_yearly',
  },
};

/** Number of assets a person chose, clamped to what the plan allows; null when it is not a number. */
export const cleanAssets = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(PLAN.maxAssets, Math.max(PLAN.included, n)) : null; };
export const cleanInterval = v => (v === 'year' ? 'year' : 'month');
export const yearCents = monthly => Math.round(monthly * 12 * (1 - PLAN.yearlyOff));
/** How many extra assets fall in each price band for n assets in total, e.g. 12 -> [7, 2, 0]. */
export function tierQty(n) {
  const total = cleanAssets(n) ?? PLAN.included; let from = PLAN.included;
  return PLAN.tiers.map(t => { const q = Math.max(0, Math.min(total, t.upTo) - from); from = Math.max(from, t.upTo); return q; });
}
export const extraQty = n => tierQty(n).reduce((a, b) => a + b, 0);
/** What a plan for n assets costs per billing period: per month, or per year with the discount. */
export const priceCents = (n, interval = 'month') => {
  const year = cleanInterval(interval) === 'year', unit = c => (year ? yearCents(c) : c);
  return unit(PLAN.baseCents) + tierQty(n).reduce((sum, q, i) => sum + q * unit(PLAN.tiers[i].cents), 0);
};
/** The Stripe lookup keys of the three extra-asset prices, in band order, for a billing interval. */
export const tierKeys = interval => (cleanInterval(interval) === 'year' ? [PLAN.keys.extraYear, PLAN.keys.extra2Year, PLAN.keys.extra3Year] : [PLAN.keys.extra, PLAN.keys.extra2, PLAN.keys.extra3]);
/** The Stripe lookup keys (base plan, extra assets by band) of a billing interval. */
export const keysFor = interval => ({ base: cleanInterval(interval) === 'year' ? PLAN.keys.baseYear : PLAN.keys.base, extra: tierKeys(interval)[0], extras: tierKeys(interval) });
export const usd = cents => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
/** The extra-asset prices in words, for screens and legal text: "$15 each for assets 4 to 10, $10 each for 11 to 25, and $5 each from the 26th". */
export function extraText() {
  let from = PLAN.included + 1; const parts = PLAN.tiers.map((t, i) => { const last = i === PLAN.tiers.length - 1; const text = last && t.upTo >= PLAN.maxAssets ? `${usd(t.cents)} each from the ${from}th` : `${usd(t.cents)} each for assets ${from} to ${t.upTo}`; from = t.upTo + 1; return text; });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
}

/** How many assets a subscription pays for, from its items [{ lookup_key, quantity }]. 0 when there is no base plan. */
export function allowedFromItems(items = []) {
  const extraKeys = [...tierKeys('month'), ...tierKeys('year')];
  let base = 0, extra = 0;
  for (const it of items) {
    const q = Number(it.quantity) || 0;
    if (it.lookup_key === PLAN.keys.base || it.lookup_key === PLAN.keys.baseYear) base += q; else if (extraKeys.includes(it.lookup_key)) extra += q;
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
