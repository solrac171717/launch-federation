import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOLUTIONS } from '../content/solutions.mjs';
import { renderAll } from '../scripts/compare.mjs';
import { PLAN, priceCents, usd } from '../src/billing-core.js';

const text = c => [c.lead, ...c.sections.map(s => s.html), ...c.faq.flat()].join(' ').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');
const words = c => text(c).split(/\s+/).filter(Boolean).length;
const by = slug => SOLUTIONS.find(s => s.slug === slug);
const html = slug => renderAll('https://ownedmap.com').find(p => p.path.endsWith(`/${slug}`)).html;

test('every solution page is substantial: 2,500+ words, six sources, a table of contents that matches, a title and description of the right length', () => {
  for (const s of SOLUTIONS) {
    assert.ok(words(s) >= 2500, `${s.slug} has ${words(s)} words`); assert.ok(s.sources.length >= 6, `${s.slug} has ${s.sources.length} sources`);
    assert.deepEqual(s.toc.map(t => t[0]), s.sections.map(x => x.id)); assert.ok(s.faq.length >= 6);
    assert.ok(s.title.length >= 30 && s.title.length <= 66, `title ${s.title.length}`); assert.ok(s.description.length >= 110 && s.description.length <= 160, `description ${s.description.length}`);
    assert.ok(s.lead.toLowerCase().slice(0, 120).includes(s.primary), 'the lead opens with the phrase the page owns');
  }
});

test('the rental portfolio example adds up', () => {
  const p = (value, cost, rent, exp, debt, pay) => { const noi = rent - exp; return { noi, gross: (rent / value * 100).toFixed(1), net: (noi / value * 100).toFixed(1), onCost: (noi / cost * 100).toFixed(1), cash: noi - pay * 12, equity: value - debt, ltv: (debt / value * 100).toFixed(1), payback: (cost / noi).toFixed(1), appr: ((value - cost) / cost * 100).toFixed(1) }; };
  assert.deepEqual(p(540000, 430000, 48000, 15600, 290000, 1980), { noi: 32400, gross: '8.9', net: '6.0', onCost: '7.5', cash: 8640, equity: 250000, ltv: '53.7', payback: '13.3', appr: '25.6' });
  assert.deepEqual(p(265000, 240000, 21000, 9800, 175000, 1150), { noi: 11200, gross: '7.9', net: '4.2', onCost: '4.7', cash: -2600, equity: 90000, ltv: '66.0', payback: '21.4', appr: '10.4' });
  assert.deepEqual(p(400000, 320000, 36000, 11500, 200000, 1350), { noi: 24500, gross: '9.0', net: '6.1', onCost: '7.7', cash: 8300, equity: 200000, ltv: '50.0', payback: '13.1', appr: '25.0' });
  assert.equal(Math.round(-2600 / 12), -217); assert.equal(Math.round(8300 * 0.4 / 12), 277); assert.equal(8300 * 0.4, 3320); assert.equal((1900 / 85000 * 100).toFixed(1), '2.2'); assert.equal(((85000 - 60000) / 60000 * 100).toFixed(1), '41.7');
  assert.equal(540000 + 265000 + 400000 * 0.4 + 85000, 1050000); assert.equal(290000 + 175000 + 200000 * 0.4, 545000); assert.equal(1050000 - 545000, 505000); assert.equal(8640 - 2600 + 3320, 9360); assert.equal(9360 / 12, 780);
  assert.equal((540000 / 1050000 * 100).toFixed(1), '51.4'); assert.equal(Math.round(540000 * 0.07 / 1000) * 1000, 38000);
  const costs = 265000 * 0.05, gain = 265000 - costs - 240000, tax = gain * 0.2; assert.equal(costs, 13250); assert.equal(gain, 11750); assert.equal(tax, 2350); assert.equal(265000 - costs - tax - 175000, 74400); assert.equal(90000 - 74400, 15600); assert.equal(costs + tax, 15600);
  const h = html('rental-property-portfolio-tracker');
  for (const t of ['$32,400 a year', '8.9%', '6.0%', '7.5%', '$8,640 a year, $720 a month', '53.7%', '13.3 years', '25.6%', '$11,200 a year', '4.2%', '4.7%', '21.4 years', '66.0%', '10.4%', '$24,500 a year', '9.0%', '6.1%', '7.7%', '$3,320', '$277 a month', '13.1 years', '25.0%', '$1,050,000', '$545,000', '$505,000', '$9,360 a year, $780 a month', '51.4%', '$74,400', '$15,600', '41.7%', '2.2%']) assert.ok(h.includes(t), t);
});

test('the net worth example adds up, and the page is honest about what Owned Map does not track', () => {
  const now = 480000 + 34000 + 58000 + 120000 * 0.5, then = 455000 + 41000 + 64000 + 110000 * 0.5;
  assert.equal(now, 632000); assert.equal(then, 615000); assert.equal(300000 + 14000, 314000); assert.equal(312000 + 21500, 333500);
  assert.equal(now - 314000, 318000); assert.equal(then - 333500, 281500); assert.equal(318000 - 281500, 36500); assert.equal(((318000 - 281500) / 281500 * 100).toFixed(1), '13.0');
  assert.equal(25000 + 5000 - 7000 - 6000, 17000); assert.equal(333500 - 314000, 19500); assert.equal(17000 + 19500, 36500); assert.equal((19500 / 36500 * 100).toFixed(1), '53.4');
  const h = html('net-worth-tracker-without-bank-linking');
  for (const t of ['$632,000', '$615,000', '$314,000', '$333,500', '$318,000', '$281,500', '$36,500', '13.0%', '53.4%', '$19,500']) assert.ok(h.includes(t), t);
  assert.match(h, /does not have bank, brokerage, retirement or crypto accounts as asset types/);
});

test('the prices quoted are the ones charged, and no page claims what the product does not do', () => {
  for (const s of SOLUTIONS) {
    const h = html(s.slug);
    assert.ok(h.includes(`${usd(PLAN.baseCents)} a month includes ${PLAN.included} assets`)); assert.ok(h.includes(usd(priceCents(25, 'year'))) && h.includes(usd(priceCents(10))));
    assert.doesNotMatch(h, /connects? to your bank accounts? automatically|syncs? your accounts|collects? rent for you/i);
  }
  assert.ok(by('rental-property-portfolio-tracker').takeaways.some(t => /does not do bookkeeping, rent collection or tax forms/.test(t)));
});
