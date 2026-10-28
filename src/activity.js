// A readable timeline for one asset, derived from data that is already stored: purchase, value and debt changes, documents.
import { dayLabel } from './networth.js';
const usd = n => '$' + Math.round(n).toLocaleString('en-US');
const pct = (a, b) => (a ? `${b >= a ? '+' : ''}${(((b - a) / a) * 100).toFixed(1)}%` : '');

/** @param row  the stored asset (full-asset figures)   @param docs  documents of that asset   @returns newest first */
export function activityFor(row, docs = [], { dayOf = x => String(x).slice(0, 10) } = {}) {
  const ev = [];
  const hist = (row.history || []).filter(p => p && p.d && Number.isFinite(Number(p.v))).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  if (row.acquiredOn) ev.push({ date: row.acquiredOn, type: 'buy', title: 'Acquired', detail: `Acquisition cost ${usd(row.cost)}` });
  const created = row.createdAt ? dayOf(row.createdAt) : null;
  if (created) ev.push({ date: created, type: 'added', title: 'Added to ATLAS', detail: `Estimated value ${usd(row.value)}` });
  hist.forEach((p, i) => {
    const prev = hist[i - 1]; if (!prev) return;
    if (Number(p.v) !== Number(prev.v)) ev.push({ date: p.d, type: 'value', title: Number(p.v) > Number(prev.v) ? 'Value increased' : 'Value decreased', detail: `${usd(prev.v)} to ${usd(p.v)} (${pct(prev.v, p.v)})` });
    if (p.b != null && prev.b != null && Number(p.b) !== Number(prev.b)) ev.push({ date: p.d, type: 'debt', title: Number(p.b) < Number(prev.b) ? 'Debt reduced' : 'Debt increased', detail: `${usd(prev.b)} to ${usd(p.b)}` });
  });
  for (const d of docs) ev.push({ date: dayOf(d.createdAt || ''), type: 'doc', title: 'Document added', detail: d.name });
  const order = { value: 0, debt: 1, doc: 2, added: 3, buy: 4 };
  return ev.filter(e => e.date).sort((a, b) => (a.date === b.date ? order[a.type] - order[b.type] : a.date < b.date ? 1 : -1)).map(e => ({ ...e, when: dayLabel(e.date) }));
}
