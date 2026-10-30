// "Plan and billing": start the free trial or subscribe, change how many assets the plan covers, and open Stripe's portal for card, invoices and cancelling.
// What the plan allows is decided by the database (src/billing-core.js has the rules; the migration enforces them). This file is only the screen.
import { h } from './dom.js';
import { PLAN, cleanAssets, priceCents, usd, billingView } from './billing-core.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** ctx: { cloud, openModal, modal, toast, run, message, used: () => number of real assets, superadmin: () => boolean } */
export function createBillingUi(ctx) {
  const { cloud, openModal, modal, toast, run, message, used, superadmin } = ctx;
  let sub = null;
  const view = () => billingView(sub, { used: used(), superadmin: superadmin() });

  /** The stored subscription, or null (none yet, or the billing update was not applied). */
  async function load() { try { sub = (await cloud.rest('GET', '/subscriptions?select=*'))[0] || null; } catch { sub = null; } return sub; }
  const label = () => view().label;

  /** After coming back from Stripe the webhook may take a few seconds: wait for the plan to show up. */
  async function waitForPlan(tries = 8) {
    for (let i = 0; i < tries; i++) { await load(); if (['trial', 'active'].includes(view().state)) return true; await sleep(1500); }
    return false;
  }

  const go = async (body, label2) => run(label2, async () => cloud.billing(body));

  function open() {
    const v = view();
    const slider = h('input', { id: 'bl-range', type: 'range', min: PLAN.included, max: PLAN.maxAssets, step: 1, value: v.state === 'trial' || v.state === 'active' || v.state === 'past_due' ? Math.max(PLAN.included, v.allowed) : PLAN.included, 'aria-label': 'Number of assets' });
    const count = h('b', { id: 'bl-count' }), price = h('b', { id: 'bl-price' });
    const paint = () => { const n = cleanAssets(slider.value); count.textContent = String(n); price.textContent = `${usd(priceCents(n))} a month`; };
    slider.addEventListener('input', paint); paint();
    const picker = h('div', { class: 'bl-pick' }, h('label', { for: 'bl-range' }, 'How many assets do you want to track?'), slider,
      h('p', { class: 'bl-sum' }, count, ' assets · ', price), h('p', { class: 'hint' }, `${usd(PLAN.baseCents)} includes ${PLAN.included} assets, then ${usd(PLAN.extraCents)} for each extra one. Up to ${PLAN.maxAssets}.`));
    const err = h('p', { class: 'err form-err', role: 'alert' });
    const btn = (text, fn, kind = 'btn btn-primary btn-sm') => { const b = h('button', { type: 'button', class: kind }, h('span', { class: 'lbl' }, text), h('span', { class: 'spin', 'aria-hidden': 'true' })); b.addEventListener('click', async () => { b.disabled = true; b.classList.add('busy'); try { await fn(); } finally { b.disabled = false; b.classList.remove('busy'); } }); return b; };
    const portal = btn(v.state === 'trial' ? 'Add a card' : 'Manage payment and invoices', async () => { const r = await go({ action: 'portal' }, 'Could not open the billing page'); if (r?.url) location.href = r.url; }, 'btn btn-dark btn-sm');
    let body;

    if (v.state === 'comped') {
      body = h('p', { class: 'modal-text' }, 'Your account has unlimited access. There is nothing to pay.');
    } else if (v.state === 'none' || v.state === 'ended') {
      const trial = v.trialAvailable;
      body = h('div', {}, h('p', { class: 'modal-text' }, v.state === 'ended' ? 'Your plan has ended. Your assets are all still here and you can still look at them; to add more, choose a plan again.' : trial ? `Try it free for ${PLAN.trialDays} days. No card needed to start.` : 'Choose how many assets you want to track.'), picker, err,
        h('div', { class: 'modal-actions' }, btn(trial ? `Start ${PLAN.trialDays}-day free trial` : 'Subscribe', async () => { err.textContent = ''; const r = await go({ action: 'checkout', assets: cleanAssets(slider.value) }, 'Could not start checkout'); if (r?.url) location.href = r.url; })));
    } else {
      const changed = () => cleanAssets(slider.value) !== v.allowed;
      const update = btn('Update plan', async () => {
        if (!changed()) { toast('That is already your plan.'); return; }
        const r = await go({ action: 'change', assets: cleanAssets(slider.value) }, 'Could not change the plan');
        if (r?.ok) { await load(); toast('Plan updated. Stripe adjusts the next invoice for the difference.'); open(); }
      });
      body = h('div', {},
        h('p', { class: `bl-line ${v.state}` }, v.state === 'trial' ? `Free trial: ${v.trialDaysLeft} day${v.trialDaysLeft === 1 ? '' : 's'} left, until ${v.renews}. Add a card before then to keep your plan.` : v.state === 'past_due' ? 'Your last payment failed. Stripe will try again; update your card to avoid losing access.' : v.cancelAtEnd ? `Your plan ends on ${v.renews}. You keep access until then.` : `Active. Next payment on ${v.renews}.`),
        h('p', { class: 'hint' }, `Using ${v.used} of ${v.allowed} assets.`), picker, err,
        h('div', { class: 'modal-actions' }, portal, update));
    }
    openModal(h('div', { class: 'modal-card wide bl' },
      h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, 'Plan and billing'), h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')),
      body, h('p', { class: 'hint' }, 'Payments are handled by Stripe; we never see your card. Nothing is ever deleted if a plan ends or shrinks: you only cannot add more assets.')));
  }
  return { open, load, label, waitForPlan, view };
}
