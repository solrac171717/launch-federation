// Owned Map app entry: sign-in, the user's assets (Supabase or this device), and the dashboard on top of them.
import { CONFIG } from '../assets/config.js';
import { h, clear } from './dom.js';
import { thumb, money } from './ui.js';
import { createCloud } from './cloud.js';
import { createCloudStore, createLocalStore, validateAsset, toView, quickValues } from './asset-store.js';
import { activityFor } from './activity.js';
import { createShareUi } from './app-share.js';
import { mountDashboard } from './dashboard.js';
import { sampleRows } from './demo-data.js';
import { ASSET_TYPES, TYPE_BY_KEY } from './types.js';
import { COUNTRIES, CITIES_LIST, placeLabel, findCity } from './places.js';
import { createCloudExtras, createLocalExtras, DOC_KINDS, validateFile, sizeText, completionPatch } from './extras-store.js';
import { REMINDER_KINDS, REPEATS, validateReminder, statusOf, isoDay, nextDue, UPDATE_TITLE } from './reminders.js';
import { previewImport, TEMPLATE_CSV } from './csv-import.js';
import { download } from './report.js';
import { planFor } from './plan.js';
import { extractFromFile, checkExtractFile, EXTRACT_ACCEPT } from './extract-client.js';
import { loadRates, currencies, currencyName, formatIn, hasRates } from './fx.js';
import { createLocalSettings, createCloudSettings, cleanSettings } from './settings-store.js';
import { createTools } from './app-tools.js';
import { isVin, cleanVin } from './vin.js';
import { showInvite } from './app-invite.js';
import { createHeirUi } from './app-heir.js';
import { createMembersUi, loadShared, pickAccount, savedAccount, saveAccount, inviteTokenOf, accessFor, ROLES } from './app-members.js';

document.documentElement.classList.add('js');
const $ = id => document.getElementById(id);
const cloud = createCloud({ url: CONFIG.supabaseUrl, anonKey: CONFIG.supabaseAnonKey });
let store = null, extras = null, raw = [], views = [], dash = null, docs = [], rems = [];
let settingsApi = null, settings = cleanSettings({}), settingsReady = true, fxInfo = { ok: false, stale: true, date: null };
// whose portfolio is open: your own, or one shared with you (as 'view' or 'edit')
let account = { ownerId: null, ownerEmail: '', role: 'owner', mine: true }, shared = [], heirNote = null;

/* ------------------------------------------------------------------ small helpers */
let toastTimer = 0;
function toast(msg, kind = 'ok', { action = null, ms = 4200 } = {}) {
  const t = $('toast'); t.className = `toast show ${kind}${action ? ' has-action' : ''}`;
  t.replaceChildren(h('span', {}, msg), ...(action ? [h('button', { type: 'button', class: 'toast-act', onclick: () => { t.className = 'toast'; action.fn(); } }, action.label)] : []));
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, ms);
}
const recompute = () => { views = raw.map(toView); };
const metaOf = id => ({ docs: docs.filter(d => d.assetId === id).length, reminders: rems.filter(r => r.assetId === id && !r.done).length });
const dueNow = () => rems.filter(r => ['overdue', 'soon'].includes(statusOf(r))).length;
const show = id => { for (const k of ['boot', 'auth', 'invite', 'shell']) $(k).hidden = k !== id; };
const message = e => (e && e.message) || 'Something went wrong. Please try again.';

/* ------------------------------------------------------------------ sign in */
function showAuth(error) {
  show('auth');
  const form = $('auth-form'), email = $('auth-email'), pass = $('auth-password'), err = $('auth-err'), btn = $('auth-submit');
  err.textContent = error || '';
  if (form.dataset.bound) return; form.dataset.bound = '1';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { err.textContent = 'Enter a valid email address.'; email.setAttribute('aria-invalid', 'true'); email.focus(); return; }
    email.removeAttribute('aria-invalid');
    if (!pass.value) { err.textContent = 'Enter your password.'; pass.setAttribute('aria-invalid', 'true'); pass.focus(); return; }
    pass.removeAttribute('aria-invalid'); err.textContent = '';
    btn.disabled = true; btn.classList.add('busy'); btn.querySelector('.lbl').textContent = 'Signing in…';
    try {
      await cloud.signInWithPassword(v, pass.value);
      pass.value = ''; location.reload(); // the session is stored; start() picks it up
    } catch (x) {
      err.textContent = message(x); pass.value = '';
      btn.disabled = false; btn.classList.remove('busy'); btn.querySelector('.lbl').textContent = 'Sign in';
    }
  });
}

/* ------------------------------------------------------------------ the dashboard */
function renderFoot() {
  const f = clear($('side-foot'));
  if (cloud.configured) {
    const plan = planFor(cloud.user()?.email);
    if (shared.length) {
      const sel = h('select', { class: 'mini-sel sf-account', 'aria-label': 'Which portfolio to open', onchange: e => switchAccount(e.target.value) },
        h('option', { value: '' }, 'My portfolio'), ...shared.map(s => h('option', { value: s.ownerId }, `${s.ownerEmail} (${ROLES[s.role].toLowerCase()})`)));
      sel.value = account.mine ? '' : account.ownerId; f.append(sel);
    }
    f.append(h('span', { class: 'sf-user', title: cloud.user()?.email || '' }, cloud.user()?.email || 'Signed in'),
      ...(plan.key === 'superadmin' ? [h('span', { class: 'sf-plan', title: plan.note }, `${plan.label} · unlimited`)] : []),
      h('span', { class: 'sf-sync' }, 'Synced to your account'),
      h('button', { type: 'button', class: 'mini-btn', onclick: signOut }, 'Sign out'));
  } else {
    f.append(h('span', { class: 'sf-sync' }, 'Saved on this device only'));
  }
}
function renderBanner() {
  const b = $('app-banner'), sample = raw.some(r => r.isSample), due = dueNow();
  const foreign = raw.some(r => r.currency && r.currency !== 'USD'), fxMsg = !foreign ? '' : !fxInfo.ok ? 'Exchange rates could not be loaded, so assets in other currencies are shown as if 1 unit equaled 1 dollar. Reload to try again.' : fxInfo.stale ? `Exchange rates are from ${fxInfo.date}; they could not be refreshed today.` : '';
  b.hidden = !sample && !due && !fxMsg && account.mine && !heirNote; clear(b);
  if (heirNote) b.append(h('div', { class: 'banner-row due' }, h('span', {}, `Your trusted person (${heirNote.name}) opened your emergency sheet on ${String(heirNote.openedAt).slice(0, 10)}.`), h('button', { type: 'button', class: 'mini-btn', onclick: () => { heirNote = null; renderBanner(); heirUi.open(); } }, 'Review'), h('button', { type: 'button', class: 'mini-btn', onclick: () => { heirNote = null; renderBanner(); } }, 'Dismiss')));
  if (!account.mine) b.append(h('div', { class: 'banner-row' }, h('span', {}, `You are looking at ${account.ownerEmail}’s portfolio. ${accessFor(account.role).edit ? 'You can make changes.' : 'It is read only.'}`), h('button', { type: 'button', class: 'mini-btn', onclick: () => switchAccount('') }, 'Back to my portfolio')));
  if (fxMsg) b.append(h('div', { class: 'banner-row due' }, h('span', {}, fxMsg)));
  if (sample && accessFor(account.role).sample) b.append(h('div', { class: 'banner-row' }, h('span', {}, 'You are looking at sample data. Add your own assets and remove the sample whenever you like.'), h('button', { type: 'button', class: 'mini-btn', onclick: removeSample }, 'Remove sample data')));
  if (due && accessFor(account.role).edit) b.append(h('div', { class: 'banner-row due' }, h('span', {}, `${due} reminder${due > 1 ? 's' : ''} need${due > 1 ? '' : 's'} your attention.`), h('button', { type: 'button', class: 'mini-btn', onclick: () => dash.show('reminders') }, 'Review')));
}
function sync(selectId) { recompute(); renderBanner(); dash.refresh(selectId ? { select: selectId } : {}); }

