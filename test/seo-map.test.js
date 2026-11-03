import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEO_MAP, PLANNED, BRAND, phrases } from '../content/seo-map.mjs';
import { renderAll, compareUrls } from '../scripts/compare.mjs';
import { SOURCES, COMPARISONS, CHECKED } from '../content/compare.mjs';

const SITE = 'https://ownedmap.com';
const norm = s => String(s).toLowerCase().replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const grab = (html, re) => { const m = html.match(re); return m ? m[1].replace(/<[^>]*>/g, ' ') : ''; };

// What each live page says about itself: the three places Google reads first.
const pages = {};
for (const f of ['index.html', 'privacy.html', 'terms.html']) {
  const h = readFileSync(f, 'utf8'); pages[f === 'index.html' ? '/' : `/${f}`] = { html: h, body: h };
}
for (const p of renderAll(SITE)) pages[p.path === '/compare/index.html' ? '/compare/' : p.path] = { html: p.html, body: p.html };
for (const [path, pg] of Object.entries(pages)) {
  pg.title = norm(grab(pg.html, /<title>([^<]*)<\/title>/)); pg.h1 = norm(grab(pg.html, /<h1[^>]*>([\s\S]*?)<\/h1>/));
  pg.description = norm(grab(pg.html, /<meta name="description" content="([^"]*)"/));
  const main = (pg.html.match(/<main[\s\S]*?<\/main>/) || [pg.html])[0].replace(/<script[\s\S]*?<\/script>/g, '');
  pg.first100 = norm(main.replace(/<[^>]*>/g, ' ')).split(' ').slice(0, 100).join(' ');
}

test('the map covers every indexable page, and only those', () => {
  assert.deepEqual(SEO_MAP.map(e => e.path).sort(), Object.keys(pages).sort());
  assert.deepEqual(compareUrls().sort(), SEO_MAP.filter(e => e.path.startsWith('/compare/')).map(e => e.path).sort());
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
  assert.deepEqual(SOURCES.map(s => s.n), SOURCES.map((_, i) => i + 1));
  for (const s of SOURCES) { assert.match(s.url, /^https:\/\//); assert.ok(s.says.length > 20 && s.publisher && s.title); }
  assert.equal(new Set(SOURCES.map(s => s.url)).size, SOURCES.length, 'a source is listed once');
  for (const c of COMPARISONS) {
    const html = c.sections.map(s => s.html).join(' ');
    const cited = [...new Set([...html.matchAll(/href="#src-(\d+)"/g)].map(m => Number(m[1])))].sort((a, b) => a - b);
    assert.deepEqual(cited, c.sources.map((_, i) => i + 1), `${c.slug}: citations are numbered 1..n by first appearance and every listed source is cited`);
    assert.ok(c.sources.length >= 6, 'a page of this kind rests on several sources');
    const page = renderAll(SITE).find(p => p.path.endsWith(`${c.slug}.html`)).html;
    const ld = JSON.parse([...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)][0][1].replaceAll('<\/', '</'));
    const art = ld['@graph'].find(x => x['@type'] === 'Article');
    assert.equal(art.citation.length, c.sources.length); assert.ok(art.wordCount >= 2500, 'wordCount is real'); for (const cit of art.citation) assert.ok(SOURCES.some(x => x.url === cit.url));
  }
});
