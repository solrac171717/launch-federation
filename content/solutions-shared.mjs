// Helpers shared by the solution and guide pages: the citation marker and the price block (the same words on every page, so a price can never drift).
import { PLAN, priceCents, usd, extraText } from '../src/billing-core.js';

export const c = n => `<sup class="cite"><a href="#src-${n}" aria-label="Source ${n}">[${n}]</a></sup>`;
export const m = n => usd(priceCents(n)), y = n => usd(priceCents(n, 'year'));

export const priceTable = `<table><thead><tr><th>Assets tracked</th><th>Monthly</th><th>Paid yearly</th></tr></thead><tbody>
<tr><td>${PLAN.included}</td><td>${m(PLAN.included)}</td><td>${y(PLAN.included)}</td></tr>
<tr><td>10</td><td>${m(10)}</td><td>${y(10)}</td></tr>
<tr><td>25</td><td>${m(25)}</td><td>${y(25)}</td></tr>
<tr><td>50</td><td>${m(50)}</td><td>${y(50)}</td></tr></tbody></table>`;
export const priceText = `${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets. ${extraText()}, up to ${PLAN.maxAssets} assets. Paying yearly is ${Math.round(PLAN.yearlyOff * 100)}% less. There is a ${PLAN.trialDays}-day free trial, and a card is required.`;
export const trialFaq = ['Can I try it before paying?', `Yes. There is a ${PLAN.trialDays}-day free trial, and a card is required to start it. You can cancel from your profile menu at any time.`];
export { PLAN, usd, priceCents };
