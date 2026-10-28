// ATLAS app entry: sign-in, the user's assets (Supabase or this device), and the dashboard on top of them.
import { CONFIG } from '../assets/config.js';
import { h, clear } from './dom.js';
import { thumb, money } from './ui.js';
import { createCloud } from './cloud.js';
import { createCloudStore, createLocalStore, validateAsset, toView } from './asset-store.js';
import { mountDashboard } from './dashboard.js';
import { sampleRows } from './demo-data.js';
import { ASSET_TYPES, TYPE_BY_KEY } from './types.js';
import { COUNTRIES, CITIES_LIST, placeLabel, findCity } from './places.js';

document.documentElement.classList.add('js');
const $ = id => document.getElementById(id);
const cloud = createCloud({ url: CONFIG.supabaseUrl, anonKey: CONFIG.supabaseAnonKey });
let store = null, raw = [], views = [], dash = null;

/* ------------------------------------------------------------------ small helpers */
let toastTimer = 0;
function toast(msg, kind = 'ok') {
  const t = $('toast'); t.textContent = msg; t.className = `toast show ${kind}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, 4200);
}
const recompute = () => { views = raw.map(toView); };
const show = id => { for (const k of ['boot', 'auth', 'shell']) $(k).hidden = k !== id; };
const message = e => (e && e.message) || 'Something went wrong. Please try again.';

/* ------------------------------------------------------------------ sign in */
function showAuth(error) {
  show('auth');
  const form = $('auth-form'), email = $('auth-email'), err = $('auth-err'), ok = $('auth-ok'), btn = $('auth-submit');
  err.textContent = error || ''; ok.hidden = true; form.hidden = false;
  if (form.dataset.bound) return; form.dataset.bound = '1';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { err.textContent = 'Enter a valid email address.'; email.setAttribute('aria-invalid', 'true'); email.focus(); return; }
    email.removeAttribute('aria-invalid'); err.textContent = '';
    btn.disabled = true; btn.classList.add('busy'); btn.querySelector('.lbl').textContent = 'Sending…';
    try {
      await cloud.signInWithEmail(v, location.origin + location.pathname);
      form.hidden = true; ok.hidden = false; ok.textContent = '';
      ok.append(h('b', {}, 'Check your inbox. '), `We sent a sign-in link to ${v}. Open it on this device to continue.`);
    } catch (x) { err.textContent = message(x); }
    finally { btn.disabled = false; btn.classList.remove('busy'); btn.querySelector('.lbl').textContent = 'Email me a sign-in link'; }
  });
}

/* ------------------------------------------------------------------ the dashboard */
function renderFoot() {
  const f = clear($('side-foot'));
  if (cloud.configured) {
    f.append(h('span', { class: 'sf-user', title: cloud.user()?.email || '' }, cloud.user()?.email || 'Signed in'), h('span', { class: 'sf-sync' }, 'Synced to your account'),
      h('button', { type: 'button', class: 'mini-btn', onclick: signOut }, 'Sign out'));
  } else {
    f.append(h('span', { class: 'sf-sync' }, 'Saved on this device only'));
  }
}
function renderBanner() {
  const b = $('app-banner'), sample = raw.some(r => r.isSample);
  b.hidden = !sample; clear(b);
  if (sample) b.append(h('span', {}, 'You are looking at sample data. Add your own assets and remove the sample whenever you like.'), h('button', { type: 'button', class: 'mini-btn', onclick: removeSample }, 'Remove sample data'));
}
function sync(selectId) { recompute(); renderBanner(); dash.refresh(selectId ? { select: selectId } : {}); }

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
  raw = await run('Could not refresh', () => store.list()) || raw; sync(); toast('Sample portfolio loaded.');
}
async function removeSample() {
  if (!(await run('Could not remove sample data', async () => { await store.removeSample(); return true; }))) return;
  raw = raw.filter(r => !r.isSample); sync(); toast('Sample data removed.');
}
async function removeAsset(id) {
  const a = raw.find(r => r.id === id); if (!a) return;
  const yes = await confirmDialog(`Delete “${a.name}”?`, 'This removes the asset and its value history. It cannot be undone.', 'Delete asset');
  if (!yes) return;
  if (!(await run('Could not delete', async () => { await store.remove(id); return true; }))) return;
  raw = raw.filter(r => r.id !== id); sync(); toast('Asset deleted.');
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
function openForm(existing) {
  const edit = Boolean(existing);
  const init = existing || { type: '', name: '', place: '', value: '', cost: '', gross: '', expenses: '', status: '', acquiredOn: '', notes: '' };
  const known = existing ? findCity(existing.place) : null;
  const st = { type: init.type, custom: Boolean(existing && !known) };
  const errs = {};
  const err = k => h('p', { class: 'err', id: `er-${k}`, role: 'alert' });
  const mkErr = {}; ['type', 'name', 'place', 'placeName', 'country', 'lat', 'lon', 'value', 'cost', 'gross', 'expenses', 'status', 'acquiredOn', 'notes'].forEach(k => { mkErr[k] = err(k); });
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
  const drawTypes = () => typeHost.replaceChildren(...ASSET_TYPES.map(t => {
    const on = st.type === t.key;
    return h('button', { type: 'button', class: 'type-card' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on), onclick: () => { st.type = t.key; status.value = ''; drawTypes(); fillStatus(); } },
      thumb({ type: t.key, category: t.category }, 52), h('span', {}, t.label));
  }));
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
  const acquired = input('f-acq', { type: 'date', value: init.acquiredOn || '', max: new Date().toISOString().slice(0, 10) });
  const notes = h('textarea', { id: 'f-notes', rows: 3, maxlength: 500, placeholder: 'Anything worth remembering (optional)' }, init.notes || '');
  fillStatus(); if (init.status) status.value = init.status;

  const formErr = h('p', { class: 'err form-err', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, h('span', { class: 'lbl' }, edit ? 'Save changes' : 'Add asset'), h('span', { class: 'spin', 'aria-hidden': 'true' }));

  const form = h('form', { class: 'asset-form', novalidate: true },
    h('div', { class: 'field' }, h('span', { class: 'lab' }, 'What are you adding?'), typeHost, mkErr.type),
    field('Name', name, 'name'),
    h('div', { class: 'field' }, h('label', { for: 'f-place' }, 'Location'), place, cityList, customBox, custom, mkErr.place),
    h('div', { class: 'two' }, field('Estimated value (USD)', value, 'value'), field('Acquisition cost (USD)', cost, 'cost')),
    h('div', { class: 'two' }, field('Annual income (optional)', gross, 'gross', 'Rent or revenue per year.'), field('Annual expenses (optional)', expenses, 'expenses', 'Taxes, insurance, upkeep.')),
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
      value: value.value, cost: cost.value, gross: gross.value, expenses: expenses.value, status: status.value, acquiredOn: acquired.value, notes: notes.value,
    });
    Object.entries(mkErr).forEach(([k, p]) => { p.textContent = r.errors[k] || ''; });
    form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    Object.keys(r.errors).forEach(k => { const el = { name, place, value, cost, gross, expenses, status, acquiredOn: acquired, notes, placeName: custom.querySelector('#f-placename'), country: custom.querySelector('#f-country'), lat: custom.querySelector('#f-lat'), lon: custom.querySelector('#f-lon') }[k]; el && el.setAttribute('aria-invalid', 'true'); });
    if (!r.ok) { formErr.textContent = ''; (form.querySelector('[aria-invalid="true"]') || typeHost.querySelector('button'))?.focus(); return; }
    formErr.textContent = ''; submit.disabled = true; submit.classList.add('busy'); submit.querySelector('.lbl').textContent = 'Saving…';
    try {
      const saved = edit ? await store.update(existing.id, r.value) : await store.add(r.value);
      raw = edit ? raw.map(x => (x.id === saved.id ? saved : x)) : [...raw, saved];
      modal().close(); sync(saved.id); toast(edit ? 'Changes saved.' : 'Asset added.');
    } catch (x) {
      if (x && x.status === 401) { modal().close(); toast('Your session expired. Please sign in again.', 'err'); setTimeout(() => location.reload(), 1200); return; }
      formErr.textContent = `Could not save: ${message(x)}`;
    } finally { submit.disabled = false; submit.classList.remove('busy'); submit.querySelector('.lbl').textContent = edit ? 'Save changes' : 'Add asset'; }
  });

  openModal(h('div', { class: 'modal-card' }, h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, edit ? 'Edit asset' : 'Add an asset'),
    h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')), form));
  setTimeout(() => (edit ? name : typeHost.querySelector('button')).focus(), 30);
}

/* ------------------------------------------------------------------ start */
async function start() {
  try {
    if (cloud.configured) {
      const r = await cloud.consumeRedirect().catch(e => ({ error: e.message }));
      if (!cloud.session()) return showAuth(r && r.error);
      store = createCloudStore(cloud);
    } else store = createLocalStore();
    raw = await store.list();
  } catch (e) {
    if (e && e.status === 401) return showAuth('Your session has expired. Please sign in again.');
    $('boot').replaceChildren(h('b', {}, 'Could not load your workspace. '), message(e), ' ', h('button', { type: 'button', class: 'mini-btn', onclick: () => location.reload() }, 'Try again'));
    return;
  }
  recompute(); show('shell'); renderFoot();
  dash = mountDashboard({
    getAssets: () => views, csvName: 'atlas-assets.csv', globeLabel: 'Rotating 3D globe of your assets',
    actions: { onAdd: () => openForm(), onEdit: id => openForm(raw.find(r => r.id === id)), onDelete: removeAsset, onSample: loadSample },
  });
  renderBanner();
  // keep tabs in sync: signing out elsewhere, or the session ending
  cloud.onAuthChange(s => { if (!s && cloud.configured) location.reload(); });
}
start();
