import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPARISONS, PROOF, CTA } from '../content/compare.mjs';
import { SOLUTIONS } from '../content/solutions.mjs';
import { renderAll, compareUrls } from '../scripts/compare.mjs';
import { PLAN, priceCents, usd } from '../src/billing-core.js';

const text = c => [c.lead, ...c.sections.map(s => s.html), ...c.faq.flat()].join(' ').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');
const words = c => text(c).split(/\s+/).filter(Boolean).length;

test('every comparison has what search engines need and enough to say', () => {
  const slugs = COMPARISONS.map(c => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const c of COMPARISONS) {
    assert.match(c.slug, /^[a-z0-9-]+$/); assert.ok(c.title.length >= 30 && c.title.length <= 66, `title length ${c.title.length}`);
    assert.ok(c.description.length >= 110 && c.description.length <= 160, `description length ${c.description.length}`);
    assert.ok(words(c) >= 2300, `${c.slug} has ${words(c)} words`);
    assert.ok(c.faq.length >= 5 && c.sections.length >= 8);
    assert.deepEqual(c.toc.map(t => t[0]), c.sections.map(s => s.id), 'the table of contents matches the sections');
  }
});
test('the rendered pages are indexable, structured and carry the sticky call to the pricing section', () => {
  const pages = renderAll('https://ownedmap.com');
  assert.deepEqual(pages.map(p => p.path).sort(), ['/compare/', ...COMPARISONS.map(c => `/compare/${c.slug}`), ...SOLUTIONS.map(x => `/solutions/${x.slug}`)].sort());
  assert.equal(compareUrls().length, COMPARISONS.length + SOLUTIONS.length + 1);
  assert.equal(CTA.href, '/#pricing');
  for (const { path, html } of pages) {
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${path} has exactly one h1`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://ownedmap\\.com${path}"`));
    assert.doesNotMatch(html, /noindex/);
    assert.match(html, /class="cmp-side"/); assert.match(html, /class="cmp-bar"/); assert.match(html, /href="\/#pricing"/);
    for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(m[1].replaceAll('<\/', '</'));
  }
  const g = pages.find(p => p.path.endsWith('/kubera-vs-owned-map')).html;
  for (const t of ['FAQPage', 'BreadcrumbList', 'Article']) assert.match(g, new RegExp(`"@type":"${t}"`));
});
test('no invented social proof: nothing that looks like a rating or a customer count', () => {
  const pages = renderAll('https://ownedmap.com').map(p => p.html).join(' ');
  assert.doesNotMatch(pages, /\b\d(\.\d)?\s*\/\s*5\b|stars?\b|\bcustomers?\s+(trust|love)|[\d,]+\+? (customers|users|reviews)/i);
  for (const q of PROOF.quotes) assert.ok(q.quote && q.name, 'a quote names who said it');
});
test('the worked example adds up and the prices are the ones charged', () => {
  assert.equal(38400 - 9600, 28800); assert.equal((28800 / 520000 * 100).toFixed(1), '5.5'); assert.equal((28800 / 640000 * 100).toFixed(1), '4.5');
  assert.equal(640000 - 310000, 330000); assert.equal(((640000 - 520000) / 520000 * 100).toFixed(1), '23.1'); assert.equal(28800 - 1850 * 12, 6600); assert.equal(6600 / 12, 550);
  const html = renderAll('https://ownedmap.com').map(p => p.html).join(' ');
  for (const s of ['$28,800 a year', '5.5%', '4.5%', '$330,000', '23.1%', '$6,600 a year, $550 a month']) assert.ok(html.includes(s), s);
  for (const n of [3, 10, 25, 50]) { assert.ok(html.includes(usd(priceCents(n))) && html.includes(usd(priceCents(n, 'year'))), `price row for ${n}`); }
  assert.ok(html.includes(`${usd(PLAN.baseCents)} a month`));
});
test('the Monarch example adds up (house, boat, car) and quotes the prices charged', () => {
  assert.equal(42000 - 13500, 28500); assert.equal((28500 / 410000 * 100).toFixed(1), '7.0'); assert.equal((28500 / 485000 * 100).toFixed(1), '5.9');
  assert.equal(485000 - 265000, 220000); assert.equal(((485000 - 410000) / 410000 * 100).toFixed(1), '18.3'); assert.equal(28500 - 1650 * 12, 8700); assert.equal(8700 / 12, 725);
  assert.equal(((78000 - 62000) / 78000 * 100).toFixed(1), '20.5'); assert.equal((9400 / 62000 * 100).toFixed(1), '15.2'); assert.equal(((48000 - 31000) / 31000 * 100).toFixed(1), '54.8');
  assert.equal(485000 + 62000 + 48000, 595000); assert.equal(595000 - 265000, 330000); assert.equal(Math.round(485000 * 0.07 / 1000) * 1000, 34000);
  const html = renderAll('https://ownedmap.com').find(p => p.path.endsWith('/monarch-vs-owned-map')).html;
  for (const t of ['$28,500 a year', '7.0%', '5.9%', '$220,000', '18.3%', '$8,700 a year, $725 a month', '20.5%', '15.2%', '54.8%', '$595,000', '$330,000', '$14.99 a month or $99.99 a year', usd(priceCents(3, 'year'))]) assert.ok(html.includes(t), t);
  assert.ok(priceCents(3, 'year') / 9999 > 3.9 && priceCents(3, 'year') / 9999 < 4.0, 'about four times, as the page says');
});
test('the public URLs have no extension, and the build writes the files they are rewritten to', () => {
  for (const p of renderAll('https://ownedmap.com')) { assert.doesNotMatch(p.path, /\.html$/); assert.match(p.file, /^\/(compare|solutions)\/[a-z0-9-]+\.html$/); }
  for (const u of compareUrls()) assert.doesNotMatch(u, /\.html/);
  const html = renderAll('https://ownedmap.com').map(p => p.html).join(' ');
  assert.doesNotMatch(html, /href="\/(compare|solutions)\/[a-z0-9-]+\.html"/, 'internal links use the clean URL');
  assert.doesNotMatch(html, /https:\/\/ownedmap\.com\/(compare|solutions)\/[a-z0-9-]+\.html/, 'canonicals, og:url and structured data use the clean URL');
});
test('the Stessa and Empower examples add up, and the prices quoted are the ones charged', () => {
  // duplex (50%) and house
  assert.equal(54000 - 16800, 37200); assert.equal((37200 / 600000 * 100).toFixed(1), '6.2'); assert.equal((37200 / 720000 * 100).toFixed(1), '5.2'); assert.equal(((720000 - 600000) / 600000 * 100).toFixed(1), '20.0'); assert.equal(37200 - 2400 * 12, 8400);
  assert.equal((720000 - 380000) * 0.5, 170000); assert.equal(8400 / 2, 4200); assert.equal(4200 / 12, 350);
  assert.equal(26400 - 8100, 18300); assert.equal((18300 / 255000 * 100).toFixed(1), '7.2'); assert.equal((18300 / 310000 * 100).toFixed(1), '5.9'); assert.equal(310000 - 140000, 170000); assert.equal(18300 - 1100 * 12, 5100); assert.equal(5100 / 12, 425);
  assert.equal(720000 * 0.5 + 310000, 670000); assert.equal(380000 * 0.5 + 140000, 330000); assert.equal(670000 - 330000, 340000); assert.equal(4200 + 5100, 9300); assert.equal(9300 / 12, 775);
  assert.equal(28 * 12, 336); assert.ok(priceCents(3, 'year') > 33600);
  // cabin, aircraft share, truck
  assert.equal(23500 - 9100, 14400); assert.equal((14400 / 330000 * 100).toFixed(1), '4.4'); assert.equal((14400 / 395000 * 100).toFixed(1), '3.6'); assert.equal(395000 - 150000, 245000); assert.equal(((395000 - 330000) / 330000 * 100).toFixed(1), '19.7'); assert.equal(14400 - 1050 * 12, 1800); assert.equal(1800 / 12, 150);
  assert.equal(120000 * 0.25, 30000); assert.equal((18000 / 120000 * 100).toFixed(1), '15.0'); assert.equal(18000 * 0.25, 4500); assert.equal(((41000 - 27500) / 41000 * 100).toFixed(1), '32.9');
  assert.equal(395000 + 30000 + 27500, 452500); assert.equal(452500 - 150000, 302500);
  const pages = renderAll('https://ownedmap.com'), get = s => pages.find(p => p.path.endsWith(`/${s}`)).html;
  for (const t of ['$37,200 a year', '6.2%', '5.2%', '20.0%', '$170,000', '$350 a month', '$18,300 a year', '7.2%', '5.9%', '$5,100 a year, $425 a month', '$670,000', '$330,000', '$340,000', '$9,300 a year, $775 a month', '$336 a year', '$12 a month billed annually', '$28 a month billed annually']) assert.ok(get('stessa-vs-owned-map').includes(t), `stessa: ${t}`);
  for (const t of ['$14,400 a year', '4.4%', '3.6%', '$245,000', '19.7%', '$1,800 a year, $150 a month', '$30,000', '15.0%', '$4,500', '32.9%', '$452,500', '$150,000', '$302,500', '$250,000', '$1 million']) assert.ok(get('empower-vs-owned-map').includes(t), `empower: ${t}`);
});
