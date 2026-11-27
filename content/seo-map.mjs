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
  { path: '/', type: 'home', primary: 'agencia seo ia', secondary: ['agencia de seo con ia', 'agencia aeo', 'agencia geo', 'agencia de seo para chatgpt'] },
  { path: '/activos', type: 'home', primary: 'track every asset you own', secondary: ['asset tracker', 'personal asset tracker', 'asset tracking app', 'real asset tracker'] },
  { path: '/privacy.html', type: 'legal' },
  { path: '/terms.html', type: 'legal' },
  { path: '/privacidad.html', type: 'legal' },
  { path: '/terminos.html', type: 'legal' },
];

/** Pages we intend to write, each with its own phrases. Empty: the old property comparison, guide and solution pages were removed (the agency is the focus). */
export const PLANNED = [];

/** The phrases a page claims: its primary first, then its secondaries. */
export const phrases = e => [e.primary, ...(e.secondary || [])].filter(Boolean);

export const CLUSTERS = [];
export function groupLinks() { return []; }
