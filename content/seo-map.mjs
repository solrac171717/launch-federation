// The keyword map: one search intent, one URL. This file is what keeps our pages from competing with each other in Google.
//
// The rules (test/seo-map.test.js fails the build when one is broken):
//  1. Every indexable URL has exactly one `primary` phrase, and no other URL may use it, or one of its `secondary` phrases, in its title, H1 or description.
//  2. A phrase belongs to one URL only, across live pages and the planned ones in PLANNED. Plan the page here BEFORE writing it.
//  3. One page per rival. "X alternative", "X vs Owned Map" and "X review"-style searches are the same intent, so they are answered by that rival's single page
//     (its primary plus its secondaries). Never a second page for the same rival, and never a separate "alternative" page.
//  4. The hub (/compare/) targets only the category phrase. Home targets the product phrase. Legal pages target nothing.
//  5. Each page's title, H1 and description are unique, and the primary appears in the title, the H1 and the first 100 words of the text.
//  6. Retired or renamed URLs answer with a permanent redirect (vercel.json) to the page that now owns the intent. Every live page has a self-referencing canonical.
//  7. Links from one page to another use anchor text that describes the target (its own phrase), never the phrase another URL owns.
//
// `brand` is allowed everywhere: it is our name, not a topic.
export const BRAND = 'owned map';

export const SEO_MAP = [
  { path: '/', type: 'home', primary: 'track every asset you own', secondary: ['asset tracker', 'personal asset tracker', 'asset tracking app', 'real asset tracker'] },
  { path: '/compare/', type: 'hub', primary: 'net worth tracker comparison', secondary: ['net worth tracker alternatives'] },
  { path: '/compare/kubera-vs-owned-map', type: 'comparison', rival: 'Kubera', primary: 'kubera vs owned map', secondary: ['kubera alternative', 'kubera competitors'] },
  { path: '/compare/monarch-vs-owned-map', type: 'comparison', rival: 'Monarch Money', primary: 'monarch money vs owned map', secondary: ['monarch money alternative', 'monarch money competitors'] },
  { path: '/compare/empower-vs-owned-map', type: 'comparison', rival: 'Empower', primary: 'empower vs owned map', secondary: ['empower alternative', 'empower personal dashboard alternative'] },
  { path: '/compare/stessa-vs-owned-map', type: 'comparison', rival: 'Stessa', primary: 'stessa vs owned map', secondary: ['stessa alternative', 'stessa competitors'] },
  { path: '/privacy.html', type: 'legal' },
  { path: '/terms.html', type: 'legal' },
];

/** Pages we intend to write, each with its own phrases, so nothing new can collide with what is live or with what is next.
 *  `wave` is the order of work (see marketing/seo-keyword-plan.md); `stage` is the buyer's stage: bofu (ready to choose), mofu (comparing), tofu (learning).
 *  Several wordings of one search are ONE page: the secondaries are the other wordings, and they are answered on that page, never on a page of their own. */
export const PLANNED = [
  // wave 1: the pages closest to a purchase, on searches where today's results are weak or off-target
  { wave: 1, stage: 'bofu', path: '/solutions/rental-property-portfolio-tracker', type: 'solution', primary: 'rental property portfolio tracker', secondary: ['real estate portfolio tracker', 'real estate portfolio tracking software', 'rental portfolio tracker'] },
  { wave: 1, stage: 'bofu', path: '/solutions/net-worth-tracker-without-bank-linking', type: 'solution', primary: 'net worth tracker without linking bank accounts', secondary: ['manual net worth tracker', 'net worth tracker no bank connection', 'private net worth tracker'] },
  { wave: 1, stage: 'mofu', path: '/compare/best-net-worth-trackers-for-real-assets', type: 'roundup', primary: 'best net worth tracker for real estate', secondary: ['best app to track rental properties'] },
  { wave: 1, stage: 'bofu', path: '/compare/landlord-studio-vs-owned-map', type: 'comparison', rival: 'Landlord Studio', primary: 'landlord studio vs owned map', secondary: ['landlord studio alternative'] },
  { wave: 1, stage: 'bofu', path: '/compare/baselane-vs-owned-map', type: 'comparison', rival: 'Baselane', primary: 'baselane vs owned map', secondary: ['baselane alternative'] },
  { wave: 1, stage: 'mofu', path: '/guides/estate-asset-inventory-template', type: 'guide', primary: 'estate asset inventory template', secondary: ['asset inventory for estate planning', 'list of assets for executor'] },
  // wave 2: narrower audiences, high value per customer
  { wave: 2, stage: 'bofu', path: '/solutions/boat-ownership-tracker', type: 'solution', primary: 'boat ownership tracker app', secondary: ['boat maintenance and documents tracker', 'track boat expenses and registration'] },
  { wave: 2, stage: 'bofu', path: '/solutions/classic-car-collection-tracker', type: 'solution', primary: 'classic car collection tracker', secondary: ['car collection value tracker', 'track collector car documents'] },
  { wave: 2, stage: 'bofu', path: '/solutions/aircraft-ownership-tracker', type: 'solution', primary: 'aircraft ownership tracker', secondary: ['aircraft records and inspection tracker'] },
  { wave: 2, stage: 'mofu', path: '/compare/spreadsheet-vs-owned-map', type: 'comparison', rival: 'Spreadsheets', primary: 'asset tracking spreadsheet vs owned map', secondary: ['asset tracking spreadsheet alternative', 'excel template for tracking assets'] },
  // wave 3: only after the data from Search Console says which of these earns clicks
  { wave: 3, stage: 'tofu', path: '/guides/yield-on-cost-vs-cap-rate', type: 'guide', primary: 'yield on cost vs cap rate', secondary: ['cap rate vs yield on cost', 'yield on cost real estate'] },
  { wave: 3, stage: 'tofu', path: '/guides/boat-ownership-costs', type: 'guide', primary: 'boat ownership costs per year', secondary: ['true cost of owning a boat'] },
  { wave: 3, stage: 'mofu', path: '/guides/personal-net-worth-statement', type: 'guide', primary: 'personal net worth statement template', secondary: ['net worth statement for a loan'] },
  { wave: 3, stage: 'bofu', path: '/compare/copilot-vs-owned-map', type: 'comparison', rival: 'Copilot Money', primary: 'copilot money vs owned map', secondary: ['copilot money alternative'] },
];

/** The phrases a page claims: its primary first, then its secondaries. */
export const phrases = e => [e.primary, ...(e.secondary || [])].filter(Boolean);
