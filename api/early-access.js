// POST /api/early-access — persists a lead to Supabase using a server-side key.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. If either is missing the endpoint answers 503
// and the form shows an error: a lead is never reported as saved unless it was actually stored.
import { validateLead } from '../src/lead.js';

const CONSENT_TEXT = 'I agree to be contacted about Owned Map early access. My details are used only for that purpose.';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return send(res, 400, { error: 'invalid_json' });

  // Honeypot: bots fill the hidden field. Pretend success without storing anything.
  if (body.website) return send(res, 200, { ok: true });

  const { ok, errors, value } = validateLead(body);
  if (!ok) return send(res, 422, { error: 'validation', errors });

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return send(res, 503, { error: 'not_configured' });

  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/early_access_leads?on_conflict=email`, {
      method: 'POST',
      headers: {
        apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json',
        // Duplicate emails are ignored, so re-submitting is harmless and leaks nothing about who is on the list.
        prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({
        ...value, consent_at: new Date().toISOString(), consent_text: CONSENT_TEXT,
        source: String(body.source || 'landing').slice(0, 40),
      }),
    });
    if (!r.ok) { console.error('early-access insert failed', r.status, await r.text().catch(() => '')); return send(res, 502, { error: 'storage_failed' }); }
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('early-access error', e);
    return send(res, 502, { error: 'storage_failed' });
  }
}
