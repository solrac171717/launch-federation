import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES } from '../content/guides.mjs';
import { renderAll, guideUrls } from '../scripts/guides.mjs';
import { PLAN, priceCents, extraText, usd } from '../src/billing-core.js';

const text = g => [g.lead, ...g.sections.map(s => s.html), ...g.faq.flat()].join(' ');
const all = GUIDES.map(text).join(' ');

test('every guide has what search engines need: its own slug, title, description, one purpose and real related pages', () => {
  const slugs = GUIDES.map(g => g.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slugs are unique'); assert.equal(new Set(GUIDES.map(g => g.title)).size, GUIDES.length);
  for (const g of GUIDES) {
    assert.match(g.slug, /^[a-z0-9-]+$/); assert.ok(g.title.length >= 30 && g.title.length <= 66, `title length of ${g.slug}: ${g.title.length}`);
    assert.ok(g.description.length >= 110 && g.description.length <= 160, `description length of ${g.slug}: ${g.description.length}`);
    assert.ok(g.sections.length >= 5 && g.faq.length >= 3, `${g.slug} is a substantial page`); assert.ok(g.crumb);
    for (const r of g.related) assert.ok(slugs.includes(r) && r !== g.slug, `${g.slug} links to a real, different guide: ${r}`);
    assert.ok(text(g).split(/\s+/).length >= 450, `${g.slug} has enough to say`);
  }
});
test('the rendered pages are complete, indexable and structured', () => {
  const pages = renderAll('https://ownedmap.com');
  assert.deepEqual(pages.map(p => p.path).sort(), ['/guides/index.html', ...GUIDES.map(g => `/guides/${g.slug}.html`)].sort());
  assert.equal(guideUrls().length, GUIDES.length + 1);
  for (const { path, html } of pages) {
    assert.match(html, /<title>[^<]{20,}<\/title>/); assert.match(html, /<meta name="description" content="[^"]{80,}"/); assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${path} has exactly one h1`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://ownedmap\.com${path === '/guides/index.html' ? '/guides/' : path}"`));
    assert.doesNotMatch(html, /noindex/); assert.match(html, /\/api\/start/, 'a way to start on every page');
    for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(m[1].replaceAll('<\/', '</'));
  }
  const g = pages.find(p => p.path.endsWith('track-rental-properties.html')).html;
  assert.match(g, /"@type":"FAQPage"/); assert.match(g, /"@type":"BreadcrumbList"/); assert.match(g, /"@type":"Article"/);
});
test('the numbers in the worked examples add up', () => {
  // rental condo
  assert.equal(38400 - 9600, 28800); assert.equal((28800 / 520000 * 100).toFixed(1), '5.5'); assert.equal((28800 / 640000 * 100).toFixed(1), '4.5');
  assert.equal(640000 - 310000, 330000); assert.equal(((640000 - 520000) / 520000 * 100).toFixed(1), '23.1'); assert.equal(28800 - 1850 * 12, 6600); assert.equal(6600 / 12, 550);
  assert.equal(330000 / 2, 165000); assert.equal(6600 / 2, 3300);
  // running costs as a share of value
  assert.equal((2100 / 34000 * 100).toFixed(1), '6.2'); assert.equal((11800 / 285000 * 100).toFixed(1), '4.1');
  // net worth with a shared condo, a car and a boat
  assert.equal(640000 * 0.5 + 34000 + 285000, 639000); assert.equal(310000 * 0.5 + 0 + 60000, 215000); assert.equal(639000 - 215000, 424000);
  for (const s of ['$28,800 a year', '5.5%', '4.5%', '$330,000', '23.1%', '$6,600 a year, $550 a month', '$165,000', '$3,300', '6.2%', '4.1%', '$639,000', '$215,000', '$424,000']) assert.ok(all.includes(s), `a guide shows ${s}`);
});
test('prices quoted in the guides are the ones that are charged', () => {
  assert.ok(all.includes(`${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets`));
  assert.ok(all.includes('$15 each for assets 4 to 10, $10 each for 11 to 25 and $5 each from the 26th'), 'the bands, as the guide words them');
  assert.ok(extraText().includes('$15') && extraText().includes('$10') && extraText().includes('$5'));
  assert.ok(all.includes(`25 assets cost ${usd(priceCents(25))} a month, or ${usd(priceCents(25, 'year'))} a year paid yearly`), 'the 25-asset example matches the plan');
  assert.ok(all.includes(`${Math.round(PLAN.yearlyOff * 100)}% less`), 'the yearly discount');
  assert.ok(!/launchfederation/.test(all));
});
