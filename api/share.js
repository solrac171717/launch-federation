// GET /api/share: returns the read-only portfolio behind a share link.
// The link secret arrives in the "x-share-token" header (it lives in the URL hash, so it is never in the page address sent to servers).
// Only its SHA-256 hash is stored. Unknown, revoked and expired links all answer the same 404, so they cannot be told apart.
// Notes, documents and reminders are never returned; debt is stripped when the owner chose not to share it.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createHash } from 'node:crypto';

const COLS = ['id', 'name', 'type', 'place', 'country', 'lat', 'lon', 'value', 'cost', 'gross', 'expenses', 'debt', 'debt_payment', 'ownership', 'owner', 'currency', 'debt_rate', 'annual_change', 'status', 'acquired_on', 'history', 'is_sample', 'created_at'];
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

  const a = await sb(`/rest/v1/assets?user_id=eq.${encodeURIComponent(share.user_id)}&select=*&order=created_at.asc`);
  if (!a.ok) return { status: 502, body: { error: 'load_failed' } };
  const assets = (await a.json()).map(pick).map(x => (share.include_debt ? x : { ...x, debt: 0, debt_payment: 0, debt_rate: 0, history: (x.history || []).map(({ b, ...p }) => p) }));
  sb(`/rest/v1/asset_shares?id=eq.${encodeURIComponent(share.id)}`, { method: 'PATCH', body: JSON.stringify({ last_viewed_at: new Date(now).toISOString() }), headers: { prefer: 'return=minimal' } }).catch(() => {});
  return { status: 200, body: { label: share.label, includeDebt: !!share.include_debt, expiresAt: share.expires_at, assets } };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('allow', 'GET'); return send(res, 405, { error: 'method_not_allowed' }); }
  try { const { status, body } = await runShare({ env: process.env, token: req.headers['x-share-token'] }); return send(res, status, body); }
  catch (e) { console.error('share error', e); return send(res, 500, { error: 'server_error' }); }
}
