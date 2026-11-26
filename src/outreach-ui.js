// The Outreach screen: the LinkedIn accounts the person connected, the messages waiting for their approval, and what has gone out.
// The browser only edits and approves drafts (Row Level Security keeps it to the person's own rows); the server sends them (api/tick.js).
import { h, clear } from './dom.js';
import { STEPS, STEP_LABEL, OUTREACH_STATUS, MAX_NOTE, fitNote, approvePatch, outreachStats } from './outreach-core.js';
import { scorePill, snippet, ago } from './leads-view.js';

export function createOutreachUi({ cloud, getViews, getRaw, getProfile, run, toast, openLead, rerender, reloadLeads }) {
  let accounts = [], rows = [];
  const connected = () => accounts.filter(a => a.status === 'connected');

  async function load() {
    if (!cloud.configured || !cloud.session()) return;
    try {
      [accounts, rows] = await Promise.all([cloud.rest('GET', '/linkedin_accounts?select=*&order=created_at.asc'), cloud.rest('GET', '/outreach?select=*&order=created_at.desc&limit=600')]);
    } catch { /* the tables arrive with the outreach migration; until then the screen explains it */ }
  }

  async function connect(btn) {
    btn.disabled = true;
    const r = await run('link', () => cloud.linkedin({ action: 'link' }));
    if (r?.url) { location.href = r.url; return; }
    btn.disabled = false;
  }
  async function disconnect(a) {
    if (!confirm('Disconnect this LinkedIn account? Messages waiting for it will stop.')) return;
    const r = await run('disconnect', () => cloud.linkedin({ action: 'disconnect', id: a.id }));
    if (r) { accounts = accounts.filter(x => x.id !== a.id); rows = rows.map(x => (x.account_id === a.id && ['draft', 'approved'].includes(x.status) ? { ...x, status: 'stopped' } : x)); rerender(); toast('Account disconnected.'); }
  }
  async function patch(id, body) {
    const saved = await run('outreach', () => cloud.rest('PATCH', `/outreach?id=eq.${encodeURIComponent(id)}`, body, { prefer: 'return=representation' }));
    const row = saved?.[0]; if (row) rows = rows.map(r => (r.id === id ? { ...r, ...row } : r)); return row;
  }

  /** Approve the whole sequence of one lead with the texts as they are now in the boxes, or skip it. */
  async function decide(leadId, boxes, approve) {
    for (const r of rows.filter(x => x.lead_id === leadId && x.status === 'draft')) {
      if (!approve) { await patch(r.id, { status: 'skipped' }); continue; }
      const text = (boxes[r.step]?.value ?? r.text).trim(); if (!text) { await patch(r.id, { status: 'skipped' }); continue; }
      await patch(r.id, { text: r.step === 'invite' ? fitNote(text) : text, ...approvePatch(r.step) });
    }
    rerender();
  }

  function accountsCard() {
    const items = accounts.map(a => h('li', { class: 'sh-row' }, h('div', { class: 'sh-main' }, h('b', {}, a.name || 'LinkedIn account'), h('span', {}, a.status === 'connected' ? `Connected ${ago(a.created_at)}` : 'Needs attention: log in to LinkedIn again')),
      a.status !== 'connected' ? h('button', { type: 'button', class: 'mini-btn accent', onclick: e => connect(e.currentTarget) }, 'Log in again') : null,
      h('button', { type: 'button', class: 'mini-btn', onclick: () => disconnect(a) }, 'Disconnect')));
    const btn = h('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'li-connect', onclick: e => connect(e.currentTarget) }, accounts.length ? 'Connect another account' : 'Connect LinkedIn');
    return h('section', { class: 'chart-card' }, h('div', { class: 'mc-h' }, h('span', {}, 'LinkedIn accounts')),
      h('p', { class: 'hint' }, 'You log in on a page hosted by our LinkedIn provider; we never see or store your password. Searches, invitations and messages go out from your own account, within safe daily limits. LinkedIn can restrict accounts that send too much: keep the limits low for the first two weeks.'),
      accounts.length ? h('ul', { class: 'sh-list' }, ...items) : null, btn);
  }

  function statsRow() {
    const st = outreachStats(rows, getRaw());
    const k = (l, v, sub) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, String(v)), h('em', {}, sub));
    return h('div', { class: 'act-kpis out-kpis' }, k('Waiting for you', st.waiting, 'Sequences to approve'), k('Invitations sent', st.sent, 'From your accounts'), k('Accepted', st.accepted, st.sent ? `${Math.round(st.accepted / st.sent * 100)}% of invitations` : 'None yet'), k('Replied', st.replied, 'The sequence stops when they answer'));
  }

  function queueCard() {
    const byLead = new Map();
    for (const r of rows.filter(x => x.status === 'draft')) { if (!byLead.has(r.lead_id)) byLead.set(r.lead_id, []); byLead.get(r.lead_id).push(r); }
    const views = getViews(), blocks = [];
    for (const [leadId, list] of byLead) {
      const v = views.find(x => x.id === leadId); if (!v) continue;
      const boxes = {};
      const field = r => {
        const area = h('textarea', { rows: r.step === 'invite' ? 3 : 4, maxlength: r.step === 'invite' ? MAX_NOTE : 2000 }, r.text); boxes[r.step] = area;
        const count = r.step === 'invite' ? h('span', { class: 'hint' }, `${r.text.length} / ${MAX_NOTE}`) : null;
        if (count) area.addEventListener('input', () => { count.textContent = `${area.value.length} / ${MAX_NOTE}`; });
        return h('div', { class: 'field' }, h('label', {}, STEP_LABEL[r.step]), area, count);
      };
      const ready = connected().length > 0;
      blocks.push(h('article', { class: 'out-card', 'data-lead': leadId },
        h('header', {}, scorePill(v), h('b', {}, v.name), h('span', { class: 'muted' }, [v.authorRole, v.authorCompany].filter(Boolean).join(' · ')), h('button', { type: 'button', class: 'linkish', onclick: () => openLead(leadId) }, 'Open lead')),
        h('blockquote', { class: 'ld-quote' }, snippet(v.text, 220)),
        ...STEPS.map(s => list.find(r => r.step === s)).filter(Boolean).map(field),
        h('div', { class: 'modal-actions am-left' },
          h('button', { type: 'button', class: 'btn btn-primary btn-sm out-approve', disabled: !ready, title: ready ? '' : 'Connect a LinkedIn account first', onclick: () => decide(leadId, boxes, true) }, 'Approve sequence'),
          h('button', { type: 'button', class: 'btn btn-dark btn-sm out-skip', onclick: () => decide(leadId, boxes, false) }, 'Skip'))));
    }
    return h('section', { class: 'chart-card out-queue' }, h('div', { class: 'mc-h' }, h('span', {}, 'Waiting for your approval')),
      blocks.length ? h('div', { class: 'out-list' }, ...blocks)
        : h('p', { class: 'hint' }, connected().length ? 'Nothing waiting. New people with a score of 70 or more appear here with their messages written, usually within hours of connecting an account.' : 'Connect your LinkedIn account to start. We then look for people who engage with the pages you watch or write about what you sell, and write the messages for you.'),
      connected().length ? h('button', { type: 'button', class: 'btn btn-dark btn-sm', id: 'li-scan', onclick: async e => { e.currentTarget.disabled = true; const r = await run('scan', () => cloud.linkedin({ action: 'scan' })); if (r) { toast(r.saved ? `${r.saved} new lead${r.saved === 1 ? '' : 's'}, ${r.drafted} with messages written.` : 'No new people this time.'); await reloadLeads(); await rerenderFull(); } else e.currentTarget.disabled = false; } }, 'Look for people now') : null);
  }

  function sentCard() {
    const views = getViews(), byLead = new Map();
    for (const r of rows.filter(x => x.status !== 'draft')) { if (!byLead.has(r.lead_id)) byLead.set(r.lead_id, []); byLead.get(r.lead_id).push(r); }
    const items = [...byLead].map(([id, list]) => ({ v: views.find(x => x.id === id), list })).filter(x => x.v).slice(0, 40);
    return h('section', { class: 'chart-card' }, h('div', { class: 'mc-h' }, h('span', {}, 'In progress and sent')),
      items.length ? h('ul', { class: 'ld-hist wide out-sent' }, ...items.map(({ v, list }) => h('li', {},
        h('button', { type: 'button', class: 'linkish', onclick: () => openLead(v.id) }, v.name),
        h('span', {}, STEPS.map(s => { const r = list.find(x => x.step === s); return r ? `${STEP_LABEL[s]}: ${r.status === 'approved' && !r.due_at ? 'after they accept' : OUTREACH_STATUS[r.status]}` : null; }).filter(Boolean).join(' · ')))))
        : h('p', { class: 'hint' }, 'Nothing sent yet.'));
  }

  async function rerenderFull() { await load(); rerender(); }

  function render(host) {
    clear(host);
    if (!cloud.configured) { host.append(h('div', { class: 'empty-panel' }, h('b', {}, 'Outreach needs an account'), h('p', {}, 'Sign in to connect LinkedIn.'))); return; }
    host.append(h('div', { class: 'out-grid' }, statsRow(), queueCard(), h('div', { class: 'set-col' }, accountsCard(), sentCard())));
  }

  return { load, render, accountsCard, connected: () => connected().length, waiting: () => rows.filter(r => r.step === 'invite' && r.status === 'draft').length };
}
