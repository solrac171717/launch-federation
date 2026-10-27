import { h, clear } from './dom.js';
import {
  CLASSES, positionMetrics, portfolioTotals, byClass, byCountry, tone,
  fmtMoney, fmtPct, fmtSigned, seriesChange, validateHolding, toCsv,
} from './calc.js';
import { load, save, newId, logPrice, snapshot, exportJson, parseImport } from './store.js';
import { fetchPrices, fetchHistory } from './prices.js';
import { lineChart, donut, bars } from './charts.js';
import { loadWorld, createMap } from './map.js';

const $ = id => document.getElementById(id);
const state = load();
const ui = { country: null, sort: { key: 'value', dir: -1 }, features: [], names: new Map(), map: null, editing: null };

const CLASS_COLOR = {
  equity: 'var(--c1)', crypto: 'var(--c2)', commodity: 'var(--c3)',
  realestate: 'var(--c4)', bond: 'var(--c5)', cash: 'var(--c6)',
};
const arrow = t => (t === 'pos' ? '▲' : t === 'neg' ? '▼' : '■');
const countryName = id => ui.names.get(String(id)) || `Country ${id}`;

function persist() {
  if (!save(state)) toast('Could not save — browser storage is full or blocked.', 'neg');
}

function toast(msg, kind = 'neu') {
  const el = $('toast');
  el.textContent = msg; el.dataset.kind = kind; el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 4500);
}

function banner(msg, { retry } = {}) {
  const el = $('banner');
  if (!msg) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren(h('span', {}, msg), retry && h('button', { type: 'button', class: 'btn ghost small', onclick: retry }, 'Retry'));
}

/* ---------- Dashboard ---------- */

function Delta({ abs, pct }) {
  const t = tone(abs);
  return h('span', { class: `delta ${t}` },
    h('span', { 'aria-hidden': 'true' }, arrow(t)),
    h('span', {}, fmtSigned(abs)),
    pct != null && h('span', { class: 'pct' }, `(${fmtPct(pct, { sign: true })})`),
    h('span', { class: 'sr' }, t === 'pos' ? 'gain' : t === 'neg' ? 'loss' : 'unchanged'));
}

function kpi(label, value, extra, cls = '') {
  return h('div', { class: `kpi ${cls}` }, h('span', { class: 'kpi-l' }, label), h('strong', { class: 'kpi-v num' }, value), extra);
}

function renderKpis() {
  const t = portfolioTotals(state.holdings);
  const host = clear($('kpis'));
  if (!state.holdings.length) {
    host.append(kpi('Total value', fmtMoney(0)), kpi('Invested', fmtMoney(0)), kpi('Unrealised P&L', '—'), kpi('Holdings', '0'));
    return;
  }
  const classes = byClass(state.holdings), countries = byCountry(state.holdings);
  host.append(
    kpi('Total value', fmtMoney(t.value), h('span', { class: 'kpi-s' }, t.unpriced ? `${t.unpriced} unpriced, carried at cost` : 'All holdings priced'), 'lead'),
    kpi('Invested', fmtMoney(t.cost), h('span', { class: 'kpi-s' }, `Across ${t.count} holding${t.count > 1 ? 's' : ''}`)),
    kpi('Unrealised P&L', Delta({ abs: t.pnl, pct: t.pnlPct }), null, `pnl ${tone(t.pnl)}`),
    kpi('Diversification', `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`,
      h('span', { class: 'kpi-s' }, `${classes.length} asset class${classes.length > 1 ? 'es' : ''} · top: ${fmtPct(countries[0].share)} ${countryName(countries[0].key)}`)),
  );
}

function visibleHoldings() {
  return ui.country ? state.holdings.filter(x => x.countryId === ui.country) : state.holdings;
}

