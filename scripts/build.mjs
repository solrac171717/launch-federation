// Static build: syntax-check modules, copy to dist/, apply SITE_URL to canonical/OG/sitemap, verify local references.
//   SITE_URL=https://example.com npm run build
import { cp, rm, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const check = f => {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`Syntax error in ${f}\n${r.stderr}`); process.exit(1); }
};
for (const dir of ['src', 'api', 'scripts']) {
  for (const f of await readdir(dir)) if (f.endsWith('.js') || f.endsWith('.mjs')) check(`${dir}/${f}`);
}
check('landing.js');

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const p of ['index.html', 'app.html', 'landing.css', 'landing.js', 'styles.css', 'robots.txt', 'src', 'assets', 'api', 'supabase']) {
  await cp(p, `dist/${p}`, { recursive: true });
}

const site = (process.env.SITE_URL || '').replace(/\/$/, '');
let html = await readFile('dist/index.html', 'utf8');
if (site) {
  html = html.replaceAll('%SITE_URL%', site);
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}/</loc></url></urlset>\n`);
  await writeFile('dist/robots.txt', (await readFile('robots.txt', 'utf8')) + `Sitemap: ${site}/sitemap.xml\n`);
} else {
  html = html.replace(/<!--site-url:start-->[\s\S]*?<!--site-url:end-->\n?/, '');
  console.warn('SITE_URL not set: canonical, og:image and sitemap were omitted. Set SITE_URL for production builds.');
}
await writeFile('dist/index.html', html);

for (const page of ['index.html', 'app.html']) {
  const src = await readFile(`dist/${page}`, 'utf8');
  const missing = [...src.matchAll(/(?:src|href)="(?!https?:|data:|#|mailto:)([^"?#]+)/g)].map(m => m[1]).filter(p => !existsSync(`dist/${p}`));
  if (missing.length) { console.error(`Missing files referenced by ${page}:`, missing); process.exit(1); }
}
console.log('Build OK -> dist/');
