// Trusted person (owner side): choose who receives the emergency sheet if you cannot, and after how long without a visit.
// The person has no account. They get a private link that does nothing until the sheet opens (see src/heir-core.js, api/heir.js).
// Only a SHA-256 hash of the link's secret is stored, so even a database leak does not expose a working link.
import { CONFIG } from '../assets/config.js';
import { h } from './dom.js';
import { makeToken, sha256Hex } from './app-share.js';
import { INACTIVE_OPTIONS, heirStatus, WARN_DAYS } from './heir-core.js';
import { validEmail } from './app-members.js';

export const heirUrl = (token, origin = location.origin) => `${origin}/heir.html#t=${token}`;
const fromDb = r => (r ? { name: r.contact_name, email: r.contact_email || '', days: r.inactive_days, enabled: !!r.enabled, lastSeenAt: r.last_seen_at, warnedAt: r.warned_at, releasedAt: r.released_at, notifiedAt: r.notified_at, openedAt: r.opened_at, openedCount: r.opened_count || 0 } : null);
export const daysText = d => (d === 365 ? '1 year' : `${d} days`);
const day = iso => (iso ? String(iso).slice(0, 10) : '');
const dayOfMs = ms => new Date(ms).toISOString().slice(0, 10);

/** What the person will be able to see, in plain words. Shown before anything is created. */
export const SHARED_LIST = ['your assets, where they are and their estimated values and debts', 'the names of your documents (never the files themselves)', 'your upcoming reminders', 'the emergency contacts and the note you wrote'];

