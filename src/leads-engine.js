// The engine behind the leads: read a business, score the signals people left, write a reply draft, find where the person is.
// Everything that touches the network takes its fetch as an argument, so the tests run the whole thing against fakes. Used by api/analyze.js, api/signals.js and api/ingest.js.
import { CITIES_LIST, COUNTRIES } from './places.js';
import { INTENTS, validateLead } from './leads-core.js';

export const MODEL = 'gpt-4o-mini'; // cheap, strict JSON schemas; override with OPENAI_MODEL

/* ------------------------------------------------------------------ calling the model */
export async function askModel({ env, fetchImpl = fetch, system, user, schema, name, maxTokens = 1800, timeout = 40_000 }) {
  const res = await fetchImpl(`${String(env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(timeout),
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || MODEL, max_completion_tokens: maxTokens, temperature: 0.2,
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw Object.assign(new Error((await res.text().catch(() => '')).slice(0, 300)), { status: res.status });
  const choice = (await res.json()).choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') throw Object.assign(new Error('declined'), { status: 422 });
  return JSON.parse(choice?.message?.content || '');
}

/* ------------------------------------------------------------------ 1. read the business */
const str = { type: 'string' };
export const ANALYZE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['name', 'niche', 'audience', 'problem', 'tone', 'competitors', 'queries'],
  properties: {
    name: str, niche: str, audience: str, problem: str, tone: str,
    competitors: { type: 'array', items: str },
    queries: { type: 'array', items: str },
  },
};
export const ANALYZE_SYSTEM = `You read the description or the website text of a business and prepare the search for people who show they may buy from it.
Report only what the text says or clearly implies. Never invent customers, numbers or features.
- name: the business or product name, or "" if it is not stated.
- niche: what it sells, in one short sentence.
- audience: who buys it, in one short sentence.
- problem: the pain it removes, in one short sentence.
- tone: how its own text sounds (for example "friendly and direct", "formal"), two or three words.
- competitors: up to 4 well-known alternatives named in the text or obvious from the niche. Empty if you do not know any.
- queries: 6 short phrases, 2 to 6 words each, that a person would literally type or write when they want what this business sells. Examples of shape: "alternative to <competitor>", "recommend a tool for <task>", "looking for <thing>", "how do you <do the task>". English, lowercase, no quotes, no hashtags.`;

export function normalizeProfile(raw, { url = '' } = {}) {
  const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const list = (v, n, len) => [...new Set((Array.isArray(v) ? v : []).map(x => t(x, len)).filter(Boolean))].slice(0, n);
  return { url: t(url, 300), name: t(raw?.name, 80), niche: t(raw?.niche, 200), audience: t(raw?.audience, 200), problem: t(raw?.problem, 240), tone: t(raw?.tone, 60), competitors: list(raw?.competitors, 4, 60), queries: list(raw?.queries, 8, 60).filter(q => q.split(' ').length >= 2) };
}

/** Visible text of a web page: no scripts, styles or tags, the title and meta description first. */
export function pageText(html, max = 6000) {
  const h = String(html || '');
  const pick = re => (h.match(re)?.[1] || '').replace(/<[^>]*>/g, '').trim();
  const head = [pick(/<title[^>]*>([\s\S]*?)<\/title>/i), pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || pick(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)].filter(Boolean);
  const body = h.replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|li|h[1-6]|section|br)>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return [...head, body].join('\n').slice(0, max);
}

/** Private, loopback and link-local addresses: never fetched on behalf of a visitor (the server must not become a way into its own network). */
export function isPrivateAddress(ip) {
  const a = String(ip || '').toLowerCase();
  if (a.includes(':')) return a === '::1' || a === '::' || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || (a.startsWith('::ffff:') && isPrivateAddress(a.slice(7)));
  const p = a.split('.').map(Number); if (p.length !== 4 || p.some(n => !(n >= 0 && n <= 255))) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || p[0] >= 224 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}

/** Fetches a public web page (follows up to 3 redirects, checking every hop) and returns its text. `lookup` resolves a host name to its addresses. */
export async function fetchPage(rawUrl, { fetchImpl = fetch, lookup, max = 400_000 } = {}) {
  let url;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) && !/^https?:\/\//i.test(rawUrl)) throw Object.assign(new Error('bad_url'), { code: 'bad_url' }); // file:, ftp:, gopher: and the like
  try { url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`); } catch { throw Object.assign(new Error('bad_url'), { code: 'bad_url' }); }
  for (let hop = 0; hop < 4; hop++) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw Object.assign(new Error('bad_url'), { code: 'bad_url' });
    const addrs = /^[\d.]+$|:/.test(url.hostname) ? [url.hostname.replace(/^\[|\]$/g, '')] : await lookup(url.hostname).catch(() => []);
    if (!addrs.length || addrs.some(isPrivateAddress)) throw Object.assign(new Error('bad_url'), { code: 'bad_url' });
    const res = await fetchImpl(url.href, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'OwnedMapBot/1.0 (+https://ownedmap.com)', accept: 'text/html' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), url); continue; }
    if (!res.ok) throw Object.assign(new Error('unreachable'), { code: 'unreachable' });
    if (!/text\/html|text\/plain|xhtml/i.test(res.headers.get('content-type') || '')) throw Object.assign(new Error('not_a_page'), { code: 'not_a_page' });
    return (await res.text()).slice(0, max);
  }
  throw Object.assign(new Error('unreachable'), { code: 'unreachable' });
}