function renderMapAndSide() {
  const groups = byCountry(state.holdings);
  ui.map?.update(groups, ui.country);
  const sel = ui.country ? groups.find(g => g.key === ui.country) : null;
  $('map-sub').textContent = !state.holdings.length ? 'Add a holding to light up the map'
    : sel ? `${countryName(sel.key)} · ${fmtMoney(sel.value, { compact: true })} · ${fmtPct(sel.share)} of portfolio`
      : `${groups.length} ${groups.length === 1 ? 'country' : 'countries'} · click a highlighted country to filter holdings`;
  $('clear-country').hidden = !ui.country;

  const scope = visibleHoldings();
  const hostD = $('donut');
  if (!scope.length) {
    clear(hostD).append(emptyBlock('No allocation yet', 'Your asset-class breakdown appears here once you add a holding.'));
  } else {
    const t = portfolioTotals(scope);
    donut(hostD, byClass(scope), {
      labelOf: k => CLASSES[k], colorOf: k => CLASS_COLOR[k],
      centre: { value: fmtMoney(t.value, { compact: true }), label: ui.country ? countryName(ui.country) : 'Total' },
    });
  }
  $('side-sub').textContent = ui.country ? `By asset class · ${countryName(ui.country)}` : 'By asset class';
  const hostB = $('country-bars');
  if (!groups.length) clear(hostB).append(h('p', { class: 'muted' }, 'No country exposure yet.'));
  else bars(hostB, groups, { labelOf: countryName, onPick: pickCountry });
}

function pickCountry(id) {
  ui.country = ui.country === id ? null : id;
  renderMapAndSide(); renderTable();
}

function emptyBlock(title, text, action) {
  return h('div', { class: 'empty' }, h('strong', {}, title), h('p', {}, text), action);
}

function renderHistory() {
  const host = $('history');
  const series = state.snapshots.map(p => ({ t: new Date(p.d + 'T00:00:00Z').getTime(), v: p.v }));
  if (!lineChart(host, series, { label: 'Portfolio value' })) {
    clear(host).append(emptyBlock(
      state.holdings.length ? 'History starts today' : 'No history yet',
      state.holdings.length
        ? 'ATLAS records one real value per day. Come back tomorrow and the line will begin to draw.'
        : 'Add your first holding. From then on ATLAS records its total value once per day.'));
  }
}

const COLS = [
  { key: 'name', label: 'Asset', get: x => x.name.toLowerCase(), text: true },
  { key: 'class', label: 'Class', get: x => CLASSES[x.class], text: true },
  { key: 'country', label: 'Country', get: x => countryName(x.countryId), text: true },
  { key: 'quantity', label: 'Qty', get: x => x.quantity },
  { key: 'price', label: 'Price', get: x => (Number.isFinite(x.price) ? x.price : -Infinity) },
  { key: 'value', label: 'Value', get: x => positionMetrics(x).value ?? positionMetrics(x).cost },
  { key: 'pnl', label: 'P&L', get: x => positionMetrics(x).pnl ?? -Infinity },
  { key: 'share', label: 'Share', get: x => positionMetrics(x).value ?? positionMetrics(x).cost },
];

