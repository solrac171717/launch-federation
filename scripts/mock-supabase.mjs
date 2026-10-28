// Local stand-in for Supabase (auth + PostgREST `assets` table) so the whole cloud path can be exercised
// without a project: `node scripts/mock-supabase.mjs` serves the site AND the API on one port.
// It mimics what matters: per-user row isolation (RLS), column/constraint errors, token expiry and refresh.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';

const COLS = ['id', 'user_id', 'name', 'type', 'place', 'country', 'lat', 'lon', 'value', 'cost', 'gross', 'expenses', 'debt', 'debt_payment', 'status', 'acquired_on', 'notes', 'history', 'is_sample', 'created_at', 'updated_at'];
const TYPES = ['house', 'office', 'warehouse', 'parking', 'land', 'car', 'truck', 'motorcycle', 'rv', 'yacht', 'sailboat', 'jetski', 'aircraft', 'equipment'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

export function startMock({ port = 4180, root = '.' } = {}) {
  const users = new Map();       // email -> { id, email }
  const access = new Map();      // access token -> { user, exp }
  const refresh = new Map();     // refresh token -> user
  const table = [];              // all rows, every user
  const docs = [], rems = [], files = new Map(); // other tables + the private file bucket
  const log = [];
  const origin = `http://localhost:${port}`;

  const issue = user => {
    const at = 'at_' + randomUUID(), rt = 'rt_' + randomUUID();
    access.set(at, { user, exp: Date.now() + 3600_000 }); refresh.set(rt, user);
    return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
  };
  const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  const bearer = req => { const t = (req.headers.authorization || '').replace(/^Bearer /, ''); const a = access.get(t); return a && a.exp > Date.now() ? a.user : null; };
  const readRaw = async req => { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); };
  const readBody = async req => { const c = []; for await (const x of req) c.push(x); const t = Buffer.concat(c).toString(); try { return t ? JSON.parse(t) : undefined; } catch { return undefined; } };

  function check(row) {
    for (const k of Object.keys(row)) if (!COLS.includes(k)) return { code: 'PGRST204', message: `Could not find the '${k}' column of 'assets' in the schema cache` };
    if (!row.name || row.name.length > 80) return { code: '23514', message: 'new row violates check constraint "assets_name_check"' };
    if (!TYPES.includes(row.type)) return { code: '23514', message: 'new row violates check constraint "assets_type_check"' };
    for (const k of ['place', 'country', 'lat', 'lon', 'value', 'cost']) if (row[k] === undefined || row[k] === null) return { code: '23502', message: `null value in column "${k}" violates not-null constraint` };
    if (!(Number(row.cost) > 0) || Number(row.value) < 0) return { code: '23514', message: 'new row violates check constraint' };
    return null;
  }
  const matches = (row, params) => {
    for (const [k, v] of params) {
      if (['select', 'order', 'limit'].includes(k)) continue;
      const m = /^eq\.(.*)$/.exec(v); if (!m) continue;
      if (String(row[k]) !== m[1]) return false;
    }
    return true;
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, origin), path = url.pathname;
    try {
      /* ---- test hooks */
      if (path === '/__link') { // the "email": the magic link the user would receive
        const email = url.searchParams.get('email'); const u = users.get(email);
        if (!u) return json(res, 404, { message: 'no link sent' });
        const t = issue(u); return json(res, 200, { url: `${origin}/app.html#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=3600&expires_at=${t.expires_at}&token_type=bearer&type=magiclink` });
      }
      if (path === '/__expire') { for (const a of access.values()) a.exp = 0; return json(res, 200, {}); }
      if (path === '/__log') return json(res, 200, log);
      if (path === '/__rows') return json(res, 200, table);
      if (path === '/__extras') return json(res, 200, { docs, rems, files: [...files.keys()] });
      if (path === '/__due') { for (const r of rems) if (url.searchParams.get('id') === r.id || !url.searchParams.get('id')) r.due_on = url.searchParams.get('on'); return json(res, 200, {}); }
      if (path === '/assets/config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`export const CONFIG = { supabaseUrl: '${origin}', supabaseAnonKey: 'mock-anon-key' };`); }

      /* ---- auth */
      if (path === '/auth/v1/otp' && req.method === 'POST') {
        const b = await readBody(req); const email = String(b?.email || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(res, 400, { error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
        if (!users.has(email)) users.set(email, { id: randomUUID(), email });
        log.push(['otp', email, url.searchParams.get('redirect_to')]); return json(res, 200, {});
      }
      if (path === '/auth/v1/user') { const u = bearer(req); return u ? json(res, 200, u) : json(res, 401, { msg: 'invalid JWT' }); }
      if (path === '/auth/v1/token' && req.method === 'POST') {
        const b = await readBody(req); const u = refresh.get(b?.refresh_token);
        if (!u) return json(res, 400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        refresh.delete(b.refresh_token); log.push(['refresh', u.email]); return json(res, 200, issue(u));
      }
      if (path === '/auth/v1/logout') { const t = (req.headers.authorization || '').replace(/^Bearer /, ''); access.delete(t); log.push(['logout']); return json(res, 204); }


      /* ---- rest: documents + reminders (same RLS idea) and the private asset-docs bucket */
      const sub = /^\/rest\/v1\/(asset_documents|asset_reminders)$/.exec(path);
      if (sub) {
        const user = bearer(req); if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        const tbl = sub[1] === 'asset_documents' ? docs : rems, mine = tbl.filter(r => r.user_id === user.id), want = /return=representation/.test(req.headers.prefer || '');
        if (req.method === 'GET') return json(res, 200, mine.filter(r => matches(r, url.searchParams)));
        if (req.method === 'POST') {
          const b = await readBody(req);
          if (!table.some(a => a.id === b.asset_id && a.user_id === user.id)) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy' });
          if (tbl === docs && !(b.size >= 0 && b.size <= 10485760 && b.path && b.name)) return json(res, 400, { code: '23514', message: 'check constraint' });
          if (tbl === rems && !(b.title && b.due_on)) return json(res, 400, { code: '23502', message: 'not-null constraint' });
          const row = tbl === rems ? { repeat: 'none', notify_days: 14, done: false, last_notified_on: null, kind: 'other', ...b } : { kind: 'other', ...b };
          Object.assign(row, { id: randomUUID(), user_id: user.id, created_at: new Date().toISOString() }); tbl.push(row);
          return json(res, 201, want ? [row] : undefined);
        }
        if (req.method === 'PATCH') { const b = await readBody(req), rows = mine.filter(r => matches(r, url.searchParams)); rows.forEach(r => Object.assign(r, b)); return json(res, 200, want ? rows : undefined); }
        if (req.method === 'DELETE') { for (const r of mine.filter(r => matches(r, url.searchParams))) tbl.splice(tbl.indexOf(r), 1); return json(res, 204); }
      }
      const st = /^\/storage\/v1\/object\/(sign\/)?asset-docs\/(.+)$/.exec(path);
      if (st) {
        const key = decodeURIComponent(st[2]);
        if (st[1] && req.method === 'GET') { // a signed link carries its own token, like the real service
          if (url.searchParams.get('token') !== 'signed-' + key) return json(res, 401, { message: 'bad token' });
          const f = files.get(key); if (!f) return json(res, 404, { message: 'not found' });
          res.writeHead(200, { 'content-type': f.type }); return res.end(f.data);
        }
        const user = bearer(req); if (!user) return json(res, 401, { message: 'JWT expired' });
        if (key.split('/')[0] !== user.id) return json(res, 403, { message: 'new row violates row-level security policy' });
        if (st[1] && req.method === 'POST') return files.has(key) ? json(res, 200, { signedURL: `/object/sign/asset-docs/${st[2]}?token=signed-${key}` }) : json(res, 404, { message: 'not found' });
        if (req.method === 'POST') { const data = await readRaw(req); if (data.length > 10485760) return json(res, 413, { message: 'too large' }); files.set(key, { data, type: req.headers['content-type'] }); return json(res, 200, { Key: key }); }
        if (req.method === 'DELETE') { files.delete(key); return json(res, 200, {}); }
      }
      /* ---- rest: public.assets with RLS */
      if (path === '/rest/v1/assets') {
        const user = bearer(req);
        if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        const mine = table.filter(r => r.user_id === user.id);
        const wantRows = /return=representation/.test(req.headers.prefer || '');
        if (req.method === 'GET') {
          let rows = mine.filter(r => matches(r, url.searchParams)).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
          const sel = url.searchParams.get('select'); if (sel && sel !== '*') rows = rows.map(r => Object.fromEntries(sel.split(',').map(k => [k, r[k]])));
          return json(res, 200, rows);
        }
        if (req.method === 'POST') {
          const b = await readBody(req); const list = Array.isArray(b) ? b : [b]; const made = [];
          for (const x of list) {
            const e = check(x); if (e) return json(res, 400, e);
            if (x.user_id && x.user_id !== user.id) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "assets"' });
            made.push({ gross: 0, expenses: 0, status: 'Held', acquired_on: null, notes: null, history: [], is_sample: false, ...x, id: randomUUID(), user_id: user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          }
          table.push(...made); return json(res, 201, wantRows ? made : undefined);
        }
        if (req.method === 'PATCH') {
          const b = await readBody(req); const rows = mine.filter(r => matches(r, url.searchParams));
          for (const r of rows) { const e = check({ ...r, ...b }); if (e) return json(res, 400, e); Object.assign(r, b); }
          return json(res, 200, wantRows ? rows : undefined);
        }
        if (req.method === 'DELETE') {
          for (const r of mine.filter(r => matches(r, url.searchParams))) { table.splice(table.indexOf(r), 1); for (const t of [docs, rems]) for (let i = t.length - 1; i >= 0; i--) if (t[i].asset_id === r.id) t.splice(i, 1); }
          return json(res, 204);
        }
      }

      /* ---- static site */
      const p = normalize(decodeURIComponent(path)).split('\\').join('/').replace(/^\/+/, '');
      if (p.includes('..')) return json(res, 400, {});
      const f = join(root, p === '' ? 'index.html' : p);
      const data = await readFile(f);
      res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404).end('Not found'); }
  });
  return new Promise(r => server.listen(port, () => r({ server, origin, close: () => server.close() })));
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('mock-supabase.mjs')) {
  const m = await startMock({ port: Number(process.env.PORT) || 4180, root: process.argv[2] || '.' });
  console.log(`Mock Supabase + site on ${m.origin}/app.html`);
}
