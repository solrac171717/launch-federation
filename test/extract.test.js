import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExtraction, EXTRACT_SCHEMA } from '../src/extract-core.js';
import { runExtract, allowed } from '../api/extract.js';
import { validateAsset } from '../src/asset-store.js';
import { checkExtractFile, mimeOf } from '../src/extract-client.js';

const deed = { documentKind: 'purchase_deed', assetType: 'house', name: 'Calle Mayor 12, 3B', addressLine: 'Calle Mayor 12, 3B', city: 'Madrid', region: 'Madrid', postalCode: '28013', countryCode: 'ES', currency: 'USD',
  purchasePrice: 450000, currentValue: null, outstandingDebt: 300000, monthlyDebtPayment: 1850.5, monthlyRent: null, acquiredOn: '2021-03-15', ownershipPercent: 50, ownerName: 'Ana Perez', details: 'Ref 1234', confidence: 'high' };

test('the schema asks for every field and nothing else', () => {
  assert.equal(EXTRACT_SCHEMA.additionalProperties, false);
  assert.deepEqual([...EXTRACT_SCHEMA.required].sort(), Object.keys(EXTRACT_SCHEMA.properties).sort());
});

test('a USD deed becomes form values, and those values pass the real asset validation', () => {
  const r = normalizeExtraction(deed, { lat: 40.41234567, lon: -3.70712345, countryCode: 'ES', precise: true });
  assert.equal(r.fields.type, 'house'); assert.equal(r.fields.cost, 450000); assert.equal(r.fields.value, 450000);
  assert.equal(r.fields.lat, '40.41235'); assert.equal(r.fields.country, 'ES'); assert.equal(r.fields.ownership, 50);
  assert.ok(r.notes.some(n => /set to the purchase price/.test(n)), 'tells the person the value is only the price');
  const v = validateAsset({ type: r.fields.type, name: r.fields.name, customPlace: true, placeName: r.fields.placeName, country: r.fields.country, lat: r.fields.lat, lon: r.fields.lon,
    value: r.fields.value, cost: r.fields.cost, debt: r.fields.debt, debtPayment: r.fields.debtPayment, ownership: r.fields.ownership, owner: r.fields.owner, acquiredOn: r.fields.acquiredOn, status: 'Held' });
  assert.equal(v.ok, true, JSON.stringify(v.errors));
});

test('a stated market value wins over the price; an imprecise pin or missing pin is flagged', () => {
  assert.equal(normalizeExtraction({ ...deed, currentValue: 520000 }, null).fields.value, 520000);
  assert.ok(normalizeExtraction(deed, { lat: 1, lon: 1, countryCode: 'ES', precise: false }).notes.some(n => /approximate/.test(n)));
  const none = normalizeExtraction(deed, null);
  assert.equal(none.fields.lat, undefined); assert.ok(none.notes.some(n => /could not find this address/.test(n)));
});

test('amounts in another currency are kept as written and the currency is set', () => {
  const r = normalizeExtraction({ ...deed, currency: 'EUR' }, null);
  assert.equal(r.fields.cost, 450000); assert.equal(r.fields.currency, 'EUR'); assert.equal(normalizeExtraction(deed, null).fields.currency, undefined);
  assert.ok(r.notes.some(n => /EUR/.test(n) && /converts/.test(n)));
});

test('garbage and unreadable documents fill nothing and warn', () => {
  const r = normalizeExtraction({ documentKind: 'other', assetType: 'spaceship', name: null, confidence: 'low', purchasePrice: -5, acquiredOn: '2999-01-01' }, null);
  assert.deepEqual(r.fields, {}); assert.ok(r.notes[0].includes('hard to read'));
  assert.deepEqual(normalizeExtraction(null).fields, {});
});

test('file checks in the browser', () => {
  assert.equal(mimeOf({ name: 'Deed.PDF' }), 'application/pdf'); assert.equal(mimeOf({ name: 'x.docx' }), '');
  assert.match(checkExtractFile({ name: 'a.docx', size: 10 }), /PDF or a photo/);
  assert.match(checkExtractFile({ name: 'a.pdf', size: 4 * 1024 * 1024 }), /over 3 MB/);
  assert.equal(checkExtractFile({ name: 'a.jpg', size: 4 * 1024 * 1024 }), null);
});

