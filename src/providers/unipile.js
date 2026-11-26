// LinkedIn through Unipile: the person connects their own account on a page hosted by Unipile (we never see a password or a cookie, only an account id),
// and every LinkedIn action goes through this one file. To change provider, write another file with the same functions.
//
// Written from Unipile's public documentation (https://developer.unipile.com) WITHOUT a live key: the paths, fields and response shapes below must be
// checked once against a real account (see README, "First run"). Every response is read defensively, so a renamed field gives an empty result, not a crash.
//
// Env: UNIPILE_DSN (for example "api3.unipile.com:13359", shown in the Unipile dashboard), UNIPILE_API_KEY.

export class ProviderError extends Error {
  constructor(message, { status = 0, kind = 'unknown' } = {}) { super(message); this.name = 'ProviderError'; this.status = status; this.kind = kind; }
}

const clean = t => String(t ?? '').replace(/\s+/g, ' ').trim();
const first = (...v) => v.find(x => x !== undefined && x !== null && x !== '');
const publicId = url => { const m = String(url || '').match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i); return m ? decodeURIComponent(m[1]) : ''; };
const profileUrl = (id, kind = 'in') => (id ? `https://www.linkedin.com/${kind}/${encodeURIComponent(id)}` : '');

export function configured(env = {}) { return Boolean(env.UNIPILE_DSN && env.UNIPILE_API_KEY); }

