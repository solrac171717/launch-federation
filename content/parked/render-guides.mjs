// Turns content/guides.mjs into static pages (/guides/<slug>.html and the /guides/ index): the same look as the legal pages, a title and description of its own,
// breadcrumbs, a call to start, related guides, and structured data (Article, BreadcrumbList, FAQPage). Used by scripts/build.mjs.
import { GUIDES, PUBLISHED, CTA, NOT_ADVICE } from '../content/guides.mjs';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = h => String(h).replace(/<[^>]*>/g, '').replace(/&rsquo;/g, '’').replace(/&ldquo;|&rdquo;/g, '"').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const bySlug = Object.fromEntries(GUIDES.map(g => [g.slug, g]));

const LOGO = '<a class="logo" href="/" aria-label="Owned Map home"><span class="lmark" style="--s:30px" aria-hidden="true"><img src="/assets/logo-o.png" alt="" width="192" height="192"></span><span>OWNED MAP</span></a>';
const header = () => `<header class="legal-top"><div class="wrap">\n  ${LOGO}\n  <nav aria-label="Primary"><a href="/#pricing">Pricing</a><a href="/guides/">Guides</a><a href="/login.html">Login</a><a class="g-start" href="${CTA.href}">${CTA.button}</a></nav>\n</div></header>`;
const footer = () => `<footer class="footer"><div class="wrap foot">\n  ${LOGO}\n  <p>&copy; 2026 Owned Map.</p>\n  <nav class="foot-links" aria-label="Footer"><a href="/guides/">Guides</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></nav>\n</div></footer>`;

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
<link rel="stylesheet" href="/guides.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replaceAll('</', '<\\/')}</script>` : ''}
</head>
<body class="legal-page guide-page">
${header()}
${body}
${footer()}
</body>
</html>
`;
}

const crumbs = items => `<nav class="g-crumbs" aria-label="Breadcrumb">${items.map(([label, href], i) => (href && i < items.length - 1 ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`)).join('<i aria-hidden="true">/</i>')}</nav>`;

export function renderGuide(g, site) {
  const path = `/guides/${g.slug}.html`;
  const url = site ? `${site}${path}` : '';
  const related = g.related.map(s => bySlug[s]).filter(Boolean);
  const body = `<main class="legal wrap">
${crumbs([['Home', '/'], ['Guides', '/guides/'], [g.crumb, path]])}
<p class="eyebrow">Guide</p>
<h1>${esc(g.h1)}</h1>
<p class="updated">Updated ${longDate(PUBLISHED)}</p>
<p class="intro">${g.lead}</p>
${g.sections.map(s => `<section>\n<h2>${esc(s.h2)}</h2>\n${s.html}\n</section>`).join('\n')}
<aside class="g-cta" aria-label="Try Owned Map"><h2>${esc(CTA.title)}</h2><p>${esc(CTA.text)}</p><a class="btn btn-primary btn-lg" href="${CTA.href}">${esc(CTA.button)}</a></aside>
<section class="g-faq">
<h2>Frequently asked questions</h2>
${g.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
</section>
<section>
<h2>Keep reading</h2>
<ul class="g-related">${related.map(r => `<li><a href="/guides/${r.slug}.html">${esc(r.h1)}</a><span>${esc(r.description)}</span></li>`).join('')}</ul>
</section>
<p class="g-note">${esc(NOT_ADVICE)}</p>
</main>`;
  const jsonld = site ? {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', '@id': `${url}#article`, headline: g.h1, description: g.description, datePublished: PUBLISHED, dateModified: PUBLISHED, inLanguage: 'en-US', mainEntityOfPage: url, image: `${site}/assets/og-image.png`, author: { '@id': `${site}/#org` }, publisher: { '@id': `${site}/#org` } },
      { '@type': 'BreadcrumbList', itemListElement: [['Home', `${site}/`], ['Guides', `${site}/guides/`], [g.h1, url]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
      { '@type': 'FAQPage', mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  } : null;
  return { path, html: shell({ site, path, title: `${g.title} | Owned Map`.length <= 66 ? `${g.title} | Owned Map` : g.title, description: g.description, jsonld, body }) };
}

export function renderHub(site) {
  const path = '/guides/';
  const title = 'Guides: Track and Manage the Assets You Own | Owned Map';
  const description = 'Practical guides for people who own property, vehicles, boats and aircraft: track rental performance, calculate net worth, plan an inventory for your family.';
  const body = `<main class="legal wrap">
${crumbs([['Home', '/'], ['Guides', '/guides/']])}
<p class="eyebrow">Guides</p>
<h1>Guides for people who own real assets</h1>
<p class="intro">Practical, plain-language guides on tracking property, vehicles, boats and aircraft: what to record, which numbers matter and how to keep everything in order.</p>
<ul class="g-cards">${GUIDES.map(g => `<li><a href="/guides/${g.slug}.html"><strong>${esc(g.h1)}</strong><span>${esc(g.description)}</span></a></li>`).join('')}</ul>
<aside class="g-cta" aria-label="Try Owned Map"><h2>${esc(CTA.title)}</h2><p>${esc(CTA.text)}</p><a class="btn btn-primary btn-lg" href="${CTA.href}">${esc(CTA.button)}</a></aside>
</main>`;
  const jsonld = site ? { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', '@id': `${site}${path}#page`, name: title, description, url: `${site}${path}`, isPartOf: { '@id': `${site}/#website` } },
    { '@type': 'ItemList', itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${site}/guides/${g.slug}.html`, name: g.h1 })) },
  ] } : null;
  return { path: '/guides/index.html', html: shell({ site, path, title, description, jsonld, body }) };
}

/** Every page this module makes: [{ path: '/guides/x.html', html }]. */
export const renderAll = site => [renderHub(site), ...GUIDES.map(g => renderGuide(g, site))];
/** Public URLs for the sitemap. */
export const guideUrls = () => ['/guides/', ...GUIDES.map(g => `/guides/${g.slug}.html`)];
