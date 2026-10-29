// Landing demo of document autofill: a scripted walk-through on three made-up sample documents.
// Nothing is uploaded and no model is called on this page; the real thing runs inside the app (api/extract.js).
import { h } from './dom.js';

export const LABELS = { type: 'Type', name: 'Name', place: 'Location', coords: 'Coordinates', vin: 'VIN', cost: 'Price paid', currency: 'Currency', debt: 'Loan', date: 'Acquired on', share: 'Your share', owner: 'Held by' };

/**
 * One sample: a document made of text and highlighted marks ({ k, t }), and the form values read from it.
 * A value has the text to show, the mark it was read from (src) and an optional note on where it came from.
 */
export const SAMPLES = [
  {
    id: 'deed', tab: 'Home deed', file: 'maple-lane-deed.pdf', meta: 'PDF · 3 pages', title: 'Warranty deed',
    doc: [
      ['This deed, made on ', { k: 'date', t: 'March 14, 2022' }, ', conveys to ', { k: 'owner', t: 'Alex Sample' }, ' the property known as the ', { k: 'name', t: 'Maple Lane House' }, ', located at ', { k: 'place', t: '1208 Maple Lane, Austin, Texas' }, '.'],
      ['The purchase price is ', { k: 'cost', t: '$540,000' }, ', of which ', { k: 'debt', t: '$432,000' }, ' is secured by a deed of trust on the property.'],
      ['Interest conveyed: ', { k: 'share', t: '100%' }, ' of the estate in fee simple.'],
    ],
    fields: ['type', 'name', 'place', 'coords', 'cost', 'debt', 'date', 'share', 'owner'],
    values: {
      type: { v: 'House', src: 'name', note: 'worked out from the deed' }, name: { v: 'Maple Lane House', src: 'name' },
      place: { v: 'Austin, TX, United States', src: 'place' }, coords: { v: '30.2672, -97.7431', src: 'place', note: 'found from the address' },
      cost: { v: '$540,000', src: 'cost' }, debt: { v: '$432,000', src: 'debt' }, date: { v: 'Mar 14, 2022', src: 'date' },
      share: { v: '100%', src: 'share' }, owner: { v: 'Alex Sample', src: 'owner' },
    },
  },
  {
    id: 'car', tab: 'Car invoice', file: 'invoice-a6-avant.pdf', meta: 'PDF · 1 page', title: 'Vehicle invoice',
    doc: [
      ['Invoice date: ', { k: 'date', t: '2 June 2024' }, '. Sold by Sample Motors, Barcelona, to ', { k: 'owner', t: 'Alex Sample' }, '.'],
      ['Vehicle: ', { k: 'name', t: 'Audi A6 Avant' }, ', VIN ', { k: 'vin', t: 'WAUZZZ4G7EN000000' }, '. Delivered in ', { k: 'place', t: 'Barcelona, Spain' }, '.'],
      ['Total paid: ', { k: 'cost', t: '€48,500' }, ' (VAT included). No financing.'],
    ],
    fields: ['type', 'name', 'vin', 'place', 'coords', 'cost', 'currency', 'date', 'owner'],
    values: {
      type: { v: 'Car', src: 'name', note: 'worked out from the invoice' }, name: { v: 'Audi A6 Avant', src: 'name' }, vin: { v: 'WAUZZZ4G7EN000000', src: 'vin' },
      place: { v: 'Barcelona, ES', src: 'place' }, coords: { v: '41.3851, 2.1734', src: 'place', note: 'found from the address' },
      cost: { v: '48,500', src: 'cost' }, currency: { v: 'EUR', src: 'cost', note: 'converted to dollars at today’s rate' }, date: { v: 'Jun 2, 2024', src: 'date' }, owner: { v: 'Alex Sample', src: 'owner' },
    },
  },
  {
    id: 'boat', tab: 'Boat contract', file: 'bill-of-sale-sea-breeze.pdf', meta: 'PDF · 2 pages', title: 'Bill of sale',
    doc: [
      ['On ', { k: 'date', t: '20 September 2023' }, ', the vessel ', { k: 'name', t: 'Sea Breeze 52' }, ', a motor yacht moored at ', { k: 'place', t: 'Cascais Marina, Lisbon, Portugal' }, ', is sold for ', { k: 'cost', t: '$890,000' }, '.'],
      ['Buyers: ', { k: 'owner', t: 'Alex Sample and Jordan Sample' }, ', each holding ', { k: 'share', t: '50%' }, '. Paid in full, no lien.'],
    ],
    fields: ['type', 'name', 'place', 'coords', 'cost', 'date', 'share', 'owner'],
    values: {
      type: { v: 'Yacht', src: 'name', note: 'worked out from the contract' }, name: { v: 'Sea Breeze 52', src: 'name' },
      place: { v: 'Lisbon, PT', src: 'place' }, coords: { v: '38.6914, -9.4215', src: 'place', note: 'found from the address' },
      cost: { v: '$890,000', src: 'cost' }, date: { v: 'Sep 20, 2023', src: 'date' }, share: { v: '50%', src: 'share', note: 'only your half is counted' },
      owner: { v: 'Alex Sample and Jordan Sample', src: 'owner' },
    },
  },
];

