// Static build: syntax-check every module, copy to dist/, and verify index.html's local references exist.
import { cp, rm, readFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

for (const f of await readdir('src')) {
  const r = spawnSync(process.execPath, ['--check', `src/${f}`], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`Syntax error in src/${f}\n${r.stderr}`); process.exit(1); }
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const p of ['index.html', 'styles.css', 'src']) await cp(p, `dist/${p}`, { recursive: true });
const html = await readFile('dist/index.html', 'utf8');
const missing = [...html.matchAll(/(?:src|href)="(?!https?:|data:|#)([^"]+)"/g)].map(m => m[1]).filter(p => !existsSync(`dist/${p}`));
if (missing.length) { console.error('Missing files referenced by index.html:', missing); process.exit(1); }
console.log('Build OK -> dist/');
