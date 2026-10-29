// Who gets which plan. The early-access product has no enforced limits yet, so today this decides the label shown in the app.
// When limits arrive, enforce them on the server (a check here is only a display hint) and read them through limitsFor().
export const SUPERADMINS = ['carlosmartinezhold@gmail.com'];

export const isSuperadmin = email => SUPERADMINS.includes(String(email || '').trim().toLowerCase());

export function planFor(email) {
  return isSuperadmin(email)
    ? { key: 'superadmin', label: 'Super admin', note: 'Unlimited assets, documents, reminders and share links' }
    : { key: 'early-access', label: 'Early access', note: '' };
}

export const limitsFor = email => (isSuperadmin(email)
  ? { assets: Infinity, documents: Infinity, reminders: Infinity, shares: Infinity }
  : { assets: Infinity, documents: Infinity, reminders: Infinity, shares: Infinity }); // not enforced yet: every account is unrestricted during early access
