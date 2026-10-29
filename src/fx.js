// Exchange rates. Every figure Owned Map adds up is in US dollars; an asset can be entered in its own currency and is converted here.
// Rates come from the European Central Bank through frankfurter.dev (free, no key), once a day, and are cached on the device.
// If they cannot be fetched we use the last cached ones and say so; we never invent a rate.
const KEY = 'atlas.fx.v1';
const URLS = ['https://api.frankfurter.dev/v1/latest?base=USD', 'https://api.frankfurter.app/latest?from=USD'];

let table = { date: null, rates: {} }; // rates[X] = how many X one US dollar buys
export const setRates = t => { table = { date: t?.date || null, rates: { ...(t?.rates || {}) } }; };
export const rateTable = () => table;
/** US dollars per one unit of `cur`, or null when we have no rate for it. USD is always 1. */
export const toUsd = cur => { const c = String(cur || 'USD').toUpperCase(); if (c === 'USD') return 1; const r = table.rates[c]; return r > 0 ? 1 / r : null; };
export const currencies = () => ['USD', ...Object.keys(table.rates).sort()];
export const hasRates = () => Object.keys(table.rates).length > 0;

const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', KRW: '₩', BRL: 'R$', CHF: 'CHF ', CAD: 'CA$', AUD: 'A$', MXN: 'MX$', NZD: 'NZ$' };
/** An amount in its own currency, e.g. "€450,000". */
export const formatIn = (n, cur = 'USD') => { const c = String(cur || 'USD').toUpperCase(); return (n < 0 ? '-' : '') + (symbols[c] ?? `${c} `) + Math.abs(Math.round(n)).toLocaleString('en-US'); };
export function currencyName(code) { try { return new Intl.DisplayNames('en', { type: 'currency' }).of(code) || code; } catch { return code; } }

/**
 * Loads today's rates (or the cached ones). Resolves to { ok, date, stale, source }:
 *   ok     rates are available (fresh or cached)
 *   stale  the rates are more than 3 days old, or could not be refreshed
 */
export async function loadRates({ fetchImpl = (...a) => globalThis.fetch(...a), storage = globalThis.localStorage, now = Date.now(), timeoutMs = 5000 } = {}) {
  let cached = null; try { cached = JSON.parse(storage.getItem(KEY) || 'null'); } catch { cached = null; }
  const today = new Date(now).toISOString().slice(0, 10);
  const age = d => (d ? Math.floor((Date.parse(today) - Date.parse(d)) / 86400000) : Infinity);
  if (cached?.rates && cached.fetchedOn === today) { setRates(cached); return { ok: true, date: cached.date, stale: age(cached.date) > 3, source: 'cache' }; }
  for (const url of URLS) {
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : 0;
      const res = await fetchImpl(url, ctl ? { signal: ctl.signal } : {}); clearTimeout(t);
      if (!res.ok) continue;
      const d = await res.json();
      if (!d || typeof d.rates !== 'object' || !d.date) continue;
      const rates = Object.fromEntries(Object.entries(d.rates).filter(([k, v]) => /^[A-Z]{3}$/.test(k) && Number(v) > 0).map(([k, v]) => [k, Number(v)]));
      if (!Object.keys(rates).length) continue;
      const fresh = { date: d.date, rates, fetchedOn: today };
      setRates(fresh); try { storage.setItem(KEY, JSON.stringify(fresh)); } catch { /* private mode */ }
      return { ok: true, date: d.date, stale: age(d.date) > 3, source: 'network' };
    } catch { /* try the next source */ }
  }
  if (cached?.rates && Object.keys(cached.rates).length) { setRates(cached); return { ok: true, date: cached.date, stale: true, source: 'cache' }; }
  return { ok: false, date: null, stale: true, source: 'none' };
}
