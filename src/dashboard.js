// The ATLAS dashboard (Map, Assets, Performance, Reports). One implementation drives both the
// marketing preview (sample data, read-only) and the real app (the user's own assets).
import { h, s, clear, money, compact, pct1, TODAY, ICON, icon, thumb, Delta, statusDot, assetCard, sparkline, valuationChart, analytics } from './ui.js';
import { fmtPct, fmtSigned, tone, toCsv } from './calc.js';
import { portfolio } from './portfolio.js';
import { CATEGORIES } from './types.js';
import { COUNTRIES } from './places.js';
import { createGlobe } from './globe.js';
import { attachGeo } from './geoui.js';
import { buildExcel, reportHtml, download, printReport } from './report.js';
import { isoDay, statusOf, whenText, REMINDER_KINDS, REPEATS } from './reminders.js';

const GROUPS = {
  all: { label: 'All', cats: null },
  re: { label: 'Real estate', cats: ['residential', 'commercial', 'land'] },
  veh: { label: 'Vehicles', cats: ['vehicle', 'equipment'] },
  ves: { label: 'Vessels', cats: ['vessel'] },
  aircraft: { label: 'Aircraft', cats: ['aircraft'] },
};
const NAV = [
  ['map', 'Map', 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2.5 2 2.5 10 0 12M8 2c-2.5 2-2.5 10 0 12'],
  ['assets', 'Assets', 'M2 13V6l6-4 6 4v7zM6 13V9h4v4'],
  ['perf', 'Performance', 'M2 13l4-5 3 3 5-7'],
  ['reports', 'Reports', 'M4 2h6l3 3v9H4zM10 2v3h3'],
];
const REMINDERS_NAV = ['reminders', 'Reminders', 'M8 2a4 4 0 0 0-4 4c0 3-1.5 4-1.5 4h11S12 9 12 6a4 4 0 0 0-4-4zM6.5 13a1.5 1.5 0 0 0 3 0'];

/**
 * @param {{
 *   getAssets: () => any[],                 // enriched assets (see portfolio.js enrich)
 *   sample?: boolean,                       // sample data: label it and keep it read-only
 *   csvName?: string, globeLabel?: string,
 *   actions?: { onAdd?: () => void, onEdit?: (id: string) => void, onDelete?: (id: string) => void, onSample?: () => void },
 *   startLon?: number, tilt?: number,
 * }} opts
 */
export function mountDashboard(opts) {
  const { getAssets, sample = false, csvName = 'atlas-assets.csv', actions = {}, reminders: R = null, meta = () => null } = opts;
  const NAVS = R ? [...NAV, REMINDERS_NAV] : NAV;
  const all = () => getAssets();
  const find = id => all().find(a => a.id === id);
  const state = { view: 'map', group: 'all', sel: null, sort: { key: 'value', dir: -1 }, q: '' };
  const $ = id => document.getElementById(id);
  const scope = () => all().filter(a => !GROUPS[state.group].cats || GROUPS[state.group].cats.includes(a.category));
  const historyFor = a => (a && a.series && a.series.length >= 2 ? a.series : null);
  const views = { map: $('view-map'), assets: $('view-assets'), perf: $('view-perf'), reports: $('view-reports'), ...(R ? { reminders: $('view-reminders') } : {}) };
  const dueCount = () => (R ? R.list().filter(r => ['overdue', 'soon'].includes(statusOf(r))).length : 0);
  const ensureSel = () => { const sc = scope(); if (!sc.some(a => a.id === state.sel)) state.sel = sc[0]?.id ?? null; };
  ensureSel();

  const globe = createGlobe($('hero-map'), { assets: all(), icons: ICON, selectedId: state.sel, startLon: opts.startLon ?? -88, tilt: opts.tilt ?? 24, countryPadV: 70,
    label: opts.globeLabel || 'Rotating 3D globe of your assets', onSelect: id => select(id, true) });
  const geo = attachGeo($('hero-map'), globe, { visible: scope, all, selected: () => state.sel, lookup: find, onPick: (id, f) => select(id, f), onChange: () => { renderMap(); }, toggleAfter: $('view-title') });
  const mapScope = () => scope().filter(a => !geo.country() || a.country === geo.country());

  function select(id, focus) {
    state.sel = id; globe.setSelected(id); if (focus) globe.focus(id);
    renderMap(); if (state.view === 'assets') renderAssets(); if (state.view === 'perf') renderPerf();
    geo.sync();
  }

  /* navigation + filters */
  function renderNav() {
    const due = dueCount();
    const mk = cls => NAVS.map(([k, label, d]) => h('button', { type: 'button', class: cls + (state.view === k ? ' on' : ''), 'aria-current': state.view === k ? 'page' : null, onclick: () => setView(k) },
      s('svg', { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': 'true', class: 'ni' }, s('path', { d })), label,
      k === 'reminders' && due ? h('span', { class: 'nav-badge', 'aria-label': `${due} due` }, String(due)) : null));
    clear($('app-nav')).append(...mk('nav-btn').map(b => h('li', {}, b)));
    clear($('view-tabs')).append(...mk('tab-btn'));
  }
  function renderFilter() {
    clear($('app-filter')).append(...Object.entries(GROUPS).map(([k, g]) => h('button', { type: 'button', class: state.group === k ? 'on' : '', 'aria-pressed': String(state.group === k), onclick: () => setGroup(k) }, g.label)));
    if (actions.onAdd) {
      let b = $('add-asset-btn');
      if (!b) { b = h('button', { type: 'button', class: 'btn btn-primary btn-sm add-btn', id: 'add-asset-btn', onclick: () => actions.onAdd() }, '+ Add asset'); $('app-filter').before(b); }
    }
    if (actions.onImport && !$('import-btn')) $('app-filter').before(h('button', { type: 'button', class: 'btn btn-dark btn-sm import-btn', id: 'import-btn', onclick: () => actions.onImport() }, 'Import CSV'));
  }
  function setView(v) {
    state.view = v; geo.toggle.hidden = v !== 'map';
    for (const [k, el] of Object.entries(views)) if (el) el.hidden = k !== v;
    const url = $('app-url'); if (url) url.textContent = `atlas.app / portfolio / ${v}`;
    $('view-title').textContent = NAVS.find(n => n[0] === v)[1];
    renderNav();
    ({ map: renderMap, assets: renderAssets, perf: renderPerf, reports: renderReports, reminders: renderReminders })[v]();
    analytics.track('dashboard_view', { view: v });
  }
  function setGroup(g) {
    state.group = g; globe.setFilter(GROUPS[g].cats);
    ensureSel(); globe.setSelected(state.sel);
    if (GROUPS[g].cats && state.sel) globe.focus(state.sel);
    renderFilter(); geo.sync(); setView(state.view);
  }

  /* shared bits */
  const costVsValue = a => {
    const mx = Math.max(a.cost, a.value, 1);
    const bar = (label, v, cls) => h('div', { class: 'cv-row' }, h('span', {}, label), h('i', { class: cls, style: `width:${(v / mx) * 100}%` }), h('b', {}, compact(v)));
    return h('div', { class: 'cv' }, bar('Acquisition cost', a.cost, 'c'), bar('Estimated value', a.value, 'v'));
  };
  const empty = (t, d) => h('div', { class: 'app-empty' }, h('b', {}, t), h('span', {}, d));
  const emptyPanel = (title, text) => h('div', { class: 'empty-panel' },
    h('div', { class: 'ep-art', 'aria-hidden': 'true' }, icon('residential', 26)),
    h('b', {}, title), h('p', {}, text),
    h('div', { class: 'ep-actions' },
      actions.onAdd ? h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => actions.onAdd() }, '+ Add your first asset') : null,
      actions.onSample ? h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => actions.onSample() }, 'Load sample data') : null));
  const noneInFilter = () => h('div', { class: 'empty-panel slim' }, h('b', {}, 'No assets in this filter'), h('p', {}, 'Pick another group above to see the rest of your portfolio.'),
    h('div', { class: 'ep-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => setGroup('all') }, 'Show all assets')));
  const extrasLabel = a => { const m = meta(a.id); return m ? `Documents ${m.docs} · Reminders ${m.reminders}` : 'Documents & reminders'; };
  const debtCard = a => (a.debt > 0 ? h('div', { class: 'debt-card' },
    h('div', {}, h('span', {}, 'Debt'), h('b', {}, money(a.debt))), h('div', {}, h('span', {}, 'Equity'), h('b', { class: a.equity < 0 ? 'neg' : '' }, money(a.equity))),
    h('div', {}, h('span', {}, 'Loan-to-value'), h('b', {}, pct1(a.ltv))), a.debtPayment ? h('div', {}, h('span', {}, 'Monthly payment'), h('b', {}, money(a.debtPayment))) : null) : null);
  const rowActions = a => (actions.onEdit || actions.onDelete || actions.onDocs) ? h('div', { class: 'ac-actions' },
    actions.onDocs ? h('button', { type: 'button', class: 'mini-btn', onclick: () => actions.onDocs(a.id) }, extrasLabel(a)) : null,
    actions.onEdit ? h('button', { type: 'button', class: 'mini-btn', onclick: () => actions.onEdit(a.id) }, 'Edit') : null,
    actions.onDelete ? h('button', { type: 'button', class: 'mini-btn danger', onclick: () => actions.onDelete(a.id) }, 'Delete') : null) : null;

  /* MAP view */
  function renderMap() {
    const a = find(state.sel), sc = mapScope(), where = geo.country() ? (COUNTRIES[geo.country()]?.name || geo.country()) : (state.group === 'all' ? '' : GROUPS[state.group].label);
    if (!all().length) {
      clear($('hero-sel')).append(emptyPanel('Your portfolio starts here', 'Add a property, vehicle, boat, or aircraft and it appears on the map with its value and returns.'));
      clear($('hero-value')).append(h('span', {}, 'Portfolio value'), h('b', {}, money(0)), h('em', { class: 'muted' }, 'No assets yet'));
      clear($('hero-pair')).append(...[['Net operating income', 'Annual'], ['NOI yield', 'Income assets only']].map(([l, sub]) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, '–'), h('em', {}, sub))));
      clear($('hero-chart')).append(h('div', { class: 'mc-h' }, h('span', {}, 'Estimated value')), h('div', { class: 'app-empty' }, h('b', {}, 'Nothing to chart yet'), h('span', {}, 'Your first asset will show here.')));
      return;
    }
    if (!a || !sc.length) { clear($('hero-sel')).append(noneInFilter()); }
    const p = portfolio(sc);
    if (a) clear($('hero-sel')).append(assetCard(a), ...[rowActions(a)].filter(Boolean));
    clear($('hero-value')).append(h('span', {}, `Portfolio value${where ? ' · ' + where : ''}`), h('b', {}, money(p.value)),
      Delta(p.appreciation, `${fmtSigned(p.appreciation, { compact: true })} · ${fmtPct(p.appreciationPct, { sign: true })} vs. cost`),
      p.debt > 0 ? h('em', { class: 'muted nw' }, `Net worth ${compact(p.netWorth)} after ${compact(p.debt)} of debt`) : null);
    const k = (l, v, sub) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, v), h('em', {}, sub));
    clear($('hero-pair')).append(k('Net operating income', p.earningCount ? compact(p.noi) : '–', p.earningCount ? 'Annual' : 'No income assets'),
      k('NOI yield', pct1(p.noiYield), p.earningCount ? `${p.earningCount} income asset${p.earningCount > 1 ? 's' : ''}` : 'Income assets only'));
    const mc = clear($('hero-chart')), hist = historyFor(a);
    if (!a) return;
    if (hist) {
      const ch = a.value - hist[0].v;
      mc.append(h('div', { class: 'mc-h' }, h('span', {}, a.name), Delta(ch, `${fmtPct(hist[0].v ? ch / hist[0].v : 0, { sign: true })} since ${hist[0].label}`)), h('div', {}));
      sparkline(mc.lastChild, hist, a.name);
    } else {
      mc.append(h('div', { class: 'mc-h' }, h('span', {}, a.name), Delta(a.appreciation, `${fmtPct(a.appreciationPct, { sign: true })} vs. cost`)), costVsValue(a));
    }
  }

  /* ASSETS view */
  function renderAssets() {
    const host = clear(views.assets), sc = scope(), k = state.sort.key, d = state.sort.dir;
    if (!all().length) { host.append(emptyPanel('No assets yet', 'Everything you add is listed here with its value, share of portfolio, and return.')); return; }
    if (!sc.length) { host.append(noneInFilter()); return; }
    const total = sc.reduce((n, x) => n + x.value, 0) || 1, maxAbs = Math.max(...sc.map(x => Math.abs(x.appreciationPct)), 0.0001);
    const val = { name: a => a.name, place: a => a.place, value: a => a.value, share: a => a.value, chg: a => a.appreciationPct, status: a => a.status };
    const th = (key, label, cls = '') => h('th', { class: cls, 'aria-sort': k === key ? (d > 0 ? 'ascending' : 'descending') : 'none' },
      h('button', { type: 'button', onclick: () => { state.sort = { key, dir: k === key ? -d : (key === 'name' || key === 'place' || key === 'status' ? 1 : -1) }; renderAssets(); } }, label, h('span', { class: 'sort', 'aria-hidden': 'true' }, k === key ? (d > 0 ? '↑' : '↓') : '')));
    const tbody = h('tbody', {}), foot = h('div', { class: 'tbl-foot' }), count = h('span', { class: 'tbl-count' });
    const draw = () => {
      const q = state.q.trim().toLowerCase();
      const rows = sc.filter(x => !q || `${x.name} ${x.place} ${x.kind} ${x.status}`.toLowerCase().includes(q)).sort((x, y) => (val[k](x) > val[k](y) ? 1 : val[k](x) < val[k](y) ? -1 : 0) * d);
      count.textContent = `${rows.length} of ${sc.length} asset${sc.length === 1 ? '' : 's'}`;
      tbody.replaceChildren(...(rows.length ? rows.map((r, i) => {
        const t = tone(r.appreciationPct, 1e-6);
        return h('tr', { class: r.id === state.sel ? 'on' : '', style: `--i:${Math.min(i, 14)}` },
          h('td', {}, h('button', { type: 'button', class: 'rowbtn two', 'aria-pressed': String(r.id === state.sel), onclick: () => select(r.id, true) },
            h('span', { class: 'rico' }, thumb(r, 44)), h('span', { class: 'rtx' }, h('b', {}, r.name), h('em', {}, r.place)))),
          h('td', { class: 'r' }, compact(r.value)),
          h('td', {}, h('span', { class: 'share' }, h('i', { style: `width:${(r.value / total) * 100}%` }), h('b', {}, `${((r.value / total) * 100).toFixed(1)}%`))),
          h('td', { class: 'r' }, Delta(r.appreciation, fmtPct(r.appreciationPct, { sign: true })), h('span', { class: 'mb', 'aria-hidden': 'true' }, h('i', { class: t, style: `width:${(Math.abs(r.appreciationPct) / maxAbs) * 100}%` }))),
          h('td', {}, statusDot(r.status)));
      }) : [h('tr', {}, h('td', { colspan: 5, class: 'none' }, `No assets match “${state.q}”.`))]));
      const p = rows.length ? portfolio(rows) : null;
      foot.replaceChildren(h('span', {}, 'Total value ', h('b', {}, p ? money(p.value) : '–')), h('span', {}, 'Gain vs. cost ', p ? Delta(p.appreciation, `${fmtSigned(p.appreciation, { compact: true })} · ${fmtPct(p.appreciationPct, { sign: true })}`) : h('b', {}, '–')));
    };
    const search = h('input', { type: 'search', class: 'tbl-search', placeholder: 'Search assets, places, status', 'aria-label': 'Search assets', value: state.q, oninput: e => { state.q = e.target.value; draw(); } });
    const a = find(state.sel) || sc[0], share = a.value / total;
    host.append(h('div', { class: 'assets-grid' },
      h('div', { class: 'tbl-card tbl-flex' },
        h('div', { class: 'tbl-bar' }, h('label', { class: 'tbl-sw' }, s('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true' }, s('circle', { cx: 7, cy: 7, r: 4.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }), s('path', { d: 'M10.5 10.5L14 14', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })), search), count),
        h('div', { class: 'tbl-scroll' }, h('table', { class: 'app-tbl' },
          h('thead', {}, h('tr', {}, th('name', 'Asset'), th('value', 'Value', 'r'), th('share', 'Share'), th('chg', 'vs. cost', 'r'), th('status', 'Status'))), tbody)),
        foot),
      h('div', { class: 'detail' }, assetCard(a), costVsValue(a), debtCard(a),
        h('div', { class: 'share-card' }, h('div', {}, h('span', {}, 'Share of ' + (state.group === 'all' ? 'portfolio' : GROUPS[state.group].label.toLowerCase())), h('b', {}, `${(share * 100).toFixed(1)}%`)),
          h('div', { class: 'share-bar' }, h('i', { style: `width:${Math.max(2, share * 100)}%` }))),
        h('div', { class: 'detail-actions' },
          h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => { setView('map'); globe.focus(state.sel); } }, 'Show on map'),
          actions.onDocs ? h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => actions.onDocs(a.id) }, extrasLabel(a)) : null,
          actions.onEdit ? h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => actions.onEdit(a.id) }, 'Edit') : null,
          actions.onDelete ? h('button', { type: 'button', class: 'btn btn-dark btn-sm danger', onclick: () => actions.onDelete(a.id) }, 'Delete') : null))));
    draw();
  }

  /* PERFORMANCE view */
  function renderPerf() {
    const host = clear(views.perf), sc = scope();
    if (!all().length) { host.append(emptyPanel('No performance yet', 'Add assets with their cost and estimated value to see returns, winners, and losers.')); return; }
    if (!sc.length) { host.append(noneInFilter()); return; }
    const a = find(state.sel) || sc[0], p = portfolio(sc), hist = historyFor(a);
    const chart = h('div', { class: 'chart-host' });
    const rank = [...sc].sort((x, y) => y.appreciationPct - x.appreciationPct), mx = Math.max(...rank.map(r => Math.abs(r.appreciationPct)), 0.0001);
    const best = rank[0], worst = rank.at(-1), up = rank.filter(r => r.appreciationPct > 0).length, down = rank.filter(r => r.appreciationPct < 0).length;
    const kpi = (cls, l, v, sub, extra) => h('div', { class: 'pk ' + cls }, h('span', {}, l), h('b', {}, v), h('em', {}, sub), extra);
    const pick = r => select(r.id, true);
    host.append(
      h('div', { class: 'perf-kpis' },
        kpi('', 'Total return', Delta(p.appreciation, fmtSigned(p.appreciation, { compact: true })), `${fmtPct(p.appreciationPct, { sign: true })} on ${compact(p.cost)} invested`),
        kpi('click', 'Best performer', h('span', { class: tone(best.appreciationPct, 1e-6) }, fmtPct(best.appreciationPct, { sign: true })), best.name, null),
        kpi('click', 'Weakest performer', h('span', { class: tone(worst.appreciationPct, 1e-6) }, fmtPct(worst.appreciationPct, { sign: true })), worst.name, null),
        kpi('', 'Winners / losers', `${up} up · ${down} down`, `${sc.length} asset${sc.length === 1 ? '' : 's'} in view`, h('span', { class: 'split', 'aria-hidden': 'true' }, h('i', { class: 'pos', style: `flex:${up || 0.001}` }), h('i', { class: 'neg', style: `flex:${down || 0.001}` })))),
      h('div', { class: 'perf-grid' },
        h('div', { class: 'tbl-card pad' }, h('div', { class: 'chart-t' }, h('div', {}, h('b', {}, a.name), h('span', {}, 'Estimated value over time')), hist ? h('span', { class: 'rng' }, `${hist[0].label} – ${hist.at(-1).label}`) : h('span', { class: 'rng' }, sample ? 'Sample data' : '')),
          hist ? chart : h('div', {}, empty('Valuation history not recorded', 'Only one valuation is recorded for this asset, so ATLAS shows cost vs. estimated value instead. Update its value over time to build a history.'), costVsValue(a)),
          h('div', { class: 'pstats' }, h('div', {}, h('span', {}, 'Acquisition cost'), h('b', {}, money(a.cost))), h('div', {}, h('span', {}, 'Estimated value'), h('b', {}, money(a.value))),
            h('div', {}, h('span', {}, 'Gain vs. cost'), h('b', { class: tone(a.appreciation, 0.5) }, `${fmtSigned(a.appreciation, { compact: true })}`)))),
        h('div', { class: 'tbl-card pad' }, h('div', { class: 'chart-t' }, h('div', {}, h('b', {}, 'Ranking by return'), h('span', {}, `${sc.length} asset${sc.length > 1 ? 's' : ''} · value vs. acquisition cost`))),
          h('ul', { class: 'rank' }, rank.map((r, i) => {
            const t = tone(r.appreciationPct, 1e-6), w = (Math.abs(r.appreciationPct) / mx) * 50;
            return h('li', { class: r.id === state.sel ? 'on' : '', style: `--i:${Math.min(i, 14)}` }, h('button', { type: 'button', onclick: () => pick(r) },
              h('span', { class: 'rn' }, h('em', { class: 'rk' }, String(i + 1)), r.name),
              h('span', { class: 'rb', 'aria-hidden': 'true' }, h('i', { class: t, style: `width:${w}%;${r.appreciationPct < 0 ? 'right' : 'left'}:50%` })),
              h('b', { class: t }, fmtPct(r.appreciationPct, { sign: true }))));
          })))));
    host.querySelectorAll('.pk.click').forEach((el, i) => { el.tabIndex = 0; el.setAttribute('role', 'button'); const r = i ? worst : best; el.addEventListener('click', () => pick(r)); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r); } }); });
    if (hist) valuationChart(chart, hist, { label: `Estimated value of ${a.name}` });
  }

  /* REPORTS view */
  function renderReports() {
    const host = clear(views.reports), sc = scope();
    if (!all().length) { host.append(emptyPanel('No data to report yet', 'Once you add assets you can review the summary here and export it as CSV, Excel or PDF.')); return; }
    if (!sc.length) { host.append(noneInFilter()); return; }
    const p = portfolio(sc), today = isoDay();
    const alloc = Object.entries(sc.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + x.value), m), {})).sort((x, y) => y[1] - x[1]);
    const scopeLabel = state.group === 'all' ? 'All assets' : GROUPS[state.group].label;
    const stem = csvName.replace(/\.csv$/, '');
    const csv = () => {
      const text = toCsv(sc, [
        { label: 'Asset', get: x => x.name }, { label: 'Category', get: x => CATEGORIES[x.category] }, { label: 'Location', get: x => x.place }, { label: 'Status', get: x => x.status },
        { label: 'Acquisition cost (USD)', get: x => x.cost }, { label: 'Estimated value (USD)', get: x => x.value }, { label: 'Debt (USD)', get: x => x.debt }, { label: 'Equity (USD)', get: x => x.equity },
        { label: 'Change vs. cost', get: x => x.appreciationPct.toFixed(4) }, { label: 'NOI (USD)', get: x => (x.earning ? x.noi : '') },
      ]);
      download(csvName, new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
      analytics.track('dashboard_csv_download');
    };
    const excel = () => { download(`${stem}.xlsx`, buildExcel(sc, { today, scope: scopeLabel, sample }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); analytics.track('dashboard_xlsx_download'); };
    const pdf = () => { printReport(reportHtml(sc, { today, scope: scopeLabel, sample, owner: opts.owner || '' })); analytics.track('dashboard_pdf_report'); };
    host.append(h('div', { class: 'rep-grid' },
      h('div', { class: 'tbl-card pad' }, h('div', { class: 'chart-t' }, h('b', {}, `Portfolio summary${state.group === 'all' ? '' : ' · ' + GROUPS[state.group].label}`), h('span', {}, `As of ${TODAY}`)),
        h('div', { class: 'rep-kpis' },
          h('div', {}, h('em', {}, 'Value'), h('b', {}, compact(p.value))), h('div', {}, h('em', {}, 'Debt'), h('b', {}, p.debt ? compact(p.debt) : '–')),
          h('div', {}, h('em', {}, 'Net worth'), h('b', {}, compact(p.netWorth))), h('div', {}, h('em', {}, 'NOI'), h('b', {}, p.earningCount ? compact(p.noi) : '–'))),
        h('div', { class: 'rep-kpis sub' },
          h('div', {}, h('em', {}, 'Cost'), h('b', {}, compact(p.cost))), h('div', {}, h('em', {}, 'NOI yield'), h('b', {}, pct1(p.noiYield))),
          h('div', {}, h('em', {}, 'Loan-to-value'), h('b', {}, p.ltv == null ? '–' : pct1(p.ltv))), h('div', {}, h('em', {}, 'Debt payments / mo'), h('b', {}, p.debtPayment ? compact(p.debtPayment) : '–'))),
        h('ul', { class: 'rep-alloc' }, alloc.map(([c, v]) => h('li', {}, h('span', {}, CATEGORIES[c]), h('i', { style: `width:${(v / alloc[0][1]) * 100}%` }), h('b', {}, pct1(v / p.value)))))),
      h('div', { class: 'tbl-card pad dl' }, h('b', {}, 'Export'), h('p', {}, `${sc.length} asset${sc.length > 1 ? 's' : ''} in the current view, with cost, value, debt, equity and NOI.`),
        h('div', { class: 'dl-btns' },
          h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: pdf }, 'PDF report'),
          h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: excel }, 'Excel (.xlsx)'),
          h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: csv }, 'CSV')),
        h('small', {}, 'PDF opens your browser’s print dialog: choose “Save as PDF”.'))));
  }

  /* REMINDERS view (the app only) */
  function renderReminders() {
    const host = clear(views.reminders); if (!R) return;
    const list = R.list(), today = isoDay();
    const head = h('div', { class: 'rem-head' }, h('div', {}, h('b', {}, 'Reminders and due dates'), h('span', {}, R.note || 'Insurance, taxes, inspections and registrations in one place.')),
      h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => R.onAdd(state.sel) }, '+ Add reminder'));
    if (!list.length) {
      host.append(head, h('div', { class: 'empty-panel' }, h('div', { class: 'ep-art', 'aria-hidden': 'true' }, icon('commercial', 26)), h('b', {}, 'Nothing due yet'),
        h('p', {}, 'Add the dates you cannot afford to miss: insurance renewal, property tax, inspections, registration, boat or aircraft surveys.'),
        h('div', { class: 'ep-actions' }, h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => R.onAdd(state.sel) }, '+ Add your first reminder'))));
      return;
    }
    const by = { overdue: [], soon: [], upcoming: [], done: [] };
    for (const r of list) by[statusOf(r, today)].push(r);
    for (const k of Object.keys(by)) by[k].sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));
    const chip = (k, label) => h('div', { class: `rem-chip ${k}` }, h('b', {}, String(by[k].length)), h('span', {}, label));
    const row = r => {
      const asset = find(r.assetId), st = statusOf(r, today);
      return h('li', { class: `rem-row ${st}` },
        h('span', { class: 'rem-kind' }, REMINDER_KINDS[r.kind] ? REMINDER_KINDS[r.kind].label : 'Other'),
        h('div', { class: 'rem-main' }, h('b', {}, r.title), h('span', {}, asset ? h('button', { type: 'button', class: 'linkish', onclick: () => select(asset.id, true) }, asset.name) : 'Removed asset', r.repeat !== 'none' ? ` · ${REPEATS[r.repeat].toLowerCase()}` : '')),
        h('div', { class: 'rem-when' }, h('b', {}, st === 'done' ? 'Done' : whenText(r, today)), h('span', {}, r.dueOn)),
        h('div', { class: 'rem-act' },
          st !== 'done' ? h('button', { type: 'button', class: 'mini-btn', onclick: () => R.onDone(r.id) }, r.repeat !== 'none' ? 'Done, renew' : 'Mark done') : h('button', { type: 'button', class: 'mini-btn', onclick: () => R.onReopen && R.onReopen(r.id) }, 'Reopen'),
          h('button', { type: 'button', class: 'mini-btn danger', onclick: () => R.onDelete(r.id) }, 'Delete')));
    };
    const section = (k, title) => (by[k].length ? h('section', { class: 'rem-sec' }, h('h3', {}, title), h('ul', { class: 'rem-list' }, by[k].map(row))) : null);
    host.append(head, h('div', { class: 'rem-chips' }, chip('overdue', 'Overdue'), chip('soon', 'Due soon'), chip('upcoming', 'Upcoming'), chip('done', 'Done')),
      ...[section('overdue', 'Overdue'), section('soon', 'Due soon'), section('upcoming', 'Upcoming'), section('done', 'Done')].filter(Boolean));
  }

  renderFilter(); setView('map');

  return {
    select: id => select(id, true),
    show: v => setView(v),
    /** Re-render after the asset list changed (add, edit, delete, load). */
    refresh({ select: id } = {}) {
      globe.setAssets(all());
      if (id) state.sel = id;
      ensureSel(); globe.setSelected(state.sel);
      renderFilter(); geo.sync(); setView(state.view);
      if (id) globe.focus(id);
    },
    selected: () => state.sel,
  };
}
