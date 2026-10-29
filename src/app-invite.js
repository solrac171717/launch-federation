// The screen a person sees when they open an invitation link (app.html#invite=<secret>).
// New to Owned Map: they choose a password and the account is created for the invited email.
// Already have an account: they sign in and join. Either way they end up in the dashboard, looking at the inviter's portfolio.
import { h } from './dom.js';
import { ROLES, saveAccount } from './app-members.js';

const PASSWORD_MIN = 10;
const ROLE_LINE = { view: 'look at', edit: 'look at and make changes to' };

/** deps: { cloud, token, show, done } where done() reloads into the app */
export async function showInvite({ cloud, token, show, done }) {
  const card = document.getElementById('invite-card');
  const logo = h('a', { class: 'logo', href: 'index.html', 'aria-label': 'Owned Map, back to the website' }, h('span', { class: 'lmark', style: '--s:34px', 'aria-hidden': 'true' }, h('img', { src: 'assets/logo-o.png', alt: '', width: 192, height: 192 })), h('span', {}, 'OWNED MAP'));
  const frame = (...kids) => { card.replaceChildren(logo, ...kids); show('invite'); };
  const field = (id, label, input, extra) => h('div', { class: 'field' }, h('label', { for: id }, label), input, extra);
  const button = text => h('button', { class: 'btn btn-primary btn-lg block', type: 'submit' }, h('span', { class: 'lbl' }, text), h('span', { class: 'spin', 'aria-hidden': 'true' }));
  const busy = (btn, on, text) => { btn.disabled = on; btn.classList.toggle('busy', on); btn.querySelector('.lbl').textContent = text; };
  const err = h('p', { class: 'err', id: 'invite-err', role: 'alert' });

  frame(h('h1', { id: 'invite-title' }, 'Opening your invitation…'));
  let info;
  try { info = await cloud.invite({ action: 'preview', token }); }
  catch (e) {
    frame(h('h1', { id: 'invite-title' }, 'This invitation is not valid'), h('p', { class: 'auth-sub' }, e.status === 404 ? 'It may have expired, been used already or been cancelled. Ask the person who invited you to send a new one.' : (e.message || 'Something went wrong.')), h('p', { class: 'auth-foot' }, h('a', { href: 'app.html' }, 'Go to sign in')));
    return;
  }
  const intro = h('p', { class: 'auth-sub' }, `${info.ownerEmail || 'Someone'} invited you to ${ROLE_LINE[info.role] || 'see'} their portfolio. Access: ${ROLES[info.role] || info.role}.`);
  const joined = async res => { saveAccount(cloud.user().id, res.ownerId); history.replaceState(null, '', location.pathname); done(); };

  // already signed in
  const me = cloud.user();
  if (me && cloud.session()) {
    if (String(me.email || '').toLowerCase() !== info.email) {
      const out = h('button', { type: 'button', class: 'btn btn-dark btn-lg block', onclick: async () => { await cloud.signOut(); location.reload(); } }, 'Sign out and continue');
      frame(h('h1', { id: 'invite-title' }, 'Use the invited account'), h('p', { class: 'auth-sub' }, `This invitation is for ${info.email}, but you are signed in as ${me.email}. Sign out, then open the link again.`), out);
      return;
    }
    const form = h('form', { novalidate: true }, err, button('Join'));
    form.addEventListener('submit', async e => {
      e.preventDefault(); const b = form.querySelector('button'); busy(b, true, 'Joining…'); err.textContent = '';
      try { await joined(await cloud.invite({ action: 'accept', token }, { signedIn: true })); } catch (x) { err.textContent = x.message || 'Could not join.'; busy(b, false, 'Join'); }
    });
    frame(h('h1', { id: 'invite-title' }, 'Join the portfolio'), intro, form);
    return;
  }

  // not signed in: new account first; if the email already has one, switch to signing in
  const emailBox = h('input', { id: 'inv-email', type: 'email', value: info.email, readonly: true, autocomplete: 'username' });
  const pw = h('input', { id: 'inv-pw', type: 'password', autocomplete: 'new-password', minlength: PASSWORD_MIN });
  const pw2 = h('input', { id: 'inv-pw2', type: 'password', autocomplete: 'new-password' });

  const signInMode = () => {
    const pass = h('input', { id: 'inv-pass', type: 'password', autocomplete: 'current-password' });
    const form = h('form', { novalidate: true }, field('inv-email', 'Email', emailBox), field('inv-pass', 'Your password', pass, err), button('Sign in and join'));
    form.addEventListener('submit', async e => {
      e.preventDefault(); const b = form.querySelector('button'); err.textContent = '';
      if (!pass.value) { err.textContent = 'Enter your password.'; pass.focus(); return; }
      busy(b, true, 'Signing in…');
      try { await cloud.signInWithPassword(info.email, pass.value); await joined(await cloud.invite({ action: 'accept', token }, { signedIn: true })); }
      catch (x) { err.textContent = x.message || 'Could not sign in.'; pass.value = ''; busy(b, false, 'Sign in and join'); }
    });
    frame(h('h1', { id: 'invite-title' }, 'You already have an account'), h('p', { class: 'auth-sub' }, `${info.email} is already registered. Sign in to join ${info.ownerEmail || 'the portfolio'}.`), form);
  };

  const form = h('form', { novalidate: true }, field('inv-email', 'Email', emailBox), field('inv-pw', `Choose a password (at least ${PASSWORD_MIN} characters)`, pw), field('inv-pw2', 'Repeat the password', pw2, err), button('Create my account and join'));
  form.addEventListener('submit', async e => {
    e.preventDefault(); const b = form.querySelector('button'); err.textContent = '';
    if (pw.value.length < PASSWORD_MIN) { err.textContent = `Use at least ${PASSWORD_MIN} characters.`; pw.focus(); return; }
    if (pw.value !== pw2.value) { err.textContent = 'The two passwords are different.'; pw2.focus(); return; }
    busy(b, true, 'Creating your account…');
    try {
      const res = await cloud.invite({ action: 'accept', token, password: pw.value });
      await cloud.signInWithPassword(info.email, pw.value);
      await joined(res);
    } catch (x) {
      if (x.status === 409) { signInMode(); return; }
      err.textContent = x.message || 'Could not create the account.'; busy(b, false, 'Create my account and join');
    }
  });
  frame(h('h1', { id: 'invite-title' }, 'You are invited'), intro, form, h('p', { class: 'auth-legal' }, 'By continuing you agree to our ', h('a', { href: 'terms.html' }, 'Terms'), ' and ', h('a', { href: 'privacy.html' }, 'Privacy Policy'), '.'));
}
