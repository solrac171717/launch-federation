// POST /api/tick: the scheduler's heartbeat, called every ten minutes by Supabase (pg_cron, see the outreach migration) with the secret in `x-cron-secret`.
// For every connected LinkedIn account: notice who accepted and who replied, send what is approved and due inside the caps and the working hours,
// and every few hours look for new people. Nothing is sent without an approved row (or the person turning automatic sending on).
// Env: CRON_SECRET, UNIPILE_DSN, UNIPILE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
import { timingSafeEqual } from 'node:crypto';
import { createUnipile, configured } from '../src/providers/unipile.js';
import { runTick } from '../src/outreach-engine.js';
import { send } from './_leads-http.js';

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export async function tick({ env, fetchImpl = fetch, provider, secret, now = Date.now() }) {
  if (!env.CRON_SECRET || !configured(env) || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.OPENAI_API_KEY) return { status: 503, body: { error: 'not_configured' } };
  if (!secret || !same(secret, env.CRON_SECRET)) return { status: 401, body: { error: 'bad_secret' } };
  return { status: 200, body: await runTick({ env, fetchImpl, provider: provider || createUnipile({ env, fetchImpl }), now }) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  try {
    // ALLOW_TEST_NOW is set only by the local stand-in (scripts/mock-supabase.mjs), so a test can pretend it is a working day; on the real site the clock is the real one
    const now = process.env.ALLOW_TEST_NOW === '1' && Number(req.headers['x-test-now']) > 0 ? Number(req.headers['x-test-now']) : Date.now();
    const { status, body } = await tick({ env: process.env, secret: req.headers['x-cron-secret'], now }); return send(res, status, body);
  }
  catch (e) { console.error('tick error', e); return send(res, 500, { error: 'server_error' }); }
}
