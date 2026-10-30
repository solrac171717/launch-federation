// POST /api/welcome: the page shown after paying (welcome.html?session_id=...). The Stripe session id, which only the payer's browser has, is the proof.
//   { action: 'preview', sessionId }              -> the email of the account, and whether the payer may choose its first password
//   { action: 'claim', sessionId, password }      -> chooses that password. Once only, only within 24 hours, and only for an account THIS checkout created.
// An email that already had an account is never opened this way (it could be somebody else's): that person signs in, or asks for a reset by email.
// Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { stripeClient, supabaseClient, StripeError } from './_stripe.js';
import { provisionFromSession, SESSION_ID } from './_provision.js';
import { PASSWORD_MIN, PASSWORD_MAX } from './invite.js';

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-robots-tag', 'noindex');
  res.end(JSON.stringify(body));
};
const NOT_FOUND = { status: 404, body: { error: 'not_found' } };

export async function runWelcome({ env, fetchImpl = fetch, action, sessionId, password, now = Math.floor(Date.now() / 1000) }) {
  let stripe, sb;
  try { stripe = stripeClient({ env, fetchImpl }); sb = supabaseClient(env, fetchImpl); } catch { return { status: 503, body: { error: 'not_configured' } }; }
  if (!SESSION_ID.test(String(sessionId || ''))) return NOT_FOUND;
  try {
    const session = await stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (session.status !== 'complete' || session.mode !== 'subscription' || now - Number(session.created) > 86400) return NOT_FOUND;
    const { userId, email } = await provisionFromSession({ env, sb, stripe, fetchImpl, session, at: now });
    const claimRow = async () => { const r = await sb(`/rest/v1/checkout_claims?session_id=eq.${encodeURIComponent(sessionId)}&select=claimable,claimed_at`); return r.ok ? (await r.json())[0] : null; };
    const claim = await claimRow();
    const canChoose = Boolean(claim?.claimable && !claim?.claimed_at);

    if (action === 'preview') return { status: 200, body: { email, canChoosePassword: canChoose, claimed: Boolean(claim?.claimed_at) } };
    if (action !== 'claim') return { status: 400, body: { error: 'bad_request' } };
    if (!canChoose) return { status: 409, body: { error: claim?.claimed_at ? 'already_claimed' : 'account_exists' } };
    const pw = String(password || '');
    if (pw.length < PASSWORD_MIN) return { status: 400, body: { error: 'weak_password', min: PASSWORD_MIN } };
    if (pw.length > PASSWORD_MAX) return { status: 400, body: { error: 'password_too_long', max: PASSWORD_MAX } };

    // take the one chance first (atomically), then set the password; give the chance back if setting it fails
    const took = await sb(`/rest/v1/checkout_claims?session_id=eq.${encodeURIComponent(sessionId)}&claimed_at=is.null&claimable=eq.true`, { method: 'PATCH', body: JSON.stringify({ claimed_at: new Date(now * 1000).toISOString() }), headers: { prefer: 'return=representation' } });
    if (!took.ok || !(await took.json()).length) return { status: 409, body: { error: 'already_claimed' } };
    const base = String(env.SUPABASE_URL).replace(/\/$/, '');
    const set = await fetchImpl(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'PUT', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ password: pw, email_confirm: true }) });
    if (!set.ok) {
      await sb(`/rest/v1/checkout_claims?session_id=eq.${encodeURIComponent(sessionId)}`, { method: 'PATCH', body: JSON.stringify({ claimed_at: null }), headers: { prefer: 'return=minimal' } });
      return { status: 502, body: { error: 'set_failed' } };
    }
    return { status: 200, body: { ok: true, email } };
  } catch (e) {
    if (e instanceof StripeError) return { status: e.status === 400 ? 404 : 502, body: { error: e.status === 400 ? 'not_found' : 'stripe_error' } };
    console.error('welcome error', e); return { status: 500, body: { error: 'server_error' } };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b);
    if (!b) { const chunks = []; for await (const c of req) chunks.push(c); b = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    const { status, body } = await runWelcome({ env: process.env, action: b.action, sessionId: b.sessionId, password: b.password });
    if (status !== 200) await new Promise(r => setTimeout(r, 300));
    return send(res, status, body);
  } catch (e) { console.error('welcome handler error', e); return send(res, 500, { error: 'server_error' }); }
}