function renderTable() {
  const host = clear($('table-host'));
  const rows = visibleHoldings();
  const total = portfolioTotals(state.holdings).value;
  $('table-sub').textContent = ui.country ? `Filtered to ${countryName(ui.country)} · ${rows.length} of ${state.holdings.length}`
    : `${state.holdings.length} holding${state.holdings.length === 1 ? '' : 's'}`;
  if (!state.holdings.length) {
    host.append(emptyBlock('No holdings yet', 'Add what you own — stocks, crypto, property, cash — and ATLAS maps where your money sits in the world.',
      h('button', { class: 'btn primary', type: 'button', onclick: () => openForm() }, 'Add your first holding')));
    return;
  }
  if (!rows.length) { host.append(emptyBlock('Nothing in this country', 'No holdings match the selected country.')); return; }

  const col = COLS.find(c => c.key === ui.sort.key) || COLS[5];
  const sorted = [...rows].sort((a, b) => {
    const x = col.get(a), y = col.get(b);
    return (x < y ? -1 : x > y ? 1 : 0) * ui.sort.dir;
  });
  const head = COLS.map(c => h('th', {
    scope: 'col', class: c.text ? '' : 'r',
    'aria-sort': ui.sort.key === c.key ? (ui.sort.dir > 0 ? 'ascending' : 'descending') : 'none',
  }, h('button', {
    type: 'button', class: 'th-btn', onclick: () => {
      ui.sort = { key: c.key, dir: ui.sort.key === c.key ? -ui.sort.dir : (c.text ? 1 : -1) };
      renderTable();
    },
  }, c.label, h('span', { 'aria-hidden': 'true' }, ui.sort.key === c.key ? (ui.sort.dir > 0 ? ' ↑' : ' ↓') : ''))));

  const body = sorted.map(x => {
    const m = positionMetrics(x), t = tone(m.pnl);
    return h('tr', {},
      h('th', { scope: 'row' }, h('a', { href: `#/asset/${x.id}`, class: 'asset-link' }, h('b', {}, x.name), x.symbol && h('span', { class: 'sym' }, x.symbol))),
      h('td', {}, h('span', { class: 'chip' }, h('i', { style: `background:${CLASS_COLOR[x.class]}`, 'aria-hidden': 'true' }), CLASSES[x.class])),
      h('td', {}, countryName(x.countryId)),
      h('td', { class: 'r num' }, x.quantity.toLocaleString('en-US', { maximumFractionDigits: 8 })),
      h('td', { class: 'r num' }, m.priced ? fmtMoney(x.price) : h('span', { class: 'muted', title: 'No price — valued at cost' }, 'unpriced')),
      h('td', { class: 'r num' }, fmtMoney(m.priced ? m.value : m.cost)),
      h('td', { class: `r num ${t}` }, m.priced
        ? h('span', { class: 'delta ' + t }, h('span', { 'aria-hidden': 'true' }, arrow(t)), fmtSigned(m.pnl), h('span', { class: 'pct' }, fmtPct(m.pnlPct, { sign: true })))
        : '—'),
      h('td', { class: 'r num' }, fmtPct(total > 0 ? (m.priced ? m.value : m.cost) / total : 0)));
  });
  host.append(h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, head)), h('tbody', {}, body)));
}

function renderDashboard() {
  renderKpis(); renderMapAndSide(); renderHistory(); renderTable();
}

/* ---------- Asset detail ---------- */

async function renderAsset(id) {
  const x = state.holdings.find(v => v.id === id);
  const view = clear($('view-asset'));
  if (!x) {
    view.append(h('a', { class: 'back', href: '#/' }, '← Portfolio'), emptyBlock('Asset not found', 'It may have been deleted or this link is from another browser.'));
    return;
  }
  const m = positionMetrics(x), t = tone(m.pnl), total = portfolioTotals(state.holdings).value;
  const share = total > 0 ? (m.priced ? m.value : m.cost) / total : 0;
  const host = h('div', { class: 'chart-host', 'aria-busy': 'true' }, h('div', { class: 'skeleton chart-skel' }));
  const note = h('p', { class: 'sub' });

  view.append(
    h('a', { class: 'back', href: '#/' }, '← Portfolio'),
    h('header', { class: 'asset-h' },
      h('div', {}, h('h1', { id: 'h-asset' }, x.name),
        h('p', { class: 'sub' }, [x.symbol, CLASSES[x.class], countryName(x.countryId)].filter(Boolean).join(' · '))),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => openForm(x) }, 'Edit'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => removeHolding(x) }, 'Delete'))),
    h('div', { class: 'kpis' },
      kpi('Position value', fmtMoney(m.priced ? m.value : m.cost), h('span', { class: 'kpi-s' }, m.priced ? `${fmtPct(share)} of portfolio` : 'Unpriced — carried at cost'), 'lead'),
      kpi('Cost basis', fmtMoney(m.cost), h('span', { class: 'kpi-s' }, `${x.quantity.toLocaleString('en-US', { maximumFractionDigits: 8 })} × ${fmtMoney(x.costPerUnit)}`)),
      h('div', { class: `kpi pnl ${t}` }, h('span', { class: 'kpi-l' }, 'Unrealised P&L'),
        m.priced ? Delta({ abs: m.pnl, pct: m.pnlPct }) : h('strong', { class: 'kpi-v' }, '—')),
      kpi('Current price', m.priced ? fmtMoney(x.price) : '—', h('span', { class: 'kpi-s' }, x.coingeckoId ? `Live: CoinGecko “${x.coingeckoId}”` : 'Manual price'))),
    h('section', { class: 'panel' },
      h('header', { class: 'panel-h' }, h('div', {}, h('h2', {}, 'Price history'), note)),
      host));

  // Real history: CoinGecko for live-priced assets, otherwise the prices you've recorded.
  const local = (state.priceLog[x.id] || []).map(p => ({ t: new Date(p.d + 'T00:00:00Z').getTime(), v: p.v }));
  const draw = (series, source) => {
    host.removeAttribute('aria-busy');
    if (location.hash !== `#/asset/${id}`) return;
    const ch = seriesChange(series);
    note.textContent = ch ? `${source} · ${fmtSigned(ch.abs)} (${fmtPct(ch.pct, { sign: true })}) over the period` : source;
    if (!lineChart(host, series, { label: `${x.name} price` })) {
      clear(host).append(emptyBlock('Not enough history yet',
        x.coingeckoId ? 'No market data came back for this id.' : 'ATLAS logs the price each time it changes. Update the price on another day to start the line.'));
    }
  };
  if (x.coingeckoId) {
    try { draw(await fetchHistory(x.coingeckoId, 90), 'Last 90 days · CoinGecko'); }
    catch (e) {
      draw(local, 'Recorded prices');
      host.append(h('p', { class: 'err-inline', role: 'alert' }, `Market history unavailable: ${e.message}`));
    }
  } else draw(local, 'Recorded prices');
}

