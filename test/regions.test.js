import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegions, locate, buildTree, cityOf, inRing } from '../src/regions.js';
import { COUNTRIES, CITIES_LIST } from '../src/places.js';

const at = (id, place, lat, lon, value = 100) => ({ id, name: id, place, lat, lon, value, country: 'US' });

test('every country the app knows has region outlines, and every region has a valid shape', async () => {
  for (const cc of Object.keys(COUNTRIES)) {
    const regs = await loadRegions(cc);
    assert.ok(regs && regs.length >= 2, `${cc} has regions`);
    for (const r of regs) {
      assert.ok(r.n && r.r.length && r.r.every(ring => ring.length >= 8 && ring.length % 2 === 0), `${cc} ${r.n} has rings`);
      assert.ok(r.b[0] < r.b[2] && r.b[1] < r.b[3], `${cc} ${r.n} has a box`);
    }
  }
  assert.equal(await loadRegions('ZZ'), null); assert.equal(await loadRegions('../x'), null);
});

test('every built-in city lands in the region people expect', async () => {
  const want = { 'New York': 'New York', Austin: 'Texas', 'San Antonio': 'Texas', Houston: 'Texas', Miami: 'Florida', 'Los Angeles': 'California', London: 'Greater London', Barcelona: 'Cataluña', Madrid: 'Madrid', Paris: 'Île-de-France', Milan: 'Lombardia', Roma: 'Lazio' };
  let checked = 0;
  for (const [city, , cc, lat, lon] of CITIES_LIST) {
    const regs = await loadRegions(cc), k = locate(regs, lat, lon);
    if (['Honolulu', 'Anchorage'].includes(city)) { assert.equal(k, -1, `${city} is outside the mainland outline, so it is listed apart`); continue; }
    assert.ok(k >= 0, `${city} (${cc}) is placed in some region`); checked++;
    if (want[city]) assert.equal(regs[k].n, want[city], city);
  }
  assert.ok(checked > 80);
});

test('points: inside, on the coast (nearest outline), and far from everything', async () => {
  const us = await loadRegions('US');
  assert.equal(us[locate(us, 30.27, -97.74)].n, 'Texas');
  assert.equal(us[locate(us, 25.7617, -80.1918)].n, 'Florida');
  assert.equal(locate(us, 48.86, 2.35), -1, 'Paris is nowhere in the US');
  assert.equal(locate(us, NaN, 1), -1); assert.equal(locate(null, 1, 1), -1);
  const sq = [0, 0, 10, 0, 10, 10, 0, 10]; assert.equal(inRing(sq, 5, 5), true); assert.equal(inRing(sq, 11, 5), false);
});

test('the place label gives the city', () => {
  assert.equal(cityOf('Austin, TX'), 'Austin'); assert.equal(cityOf('12 Calle Mayor, Madrid, ES'), 'Madrid'); assert.equal(cityOf('Barcelona, ES'), 'Barcelona');
  assert.equal(cityOf('Hallstatt'), 'Hallstatt'); assert.equal(cityOf(''), 'Unknown'); assert.equal(cityOf(null), 'Unknown');
});

test('the tree: 4 in New York, 6 in Texas split over two cities, nothing lost, biggest first', async () => {
  const us = await loadRegions('US');
  const assets = [
    ...[1, 2, 3, 4].map(i => at(`ny${i}`, 'New York, NY', 40.71, -74.01, 500)),
    ...[1, 2, 3].map(i => at(`au${i}`, 'Austin, TX', 30.27, -97.74, 300)), ...[1, 2, 3].map(i => at(`sa${i}`, 'San Antonio, TX', 29.42, -98.49, 200)),
    at('sea', 'Seattle, WA', 47.61, -122.33, 50), at('nowhere', 'Paris, FR', 48.86, 2.35, 10),
  ];
  const t = buildTree(us, assets);
  const byName = Object.fromEntries(t.regions.map(r => [r.name, r]));
  assert.equal(byName['New York'].count, 4); assert.equal(byName.Texas.count, 6); assert.equal(byName.Washington.count, 1);
  assert.equal(t.regions[0].name, 'New York', 'sorted by value'); assert.equal(t.regions[0].value, 2000);
  assert.deepEqual(byName.Texas.cities.map(c => [c.name, c.count, c.value]), [['Austin', 3, 900], ['San Antonio', 3, 600]]);
  assert.ok(byName.Texas.cities[0].bbox[0] < -97.74 && byName.Texas.cities[0].bbox[2] > -97.74);
  assert.equal(t.regions.reduce((n, r) => n + r.count, 0) + t.loose.length, assets.length); assert.deepEqual(t.loose.map(a => a.id), ['nowhere']);
});

test('Spain is split into autonomous communities and the UK into regions', async () => {
  const es = await loadRegions('ES'), gb = await loadRegions('GB');
  const tes = buildTree(es, [at('f', 'Barcelona, ES', 41.39, 2.17), at('c1', 'Barcelona, ES', 41.39, 2.17), at('c2', 'Barcelona, ES', 41.39, 2.17), at('m', 'Madrid, ES', 40.42, -3.7)]);
  assert.deepEqual(tes.regions.map(r => [r.name, r.count]).sort(), [['Cataluña', 3], ['Madrid', 1]]);
  assert.equal(tes.regions.find(r => r.name === 'Cataluña').cities[0].name, 'Barcelona');
  assert.equal(buildTree(gb, [at('l', 'London, UK', 51.51, -0.13), at('l2', 'London, UK', 51.51, -0.13)]).regions[0].name, 'Greater London');
});