/** ctx: { cloud, openModal, modal, toast, run, message } */
export function createHeirUi(ctx) {
  const { cloud, openModal, modal, toast, run, message } = ctx;
  const me = () => cloud.user().id;
  const load = async () => fromDb((await cloud.rest('GET', '/emergency_access?select=*'))[0]);
  const patch = body => cloud.rest('PATCH', `/emergency_access?user_id=eq.${encodeURIComponent(me())}`, { ...body, updated_at: new Date().toISOString() });

  /** A visit of the owner closes the sheet again. Returns what was stored before the visit, or null (none, or the feature is not set up yet). */
  async function touch() {
    try {
      const before = await load(); if (!before) return null;
      await cloud.rest('PATCH', `/emergency_access?user_id=eq.${encodeURIComponent(me())}`, { last_seen_at: new Date().toISOString(), warned_at: null, notified_at: null });
      return before;
    } catch { return null; }
  }

  async function open() {
    let row; try { row = await load(); } catch (e) { toast(`Could not load this: ${message(e)}. Has the latest database update been applied?`, 'err'); return; }
    draw(row, null);
  }

  function draw(row, fresh) {
    const intro = h('p', { class: 'modal-text' }, 'Choose one person who can open your emergency sheet if you cannot. It opens only after you have not signed in for the time you pick, or when you release it yourself. Any visit of yours closes it again.');
    const sees = h('div', { class: 'hr-sees' }, h('b', {}, 'What they will be able to see'), h('ul', {}, SHARED_LIST.map(t => h('li', {}, t))), h('p', { class: 'hint' }, 'They cannot sign in, change anything or download your files. This is not a will and it does not transfer ownership of anything.'));

    const copy = h('button', { type: 'button', class: 'btn btn-primary btn-sm' }, 'Copy link');
    const box = fresh ? h('div', { class: 'share-new', role: 'status' },
      h('b', {}, `Private link for ${row.name}`),
      h('p', { class: 'hint' }, 'Give it to them now (or keep it with your important papers). It is shown only once and it opens nothing until the time you chose has passed.'),
      h('div', { class: 'share-url' }, h('input', { type: 'text', readonly: true, value: fresh, 'aria-label': 'Private link', onfocus: e => e.target.select() }), copy)) : null;
    if (box) copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(fresh); copy.textContent = 'Copied'; } catch { box.querySelector('input').select(); toast('Press Ctrl+C to copy.'); } });

    const name = h('input', { id: 'hr-name', type: 'text', maxlength: 80, autocomplete: 'off', placeholder: 'e.g. Maria, my sister', value: row?.name || '' });
    const email = h('input', { id: 'hr-email', type: 'email', autocomplete: 'off', placeholder: 'optional', value: row?.email || '' });
    const days = h('select', { id: 'hr-days' }, ...INACTIVE_OPTIONS.map(d => h('option', { value: String(d) }, `After ${daysText(d)} without a visit`)));
    days.value = String(row?.days || 90);
    const consent = h('input', { id: 'hr-consent', type: 'checkbox' });
    const err = h('p', { class: 'err form-err', role: 'alert' });
    const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, h('span', { class: 'lbl' }, row ? 'Save changes' : 'Create private link'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
    const form = h('form', { class: 'asset-form share-form', novalidate: true },
      h('div', { class: 'two' },
        h('div', { class: 'field' }, h('label', { for: 'hr-name' }, 'Who is it for?'), name),
        h('div', { class: 'field' }, h('label', { for: 'hr-email' }, 'Their email'), email, h('p', { class: 'hint' }, 'Only used to tell them, once, that it is open. The link is never emailed.'))),
      h('div', { class: 'field' }, h('label', { for: 'hr-days' }, 'When does it open?'), days, CONFIG.remindersEmail ? h('p', { class: 'hint' }, `We email you ${WARN_DAYS} days before, so you can stop it by signing in.`) : h('p', { class: 'hint warn' }, 'Email is not set up on this site yet, so you would not get a warning before it opens. Sign in now and then to keep it closed.')),
      row ? null : h('div', { class: 'field' }, h('label', { class: 'check', for: 'hr-consent' }, consent, h('span', {}, 'I understand that, after that time without a visit, this person will be able to see the details above.'))),
      err, h('div', { class: 'modal-actions' }, submit));
    form.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      const n = name.value.trim(), m = email.value.trim().toLowerCase();
      if (!n) { err.textContent = 'Write who it is for.'; name.focus(); return; }
      if (m && !validEmail(m)) { err.textContent = 'That email does not look right. Leave it empty if you prefer.'; email.focus(); return; }
      if (!row && !consent.checked) { err.textContent = 'Please confirm that you understand what they will be able to see.'; return; }
      submit.disabled = true; submit.classList.add('busy');
      try {
        if (row) { await patch({ contact_name: n, contact_email: m || null, inactive_days: Number(days.value) }); draw({ ...row, name: n, email: m, days: Number(days.value) }, null); toast('Saved.'); return; }
        const token = makeToken(), hash = await sha256Hex(token);
        const [r] = await cloud.rest('POST', '/emergency_access', { contact_name: n, contact_email: m || null, inactive_days: Number(days.value), token_hash: hash }, { prefer: 'return=representation' });
        draw(fromDb(r), heirUrl(token));
      } catch (x) { err.textContent = `Could not save: ${message(x)}`; submit.disabled = false; submit.classList.remove('busy'); }
    });

    const act = (label, fn, ok, kind = 'mini-btn') => h('button', { type: 'button', class: kind, onclick: async () => { if (await run(label, async () => { await fn(); return true; })) { if (ok) toast(ok); draw(await load(), null); } } }, label);
    let status = null;
    if (row) {
      const st = heirStatus(row);
      const line = st.state === 'open' ? (st.reason === 'owner' ? 'Open now: you released it. Anyone who has the link can read the sheet.' : 'Open now: you have not signed in for the time you chose. Signing in again closes it.')
        : st.state === 'paused' ? 'Paused. Nothing will open.'
        : `Closed. It would open on ${dayOfMs(st.opensAt)} if you do not sign in before then (${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'}).`;
      status = h('section', { class: 'xt-sec hr-status' },
        h('h3', {}, `Your trusted person: ${row.name}`),
        h('p', { class: `hr-line ${st.state}` }, line),
        h('p', { class: 'hint' }, row.openedAt ? `They opened it on ${day(row.openedAt)}${row.openedCount > 1 ? ` (${row.openedCount} times)` : ''}.` : 'They have not opened it.', ` Your last visit: ${day(row.lastSeenAt)}.`),
        h('div', { class: 'rem-act' },
          act(row.enabled ? 'Pause' : 'Resume', () => patch({ enabled: !row.enabled }), row.enabled ? 'Paused. Nothing will open.' : 'Resumed.'),
          act(row.releasedAt ? 'Close it again' : 'Release it now', () => patch({ released_at: row.releasedAt ? null : new Date().toISOString() }), row.releasedAt ? 'Closed again.' : 'Released. Anyone with the link can now read the sheet.'),
          h('button', { type: 'button', class: 'mini-btn', onclick: async () => {
            const token = makeToken();
            if (await run('Could not renew the link', async () => { await patch({ token_hash: await sha256Hex(token), opened_at: null, opened_count: 0, notified_at: null }); return true; })) draw(await load(), heirUrl(token));
          } }, 'New link'),
          h('button', { type: 'button', class: 'mini-btn danger', onclick: async () => {
            if (await run('Could not remove it', async () => { await cloud.rest('DELETE', `/emergency_access?user_id=eq.${encodeURIComponent(me())}`); return true; })) { toast('Removed. The link stopped working.'); draw(null, null); }
          } }, 'Remove')),
        h('p', { class: 'hint' }, '“New link” stops the old one and shows you a new one.'));
    }

    openModal(h('div', { class: 'modal-card wide' },
      h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, 'Trusted person'), h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')),
      intro, sees, box, status, h('section', { class: 'xt-sec' }, h('h3', {}, row ? 'Change the person or the time' : 'Set it up'), form),
      h('p', { class: 'hint' }, 'Check with a lawyer how this fits with your will and local rules. Owned Map is not a legal service.')));
  }
  return { open, touch, load };
}
