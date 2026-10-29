import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runInvite, PASSWORD_MIN } from '../api/invite.js';
import { inviteTokenOf, inviteUrl, accessFor, pickAccount, inviteState, validEmail, savedAccount, saveAccount } from '../src/app-members.js';

const TOKEN = 'A'.repeat(43), HASH = createHash('sha256').update(TOKEN).digest('hex');
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
const inviteRow = (over = {}) => ({ id: 'm1', owner_id: 'o1', owner_email: 'host@x.test', email: 'guest@x.test', role: 'edit', status: 'invited', invite_expires_at: new Date(Date.now() + 86400000).toISOString(), ...over });

/** A fake Supabase: records every call, answers from the options. */
function fake({ row = inviteRow(), userFor = null, createStatus = 200, patchOk = true } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path: u.pathname + u.search, method: init.method || 'GET', body, auth: init.headers?.authorization });
    const ok = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) });
    if (u.pathname === '/rest/v1/account_members' && (init.method || 'GET') === 'GET') return ok(u.search.includes(HASH) && row ? [row] : []);
    if (u.pathname === '/rest/v1/account_members' && init.method === 'PATCH') return patchOk ? ok([]) : ok({}, 500);
    if (u.pathname === '/auth/v1/user') return userFor ? ok(userFor) : ok({}, 401);
    if (u.pathname === '/auth/v1/admin/users') return createStatus === 200 ? ok({ id: 'new-user' }) : ok({ error_code: 'email_exists' }, createStatus);
    return ok({}, 404);
  };
  return { fetchImpl, calls };
}

test('preview names the inviter, the email and the role, and nothing else', async () => {
  const { fetchImpl } = fake();
  const r = await runInvite({ env: ENV, fetchImpl, action: 'preview', token: TOKEN });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ownerEmail: 'host@x.test', email: 'guest@x.test', role: 'edit' });
});

test('unknown, malformed, expired and already used invitations all answer the same 404', async () => {
  const same = { status: 404, body: { error: 'not_found' } };
  assert.deepEqual(await runInvite({ env: ENV, fetchImpl: fake().fetchImpl, action: 'preview', token: 'short' }), same);
  assert.deepEqual(await runInvite({ env: ENV, fetchImpl: fake({ row: null }).fetchImpl, action: 'preview', token: TOKEN }), same);
  assert.deepEqual(await runInvite({ env: ENV, fetchImpl: fake({ row: inviteRow({ invite_expires_at: new Date(Date.now() - 1000).toISOString() }) }).fetchImpl, action: 'preview', token: TOKEN }), same);
  assert.deepEqual(await runInvite({ env: ENV, fetchImpl: fake({ row: inviteRow({ status: 'active' }) }).fetchImpl, action: 'preview', token: TOKEN }), same);
});

test('only the hash of the secret is looked up, never the secret', async () => {
  const { fetchImpl, calls } = fake();
  await runInvite({ env: ENV, fetchImpl, action: 'preview', token: TOKEN });
  assert.ok(calls[0].path.includes(HASH));
  assert.ok(!JSON.stringify(calls).includes(TOKEN));
});

test('a new person chooses a password: the account is created for the invited email and joins as invited', async () => {
  const { fetchImpl, calls } = fake();
  const r = await runInvite({ env: ENV, fetchImpl, action: 'accept', token: TOKEN, password: 'a-good-password' });
  assert.equal(r.status, 200); assert.equal(r.body.ownerId, 'o1');
  const create = calls.find(c => c.path === '/auth/v1/admin/users');
  assert.deepEqual(create.body, { email: 'guest@x.test', password: 'a-good-password', email_confirm: true });
  const patch = calls.find(c => c.method === 'PATCH');
  assert.equal(patch.body.member_id, 'new-user'); assert.equal(patch.body.status, 'active'); assert.equal(patch.body.invite_hash, null);
  assert.ok(patch.path.includes('status=eq.invited'), 'an invitation can only be used once');
});

test('weak and oversized passwords are refused before anything is created', async () => {
  const { fetchImpl, calls } = fake();
  assert.equal((await runInvite({ env: ENV, fetchImpl, action: 'accept', token: TOKEN, password: 'x'.repeat(PASSWORD_MIN - 1) })).body.error, 'weak_password');
  assert.equal((await runInvite({ env: ENV, fetchImpl, action: 'accept', token: TOKEN, password: 'x'.repeat(73) })).body.error, 'password_too_long');
  assert.ok(!calls.some(c => c.path === '/auth/v1/admin/users'));
});

