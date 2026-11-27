// Owned Map agency page: rotating AI logos in the headline, the sample visibility dashboard (globe of zones, tracked questions,
// work of the month), the monthly / yearly switch (30% off when paid for the year), FAQ and the sticky call button on phones.
import { h, s, clear } from './src/dom.js';
import { createGlobe } from './src/globe.js';
import { AI_LOGOS } from './assets/ai-logos.js';

document.documentElement.classList.add('js');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const eur = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(Math.round(n));
const num = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const OFF = 0.30;

/* ------------------------------------------------------------------ AI marks (headline, strip) */
const COLOR = { chatgpt: '#10A37F', claude: '#D97757', perplexity: '#20808D', gemini: '#4285F4' };
const mark = k => s('svg', { viewBox: '0 0 24 24', class: 'ai-mark', 'aria-hidden': 'true', style: `color:${COLOR[k]}` }, s('path', { d: AI_LOGOS[k], fill: 'currentColor' }));
for (const el of document.querySelectorAll('[data-logo]')) el.prepend(mark(el.dataset.logo));

/* ------------------------------------------------------------------ rotating headline */
{
  const rot = document.querySelector('.rot');
  const items = [...rot.querySelectorAll('.rot-i')];
  let i = 0;
  const fit = () => { rot.style.width = items[i].getBoundingClientRect().width + 'px'; };
  fit(); document.fonts?.ready.then(fit); addEventListener('resize', fit);
  if (!reduceMotion) {
    setInterval(() => {
      items[i].classList.remove('on'); items[i].classList.add('out');
      const gone = items[i]; setTimeout(() => gone.classList.remove('out'), 600);
      i = (i + 1) % items.length; items[i].classList.add('on'); fit();
    }, 2400);
  }
}

