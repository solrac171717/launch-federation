import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEO_MAP, PLANNED, BRAND, CLUSTERS, groupLinks, phrases } from '../content/seo-map.mjs';
import { renderAll, compareUrls } from '../scripts/compare.mjs';
import { SOURCES, COMPARISONS, CHECKED } from '../content/compare.mjs';
import { SOLUTIONS } from '../content/solutions.mjs';

const SITE = 'https://ownedmap.com';
const norm = s => String(s).toLowerCase().replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const grab = (html, re) => { const m = html.match(re); return m ? m[1].replace(/<[^>]*>/g, ' ') : ''; };

// What each live page says about itself: the three places Google reads first.
const pages = {};
for (const f of ['index.html', 'privacy.html', 'terms.html']) {
  const h = readFileSync(f, 'utf8'); pages[f === 'index.html' ? '/' : `/${f}`] = { html: h, body: h };
}
for (const p of renderAll(SITE)) pages[p.path] = { html: p.html, body: p.html };
for (const [path, pg] of Object.entries(pages)) {
  pg.title = norm(grab(pg.html, /<title>([^<]*)<\/title>/)); pg.h1 = norm(grab(pg.html, /<h1[^>]*>([\s\S]*?)<\/h1>/));
  pg.description = norm(grab(pg.html, /<meta name="description" content="([^"]*)"/));
  const main = (pg.html.match(/<main[\s\S]*?<\/main>/) || [pg.html])[0].replace(/<script[\s\S]*?<\/script>/g, '');
  pg.first100 = norm(main.replace(/<[^>]*>/g, ' ')).split(' ').slice(0, 100).join(' ');
}

