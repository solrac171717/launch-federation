// Local stand-in for Supabase (auth + PostgREST `assets` table) so the whole cloud path can be exercised
// without a project: `node scripts/mock-supabase.mjs` serves the site AND the API on one port.
// It mimics what matters: per-user row isolation (RLS), column/constraint errors, token expiry and refresh.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { signPayload } from '../api/_stripe.js';

const COLS = ['id', 'user_id', 'name', 'type', 'place', 'country', 'lat', 'lon', 'value', 'cost', 'gross', 'expenses', 'debt', 'debt_payment', 'ownership', 'owner', 'currency', 'debt_rate', 'annual_change', 'status', 'acquired_on', 'notes', 'history', 'is_sample', 'created_at', 'updated_at'];
const TYPES = ['house', 'office', 'warehouse', 'parking', 'land', 'car', 'truck', 'motorcycle', 'rv', 'yacht', 'sailboat', 'jetski', 'aircraft', 'equipment'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

/** A stand-in for the model: it answers by the name of the JSON schema the request asked for. */
function leadModel(req) {
  const name = req.response_format?.json_schema?.name, user = String(req.messages?.[1]?.content || '');
  let out;
  if (name === 'business_profile') out = { name: 'Acme Invoices', niche: 'Invoicing software for small teams', audience: 'Teams of 2 to 20 people', problem: 'Late payments and month-end chaos', tone: 'friendly and direct', competitors: ['QuickBooks'], queries: ['alternative to quickbooks', 'simple invoicing tool', 'recommend invoicing software', 'chase late invoices', 'invoicing for small teams', 'cheap bookkeeping tool'] };
  else if (name === 'lead_scores') {
    const authors = user.split('\n\n').map(b => b.split('\n')[0]);
    out = { items: authors.map((line, i) => { const sure = /invoic|quickbooks|bookkeep/i.test(user.split('\n\n')[i] || ''); return { id: String(i + 1), score: sure ? 90 - i * 4 : 12, intent: sure ? 'alternative' : 'problem', role: sure ? 'Founder' : '', company: '', place: i % 2 ? 'Austin, TX' : 'London, England', country: i % 2 ? 'US' : 'GB', draft: sure ? 'Happy to help with that.' : '' }; }) };
  } else if (name === 'outreach_sequence') out = { invite: 'Hi, saw your post about invoicing. Would be glad to connect.', follow1: 'Thanks for connecting. We make invoicing simpler for small teams. Is month-end still painful?', follow2: 'One more idea: automatic reminders cut late payments. Happy to show it, no pressure.' };
  else out = {};
  return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(out) } }] };
}

import { matchRow, shape } from './rest-filter.mjs';