function switchAccount(ownerId) { saveAccount(cloud.user().id, ownerId); location.reload(); }

async function signOut() {
  await cloud.signOut(); raw = []; views = []; location.reload();
}
async function run(label, fn) {
  try { return await fn(); }
  catch (e) {
    if (e && e.status === 401) { toast('Your session expired. Please sign in again.', 'err'); setTimeout(() => location.reload(), 1200); return null; }
    toast(`${label}: ${message(e)}`, 'err'); return null;
  }
}

async function loadSample() {
  const rows = await run('Could not load sample data', () => store.addMany(sampleRows()));
  if (!rows) return;
  raw = await run('Could not refresh', listAssets) || raw; sync(); toast('Sample portfolio loaded.');
}
async function removeSample() {
  const sampleIds = raw.filter(r => r.isSample).map(r => r.id);
  if (!(await run('Could not remove sample data', async () => { for (const id of sampleIds) await extras.removeForAsset(id); await store.removeSample(); return true; }))) return;
  raw = raw.filter(r => !r.isSample); docs = docs.filter(d => !sampleIds.includes(d.assetId)); rems = rems.filter(r => !sampleIds.includes(r.assetId)); sync(); toast('Sample data removed.');
}
// Deleting hides the asset at once and really deletes it after a few seconds, so there is time to change your mind.
// If the tab is closed inside that window the asset simply stays.
const pending = new Map();
const listAssets = async () => (await store.list()).filter(r => !pending.has(r.id));
const UNDO_MS = 8000;
async function removeAsset(id) {
  const a = raw.find(r => r.id === id); if (!a) return;
  const stash = { a, d: docs.filter(x => x.assetId === id), r: rems.filter(x => x.assetId === id) };
  raw = raw.filter(r => r.id !== id); docs = docs.filter(x => x.assetId !== id); rems = rems.filter(x => x.assetId !== id); sync();
  const restore = () => { raw = [...raw, stash.a].sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1)); docs = [...docs, ...stash.d]; rems = [...rems, ...stash.r]; sync(stash.a.id); };
  const timer = setTimeout(async () => {
    const ok = await run('Could not delete', async () => { await extras.removeForAsset(id); await store.remove(id); return true; });
    pending.delete(id); if (!ok) restore();
  }, UNDO_MS);
  pending.set(id, { timer });
  toast(`\u201C${a.name}\u201D deleted.`, 'ok', { ms: UNDO_MS, action: { label: 'Undo', fn: () => { clearTimeout(timer); pending.delete(id); restore(); toast('Restored.'); } } });
}

/* ------------------------------------------------------------------ dialogs */
const modal = () => $('modal');
function openModal(content, { onClose } = {}) {
  const m = modal(); clear(m).append(content);
  if (!m.dataset.bound) {
    m.dataset.bound = '1';
    m.addEventListener('click', e => { if (e.target === m) m.close(); });
  }
  m.onclose = () => { m.onclose = null; onClose && onClose(); };
  if (!m.open) m.showModal();
}
function confirmDialog(title, text, label) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (!done) { done = true; resolve(v); } };
    openModal(h('div', { class: 'modal-card small' },
      h('h2', { id: 'modal-title' }, title), h('p', { class: 'modal-text' }, text),
      h('div', { class: 'modal-actions' },
        h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => { finish(false); modal().close(); } }, 'Cancel'),
        h('button', { type: 'button', class: 'btn btn-primary btn-sm danger-fill', onclick: () => { finish(true); modal().close(); } }, label))),
    { onClose: () => finish(false) });
  });
}

