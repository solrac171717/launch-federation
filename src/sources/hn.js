// Hacker News as a source of buying signals, through the free Algolia search API (no key, answers in a fraction of a second).
// Every source has the same shape: buscarSeñales(keywords, opts) -> candidates [{ source, externalId, authorName, text, url, signalAt, authorAbout }],
// so another source (LinkedIn through the extension, later others) is one more file with this one function.
const API = 'https://hn.algolia.com/api/v1';
const ITEM = id => `https://news.ycombinator.com/item?id=${id}`;
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#x2F;': '/', '&#39;': "'", '&nbsp;': ' ' };

/** Comment text from Hacker News comes as HTML: paragraphs, links, code. We keep plain readable text. */
export function plain(html) {
  return String(html || '').replace(/<p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, m => ENT[m] ?? (/^&#x/i.test(m) ? String.fromCodePoint(parseInt(m.slice(3, -1), 16)) : /^&#/.test(m) ? String.fromCodePoint(parseInt(m.slice(2, -1), 10)) : m)).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

export function hitToCandidate(hit) {
  const text = plain(hit.comment_text || hit.story_text || hit.title || '');
  if (!hit.author || text.length < 25) return null;
  const title = hit.story_title || hit.title || '';
  return {
    source: 'hn', externalId: String(hit.objectID), authorName: hit.author, text: title && hit.comment_text ? `${text}\n(in the thread: ${title})` : text,
    url: ITEM(hit.objectID), signalAt: hit.created_at || new Date((hit.created_at_i || 0) * 1000).toISOString(),
  };
}

/** @returns {Promise<Array>} fresh candidates for the given phrases, newest first, without repeats. */
export async function buscarSeñales(keywords, { fetchImpl = fetch, days = 45, perQuery = 12, now = Date.now() } = {}) {
  const since = Math.floor(now / 1000) - days * 86400, seen = new Map();
  const queries = [...new Set((keywords || []).map(k => String(k).trim()).filter(Boolean))].slice(0, 6);
  await Promise.all(queries.map(async q => {
    const url = `${API}/search_by_date?query=${encodeURIComponent(q)}&tags=(comment,ask_hn)&numericFilters=created_at_i>${since}&hitsPerPage=${perQuery}`;
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return;
      for (const hit of (await res.json()).hits || []) { const c = hitToCandidate(hit); if (c && !seen.has(c.externalId)) seen.set(c.externalId, c); }
    } catch { /* one phrase failing must not lose the others */ }
  }));
  return [...seen.values()].sort((a, b) => Date.parse(b.signalAt) - Date.parse(a.signalAt));
}

/** The free text some people put on their Hacker News profile, often "founder at X, based in Y". Up to a few authors, in parallel, never blocking. */
export async function aboutOf(names, { fetchImpl = fetch, max = 12 } = {}) {
  const out = {};
  await Promise.all([...new Set(names)].slice(0, max).map(async n => {
    try {
      const res = await fetchImpl(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(n)}.json`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) { const u = await res.json(); if (u?.about) out[n] = plain(u.about).slice(0, 300); }
    } catch { /* no profile text: the person simply has no location */ }
  }));
  return out;
}
