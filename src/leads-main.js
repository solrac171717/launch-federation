// Owned Map app entry: sign-in, the user's business, the leads found for it, and the globe they appear on.
// Same architecture as before: Supabase (or this device) for storage, the browser talks to the database with the user's own session,
// and the three /api endpoints do only what the browser cannot (read a web page, call the model, search).
import { CONFIG } from '../assets/config.js';
import { h, s as svg, clear } from './dom.js';
import { ICON } from './ui.js';
import { createCloud } from './cloud.js';
import { createGlobe } from './globe.js';
import { attachGeo } from './geoui.js';
import { download } from './report.js';
import { toCsv } from './calc.js';
import { showSetPassword } from './app-password.js';
import { createAccountUi } from './app-account.js';
import { makeToken, sha256Hex, createShareUi } from './app-share.js';
import { planFor, isSuperadmin } from './plan.js';
import { createBillingUi } from './app-billing.js';
import { SOURCES, INTENTS, STATUSES, HIGH_SCORE, HISTORY_LABEL, toView, stats, funnel, quotaState, nextHistory, createLocalStore, createCloudStore, toCsvRows, LEAD_COLUMNS } from './leads-core.js';
import { sampleLeads } from './leads-demo.js';
import { ago, snippet, sourceIcon, scorePill, leadCard, funnelBars } from './leads-view.js';
import { createProfileStore, profileForm, queriesFromText, PROFILE_EMPTY } from './leads-profile.js';

document.documentElement.classList.add('js');
const $ = id => document.getElementById(id);
const cloud = createCloud({ url: CONFIG.supabaseUrl, anonKey: CONFIG.supabaseAnonKey });
const SUPPORT_EMAIL = 'support@ownedmap.com';
let store = null, profiles = null, raw = [], views = [], profile = null, globe = null, geo = null;
const state = { view: 'map', sel: null, source: 'all', q: '', status: 'all', min: 0, sort: { key: 'score', dir: -1 }, searching: false };
const UNITS = 3; // the base plan; the monthly allowance is read from here until the plan is wired to the charge

/* ------------------------------------------------------------------ small helpers */
let toastTimer = 0;
function toast(msg, kind = 'ok') {
  const t = $('toast'); t.className = `toast show ${kind}`; t.replaceChildren(h('span', {}, msg));
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, 4200);
}
const message = e => (e && e.message) || 'Something went wrong. Please try again.';
const show = id => { for (const k of ['boot', 'auth', 'invite', 'shell']) $(k).hidden = k !== id; };
const modal = () => $('modal');
function openModal(content) { const m = modal(); m.replaceChildren(content); if (!m.open) m.showModal(); }
async function run(label, fn) { try { return await fn(); } catch (e) { if (e && e.status === 401) { toast('Your session has expired. Please sign in again.', 'err'); return undefined; } console.error(label, e); toast(message(e), 'err'); return undefined; } }
const recompute = () => { views = raw.map(toView); };
const find = id => views.find(v => v.id === id);
const located = () => views.filter(v => v.located);
const inFilter = v => (state.source === 'all' || v.source === state.source);
const copyText = async text => { try { await navigator.clipboard.writeText(text); return true; } catch { const t = h('textarea', { style: 'position:fixed;opacity:0' }, text); document.body.append(t); t.select(); const ok = document.execCommand?.('copy'); t.remove(); return Boolean(ok); } };

