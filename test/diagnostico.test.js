import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTarget, isPrivateAddress, blockedBots, runChecks, summarize, readPage } from '../src/diagnostico-core.js';
import { runDiagnostico, guardedLookup, competitorsFor } from '../api/diagnostico.js';

const GOOD = `<!doctype html><html lang="es"><head><title>Asesoría fiscal para startups en Madrid</title>
<meta name="description" content="Asesoría fiscal y contable para startups en Madrid: impuestos, nóminas y subvenciones explicados sin letra pequeña y con precio cerrado."><meta property="og:title" content="x"><meta property="og:description" content="y">
<link rel="canonical" href="https://ej.com/"><script type="application/ld+json">{"@graph":[{"@type":"ProfessionalService","name":"Ej"},{"@type":"FAQPage"},{"@type":"WebSite"},{"@type":"Service"},{"@type":"AggregateRating"},{"@type":"BreadcrumbList"}]}</script></head>
<body><h1>Asesoría fiscal para startups</h1><h2>¿Cuánto cuesta una asesoría?</h2><h2>¿Cómo funciona el alta?</h2><h2>Nuestro equipo</h2>
<ul><li>Impuestos</li></ul><img src="a.png" alt="a"><a href="/nosotros">Nosotros</a><a href="https://linkedin.com/x">in</a><a href="https://instagram.com/x">ig</a>
<p>Preguntas frecuentes. Reseñas de clientes y casos de éxito. ${'palabra '.repeat(320)}</p></body></html>`;
const BARE = '<html><head></head><body><div>Hola</div></body></html>';
const ctx = (html, o = {}) => ({ url: 'https://ej.com/', status: 200, headers: {}, html, robotsTxt: 'User-agent: *\nAllow: /\nSitemap: https://ej.com/sitemap.xml', llmsTxt: true, sitemap: true, ...o });

test('parseTarget accepts domains and refuses anything that is not a public website', () => {
  assert.deepEqual(parseTarget('Ejemplo.com'), { ok: true, host: 'ejemplo.com', url: 'https://ejemplo.com/' });
  assert.equal(parseTarget('https://www.ejemplo.com/ruta?x=1').host, 'www.ejemplo.com');
  for (const bad of ['', 'localhost', 'http://127.0.0.1', '10.0.0.5', '[::1]', 'intranet', 'foo.local', 'ftp://x.com', 'x.com:8080', 'a b.com', 'javascript:alert(1)']) assert.equal(parseTarget(bad).ok, false, bad);
});

test('private, loopback, link-local and reserved addresses are never fetched', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', 'garbage']) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
});

test('the lookup the socket uses refuses a name that resolves to a private address', async () => {
  const err = await new Promise(r => guardedLookup('localhost', {}, e => r(e)));
  assert.equal(err?.code, 'EBLOCKED');
});

test('robots.txt: which AI bots are shut out', () => {
  assert.deepEqual(blockedBots('User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /private\n\nUser-agent: *\nAllow: /'), { bots: ['GPTBot'], all: false });
  assert.deepEqual(blockedBots('User-agent: *\nDisallow: /'), { bots: [], all: true });
  assert.deepEqual(blockedBots('User-agent: PerplexityBot\nUser-agent: CCBot\nDisallow: /\n'), { bots: ['PerplexityBot', 'CCBot'], all: false });
  assert.deepEqual(blockedBots(null), { bots: [], all: false });
});

test('there are exactly 30 checks with unique ids, in four groups', () => {
  const checks = runChecks(ctx(GOOD));
  assert.equal(checks.length, 30);
  assert.equal(new Set(checks.map(c => c.id)).size, 30);
  assert.deepEqual([...new Set(checks.map(c => c.group))].sort(), ['acceso', 'autoridad', 'contenido', 'datos']);
});

test('a well built page has almost no gaps, a bare page has many', () => {
  const good = summarize(runChecks(ctx(GOOD))), bare = summarize(runChecks(ctx(BARE, { llmsTxt: false, sitemap: false, robotsTxt: null })));
  assert.ok(good.gaps <= 2, `good page gaps: ${JSON.stringify(good.shown)}`);
  assert.ok(good.score >= 90);
  assert.ok(bare.gaps >= 20 && bare.score < 40, `bare: ${bare.gaps} / ${bare.score}`);
  assert.equal(good.total, 30);
});

test('individual checks look at the right things', () => {
  const find = (html, o, id) => runChecks(ctx(html, o)).find(c => c.id === id);
  assert.equal(find(GOOD, { robotsTxt: 'User-agent: GPTBot\nDisallow: /' }, 'robots-ai').ok, false);
  assert.match(find(GOOD, { robotsTxt: 'User-agent: GPTBot\nDisallow: /' }, 'robots-ai').detail, /GPTBot/);
  assert.equal(find(GOOD, { url: 'http://ej.com/' }, 'https').ok, false);
  assert.equal(find(GOOD.replace('<head>', '<head><meta name="robots" content="noindex">'), {}, 'indexable').ok, false);
  assert.equal(find(GOOD, { headers: { xRobotsTag: 'noindex' } }, 'indexable').ok, false);
  assert.equal(find(GOOD, { status: 503 }, 'status').ok, false);
  assert.equal(find(GOOD.replace(/"FAQPage"/, '"Thing"'), {}, 'faq-schema').ok, false);
  assert.equal(find(GOOD.replace('<script type="application/ld+json">{', '<script type="application/ld+json">{{'), {}, 'jsonld').ok, false, 'a broken block counts as none and does not crash');
  assert.equal(find(BARE, {}, 'questions').ok, false);
  assert.equal(find(GOOD, {}, 'questions').ok, true);
  assert.equal(readPage(GOOD).words > 300, true);
});

