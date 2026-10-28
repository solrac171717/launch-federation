// Dev server: static files + /api/* routed to the same handlers Vercel runs in production.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2] || '.';
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain', '.xml': 'application/xml',
};

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new Error('too large');
    chunks.push(c);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text); } catch { return text; }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = normalize(decodeURIComponent(url.pathname)).split('\\').join('/').replace(/^\/+/, '');
  if (p.includes('..')) { res.writeHead(400).end(); return; }
  if (p.startsWith('api/')) {
    try {
      const mod = await import(pathToFileURL(join(process.cwd(), p.replace(/\/$/, '') + '.js')).href);
      if (req.method === 'POST') req.body = await readBody(req);
      await mod.default(req, res);
    } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND') res.writeHead(404).end('Not found');
      else { console.error(e); res.writeHead(500).end('Server error'); }
    }
    return;
  }
  try {
    const f = join(root, p === '' ? 'index.html' : p);
    const data = await readFile(f);
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }).end(data);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(process.env.PORT || 4173, () => console.log('ATLAS on http://localhost:' + (process.env.PORT || 4173)));
