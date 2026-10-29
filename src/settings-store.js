// Small per-user preferences kept next to the assets: the concentration warning level, the net-worth goal,
// sale assumptions, and the key contacts for the emergency sheet. Device (localStorage) or the user's Supabase account, like the assets.
export const DEFAULTS = { concentrationLimit: 40, goal: { target: null, date: '' }, sale: { costsPct: 5, taxPct: 15 }, contacts: [], emergencyNote: '' };

/** Cleans a (possibly partial or hostile) settings object into the stored shape. Unknown keys are dropped. */
export function cleanSettings(raw = {}) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
  const str = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
  const g = input.goal || {}, s = input.sale || {};
  const target = g.target === '' || g.target == null ? null : num(String(g.target).replace(/[$,\s]/g, ''), 1, 1e12, null);
  return {
    concentrationLimit: num(input.concentrationLimit, 5, 100, DEFAULTS.concentrationLimit),
    goal: { target, date: /^\d{4}-\d{2}-\d{2}$/.test(g.date || '') ? g.date : '' },
    sale: { costsPct: num(s.costsPct, 0, 50, DEFAULTS.sale.costsPct), taxPct: num(s.taxPct, 0, 80, DEFAULTS.sale.taxPct) },
    contacts: (Array.isArray(input.contacts) ? input.contacts : []).slice(0, 12).map(c => ({ role: str(c?.role, 40), name: str(c?.name, 80), phone: str(c?.phone, 40), email: str(c?.email, 120) })).filter(c => c.name || c.phone || c.email),
    emergencyNote: str(input.emergencyNote, 1000),
  };
}

export function createLocalSettings(storage = globalThis.localStorage, key = 'atlas.settings.v1') {
  return {
    async get() { try { return cleanSettings(JSON.parse(storage.getItem(key) || '{}')); } catch { return cleanSettings({}); } },
    async save(patch) { const next = cleanSettings({ ...(await this.get()), ...patch }); try { storage.setItem(key, JSON.stringify(next)); } catch { throw new Error('This browser cannot save data (storage is full or blocked).'); } return next; },
  };
}

export function createCloudSettings(cloud) {
  return {
    async get() { const r = await cloud.rest('GET', '/user_settings?select=data'); return cleanSettings(r[0]?.data || {}); },
    async save(patch) {
      const next = cleanSettings({ ...(await this.get()), ...patch });
      await cloud.rest('POST', '/user_settings?on_conflict=user_id', { data: next, updated_at: new Date().toISOString() }, { prefer: 'resolution=merge-duplicates,return=minimal' });
      return next;
    },
  };
}