/* ------------------------------------------------------------------ sign in (unchanged from before) */
function showAuth(error) {
  show('auth');
  const form = $('auth-form'), email = $('auth-email'), pass = $('auth-password'), err = $('auth-err'), btn = $('auth-submit');
  err.textContent = error || '';
  if (form.dataset.bound) return; form.dataset.bound = '1';
  $('auth-forgot').addEventListener('click', async () => {
    const v = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { err.textContent = 'Type your email above first, then press this again.'; email.focus(); return; }
    err.textContent = '';
    try { await cloud.recover(v, `${location.origin}/app.html`); err.textContent = 'If that email has an account, we sent a link to choose a new password. It can take a minute.'; }
    catch (x) { err.textContent = message(x); }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { err.textContent = 'Enter a valid email address.'; email.focus(); return; }
    if (!pass.value) { err.textContent = 'Enter your password.'; pass.focus(); return; }
    err.textContent = ''; btn.disabled = true; btn.classList.add('busy'); btn.querySelector('.lbl').textContent = 'Signing in…';
    try { await cloud.signInWithPassword(v, pass.value); pass.value = ''; location.reload(); }
    catch (x) { err.textContent = message(x); pass.value = ''; btn.disabled = false; btn.classList.remove('busy'); btn.querySelector('.lbl').textContent = 'Sign in'; }
  });
}
async function signOut() { await cloud.signOut(); raw = []; views = []; location.reload(); }

/* ------------------------------------------------------------------ the account card (bottom left) */
const initialsOf = email => { const n = String(email || '?').split('@')[0].split(/[._+-]+/).filter(Boolean); return ((n[0]?.[0] || '?') + (n[1]?.[0] || n[0]?.[1] || '')).toUpperCase(); };
const whoAmI = () => { const email = cloud.user()?.email || '', plan = planFor(email), admin = plan.key === 'superadmin'; return { email, initials: initialsOf(email), admin, mine: true, role: admin ? plan.label : 'Owner', note: plan.note }; };
const supportMailto = () => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Owned Map support')}&body=${encodeURIComponent(`Hi Owned Map support,\n\n\n\n--\nAccount: ${cloud.user()?.email || ''}`)}`;
const shareUi = createShareUi({ cloud, openModal, modal, toast, run, message });
const billingUi = createBillingUi({ cloud, openModal, modal, toast, run, message, used: () => stats(raw.filter(l => !l.isSample)).highThisMonth, superadmin: () => isSuperadmin(cloud.user()?.email) });
const accountUi = createAccountUi({ cloud, openModal, modal, toast, message, billing: billingUi, billingOn: () => Boolean(CONFIG.billing), signOut, who: whoAmI, support: () => ({ href: supportMailto(), email: SUPPORT_EMAIL }) });
function renderFoot() {
  const f = clear($('side-foot'));
  if (!cloud.configured) { f.append(h('div', { class: 'acct-sync off' }, h('i', { 'aria-hidden': 'true' }), 'Saved on this device only')); return; }
  const me = whoAmI();
  f.append(h('div', { class: 'acct' },
    h('button', { type: 'button', class: 'acct-head', id: 'profile-btn', 'aria-haspopup': 'dialog', title: 'Your account', onclick: () => accountUi.open() },
      h('span', { class: 'acct-av' + (me.admin ? ' admin' : ''), 'aria-hidden': 'true' }, me.initials),
      h('span', { class: 'acct-who' }, h('span', { class: 'acct-email', title: me.email }, me.email || 'Signed in'), h('span', { class: 'acct-role' + (me.admin ? ' admin' : '') }, me.admin || !CONFIG.billing ? me.role : billingUi.label()))),
    h('a', { class: 'acct-support', id: 'support-link', href: supportMailto() }, 'Support'),
    h('div', { class: 'acct-sync' }, h('i', { 'aria-hidden': 'true' }), 'Synced to your account')));
}

/* ------------------------------------------------------------------ the three things a lead can do: be found, be worked, be removed */
function merge(list) { // a signal already in the list (same source and id) is not added twice
  const have = new Set(raw.map(l => `${l.source}:${l.externalId}`));
  const fresh = list.filter(l => !have.has(`${l.source}:${l.externalId}`));
  raw = [...fresh, ...raw]; return fresh;
}
let freshAt = new Map();
async function saveFound(leads) {
  if (!leads.length) return 0;
  const saved = await store.addMany(leads);
  const added = merge(saved);
  const now = Date.now(); added.forEach(l => freshAt.set(l.id, now));
  refresh(); return added.length;
}

