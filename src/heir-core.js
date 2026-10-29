// Trusted person: the rules for when the emergency sheet is open, and the emails around it. Pure functions, used by the server and the app.
export const DAY = 86400000;
export const INACTIVE_OPTIONS = [30, 60, 90, 180, 365];
export const WARN_DAYS = 14; // the owner is warned this many days before it opens

/**
 * Is the sheet open right now? It opens when the owner released it, or when the owner has not been seen for `inactive_days`.
 * A paused (disabled) setup is never open. Pure: `now` is a timestamp in ms.
 */
export function heirStatus(row, now = Date.now()) {
  if (!row) return { state: 'none' };
  const last = Date.parse(row.last_seen_at ?? row.lastSeenAt), days = Number(row.inactive_days ?? row.days);
  const opensAt = last + days * DAY, warnAt = opensAt - WARN_DAYS * DAY, releasedAt = row.released_at ?? row.releasedAt;
  if (!row.enabled) return { state: 'paused', opensAt };
  if (releasedAt) return { state: 'open', reason: 'owner', opensAt };
  if (now >= opensAt) return { state: 'open', reason: 'inactive', opensAt };
  return { state: 'waiting', opensAt, warnAt, daysLeft: Math.ceil((opensAt - now) / DAY), warn: now >= warnAt };
}

const day = ms => new Date(ms).toISOString().slice(0, 10);
const site = u => (u ? String(u).replace(/\/$/, '') : '');

/** Email to the owner: you have not been seen for a while, here is the date it opens and how to stop it. */
export function warningEmail({ contactName, opensAt, days, appUrl = '' }) {
  const when = day(opensAt), link = site(appUrl) ? `${site(appUrl)}/app.html` : '';
  const text = `We have not seen you in Owned Map for a while.\n\nYou chose ${contactName} as your trusted person. If you do not sign in before ${when}, they will be able to open your emergency sheet (your assets, where they are, your contacts and the names of your documents). It opens after ${days} days without a visit.\n\n${link ? `To keep it closed, just sign in: ${link}\n\n` : 'To keep it closed, just sign in to Owned Map.\n\n'}If this is expected, you can ignore this message. You can pause or change this at any time under Reports, Trusted person.`;
  return { subject: 'Your trusted person will be able to open your emergency sheet soon', text, html: `<p>${esc(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>` };
}

/** Email to the trusted person when it opens. It never contains the link: they already hold it. */
export function openNotice({ ownerEmail, contactName }) {
  const text = `Hello ${contactName},\n\n${ownerEmail} chose you as a trusted person on Owned Map. The emergency sheet they prepared for you is now open.\n\nUse the private link they gave you. If you do not have it, ask the people close to them, or contact them directly.\n\nThis message is sent automatically. If you do not know ${ownerEmail}, you can ignore it.`;
  return { subject: 'The emergency sheet you were given is now open', text, html: `<p>${esc(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>` };
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
