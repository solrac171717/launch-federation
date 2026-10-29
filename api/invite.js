// POST /api/invite: the invited person opens the link the owner sent (app.html#invite=<secret>) and joins the account.
//   { action: 'preview', token }                     -> who invited you, as what (no account needed)
//   { action: 'accept', token, password }            -> creates the account for the invited email, with the password the person chose
//   { action: 'accept', token } + "Authorization: Bearer <session>"   -> an existing user, signed in as the invited email, joins
// The secret travels in the request body (it lives in the URL hash, so it never reaches our servers as part of a page address); only its SHA-256 hash is stored.
// Unknown, expired and already used links all answer the same 404, so they cannot be told apart.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createHash } from 'node:crypto';

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-robots-tag', 'noindex');
  res.end(JSON.stringify(body));
};
const NOT_FOUND = { status: 404, body: { error: 'not_found' } };
export const PASSWORD_MIN = 10, PASSWORD_MAX = 72;

export async function runInvite({ env, fetchImpl = fetch, action, token, password, bearer, now = Date.now() }) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return { status: 503, body: { error: 'not_configured' } };
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) return NOT_FOUND;
  const sb = (path, init = {}) => fetchImpl(`${base}${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const hash = createHash('sha256').update(token).digest('hex');

  const r = await sb(`/rest/v1/account_members?invite_hash=eq.${hash}&select=id,owner_id,owner_email,email,role,status,invite_expires_at`);
  if (!r.ok) return { status: 502, body: { error: 'lookup_failed' } };
  const inv = (await r.json())[0];
  if (!inv || inv.status !== 'invited' || (inv.invite_expires_at && Date.parse(inv.invite_expires_at) <= now)) return NOT_FOUND;
  const info = { ownerEmail: inv.owner_email, email: inv.email, role: inv.role };

  if (action === 'preview') return { status: 200, body: info };
  if (action !== 'accept') return { status: 400, body: { error: 'bad_request' } };

  const join = async userId => {
    const p = await sb(`/rest/v1/account_members?id=eq.${encodeURIComponent(inv.id)}&status=eq.invited`, { method: 'PATCH', body: JSON.stringify({ member_id: userId, status: 'active', invite_hash: null, invite_expires_at: null }), headers: { prefer: 'return=minimal' } });
    return p.ok ? { status: 200, body: { ok: true, ownerId: inv.owner_id, ...info } } : { status: 502, body: { error: 'join_failed' } };
  };

  if (bearer) { // someone who already has an account: they must be signed in as the invited email
    const u = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${bearer}` } });
    const user = u.ok ? await u.json().catch(() => null) : null;
    if (!user?.id) return { status: 401, body: { error: 'not_signed_in' } };
    if (String(user.email || '').toLowerCase() !== inv.email) return { status: 403, body: { error: 'wrong_account', email: inv.email } };
    return join(user.id);
  }

  const pw = String(password || '');
  if (pw.length < PASSWORD_MIN) return { status: 400, body: { error: 'weak_password', min: PASSWORD_MIN } };
  if (pw.length > PASSWORD_MAX) return { status: 400, body: { error: 'password_too_long', max: PASSWORD_MAX } };
  const made = await fetchImpl(`${base}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ email: inv.email, password: pw, email_confirm: true }) });
  if (!made.ok) {
    const e = await made.json().catch(() => ({}));
    if (made.status === 422 || e.error_code === 'email_exists') return { status: 409, body: { error: 'account_exists', email: inv.email } }; // has an account: sign in, then accept
    console.error('invite: could not create the account', made.status);
    return { status: 502, body: { error: 'create_failed' } };
  }
  const created = await made.json().catch(() => ({}));
  const id = created.id || created.user?.id;
  if (!id) return { status: 502, body: { error: 'create_failed' } };
  return join(id);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b);
    if (!b) { const chunks = []; for await (const c of req) chunks.push(c); b = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    // the page sends the anon key as its bearer on public calls: only a real session counts
    const { status, body } = await runInvite({ env: process.env, action: b.action, token: b.token, password: b.password, bearer: b.signedIn ? bearer : '' });
    if (status !== 200) await new Promise(r => setTimeout(r, 400));
    return send(res, status, body);
  } catch (e) { console.error('invite error', e); return send(res, 500, { error: 'server_error' }); }
}
