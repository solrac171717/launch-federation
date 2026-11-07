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
  assert.deepEqual(pages.map(p => p.path).sort(), ['/compare/', ...COMPARISONS.map(c => `/compare/${c.slug}`), ...SOLUTIONS.map(x => `/${x.dir || 'solutions'}/${x.slug}`)].sort());
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
  for (const p of renderAll('https://ownedmap.com')) { assert.doesNotMatch(p.path, /\.html$/); assert.match(p.file, /^\/(compare|solutions|guides)\/[a-z0-9-]+\.html$/); }
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
test('the Landlord Studio, Baselane and roundup numbers add up, and the prices quoted are the ones listed or charged', () => {
  const p = (value, cost, rent, exp, debt, pay) => { const noi = rent - exp; return { noi, gross: (rent / value * 100).toFixed(1), net: (noi / value * 100).toFixed(1), onCost: (noi / cost * 100).toFixed(1), cash: noi - pay * 12, equity: value - debt, ltv: (debt / value * 100).toFixed(1), payback: (cost / noi).toFixed(1), appr: ((value - cost) / cost * 100).toFixed(1) }; };
  assert.deepEqual(p(1150000, 890000, 108000, 41400, 620000, 4100), { noi: 66600, gross: '9.4', net: '5.8', onCost: '7.5', cash: 17400, equity: 530000, ltv: '53.9', payback: '13.4', appr: '29.2' });
  assert.deepEqual(p(620000, 505000, 57600, 22100, 350000, 2350), { noi: 35500, gross: '9.3', net: '5.7', onCost: '7.0', cash: 7300, equity: 270000, ltv: '56.5', payback: '14.2', appr: '22.8' });
  assert.deepEqual(p(395000, 330000, 31200, 10700, 225000, 1500), { noi: 20500, gross: '7.9', net: '5.2', onCost: '6.2', cash: 2500, equity: 170000, ltv: '57.0', payback: '16.1', appr: '19.7' });
  assert.equal(1150000 + 620000 + 395000, 2165000); assert.equal(620000 + 350000 + 225000, 1195000); assert.equal(2165000 - 1195000, 970000); assert.equal(17400 + 7300 + 2500, 27200); assert.equal(Math.round(27200 / 12), 2267); assert.equal(Math.round(7300 / 12), 608); assert.equal(Math.round(2500 / 12), 208);
  assert.equal((15 + 9 * 1.2).toFixed(2), '25.80');
  assert.deepEqual(p(780000, 650000, 72000, 19500, 410000, 2900), { noi: 52500, gross: '9.2', net: '6.7', onCost: '8.1', cash: 17700, equity: 370000, ltv: '52.6', payback: '12.4', appr: '20.0' });
  assert.deepEqual(p(350000, 280000, 28800, 9600, 190000, 1200), { noi: 19200, gross: '8.2', net: '5.5', onCost: '6.9', cash: 4800, equity: 160000, ltv: '54.3', payback: '14.6', appr: '25.0' });
  assert.equal(((118000 - 92000) / 118000 * 100).toFixed(1), '22.0'); assert.equal((11500 / 92000 * 100).toFixed(1), '12.5'); assert.equal(Math.round(11500 / 12), 958);
  assert.equal(780000 + 350000 * 0.5 + 92000, 1047000); assert.equal(410000 + 190000 * 0.5, 505000); assert.equal(1047000 - 505000, 542000); assert.equal(17700 + 4800 / 2, 20100); assert.equal(20100 / 12, 1675); assert.equal(20 * 12, 240);
  const pages = renderAll('https://ownedmap.com'), get = s => pages.find(q => q.path.endsWith(`/${s}`)).html;
  for (const x of ['$66,600 a year', '9.4%', '5.8%', '7.5%', '$17,400 a year, $1,450 a month', '53.9%', '13.4 years', '29.2%', '$35,500 a year', '$7,300 a year, $608 a month', '16.1 years', '$2,165,000', '$1,195,000', '$970,000', '$27,200 a year, $2,267 a month', '$25.80 a month', '$144 a year', '$336 a year', '$1.20']) assert.ok(get('landlord-studio-vs-owned-map').includes(x), `landlord: ${x}`);
  for (const x of ['$52,500 a year', '9.2%', '6.7%', '8.1%', '$17,700 a year, $1,475 a month', '52.6%', '12.4 years', '$2,400 a year, $200 a month', '$80,000', '54.3%', '14.6 years', '22.0%', '12.5%', '$958 a month', '$1,047,000', '$505,000', '$542,000', '$20,100 a year, $1,675 a month', '$24.99', '$20 a month', 'Thread Bank, Member FDIC']) assert.ok(get('baselane-vs-owned-map').includes(x), `baselane: ${x}`);
  const r = get('best-net-worth-trackers-for-real-assets');
  for (const x of ['$15.00 a month', '$23.40 a month', '$41.40 a month', usd(priceCents(3)), usd(priceCents(10)), usd(priceCents(25)), usd(priceCents(25, 'year')), '$2,500 a year', '$99.99']) assert.ok(r.includes(x), `roundup: ${x}`);
  assert.equal((15 + 7 * 1.2).toFixed(2), '23.40'); assert.equal((15 + 22 * 1.2).toFixed(2), '41.40');
  assert.ok(/we make Owned Map/i.test(r), 'the roundup says whose product Owned Map is');
});

