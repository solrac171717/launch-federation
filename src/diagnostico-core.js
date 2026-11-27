// Diagnóstico de visibilidad en IA de una página de inicio: 30 comprobaciones deterministas (sin modelos), y la lista de brechas.
// Pure functions, shared by api/diagnostico.js and the tests. Nothing here touches the network.
import net from 'node:net';

export const GROUPS = {
  acceso: 'Acceso para las IA',
  datos: 'Datos estructurados',
  contenido: 'Contenido listo para responder',
  autoridad: 'Autoridad y confianza',
};
export const AI_BOTS = ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot', 'Google-Extended', 'CCBot'];

/* ---------------------------------------------------------------- the address that was typed */
export function parseTarget(input) {
  const raw = String(input ?? '').trim().slice(0, 300);
  if (!raw) return { ok: false, error: 'empty' };
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return { ok: false, error: 'invalid' }; }
  if (!['http:', 'https:'].includes(u.protocol)) return { ok: false, error: 'invalid' };
  if (u.port && !['80', '443'].includes(u.port)) return { ok: false, error: 'invalid' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || net.isIP(host) || host.startsWith('[') || host === 'localhost' || /\.(local|localhost|internal|lan|home|corp|test|invalid)$/.test(host) || !/^[a-z0-9.-]+$/.test(host)) return { ok: false, error: 'invalid' };
  return { ok: true, host, url: `https://${host}/` };
}

/** Private, loopback, link-local, shared, multicast and reserved addresses (IPv4 and IPv6): never fetched. */
export function isPrivateAddress(ip) {
  const v = String(ip || '').toLowerCase();
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (net.isIPv4(v)) {
    const [a, b] = v.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIPv6(v)) return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v) || v.startsWith('2001:db8') || v.startsWith('64:ff9b');
  return true; // not an address we understand: do not connect
}

