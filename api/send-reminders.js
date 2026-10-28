// GET /api/send-reminders: daily job (Vercel Cron) that emails each person a digest of the reminders that need attention.
// Env: CRON_SECRET (Vercel sends it as a Bearer token), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//      RESEND_API_KEY and REMINDER_FROM (a sender address verified in Resend), optional SITE_URL.
// If anything is missing it answers 503 and sends nothing. A reminder is only marked as notified after its email was accepted.
import { shouldNotify, digestEmail, isoDay } from '../src/reminders.js';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

/** The whole job, with its dependencies injected so it can be tested without any network. */
export async function runReminders({ env, fetchImpl = fetch, today = isoDay() }) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !env.RESEND_API_KEY || !env.REMINDER_FROM) return { status: 503, body: { error: 'not_configured' } };
  const sb = (path, init = {}) => fetchImpl(`${base}${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers || {}) } });

  const horizon = isoDay(Date.parse(`${today}T00:00:00Z`) + 91 * 86400000);
  const r = await sb(`/rest/v1/asset_reminders?done=eq.false&due_on=lte.${horizon}&select=id,user_id,title,kind,due_on,notify_days,last_notified_on,assets(name)`);
  if (!r.ok) return { status: 502, body: { error: 'query_failed' } };
  const due = (await r.json()).map(x => ({ id: x.id, userId: x.user_id, title: x.title, kind: x.kind, dueOn: x.due_on, notifyDays: x.notify_days, lastNotifiedOn: x.last_notified_on, assetName: x.assets?.name || 'Asset' }))
    .filter(x => shouldNotify(x, today));

  const byUser = new Map();
  for (const x of due) byUser.set(x.userId, [...(byUser.get(x.userId) || []), x]);
  let emails = 0, failed = 0;
  for (const [userId, items] of byUser) {
    try {
      const u = await sb(`/auth/v1/admin/users/${encodeURIComponent(userId)}`);
      const email = u.ok ? (await u.json()).email : '';
      if (!email) { failed++; continue; }
      const mail = digestEmail(items, { today, appUrl: env.SITE_URL ? `${String(env.SITE_URL).replace(/\/$/, '')}/app.html` : '' });
      const sent = await fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.REMINDER_FROM, to: [email], subject: mail.subject, text: mail.text, html: mail.html }) });
      if (!sent.ok) { failed++; continue; }
      emails++;
      const ids = items.map(i => i.id).join(',');
      await sb(`/rest/v1/asset_reminders?id=in.(${ids})`, { method: 'PATCH', body: JSON.stringify({ last_notified_on: today }), headers: { prefer: 'return=minimal' } });
    } catch { failed++; }
  }
  return { status: 200, body: { ok: true, reminders: due.length, people: byUser.size, emails, failed } };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return send(res, 503, { error: 'not_configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) return send(res, 401, { error: 'unauthorized' });
  try { const { status, body } = await runReminders({ env: process.env }); return send(res, status, body); }
  catch (e) { console.error('send-reminders error', e); return send(res, 500, { error: 'server_error' }); }
}