function removeHolding(x) {
  if (!confirm(`Delete “${x.name}”? This cannot be undone (use Backup first if unsure).`)) return;
  state.holdings = state.holdings.filter(v => v.id !== x.id);
  delete state.priceLog[x.id];
  snapshot(state, portfolioTotals(state.holdings).value);
  persist(); toast(`Deleted ${x.name}`);
  location.hash = '#/';
}

/* ---------- Form ---------- */

function fillSelects() {
  const f = $('form');
  f.elements.class.replaceChildren(h('option', { value: '' }, 'Select…'), ...Object.entries(CLASSES).map(([k, v]) => h('option', { value: k }, v)));
  const opts = [...ui.names].sort((a, b) => a[1].localeCompare(b[1]));
  f.elements.countryId.replaceChildren(h('option', { value: '' }, 'Select…'), ...opts.map(([k, v]) => h('option', { value: k }, v)));
}

function openForm(x = null) {
  ui.editing = x;
  const f = $('form');
  f.reset();
  $('dlg-title').textContent = x ? 'Edit holding' : 'Add holding';
  document.querySelectorAll('.err').forEach(e => { e.textContent = ''; });
  f.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
  if (x) for (const k of ['name', 'symbol', 'class', 'countryId', 'quantity', 'costPerUnit', 'price', 'coingeckoId']) f.elements[k].value = x[k] ?? '';
  if (ui.country && !x) f.elements.countryId.value = ui.country;
  $('dlg').showModal();
  f.elements.name.focus();
}

function submitForm(e) {
  e.preventDefault();
  const f = $('form'), data = Object.fromEntries(new FormData(f));
  const r = validateHolding(data);
  document.querySelectorAll('.err').forEach(el => { el.textContent = r.errors[el.dataset.for] || ''; });
  f.querySelectorAll('input,select').forEach(el => {
    if (r.errors[el.name]) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  });
  if (!r.ok) { f.querySelector('[aria-invalid]')?.focus(); return; }
  let item;
  if (ui.editing) { item = Object.assign(ui.editing, r.value); }
  else { item = { id: newId(), ...r.value }; state.holdings.push(item); }
  if (Number.isFinite(item.price)) logPrice(state, item.id, item.price);
  snapshot(state, portfolioTotals(state.holdings).value);
  persist(); $('dlg').close();
  toast(ui.editing ? 'Holding updated' : 'Holding added', 'pos');
  route();
}

/* ---------- Actions ---------- */

