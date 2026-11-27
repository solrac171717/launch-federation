// Owned Map agency page: rotating AI logos in the headline, the free diagnosis (4-step onboarding that reads the visitor's own site through
// /api/diagnostico), the sample visibility dashboard (globe with countries and regions, tracked questions, work, competitors, reports),
// the monthly / yearly switch (30% off when paid for the year), FAQ and the sticky call button on phones.
import { h, s, clear } from './src/dom.js';
import { createGlobe } from './src/globe.js';
import { attachGeo } from './src/geoui.js';
import { ICON } from './src/ui.js';
import { AI_LOGOS } from './assets/ai-logos.js';

document.documentElement.classList.add('js');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const eur = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(Math.round(n));
const num = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const OFF = 0.30;
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ AI marks (headline, strip) */
const COLOR = { chatgpt: '#10A37F', claude: '#D97757', perplexity: '#20808D', gemini: '#4285F4', google: '#4285F4' };
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
      const gone = items[i];
      gone.classList.remove('on'); gone.classList.add('out'); setTimeout(() => gone.classList.remove('out'), 600);
      i = (i + 1) % items.length; items[i].classList.add('on'); fit();
    }, 2400);
  }
}

/* ------------------------------------------------------------------ sample dashboard */
ICON.cited = 'M5 12l5 5 9-10';
ICON.grow = 'M12 19V5M6 11l6-6 6 6';
const ZONES = [
  { id: 'madrid', name: 'Madrid', country: 'ES', lat: 40.42, lon: -3.7, category: 'cited', imp: 48200, clk: 1310, cit: 14 },
  { id: 'barcelona', name: 'Barcelona', country: 'ES', lat: 41.39, lon: 2.17, category: 'cited', imp: 31900, clk: 920, cit: 9 },
  { id: 'valencia', name: 'Valencia', country: 'ES', lat: 39.47, lon: -0.38, category: 'grow', imp: 9800, clk: 240, cit: 2 },
  { id: 'sevilla', name: 'Sevilla', country: 'ES', lat: 37.39, lon: -5.98, category: 'grow', imp: 6100, clk: 150, cit: 1 },
  { id: 'cdmx', name: 'Ciudad de México', country: 'MX', lat: 19.43, lon: -99.13, category: 'cited', imp: 22400, clk: 610, cit: 6 },
  { id: 'guadalajara', name: 'Guadalajara', country: 'MX', lat: 20.67, lon: -103.35, category: 'grow', imp: 8700, clk: 210, cit: 2 },
  { id: 'monterrey', name: 'Monterrey', country: 'MX', lat: 25.69, lon: -100.32, category: 'cited', imp: 14300, clk: 380, cit: 4 },
  { id: 'miami', name: 'Miami', country: 'US', lat: 25.76, lon: -80.19, category: 'cited', imp: 11800, clk: 330, cit: 5 },
  { id: 'losangeles', name: 'Los Ángeles', country: 'US', lat: 34.05, lon: -118.24, category: 'grow', imp: 7300, clk: 190, cit: 2 },
  { id: 'houston', name: 'Houston', country: 'US', lat: 29.76, lon: -95.37, category: 'grow', imp: 5200, clk: 120, cit: 1 },
].map(z => ({ ...z, value: z.imp, place: z.name }));
const COUNTRY_ES = { ES: 'España', MX: 'México', US: 'Estados Unidos' };
const WEEKLY = [1, 1, 2, 2, 3, 3, 4, 5, 6, 6, 7, 6]; // citations per week in the sample (sums to the zone total)
const LABEL = { cited: 'Te citan aquí', grow: 'Zona prioritaria' };
const state = { filter: null, sel: 'madrid' };
const byId = id => ZONES.find(z => z.id === id);
const visible = () => ZONES.filter(z => !state.filter || z.category === state.filter);
const sum = (arr, k) => arr.reduce((t, z) => t + z[k], 0);