/* ------------------------------------------------------------------ sample dashboard */
const ZONES = [
  { id: 'madrid', name: 'Madrid', lat: 40.42, lon: -3.7, category: 'cited', imp: 48200, clk: 1310, cit: 14 },
  { id: 'barcelona', name: 'Barcelona', lat: 41.39, lon: 2.17, category: 'cited', imp: 31900, clk: 920, cit: 9 },
  { id: 'valencia', name: 'Valencia', lat: 39.47, lon: -0.38, category: 'grow', imp: 9800, clk: 240, cit: 2 },
  { id: 'sevilla', name: 'Sevilla', lat: 37.39, lon: -5.98, category: 'grow', imp: 6100, clk: 150, cit: 1 },
  { id: 'cdmx', name: 'Ciudad de México', lat: 19.43, lon: -99.13, category: 'cited', imp: 22400, clk: 610, cit: 6 },
  { id: 'bogota', name: 'Bogotá', lat: 4.71, lon: -74.07, category: 'grow', imp: 8700, clk: 210, cit: 2 },
  { id: 'buenosaires', name: 'Buenos Aires', lat: -34.6, lon: -58.38, category: 'cited', imp: 14300, clk: 380, cit: 4 },
  { id: 'santiago', name: 'Santiago', lat: -33.45, lon: -70.67, category: 'grow', imp: 5200, clk: 120, cit: 1 },
  { id: 'miami', name: 'Miami', lat: 25.76, lon: -80.19, category: 'cited', imp: 11800, clk: 330, cit: 5 },
  { id: 'losangeles', name: 'Los Ángeles', lat: 34.05, lon: -118.24, category: 'grow', imp: 7300, clk: 190, cit: 2 },
];
const WEEKLY = [1, 1, 2, 2, 3, 3, 4, 5, 6, 6, 7, 6]; // citations per week in the sample (sums to the zone total)
const ENGINES = [['chatgpt', 'ChatGPT'], ['claude', 'Claude'], ['perplexity', 'Perplexity'], ['gemini', 'Gemini'], [null, 'Google IA']];
const PROMPTS = [
  ['mejor asesoría fiscal para startups', 'Madrid', [1, 1, 0, 1, 1]],
  ['asesoría para autónomos', 'Barcelona', [1, 0, 1, 1, 0]],
  ['gestoría online para empresas', 'Ciudad de México', [1, 1, 0, 0, 0]],
  ['abogado mercantil', 'Valencia', [0, 0, 0, 1, 0]],
  ['contador para pymes', 'Bogotá', [0, 0, 0, 0, 0]],
  ['asesoría para negocios hispanos', 'Miami', [1, 1, 1, 0, 1]],
  ['consultoría fiscal', 'Buenos Aires', [1, 0, 0, 1, 0]],
  ['asesor financiero para emprendedores', 'Sevilla', [0, 0, 0, 0, 1]],
];
const WORK = [
  ['6 artículos publicados', 'Respuestas a las preguntas que más buscan tus clientes, con tus datos y tu voz.'],
  ['Datos estructurados en 12 páginas', 'Para que las IA entiendan quién eres, qué ofreces y dónde.'],
  ['3 menciones en foros y directorios', 'Fuentes que las IA ya leen y en las que ahora apareces.'],
  ['2 páginas comerciales nuevas', 'Una por cada zona prioritaria, con su propia pregunta.'],
  ['Informe semanal enviado', 'Qué se movió, qué viene y qué decidimos contigo.'],
];
const LABEL = { cited: 'Te citan aquí', grow: 'Zona prioritaria' };
const ICONS = { cited: 'M5 12l5 5 9-10', grow: 'M12 19V5M6 11l6-6 6 6' };
const NAV = [
  ['zonas', 'Zonas', 'Visibilidad por zonas', 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2.5 2 2.5 10 0 12M8 2c-2.5 2-2.5 10 0 12'],
  ['prompts', 'Preguntas', 'Preguntas seguidas en las IA', 'M2 3h12v8H6l-3 3v-3H2z'],
  ['trabajo', 'Trabajo', 'Trabajo de este mes', 'M2 13l4-5 3 3 5-7'],
];
const state = { view: 'zonas', filter: null, sel: 'madrid' };
const $ = id => document.getElementById(id);
const scope = () => ZONES.filter(z => !state.filter || z.category === state.filter);
const sum = (arr, k) => arr.reduce((t, z) => t + z[k], 0);

const globe = createGlobe($('ag-map'), {
  assets: ZONES, icons: ICONS, selectedId: state.sel, startLon: -32, tilt: 20, countryPadV: 70,
  label: 'Globo giratorio con las zonas de un panel de ejemplo', onSelect: id => select(id, true),
});

function select(id, focus) { state.sel = id; globe.setSelected(id); if (focus) globe.focus(id); renderZones(); }

function renderNav() {
  const mk = cls => NAV.map(([k, label, , d]) => h('button', { type: 'button', class: cls + (state.view === k ? ' on' : ''), 'aria-current': state.view === k ? 'page' : null, onclick: () => setView(k) },
    s('svg', { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': 'true', class: 'ni' }, s('path', { d })), label));
  clear($('ag-nav')).append(...mk('nav-btn').map(b => h('li', {}, b)));
  clear($('ag-tabs')).append(...mk('tab-btn'));
}
function renderFilter() {
  const opts = [[null, 'Todas'], ['cited', 'Te citan'], ['grow', 'Prioritarias']];
  clear($('ag-filter')).append(...opts.map(([k, label]) => h('button', { type: 'button', class: state.filter === k ? 'on' : '', 'aria-pressed': String(state.filter === k), onclick: () => setFilter(k) }, label)));
  $('ag-filter').hidden = state.view !== 'zonas';
}
function setFilter(k) {
  state.filter = k; globe.setFilter(k);
  if (!scope().some(z => z.id === state.sel)) state.sel = scope()[0].id;
  globe.setSelected(state.sel); renderFilter(); renderZones();
}
function setView(k) {
  state.view = k; $('ag-title').textContent = NAV.find(n => n[0] === k)[2];
  for (const [id] of NAV) $('ag-v-' + id).hidden = id !== k;
  renderNav(); renderFilter();
}

function renderZones() {
  const sc = scope(), z = ZONES.find(x => x.id === state.sel), imp = sum(sc, 'imp'), clk = sum(sc, 'clk'), cit = sum(sc, 'cit');
  clear($('ag-sel')).append(h('div', { class: 'ag-zone' },
    h('div', { class: 'ag-zone-h' }, h('b', {}, z.name), h('span', { class: 'ag-chip ' + z.category }, LABEL[z.category])),
    h('dl', {}, ...[['Impresiones', num.format(z.imp)], ['Clics', num.format(z.clk)], ['Citas en IA', String(z.cit)]].map(([l, v]) => h('div', {}, h('dt', {}, l), h('dd', {}, v))))));
  clear($('ag-kpi')).append(h('span', {}, `Impresiones · últimos 90 días${state.filter ? ' · ' + (state.filter === 'cited' ? 'zonas donde te citan' : 'zonas prioritarias') : ''}`), h('b', {}, compact.format(imp)),
    h('span', { class: 'delta pos' }, '+38 % frente a los 90 días anteriores'));
  clear($('ag-pair')).append(...[['Clics', num.format(clk), 'desde Google'], ['Citas en IA', String(cit), `${sc.length} zonas`]].map(([l, v, sub]) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, v), h('em', {}, sub))));
  const k = cit / sum(ZONES, 'cit'), pts = WEEKLY.map(v => v * k), max = Math.max(...pts, 1), W = 240, H = 64;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - 6 - (v / max) * (H - 14)]);
  const line = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join('');
  clear($('ag-chart')).append(h('div', { class: 'mc-h' }, h('span', {}, 'Citas en IA por semana'), h('span', { class: 'delta pos' }, 'subiendo')),
    s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ag-spark', role: 'img', 'aria-label': 'Citas en IA por semana, con tendencia al alza (datos de ejemplo)', preserveAspectRatio: 'none' },
      s('path', { d: `${line}L${W} ${H}L0 ${H}Z`, fill: 'rgba(37,99,235,.12)' }), s('path', { d: line, fill: 'none', stroke: '#2563EB', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }),
      s('circle', { cx: xy.at(-1)[0] - 1, cy: xy.at(-1)[1], r: 3.2, fill: '#2563EB' })));
}

