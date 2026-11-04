// "Stessa vs Owned Map". Same rules as content/compare.mjs: only claims we can back, Stessa described from what it publishes, outside claims numbered.
// Citations use the ids of SOURCES in compare.mjs (14 and 15 here; 5, 6, 7 and 8 shared); compare.mjs renumbers them per page, in order of appearance.
import { PLAN, priceCents, usd, extraText } from '../src/billing-core.js';

const c = n => `<sup class="cite"><a href="#src-${n}" aria-label="Source ${n}">[${n}]</a></sup>`;
const m = n => usd(priceCents(n)), y = n => usd(priceCents(n, 'year'));

export const STESSA = {
  slug: 'stessa-vs-owned-map',
  rival: 'Stessa',
  rivalUrl: 'https://www.stessa.com',
  crumb: 'Stessa vs Owned Map',
  title: 'Stessa vs Owned Map (2026): Stessa Alternative for Real Assets',
  description: 'Stessa vs Owned Map compared on rental bookkeeping, other assets, documents, ownership shares and price. A Stessa alternative for property, boats and more.',
  h1: 'Stessa vs Owned Map: an honest comparison',
  primary: 'stessa vs owned map',
  takeaways: [
    'Stessa is a landlord tool: bank feeds, bookkeeping, rent collection, tenant screening and tax reports. Its Essentials plan is free.',
    'Owned Map is not property management. It is a map of everything you own, with the value, yield, cash flow, loan, documents and dates of each asset, rentals and non-rentals alike.',
    `Stessa has paid plans at $12 to $35 a month. Owned Map starts at ${usd(PLAN.baseCents)} a month for ${PLAN.included} assets, so for rentals alone Stessa is far cheaper.`,
    'If you run rentals in the US, start with Stessa. If you also own land, vehicles, boats or aircraft, or hold shares in properties, Owned Map covers what Stessa does not.',
  ],
  lead: 'Stessa vs Owned Map is a comparison between a tool that helps you run rental properties and a tool that helps you keep track of everything you own. Stessa connects to your bank accounts, sorts the income and expenses of each rental, collects rent and produces the reports landlords need at tax time, and its entry plan is free. Owned Map does none of that. It puts each asset on a map, rentals and everything else, and shows its value, yield, cash flow, loan, documents and renewal dates. This page compares the two honestly, says where Stessa is the better choice (more often than you might expect), and shows with one worked example what Owned Map adds when your holdings are shared or varied.',
  toc: [['verdict', 'The short answer'], ['at-a-glance', 'At a glance'], ['starting-point', 'Landlord tool or asset manager'], ['features', 'Feature by feature'], ['example', 'A worked example: a shared duplex and a rental house'], ['shares', 'Shared ownership and non-rental assets'], ['records', 'Records, documents and dates'], ['estate', 'If something happens to you'], ['price', 'Price'], ['choose', 'Who should choose which'], ['both', 'Using both'], ['method', 'How we checked'], ['sources', 'Sources']],
  sections: [
    { id: 'verdict', h2: 'The short answer', html: `<ul><li><strong>Pick Stessa</strong> if you run rental properties and want the books done for you: bank feeds, income and expense reports, rent collection and tax-time reports, with a free plan to start.${c(14)}</li><li><strong>Pick Owned Map</strong> if you want one record of everything you own, not only rentals: land, vehicles, boats, aircraft, properties held with partners, each with its value, loan, documents and dates, on a map.</li><li><strong>Use both</strong> if you are a landlord with other assets, or want a clear view of your net worth above the day-to-day bookkeeping.</li></ul>
<p>Where we describe Stessa, we rely on its own website and pricing page, and we link each claim so you can check it. We have not used a paid Stessa account for this page.</p>` },
    { id: 'at-a-glance', h2: 'At a glance', html: `<table><thead><tr><th></th><th>Stessa</th><th>Owned Map</th></tr></thead><tbody>
<tr><td>Built around</td><td>Running rental properties</td><td>Everything you own, on a map</td></tr>
<tr><td>Bank feeds and automatic bookkeeping</td><td><strong>Yes</strong>${c(14)}</td><td>No, by design</td></tr>
<tr><td>Rent collection</td><td><strong>Yes</strong>: ACH, credit card or debit card${c(14)}</td><td>No</td></tr>
<tr><td>Tenant screening, leases, maintenance</td><td><strong>Yes</strong>${c(15)}</td><td>No</td></tr>
<tr><td>Tax-time reports</td><td><strong>Yes</strong>: a Schedule E report on its Manage plan${c(15)}</td><td>No</td></tr>
<tr><td>Rental numbers per property (NOI, yield, cash flow)</td><td>Income statement and net cash flow reports${c(14)}</td><td><strong>Yes</strong>, yield on cost and on value, plus monthly cash flow</td></tr>
<tr><td>Land, vehicles, boats, aircraft</td><td>Not listed on the pages we read</td><td><strong>Yes, each as a pin</strong></td></tr>
<tr><td>Ownership share and net worth after debt</td><td>Not listed on the pages we read</td><td><strong>Yes</strong></td></tr>
<tr><td>Map of everything you own</td><td>Not advertised</td><td><strong>Yes</strong>, globe and country views</td></tr>
<tr><td>Fill in an asset from a deed or invoice</td><td>Not advertised</td><td><strong>Yes</strong>, you review before saving</td></tr>
<tr><td>Documents and renewal dates on each asset</td><td>Lease and maintenance tools for rentals${c(15)}</td><td><strong>Yes</strong>, for every asset</td></tr>
<tr><td>Price</td><td>Free Essentials plan; paid plans from $12 a month${c(15)}</td><td>${usd(PLAN.baseCents)} a month for ${PLAN.included} assets</td></tr></tbody></table>
<p>&ldquo;Not advertised&rdquo; and &ldquo;not listed&rdquo; mean we did not find it on the Stessa pages we read in November 2026. Features can exist without being listed, so ask Stessa before you rule one out.</p>` },
    { id: 'starting-point', h2: 'Landlord tool or asset manager', html: `<p>These two products answer different questions, and it helps to say which.</p>
<p><strong>Stessa answers &ldquo;how are my rentals doing this month?&rdquo;</strong> It says its bookkeeping is automated and meant to replace spreadsheets, that you can link a separate bank account for each property, and that it produces an income statement, a net cash flow report, a schedule of real estate owned and a tenant ledger, plus tax package reports.${c(14)} It also handles the operating side: online rent collection, vacancy marketing, tenant screening and maintenance requests.${c(15)} That is a lot of landlord work taken off your hands, and the entry plan is free.</p>
<p><strong>Owned Map answers &ldquo;what do I own, where is it and what is it worth?&rdquo;</strong> Rentals are one kind of asset among several. Open any pin and you see the value, what you paid, the income and expenses, the loan, your share of ownership and the documents and dates attached. From those it calculates appreciation, net operating income, yield, monthly cash flow and your net worth after debt, and the value history grows each time you update. The numbers are the ones you enter; Owned Map does not connect to bank accounts.</p>
<p>So the first question is whether you need an operating tool or a record. If you have tenants and transactions every month, you need an operating tool. If you have a handful of valuable things and want to know their worth, their costs and where the papers are, you need a record. Many landlords need both.</p>` },
    { id: 'features', h2: 'Feature by feature', html: `<h3>Bookkeeping</h3>
<p>Stessa wins this outright. Automatic bank feeds and per-property reports are the reason landlords use it, and Owned Map does not try to compete. Owned Map has no transactions: you enter yearly income and expenses for each asset, which is enough for yield and cash flow, not for a ledger.</p>
<h3>Running the tenancy</h3>
<p>Rent collection, late fees, screening, lease agreements and maintenance tracking are Stessa&rsquo;s operating tools.${c(14)}${c(15)} Owned Map has none of them. If you collect rent every month, use a tool built for it.</p>
<h3>Tax time</h3>
<p>Stessa mentions built-in tax package reports, and its pricing page lists a Schedule E report on the Manage plan.${c(14)}${c(15)} Schedule E is a US tax form, which tells you Stessa is written with US landlords in mind. Owned Map produces no tax forms. It does give you the NOI and cash flow of each asset, which is useful for talking to an accountant.</p>
<h3>Anything that is not a rental</h3>
<p>This is where Owned Map earns its place. Land, vehicles, boats, aircraft and any other asset get a pin, a value, costs, documents and dates, and appear in your net worth. We did not find these asset types on the Stessa pages we read.</p>
<h3>Reading a document for you</h3>
<p>Upload a deed, an invoice or a contract to Owned Map and the details are read for you to review before anything is saved. It saves the typing when you add an asset; always check the result.</p>
<h3>Reports and exports</h3>
<p>Owned Map exports PDF, Excel and CSV reports and imports a CSV. Our free <a href="/downloads/asset-inventory-template.csv">inventory template</a> uses the exact columns the app reads, and it works as a checklist even if you never sign up.</p>` },
    { id: 'example', h2: 'A worked example: a shared duplex and a rental house', html: `<p>Imagine a landlord with two properties. One is a duplex owned 50/50 with a business partner. The other is a house they own alone. These are the inputs for each.</p>
<h3>The duplex (you own 50%)</h3>
<ul><li>Estimated value: <strong>$720,000</strong>. Purchase cost: <strong>$600,000</strong></li><li>Rent collected in a year: <strong>$54,000</strong>. Yearly expenses: <strong>$16,800</strong></li><li>Loan balance: <strong>$380,000</strong>, with payments of <strong>$2,400 a month</strong></li></ul>
<p>For the whole property:</p>
<ul><li>Net operating income: $54,000 &minus; $16,800 = <strong>$37,200 a year</strong></li><li>Yield on what was paid: $37,200 &divide; $600,000 = <strong>6.2%</strong></li><li>Yield on what it is worth now: $37,200 &divide; $720,000 = <strong>5.2%</strong></li><li>Appreciation: ($720,000 &minus; $600,000) &divide; $600,000 = <strong>20.0%</strong></li><li>Cash flow after the loan: $37,200 &minus; ($2,400 &times; 12) = <strong>$8,400 a year</strong></li></ul>
<p>Your half: equity of ($720,000 &minus; $380,000) &times; 50% = <strong>$170,000</strong>, and cash flow of <strong>$4,200 a year, $350 a month</strong>.</p>
<h3>The rental house (you own 100%)</h3>
<ul><li>Estimated value: <strong>$310,000</strong>. Purchase cost: <strong>$255,000</strong></li><li>Rent collected: <strong>$26,400</strong>. Expenses: <strong>$8,100</strong></li><li>Loan balance: <strong>$140,000</strong>, with payments of <strong>$1,100 a month</strong></li></ul>
<ul><li>Net operating income: $26,400 &minus; $8,100 = <strong>$18,300 a year</strong></li><li>Yield on what was paid: $18,300 &divide; $255,000 = <strong>7.2%</strong></li><li>Yield on what it is worth now: $18,300 &divide; $310,000 = <strong>5.9%</strong></li><li>Equity: $310,000 &minus; $140,000 = <strong>$170,000</strong></li><li>Cash flow after the loan: $18,300 &minus; ($1,100 &times; 12) = <strong>$5,100 a year, $425 a month</strong></li></ul>
<h3>Together</h3>
<p>Your share of the value: $360,000 + $310,000 = <strong>$670,000</strong>. Your share of the debt: $190,000 + $140,000 = <strong>$330,000</strong>. Net worth in these two properties: <strong>$340,000</strong>. Cash flow reaching you: $4,200 + $5,100 = <strong>$9,300 a year, $775 a month</strong>.</p>
<p>Two points matter here. First, the duplex looks great at 6.2% on cost, but 5.2% on what it is worth now, and the house is the better earner on both measures. That comparison across properties, on the same basis, is what lets you decide where to put the next dollar. The 5.2% is the standard capitalization rate, net operating income divided by <em>current value</em> rather than the original price.${c(5)}</p>
<p>Second, your half of a shared property is not the property. A tool that only knows whole properties will overstate what you own and what you earn. In Owned Map you set your share once, and the equity, cash flow and net worth are worked out for your share. We did not find ownership shares on the Stessa pages we read, so if you hold property with partners, ask.</p>
<p>Keeping the books for either property is a different job: the IRS reminds rental owners to keep accurate records and to separate repairs from improvements, and says mortgage principal payments cannot simply be deducted.${c(6)} That is what a bookkeeping tool such as Stessa is for.</p>` },
    { id: 'shares', h2: 'Shared ownership and non-rental assets', html: `<p>Most landlord software assumes you own 100% of rental properties, in your own name, in one country. Real portfolios are untidier. A cousin owns the other half of the duplex. A boat is held with two friends. A plot of land earns nothing and costs tax every year. A vintage car is an asset but not an income. None of these is a rental, and all of them are part of what you own.</p>
<p>Owned Map handles each as an asset with a share: the value, the cost, the income if any, the loan if any, and your percentage. Net worth is calculated on your share and after debt, so a half-share in a $720,000 duplex with a $380,000 loan counts as $170,000, not $720,000.</p>
<p>That matters when you decide what to do next. If you ask whether to sell the land, refinance the duplex or insure the boat for more, you want the same measures for all of them on one screen. Stessa&rsquo;s strength is going deep on rentals; Owned Map&rsquo;s strength is putting every kind of asset on the same footing.</p>` },
    { id: 'records', h2: 'Records, documents and dates', html: `<p>Ownership produces paperwork and deadlines: a deed, a title, an insurance policy that renews, a registration, a yearly inspection, a loan agreement, a property tax bill. The expensive surprises usually come from a date nobody wrote down.</p>
<p>Stessa gives rentals lease agreements, maintenance tracking and screening tools.${c(15)} Owned Map keeps documents on any asset and holds the dates (insurance, tax, registration, inspections) with reminders, so the policy and its renewal sit next to the thing they cover, whether it is a house, a trailer or a plane.</p>
<p>The habit is worth having with or without a tool. For every asset keep four things together: proof of ownership, the insurance policy, the loan agreement if there is one, and the next date that needs action.</p>` },
    { id: 'estate', h2: 'If something happens to you', html: `<p>A landlord with several properties, partners and loans leaves a complicated picture. In Caring.com&rsquo;s 2025 survey of more than 2,500 US adults, only 24% said they have a will, down from 33% in 2022.${c(7)} A will is not an inventory, and an executor cannot settle what nobody knows exists.</p>
<p>Owned Map lets you share a read-only link, give household members access, and set a private emergency sheet for one trusted person, so someone can find out what exists, where it is and where the papers are. The same discipline applies to everything you own: the Nebraska Department of Insurance advises recording brand, price, purchase date, model, serial number and receipts, with photos.${c(8)} Add the registration or title number for vehicles and the deed reference for property.</p>` },
    { id: 'price', h2: 'Price', html: `<p>Stessa&rsquo;s pricing page lists a free Essentials plan and two paid plans: Manage at $12 a month billed annually ($15 billed monthly) and Pro at $28 a month billed annually ($35 billed monthly). All plans include unlimited properties. It does not list a free trial, because the entry plan is free.${c(15)} Prices can change, so check <a href="https://www.stessa.com/pricing" rel="noopener" target="_blank">stessa.com/pricing</a>.</p>
<p>Owned Map&rsquo;s pricing is public and simple. ${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets. ${extraText()}, up to ${PLAN.maxAssets} assets. Paying yearly is ${Math.round(PLAN.yearlyOff * 100)}% less. There is a ${PLAN.trialDays}-day free trial, and a card is required.</p>
<table><thead><tr><th>Assets tracked</th><th>Owned Map monthly</th><th>Owned Map paid yearly</th></tr></thead><tbody>
<tr><td>${PLAN.included}</td><td>${m(PLAN.included)}</td><td>${y(PLAN.included)}</td></tr>
<tr><td>10</td><td>${m(10)}</td><td>${y(10)}</td></tr>
<tr><td>25</td><td>${m(25)}</td><td>${y(25)}</td></tr>
<tr><td>50</td><td>${m(50)}</td><td>${y(50)}</td></tr></tbody></table>
<p>Let us be plain about this. If all you own is rental property in the United States and you want the books done, Stessa&rsquo;s free plan is very hard to beat, and Owned Map is the wrong purchase. Even Stessa Pro at $28 a month billed annually is $336 a year, less than Owned Map for ${PLAN.included} assets (${y(PLAN.included)}). Owned Map becomes worth its price when your holdings are not only rentals: when you hold shares with partners, own land, vehicles, boats or aircraft, or simply want one record of all of it with the papers and dates attached.</p>` },
    { id: 'choose', h2: 'Who should choose which', html: `<h3>Choose Stessa if</h3>
<ul><li>You own rentals in the US and want bank feeds, reports and rent collection.</li><li>You want a free plan to start and the books ready for your accountant.</li><li>You need tenant screening, leases and maintenance handled in the same place.</li></ul>
<h3>Choose Owned Map if</h3>
<ul><li>You own more than rentals: land, vehicles, boats, aircraft or other assets.</li><li>You hold properties with partners and want your own share of the value, debt and cash flow.</li><li>You want every asset on a map, with documents and renewal dates attached.</li><li>You prefer a tool that does not connect to your bank accounts.</li></ul>
<h3>A five-question test</h3>
<ol><li>Do you collect rent every month and need the books to match? If yes, Stessa.</li><li>Do you own anything that is not a rental? If yes, Owned Map covers it.</li><li>Do you hold a share of a property with someone else? If yes, Owned Map.</li><li>Is price your top concern and are you all rentals? If yes, start with Stessa&rsquo;s free plan.</li><li>Could someone find your documents if something happened to you? If not, fix that first, with either tool.</li></ol>` },
    { id: 'both', h2: 'Using both', html: `<p>A sensible setup for a landlord with other assets is Stessa for the monthly running of the rentals and Owned Map for the whole picture. The only discipline is to enter each property&rsquo;s yearly income and expenses in Owned Map from Stessa&rsquo;s reports once a year, so the figures stay in step.</p>
<p>To start Owned Map from a spreadsheet, download the <a href="/downloads/asset-inventory-template.csv">inventory template</a>, paste your list in and import the CSV. Then add loans, shares and documents asset by asset. If it is not for you, you can cancel from your profile menu and export your data first.</p>` },
    { id: 'method', h2: 'How we checked', html: `<p>We wrote this page on ${'November 4, 2026'}. What we say about Stessa comes from its own public pages, its home page and its pricing page. We have not used a paid Stessa account, so where we found nothing we say &ldquo;not listed&rdquo;, not &ldquo;not available&rdquo;. That Schedule E is a US form is our reading of what the pricing page lists. What we say about Owned Map is what the product does today.</p>
<p>Every outside claim is numbered and listed under Sources below. Both products change. If you spot something out of date, email <a href="mailto:support@ownedmap.com">support@ownedmap.com</a> and we will correct it.</p>` },
  ],
  faq: [
    ['Is Owned Map a replacement for Stessa?', 'Not for running rentals. Owned Map has no bank feeds, rent collection or tenant tools. It is a record of everything you own, rentals and other assets, with values, yield, cash flow, loans, shares, documents and dates.'],
    ['Is Stessa free?', 'Stessa lists a free Essentials plan, plus Manage at $12 a month billed annually and Pro at $28 a month billed annually. Check its pricing page for current figures.'],
    ['Does Owned Map collect rent or do bookkeeping?', 'No. Owned Map does not connect to bank accounts or handle transactions. You enter yearly income and expenses for each asset, and it calculates NOI, yield and cash flow.'],
    ['Can Owned Map track a property I own with a partner?', 'Yes. You set your ownership share, and equity, cash flow and net worth are calculated for your share and after debt.'],
    ['Can Stessa track boats, vehicles and land?', 'On the pages we read, Stessa describes tools for rental properties and does not list vehicles, boats or land. Ask Stessa if you need them.'],
    ['Can I try Owned Map before paying?', `Yes. There is a ${PLAN.trialDays}-day free trial, and a card is required to start it. You can cancel from your profile menu at any time.`],
  ],
};
