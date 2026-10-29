// Small tools that open as dialogs from the dashboard: loan calculator, sale simulator, the usual reminders for an asset,
// and the emergency contacts. They read the stored asset (its own currency) or the enriched view (dollars) and never change
// anything unless the person presses a save button.
import { h } from './dom.js';
import { money } from './ui.js';
import { amortize, saleSim } from './finance.js';
import { formatIn } from './fx.js';
import { standardFor, validateReminder, isoDay } from './reminders.js';
import { quickValues } from './asset-store.js';
import { emergencyHtml } from './emergency.js';
import { printReport } from './report.js';

const num = v => { const n = Number(String(v ?? '').replace(/[$,%\s]/g, '')); return String(v ?? '').trim() === '' ? 0 : Number.isFinite(n) ? n : NaN; };
const monthsText = m => { const y = Math.floor(m / 12), r = m % 12; return [y && `${y} year${y > 1 ? 's' : ''}`, r && `${r} month${r > 1 ? 's' : ''}`].filter(Boolean).join(' ') || 'less than a month'; };
const dayText = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * ctx: { openModal, modal, toast, run, message, rawOf(id), viewOf(id), assets() (enriched), docs(), rems(), setRems(list), addReminder(id, v),
 *        saveAsset(id, valuesFromQuickValues, prev), settings: { get(), save(patch) }, sync(id), owner() }
 */
