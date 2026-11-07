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
  { path: '/compare/landlord-studio-vs-owned-map', type: 'comparison', rival: 'Landlord Studio', primary: 'landlord studio vs owned map', secondary: ['landlord studio alternative'] },
  { path: '/compare/baselane-vs-owned-map', type: 'comparison', rival: 'Baselane', primary: 'baselane vs owned map', secondary: ['baselane alternative'] },
  { path: '/compare/best-net-worth-trackers-for-real-assets', type: 'roundup', primary: 'best net worth tracker for real estate', secondary: ['best app to track rental properties'] },
  { path: '/solutions/rental-property-portfolio-tracker', type: 'solution', primary: 'rental property portfolio tracker', secondary: ['real estate portfolio tracker', 'real estate portfolio tracking software', 'rental portfolio tracker', 'rental property equity tracker', 'track equity across rental properties'] },
  { path: '/solutions/net-worth-tracker-without-bank-linking', type: 'solution', primary: 'net worth tracker without linking bank accounts', secondary: ['manual net worth tracker', 'net worth tracker no bank connection', 'private net worth tracker'] },
  { path: '/privacy.html', type: 'legal' },
  { path: '/terms.html', type: 'legal' },
];

/** Pages we intend to write, each with its own phrases, so nothing new can collide with what is live or with what is next.
 *  `wave` is the order of work (see marketing/seo-keyword-plan.md); `stage` is the buyer's stage: bofu (ready to choose), mofu (comparing), tofu (learning).
 *  Several wordings of one search are ONE page: the secondaries are the other wordings, and they are answered on that page, never on a page of their own. */
export const PLANNED = [
  // wave 1: the pages closest to a purchase, on searches where today's results are weak or off-target
  { wave: 1, stage: 'mofu', path: '/guides/estate-asset-inventory-template', type: 'guide', primary: 'estate asset inventory template', secondary: ['asset inventory for estate planning', 'list of assets for executor'] },
  // wave 2: narrower audiences, high value per customer
  { wave: 2, stage: 'bofu', path: '/solutions/boat-ownership-tracker', type: 'solution', primary: 'boat ownership tracker app', secondary: ['track boat expenses and registration', 'boat documents and insurance tracker'] },
  { wave: 2, stage: 'bofu', path: '/solutions/classic-car-collection-tracker', type: 'solution', primary: 'classic car collection tracker', secondary: ['car collection value tracker', 'track collector car documents'] },
  { wave: 2, stage: 'mofu', path: '/compare/spreadsheet-vs-owned-map', type: 'comparison', rival: 'Spreadsheets', primary: 'asset tracking spreadsheet vs owned map', secondary: ['asset tracking spreadsheet alternative', 'excel template for tracking assets'] },
  { wave: 2, stage: 'bofu', path: '/solutions/co-owned-property-tracker', type: 'solution', primary: 'co-owned property tracker', secondary: ['shared property ownership tracker', 'co-ownership property tracking app'] },
  { wave: 2, stage: 'mofu', path: '/solutions/property-and-vehicle-records-app', type: 'solution', primary: 'app to manage property and vehicle records', secondary: ['organize family asset documents', 'digital asset records for family'] },
  // wave 3: only after the data from Search Console says which of these earns clicks
  { wave: 3, stage: 'bofu', path: '/solutions/aircraft-ownership-tracker', type: 'solution', primary: 'aircraft ownership tracker', secondary: ['aircraft ownership cost tracker'] }, // dedicated logbook apps own this SERP; Owned Map is not a logbook, so only the cost, value and documents angle
  { wave: 3, stage: 'bofu', path: '/solutions/track-real-estate-in-multiple-countries', type: 'solution', primary: 'track real estate in multiple countries', secondary: ['net worth tracker for international property'] }, // needs a product check first: currencies
  { wave: 3, stage: 'mofu', path: '/solutions/insurance-renewal-tracker-for-rental-properties', type: 'solution', primary: 'insurance renewal tracker for rental properties', secondary: ['track property insurance renewal dates'] },
  { wave: 3, stage: 'tofu', path: '/guides/yield-on-cost-vs-cap-rate', type: 'guide', primary: 'yield on cost vs cap rate', secondary: ['cap rate vs yield on cost', 'yield on cost real estate'] },
  { wave: 3, stage: 'tofu', path: '/guides/boat-ownership-costs', type: 'guide', primary: 'boat ownership costs per year', secondary: ['true cost of owning a boat'] },
  { wave: 3, stage: 'mofu', path: '/guides/personal-net-worth-statement', type: 'guide', primary: 'personal net worth statement template', secondary: ['net worth statement for a loan'] },
  { wave: 3, stage: 'bofu', path: '/compare/copilot-vs-owned-map', type: 'comparison', rival: 'Copilot Money', primary: 'copilot money vs owned map', secondary: ['copilot money alternative'] },
  // wave 4 (7 Nov 2026 research round): investors who must show lenders a list of properties, free-and-manual rivals, and the passion-asset owner
  { wave: 4, stage: 'mofu', path: '/guides/schedule-of-real-estate-owned-template', type: 'guide', primary: 'schedule of real estate owned template', secondary: ['sreo template', 'real estate owned schedule for lenders'] },
  { wave: 4, stage: 'mofu', path: '/guides/rental-portfolio-ltv-calculator', type: 'guide', primary: 'rental portfolio ltv calculator', secondary: ['portfolio loan to value calculator'] },
  { wave: 4, stage: 'bofu', path: '/compare/projectionlab-vs-owned-map', type: 'comparison', rival: 'ProjectionLab', primary: 'projectionlab vs owned map', secondary: ['projectionlab alternative'] },
  { wave: 4, stage: 'bofu', path: '/compare/quicken-simplifi-vs-owned-map', type: 'comparison', rival: 'Quicken Simplifi', primary: 'quicken simplifi vs owned map', secondary: ['quicken simplifi alternative'] },
  { wave: 4, stage: 'bofu', path: '/solutions/luxury-asset-portfolio-tracker', type: 'solution', primary: 'luxury asset portfolio tracker', secondary: ['passion assets tracker', 'family office software for individuals'] },
];