test('the map covers every indexable page, and only those', () => {
  assert.deepEqual(SEO_MAP.map(e => e.path).sort(), Object.keys(pages).sort());
  assert.deepEqual(compareUrls().sort(), SEO_MAP.filter(e => /^\/(compare|solutions|guides)\//.test(e.path)).map(e => e.path).sort());
  const all = [...SEO_MAP, ...PLANNED]; assert.equal(new Set(all.map(e => e.path)).size, all.length, 'a path is mapped once');
});

test('no phrase is claimed twice: not equal, not contained in another page’s phrase, live or planned', () => {
  const all = [...SEO_MAP, ...PLANNED].filter(e => e.primary);
  const claims = all.flatMap(e => phrases(e).map(ph => ({ path: e.path, ph: norm(ph) })));
  for (const a of claims) for (const b of claims) {
    if (a === b || a.path === b.path) continue;
    assert.ok(a.ph !== b.ph && !a.ph.includes(b.ph) && !b.ph.includes(a.ph), `"${a.ph}" (${a.path}) overlaps "${b.ph}" (${b.path})`);
  }
  for (const e of all) assert.ok(norm(e.primary).split(' ').length >= 3, `${e.path}: a primary phrase is specific (3+ words)`);
});

test('one page per rival, and "alternative" is never a page of its own', () => {
  const rivals = [...SEO_MAP, ...PLANNED].filter(e => e.type === 'comparison').map(e => norm(e.rival));
  assert.equal(new Set(rivals).size, rivals.length, 'each rival has exactly one page');
  for (const e of [...SEO_MAP, ...PLANNED]) assert.doesNotMatch(e.path, /alternative/i, `${e.path}: alternatives are answered by the rival’s own page`);
  for (const e of SEO_MAP.filter(x => x.type === 'comparison')) assert.ok((e.secondary || []).some(s => /alternative/.test(s)), `${e.path} also answers "alternative" searches`);
});

test('each page owns its phrase in the title, the H1 and the first 100 words', () => {
  for (const e of SEO_MAP.filter(x => x.primary)) {
    const pg = pages[e.path], p = norm(e.primary);
    assert.ok(pg.title.includes(p), `${e.path}: title has "${p}" (title: ${pg.title})`);
    if (e.type !== 'home') assert.ok(pg.h1.includes(p), `${e.path}: H1 has "${p}" (h1: ${pg.h1})`); // the home H1 is a styled hero line; its title carries the phrase
    assert.ok(phrases(e).some(ph => pg.description.includes(norm(ph))), `${e.path}: the description uses one of its phrases`);
    if (e.type !== 'home') assert.ok(pg.first100.includes(p), `${e.path}: the first 100 words use "${p}"`);
  }
});

test('no page puts another page’s phrase in its title, H1 or description', () => {
  const all = [...SEO_MAP, ...PLANNED].filter(e => e.primary);
  for (const [path, pg] of Object.entries(pages)) {
    for (const e of all) {
      if (e.path === path) continue;
      for (const ph of phrases(e).map(norm)) for (const where of ['title', 'h1', 'description']) assert.ok(!pg[where].includes(ph), `${path} ${where} contains "${ph}", which belongs to ${e.path}`);
    }
  }
});

test('titles, H1s and descriptions are unique, and the legal pages target nothing', () => {
  for (const where of ['title', 'h1', 'description']) { const v = Object.values(pages).map(p => p[where]); assert.equal(new Set(v).size, v.length, `${where}s are unique`); }
  for (const e of SEO_MAP.filter(x => x.type === 'legal')) assert.ok(!e.primary);
  for (const e of SEO_MAP.filter(x => x.type === 'comparison')) { const h = norm(pages[e.path].h1); assert.ok(h.includes(norm(BRAND))); }
});

test('links between pages describe their target', () => {
  const owner = new Map(); for (const e of SEO_MAP) for (const ph of phrases(e).map(norm)) owner.set(ph, e.path);
  for (const [path, pg] of Object.entries(pages)) {
    for (const m of pg.html.matchAll(/<a [^>]*href="([^"#]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const target = m[1].replace(/index\.html$/, '').replace(/^(?!\/|https?:)/, '/'), text = norm(m[2].replace(/<[^>]*>/g, ' '));
      for (const [ph, ownerPath] of owner) if (ownerPath !== target && ownerPath !== path && text.includes(ph)) assert.fail(`${path} links to ${target} with anchor "${text}", which names the phrase "${ph}" owned by ${ownerPath}`);
    }
  }
});

test('every comparison backs its outside claims: numbered, listed, linked and read', () => {
  assert.equal(CHECKED.length, 10);
  assert.deepEqual(SOURCES.map(s => s.n).sort((a, b) => a - b), SOURCES.map((_, i) => i + 1), 'source ids are unique and have no gaps');
  for (const s of SOURCES) { assert.match(s.url, /^https:\/\//); assert.ok(s.says.length > 20 && s.publisher && s.title); }
  assert.equal(new Set(SOURCES.map(s => s.url)).size, SOURCES.length, 'a source is listed once');
  for (const c of [...COMPARISONS, ...SOLUTIONS]) {
    const html = c.sections.map(s => s.html).join(' ');
    const cited = [...new Set([...html.matchAll(/href="#src-(\d+)"/g)].map(m => Number(m[1])))].sort((a, b) => a - b);
    assert.deepEqual(cited, c.sources.map((_, i) => i + 1), `${c.slug}: citations are numbered 1..n by first appearance and every listed source is cited`);
    assert.ok(c.sources.length >= 6, 'a page of this kind rests on several sources');
    const page = renderAll(SITE).find(p => p.path.endsWith(`/${c.slug}`)).html;
    const ld = JSON.parse([...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)][0][1].replaceAll('<\/', '</'));
    const art = ld['@graph'].find(x => x['@type'] === 'Article');
    assert.equal(art.citation.length, c.sources.length); assert.ok(art.wordCount >= 2500, 'wordCount is real'); for (const cit of art.citation) assert.ok(SOURCES.some(x => x.url === cit.url));
  }
});

test('the groups: every page belongs to one, a spoke has a live pillar to point to, and the links stay within the rules', () => {
  const all = [...SEO_MAP, ...PLANNED].map(e => e.path), live = SEO_MAP.map(e => e.path);
  for (const cl of CLUSTERS) {
    assert.ok(all.includes(cl.pillar), `${cl.id}: the pillar is mapped`); for (const sp of cl.spokes) assert.ok(all.includes(sp), `${cl.id}: ${sp} is mapped`);
    assert.ok(!cl.spokes.includes(cl.pillar), 'a pillar is not its own spoke');
  }
  // every mapped page that is not home, hub or legal sits in at least one group, as a pillar or a spoke
  const grouped = new Set(CLUSTERS.flatMap(cl => [cl.pillar, ...cl.spokes]));
  for (const e of [...SEO_MAP, ...PLANNED].filter(x => ['comparison', 'solution', 'guide', 'roundup'].includes(x.type))) assert.ok(grouped.has(e.path), `${e.path} belongs to a group`);
  for (const p of live) {
    const out = groupLinks(p, live); assert.ok(!out.includes(p), 'a page does not link to itself'); assert.equal(new Set(out).size, out.length, 'no link twice');
    for (const t of out) assert.ok(live.includes(t), `${p} only links to live pages (${t})`);
    const pillarOf = CLUSTERS.filter(cl => cl.spokes.includes(p));
    if (pillarOf.length) { const siblings = out.filter(t => !CLUSTERS.some(cl => cl.pillar === t)); assert.ok(siblings.length <= 2 * pillarOf.length, `${p} links to at most two siblings per group`); }
  }
});

test('the live pages link up to their pillar and the pillars link to their live spokes, with the target\u2019s own title as the text', () => {
  const pages = Object.fromEntries(renderAll(SITE).map(p => [p.path, p.html]));
  const hasLink = (from, to) => new RegExp(`<a href="${to}">`).test(pages[from]);
  for (const cl of CLUSTERS) {
    if (!pages[cl.pillar]) continue;
    for (const sp of cl.spokes.filter(p => pages[p])) { assert.ok(hasLink(sp, cl.pillar), `${sp} links up to ${cl.pillar}`); assert.ok(hasLink(cl.pillar, sp), `${cl.pillar} links down to ${sp}`); }
  }
  assert.ok(pages['/compare/stessa-vs-owned-map'].includes('Rental property portfolio tracker'));
  assert.ok(/<a href="\/solutions\/net-worth-tracker-without-bank-linking">Net worth tracker without linking bank accounts/.test(pages['/compare/kubera-vs-owned-map']));
});
