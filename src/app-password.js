// The screen after following the link of a password-reset email: choose a new password. The link signed the person in, so this only sets the new one.
import { h } from './dom.js';

const PASSWORD_MIN = 10;

export function showSetPassword({ cloud, show, done }) {
  const card = document.getElementById('invite-card');
  const logo = h('a', { class: 'logo', href: 'index.html', 'aria-label': 'Owned Map, back to the website' }, h('span', { class: 'lmark', style: '--s:34px', 'aria-hidden': 'true' }, h('img', { src: 'assets/logo-o.png', alt: '', width: 192, height: 192 })), h('span', {}, 'OWNED MAP'));
  const err = h('p', { class: 'err', id: 'invite-err', role: 'alert' });
  const pw = h('input', { id: 'np-pw', type: 'password', autocomplete: 'new-password', minlength: PASSWORD_MIN }), pw2 = h('input', { id: 'np-pw2', type: 'password', autocomplete: 'new-password' });
  const btn = h('button', { class: 'btn btn-primary btn-lg block', type: 'submit' }, h('span', { class: 'lbl' }, 'Save the new password'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
  const form = h('form', { novalidate: true },
    h('div', { class: 'field' }, h('label', { for: 'np-pw' }, `New password (at least ${PASSWORD_MIN} characters)`), pw),
    h('div', { class: 'field' }, h('label', { for: 'np-pw2' }, 'Repeat the new password'), pw2, err), btn);
  form.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = '';
    if (pw.value.length < PASSWORD_MIN) { err.textContent = `Use at least ${PASSWORD_MIN} characters.`; pw.focus(); return; }
    if (pw.value !== pw2.value) { err.textContent = 'The two passwords are different.'; pw2.focus(); return; }
    btn.disabled = true; btn.classList.add('busy');
    try { await cloud.updatePassword(pw.value); done(); }
    catch (x) { err.textContent = x.message || 'Could not save the password.'; btn.disabled = false; btn.classList.remove('busy'); }
  });
  card.replaceChildren(logo, h('h1', { id: 'invite-title' }, 'Choose a new password'), h('p', { class: 'auth-sub' }, 'Then you go straight to your portfolio.'), form);
  show('invite');
}