/** The phrases a page claims: its primary first, then its secondaries. */
export const phrases = e => [e.primary, ...(e.secondary || [])].filter(Boolean);

/** The groups (topic clusters). A pillar is the page that owns the group's main search; a spoke owns a narrower one and points up to its pillar.
 *  Link rules, checked by test/seo-map.test.js:
 *   - a spoke links to its pillar and to at most two sibling spokes; the pillar links to every live spoke of its group;
 *   - only pages that are live are linked (a link to a page that does not exist yet would break the build);
 *   - the link text is the target's own title, so it carries the target's phrase and never another page's;
 *   - the best-net-worth roundup is a bridge: it is a spoke of both groups, so the two groups feed each other through it. */
export const CLUSTERS = [
  { id: 'rental', name: 'Rental and real estate portfolio', pillar: '/solutions/rental-property-portfolio-tracker', spokes: ['/compare/stessa-vs-owned-map', '/compare/landlord-studio-vs-owned-map', '/compare/baselane-vs-owned-map', '/compare/best-net-worth-trackers-for-real-assets', '/solutions/co-owned-property-tracker', '/solutions/insurance-renewal-tracker-for-rental-properties', '/guides/yield-on-cost-vs-cap-rate', '/solutions/track-real-estate-in-multiple-countries', '/guides/schedule-of-real-estate-owned-template', '/guides/rental-portfolio-ltv-calculator'] },
  { id: 'networth', name: 'Net worth without bank linking', pillar: '/solutions/net-worth-tracker-without-bank-linking', spokes: ['/compare/kubera-vs-owned-map', '/compare/monarch-vs-owned-map', '/compare/empower-vs-owned-map', '/compare/spreadsheet-vs-owned-map', '/compare/copilot-vs-owned-map', '/compare/projectionlab-vs-owned-map', '/compare/quicken-simplifi-vs-owned-map', '/compare/best-net-worth-trackers-for-real-assets'] },
  { id: 'vehicles', name: 'Vehicles, boats and collections', pillar: '/solutions/property-and-vehicle-records-app', spokes: ['/solutions/boat-ownership-tracker', '/solutions/classic-car-collection-tracker', '/solutions/aircraft-ownership-tracker', '/guides/boat-ownership-costs', '/solutions/luxury-asset-portfolio-tracker'] },
  { id: 'estate', name: 'Estate and family records', pillar: '/guides/estate-asset-inventory-template', spokes: ['/solutions/property-and-vehicle-records-app', '/guides/personal-net-worth-statement'] },
];

/** The pages `path` links to inside its groups, among the live ones, in a fixed order. */
export function groupLinks(path, live = SEO_MAP.map(e => e.path)) {
  const isLive = new Set(live), out = [];
  for (const cl of CLUSTERS) {
    if (cl.pillar === path) out.push(...cl.spokes.filter(p => isLive.has(p)));
    else if (cl.spokes.includes(path)) {
      if (isLive.has(cl.pillar)) out.push(cl.pillar);
      out.push(...cl.spokes.filter(p => p !== path && isLive.has(p)).slice(0, 2));
    }
  }
  return [...new Set(out)].filter(p => p !== path);
}
