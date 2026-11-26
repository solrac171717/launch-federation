import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, toRow, fromDb, toView, nextHistory, stats, funnel, allowanceFor, quotaState, createLocalStore, createCloudStore, toCsvRows, HIGH_SCORE } from '../src/leads-core.js';
import { plain, hitToCandidate, buscarSeñales, aboutOf } from '../src/sources/hn.js';
import { cityMatch, isPrivateAddress, fetchPage, pageText, applyScores, normalizeProfile, geocodePlace, locateLeads } from '../src/leads-engine.js';
import { runAnalyze } from '../api/analyze.js';
import { runSignals, cleanProfile } from '../api/signals.js';
import { runIngest } from '../api/ingest.js';

const good = { source: 'hn', externalId: '123', score: 82, intent: 'alternative', text: 'Looking for an alternative to Notion for our team wiki', url: 'https://news.ycombinator.com/item?id=123', authorName: 'ada' };
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const json = (body, init = {}) => ({ ok: init.ok ?? true, status: init.status ?? 200, headers: new Headers(init.headers || { 'content-type': 'application/json' }), json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

test('a lead is validated: source, text, id, score, link and coordinates', () => {
  const r = validateLead(good, { now: Date.parse('2026-11-26T10:00:00Z') });
  assert.ok(r.ok); assert.equal(r.value.signalAt, '2026-11-26T10:00:00.000Z'); assert.equal(r.value.status, 'new'); assert.equal(r.value.lat, null);
  assert.equal(validateLead({ ...good, source: 'x' }).errors.source, 'Unknown source.');
  assert.ok(validateLead({ ...good, text: '  ' }).errors.text);
  assert.ok(validateLead({ ...good, score: 101 }).errors.score); assert.ok(validateLead({ ...good, score: 'abc' }).errors.score);
  assert.ok(validateLead({ ...good, url: 'javascript:alert(1)' }).errors.url);
  assert.ok(validateLead({ ...good, lat: 40 }).errors.lat); assert.ok(validateLead({ ...good, lat: 99, lon: 0 }).errors.lat);
  assert.ok(validateLead({ ...good, country: 'USA' }).errors.country);
  assert.equal(validateLead({ ...good, intent: 'nonsense' }).value.intent, 'problem');
  assert.equal(validateLead({ ...good, text: 'x'.repeat(5000) }).value.text.length, 1500);
});

test('database rows and the view the globe reads', () => {
  const v = validateLead({ ...good, lat: 30.27, lon: -97.74, country: 'US', place: 'Austin, TX', draft: 'Hi\nthere' }).value;
  const row = toRow(v); assert.equal(row.external_id, '123'); assert.equal(row.signal_text, v.text); assert.equal(row.draft, 'Hi\nthere');
  const back = fromDb({ ...row, id: 'a', history: [], is_sample: false, created_at: '2026-11-26T00:00:00Z' });
  assert.equal(back.externalId, '123'); assert.equal(back.lat, 30.27);
  const view = toView(back); assert.equal(view.located, true); assert.equal(view.category, 'hn'); assert.equal(view.tier, 'high'); assert.equal(view.name, 'ada');
  assert.equal(toView({ ...back, country: 'ZZ' }).located, false, 'a country the map has no outline for stays in the list');
  assert.equal(toView({ ...back, lat: null, lon: null }).located, false);
  assert.equal(toView({ ...back, score: 55 }).tier, 'mid'); assert.equal(toView({ ...back, score: 10 }).tier, 'low');
});

test('statistics, the funnel and the monthly allowance', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  const L = [
    { score: 90, status: 'customer', lat: 1, lon: 1, source: 'hn', createdAt: '2026-11-02T00:00:00Z' },
    { score: 75, status: 'replied', lat: null, lon: null, source: 'linkedin', createdAt: '2026-11-10T00:00:00Z' },
    { score: 71, status: 'contacted', lat: 2, lon: 2, source: 'hn', createdAt: '2026-10-30T00:00:00Z' },
    { score: 40, status: 'new', lat: null, lon: null, source: 'hn', createdAt: '2026-11-11T00:00:00Z' },
  ];
  const s = stats(L, now);
  assert.deepEqual([s.total, s.high, s.located, s.avgScore, s.highThisMonth], [4, 3, 2, 69, 2]);
  assert.deepEqual(s.bySource, { hn: 3, linkedin: 1 });
  assert.deepEqual(funnel(L), [['Detected', 4], ['Contacted', 3], ['Replied', 2], ['Customers', 1]]);
  assert.equal(allowanceFor(3), 75); assert.equal(allowanceFor('x'), 0);
  assert.deepEqual(quotaState(L, 3, now), { used: 2, allowed: 75, left: 73, over: false });
  assert.equal(quotaState(L, 0, now).over, true);
  assert.equal(HIGH_SCORE, 70);
  assert.deepEqual(nextHistory([{ d: 'a', e: 'found' }], 'contacted', { today: '2026-11-26' }), [{ d: 'a', e: 'found' }, { d: '2026-11-26', e: 'contacted' }]);
  assert.equal(toCsvRows([{ authorName: 'ada', source: 'hn', intent: 'pricing', score: 80, status: 'new', text: 't', url: 'u', place: '', signalAt: '2026-11-01T00:00:00Z', draft: 'd' }])[0].length, 12);
});

test('the device store keeps leads, skips repeats and removes the sample', async () => {
  const st = createLocalStore(memory());
  const a = validateLead(good).value, b = validateLead({ ...good, externalId: '124' }).value;
  assert.equal((await st.addMany([a, b])).length, 2);
  assert.equal((await st.addMany([a])).length, 0, 'same source and id is the same signal');
  const [first] = await st.list();
  assert.equal((await st.update(first.id, { status: 'contacted' })).status, 'contacted');
  await assert.rejects(() => st.update('nope', {}), /no longer exists/);
  await st.addMany([validateLead({ ...good, externalId: '999' }).value], { sample: true });
  await st.removeSample(); assert.equal((await st.list()).length, 2);
  await st.remove(first.id); assert.equal((await st.list()).length, 1);
});

test('the cloud store talks to the leads table and ignores duplicates', async () => {
  const calls = [], cloud = { rest: async (...a) => { calls.push(a); return []; } };
  const st = createCloudStore(cloud, { owner: 'u1' });
  await st.list(); assert.match(calls[0][1], /^\/leads\?user_id=eq\.u1&select=\*&order=signal_at\.desc/);
  await st.addMany([validateLead(good).value]);
  assert.match(calls[1][1], /on_conflict=user_id,source,external_id/); assert.match(calls[1][3].prefer, /ignore-duplicates/); assert.equal(calls[1][2][0].user_id, 'u1'); assert.equal(calls[1][2][0].is_sample, false);
  assert.equal((await st.addMany([])).length, 0);
  await assert.rejects(() => st.update('x', { status: 'customer' }), /no longer exists/);
  assert.deepEqual(Object.keys(calls.at(-1)[2]).sort(), ['status', 'updated_at']);
});

test('Hacker News text and hits become candidates', async () => {
  assert.equal(plain('<p>Hi &amp; bye<p>See <a href="x">here</a> &#x27;ok&#x27; &#8217;'), 'Hi & bye\nSee here \'ok\' ’');
  assert.equal(hitToCandidate({ objectID: '1', author: 'a', comment_text: 'short' }), null);
  assert.equal(hitToCandidate({ objectID: '1', comment_text: 'x'.repeat(60) }), null, 'no author, no lead');
  const c = hitToCandidate({ objectID: '42', author: 'bob', comment_text: '<p>We are looking for a better way to track invoices, any tips?', story_title: 'Ask HN: invoices', created_at: '2026-11-20T10:00:00Z' });
  assert.equal(c.url, 'https://news.ycombinator.com/item?id=42'); assert.match(c.text, /in the thread: Ask HN: invoices/); assert.equal(c.source, 'hn');
  const urls = [], fake = async u => { urls.push(u); return json({ hits: [{ objectID: String(urls.length), author: 'a', comment_text: 'x'.repeat(40) + urls.length, created_at: `2026-11-${10 + urls.length}T00:00:00Z` }, { objectID: 'dup', author: 'a', comment_text: 'y'.repeat(40), created_at: '2026-11-01T00:00:00Z' }] }); };
  const out = await buscarSeñales(['alternative to notion', 'alternative to notion', 'recommend a wiki'], { fetchImpl: fake, now: Date.parse('2026-11-26T00:00:00Z') });
  assert.equal(urls.length, 2, 'the same phrase is searched once'); assert.match(urls[0], /query=alternative%20to%20notion/); assert.match(urls[0], /numericFilters=created_at_i>/);
  assert.equal(out.length, 3, 'a hit found by two phrases appears once'); assert.ok(Date.parse(out[0].signalAt) >= Date.parse(out[1].signalAt));
  assert.deepEqual(await buscarSeñales(['q'], { fetchImpl: async () => { throw new Error('down'); } }), []);
  assert.deepEqual(await aboutOf(['a', 'b'], { fetchImpl: async u => (u.includes('/a.') ? json({ about: 'Founder, based in <i>Berlin</i>' }) : json(null, { ok: false, status: 404 })) }), { a: 'Founder, based in Berlin' });
});

test('places written by people are matched to cities, or left unplaced', () => {
  assert.deepEqual(cityMatch('Austin, TX'), { place: 'Austin, TX', country: 'US', lat: 30.27, lon: -97.74 });
  assert.equal(cityMatch('Greater London Area').country, 'GB'); assert.equal(cityMatch('Lisboa Lisbon, Portugal', 'PT').place, 'Lisbon, PT');
  assert.equal(cityMatch('Málaga').country, 'ES'); assert.equal(cityMatch('Remote'), null); assert.equal(cityMatch(''), null);
  assert.equal(cityMatch('Portland', 'GB'), null, 'a wrong country is not forced onto a city');
});

test('the geocoder asks a free service only when the built-in cities do not know the place, and remembers the answer', async () => {
  let n = 0; const fake = async () => { n++; return json([{ lat: '47.37', lon: '8.54', address: { country_code: 'ch' } }]); };
  assert.equal((await geocodePlace({ place: 'Austin, TX', fetchImpl: fake })).country, 'US'); assert.equal(n, 0);
  const z = await geocodePlace({ place: 'Winterthur', fetchImpl: fake }); assert.deepEqual([z.country, z.lat], ['CH', 47.37]); assert.equal(n, 1);
  await geocodePlace({ place: 'Winterthur', fetchImpl: fake }); assert.equal(n, 1);
  assert.equal(await geocodePlace({ place: 'Nowhereville', fetchImpl: async () => json([]) }), null);
  const leads = [{ place: 'Berlin', country: 'DE', lat: null }, { place: 'Remote', lat: null }, { place: '', lat: null }];
  await locateLeads(leads, { fetchImpl: async () => json([]) }); assert.equal(leads[0].lat, 52.52); assert.equal(leads[1].lat, null);
});

test('the page reader never reaches private addresses, even through a redirect', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', 'garbage']) assert.ok(isPrivateAddress(ip), ip);
  for (const ip of ['8.8.8.8', '151.101.1.1', '2606:4700::1111']) assert.ok(!isPrivateAddress(ip), ip);
  const page = { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<title>Acme</title><body>We sell anvils</body>' };
  assert.match(await fetchPage('acme.com', { fetchImpl: async () => page, lookup: async () => ['93.184.216.34'] }), /anvils/);
  await assert.rejects(() => fetchPage('http://intranet.local', { fetchImpl: async () => page, lookup: async () => ['10.0.0.5'] }), /bad_url/);
  await assert.rejects(() => fetchPage('http://169.254.169.254/latest', { fetchImpl: async () => page, lookup: async () => [] }), /bad_url/);
  await assert.rejects(() => fetchPage('file:///etc/passwd', { fetchImpl: async () => page, lookup: async () => ['8.8.8.8'] }), /bad_url/);
  await assert.rejects(() => fetchPage('https://user:pw@acme.com', { fetchImpl: async () => page, lookup: async () => ['8.8.8.8'] }), /bad_url/);
  await assert.rejects(() => fetchPage('https://acme.com:8080', { fetchImpl: async () => page, lookup: async () => ['8.8.8.8'] }), /bad_url/);
  const redirect = { ok: false, status: 302, headers: new Headers({ location: 'http://internal.example/admin' }) };
  await assert.rejects(() => fetchPage('https://acme.com', { fetchImpl: async () => redirect, lookup: async h => (h === 'acme.com' ? ['8.8.8.8'] : ['10.0.0.1']) }), /bad_url/);
  await assert.rejects(() => fetchPage('https://acme.com', { fetchImpl: async () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/pdf' }), text: async () => '' }), lookup: async () => ['8.8.8.8'] }), /not_a_page/);
  assert.equal(pageText('<title>Acme</title><meta name="description" content="Anvils for everyone"><script>evil()</script><style>x{}</style><p>Fast &amp; strong</p>').split('\n')[0], 'Acme');
  assert.ok(!pageText('<script>evil()</script><p>ok</p>').includes('evil')); assert.match(pageText('<p>Fast &amp; strong</p>'), /Fast & strong/);
});

test('the model answer is joined back to the posts it scored, and bad rows are dropped', () => {
  const cands = [{ source: 'hn', externalId: 'a', authorName: 'ann', text: 'Need a tool to track invoices, what do you use?' }, { source: 'hn', externalId: 'b', authorName: 'bo', text: 'Great weather today in the city, folks' }];
  const out = applyScores({ items: [{ id: '1', score: 91.4, intent: 'recommendation', role: 'CFO', company: 'Acme', place: 'Austin, TX', country: 'us', draft: 'Try X.' }, { id: '9', score: 50, intent: 'pricing', role: '', company: '', place: '', country: '', draft: '' }, { id: '2', score: 500, intent: 'nonsense', role: '', company: '', place: '', country: 'ZZZ', draft: '' }] }, cands);
  assert.equal(out.length, 2, 'an id the posts do not have is ignored');
  assert.deepEqual([out[0].score, out[0].authorRole, out[0].authorCompany, out[0].country, out[0].draft], [91, 'CFO', 'Acme', 'US', 'Try X.']);
  assert.deepEqual([out[1].score, out[1].intent, out[1].country], [100, 'problem', null]);
  const p = normalizeProfile({ name: ' Acme ', niche: 'n', audience: 'a', problem: 'p', tone: 't', competitors: ['A', 'A', ''], queries: ['alternative to a', 'x', 'this phrase has far too many words in it'] }, { url: 'acme.com' });
  assert.deepEqual([p.name, p.competitors, p.queries], ['Acme', ['A'], ['alternative to a']]);
  assert.equal(cleanProfile({ queries: Array(20).fill('a b') }).queries.length, 8);
});

// a pretend Supabase + OpenAI + Hacker News, so the endpoints run end to end
function world({ signedIn = true, model } = {}) {
  const log = [];
  const fetchImpl = async (url, init = {}) => {
    const u = String(url); log.push([init.method || 'GET', u]);
    if (u.includes('/auth/v1/user')) return signedIn ? json({ id: 'u1', email: 'a@b.co' }) : json({}, { ok: false, status: 401 });
    if (u.includes('hn.algolia.com')) return json({ hits: [{ objectID: '77', author: 'carol', comment_text: 'We need an alternative to our CRM, anything simple for a 5 person team?', created_at: '2026-11-25T09:00:00Z' }, { objectID: '78', author: 'dan', comment_text: 'The weather in Lisbon is lovely this week, going for a walk', created_at: '2026-11-25T10:00:00Z' }] });
    if (u.includes('hacker-news.firebaseio.com')) return json(u.includes('carol') ? { about: 'Ops lead at Acme, Austin TX' } : null);
    if (u.includes('/v1/chat/completions')) return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(model ? model(JSON.parse(init.body)) : { items: [{ id: '1', score: 88, intent: 'alternative', role: 'Ops lead', company: 'Acme', place: 'Austin, TX', country: 'US', draft: 'Happy to help.' }, { id: '2', score: 5, intent: 'problem', role: '', company: '', place: '', country: '', draft: '' }] }) } }] });
    throw new Error(`unexpected ${u}`);
  };
  return { fetchImpl, log };
}
const env = { OPENAI_API_KEY: 'k', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
const profile = { name: 'Acme CRM', niche: 'CRM for small teams', audience: 'teams of 2 to 20', problem: 'messy customer data', tone: 'friendly', competitors: ['Salesforce'], queries: ['alternative to salesforce', 'simple crm'] };

test('analyze: reads a page, answers a profile, and refuses what it must', async () => {
  const w = world({ model: () => ({ name: 'Acme', niche: 'CRM', audience: 'small teams', problem: 'messy data', tone: 'friendly', competitors: ['Salesforce'], queries: ['alternative to salesforce', 'simple crm for startups', 'x'] }) });
  const page = { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), text: async () => `<title>Acme CRM</title><p>${'We help small teams keep customer data tidy. '.repeat(5)}</p>` };
  const fetchImpl = async (u, i) => (String(u).startsWith('https://acme.com') ? page : w.fetchImpl(u, i));
  const ok = await runAnalyze({ env, fetchImpl, lookupImpl: async () => ['93.184.216.34'], token: 't', body: { url: 'acme.com' } });
  assert.equal(ok.status, 200); assert.deepEqual(ok.body.profile.queries, ['alternative to salesforce', 'simple crm for startups']); assert.equal(ok.body.profile.url, 'acme.com');
  assert.equal((await runAnalyze({ env, fetchImpl: world({ signedIn: false }).fetchImpl, token: 't', body: { text: 'x'.repeat(80) } })).status, 401);
  assert.equal((await runAnalyze({ env: {}, fetchImpl, token: 't', body: {} })).status, 503);
  assert.equal((await runAnalyze({ env, fetchImpl: w.fetchImpl, token: 't', body: { text: 'tiny' } })).status, 400);
  const blocked = await runAnalyze({ env, fetchImpl: w.fetchImpl, lookupImpl: async () => ['10.0.0.1'], token: 't', body: { url: 'http://corp.internal' } });
  assert.equal(blocked.status, 422); assert.ok(!w.log.some(([, u]) => u.includes('corp.internal')), 'a private address is never requested');
  const typed = await runAnalyze({ env, fetchImpl, lookupImpl: async () => ['10.0.0.1'], token: 't', body: { url: 'http://corp.internal', text: 'We sell a simple CRM for small teams who hate spreadsheets.' } });
  assert.equal(typed.status, 200, 'a typed description still works when the page cannot be opened');
  const unclear = await runAnalyze({ env, fetchImpl: world({ model: () => ({ name: '', niche: '', audience: '', problem: '', tone: '', competitors: [], queries: [] }) }).fetchImpl, token: 't', body: { text: 'x'.repeat(80) } });
  assert.equal(unclear.status, 422);
});

