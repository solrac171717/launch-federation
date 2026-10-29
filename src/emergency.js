// The emergency sheet: one printable page that tells a trusted person what exists, where it is, who to call and where the papers are.
// It contains personal data on purpose: the person who prints it decides who gets the paper. Documents are listed by name only, never linked.
import { DOC_KINDS } from './extras-store.js';
import { REMINDER_KINDS, daysUntil, isoDay } from './reminders.js';
import { formatIn } from './fx.js';

const usd = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const prettyDate = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** @param assets enriched assets  @param docs [{assetId,name,kind}]  @param reminders [{assetId,title,dueOn,done}]  @param settings {contacts,emergencyNote} */
export function emergencyHtml({ assets, docs = [], reminders = [], settings = {}, today = isoDay(), owner = '' }) {
  const contacts = (settings.contacts || []).filter(c => c.name || c.phone || c.email);
  const net = assets.reduce((n, a) => n + a.value - (a.debt || 0), 0);
  const items = [...assets].sort((a, b) => b.value - a.value).map(a => {
    const d = docs.filter(x => x.assetId === a.id), r = reminders.filter(x => x.assetId === a.id && !x.done).sort((x, y) => (x.dueOn < y.dueOn ? -1 : 1)).slice(0, 4);
    const coords = Number.isFinite(a.lat) && Number.isFinite(a.lon) ? `${a.lat.toFixed(4)}, ${a.lon.toFixed(4)}` : '';
    return `<section class="a"><h3>${esc(a.name)} <small>${esc(a.kind)}</small></h3>
<dl><dt>Where</dt><dd>${esc(a.place)}${coords ? ` <span class="m">(${coords})</span>` : ''}</dd>
<dt>Worth</dt><dd>${usd(a.value)}${a.currency && a.currency !== 'USD' ? ` <span class="m">(entered as ${esc(formatIn(a.localValue, a.currency))})</span>` : ''}${a.debt > 0 ? `, owed ${usd(a.debt)}${a.debtPayment ? ` (${usd(a.debtPayment)} a month)` : ''}` : ''}</dd>
<dt>Held by</dt><dd>${esc(a.owner || 'Not recorded')}${a.shared ? ` <span class="m">(your share ${a.ownership}%)</span>` : ''}</dd>
${d.length ? `<dt>Papers</dt><dd>${d.map(x => `${esc(x.name)} <span class="m">(${esc(DOC_KINDS[x.kind] || 'Other')})</span>`).join('; ')}</dd>` : ''}
${r.length ? `<dt>Coming up</dt><dd>${r.map(x => `${esc(x.title)} <span class="m">${esc(prettyDate(x.dueOn))}${daysUntil(x.dueOn, today) < 0 ? ', overdue' : ''}</span>`).join('; ')}</dd>` : ''}
${a.notes ? `<dt>Notes</dt><dd>${esc(a.notes)}</dd>` : ''}</dl></section>`;
  }).join('');
  return `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><title>Owned Map emergency sheet ${esc(today)}</title><style>
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; } html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 11.5px/1.5 Inter, "Segoe UI", Arial, sans-serif; color: #0A0F1F; }
header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #B91C1C; }
.brand { font-weight: 800; letter-spacing: .22em; font-size: 15px; color: #0B2A6B; } h1 { margin: 6px 0 0; font-size: 22px; letter-spacing: -.02em; }
.meta { text-align: right; color: #475569; font-size: 10.5px; } .meta b { color: #0A0F1F; }
h2 { font-size: 13px; margin: 18px 0 8px; color: #7F1D1D; text-transform: uppercase; letter-spacing: .06em; }
.box { border: 1px solid #FECACA; background: #FEF2F2; border-radius: 10px; padding: 10px 12px; }
table { width: 100%; border-collapse: collapse; } td, th { padding: 6px 6px; border-bottom: 1px solid #E8EEF8; text-align: left; vertical-align: top; } th { font-size: 9.5px; text-transform: uppercase; color: #64748B; }
.a { break-inside: avoid; border: 1px solid #DCE7FA; border-radius: 10px; padding: 9px 12px; margin: 0 0 8px; } .a h3 { margin: 0 0 4px; font-size: 13px; } .a h3 small { font-weight: 400; color: #64748B; font-size: 10.5px; margin-left: 6px; }
dl { display: grid; grid-template-columns: 74px 1fr; gap: 2px 10px; margin: 0; } dt { color: #64748B; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding-top: 1px; } dd { margin: 0; } .m { color: #64748B; font-size: 10.5px; }
.note { margin-top: 16px; padding-top: 10px; border-top: 1px solid #E2E8F0; color: #64748B; font-size: 9.5px; }
</style></head><body>
<header><div><div class="brand">OWNED MAP</div><h1>Emergency sheet</h1></div><div class="meta"><div><b>${owner ? esc(owner) : 'Asset overview'}</b></div><div>Prepared ${esc(prettyDate(today))}</div><div>${assets.length} asset${assets.length === 1 ? '' : 's'} · estimated net worth ${usd(net)}</div></div></header>
${settings.emergencyNote ? `<h2>Where to start</h2><div class="box">${esc(settings.emergencyNote).replace(/\n/g, '<br>')}</div>` : ''}
<h2>Who to call</h2>${contacts.length ? `<table><thead><tr><th>Role</th><th>Name</th><th>Phone</th><th>Email</th></tr></thead><tbody>${contacts.map(c => `<tr><td>${esc(c.role)}</td><td><b>${esc(c.name)}</b></td><td>${esc(c.phone)}</td><td>${esc(c.email)}</td></tr>`).join('')}</tbody></table>` : '<p class="m">No contacts added yet. In Owned Map, open Reports and choose &ldquo;Emergency contacts&rdquo; to add your lawyer, accountant, insurer and family.</p>'}
<h2>What there is</h2>${items || '<p class="m">No assets recorded.</p>'}
<p class="note">This sheet lists estimates entered by the owner, and the names of documents stored in Owned Map (the documents themselves are not printed). It contains private information: keep the paper somewhere safe and share it only with people you trust. Not legal, tax or financial advice.</p>
</body></html>`;
}