/** The first search: three calls in parallel, so the first points reach the globe in seconds and the rest follow. */
async function findLeads({ announce = true } = {}) {
  if (state.searching || !profile) return 0;
  if (!cloud.configured || !cloud.session()) { toast('Searching needs you to be signed in.', 'err'); return 0; }
  state.searching = true; paintSearchState();
  const qs = profile.queries.slice(0, 6), groups = [qs.slice(0, 2), qs.slice(2, 4), qs.slice(4, 6)].filter(g => g.length);
  let total = 0, failed = 0, last = null;
  await Promise.all(groups.map(async g => {
    try { const r = await cloud.signals({ profile, queries: g }); const n = await saveFound(r.leads || []); total += n; } // not `total += await ...`: the three calls overlap, and that form would overwrite the others' counts
    catch (e) { failed++; last = e; }
  }));
  state.searching = false; paintSearchState();
  if (failed === groups.length) toast(message(last), 'err');
  else if (announce) toast(total ? `${total} new lead${total === 1 ? '' : 's'} found.` : 'No new people asking for this right now. We will look again when you press search.');
  return total;
}
function paintSearchState() {
  const b = $('find-btn'); if (!b) return;
  b.disabled = state.searching; b.classList.toggle('busy', state.searching); b.querySelector('.lbl').textContent = state.searching ? 'Searching…' : 'Find new leads';
  const bar = $('search-bar'); if (bar) bar.hidden = !state.searching;
}

async function setStatus(l, status) {
  const prev = raw.find(x => x.id === l.id); if (!prev || prev.status === status) return;
  const history = nextHistory(prev.history, status);
  const saved = await run('status', () => store.update(l.id, { status, history })); if (!saved) return;
  raw = raw.map(x => (x.id === l.id ? { ...x, ...saved, status, history } : x)); refresh(); openLead(l.id, { keep: true });
}
async function saveDraft(l, draft) { const saved = await run('draft', () => store.update(l.id, { draft })); if (saved) { raw = raw.map(x => (x.id === l.id ? { ...x, draft } : x)); recompute(); toast('Draft saved.'); } }
async function removeLead(l) {
  if (!confirm('Remove this lead? This cannot be undone.')) return;
  await run('remove', () => store.remove(l.id)); raw = raw.filter(x => x.id !== l.id); if (state.sel === l.id) state.sel = null; modal().close(); refresh();
}

/* ------------------------------------------------------------------ one lead, in full */
function openLead(id, { keep = false } = {}) {
  const v = find(id); if (!v) return;
  const draft = h('textarea', { id: 'lead-draft', rows: 6, maxlength: 2000, placeholder: 'Your reply, ready to copy. Nothing is ever posted for you.' }, v.draft);
  const steps = Object.entries(STATUSES).map(([k, label]) => h('button', { type: 'button', class: `step${v.status === k ? ' on' : ''}`, 'aria-pressed': String(v.status === k), onclick: () => setStatus(v, k) }, label));
  const hist = [...v.history].reverse().map(e => h('li', {}, h('time', {}, e.d), h('span', {}, HISTORY_LABEL[e.e] || e.e)));
  const card = h('div', { class: 'modal-card wide lead-detail' },
    h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, v.name), h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')),
    h('div', { class: 'ld-meta' }, scorePill(v), h('span', {}, v.intentLabel), h('span', { class: 'ld-src' }, sourceIcon(v.source), v.kind), h('span', {}, `Detected ${ago(v.signalAt)}`),
      v.place ? h('span', {}, v.place) : h('span', { class: 'muted' }, 'Location unknown')),
    (v.authorRole || v.authorCompany) ? h('p', { class: 'ld-who' }, [v.authorRole, v.authorCompany].filter(Boolean).join(' · ')) : null,
    h('blockquote', { class: 'ld-quote' }, v.text),
    h('div', { class: 'ld-links' },
      v.url ? h('a', { class: 'btn btn-dark btn-sm', href: v.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open the original post') : null,
      v.authorUrl ? h('a', { class: 'btn btn-dark btn-sm', href: v.authorUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open their profile') : null),
    v.source === 'linkedin' && !v.located && v.authorUrl ? h('p', { class: 'hint' }, 'When you open their profile with the Owned Map extension installed, their location is added and the lead appears on the globe.') : null,
    h('div', { class: 'field' }, h('label', { for: 'lead-draft' }, 'Suggested reply (you edit it, you send it)'), draft,
      h('div', { class: 'modal-actions am-left' },
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: async () => toast((await copyText(draft.value)) ? 'Copied. Paste it where the conversation is.' : 'Could not copy. Select the text and copy it.') }, 'Copy reply'),
        h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => saveDraft(v, draft.value) }, 'Save my edits'))),
    h('div', { class: 'ld-steps', role: 'group', 'aria-label': 'Where this lead is' }, steps),
    h('h3', { class: 'ld-h' }, 'History'), h('ul', { class: 'ld-hist' }, hist),
    h('div', { class: 'modal-actions am-left' }, h('button', { type: 'button', class: 'btn btn-ghost-danger btn-sm', onclick: () => removeLead(v) }, 'Remove this lead')));
  openModal(card); if (!keep) state.sel = id;
}

