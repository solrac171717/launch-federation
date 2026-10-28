// Report exports for a list of enriched assets: Excel (.xlsx) and a print-ready PDF report.
// Every figure comes from portfolio.js, so the files always match what the dashboard shows.
import { portfolio } from './portfolio.js';
import { CATEGORIES } from './types.js';
import { buildXlsx } from './xlsx.js';

const usd = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const pct = (n, d = 1) => (n == null ? '–' : `${(n * 100).toFixed(d)}%`);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const prettyDate = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function allocationOf(assets, total) {
  const m = new Map(); for (const a of assets) m.set(a.category, (m.get(a.category) || 0) + a.value);
  return [...m].map(([k, v]) => ({ key: k, label: CATEGORIES[k] || k, value: v, share: total > 0 ? v / total : 0 })).sort((a, b) => b.value - a.value);
}

/** Net worth (value minus debt) grouped by legal owner. Empty unless at least one asset has an owner. */
export function ownerRows(assets) {
  if (!assets.some(a => a.owner)) return [];
  const m = new Map(); for (const a of assets) { const k = a.owner || 'No owner set'; m.set(k, (m.get(k) || 0) + a.equity); }
  const total = [...m.values()].reduce((n, x) => n + x, 0);
  return [...m].map(([label, net]) => ({ label, net, share: total > 0 ? net / total : 0 })).sort((a, b) => b.net - a.net);
}

/** The workbook: "Assets" (one row per asset) and "Summary" (totals and allocation). */
export function buildExcel(assets, { today, scope = 'All assets', sample = false } = {}) {
  const p = portfolio(assets);
  const head = ['Asset', 'Category', 'Type', 'Location', 'Status', 'Owner', 'Ownership', 'Acquisition cost', 'Estimated value', 'Gain vs. cost', 'Gain %', 'Debt', 'Equity', 'Loan-to-value', 'Annual income', 'Annual expenses', 'Net operating income', 'NOI yield', 'Acquired on', 'Notes']
    .map(v => ({ v, s: 'head' }));
  const rows = [head, ...assets.map(a => [a.name, CATEGORIES[a.category] || a.category, a.kind, a.place, a.status, a.owner || '', { v: a.ownership / 100, s: 'pct' },
    { v: a.cost, s: 'money' }, { v: a.value, s: 'money' }, { v: a.appreciation, s: 'money' }, { v: a.appreciationPct, s: 'pct' },
    { v: a.debt, s: 'money' }, { v: a.equity, s: 'money' }, a.ltv == null ? '' : { v: a.ltv, s: 'pct' },
    a.earning ? { v: a.gross, s: 'money' } : '', { v: a.expenses, s: 'money' }, a.earning ? { v: a.noi, s: 'money' } : '', a.noiYield == null ? '' : { v: a.noiYield, s: 'pct' },
    a.acquiredOn || '', a.notes || ''])];
  rows.push([{ v: 'Total', s: 'bold' }, '', '', '', '', '', '', { v: p.cost, s: 'boldMoney' }, { v: p.value, s: 'boldMoney' }, { v: p.appreciation, s: 'boldMoney' }, { v: p.appreciationPct, s: 'boldPct' },
    { v: p.debt, s: 'boldMoney' }, { v: p.netWorth, s: 'boldMoney' }, p.ltv == null ? '' : { v: p.ltv, s: 'boldPct' }, '', '', p.earningCount ? { v: p.noi, s: 'boldMoney' } : '', p.noiYield == null ? '' : { v: p.noiYield, s: 'boldPct' }]);
  const sum = [[{ v: 'ATLAS portfolio summary', s: 'title' }, ''],
    ['Scope', scope], ['As of', today], ...(sample ? [['Data', 'Illustrative sample data']] : []), ['Assets', p.count], ['', ''],
    [{ v: 'Total value', s: 'bold' }, { v: p.value, s: 'boldMoney' }], ['Acquisition cost', { v: p.cost, s: 'money' }], ['Gain vs. cost', { v: p.appreciation, s: 'money' }], ['Gain %', { v: p.appreciationPct, s: 'pct' }],
    ['Total debt', { v: p.debt, s: 'money' }], [{ v: 'Net worth (value minus debt)', s: 'bold' }, { v: p.netWorth, s: 'boldMoney' }], ['Loan-to-value', p.ltv == null ? '–' : { v: p.ltv, s: 'pct' }],
    ['Monthly debt payments', { v: p.debtPayment, s: 'money' }],
    ['Net operating income (yearly)', p.earningCount ? { v: p.noi, s: 'money' } : '–'], ['NOI yield (income assets)', p.noiYield == null ? '–' : { v: p.noiYield, s: 'pct' }], ['', ''],
    [{ v: 'Allocation by category', s: 'head' }, { v: 'Value', s: 'head' }, { v: 'Share', s: 'head' }],
    ...allocationOf(assets, p.value).map(x => [x.label, { v: x.value, s: 'money' }, { v: x.share, s: 'pct' }]),
    ...(ownerRows(assets).length ? [['', ''], [{ v: 'Net worth by owner', s: 'head' }, { v: 'Net worth', s: 'head' }, { v: 'Share', s: 'head' }], ...ownerRows(assets).map(o => [o.label, { v: o.net, s: 'money' }, { v: o.share, s: 'pct' }])] : []),
    ['', ''], ['Note', 'Values are estimates entered by the owner. Figures follow the ownership share of each asset. This is not an appraisal or financial advice.']];
  return buildXlsx([
    { name: 'Assets', rows, widths: [28, 16, 20, 22, 12, 18, 11, 16, 16, 14, 9, 14, 14, 12, 14, 14, 18, 10, 12, 30] },
    { name: 'Summary', rows: sum, widths: [34, 18, 12], freeze: false },
  ]);
}

