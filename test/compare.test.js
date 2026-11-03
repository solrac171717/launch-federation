import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPARISONS, PROOF, CTA } from '../content/compare.mjs';
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
  assert.deepEqual(pages.map(p => p.path).sort(), ['/compare/', ...COMPARISONS.map(c => `/compare/${c.slug}`)].sort());
  assert.equal(compareUrls().length, COMPARISONS.length + 1);
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
  for (const p of renderAll('https://ownedmap.com')) { assert.doesNotMatch(p.path, /\.html$/); assert.match(p.file, /^\/compare\/[a-z0-9-]+\.html$/); }
  for (const u of compareUrls()) assert.doesNotMatch(u, /\.html/);
  const html = renderAll('https://ownedmap.com').map(p => p.html).join(' ');
  assert.doesNotMatch(html, /href="\/compare\/[a-z0-9-]+\.html"/, 'internal links use the clean URL');
  assert.doesNotMatch(html, /https:\/\/ownedmap\.com\/compare\/[a-z0-9-]+\.html/, 'canonicals, og:url and structured data use the clean URL');
});
