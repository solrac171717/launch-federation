// The guides: useful, honest pages that answer what people search for before they need Owned Map. Plain data, rendered by scripts/guides.mjs into /guides/*.html.
// Rules for anything added here: only claims we can back (the product does what the code does; no invented customers, reviews or statistics),
// numbers in examples must add up, and competitors are described from public information with a "check their site" note.
export const PUBLISHED = '2026-11-03';

const CTA = { title: 'See all of it on one map', text: 'Owned Map puts your property, vehicles, boats and aircraft on one map, with value, income, expenses, yield and net worth for each. 7-day free trial, card required, cancel anytime.', button: 'Start for Free', href: '/api/start' };
const NOT_ADVICE = 'This guide is general information, not financial, tax or legal advice. Rules and numbers differ by country and situation, so check with a professional before you decide.';

export const GUIDES = [
  {
    slug: 'track-rental-properties',
    crumb: 'Rental properties',
    title: 'Track Rental Property Performance: Income, Yield, Equity',
    description: 'The six numbers to track for each rental property, the formulas for NOI, yield, equity and cash flow, and a worked example you can copy.',
    h1: 'How to track rental property performance',
    lead: 'A spreadsheet works for one rental. By the third property, with a loan on each, one of them owned with a partner and one in another country, it stops telling you how you are really doing. Here are the numbers worth tracking for every property, and how to calculate them.',
    sections: [
      { h2: 'The six numbers to keep for every property', html: `<p>You can run a whole portfolio on six numbers per property. Keep them in one place and update them on a schedule.</p>
<ul><li><strong>Estimated value:</strong> what you could sell it for today. Not what you paid.</li><li><strong>Purchase cost:</strong> the price paid, plus closing costs if you want a true cost basis.</li><li><strong>Annual income:</strong> rent actually collected in a year.</li><li><strong>Annual expenses:</strong> property tax, insurance, maintenance, management, utilities you pay, vacancy costs. Leave the loan payment out of this one.</li><li><strong>Debt and monthly payment:</strong> what you still owe, and what you pay each month.</li><li><strong>Your share:</strong> 100% if it is all yours, less if you own it with someone else.</li></ul>` },
      { h2: 'The formulas', html: `<ul><li><strong>NOI (net operating income)</strong> = annual income &minus; annual expenses. It ignores the loan, so you can compare properties fairly.</li><li><strong>Yield on cost</strong> = NOI &divide; purchase cost. It shows how hard the money you put in is working.</li><li><strong>NOI yield on value</strong> = NOI &divide; estimated value. It shows what the property earns at today&rsquo;s value, and falls when the property goes up faster than the rent.</li><li><strong>Equity</strong> = estimated value &minus; debt.</li><li><strong>Appreciation</strong> = (estimated value &minus; purchase cost) &divide; purchase cost.</li><li><strong>Cash flow</strong> = NOI &minus; loan payments. This is the money that really reaches you.</li></ul>` },
      { h2: 'A worked example', html: `<p>A condo bought for $520,000 that is worth about $640,000 today. It rents for $38,400 a year and costs $9,600 a year to run. The loan balance is $310,000 and the payments are $1,850 a month.</p>
<table><thead><tr><th>Number</th><th>Calculation</th><th>Result</th></tr></thead><tbody>
<tr><td>NOI</td><td>$38,400 &minus; $9,600</td><td>$28,800 a year</td></tr>
<tr><td>Yield on cost</td><td>$28,800 &divide; $520,000</td><td>5.5%</td></tr>
<tr><td>NOI yield on value</td><td>$28,800 &divide; $640,000</td><td>4.5%</td></tr>
<tr><td>Equity</td><td>$640,000 &minus; $310,000</td><td>$330,000</td></tr>
<tr><td>Appreciation</td><td>($640,000 &minus; $520,000) &divide; $520,000</td><td>23.1%</td></tr>
<tr><td>Cash flow</td><td>$28,800 &minus; ($1,850 &times; 12)</td><td>$6,600 a year, $550 a month</td></tr></tbody></table>
<p>These are example figures. If you own the condo 50/50 with a partner, your share of every money figure is half: equity of $165,000 and cash flow of $3,300 a year. The percentages do not change.</p>` },
      { h2: 'The dates that cost you money', html: `<p>Performance is not only numbers. A missed insurance renewal or property tax date costs real money, and it is the easiest thing to lose track of across several properties. Write down, for each property: insurance renewal, property tax, inspections, lease end and any loan rate change. Put each one in a calendar or reminder tool with a warning a few weeks ahead.</p>` },
      { h2: 'Keep the paperwork next to the property', html: `<p>The deed, the insurance policy, the lease and the loan statement are the documents you will want in a hurry: for a refinance, a sale, a tax question or an emergency. Store them against the property they belong to, not in one folder called &ldquo;house stuff&rdquo;.</p>` },
      { h2: 'How Owned Map does this', html: `<p>In Owned Map each property is a pin on a world map with its own value, cost, income, expenses, loan, ownership share and documents. Upload a deed and the details fill in for you (you review them). The app calculates NOI, yield, equity, appreciation and monthly cash flow, shows your net worth after debt across everything, sets reminders for insurance and tax dates, and exports PDF, Excel and CSV reports. It does not look up market prices: the value is the one you enter, so it always matches what you believe the property is worth.</p>` },
    ],
    faq: [
      ['What is a good yield for a rental property?', 'It depends on the country, the city and the kind of property, so there is no single right number. Compare the properties you own against each other and against what you could earn elsewhere, using the same formula every time.'],
      ['Should the mortgage count as an expense?', 'Not in NOI. NOI is meant to show what the property earns before financing. The loan payment comes in when you work out cash flow.'],
      ['How often should I update the estimated value?', 'Once or twice a year is enough for most people, or when something clearly changes the value, such as a renovation, a recent sale nearby or a new appraisal. Keep the old values so you can see the trend.'],
    ],
    related: ['net-worth-with-real-assets', 'asset-inventory-for-estate-planning'],
  },
  {
    slug: 'track-vehicles-boats-and-aircraft',
    crumb: 'Vehicles, boats and aircraft',
    title: 'Track Vehicles, Boats and Aircraft: Value, Costs, Paperwork',
    description: 'How to keep track of cars, boats and aircraft: what to record, how to handle depreciation, the paperwork to keep and the dates not to miss.',
    h1: 'How to keep track of your vehicles, boats and aircraft',
    lead: 'Cars, boats and aircraft lose value, cost money every year and come with registrations, insurance and inspections that expire. They are easy to forget in a net worth sheet, and expensive to forget in real life. This is what to record, and why.',
    sections: [
      { h2: 'Why they are different from property', html: `<p>A house usually holds or gains value and earns rent. A car, boat or aircraft usually does the opposite: it loses value year after year and costs money to keep (insurance, storage, maintenance, fuel, fees). That does not make them a bad idea, but it means the useful questions change: what is it worth now, and what does it cost me per year?</p>` },
      { h2: 'What to record for each one', html: `<ul><li><strong>The identifier:</strong> the VIN for a vehicle, the hull identification number (HIN) for a boat, the registration or tail number for an aircraft. It is the first thing anyone asks for.</li><li><strong>Purchase price and date.</strong></li><li><strong>Estimated value today,</strong> and where you got it from (a dealer quote, a recent sale of the same model, a survey, a broker).</li><li><strong>Yearly running costs:</strong> insurance, storage or berth or hangar, maintenance, registration, fuel you would not spend otherwise.</li><li><strong>Any loan:</strong> balance and monthly payment.</li><li><strong>Where it is:</strong> the city, marina or airfield. It matters for insurance and for you when you need to find it.</li></ul>` },
      { h2: 'Handling depreciation', html: `<p>Do not keep the purchase price as the value forever. Update the estimate on a schedule, and keep the old figures so you can see how fast it falls. If you want a forecast, an expected yearly change is a simple way to do it: for example &minus;12% a year for a car early in its life, a smaller drop for a well-kept boat. Treat these as assumptions you revise, not facts.</p>` },
      { h2: 'The cost of owning it', html: `<p>Divide the yearly running cost by the current value. It shows how much of the asset&rsquo;s value you spend each year just to keep it.</p>
<table><thead><tr><th>Example asset</th><th>Value</th><th>Yearly running costs</th><th>Cost as % of value</th></tr></thead><tbody>
<tr><td>Family car</td><td>$34,000</td><td>$2,100</td><td>6.2%</td></tr>
<tr><td>Sailboat</td><td>$285,000</td><td>$11,800</td><td>4.1%</td></tr></tbody></table>
<p>Example figures. Looking at this every year makes decisions like selling, renewing a berth or upgrading a lot more concrete.</p>` },
      { h2: 'Paperwork and dates', html: `<p>Keep the title or registration, the insurance policy, purchase invoice and any survey or inspection report together with the asset. Then list the dates that expire: registration, insurance, scheduled service and inspections (for aircraft, the annual inspection; for boats, haul-out and survey intervals). Set a reminder a few weeks before each one.</p>` },
      { h2: 'How Owned Map does this', html: `<p>Vehicles, boats and aircraft are first-class assets in Owned Map. Add an identifier, upload the invoice or contract and the form fills in for you, set a yearly change in value, enter the loan, attach the insurance and registration, and add reminders for every date. Everything shows on the map, in your net worth after debt, and in the reports you can export. Values are the ones you enter; the app does not fetch market prices.</p>` },
    ],
    faq: [
      ['Where do I find the number to identify my boat or aircraft?', 'Boats carry a hull identification number, usually on the transom. Aircraft carry a registration (tail) number on the fuselage and in the registration papers. Check your paperwork for the exact format in your country.'],
      ['How do I estimate what my boat or car is worth?', 'Look at recent asking and sale prices for the same make, model, year and condition, ask a dealer or broker for a quote, and use a survey for boats and aircraft when the amount justifies it. Write down the source so you can compare next year.'],
      ['Should I count a vehicle in my net worth?', 'Most people do, at its realistic resale value and minus any loan on it. What matters is being consistent from one year to the next.'],
    ],
    related: ['net-worth-with-real-assets', 'track-rental-properties'],
  },
  {
    slug: 'asset-inventory-for-estate-planning',
    crumb: 'Estate planning inventory',
    title: 'Asset Inventory for Estate Planning: What to List',
    description: 'What to put in an asset inventory so your family can find everything: property, vehicles, boats, documents and contacts, plus a free CSV template.',
    h1: 'Asset inventory for estate planning: what to list',
    lead: 'When someone dies or becomes unable to manage their affairs, the hardest part for the family is often not the law. It is finding out what exists, where the documents are and who to call. An up-to-date inventory fixes most of that. Here is what to put in it.',
    sections: [
      { h2: 'What an inventory is, and what it is not', html: `<p>An inventory is a list of what you own, with the details someone else would need to find it and deal with it. It is not a will and it does not decide who gets what. It is the map that a will, a lawyer or an executor then works from.</p>` },
      { h2: 'What to list for each asset', html: `<ul><li>What it is and where it is (address, marina, airfield, storage).</li><li>An identifier: the property reference, VIN, hull number or tail number.</li><li>An estimated value and the date of that estimate.</li><li>How it is owned: you alone, shared, or through a company, and the percentages.</li><li>Any loan, with the lender and the balance.</li><li>Where the documents are: deed, title, registration, insurance policy, loan contract.</li><li>The people who know it: the insurance agent, the property manager, the accountant, the lawyer.</li><li>Dates that matter: renewals, rent reviews, inspections.</li></ul>` },
      { h2: 'The categories people forget', html: `<ul><li>Property in another country, and who looks after it.</li><li>Vehicles, boats and aircraft kept somewhere other than home.</li><li>Land, parking spaces and storage units.</li><li>Equipment and machinery used in a business.</li><li>Assets held jointly, or through a company or trust.</li></ul><p>Bank accounts, investments and digital accounts also belong in a complete picture. They live in other tools, so many people keep a short pointer in the inventory (&ldquo;accounts at these institutions, details held by my lawyer&rdquo;).</p>` },
      { h2: 'What not to put in it', html: `<p>Do not write passwords, PINs or recovery codes into a list that several people can open. Say where they are kept (a password manager, a safe) and who can get to them.</p>` },
      { h2: 'Who should see it, and when', html: `<p>Decide who needs to see the inventory and when. A common choice is one trusted person who opens it only when needed. Keep a way to stop that access, and review the list at least once a year so it never goes out of date.</p>` },
      { h2: 'A free template', html: `<p>You can start with a simple spreadsheet. <a href="/downloads/asset-inventory-template.csv" download>Download the asset inventory template (CSV)</a>. It has one row per asset with the columns above and opens in Excel, Google Sheets or Numbers. It is also in the format Owned Map imports, so you can move to the app later without retyping.</p>` },
      { h2: 'How Owned Map does this', html: `<p>Every asset in Owned Map has its owner, ownership share, loan, documents and reminders. On top of that, you can name one trusted person and set a private emergency sheet: a link that opens only after you have been away from the app for a number of days you choose, or when you release it yourself. It shows only the details you decided to include. You can pause or remove it at any time, and a visit from you closes it again.</p>` },
    ],
    faq: [
      ['Is an asset inventory legally binding?', 'No. It helps whoever deals with your affairs find and value your assets. The legal decisions are made in your will, trust or other documents, so talk to a lawyer about those.'],
      ['How often should I update it?', 'At least once a year, and whenever you buy, sell or refinance something, or change who owns it.'],
      ['Can my family see it while I am alive?', 'Only if you choose to share it. Give access to the people you trust, keep it read-only where you can, and review who has it from time to time.'],
    ],
    related: ['track-rental-properties', 'net-worth-with-real-assets'],
  },
  {
    slug: 'net-worth-with-real-assets',
    crumb: 'Net worth with real assets',
    title: 'How to Calculate Net Worth With Property, Cars and Boats',
    description: 'A step-by-step way to calculate net worth when you own real assets, with shared ownership, loans and a worked example that adds up.',
    h1: 'How to calculate your net worth when you own real assets',
    lead: 'Net worth is what you own minus what you owe. That is simple until some of what you own is a property shared with a partner, a car that loses value every year and a boat with a loan. Here is a clear way to do it, with an example that adds up.',
    sections: [
      { h2: 'The idea', html: `<p><strong>Net worth = the value of everything you own &minus; everything you owe.</strong> For real assets that means three things to get right: use a realistic value, count only your share, and subtract the loan that belongs to that asset.</p>` },
      { h2: 'Step by step', html: `<ol><li><strong>List every asset</strong> with its estimated value today, meaning what you could sell it for, not the price you paid.</li><li><strong>Apply your share.</strong> If you own 50% of a property, count 50% of its value.</li><li><strong>List the debt on each asset</strong> and apply the same share to it.</li><li><strong>Subtract</strong> the total debt from the total value.</li><li><strong>Write down the date.</strong> The number is only useful if you can compare it with last year&rsquo;s.</li></ol>` },
      { h2: 'A worked example', html: `<table><thead><tr><th>Asset</th><th>Your share</th><th>Value (whole)</th><th>Your value</th><th>Debt (whole)</th><th>Your debt</th></tr></thead><tbody>
<tr><td>Condo</td><td>50%</td><td>$640,000</td><td>$320,000</td><td>$310,000</td><td>$155,000</td></tr>
<tr><td>Car</td><td>100%</td><td>$34,000</td><td>$34,000</td><td>$0</td><td>$0</td></tr>
<tr><td>Sailboat</td><td>100%</td><td>$285,000</td><td>$285,000</td><td>$60,000</td><td>$60,000</td></tr>
<tr><td><strong>Total</strong></td><td></td><td></td><td><strong>$639,000</strong></td><td></td><td><strong>$215,000</strong></td></tr></tbody></table>
<p><strong>Net worth = $639,000 &minus; $215,000 = $424,000.</strong> Example figures.</p>` },
      { h2: 'Mistakes that distort the number', html: `<ul><li><strong>Using the purchase price</strong> for something that loses value, such as a car or boat.</li><li><strong>Counting 100% of a shared asset</strong> but only your part of the loan, or the other way round.</li><li><strong>Forgetting the loan</strong> on an asset you counted at full value.</li><li><strong>Mixing currencies</strong> without converting them at one rate on one date.</li><li><strong>Never updating values.</strong> A net worth built on three-year-old figures is a story, not a measurement.</li></ul>` },
      { h2: 'How often to recalculate', html: `<p>Once a quarter is plenty for most people, and once a year is the minimum. Update the value of an asset sooner when something clearly changes it.</p>` },
      { h2: 'How Owned Map does this', html: `<p>Owned Map keeps the value, loan and ownership share of each asset, counts only your part everywhere, converts assets held in other currencies, and shows your net worth after debt with a history that grows each time you update a value. Values are the ones you enter, so the result always reflects what you believe your assets are worth.</p>` },
    ],
    faq: [
      ['Should I include my primary home?', 'Many people do, since it is a large part of what they own. Some also show a second figure without it. Pick one approach and keep it the same from year to year.'],
      ['What about money in bank and investment accounts?', 'They belong in a complete net worth. Owned Map focuses on physical assets and does not connect to bank or brokerage accounts, so many people add a single line for the total of their accounts.'],
      ['How do I treat an asset that is in another currency?', 'Convert it to your main currency at a stated rate on a stated date, and use the same approach each time you update.'],
    ],
    related: ['track-vehicles-boats-and-aircraft', 'track-rental-properties'],
  },
  {
    slug: 'kubera-alternative-for-real-assets',
    crumb: 'Kubera alternative',
    title: 'Kubera Alternative for People Who Own Real Assets',
    description: 'An honest comparison of Kubera and Owned Map: what each does best, how they are priced and which fits if you own property, boats, vehicles or aircraft.',
    h1: 'A Kubera alternative for people who own real assets',
    lead: 'Kubera is a net worth tracker. Owned Map is a place to manage the physical things you own. They overlap, but they are built for different people. This page says plainly where each one is the better choice, so you can pick without a sales pitch.',
    sections: [
      { h2: 'The short answer', html: `<ul><li>If you mostly want to <strong>watch your whole net worth update itself</strong> across bank accounts, brokerages and crypto, Kubera is built for that and Owned Map is not.</li><li>If most of your wealth is in <strong>things you can point to on a map</strong> (property, vehicles, boats, aircraft, land) and you want their numbers, documents and dates in one place, Owned Map is built for that.</li><li>Some people use both.</li></ul>` },
      { h2: 'Where Kubera is stronger', html: `<p>According to public reviews, Kubera connects to financial accounts and crypto wallets and updates balances automatically, and it lets you add other assets by hand. Owned Map does <strong>not</strong> connect to bank or brokerage accounts and does not fetch market prices. If automatic account syncing matters most to you, choose a tool built around it.</p>` },
      { h2: 'Where Owned Map is stronger', html: `<ul><li><strong>The map.</strong> Every asset is a pin on a world map, with a globe view and a country view, so a portfolio across several countries is easy to see.</li><li><strong>Per-asset financials.</strong> Value, cost, income, expenses, loan, ownership share, yield and monthly cash flow for each asset.</li><li><strong>Documents that fill in the form.</strong> Upload a deed, invoice or contract and the details are read for you to review.</li><li><strong>Dates.</strong> Reminders for insurance, tax, registration and inspections.</li><li><strong>People.</strong> Read-only share links, household access, and a private emergency sheet for one trusted person.</li><li><strong>Reports.</strong> PDF, Excel and CSV exports.</li></ul>` },
      { h2: 'Price', html: `<table><thead><tr><th></th><th>Kubera</th><th>Owned Map</th></tr></thead><tbody>
<tr><td>Published price</td><td>Reviews report plans from about $150 to $250 a year, with higher tiers. Check kubera.com for the current price.</td><td>$47 a month includes 3 assets. Extra assets cost $15 each for assets 4 to 10, $10 each for 11 to 25 and $5 each from the 26th. Yearly billing is 30% less.</td></tr>
<tr><td>Free trial</td><td>Check kubera.com.</td><td>7 days, card required, cancel anytime.</td></tr></tbody></table>
<p>Owned Map costs more than Kubera for a small portfolio and less than it might seem for a large one: for example, 25 assets cost $302 a month, or $2,536.80 a year paid yearly. We think the extra goes to something different (the map, the documents and the dates), but compare for yourself. Prices were checked against public sources in November 2026 and can change.</p>` },
      { h2: 'Who should pick which', html: `<table><thead><tr><th>You want to&hellip;</th><th>Better fit</th></tr></thead><tbody>
<tr><td>Sync bank, brokerage and crypto accounts automatically</td><td>Kubera</td></tr>
<tr><td>Track several properties with income, loans and ownership shares</td><td>Owned Map</td></tr>
<tr><td>Keep boats, aircraft and vehicles with their documents and renewals</td><td>Owned Map</td></tr>
<tr><td>See everything you own on a world map</td><td>Owned Map</td></tr>
<tr><td>Prepare a clear inventory for your family</td><td>Owned Map</td></tr></tbody></table>` },
    ],
    faq: [
      ['Does Owned Map connect to my bank accounts?', 'No. Owned Map is for physical assets and you enter the values yourself. It does not connect to banks, brokerages or crypto wallets.'],
      ['Can I import my assets from a spreadsheet?', 'Yes. Owned Map imports a CSV file, and you can download the template from the app or from our asset inventory guide.'],
      ['Is there a free trial?', 'Yes, 7 days. A card is required to start it and you are charged only when it ends, unless you cancel before.'],
    ],
    related: ['net-worth-with-real-assets', 'asset-inventory-for-estate-planning'],
  },
];

export { CTA, NOT_ADVICE };
