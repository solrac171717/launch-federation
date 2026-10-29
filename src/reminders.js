// Reminders for things that expire or fall due on an asset (insurance, tax, inspection, registration...).
// Pure functions only: the browser and the daily email job share them, so both agree on what is "due".
export const REMINDER_KINDS = {
  insurance: { label: 'Insurance', title: 'Insurance renewal' },
  tax: { label: 'Tax', title: 'Property or vehicle tax' },
  inspection: { label: 'Inspection', title: 'Inspection or survey' },
  registration: { label: 'Registration', title: 'Registration renewal' },
  maintenance: { label: 'Maintenance', title: 'Service or maintenance' },
  other: { label: 'Other', title: '' },
};
/** The monthly reminder that nudges the owner to refresh an estimated value. */
export const UPDATE_TITLE = 'Update estimated value';
export const REPEATS = { none: 'Does not repeat', monthly: 'Every month', quarterly: 'Every 3 months', yearly: 'Every year' };
const MONTHS_OF = { monthly: 1, quarterly: 3, yearly: 12 };

const DAY = 86400000;
const ts = iso => Date.parse(`${iso}T00:00:00Z`);
export const isoDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
/** Whole days from `today` to `due` (negative when overdue). */
export const daysUntil = (due, today = isoDay()) => Math.round((ts(due) - ts(today)) / DAY);

/** The next due date for a repeating reminder (the day is clamped, e.g. Jan 31 + 1 month = Feb 28). */
export function nextDue(due, repeat) {
  const m = MONTHS_OF[repeat]; if (!m) return due;
  const [y, mo, d] = due.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1 + m, 1)), last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return isoDay(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)));
}

/** 'overdue' | 'soon' (inside the notice window) | 'upcoming' | 'done' */
export function statusOf(r, today = isoDay()) {
  if (r.done) return 'done';
  const d = daysUntil(r.dueOn, today);
  return d < 0 ? 'overdue' : d <= (r.notifyDays ?? 14) ? 'soon' : 'upcoming';
}
export function whenText(r, today = isoDay()) {
  const d = daysUntil(r.dueOn, today);
  if (d === 0) return 'Due today'; if (d === 1) return 'Due tomorrow'; if (d === -1) return 'Overdue by 1 day';
  return d < 0 ? `Overdue by ${-d} days` : `In ${d} days`;
}

export function validateReminder(input, { today = isoDay() } = {}) {
  const errors = {};
  const kind = REMINDER_KINDS[input.kind] ? input.kind : '';
  if (!kind) errors.kind = 'Choose a type.';
  const title = String(input.title || '').trim() || (kind ? REMINDER_KINDS[kind].title : '');
  if (!title) errors.title = 'Give the reminder a title.'; else if (title.length > 120) errors.title = 'Keep the title under 120 characters.';
  const dueOn = String(input.dueOn || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || Number.isNaN(ts(dueOn))) errors.dueOn = 'Pick the due date.';
  else if (dueOn < '2000-01-01' || dueOn > '2100-12-31') errors.dueOn = 'That date looks wrong.';
  const repeat = Object.hasOwn(REPEATS, input.repeat || 'none') ? (input.repeat || 'none') : '';
  if (!repeat) errors.repeat = 'Choose how often it repeats.';
  const nd = input.notifyDays === '' || input.notifyDays == null ? 14 : Number(input.notifyDays);
  if (!Number.isInteger(nd) || nd < 0 || nd > 90) errors.notifyDays = 'Use a whole number of days from 0 to 90.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, errors, value: { kind, title, dueOn, repeat, notifyDays: nd } };
}

/**
 * Should the daily job email this reminder today?
 * Once when it enters its notice window, once on the due date, then weekly while it stays overdue.
 */
