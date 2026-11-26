// An in-memory stand-in for the PostgREST endpoints the outreach engine uses, as a `fetch`. Service-key access (no row security): the tests check the engine's own filters.
import { randomUUID } from 'node:crypto';
import { matchRow, shape } from '../scripts/rest-filter.mjs';

export function createFakeDb(initial = {}, { fallback } = {}) {
  const tables = { business_profiles: [], leads: [], linkedin_accounts: [], outreach: [], ...initial };
  const calls = [];
  const json = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)), json: async () => body });
  async function fetchImpl(url, init = {}) {
    const u = new URL(String(url)), m = init.method || 'GET', name = u.pathname.split('/').pop();
    if (!u.pathname.startsWith('/rest/v1/') || !tables[name]) { if (fallback) return fallback(url, init); throw new Error(`unexpected ${m} ${u}`); }
    const T = tables[name], prefer = (init.headers || {}).prefer || '', body = init.body ? JSON.parse(init.body) : undefined;
    calls.push([m, name, u.search, body]);
    if (m === 'GET') return json(200, shape(T.filter(r => matchRow(r, u.searchParams)), u.searchParams));
    if (m === 'POST') {
      const made = [], conflict = (u.searchParams.get('on_conflict') || '').split(',').filter(Boolean);
      for (const x of Array.isArray(body) ? body : [body]) {
        const dup = conflict.length && T.find(r => conflict.every(k => r[k] === x[k]));
        if (dup) { if (/merge-duplicates/.test(prefer)) { Object.assign(dup, x); made.push(dup); } continue; }
        const row = { id: randomUUID(), created_at: new Date().toISOString(), history: [], status: name === 'linkedin_accounts' ? 'connected' : name === 'outreach' ? 'draft' : 'new', ...x }; T.push(row); made.push(row);
      }
      return json(201, /return=representation/.test(prefer) ? made : undefined);
    }
    if (m === 'PATCH') { const rows = T.filter(r => matchRow(r, u.searchParams)); rows.forEach(r => Object.assign(r, body)); return json(200, /return=representation/.test(prefer) ? rows : undefined); }
    if (m === 'DELETE') { for (const r of T.filter(x => matchRow(x, u.searchParams))) T.splice(T.indexOf(r), 1); return json(204); }
    throw new Error(`unsupported ${m}`);
  }
  return { tables, calls, fetchImpl };
}