const globe = createGlobe($('ag-map'), {
  assets: ZONES, icons: ICON, selectedId: state.sel, startLon: -32, tilt: 20, countryPadV: 70,
  label: 'Globo giratorio con las zonas de un panel de ejemplo', onSelect: id => select(id, true),
});
const geo = attachGeo($('ag-map'), globe, {
  visible, all: () => ZONES, selected: () => state.sel, lookup: byId, onPick: (id, f) => select(id, f), onChange: () => renderZones(), toggleAfter: $('ag-title'),
  labels: { mapView: 'Vista del mapa', globe: 'Globo', country: 'País', countries: 'Países', where: 'Dónde estás en el mapa', places: 'Zonas y lugares aquí', world: 'Mundo' },
  fmt: n => compact.format(n), countryName: c => COUNTRY_ES[c] || c,
});
const scope = () => visible().filter(z => geo.inScope(z));

function select(id, focus) { state.sel = id; globe.setSelected(id); if (focus) globe.focus(id); renderZones(); geo.sync(); }

function renderFilter() {
  const opts = [[null, 'Todas'], ['cited', 'Te citan'], ['grow', 'Prioritarias']];
  clear($('ag-filter')).append(...opts.map(([k, label]) => h('button', { type: 'button', class: state.filter === k ? 'on' : '', 'aria-pressed': String(state.filter === k), onclick: () => setFilter(k) }, label)));
}
function setFilter(k) {
  state.filter = k; globe.setFilter(k);
  if (!visible().some(z => z.id === state.sel)) state.sel = visible()[0].id;
  globe.setSelected(state.sel); renderFilter(); geo.sync(); renderZones();
}
function renderZones() {
  const sc = scope(), z = byId(state.sel), where = geo.placeName(), imp = sum(sc, 'imp'), clk = sum(sc, 'clk'), cit = sum(sc, 'cit');
  clear($('ag-sel')).append(h('div', { class: 'ag-zone' },
    h('div', { class: 'ag-zone-h' }, h('b', {}, z.name), h('span', { class: 'ag-chip ' + z.category }, LABEL[z.category])),
    h('dl', {}, ...[['Impresiones', num.format(z.imp)], ['Clics', num.format(z.clk)], ['Citas en IA', String(z.cit)]].map(([l, v]) => h('div', {}, h('dt', {}, l), h('dd', {}, v))))));
  const part = where || (state.filter ? (state.filter === 'cited' ? 'zonas donde te citan' : 'zonas prioritarias') : '');
  clear($('ag-kpi')).append(h('span', {}, `Impresiones · últimos 90 días${part ? ' · ' + part : ''}`), h('b', {}, compact.format(imp)),
    h('span', { class: 'delta pos' }, '+38 % frente a los 90 días anteriores'));
  clear($('ag-pair')).append(...[['Clics', num.format(clk), 'desde Google'], ['Citas en IA', String(cit), `${sc.length} ${sc.length === 1 ? 'zona' : 'zonas'}`]].map(([l, v, sub]) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, v), h('em', {}, sub))));
  const k = cit / sum(ZONES, 'cit'), pts = WEEKLY.map(v => v * k), max = Math.max(...pts, 1), W = 240, H = 64;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - 6 - (v / max) * (H - 14)]);
  const line = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join('');
  clear($('ag-chart')).append(h('div', { class: 'mc-h' }, h('span', {}, 'Citas en IA por semana'), h('span', { class: 'delta pos' }, 'subiendo')),
    s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ag-spark', role: 'img', 'aria-label': 'Citas en IA por semana, con tendencia al alza (datos de ejemplo)', preserveAspectRatio: 'none' },
      s('path', { d: `${line}L${W} ${H}L0 ${H}Z`, fill: 'rgba(37,99,235,.12)' }), s('path', { d: line, fill: 'none', stroke: '#2563EB', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }),
      s('circle', { cx: xy.at(-1)[0] - 1, cy: xy.at(-1)[1], r: 3.2, fill: '#2563EB' })));
}
function renderGoal() {
  clear($('ag-goal')).append(h('span', {}, 'Garantía · objetivo +30% en 90 días'), h('b', {}, '+38 %'), h('div', { class: 'ag-bar', role: 'img', 'aria-label': 'Objetivo superado: día 62 de 90' }, h('i', { style: 'width:100%' }), h('u', { style: 'left:79%' })), h('em', {}, 'Objetivo cumplido · día 62 de 90'));
}
renderGoal(); renderFilter(); renderZones(); geo.sync();