test('the summary describes three gaps in full and only counts the rest: their text never leaves the server', () => {
  const checks = runChecks(ctx(BARE, { llmsTxt: false, sitemap: false, robotsTxt: null })), s = summarize(checks);
  assert.equal(s.shown.length, 3);
  assert.equal(s.locked, s.gaps - 3);
  assert.ok(s.shown.every((g, i, a) => !i || a[i - 1].sev >= g.sev), 'most serious first');
  const wire = JSON.stringify(s);
  for (const hidden of checks.filter(c => !c.ok && !s.shown.some(g => g.id === c.id))) { assert.ok(!wire.includes(hidden.title), `leaked: ${hidden.title}`); assert.ok(!wire.includes(`"id":"${hidden.id}"`), `leaked id: ${hidden.id}`); }
  assert.equal(Object.values(s.lockedGroups).reduce((a, b) => a + b, 0), s.locked);
  const few = summarize(runChecks(ctx(GOOD)));
  assert.equal(few.locked, Math.max(0, few.gaps - 3));
});

/* ---------------------------------------------------------------- the endpoint, with a stand-in for the network */
const site = (pages, calls = []) => async (url) => {
  calls.push(url);
  const u = new URL(url), hit = pages[u.pathname];
  if (!hit) return { status: 404, headers: { 'content-type': 'text/html' }, text: '<html>not found</html>' };
  return { status: hit.status ?? 200, headers: { 'content-type': hit.type || 'text/html', ...(hit.headers || {}) }, text: hit.text };
};

test('runDiagnostico: reads the home page, robots, llms and sitemap, and answers with the gated summary', async () => {
  const calls = [], request = site({ '/': { text: GOOD }, '/robots.txt': { type: 'text/plain', text: 'User-agent: *\nAllow: /' }, '/llms.txt': { type: 'text/plain', text: '# Ej\n> Asesoría fiscal para startups en Madrid' }, '/sitemap.xml': { type: 'application/xml', text: '<urlset></urlset>' } }, calls);
  const r = await runDiagnostico({ url: 'ej-uno.com', ip: '1.1.1.1', env: {}, request });
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 30); assert.equal(r.body.host, 'ej-uno.com'); assert.deepEqual(r.body.competitors, []);
  assert.ok(calls.some(u => u.endsWith('/robots.txt')) && calls.some(u => u.endsWith('/llms.txt')) && calls.some(u => u.endsWith('/sitemap.xml')));
  assert.ok(r.body.score >= 80);
});

test('runDiagnostico: an HTML page served at /llms.txt or /robots.txt (a catch-all) does not count as the file', async () => {
  const request = site({ '/': { text: BARE }, '/robots.txt': { text: '<html>app</html>' }, '/llms.txt': { text: '<!doctype html><html>app</html>' }, '/sitemap.xml': { text: '<html>app</html>' } });
  const r = await runDiagnostico({ url: 'ej-dos.com', ip: '1.1.1.2', env: {}, request });
  assert.equal(r.status, 200);
  const all = r.body.shown.map(g => g.id);
  assert.ok(r.body.gaps >= 20 && all.length === 3);
});

test('runDiagnostico: invalid address, redirect to a private host, unreachable site and the rate limit', async () => {
  assert.equal((await runDiagnostico({ url: 'http://127.0.0.1/admin', ip: '2.2.2.2' })).status, 400);
  assert.equal((await runDiagnostico({ url: '', ip: '2.2.2.2' })).status, 400);
  const redirect = async url => (new URL(url).hostname === 'ej-tres.com' ? { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' }, text: '' } : { status: 200, headers: {}, text: '' });
  assert.equal((await runDiagnostico({ url: 'ej-tres.com', ip: '3.3.3.3', request: redirect })).status, 422);
  const down = async () => { throw new Error('ECONNREFUSED'); };
  assert.equal((await runDiagnostico({ url: 'ej-cuatro.com', ip: '4.4.4.4', request: down })).status, 422);
  const ok = site({ '/': { text: GOOD } });
  const codes = []; for (let i = 0; i < 8; i++) codes.push((await runDiagnostico({ url: `ej-limite${i}.com`, ip: '5.5.5.5', request: ok })).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 200, 429, 429]);
  assert.equal((await runDiagnostico({ url: 'ej-limite0.com', ip: '5.5.5.5', request: ok })).status, 200, 'a site just checked is answered from memory');
});

test('competitors: from the model when there is a key, filtered; none without one or when it fails', async () => {
  const page = { url: 'https://ej.com/', html: GOOD };
  const model = content => async (url, init) => { assert.match(url, /chat\/completions/); assert.match(JSON.parse(init.body).messages[1].content, /ej\.com/); return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) }; };
  const list = await competitorsFor(page, { env: { OPENAI_API_KEY: 'k' }, fetchImpl: model({ competitors: [{ name: 'Holded', domain: 'https://www.Holded.com/precios' }, { name: 'Propio', domain: 'ej.com' }, { name: 'Roto', domain: 'no es dominio' }] }) });
  assert.deepEqual(list, [{ name: 'Holded', domain: 'holded.com' }]);
  assert.deepEqual(await competitorsFor(page, { env: {} }), []);
  assert.deepEqual(await competitorsFor(page, { env: { OPENAI_API_KEY: 'k' }, fetchImpl: async () => { throw new Error('boom'); } }), []);
  assert.deepEqual(await competitorsFor(page, { env: { OPENAI_API_KEY: 'k' }, fetchImpl: async () => ({ ok: false }) }), []);
});