test('signals: searches Hacker News, scores, drafts, places and drops the noise', async () => {
  const names = body => body.messages[1].content.split('\n\n').map(x => x.split('\n')[0]);
  const at = (body, n) => String(names(body).findIndex(l => l.includes(n)) + 1);
  const w = world({ model: body => ({ items: [{ id: at(body, 'carol'), score: 88, intent: 'alternative', role: 'Ops lead', company: 'Acme', place: 'Austin, TX', country: 'US', draft: 'Happy to help.' }, { id: at(body, 'dan'), score: 5, intent: 'problem', role: '', company: '', place: '', country: '', draft: '' }] }) });
  const r = await runSignals({ env, fetchImpl: w.fetchImpl, token: 't', body: { profile, queries: ['alternative to salesforce'] } });
  assert.equal(r.status, 200); assert.equal(r.body.scanned, 2); assert.equal(r.body.leads.length, 1, 'the weather post scored 5 and is dropped');
  const l = r.body.leads[0];
  assert.deepEqual([l.score, l.intent, l.authorName, l.authorRole, l.draft, l.country, l.lat], [88, 'alternative', 'carol', 'Ops lead', 'Happy to help.', 'US', 30.27]);
  assert.ok(w.log.some(([, u]) => u.includes('user/carol.json')), "the author's own profile text was read");
  assert.equal(w.log.filter(([, u]) => u.includes('chat/completions')).length, 1, 'one model call for the whole batch');
  assert.equal((await runSignals({ env, fetchImpl: w.fetchImpl, token: 't', body: { profile: { queries: [] } } })).status, 400);
  assert.equal((await runSignals({ env, fetchImpl: world({ signedIn: false }).fetchImpl, token: 't', body: { profile } })).status, 401);
  const down = world({ model: () => { throw new Error('x'); } });
  const f = async (u, i) => (String(u).includes('chat/completions') ? { ok: false, status: 500, text: async () => 'boom', json: async () => ({}) } : down.fetchImpl(u, i));
  assert.equal((await runSignals({ env, fetchImpl: f, token: 't', body: { profile } })).status, 502);
});

