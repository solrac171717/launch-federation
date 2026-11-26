// POST /api/signals { profile, queries? }: looks for people who are asking for what the business sells, right now.
//   1. searches Hacker News (free Algolia API) for the profile's phrases,
//   2. reads the authors' own profile text when they wrote one,
//   3. one model call scores each post 0 to 100, labels the intent and drafts a reply (never sent anywhere),
//   4. places the person on the map when the post or profile says where they are.
// The answer is the leads; the browser saves them (so this endpoint stores nothing and holds no database key).
// The browser calls it with a few phrases at a time, in parallel, so the first points reach the globe in seconds.
// Env: OPENAI_API_KEY, optional OPENAI_MODEL, SUPABASE_URL, SUPABASE_ANON_KEY. Test hooks: OPENAI_BASE_URL, NOMINATIM_URL.
import { buscarSeñales, aboutOf } from '../src/sources/hn.js';
import { scoreCandidates, locateLeads } from '../src/leads-engine.js';
import { send, readJson, userOf, limiter } from './_leads-http.js';

const allowed = limiter(90);
export const MIN_SCORE = 30; // below this the post is noise, not a lead

export function cleanProfile(p) {
  const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n), list = (v, n, len) => (Array.isArray(v) ? v : []).map(x => t(x, len)).filter(Boolean).slice(0, n);
  return { name: t(p?.name, 80), niche: t(p?.niche, 200), audience: t(p?.audience, 200), problem: t(p?.problem, 240), tone: t(p?.tone, 60), competitors: list(p?.competitors, 4, 60), queries: list(p?.queries, 8, 60) };
}

export async function runSignals({ env, fetchImpl = fetch, token, body, now = Date.now() }) {
  if (!env.OPENAI_API_KEY || !env.SUPABASE_URL) return { status: 503, body: { error: 'not_configured' } };
  const user = await userOf({ env, fetchImpl, token });
  if (!user) return { status: 401, body: { error: 'sign_in_required' } };
  const profile = cleanProfile(body?.profile);
  const queries = (Array.isArray(body?.queries) && body.queries.length ? body.queries : profile.queries).map(q => String(q).trim()).filter(Boolean).slice(0, 3);
  if (!profile.niche || !queries.length) return { status: 400, body: { error: 'no_profile', message: 'Describe your business first.' } };
  if (!allowed(user.id, now)) return { status: 429, body: { error: 'rate_limited', message: 'You have searched a lot in the last hour. Try again later.' } };
  try {
    const found = (await buscarSeñales(queries, { fetchImpl, now })).slice(0, 14);
    if (!found.length) return { status: 200, body: { leads: [], scanned: 0 } };
    const about = await aboutOf(found.map(c => c.authorName), { fetchImpl });
    const candidates = found.map(c => ({ ...c, authorAbout: about[c.authorName] || '' }));
    const scored = (await scoreCandidates({ env, fetchImpl, profile, candidates })).filter(l => l.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
    await locateLeads(scored, { env, fetchImpl });
    return { status: 200, body: { leads: scored, scanned: found.length } };
  } catch (e) {
    console.error('signals error', e?.status, e?.message);
    return { status: 502, body: { error: 'model_unavailable', message: 'The search could not finish. Try again in a moment.' } };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    const { status, body } = await runSignals({ env: process.env, token: String(req.headers.authorization || '').replace(/^Bearer /, ''), body: await readJson(req) });
    return send(res, status, body);
  } catch (e) { console.error('signals error', e); return send(res, e.status === 413 ? 413 : 500, { error: 'server_error', message: 'Something went wrong. Try again.' }); }
}
