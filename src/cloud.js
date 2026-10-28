// Minimal Supabase client (no SDK): email magic-link sign-in + the PostgREST calls ATLAS needs.
// Only the public anon key lives in the browser; every row is protected by Row Level Security
// (see supabase/assets.sql), so a user can only ever read and write their own assets.
export class CloudError extends Error {
  constructor(message, { status = 0, code = '' } = {}) { super(message); this.name = 'CloudError'; this.status = status; this.code = code; }
}

const SESSION_KEY = 'atlas.session.v1';

export function createCloud({ url, anonKey, storage = globalThis.localStorage, fetchImpl = (...a) => globalThis.fetch(...a), location = globalThis.location, history = globalThis.history, now = () => Date.now() }) {
  const base = String(url || '').replace(/\/$/, '');
  const listeners = new Set();
  let session = null;

  const readStore = () => { try { return JSON.parse(storage.getItem(SESSION_KEY) || 'null'); } catch { return null; } };
  const writeStore = v => { try { v ? storage.setItem(SESSION_KEY, JSON.stringify(v)) : storage.removeItem(SESSION_KEY); } catch { /* private mode: session lives in memory */ } };
  const emit = () => listeners.forEach(f => { try { f(session); } catch { /* listener errors must not break auth */ } });
  const setSession = v => { session = v; writeStore(v); emit(); };
  session = readStore();
  // another tab signed in or out: follow it, so a signed-out tab never keeps showing someone's assets
  try { globalThis.addEventListener?.('storage', e => { if (e.key === SESSION_KEY) { session = readStore(); emit(); } }); } catch { /* no window */ }

  async function call(path, { method = 'GET', body, token, headers = {}, raw = false } = {}) {
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: { apikey: anonKey, authorization: `Bearer ${token || anonKey}`, ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}), ...headers },
        body: body !== undefined ? (raw ? body : JSON.stringify(body)) : undefined,
      });
    } catch { throw new CloudError('Could not reach the server. Check your connection and try again.', { code: 'network' }); }
    const text = await res.text().catch(() => '');
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const code = data?.error_code || data?.code || '';
      const msg = data?.msg || data?.message || data?.error_description || data?.error || `Request failed (${res.status})`;
      throw new CloudError(friendly(res.status, code, msg), { status: res.status, code });
    }
    return data;
  }

  function friendly(status, code, msg) {
    if (code === 'over_email_send_rate_limit' || status === 429) return 'Too many sign-in emails were requested. Wait a few minutes and try again.';
    if (code === 'validation_failed' || /valid email/i.test(msg)) return 'Enter a valid email address.';
    if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.';
    return msg;
  }

  const expiresSoon = s => !s || (s.expires_at * 1000 - now() < 60_000);

  async function refresh() {
    if (!session?.refresh_token) throw new CloudError('Your session has expired. Please sign in again.', { status: 401 });
    try {
      const d = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
      setSession(fromTokenResponse(d));
    } catch (e) { if (e.status === 400 || e.status === 401 || e.status === 403) setSession(null); throw e; }
  }

  function fromTokenResponse(d) {
    return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(now() / 1000) + (d.expires_in || 3600), user: d.user || session?.user || null };
  }

  async function token() {
    if (!session) throw new CloudError('Please sign in.', { status: 401 });
    if (expiresSoon(session)) await refresh();
    return session.access_token;
  }

  const encPath = p => String(p).split('/').map(encodeURIComponent).join('/');
  /** Runs a call with the user token; if the server says it expired, refreshes once and retries. */
  async function authed(fn) {
    try { return await fn(await token()); }
    catch (e) { if (e.status === 401 && session?.refresh_token) { await refresh(); return fn(await token()); } throw e; }
  }

  return {
    configured: Boolean(base && anonKey),
    session: () => session,
    user: () => session?.user || null,
    onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Sends a magic link to the email. The link returns the user to `redirectTo` with the session in the URL hash. */
    async signInWithEmail(email, redirectTo) {
      const q = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
      await call(`/auth/v1/otp${q}`, { method: 'POST', body: { email: String(email).trim().toLowerCase(), create_user: true } });
    },

    /** Call once on load: finishes a magic-link sign-in if the URL carries a session (or an error). */
    async consumeRedirect() {
      const hash = (location?.hash || '').replace(/^#/, '');
      if (!hash || !/(access_token|error_description|error_code)=/.test(hash)) return { signedIn: false };
      const p = new URLSearchParams(hash);
      const clean = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ } };
      if (p.get('error_description') || p.get('error_code')) {
        clean();
        const code = p.get('error_code') || '';
        return { signedIn: false, error: code === 'otp_expired' ? 'That sign-in link has expired. Request a new one.' : (p.get('error_description') || 'Sign-in failed.').replace(/\+/g, ' ') };
      }
      const at = p.get('access_token'), rt = p.get('refresh_token');
      if (!at || !rt) { clean(); return { signedIn: false, error: 'The sign-in link is incomplete. Request a new one.' }; }
      const user = await call('/auth/v1/user', { token: at });
      setSession({ access_token: at, refresh_token: rt, expires_at: Number(p.get('expires_at')) || Math.floor(now() / 1000) + (Number(p.get('expires_in')) || 3600), user });
      clean();
      return { signedIn: true };
    },

    async signOut() {
      const s = session; setSession(null);
      if (s?.access_token) { try { await call('/auth/v1/logout', { method: 'POST', token: s.access_token }); } catch { /* the local session is already gone */ } }
    },

    /** Authenticated PostgREST request. Refreshes the token once if the server says it expired. */
    async rest(method, path, body, headers = {}) { return authed(t => call(`/rest/v1${path}`, { method, body, token: t, headers })); },

    /** Private file storage (bucket policies keep every user inside their own folder). */
    async upload(bucket, path, blob, mime) {
      return authed(t => call(`/storage/v1/object/${bucket}/${encPath(path)}`, { method: 'POST', body: blob, raw: true, token: t, headers: { 'content-type': mime || 'application/octet-stream', 'x-upsert': 'false' } }));
    },
    async removeObject(bucket, path) { return authed(t => call(`/storage/v1/object/${bucket}/${encPath(path)}`, { method: 'DELETE', token: t })); },
    /** A temporary link to a private file. */
    async signedUrl(bucket, path, seconds = 600) {
      const d = await authed(t => call(`/storage/v1/object/sign/${bucket}/${encPath(path)}`, { method: 'POST', body: { expiresIn: seconds }, token: t }));
      const u = String(d?.signedURL || d?.signedUrl || '');
      if (!u) throw new CloudError('Could not open the file.');
      return /^https?:/.test(u) ? u : `${base}/storage/v1${u.startsWith('/storage/v1') ? u.slice(11) : u}`;
    },
  };
}