/* ------------------------------------------------------------------ views */
const TABS = [['map', 'Map', 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2.5 2 2.5 10 0 12M8 2c-2.5 2-2.5 10 0 12'], ['leads', 'Leads', 'M2 4h12M2 8h12M2 12h8'], ['activity', 'Activity', 'M2 13l4-5 3 3 5-7'], ['settings', 'Settings', 'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 1v2M8 13v2M1 8h2M13 8h2']];
function setView(v) {
  state.view = v;
  for (const [k] of TABS) $(`view-${k}`).hidden = k !== v;
  $('view-title').textContent = TABS.find(t => t[0] === v)[1];
  const mk = cls => TABS.map(([k, label, d]) => h('button', { type: 'button', class: `${cls}${k === v ? ' on' : ''}`, 'aria-pressed': String(k === v), 'aria-current': k === v ? 'page' : null, onclick: () => setView(k) },
    svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' }, svg('path', { d })), label));
  clear($('app-nav')).append(...mk('nav-btn').map(b => h('li', {}, b))); clear($('view-tabs')).append(...mk('tab-btn'));
  if (geo) geo.toggle.hidden = v !== 'map';
  render();
}
function renderTop() {
  const host = $('app-filter'); clear(host);
  if (!$('find-btn')) {
    host.before(h('button', { type: 'button', class: 'btn btn-primary btn-sm add-btn', id: 'find-btn', onclick: () => findLeads() }, h('span', { class: 'lbl' }, 'Find new leads'), h('span', { class: 'spin', 'aria-hidden': 'true' })));
    host.before(h('button', { type: 'button', class: 'btn btn-dark btn-sm import-btn', id: 'export-btn', onclick: exportCsv }, 'Export CSV'));
    if (cloud.configured) host.before(h('button', { type: 'button', class: 'btn btn-dark btn-sm import-btn', id: 'share-btn', onclick: () => shareUi.open() }, 'Share'));
  }
  const present = Object.keys(SOURCES).filter(k => views.some(v => v.source === k));
  const opts = [['all', 'All'], ...present.map(k => [k, SOURCES[k].label])];
  host.append(...opts.map(([k, label]) => h('button', { type: 'button', class: state.source === k ? 'on' : '', 'aria-pressed': String(state.source === k), onclick: () => { state.source = k; globe?.setFilter(k === 'all' ? null : [k]); refresh(); } }, label)));
  paintSearchState();
}
function render() {
  renderTop();
  if (state.view === 'map') renderMap(); else if (state.view === 'leads') renderLeads(); else if (state.view === 'activity') renderActivity(); else renderSettings();
}
function refresh() {
  recompute(); globe?.setAssets(located().map(v => ({ ...v, fresh: freshAt.get(v.id) || 0 })));
  if (state.sel && !find(state.sel)) state.sel = null;
  if (!state.sel) state.sel = (views.filter(inFilter).filter(v => v.located).sort((a, b) => b.score - a.score)[0] || views[0])?.id || null;
  globe?.setSelected(state.sel); geo?.sync(); render();
}

const empty = (t, d) => h('div', { class: 'app-empty' }, h('b', {}, t), h('span', {}, d));
const appCard = v => leadCard(v, { actions: [h('button', { type: 'button', class: 'mini-btn accent', onclick: () => openLead(v.id) }, 'Open lead and reply'), v.url ? h('a', { class: 'mini-btn', href: v.url, target: '_blank', rel: 'noopener noreferrer' }, 'Original post') : null].filter(Boolean) });

function renderMap() {
  const host = $('view-map');
  if (!views.length) { // first run: the heart of the product starts with one question
    clear($('hero-sel')).append(onboarding());
    clear($('hero-value')).append(h('span', {}, 'Leads found'), h('b', {}, '0'), h('em', { class: 'muted' }, 'Start by describing your business'));
    clear($('hero-pair')); clear($('hero-chart'));
    return;
  }
  const sc = views.filter(inFilter), st = stats(sc), v = find(state.sel);
  clear($('hero-sel')).append(v ? appCard(v) : empty('Pick a point on the globe', 'Each point is a person who asked for something like what you sell.'));
  clear($('hero-value')).append(h('span', {}, 'Leads found'), h('b', {}, String(st.total)), h('em', { class: 'muted' }, `${st.high} with a score of ${HIGH_SCORE} or more · ${st.located} on the map`));
  const k = (l, val, sub) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, val), h('em', {}, sub));
  const unplaced = sc.length - st.located;
  clear($('hero-pair')).append(k('Average score', String(st.avgScore), 'Out of 100'), k('Not on the map', String(unplaced), unplaced ? 'Place unknown: see the list' : 'Everyone is placed'));
  const mc = clear($('hero-chart')); mc.append(h('div', { class: 'mc-h' }, h('span', {}, 'From signal to customer')), funnelBars(sc));
  void host;
}
function onboarding() {
  const url = h('input', { id: 'onb-url', type: 'text', inputmode: 'url', autocomplete: 'url', placeholder: 'yourbusiness.com' });
  const txt = h('textarea', { id: 'onb-text', rows: 3, maxlength: 4000, placeholder: 'Or describe what you sell and who buys it, in a few lines.' });
  const err = h('p', { class: 'err', role: 'alert' });
  const go = h('button', { type: 'button', class: 'btn btn-primary btn-lg', id: 'onb-go' }, h('span', { class: 'lbl' }, 'Find people who want this'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
  go.addEventListener('click', async () => {
    if (!cloud.configured || !cloud.session()) { err.textContent = 'Sign in first.'; return; }
    err.textContent = ''; go.disabled = true; go.classList.add('busy'); go.querySelector('.lbl').textContent = 'Reading your business…';
    try {
      const { profile: p } = await cloud.analyze({ url: url.value.trim(), text: txt.value.trim() });
      profile = await profiles.save({ ...PROFILE_EMPTY, ...p });
      render(); // the form is replaced by the globe filling up
      findLeads();
    } catch (e) { err.textContent = message(e); go.disabled = false; go.classList.remove('busy'); go.querySelector('.lbl').textContent = 'Find people who want this'; }
  });
  return h('div', { class: 'onb' },
    h('b', {}, 'Who is looking for what you sell?'),
    h('p', {}, 'Paste your website. We read it, search for people asking for something like it, and put each one on the globe with what they said.'),
    h('div', { class: 'field' }, h('label', { for: 'onb-url' }, 'Your website'), url), txt, err, go,
    h('p', { class: 'hint' }, 'We only read public pages and public posts. Nothing is ever posted or sent for you.'),
    h('button', { type: 'button', class: 'link-btn', onclick: loadSample }, 'Or look around with sample leads first'));
}
async function loadSample() { const made = await run('sample', () => store.addMany(sampleLeads(), { sample: true })); if (made) { merge(made); refresh(); } }
async function removeSample() { await run('sample', () => store.removeSample()); raw = raw.filter(l => !l.isSample); refresh(); toast('Sample leads removed.'); }

function renderLeads() {
  const host = clear($('view-leads'));
  if (!views.length) { host.append(h('div', { class: 'empty-panel' }, h('b', {}, 'No leads yet'), h('p', {}, 'Describe your business on the Map tab and the first people appear in seconds.'), h('div', { class: 'ep-actions' }, h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => setView('map') }, 'Go to the map')))); return; }
  const q = h('input', { type: 'search', class: 'tbl-q', placeholder: 'Search what they said, a name or a company', 'aria-label': 'Search leads', value: state.q });
  const sel = (label, key, opts) => h('select', { class: 'mini-sel', 'aria-label': label, onchange: e => { state[key] = key === 'min' ? Number(e.target.value) : e.target.value; draw(); } }, ...opts.map(([v, t]) => h('option', { value: v, selected: String(state[key]) === String(v) }, t)));
  const tbody = h('tbody', {}), count = h('span', { class: 'tbl-count' });
  const th = (key, label) => h('th', { 'aria-sort': state.sort.key === key ? (state.sort.dir > 0 ? 'ascending' : 'descending') : 'none' }, h('button', { type: 'button', onclick: () => { state.sort = { key, dir: state.sort.key === key ? -state.sort.dir : (key === 'name' ? 1 : -1) }; draw(); } }, label));
  const val = { score: v => v.score, name: v => v.name.toLowerCase(), intent: v => v.intentLabel, source: v => v.kind, status: v => v.status, signalAt: v => Date.parse(v.signalAt) };
  const draw = () => {
    const needle = q.value.trim().toLowerCase(); state.q = q.value;
    const rows = views.filter(inFilter).filter(v => (state.status === 'all' || v.status === state.status) && v.score >= state.min && (!needle || `${v.text} ${v.name} ${v.authorCompany} ${v.authorRole} ${v.place}`.toLowerCase().includes(needle)))
      .sort((a, b) => { const x = val[state.sort.key](a), y = val[state.sort.key](b); return (x > y ? 1 : x < y ? -1 : 0) * state.sort.dir; });
    clear(tbody).append(...rows.map(v => h('tr', { tabindex: 0, onclick: () => openLead(v.id), onkeydown: e => { if (e.key === 'Enter') openLead(v.id); } },
      h('td', {}, scorePill(v)), h('td', { class: 'lt-who' }, h('b', {}, v.name), h('span', {}, [v.authorRole, v.authorCompany].filter(Boolean).join(' · ') || v.place || '')),
      h('td', { class: 'lt-sig' }, snippet(v.text, 130)), h('td', {}, v.intentLabel), h('td', { class: 'lt-src' }, sourceIcon(v.source), v.kind), h('td', {}, v.statusLabel), h('td', {}, ago(v.signalAt)))));
    count.textContent = `${rows.length} of ${views.length} leads`;
    if (!rows.length) tbody.append(h('tr', {}, h('td', { colspan: 7, class: 'lt-none' }, 'No lead matches these filters.')));
  };
  q.addEventListener('input', draw);
  host.append(h('div', { class: 'tbl-bar' }, q, sel('Status', 'status', [['all', 'Any status'], ...Object.entries(STATUSES)]), sel('Minimum score', 'min', [[0, 'Any score'], [40, '40 or more'], [HIGH_SCORE, `${HIGH_SCORE} or more`], [85, '85 or more']]), count),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'lt' }, h('thead', {}, h('tr', {}, th('score', 'Score'), th('name', 'Who'), h('th', {}, 'What they said'), th('intent', 'Intent'), th('source', 'Source'), th('status', 'Status'), th('signalAt', 'Detected'))), tbody)));
  draw();
}