test('an email that already has an account is told to sign in (409), without changing it', async () => {
  const { fetchImpl, calls } = fake({ createStatus: 422 });
  const r = await runInvite({ env: ENV, fetchImpl, action: 'accept', token: TOKEN, password: 'a-good-password' });
  assert.equal(r.status, 409); assert.equal(r.body.error, 'account_exists');
  assert.ok(!calls.some(c => c.method === 'PATCH'));
});

test('a signed-in user joins only if their email is the invited one', async () => {
  let f = fake({ userFor: { id: 'u9', email: 'Guest@X.test' } });
  assert.equal((await runInvite({ env: ENV, fetchImpl: f.fetchImpl, action: 'accept', token: TOKEN, bearer: 'session' })).status, 200);
  assert.equal(f.calls.find(c => c.method === 'PATCH').body.member_id, 'u9');
  f = fake({ userFor: { id: 'u9', email: 'someone.else@x.test' } });
  const wrong = await runInvite({ env: ENV, fetchImpl: f.fetchImpl, action: 'accept', token: TOKEN, bearer: 'session' });
  assert.equal(wrong.status, 403); assert.ok(!f.calls.some(c => c.method === 'PATCH'));
  f = fake({ userFor: null });
  assert.equal((await runInvite({ env: ENV, fetchImpl: f.fetchImpl, action: 'accept', token: TOKEN, bearer: 'bad' })).status, 401);
});

test('without the service key the endpoint is off', async () => {
  assert.equal((await runInvite({ env: {}, fetchImpl: fake().fetchImpl, action: 'preview', token: TOKEN })).status, 503);
});

test('invite links: build and read back, and only a well-formed secret counts', () => {
  assert.equal(inviteUrl(TOKEN, 'https://a.test'), `https://a.test/app.html#invite=${TOKEN}`);
  assert.equal(inviteTokenOf(`#invite=${TOKEN}`), TOKEN);
  assert.equal(inviteTokenOf('#invite=short'), null);
  assert.equal(inviteTokenOf('#access_token=abc'), null);
});

test('what each kind of access may do', () => {
  assert.deepEqual(accessFor('view'), { edit: false, docs: false, share: false, emergency: false, welcome: false, sample: false });
  const edit = accessFor('edit');
  assert.ok(edit.edit && edit.docs && !edit.share && !edit.emergency, 'an editor edits but does not share or print the owner emergency sheet');
  assert.ok(Object.values(accessFor('owner')).every(Boolean));
});

test('which portfolio opens: the remembered shared one only while access lasts, otherwise your own', () => {
  const shared = [{ ownerId: 'o1', ownerEmail: 'host@x.test', role: 'view' }];
  assert.equal(pickAccount('me', 'me@x.test', shared, 'o1').ownerId, 'o1');
  assert.equal(pickAccount('me', 'me@x.test', shared, 'o1').mine, false);
  assert.equal(pickAccount('me', 'me@x.test', [], 'o1').ownerId, 'me');
  assert.equal(pickAccount('me', 'me@x.test', shared, '').role, 'owner');
});

test('the chosen portfolio is remembered per user and forgotten when you go back to your own', () => {
  const st = new Map(), storage = { getItem: k => st.get(k) ?? null, setItem: (k, v) => st.set(k, v), removeItem: k => st.delete(k) };
  saveAccount('me', 'o1', storage); assert.equal(savedAccount('me', storage), 'o1'); assert.equal(savedAccount('other', storage), '');
  saveAccount('me', '', storage); assert.equal(savedAccount('me', storage), '');
});

test('invitation states and email check', () => {
  const now = Date.parse('2026-11-01T00:00:00Z');
  assert.equal(inviteState({ status: 'active' }, now), 'active');
  assert.equal(inviteState({ status: 'invited', expiresAt: '2026-11-08T00:00:00Z' }, now), 'pending');
  assert.equal(inviteState({ status: 'invited', expiresAt: '2026-10-31T00:00:00Z' }, now), 'expired');
  assert.ok(validEmail('a@b.co') && !validEmail('nope') && !validEmail('a@b'));
});
