// GET /api/share: returns the read-only list of leads behind a share link.
// The link secret arrives in the "x-share-token" header (it lives in the URL hash, so it is never in the page address sent to servers).
// Only its SHA-256 hash is stored. Unknown, revoked and expired links all answer the same 404, so they cannot be told apart.
// The reply drafts are stripped unless the owner chose to share them (the stored flag is still named include_debt, from before leads).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createHash } from 'node:crypto';

const COLS = ['id', 'source', 'intent', 'score', 'status', 'signal_text', 'url', 'author_name', 'author_role', 'author_company', 'place', 'country', 'lat', 'lon', 'signal_at', 'draft', 'history', 'is_sample', 'created_at'];
const pick = row => Object.fromEntries(COLS.filter(k => k in row).map(k => [k, row[k]]));

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-robots-tag', 'noindex');
  res.end(JSON.stringify(body));
}

export async function runShare({ env, fetchImpl = fetch, token, now = Date.now() }) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return { status: 503, body: { error: 'not_configured' } };
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) return { status: 404, body: { error: 'not_found' } };
  const sb = (path, init = {}) => fetchImpl(`${base}${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const hash = createHash('sha256').update(token).digest('hex');

  const r = await sb(`/rest/v1/asset_shares?token_hash=eq.${hash}&select=id,user_id,label,include_debt,expires_at,revoked`);
  if (!r.ok) return { status: 502, body: { error: 'lookup_failed' } };
  const share = (await r.json())[0];
  if (!share || share.revoked || (share.expires_at && Date.parse(share.expires_at) <= now)) return { status: 404, body: { error: 'not_found' } };

  const a = await sb(`/rest/v1/leads?user_id=eq.${encodeURIComponent(share.user_id)}&select=*&order=signal_at.desc&limit=1000`);
  if (!a.ok) return { status: 502, body: { error: 'load_failed' } };
  const leads = (await a.json()).map(pick).map(x => (share.include_debt ? x : { ...x, draft: null }));
  sb(`/rest/v1/asset_shares?id=eq.${encodeURIComponent(share.id)}`, { method: 'PATCH', body: JSON.stringify({ last_viewed_at: new Date(now).toISOString() }), headers: { prefer: 'return=minimal' } }).catch(() => {});
  return { status: 200, body: { label: share.label, includeDrafts: !!share.include_debt, expiresAt: share.expires_at, leads } };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('allow', 'GET'); return send(res, 405, { error: 'method_not_allowed' }); }
  try { const { status, body } = await runShare({ env: process.env, token: req.headers['x-share-token'] }); return send(res, status, body); }
  catch (e) { console.error('share error', e); return send(res, 500, { error: 'server_error' }); }
}
