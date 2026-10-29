// GET /api/vin?vin=...: decodes a vehicle identification number with the free public NHTSA vPIC service (US-market vehicles).
// Nothing is stored. The VIN is validated before it is forwarded, so this cannot be used as an open proxy.
import { isVin, cleanVin, fromNhtsa } from '../src/vin.js';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', status === 200 ? 'public, max-age=86400' : 'no-store');
  res.end(JSON.stringify(body));
}

export async function runVin({ vin, fetchImpl = fetch, base = 'https://vpic.nhtsa.dot.gov' }) {
  if (!isVin(vin)) return { status: 400, body: { error: 'invalid_vin', message: 'A VIN has 17 letters and digits (no I, O or Q).' } };
  let res;
  try { res = await fetchImpl(`${base}/api/vehicles/DecodeVinValues/${cleanVin(vin)}?format=json`, { headers: { accept: 'application/json' } }); }
  catch { return { status: 502, body: { error: 'lookup_failed', message: 'The vehicle database did not answer. Try again, or type the details in.' } }; }
  if (!res.ok) return { status: 502, body: { error: 'lookup_failed', message: 'The vehicle database did not answer. Try again, or type the details in.' } };
  const data = fromNhtsa((await res.json().catch(() => ({})))?.Results?.[0], vin);
  if (!data) return { status: 404, body: { error: 'not_found', message: 'We could not find that VIN. The free database covers vehicles sold in the US; type the details in instead.' } };
  return { status: 200, body: data };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('allow', 'GET'); return send(res, 405, { error: 'method_not_allowed' }); }
  try { const { status, body } = await runVin({ vin: new URL(req.url, 'http://x').searchParams.get('vin'), base: process.env.NHTSA_URL || undefined }); return send(res, status, body); }
  catch (e) { console.error('vin error', e); return send(res, 500, { error: 'server_error', message: 'Something went wrong.' }); }
}