/* ---- the endpoint */
const pdf = Buffer.from('%PDF-1.4 fake').toString('base64');
const env = { ANTHROPIC_API_KEY: 'k', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', NOMINATIM_URL: 'https://geo.test' };
const answer = (obj, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text: JSON.stringify(obj) }] });
let uid = 0;
function fetchFor({ signedIn = true } = {}) {
  const calls = [];
  const f = async url => {
    calls.push(String(url));
    if (String(url).includes('/auth/v1/user')) return signedIn ? { ok: true, json: async () => ({ id: 'u-' + (++uid) }) } : { ok: false, status: 401, json: async () => ({}) };
    if (String(url).startsWith('https://geo.test/search')) return { ok: true, json: async () => [{ lat: '40.4', lon: '-3.7', category: 'building', address: { house_number: '12', country_code: 'es' } }] };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  f.calls = calls; return f;
}

test('/api/extract: needs sign-in, a real file of an allowed type, and the key being set', async () => {
  const body = { mime: 'application/pdf', data: pdf };
  const client = { messages: { create: async () => answer(deed) } };
  assert.equal((await runExtract({ env: { ...env, ANTHROPIC_API_KEY: '' }, fetchImpl: fetchFor(), client, token: 't', body })).status, 503);
  assert.equal((await runExtract({ env, fetchImpl: fetchFor(), client, token: '', body })).status, 401);
  assert.equal((await runExtract({ env, fetchImpl: fetchFor({ signedIn: false }), client, token: 'bad', body })).status, 401);
  assert.equal((await runExtract({ env, fetchImpl: fetchFor(), client, token: 't', body: { mime: 'text/html', data: pdf } })).status, 400);
  assert.equal((await runExtract({ env, fetchImpl: fetchFor(), client, token: 't', body: { mime: 'application/pdf', data: Buffer.from('<html>').toString('base64') } })).status, 400, 'content must match the type');
  assert.equal((await runExtract({ env, fetchImpl: fetchFor(), client, token: 't', body: { mime: 'application/pdf', data: Buffer.alloc(3.5 * 1024 * 1024, 1).toString('base64') } })).status, 413);
});

test('/api/extract: sends the document to the model and returns normalized values with a map pin', async () => {
  let sent;
  const client = { messages: { create: async p => { sent = p; return answer(deed); } } };
  const f = fetchFor();
  const r = await runExtract({ env, fetchImpl: f, client, token: 't', body: { mime: 'application/pdf', data: pdf } });
  assert.equal(r.status, 200); assert.equal(r.body.fields.cost, 450000); assert.equal(r.body.fields.lat, '40.4');
  assert.equal(sent.model, 'claude-opus-5-5'); assert.equal(sent.messages[0].content[0].type, 'document');
  assert.equal(sent.output_config.format.type, 'json_schema'); assert.equal(sent.tool_choice, undefined);
  assert.ok(f.calls.some(u => u.includes('geo.test') && u.includes('Calle%20Mayor')), 'address was looked up');
});

test('/api/extract: refusals, model errors and broken answers give safe messages', async () => {
  const run = client => runExtract({ env, fetchImpl: fetchFor(), client, token: 't', body: { mime: 'image/png', data: Buffer.from([0x89, 0x50, 1, 2]).toString('base64') } });
  assert.equal((await run({ messages: { create: async () => answer({}, 'refusal') } })).status, 422);
  assert.equal((await run({ messages: { create: async () => { throw Object.assign(new Error('boom'), { status: 500 }); } } })).status, 502);
  assert.equal((await run({ messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }) } })).status, 502);
});

test('/api/extract: a user is limited to 30 documents an hour', () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 30; i++) assert.equal(allowed('rate-user', t0 + i), true);
  assert.equal(allowed('rate-user', t0 + 40), false);
  assert.equal(allowed('rate-user', t0 + 3600_001 + 30), true);
});
