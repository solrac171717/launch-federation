// Household access: the owner invites a partner or family member as "can view" or "can edit"; the invited person joins from a private link.
// The rules are enforced by the database (supabase/migrations/20261101000000_household_access.sql), not by this file:
// hiding a button is only a courtesy, a read-only member cannot write even by calling the database directly.
import { h } from './dom.js';
import { makeToken, sha256Hex } from './app-share.js';

export const ROLES = { view: 'Can view', edit: 'Can edit' };
export const ROLE_HELP = { view: 'Sees everything in your portfolio, changes nothing.', edit: 'Can add, change and delete assets, documents and reminders.' };
export const INVITE_DAYS = 7;

export const inviteUrl = (token, origin = location.origin) => `${origin}/app.html#invite=${token}`;
/** The secret of an invite link, or null. */
export const inviteTokenOf = (hash = '') => { const m = /(?:^#|&)invite=([A-Za-z0-9_-]{43})(?:&|$)/.exec(hash); return m ? m[1] : null; };
export const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

/** What a member may see and do in somebody else's account. The owner (or a device without an account) can do everything. */
export function accessFor(role) {
  const edit = role === 'owner' || role === 'edit';
  return { edit, docs: edit, share: role === 'owner', emergency: role === 'owner', welcome: role === 'owner', sample: role === 'owner' };
}

const fromDb = r => ({ id: r.id, email: r.email, role: r.role, status: r.status, memberId: r.member_id, expiresAt: r.invite_expires_at, createdAt: r.created_at });
export const inviteState = (m, now = Date.now()) => (m.status === 'active' ? 'active' : m.expiresAt && Date.parse(m.expiresAt) <= now ? 'expired' : 'pending');
const day = iso => (iso ? String(iso).slice(0, 10) : '');

/** Accounts shared with the signed-in user: [{ ownerId, ownerEmail, role }]. Empty when the feature is not set up yet. */
export async function loadShared(cloud) {
  const me = cloud.user()?.id; if (!me) return [];
  try {
    const rows = await cloud.rest('GET', `/account_members?member_id=eq.${encodeURIComponent(me)}&status=eq.active&select=owner_id,owner_email,role&order=created_at.asc`);
    return rows.map(r => ({ ownerId: r.owner_id, ownerEmail: r.owner_email, role: r.role }));
  } catch { return []; }
}

const ACCOUNT_KEY = uid => `atlas.account.v1:${uid}`;
export const savedAccount = (uid, storage = globalThis.localStorage) => { try { return storage.getItem(ACCOUNT_KEY(uid)) || ''; } catch { return ''; } };
export const saveAccount = (uid, ownerId, storage = globalThis.localStorage) => { try { ownerId && ownerId !== uid ? storage.setItem(ACCOUNT_KEY(uid), ownerId) : storage.removeItem(ACCOUNT_KEY(uid)); } catch { /* the choice just is not remembered */ } };

/** Which account to open: the remembered one if the user still has access to it, otherwise their own. */
export function pickAccount(uid, email, shared, remembered) {
  const s = shared.find(x => x.ownerId === remembered);
  return s ? { ownerId: s.ownerId, ownerEmail: s.ownerEmail, role: s.role, mine: false } : { ownerId: uid, ownerEmail: email, role: 'owner', mine: true };
}

/** ctx: { cloud, openModal, modal, toast, run, message } */
export function createMembersUi(ctx) {
  const { cloud, openModal, modal, toast, run, message } = ctx;
  const list = async () => (await cloud.rest('GET', `/account_members?owner_id=eq.${encodeURIComponent(cloud.user().id)}&select=id,email,role,status,member_id,invite_expires_at,created_at&order=created_at.desc`)).map(fromDb);

  async function open() {
    let members = [];
    try { members = await list(); } catch (e) { toast(`Could not load household access: ${message(e)}. Has the latest database update been applied?`, 'err'); return; }
    draw(members, null);
  }

  function draw(members, fresh) {
    const email = h('input', { id: 'hm-email', type: 'email', placeholder: 'partner@email.com', autocomplete: 'off', inputmode: 'email' });
    const role = h('select', { id: 'hm-role' }, ...Object.entries(ROLES).map(([k, t]) => h('option', { value: k }, t)));
    const help = h('p', { class: 'hint' }, ROLE_HELP.view);
    role.addEventListener('change', () => { help.textContent = ROLE_HELP[role.value]; });
    const err = h('p', { class: 'err form-err', role: 'alert' });
    const create = h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, h('span', { class: 'lbl' }, 'Create invitation'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
    const form = h('form', { class: 'asset-form share-form', novalidate: true },
      h('div', { class: 'two' },
        h('div', { class: 'field' }, h('label', { for: 'hm-email' }, 'Their email'), email, h('p', { class: 'hint' }, 'They will use this email to sign in.')),
        h('div', { class: 'field' }, h('label', { for: 'hm-role' }, 'Access'), role, help)),
      err, h('div', { class: 'modal-actions' }, create));
    form.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      const mail = email.value.trim().toLowerCase();
      if (!validEmail(mail)) { err.textContent = 'Enter a valid email address.'; email.focus(); return; }
      if (mail === (cloud.user()?.email || '').toLowerCase()) { err.textContent = 'That is your own email.'; return; }
      if (members.some(m => m.email === mail)) { err.textContent = 'That person already has an invitation. Remove it first to send a new one.'; return; }
      create.disabled = true; create.classList.add('busy');
      try {
        const token = makeToken(), hash = await sha256Hex(token);
        const [row] = await cloud.rest('POST', '/account_members', { email: mail, role: role.value, invite_hash: hash, invite_expires_at: new Date(Date.now() + INVITE_DAYS * 86400000).toISOString() }, { prefer: 'return=representation' });
        draw([fromDb(row), ...members], { url: inviteUrl(token), email: mail });
      } catch (x) { err.textContent = `Could not create the invitation: ${message(x)}`; create.disabled = false; create.classList.remove('busy'); }
    });

    const copy = h('button', { type: 'button', class: 'btn btn-primary btn-sm' }, 'Copy link');
    const box = fresh ? h('div', { class: 'share-new', role: 'status' },
      h('b', {}, `Invitation for ${fresh.email}`),
      h('p', { class: 'hint' }, `Send them this link yourself (message or email). It works once, for ${INVITE_DAYS} days, and it is shown only now. They choose their own password; you never see it.`),
      h('div', { class: 'share-url' }, h('input', { type: 'text', readonly: true, value: fresh.url, 'aria-label': 'Invitation link', onfocus: e => e.target.select() }), copy)) : null;
    if (box) copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(fresh.url); copy.textContent = 'Copied'; } catch { box.querySelector('input').select(); toast('Press Ctrl+C to copy.'); } });

    const setRole = async (m, value) => {
      if (!(await run('Could not change the access', async () => { await cloud.rest('PATCH', `/account_members?id=eq.${encodeURIComponent(m.id)}`, { role: value }); return true; }))) return;
      toast(`${m.email} now ${ROLES[value].toLowerCase()}.`); draw(members.map(x => (x.id === m.id ? { ...x, role: value } : x)), null);
    };
    const remove = async m => {
      if (!(await run('Could not remove', async () => { await cloud.rest('DELETE', `/account_members?id=eq.${encodeURIComponent(m.id)}`); return true; }))) return;
      toast(m.status === 'active' ? 'Access removed. They can no longer open your portfolio.' : 'Invitation cancelled.'); draw(members.filter(x => x.id !== m.id), null);
    };
    const row = m => {
      const st = inviteState(m);
      const sel = h('select', { class: 'mini-sel', 'aria-label': `Access for ${m.email}`, onchange: e => setRole(m, e.target.value) }, ...Object.entries(ROLES).map(([k, t]) => h('option', { value: k }, t)));
      sel.value = m.role;
      return h('li', { class: `sh-row ${st === 'active' ? 'active' : st === 'pending' ? 'active' : 'expired'}` },
        h('div', { class: 'sh-main' }, h('b', {}, m.email), h('span', {}, st === 'active' ? 'Has joined' : st === 'pending' ? `Invitation sent ${day(m.createdAt)}, valid until ${day(m.expiresAt)}` : `Invitation expired ${day(m.expiresAt)}`)),
        h('span', { class: `sh-st ${st === 'expired' ? 'expired' : 'active'}` }, st === 'active' ? 'Active' : st === 'pending' ? 'Waiting' : 'Expired'),
        h('div', { class: 'rem-act' }, sel, h('button', { type: 'button', class: 'mini-btn danger', onclick: () => remove(m) }, st === 'active' ? 'Remove access' : 'Cancel')));
    };

    openModal(h('div', { class: 'modal-card wide' },
      h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, 'Household access'), h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')),
      h('p', { class: 'modal-text' }, 'Let your partner or family open your portfolio with their own sign-in. Choose whether they can only look, or also make changes. You can remove access at any time, and it stops at once.'),
      box, form,
      members.length ? h('section', { class: 'xt-sec' }, h('h3', {}, 'People with access'), h('ul', { class: 'sh-list' }, members.map(row))) : null,
      h('p', { class: 'hint' }, 'Members cannot create share links, invite others or print your emergency sheet. Each person sees the shared portfolio in their own account, next to their own.')));
  }
  return { open };
}
