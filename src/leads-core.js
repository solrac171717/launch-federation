// Leads: what the app stores about one person who showed they might buy, and the small pure helpers around it (validation, database rows,
// what the globe and the list read, the monthly allowance). No network and no DOM here, so the browser, the API and the tests share the same rules.
import { COUNTRIES } from './places.js';

export const SOURCES = {
  hn: { label: 'Hacker News', short: 'HN' },
  linkedin: { label: 'LinkedIn', short: 'in' },
};
export const INTENTS = {
  recommendation: 'Asks for a recommendation',
  complaint: 'Complains about a competitor',
  pricing: 'Asks about price',
  alternative: 'Looks for an alternative',
  problem: 'Describes the problem you solve',
};
export const STATUSES = { new: 'New', contacted: 'Contacted', replied: 'Replied', customer: 'Customer' };
export const HIGH_SCORE = 70; // a lead at or above this counts against the monthly allowance

const isoDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const clipKeep = (v, n) => String(v ?? '').replace(/\r/g, '').trim().slice(0, n); // keeps line breaks (the reply draft)

export const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`);

/** Cleans one lead coming from the engine, the extension or the browser. Returns { ok, errors, value }. */
export function validateLead(input, { now = Date.now() } = {}) {
  const errors = {};
  const source = String(input?.source || '');
  if (!SOURCES[source]) errors.source = 'Unknown source.';
  const text = clip(input?.text, 1500);
  if (!text) errors.text = 'The signal text is empty.';
  const externalId = clip(input?.externalId, 120);
  if (!externalId) errors.externalId = 'Missing id.';
  const url = clip(input?.url, 500);
  if (url && !/^https?:\/\//i.test(url)) errors.url = 'The link must start with http(s)://.';
  const score = Math.round(Number(input?.score));
  if (!Number.isFinite(score) || score < 0 || score > 100) errors.score = 'Score must be 0 to 100.';
  const intent = INTENTS[input?.intent] ? input.intent : 'problem';
  const status = STATUSES[input?.status] ? input.status : 'new';
  const lat = input?.lat == null || input.lat === '' ? null : Number(input.lat), lon = input?.lon == null || input.lon === '' ? null : Number(input.lon);
  if ((lat == null) !== (lon == null)) errors.lat = 'Give both latitude and longitude, or neither.';
  if (lat != null && !(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) errors.lat = 'Coordinates out of range.';
  const country = input?.country ? String(input.country).toUpperCase() : null;
  if (country && !/^[A-Z]{2}$/.test(country)) errors.country = 'Country must be a two-letter code.';
  if (Object.keys(errors).length) return { ok: false, errors, value: null };
  const at = Date.parse(input?.signalAt);
  return {
    ok: true, errors: {},
    value: {
      source, externalId, intent, score, status, text, url,
      authorName: clip(input?.authorName, 120), authorRole: clip(input?.authorRole, 160), authorCompany: clip(input?.authorCompany, 120), authorUrl: clip(input?.authorUrl, 300),
      place: clip(input?.place, 120), country, lat, lon,
      draft: clipKeep(input?.draft, 2000),
      providerId: clip(input?.providerId, 120), signalKind: SIGNAL_KINDS.includes(input?.signalKind) ? input.signalKind : null,
      signalAt: Number.isFinite(at) ? new Date(at).toISOString() : new Date(now).toISOString(),
    },
  };
}

export const SIGNAL_KINDS = ['post', 'comment', 'like', 'follow', 'job'];

/** A lead as the database stores it. */
export const toRow = v => ({
  source: v.source, external_id: v.externalId, intent: v.intent, score: v.score, status: v.status || 'new', signal_text: v.text, url: v.url || null,
  author_name: v.authorName || null, author_role: v.authorRole || null, author_company: v.authorCompany || null, author_url: v.authorUrl || null,
  place: v.place || null, country: v.country || null, lat: v.lat ?? null, lon: v.lon ?? null, signal_at: v.signalAt, draft: v.draft || null,
  provider_id: v.providerId || null, signal_kind: v.signalKind || null,
});
export const fromDb = r => ({
  id: r.id, source: r.source, externalId: r.external_id, intent: r.intent, score: r.score, status: r.status, text: r.signal_text, url: r.url || '',
  authorName: r.author_name || '', authorRole: r.author_role || '', authorCompany: r.author_company || '', authorUrl: r.author_url || '',
  place: r.place || '', country: r.country || null, lat: r.lat ?? null, lon: r.lon ?? null, signalAt: r.signal_at, draft: r.draft || '',
  providerId: r.provider_id || '', signalKind: r.signal_kind || null, connectedAt: r.connected_at || null,
  history: Array.isArray(r.history) ? r.history : [], isSample: !!r.is_sample, createdAt: r.created_at,
});

/** What the list and the globe read. The globe can only place leads in countries it has outlines for, so the others stay in the "not on the map" list. */
export function toView(l) {
  const located = l.lat != null && l.lon != null && Boolean(COUNTRIES[l.country]);
  return {
    ...l,
    name: l.authorName || 'Unknown author',
    category: l.source, // the globe picks its marker glyph by `category`
    kind: SOURCES[l.source]?.label || l.source,
    located, tier: l.score >= HIGH_SCORE ? 'high' : l.score >= 40 ? 'mid' : 'low',
    intentLabel: INTENTS[l.intent] || INTENTS.problem, statusLabel: STATUSES[l.status] || 'New',
  };
}

/** A new event on the lead's interaction history: when it was found, contacted, replied to. */
export function nextHistory(prev, event, { today = isoDay() } = {}) {
  const list = Array.isArray(prev) ? prev : [];
  return [...list, { d: today, e: event }].slice(-60);
}

export const HISTORY_LABEL = { found: 'Signal detected', contacted: 'Marked as contacted', replied: 'Replied', customer: 'Became a customer', new: 'Back to new', located: 'Location added', invited: 'Invitation sent', connected: 'Accepted the invitation', messaged: 'Message sent' };

export function stats(leads, now = Date.now()) {
  const month = isoDay(now).slice(0, 7);
  const n = leads.length, high = leads.filter(l => l.score >= HIGH_SCORE).length;
  const by = k => leads.reduce((m, l) => { m[l[k]] = (m[l[k]] || 0) + 1; return m; }, {});
  return {
    total: n, high, located: leads.filter(l => l.lat != null && l.lon != null).length,
    avgScore: n ? Math.round(leads.reduce((a, l) => a + l.score, 0) / n) : 0,
    byStatus: by('status'), bySource: by('source'),
    highThisMonth: leads.filter(l => l.score >= HIGH_SCORE && String(l.createdAt || l.signalAt || '').slice(0, 7) === month).length,
  };
}

/** The funnel: found, contacted, replied, customer. A lead that became a customer also counts as replied and contacted. */
export function funnel(leads) {
  const rank = { new: 0, contacted: 1, replied: 2, customer: 3 };
  const at = k => leads.filter(l => (rank[l.status] ?? 0) >= k).length;
  return [['Detected', leads.length], ['Contacted', at(1)], ['Replied', at(2)], ['Customers', at(3)]];
}

/** The monthly allowance of high-score leads for a plan. The base plan includes `included`; the structure is ready, the charge is not wired yet. */
export const LEADS_PER_UNIT = 25;
export const allowanceFor = units => Math.max(0, Math.round(Number(units) || 0)) * LEADS_PER_UNIT;
export function quotaState(leads, units, now = Date.now()) {
  const used = stats(leads, now).highThisMonth, allowed = allowanceFor(units);
  return { used, allowed, left: Math.max(0, allowed - used), over: used >= allowed };
}

export const LEAD_COLUMNS = ['Author', 'Role', 'Company', 'Source', 'Intent', 'Score', 'Status', 'Signal', 'Link', 'Location', 'Detected', 'Draft reply'];
export const toCsvRows = leads => leads.map(l => [l.authorName, l.authorRole, l.authorCompany, SOURCES[l.source]?.label || l.source, INTENTS[l.intent] || '', l.score, STATUSES[l.status] || l.status, l.text, l.url, l.place, String(l.signalAt || '').slice(0, 10), l.draft]);

export function createLocalStore(storage = globalThis.localStorage, key = 'ownedmap.leads.v1') {
  const read = () => { try { return JSON.parse(storage.getItem(key) || '[]'); } catch { return []; } };
  const write = list => storage.setItem(key, JSON.stringify(list));
  return {
    kind: 'local',
    async list() { return read(); },
    async addMany(values, { sample = false } = {}) {
      const have = new Set(read().map(l => `${l.source}:${l.externalId}`)), made = [];
      for (const v of values) {
        const k = `${v.source}:${v.externalId}`; if (have.has(k)) continue; have.add(k);
        made.push({ ...v, id: newId(), history: nextHistory([], 'found'), isSample: sample, createdAt: new Date().toISOString() });
      }
      write([...read(), ...made]); return made;
    },
    async update(id, patch) {
      const list = read(), i = list.findIndex(l => l.id === id); if (i < 0) throw new Error('That lead no longer exists.');
      list[i] = { ...list[i], ...patch }; write(list); return list[i];
    },
    async remove(id) { write(read().filter(l => l.id !== id)); },
    async removeSample() { write(read().filter(l => !l.isSample)); },
  };
}

export function createCloudStore(cloud, { owner = null } = {}) {
  const only = owner ? `user_id=eq.${encodeURIComponent(owner)}&` : '';
  const mine = owner ? { user_id: owner } : {};
  const patchBody = p => {
    const m = { status: 'status', draft: 'draft', history: 'history', lat: 'lat', lon: 'lon', country: 'country', place: 'place' }, o = {};
    for (const [k, c] of Object.entries(m)) if (k in p) o[c] = p[k] === '' ? null : p[k];
    return { ...o, updated_at: new Date().toISOString() };
  };
  return {
    kind: 'cloud',
    async list() { return (await cloud.rest('GET', `/leads?${only}select=*&order=signal_at.desc&limit=1000`)).map(fromDb); },
    // a signal already stored (same source and external id) is skipped, so searching again never duplicates
    async addMany(values, { sample = false } = {}) {
      if (!values.length) return [];
      const body = values.map(v => ({ ...toRow(v), ...mine, history: nextHistory([], 'found'), is_sample: sample }));
      return (await cloud.rest('POST', '/leads?on_conflict=user_id,source,external_id', body, { prefer: 'resolution=ignore-duplicates,return=representation' })).map(fromDb);
    },
    async update(id, patch) {
      const [r] = await cloud.rest('PATCH', `/leads?id=eq.${encodeURIComponent(id)}`, patchBody(patch), { prefer: 'return=representation' });
      if (!r) throw new Error('That lead no longer exists.'); return fromDb(r);
    },
    async remove(id) { await cloud.rest('DELETE', `/leads?id=eq.${encodeURIComponent(id)}`); },
    async removeSample() { await cloud.rest('DELETE', `/leads?${only}is_sample=eq.true`); },
  };
}
