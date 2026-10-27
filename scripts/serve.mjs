import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[\\/]+/, '');
  if (p.includes('..')) { res.writeHead(400).end(); return; }
  try {
    const f = join(root, p === '' ? 'index.html' : p);
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }).end(await readFile(f));
  } catch { res.writeHead(404).end('Not found'); }
}).listen(process.env.PORT || 4173, () => console.log('ATLAS on http://localhost:' + (process.env.PORT || 4173)));
