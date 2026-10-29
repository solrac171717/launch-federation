// POST /api/extract: reads one uploaded document (PDF or image) and returns the facts to prefill the "Add an asset" form.
// Only signed-in users can call it (it costs money per document), the file is read once and never stored here,
// and the model is told to report only what the document says. The address is then looked up on OpenStreetMap (Nominatim) for exact coordinates.
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY). Test hooks: ANTHROPIC_BASE_URL, NOMINATIM_URL.
import Anthropic from '@anthropic-ai/sdk';
import { EXTRACT_SCHEMA, SYSTEM_PROMPT, normalizeExtraction } from '../src/extract-core.js';
import { COUNTRIES } from '../src/places.js';

export const MODEL = 'claude-opus-5-5';
const MAX_BYTES = 3 * 1024 * 1024; // Vercel functions accept ~4.5 MB bodies and base64 adds a third
const PER_HOUR = 30;
const hits = new Map(); // user id -> timestamps; per server instance, a best-effort brake on cost

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export function allowed(userId, now = Date.now()) {
  const list = (hits.get(userId) || []).filter(t => now - t < 3600_000);
  if (list.length >= PER_HOUR) { hits.set(userId, list); return false; }
  list.push(now); hits.set(userId, list); return true;
}

const SIGNATURES = { 'application/pdf': b => b.subarray(0, 4).toString('latin1') === '%PDF', 'image/png': b => b[0] === 0x89 && b[1] === 0x50, 'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8, 'image/webp': b => b.subarray(8, 12).toString('latin1') === 'WEBP', 'image/gif': b => b.subarray(0, 3).toString('latin1') === 'GIF' };

async function geocode({ env, fetchImpl, r }) {
  const base = String(env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
  const country = COUNTRIES[String(r.countryCode || '').toUpperCase()]?.name || '';
  const tries = [
    [r.addressLine, r.postalCode, r.city, r.region, country],
    [r.city, r.region, country],
  ].map(p => p.filter(Boolean).join(', ')).filter(Boolean);
  for (let i = 0; i < tries.length; i++) {
    try {
      const u = `${base}/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(tries[i])}`;
      const res = await fetchImpl(u, { headers: { 'user-agent': 'ATLAS/1.0 (https://launchfederation.com)', 'accept-language': 'en' } });
      if (!res.ok) continue;
      const hit = (await res.json())[0];
      if (!hit) continue;
      const lat = Number(hit.lat), lon = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      return { lat, lon, countryCode: String(hit.address?.country_code || '').toUpperCase(), precise: i === 0 && Boolean(r.addressLine) && (Boolean(hit.address?.house_number) || ['building', 'place', 'highway', 'amenity'].includes(hit.category)) };
    } catch { /* try the next, coarser query */ }
  }
  return null;
}

export async function runExtract({ env, fetchImpl = fetch, client, token, body, now = Date.now() }) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!env.ANTHROPIC_API_KEY || !base) return { status: 503, body: { error: 'not_configured' } };
  if (!token) return { status: 401, body: { error: 'sign_in_required' } };
  const who = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token}` } }).catch(() => null);
  if (!who || !who.ok) return { status: 401, body: { error: 'sign_in_required' } };
  const user = await who.json().catch(() => ({}));
  if (!user.id) return { status: 401, body: { error: 'sign_in_required' } };

  const mime = String(body?.mime || '').toLowerCase(), b64 = String(body?.data || '');
  if (!SIGNATURES[mime]) return { status: 400, body: { error: 'unsupported_type', message: 'Use a PDF, PNG, JPG, WebP or GIF.' } };
  const bytes = Buffer.from(b64, 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES) return { status: 413, body: { error: 'too_large', message: 'The file is too large. Use one under 3 MB.' } };
  if (!SIGNATURES[mime](bytes)) return { status: 400, body: { error: 'unsupported_type', message: 'That file does not look like a real ' + mime.split('/')[1].toUpperCase() + '.' } };
  if (!allowed(user.id, now)) return { status: 429, body: { error: 'rate_limited', message: 'You have read many documents in the last hour. Try again later.' } };

  const anthropic = client || new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 1, timeout: 50_000 });
  const block = mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: mime, data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };
  let msg;
  try {
    msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 2000,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: EXTRACT_SCHEMA } },
      messages: [{ role: 'user', content: [block, { type: 'text', text: 'Extract the asset facts from this document.' }] }],
    });
  } catch (e) {
    console.error('extract model error', e?.status, e?.message);
    return { status: 502, body: { error: 'model_unavailable', message: 'We could not read this document right now. Try again, or enter the details by hand.' } };
  }
  if (msg.stop_reason === 'refusal') return { status: 422, body: { error: 'declined', message: 'This document could not be read. Enter the details by hand.' } };
  let raw;
  try { raw = JSON.parse((msg.content.find(c => c.type === 'text') || {}).text || ''); } catch { return { status: 502, body: { error: 'bad_answer', message: 'We could not understand the result. Try again, or enter the details by hand.' } }; }

  const geo = (raw.addressLine || raw.city) ? await geocode({ env, fetchImpl, r: raw }) : null;
  return { status: 200, body: normalizeExtraction(raw, geo) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b);
    if (!b) { const chunks = []; let n = 0; for await (const c of req) { n += c.length; if (n > 5 * 1024 * 1024) return send(res, 413, { error: 'too_large', message: 'The file is too large. Use one under 3 MB.' }); chunks.push(c); } b = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const { status, body } = await runExtract({ env: process.env, token, body: b });
    return send(res, status, body);
  } catch (e) { console.error('extract error', e); return send(res, 500, { error: 'server_error', message: 'Something went wrong. Enter the details by hand.' }); }
}
