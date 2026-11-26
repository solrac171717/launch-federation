// The small part of PostgREST's filter language that Owned Map uses, for the local stand-ins (scripts/mock-supabase.mjs and the unit tests).
// eq, neq, in.(a,b), is.null, not.is.null, lt/lte/gt/gte (numbers or ISO dates), like with * as the wildcard; select, order and limit are handled by the caller.

const cmp = (a, b) => (typeof a === 'number' || /^\d+(\.\d+)?$/.test(String(b)) ? Number(a) - Number(b) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);

export function matchRow(row, params) {
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(k)) continue;
    const cell = row[k];
    let m;
    if (v === 'is.null') { if (cell != null) return false; continue; }
    if (v === 'not.is.null') { if (cell == null) return false; continue; }
    if ((m = /^eq\.(.*)$/.exec(v))) { if (String(cell) !== m[1]) return false; continue; }
    if ((m = /^neq\.(.*)$/.exec(v))) { if (String(cell) === m[1]) return false; continue; }
    if ((m = /^in\.\((.*)\)$/.exec(v))) { if (!m[1].split(',').map(decodeURIComponent).includes(String(cell))) return false; continue; }
    if ((m = /^(lt|lte|gt|gte)\.(.*)$/.exec(v))) {
      if (cell == null) return false;
      const d = cmp(cell, m[2]);
      if (m[1] === 'lt' ? !(d < 0) : m[1] === 'lte' ? !(d <= 0) : m[1] === 'gt' ? !(d > 0) : !(d >= 0)) return false; continue;
    }
    if ((m = /^like\.(.*)$/.exec(v))) { if (cell == null || !new RegExp(`^${m[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(String(cell))) return false; continue; }
  }
  return true;
}

/** select=a,b keeps only those columns; order=col.desc sorts; limit cuts. */
export function shape(rows, params) {
  let out = rows;
  const order = params.get('order'); if (order) { const [col, dir] = order.split('.'); out = [...out].sort((a, b) => (cmp(a[col] ?? '', b[col] ?? '')) * (dir === 'desc' ? -1 : 1)); }
  const limit = Number(params.get('limit')); if (limit > 0) out = out.slice(0, limit);
  const sel = params.get('select'); if (sel && sel !== '*') out = out.map(r => Object.fromEntries(sel.split(',').map(k => [k, r[k]])));
  return out;
}