export function createTools(ctx) {
  const { openModal, modal, toast, run, message } = ctx;
  const card = (title, sub, body, small = true) => h('div', { class: 'modal-card' + (small ? ' small' : '') }, h('div', { class: 'modal-head' }, h('div', {}, h('h2', { id: 'modal-title' }, title), sub ? h('p', { class: 'hint' }, sub) : null),
    h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')), body);
  const row = (label, value, cls = '') => h('div', { class: 'calc-row ' + cls }, h('span', {}, label), h('b', {}, value));

  /* ---- loan calculator */
  function openLoan(id) {
    const a = ctx.rawOf(id); if (!a) return;
    const cur = a.currency || 'USD', f = n => formatIn(n, cur);
    const mk = (idn, v, ph) => h('input', { id: idn, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: v ? String(v) : '', placeholder: ph });
    const bal = mk('l-bal', a.debt, '250,000'), rate = mk('l-rate', a.debtRate, '4.5'), pay = mk('l-pay', a.debtPayment, '1,500'), extra = mk('l-extra', '', '200');
    const out = h('div', { class: 'calc-out', 'aria-live': 'polite' });
    const saveBtn = h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: save }, 'Save rate and payment to this asset');
    const fld = (l, c, hint) => h('div', { class: 'field' }, h('label', { for: c.id }, l), c, hint ? h('p', { class: 'hint' }, hint) : null);
    function calc() {
      const b = num(bal.value), r = num(rate.value), p = num(pay.value), x = num(extra.value);
      out.replaceChildren();
      if ([b, r, p, x].some(Number.isNaN) || b < 0 || r < 0 || p < 0 || x < 0) { out.append(h('p', { class: 'err' }, 'Use numbers from zero up.')); return; }
      if (!(b > 0)) { out.append(h('p', { class: 'hint' }, 'Enter the balance you still owe.')); return; }
      if (!(p > 0)) { out.append(h('p', { class: 'hint' }, 'Enter your monthly payment to see when the loan ends.')); return; }
      const base = amortize({ balance: b, annualRatePct: r, payment: p });
      if (!base.ok) {
        out.append(h('p', { class: 'err' }, base.reason === 'too-low' ? `This payment does not even cover the monthly interest (about ${f(b * r / 1200)}), so the balance never goes down.` : 'At this payment the loan would take more than 100 years.'));
        return;
      }
      out.append(row('Debt-free in', `${monthsText(base.months)} (${dayText(base.payoff)})`), row('Interest still to pay', f(base.totalInterest)), row('Total you will pay', f(base.totalPaid)));
      if (!(r > 0)) out.append(h('p', { class: 'hint' }, 'No interest rate entered, so interest is counted as zero. Add the rate for a real answer.'));
      if (x > 0) {
        const fast = amortize({ balance: b, annualRatePct: r, payment: p, extra: x });
        out.append(h('div', { class: 'calc-sep' }, `If you also pay ${f(x)} more every month`),
          row('Debt-free in', `${monthsText(fast.months)} (${dayText(fast.payoff)})`),
          row('You finish sooner by', monthsText(base.months - fast.months), 'good'), row('Interest you save', f(base.totalInterest - fast.totalInterest), 'good'));
      }
    }
    async function save() {
      const r = num(rate.value), p = num(pay.value), b = num(bal.value);
      const q = quickValues(a, { value: a.value, debt: b, debtPayment: p, debtRate: r });
      if (!q.ok || [r, p, b].some(Number.isNaN) || r > 100) { toast('Check the numbers before saving.', 'err'); return; }
      saveBtn.disabled = true;
      const ok = await run('Could not save', async () => { await ctx.saveAsset(id, q.value, a); return true; });
      saveBtn.disabled = false; if (ok) { modal().close(); toast('Loan details saved.'); }
    }
    [bal, rate, pay, extra].forEach(i => i.addEventListener('input', calc));
    const body = h('div', { class: 'asset-form' },
      h('div', { class: 'two' }, fld(`Balance owed (${cur})`, bal), fld('Yearly interest rate, %', rate)),
      h('div', { class: 'two' }, fld(`Monthly payment (${cur})`, pay), fld(`Extra each month (${cur})`, extra, 'Try an amount to see what it saves.')),
      out, h('p', { class: 'hint' }, 'Standard monthly repayment maths. Fees, rate changes and insurance are not included, so your bank statement is the final word.'),
      h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => modal().close() }, 'Close'), saveBtn));
    calc(); openModal(card('Loan calculator', a.name, body)); setTimeout(() => (a.debtRate ? extra : rate).focus(), 30);
  }

  /* ---- sale simulator */
  async function openSale(id) {
    const v = ctx.viewOf(id); if (!v) return;
    const s = await ctx.settings.get().catch(() => ({ sale: { costsPct: 5, taxPct: 15 } }));
    const mk = (idn, val) => h('input', { id: idn, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: String(val) });
    const price = mk('s-price', Math.round(v.value)), costs = mk('s-costs', s.sale.costsPct), tax = mk('s-tax', s.sale.taxPct);
    const out = h('div', { class: 'calc-out', 'aria-live': 'polite' });
    const fld = (l, c, hint) => h('div', { class: 'field' }, h('label', { for: c.id }, l), c, hint ? h('p', { class: 'hint' }, hint) : null);
    const nw = ctx.assets().reduce((n, x) => n + x.value - (x.debt || 0), 0);
    function calc() {
      const p = num(price.value), c = num(costs.value), t = num(tax.value);
      out.replaceChildren();
      if ([p, c, t].some(Number.isNaN) || p <= 0 || c < 0 || t < 0 || c > 50 || t > 80) { out.append(h('p', { class: 'err' }, 'Enter a sale price, selling costs up to 50% and tax up to 80%.')); return; }
      const r = saleSim(v, { price: p, costsPct: c, taxPct: t });
      out.append(row('Sale price', money(r.price)), row('Selling costs', `-${money(r.costs)}`), row('Tax on the gain', `-${money(r.tax)}`, r.tax ? '' : 'muted'), row('Loan paid off', `-${money(r.debt)}`, r.debt ? '' : 'muted'),
        row('What you keep', money(r.net), r.net < 0 ? 'bad total' : 'good total'),
        h('div', { class: 'calc-sep' }, 'Effect on your net worth'),
        row('Now', money(nw)), row('After the sale', money(nw + r.netWorthChange)), row('Cost of selling', money(r.netWorthChange), 'muted'));
      if (r.underwater) out.append(h('p', { class: 'err' }, 'The sale would not cover the loan: you would have to pay the difference.'));
      if (r.gain < 0) out.append(h('p', { class: 'hint' }, 'You would sell below what you paid, so no tax on a gain is counted.'));
    }
    [price, costs, tax].forEach(i => i.addEventListener('input', calc));
    async function remember() {
      const c = num(costs.value), t = num(tax.value);
      if ([c, t].some(Number.isNaN)) return;
      const ok = await run('Could not save', async () => { await ctx.settings.save({ sale: { costsPct: c, taxPct: t } }); return true; });
      if (ok) toast('Assumptions saved for next time.');
    }
    const body = h('div', { class: 'asset-form' },
      h('p', { class: 'hint' }, v.shared ? `This is your ${v.ownership}% share, in US dollars.` : 'Figures in US dollars.'),
      fld('Sale price (USD)', price),
      h('div', { class: 'two' }, fld('Selling costs, %', costs, 'Agent, legal, closing.'), fld('Tax on the gain, %', tax, 'Your own rate.')),
      out, h('p', { class: 'hint' }, 'A rough estimate for planning. Real taxes depend on your country, how long you owned it and your situation, so ask your accountant. Nothing is changed in Owned Map.'),
      h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => modal().close() }, 'Close'), h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: remember }, 'Remember these percentages')));
    calc(); openModal(card('If you sold it', v.name, body)); setTimeout(() => price.focus(), 30);
  }

  /* ---- the usual reminders */
  function openStandard(id, { back } = {}) {
    const a = ctx.rawOf(id); if (!a) return;
    const have = ctx.rems().filter(r => r.assetId === id), list = standardFor(a.type, have);
    if (!list.length) { toast(have.length ? 'The usual reminders are already there.' : 'There are no standard reminders for this kind of asset.'); return; }
    const picks = list.map(s => ({ s, on: h('input', { type: 'checkbox', checked: true, 'aria-label': s.title }), date: h('input', { type: 'date', value: s.dueOn, min: '2000-01-01', 'aria-label': `Date for ${s.title}` }) }));
    const err = h('p', { class: 'err form-err', role: 'alert' });
    const go = h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: add }, 'Add the selected ones');
    async function add() {
      const chosen = picks.filter(p => p.on.checked); if (!chosen.length) { err.textContent = 'Choose at least one.'; return; }
      go.disabled = true; err.textContent = '';
      try {
        let n = 0;
        for (const p of chosen) { const r = validateReminder({ kind: p.s.kind, title: p.s.title, dueOn: p.date.value, repeat: p.s.repeat, notifyDays: 14 }, { today: isoDay() }); if (r.ok) { ctx.setRems([...ctx.rems(), await ctx.addReminder(id, r.value)]); n++; } }
        ctx.sync(id); toast(`${n} reminder${n === 1 ? '' : 's'} added.`); back ? back() : modal().close();
      } catch (x) { err.textContent = `Could not add them: ${message(x)}`; go.disabled = false; }
    }
    const body = h('div', { class: 'asset-form' },
      h('p', { class: 'hint' }, 'The dates are placeholders. Set each one to the real due date (policy renewal, last inspection plus a year...) and untick what does not apply.'),
      ...picks.map(p => h('div', { class: 'std-row' }, h('label', { class: 'check' }, p.on, h('span', {}, p.s.title)), p.date)),
      err, h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => (back ? back() : modal().close()) }, back ? 'Back' : 'Cancel'), go));
    openModal(card('The usual reminders', `For ${a.name}. They repeat every year.`, body));
  }

  /* ---- emergency contacts and the sheet */
  async function openContacts() {
    const s = await run('Could not load your settings', () => ctx.settings.get()); if (!s) return;
    const rows = [...s.contacts, ...Array.from({ length: Math.max(0, 4 - s.contacts.length) }, () => ({ role: '', name: '', phone: '', email: '' }))].slice(0, 12);
    const inp = (ph, val, max, type = 'text') => h('input', { type, placeholder: ph, value: val, maxlength: max, autocomplete: 'off' });
    const fields = rows.map(c => ({ role: inp('Role, e.g. Lawyer', c.role, 40), name: inp('Name', c.name, 80), phone: inp('Phone', c.phone, 40, 'tel'), email: inp('Email', c.email, 120, 'email') }));
    const note = h('textarea', { rows: 4, maxlength: 1000, placeholder: 'Where the originals are kept, who has the keys, what to do first…' }, s.emergencyNote);
    const err = h('p', { class: 'err form-err', role: 'alert' });
    const save = h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: submit }, 'Save');
    async function submit() {
      save.disabled = true; err.textContent = '';
      const ok = await run('Could not save', async () => { await ctx.settings.save({ contacts: fields.map(f => ({ role: f.role.value, name: f.name.value, phone: f.phone.value, email: f.email.value })), emergencyNote: note.value }); return true; });
      save.disabled = false; if (ok) { modal().close(); toast('Emergency details saved.'); }
    }
    const body = h('div', { class: 'asset-form' },
      h('p', { class: 'hint' }, 'These appear on the emergency sheet so that someone you trust knows who to call. Only add what you are comfortable printing.'),
      ...fields.map(f => h('div', { class: 'contact-row' }, f.role, f.name, f.phone, f.email)),
      h('div', { class: 'field' }, h('label', {}, 'Where to start (optional)'), note), err,
      h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: () => modal().close() }, 'Cancel'), save));
    openModal(card('Emergency contacts', null, body, false));
  }
  async function printEmergency() {
    const s = await run('Could not load your settings', () => ctx.settings.get()); if (!s) return;
    printReport(emergencyHtml({ assets: ctx.assets(), docs: ctx.docs(), reminders: ctx.rems(), settings: s, owner: ctx.owner() }));
  }

  return { openLoan, openSale, openStandard, openContacts, printEmergency };
}