test('the ProjectionLab, Simplifi, SREO, LTV and luxury examples add up, and the pages quote what they computed', () => {
  const p = (value, cost, rent, exp, debt, pay) => { const noi = rent - exp; return { noi, gross: (rent / value * 100).toFixed(1), net: (noi / value * 100).toFixed(1), onCost: (noi / cost * 100).toFixed(1), cash: noi - pay * 12, equity: value - debt, ltv: (debt / value * 100).toFixed(1), payback: (cost / noi).toFixed(1), appr: ((value - cost) / cost * 100).toFixed(1) }; };
  const pages = renderAll('https://ownedmap.com'), get = s => pages.find(q => q.path.endsWith(`/${s}`)).html;
  assert.deepEqual(p(420000, 350000, 30000, 10500, 250000, 1500), { noi: 19500, gross: '7.1', net: '4.6', onCost: '5.6', cash: 1500, equity: 170000, ltv: '59.5', payback: '17.9', appr: '20.0' });
  assert.equal((20000 / 70000 * 100).toFixed(1), '28.6'); assert.equal((1200 / 90000 * 100).toFixed(1), '1.3'); assert.equal((16000 / 80000 * 100).toFixed(1), '20.0'); assert.equal((6400 / 64000 * 100).toFixed(1), '10.0'); assert.equal(Math.round(6400 / 12), 533);
  assert.equal(420000 + 90000 + 64000, 574000); assert.equal(574000 - 250000, 324000); assert.equal(1500 - 1200 - 6400, -6100);
  for (const x of ['$19,500 a year', '7.1%', '4.6%', '5.6%', '$1,500 a year, $125 a month', '59.5%', '17.9 years', '28.6%', '$574,000', '$324,000', '$129 a year', '$549 a year']) assert.ok(get('projectionlab-vs-owned-map').includes(x), `projectionlab: ${x}`);
  assert.deepEqual(p(520000, 430000, 46800, 15300, 310000, 2100), { noi: 31500, gross: '9.0', net: '6.1', onCost: '7.3', cash: 6300, equity: 210000, ltv: '59.6', payback: '13.7', appr: '20.9' });
  assert.equal((22000 / 96000 * 100).toFixed(1), '22.9'); assert.equal((5400 / 118000 * 100).toFixed(1), '4.6'); assert.equal(210000 / 3, 70000); assert.equal(18000 / 3, 6000); assert.equal((6000 / 70000 * 100).toFixed(1), '8.6'); assert.equal((30000 / 240000 * 100).toFixed(1), '12.5');
  assert.equal(520000 + 118000 + 70000, 708000); assert.equal(708000 - 310000, 398000); assert.equal(6300 - 5400 - 6000, -5100); assert.equal(5400 + 6000, 11400);
  for (const x of ['$31,500 a year', '9.0%', '6.1%', '7.3%', '$6,300 a year, $525 a month', '59.6%', '13.7 years', '$708,000', '$398,000', '$3.99', '$6.99', 'Quicken Business']) assert.ok(get('quicken-simplifi-vs-owned-map').includes(x), `simplifi: ${x}`);
  // SREO example
  const loan = [[540000, 290000, 1980, 48000, 15600], [265000, 175000, 1150, 21000, 9800], [400000, 200000, 1350, 36000, 11500]];
  assert.deepEqual(loan.map(([v, d]) => (d / v * 100).toFixed(1)), ['53.7', '66.0', '50.0']); assert.deepEqual(loan.map(([, , pay, r, e]) => ((r - e) / (pay * 12)).toFixed(2)), ['1.36', '0.81', '1.51']);
  const tv = loan.reduce((n, l) => n + l[0], 0), td = loan.reduce((n, l) => n + l[1], 0), noi = loan.reduce((n, l) => n + l[3] - l[4], 0), ds = loan.reduce((n, l) => n + l[2] * 12, 0);
  assert.deepEqual([tv, td, tv - td, (td / tv * 100).toFixed(1), noi, ds, (noi / ds).toFixed(2)], [1205000, 665000, 540000, '55.2', 68100, 53760, '1.27']); assert.equal(540000 + 265000 + 160000, 965000); assert.equal(290000 + 175000 + 80000, 545000); assert.equal(965000 - 545000, 420000);
  for (const x of ['$1,205,000', '$665,000', '$540,000', '55.2%', '$68,100', '$53,760', '1.27', '$965,000', '$545,000', '$420,000', '1.36', '0.81', '1.51']) assert.ok(get('schedule-of-real-estate-owned-template').includes(x), `sreo: ${x}`);
  // LTV example
  const v4 = [540000, 265000, 400000, 85000], d4 = [290000, 175000, 200000, 0], sum = a => a.reduce((n, x) => n + x, 0);
  assert.equal((sum(d4) / sum(v4) * 100).toFixed(1), '51.6'); assert.equal((sum(v4.map((v, i) => d4[i] / v * 100)) / 4).toFixed(1), '42.4'); assert.equal((sum(v4.slice(0, 3).map((v, i) => d4[i] / v * 100)) / 3).toFixed(1), '56.6');
  assert.equal((250000 / (420000 * 0.93) * 100).toFixed(1), '64.0'); assert.equal((sum(d4) / (sum(v4) * 0.9) * 100).toFixed(1), '57.3'); assert.equal((175000 / (265000 * 0.9) * 100).toFixed(1), '73.4'); assert.equal(sum(v4) * 0.1, 129000); assert.equal(sum(v4) * 0.9 - sum(d4), 496000);
  assert.deepEqual(v4.map((v, i) => v * 0.6 - d4[i]), [34000, -16000, 40000, 51000]); assert.equal(sum(v4) * 0.6 - sum(d4), 109000);
  assert.equal((545000 / 1050000 * 100).toFixed(1), '51.9'); assert.equal(1050000 - 545000, 505000);
  for (const x of ['51.6%', '42.4%', '56.6%', '$1,290,000', '$625,000', '64.0%', '57.3%', '73.4%', '$1,161,000', '$496,000', '$109,000', '51.9%', '$505,000']) assert.ok(get('rental-portfolio-ltv-calculator').includes(x), `ltv: ${x}`);
  assert.match(get('rental-portfolio-ltv-calculator'), /id="ltv-calc"/);
  // luxury example
  const val = [725000, 423000, 380000, 130000, 220000], tot = sum(val);
  assert.equal(tot, 1878000); assert.equal(tot - 410000, 1468000); assert.equal(14000 + 12600 + 46000 + 9000 + 3400, 85000); assert.equal((85000 / tot * 100).toFixed(1), '4.5');
  assert.deepEqual([(380000 / tot * 100).toFixed(1), (46000 / 85000 * 100).toFixed(1), (46000 / 380000 * 100).toFixed(1), (70000 / 450000 * 100).toFixed(1), (20000 / 150000 * 100).toFixed(1), (9000 / 130000 * 100).toFixed(1), (93000 / 330000 * 100).toFixed(1), (12600 / 423000 * 100).toFixed(1), (40000 / 180000 * 100).toFixed(1), (3400 / 220000 * 100).toFixed(1), (725000 / tot * 100).toFixed(1), (200000 / 725000 * 100).toFixed(1)], ['20.2', '54.1', '12.1', '15.6', '13.3', '6.9', '28.2', '3.0', '22.2', '1.5', '38.6', '27.6']);
  for (const x of ['$1,878,000', '$410,000', '$1,468,000', '$85,000', '4.5%', '54.1%', '20.2%', '$340', '$870', '$1,100']) assert.ok(get('luxury-asset-portfolio-tracker').includes(x), `luxury: ${x}`);
  assert.doesNotMatch(get('luxury-asset-portfolio-tracker'), /connects? to your bank accounts? automatically|syncs? your accounts/i);
});