/* ------------------------------------------------------------------ 2. score the signals */
export const SCORE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['id', 'score', 'intent', 'role', 'company', 'place', 'country', 'draft'],
    properties: { id: str, score: { type: 'integer' }, intent: { type: 'string', enum: Object.keys(INTENTS) }, role: str, company: str, place: str, country: str, draft: str },
  } } },
};
export const scoreSystem = profile => `You help a seller find people who are asking for what they sell. The seller:
- Business: ${profile.name || '(unnamed)'}. ${profile.niche}
- Sells to: ${profile.audience}
- Removes this pain: ${profile.problem}
- Known alternatives: ${profile.competitors.join(', ') || 'none given'}
- Their tone: ${profile.tone || 'friendly and direct'}

You get numbered posts written by other people (with the author's profile text when there is one). For every post:
- score: 0 to 100, how clearly this person is looking for, or would welcome, something like the seller's product right now. 80+ means they ask for it or for an alternative to a rival. 40 to 79 means they describe the problem. Under 40 means the post is off topic, a sales pitch, a joke, or answers somebody else. Be strict: most posts are under 40.
- intent: one of recommendation, complaint, pricing, alternative, problem.
- role and company: only if the post or the profile text states them, otherwise "".
- place and country: only where the person says they live or work (post or profile text), as "City, Region" and the two-letter ISO country code. Never guess from the language or the topic. Otherwise "" and "".
- draft: for a score of 60 or more, a reply the seller could post under that message, in the seller's tone: 2 to 4 sentences, useful first, answers what the person said, mentions the seller's product once and honestly, no hype, no emojis, no invented facts or customers, no link. For a lower score, "".
Use only what the posts say. Write the draft in the language of the post.`;

export const scoreUser = candidates => candidates.map((c, i) => `[${i + 1}] ${c.authorName}${c.authorAbout ? ` (profile: ${c.authorAbout})` : c.authorRole ? ` (${c.authorRole})` : ''}\n${String(c.text).slice(0, 700)}`).join('\n\n');

