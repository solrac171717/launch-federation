// GET /api/heir-check: daily job (Vercel Cron) for the trusted-person feature.
//   1. Warns the owner by email when their trusted person's sheet is about to open (14 days before).
//   2. Tells the trusted person by email, once, that the sheet is now open (never with the link: they already hold it).
// Every visit of the owner to the app clears both marks (see touch() in src/app-heir.js), so a person who comes back is warned again next time.
// Env: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, REMINDER_FROM, optional SITE_URL. Anything missing answers 503 and sends nothing.
import { heirStatus, warningEmail, openNotice } from '../src/heir-core.js';

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
};

export async function runHeirCheck({ env, fetchImpl = fetch, now = Date.now() }) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !env.RESEND_API_KEY || !env.REMINDER_FROM) return { status: 503, body: { error: 'not_configured' } };
  const sb = (path, init = {}) => fetchImpl(`${base}${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const mail = (to, m) => fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.REMINDER_FROM, to: [to], subject: m.subject, text: m.text, html: m.html }) });
  const mark = (uid, patch) => sb(`/rest/v1/emergency_access?user_id=eq.${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify(patch), headers: { prefer: 'return=minimal' } });

  const r = await sb('/rest/v1/emergency_access?enabled=eq.true&select=*');
  if (!r.ok) return { status: 502, body: { error: 'query_failed' } };
  let warned = 0, notified = 0, failed = 0;
  for (const row of await r.json()) {
    try {
      const st = heirStatus(row, now);
      if (st.state === 'waiting' && st.warn && !row.warned_at) {
        const u = await sb(`/auth/v1/admin/users/${encodeURIComponent(row.user_id)}`);
        const email = u.ok ? (await u.json()).email : '';
        if (!email) { failed++; continue; }
        const sent = await mail(email, warningEmail({ contactName: row.contact_name, opensAt: st.opensAt, days: row.inactive_days, appUrl: env.SITE_URL }));
        if (!sent.ok) { failed++; continue; }
        await mark(row.user_id, { warned_at: new Date(now).toISOString() }); warned++;
      } else if (st.state === 'open' && !row.notified_at && row.contact_email) {
        const u = await sb(`/auth/v1/admin/users/${encodeURIComponent(row.user_id)}`);
        const ownerEmail = u.ok ? (await u.json()).email : '';
        const sent = await mail(row.contact_email, openNotice({ ownerEmail: ownerEmail || 'The owner', contactName: row.contact_name }));
        if (!sent.ok) { failed++; continue; }
        await mark(row.user_id, { notified_at: new Date(now).toISOString() }); notified++;
      }
    } catch { failed++; }
  }
  return { status: 200, body: { ok: true, warned, notified, failed } };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return send(res, 503, { error: 'not_configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) return send(res, 401, { error: 'unauthorized' });
  try { const { status, body } = await runHeirCheck({ env: process.env }); return send(res, status, body); }
  catch (e) { console.error('heir-check error', e); return send(res, 500, { error: 'server_error' }); }
}
