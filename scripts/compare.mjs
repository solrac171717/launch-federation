// Turns content/compare.mjs into static pages (/compare/<slug>.html and the /compare/ index): article on the left, a sticky call to start on the right
// (a bottom bar on phones), breadcrumbs, table of contents and structured data (Article, BreadcrumbList, FAQPage). Used by scripts/build.mjs.
import { COMPARISONS, CHECKED, CTA, PROOF } from '../content/compare.mjs';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const LOGO = '<a class="logo" href="/" aria-label="Owned Map home"><span class="lmark" style="--s:30px" aria-hidden="true"><img src="/assets/logo-o.png" alt="" width="192" height="192"></span><span>OWNED MAP</span></a>';
const header = () => `<header class="legal-top"><div class="wrap">\n  ${LOGO}\n  <nav aria-label="Primary"><a href="/#pricing">Pricing</a><a href="/compare/">Compare</a><a href="/login.html">Login</a><a class="g-start" href="${CTA.href}">Start free</a></nav>\n</div></header>`;
const footer = () => `<footer class="footer"><div class="wrap foot">\n  ${LOGO}\n  <p>&copy; 2026 Owned Map.</p>\n  <nav class="foot-links" aria-label="Footer"><a href="/compare/">Compare</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></nav>\n</div></footer>`;

function shell({ site, path, title, description, jsonld, body }) {
  const url = site ? `${site}${path}` : '';
  return `<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
${site ? `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${site}/assets/og-image.png">\n<meta name="twitter:image" content="${site}/assets/og-image.png">` : ''}
<meta property="og:type" content="article">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="Owned Map">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/assets/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/landing.css">
<link rel="stylesheet" href="/legal.css">
<link rel="stylesheet" href="/compare.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replaceAll('</', '<\\/')}</script>` : ''}
</head>
<body class="legal-page cmp-page">
${header()}
${body}
${footer()}
</body>
</html>
`;
}

const crumbs = items => `<nav class="g-crumbs" aria-label="Breadcrumb">${items.map(([label, href], i) => (href && i < items.length - 1 ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`)).join('<i aria-hidden="true">/</i>')}</nav>`;

const proof = () => `${PROOF.quotes.map(q => `<blockquote class="cmp-quote"><p>&ldquo;${esc(q.quote)}&rdquo;</p><footer>${esc(q.name)}${q.role ? `, ${esc(q.role)}` : ''}</footer></blockquote>`).join('')}<ul class="cmp-proof">${PROOF.points.map(([t, d]) => `<li><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`).join('')}</ul>`;
const side = () => `<aside class="cmp-side" aria-label="Try Owned Map"><div class="cmp-card"><p class="cmp-kicker">Free for ${7} days</p><h2>${esc(CTA.title)}</h2><p>${esc(CTA.text)}</p><a class="btn btn-primary btn-lg" href="${CTA.href}">${esc(CTA.button)}</a><p class="cmp-fine">Card required, cancel anytime.</p>${proof()}</div></aside>`;
const bar = () => `<div class="cmp-bar"><a class="btn btn-primary" href="${CTA.href}">${esc(CTA.button)}</a></div>`;

export function renderComparison(c, site) {
  const path = `/compare/${c.slug}.html`, url = site ? `${site}${path}` : '';
  const body = `<main class="wrap cmp-layout">
<article class="legal cmp-article">
${crumbs([['Home', '/'], ['Compare', '/compare/'], [c.crumb, path]])}
<p class="eyebrow">Comparison</p>
<h1>${esc(c.h1)}</h1>
<p class="updated">Checked ${longDate(CHECKED)}</p>
<p class="intro">${c.lead}</p>
<nav class="cmp-toc" aria-label="On this page"><strong>On this page</strong><ol>${c.toc.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('')}</ol></nav>
${c.sections.map(s => `<section id="${s.id}">\n<h2>${esc(s.h2)}</h2>\n${s.html}\n</section>`).join('\n')}
<aside class="g-cta" aria-label="Try Owned Map"><h2>${esc(CTA.title)}</h2><p>${esc(CTA.text)}</p><a class="btn btn-primary btn-lg" href="${CTA.href}">${esc(CTA.button)}</a></aside>
<section class="g-faq" id="faq">
<h2>Frequently asked questions</h2>
${c.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
</section>
<p class="g-note">${esc(c.rival)} is a trademark of its owner. We are not affiliated with it. This page is general information, not financial advice.</p>
</article>
${side()}
</main>
${bar()}`;
  const jsonld = site ? {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', '@id': `${url}#article`, headline: c.h1, description: c.description, datePublished: CHECKED, dateModified: CHECKED, inLanguage: 'en-US', mainEntityOfPage: url, image: `${site}/assets/og-image.png`, author: { '@id': `${site}/#org` }, publisher: { '@id': `${site}/#org` } },
      { '@type': 'BreadcrumbList', itemListElement: [['Home', `${site}/`], ['Compare', `${site}/compare/`], [c.h1, url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
      { '@type': 'FAQPage', mainEntity: c.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  } : null;
  return { path, html: shell({ site, path, title: c.title, description: c.description, jsonld, body }) };
}

export function renderHub(site) {
  const path = '/compare/';
  const title = 'Compare Owned Map: Honest Side-by-Side Comparisons';
  const description = 'How Owned Map compares with other net worth and asset trackers, feature by feature, with prices and who each one suits. Honest, dated and sourced.';
  const body = `<main class="wrap cmp-layout">
<article class="legal cmp-article">
${crumbs([['Home', '/'], ['Compare', '/compare/']])}
<p class="eyebrow">Compare</p>
<h1>Owned Map compared with other trackers</h1>
<p class="intro">Side-by-side pages for people choosing a tool to keep track of what they own. Each one says where the other product is stronger, uses what it publishes, and is dated.</p>
<ul class="g-cards">${COMPARISONS.map(c => `<li><a href="/compare/${c.slug}.html"><strong>${esc(c.h1)}</strong><span>${esc(c.description)}</span></a></li>`).join('')}</ul>
</article>
${side()}
</main>
${bar()}`;
  const jsonld = site ? { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', '@id': `${site}${path}#page`, name: title, description, url: `${site}${path}`, isPartOf: { '@id': `${site}/#website` } },
    { '@type': 'ItemList', itemListElement: COMPARISONS.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `${site}/compare/${c.slug}.html`, name: c.h1 })) },
  ] } : null;
  return { path: '/compare/index.html', html: shell({ site, path, title, description, jsonld, body }) };
}

/** Every page this module makes: [{ path: '/compare/x.html', html }]. */
export const renderAll = site => [renderHub(site), ...COMPARISONS.map(c => renderComparison(c, site))];
/** Public URLs for the sitemap. */
export const compareUrls = () => ['/compare/', ...COMPARISONS.map(c => `/compare/${c.slug}.html`)];