function renderPrompts() {
  const cells = PROMPTS.flatMap(p => p[2]), hit = cells.filter(Boolean).length;
  const head = h('tr', {}, h('th', { scope: 'col' }, 'Pregunta'), h('th', { scope: 'col' }, 'Zona'), ...ENGINES.map(([k, label]) => h('th', { scope: 'col', class: 'eng', title: label }, k ? mark(k) : h('span', { class: 'gtxt' }, 'G'), h('span', { class: 'sr' }, label))));
  const rows = PROMPTS.map(([q, zone, r]) => h('tr', {}, h('td', { class: 'q' }, q), h('td', { class: 'z' }, zone),
    ...r.map((v, i) => h('td', { class: 'eng' }, v ? h('span', { class: 'ok', role: 'img', 'aria-label': `${ENGINES[i][1]}: te cita` }, '✓') : h('span', { class: 'no', role: 'img', 'aria-label': `${ENGINES[i][1]}: no te cita` }, '–')))));
  clear($('ag-v-prompts')).append(h('div', { class: 'ag-pr-top' }, h('b', {}, `${hit} de ${cells.length}`), h('span', {}, 'respuestas de IA te citan esta semana, con la ciudad incluida en la pregunta')),
    h('div', { class: 'ag-tablewrap' }, h('table', { class: 'ag-table' }, h('thead', {}, head), h('tbody', {}, ...rows))));
}
function renderWork() {
  clear($('ag-v-trabajo')).append(h('ul', { class: 'ag-work' }, ...WORK.map(([t, d]) => h('li', {}, s('svg', { viewBox: '0 0 16 16', width: 18, height: 18, 'aria-hidden': 'true' }, s('circle', { cx: 8, cy: 8, r: 8, fill: '#DCE9FF' }), s('path', { d: 'M4.6 8.3l2.2 2.2 4.6-4.9', fill: 'none', stroke: '#2563EB', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })), h('div', {}, h('b', {}, t), h('span', {}, d))))));
}
renderPrompts(); renderWork(); setView('zonas'); renderZones();

/* ------------------------------------------------------------------ header, FAQ, pricing switch, sticky call button */
const header = document.querySelector('.site-header');
const sticky = $('ag-sticky'), hero = document.querySelector('.hero');
const onScroll = () => {
  header?.classList.toggle('scrolled', scrollY > 8);
  if (sticky && hero) sticky.hidden = !(scrollY > hero.offsetHeight * 0.6);
};
addEventListener('scroll', onScroll, { passive: true }); onScroll();

const items = [...document.querySelectorAll('[data-faq]')];
for (const item of items) {
  const btn = item.querySelector('.faq-q');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    for (const o of items) { const b = o.querySelector('.faq-q'), on = o === item && open; b.setAttribute('aria-expanded', String(on)); o.classList.toggle('open', on); }
  });
}

const buttons = [...document.querySelectorAll('.ag-per-b')];
const paint = per => {
  for (const b of buttons) { const on = b.dataset.per === per; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
  for (const plan of document.querySelectorAll('.ag-plan')) {
    const month = Number(plan.dataset.month), price = plan.querySelector('[data-price]'), bill = plan.querySelector('[data-bill]');
    if (per === 'year') {
      const perMonth = month * (1 - OFF);
      price.textContent = eur(perMonth); bill.textContent = `${eur(perMonth * 12)} al año, pagados por adelantado (antes ${eur(month * 12)})`;
    } else { price.textContent = eur(month); bill.textContent = 'Facturación mensual'; }
  }
};
for (const b of buttons) b.addEventListener('click', () => paint(b.dataset.per));
