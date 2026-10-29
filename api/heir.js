// POST /api/heir { token }: what the trusted person sees when they open their private link (heir.html#t=<secret>).
// The sheet is open only when the owner released it or has not been seen for the chosen number of days (see src/heir-core.js).
// Until then the answer is the same "locked" for everybody. Unknown, removed and paused links answer 404, so they cannot be told apart.
// What is returned: the assets (with debt), the NAMES of documents (never the files), open reminders, and the owner's emergency contacts and note.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createHash } from 'node:crypto';
import { heirStatus } from '../src/heir-core.js';
import { cleanSettings } from '../src/settings-store.js';

const COLS = ['id', 'name', 'type', 'place', 'country', 'lat', 'lon', 'value', 'cost', 'gross', 'expenses', 'debt', 'debt_payment', 'ownership', 'owner', 'currency', 'debt_rate', 'annual_change', 'status', 'acquired_on', 'notes', 'history', 'is_sample', 'created_at'];
const pick = row => Object.fromEntries(COLS.filter(k => k in row).map(k => [k, row[k]]));

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-robots-tag', 'noindex');
  res.end(JSON.stringify(body));
};

export async function runHeir({ env, fetchImpl = fetch, token, now = Date.now() }) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return { status: 503, body: { error: 'not_configured' } };
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) return { status: 404, body: { error: 'not_found' } };
  const sb = (path, init = {}) => fetchImpl(`${base}${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const hash = createHash('sha256').update(token).digest('hex');

  const r = await sb(`/rest/v1/emergency_access?token_hash=eq.${hash}&select=*`);
  if (!r.ok) return { status: 502, body: { error: 'lookup_failed' } };
  const row = (await r.json())[0];
  if (!row || !row.enabled) return { status: 404, body: { error: 'not_found' } };
  const st = heirStatus(row, now);
  if (st.state !== 'open') return { status: 403, body: { error: 'locked' } };

  const uid = encodeURIComponent(row.user_id);
  const [a, d, m, s, u] = await Promise.all([
    sb(`/rest/v1/assets?user_id=eq.${uid}&select=*&order=created_at.asc`),
    sb(`/rest/v1/asset_documents?user_id=eq.${uid}&select=asset_id,name,kind`),
    sb(`/rest/v1/asset_reminders?user_id=eq.${uid}&done=eq.false&select=asset_id,title,due_on,done`),
    sb(`/rest/v1/user_settings?user_id=eq.${uid}&select=data`),
    sb(`/auth/v1/admin/users/${uid}`),
  ]);
  if (!a.ok) return { status: 502, body: { error: 'load_failed' } };
  const settings = cleanSettings(s.ok ? ((await s.json())[0]?.data || {}) : {});
  const ownerEmail = u.ok ? (await u.json()).email || '' : '';
  sb(`/rest/v1/emergency_access?user_id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ opened_at: row.opened_at || new Date(now).toISOString(), opened_count: (row.opened_count || 0) + 1 }), headers: { prefer: 'return=minimal' } }).catch(() => {});
  return {
    status: 200,
    body: {
      ownerEmail, contactName: row.contact_name, reason: st.reason, lastSeenAt: row.last_seen_at,
      assets: (await a.json()).map(pick),
      docs: d.ok ? (await d.json()).map(x => ({ asset_id: x.asset_id, name: x.name, kind: x.kind })) : [],
      reminders: m.ok ? (await m.json()).map(x => ({ asset_id: x.asset_id, title: x.title, due_on: x.due_on, done: !!x.done })) : [],
      settings: { contacts: settings.contacts, emergencyNote: settings.emergencyNote },
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b);
    if (!b) { const chunks = []; for await (const c of req) chunks.push(c); b = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    const { status, body } = await runHeir({ env: process.env, token: b.token });
    if (status === 404) await new Promise(r => setTimeout(r, 300));
    return send(res, status, body);
  } catch (e) { console.error('heir error', e); return send(res, 500, { error: 'server_error' }); }
}
