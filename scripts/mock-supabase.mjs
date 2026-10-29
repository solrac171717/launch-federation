// Local stand-in for Supabase (auth + PostgREST `assets` table) so the whole cloud path can be exercised
// without a project: `node scripts/mock-supabase.mjs` serves the site AND the API on one port.
// It mimics what matters: per-user row isolation (RLS), column/constraint errors, token expiry and refresh.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';

const COLS = ['id', 'user_id', 'name', 'type', 'place', 'country', 'lat', 'lon', 'value', 'cost', 'gross', 'expenses', 'debt', 'debt_payment', 'ownership', 'owner', 'status', 'acquired_on', 'notes', 'history', 'is_sample', 'created_at', 'updated_at'];
const TYPES = ['house', 'office', 'warehouse', 'parking', 'land', 'car', 'truck', 'motorcycle', 'rv', 'yacht', 'sailboat', 'jetski', 'aircraft', 'equipment'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

export function startMock({ port = 4180, root = '.' } = {}) {
  const users = new Map();       // email -> { id, email }
  const access = new Map();      // access token -> { user, exp }
  const refresh = new Map();     // refresh token -> user
  const table = [];              // all rows, every user
  const docs = [], rems = [], shares = [], files = new Map(); // other tables + the private file bucket
  const log = [];
  const origin = `http://localhost:${port}`;
  const SERVICE = 'mock-service-key'; // the server-side key used by /api/* (bypasses row security, like the real service role)

  const issue = user => {
    const at = 'at_' + randomUUID(), rt = 'rt_' + randomUUID();
    access.set(at, { user, exp: Date.now() + 3600_000 }); refresh.set(rt, user);
    return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
  };
  const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  const bearer = req => { const t = (req.headers.authorization || '').replace(/^Bearer /, ''); if (t === SERVICE) return { id: '*service*', service: true }; const a = access.get(t); return a && a.exp > Date.now() ? a.user : null; };
  const owns = (r, user) => user.service || r.user_id === user.id;
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
      if (path === '/__user') { // an account created by hand in the Supabase dashboard
        const email = url.searchParams.get('email'), password = url.searchParams.get('password');
        users.set(email, { ...(users.get(email) || { id: randomUUID(), email }), password }); return json(res, 200, {});
      }
      if (path === '/__expire') { for (const a of access.values()) a.exp = 0; return json(res, 200, {}); }
      if (path === '/__log') return json(res, 200, log);
      if (path === '/__rows') return json(res, 200, table);
      if (path === '/__extras') return json(res, 200, { docs, rems, files: [...files.keys()], shares });
      if (path === '/api/extract') { // the real handler, with a stand-in for the model and for the map lookup
        Object.assign(process.env, { SUPABASE_URL: origin, SUPABASE_ANON_KEY: 'mock-anon-key', ANTHROPIC_API_KEY: 'mock-key', ANTHROPIC_BASE_URL: origin, NOMINATIM_URL: `${origin}/__nominatim` });
        const mod = await import('../api/extract.js'); return mod.default(req, res);
      }
      if (path === '/v1/messages' && req.method === 'POST') { // pretend model: reads "a deed"
        const b = await readBody(req); log.push(['model', b.model, b.messages?.[0]?.content?.[0]?.type]);
        return json(res, 200, { id: 'msg_mock', type: 'message', role: 'assistant', model: b.model, stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
          content: [{ type: 'text', text: JSON.stringify({ documentKind: 'purchase_deed', assetType: 'house', name: 'Lakeview Cottage', addressLine: '12 Calle Mayor', city: 'Madrid', region: 'Madrid', postalCode: '28013', countryCode: 'ES', currency: 'USD', purchasePrice: 640000, currentValue: null, outstandingDebt: 250000, monthlyDebtPayment: 1900, monthlyRent: null, acquiredOn: '2020-06-01', ownershipPercent: null, ownerName: 'Ana Test', details: 'Registry 77-A', confidence: 'high' }) }] });
      }
      if (path === '/__nominatim/search') return json(res, 200, [{ lat: '40.4168', lon: '-3.7038', category: 'building', address: { house_number: '12', country_code: 'es' } }]);
      if (path === '/api/login') {
        process.env.SUPABASE_URL = origin; process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE; process.env.SUPABASE_ANON_KEY = 'mock-anon-key'; process.env.ADMIN_PASSWORD = 'e2e-owner-pw';
        const mod = await import('../api/login.js'); return mod.default(req, res);
      }
      if (path.startsWith('/auth/v1/admin/users')) { // Supabase admin API, service key only
        if ((req.headers.authorization || '') !== `Bearer ${SERVICE}`) return json(res, 401, { msg: 'not admin' });
        const id = path.split('/')[5];
        if (req.method === 'GET') return json(res, 200, { users: [...users.values()] });
        const b = await readBody(req);
        if (req.method === 'POST') { if (users.has(b.email)) return json(res, 422, { error_code: 'email_exists', msg: 'exists' }); const u = { id: randomUUID(), email: b.email, password: b.password }; users.set(b.email, u); log.push(['admin-create', b.email]); return json(res, 200, { id: u.id, email: u.email }); }
        if (req.method === 'PUT') { const u = [...users.values()].find(x => x.id === id); if (!u) return json(res, 404, {}); u.password = b.password; log.push(['admin-password', u.email]); return json(res, 200, { id: u.id }); }
      }
      if (path === '/api/share') { // run the real serverless handler against this mock
        process.env.SUPABASE_URL = origin; process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
        const mod = await import('../api/share.js'); return mod.default(req, res);
      }
      if (path === '/__age') { // move every asset's history and creation date back, to test timelines without waiting
        const days = Number(url.searchParams.get('days')) || 30, shift = d => new Date(Date.parse(d) - days * 86400000).toISOString().slice(0, 10);
        for (const r of table) { r.history = (r.history || []).map(p => ({ ...p, d: shift(p.d) })); r.created_at = new Date(Date.parse(r.created_at) - days * 86400000).toISOString(); }
        return json(res, 200, {});
      }
      if (path === '/__due') { for (const r of rems) if (url.searchParams.get('id') === r.id || !url.searchParams.get('id')) r.due_on = url.searchParams.get('on'); return json(res, 200, {}); }
      if (path === '/assets/config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`export const CONFIG = { supabaseUrl: '${origin}', supabaseAnonKey: 'mock-anon-key', extractor: true };`); }

      /* ---- auth */
      if (path === '/auth/v1/otp' && req.method === 'POST') {
        const b = await readBody(req); const email = String(b?.email || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(res, 400, { error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
        if (!users.has(email)) users.set(email, { id: randomUUID(), email });
        log.push(['otp', email, url.searchParams.get('redirect_to')]); return json(res, 200, {});
      }
      if (path === '/auth/v1/user') { const u = bearer(req); return u ? json(res, 200, u) : json(res, 401, { msg: 'invalid JWT' }); }
      if (path === '/auth/v1/token' && req.method === 'POST') {
        const b = await readBody(req);
        if (url.searchParams.get('grant_type') === 'password') { // like the real server: same error for a wrong password and an unknown email
          const u = users.get(String(b?.email || ''));
          if (!u || !u.password || u.password !== b?.password) return json(res, 400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
          log.push(['password', u.email]); return json(res, 200, issue(u));
        }
        const u = refresh.get(b?.refresh_token);
        if (!u) return json(res, 400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        refresh.delete(b.refresh_token); log.push(['refresh', u.email]); return json(res, 200, issue(u));
      }
      if (path === '/auth/v1/logout') { const t = (req.headers.authorization || '').replace(/^Bearer /, ''); access.delete(t); log.push(['logout']); return json(res, 204); }


      /* ---- rest: documents + reminders (same RLS idea) and the private asset-docs bucket */
      const sub = /^\/rest\/v1\/(asset_documents|asset_reminders|asset_shares)$/.exec(path);
      if (sub) {
        const user = bearer(req); if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        const tbl = sub[1] === 'asset_documents' ? docs : sub[1] === 'asset_shares' ? shares : rems, mine = tbl.filter(r => owns(r, user)), want = /return=representation/.test(req.headers.prefer || '');
        if (req.method === 'GET') return json(res, 200, mine.filter(r => matches(r, url.searchParams)));
        if (req.method === 'POST') {
          const b = await readBody(req);
          if (tbl !== shares && !table.some(a => a.id === b.asset_id && a.user_id === user.id)) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy' });
          if (tbl === docs && !(b.size >= 0 && b.size <= 10485760 && b.path && b.name)) return json(res, 400, { code: '23514', message: 'check constraint' });
          if (tbl === rems && !(b.title && b.due_on)) return json(res, 400, { code: '23502', message: 'not-null constraint' });
          if (tbl === shares && !(b.label && b.token_hash && b.token_hash.length === 64)) return json(res, 400, { code: '23514', message: 'check constraint' });
          const row = tbl === rems ? { repeat: 'none', notify_days: 14, done: false, last_notified_on: null, kind: 'other', ...b } : tbl === shares ? { include_debt: true, expires_at: null, revoked: false, last_viewed_at: null, ...b } : { kind: 'other', ...b };
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
        const mine = table.filter(r => owns(r, user));
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