export function startMock({ port = 4180, root = '.' } = {}) {
  const users = new Map();       // email -> { id, email }
  const access = new Map();      // access token -> { user, exp }
  const refresh = new Map();     // refresh token -> user
  const table = [];              // all rows, every user
  const members = [];            // account_members: who may open whose account
  const heirs = [];              // emergency_access: one trusted person per user
  // billing: our subscriptions table, the on/off switch for limits, and a pretend Stripe (everything it knows lives in these maps)
  const subs = [], claims = []; let enforce = false, buyer = 'buyer@example.com';
  const stripe = { customers: new Map(), products: [], prices: [], sessions: new Map(), subs: new Map(), n: 0 };
  const sid = p => `${p}_${++stripe.n}`;
  const parseForm = text => { // a=1&b[0][c]=2 -> { a: '1', b: [{ c: '2' }] }
    const root = {};
    for (const [k, v] of new URLSearchParams(text)) {
      const path = k.replace(/\]/g, '').split('['); let o = root;
      path.forEach((p, i) => { if (i === path.length - 1) o[p] = v; else o = (o[p] ??= {}); });
    }
    const arr = o => (o && typeof o === 'object' ? (Object.keys(o).length && Object.keys(o).every(x => /^\d+$/.test(x)) ? Object.keys(o).sort((a, b) => a - b).map(x => arr(o[x])) : Object.fromEntries(Object.entries(o).map(([x, y]) => [x, arr(y)]))) : o);
    return arr(root);
  };
  const priceById = id => stripe.prices.find(p => p.id === id);
  const itemsOf = s => ({ data: s.items.map(i => ({ ...i, price: { id: i.price.id, lookup_key: i.price.lookup_key } })) });
  const subJson = s => ({ id: s.id, customer: s.customer, status: s.status, metadata: s.metadata, trial_end: s.trial_end, cancel_at_period_end: s.cancel_at_period_end, items: itemsOf(s) });
  const hook = async (origin2, type, obj, secret = 'whsec_mock') => { // what Stripe would send us
    const raw = JSON.stringify({ id: sid('evt'), type, created: Math.floor(Date.now() / 1000), data: { object: obj } });
    return fetch(`${origin2}/api/stripe-webhook`, { method: 'POST', headers: { 'stripe-signature': signPayload(raw, secret), 'content-type': 'application/json' }, body: raw });
  };
  const setBillingEnv = () => Object.assign(process.env, { SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: SERVICE, SUPABASE_ANON_KEY: 'mock-anon-key', STRIPE_SECRET_KEY: 'sk_test_mock', STRIPE_API_BASE: `${origin}/__stripe`, STRIPE_WEBHOOK_SECRET: 'whsec_mock', SITE_URL: origin });
  const leadTables = { leads: [], business_profiles: [], linkedin_accounts: [], outreach: [] };
  const li = { n: 0, friends: [], inbox: [], log: [] }; // the fake LinkedIn provider: who accepted, what people replied, what was sent // the leads app: one table each, rows isolated per user like the real policies
  const docs = [], rems = [], shares = [], settingsRows = [], files = new Map(); // other tables + the private file bucket
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
  // the same two questions as public.can_read / public.can_edit in the household migration
  const canRead = (ownerId, user) => user.service || ownerId === user.id || members.some(m => m.owner_id === ownerId && m.member_id === user.id && m.status === 'active');
  const canEdit = (ownerId, user) => user.service || ownerId === user.id || members.some(m => m.owner_id === ownerId && m.member_id === user.id && m.status === 'active' && m.role === 'edit');
  const owns = (r, user) => canRead(r.user_id, user);
  const ownsEdit = (r, user) => canEdit(r.user_id, user);
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
  const matches = matchRow;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, origin), path = url.pathname;
    try {
      /* ---- test hooks */
      if (path === '/__link') { // the "email": the magic link the user would receive
        const email = url.searchParams.get('email'); const u = users.get(email);
        if (!u) return json(res, 404, { message: 'no link sent' });
        const t = issue(u); return json(res, 200, { url: `${origin}/app.html#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=3600&expires_at=${t.expires_at}&token_type=bearer&type=${url.searchParams.get('type') || 'magiclink'}` });
      }
      if (path === '/__user') { // an account created by hand in the Supabase dashboard
        const email = url.searchParams.get('email'), password = url.searchParams.get('password');
        users.set(email, { ...(users.get(email) || { id: randomUUID(), email }), password }); return json(res, 200, {});
      }
      if (path === '/__expire') { for (const a of access.values()) a.exp = 0; return json(res, 200, {}); }
      if (path === '/__log') return json(res, 200, log);
      if (path === '/__rows') return json(res, 200, table);
      if (path === '/__extras') return json(res, 200, { docs, rems, files: [...files.keys()], shares });
      if (path === '/__members') return json(res, 200, members);
      if (path === '/__heirs') return json(res, 200, heirs);
      if (path === '/__subs') return json(res, 200, subs);
      if (path === '/__untrial') { const u = users.get(url.searchParams.get('email')); const i = subs.findIndex(r => r.user_id === u?.id); if (i >= 0) subs.splice(i, 1); return json(res, 200, {}); }
      if (path === '/__trial') { // put this account on a free trial without going through checkout (a shortcut for screens that only need the state)
        const u = users.get(url.searchParams.get('email')); if (!u) return json(res, 404, {});
        const end = new Date(Date.now() + 5 * 86400000).toISOString(); subs.push({ user_id: u.id, status: 'trialing', assets_allowed: Number(url.searchParams.get('assets')) || 3, trial_end: end, current_period_end: end, cancel_at_period_end: false, stripe_customer_id: `cus_mock_${u.id.slice(0, 6)}`, stripe_subscription_id: `sub_mock_${u.id.slice(0, 6)}`, last_event_at: 0, updated_at: new Date().toISOString() });
        return json(res, 200, {});
      }
      if (path === '/__claims') return json(res, 200, claims);
      if (path === '/__buyer') { buyer = url.searchParams.get('email') || buyer; return json(res, 200, { buyer }); }
      if (path === '/api/start') { setBillingEnv(); const mod = await import('../api/start.js'); return mod.default(req, res); }
      if (path === '/api/welcome') { setBillingEnv(); const mod = await import('../api/welcome.js'); return mod.default(req, res); }
      if (path === '/rest/v1/rpc/user_id_by_email') { // service only, like the real function
        const user = bearer(req); if (!user?.service) return json(res, 403, { code: '42501', message: 'permission denied for function user_id_by_email' });
        const b = await readBody(req); return json(res, 200, users.get(String(b?.mail || '').toLowerCase())?.id || null);
      }
      if (path === '/rest/v1/checkout_claims') { // service only
        const user = bearer(req); if (!user?.service) return json(res, 403, { code: '42501', message: 'permission denied for table checkout_claims' });
        const want = /return=representation/.test(req.headers.prefer || '');
        if (req.method === 'GET') return json(res, 200, claims.filter(r => matches(r, url.searchParams)));
        if (req.method === 'POST') { const b = await readBody(req); if (!claims.some(r => r.session_id === b.session_id)) claims.push({ claimed_at: null, created_at: new Date().toISOString(), ...b }); return json(res, 201); }
        if (req.method === 'PATCH') { const b = await readBody(req); const rows = claims.filter(r => matches(r, url.searchParams)); rows.forEach(r => Object.assign(r, b)); return json(res, 200, want ? rows : undefined); }
      }
      if (path === '/__enforce') { enforce = url.searchParams.get('on') === '1'; return json(res, 200, { enforce }); }
      if (path === '/api/billing') { setBillingEnv(); const mod = await import('../api/billing.js'); return mod.default(req, res); }
      if (path === '/api/stripe-webhook') { setBillingEnv(); const mod = await import('../api/stripe-webhook.js'); return mod.default(req, res); }
      if (path === '/__stripe_pay') { // the customer pays (or starts the trial) on the page Stripe would host, then comes back
        const s = stripe.sessions.get(url.searchParams.get('session')); if (!s) return json(res, 404, {});
        s.customer ||= sid('cus'); s.paid = true; s.paidBy = (url.searchParams.get('email') || buyer).toLowerCase(); s.mode ||= 'subscription';
        const trial = Number(s.subscription_data?.trial_period_days) || 0, sub = { id: sid('sub'), customer: s.customer, status: trial ? 'trialing' : 'active', metadata: s.subscription_data?.metadata || {}, trial_end: trial ? Math.floor(Date.now() / 1000) + trial * 86400 : null, cancel_at_period_end: false,
          items: (s.line_items || []).map(l => ({ id: sid('si'), quantity: Number(l.quantity), price: priceById(l.price), current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 })) };
        stripe.subs.set(sub.id, sub); s.subscription = sub.id;
        await hook(origin, 'checkout.session.completed', { id: s.id, mode: 'subscription', subscription: sub.id, client_reference_id: s.client_reference_id, customer: s.customer, customer_details: { email: s.paidBy } });
        await hook(origin, 'customer.subscription.created', subJson(sub));
        res.writeHead(302, { location: String(s.success_url).replace('{CHECKOUT_SESSION_ID}', s.id) }); return res.end();
      }
      if (path === '/__stripe_cancel') { // the subscription of this email ends (a cancellation, or a trial that ran out)
        const u = users.get(url.searchParams.get('email')); const sub = [...stripe.subs.values()].find(x => x.metadata?.user_id === u?.id); if (!sub) return json(res, 404, {});
        sub.status = 'canceled'; await hook(origin, 'customer.subscription.deleted', subJson(sub)); return json(res, 200, {});
      }
      if (path === '/__stripe_portal') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h1>Stripe customer portal (mock)</h1>'); }
      if (path.startsWith('/__stripe/v1/')) { // a small pretend Stripe API
        const sp = path.slice('/__stripe/v1/'.length), b = req.method === 'GET' ? Object.fromEntries([...url.searchParams]) : parseForm((await readRaw(req)).toString());
        if (req.headers.authorization !== 'Bearer sk_test_mock') return json(res, 401, { error: { message: 'Invalid API Key provided' } });
        if (sp === 'customers' && req.method === 'POST') { const c = { id: sid('cus'), email: b.email, metadata: b.metadata }; stripe.customers.set(c.id, c); return json(res, 200, c); }
        if (sp === 'products' && req.method === 'GET') return json(res, 200, { data: stripe.products });
        if (sp === 'products') { const p = { id: sid('prod'), ...b }; stripe.products.push(p); return json(res, 200, p); }
        if (sp === 'prices' && req.method === 'GET') { const want = url.searchParams.getAll('lookup_keys[0]').concat(url.searchParams.getAll('lookup_keys[1]')); return json(res, 200, { data: stripe.prices.filter(p => p.active && want.includes(p.lookup_key)) }); }
        if (sp === 'prices') { for (const p of stripe.prices) if (p.lookup_key === b.lookup_key) { p.active = false; p.lookup_key = null; } const p = { id: sid('price'), active: true, lookup_key: b.lookup_key, unit_amount: Number(b.unit_amount), recurring: b.recurring, product: b.product }; stripe.prices.push(p); return json(res, 200, p); }
        if (sp === 'checkout/sessions' && req.method === 'GET') return json(res, 404, {});
        const getSession = /^checkout\/sessions\/(.+)$/.exec(sp);
        if (getSession) { const s = stripe.sessions.get(getSession[1]); return s ? json(res, 200, { id: s.id, status: s.paid ? 'complete' : 'open', mode: s.mode, subscription: s.subscription || null, customer: s.customer || null, client_reference_id: s.client_reference_id || null, customer_details: s.paid ? { email: s.paidBy } : null, created: Math.floor(s.createdAt / 1000) }) : json(res, 404, { error: { message: 'No such checkout.session' } }); }
        if (sp === 'checkout/sessions') { const s = { id: 'cs_test_' + randomUUID().replace(/-/g, '').slice(0, 24), createdAt: Date.now(), ...b }; stripe.sessions.set(s.id, s); log.push(['stripe-checkout', JSON.stringify({ items: (b.line_items || []).map(l => [priceById(l.price)?.lookup_key, l.quantity]), trial: b.subscription_data?.trial_period_days || null })]); return json(res, 200, { id: s.id, url: `${origin}/__stripe_pay?session=${s.id}` }); }
        if (sp === 'billing_portal/sessions') return json(res, 200, { url: `${origin}/__stripe_portal` });
        const m = /^subscriptions\/(.+)$/.exec(sp);
        if (m) {
          const sub = stripe.subs.get(m[1]); if (!sub) return json(res, 404, { error: { message: 'No such subscription' } });
          if (req.method === 'POST') for (const it of b.items || []) {
            if (it.id && it.deleted) sub.items = sub.items.filter(x => x.id !== it.id);
            else if (it.id) sub.items.find(x => x.id === it.id).quantity = Number(it.quantity);
            else sub.items.push({ id: sid('si'), quantity: Number(it.quantity), price: priceById(it.price), current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 });
          }
          return json(res, 200, subJson(sub));
        }
        return json(res, 404, { error: { message: 'unknown mock route ' + sp } });
      }
      if (path === '/__heir_age') { const d = Number(url.searchParams.get('days')) || 0; for (const r of heirs) r.last_seen_at = new Date(Date.parse(r.last_seen_at) - d * 86400000).toISOString(); return json(res, 200, {}); }
      if (path === '/v1/chat/completions' && req.method === 'POST') { // pretend model: reads "a deed", or answers the leads app by the name of its JSON schema
        const b = await readBody(req);
        if (['business_profile', 'lead_scores', 'outreach_sequence'].includes(b.response_format?.json_schema?.name)) return json(res, 200, leadModel(b)); log.push(['model', b.model, b.messages?.[1]?.content?.[0]?.type]);
        return json(res, 200, { id: 'chatcmpl_mock', object: 'chat.completion', model: b.model, usage: { prompt_tokens: 10, completion_tokens: 10 },
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ documentKind: 'purchase_deed', assetType: 'house', name: 'Lakeview Cottage', addressLine: '12 Calle Mayor', city: 'Madrid', region: 'Madrid', postalCode: '28013', countryCode: 'ES', currency: 'USD', purchasePrice: 640000, currentValue: null, outstandingDebt: 250000, monthlyDebtPayment: 1900, monthlyRent: null, acquiredOn: '2020-06-01', ownershipPercent: null, ownerName: 'Ana Test', details: 'Registry 77-A', confidence: 'high' }) } }] });
      }
      if (path === '/__nominatim/search') return json(res, 200, [{ lat: '40.4168', lon: '-3.7038', category: 'building', address: { house_number: '12', country_code: 'es' } }]);
      if (path.startsWith('/__nhtsa/api/vehicles/DecodeVinValues/')) return json(res, 200, { Results: [{ Make: 'HONDA', Model: 'Accord', ModelYear: '2003', Trim: 'EX-V6', VehicleType: 'PASSENGER CAR', BodyClass: 'Coupe', ErrorCode: '0', PlantCountry: 'UNITED STATES (USA)' }] });
      if (path === '/__settings') return json(res, 200, settingsRows);
      if (path === '/api/login') {
        process.env.SUPABASE_URL = origin; process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE; process.env.SUPABASE_ANON_KEY = 'mock-anon-key'; process.env.ADMIN_PASSWORD = 'e2e-owner-pw';
        const mod = await import('../api/login.js'); return mod.default(req, res);
      }
      if (path.startsWith('/auth/v1/admin/users')) { // Supabase admin API, service key only
        if ((req.headers.authorization || '') !== `Bearer ${SERVICE}`) return json(res, 401, { msg: 'not admin' });
        const id = path.split('/')[5];
        if (req.method === 'GET' && id) { const u = [...users.values()].find(x => x.id === id); return u ? json(res, 200, { id: u.id, email: u.email }) : json(res, 404, {}); }
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
      if (path === '/assets/config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`export const CONFIG = { supabaseUrl: '${origin}', supabaseAnonKey: 'mock-anon-key', extractor: true, billing: true };`); }

      /* ---- auth */
      if (path === '/auth/v1/otp' && req.method === 'POST') {
        const b = await readBody(req); const email = String(b?.email || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(res, 400, { error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
        if (!users.has(email)) users.set(email, { id: randomUUID(), email });
        log.push(['otp', email, url.searchParams.get('redirect_to')]); return json(res, 200, {});
      }
      if (path === '/auth/v1/user' && req.method === 'PUT') { const u = bearer(req); if (!u) return json(res, 401, { msg: 'invalid JWT' }); const b = await readBody(req); const mine = [...users.values()].find(x => x.id === u.id); if (!mine || !b?.password || String(b.password).length < 6) return json(res, 422, { error_code: 'weak_password', msg: 'Password should be at least 6 characters.' }); mine.password = b.password; log.push(['password-updated', mine.email]); return json(res, 200, { id: mine.id, email: mine.email }); }
      if (path === '/auth/v1/recover' && req.method === 'POST') { const b = await readBody(req); log.push(['recover', String(b?.email || ''), url.searchParams.get('redirect_to')]); return json(res, 200, {}); } // same answer whether or not the email has an account
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
      if (path === '/rest/v1/user_settings') { // one JSON document per user, upserted
        const user = bearer(req); if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        if (req.method === 'GET') return json(res, 200, (user.service ? settingsRows.filter(r => matches(r, url.searchParams)) : settingsRows.filter(r => r.user_id === user.id)).map(r => ({ data: r.data })));
        if (req.method === 'POST') { const b = await readBody(req); const cur = settingsRows.find(r => r.user_id === user.id); if (cur) cur.data = b.data; else settingsRows.push({ user_id: user.id, data: b.data }); return json(res, 201); }
      }
      if (path === '/rest/v1/subscriptions') { // users read their own row; only the server (service key) writes
        const user = bearer(req); if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        if (req.method === 'GET') return json(res, 200, subs.filter(r => (user.service || r.user_id === user.id) && matches(r, url.searchParams)));
        if (!user.service) return json(res, 403, { code: '42501', message: 'permission denied for table subscriptions' });
        if (req.method === 'POST') { const b = await readBody(req); const cur = subs.find(r => r.user_id === b.user_id); if (cur) Object.assign(cur, b); else subs.push({ assets_allowed: 0, status: 'none', trial_end: null, current_period_end: null, cancel_at_period_end: false, last_event_at: 0, ...b }); return json(res, 201); }
      }
      if (path === '/rest/v1/account_members') { // owner: everything about their invitations; member: see and leave
        const user = bearer(req); if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        const visible = members.filter(m => user.service || m.owner_id === user.id || m.member_id === user.id), want = /return=representation/.test(req.headers.prefer || '');
        if (req.method === 'GET') return json(res, 200, visible.filter(r => matches(r, url.searchParams)));
        if (req.method === 'POST') {
          const b = await readBody(req); const email = String(b.email || '').trim().toLowerCase();
          if (!email || email === String(user.email).toLowerCase()) return json(res, 400, { code: 'P0001', message: 'You cannot invite yourself' });
          if (!['view', 'edit'].includes(b.role || 'view')) return json(res, 400, { code: '23514', message: 'check constraint' });
          if (b.invite_hash && String(b.invite_hash).length !== 64) return json(res, 400, { code: '23514', message: 'check constraint' });
          if (members.some(m => m.owner_id === user.id && m.email === email)) return json(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' });
          const row = { role: 'view', invite_hash: null, invite_expires_at: null, ...Object.fromEntries(['role', 'invite_hash', 'invite_expires_at'].filter(k => b[k] !== undefined).map(k => [k, b[k]])), id: randomUUID(), owner_id: user.id, owner_email: String(user.email).toLowerCase(), email, status: 'invited', member_id: null, created_at: new Date().toISOString() };
          members.push(row); return json(res, 201, want ? [row] : undefined);
        }
        if (req.method === 'PATCH') {
          const b = await readBody(req) || {};
          if (!user.service && Object.keys(b).some(k => k !== 'role')) return json(res, 403, { code: '42501', message: 'permission denied for table account_members' });
          const rows = members.filter(m => (user.service || m.owner_id === user.id) && matches(m, url.searchParams)); rows.forEach(r => Object.assign(r, b)); return json(res, 200, want ? rows : undefined);
        }
        if (req.method === 'DELETE') { for (const m of visible.filter(r => matches(r, url.searchParams))) members.splice(members.indexOf(m), 1); return json(res, 204); }
      }
      if (path === '/rest/v1/emergency_access') { // one row per user, owner only (the server reads it with the service key)
        const user = bearer(req); if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        const mineH = heirs.filter(r => user.service || r.user_id === user.id), want = /return=representation/.test(req.headers.prefer || '');
        if (req.method === 'GET') return json(res, 200, mineH.filter(r => matches(r, url.searchParams)));
        if (req.method === 'POST') {
          const b = await readBody(req) || {};
          if (heirs.some(r => r.user_id === user.id)) return json(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' });
          if (!b.contact_name || String(b.contact_name).length > 80 || !b.token_hash || String(b.token_hash).length !== 64 || ![30, 60, 90, 180, 365].includes(b.inactive_days ?? 90)) return json(res, 400, { code: '23514', message: 'check constraint' });
          const row = { contact_email: null, inactive_days: 90, enabled: true, warned_at: null, released_at: null, notified_at: null, opened_at: null, opened_count: 0, ...b, user_id: user.id, last_seen_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          heirs.push(row); return json(res, 201, want ? [row] : undefined);
        }
        if (req.method === 'PATCH') { const b = await readBody(req); const rows = mineH.filter(r => matches(r, url.searchParams)); rows.forEach(r => Object.assign(r, b)); return json(res, 200, want ? rows : undefined); }
        if (req.method === 'DELETE') { for (const r of mineH.filter(r => matches(r, url.searchParams))) heirs.splice(heirs.indexOf(r), 1); return json(res, 204); }
      }
      const sub = /^\/rest\/v1\/(asset_documents|asset_reminders|asset_shares)$/.exec(path);
      if (sub) {
        const user = bearer(req); if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        const tbl = sub[1] === 'asset_documents' ? docs : sub[1] === 'asset_shares' ? shares : rems, own = tbl === shares ? (r, u) => u.service || r.user_id === u.id : owns, ownE = tbl === shares ? own : ownsEdit;
        const mine = tbl.filter(r => own(r, user)), mineE = tbl.filter(r => ownE(r, user)), want = /return=representation/.test(req.headers.prefer || '');
        if (req.method === 'GET') return json(res, 200, mine.filter(r => matches(r, url.searchParams)));
        if (req.method === 'POST') {
          const b = await readBody(req);
          const asset = table.find(a => a.id === b.asset_id);
          if (tbl !== shares && !(asset && canEdit(asset.user_id, user) && (!b.user_id || b.user_id === asset.user_id))) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy' });
          if (tbl === docs && !(b.size >= 0 && b.size <= 10485760 && b.path && b.name)) return json(res, 400, { code: '23514', message: 'check constraint' });
          if (tbl === rems && !(b.title && b.due_on)) return json(res, 400, { code: '23502', message: 'not-null constraint' });
          if (tbl === shares && !(b.label && b.token_hash && b.token_hash.length === 64)) return json(res, 400, { code: '23514', message: 'check constraint' });
          const row = tbl === rems ? { repeat: 'none', notify_days: 14, done: false, last_notified_on: null, kind: 'other', ...b } : tbl === shares ? { include_debt: true, expires_at: null, revoked: false, last_viewed_at: null, ...b } : { kind: 'other', ...b };
          Object.assign(row, { id: randomUUID(), user_id: tbl === shares ? user.id : asset.user_id, created_at: new Date().toISOString() }); tbl.push(row);
          return json(res, 201, want ? [row] : undefined);
        }
        if (req.method === 'PATCH') { const b = await readBody(req), rows = mineE.filter(r => matches(r, url.searchParams)); rows.forEach(r => Object.assign(r, b)); return json(res, 200, want ? rows : undefined); }
        if (req.method === 'DELETE') { for (const r of mineE.filter(r => matches(r, url.searchParams))) tbl.splice(tbl.indexOf(r), 1); return json(res, 204); }
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
        const folderOwner = key.split('/')[0], reading = (st[1] && req.method === 'POST');
        if (!(reading ? canRead(folderOwner, user) : canEdit(folderOwner, user))) return json(res, 403, { message: 'new row violates row-level security policy' });
        if (st[1] && req.method === 'POST') return files.has(key) ? json(res, 200, { signedURL: `/object/sign/asset-docs/${st[2]}?token=signed-${key}` }) : json(res, 404, { message: 'not found' });
        if (req.method === 'POST') { const data = await readRaw(req); if (data.length > 10485760) return json(res, 413, { message: 'too large' }); files.set(key, { data, type: req.headers['content-type'] }); return json(res, 200, { Key: key }); }
        if (req.method === 'DELETE') { files.delete(key); return json(res, 200, {}); }
      }
      /* ---- rest: leads, the business profile and the extension tokens (RLS: your own rows only) */
      if (path === '/api/analyze' || path === '/api/signals' || path === '/api/linkedin' || path === '/api/tick') {
        Object.assign(process.env, { SUPABASE_URL: origin, SUPABASE_ANON_KEY: 'mock-anon-key', SUPABASE_SERVICE_ROLE_KEY: SERVICE, OPENAI_API_KEY: 'mock-openai', OPENAI_BASE_URL: origin, UNIPILE_BASE_URL: origin, UNIPILE_DSN: 'mock', UNIPILE_API_KEY: 'mock-unipile', CRON_SECRET: 'mock-cron-secret-value', SITE_URL: origin, NOMINATIM_URL: `${origin}/__nominatim`, ALLOW_TEST_NOW: '1' });
        const mod = await import(`..${path}.js`); return mod.default(req, res);
      }
      if (path === '/__unipile_login') { // the page where the person would log in to LinkedIn: here it just "succeeds", tells the notify address and goes back to the app
        const acc = 'MOCKACC-' + (++li.n); li.accounts = [...(li.accounts || []), acc];
        await fetch(url.searchParams.get('notify'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'CREATION_SUCCESS', account_id: acc, name: url.searchParams.get('name') }) }).catch(() => {});
        res.writeHead(302, { location: url.searchParams.get('ok') }); return res.end();
      }
      if (path === '/__unipile') { // test hooks: ?friends=P1,P2 (accepted invitations)  &inbox=P1 (people who replied)  &reset=1
        if (url.searchParams.get('reset')) { li.friends = []; li.inbox = []; li.log = []; }
        if (url.searchParams.has('friends')) li.friends = url.searchParams.get('friends').split(',').filter(Boolean);
        if (url.searchParams.has('inbox')) li.inbox = url.searchParams.get('inbox').split(',').filter(Boolean);
        return json(res, 200, li);
      }
      if (path.startsWith('/api/v1/')) { // Unipile, as far as this app uses it
        const sp = path.slice('/api/v1/'.length), body = req.method === 'GET' || req.method === 'DELETE' ? {} : await (async () => { try { const raw = await readRaw(req); const t = raw.toString(); return t.startsWith('{') ? JSON.parse(t) : { form: t }; } catch { return {}; } })();
        if (req.headers['x-api-key'] !== 'mock-unipile') return json(res, 401, { title: 'Unauthorized' });
        if (sp === 'hosted/accounts/link') return json(res, 201, { url: `${origin}/__unipile_login?name=${encodeURIComponent(body.name)}&notify=${encodeURIComponent(body.notify_url)}&ok=${encodeURIComponent(body.success_redirect_url)}` });
        if (sp.startsWith('accounts/')) return req.method === 'DELETE' ? json(res, 200, {}) : (li.accounts || []).includes(sp.slice(9)) ? json(res, 200, { name: 'Mock Seller', sources: [{ status: 'OK' }] }) : json(res, 404, {});
        if (sp === 'linkedin/search') return json(res, 200, { items: [
          { id: 'urn:li:activity:1001', text: 'Does anyone know a simple invoicing tool for a team of six? QuickBooks is too heavy for us.', author: { id: 'MEMBER-1', name: 'Dana Whitfield', headline: 'Founder at Brightloop', public_identifier: 'dana-whitfield' }, share_url: 'https://www.linkedin.com/feed/update/urn:li:activity:1001/' },
          { id: 'urn:li:activity:1002', text: 'Beautiful weather in the mountains this weekend, hiking with the family.', author: { id: 'MEMBER-2', name: 'Sam Doe', headline: 'Teacher', public_identifier: 'sam-doe' }, share_url: 'https://www.linkedin.com/feed/update/urn:li:activity:1002/' }] });
        if (sp.endsWith('/posts') && sp.startsWith('users/')) return json(res, 200, { items: [{ id: 'urn:li:activity:900', text: 'Why invoicing software should be simpler', share_url: 'https://www.linkedin.com/feed/update/urn:li:activity:900/' }] });
        if (sp.endsWith('/comments')) return json(res, 200, { items: [{ id: 'cm1', text: 'We are looking at alternatives to QuickBooks for invoicing, this is our month-end pain.', author: { id: 'MEMBER-3', name: 'Priya Nair', headline: 'COO at Fieldstone', public_identifier: 'priya-nair' } }] });
        if (sp.endsWith('/reactions')) return json(res, 200, { items: [] });
        if (sp === 'users/relations') return json(res, 200, { items: li.friends.map(member_id => ({ member_id })) });
        if (sp === 'messages') return json(res, 200, { items: li.inbox.map(sender_id => ({ sender_id, text: 'Sure, tell me more', is_sender: 0, timestamp: new Date().toISOString() })) });
        if (sp === 'users/invite') { li.log.push(['invite', body.provider_id, body.message]); return json(res, 201, {}); }
        if (sp === 'chats') { li.log.push(['message', /attendees_ids"\r?\n\r?\n([^\r\n]+)/.exec(body.form || '')?.[1] || '', body.form || '']); return json(res, 201, {}); }
        if (sp.startsWith('users/')) { const id = sp.slice(6), n = { 'dana-whitfield': 'MEMBER-1', 'priya-nair': 'MEMBER-3', 'sam-doe': 'MEMBER-2' }[id] || 'MEMBER-X'; return json(res, 200, { provider_id: n, first_name: id.split('-')[0], last_name: id.split('-')[1] || '', headline: 'Founder', location: 'Austin, Texas, United States', network_distance: 'DISTANCE_2' }); }
        return json(res, 404, {});
      }
      if (leadTables[path.split('/').pop()] && path.startsWith('/rest/v1/')) {
        const user = bearer(req); if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        const name = path.split('/').pop(), T = leadTables[name], prefer = req.headers.prefer || '';
        const mineOf = () => T.filter(r => (user.service || r.user_id === user.id) && matches(r, url.searchParams));
        if (name === 'linkedin_accounts' && !user.service && !['GET', 'DELETE'].includes(req.method)) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "linkedin_accounts"' });
        if (req.method === 'GET') return json(res, 200, shape(mineOf(), url.searchParams));
        if (req.method === 'POST') {
          const b = await readBody(req), list = Array.isArray(b) ? b : [b], made = [];
          for (const x of list) {
            const owner = x.user_id || user.id; if (!user.service && owner !== user.id) return json(res, 403, { code: '42501', message: `new row violates row-level security policy for table "${name}"` });
            if (name === 'leads') {
              if (!['hn', 'linkedin'].includes(x.source) || !(x.score >= 0 && x.score <= 100) || !x.signal_text) return json(res, 400, { code: '23514', message: 'new row violates check constraint' });
              if (T.some(r => r.user_id === owner && r.source === x.source && r.external_id === x.external_id)) { if (/ignore-duplicates/.test(prefer)) continue; return json(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' }); }
            }
            if (name === 'outreach' && T.some(r => r.lead_id === x.lead_id && r.step === x.step)) { if (/ignore-duplicates/.test(prefer)) continue; return json(res, 409, { code: '23505', message: 'duplicate key' }); }
            if (name === 'business_profiles') { const cur = T.find(r => r.user_id === owner); if (cur) { if (!/merge-duplicates/.test(prefer)) return json(res, 409, { code: '23505', message: 'duplicate key' }); Object.assign(cur, x); made.push(cur); continue; } }
            const row = { id: randomUUID(), history: [], is_sample: false, status: name === 'outreach' ? 'draft' : name === 'linkedin_accounts' ? 'connected' : 'new', revoked: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...x, user_id: owner }; T.push(row); made.push(row);
          }
          return json(res, 201, /return=representation/.test(prefer) ? made : undefined);
        }
        if (req.method === 'PATCH') { const b = await readBody(req), rows = mineOf(); rows.forEach(r => Object.assign(r, b)); return json(res, 200, /return=representation/.test(prefer) ? rows : undefined); }
        if (req.method === 'DELETE') { for (const r of mineOf()) T.splice(T.indexOf(r), 1); return json(res, 204); }
      }
      if (path === '/__leads') return json(res, 200, leadTables);
      /* ---- rest: public.assets with RLS */
      if (path === '/rest/v1/assets') {
        const user = bearer(req);
        if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        const mine = table.filter(r => owns(r, user)), mineE = table.filter(r => ownsEdit(r, user));
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
            const target = x.user_id || user.id;
            if (!canEdit(target, user)) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "assets"' });
            made.push({ gross: 0, expenses: 0, status: 'Held', acquired_on: null, notes: null, history: [], is_sample: false, ...x, id: randomUUID(), user_id: target, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          }
          table.push(...made);
          if (enforce) for (const owner of new Set(made.filter(m => !m.is_sample).map(m => m.user_id))) { // the database trigger: every owner must stay within their plan
            const mail = [...users.values()].find(u => u.id === owner)?.email, s = subs.find(r => r.user_id === owner);
            const ok = mail === 'carlosmartinezhold@gmail.com' || (s && (s.status === 'comped' || (['trialing', 'active', 'past_due'].includes(s.status) && table.filter(a => a.user_id === owner && !a.is_sample).length <= s.assets_allowed)));
            if (!ok) { for (const m of made) table.splice(table.indexOf(m), 1); return json(res, 400, { code: 'P0001', message: 'plan_limit', hint: 'Your plan does not include more assets.' }); }
          }
          return json(res, 201, wantRows ? made : undefined);
        }
        if (req.method === 'PATCH') {
          const b = await readBody(req); const rows = mineE.filter(r => matches(r, url.searchParams));
          for (const r of rows) { const e = check({ ...r, ...b }); if (e) return json(res, 400, e); Object.assign(r, b); }
          return json(res, 200, wantRows ? rows : undefined);
        }
        if (req.method === 'DELETE') {
          for (const r of mineE.filter(r => matches(r, url.searchParams))) { table.splice(table.indexOf(r), 1); for (const t of [docs, rems]) for (let i = t.length - 1; i >= 0; i--) if (t[i].asset_id === r.id) t.splice(i, 1); }
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