/* ------------------------------------------------------------------ add / edit form */
function openForm(existing, opts = {}) {
  const edit = Boolean(existing);
  const init = existing || { type: opts.type || '', name: '', place: '', value: '', cost: '', gross: '', expenses: '', status: '', acquiredOn: '', notes: '', ownership: 100, owner: '' };
  const known = existing ? findCity(existing.place) : null;
  const st = { type: init.type, custom: Boolean(existing && !known) };
  const errs = {};
  const err = k => h('p', { class: 'err', id: `er-${k}`, role: 'alert' });
  const mkErr = {}; ['type', 'name', 'place', 'placeName', 'country', 'lat', 'lon', 'value', 'cost', 'gross', 'expenses', 'debt', 'debtPayment', 'ownership', 'owner', 'currency', 'debtRate', 'annualChange', 'status', 'acquiredOn', 'notes'].forEach(k => { mkErr[k] = err(k); });
  const field = (label, control, k, hint) => h('div', { class: 'field' }, h('label', { for: control.id }, label), control, hint ? h('p', { class: 'hint' }, hint) : null, mkErr[k]);
  const input = (id, props = {}) => h('input', { id, ...props });
  const money_ = (id, v, ph) => input(id, { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: ph, value: v === '' || v == null ? '' : String(v) });

  // type picker (3D thumbnails)
  const typeHost = h('div', { class: 'type-grid', role: 'radiogroup', 'aria-label': 'Asset type' });
  const status = h('select', { id: 'f-status' });
  const fillStatus = () => {
    const t = TYPE_BY_KEY[st.type]; const list = t ? t.statuses : ['Held'];
    const cur = status.value || init.status;
    status.replaceChildren(...list.map(s => h('option', { value: s }, s)));
    status.value = list.includes(cur) ? cur : list[0];
  };
  let onType = () => {};
  const drawTypes = () => {
    typeHost.replaceChildren(...ASSET_TYPES.map(t => {
      const on = st.type === t.key;
      return h('button', { type: 'button', class: 'type-card' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on), onclick: () => { st.type = t.key; status.value = ''; drawTypes(); fillStatus(); } },
        thumb({ type: t.key, category: t.category }, 52), h('span', {}, t.label));
    }));
    onType();
  };
  drawTypes();

  const name = input('f-name', { type: 'text', maxlength: 80, autocomplete: 'off', placeholder: 'e.g. Lake House, Porsche 911, Sea Atlas 52', value: init.name });
  // location
  const cityList = h('datalist', { id: 'city-list' }, ...CITIES_LIST.map(c => h('option', { value: placeLabel(c) })));
  const place = input('f-place', { type: 'text', list: 'city-list', autocomplete: 'off', placeholder: 'Start typing a city, e.g. Austin, TX', value: known ? placeLabel(known) : (st.custom ? '' : init.place) });
  const custom = h('div', { class: 'custom-place' },
    field('City or place name', input('f-placename', { type: 'text', placeholder: 'e.g. Hallstatt', value: st.custom ? String(init.place).replace(/,\s*[A-Za-z]{2}$/, '') : '' }), 'placeName'),
    field('Country', h('select', { id: 'f-country' }, h('option', { value: '' }, 'Choose a country'), ...Object.entries(COUNTRIES).map(([k, v]) => h('option', { value: k }, v.name))), 'country'),
    h('div', { class: 'two' },
      field('Latitude', input('f-lat', { type: 'text', inputmode: 'decimal', placeholder: '47.56', value: st.custom ? init.lat : '' }), 'lat'),
      field('Longitude', input('f-lon', { type: 'text', inputmode: 'decimal', placeholder: '13.65', value: st.custom ? init.lon : '' }), 'lon')),
    h('p', { class: 'hint' }, 'Tip: in Google Maps, right-click the spot and click the coordinates to copy them.'));
  const customBox = h('label', { class: 'check' }, input('f-custom', { type: 'checkbox' }), h('span', {}, 'My city isn’t listed'));
  const syncCustom = () => { const on = customBox.querySelector('input').checked; custom.hidden = !on; place.disabled = on; };
  customBox.querySelector('input').checked = st.custom; customBox.querySelector('input').addEventListener('change', syncCustom);
  if (st.custom) custom.querySelector('#f-country').value = init.country;
  syncCustom();

  const value = money_('f-value', init.value, '685,000'), cost = money_('f-cost', init.cost, '520,000');
  const gross = money_('f-gross', init.gross || '', '0'), expenses = money_('f-expenses', init.expenses || '', '0');
  const debt = money_('f-debt', init.debt || '', '0'), debtPayment = money_('f-debtpay', init.debtPayment || '', '0');
  const ownership = money_('f-own', init.ownership != null && init.ownership !== 100 ? init.ownership : '', '100');
  const curSel = h('select', { id: 'f-currency' }, ...(() => { const list = currencies(); if (init.currency && !list.includes(init.currency)) list.push(init.currency); return list; })().map(c => h('option', { value: c }, c === 'USD' ? 'USD · US dollar' : `${c} · ${currencyName(c)}`)));
  curSel.value = init.currency || 'USD';
  const debtRate = money_('f-debtrate', init.debtRate || '', '4.5'), annualChange = money_('f-annual', init.annualChange || '', '3');
  const ownerList = [...new Set(raw.map(r => r.owner).filter(Boolean))];
  const owner = input('f-owner', { type: 'text', list: 'owner-list', maxlength: 60, autocomplete: 'off', placeholder: 'Me, Acme LLC, my partner…', value: init.owner || '' });
  const ownerData = h('datalist', { id: 'owner-list' }, ...ownerList.map(o => h('option', { value: o })));
  // income and expenses are stored per year; people think in months for rent, so the form accepts either
  const period = h('select', { id: 'f-period', 'aria-label': 'Enter income and expenses per' }, h('option', { value: 'month' }, 'per month'), h('option', { value: 'year' }, 'per year'));
  period.value = edit ? 'year' : 'month';
  const incField = field('Income (optional)', gross, 'gross', 'Rent or revenue.'), expField = field('Expenses (optional)', expenses, 'expenses', 'Taxes, insurance, upkeep.');
  const relabel = () => { const w = period.value === 'month' ? 'per month' : 'per year'; incField.querySelector('label').textContent = `Income ${w} (optional)`; expField.querySelector('label').textContent = `Expenses ${w} (optional)`; };
  const conv = (el, f) => { const t = el.value.trim(), n = Number(t.replace(/[$,\s]/g, '')); if (t !== '' && Number.isFinite(n)) el.value = String(Math.round(n * f * 100) / 100); };
  let shown = period.value;
  period.addEventListener('change', () => { if (period.value !== shown) { const f = period.value === 'month' ? 1 / 12 : 12; conv(gross, f); conv(expenses, f); shown = period.value; } relabel(); });
  const toYear = v => { const t = String(v).trim(), n = Number(t.replace(/[$,\s]/g, '')); return period.value === 'month' && t !== '' && Number.isFinite(n) ? String(Math.round(n * 12 * 100) / 100) : v; };
  relabel();
  const acquired = input('f-acq', { type: 'date', value: init.acquiredOn || '', max: new Date().toISOString().slice(0, 10) });
  const notes = h('textarea', { id: 'f-notes', rows: 3, maxlength: 500, placeholder: 'Anything worth remembering (optional)' }, init.notes || '');
  fillStatus(); if (init.status) status.value = init.status;

  const formErr = h('p', { class: 'err form-err', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, h('span', { class: 'lbl' }, edit ? 'Save changes' : 'Add asset'), h('span', { class: 'spin', 'aria-hidden': 'true' }));

  // Autofill from a document (new assets, signed-in accounts, when the server has the reader switched on)
  const DOC_KIND_OF = { purchase_deed: 'deed', invoice_or_receipt: 'invoice', insurance: 'insurance', registration_or_title: 'registration' };
  let source = null;
  const attach = h('input', { type: 'checkbox', id: 'af-attach', checked: true });
  const afStatus = h('div', { class: 'af-status', role: 'status', 'aria-live': 'polite' });
  const afFile = h('input', { type: 'file', id: 'af-file', accept: EXTRACT_ACCEPT, hidden: true });
  const afDrop = h('label', { class: 'af-drop', for: 'af-file' }, h('span', { class: 'af-ico', 'aria-hidden': 'true' }, '⇪'), h('span', {}, h('b', {}, 'Upload an invoice, deed or contract'), h('small', {}, 'PDF or photo. We read it and fill in the form for you. You can change anything.')));
  const setFill = (el, v) => { if (v === undefined || v === '' || (el.value || '').trim()) return false; el.value = String(v); el.classList.add('autofilled'); el.addEventListener('input', () => el.classList.remove('autofilled'), { once: true }); return true; };
  function applyExtraction(res) {
    const f = res.fields || {};
    if (f.type && !st.type) { st.type = f.type; status.value = ''; drawTypes(); fillStatus(); }
    setFill(name, f.name);
    if (f.placeName && !place.value.trim()) {
      const box = customBox.querySelector('input'); box.checked = true; syncCustom();
      setFill(custom.querySelector('#f-placename'), f.placeName); setFill(custom.querySelector('#f-lat'), f.lat); setFill(custom.querySelector('#f-lon'), f.lon);
      if (f.country && !custom.querySelector('#f-country').value) custom.querySelector('#f-country').value = f.country;
    }
    if (f.currency && [...curSel.options].some(o => o.value === f.currency)) curSel.value = f.currency;
    setFill(value, f.value); setFill(cost, f.cost); setFill(debt, f.debt); setFill(debtPayment, f.debtPayment);
    if (f.gross != null) setFill(gross, period.value === 'month' ? f.gross : Math.round(f.gross * 12 * 100) / 100);
    setFill(ownership, f.ownership); setFill(owner, f.owner); setFill(acquired, f.acquiredOn); setFill(notes, f.notes);
  }
  async function readDocument(file) {
    const bad = checkExtractFile(file); if (bad) { afStatus.className = 'af-status err'; afStatus.textContent = bad; return; }
    afStatus.className = 'af-status busy'; afStatus.replaceChildren(h('span', { class: 'spin on', 'aria-hidden': 'true' }), ` Reading ${file.name}…`);
    afDrop.classList.add('disabled');
    try {
      const res = await extractFromFile(cloud, file);
      source = { file, kind: DOC_KIND_OF[res.documentKind] || 'other' };
      applyExtraction(res);
      afStatus.className = 'af-status ok';
      afStatus.replaceChildren(h('b', {}, res.found.length ? `Filled from ${file.name}. ` : `Read ${file.name}, but found little. `), 'Check every field before saving; the highlighted ones came from the document.',
        ...(res.notes.length ? [h('ul', {}, ...res.notes.map(n => h('li', {}, n)))] : []),
        h('label', { class: 'check' }, attach, h('span', {}, 'Also keep this file with the asset (under Documents)')));
    } catch (x) { afStatus.className = 'af-status err'; afStatus.textContent = message(x); }
    finally { afDrop.classList.remove('disabled'); afFile.value = ''; }
  }
  afFile.addEventListener('change', () => { if (afFile.files[0]) readDocument(afFile.files[0]); });
  ['dragover', 'dragenter'].forEach(ev => afDrop.addEventListener(ev, e => { e.preventDefault(); afDrop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => afDrop.addEventListener(ev, () => afDrop.classList.remove('over')));
  afDrop.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer?.files[0]) readDocument(e.dataTransfer.files[0]); });
  const autofill = !edit && cloud.configured && CONFIG.extractor ? h('div', { class: 'autofill' }, afDrop, afFile, afStatus) : null;

  // VIN lookup (cars, trucks, motorcycles, motorhomes): the free US NHTSA database fills in make, model and year
  const VEHICLES = ['car', 'truck', 'motorcycle', 'rv'];
  const vinIn = h('input', { id: 'f-vin', type: 'text', maxlength: 20, autocomplete: 'off', placeholder: '17-character VIN', 'aria-label': 'Vehicle identification number' });
  const vinMsg = h('p', { class: 'hint', role: 'status', 'aria-live': 'polite' });
  const vinBtn = h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: lookupVin }, 'Look up');
  const vinBox = h('div', { class: 'field vin-box' }, h('label', { for: 'f-vin' }, 'Have the VIN? (optional)'), h('div', { class: 'vin-row' }, vinIn, vinBtn), vinMsg);
  async function lookupVin() {
    const v = cleanVin(vinIn.value);
    if (!isVin(v)) { vinMsg.className = 'err'; vinMsg.textContent = 'A VIN has 17 letters and digits (no I, O or Q).'; return; }
    vinBtn.disabled = true; vinMsg.className = 'hint'; vinMsg.textContent = 'Looking it up…';
    try {
      const r = await fetch(`/api/vin?vin=${encodeURIComponent(v)}`); const d = await r.json().catch(() => ({}));
      if (!r.ok) { vinMsg.className = 'err'; vinMsg.textContent = d.message || 'Could not look that up.'; return; }
      if (d.type && VEHICLES.includes(d.type) && !VEHICLES.includes(st.type)) { st.type = d.type; status.value = ''; drawTypes(); fillStatus(); }
      setFill(name, d.name); setFill(notes, [`VIN ${d.vin}`, d.details].filter(Boolean).join('. ').slice(0, 500));
      vinMsg.className = 'hint'; vinMsg.textContent = `${d.name || 'Vehicle'} found${d.checkDigitOk ? '' : ' (the VIN check digit does not match, so double-check it)'}. Add its value and cost below.`;
    } catch { vinMsg.className = 'err'; vinMsg.textContent = 'Could not reach the vehicle database. Type the details in instead.'; }
    finally { vinBtn.disabled = false; }
  }
  const syncVin = () => { vinBox.hidden = edit || !VEHICLES.includes(st.type); };
  onType = syncVin; syncVin();

  const form = h('form', { class: 'asset-form', novalidate: true },
    autofill,
    h('div', { class: 'field' }, h('span', { class: 'lab' }, 'What are you adding?'), typeHost, mkErr.type),
    vinBox,
    field('Name', name, 'name'),
    h('div', { class: 'field' }, h('label', { for: 'f-place' }, 'Location'), place, cityList, customBox, custom, mkErr.place),
    ...(hasRates() ? [field('Currency of these amounts', curSel, 'currency', 'Amounts are kept in this currency; Owned Map shows and adds everything in US dollars at today’s rate.')] : []),
    h('div', { class: 'two' }, field('Estimated value', value, 'value'), field('Acquisition cost', cost, 'cost')),
    h('div', { class: 'field period' }, h('label', { for: 'f-period' }, 'I will enter income and expenses'), period),
    h('div', { class: 'two' }, incField, expField),
    h('div', { class: 'two' }, field('Debt owed (optional)', debt, 'debt', 'Mortgage or loan balance still to pay.'), field('Monthly payment (optional)', debtPayment, 'debtPayment', 'What you pay each month on that debt.')),
    h('div', { class: 'two' }, field('Loan interest rate, % a year (optional)', debtRate, 'debtRate', 'Lets Owned Map work out when the loan ends.'), field('Value moves by, % a year (optional)', annualChange, 'annualChange', 'For example -12 for a car, 3 for a home. Leave empty if you update it yourself.')),
    h('div', { class: 'two' }, field('Your share of this asset, % (optional)', ownership, 'ownership', 'Leave empty if it is all yours. Value, debt and income above are for the whole asset; Owned Map counts only your share.'), field('Held by (optional)', owner, 'owner', 'You, a company, your partner…')), ownerData,
    h('div', { class: 'two' }, field('Status', status, 'status'), field('Acquired on (optional)', acquired, 'acquiredOn', 'Starts the value history.')),
    field('Notes (optional)', notes, 'notes'),
    formErr,
    h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => modal().close() }, 'Cancel'), submit));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const customOn = customBox.querySelector('input').checked;
    const r = validateAsset({
      type: st.type, name: name.value, place: place.value, customPlace: customOn,
      placeName: custom.querySelector('#f-placename').value, country: custom.querySelector('#f-country').value, lat: custom.querySelector('#f-lat').value, lon: custom.querySelector('#f-lon').value,
      value: value.value, cost: cost.value, gross: toYear(gross.value), expenses: toYear(expenses.value), debt: debt.value, debtPayment: debtPayment.value, ownership: ownership.value, owner: owner.value, currency: curSel.value, debtRate: debtRate.value, annualChange: annualChange.value, status: status.value, acquiredOn: acquired.value, notes: notes.value,
    });
    Object.entries(mkErr).forEach(([k, p]) => { p.textContent = r.errors[k] || ''; });
    form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    Object.keys(r.errors).forEach(k => { const el = { name, place, value, cost, gross, expenses, debt, debtPayment, ownership, owner, currency: curSel, debtRate, annualChange, status, acquiredOn: acquired, notes, placeName: custom.querySelector('#f-placename'), country: custom.querySelector('#f-country'), lat: custom.querySelector('#f-lat'), lon: custom.querySelector('#f-lon') }[k]; el && el.setAttribute('aria-invalid', 'true'); });
    if (!r.ok) { formErr.textContent = ''; (form.querySelector('[aria-invalid="true"]') || typeHost.querySelector('button'))?.focus(); return; }
    formErr.textContent = ''; submit.disabled = true; submit.classList.add('busy'); submit.querySelector('.lbl').textContent = 'Saving…';
    try {
      const saved = edit ? await store.update(existing.id, r.value, { prev: existing }) : await store.add(r.value);
      raw = edit ? raw.map(x => (x.id === saved.id ? saved : x)) : [...raw, saved];
      modal().close(); sync(saved.id); toast(edit ? 'Changes saved.' : 'Asset added.');
      if (source && attach.checked) {
        try { const d = await extras.addDoc(saved.id, source.file, source.kind); docs = [d, ...docs]; sync(saved.id); }
        catch (x2) { toast(`Asset added, but the file could not be kept: ${message(x2)}`, 'err'); }
      }
      if (opts.onSaved) opts.onSaved(saved);
    } catch (x) {
      if (x && x.status === 401) { modal().close(); toast('Your session expired. Please sign in again.', 'err'); setTimeout(() => location.reload(), 1200); return; }
      formErr.textContent = `Could not save: ${message(x)}`;
    } finally { submit.disabled = false; submit.classList.remove('busy'); submit.querySelector('.lbl').textContent = edit ? 'Save changes' : 'Add asset'; }
  });

  openModal(h('div', { class: 'modal-card' }, h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, edit ? 'Edit asset' : 'Add an asset'),
    h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')), form));
  setTimeout(() => (edit ? name : typeHost.querySelector('button')).focus(), 30);
}