/** The model's answer joined back to the candidates it was about: a validated lead each, the ones the model did not mention are dropped. */
export function applyScores(raw, candidates, { now = Date.now() } = {}) {
  const out = [];
  for (const it of raw?.items || []) {
    const c = candidates[Number(it.id) - 1]; if (!c) continue;
    const cc = String(it.country || '').toUpperCase();
    const v = validateLead({ ...c, score: Math.max(0, Math.min(100, Math.round(Number(it.score) || 0))), intent: it.intent, authorRole: it.role || c.authorRole, authorCompany: it.company, place: it.place, country: /^[A-Z]{2}$/.test(cc) ? cc : null, draft: it.draft }, { now });
    if (v.ok) out.push(v.value);
  }
  return out;
}

export async function scoreCandidates({ env, fetchImpl = fetch, profile, candidates }) {
  if (!candidates.length) return [];
  const raw = await askModel({ env, fetchImpl, system: scoreSystem(profile), user: scoreUser(candidates), schema: SCORE_SCHEMA, name: 'lead_scores', maxTokens: 3000 });
  return applyScores(raw, candidates);
}

/* ------------------------------------------------------------------ 3. where is the person */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const BY_NAME = new Map();
for (const c of CITIES_LIST) { const k = norm(c[0]); if (!BY_NAME.has(k)) BY_NAME.set(k, []); BY_NAME.get(k).push(c); }

/** A place written by a person ("Austin, TX", "Greater London", "Lisbon") matched against the built-in cities. Null when no city is named; no network. */
export function cityMatch(place, country = '') {
  const p = norm(place); if (!p) return null;
  const cc = String(country || '').toUpperCase();
  const words = p.split(' ');
  for (let n = Math.min(3, words.length); n >= 1; n--) for (let i = 0; i + n <= words.length; i++) {
    const hits = BY_NAME.get(words.slice(i, i + n).join(' '));
    if (hits) { const c = hits.find(h => !cc || h[2] === cc) || (cc ? null : hits[0]); if (c) return { place: `${c[0]}, ${c[1]}`, country: c[2], lat: c[3], lon: c[4] }; }
  }
  return null;
}

const cache = new Map(); // per server instance: the same city is not asked twice
export async function geocodePlace({ place, country, env = {}, fetchImpl = fetch }) {
  const local = cityMatch(place, country); if (local) return local;
  const q = String(place || '').trim(); if (!q) return null;
  const key = `${norm(q)}|${country || ''}`; if (cache.has(key)) return cache.get(key);
  let found = null;
  try {
    const base = String(env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
    const cn = COUNTRIES[String(country || '').toUpperCase()]?.name;
    const res = await fetchImpl(`${base}/search?format=jsonv2&limit=1&addressdetails=1&featuretype=city&q=${encodeURIComponent(cn ? `${q}, ${cn}` : q)}`, { signal: AbortSignal.timeout(3500), headers: { 'user-agent': 'OwnedMap/1.0 (https://ownedmap.com)', 'accept-language': 'en' } });
    const hit = res.ok ? (await res.json())[0] : null;
    const lat = Number(hit?.lat), lon = Number(hit?.lon), cc = String(hit?.address?.country_code || '').toUpperCase();
    if (hit && Number.isFinite(lat) && Number.isFinite(lon) && /^[A-Z]{2}$/.test(cc)) found = { place: q, country: cc, lat, lon };
  } catch { /* an unplaced lead is fine */ }
  cache.set(key, found); return found;
}

/** Adds coordinates to the leads that name a place. At most `max` network lookups per call (one per second is the polite rate of the free service). */
export async function locateLeads(leads, { env, fetchImpl, max = 4 } = {}) {
  let net = 0;
  for (const l of leads) {
    if (l.lat != null || !l.place) continue;
    const local = cityMatch(l.place, l.country);
    if (!local && net >= max) continue;
    if (!local) net++;
    const g = local || await geocodePlace({ place: l.place, country: l.country, env, fetchImpl });
    if (g) Object.assign(l, { place: g.place, country: g.country, lat: g.lat, lon: g.lon });
  }
  return leads;
}