function renderActivity() {
  const host = clear($('view-activity'));
  if (!views.length) { host.append(empty('Nothing to show yet', 'When you contact people and they reply, the story appears here.')); return; }
  const st = stats(views), q = quotaState(raw, UNITS);
  const events = views.flatMap(v => v.history.map(e => ({ d: e.d, e: e.e, who: v.name, id: v.id, score: v.score }))).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)).slice(0, 40);
  const k = (l, val, sub) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, val), h('em', {}, sub));
  host.append(h('div', { class: 'act-grid' },
    h('div', { class: 'chart-card' }, h('div', { class: 'mc-h' }, h('span', {}, 'From signal to customer')), funnelBars(views)),
    h('div', { class: 'act-kpis' }, k('Leads this month', String(q.used), `of ${q.allowed} included with a score of ${HIGH_SCORE}+`), k('Average score', String(st.avgScore), 'Out of 100'),
      k('Replied or better', String((st.byStatus.replied || 0) + (st.byStatus.customer || 0)), `${st.byStatus.customer || 0} customer${(st.byStatus.customer || 0) === 1 ? '' : 's'}`)),
    h('div', { class: 'chart-card act-log' }, h('div', { class: 'mc-h' }, h('span', {}, 'Recent activity')),
      h('ul', { class: 'ld-hist wide' }, ...events.map(e => h('li', {}, h('time', {}, e.d), h('button', { type: 'button', class: 'linkish', onclick: () => openLead(e.id) }, e.who), h('span', {}, HISTORY_LABEL[e.e] || e.e)))))));
}