/* ------------------------------------------------------------------ reminders */
const reminderApi = {
  list: () => rems,
  get note() { return cloud.configured && CONFIG.remindersEmail ? `We email you at ${cloud.user()?.email || 'your address'} when something is due.` : 'Reminders show here and in the badge on this tab. Email alerts are not switched on yet.'; },
  onAdd: assetId => openReminderForm(assetId),
  onDone: id => patchReminder(id, completionPatch(rems.find(r => r.id === id))),
  onReopen: id => patchReminder(id, { done: false, lastNotifiedOn: null }),
  onDelete: async id => { if (await run('Could not delete the reminder', async () => { await extras.removeReminder(id); return true; })) { rems = rems.filter(r => r.id !== id); sync(); refreshExtras(); toast('Reminder deleted.'); } },
};
async function patchReminder(id, patch) {
  const saved = await run('Could not update the reminder', () => extras.updateReminder(id, patch));
  if (!saved) return;
  rems = rems.map(r => (r.id === id ? saved : r)); sync(); refreshExtras();
  toast(patch.done === false && patch.dueOn ? `Renewed. Next due ${saved.dueOn}.` : patch.done ? 'Marked done.' : 'Updated.');
}

function openReminderForm(assetId, { back } = {}) {
  if (!raw.length) { toast('Add an asset first, then set reminders for it.', 'err'); return; }
  const today = isoDay(), er = {};
  ['asset', 'kind', 'title', 'dueOn', 'repeat', 'notifyDays'].forEach(k => { er[k] = h('p', { class: 'err', role: 'alert' }); });
  const fld = (label, control, k, hint) => h('div', { class: 'field' }, h('label', { for: control.id }, label), control, hint ? h('p', { class: 'hint' }, hint) : null, er[k]);
  const asset = h('select', { id: 'r-asset' }, ...raw.map(a => h('option', { value: a.id }, a.name)));
  asset.value = assetId && raw.some(a => a.id === assetId) ? assetId : raw[0].id;
  const kind = h('select', { id: 'r-kind' }, ...Object.entries(REMINDER_KINDS).map(([k, v]) => h('option', { value: k }, v.label)));
  const title = h('input', { id: 'r-title', type: 'text', maxlength: 120, autocomplete: 'off', placeholder: REMINDER_KINDS.insurance.title });
  kind.value = 'insurance';
  kind.addEventListener('change', () => { title.placeholder = REMINDER_KINDS[kind.value].title || 'What is due?'; });
  const due = h('input', { id: 'r-due', type: 'date', min: '2000-01-01' });
  const repeat = h('select', { id: 'r-repeat' }, ...Object.entries(REPEATS).map(([k, v]) => h('option', { value: k }, v)));
  const notify = h('input', { id: 'r-notify', type: 'text', inputmode: 'numeric', value: '14' });
  const formErr = h('p', { class: 'err form-err', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, h('span', { class: 'lbl' }, 'Add reminder'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
  const form = h('form', { class: 'asset-form', novalidate: true },
    fld('Asset', asset, 'asset'),
    h('div', { class: 'two' }, fld('Type', kind, 'kind'), fld('Due date', due, 'dueOn')),
    fld('Title (optional)', title, 'title', 'Leave blank to use the type, for example “Insurance renewal”.'),
    h('div', { class: 'two' }, fld('Repeats', repeat, 'repeat'), fld('Remind me (days before)', notify, 'notifyDays', 'Between 0 and 90.')),
    formErr,
    h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => (back ? back() : modal().close()) }, back ? 'Back' : 'Cancel'), submit));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const r = validateReminder({ kind: kind.value, title: title.value, dueOn: due.value, repeat: repeat.value, notifyDays: notify.value }, { today });
    Object.entries(er).forEach(([k, p]) => { p.textContent = r.errors[k] || ''; });
    if (!r.ok) return;
    submit.disabled = true; submit.classList.add('busy'); formErr.textContent = '';
    try {
      const saved = await extras.addReminder(asset.value, r.value);
      rems = [...rems, saved]; sync(); toast('Reminder added.');
      if (back) back(); else modal().close();
    } catch (x) { formErr.textContent = `Could not save: ${message(x)}`; }
    finally { submit.disabled = false; submit.classList.remove('busy'); }
  });
  openModal(h('div', { class: 'modal-card' }, h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, 'Add a reminder'),
    h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')), form));
  setTimeout(() => due.focus(), 30);
}

