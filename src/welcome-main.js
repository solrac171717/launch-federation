// welcome.html: where Stripe sends people after they start the free trial. The account was created from the email they typed at checkout;
// here they choose its password (once), and go straight into the app.
import { CONFIG } from '../assets/config.js';
import { h } from './dom.js';
import { createCloud } from './cloud.js';

const PASSWORD_MIN = 10, SUPPORT = 'support@ownedmap.com';
const card = document.getElementById('invite-card');
const cloud = createCloud({ url: CONFIG.supabaseUrl, anonKey: CONFIG.supabaseAnonKey });
const logo = h('a', { class: 'logo', href: 'index.html', 'aria-label': 'Owned Map website' }, h('span', { class: 'lmark', style: '--s:34px', 'aria-hidden': 'true' }, h('img', { src: 'assets/logo-o.png', alt: '', width: 192, height: 192 })), h('span', {}, 'OWNED MAP'));
const frame = (...kids) => card.replaceChildren(logo, ...kids);
const say = (title, text, ...more) => frame(h('h1', { id: 'invite-title' }, title), h('p', { class: 'auth-sub' }, text), ...more);
const signIn = label => h('a', { class: 'btn btn-primary btn-lg block', href: 'app.html' }, label);

async function api(body) {
  const r = await fetch('/api/welcome', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'failed'); e.status = r.status; e.code = data.error; throw e; }
  return data;
}

async function start() {
  const KEY = 'om.checkout'; let sessionId = new URLSearchParams(location.search).get('session_id');
  try { if (sessionId) sessionStorage.setItem(KEY, sessionId); else sessionId = sessionStorage.getItem(KEY); } catch { /* private mode: reloading the page loses it */ }
  if (!sessionId) return say('This page needs a checkout', 'Start your free trial from the website.', signIn('Go to sign in'));
  history.replaceState(null, '', location.pathname); // the session id does not stay in the address bar or the history
  let info; // the payment can take a few seconds to reach us, and a server hiccup can happen: try a few times before giving up
  for (let i = 0; i < 6 && !info; i++) {
    try { info = await api({ action: 'preview', sessionId }); }
    catch (e) {
      if (i < 5) { await new Promise(r => setTimeout(r, 1500)); continue; }
      if (e.status === 404) return say('We could not confirm this checkout', 'The link may be old. If you completed the payment, sign in with the email you used, or ask for a new password on the sign-in page.', signIn('Go to sign in'));
      return say('We are finishing your account', `Your payment went through, but your account is taking longer than usual to open. Reload this page in a minute. If it still does not open, write to ${SUPPORT} and we will open it for you; you are not charged until your trial ends.`, signIn('Go to sign in'));
    }
  }
  if (info.duplicate) return say('You already have a plan', `${info.email} already has an account with a plan, so we cancelled this second trial and you will not be charged for it. Sign in with your usual password, or use “Forgot your password?” on the sign-in page.`, signIn('Go to sign in'));
  if (!info.canChoosePassword) {
    return say(info.claimed ? 'Your account is ready' : 'Your trial has started', info.claimed ? `Sign in with ${info.email} and the password you chose.` : `${info.email} already has an account, and your plan is now on it. Sign in with your usual password, or use “Forgot your password?” on the sign-in page.`, signIn('Go to sign in'));
  }
  const err = h('p', { class: 'err', role: 'alert' });
  const pw = h('input', { id: 'wl-pw', type: 'password', autocomplete: 'new-password', minlength: PASSWORD_MIN }), pw2 = h('input', { id: 'wl-pw2', type: 'password', autocomplete: 'new-password' });
  const btn = h('button', { class: 'btn btn-primary btn-lg block', type: 'submit' }, h('span', { class: 'lbl' }, 'Open my account'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
  const form = h('form', { novalidate: true, id: 'wl-form' },
    h('div', { class: 'field' }, h('label', { for: 'wl-email' }, 'Email'), h('input', { id: 'wl-email', type: 'email', value: info.email, readonly: true, autocomplete: 'username' })),
    h('div', { class: 'field' }, h('label', { for: 'wl-pw' }, `Choose a password (at least ${PASSWORD_MIN} characters)`), pw),
    h('div', { class: 'field' }, h('label', { for: 'wl-pw2' }, 'Repeat the password'), pw2, err), btn);
  form.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = '';
    if (pw.value.length < PASSWORD_MIN) { err.textContent = `Use at least ${PASSWORD_MIN} characters.`; pw.focus(); return; }
    if (pw.value !== pw2.value) { err.textContent = 'The two passwords are different.'; pw2.focus(); return; }
    btn.disabled = true; btn.classList.add('busy'); btn.querySelector('.lbl').textContent = 'Opening your account…';
    try {
      await api({ action: 'claim', sessionId, password: pw.value });
      try { await cloud.signInWithPassword(info.email, pw.value); } catch { /* the password is set; the sign-in page takes it from here */ }
      location.replace('app.html');
    }
    catch (x) {
      err.textContent = x.code === 'already_claimed' ? 'This account already has a password. Sign in instead.' : (x.message === 'failed' || /^[a-z_]+$/.test(x.message || '') ? 'Could not set the password. Please try again.' : x.message);
      btn.disabled = false; btn.classList.remove('busy'); btn.querySelector('.lbl').textContent = 'Open my account';
    }
  });
  frame(h('h1', { id: 'invite-title' }, 'Your 7-day trial has started'), h('p', { class: 'auth-sub' }, 'Choose a password for your account and you are in. Your card is charged only when the trial ends, and you can cancel before then from Plan and billing.'), form);
}
start();
