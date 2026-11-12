// Blocks every "X vs Owned Map" page repeats in its own words: the Owned Map price block, the estate section and the closing "using both" section.
// Pages keep the claims about the rival to themselves; only Owned Map's own facts live here, so a price or a feature can never drift between pages.
import { PLAN, priceCents, usd, extraText } from '../src/billing-core.js';

export const c = n => `<sup class="cite"><a href="#src-${n}" aria-label="Source ${n}">[${n}]</a></sup>`;
export const m = n => usd(priceCents(n)), y = n => usd(priceCents(n, 'year'));
export { PLAN, usd };

export const omPrice = () => `<p>Owned Map&rsquo;s pricing is public and simple. ${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets. ${extraText()}, up to ${PLAN.maxAssets} assets. Paying yearly is ${Math.round(PLAN.yearlyOff * 100)}% less. There is a ${PLAN.trialDays}-day free trial, and a card is required to start it.</p>
<table><thead><tr><th>Assets tracked</th><th>Owned Map monthly</th><th>Owned Map paid yearly</th></tr></thead><tbody>
<tr><td>${PLAN.included}</td><td>${m(PLAN.included)}</td><td>${y(PLAN.included)}</td></tr>
<tr><td>10</td><td>${m(10)}</td><td>${y(10)}</td></tr>
<tr><td>25</td><td>${m(25)}</td><td>${y(25)}</td></tr>
<tr><td>50</td><td>${m(50)}</td><td>${y(50)}</td></tr></tbody></table>`;

export const estate = (what) => `<p>${what} In Caring.com&rsquo;s 2025 survey of more than 2,500 US adults, only 24% said they have a will, down from 33% in 2022.${c(7)} The Nebraska Department of Insurance advises recording brand, price, purchase date, model, serial number and receipts, with photos; for a vehicle, a boat or an aircraft, add the registration or title number.${c(8)}</p>
<p>Owned Map lets you share a read-only link, give household members access, and set a private emergency sheet for one trusted person, with no bank balance anywhere in the app. Our page on the <a href="/solutions/net-worth-tracker-without-bank-linking">net worth tracker without linking bank accounts</a> explains the approach.</p>`;

export const startFromCsv = `<p>To start Owned Map from a spreadsheet, download the <a href="/downloads/asset-inventory-template.csv">inventory template</a>, paste your list in and import the CSV. If it is not for you, you can cancel from your profile menu and export your data first. You are not locked in.</p>`;

export const trialFaq = ['Can I try Owned Map before paying?', `Yes. There is a ${PLAN.trialDays}-day free trial, and a card is required to start it. You can cancel from your profile menu at any time.`];
export const noBankFaq = ['Does Owned Map connect to my bank?', 'No. Owned Map never connects to a bank, a broker or a card. You enter figures by hand, import a CSV or review details read from a document you upload.'];
export const typesFaq = ['Can Owned Map track boats, aircraft and vehicles?', 'Yes. Owned Map tracks yachts, sailboats, jet skis, aircraft, land, RVs, cars, trucks, motorcycles and heavy equipment as well as property, each with its documents and dates.'];
