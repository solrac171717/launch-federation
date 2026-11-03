// Static build: syntax-check modules, copy to dist/, apply SITE_URL to canonical/OG/sitemap, verify local references.
//   SITE_URL=https://example.com npm run build
import { cp, rm, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PLAN, priceCents, extraText } from '../src/billing-core.js';
import { TEMPLATE_CSV } from '../src/csv-import.js';
import { renderAll, compareUrls } from './compare.mjs';

const check = f => {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`Syntax error in ${f}\n${r.stderr}`); process.exit(1); }
};
for (const dir of ['src', 'api', 'scripts', 'assets']) {
  for (const f of await readdir(dir)) if (f.endsWith('.js') || f.endsWith('.mjs')) check(`${dir}/${f}`);
}
check('landing.js'); check('login.js');

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const p of ['index.html', 'app.html', 'login.html', 'login.css', 'login.js', 'privacy.html', 'terms.html', 'share.html', 'heir.html', 'welcome.html', 'legal.css', 'compare.css', 'landing.css', 'landing.js', 'app.css', 'robots.txt', 'src', 'assets', 'api', 'supabase']) {
  await cp(p, `dist/${p}`, { recursive: true });
}

// on Vercel's production build the live address is the default, so canonical, og:image and the sitemap are never missing by accident
const site = (process.env.SITE_URL || (process.env.VERCEL_ENV === 'production' ? 'https://ownedmap.com' : '')).replace(/\/$/, '');
const entity = { '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&mdash;': '—', '&ndash;': '–', '&middot;': '·', '&nbsp;': ' ', '&quot;': '"', '&#39;': "'", '&amp;': '&' };
const plain = h => h.replace(/<[^>]*>/g, '').replace(/&[#a-z0-9]+;/gi, m => entity[m] ?? m).replace(/\s+/g, ' ').trim();

// Structured data for search engines and AI assistants, built from the page itself so the FAQ and the prices can never drift from what visitors read.
const jsonLd = (html, site) => {
  const faq = [...html.matchAll(/<button[^>]*class="faq-q"[^>]*><span>(.*?)<\/span>[\s\S]*?<div class="faq-in"><p>([\s\S]*?)<\/p>/g)].map(m => ({ '@type': 'Question', name: plain(m[1]), acceptedAnswer: { '@type': 'Answer', text: plain(m[2]) } }));
  const usd = c => (c / 100).toFixed(2);
  const offer = (name, cents, per, desc) => ({ '@type': 'Offer', name, price: usd(cents), priceCurrency: 'USD', description: desc, priceSpecification: { '@type': 'UnitPriceSpecification', price: usd(cents), priceCurrency: 'USD', billingDuration: per, unitText: per === 'P1Y' ? 'YEAR' : 'MONTH' } });
  const graph = [
    { '@type': 'Organization', '@id': `${site}/#org`, name: 'Owned Map', url: `${site}/`, logo: `${site}/assets/logo-o.png`, email: 'support@ownedmap.com' },
    { '@type': 'WebSite', '@id': `${site}/#website`, url: `${site}/`, name: 'Owned Map', inLanguage: 'en-US', publisher: { '@id': `${site}/#org` } },
    { '@type': 'SoftwareApplication', '@id': `${site}/#app`, name: 'Owned Map', url: `${site}/`, applicationCategory: 'FinanceApplication', operatingSystem: 'Web', inLanguage: 'en-US', publisher: { '@id': `${site}/#org` },
      description: 'Owned Map puts property, vehicles, boats, aircraft, land and equipment on one interactive map, with the value, income, expenses, yield and net worth of each asset, plus PDF, Excel and CSV reports.',
      featureList: ['Interactive world map of every asset you own', 'Value, income, expenses, yield and net worth per asset', 'Mortgages and loans per asset', 'Documents and renewal reminders', 'PDF, Excel and CSV reports', 'CSV import'],
      offers: [offer('Monthly', PLAN.baseCents, 'P1M', `Includes ${PLAN.included} assets; extra assets: ${extraText()}, per month. 7-day free trial.`), offer('Yearly', priceCents(PLAN.included, 'year'), 'P1Y', `Includes ${PLAN.included} assets, ${Math.round(PLAN.yearlyOff * 100)}% less than monthly billing. 7-day free trial.`)] },
  ];
  if (faq.length) graph.push({ '@type': 'FAQPage', '@id': `${site}/#faq`, mainEntity: faq });
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('</', '<\/')}</script>`;
};

// pages search engines may index; everything else is noindex and left out of the sitemap
const INDEXABLE = ['index.html', 'privacy.html', 'terms.html'];
for (const page of INDEXABLE) {
  let html = await readFile(`dist/${page}`, 'utf8');
  if (site) {
    html = html.replaceAll('%SITE_URL%', site);
    if (page === 'index.html') html = html.replace('<!--jsonld-->', jsonLd(html, site));
  } else {
    html = html.replace(/<!--site-url:start-->[\s\S]*?<!--site-url:end-->\n?/, '').replace('<!--jsonld-->\n', '');
  }
  await writeFile(`dist/${page}`, html);
}
// The comparison pages (content/compare.mjs) become static pages, and the inventory template is made from the same columns the app imports.
await mkdir('dist/compare', { recursive: true }); await mkdir('dist/downloads', { recursive: true });
for (const g of renderAll(site)) await writeFile(`dist${g.path}`, g.html);
await writeFile('dist/downloads/asset-inventory-template.csv', TEMPLATE_CSV);

if (site) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [...INDEXABLE.map(p => `/${p === 'index.html' ? '' : p}`), ...compareUrls()].map(path => `<url><loc>${site}${path}</loc><lastmod>${today}</lastmod></url>`).join('');
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
  await writeFile('dist/robots.txt', (await readFile('robots.txt', 'utf8')) + `Sitemap: ${site}/sitemap.xml\n`);
  await writeFile('dist/llms.txt', (await readFile('llms.txt', 'utf8')).replaceAll('%SITE_URL%', site));
} else {
  console.warn('SITE_URL not set: canonical, og:image, structured data, sitemap and llms.txt were omitted. Set SITE_URL for production builds.');
}

// Public browser config for the app. Only the anon key belongs here; row-level security protects the data.
const sbUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), sbKey = process.env.SUPABASE_ANON_KEY || '';
if (sbUrl && sbKey) {
  await writeFile('dist/assets/config.js', `// Generated by scripts/build.mjs from the build environment.
export const CONFIG = ${JSON.stringify({ supabaseUrl: sbUrl, supabaseAnonKey: sbKey, remindersEmail: Boolean(process.env.RESEND_API_KEY && process.env.CRON_SECRET), extractor: Boolean(process.env.OPENAI_API_KEY), billing: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET), googleClientId: process.env.GOOGLE_CLIENT_ID || '' })};
`);
  console.log('App configured for Supabase (' + new URL(sbUrl).host + ').');
} else console.warn('SUPABASE_URL / SUPABASE_ANON_KEY not set: the app will save assets on the visitor device only.');

const generated = renderAll(site).map(g => g.path === '/compare/index.html' ? 'compare/index.html' : g.path.slice(1));
for (const page of ['index.html', 'app.html', 'login.html', 'share.html', 'heir.html', 'welcome.html', 'privacy.html', 'terms.html', ...generated]) {
  const src = await readFile(`dist/${page}`, 'utf8');
  const missing = [...src.matchAll(/(?:src|href)="(?!https?:|data:|#|mailto:)([^"?#]+)/g)].map(m => m[1]).filter(p => !p.startsWith('/api/') && !existsSync(`dist/${p}`)); // /api/... is answered by a serverless function, not a file
  if (missing.length) { console.error(`Missing files referenced by ${page}:`, missing); process.exit(1); }
}
console.log('Build OK -> dist/');