export function createUnipile({ env, fetchImpl = (...a) => globalThis.fetch(...a), timeout = 30_000 }) {
  const dsn = String(env.UNIPILE_DSN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const root = env.UNIPILE_BASE_URL ? String(env.UNIPILE_BASE_URL).replace(/\/+$/, '') : `https://${dsn}`; // UNIPILE_BASE_URL is a test hook: a local stand-in for Unipile

  async function call(method, path, { query, json, form } = {}) {
    const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]))}` : '';
    let res;
    try {
      res = await fetchImpl(`${root}/api/v1${path}${qs}`, {
        method, signal: AbortSignal.timeout(timeout),
        headers: { 'X-API-KEY': env.UNIPILE_API_KEY, accept: 'application/json', ...(json !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: json !== undefined ? JSON.stringify(json) : form,
      });
    } catch { throw new ProviderError('provider_unreachable', { kind: 'network' }); }
    const text = await res.text().catch(() => '');
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const kind = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'limit' : res.status === 404 || res.status === 422 || res.status === 400 ? 'invalid' : 'unknown';
      throw new ProviderError(clean(first(data?.detail, data?.title, data?.message, `provider ${res.status}`)).slice(0, 200), { status: res.status, kind });
    }
    return data;
  }

  const member = (a = {}) => ({
    providerId: clean(first(a.id, a.provider_id, a.member_id)),
    name: clean(first(a.name, [a.first_name, a.last_name].filter(Boolean).join(' '), a.public_identifier)),
    headline: clean(first(a.headline, a.occupation, '')),
    url: first(a.profile_url, a.public_profile_url, profileUrl(a.public_identifier)) || '',
  });

  const asCandidate = (item, kind) => {
    const author = member(item.author || item.actor || item);
    const text = clean(first(item.text, item.comment, item.content, ''));
    const url = first(item.share_url, item.url, item.permalink, '') || '';
    return {
      source: 'linkedin', externalId: clean(first(item.id, item.social_id, item.urn, url)).slice(0, 120), signalKind: kind,
      authorName: author.name, authorRole: author.headline, authorUrl: author.url, providerId: author.providerId,
      text, url, signalAt: first(item.parsed_datetime, item.created_at, item.date, undefined),
    };
  };

  return {
    name: 'unipile',

    /** A page where the person logs in to LinkedIn. `notifyUrl` is told, from Unipile's server, which account id was created for `name`. */
    async hostedLink({ name, successUrl, failureUrl, notifyUrl }) {
      const d = await call('POST', '/hosted/accounts/link', { json: { type: 'create', providers: ['LINKEDIN'], api_url: root, expiresOn: new Date(Date.now() + 3600_000).toISOString(), name, success_redirect_url: successUrl, failure_redirect_url: failureUrl, notify_url: notifyUrl } });
      if (!d?.url) throw new ProviderError('no_link', { kind: 'unknown' });
      return d.url;
    },

    /** Is the account still logged in? -> { ok, name } */
    async account(accountId) {
      const d = await call('GET', `/accounts/${encodeURIComponent(accountId)}`);
      const sources = Array.isArray(d?.sources) ? d.sources : [];
      return { ok: !sources.length || sources.every(s => !s.status || /^(OK|RUNNING|CONNECTED)$/i.test(s.status)), name: clean(first(d?.name, d?.connection_params?.im?.username, '')) };
    },

    async disconnect(accountId) { await call('DELETE', `/accounts/${encodeURIComponent(accountId)}`); },

    /** Posts that match a phrase, newest first, from the connected account (the person's own search). */
    async search({ accountId, keywords, limit = 10 }) {
      const d = await call('POST', '/linkedin/search', { query: { account_id: accountId, limit }, json: { api: 'classic', category: 'posts', keywords: clean(keywords), date_posted: 'past_week', sort_by: 'date' } });
      return (d?.items || []).map(i => asCandidate(i, 'post')).filter(c => c.externalId && c.text.length >= 25);
    },

    /** People who reacted to or commented on the latest posts of a page or profile the person watches (a competitor, a creator). */
    async engagers({ accountId, pageUrl, posts = 3, limit = 20 }) {
      const id = publicId(pageUrl); if (!id) return [];
      const list = await call('GET', `/users/${encodeURIComponent(id)}/posts`, { query: { account_id: accountId, limit: posts } });
      const out = [];
      for (const p of (list?.items || []).slice(0, posts)) {
        const pid = first(p.id, p.social_id); if (!pid) continue;
        const [comments, reactions] = await Promise.all([
          call('GET', `/posts/${encodeURIComponent(pid)}/comments`, { query: { account_id: accountId, limit } }).catch(() => ({ items: [] })),
          call('GET', `/posts/${encodeURIComponent(pid)}/reactions`, { query: { account_id: accountId, limit } }).catch(() => ({ items: [] })),
        ]);
        const about = clean(first(p.text, '')).slice(0, 120);
        for (const c of comments?.items || []) { const a = asCandidate({ ...c, id: `c:${first(c.id, '')}:${pid}`, url: first(p.share_url, '') }, 'comment'); if (a.providerId || a.authorUrl) out.push({ ...a, text: `Commented on a post by ${publicId(pageUrl)} ("${about}"): ${a.text}`.slice(0, 1500) }); }
        for (const r of reactions?.items || []) { const a = asCandidate({ ...r, id: `r:${first(r.author?.id, r.id, '')}:${pid}`, text: '', url: first(p.share_url, '') }, 'like'); if (a.providerId || a.authorUrl) out.push({ ...a, text: `Reacted to a post by ${publicId(pageUrl)}: "${about}"`.slice(0, 1500) }); }
      }
      return out.filter(c => c.externalId).slice(0, limit * posts);
    },

    /** The LinkedIn member behind a profile address (needed to invite or message them). */
    async profile({ accountId, url }) {
      const id = publicId(url); if (!id) return null;
      const d = await call('GET', `/users/${encodeURIComponent(id)}`, { query: { account_id: accountId } });
      const m = member({ ...d, id: first(d?.provider_id, d?.id) });
      return { providerId: m.providerId, name: m.name, headline: m.headline, location: clean(first(d?.location, '')), distance: clean(first(d?.network_distance, '')) };
    },

    /** An invitation with a note. */
    async invite({ accountId, providerId, note }) { await call('POST', '/users/invite', { json: { account_id: accountId, provider_id: providerId, message: clean(note).slice(0, 200) } }); return { ok: true }; },

    /** A direct message to someone who is already connected. */
    async message({ accountId, providerId, text }) {
      const form = new FormData(); form.append('account_id', accountId); form.append('attendees_ids', providerId); form.append('text', String(text).slice(0, 2000));
      await call('POST', '/chats', { form }); return { ok: true };
    },

    /** Provider ids of the newest connections of the account (to notice who accepted an invitation). */
    async connections({ accountId, limit = 100 }) {
      const d = await call('GET', '/users/relations', { query: { account_id: accountId, limit } });
      return (d?.items || []).map(i => clean(first(i.member_id, i.provider_id, i.id))).filter(Boolean);
    },

    /** Messages received since a date: [{ senderId, text, at }]. */
    async incoming({ accountId, since }) {
      const d = await call('GET', '/messages', { query: { account_id: accountId, after: since, limit: 100 } });
      return (d?.items || []).filter(m => !(m.is_sender === 1 || m.is_sender === true)).map(m => ({ senderId: clean(first(m.sender_id, m.sender?.id)), text: clean(first(m.text, '')).slice(0, 500), at: first(m.timestamp, m.created_at, new Date().toISOString()) })).filter(m => m.senderId);
    },
  };
}
