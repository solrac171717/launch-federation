// "Landlord Studio vs Owned Map". Same rules as content/compare.mjs: only claims we can back, Landlord Studio described from what it publishes, outside claims numbered.
// Citations use the ids of SOURCES in compare.mjs (19 to 21 here; 5 to 8 shared); compare.mjs renumbers them per page, in order of appearance.
import { PLAN, priceCents, usd, extraText } from '../src/billing-core.js';

const c = n => `<sup class="cite"><a href="#src-${n}" aria-label="Source ${n}">[${n}]</a></sup>`;
const m = n => usd(priceCents(n)), y = n => usd(priceCents(n, 'year'));

export const LANDLORD = {
  slug: 'landlord-studio-vs-owned-map',
  rival: 'Landlord Studio',
  rivalUrl: 'https://www.landlordstudio.com',
  crumb: 'Landlord Studio vs Owned Map',
  title: 'Landlord Studio vs Owned Map (2026): Landlord Studio Alternative',
  description: 'Landlord Studio vs Owned Map compared on rental accounting, tenants, other assets, ownership shares and price. A Landlord Studio alternative for real assets.',
  h1: 'Landlord Studio vs Owned Map: an honest comparison',
  primary: 'landlord studio vs owned map',
  takeaways: [
    'Landlord Studio is software for running rentals: tenant screening, online rent, bank feeds, receipts, reports and a Schedule E report. Its Go plan is free for up to 3 units.',
    'Owned Map is not property management. It shows every property and every other asset you own on a map, with yield, cash flow, loan, your share, documents and dates.',
    'The two charge on different bases. Landlord Studio prices per unit, Owned Map per asset, so a 12-unit portfolio in 3 buildings can cost less on Landlord Studio.',
    'If you run rentals and want the books done, start with Landlord Studio. If you also own land, vehicles or boats, or want the whole picture on one map, add Owned Map.',
  ],
  lead: 'Landlord Studio vs Owned Map is a comparison between software that helps you run rental properties and software that helps you see everything you own. Landlord Studio finds and screens tenants, collects rent online, imports your bank transactions, scans receipts and produces the reports landlords need at tax time, and its entry plan is free for three units. Owned Map does none of that. It puts each property, and every other asset, on a map, with its value, yield, cash flow, loan, your ownership share, documents and renewal dates. This page compares the two honestly, explains the one difference that surprises most landlords (the two charge on different bases), and shows with a worked example what each tells you about three buildings and twelve units.',
  toc: [['verdict', 'The short answer'], ['at-a-glance', 'At a glance'], ['starting-point', 'Running rentals or seeing everything'], ['features', 'Feature by feature'], ['basis', 'Per unit or per asset'], ['example', 'A worked example: three buildings, twelve units'], ['reading', 'Reading the example'], ['shares', 'Shared ownership'], ['records', 'Documents and dates'], ['estate', 'If something happens to you'], ['price', 'Price'], ['choose', 'Who should choose which'], ['both', 'Using both'], ['method', 'How we checked'], ['sources', 'Sources']],
  sections: [
    { id: 'verdict', h2: 'The short answer', html: `<ul><li><strong>Pick Landlord Studio</strong> if you run rentals and want help with the work: tenants, rent, receipts, bank feeds and tax-time reports, with a free plan for up to three units.${c(19)}${c(20)}</li><li><strong>Pick Owned Map</strong> if you want one record of everything you own, not only rentals: each property with its yield, cash flow, loan and your share, plus land, vehicles, boats and aircraft, on a map, with documents and dates.</li><li><strong>Use both</strong> if you run rentals and want a clear picture of the whole portfolio above the day-to-day.</li></ul>
<p>Where we describe Landlord Studio, we rely on its own website and pricing page, and we link each claim. We have not used a paid Landlord Studio account. If you want the same comparison for another landlord tool, see our <a href="/compare/stessa-vs-owned-map">Stessa vs Owned Map</a> page.</p>` },
    { id: 'at-a-glance', h2: 'At a glance', html: `<table><thead><tr><th></th><th>Landlord Studio</th><th>Owned Map</th></tr></thead><tbody>
<tr><td>Built around</td><td>Running rental properties</td><td>Everything you own, on a map</td></tr>
<tr><td>Bank feeds and bookkeeping</td><td><strong>Yes</strong>: bank feeds, receipt capture, expense tracking${c(19)}</td><td>No, by design</td></tr>
<tr><td>Rent collection online</td><td><strong>Yes</strong>, with reminders and late fees${c(19)}</td><td>No</td></tr>
<tr><td>Tenant screening and listings</td><td><strong>Yes</strong>: listings syndicated to Zillow and others; screening paid by the tenant${c(19)}${c(20)}</td><td>No</td></tr>
<tr><td>Tax-time reports</td><td><strong>Yes</strong>: P&amp;L and a Schedule E report${c(19)}</td><td>No</td></tr>
<tr><td>Accounting integration</td><td><strong>Xero</strong>, on the paid plans${c(20)}</td><td>No</td></tr>
<tr><td>Yield and cash flow per property</td><td>Reports built from your bookkeeping</td><td><strong>Yes</strong>: gross and net yield, yield on cost, cash flow, payback</td></tr>
<tr><td>Equity, loan-to-value, sale simulation</td><td>Not listed on the pages we read</td><td><strong>Yes</strong></td></tr>
<tr><td>Land, vehicles, boats, aircraft</td><td>Not listed on the pages we read</td><td><strong>Yes, each as a pin</strong></td></tr>
<tr><td>Map of everything you own</td><td>Not advertised</td><td><strong>Yes</strong>, globe and country views</td></tr>
<tr><td>Ownership share of a property</td><td>Described for UK tax filing${c(21)}</td><td><strong>Yes</strong>, for every figure and the net worth</td></tr>
<tr><td>Price</td><td>Free for up to 3 units; paid from $15 a month${c(20)}</td><td>${usd(PLAN.baseCents)} a month for ${PLAN.included} assets</td></tr></tbody></table>
<p>&ldquo;Not listed&rdquo; and &ldquo;not advertised&rdquo; mean we did not find it on the Landlord Studio pages we read in November 2026. Features can exist without being listed, so ask before you rule one out.</p>` },
    { id: 'starting-point', h2: 'Running rentals or seeing everything', html: `<p>These two answer different questions, and it helps to name them.</p>
<p><strong>Landlord Studio answers &ldquo;how do I run my rentals?&rdquo;</strong> It describes itself as property management software built for independent landlords: find and screen tenants, collect rent online, keep your accounts and prepare Schedule E reports in one place.${c(19)} It lists listings syndication, online rent with reminders and late fees, bank feeds, receipt scanning, a tenant portal and maintenance management.${c(20)} That is the operating side of being a landlord, and it is why many small landlords choose it.</p>
<p><strong>Owned Map answers &ldquo;what do I own, and how is it doing?&rdquo;</strong> Open any asset and you see its value, what you paid, the income and expenses, the loan, your share, and the documents and dates attached. From those it calculates appreciation, net operating income, gross and net yield, yield on cost, monthly cash flow, equity, loan-to-value and your net worth after debt, and it can simulate a sale. The numbers are the ones you enter: Owned Map does not connect to bank accounts.</p>
<p>The question to ask yourself is which job takes your time. If it is the monthly paperwork, you want the first. If it is deciding which properties to keep, refinance or sell, and knowing where the papers are, you want the second.</p>` },
    { id: 'features', h2: 'Feature by feature', html: `<h3>Running the tenancy</h3>
<p>Landlord Studio wins this outright. Listings, tenant screening, online rent, automated reminders and late fees, a tenant portal and maintenance requests are its day job.${c(19)}${c(20)} Owned Map has none of them.</p>
<h3>Bookkeeping</h3>
<p>Landlord Studio imports bank transactions through bank feeds, captures receipts on the go with its mobile app and produces more than fifteen reports, including a profit-and-loss and a Schedule E report.${c(19)} On its free Go plan the bank feeds are not included; they arrive with the paid plans, along with Xero integration and advanced reports.${c(20)} Owned Map has no transactions. You enter each property&rsquo;s yearly income and expenses, which is enough for yield and cash flow but not for a ledger.</p>
<h3>Judging a property</h3>
<p>This is where Owned Map is stronger. For every property it shows gross yield, net yield on current value, yield on cost, cash flow after the loan, payback in years, equity and loan-to-value, ranks your properties by net yield, and shows what you would keep if you sold. Landlord Studio&rsquo;s reports describe what happened in your accounts; Owned Map&rsquo;s numbers compare properties on the same basis.</p>
<h3>Anything that is not a rental</h3>
<p>Land, vehicles, boats, aircraft and heavy equipment each get a pin, a value, costs, documents and dates in Owned Map, and they appear in your net worth. We did not find these on the Landlord Studio pages we read.</p>
<h3>Reading a document for you</h3>
<p>Upload a deed, an invoice or a contract to Owned Map and the details are read for you to review before anything is saved. Always check the result: it is a help, not an oracle. Our free <a href="/downloads/asset-inventory-template.csv">inventory template</a> uses the exact columns the app imports.</p>` },
    { id: 'basis', h2: 'Per unit or per asset', html: `<p>This is the difference that surprises most landlords, and it can reverse the price comparison.</p>
<p>Landlord Studio prices by <strong>unit</strong>: its Go plan is free for three units, and Pro and Pro Plus list &ldquo;3 units + $1.20 per extra unit&rdquo;.${c(20)} Owned Map prices by <strong>asset</strong>: ${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets, and ${extraText()}.</p>
<p>A 12-unit portfolio held in three buildings is 12 units to Landlord Studio and 3 assets to Owned Map. On Landlord Studio&rsquo;s Pro plan, by our arithmetic from its listed prices, that is $15 plus 9 extra units at $1.20, or $25.80 a month. On Owned Map it is ${m(3)} a month. So the more units per building you have, the better the per-unit model looks, and the more buildings and other assets you have, the better the per-asset model looks.</p>
<p>Neither is better in the abstract. It depends on what you own. Compare them with your own count of units and assets.</p>` },
    { id: 'example', h2: 'A worked example: three buildings, twelve units', html: `<p>Imagine a landlord with a six-unit building, a four-unit building and a duplex. These are the inputs for each.</p>
<table><thead><tr><th></th><th>Six-unit</th><th>Four-unit</th><th>Duplex</th></tr></thead><tbody>
<tr><td>Value</td><td>$1,150,000</td><td>$620,000</td><td>$395,000</td></tr>
<tr><td>Purchase cost</td><td>$890,000</td><td>$505,000</td><td>$330,000</td></tr>
<tr><td>Rent a year</td><td>$108,000</td><td>$57,600</td><td>$31,200</td></tr>
<tr><td>Expenses a year</td><td>$41,400</td><td>$22,100</td><td>$10,700</td></tr>
<tr><td>Loan balance</td><td>$620,000</td><td>$350,000</td><td>$225,000</td></tr>
<tr><td>Loan payment a month</td><td>$4,100</td><td>$2,350</td><td>$1,500</td></tr></tbody></table>
<p>What Owned Map calculates from those figures:</p>
<table><thead><tr><th></th><th>Six-unit</th><th>Four-unit</th><th>Duplex</th></tr></thead><tbody>
<tr><td>Net operating income</td><td>$66,600 a year</td><td>$35,500 a year</td><td>$20,500 a year</td></tr>
<tr><td>Gross yield</td><td>9.4%</td><td>9.3%</td><td>7.9%</td></tr>
<tr><td>Net yield on value</td><td>5.8%</td><td>5.7%</td><td>5.2%</td></tr>
<tr><td>Yield on cost</td><td>7.5%</td><td>7.0%</td><td>6.2%</td></tr>
<tr><td>Cash flow after the loan</td><td>$17,400 a year, $1,450 a month</td><td>$7,300 a year, $608 a month</td><td>$2,500 a year, $208 a month</td></tr>
<tr><td>Equity</td><td>$530,000</td><td>$270,000</td><td>$170,000</td></tr>
<tr><td>Loan-to-value</td><td>53.9%</td><td>56.5%</td><td>57.0%</td></tr>
<tr><td>Payback</td><td>13.4 years</td><td>14.2 years</td><td>16.1 years</td></tr>
<tr><td>Appreciation</td><td>29.2%</td><td>22.8%</td><td>19.7%</td></tr></tbody></table>
<p>The whole portfolio: value <strong>$2,165,000</strong>, debt <strong>$1,195,000</strong>, equity <strong>$970,000</strong>, and cash flow after the loans of <strong>$27,200 a year, $2,267 a month</strong>.</p>` },
    { id: 'reading', h2: 'Reading the example', html: `<p>The rent roll alone would tell you the six-unit building collects the most. The comparison on one basis tells you more.</p>
<p>All three buildings sit in a narrow band on gross yield, but the duplex is the weakest on every measure that matters: a 5.2% net yield, a 6.2% yield on cost, a 16.1-year payback and only $208 a month of cash flow after its loan. It also has the highest loan-to-value, at 57.0%, so it has the least margin if values soften. The six-unit building does the heavy lifting, with $1,450 of the $2,267 monthly cash flow.</p>
<p>Two details make the numbers honest. The net yield is the standard capitalization rate, net operating income divided by <em>current value</em> rather than the price you paid.${c(5)} And the loan payment is deliberately outside net operating income: the IRS tells US rental owners that mortgage principal payments cannot simply be deducted, and to separate repairs from improvements and keep accurate records.${c(6)} Your bookkeeping tool records what happened; a tracker compares what you hold.</p>
<p>That is the division of labour. Landlord Studio is how the yearly rent and expenses get into a clean set of books. Owned Map is where you read them side by side.</p>` },
    { id: 'shares', h2: 'Shared ownership', html: `<p>Many properties are not owned 100% by one person. Landlord Studio&rsquo;s help centre describes ownership percentages for co-owned properties, but the article we read is for the UK&rsquo;s Making Tax Digital for Income Tax: each owner reports a different share of the rental income to HMRC, and the percentages must total 100%.${c(21)} We did not find an equivalent for US reporting on the pages we read, so if you co-own a US property, ask.</p>
<p>In Owned Map you enter the figures for the whole property and set your share once. Everything it shows and adds up is on your share, so a property worth $400,000 with a $200,000 loan, held 40%, counts as $160,000 of value and $80,000 of debt. It does not keep a ledger of who put in what.</p>` },
    { id: 'records', h2: 'Documents and dates', html: `<p>Landlords generate paper: deeds, leases, insurance, loan agreements, tax bills. Landlord Studio&rsquo;s plans list document storage, from ten documents on the free plan to unlimited on the top plan, and automated lease-expiry reminders on the paid plans.${c(20)} Owned Map keeps documents on any asset, rental or not, and holds the dates (insurance, tax, registration, inspections) with reminders, so the policy and its renewal sit next to the thing they cover.</p>
<p>Whichever you use, keep four things together for every asset: proof of ownership, the insurance policy, the loan agreement if there is one, and the next date that needs action.</p>` },
    { id: 'estate', h2: 'If something happens to you', html: `<p>A landlord with several buildings, partners and loans leaves a complicated picture. In Caring.com&rsquo;s 2025 survey of more than 2,500 US adults, only 24% said they have a will, down from 33% in 2022.${c(7)} An executor cannot settle what nobody knows exists.</p>
<p>Owned Map lets you share a read-only link, give household members access, and set a private emergency sheet for one trusted person. The same discipline applies to everything you own: the Nebraska Department of Insurance advises recording brand, price, purchase date, model, serial number and receipts, with photos.${c(8)} Add the deed reference for property and the registration or title number for vehicles.</p>` },
    { id: 'price', h2: 'Price', html: `<p>Landlord Studio&rsquo;s pricing page lists a free Go plan (three units, one user, standard reports, ten documents), Pro at $15 a month ($144 a year) and Pro Plus at $35 a month ($336 a year), with three units included and $1.20 per extra unit on the paid plans, and a 14-day trial of Pro.${c(20)} Be aware that the page shows prices in both pounds and dollars, so check <a href="https://www.landlordstudio.com/pricing" rel="noopener" target="_blank">landlordstudio.com/pricing</a> for the figures that apply to you.</p>
<p>Owned Map&rsquo;s pricing is public and simple. ${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets. ${extraText()}, up to ${PLAN.maxAssets} assets. Paying yearly is ${Math.round(PLAN.yearlyOff * 100)}% less. There is a ${PLAN.trialDays}-day free trial, and a card is required.</p>
<table><thead><tr><th>Assets tracked</th><th>Owned Map monthly</th><th>Owned Map paid yearly</th></tr></thead><tbody>
<tr><td>${PLAN.included}</td><td>${m(PLAN.included)}</td><td>${y(PLAN.included)}</td></tr>
<tr><td>10</td><td>${m(10)}</td><td>${y(10)}</td></tr>
<tr><td>25</td><td>${m(25)}</td><td>${y(25)}</td></tr>
<tr><td>50</td><td>${m(50)}</td><td>${y(50)}</td></tr></tbody></table>
<p>To be direct: if all you own is a few rentals and you want the work done, Landlord Studio is cheaper and does more of what you asked for, and for up to three units it is free. Owned Map is worth its price when your question is bigger than the bookkeeping: you hold shares with partners, own land, vehicles or boats, or want one record of everything with the papers and dates attached.</p>` },
    { id: 'choose', h2: 'Who should choose which', html: `<h3>Choose Landlord Studio if</h3>
<ul><li>You want tenants, rent, receipts and tax reports handled in one tool.</li><li>You own a few rentals, and you want to start free.</li><li>You use Xero for your accounts.</li></ul>
<h3>Choose Owned Map if</h3>
<ul><li>You want to compare properties on yield, cash flow, equity and loan-to-value.</li><li>You own more than rentals: land, vehicles, boats, aircraft or equipment.</li><li>You hold some properties with partners and want your own share.</li><li>You prefer a tool that does not connect to your bank.</li></ul>
<h3>A five-question test</h3>
<ol><li>Do you spend your time on rent, receipts and tenants? If yes, Landlord Studio.</li><li>Do you ask &ldquo;which property should I sell or refinance?&rdquo; If yes, Owned Map.</li><li>Do you own anything that is not a rental? If yes, Owned Map covers it.</li><li>Do you have many units in few buildings? If yes, compare the per-unit and per-asset prices.</li><li>Could someone find your documents if something happened to you? If not, fix that first, with either tool.</li></ol>` },
    { id: 'both', h2: 'Using both', html: `<p>A sensible setup for a landlord with other assets is Landlord Studio for the monthly running and Owned Map for the portfolio. Once a year, copy each property&rsquo;s rent and expenses from Landlord Studio&rsquo;s reports into Owned Map, so the figures stay in step. If you want the fuller picture of how Owned Map works for property, read about the <a href="/solutions/rental-property-portfolio-tracker">rental property portfolio tracker</a>.</p>
<p>To start Owned Map from a spreadsheet, download the <a href="/downloads/asset-inventory-template.csv">inventory template</a>, paste your list in and import the CSV. If it is not for you, you can cancel from your profile menu and export your data first.</p>` },
    { id: 'method', h2: 'How we checked', html: `<p>We wrote this page on ${'November 5, 2026'}. What we say about Landlord Studio comes from its public home page, its pricing page and one help-centre article. The $25.80 figure is our arithmetic from the prices listed there. We have not used a paid Landlord Studio account, so where we found nothing we say &ldquo;not listed&rdquo;, not &ldquo;not available&rdquo;. What we say about Owned Map is what the product does today.</p>
<p>Every outside claim is numbered and listed under Sources below. Both products change. If you spot something out of date, email <a href="mailto:support@ownedmap.com">support@ownedmap.com</a> and we will correct it.</p>` },
  ],
  faq: [
    ['Is Owned Map a replacement for Landlord Studio?', 'Not for running rentals. Owned Map has no bank feeds, rent collection, tenant screening or tax forms. It shows every property and other asset on a map with yield, cash flow, loan, your share, documents and dates.'],
    ['Is Landlord Studio free?', 'Landlord Studio lists a free Go plan for up to three units, with paid Pro and Pro Plus plans that add bank feeds, advanced reports and Xero. Its pricing page shows both pounds and dollars, so check the current figures.'],
    ['How does Landlord Studio charge, per unit or per property?', 'Per unit: three units are included, and its paid plans list $1.20 for each extra unit. Owned Map charges per asset, so a building with many units counts as one.'],
    ['Does Owned Map collect rent or screen tenants?', 'No. Owned Map does not collect rent, screen tenants or connect to your bank. You enter each property’s yearly income and expenses and it calculates NOI, yield and cash flow.'],
    ['Can Owned Map track land, vehicles and boats?', 'Yes. Owned Map tracks land, vehicles, boats, aircraft and heavy equipment as well as property, each with its documents and dates.'],
    ['Can I try Owned Map before paying?', `Yes. There is a ${PLAN.trialDays}-day free trial, and a card is required to start it. You can cancel from your profile menu at any time.`],
  ],
};
