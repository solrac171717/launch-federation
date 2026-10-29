// POST /api/login: email + password sign-in. Answers with a normal Supabase session, so Row Level Security applies as usual.
// The owner account is provisioned here on first use (created, confirmed and its password set with the service key), so nothing has to be done in the Supabase panel.
// Any other email is simply checked against Supabase's own password grant. There is no sign-up.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (optional), ADMIN_PASSWORD (the owner password; never written in the repo), ADMIN_EMAIL (optional).
import { createHash, timingSafeEqual } from 'node:crypto';

const ADMIN_EMAIL = 'carlosmartinezhold@gmail.com';

const digest = s => createHash('sha256').update(String(s)).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

const BAD = { status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } };

export async function runLogin({ env, fetchImpl = fetch, email, password }) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, ''), service = env.SUPABASE_SERVICE_ROLE_KEY, anon = env.SUPABASE_ANON_KEY || service;
  if (!base || !service) return { status: 503, body: { error: 'not_configured' } };
  const mail = String(email || '').trim().toLowerCase(), pw = String(password || '');
  if (!mail || !pw || pw.length > 200) return BAD;

  const grant = async () => {
    const r = await fetchImpl(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'content-type': 'application/json' }, body: JSON.stringify({ email: mail, password: pw }) });
    return { status: r.status, body: await r.json().catch(() => ({})), ok: r.ok };
  };
  const admin = (path, init = {}) => fetchImpl(`${base}/auth/v1/admin${path}`, { ...init, headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' } });

  const first = await grant();
  if (first.ok) return { status: 200, body: first.body };

  const ownerEmail = String(env.ADMIN_EMAIL || ADMIN_EMAIL).toLowerCase();
  const passwords = env.ADMIN_PASSWORD ? [env.ADMIN_PASSWORD] : []; // no password configured: the owner account is not provisioned
  if (mail !== ownerEmail || !passwords.some(p => same(p, pw))) return first.status >= 500 ? { status: 502, body: { error: 'auth_unavailable' } } : BAD;

  // right owner credentials but Supabase does not know them yet (or has another password): create or fix the account, then sign in
  const made = await admin('/users', { method: 'POST', body: JSON.stringify({ email: mail, password: pw, email_confirm: true }) });
  const fail = (step, status, detail) => { console.error('login provisioning failed at', step, status, detail); return { status: 502, body: { error: 'provision_failed', step, upstream: status } }; };
  if (!made.ok) {
    const madeMsg = await made.text().catch(() => '');
    const list = await admin('/users?per_page=200');
    if (!list.ok) return fail('create', made.status, madeMsg.slice(0, 200));
    const found = ((await list.json()).users || []).find(u => String(u.email).toLowerCase() === mail);
    if (!found) return fail('find', made.status, madeMsg.slice(0, 200));
    const upd = await admin(`/users/${encodeURIComponent(found.id)}`, { method: 'PUT', body: JSON.stringify({ password: pw, email_confirm: true }) });
    if (!upd.ok) return fail('update', upd.status, (await upd.text().catch(() => '')).slice(0, 200));
  }
  const second = await grant();
  return second.ok ? { status: 200, body: second.body } : fail('sign-in', second.status, JSON.stringify(second.body).slice(0, 200));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b);
    if (!b) { const chunks = []; for await (const c of req) chunks.push(c); b = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    const { status, body } = await runLogin({ env: process.env, email: b.email, password: b.password });
    if (status !== 200) await new Promise(r => setTimeout(r, 600)); // slows down guessing
    return send(res, status, body);
  } catch (e) { console.error('login error', e); return send(res, 500, { error: 'server_error' }); }
}