async function refreshPrices() {
  const btn = $('refresh');
  const live = state.holdings.filter(x => x.coingeckoId);
  if (!live.length) { toast('No holdings have a CoinGecko id — set one to get live prices.'); return; }
  btn.disabled = true; btn.textContent = 'Refreshing…';
  try {
    const prices = await fetchPrices([...new Set(live.map(x => x.coingeckoId))]);
    let n = 0;
    for (const x of live) if (x.coingeckoId in prices) { x.price = prices[x.coingeckoId]; logPrice(state, x.id, x.price); n++; }
    snapshot(state, portfolioTotals(state.holdings).value);
    persist(); route();
    toast(`Updated ${n} of ${live.length} live price${live.length > 1 ? 's' : ''}`, n ? 'pos' : 'neg');
  } catch (e) {
    toast(e.message || 'Could not refresh prices', 'neg');
  } finally { btn.disabled = false; btn.textContent = 'Refresh prices'; }
}

function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCsv() {
  if (!state.holdings.length) { toast('Nothing to export yet.'); return; }
  const total = portfolioTotals(state.holdings).value;
  const csv = toCsv(state.holdings, [
    { label: 'Name', get: x => x.name }, { label: 'Symbol', get: x => x.symbol },
    { label: 'Class', get: x => CLASSES[x.class] }, { label: 'Country', get: x => countryName(x.countryId) },
    { label: 'Quantity', get: x => x.quantity }, { label: 'Cost per unit (USD)', get: x => x.costPerUnit },
    { label: 'Price (USD)', get: x => x.price ?? '' },
    { label: 'Cost basis (USD)', get: x => positionMetrics(x).cost },
    { label: 'Value (USD)', get: x => positionMetrics(x).value ?? '' },
    { label: 'P&L (USD)', get: x => positionMetrics(x).pnl ?? '' },
    { label: 'P&L %', get: x => positionMetrics(x).pnlPct ?? '' },
    { label: 'Share of portfolio', get: x => (total > 0 ? (positionMetrics(x).value ?? positionMetrics(x).cost) / total : 0) },
  ]);
  download(`atlas-holdings-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
}

async function importFile(file) {
  try {
    const next = parseImport(await file.text());
    if (state.holdings.length && !confirm(`Replace your ${state.holdings.length} current holdings with ${next.holdings.length} from this backup?`)) return;
    Object.assign(state, next); persist(); route();
    toast(`Restored ${next.holdings.length} holdings`, 'pos');
  } catch (e) { toast(`Restore failed: ${e.message}`, 'neg'); }
}

/* ---------- Routing & boot ---------- */

function route() {
  const m = location.hash.match(/^#\/asset\/(.+)$/);
  $('view-dash').hidden = !!m; $('view-asset').hidden = !m;
  if (m) renderAsset(decodeURIComponent(m[1])); else renderDashboard();
}

async function initMap() {
  const host = $('map');
  try {
    if (!window.d3 || !window.topojson) throw new Error('Map libraries could not be loaded');
    ui.features = await loadWorld();
    ui.names = new Map(ui.features.map(f => [String(f.id), f.properties.name]));
    fillSelects();
    clear(host);
    ui.map = createMap(host, ui.features, { onPick: pickCountry });
    host.removeAttribute('aria-busy');
    route();
  } catch (e) {
    host.removeAttribute('aria-busy');
    clear(host).append(emptyBlock('The map could not load', e.message, h('button', { class: 'btn ghost', type: 'button', onclick: () => { clear(host).append(h('div', { class: 'skeleton map-skel' })); initMap(); } }, 'Try again')));
    route();
    banner('Map data is unavailable, so adding holdings is paused (country list comes from the map).', { retry: initMap });
  }
}

$('add').addEventListener('click', () => { if (!ui.names.size) { toast('Wait for the map to load first.'); return; } openForm(); });
$('cancel').addEventListener('click', () => $('dlg').close());
$('form').addEventListener('submit', submitForm);
$('refresh').addEventListener('click', refreshPrices);
$('export-csv').addEventListener('click', exportCsv);
$('export-json').addEventListener('click', () => download(`atlas-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJson(state), 'application/json'));
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
$('clear-country').addEventListener('click', () => pickCountry(ui.country));
window.addEventListener('hashchange', () => { route(); $('main').focus({ preventScroll: false }); });

snapshot(state, portfolioTotals(state.holdings).value);
persist();
renderKpis(); renderHistory(); renderTable();
initMap().then(() => { if (state.holdings.some(x => x.coingeckoId)) refreshPrices(); });
