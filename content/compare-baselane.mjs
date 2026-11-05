// "Baselane vs Owned Map". Same rules as content/compare.mjs: only claims we can back, Baselane described from what it publishes, outside claims numbered.
// Citations use the ids of SOURCES in compare.mjs (22 to 24 here; 5 to 8 shared); compare.mjs renumbers them per page, in order of appearance.
import { PLAN, priceCents, usd, extraText } from '../src/billing-core.js';

const c = n => `<sup class="cite"><a href="#src-${n}" aria-label="Source ${n}">[${n}]</a></sup>`;
const m = n => usd(priceCents(n)), y = n => usd(priceCents(n, 'year'));

export const BASELANE = {
  slug: 'baselane-vs-owned-map',
  rival: 'Baselane',
  rivalUrl: 'https://www.baselane.com',
  crumb: 'Baselane vs Owned Map',
  title: 'Baselane vs Owned Map (2026): Baselane Alternative for Real Assets',
  description: 'Baselane vs Owned Map compared on rental banking, bookkeeping, other assets, ownership shares and price. A Baselane alternative for property and vehicles.',
  h1: 'Baselane vs Owned Map: an honest comparison',
  primary: 'baselane vs owned map',
  takeaways: [
    'Baselane is banking plus bookkeeping for landlords: property-level accounts, automatic rent, tax packages and a Schedule E report. Its Core plan is free.',
    'Owned Map is not a bank and does not connect to one. It shows every property and every other asset you own on a map, with yield, cash flow, loan, your share, documents and dates.',
    'Baselane charges per transaction for some services (card rent payments, wires, screening). Owned Map has one monthly price per set of assets.',
    'If you want your rental money organized by property inside a bank account, look at Baselane. If you want to decide which assets to keep, add Owned Map.',
  ],
  lead: 'Baselane vs Owned Map is a comparison between a landlord bank and a map of what you own. Baselane gives you property-level banking and automated bookkeeping: separate accounts for each property or entity, rent collected into them, transactions tagged by property and tax category, and a tax package at the end of the year. Owned Map does none of that and holds no money. It puts each property, and every other asset you own, on a map, with value, yield, cash flow, loan, your share, documents and renewal dates. This page compares them honestly, says where Baselane is the better choice, and shows with a worked example what Owned Map adds when you own more than rentals.',
  toc: [['verdict', 'The short answer'], ['at-a-glance', 'At a glance'], ['starting-point', 'A landlord bank or a map of what you own'], ['features', 'Feature by feature'], ['banking', 'Banking is the real difference'], ['example', 'A worked example: a shop, a shared house and a sailboat'], ['reading', 'Reading the example'], ['records', 'Documents and dates'], ['estate', 'If something happens to you'], ['price', 'Price and fees'], ['choose', 'Who should choose which'], ['both', 'Using both'], ['method', 'How we checked'], ['sources', 'Sources']],
  sections: [
    { id: 'verdict', h2: 'The short answer', html: `<ul><li><strong>Pick Baselane</strong> if you want your rental money organized by property inside the bank account itself: property-level accounts, automatic rent, transactions tagged for tax and a Schedule E report, on a free Core plan.${c(22)}${c(23)}</li><li><strong>Pick Owned Map</strong> if you want to see and compare everything you own, rentals and not: yield, cash flow, equity and loan-to-value for each property, your share when you co-own, and land, vehicles, boats and aircraft on the same map with their documents and dates.</li><li><strong>Use both</strong> if you want the money handled where it moves and the portfolio read in one place.</li></ul>
<p>Where we describe Baselane, we rely on its own website and pricing page, and we link each claim. We have not opened a Baselane account. If you are comparing landlord tools, our <a href="/compare/landlord-studio-vs-owned-map">Landlord Studio vs Owned Map</a> page covers the accounting side.</p>` },
    { id: 'at-a-glance', h2: 'At a glance', html: `<table><thead><tr><th></th><th>Baselane</th><th>Owned Map</th></tr></thead><tbody>
<tr><td>Built around</td><td>Banking and bookkeeping for landlords</td><td>Everything you own, on a map</td></tr>
<tr><td>Holds your money</td><td><strong>Yes</strong>: accounts at Thread Bank, Member FDIC${c(22)}</td><td>No. It is not a bank and never touches money</td></tr>
<tr><td>Property-level accounts</td><td><strong>Yes</strong>, unlimited${c(22)}${c(23)}</td><td>Not applicable</td></tr>
<tr><td>Automatic bookkeeping and tagging</td><td><strong>Yes</strong>, by property and tax category${c(22)}</td><td>No</td></tr>
<tr><td>Rent collection</td><td><strong>Yes</strong>, with reminders and late fees${c(22)}${c(23)}</td><td>No</td></tr>
<tr><td>Tax package and Schedule E report</td><td><strong>Yes</strong>, on the free Core plan${c(23)}</td><td>No</td></tr>
<tr><td>Yield, cash flow and payback per property</td><td>Not listed on the pages we read</td><td><strong>Yes</strong></td></tr>
<tr><td>Equity, loan-to-value, sale simulation</td><td>Not listed on the pages we read</td><td><strong>Yes</strong></td></tr>
<tr><td>Land, vehicles, boats, aircraft</td><td>Not listed on the pages we read</td><td><strong>Yes, each as a pin</strong></td></tr>
<tr><td>Map of everything you own</td><td>Not advertised</td><td><strong>Yes</strong></td></tr>
<tr><td>Ownership share and net worth after debt</td><td>Not listed on the pages we read</td><td><strong>Yes</strong></td></tr>
<tr><td>Price</td><td>Core $0; Smart $20 a month on an annual plan; fees for some services${c(23)}</td><td>${usd(PLAN.baseCents)} a month for ${PLAN.included} assets</td></tr></tbody></table>
<p>&ldquo;Not listed&rdquo; and &ldquo;not advertised&rdquo; mean we did not find it on the Baselane pages we read in November 2026. Features can exist without being listed, so ask before you rule one out.</p>` },
    { id: 'starting-point', h2: 'A landlord bank or a map of what you own', html: `<p>It is easy to treat these as rivals because both mention rentals. They are not in the same category.</p>
<p><strong>Baselane is banking and bookkeeping for rental owners.</strong> Its homepage describes banking and bookkeeping that removes the mental overhead of managing rental finances for multi-property owners: unlimited property-specific accounts for all your entities, AI that tags transactions to the right entity, property and tax category, automatic invoices and reminders for collecting rent, and instant tax packages with ledgers, receipts and statements.${c(22)} The point is that the money, the records and the tax paperwork live together.</p>
<p><strong>Owned Map is a map and a calculator.</strong> It holds no money and connects to no bank. Open any asset and you see its value, what you paid, income, expenses, loan, your share, and the documents and dates attached, and from those the yield, cash flow, equity, loan-to-value, payback and net worth after debt. Its raw material is the figures you enter, once a quarter or once a year.</p>
<p>So the question is not which is better but which job you have. If your job is to keep a rental business&rsquo;s money tidy, Baselane. If it is to decide what to do with a set of assets, Owned Map.</p>` },
    { id: 'features', h2: 'Feature by feature', html: `<h3>Money and bookkeeping</h3>
<p>Baselane wins this without a contest. Its Core plan lists unlimited checking and savings accounts, physical and virtual debit cards with spend controls, property-level income and expense tracking, an accountant tax package with Schedule E reports, and automated rent, reminders and late fees.${c(23)} Owned Map holds no money and tracks no transactions.</p>
<h3>Paid features</h3>
<p>The Smart plan adds faster rent deposits, automatic tagging across more than 120 categories, receipt matching, balance sheet reports, cost segregation and shared access with role-based controls.${c(23)} These are bookkeeping and reporting features for a rental business.</p>
<h3>Judging the assets</h3>
<p>This is Owned Map&rsquo;s ground. For every property it shows gross yield, net yield on current value, yield on cost, cash flow after the loan, payback, equity and loan-to-value, ranks properties by net yield and simulates a sale. Baselane&rsquo;s own comparison page with Stessa emphasizes banking and bookkeeping features, which is a fair summary of what it is for.${c(24)}</p>
<h3>Anything that is not a rental</h3>
<p>Land, vehicles, boats, aircraft and heavy equipment each get a pin, a value, costs, documents and dates in Owned Map and appear in your net worth. We did not find them on the Baselane pages we read.</p>
<h3>Reading a document for you</h3>
<p>Upload a deed, an invoice or a contract to Owned Map and the details are read for you to review before anything is saved. Check the result; it is a help, not an oracle. Our free <a href="/downloads/asset-inventory-template.csv">inventory template</a> uses the exact columns the app imports.</p>` },
    { id: 'banking', h2: 'Banking is the real difference', html: `<p>Baselane is a financial technology company, not a bank. Its pages say it is not an FDIC-insured bank and that its banking services are provided by Thread Bank, Member FDIC.${c(22)} Whether that arrangement suits you is a choice to make by reading the terms, not a matter for us to judge.</p>
<p>What matters for this comparison is the consequence. A tool that holds your money is a tool you point your rent at, and that decision is bigger than choosing a tracker: it means opening accounts, redirecting tenants and moving balances. Some landlords love that because the books write themselves. Others prefer to keep their bank where it is and use tools that never touch the money.</p>
<p>Owned Map is the second kind. It does not connect to your bank, hold a balance or see a transaction, so there is nothing to open, nothing to move and no bank login to protect. The trade is that you enter the figures yourself.</p>` },
    { id: 'example', h2: 'A worked example: a shop, a shared house and a sailboat', html: `<p>Imagine an owner of three things: a retail unit rented to a shop, a house owned 50/50 with a brother and let to tenants, and a sailboat. These are the inputs.</p>
<h3>The retail unit</h3>
<ul><li>Value <strong>$780,000</strong>. Purchase cost <strong>$650,000</strong>. Rent <strong>$72,000</strong> a year. Expenses <strong>$19,500</strong>.</li><li>Loan balance <strong>$410,000</strong>, payments <strong>$2,900 a month</strong>.</li></ul>
<ul><li>Net operating income: $72,000 &minus; $19,500 = <strong>$52,500 a year</strong></li><li>Gross yield <strong>9.2%</strong>, net yield on value <strong>6.7%</strong>, yield on cost <strong>8.1%</strong></li><li>Cash flow after the loan: $52,500 &minus; ($2,900 &times; 12) = <strong>$17,700 a year, $1,475 a month</strong></li><li>Equity <strong>$370,000</strong>; loan-to-value <strong>52.6%</strong>; payback <strong>12.4 years</strong>; appreciation <strong>20.0%</strong></li></ul>
<h3>The house (you own 50%)</h3>
<ul><li>Value <strong>$350,000</strong>. Purchase cost <strong>$280,000</strong>. Rent <strong>$28,800</strong> a year. Expenses <strong>$9,600</strong>. Loan <strong>$190,000</strong>, payments <strong>$1,200 a month</strong>.</li></ul>
<ul><li>Net operating income: <strong>$19,200 a year</strong>. Gross yield <strong>8.2%</strong>, net yield <strong>5.5%</strong>, yield on cost <strong>6.9%</strong></li><li>Cash flow after the loan for the whole house: $19,200 &minus; $14,400 = <strong>$4,800 a year</strong>. Your half: <strong>$2,400 a year, $200 a month</strong></li><li>Equity for the whole house <strong>$160,000</strong>; your half <strong>$80,000</strong>; loan-to-value <strong>54.3%</strong>; payback <strong>14.6 years</strong></li></ul>
<h3>The sailboat</h3>
<ul><li>Worth <strong>$92,000</strong>, bought for $118,000, so it has lost <strong>22.0%</strong>. Mooring, insurance and upkeep cost <strong>$11,500</strong> a year, which is <strong>12.5%</strong> of its value.</li></ul>
<h3>Together, on your share</h3>
<p>Value: $780,000 + $175,000 + $92,000 = <strong>$1,047,000</strong>. Debt: $410,000 + $95,000 = <strong>$505,000</strong>. Net worth: <strong>$542,000</strong>. Cash flow from the two rentals: $17,700 + $2,400 = <strong>$20,100 a year, $1,675 a month</strong>.</p>` },
    { id: 'reading', h2: 'Reading the example', html: `<p>A bank account would show you $1,675 a month arriving. It would not tell you what to do with the three things behind it.</p>
<p>The retail unit is the strong performer: a 6.7% net yield and a 12.4-year payback. The house is respectable at 5.5%, but note that your half of its cash flow is only $200 a month for $80,000 of your equity. The sailboat is a different kind of asset altogether: it earns nothing, has lost 22.0% of what you paid, and costs 12.5% of its value every year to keep, about $958 a month. It is the largest drag on the picture and the one no rental tool would show.</p>
<p>Two points keep the numbers honest. The net yield is the capitalization rate, net operating income divided by <em>current value</em> rather than the original price.${c(5)} And the loan payment sits outside net operating income, because the IRS tells US rental owners that mortgage principal payments cannot simply be deducted; keep accurate records and separate repairs from improvements.${c(6)} The records are what Baselane&rsquo;s tax package is for. The comparison across assets is what Owned Map is for.</p>` },
    { id: 'records', h2: 'Documents and dates', html: `<p>Ownership produces paper and deadlines: a deed, a title, a lease, an insurance policy that renews, a registration, a loan agreement. The expensive surprises usually come from a date nobody wrote down.</p>
<p>Baselane stores receipts and generates tax packages with ledgers, receipts and statements for each property.${c(22)} Owned Map keeps documents on any asset, a house or a boat, and holds the dates (insurance, tax, registration, inspections) with reminders, so the policy and its renewal sit next to the thing they cover.</p>
<p>For every asset keep four things together: proof of ownership, the insurance policy, the loan agreement if there is one, and the next date that needs action.</p>` },
    { id: 'estate', h2: 'If something happens to you', html: `<p>Bank accounts leave statements; a boat or a share of a house does not. In Caring.com&rsquo;s 2025 survey of more than 2,500 US adults, only 24% said they have a will, down from 33% in 2022.${c(7)} An executor cannot settle what nobody knows exists.</p>
<p>Owned Map lets you share a read-only link, give household members access, and set a private emergency sheet for one trusted person. The Nebraska Department of Insurance advises recording brand, price, purchase date, model, serial number and receipts, with photos, and the same applies to vehicles and boats, with the registration or title number added.${c(8)}</p>` },
    { id: 'price', h2: 'Price and fees', html: `<p>Baselane&rsquo;s pricing page lists Core at $0 and Smart at $20 a month on an annual plan, with a 30-day trial of Smart. It also lists fees for some services: for example, rent paid by ACH carries a $2 fee that the landlord can cover or pass to the tenant, rent paid by debit or credit card carries a 3.49% charge, tenant screening starts at $24.99, and wires cost $15, waived with a $50,000 combined balance.${c(23)} Check <a href="https://www.baselane.com/pricing" rel="noopener" target="_blank">baselane.com/pricing</a> for today&rsquo;s terms. We do not quote its savings interest rate, because the pages we read showed placeholders where the figure should be.</p>
<p>Owned Map&rsquo;s pricing is public and simple. ${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets. ${extraText()}, up to ${PLAN.maxAssets} assets. Paying yearly is ${Math.round(PLAN.yearlyOff * 100)}% less. There is a ${PLAN.trialDays}-day free trial, and a card is required.</p>
<table><thead><tr><th>Assets tracked</th><th>Owned Map monthly</th><th>Owned Map paid yearly</th></tr></thead><tbody>
<tr><td>${PLAN.included}</td><td>${m(PLAN.included)}</td><td>${y(PLAN.included)}</td></tr>
<tr><td>10</td><td>${m(10)}</td><td>${y(10)}</td></tr>
<tr><td>25</td><td>${m(25)}</td><td>${y(25)}</td></tr>
<tr><td>50</td><td>${m(50)}</td><td>${y(50)}</td></tr></tbody></table>
<p>Baselane Core is free and Smart is $240 a year on an annual plan, so for the same three assets Owned Map (${y(PLAN.included)} a year paid yearly) costs more. They do different jobs, so the right comparison is what you would otherwise do. If you would otherwise keep a spreadsheet of properties, loans, shares and renewal dates, Owned Map replaces it. If you would otherwise keep your rental money in a pile of accounts, Baselane replaces that.</p>` },
    { id: 'choose', h2: 'Who should choose which', html: `<h3>Choose Baselane if</h3>
<ul><li>You want rent, expenses and tax paperwork organized by property inside the bank account.</li><li>You are happy to move your rental banking to a new provider.</li><li>You want a free plan to start.</li></ul>
<h3>Choose Owned Map if</h3>
<ul><li>You want to compare assets on yield, cash flow, equity and loan-to-value.</li><li>You own more than rentals: land, vehicles, boats, aircraft or equipment.</li><li>You hold properties with partners and want your own share of every figure.</li><li>You prefer a tool that never touches your money or your bank.</li></ul>
<h3>A five-question test</h3>
<ol><li>Do you want your rental money tidy by property automatically? If yes, Baselane.</li><li>Would you rather not move your banking? If yes, Owned Map.</li><li>Do you own anything that is not a rental? If yes, Owned Map covers it.</li><li>Do you ask which asset to keep, sell or refinance? If yes, Owned Map.</li><li>Could someone find your documents if something happened to you? If not, fix that first, with either tool.</li></ol>` },
    { id: 'both', h2: 'Using both', html: `<p>A sensible setup for an owner with rentals and other assets is Baselane for the money and the tax records, and Owned Map for the whole picture. Once a year, copy each property&rsquo;s rent and expenses from Baselane&rsquo;s reports into Owned Map so the figures stay in step. For the fuller picture of how Owned Map works for property, read about the <a href="/solutions/rental-property-portfolio-tracker">rental property portfolio tracker</a>.</p>
<p>To start Owned Map from a spreadsheet, download the <a href="/downloads/asset-inventory-template.csv">inventory template</a>, paste your list in and import the CSV. If it is not for you, you can cancel from your profile menu and export your data first.</p>` },
    { id: 'method', h2: 'How we checked', html: `<p>We wrote this page on ${'November 5, 2026'}. What we say about Baselane comes from its public home page, its pricing page and its own comparison page with Stessa, which is written by Baselane and which we treat accordingly. We have not opened a Baselane account, so where we found nothing we say &ldquo;not listed&rdquo;, not &ldquo;not available&rdquo;. What we say about Owned Map is what the product does today.</p>
<p>Every outside claim is numbered and listed under Sources below. Both products change. If you spot something out of date, email <a href="mailto:support@ownedmap.com">support@ownedmap.com</a> and we will correct it.</p>` },
  ],
  faq: [
    ['Is Owned Map a replacement for Baselane?', 'No. Baselane is banking and bookkeeping for landlords. Owned Map holds no money and connects to no bank. It shows every property and other asset on a map with yield, cash flow, loan, your share, documents and dates.'],
    ['Is Baselane free?', 'Baselane lists a Core plan at $0 and a Smart plan at $20 a month on an annual plan, with separate fees for some services such as card rent payments, wires and tenant screening. Check its pricing page for current terms.'],
    ['Is Baselane a bank?', 'Baselane says it is a financial technology company and not an FDIC-insured bank, with banking services provided by Thread Bank, Member FDIC.'],
    ['Does Owned Map handle rent or bank accounts?', 'No. Owned Map does not collect rent, hold money or connect to a bank. You enter each property’s yearly income and expenses and it calculates NOI, yield and cash flow.'],
    ['Can Owned Map track land, vehicles and boats?', 'Yes. Owned Map tracks land, vehicles, boats, aircraft and heavy equipment as well as property, each with its documents and dates.'],
    ['Can I try Owned Map before paying?', `Yes. There is a ${PLAN.trialDays}-day free trial, and a card is required to start it. You can cancel from your profile menu at any time.`],
  ],
};
