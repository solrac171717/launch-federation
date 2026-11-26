// Small helpers the lead endpoints share (the leading underscore keeps Vercel from serving this file as a function of its own).
export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJson(req, limit = 200 * 1024) {
  let b = req.body;
  if (typeof b === 'string') b = JSON.parse(b);
  if (b && typeof b === 'object') return b;
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error('too_large'), { status: 413 }); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/** The signed-in user behind a session token, or null. The model costs money, so only people who signed in can ask. */
export async function userOf({ env, fetchImpl = fetch, token }) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!token || !base) return null;
  const who = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token}` } }).catch(() => null);
  if (!who || !who.ok) return null;
  const u = await who.json().catch(() => ({}));
  return u.id ? u : null;
}

/** A best-effort brake per server instance: `limit` calls per hour per key. */
export function limiter(limit) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const list = (hits.get(key) || []).filter(t => now - t < 3600_000);
    if (list.length >= limit) { hits.set(key, list); return false; }
    list.push(now); hits.set(key, list); return true;
  };
}
