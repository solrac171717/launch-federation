// The comparison pages ("Owned Map vs X"): long, honest pages for people choosing between tools, each with a sticky call to start next to the text.
// Rules for anything added here: only claims we can back. Owned Map's numbers come from src/billing-core.js; a competitor is described only from what it publishes,
// with the date we checked and a link to its own page. No invented customers, ratings or reviews: real quotes go in PROOF.quotes when we have them.
import { PLAN, priceCents, usd, extraText } from '../src/billing-core.js';
import { MONARCH } from './compare-monarch.mjs';
import { STESSA } from './compare-stessa.mjs';
import { EMPOWER } from './compare-empower.mjs';
import { LANDLORD } from './compare-landlord.mjs';
import { BASELANE } from './compare-baselane.mjs';
import { ROUNDUP } from './compare-roundup.mjs';

export const CHECKED = '2026-11-03';

/** Every outside claim on a page points to one of these. Each was opened and read on CHECKED; `says` is what we rely on it for. */
export const SOURCES = [
  { n: 1, title: 'Kubera: homepage', publisher: 'Kubera', url: 'https://www.kubera.com', says: 'Features, asset types, sharing, beneficiaries and the 14-day trial.' },
  { n: 2, title: 'Kubera Black', publisher: 'Kubera', url: 'https://www.kubera.com/kubera-black', says: 'Kubera Black is priced at $2,500 a year.' },
  { n: 3, title: 'Kubera: security', publisher: 'Kubera', url: 'https://www.kubera.com/security', says: 'How accounts connect through aggregators; Kubera says it does not store bank credentials.' },
  { n: 4, title: 'Kubera pricing', publisher: 'Toolradar', url: 'https://toolradar.com/tools/kubera/pricing', says: 'Lists Essentials at $250 a year; says prices were confirmed on kubera.com on October 29, 2026.' },
  { n: 5, title: 'Capitalization rate', publisher: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Capitalization_rate', says: 'The cap rate is net operating income divided by current value, not the original price.' },
  { n: 6, title: 'Publication 527, Residential Rental Property (2025)', publisher: 'Internal Revenue Service', url: 'https://www.irs.gov/publications/p527', says: 'You cannot simply deduct mortgage principal payments; separate the costs of repairs and improvements and keep accurate records; residential rental property is depreciated over 27.5 years under GDS.' },
  { n: 7, title: 'Wills Survey 2025', publisher: 'Caring.com, with YouGov', url: 'https://www.caring.com/resources/wills-survey/', says: '24% of respondents have a will, down from 33% in 2022 (more than 2,500 US adults).' },
  { n: 8, title: 'Before the Storm: Don\u2019t Wait Until It\u2019s Too Late', publisher: 'Nebraska Department of Insurance', url: 'https://doi.nebraska.gov/sites/default/files/doc/BeforeTheStorm-Don%27tWaitUntilItsTooLate.pdf', says: 'An inventory should record brand, price, purchase date, model, serial number and receipts, with photos.' },
  { n: 9, title: 'Monarch: homepage', publisher: 'Monarch', url: 'https://www.monarch.com', says: 'Budgeting, goals, 13,000+ institutions, collaboration with a partner or advisor at no extra cost, web, iOS and Android.' },
  { n: 10, title: 'Monarch: pricing', publisher: 'Monarch', url: 'https://www.monarch.com/pricing', says: 'Lists $14.99 a month or $99.99 a year, cancel anytime, a money-back guarantee, and a Plus level.' },
  { n: 11, title: 'Monarch: net worth', publisher: 'Monarch', url: 'https://www.monarch.com/features/net-worth', says: 'Real estate by syncing Zillow Zestimates; vehicles listed in net worth; manual accounts for any asset not connected.' },
  { n: 12, title: 'Monarch: security', publisher: 'Monarch', url: 'https://www.monarch.com/security', says: 'It says it does not see or store login credentials, data is encrypted, and it has read-only permissions.' },
  { n: 13, title: 'What is a Zestimate?', publisher: 'Zillow', url: 'https://www.zillow.com/zestimate/', says: 'Zillow publishes the Zestimate\u2019s median error: roughly 7% for off-market homes, and wider in some metros.', via: 'Figures as summarized in search results for Zillow\u2019s pages; open the page for the current table.' },
  { n: 18, title: 'Changes in U.S. Family Finances from 2022 to 2025: Evidence from the Survey of Consumer Finances', publisher: 'Federal Reserve Board', url: 'https://www.federalreserve.gov/publications/files/scf26.pdf', says: 'Between 2022 and 2025, real median net worth rose by 2 percent, while real mean net worth rose by 7 percent.' },
  { n: 14, title: 'Stessa: homepage', publisher: 'Stessa', url: 'https://www.stessa.com', says: 'Automated bookkeeping, a bank account per property, income statement, net cash flow and tenant ledger reports, tax package reports and online rent collection.' },
  { n: 15, title: 'Stessa: pricing', publisher: 'Stessa', url: 'https://www.stessa.com/pricing', says: 'Essentials is free; Manage is $12 a month billed annually ($15 monthly) and Pro $28 ($35); unlimited properties; a Schedule E report on Manage; screening, lease and maintenance tools.' },
  { n: 16, title: 'Empower: financial tools', publisher: 'Empower', url: 'https://www.empower.com/tools', says: 'The tools are described as completely free: retirement planner, net worth, budgeting and cash flow, portfolio analysis; wealth management for $1M+ and advisory above $250,000, with fees based on assets managed.' },
  { n: 17, title: 'Empower: net worth', publisher: 'Empower', url: 'https://www.empower.com/tools/net-worth', says: 'It shows all your accounts in one place; the page does not list account types.' },
  { n: 19, title: 'Landlord Studio: homepage', publisher: 'Landlord Studio', url: 'https://www.landlordstudio.com', says: 'Property management software for independent landlords: tenant listings and screening, online rent, bank feeds, receipt scanning, P&L and Schedule E reports.' },
  { n: 20, title: 'Landlord Studio: pricing', publisher: 'Landlord Studio', url: 'https://www.landlordstudio.com/pricing', says: 'Go is free for 3 units; Pro $15 a month ($144 a year) and Pro Plus $35 ($336 a year), with $1.20 per extra unit; 14-day trial of Pro. The page shows both pounds and dollars.' },
  { n: 21, title: 'How to set ownership percentages for your properties', publisher: 'Landlord Studio help centre', url: 'https://help.landlordstudio.com/en/articles/14253443-how-to-set-ownership-percentages-for-your-properties', says: 'Ownership percentages for co-owned properties, in the context of the UK Making Tax Digital for Income Tax; they must total 100%.' },
  { n: 22, title: 'Baselane: homepage', publisher: 'Baselane', url: 'https://www.baselane.com', says: 'Banking and bookkeeping for landlords: unlimited property-specific accounts, automated tagging, rent collection, tax packages; not an FDIC-insured bank; banking services by Thread Bank, Member FDIC.' },
  { n: 23, title: 'Baselane: pricing', publisher: 'Baselane', url: 'https://www.baselane.com/pricing', says: 'Core $0; Smart $20 a month on an annual plan with a 30-day trial; fees such as $2 for ACH rent, 3.49% for card rent, tenant screening from $24.99.' },
  { n: 24, title: 'Baselane vs. Stessa', publisher: 'Baselane (its own comparison)', url: 'https://www.baselane.com/resources/baselane-vs-stessa/', says: 'A comparison written by Baselane, updated October 29, 2026.' },
];
const c = n => `<sup class="cite"><a href="#src-${n}" aria-label="Source ${n}">[${n}]</a></sup>`;

/** Social proof we can stand behind. Add { quote, name, role } to quotes only when a real customer has said it and agreed to be named. */
export const PROOF = {
  quotes: [],
  points: [
    ['No bank logins', 'Nothing to connect, so there is no bank access to set up or revoke.'],
    ['Your data leaves with you', 'Export PDF, Excel or CSV whenever you like.'],
    ['Cancel in two clicks', 'From your profile menu, no email to support.'],
  ],
};

export const CTA = { button: 'See pricing and start the free trial', href: '/#pricing', title: 'Try Owned Map free for 7 days', text: `See everything you own on one map. ${usd(PLAN.baseCents)} a month for ${PLAN.included} assets, ${Math.round(PLAN.yearlyOff * 100)}% less when you pay yearly.` };

const m = n => usd(priceCents(n)), y = n => usd(priceCents(n, 'year'));

export const COMPARISONS = [
  {
    slug: 'kubera-vs-owned-map',
    rival: 'Kubera',
    crumb: 'Kubera vs Owned Map',
    title: 'Kubera vs Owned Map (2026): Kubera Alternative for Real Assets',
    description: 'Kubera vs Owned Map compared on assets, automation, documents, sharing and price. A Kubera alternative for property, boats and vehicles. Checked Nov 2026.',
    primary: 'kubera vs owned map',
    rivalUrl: 'https://www.kubera.com',
    takeaways: ['Kubera syncs bank, brokerage and crypto accounts for you; Owned Map does not connect to any account.', 'Owned Map is built for physical assets: a map, rental numbers, documents and renewal dates.', `Owned Map starts at ${usd(PLAN.baseCents)} a month for ${PLAN.included} assets. Kubera Black is $2,500 a year, and its entry plan is about $250 a year.`, 'Many owners of both kinds of wealth use the two together.'],
    h1: 'Kubera vs Owned Map: an honest comparison',
    lead: 'Kubera and Owned Map both help you see what you are worth, but they start from opposite ends. Kubera starts from your financial accounts and pulls them in. Owned Map starts from the things you can point to on a map (property, vehicles, boats, aircraft, land) and keeps their numbers, documents and dates together. This page puts them side by side, says plainly where Kubera is the better pick, and gives you a way to decide in five minutes.',
    toc: [['verdict', 'The short answer'], ['at-a-glance', 'At a glance'], ['starting-point', 'Two different starting points'], ['features', 'Feature by feature'], ['example', 'A worked example: one rental condo'], ['documents', 'Documents and dates'], ['sharing', 'Sharing and inheritance'], ['security', 'Security and privacy'], ['price', 'Price'], ['choose', 'Who should choose which'], ['switch', 'Using both, or switching'], ['method', 'How we checked'], ['sources', 'Sources']],
    sections: [
      { id: 'verdict', h2: 'The short answer', html: `<ul><li><strong>Pick Kubera</strong> if what you want is a dashboard that updates itself from your bank, brokerage and crypto accounts, and you mostly track financial assets.</li><li><strong>Pick Owned Map</strong> if a large part of what you own is physical (rental property, your home, cars, a boat, an aircraft, land) and you want the numbers that matter for each one, plus the documents and renewal dates, in one place and on a map.</li><li><strong>Use both</strong> if you have a big financial portfolio and a serious set of physical assets. They do not get in each other&rsquo;s way.</li></ul>
<p>The rest of the page explains why, so you do not have to take our word for it. Where we describe Kubera, we use what it publishes on its own site, and we link to it so you can check.${c(1)}</p>` },
      { id: 'at-a-glance', h2: 'At a glance', html: `<table><thead><tr><th></th><th>Kubera</th><th>Owned Map</th></tr></thead><tbody>
<tr><td>Built around</td><td>Your whole net worth, financial accounts first</td><td>The physical assets you own, on a map</td></tr>
<tr><td>Connects to banks and brokerages</td><td><strong>Yes.</strong> It advertises thousands of banks and brokerages worldwide${c(1)}</td><td>No, by design</td></tr>
<tr><td>Crypto wallets, exchanges, DeFi</td><td><strong>Yes</strong></td><td>No (you can enter a value by hand)</td></tr>
<tr><td>Property, vehicles, boats, aircraft</td><td>Yes, as assets you add</td><td><strong>Yes, the core of the product</strong></td></tr>
<tr><td>Map of everything you own</td><td>Not advertised</td><td><strong>Yes</strong>, globe and country views</td></tr>
<tr><td>Rental numbers (NOI, yield, cash flow)</td><td>Not advertised</td><td><strong>Yes</strong>, calculated for each asset</td></tr>
<tr><td>Fill in an asset from a deed or invoice</td><td>Not advertised</td><td><strong>Yes</strong>, you review before saving</td></tr>
<tr><td>Date reminders (insurance, tax, registration, inspection)</td><td>Not advertised</td><td><strong>Yes</strong></td></tr>
<tr><td>Share with family or an advisor</td><td>Yes (&ldquo;Multiplayer&rdquo;, with access control)</td><td>Yes (read-only link, household members)</td></tr>
<tr><td>Passes the portfolio to beneficiaries</td><td>Yes (a dead man&rsquo;s switch)</td><td>A private emergency sheet for one trusted person</td></tr>
<tr><td>Free trial</td><td>14 days${c(1)}</td><td>7 days, card required</td></tr>
<tr><td>Starting price</td><td>Check kubera.com (see the price section)</td><td>${usd(PLAN.baseCents)} a month for ${PLAN.included} assets</td></tr></tbody></table>
<p>&ldquo;Not advertised&rdquo; means we did not find it on Kubera&rsquo;s public pages in ${'November 2026'}. It may exist or be added later, so check before you rule it out.</p>` },
      { id: 'starting-point', h2: 'Two different starting points', html: `<p>Most comparison pages list features as if every tool were trying to do the same job. These two are not.</p>
<p><strong>Kubera is a net worth tracker.</strong> Its pitch is that you connect your accounts once and your total updates itself. It talks about thousands of banks and brokerages through several data aggregators, a web-based sync for institutions that cannot connect directly, blockchain wallets, exchanges, DeFi and NFTs, and a long list of other asset types. Its tagline is that if you can own it, Kubera can track it.${c(1)} That is a financial-first design: the accounts are the main source, and everything else is something you add.</p>
<p><strong>Owned Map is a manager for physical things.</strong> Every asset is a pin on a map. Open one and you see the estimated value, what you paid, the income and expenses, any loan, your share of ownership, and what follows from them: appreciation, net operating income, yield, monthly cash flow and your net worth after debt. The value history grows each time you update a value. Documents sit on the asset, and so do the dates you cannot afford to miss. The numbers are the ones you enter. Owned Map does not connect to any account and does not fetch market prices.</p>
<p>That last point is the biggest single difference, and it cuts both ways. If you hate typing numbers, an automatic connection is a real advantage. If a house, a boat or a collector car is most of your wealth, no bank feed will ever tell you what it is worth, so you are typing the number either way, and what matters is what the tool does with it.</p>` },
      { id: 'features', h2: 'Feature by feature', html: `<h3>Assets you can track</h3>
<p>Kubera covers financial accounts, crypto, alternatives such as private stocks and LP positions, and physical assets such as real estate, vehicles, gold, jewelry and watches. It is the wider tool by a distance.</p>
<p>Owned Map covers property, land, vehicles, boats and aircraft in depth, plus anything else you want a pin and a value for. It is the narrower tool, and it goes deeper on that narrow set: a rental condo is not just a name and a number, it is a property with income, costs, a loan and a share.</p>
<h3>Automation</h3>
<p>Kubera wins here. Balances that update on their own are the reason many people buy a tracker. Owned Map asks you to update values yourself, which for physical assets usually means a few minutes once a quarter or once a year, not every day.</p>
<h3>The map</h3>
<p>Owned Map puts everything on an interactive world map, with a globe view and a country view. If you own things in more than one place, you see at once where your wealth sits. We did not find a map on Kubera&rsquo;s public pages. If a map matters to you, that is a clear reason to prefer Owned Map; if it does not, ignore it.</p>
<h3>Reading a document for you</h3>
<p>Upload a deed, an invoice or a contract to Owned Map and the details are read for you to review before anything is saved. It saves the typing when you add an asset. It is a help, not an oracle, so always check the result.</p>
<h3>Reports and exports</h3>
<p>Owned Map exports PDF, Excel and CSV reports and imports a CSV. We offer a <a href="/downloads/asset-inventory-template.csv">free inventory template</a> in the exact format the app reads, which is handy even if you never use Owned Map: it is a decent column list for any asset inventory.</p>` },
      { id: 'example', h2: 'A worked example: one rental condo', html: `<p>Numbers make the difference concrete. Say you own a rental condo, and you want to know how it is really doing. These are the inputs you would enter:</p>
<ul><li>Estimated value: <strong>$640,000</strong></li><li>Purchase cost: <strong>$520,000</strong></li><li>Rent collected in a year: <strong>$38,400</strong></li><li>Yearly expenses (tax, insurance, upkeep, management): <strong>$9,600</strong></li><li>Loan balance: <strong>$310,000</strong>, with payments of <strong>$1,850 a month</strong></li></ul>
<p>From those, Owned Map calculates the following and shows it on the asset:</p>
<ul><li>Net operating income: $38,400 &minus; $9,600 = <strong>$28,800 a year</strong></li><li>Yield on what you paid: $28,800 &divide; $520,000 = <strong>5.5%</strong></li><li>Yield on what it is worth now: $28,800 &divide; $640,000 = <strong>4.5%</strong></li><li>Equity: $640,000 &minus; $310,000 = <strong>$330,000</strong></li><li>Appreciation: ($640,000 &minus; $520,000) &divide; $520,000 = <strong>23.1%</strong></li><li>Cash flow after the loan: $28,800 &minus; ($1,850 &times; 12) = <strong>$6,600 a year, $550 a month</strong></li></ul>
<p>The gap between the two yields is the useful part. The condo returns 5.5% on the money you put in, but only 4.5% on what it is worth today, because its value rose faster than the rent. That is the kind of fact that tells you whether to hold, raise the rent or sell, and it is the kind of number a net worth total alone hides.</p>
<p>Two details are worth knowing. First, the 4.5% figure is the standard capitalization rate, which divides net operating income by the property&rsquo;s <em>current value</em>, not the original price.${c(5)} Second, the loan payment sits outside net operating income, and for good reason: in the United States the IRS tells rental owners that they cannot simply deduct mortgage principal payments, and that they should keep accurate records and separate repairs from improvements.${c(6)} So cash flow (what reaches you), net operating income (how the property performs) and taxable profit (what you report) are three different numbers. Ask your accountant about the third; a tracker should at least keep the first two straight.</p>
<p>In a pure net worth tracker you can still add the condo with its value and the loan, and the total will be right. You would work out the yields yourself, in a spreadsheet. Whether that is a problem depends on how many properties you have and how often you ask the question. With one property, probably not. With four, in two countries, one of them co-owned, it usually is.</p>` },
      { id: 'documents', h2: 'Documents and dates', html: `<p>Owning things creates paperwork and deadlines: an insurance policy that renews, a registration, a yearly inspection, a property tax bill, a loan agreement. Most of the expensive surprises of ownership come from a date nobody wrote down.</p>
<p>Owned Map keeps documents on the asset they belong to and holds the dates (insurance, tax, registration, inspections) with reminders, so the policy and the date live next to the thing they cover. On Kubera&rsquo;s public pages we found no mention of attaching documents or tracking renewal dates, so if this is part of why you want a tool, ask them before you buy.</p>
<p>Even without any tool, the habit is worth having. For every physical asset, keep four things together: proof of ownership, the insurance policy, the loan agreement if there is one, and the next date that needs action. A shared folder and a spreadsheet will do. A tool just makes it harder to skip.</p>` },
      { id: 'sharing', h2: 'Sharing and inheritance', html: `<p>Both tools take this seriously, in different ways.</p>
<p><strong>Kubera</strong> offers a sharing feature it calls Multiplayer, with granular access control for family, assistants, advisors and accountants, and a dead man&rsquo;s switch: if you go silent for too long, it delivers your portfolio to the beneficiaries you chose. For a large, mostly digital estate, that is a strong feature.</p>
<p><strong>Owned Map</strong> lets you share a read-only link, give household members access, and set a private emergency sheet for one trusted person. It is simpler and aimed at the common case: your partner or one executor needs to know what exists, where it is and where the papers are. It does not hand your portfolio to several beneficiaries automatically.</p>
<p>Why it matters: in Caring.com&rsquo;s 2025 survey of more than 2,500 US adults, only 24% said they have a will, down from 33% in 2022.${c(7)} A will is not an inventory, but the two go together: an executor cannot settle what nobody knows exists. Regulators say the same about household goods. The Nebraska Department of Insurance advises recording brand, price, purchase date, model, serial number and receipts, with photos.${c(8)} Cars, boats and aircraft deserve the same discipline, with the registration or title number added.</p>
<p>Whichever you use, the most valuable thing for your family is not the tool but the list: every asset, where it is, who holds the papers, and who to call. We wrote the template mentioned above for that reason.</p>` },
      { id: 'security', h2: 'Security and privacy', html: `<p>This is where the two products are most different, so it is worth being precise.</p>
<p><strong>Kubera</strong> connects to your accounts through a network of financial aggregators (its security page names Plaid, Mastercard, MX, Yodlee, Akoya, SnapTrade, Lean, Akahu and Salt Edge). It says your banking credentials are entered on the aggregator&rsquo;s screen or, with open banking, on the bank&rsquo;s own login page, that its servers never see them, that it asks for read-only access and cannot initiate transactions, and that data is encrypted at rest and in transit but not end to end.${c(3)} Those are Kubera&rsquo;s own statements, and they describe a careful design for a product that has to read your accounts.</p>
<p><strong>Owned Map</strong> avoids the question. It does not connect to bank, brokerage or crypto accounts, so there is no access to grant, no connection that can break and nothing to revoke. The trade is the one already described: you enter the values yourself. For physical assets, where no feed could tell you what a boat is worth anyway, many people consider that a fair trade.</p>
<p>Whichever you choose, use a unique password and turn on every extra sign-in protection the service offers.</p>` },
      { id: 'price', h2: 'Price', html: `<p>Kubera&rsquo;s prices change, so check <a href="https://www.kubera.com" rel="noopener" target="_blank">kubera.com</a> before deciding. As of ${'November 2026'}, Kubera&rsquo;s own Black page lists that plan at $2,500 a year.${c(2)} The pages of Kubera&rsquo;s we could read do not show an entry price. The price tracker Toolradar lists the Essentials plan at $250 a year and says it confirmed prices on kubera.com on October 29, 2026.${c(4)} Treat that as a guide, not a quote. Kubera offers a 14-day trial.${c(1)}</p>
<p>Owned Map&rsquo;s pricing is simple and public. ${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets. ${extraText()}, up to ${PLAN.maxAssets} assets. Paying yearly is ${Math.round(PLAN.yearlyOff * 100)}% less. There is a ${PLAN.trialDays}-day free trial, and a card is required.</p>
<table><thead><tr><th>Assets tracked</th><th>Monthly</th><th>Paid yearly</th></tr></thead><tbody>
<tr><td>${PLAN.included}</td><td>${m(PLAN.included)}</td><td>${y(PLAN.included)}</td></tr>
<tr><td>10</td><td>${m(10)}</td><td>${y(10)}</td></tr>
<tr><td>25</td><td>${m(25)}</td><td>${y(25)}</td></tr>
<tr><td>50</td><td>${m(50)}</td><td>${y(50)}</td></tr></tbody></table>
<p>To be direct: for a small portfolio, Owned Map costs more than Kubera&rsquo;s entry plan. We think what you get for it is different (the map, the property numbers, the documents and dates), not just more of the same. If those things do not matter to you, a cheaper tracker is the sensible choice. If you own a handful of properties, a boat and a couple of vehicles, the cost per asset falls as you add more, and the monthly figure is small next to the value of what you are keeping track of.</p>` },
      { id: 'choose', h2: 'Who should choose which', html: `<h3>Choose Kubera if</h3>
<ul><li>Most of your wealth is in accounts, brokerages and crypto, and you want it synced automatically.</li><li>You hold alternatives, private stocks or LP positions and want them in the same view.</li><li>You want a beneficiary system that delivers the whole portfolio on its own.</li></ul>
<h3>Choose Owned Map if</h3>
<ul><li>You own rental property, a home, land, vehicles, a boat or an aircraft, and want yield, cash flow and net worth after debt for each.</li><li>You own things in more than one place and want to see them on a map.</li><li>You are tired of hunting for the insurance policy or the date it renews.</li><li>You do not want to give any service access to your bank accounts.</li></ul>
<h3>A five-question test</h3>
<ol><li>Is more than a third of what you own physical? If yes, lean towards Owned Map.</li><li>Do you need balances to update without touching them? If yes, lean towards Kubera.</li><li>Do you ask questions like &ldquo;is this property still worth keeping?&rdquo; If yes, lean towards Owned Map.</li><li>Do you hold crypto, DeFi or private investments? If yes, Kubera, or both.</li><li>Does anyone else need to find your documents if something happens to you? If yes, make sure whichever you choose has them attached to the asset.</li></ol>` },
      { id: 'switch', h2: 'Using both, or switching', html: `<p>You do not have to choose one. A reasonable setup for someone with a large portfolio and real assets is Kubera for the accounts and Owned Map for the physical assets. The only overlap to manage is that real estate should live in one place, so the same house is not counted twice in your total.</p>
<p>If you are moving physical assets from a spreadsheet or another tool, the quickest route is the CSV import: download the <a href="/downloads/asset-inventory-template.csv">inventory template</a>, paste your list in, and import it. Then add the loans, shares and documents asset by asset. For a list of ten assets it is a short afternoon, and the pins appear on the map as you go.</p>
<p>If you try Owned Map and it is not for you, you can cancel from your profile menu and export your data first. You are not locked in.</p>` },
      { id: 'method', h2: 'How we checked', html: `<p>We wrote this page on ${'November 3, 2026'}. What we say about Kubera comes from its own public pages, <a href="https://www.kubera.com" rel="noopener" target="_blank">kubera.com</a> and its Black plan page, plus third-party price listings where Kubera does not show a figure, which we flag as such. We have not used a paid Kubera account for this page, so we say &ldquo;not advertised&rdquo; where we found nothing, rather than &ldquo;not available&rdquo;. What we say about Owned Map is what the product does today.</p>
<p>Every outside claim is numbered and listed under Sources below, with what we rely on it for. Both products change. If you spot something out of date, email <a href="mailto:support@ownedmap.com">support@ownedmap.com</a> and we will correct it.</p>` },
    ],
    faq: [
      ['Is Owned Map a replacement for Kubera?', 'Only if most of what you track is physical: property, vehicles, boats, aircraft and land. Owned Map does not connect to bank, brokerage or crypto accounts, which is what Kubera is built around. Many people with both kinds of wealth would use the two together.'],
      ['Does Owned Map connect to my bank accounts?', 'No. Owned Map never asks for your bank logins and does not fetch market prices. The values are the ones you enter, which also means there are no bank credentials to protect.'],
      ['Is Owned Map cheaper than Kubera?', `Not for a small portfolio. Owned Map starts at ${usd(PLAN.baseCents)} a month for ${PLAN.included} assets, or about ${y(PLAN.included)} a year if you pay yearly. Kubera lists its prices on its own site, so compare the current figures. The two do different jobs, so price is only part of the choice.`],
      ['Can Kubera track real estate and vehicles?', 'Yes. Kubera says it tracks physical assets such as real estate, vehicles, gold, jewelry and watches. We did not find rental yield, cash flow, documents or renewal dates on its public pages, which Owned Map is built around.'],
      ['Can I try Owned Map before paying?', `Yes. There is a ${PLAN.trialDays}-day free trial, and a card is required to start it. You can cancel from your profile menu at any time.`],
      ['Does Kubera store my bank password?', 'Kubera says it does not. Its security page says credentials are entered on the aggregator\u2019s screen or the bank\u2019s own login page, that its servers never see them, and that it has read-only access and cannot move money. Owned Map avoids the question by not connecting to accounts at all.'],
      ['How do I move my assets over?', 'Download the free inventory template, fill in your list and import the CSV. Then add loans, ownership shares and documents to each asset.'],
    ],
  },
  MONARCH,
  STESSA,
  EMPOWER,
  LANDLORD,
  BASELANE,
  ROUNDUP,
];

const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** The Sources section of a page, built from SOURCES. Citations are numbered per page by first appearance, so the numbers in the text and the list cannot drift apart. */
export function finalizeCitations(cmp) {
  const order = [];
  for (const sec of cmp.sections) for (const mt of sec.html.matchAll(/href="#src-(\d+)"/g)) if (!order.includes(Number(mt[1]))) order.push(Number(mt[1]));
  const num = id => order.indexOf(id) + 1;
  for (const sec of cmp.sections) sec.html = sec.html.replace(/<sup class="cite"><a href="#src-(\d+)" aria-label="Source \d+">\[\d+\]<\/a><\/sup>/g, (_, id) => `<sup class="cite"><a href="#src-${num(+id)}" aria-label="Source ${num(+id)}">[${num(+id)}]</a></sup>`);
  cmp.sources = order;
  cmp.sections.push({ id: 'sources', h2: 'Sources', html: `<ol class="cmp-sources">${order.map((id, i) => { const r = SOURCES.find(x => x.n === id); return `<li id="src-${i + 1}"><a href="${r.url}" rel="noopener" target="_blank">${r.title}</a>, ${r.publisher}. <span>${r.says} ${r.via || `Read ${longDate(CHECKED)}.`}</span></li>`; }).join('')}</ol>` });
}
for (const cmp of COMPARISONS) finalizeCitations(cmp);

export const bySlug = Object.fromEntries(COMPARISONS.map(c => [c.slug, c]));