/* ------------------------------------------------------------------ free diagnosis: 4-step onboarding */
const ob = $('ob'), obBody = $('ob-body'), obSteps = [...$('ob-steps').children];
const BOOK = document.querySelector('[data-where="final"]')?.getAttribute('href') || '#';
const form = $('start'), urlInput = $('start-url'), note = $('start-note'), NOTE = note.innerHTML;
const SEV = { 3: ['Crítica', 'crit'], 2: ['Importante', 'mid'], 1: ['Mejora', 'low'] };
const lockIcon = () => s('svg', { viewBox: '0 0 24 24', width: 16, height: 16, class: 'lk', 'aria-hidden': 'true' }, s('rect', { x: 5, y: 10.5, width: 14, height: 10, rx: 2.5, fill: 'currentColor' }), s('path', { d: 'M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }));
const checkIcon = () => s('svg', { viewBox: '0 0 16 16', width: 18, height: 18, 'aria-hidden': 'true' }, s('circle', { cx: 8, cy: 8, r: 8, fill: '#DCE9FF' }), s('path', { d: 'M4.6 8.3l2.2 2.2 4.6-4.9', fill: 'none', stroke: '#2563EB', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
const TASKS = ['Leyendo tu página de inicio', 'Revisando robots.txt y llms.txt', 'Comprobando los datos estructurados', 'Midiendo si tu contenido responde preguntas', 'Buscando competidores en tu sector'];
let flow = null, lastFocus = null;

function setStep(n) { obSteps.forEach((li, i) => { li.classList.toggle('done', i < n); li.classList.toggle('on', i === n); li.setAttribute('aria-current', i === n ? 'step' : 'false'); }); }
function show(node, step) {
  setStep(step); clear(obBody).append(node);
  const t = obBody.querySelector('h2'); if (t) { t.id = 'ob-title'; t.tabIndex = -1; t.focus({ preventScroll: true }); }
  obBody.scrollTop = 0; ob.querySelector('.ob-card').scrollTop = 0;
}
function openFlow(raw) {
  lastFocus = document.activeElement; const token = (flow?.token || 0) + 1;
  flow = { token, raw, result: null };
  ob.hidden = false; document.body.classList.add('ob-open');
  stepAnalyze(token);
}
function closeFlow() {
  if (flow) flow.token++; ob.hidden = true; document.body.classList.remove('ob-open');
  (lastFocus && document.contains(lastFocus) ? lastFocus : urlInput).focus();
}
const alive = t => flow && flow.token === t && !ob.hidden;
const backBtn = fn => h('button', { type: 'button', class: 'ob-back', onclick: fn }, '← Atrás');
const bookBtn = (label, where) => h('a', { class: 'btn btn-primary btn-lg', href: BOOK, 'data-where': where }, label);

async function stepAnalyze(token) {
  const hostShown = flow.raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').slice(0, 60);
  const items = TASKS.map(t => h('li', {}, h('i', { 'aria-hidden': 'true' }), t));
  show(h('div', { class: 'ob-s1' }, h('div', { class: 'ob-site' }, s('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true' }, s('circle', { cx: 12, cy: 12, r: 9, fill: 'none', stroke: '#2563EB', 'stroke-width': 1.7 }), s('path', { d: 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', fill: 'none', stroke: '#2563EB', 'stroke-width': 1.5 })), h('b', {}, hostShown)),
    h('h2', {}, 'Analizando tu web…'), h('p', { class: 'ob-sub' }, 'Leemos tu página de inicio como lo haría una IA. Tarda unos segundos.'), h('ul', { class: 'ob-tasks' }, ...items)), 0);
  const call = fetch('/api/diagnostico', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: flow.raw }) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) })).catch(() => ({ status: 0, body: {} }));
  const step = reduceMotion ? 300 : 800;
  let k = 0; const tick = setInterval(() => { if (!alive(token)) return clearInterval(tick); if (k < items.length - 1) { items[k].className = 'done'; k++; items[k].className = 'doing'; } }, step);
  items[0].className = 'doing';
  const [res] = await Promise.all([call, sleep(step * (items.length - 1) + 400)]); clearInterval(tick);
  if (!alive(token)) return;
  if (res.status !== 200 || !res.body?.ok) return stepError(res.status, res.body?.error);
  items.forEach(li => { li.className = 'done'; }); await sleep(450); if (!alive(token)) return;
  flow.result = res.body; stepCompetitors();
}
function stepError(status, error) {
  const msg = error === 'invalid_url' ? ['Esa dirección no parece una web', 'Escribe algo como tuweb.com y vuelve a intentarlo.']
    : error === 'rate_limited' ? ['Has probado muchas veces', 'Espera unos minutos y vuelve a intentarlo, o reserva una llamada y lo vemos contigo.']
    : status === 422 || error === 'unreachable' ? ['No hemos podido leer tu web ahora mismo', 'Puede estar caída, bloquear visitas automáticas o ser una dirección privada. Si la web es pública, lo revisamos juntos en la llamada.']
    : ['Algo ha fallado de nuestro lado', 'Inténtalo de nuevo en un momento, o reserva una llamada y lo hacemos contigo.'];
  show(h('div', { class: 'ob-err' }, h('h2', {}, msg[0]), h('p', { class: 'ob-sub' }, msg[1]), h('div', { class: 'ob-actions' }, h('button', { type: 'button', class: 'btn btn-dark btn-lg', onclick: () => { closeFlow(); urlInput.select(); } }, 'Probar con otra web'), bookBtn('Reservar llamada gratuita', 'ob-error'))), 0);
}
function stepCompetitors() {
  const r = flow.result, ring = h('div', { class: 'ob-ring', style: `--p:${r.score}`, role: 'img', 'aria-label': `Puntuación ${r.score} sobre 100` }, h('b', {}, String(r.score)), h('span', {}, '/100'));
  const comps = r.competitors?.length
    ? h('div', {}, h('h3', {}, 'Posibles competidores en tu sector'), h('ul', { class: 'ob-comps' }, ...r.competitors.map(c => h('li', {}, h('i', { 'aria-hidden': 'true' }, c.name.slice(0, 1).toUpperCase()), h('div', {}, h('b', {}, c.name), h('span', {}, c.domain))))), h('p', { class: 'ob-hint' }, 'Los confirmamos contigo en la llamada y medimos cuántas veces las IA los nombran a ellos y no a ti.'))
    : h('div', {}, h('h3', {}, 'Tus competidores'), h('p', { class: 'ob-sub left' }, 'Los identificamos a partir de tu sector y medimos, pregunta a pregunta, cuántas veces las IA los nombran a ellos y no a ti. Es parte del informe completo.'));
  show(h('div', { class: 'ob-s2' }, h('h2', {}, 'Así ven las IA tu web'), h('div', { class: 'ob-score' }, ring, h('div', {}, h('b', {}, r.title || r.host), h('span', {}, `${r.passed} de ${r.total} comprobaciones superadas`), h('em', {}, 'Visibilidad técnica para las IA'))), comps,
    h('div', { class: 'ob-actions' }, h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: stepGaps }, 'Ver mis brechas'))), 1);
}
function stepGaps() {
  const r = flow.result, shown = r.shown.map(g => h('li', { class: 'ob-gap ' + SEV[g.sev][1] }, h('span', { class: 'sev' }, SEV[g.sev][0]), h('div', {}, h('b', {}, g.title), h('p', {}, g.why), g.detail ? h('em', {}, g.detail) : null)));
  const lockedBlock = r.locked > 0 ? h('div', { class: 'ob-locked' },
    h('div', { class: 'ob-lock-h' }, lockIcon(), h('b', {}, `${r.locked} ${r.locked === 1 ? 'brecha más' : 'brechas más'}`), h('span', {}, 'bloqueadas')),
    ...Array.from({ length: Math.min(r.locked, 3) }, (_, i) => h('div', { class: 'ob-row ob-skel', 'aria-hidden': 'true' }, lockIcon(), h('div', {}, h('i', { style: `width:${72 - i * 9}%` }), h('i', { style: `width:${48 - i * 5}%` })))),
    h('ul', { class: 'ob-chips' }, ...Object.entries(r.lockedGroups).map(([g, n]) => h('li', {}, lockIcon(), `${g} · ${n}`)))) : null;
  const title = r.gaps === 0 ? 'Tu base técnica es sólida' : `Encontramos ${r.gaps} ${r.gaps === 1 ? 'brecha' : 'brechas'} que frenan tus citas`;
  const sub = r.gaps === 0 ? 'No vemos brechas técnicas en tu página de inicio. Lo que falta es medir cuántas veces te citan las IA.' : r.locked > 0 ? `Estas son las ${r.shown.length} más graves de ${r.gaps}. El resto se desbloquea en tu informe completo.` : 'Estas son todas. En tu informe completo te decimos cómo arreglar cada una.';
  show(h('div', { class: 'ob-s3' }, h('h2', {}, title), h('p', { class: 'ob-sub' }, sub), h('ul', { class: 'ob-gaps' }, ...shown), lockedBlock,
    h('div', { class: 'ob-actions' }, backBtn(stepCompetitors), h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: stepReport }, r.locked > 0 ? `Desbloquear las ${r.locked} restantes` : 'Siguiente'))), 2);
}
function stepReport() {
  const r = flow.result, perks = [r.gaps > 0 ? `Las ${r.gaps} ${r.gaps === 1 ? 'brecha' : 'brechas'} de tu web, con cómo arreglar cada una` : 'Una revisión a fondo de tu web y de tu contenido', 'Cuántas veces te citan ChatGPT, Claude, Perplexity y Gemini, pregunta a pregunta', 'Tus competidores medidos señal por señal', 'Un plan de 90 días para crecer un 30 %, o trabajamos gratis'];
  show(h('div', { class: 'ob-s4' }, h('h2', {}, 'Desbloquea tu informe completo'), h('p', { class: 'ob-sub' }, 'En una llamada de 30 minutos te lo enseñamos todo y te decimos qué haríamos primero. Sin tarjeta y sin iniciar sesión.'),
    h('ul', { class: 'ob-perks' }, ...perks.map(t => h('li', {}, checkIcon(), t))),
    h('div', { class: 'ob-actions col' }, bookBtn('Reservar llamada gratuita', 'ob-report'), h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { closeFlow(); $('planes').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); } }, 'Ver planes'), backBtn(stepGaps)),
    h('p', { class: 'ob-fine' }, 'No guardamos tu diagnóstico ni los datos de tu web.')), 3);
}

