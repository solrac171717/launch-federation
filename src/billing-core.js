// Plans and billing rules, in one place. Pure functions: the app, the server (api/billing.js, api/stripe-webhook.js) and the tests share them.
// The customer says how many assets they want to track; the cheapest plan that covers them is chosen:
//   Owner   $47 a month, 10 assets included.      Family  $119 a month, 40 assets included.
//   Each asset beyond what the plan includes costs $9 a month. Every plan can be paid yearly (ten months for twelve).
// Every feature is in every plan: the plans differ only in how many assets they cover.
export const PLAN = {
  name: 'Owned Map', currency: 'usd', maxAssets: 100,
  trialDays: 7,                                    // free, but a card is required (charged when the trial ends); 0 turns the trial off
  tiers: [
    { id: 'owner', name: 'Owner', included: 10, cents: { month: 4700, year: 47000 } },
    { id: 'family', name: 'Family', included: 40, cents: { month: 11900, year: 119000 } },
  ],
  extra: { cents: { month: 900, year: 9000 } },
};
export const INTERVALS = ['month', 'year'];
export const cleanInterval = v => (v === 'year' ? 'year' : 'month');
/** The Stripe lookup key of a price: kind is a tier id ('owner', 'family') or 'extra'. The prices are found (or created) by these keys. */
export const priceKey = (kind, interval) => `ownedmap_v2_${kind}_${cleanInterval(interval)}`;
const LEGACY = { ownedmap_base_monthly: { base: 3 }, ownedmap_extra_asset_monthly: { extra: 1 } }; // the first version of the plan, in case anybody still has it

/** Every price the plans need: [{ key, kind, interval, cents, nickname }]. */
export const priceDefs = () => INTERVALS.flatMap(interval => [
  ...PLAN.tiers.map(t => ({ key: priceKey(t.id, interval), kind: t.id, interval, cents: t.cents[interval], nickname: `${t.name}, ${t.included} assets, ${interval === 'year' ? 'yearly' : 'monthly'}` })),
  { key: priceKey('extra', interval), kind: 'extra', interval, cents: PLAN.extra.cents[interval], nickname: `Extra asset, ${interval === 'year' ? 'yearly' : 'monthly'}` },
]);
const ITEM = Object.fromEntries([
  ...PLAN.tiers.flatMap(t => INTERVALS.map(i => [priceKey(t.id, i), { base: t.included, tier: t.id, interval: i }])),
  ...INTERVALS.map(i => [priceKey('extra', i), { extra: 1, interval: i }]),
  ...Object.entries(LEGACY).map(([k, v]) => [k, { ...v, interval: 'month' }]),
]);
/** What a Stripe price (by lookup key) means for us: { base, tier, interval } for a plan, { extra, interval } for an extra asset, or null. */
export const describeKey = key => ITEM[key] || null;

/** Number of assets a person chose, clamped to what the plans allow; null when it is not a number. */
export const cleanAssets = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(PLAN.maxAssets, Math.max(1, n)) : null; };

/**
 * The cheapest plan for `assets`: { assets, interval, tier, name, extra, allowed, cents, monthlyCents }.
 * `allowed` is how many assets that plan covers (never fewer than asked); `cents` is the price of one billing period.
 */
export function quote(assets, interval = 'month') {
  const n = cleanAssets(assets) ?? 1, iv = cleanInterval(interval);
  let best = null;
  for (const t of PLAN.tiers) {
    const extra = Math.max(0, n - t.included), cents = t.cents[iv] + extra * PLAN.extra.cents[iv];
    if (!best || cents < best.cents) best = { tier: t.id, name: t.name, extra, allowed: t.included + extra, cents };
  }
  return { assets: n, interval: iv, ...best, monthlyCents: iv === 'year' ? Math.round(best.cents / 12) : best.cents };
}
export const priceCents = (assets, interval = 'month') => quote(assets, interval).cents;
export const usd = cents => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
/** "$47 a month" / "$470 a year" */
export const priceText = (assets, interval = 'month') => `${usd(priceCents(assets, interval))} a ${cleanInterval(interval)}`;

/** How many assets a subscription pays for, from its items [{ lookup_key, quantity }]. 0 when there is no plan item. */
export function allowedFromItems(items = []) {
  let base = 0, extra = 0;
  for (const it of items) {
    const q = Number(it.quantity) || 0, d = describeKey(it.lookup_key);
    if (d?.base) base += q * d.base; else if (d?.extra) extra += q * d.extra;
  }
  return base > 0 ? base + extra : 0;
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
