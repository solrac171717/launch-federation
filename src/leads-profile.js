// The business the leads are searched for: what it sells, to whom, in what tone, and the phrases people use when they want it.
// One per user. Kept in Supabase (table business_profiles) or, without an account, on this device.
import { h } from './dom.js';

export const PROFILE_EMPTY = { url: '', name: '', niche: '', audience: '', problem: '', tone: '', competitors: [], queries: [] };

const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const list = (v, n, len) => [...new Set((Array.isArray(v) ? v : []).map(x => t(x, len)).filter(Boolean))].slice(0, n);

/** One phrase per line (or comma separated), as typed in the settings box. */
export const queriesFromText = text => list(String(text || '').split(/\n|,/), 8, 60).filter(q => q.length >= 3 && q.split(' ').length <= 4);

export function cleanProfile(p) {
  return { url: t(p?.url, 300), name: t(p?.name, 80), niche: t(p?.niche, 200), audience: t(p?.audience, 200), problem: t(p?.problem, 240), tone: t(p?.tone, 60), competitors: list(p?.competitors, 4, 60), queries: list(p?.queries, 8, 60) };
}

export function createProfileStore(cloud, { owner = null, storage = globalThis.localStorage, key = 'ownedmap.profile.v1' } = {}) {
  if (!cloud) {
    return {
      async get() { try { const v = JSON.parse(storage.getItem(key) || 'null'); return v ? cleanProfile(v) : null; } catch { return null; } },
      async save(p) { const c = cleanProfile(p); storage.setItem(key, JSON.stringify(c)); return c; },
    };
  }
  const mine = owner ? { user_id: owner } : {};
  const fromRow = r => cleanProfile({ ...r, competitors: r.competitors || [], queries: r.queries || [] });
  return {
    async get() { const rows = await cloud.rest('GET', `/business_profiles?${owner ? `user_id=eq.${encodeURIComponent(owner)}&` : ''}select=*&limit=1`); return rows[0] ? fromRow(rows[0]) : null; },
    async save(p) {
      const c = cleanProfile(p);
      const [r] = await cloud.rest('POST', '/business_profiles?on_conflict=user_id', { ...c, ...mine, updated_at: new Date().toISOString() }, { prefer: 'resolution=merge-duplicates,return=representation' });
      return fromRow(r);
    },
  };
}

/** The settings form: what we understood about the business, editable, and a way to read the website again. */
export function profileForm(p, { onSave, onReanalyze, message }) {
  const field = (id, label, value, { area = false, hint = '' } = {}) => h('div', { class: 'field' }, h('label', { for: id }, label),
    area ? h('textarea', { id, rows: 4, maxlength: 600 }, value) : h('input', { id, type: 'text', maxlength: 240, value }), hint ? h('p', { class: 'hint' }, hint) : null);
  const err = h('p', { class: 'err', role: 'alert' });
  const form = h('form', { class: 'asset-form profile-form', novalidate: true },
    field('pf-name', 'Business name', p.name), field('pf-niche', 'What you sell', p.niche), field('pf-audience', 'Who buys it', p.audience), field('pf-problem', 'The pain it removes', p.problem), field('pf-tone', 'The tone of your replies', p.tone, { hint: 'For example: friendly and direct.' }),
    field('pf-comp', 'Competitors people complain about', p.competitors.join(', '), { hint: 'Separate them with commas.' }),
    field('pf-queries', 'What people write when they want it', p.queries.join('\n'), { area: true, hint: 'One short phrase per line (a category, a task or a rival, one to three words, in English), for example: invoicing software. Every word must appear in a post for it to match.' }),
    err,
    h('div', { class: 'modal-actions am-left' },
      h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, 'Save'),
      h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: async () => {
        const url = form.querySelector('#pf-url').value.trim(); if (!url) { err.textContent = 'Type your website address first.'; return; }
        err.textContent = ''; try { await onReanalyze(url); } catch (e) { err.textContent = message(e); }
      } }, 'Read my website again')),
    h('div', { class: 'field' }, h('label', { for: 'pf-url' }, 'Your website'), h('input', { id: 'pf-url', type: 'text', maxlength: 300, value: p.url, placeholder: 'yourbusiness.com' })));
  form.addEventListener('submit', e => {
    e.preventDefault(); const v = id => form.querySelector(id).value;
    const next = { url: v('#pf-url'), name: v('#pf-name'), niche: v('#pf-niche'), audience: v('#pf-audience'), problem: v('#pf-problem'), tone: v('#pf-tone'), competitors: v('#pf-comp').split(','), queries: queriesFromText(v('#pf-queries')) };
    if (!t(next.niche, 200)) { err.textContent = 'Say what you sell, in a few words.'; return; }
    if (next.queries.length < 2) { err.textContent = 'Add at least two short phrases, one to four words each.'; return; }
    err.textContent = ''; onSave(next);
  });
  return form;
}
