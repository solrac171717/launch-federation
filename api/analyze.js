// POST /api/analyze { url } or { text }: reads a business (its public web page, or a few lines the person wrote) and answers with
// what it sells, to whom, the pain it removes, its tone and the phrases people use when they want it. Signed-in users only (it costs money).
// Env: OPENAI_API_KEY, optional OPENAI_MODEL, SUPABASE_URL, SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY). Test hooks: OPENAI_BASE_URL.
import { lookup } from 'node:dns/promises';
import { askModel, ANALYZE_SCHEMA, ANALYZE_SYSTEM, normalizeProfile, fetchPage, pageText } from '../src/leads-engine.js';
import { send, readJson, userOf, limiter } from './_leads-http.js';

const allowed = limiter(12);

export async function runAnalyze({ env, fetchImpl = fetch, lookupImpl = h => lookup(h, { all: true }).then(a => a.map(x => x.address)), token, body, now = Date.now() }) {
  if (!env.OPENAI_API_KEY || !env.SUPABASE_URL) return { status: 503, body: { error: 'not_configured' } };
  const user = await userOf({ env, fetchImpl, token });
  if (!user) return { status: 401, body: { error: 'sign_in_required' } };
  if (!allowed(user.id, now)) return { status: 429, body: { error: 'rate_limited', message: 'You have analyzed many businesses in the last hour. Try again later.' } };

  const url = String(body?.url || '').trim().slice(0, 300), typed = String(body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
  let source = typed;
  if (url) {
    try { source = pageText(await fetchPage(url, { fetchImpl, lookup: lookupImpl })); }
    catch (e) { if (typed.length < 40) return { status: 422, body: { error: e.code || 'unreachable', message: 'We could not open that page. Check the address, or describe your business in a few lines instead.' } }; }
  }
  if (source.length < 40) return { status: 400, body: { error: 'too_short', message: 'Give your website address, or describe what you sell in a few lines.' } };
  try {
    const raw = await askModel({ env, fetchImpl, system: ANALYZE_SYSTEM, user: `${url ? `Website: ${url}\n` : ''}${typed && url ? `The seller adds: ${typed}\n` : ''}Text:\n${source}`, schema: ANALYZE_SCHEMA, name: 'business_profile', maxTokens: 900 });
    const profile = normalizeProfile(raw, { url });
    if (profile.queries.length < 2) return { status: 422, body: { error: 'unclear', message: 'We could not tell what you sell from that. Describe it in a few lines.' } };
    return { status: 200, body: { profile } };
  } catch (e) {
    console.error('analyze model error', e?.status, e?.message);
    return { status: 502, body: { error: 'model_unavailable', message: 'We could not read your business right now. Try again in a moment.' } };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    const { status, body } = await runAnalyze({ env: process.env, token: String(req.headers.authorization || '').replace(/^Bearer /, ''), body: await readJson(req) });
    return send(res, status, body);
  } catch (e) { console.error('analyze error', e); return send(res, e.status === 413 ? 413 : 500, { error: 'server_error', message: 'Something went wrong. Try again.' }); }
}
