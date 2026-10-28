// Read-only sharing: the owner creates a private link for an accountant or partner and can revoke it at any time.
// The link carries a random secret in the URL hash (it is never sent to our servers in the page address);
// only a SHA-256 hash of the secret is stored, so even a database leak does not expose working links.
import { h } from './dom.js';

const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const makeToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const shareUrl = (token, origin = location.origin) => `${origin}/share.html#t=${token}`;

const EXPIRY = { 7: '7 days', 30: '30 days', 90: '90 days', 365: '1 year' };
const fromDb = r => ({ id: r.id, label: r.label, includeDebt: !!r.include_debt, expiresAt: r.expires_at, revoked: !!r.revoked, lastViewedAt: r.last_viewed_at, createdAt: r.created_at });
export const shareState = (s, now = Date.now()) => (s.revoked ? 'revoked' : s.expiresAt && Date.parse(s.expiresAt) <= now ? 'expired' : 'active');
const day = iso => (iso ? String(iso).slice(0, 10) : '');

/** ctx: { cloud, openModal, modal, toast, run, message } */
export function createShareUi(ctx) {
  const { cloud, openModal, modal, toast, run, message } = ctx;
  const list = async () => (await cloud.rest('GET', '/asset_shares?select=id,label,include_debt,expires_at,revoked,last_viewed_at,created_at&order=created_at.desc')).map(fromDb);

  async function open() {
    let shares = [];
    try { shares = await list(); } catch (e) { toast(`Could not load your links: ${message(e)}`, 'err'); return; }
    draw(shares, null);
  }

  function draw(shares, fresh) {
    const label = h('input', { id: 'sh-label', type: 'text', maxlength: 60, placeholder: 'e.g. My accountant', autocomplete: 'off' });
    const expiry = h('select', { id: 'sh-exp' }, ...Object.entries(EXPIRY).map(([d, t]) => h('option', { value: d }, `Expires in ${t}`)), h('option', { value: '' }, 'Never expires'));
    expiry.value = '30';
    const debt = h('input', { id: 'sh-debt', type: 'checkbox', checked: true });
    const err = h('p', { class: 'err form-err', role: 'alert' });
    const create = h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, h('span', { class: 'lbl' }, 'Create link'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
    const form = h('form', { class: 'asset-form share-form', novalidate: true },
      h('div', { class: 'field' }, h('label', { for: 'sh-label' }, 'Who is it for?'), label, h('p', { class: 'hint' }, 'Only a name to help you remember. They are not notified.')),
      h('div', { class: 'two' },
        h('div', { class: 'field' }, h('label', { for: 'sh-exp' }, 'Access'), expiry),
        h('div', { class: 'field' }, h('span', { class: 'lab' }, 'Includes'), h('label', { class: 'check' }, debt, h('span', {}, 'Debt and net worth')), h('p', { class: 'hint' }, 'Assets, values, income and cash flow are always included. Notes, documents and reminders never are.'))),
      err, h('div', { class: 'modal-actions' }, create));
    form.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      const name = label.value.trim(); if (!name) { err.textContent = 'Give the link a name, for example “My accountant”.'; label.focus(); return; }
      create.disabled = true; create.classList.add('busy');
      try {
        const token = makeToken(), hash = await sha256Hex(token);
        const days = expiry.value ? Number(expiry.value) : null;
        const [row] = await cloud.rest('POST', '/asset_shares', { label: name, token_hash: hash, include_debt: debt.checked, expires_at: days ? new Date(Date.now() + days * 86400000).toISOString() : null }, { prefer: 'return=representation' });
        draw([fromDb(row), ...shares], shareUrl(token));
      } catch (x) { err.textContent = `Could not create the link: ${message(x)}`; create.disabled = false; create.classList.remove('busy'); }
    });

    const copy = h('button', { type: 'button', class: 'btn btn-primary btn-sm' }, 'Copy link');
    const box = fresh ? h('div', { class: 'share-new', role: 'status' },
      h('b', {}, 'Your link is ready'), h('p', { class: 'hint' }, 'Copy it now: for your security it is shown only once. Anyone who has it can see the shared figures, so send it like a password.'),
      h('div', { class: 'share-url' }, h('input', { type: 'text', readonly: true, value: fresh, 'aria-label': 'Share link', onfocus: e => e.target.select() }), copy)) : null;
    if (box) copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(fresh); copy.textContent = 'Copied'; } catch { box.querySelector('input').select(); toast('Press Ctrl+C to copy.'); } });

    const revoke = async s => {
      if (!(await run('Could not revoke the link', async () => { await cloud.rest('PATCH', `/asset_shares?id=eq.${encodeURIComponent(s.id)}`, { revoked: true }); return true; }))) return;
      toast('Link revoked. It stopped working.'); draw(shares.map(x => (x.id === s.id ? { ...x, revoked: true } : x)), null);
    };
    const remove = async s => {
      if (!(await run('Could not delete the link', async () => { await cloud.rest('DELETE', `/asset_shares?id=eq.${encodeURIComponent(s.id)}`); return true; }))) return;
      draw(shares.filter(x => x.id !== s.id), null);
    };
    const row = s => { const st = shareState(s); return h('li', { class: `sh-row ${st}` },
      h('div', { class: 'sh-main' }, h('b', {}, s.label), h('span', {}, `Created ${day(s.createdAt)} · ${s.expiresAt ? `expires ${day(s.expiresAt)}` : 'never expires'} · ${s.includeDebt ? 'with debt' : 'without debt'} · ${s.lastViewedAt ? `last opened ${day(s.lastViewedAt)}` : 'not opened yet'}`)),
      h('span', { class: `sh-st ${st}` }, st === 'active' ? 'Active' : st === 'revoked' ? 'Revoked' : 'Expired'),
      h('div', { class: 'rem-act' }, st === 'active' ? h('button', { type: 'button', class: 'mini-btn danger', onclick: () => revoke(s) }, 'Revoke') : h('button', { type: 'button', class: 'mini-btn', onclick: () => remove(s) }, 'Remove'))); };

    openModal(h('div', { class: 'modal-card wide' },
      h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, 'Share a read-only view'), h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')),
      h('p', { class: 'modal-text' }, 'Give your accountant, partner or lender a private link to see your portfolio. They cannot change anything and they do not need an account. You can revoke the link whenever you like.'),
      box, form,
      shares.length ? h('section', { class: 'xt-sec' }, h('h3', {}, 'Your links'), h('ul', { class: 'sh-list' }, shares.map(row))) : null));
  }
  return { open };
}