function renderSettings() {
  const host = clear($('view-settings')), sampleCount = raw.filter(l => l.isSample).length, q = quotaState(raw, UNITS);
  const form = profileForm(profile || PROFILE_EMPTY, {
    onSave: async next => { const saved = await run('profile', () => profiles.save(next)); if (saved) { profile = saved; toast('Saved. The next search uses this.'); renderSettings(); } },
    onReanalyze: async url => { const { profile: p } = await cloud.analyze({ url }); const saved = await profiles.save({ ...PROFILE_EMPTY, ...p }); profile = saved; toast('Business read again.'); renderSettings(); },
    message,
  });
  host.append(
    h('div', { class: 'set-grid' },
      h('section', { class: 'chart-card' }, h('div', { class: 'mc-h' }, h('span', {}, 'Your business')), form),
      h('div', { class: 'set-col' },
        h('section', { class: 'chart-card' }, h('div', { class: 'mc-h' }, h('span', {}, 'This month')),
          h('p', { class: 'set-big' }, `${q.used} of ${q.allowed}`), h('p', { class: 'hint' }, `leads with a score of ${HIGH_SCORE} or more. Your plan will set this allowance; nothing is limited yet.`)),
        h('section', { class: 'chart-card' }, h('div', { class: 'mc-h' }, h('span', {}, 'LinkedIn')), extensionBox()),
        h('section', { class: 'chart-card' }, h('div', { class: 'mc-h' }, h('span', {}, 'Data')),
          h('div', { class: 'modal-actions am-left' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: exportCsv }, 'Export leads (CSV)'),
            sampleCount ? h('button', { type: 'button', class: 'btn btn-ghost-danger btn-sm', onclick: removeSample }, `Remove ${sampleCount} sample leads`) : h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: loadSample }, 'Add sample leads'))))));
}

