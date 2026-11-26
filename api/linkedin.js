// POST /api/linkedin: everything about the person's LinkedIn accounts, through the provider (Unipile). Nothing here holds a LinkedIn password or cookie.
//   { action: 'link' }                a page where the person logs in to LinkedIn (hosted by the provider); answers { url }
//   { action: 'disconnect', id }      removes one of their accounts, here and at the provider
//   { action: 'scan' }                looks for new people now (the scheduler does it every six hours anyway)
//   ?notify=1&u=<user>&sig=<hmac>     called by the provider, from its server, when the account was created: attaches it to that user
// Env: UNIPILE_DSN, UNIPILE_API_KEY, CRON_SECRET (also signs the notify address), SITE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
import { createUnipile, configured } from '../src/providers/unipile.js';
import { signUser, verifySig, attachAccount, scanNow, restFor } from '../src/outreach-engine.js';
import { send, readJson, userOf, limiter } from './_leads-http.js';

const scanAllowed = limiter(6), linkAllowed = limiter(10);

export async function runLinkedin({ env, fetchImpl = fetch, provider, token, body, query = {}, now = Date.now() }) {
  if (!configured(env) || !env.CRON_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 503, body: { error: 'not_configured' } };
  provider ||= createUnipile({ env, fetchImpl });

  if (query.notify) { // the provider's server tells us an account was created
    if (!verifySig(query.u, query.sig, env.CRON_SECRET)) return { status: 401, body: { error: 'bad_signature' } };
    const status = String(body?.status || ''), accountId = String(body?.account_id || '');
    if (!/^(CREATION_SUCCESS|RECONNECTED)$/i.test(status) || !accountId) return { status: 200, body: { ok: false } };
    try { await attachAccount({ env, fetchImpl, provider, userId: query.u, accountId, now }); return { status: 200, body: { ok: true } }; }
    catch (e) { console.error('attach failed', e?.message); return { status: 400, body: { error: 'attach_failed' } }; }
  }

  const user = await userOf({ env, fetchImpl, token });
  if (!user) return { status: 401, body: { error: 'sign_in_required' } };
  const site = String(env.SITE_URL || '').replace(/\/$/, '');

  if (body?.action === 'link') {
    if (!linkAllowed(user.id, now)) return { status: 429, body: { error: 'rate_limited' } };
    try {
      const url = await provider.hostedLink({ name: user.id, successUrl: `${site}/app.html?linkedin=connected`, failureUrl: `${site}/app.html?linkedin=failed`, notifyUrl: `${site}/api/linkedin?notify=1&u=${encodeURIComponent(user.id)}&sig=${signUser(user.id, env.CRON_SECRET)}` });
      return { status: 200, body: { url } };
    } catch (e) { console.error('link failed', e?.message); return { status: 502, body: { error: 'provider_unavailable', message: 'Could not open the LinkedIn connection page. Try again in a moment.' } }; }
  }

  if (body?.action === 'disconnect') {
    const db = restFor(env, fetchImpl), id = String(body.id || '');
    const row = (await db('GET', `/linkedin_accounts?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}&select=id,provider_account_id`))?.[0];
    if (!row) return { status: 404, body: { error: 'not_found' } };
    await provider.disconnect(row.provider_account_id).catch(() => {}); // already gone at the provider is fine
    await db('DELETE', `/linkedin_accounts?id=eq.${row.id}&user_id=eq.${user.id}`, undefined, 'return=minimal');
    await db('PATCH', `/outreach?user_id=eq.${user.id}&status=in.(draft,approved)&account_id=eq.${row.id}`, { status: 'stopped' }, 'return=minimal');
    return { status: 200, body: { ok: true } };
  }

  if (body?.action === 'scan') {
    if (!env.OPENAI_API_KEY) return { status: 503, body: { error: 'not_configured' } };
    if (!scanAllowed(user.id, now)) return { status: 429, body: { error: 'rate_limited', message: 'You have searched a lot in the last hour. Try again later.' } };
    const r = await scanNow({ env, fetchImpl, provider, userId: user.id, now });
    if (r.error === 'no_account') return { status: 409, body: { error: 'no_account', message: 'Connect your LinkedIn account first.' } };
    if (r.error === 'no_profile') return { status: 409, body: { error: 'no_profile', message: 'Describe your business first.' } };
    return { status: 200, body: r };
  }
  return { status: 400, body: { error: 'bad_request' } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    const { status, body } = await runLinkedin({ env: process.env, token: String(req.headers.authorization || '').replace(/^Bearer /, ''), body: await readJson(req), query });
    return send(res, status, body);
  } catch (e) { console.error('linkedin error', e); return send(res, e.status === 413 ? 413 : 500, { error: 'server_error', message: 'Something went wrong. Try again.' }); }
}