/* ---------------------------------------------------------------- reading the page */
const attrs = tag => { const out = {}; for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) out[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').trim(); return out; };
const text = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<!--[\s\S]*?-->/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export function readPage(html) {
  const src = String(html || '').slice(0, 1_500_000);
  const metas = [...src.matchAll(/<meta\s+([^>]*?)\/?>/gi)].map(m => attrs(m[1]));
  const meta = n => metas.find(m => (m.name || m.property || '').toLowerCase() === n)?.content || '';
  const types = new Set();
  const walk = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(walk); for (const t of [].concat(n['@type'] || [])) types.add(String(t)); walk(n['@graph']); for (const k of ['mainEntity', 'itemListElement', 'publisher', 'author', 'aggregateRating', 'makesOffer', 'offers', 'hasOfferCatalog', 'itemOffered', 'review']) walk(n[k]); };
  let jsonld = 0;
  for (const m of src.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(m[1])); jsonld++; } catch { /* a broken block counts as none */ } }
  const heads = [...src.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => ({ level: +m[1], text: text(m[2]) })).filter(h => h.text);
  const imgs = [...src.matchAll(/<img\b[^>]*>/gi)].map(m => attrs(m[0]));
  const links = [...src.matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({ href: attrs(m[0].slice(0, m[0].indexOf('>') + 1)).href || '', label: text(m[1]) }));
  const body = text(src.replace(/^[\s\S]*?<body[^>]*>/i, ''));
  return {
    title: text((src.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''),
    description: meta('description'), robotsMeta: meta('robots').toLowerCase(), ogTitle: meta('og:title'), ogDescription: meta('og:description'),
    canonical: [...src.matchAll(/<link\s+([^>]*?)\/?>/gi)].map(m => attrs(m[1])).some(l => (l.rel || '').toLowerCase().split(/\s+/).includes('canonical') && l.href),
    lang: /<html[^>]*\blang\s*=\s*["']?[a-z]/i.test(src), jsonld, types, heads, imgs, links, body,
    words: body ? body.split(' ').length : 0,
    hasList: /<(ul|ol|table)\b/i.test(src), hasDetails: /<details\b/i.test(src),
  };
}

/** Which AI bots does this robots.txt shut out? */
export function blockedBots(robotsTxt) {
  if (!robotsTxt) return { bots: [], all: false };
  const groups = []; let cur = null;
  for (const line of String(robotsTxt).split(/\r?\n/)) {
    const m = line.replace(/#.*$/, '').match(/^\s*([a-zA-Z-]+)\s*:\s*(.*?)\s*$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2];
    if (k === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); }
    else if (cur && (k === 'disallow' || k === 'allow')) cur.rules.push([k, v]);
  }
  const shutsOut = g => g.rules.some(([k, v]) => k === 'disallow' && v === '/') && !g.rules.some(([k, v]) => k === 'allow' && v === '/');
  const all = groups.some(g => g.agents.includes('*') && shutsOut(g));
  const bots = AI_BOTS.filter(b => groups.some(g => g.agents.includes(b.toLowerCase()) && shutsOut(g)));
  return { bots, all };
}

/* ---------------------------------------------------------------- the 30 checks */
const hasType = (p, re) => [...p.types].some(t => re.test(t));
const socials = /(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com)/i;

/**
 * @param {{ url: string, status: number, headers?: {xRobotsTag?: string}, html: string, robotsTxt: string|null, llmsTxt: boolean, sitemap: boolean }} ctx
 * @returns {{ id: string, group: string, sev: 1|2|3, ok: boolean, title: string, why: string, detail?: string }[]}
 */
export function runChecks(ctx) {
  const p = readPage(ctx.html), blocked = blockedBots(ctx.robotsTxt), h1s = p.heads.filter(h => h.level === 1), h2s = p.heads.filter(h => h.level === 2);
  const questions = p.heads.filter(h => /\?|^(c[oó]mo|qu[eé]|por qu[eé]|cu[aá]nto|cu[aá]ndo|d[oó]nde|qui[eé]n|how|what|why|when|where|which)\b/i.test(h.text));
  const alt = p.imgs.length ? p.imgs.filter(i => 'alt' in i).length / p.imgs.length : 1;
  const bodyLow = p.body.toLowerCase(), linkText = p.links.map(l => `${l.label} ${l.href}`).join(' ').toLowerCase();
  const sameAs = new Set(p.links.map(l => (l.href.match(socials) || [])[1]?.toLowerCase()).filter(Boolean));
  const c = (id, group, sev, ok, title, why, detail) => ({ id, group, sev, ok: Boolean(ok), title, why, ...(detail && !ok ? { detail } : {}) });
  return [
    c('robots-ai', 'acceso', 3, !blocked.bots.length && !blocked.all, 'Tu robots.txt cierra la puerta a bots de IA', 'Si un bot no puede leerte, no puede citarte.', blocked.all ? 'Bloqueas a todos los bots' : `Bloqueas: ${blocked.bots.join(', ')}`),
    c('https', 'acceso', 3, ctx.url.startsWith('https://'), 'Tu web no se sirve de forma segura (https)', 'Las IA y Google prefieren fuentes seguras.'),
    c('indexable', 'acceso', 3, !/noindex/.test(p.robotsMeta) && !/noindex/i.test(ctx.headers?.xRobotsTag || ''), 'Tu página pide que no se indexe (noindex)', 'Una página fuera del índice no puede aparecer en respuestas.'),
    c('status', 'acceso', 3, ctx.status >= 200 && ctx.status < 300, 'Tu página de inicio no responde con un 200 limpio', 'Si el servidor da error, nadie te lee.', `Código ${ctx.status}`),
    c('llms', 'acceso', 2, ctx.llmsTxt, 'No tienes un archivo llms.txt', 'Es la guía que algunas IA leen para entender tu empresa.'),
    c('sitemap', 'acceso', 2, ctx.sitemap, 'No encontramos un sitemap.xml', 'El sitemap les dice qué páginas existen.'),
    c('robots-file', 'acceso', 1, ctx.robotsTxt != null, 'No tienes un archivo robots.txt', 'Sin él, no controlas qué leen los bots.'),
    c('canonical', 'acceso', 1, p.canonical, 'Falta la etiqueta canonical', 'Evita que tu contenido se duplique y se diluya.'),
    c('jsonld', 'datos', 3, p.jsonld > 0, 'No tienes datos estructurados (JSON-LD)', 'Es el idioma con el que las IA entienden quién eres.'),
    c('org', 'datos', 3, hasType(p, /^(Organization|LocalBusiness|ProfessionalService|Corporation|Person|Store|MedicalBusiness|LegalService|Restaurant|[A-Za-z]*Business)$/), 'Falta el dato estructurado de tu organización', 'Sin él, la IA no sabe qué empresa eres ni qué haces.'),
    c('faq-schema', 'datos', 3, hasType(p, /^FAQPage$/), 'No marcas tus preguntas frecuentes (FAQPage)', 'Las preguntas marcadas son las que más se citan en respuestas.'),
    c('offer-schema', 'datos', 2, hasType(p, /^(Product|Service|Offer|SoftwareApplication|Article|BlogPosting|Course|Event)$/), 'No marcas tus productos o servicios', 'La IA no puede resumir lo que vendes si no se lo explicas.'),
    c('rating-schema', 'datos', 2, hasType(p, /^(AggregateRating|Review|Rating)$/), 'Tus reseñas no están marcadas', 'Las valoraciones refuerzan que te recomienden.'),
    c('website-schema', 'datos', 1, hasType(p, /^WebSite$/), 'Falta el dato estructurado del sitio (WebSite)', 'Ayuda a asociar tu marca con tu dominio.'),
    c('breadcrumb', 'datos', 1, hasType(p, /^BreadcrumbList$/), 'No tienes migas de pan marcadas', 'Aclaran cómo se organiza tu web.'),
    c('title', 'contenido', 2, p.title.length >= 15 && p.title.length <= 70, 'El título de tu página no está bien planteado', 'Es lo primero que lee una IA para saber de qué va tu web.', p.title ? `Tu título mide ${p.title.length} caracteres` : 'No hay título'),
    c('description', 'contenido', 2, p.description.length >= 70 && p.description.length <= 170, 'La descripción de tu página falta o no es útil', 'Resume tu oferta en una frase que se pueda citar.', p.description ? `Mide ${p.description.length} caracteres` : 'No hay descripción'),
    c('h1', 'contenido', 2, h1s.length === 1, 'Tu página no tiene un único titular principal (H1)', 'El H1 dice de qué trata la página.', `Hay ${h1s.length} H1`),
    c('questions', 'contenido', 3, questions.length >= 2, 'Tu contenido no responde preguntas de tus compradores', 'Las IA citan páginas que contestan lo que se les pregunta.', `Solo ${questions.length} ${questions.length === 1 ? 'titular' : 'titulares'} con forma de pregunta`),
    c('faq-visible', 'contenido', 2, p.hasDetails || /preguntas frecuentes|faq|frequently asked/i.test(bodyLow), 'No muestras una sección de preguntas frecuentes', 'Es el formato que más se reutiliza en respuestas.'),
    c('words', 'contenido', 2, p.words >= 300, 'Tu página tiene muy poco texto que leer', 'Con poco texto, la IA no tiene de dónde citarte.', `${p.words} palabras`),
    c('h2', 'contenido', 1, h2s.length >= 3, 'Tu contenido no está dividido en secciones claras', 'Los subtítulos ayudan a extraer respuestas.'),
    c('alt', 'contenido', 1, alt >= 0.8, 'Tus imágenes no tienen texto alternativo', 'Sin él, las imágenes no cuentan para entender tu página.', `${Math.round(alt * 100)} % con alt`),
    c('lists', 'contenido', 1, p.hasList, 'No usas listas ni tablas', 'Los datos ordenados se citan con más facilidad.'),
    c('lang', 'contenido', 1, p.lang, 'No declaras el idioma de la página', 'Ayuda a mostrarte en el idioma correcto.'),
    c('about', 'autoridad', 2, /(nosotros|sobre|about|equipo|contacto|contact)/.test(linkText), 'No enlazas a una página sobre ti o de contacto', 'La IA busca señales de que detrás hay una empresa real.'),
    c('social', 'autoridad', 2, sameAs.size >= 2, 'Apenas enlazas tus perfiles en redes', 'Las menciones cruzadas confirman quién eres.', `${sameAs.size} perfiles enlazados`),
    c('proof', 'autoridad', 2, /(reseñas|rese[nñ]as|testimonio|casos? de [eé]xito|opiniones|reviews|testimonials|case stud)/i.test(bodyLow), 'No muestras reseñas, casos o testimonios', 'Las pruebas sociales empujan a que te recomienden.'),
    c('author', 'autoridad', 1, /(autor|equipo|fundador|nuestro equipo|author|team|founder)/.test(bodyLow), 'No muestras a las personas detrás de la empresa', 'Poner cara y nombre aumenta la confianza.'),
    c('og', 'autoridad', 1, p.ogTitle && p.ogDescription, 'Faltan las etiquetas para compartir tu web (Open Graph)', 'Controlan cómo se presenta tu marca al enlazarla.'),
  ];
}

/** Gaps ranked by weight; only `top` are described, the rest are only counted (the server never sends their text). */
export function summarize(checks, top = 3) {
  const gaps = checks.map((c, i) => ({ ...c, i })).filter(c => !c.ok).sort((a, b) => b.sev - a.sev || a.i - b.i);
  const weight = checks.reduce((t, c) => t + c.sev, 0), lost = gaps.reduce((t, c) => t + c.sev, 0);
  const pick = ({ id, group, sev, title, why, detail }) => ({ id, group, groupName: GROUPS[group], sev, title, why, ...(detail ? { detail } : {}) });
  const hidden = gaps.slice(top), lockedGroups = {};
  for (const g of hidden) lockedGroups[GROUPS[g.group]] = (lockedGroups[GROUPS[g.group]] || 0) + 1;
  return { total: checks.length, passed: checks.length - gaps.length, gaps: gaps.length, score: Math.round(100 * (1 - lost / weight)), shown: gaps.slice(0, top).map(pick), locked: hidden.length, lockedGroups };
}
