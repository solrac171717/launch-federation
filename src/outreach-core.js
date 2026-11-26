// The rules of outreach, with no network and no DOM: who may send what, when, from which account. The server (api/tick.js) and the tests share it.
// Limits are real: LinkedIn restricts accounts that send too much, so the caps are conservative and the person can only lower them.

export const STEPS = ['invite', 'follow1', 'follow2'];
export const STEP_LABEL = { invite: 'Invitation note', follow1: 'First follow-up', follow2: 'Second follow-up' };
export const OUTREACH_STATUS = { draft: 'Waiting for you', approved: 'Approved', sent: 'Sent', skipped: 'Skipped', failed: 'Failed', stopped: 'Stopped' };
export const MAX_NOTE = 200;                              // what LinkedIn allows in an invitation note
export const HARD_CAPS = { invites: 20, messages: 40 };    // per account per day; never exceeded whatever the settings say
export const DAYS_AFTER = { follow1: 1, follow2: 4 };      // follow-up 1 a day after they accept; follow-up 2 four days after follow-up 1
export const WORK_HOURS = [8, 18];                         // the person's own time: from 08:00 until 18:00
export const MIN_GAP_MS = 4 * 60_000;                      // between two sends from one account (the scheduler runs every ten minutes; this adds a random pause)

const DAY = 86400_000;

/** The hour (0-23) and weekday (0 = Sunday) in a time zone, from an instant. An unknown zone falls back to UTC. */
export function localTime(now, tz = 'UTC') {
  let parts;
  try { parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(now)); }
  catch { parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(now)); }
  const hour = Number(parts.find(p => p.type === 'hour').value), wd = parts.find(p => p.type === 'weekday').value;
  return { hour, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd) };
}

/** Business hours on a weekday, in the person's time zone. */
export function inWorkHours(now, tz) { const { hour, weekday } = localTime(now, tz); return weekday >= 1 && weekday <= 5 && hour >= WORK_HOURS[0] && hour < WORK_HOURS[1]; }

/** The caps for one account today: what the person chose, never above the hard limits. */
export const capsFor = profile => ({ invites: Math.min(HARD_CAPS.invites, Math.max(1, Number(profile?.inviteCap ?? profile?.invite_cap) || 15)), messages: HARD_CAPS.messages });

/** Cuts an invitation note to what LinkedIn accepts: whole sentences while they fit, else at a word. */
export function fitNote(text, max = MAX_NOTE) {
  const t = String(text || '').replace(/\s+/g, ' ').trim(); if (t.length <= max) return t;
  const parts = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [t]; let out = '';
  for (const p of parts) { if ((out + p).trim().length > max) break; out += p; }
  if (out.trim()) return out.trim();
  const cut = t.slice(0, max); return cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).trim();
}

/** The three rows a lead gets when its sequence is drafted. They wait for approval unless the person turned automatic sending on. */
export function sequenceRows({ lead, drafts, accountId = null, auto = false, now = Date.now() }) {
  const text = { invite: fitNote(drafts.invite), follow1: String(drafts.follow1 || '').trim().slice(0, 2000), follow2: String(drafts.follow2 || '').trim().slice(0, 2000) };
  return STEPS.filter(s => text[s]).map(step => ({ lead_id: lead.id, account_id: accountId, step, text: text[step], status: auto ? 'approved' : 'draft', due_at: step === 'invite' && auto ? new Date(now).toISOString() : null }));
}

/** Approving a sequence: the invitation may go now; the follow-ups wait for the acceptance (their due date is set then). */
export function approvePatch(step, now = Date.now()) { return { status: 'approved', due_at: step === 'invite' ? new Date(now).toISOString() : null }; }

/** When a follow-up becomes due after an acceptance, or after the previous follow-up, with a little jitter so messages never land on the minute. */
export function followDue(step, from, rand = Math.random) { return new Date(Date.parse(from) + DAYS_AFTER[step] * DAY + Math.floor(rand() * 3 * 3600_000)).toISOString(); }

/**
 * What may be sent now. `rows` are approved outreach rows that are due; `accounts` the connected accounts of the user (status 'connected');
 * `today` counts what each account already sent today: { [accountId]: { invites, messages } }; `last` the time of each account's latest send.
 * One message per account per run, the least-used account first (so several accounts take turns), inside the caps and the working hours.
 * Returns [{ row, accountId }].
 */
export function planSends({ rows, accounts, today = {}, last = {}, profile, now = Date.now(), rand = Math.random }) {
  if (!inWorkHours(now, profile?.tz)) return [];
  const caps = capsFor(profile), used = a => (today[a.id]?.invites || 0) + (today[a.id]?.messages || 0), plan = [];
  const taken = new Set(), count = {};
  const live = accounts.filter(a => a.status === 'connected');
  const due = rows.filter(r => r.status === 'approved' && r.due_at && Date.parse(r.due_at) <= now).sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  for (const row of due) {
    const kind = row.step === 'invite' ? 'invites' : 'messages';
    // a follow-up goes from the account that sent the invitation; an invitation goes from the account with the most room
    const pool = row.account_id && row.step !== 'invite' ? live.filter(a => a.id === row.account_id) : live;
    const choices = pool.filter(a => !taken.has(a.id) && ((today[a.id]?.[kind] || 0) + (count[`${a.id}:${kind}`] || 0)) < caps[kind]
      && now - (last[a.id] ? Date.parse(last[a.id]) : 0) >= MIN_GAP_MS * (1 + rand())).sort((a, b) => used(a) - used(b));
    const account = choices[0]; if (!account) continue;
    taken.add(account.id); count[`${account.id}:${kind}`] = (count[`${account.id}:${kind}`] || 0) + 1; plan.push({ row, accountId: account.id });
  }
  return plan;
}

/** Funnel of the outreach rows, for the panel: invitations sent, accepted, replied. */
export function outreachStats(rows, leads) {
  const sent = rows.filter(r => r.step === 'invite' && r.status === 'sent').length;
  const ids = new Set(rows.filter(r => r.step === 'invite' && r.status === 'sent').map(r => r.lead_id));
  const mine = leads.filter(l => ids.has(l.id));
  return { waiting: rows.filter(r => r.step === 'invite' && r.status === 'draft').length, sent, accepted: mine.filter(l => l.connected_at || l.connectedAt).length, replied: mine.filter(l => l.status === 'replied' || l.status === 'customer').length };
}