export function shouldNotify(r, today = isoDay()) {
  if (r.done) return false;
  const d = daysUntil(r.dueOn, today);
  if (d > (r.notifyDays ?? 14)) return false;
  if (!r.lastNotifiedOn) return true;
  if (d > 0) return false;
  return r.lastNotifiedOn < r.dueOn || daysUntil(today, r.lastNotifiedOn) >= 7;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** One digest email for a person: items = [{ title, assetName, dueOn, kind }] */
export function digestEmail(items, { today = isoDay(), appUrl = '' } = {}) {
  const rows = items.map(i => ({ ...i, d: daysUntil(i.dueOn, today) })).sort((a, b) => a.d - b.d);
  const line = i => `${i.title} (${i.assetName}): ${i.d < 0 ? `overdue by ${-i.d} day${i.d === -1 ? '' : 's'}` : i.d === 0 ? 'due today' : `due in ${i.d} day${i.d === 1 ? '' : 's'}`} (${i.dueOn})`;
  const subject = rows.some(i => i.d < 0) ? `Owned Map: ${rows.length} reminder${rows.length > 1 ? 's' : ''}, some overdue` : `Owned Map: ${rows.length} upcoming reminder${rows.length > 1 ? 's' : ''}`;
  const text = `Here is what needs your attention:\n\n${rows.map(line).join('\n')}\n\n${appUrl ? `Open Owned Map: ${appUrl}\n\n` : ''}You are getting this because you set reminders in Owned Map. You can mark them done or delete them in the app.`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0A0F1F"><h2 style="margin:0 0 12px">Reminders from Owned Map</h2><ul style="padding-left:18px;line-height:1.6">${rows.map(i => `<li><b>${esc(i.title)}</b> (${esc(i.assetName)})<br><span style="color:${i.d < 0 ? '#B91C1C' : '#475569'}">${esc(line(i).split('): ')[1])}</span></li>`).join('')}</ul>${appUrl ? `<p><a href="${esc(appUrl)}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open Owned Map</a></p>` : ''}<p style="color:#64748B;font-size:13px">You are getting this because you set reminders in Owned Map. You can mark them done or delete them in the app.</p></div>`;
  return { subject, text, html };
}

/* ------------------------------------------------------------------ the usual reminders for each kind of asset */
const PROPERTY = [
  { kind: 'insurance', title: 'Property insurance renewal', repeat: 'yearly', inDays: 60 },
  { kind: 'tax', title: 'Property tax', repeat: 'yearly', inDays: 90 },
  { kind: 'maintenance', title: 'Annual safety and maintenance check', repeat: 'yearly', inDays: 120 },
];
const VEHICLE = [
  { kind: 'insurance', title: 'Vehicle insurance renewal', repeat: 'yearly', inDays: 60 },
  { kind: 'inspection', title: 'Roadworthiness inspection (ITV / MOT / state inspection)', repeat: 'yearly', inDays: 90 },
  { kind: 'registration', title: 'Registration and road tax renewal', repeat: 'yearly', inDays: 120 },
  { kind: 'maintenance', title: 'Service', repeat: 'yearly', inDays: 150 },
];
const VESSEL = [
  { kind: 'insurance', title: 'Boat insurance renewal', repeat: 'yearly', inDays: 60 },
  { kind: 'inspection', title: 'Annual survey or safety inspection', repeat: 'yearly', inDays: 90 },
  { kind: 'registration', title: 'Registration and mooring fees', repeat: 'yearly', inDays: 120 },
  { kind: 'maintenance', title: 'Engine and hull service', repeat: 'yearly', inDays: 150 },
];
const STANDARD = {
  house: PROPERTY, office: PROPERTY, warehouse: PROPERTY,
  parking: PROPERTY.slice(0, 2), land: [{ kind: 'tax', title: 'Land tax', repeat: 'yearly', inDays: 90 }, { kind: 'insurance', title: 'Liability insurance renewal', repeat: 'yearly', inDays: 60 }],
  car: VEHICLE, truck: VEHICLE, motorcycle: VEHICLE, rv: VEHICLE,
  yacht: VESSEL, sailboat: VESSEL, jetski: VESSEL,
  aircraft: [
    { kind: 'insurance', title: 'Aircraft insurance renewal', repeat: 'yearly', inDays: 60 },
    { kind: 'inspection', title: 'Annual inspection', repeat: 'yearly', inDays: 90 },
    { kind: 'registration', title: 'Registration and airworthiness certificate', repeat: 'yearly', inDays: 120 },
    { kind: 'maintenance', title: 'Maintenance and avionics check', repeat: 'yearly', inDays: 150 },
  ],
  equipment: [
    { kind: 'insurance', title: 'Equipment insurance renewal', repeat: 'yearly', inDays: 60 },
    { kind: 'inspection', title: 'Safety inspection', repeat: 'yearly', inDays: 90 },
    { kind: 'maintenance', title: 'Scheduled service', repeat: 'yearly', inDays: 150 },
  ],
};
/**
 * The reminders people usually need for this kind of asset, skipping any whose title already exists on it.
 * The real dates are not known, so each comes with a placeholder date the person is asked to correct.
 * @returns {Array<{ kind, title, repeat, dueOn }>}
 */
export function standardFor(type, existing = [], today = isoDay()) {
  const have = new Set(existing.map(r => String(r.title).trim().toLowerCase()));
  return (STANDARD[type] || []).filter(s => !have.has(s.title.toLowerCase())).map(({ inDays, ...s }) => ({ ...s, dueOn: isoDay(ts(today) + inDays * DAY) }));
}