/** A self-contained, print-ready HTML document (A4). Opened in a hidden frame and sent to the browser's "Save as PDF". */
export function reportHtml(assets, { today, scope = 'All assets', owner = '', sample = false } = {}) {
  const p = portfolio(assets), alloc = allocationOf(assets, p.value);
  const kpi = (l, v, sub = '') => `<div class="k"><span>${esc(l)}</span><b>${esc(v)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;
  const tone = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
  const rows = [...assets].sort((a, b) => b.value - a.value).map(a => `<tr><td><b>${esc(a.name)}</b><small>${esc(a.kind)} · ${esc(a.place)}${a.shared ? ` · you own ${a.ownership}%` : ''}${a.owner ? ` · ${esc(a.owner)}` : ''}</small></td><td>${esc(a.status)}</td><td class="r">${usd(a.value)}</td><td class="r">${a.debt ? usd(a.debt) : '–'}</td><td class="r">${usd(a.equity)}</td><td class="r ${tone(a.appreciation)}">${a.appreciationPct >= 0 ? '+' : ''}${pct(a.appreciationPct)}</td><td class="r">${a.earning ? usd(a.noi) : '–'}</td></tr>`).join('');
  return `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><title>ATLAS portfolio report ${esc(today)}</title><style>
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; } html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 11px/1.45 Inter, "Segoe UI", Arial, sans-serif; color: #0A0F1F; }
header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #2563EB; }
.brand { font-weight: 800; letter-spacing: .22em; font-size: 15px; color: #0B2A6B; } h1 { margin: 6px 0 0; font-size: 22px; letter-spacing: -.02em; }
.meta { text-align: right; color: #475569; font-size: 10.5px; } .meta b { color: #0A0F1F; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0 6px; }
.k { border: 1px solid #DCE7FA; border-radius: 10px; padding: 9px 11px; background: #F7FAFF; } .k span { display: block; color: #64748B; font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; } .k b { display: block; font-size: 16px; margin-top: 2px; } .k em { display: block; font-style: normal; color: #64748B; font-size: 9.5px; }
.k.big { background: #EEF4FF; border-color: #BFD3F7; }
h2 { font-size: 12.5px; margin: 18px 0 8px; color: #0B2A6B; }
.alloc { display: grid; gap: 5px; } .alloc div { display: grid; grid-template-columns: 110px 1fr 54px 90px; gap: 8px; align-items: center; } .alloc i { display: block; height: 7px; border-radius: 4px; background: linear-gradient(90deg, #2563EB, #60A5FA); } .alloc span:last-child, .alloc span:nth-child(3) { text-align: right; }
table { width: 100%; border-collapse: collapse; } thead { display: table-header-group; } tr { break-inside: avoid; }
th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; color: #64748B; padding: 6px 6px; border-bottom: 1.5px solid #CBD5E1; } td { padding: 7px 6px; border-bottom: 1px solid #E8EEF8; vertical-align: top; }
td small { display: block; color: #64748B; font-size: 9.5px; } .r { text-align: right; font-variant-numeric: tabular-nums; } th.r { text-align: right; }
.pos { color: #047857; } .neg { color: #B91C1C; }
tfoot td { border-top: 1.5px solid #CBD5E1; border-bottom: 0; font-weight: 700; }
.note { margin-top: 18px; padding-top: 10px; border-top: 1px solid #E2E8F0; color: #64748B; font-size: 9.5px; }
.sample { margin-top: 10px; padding: 6px 10px; border-radius: 8px; background: #FEF3C7; color: #92400E; font-size: 10px; }
</style></head><body>
<header><div><div class="brand">ATLAS</div><h1>Portfolio report</h1></div><div class="meta"><div><b>${esc(scope)}</b></div><div>As of ${esc(prettyDate(today))}</div>${owner ? `<div>${esc(owner)}</div>` : ''}</div></header>
${sample ? '<div class="sample">Illustrative sample data, not a real portfolio.</div>' : ''}
<section class="kpis">${kpi('Total value', usd(p.value), `${p.count} asset${p.count === 1 ? '' : 's'}`).replace('class="k"', 'class="k big"')}${kpi('Total debt', usd(p.debt), p.ltv == null ? 'No debt' : `${pct(p.ltv)} loan-to-value`)}${kpi('Net worth', usd(p.netWorth), 'Value minus debt').replace('class="k"', 'class="k big"')}${kpi('Gain vs. cost', usd(p.appreciation), `${p.appreciationPct >= 0 ? '+' : ''}${pct(p.appreciationPct)} on ${usd(p.cost)}`)}
${kpi('Net operating income', p.earningCount ? usd(p.noi) : '–', 'Yearly, income assets')}${kpi('NOI yield', pct(p.noiYield), `${p.earningCount} income asset${p.earningCount === 1 ? '' : 's'}`)}${kpi('Monthly debt payments', usd(p.debtPayment), p.indebtedCount ? `${p.indebtedCount} loan${p.indebtedCount === 1 ? '' : 's'}` : 'None')}${kpi('Acquisition cost', usd(p.cost))}</section>
<h2>Allocation</h2><div class="alloc">${alloc.map(x => `<div><span>${esc(x.label)}</span><i style="width:${Math.max(1, x.share * 100)}%"></i><span>${pct(x.share)}</span><span>${usd(x.value)}</span></div>`).join('')}</div>
<h2>Assets</h2><table><thead><tr><th>Asset</th><th>Status</th><th class="r">Value</th><th class="r">Debt</th><th class="r">Equity</th><th class="r">Gain</th><th class="r">NOI</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td>Total</td><td></td><td class="r">${usd(p.value)}</td><td class="r">${usd(p.debt)}</td><td class="r">${usd(p.netWorth)}</td><td class="r">${p.appreciationPct >= 0 ? '+' : ''}${pct(p.appreciationPct)}</td><td class="r">${p.earningCount ? usd(p.noi) : '–'}</td></tr></tfoot></table>
<p class="note">Values are estimates entered by the owner and follow the share the owner holds in each asset. This is not an appraisal, and this report is not financial, tax or legal advice. Net worth is the sum of estimated values minus the outstanding debt entered for each asset. Generated by ATLAS on ${esc(prettyDate(today))}.</p>
</body></html>`;
}

/** Saves a Blob or Uint8Array as a file download. */
export function download(name, data, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Opens the print dialog for the report (choose "Save as PDF"). Returns false if the browser blocked it. */
export function printReport(html) {
  const frame = Object.assign(document.createElement('iframe'), { title: 'Report', srcdoc: html });
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0' });
  frame.onload = () => {
    try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { /* blocked */ }
    setTimeout(() => frame.remove(), 60_000);
  };
  document.body.append(frame); return true;
}