/** Pairing for the browser extension: a secret made here, shown once, stored only as its hash. */
function extensionBox() {
  const out = h('div', { class: 'ext-out' }), list = h('ul', { class: 'sh-list' });
  const loadTokens = async () => {
    if (!cloud.configured) return;
    const rows = await run('tokens', () => cloud.rest('GET', '/ingest_tokens?revoked=eq.false&select=id,label,created_at,last_used&order=created_at.desc')) || [];
    clear(list).append(...rows.map(t => h('li', { class: 'sh-row' }, h('div', { class: 'sh-main' }, h('b', {}, t.label || 'Browser'), h('span', {}, `Added ${String(t.created_at).slice(0, 10)}${t.last_used ? ` · used ${ago(t.last_used)}` : ' · not used yet'}`)),
      h('button', { type: 'button', class: 'mini-btn', onclick: async () => { await run('revoke', () => cloud.rest('PATCH', `/ingest_tokens?id=eq.${t.id}`, { revoked: true }, { prefer: 'return=minimal' })); loadTokens(); } }, 'Disconnect'))));
  };
  const make = h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: async () => {
    if (!cloud.configured) { toast('Sign in to pair the extension.', 'err'); return; }
    const token = makeToken(), hash = await sha256Hex(token);
    const ok = await run('token', () => cloud.rest('POST', '/ingest_tokens', { token_hash: hash, label: 'Chrome' }, { prefer: 'return=minimal' })); if (ok === undefined) return;
    clear(out).append(h('p', { class: 'hint' }, 'Copy this into the extension now. It is shown only once.'), h('code', { class: 'ext-token' }, token),
      h('button', { type: 'button', class: 'mini-btn', onclick: async () => toast((await copyText(token)) ? 'Copied.' : 'Could not copy.') }, 'Copy'));
    loadTokens();
  } }, 'Connect the extension');
  loadTokens();
  return h('div', {}, h('p', { class: 'hint' }, 'The extension reads the LinkedIn posts and profiles you are already looking at and sends them here to be scored. It never sends a message or an invitation for you. To install it: download the file below, unzip it, then in Chrome open Extensions, turn on Developer mode, press Load unpacked and choose the folder. It is new and has not been published to the Chrome Web Store yet.'), h('p', {}, h('a', { class: 'link-btn', href: '/downloads/owned-map-extension.zip', download: '' }, 'Download the extension (.zip)')), make, out, list);
}