/* ------------------------------------------------------------------ documents and reminders of one asset */
let extrasFor = null;
function refreshExtras() { if (extrasFor && modal().open && modal().querySelector('.extras')) openExtras(extrasFor, { keepScroll: true }); }

function openExtras(assetId, { keepScroll = false } = {}) {
  const a = raw.find(r => r.id === assetId); if (!a) return;
  extrasFor = assetId;
  const prev = keepScroll ? modal().querySelector('.modal-card')?.scrollTop || 0 : 0;
  const mine = docs.filter(d => d.assetId === assetId), myRems = rems.filter(r => r.assetId === assetId).sort((x, y) => (x.dueOn < y.dueOn ? -1 : 1));
  const kindSel = h('select', { id: 'd-kind', 'aria-label': 'Document type' }, ...Object.entries(DOC_KINDS).map(([k, v]) => h('option', { value: k }, v)));
  const file = h('input', { id: 'd-file', type: 'file', accept: '.pdf,.png,.jpg,.jpeg,.webp,.heic,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt', 'aria-label': 'Choose a file' });
  const dErr = h('p', { class: 'err', role: 'alert' });
  const up = h('button', { type: 'button', class: 'btn btn-primary btn-sm' }, h('span', { class: 'lbl' }, 'Upload'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
  up.addEventListener('click', async () => {
    const f = file.files[0], bad = validateFile(f); dErr.textContent = bad || '';
    if (bad) return;
    up.disabled = true; up.classList.add('busy'); up.querySelector('.lbl').textContent = 'Uploading…';
    try { const d = await extras.addDoc(assetId, f, kindSel.value); docs = [d, ...docs]; sync(); toast('Document saved.'); openExtras(assetId, { keepScroll: true }); }
    catch (x) { dErr.textContent = `Could not upload: ${message(x)}`; up.disabled = false; up.classList.remove('busy'); up.querySelector('.lbl').textContent = 'Upload'; }
  });
  const openDoc = async d => { try { const u = await extras.docUrl(d); const w = window.open(u, '_blank', 'noopener'); if (!w) location.href = u; } catch (x) { toast(message(x), 'err'); } };
  const delDoc = async d => {
    if (!window.confirm(`Delete “${d.name}”? This cannot be undone.`)) return;
    if (await run('Could not delete the document', async () => { await extras.removeDoc(d); return true; })) { docs = docs.filter(x => x.id !== d.id); sync(); toast('Document deleted.'); openExtras(assetId, { keepScroll: true }); }
  };
  const thumbFor = d => {
    const box = h('span', { class: 'doc-ico', 'aria-hidden': 'true' }, (d.name.split('.').pop() || 'file').slice(0, 4).toUpperCase());
    if (/^image\//.test(d.mime || '') || /\.(png|jpe?g|webp|gif)$/i.test(d.name)) extras.docUrl(d).then(u => { const im = h('img', { src: u, alt: '', loading: 'lazy' }); box.replaceChildren(im); box.classList.add('img'); }).catch(() => {});
    return box;
  };
  const docRow = d => h('li', { class: 'doc-row' }, thumbFor(d),
    h('div', { class: 'doc-main' }, h('b', {}, d.name), h('span', {}, `${DOC_KINDS[d.kind] || 'Other'} · ${sizeText(d.size)} · ${String(d.createdAt || '').slice(0, 10)}`)),
    h('div', { class: 'rem-act' }, h('button', { type: 'button', class: 'mini-btn', onclick: () => openDoc(d) }, 'Open'), h('button', { type: 'button', class: 'mini-btn danger', onclick: () => delDoc(d) }, 'Delete')));
  const today = isoDay();
  const activity = activityFor(a, mine);
  const remRow = r => h('li', { class: `rem-row ${statusOf(r, today)}` },
    h('span', { class: 'rem-kind' }, REMINDER_KINDS[r.kind] ? REMINDER_KINDS[r.kind].label : 'Other'),
    h('div', { class: 'rem-main' }, h('b', {}, r.title), h('span', {}, r.repeat !== 'none' ? REPEATS[r.repeat] : 'One time')),
    h('div', { class: 'rem-when' }, h('b', {}, r.done ? 'Done' : whenWord(r)), h('span', {}, r.dueOn)),
    h('div', { class: 'rem-act' }, r.done ? null : h('button', { type: 'button', class: 'mini-btn', onclick: () => reminderApi.onDone(r.id) }, r.repeat !== 'none' ? 'Done, renew' : 'Mark done'), h('button', { type: 'button', class: 'mini-btn danger', onclick: () => reminderApi.onDelete(r.id) }, 'Delete')));
  const whenWord = r => { const d = Math.round((Date.parse(`${r.dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000); return d < 0 ? `Overdue by ${-d}d` : d === 0 ? 'Due today' : `In ${d} days`; };
  openModal(h('div', { class: 'modal-card wide extras' },
    h('div', { class: 'modal-head' }, h('div', {}, h('h2', { id: 'modal-title' }, a.name), h('p', { class: 'hint' }, `${a.place}${a.owner ? ' · ' + a.owner : ''}${Number(a.ownership) < 100 ? ' · you own ' + a.ownership + '%' : ''}`)), h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')),
    h('section', { class: 'xt-sec' }, h('h3', {}, 'Documents'),
      h('p', { class: 'hint' }, extras.kind === 'cloud' ? 'Deeds, insurance, registration, invoices and your own photos. Stored privately in your account. Up to 10 MB each.' : 'Stored on this device only. Up to 10 MB each. Sign in to keep them across devices.'),
      h('div', { class: 'upload-row' }, kindSel, file, up), dErr,
      mine.length ? h('ul', { class: 'doc-list' }, mine.map(docRow)) : h('p', { class: 'xt-empty' }, 'No documents yet.')),
    h('section', { class: 'xt-sec' }, h('div', { class: 'xt-h' }, h('h3', {}, 'Reminders'), h('div', { class: 'xt-btns' }, h('button', { type: 'button', class: 'mini-btn', onclick: () => tools.openStandard(assetId, { back: () => openExtras(assetId) }) }, 'Add the usual ones'), h('button', { type: 'button', class: 'mini-btn', onclick: () => openReminderForm(assetId, { back: () => openExtras(assetId) }) }, '+ Add reminder'))),
      myRems.length ? h('ul', { class: 'rem-list' }, myRems.map(remRow)) : h('p', { class: 'xt-empty' }, 'No reminders yet. Add insurance, tax or inspection dates so they never slip.')),
    h('section', { class: 'xt-sec' }, h('h3', {}, 'Activity'),
      activity.length ? h('ol', { class: 'tl' }, activity.map(e => h('li', { class: `tl-i ${e.type}` }, h('span', { class: 'tl-dot', 'aria-hidden': 'true' }), h('div', {}, h('b', {}, e.title), h('span', {}, e.detail)), h('time', {}, e.when)))) : h('p', { class: 'xt-empty' }, 'Nothing recorded yet.'))),
  { onClose: () => { extrasFor = null; } });
  if (prev) modal().querySelector('.modal-card').scrollTop = prev;
}

/* ------------------------------------------------------------------ import from CSV */
function openImport(opts = {}) {
  const file = h('input', { id: 'imp-file', type: 'file', accept: '.csv,.txt,text/csv', 'aria-label': 'Choose a CSV file' });
  const out = h('div', { class: 'imp-out' }), err = h('p', { class: 'err', role: 'alert' });
  const doImport = h('button', { type: 'button', class: 'btn btn-primary btn-sm', disabled: true }, h('span', { class: 'lbl' }, 'Import'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
  let ready = [];
  const show = (text) => {
    const p = previewImport(text, { existing: raw });
    clear(out); ready = []; doImport.disabled = true; err.textContent = '';
    if (!p.ok) { err.textContent = p.error; return; }
    const skipDupes = h('input', { type: 'checkbox', checked: true, id: 'imp-skip' });
    const good = p.rows.filter(r => r.ok), bad = p.rows.filter(r => !r.ok), dupes = good.filter(r => r.dupe);
    const recount = () => { ready = good.filter(r => !(skipDupes.checked && r.dupe)).map(r => r.value); doImport.querySelector('.lbl').textContent = ready.length ? `Import ${ready.length} asset${ready.length > 1 ? 's' : ''}` : 'Nothing to import'; doImport.disabled = !ready.length; };
    out.append(...[h('p', { class: 'imp-sum' }, h('b', {}, `${good.length} ready`), bad.length ? h('span', { class: 'neg' }, ` · ${bad.length} need fixes`) : null, dupes.length ? ` · ${dupes.length} possible duplicate${dupes.length > 1 ? 's' : ''}` : null),
      dupes.length ? h('label', { class: 'check' }, skipDupes, h('span', {}, 'Skip assets already in my portfolio (same name and place)')) : null,
      h('div', { class: 'imp-tbl' }, h('table', { class: 'app-tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Row'), h('th', {}, 'Asset'), h('th', { class: 'r' }, 'Value'), h('th', {}, 'Result'))),
        h('tbody', {}, p.rows.slice(0, 100).map(r => h('tr', { class: r.ok ? '' : 'bad' }, h('td', {}, String(r.line)), h('td', {}, r.name), h('td', { class: 'r' }, r.ok ? money(r.value.value) : ''),
          h('td', {}, r.ok ? (r.dupe ? 'Possible duplicate' : 'Ready') : r.errors.join(' ')))))),
        p.rows.length > 100 ? h('p', { class: 'hint' }, `Showing the first 100 of ${p.rows.length} rows.`) : null)].filter(Boolean));
    skipDupes.addEventListener('change', recount); recount();
  };
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { err.textContent = 'That file is larger than 2 MB. Split it into smaller files.'; return; }
    show(await f.text());
  });
  doImport.addEventListener('click', async () => {
    doImport.disabled = true; doImport.classList.add('busy');
    try {
      const batch = ready.map(v => ({ ...v, isSample: false }));
      for (let i = 0; i < batch.length; i += 100) await store.addMany(batch.slice(i, i + 100));
      raw = await listAssets(); sync(); modal().close(); toast(`${batch.length} asset${batch.length > 1 ? 's' : ''} imported.`);
      if (opts.onDone) opts.onDone();
    } catch (x) { err.textContent = `Could not import: ${message(x)}`; doImport.disabled = false; }
    finally { doImport.classList.remove('busy'); }
  });
  openModal(h('div', { class: 'modal-card wide' }, h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, 'Import assets from a CSV'),
    h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')),
    h('p', { class: 'modal-text' }, 'Export your spreadsheet as CSV (File, Download, CSV in Excel or Google Sheets) and choose it below. Required columns: name, type, location, value and cost. Debt, income, expenses, status, date and notes are optional.'),
    h('div', { class: 'imp-pick' }, file, h('button', { type: 'button', class: 'mini-btn', onclick: () => download('owned-map-import-template.csv', new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })) }, 'Download template')),
    err, out, h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => modal().close() }, 'Cancel'), doImport)));
}

/* ------------------------------------------------------------------ quick "update value" */
function openQuick(id) {
  const a = raw.find(r => r.id === id); if (!a) return;
  const rem = rems.find(r => r.assetId === id && r.title === UPDATE_TITLE && !r.done);
  const value = h('input', { id: 'q-value', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: String(a.value) });
  const debt = h('input', { id: 'q-debt', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: a.debt ? String(a.debt) : '', placeholder: '0' });
  const remind = h('input', { id: 'q-remind', type: 'checkbox', checked: !rem });
  const err = { value: h('p', { class: 'err', role: 'alert' }), debt: h('p', { class: 'err', role: 'alert' }) }, formErr = h('p', { class: 'err form-err', role: 'alert' });
  const save = h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, h('span', { class: 'lbl' }, 'Save value'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
  const share = Number(a.ownership) < 100 ? h('p', { class: 'hint' }, `This is the value of the whole asset. You own ${a.ownership}%.`) : null;
  const form = h('form', { class: 'asset-form', novalidate: true },
    h('div', { class: 'field' }, h('label', { for: 'q-value' }, `Estimated value today (${a.currency || 'USD'})`), value, share, err.value),
    h('div', { class: 'field' }, h('label', { for: 'q-debt' }, `Debt still owed (${a.currency || 'USD'}, optional)`), debt, h('p', { class: 'hint' }, a.debt ? 'Update it if you paid some of it down.' : 'Leave empty if there is no loan on it.'), err.debt),
    rem ? h('p', { class: 'hint' }, `Your monthly reminder to update this value is due ${rem.dueOn}. Saving moves it to next month.`) : h('label', { class: 'check' }, remind, h('span', {}, 'Remind me every month to update this value')),
    formErr, h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => modal().close() }, 'Cancel'), save));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const r = quickValues(a, { value: value.value, debt: debt.value });
    err.value.textContent = r.errors.value || ''; err.debt.textContent = r.errors.debt || ''; formErr.textContent = '';
    if (!r.ok) return;
    save.disabled = true; save.classList.add('busy');
    try {
      const saved = await store.update(id, r.value, { prev: a });
      raw = raw.map(x => (x.id === id ? saved : x));
      if (rem) { const up = await extras.updateReminder(rem.id, completionPatch(rem)); rems = rems.map(x => (x.id === rem.id ? up : x)); }
      else if (remind.checked) { const nr = await extras.addReminder(id, { kind: 'other', title: UPDATE_TITLE, dueOn: nextDue(isoDay(), 'monthly'), repeat: 'monthly', notifyDays: 3 }); rems = [...rems, nr]; }
      modal().close(); sync(id);
      const was = a.value ? (saved.value - a.value) / a.value : 0;
      toast(saved.value === a.value ? 'Value confirmed.' : `Value updated (${was >= 0 ? '+' : ''}${(was * 100).toFixed(1)}%).`);
    } catch (x) { formErr.textContent = `Could not save: ${message(x)}`; save.disabled = false; save.classList.remove('busy'); }
  });
  openModal(h('div', { class: 'modal-card small' }, h('div', { class: 'modal-head' }, h('div', {}, h('h2', { id: 'modal-title' }, 'Update value'), h('p', { class: 'hint' }, a.name)),
    h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')), form));
  setTimeout(() => { value.focus(); value.select(); }, 30);
}

/* ------------------------------------------------------------------ first-minute guide */
const welcomeKey = () => `atlas.welcome.v1:${cloud.user()?.id || 'device'}`;
const seenWelcome = () => { try { return localStorage.getItem(welcomeKey()) === '1'; } catch { return false; } };
const markWelcome = () => { try { localStorage.setItem(welcomeKey(), '1'); } catch { /* the guide just shows again next time */ } };

function openWelcome({ step = 1, picked = [], assetId = null } = {}) {
  markWelcome();
  const dots = n => h('div', { class: 'wz-dots', role: 'img', 'aria-label': `Step ${n} of 3` }, [1, 2, 3].map(i => h('i', { class: i <= n ? 'on' : '' })));
  const frame = (n, title, text, body, actions) => openModal(h('div', { class: 'modal-card wide wizard' },
    h('div', { class: 'modal-head' }, dots(n), h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close guide', onclick: () => modal().close() }, '×')),
    h('h2', { id: 'modal-title' }, title), h('p', { class: 'modal-text' }, text), body, h('div', { class: 'modal-actions' }, ...actions)));
  const skip = h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => modal().close() }, 'Skip for now');

  if (step === 1) {
    const grid = h('div', { class: 'type-grid wz-types', role: 'group', 'aria-label': 'What you own' });
    const next = h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => openWelcome({ step: 2, picked }) }, 'Continue');
    const draw = () => {
      grid.replaceChildren(...ASSET_TYPES.map(t => h('button', { type: 'button', class: 'type-card' + (picked.includes(t.key) ? ' on' : ''), 'aria-pressed': String(picked.includes(t.key)),
        onclick: () => { picked = picked.includes(t.key) ? picked.filter(k => k !== t.key) : [...picked, t.key]; draw(); } }, thumb({ type: t.key, category: t.category }, 52), h('span', {}, t.label))));
      next.textContent = picked.length ? `Continue with ${picked.length}` : 'Continue';
    };
    draw(); frame(1, 'What do you own?', 'Pick everything that applies. We use it to start you off, and you can add any type later.', grid, [skip, next]);
    return;
  }
  if (step === 2) {
    const first = TYPE_BY_KEY[picked[0]];
    const opt = (title, text, onclick, primary) => h('button', { type: 'button', class: 'wz-opt' + (primary ? ' primary' : ''), onclick }, h('b', {}, title), h('span', {}, text));
    frame(2, 'Add your first one', first ? `Let’s start with your ${first.label.toLowerCase()}.` : 'Choose the easiest way to get your first asset in.',
      h('div', { class: 'wz-opts' },
        opt(first ? `Add your ${first.label.toLowerCase()}` : 'Add an asset', 'Takes about a minute: name, place, value and cost.', () => { modal().close(); openForm(null, { type: first ? first.key : '', onSaved: s => openWelcome({ step: 3, assetId: s.id }) }); }, true),
        opt('Import a spreadsheet', 'Bring in many assets at once from a CSV file.', () => { modal().close(); openImport({ onDone: () => { if (raw[0]) openWelcome({ step: 3, assetId: raw[0].id }); } }); }),
        opt('Look around with sample data', 'See how everything works first. You can remove it in one click.', async () => { modal().close(); await loadSample(); })),
      [h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => openWelcome({ step: 1, picked }) }, 'Back'), skip]);
    return;
  }
  const a = raw.find(r => r.id === assetId);
  if (!a) { modal().close(); return; }
  const presets = [
    { kind: 'insurance', title: 'Insurance renewal', repeat: 'yearly', date: '', on: true, note: 'Every year' },
    { kind: 'other', title: UPDATE_TITLE, repeat: 'monthly', date: nextDue(isoDay(), 'monthly'), on: true, note: 'Every month, keeps your history up to date' },
    { kind: 'inspection', title: 'Inspection or service', repeat: 'yearly', date: '', on: false, note: 'Every year' },
  ];
  const rows = presets.map(p => {
    const box = h('input', { type: 'checkbox', checked: p.on, id: `wz-${p.kind}-${p.repeat}` }), date = h('input', { type: 'date', value: p.date, 'aria-label': `${p.title} date` });
    return { p, box, date, el: h('div', { class: 'wz-rem' }, h('label', { class: 'check', for: box.id }, box, h('span', {}, h('b', {}, p.title), h('em', {}, p.note))), date) };
  });
  const err = h('p', { class: 'err form-err', role: 'alert' });
  const done = h('button', { type: 'button', class: 'btn btn-primary btn-sm' }, h('span', { class: 'lbl' }, 'Finish setup'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
  done.addEventListener('click', async () => {
    err.textContent = '';
    const chosen = rows.filter(r => r.box.checked);
    if (chosen.some(r => !r.date.value)) { err.textContent = 'Pick a date for each reminder you keep ticked.'; return; }
    done.disabled = true; done.classList.add('busy');
    try { for (const r of chosen) { const v = validateReminder({ kind: r.p.kind, title: r.p.title, dueOn: r.date.value, repeat: r.p.repeat, notifyDays: r.p.repeat === 'monthly' ? 3 : 14 }); if (v.ok) rems = [...rems, await extras.addReminder(a.id, v.value)]; }
      modal().close(); sync(a.id); toast(chosen.length ? 'You are all set. Reminders added.' : 'You are all set.'); }
    catch (x) { err.textContent = `Could not save: ${message(x)}`; done.disabled = false; done.classList.remove('busy'); }
  });
  frame(3, 'Never miss a date', `Set the dates that matter for ${a.name}. ${cloud.configured && CONFIG.remindersEmail ? 'We will email you before they are due.' : 'They show in the Reminders tab with a badge when due.'}`,
    h('div', { class: 'wz-rems' }, ...rows.map(r => r.el), err), [h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => modal().close() }, 'Skip'), done]);
}

const shareUi = createShareUi({ cloud, openModal, modal, toast, run, message });
const membersUi = createMembersUi({ cloud, openModal, modal, toast, run, message });
const heirUi = createHeirUi({ cloud, openModal, modal, toast, run, message });
const settingsFacade = {
  get: async () => settings,
  save: async patch => {
    if (!settingsReady) throw new Error('Settings need the latest database update (see the README) before they can be saved.');
    settings = await settingsApi.save({ ...settings, ...patch }); return settings;
  },
};
// what the Insights view reads and writes; save() resolves to an error message, or null when it worked
const insightsApi = {
  settings: () => settings,
  save: async patch => { try { await settingsFacade.save(patch); return null; } catch (e) { return message(e); } },
};
const tools = createTools({
  openModal, modal, toast, run, message,
  rawOf: id => raw.find(r => r.id === id), viewOf: id => views.find(v => v.id === id), assets: () => views, docs: () => docs, rems: () => rems, setRems: l => { rems = l; },
  addReminder: (id, v) => extras.addReminder(id, v),
  saveAsset: async (id, v, prev) => { const saved = await store.update(id, v, { prev }); raw = raw.map(x => (x.id === id ? saved : x)); sync(id); return saved; },
  settings: settingsFacade, sync: id => sync(id), owner: () => cloud.user()?.email || '',
});

/* ------------------------------------------------------------------ what each kind of access can do */
function actionsFor(acc) {
  if (!acc.edit) return {}; // read only: the figures, the map and the reports, nothing that changes data
  return {
    onLoan: id => tools.openLoan(id), onSell: id => tools.openSale(id), onAdd: () => openForm(), onEdit: id => openForm(raw.find(r => r.id === id)), onDelete: removeAsset,
    onImport: () => openImport(), onDocs: id => openExtras(id), onQuick: openQuick,
    ...(acc.sample ? { onSample: loadSample } : {}), ...(acc.welcome ? { onWelcome: () => openWelcome() } : {}),
    ...(acc.emergency ? { onEmergency: () => tools.printEmergency(), onContacts: () => tools.openContacts() } : {}),
    ...(cloud.configured && acc.share ? { onShare: () => shareUi.open(), onMembers: () => membersUi.open(), onHeir: () => heirUi.open() } : {}),
  };
}

/* ------------------------------------------------------------------ start */
async function start() {
  try {
    if (cloud.configured) {
      const invite = inviteTokenOf(location.hash);
      if (invite) return showInvite({ cloud, token: invite, show, done: () => location.replace('app.html') });
      const r = await cloud.consumeRedirect().catch(e => ({ error: e.message }));
      if (!cloud.session()) return showAuth(r && r.error);
      const me = cloud.user();
      shared = await loadShared(cloud);
      account = pickAccount(me.id, me.email, shared, savedAccount(me.id));
      store = createCloudStore(cloud, { owner: account.ownerId }); extras = createCloudExtras(cloud, 'asset-docs', account.ownerId);
    } else { store = createLocalStore(); extras = createLocalExtras(); }
    fxInfo = await loadRates();
    raw = await store.list();
  } catch (e) {
    if (e && e.status === 401) return showAuth('Your session has expired. Please sign in again.');
    $('boot').replaceChildren(h('b', {}, 'Could not load your workspace. '), message(e), ' ', h('button', { type: 'button', class: 'mini-btn', onclick: () => location.reload() }, 'Try again'));
    return;
  }
  // documents and reminders are secondary: if they cannot load (e.g. the database update was not applied yet) the assets still work
  try { [docs, rems] = await Promise.all([extras.listDocs(), extras.listReminders()]); } catch (e) { console.error('extras unavailable', e); docs = []; rems = []; toast('Documents and reminders could not be loaded.', 'err'); }
  settingsApi = cloud.configured ? createCloudSettings(cloud) : createLocalSettings();
  try { settings = await settingsApi.get(); } catch (e) { console.error('settings unavailable', e); settingsReady = false; }
  recompute(); show('shell'); renderFoot();
  // a visit of the owner closes the trusted person's sheet again; and tells the owner if it was opened since their last visit
  if (cloud.configured && account.mine) { const before = await heirUi.touch(); if (before?.openedAt && Date.parse(before.openedAt) > Date.parse(before.lastSeenAt)) heirNote = before; }
  dash = mountDashboard({
    getAssets: () => views, csvName: 'owned-map-assets.csv', globeLabel: 'Rotating 3D globe of your assets', owner: (account.mine ? cloud.user()?.email : account.ownerEmail) || '', meta: metaOf,
    cashflow: true,
    insights: insightsApi,
    actions: actionsFor(accessFor(account.role)),
    reminders: accessFor(account.role).edit ? reminderApi : null,
  });
  renderBanner();
  if (account.mine && !raw.length && !seenWelcome()) openWelcome();
  // keep tabs in sync: signing out elsewhere, or the session ending
  cloud.onAuthChange(s => { if (!s && cloud.configured) location.reload(); });
}
start();