form.addEventListener('submit', e => {
  e.preventDefault(); const v = urlInput.value.trim();
  if (!/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(v)) { note.textContent = 'Escribe la dirección de tu web, por ejemplo tuweb.com'; note.classList.add('err'); urlInput.focus(); return; }
  note.classList.remove('err'); note.innerHTML = NOTE; openFlow(v);
});
$('ob-x').addEventListener('click', closeFlow);
ob.addEventListener('mousedown', e => { if (e.target === ob) closeFlow(); });
addEventListener('keydown', e => {
  if (ob.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeFlow(); }
  if (e.key === 'Tab') { // keep the focus inside the dialog
    const f = [...ob.querySelectorAll('button, a[href], input, [tabindex="-1"]')].filter(x => !x.disabled && x.offsetParent !== null && x.tabIndex >= -1 && !(x.tabIndex === -1 && x.tagName === 'H2'));
    if (!f.length) return; const a = f[0], z = f.at(-1);
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
});

/* ------------------------------------------------------------------ header, FAQ, pricing switch, sticky call button, reveal */
const header = document.querySelector('.site-header');
const sticky = $('ag-sticky'), hero = document.querySelector('.hero');
const onScroll = () => {
  header?.classList.toggle('scrolled', scrollY > 8);
  if (sticky && hero) sticky.hidden = !(scrollY > hero.offsetHeight * 0.6) || !ob.hidden;
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

if (!reduceMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.ag-reveal').forEach(el => io.observe(el));
} else document.querySelectorAll('.ag-reveal').forEach(el => el.classList.add('in'));

/* ------------------------------------------------------------------ landing visuals: animate only while on screen */
{
  const arts = [...document.querySelectorAll('.how-art, .ag-g30')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { for (const e of es) e.target.classList.toggle('live', e.isIntersecting); }, { threshold: .25 });
    arts.forEach(a => io.observe(a));
  } else arts.forEach(a => a.classList.add('live'));
}