/** The ordered steps of the animation for a sample: which form field fills in and which mark of the document lights up. */
export const stepsOf = sample => sample.fields.map(k => ({ field: k, mark: sample.values[k].src, text: sample.values[k].v, note: sample.values[k].note || '' }));

const wait = ms => new Promise(r => setTimeout(r, ms));

export function mountAutofillDemo(root, { reduceMotion = false } = {}) {
  let run = 0, current = SAMPLES[0], started = false;
  const status = h('p', { class: 'af-status', role: 'status', 'aria-live': 'polite' }, 'Pick a sample, then watch it read.');
  const replay = h('button', { type: 'button', class: 'btn btn-primary btn-sm af-play' }, 'Read this document');
  const tabs = h('div', { class: 'af-tabs', role: 'group', 'aria-label': 'Sample documents' });
  const doc = h('div', { class: 'af-doc', 'aria-label': 'Sample document' });
  const form = h('div', { class: 'af-form', 'aria-label': 'New asset form, filled in by the reader' });
  root.replaceChildren(tabs, h('div', { class: 'af-stage' }, doc, h('div', { class: 'af-arrow', 'aria-hidden': 'true' }), form), h('div', { class: 'af-foot' }, status, replay));

  const drawTabs = () => tabs.replaceChildren(...SAMPLES.map(s => h('button', { type: 'button', class: 'af-tab', 'aria-pressed': String(s === current), onclick: () => { if (s !== current) { current = s; draw(); play(); } } }, s.tab)));

  function draw() {
    drawTabs();
    doc.replaceChildren(
      h('div', { class: 'af-doc-top' }, h('b', {}, current.file), h('span', {}, current.meta)),
      h('div', { class: 'af-paper' },
        h('p', { class: 'af-title' }, current.title.toUpperCase()), h('p', { class: 'af-sample' }, 'Sample document, not a real record'),
        ...current.doc.map(line => h('p', { class: 'af-line' }, line.map(p => (typeof p === 'string' ? p : h('mark', { 'data-k': p.k }, p.t))))),
        h('i', { class: 'af-bar', 'aria-hidden': 'true' }), h('span', { class: 'af-scan', 'aria-hidden': 'true' })));
    form.replaceChildren(
      h('div', { class: 'af-form-top' }, h('b', {}, 'New asset'), h('span', { class: 'af-chip' }, 'Filled in from your document')),
      ...current.fields.map(k => h('div', { class: 'af-field', 'data-f': k }, h('label', {}, LABELS[k]), h('div', { class: 'af-val' }, h('span', { class: 'af-txt' }), h('em', { class: 'af-note' })))),
      h('div', { class: 'af-actions' }, h('span', { class: 'af-edit' }, 'Every field stays editable'), h('span', { class: 'af-save' }, 'Save asset')));
    status.textContent = 'Pick a sample, then watch it read.';
  }

  const fieldEl = k => form.querySelector(`[data-f="${k}"]`);
  const markEls = k => [...doc.querySelectorAll(`mark[data-k="${k}"]`)];
  const reset = () => { doc.classList.remove('scanning', 'af-done'); form.classList.remove('af-done'); doc.querySelectorAll('mark.on').forEach(m => m.classList.remove('on')); form.querySelectorAll('.af-field').forEach(f => { f.classList.remove('on', 'filled'); f.querySelector('.af-txt').textContent = ''; f.querySelector('.af-note').textContent = ''; }); };
  const fillNow = steps => { for (const s of steps) { const f = fieldEl(s.field); f.classList.add('filled'); f.querySelector('.af-txt').textContent = s.text; f.querySelector('.af-note').textContent = s.note; markEls(s.mark).forEach(m => m.classList.add('on')); } doc.classList.add('af-done'); form.classList.add('af-done'); };

  async function play() {
    const me = ++run, steps = stepsOf(current);
    reset(); replay.textContent = 'Read it again';
    if (reduceMotion) { fillNow(steps); status.textContent = `Read ${steps.length} fields from the document. Check them and edit anything.`; return; }
    status.textContent = 'Reading the document…';
    doc.classList.add('scanning'); await wait(950); if (me !== run) return;
    doc.classList.remove('scanning');
    let n = 0;
    for (const s of steps) {
      if (me !== run) return;
      const f = fieldEl(s.field), t = f.querySelector('.af-txt');
      markEls(s.mark).forEach(m => m.classList.add('on')); f.classList.add('on');
      const per = Math.max(8, Math.min(22, 420 / s.text.length));
      for (let i = 1; i <= s.text.length; i++) { t.textContent = s.text.slice(0, i); await wait(per); if (me !== run) return; }
      f.classList.remove('on'); f.classList.add('filled'); f.querySelector('.af-note').textContent = s.note; n++;
      status.textContent = `Filled in ${n} of ${steps.length}…`; await wait(130);
    }
    if (me !== run) return;
    doc.classList.add('af-done'); form.classList.add('af-done');
    status.textContent = `Done: ${steps.length} fields read from the document. Check them and edit anything.`;
  }

  replay.addEventListener('click', play);
  draw();
  // start by itself the first time the demo is on screen
  const kick = () => { if (started) return; started = true; play(); };
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); kick(); } }, { threshold: 0.35 }); io.observe(root); }
  else kick();
  return { play, draw };
}
