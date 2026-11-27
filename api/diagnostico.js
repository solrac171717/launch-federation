// POST /api/diagnostico { url }: the free diagnosis on the home page. Reads the visitor's own home page (plus robots.txt, llms.txt and
// sitemap.xml), runs the 30 checks of src/diagnostico-core.js, and answers with the score, the three most serious gaps in full and only
// the NUMBER of the others (their text is never sent, so it cannot be read from the browser). Optionally asks a model for likely competitors.
// Safety: only http/https on ports 80/443, no IP literals, every address the name resolves to is checked at connect time (not just before),
// redirects are followed by hand and re-checked, size and time are capped, and each visitor and each site is rate limited.
// Env (all optional): OPENAI_API_KEY and OPENAI_MODEL (competitors). Without a key the diagnosis still works, without competitors.
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import zlib from 'node:zlib';
import { parseTarget, isPrivateAddress, runChecks, summarize, readPage } from '../src/diagnostico-core.js';

const UA = 'OwnedMapDiagnostic/1.0 (+https://ownedmap.com)';
const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
};

/** dns.lookup that refuses private addresses: used by the socket itself, so what is checked is what is connected to. */
export function guardedLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some(a => isPrivateAddress(a.address))) return cb(Object.assign(new Error('blocked_address'), { code: 'EBLOCKED' }));
    return options?.all ? cb(null, addrs) : cb(null, addrs[0].address, addrs[0].family);
  });
}

/** One GET of a public page: { status, headers, text, url } or throws. Follows up to 3 redirects, re-checking each address. */
export async function fetchPage(startUrl, { max = 1_500_000, timeout = 8000, hops = 3, request = realRequest } = {}) {
  let url = startUrl;
  for (let i = 0; i <= hops; i++) {
    const t = parseTarget(url);
    if (!t.ok) throw new Error('blocked_target');
    const r = await request(url, { max, timeout });
    if (r.status >= 300 && r.status < 400 && r.headers.location) { url = new URL(r.headers.location, url).href; continue; }
    return { ...r, url };
  }
  throw new Error('too_many_redirects');
}

function realRequest(url, { max, timeout }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), mod = u.protocol === 'http:' ? http : https;
    const req = mod.request(u, { method: 'GET', lookup: guardedLookup, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5', 'accept-encoding': 'gzip, deflate, br' }, timeout }, res => {
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      const stream = enc === 'gzip' ? res.pipe(zlib.createGunzip()) : enc === 'br' ? res.pipe(zlib.createBrotliDecompress()) : enc === 'deflate' ? res.pipe(zlib.createInflate()) : res;
      const chunks = []; let size = 0;
      stream.on('data', c => { size += c.length; if (size > max) { req.destroy(); resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }); } else chunks.push(c); });
      stream.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
      stream.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

const looksLikeHtml = r => /html/i.test(String(r.headers['content-type'] || '')) || /^\s*<(!doctype|html)/i.test(r.text);

/** Everything the checks need about one site. */
export async function inspect(target, { request } = {}) {
  const opts = { request };
  let home;
  try { home = await fetchPage(target.url, opts); }
  catch (e) { if (e.message === 'blocked_target' || e.code === 'EBLOCKED') throw e; home = await fetchPage(target.url.replace('https://', 'http://'), opts); }
  const origin = new URL(home.url).origin;
  const small = path => fetchPage(origin + path, { ...opts, max: 300_000, timeout: 5000 }).catch(() => null);
  const [robots, llms, sitemap] = await Promise.all([small('/robots.txt'), small('/llms.txt'), small('/sitemap.xml')]);
  const robotsTxt = robots && robots.status === 200 && !looksLikeHtml(robots) && /user-agent/i.test(robots.text) ? robots.text : null;
  const sitemapOk = Boolean((sitemap && sitemap.status === 200 && /<(urlset|sitemapindex)/i.test(sitemap.text)) || /^\s*sitemap\s*:/im.test(robotsTxt || ''));
  return { url: home.url, status: home.status, html: home.text, headers: { xRobotsTag: home.headers['x-robots-tag'] || '' }, robotsTxt, llmsTxt: Boolean(llms && llms.status === 200 && !looksLikeHtml(llms) && llms.text.trim().length > 20), sitemap: sitemapOk };
}

/** Likely competitors, from what the home page says. Optional: [] without a key or on any failure. */
export async function competitorsFor(page, { env, fetchImpl = fetch }) {
  if (!env.OPENAI_API_KEY) return [];
  const p = readPage(page.html), host = new URL(page.url).hostname.replace(/^www\./, '');
  const brief = [`Dominio: ${host}`, `Título: ${p.title}`, `Descripción: ${p.description}`, `Titular: ${p.heads.find(h => h.level === 1)?.text || ''}`, `Texto: ${p.body.slice(0, 1200)}`].join('\n');
  try {
    const res = await fetchImpl(`${String(env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(9000),
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4o-mini', max_completion_tokens: 300,
        messages: [{ role: 'system', content: 'Eres analista de mercado. A partir de lo que dice una web, nombra hasta 4 competidores directos que sean empresas reales y conocidas, con su dominio. Si no estás seguro de alguno, no lo incluyas: es mejor una lista vacía que un nombre inventado.' }, { role: 'user', content: brief }],
        response_format: { type: 'json_schema', json_schema: { name: 'competitors', strict: true, schema: { type: 'object', additionalProperties: false, required: ['competitors'], properties: { competitors: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['name', 'domain'], properties: { name: { type: 'string' }, domain: { type: 'string' } } } } } } } },
      }),
    });
    if (!res.ok) return [];
    const list = JSON.parse((await res.json())?.choices?.[0]?.message?.content || '{}').competitors || [];
    return list.map(c => ({ name: String(c.name || '').slice(0, 60), domain: String(c.domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').slice(0, 80) }))
      .filter(c => c.name && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(c.domain) && c.domain !== host).slice(0, 4);
  } catch { return []; }
}

/* ---------------------------------------------------------------- limits (best effort: per server instance) */
const hits = new Map(), cache = new Map();
const tooMany = (ip, now) => { const l = (hits.get(ip) || []).filter(t => now - t < 10 * 60_000); l.push(now); hits.set(ip, l); if (hits.size > 5000) hits.clear(); return l.length > 6; };

export async function runDiagnostico({ url, ip = 'x', env = {}, now = Date.now(), request, fetchImpl }) {
  const target = parseTarget(url);
  if (!target.ok) return { status: 400, body: { error: 'invalid_url' } };
  const hot = cache.get(target.host);
  if (hot && now - hot.t < 10 * 60_000) return { status: 200, body: hot.body };
  if (tooMany(ip, now)) return { status: 429, body: { error: 'rate_limited' } };
  let page;
  try { page = await inspect(target, { request }); }
  catch { return { status: 422, body: { error: 'unreachable' } }; }
  const checks = runChecks(page), summary = summarize(checks), competitors = await competitorsFor(page, { env, fetchImpl });
  const p = readPage(page.html);
  const body = { ok: true, host: target.host, title: p.title.slice(0, 120), ...summary, competitors };
  cache.set(target.host, { t: now, body }); if (cache.size > 500) cache.clear();
  return { status: 200, body };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  let data = req.body; if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();
  try { const { status, body } = await runDiagnostico({ url: data?.url, ip, env: process.env }); return send(res, status, body); }
  catch (e) { console.error('diagnostico error', e); return send(res, 500, { error: 'server_error' }); }
}