test('ingest: only a paired extension, only the person’s own data', async () => {
  const saved = [], patched = []; const senv = { ...env, SUPABASE_SERVICE_ROLE_KEY: 'svc' };
  const w = world();
  const fetchImpl = async (url, init = {}) => {
    const u = String(url), m = init.method || 'GET';
    if (u.includes('/rest/v1/ingest_tokens') && m === 'GET') return json(u.includes('token_hash=eq.') && !u.includes('revoked=eq.true') ? [{ id: 't1', user_id: 'u1' }] : []);
    if (u.includes('/rest/v1/ingest_tokens') && m === 'PATCH') return json(null);
    if (u.includes('/rest/v1/business_profiles')) return json([{ ...profile, user_id: 'u1' }]);
    if (u.includes('/rest/v1/leads') && m === 'POST') { const b = JSON.parse(init.body); saved.push(...b); return json(b); }
    if (u.includes('/rest/v1/leads') && m === 'PATCH') { patched.push([u, JSON.parse(init.body)]); return json([{ id: 'l1' }]); }
    if (u.includes('nominatim')) return json([{ lat: '51.5', lon: '-0.12', address: { country_code: 'gb' } }]);
    return w.fetchImpl(url, init);
  };
  const post = { externalId: 'urn:li:activity:1', authorName: 'Eve', authorRole: 'COO at Zed', authorUrl: 'https://www.linkedin.com/in/eve?miniProfileUrn=x', text: 'Anyone know a simple CRM for a team of five? Tired of spreadsheets.', url: 'https://www.linkedin.com/feed/update/urn:li:activity:1' };
  assert.equal((await runIngest({ env: senv, fetchImpl, token: 'short', body: {} })).status, 401);
  const r = await runIngest({ env: senv, fetchImpl, token: 'a'.repeat(43), body: { items: [post, { externalId: '', text: 'x' }] } });
  assert.equal(r.status, 200); assert.equal(r.body.scanned, 1);
  assert.equal(saved.length, 1); assert.equal(saved[0].user_id, 'u1'); assert.equal(saved[0].source, 'linkedin'); assert.equal(saved[0].author_url, 'https://www.linkedin.com/in/eve');
  const p = await runIngest({ env: senv, fetchImpl, token: 'a'.repeat(43), body: { profile: { url: 'https://www.linkedin.com/in/eve/?x=1', location: 'Greater London Area' } } });
  assert.equal(p.body.placed, 1); assert.match(patched.at(-1)[0], /user_id=eq\.u1&author_url=like\./); assert.match(patched.at(-1)[0], /lat=is\.null/); assert.equal(patched.at(-1)[1].country, 'GB');
  assert.equal((await runIngest({ env: senv, fetchImpl, token: 'a'.repeat(43), body: { profile: { url: 'https://evil.example/in/eve', location: 'Paris' } } })).status, 400);
  assert.equal((await runIngest({ env, fetchImpl, token: 'a'.repeat(43), body: {} })).status, 503);
});

test('linkedinSearchUrl: content search, past week, newest first, phrase encoded', async () => {
  const { linkedinSearchUrl } = await import('../src/leads-core.js');
  const u = new URL(linkedinSearchUrl('invoicing  software & more'));
  assert.equal(u.origin + u.pathname, 'https://www.linkedin.com/search/results/content/');
  assert.equal(u.searchParams.get('keywords'), 'invoicing software & more');
  assert.equal(u.searchParams.get('sortBy'), '"date_posted"');
  assert.equal(u.searchParams.get('datePosted'), '"past-week"');
});
