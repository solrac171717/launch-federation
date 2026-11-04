// "Empower vs Owned Map". Same rules as content/compare.mjs: only claims we can back, Empower described from what it publishes, outside claims numbered.
// Citations use the ids of SOURCES in compare.mjs (16 and 17 here; 5, 6, 7 and 8 shared); compare.mjs renumbers them per page, in order of appearance.
import { PLAN, priceCents, usd, extraText } from '../src/billing-core.js';

const c = n => `<sup class="cite"><a href="#src-${n}" aria-label="Source ${n}">[${n}]</a></sup>`;
const m = n => usd(priceCents(n)), y = n => usd(priceCents(n, 'year'));

export const EMPOWER = {
  slug: 'empower-vs-owned-map',
  rival: 'Empower',
  rivalUrl: 'https://www.empower.com',
  crumb: 'Empower vs Owned Map',
  title: 'Empower vs Owned Map (2026): Empower Alternative for Real Assets',
  description: 'Empower vs Owned Map compared on free tools, net worth tracking, real assets, documents and price. An Empower alternative for property, vehicles and boats.',
  h1: 'Empower vs Owned Map: an honest comparison',
  primary: 'empower vs owned map',
  takeaways: [
    'Empower offers free financial tools, including net worth, budgeting and a retirement planner. It earns its money from wealth management, with advisory services for larger investors.',
    'Owned Map is paid and does one thing: it keeps the physical things you own on a map, with value, yield, cash flow, loan, documents and dates for each.',
    `Empower says its tools are completely free. Owned Map starts at ${usd(PLAN.baseCents)} a month for ${PLAN.included} assets, so Empower wins on price every time.`,
    'The two fit together: Empower for accounts and retirement, Owned Map for the property, vehicles and boats an account dashboard does not describe.',
  ],
  lead: 'Empower vs Owned Map is a comparison between a free dashboard for your financial accounts and a paid tool for the things you own. Empower lets you see your accounts together, plan retirement, watch cash flow and analyze your portfolio, and it says the tools are completely free. Owned Map does not connect to any account. It puts each property, vehicle, boat, aircraft and plot of land on a map, with its value, yield, cash flow, loan, documents and renewal dates. This page compares the two honestly, explains how a free tool pays for itself so you can judge it, and shows with one worked example what an account dashboard does not tell you about a cabin, an aircraft share and a truck.',
  toc: [['verdict', 'The short answer'], ['at-a-glance', 'At a glance'], ['free', 'How a free tool pays for itself'], ['starting-point', 'Accounts or assets'], ['features', 'Feature by feature'], ['example', 'A worked example: cabin, aircraft share and truck'], ['values', 'Whose number is it'], ['records', 'Documents and dates'], ['estate', 'If something happens to you'], ['price', 'Price'], ['choose', 'Who should choose which'], ['both', 'Using both'], ['method', 'How we checked'], ['sources', 'Sources']],
  sections: [
    { id: 'verdict', h2: 'The short answer', html: `<ul><li><strong>Pick Empower</strong> if you want a free place to see your accounts together, plan retirement, watch your cash flow and analyze your investments.${c(16)}</li><li><strong>Pick Owned Map</strong> if you own physical assets (rental property, land, vehicles, boats, aircraft) and want the value, performance, documents and dates of each one, on a map.</li><li><strong>Use both</strong> if you have investment accounts and real assets. Empower is free, so there is no cost to starting there.</li></ul>
<p>Where we describe Empower, we rely on its own website, and we link each claim so you can check it. We have not used an Empower account to write this page, and several of its pages did not load for us, so we say so wherever it limits what we can claim.</p>` },
    { id: 'at-a-glance', h2: 'At a glance', html: `<table><thead><tr><th></th><th>Empower</th><th>Owned Map</th></tr></thead><tbody>
<tr><td>Built around</td><td>Your financial accounts and retirement</td><td>The physical assets you own, on a map</td></tr>
<tr><td>Connects to your accounts</td><td><strong>Yes.</strong> It shows all your accounts in one place${c(17)}</td><td>No, by design</td></tr>
<tr><td>Net worth</td><td><strong>Yes</strong>${c(16)}</td><td><strong>Yes</strong>, from the assets you enter, after debt</td></tr>
<tr><td>Retirement planner</td><td><strong>Yes</strong>${c(16)}</td><td>No</td></tr>
<tr><td>Budgeting and cash flow</td><td><strong>Yes</strong>${c(16)}</td><td>No</td></tr>
<tr><td>Portfolio analysis</td><td><strong>Yes</strong>${c(16)}</td><td>No</td></tr>
<tr><td>Real estate, vehicles, boats, aircraft</td><td>Not listed on the pages we read</td><td><strong>Yes, the core of the product</strong></td></tr>
<tr><td>Rental numbers (NOI, yield, cash flow) per asset</td><td>Not advertised</td><td><strong>Yes</strong></td></tr>
<tr><td>Map of everything you own</td><td>Not advertised</td><td><strong>Yes</strong>, globe and country views</td></tr>
<tr><td>Documents and renewal dates on each asset</td><td>Not advertised</td><td><strong>Yes</strong></td></tr>
<tr><td>Price</td><td>Tools are free${c(16)}</td><td>${usd(PLAN.baseCents)} a month for ${PLAN.included} assets</td></tr></tbody></table>
<p>&ldquo;Not listed&rdquo; and &ldquo;not advertised&rdquo; mean we did not find it on the Empower pages we read in November 2026. Features can exist without being listed, so check in the app before you rule one out.</p>` },
    { id: 'free', h2: 'How a free tool pays for itself', html: `<p>Empower&rsquo;s FAQ answers the question of cost with one word: nothing. Its financial tools (a retirement planner, net worth, budgeting and cash flow, portfolio analysis, a savings planner, debt paydown and an emergency fund tool) are listed as completely free.${c(16)} That is real value, and it is a good reason to try it.</p>
<p>It is worth knowing what pays for it, because it tells you what the product is for. The same pages promote Empower&rsquo;s wealth management services: a Private Client service described as premium financial planning and portfolio management for $1 million or more in investments, and a Personal Strategy service that puts you with a financial advisor, available, according to its footnote, when you invest more than $250,000 with the company. Its disclosures say advisory fees are calculated on the amount of assets being managed.${c(16)} Tax filing is offered through a third party and is not described as free.</p>
<p>None of this is a criticism. A free tool that leads some users to paid advice is a normal business model, and the tools can be useful whether or not you ever speak to an advisor. It does mean the dashboard is shaped around investable accounts, and physical assets are not what a fee on managed assets is calculated from. Owned Map exists for the part that sits outside that.</p>` },
    { id: 'starting-point', h2: 'Accounts or assets', html: `<p><strong>Empower answers &ldquo;am I on track?&rdquo;</strong> It aims to show where you stand and where you want to get to: your accounts together, a retirement planner to test what retirement could look like, and tools to spend, save and pay down debt with more foresight.${c(16)} Its raw material is accounts that report balances.</p>
<p><strong>Owned Map answers &ldquo;what do I own and how is it doing?&rdquo;</strong> Its raw material is assets that do not report anything: a cabin, a share in an aircraft, a truck, a plot of land. For each, you enter the value, the cost, the income and expenses and any loan, and Owned Map calculates appreciation, net operating income, yield, monthly cash flow and net worth after debt. It then keeps the documents and dates with the asset.</p>
<p>If your wealth is mostly in accounts, an account dashboard gets you most of the way. If a large part of it is in things, the dashboard needs a partner. And for the retirement question, the part of your net worth that sits in a house or a business is worth knowing precisely, not as a rough guess.</p>` },
    { id: 'features', h2: 'Feature by feature', html: `<h3>Planning and analysis</h3>
<p>Retirement planning, budgeting, cash flow and portfolio analysis are Empower&rsquo;s ground, and Owned Map does not compete there.${c(16)} If you want to test when you can retire, use a planner built for it.</p>
<h3>Account connections</h3>
<p>Empower says its net worth tool shows all your accounts in one place.${c(17)} The page we could read does not say which account types, how many institutions or how values refresh, so check the app. Owned Map connects to no accounts at all. You enter values yourself, which for physical assets usually means a few minutes when something changes, or once a quarter.</p>
<h3>Physical assets</h3>
<p>On the Empower pages we read, we did not find real estate, vehicles or manually added assets. They may well be supported in the app, so it is worth a look. What we can say is what Owned Map does with them: each is an asset with a value, cost, income, expenses, loan, ownership share, documents and dates, shown on a map.</p>
<h3>Reading a document for you</h3>
<p>Upload a deed, an invoice or a contract to Owned Map and the details are read for you to review before anything is saved. It saves the typing when you add an asset; always check the result.</p>
<h3>Reports and exports</h3>
<p>Owned Map exports PDF, Excel and CSV reports and imports a CSV. Our free <a href="/downloads/asset-inventory-template.csv">inventory template</a> uses the exact columns the app reads, and it works as a checklist even if you never sign up.</p>` },
    { id: 'example', h2: 'A worked example: cabin, aircraft share and truck', html: `<p>Imagine someone with three physical assets that no bank would ever report on: a lake cabin they rent out some weeks of the year, a quarter share in a small aircraft, and a pickup truck.</p>
<h3>The cabin</h3>
<ul><li>Estimated value: <strong>$395,000</strong>. Purchase cost: <strong>$330,000</strong></li><li>Rent collected in a year: <strong>$23,500</strong>. Yearly expenses: <strong>$9,100</strong></li><li>Loan balance: <strong>$150,000</strong>, with payments of <strong>$1,050 a month</strong></li></ul>
<ul><li>Net operating income: $23,500 &minus; $9,100 = <strong>$14,400 a year</strong></li><li>Yield on what was paid: $14,400 &divide; $330,000 = <strong>4.4%</strong></li><li>Yield on what it is worth now: $14,400 &divide; $395,000 = <strong>3.6%</strong></li><li>Equity: $395,000 &minus; $150,000 = <strong>$245,000</strong></li><li>Appreciation: ($395,000 &minus; $330,000) &divide; $330,000 = <strong>19.7%</strong></li><li>Cash flow after the loan: $14,400 &minus; ($1,050 &times; 12) = <strong>$1,800 a year, $150 a month</strong></li></ul>
<h3>The aircraft share and the truck</h3>
<ul><li>Aircraft: the whole plane is worth <strong>$120,000</strong> and you own <strong>25%</strong>, so your share is worth <strong>$30,000</strong>. The plane costs <strong>$18,000</strong> a year to hold, which is <strong>15.0%</strong> of its value, and your share of that is <strong>$4,500</strong>.</li><li>Truck: worth <strong>$27,500</strong>, bought for $41,000, so it has lost <strong>32.9%</strong>.</li></ul>
<h3>The total</h3>
<p>Assets: $395,000 + $30,000 + $27,500 = <strong>$452,500</strong>. Debt: <strong>$150,000</strong>. Net worth: <strong>$302,500</strong>.</p>
<p>The total tells you what you are worth, and the asset-by-asset view tells you what to do. The cabin returns 4.4% on what you paid but only 3.6% on its current value, and the 3.6% is the standard capitalization rate, net operating income divided by <em>current value</em> rather than the original price.${c(5)} Its cash flow after the loan is $150 a month, which is thin once you remember that the loan payment is deliberately outside NOI: the IRS tells US rental owners that mortgage principal payments cannot simply be deducted, and that they should keep accurate records and separate repairs from improvements.${c(6)} The aircraft costs 15.0% of its value every year just to hold, and the truck has lost a third of its price. Each of those is a decision waiting to be made, and none of them appears in an account feed.</p>` },
    { id: 'values', h2: 'Whose number is it', html: `<p>In an account dashboard, a balance is a fact: the bank says so. For a physical asset, the value is an opinion, and the question is whose.</p>
<p>In Owned Map, it is yours: an appraisal, a broker&rsquo;s opinion, a recent comparable sale, or your own judgment, dated and kept in a history that grows each time you update. That takes a minute of thought. In return it is a number you chose and can defend, and it stays put until you change it. For something like an aircraft share, where no automatic feed could know the market, a number you chose and dated is worth more than a blank.</p>
<p>The discipline that makes this work is a calendar one: update the values once a quarter, or when something changes (a renovation, a sale nearby, a new valuation for insurance). A few minutes, four times a year.</p>` },
    { id: 'records', h2: 'Documents and dates', html: `<p>Ownership produces paperwork and deadlines: a deed, a title, an insurance policy that renews, a registration, an annual inspection, a loan agreement, a property tax bill. The expensive surprises usually come from a date nobody wrote down.</p>
<p>Owned Map keeps documents on the asset they belong to and holds the dates (insurance, tax, registration, inspections) with reminders, so the policy and its renewal sit next to the thing they cover. On the Empower pages we read, we found no mention of attaching documents to an asset or tracking renewal dates, so if that matters to you, ask before relying on it.</p>
<p>The habit is worth having with or without a tool. For every physical asset keep four things together: proof of ownership, the insurance policy, the loan agreement if there is one, and the next date that needs action.</p>` },
    { id: 'estate', h2: 'If something happens to you', html: `<p>Accounts are easy to find, because statements arrive in the post or the inbox. Physical assets are not: nobody gets a statement for a boat, an aircraft share or a plot of land. In Caring.com&rsquo;s 2025 survey of more than 2,500 US adults, only 24% said they have a will, down from 33% in 2022.${c(7)} An executor cannot settle what nobody knows exists.</p>
<p>Owned Map lets you share a read-only link, give household members access, and set a private emergency sheet for one trusted person. The discipline applies to everything you own: the Nebraska Department of Insurance advises recording brand, price, purchase date, model, serial number and receipts, with photos.${c(8)} Add the registration or title number for vehicles and aircraft and the deed reference for property.</p>` },
    { id: 'price', h2: 'Price', html: `<p>Empower says its financial tools are free.${c(16)} Prices and terms can change, so check <a href="https://www.empower.com/tools" rel="noopener" target="_blank">empower.com/tools</a>.</p>
<p>Owned Map&rsquo;s pricing is public and simple. ${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets. ${extraText()}, up to ${PLAN.maxAssets} assets. Paying yearly is ${Math.round(PLAN.yearlyOff * 100)}% less. There is a ${PLAN.trialDays}-day free trial, and a card is required.</p>
<table><thead><tr><th>Assets tracked</th><th>Owned Map monthly</th><th>Owned Map paid yearly</th></tr></thead><tbody>
<tr><td>${PLAN.included}</td><td>${m(PLAN.included)}</td><td>${y(PLAN.included)}</td></tr>
<tr><td>10</td><td>${m(10)}</td><td>${y(10)}</td></tr>
<tr><td>25</td><td>${m(25)}</td><td>${y(25)}</td></tr>
<tr><td>50</td><td>${m(50)}</td><td>${y(50)}</td></tr></tbody></table>
<p>The honest comparison is that free beats paid on price, always. Owned Map is worth paying for only if you need what a free account dashboard does not describe: a map of what you own, the performance of each asset, and the documents and dates attached. If you would otherwise keep that in a spreadsheet and a folder, it replaces both. If you have no physical assets to speak of, you do not need Owned Map. Start with Empower.</p>` },
    { id: 'choose', h2: 'Who should choose which', html: `<h3>Choose Empower if</h3>
<ul><li>Most of your wealth is in accounts and retirement savings.</li><li>You want free planning, budgeting and portfolio tools.</li><li>You may want advice on your investments one day.</li></ul>
<h3>Choose Owned Map if</h3>
<ul><li>You own property, land, vehicles, boats or aircraft and want the performance of each.</li><li>You hold some of them in shares with others.</li><li>You want everything on a map, with documents and renewal dates attached.</li><li>You prefer a tool that does not connect to your accounts.</li></ul>
<h3>A five-question test</h3>
<ol><li>Is your biggest question whether you are on track for retirement? If yes, Empower.</li><li>Is more than a third of what you own physical? If yes, Owned Map.</li><li>Do you ask whether a property or a vehicle is still worth keeping? If yes, Owned Map.</li><li>Is free essential and are your assets mostly accounts? If yes, Empower.</li><li>Could someone find your documents if something happened to you? If not, fix that first, with either tool.</li></ol>` },
    { id: 'both', h2: 'Using both', html: `<p>A sensible setup for someone with investments and real assets is Empower for the accounts and retirement, and Owned Map for what you own. The only thing to manage is the overlap: if both show the same house, pick one as the source of truth for its value so the total is not counted twice.</p>
<p>To start Owned Map from a spreadsheet, download the <a href="/downloads/asset-inventory-template.csv">inventory template</a>, paste your list in and import the CSV. Then add loans, shares and documents asset by asset. If it is not for you, you can cancel from your profile menu and export your data first.</p>` },
    { id: 'method', h2: 'How we checked', html: `<p>We wrote this page on ${'November 4, 2026'}. What we say about Empower comes from its public tools page and its net worth page; one of its support articles did not load for us, so we do not rely on it. We have not used an Empower account, so where we found nothing we say &ldquo;not listed&rdquo;, not &ldquo;not available&rdquo;. What we say about Owned Map is what the product does today.</p>
<p>Every outside claim is numbered and listed under Sources below. Both products change. If you spot something out of date, email <a href="mailto:support@ownedmap.com">support@ownedmap.com</a> and we will correct it.</p>` },
  ],
  faq: [
    ['Is Owned Map a replacement for Empower?', 'No. Owned Map has no retirement planner, budgeting or portfolio analysis, and it does not connect to accounts. It keeps physical assets on a map, with values, yield, cash flow, loans, shares, documents and dates.'],
    ['Is Empower really free?', 'Empower says its financial tools are completely free. It also offers paid wealth management and advisory services, with fees based on the assets managed. Check its site for current terms.'],
    ['Does Empower track real estate, vehicles or boats?', 'On the pages we read, Empower does not list real estate, vehicles or manual assets, and we could not confirm them. Check in the app. Owned Map is built for them.'],
    ['Is Owned Map cheaper than Empower?', `No. Empower says its tools are free, and Owned Map starts at ${usd(PLAN.baseCents)} a month for ${PLAN.included} assets, or ${y(PLAN.included)} a year paid yearly. They do different jobs, so compare what each replaces.`],
    ['Can I use Empower and Owned Map together?', 'Yes. Use Empower for accounts and retirement planning, and Owned Map for physical assets. Choose one place as the source of truth for each asset so it is not counted twice in your net worth.'],
    ['Can I try Owned Map before paying?', `Yes. There is a ${PLAN.trialDays}-day free trial, and a card is required to start it. You can cancel from your profile menu at any time.`],
  ],
};
