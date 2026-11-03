// "Monarch Money vs Owned Map". Same rules as content/compare.mjs: only claims we can back, Monarch described from what it publishes, outside claims numbered.
// Citations use the ids of SOURCES in compare.mjs (9 to 13 here, 5 to 8 shared); compare.mjs renumbers them per page, in order of appearance.
import { PLAN, priceCents, usd, extraText } from '../src/billing-core.js';

const c = n => `<sup class="cite"><a href="#src-${n}" aria-label="Source ${n}">[${n}]</a></sup>`;
const m = n => usd(priceCents(n)), y = n => usd(priceCents(n, 'year'));

export const MONARCH = {
  slug: 'monarch-vs-owned-map',
  rival: 'Monarch Money',
  crumb: 'Monarch Money vs Owned Map',
  title: 'Monarch Money vs Owned Map (2026): Monarch Money Alternative',
  description: 'Monarch Money vs Owned Map compared on budgeting, real estate values, documents, sharing and price. A Monarch Money alternative for real assets.',
  h1: 'Monarch Money vs Owned Map: an honest comparison',
  primary: 'monarch money vs owned map',
  takeaways: [
    'Monarch is a budgeting and money-management app that also tracks net worth. Owned Map is not a budgeting app: it manages the physical things you own.',
    'Monarch values a house by syncing Zillow Zestimates. Owned Map uses the value you enter, and adds income, costs, loan, yield and cash flow for each asset.',
    `Monarch lists $14.99 a month or $99.99 a year. Owned Map starts at ${usd(PLAN.baseCents)} a month for ${PLAN.included} assets, so it costs more for a small portfolio.`,
    'If you want to know where your money goes each month, pick Monarch. If you own property, a boat or a collector car, add Owned Map.',
  ],
  lead: 'Monarch Money vs Owned Map is not a fight between two copies of the same app. Monarch is built to show where your money goes each month: it connects your accounts, sorts your transactions, runs a budget and adds up your net worth. Owned Map is built for the other half of your wealth, the things you can point to on a map (property, vehicles, boats, aircraft, land) and the numbers, documents and dates that go with them. This page compares them honestly, says where Monarch is clearly the better choice, and shows with one worked example what each does with a rental house, a boat and a classic car.',
  toc: [['verdict', 'The short answer'], ['at-a-glance', 'At a glance'], ['starting-point', 'Budget app or asset manager'], ['features', 'Feature by feature'], ['example', 'A worked example: house, boat and car'], ['values', 'Where the values come from'], ['documents', 'Documents and dates'], ['sharing', 'Sharing and family'], ['security', 'Security and privacy'], ['price', 'Price'], ['choose', 'Who should choose which'], ['both', 'Using both'], ['method', 'How we checked'], ['sources', 'Sources']],
  sections: [
    { id: 'verdict', h2: 'The short answer', html: `<ul><li><strong>Pick Monarch</strong> if your main question is &ldquo;where is my money going?&rdquo;: you want transactions, a monthly budget, goals and your investment accounts synced automatically, usually shared with a partner.${c(9)}</li><li><strong>Pick Owned Map</strong> if a large part of your wealth is physical (rental property, land, vehicles, a boat, an aircraft) and you want the performance, documents and dates of each asset in one place, on a map.</li><li><strong>Use both</strong> if you want a budget for everyday money and a proper record of what you own. They cover different ground and do not conflict.</li></ul>
<p>Where we describe Monarch, we rely on what it publishes on its own website, and we link each claim so you can check it. We have not used a paid Monarch account to write this page.</p>` },
    { id: 'at-a-glance', h2: 'At a glance', html: `<table><thead><tr><th></th><th>Monarch Money</th><th>Owned Map</th></tr></thead><tbody>
<tr><td>Built around</td><td>Budgeting and everyday money, with net worth</td><td>The physical assets you own, on a map</td></tr>
<tr><td>Connects to banks, cards and brokerages</td><td><strong>Yes.</strong> It advertises 13,000+ institutions${c(9)}</td><td>No, by design</td></tr>
<tr><td>Budget and transaction tracking</td><td><strong>Yes</strong></td><td>No</td></tr>
<tr><td>Savings goals</td><td><strong>Yes</strong>${c(9)}</td><td>No</td></tr>
<tr><td>Real estate value</td><td>Syncs Zillow Zestimates${c(11)}</td><td>The value you enter, with history</td></tr>
<tr><td>Other assets</td><td>Lists vehicles in net worth and lets you add manual accounts${c(11)}</td><td><strong>Vehicles, boats, aircraft, land and more, each as a pin</strong></td></tr>
<tr><td>Rental numbers (NOI, yield, cash flow)</td><td>Not advertised</td><td><strong>Yes</strong>, for each asset</td></tr>
<tr><td>Map of everything you own</td><td>Not advertised</td><td><strong>Yes</strong>, globe and country views</td></tr>
<tr><td>Fill in an asset from a deed or invoice</td><td>Not advertised</td><td><strong>Yes</strong>, you review before saving</td></tr>
<tr><td>Documents and renewal dates on each asset</td><td>Not advertised</td><td><strong>Yes</strong></td></tr>
<tr><td>Share with a partner or advisor</td><td><strong>Yes</strong>, at no extra cost${c(9)}</td><td>Yes (read-only link, household members)</td></tr>
<tr><td>Price</td><td>$14.99 a month or $99.99 a year${c(10)}</td><td>${usd(PLAN.baseCents)} a month for ${PLAN.included} assets</td></tr></tbody></table>
<p>&ldquo;Not advertised&rdquo; means we did not find it on the Monarch pages we read in November 2026. It may exist or be added, so check before you rule it out.</p>` },
    { id: 'starting-point', h2: 'Budget app or asset manager', html: `<p>The easiest way to choose is to ask which problem hurts more.</p>
<p><strong>Monarch solves the monthly problem.</strong> Its pitch is a budget that flexes to your life, goals with progress, customizable charts of where your money goes, and your accounts kept in sync, across web, iOS and Android.${c(9)} Net worth is part of that picture, alongside cash flow and spending. Most of what it handles is money that moves: paychecks, rent, card spending, investments.</p>
<p><strong>Owned Map solves the ownership problem.</strong> Money that moves is not the hard part when you own a rental house, a boat and a couple of vehicles. The hard part is that each of them needs its own numbers (what it is worth, what it earns, what it costs, what you still owe), its own papers (deed, title, policy, loan) and its own dates (insurance, registration, inspection). Owned Map puts each on a map and calculates appreciation, net operating income, yield, monthly cash flow and your net worth after debt, with a value history that grows each time you update.</p>
<p>The two problems overlap in one place, net worth. Monarch gets there from accounts. Owned Map gets there from assets. For a person whose wealth is mostly accounts, Monarch&rsquo;s route is shorter. For a person whose wealth is mostly things, Owned Map&rsquo;s is.</p>` },
    { id: 'features', h2: 'Feature by feature', html: `<h3>Budgeting and spending</h3>
<p>This is Monarch&rsquo;s home ground, and Owned Map does not compete. Owned Map has no transactions, no categories and no budget. If you want to see that you spent more on dining out than last month, use Monarch or a tool like it.</p>
<h3>Account sync</h3>
<p>Monarch says it connects with more than 13,000 financial institutions through several data providers.${c(9)} Owned Map connects to none. You enter values yourself, which for physical assets usually means a few minutes when something changes, or once a quarter.</p>
<h3>Real estate and vehicles</h3>
<p>Monarch&rsquo;s net worth page says you can include real estate by syncing with Zillow Zestimates, lists vehicles among the assets in net worth, and says you can add manual accounts for any asset not connected.${c(11)} That covers the basics of showing a house, a car and other things in your total.</p>
<p>Owned Map treats each of those as an asset with a life of its own: purchase cost, current value, income, expenses, a loan, your share of ownership, documents and dates. Boats, aircraft and land are first-class, not &ldquo;other&rdquo;.</p>
<h3>Reading a document for you</h3>
<p>Upload a deed, an invoice or a contract to Owned Map and the details are read for you to review before anything is saved. It saves the typing when you add an asset. Check the result: it is a help, not an oracle.</p>
<h3>Reports and exports</h3>
<p>Owned Map exports PDF, Excel and CSV reports and imports a CSV. Our free <a href="/downloads/asset-inventory-template.csv">inventory template</a> uses the exact columns the app reads, and works as a checklist even if you never sign up.</p>` },
    { id: 'example', h2: 'A worked example: house, boat and car', html: `<p>Take someone who owns three things: a beach house they rent out, a boat and a classic car. These are the inputs for each.</p>
<h3>The beach house</h3>
<ul><li>Estimated value: <strong>$485,000</strong>. Purchase cost: <strong>$410,000</strong></li><li>Rent collected in a year: <strong>$42,000</strong>. Yearly expenses: <strong>$13,500</strong></li><li>Loan balance: <strong>$265,000</strong>, with payments of <strong>$1,650 a month</strong></li></ul>
<p>What follows from those numbers:</p>
<ul><li>Net operating income: $42,000 &minus; $13,500 = <strong>$28,500 a year</strong></li><li>Yield on what you paid: $28,500 &divide; $410,000 = <strong>7.0%</strong></li><li>Yield on what it is worth now: $28,500 &divide; $485,000 = <strong>5.9%</strong></li><li>Equity: $485,000 &minus; $265,000 = <strong>$220,000</strong></li><li>Appreciation: ($485,000 &minus; $410,000) &divide; $410,000 = <strong>18.3%</strong></li><li>Cash flow after the loan: $28,500 &minus; ($1,650 &times; 12) = <strong>$8,700 a year, $725 a month</strong></li></ul>
<h3>The boat and the car</h3>
<ul><li>Boat: worth <strong>$62,000</strong>, bought for $78,000, so it has lost <strong>20.5%</strong>. Slip, insurance and upkeep cost <strong>$9,400</strong> a year, which is <strong>15.2%</strong> of its value.</li><li>Classic car: worth <strong>$48,000</strong>, bought for $31,000, so it has gained <strong>54.8%</strong>.</li></ul>
<h3>The total</h3>
<p>Assets: $485,000 + $62,000 + $48,000 = <strong>$595,000</strong>. Debt: <strong>$265,000</strong>. Net worth: <strong>$330,000</strong>.</p>
<p>Here is what that shows. A net worth number alone would say $330,000 and stop. The asset-by-asset view says something more useful: the house returns 7.0% on what you paid but 5.9% on what it is worth now, the boat costs 15.2% of its value every year to keep, and the car is the one that has gained the most. Those are the facts that decide what to keep, sell or renew.</p>
<p>Two details make the numbers honest. The 5.9% is the standard capitalization rate, net operating income divided by <em>current value</em> rather than the original price.${c(5)} And the loan payment is deliberately outside net operating income: the IRS tells US rental owners that mortgage principal payments cannot simply be deducted, and to keep accurate records separating repairs from improvements.${c(6)} Cash flow, property performance and taxable profit are three different numbers, and your accountant owns the third.</p>
<p>In Monarch you can show the house, the boat and the car in your net worth and see the total move. You would work out the yields and the running-cost ratio yourself.</p>` },
    { id: 'values', h2: 'Where the values come from', html: `<p>This is the most practical difference after budgeting, so it deserves a closer look.</p>
<p><strong>Monarch syncs Zillow Zestimates for real estate.</strong>${c(11)} The big advantage is that it needs no effort: the value updates on its own. The catch is what a Zestimate is. It is an automated estimate for a home, and Zillow publishes how far off it can be: a median error of roughly 7% for homes that are not on the market, and wider in some metros.${c(13)} On the $485,000 beach house, 7% is about $34,000, in either direction. A Zestimate also cannot know that your house is a short-term rental, what state its kitchen is in, or what you would actually accept for it. And it has nothing to say about a boat, a plane or a plot of land.</p>
<p><strong>Owned Map uses the number you enter.</strong> That costs you a minute of thought, and it gives you a number you chose: an appraisal, a broker&rsquo;s opinion, a recent comparable sale, or your own judgment, dated and kept in the history. For assets with no automatic feed, a number you chose and dated is usually better than a stale placeholder.</p>
<p>Neither approach is wrong. If you own a primary home and want it in your total without lifting a finger, a Zestimate is a fair shortcut. If your wealth is in assets where the value really matters, you will want to set the figure yourself.</p>` },
    { id: 'documents', h2: 'Documents and dates', html: `<p>Ownership creates paperwork and deadlines: a policy that renews, a registration, a yearly inspection, a property tax bill, a loan agreement. Most expensive surprises come from a date nobody wrote down.</p>
<p>Owned Map keeps documents on the asset they belong to and holds the dates (insurance, tax, registration, inspections) with reminders, so the policy and its renewal sit next to the thing they cover. On the Monarch pages we read, we found no mention of attaching documents to an asset or tracking renewal dates, so if that is part of what you need, ask them before you buy.</p>
<p>The habit is worth having with or without a tool. For every physical asset keep four things together: proof of ownership, the insurance policy, the loan agreement if there is one, and the next date that needs action.</p>` },
    { id: 'sharing', h2: 'Sharing and family', html: `<p><strong>Monarch</strong> says you can collaborate with your partner or advisor at no extra cost.${c(9)} For a couple who run a household budget together, that is the feature that matters most, and it is a strong one.</p>
<p><strong>Owned Map</strong> lets you share a read-only link, give household members access, and set a private emergency sheet for one trusted person. It is simpler, and aimed at a different moment: when someone else needs to find out what exists, where it is and where the papers are.</p>
<p>That moment is more likely to be unprepared than people think. In Caring.com&rsquo;s 2025 survey of more than 2,500 US adults, only 24% said they have a will, down from 33% in 2022.${c(7)} An executor cannot settle what nobody knows exists, which is why a list of every asset, with where its papers are kept, is worth keeping. Regulators say the same about household goods: the Nebraska Department of Insurance advises recording brand, price, purchase date, model, serial number and receipts, with photos.${c(8)}</p>` },
    { id: 'security', h2: 'Security and privacy', html: `<p><strong>Monarch</strong> says it does not see or store your login credentials, that accounts connect through third-party data providers, that data is encrypted at rest and in transit, and that it has read-only permissions and cannot move your money.${c(12)} Those are Monarch&rsquo;s own statements, and they describe a reasonable design for an app that has to read your accounts.</p>
<p><strong>Owned Map</strong> sidesteps the question: it does not connect to bank, card or brokerage accounts, so there is no access to grant, no link that can break and nothing to revoke. The trade is that you enter the values yourself.</p>
<p>With either, use a unique password and turn on every extra sign-in protection offered.</p>` },
    { id: 'price', h2: 'Price', html: `<p>Monarch&rsquo;s pricing page lists $14.99 a month or $99.99 a year, says you can cancel anytime and mentions a no-questions-asked money-back guarantee.${c(10)} It also mentions a Plus level with forecasting and tools for multiple income sources, without a separate price on the page we read, and a first-week offer without stated terms. Check <a href="https://www.monarch.com/pricing" rel="noopener" target="_blank">monarch.com/pricing</a> for today&rsquo;s figures.</p>
<p>Owned Map&rsquo;s pricing is public and simple. ${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets. ${extraText()}, up to ${PLAN.maxAssets} assets. Paying yearly is ${Math.round(PLAN.yearlyOff * 100)}% less. There is a ${PLAN.trialDays}-day free trial, and a card is required.</p>
<table><thead><tr><th>Assets tracked</th><th>Monthly</th><th>Paid yearly</th></tr></thead><tbody>
<tr><td>${PLAN.included}</td><td>${m(PLAN.included)}</td><td>${y(PLAN.included)}</td></tr>
<tr><td>10</td><td>${m(10)}</td><td>${y(10)}</td></tr>
<tr><td>25</td><td>${m(25)}</td><td>${y(25)}</td></tr>
<tr><td>50</td><td>${m(50)}</td><td>${y(50)}</td></tr></tbody></table>
<p>To be direct: for the three assets in the example above, Owned Map costs ${y(PLAN.included)} a year paid yearly, about four times Monarch&rsquo;s $99.99. They are not the same product, so the right comparison is not price alone but what you would do without each. If you would otherwise keep a spreadsheet of properties, loans and renewal dates, Owned Map replaces it. If you would otherwise lose track of your spending, Monarch is the better buy, and the cheaper one.</p>` },
    { id: 'choose', h2: 'Who should choose which', html: `<h3>Choose Monarch if</h3>
<ul><li>You want to see and control spending, with a budget and goals.</li><li>Most of your net worth is in bank, card, retirement and brokerage accounts that you want synced.</li><li>You manage money with a partner and want to share one view.</li></ul>
<h3>Choose Owned Map if</h3>
<ul><li>You own rental property, land, vehicles, a boat or an aircraft and want yield, cash flow and net worth after debt for each.</li><li>You want to see everything on a map, in more than one place if needed.</li><li>You want the documents and renewal dates next to each asset.</li><li>You would rather not connect any account to the tool.</li></ul>
<h3>A five-question test</h3>
<ol><li>Is your biggest money question about monthly spending? If yes, Monarch.</li><li>Is more than a third of what you own physical? If yes, lean towards Owned Map.</li><li>Do you ask &ldquo;is this property still worth keeping?&rdquo; If yes, Owned Map.</li><li>Do you need balances to update without touching them? If yes, Monarch.</li><li>Could someone find your documents if something happened to you? If not, fix that first, with whichever tool.</li></ol>` },
    { id: 'both', h2: 'Using both', html: `<p>A sensible setup for someone with a household budget and real assets is Monarch for the month-to-month and Owned Map for what you own. The only thing to manage is the overlap: if both show your house, pick one place as the source of truth for its value so the total is not counted twice.</p>
<p>To start Owned Map from a spreadsheet, download the <a href="/downloads/asset-inventory-template.csv">inventory template</a>, paste your list in and import the CSV. Then add loans, shares and documents asset by asset. If it is not for you, you can cancel from your profile menu and export your data first.</p>` },
    { id: 'method', h2: 'How we checked', html: `<p>We wrote this page on ${'November 3, 2026'}. What we say about Monarch comes from its public pages: its home page, pricing page, net worth feature page and security page. The Zillow figure comes from Zillow&rsquo;s published Zestimate accuracy information. We have not used a paid Monarch account, so where we found nothing we say &ldquo;not advertised&rdquo;, not &ldquo;not available&rdquo;. What we say about Owned Map is what the product does today.</p>
<p>Every outside claim is numbered and listed under Sources below. Both products change. If you spot something out of date, email <a href="mailto:support@ownedmap.com">support@ownedmap.com</a> and we will correct it.</p>` },
  ],
  faq: [
    ['Is Owned Map a replacement for Monarch Money?', 'No, not for budgeting. Owned Map has no transactions or budgets and does not connect to bank accounts. It replaces a spreadsheet of the things you own: property, vehicles, boats and aircraft, with their values, income, costs, loans, documents and dates.'],
    ['Does Monarch track rental properties?', 'Monarch can show real estate in your net worth by syncing Zillow Zestimates and lets you add manual accounts. On the pages we read we did not find rental yield, cash flow per property, documents or renewal dates, which Owned Map is built around.'],
    ['Does Owned Map budget or track spending?', 'No. Owned Map does not track transactions or budgets. It tracks assets: values, income, expenses, loans, ownership shares, documents and dates.'],
    ['Is Owned Map cheaper than Monarch?', `No. Monarch lists $14.99 a month or $99.99 a year on its pricing page. Owned Map starts at ${usd(PLAN.baseCents)} a month for ${PLAN.included} assets, or ${y(PLAN.included)} a year paid yearly. The two do different jobs, so compare what each replaces.`],
    ['Can I use Monarch and Owned Map together?', 'Yes. Many people will want Monarch for spending and accounts and Owned Map for physical assets. Choose one place as the source of truth for each asset so it is not counted twice in your net worth.'],
    ['Can I try Owned Map before paying?', `Yes. There is a ${PLAN.trialDays}-day free trial, and a card is required to start it. You can cancel from your profile menu at any time.`],
  ],
};
