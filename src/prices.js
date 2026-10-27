// Live market data from CoinGecko's public API (no key). Used only for holdings with a CoinGecko id.
const BASE = 'https://api.coingecko.com/api/v3';

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(r.status === 429 ? 'Rate limited by CoinGecko — try again in a minute' : `Price service error (${r.status})`);
  return r.json();
}

/** @returns {Promise<Record<string, number>>} id -> USD price */
export async function fetchPrices(ids) {
  if (!ids.length) return {};
  const data = await getJson(`${BASE}/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd`);
  const out = {};
  for (const id of ids) if (Number.isFinite(data?.[id]?.usd)) out[id] = data[id].usd;
  return out;
}

/** @returns {Promise<{t:number, v:number}[]>} */
export async function fetchHistory(id, days = 90) {
  const data = await getJson(`${BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`);
  return (data.prices || []).map(([t, v]) => ({ t, v }));
}