function exportCsv() {
  if (!raw.length) { toast('No leads to export yet.', 'err'); return; }
  const cols = LEAD_COLUMNS.map((label, i) => ({ label, get: r => r[i] }));
  download('owned-map-leads.csv', toCsv(toCsvRows(views.filter(inFilter)), cols), 'text/csv;charset=utf-8');
}

/* ------------------------------------------------------------------ start */
async function start() {
  try {
    if (cloud.configured) {
      const r = await cloud.consumeRedirect().catch(e => ({ error: e.message }));
      if (r?.recovery && cloud.session()) return showSetPassword({ cloud, show, done: () => location.replace('app.html') });
      if (!cloud.session()) return showAuth(r && r.error);
      const me = cloud.user();
      store = createCloudStore(cloud, { owner: me.id }); profiles = createProfileStore(cloud, { owner: me.id });
    } else { store = createLocalStore(); profiles = createProfileStore(null); }
    [raw, profile] = await Promise.all([store.list(), profiles.get()]);
  } catch (e) {
    if (e && e.status === 401) return showAuth('Your session has expired. Please sign in again.');
    $('boot').replaceChildren(h('b', {}, 'Could not load your leads. '), message(e), ' ', h('button', { type: 'button', class: 'mini-btn', onclick: () => location.reload() }, 'Try again'));
    return;
  }
  if (cloud.configured && CONFIG.billing) {
    await billingUi.load();
    const back = new URLSearchParams(location.search).get('billing');
    if (back) { history.replaceState(null, '', location.pathname); if (back === 'success') billingUi.waitForPlan().then(ok => { renderFoot(); toast(ok ? 'Thank you! Your plan is active.' : 'Payment received. Your plan will show up in a moment.'); }); }
  }
  recompute(); show('shell'); renderFoot();
  globe = createGlobe($('hero-map'), { assets: located(), icons: ICON, selectedId: state.sel, startLon: -30, tilt: 22, countryPadV: 70, label: 'Rotating 3D globe of the people looking for what you sell', onSelect: id => { state.sel = id; globe.setSelected(id); renderMap(); } });
  geo = attachGeo($('hero-map'), globe, { visible: () => located().filter(inFilter), all: located, selected: () => state.sel, lookup: find, onPick: (id, fly) => { state.sel = id; globe.setSelected(id); if (fly !== false) globe.focus(id); renderMap(); }, onChange: () => renderMap(), toggleAfter: $('view-title'), fmt: v => `${Math.round(v)}`, fmtGroup: () => '' });
  refresh(); setView('map');
  cloud.onAuthChange(s => { if (!s && cloud.configured) location.reload(); });
}
start();
