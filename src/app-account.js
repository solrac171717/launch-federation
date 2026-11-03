// The profile menu, opened from the account card in the sidebar: who you are, password, preferences, plan and billing, sign out,
// and, at the very bottom, cancelling the subscription. Plans themselves are handled by app-billing.js; this is only the screen around them.
import { h } from './dom.js';

const PASSWORD_MIN = 10, PASSWORD_MAX = 72;

/** ctx: { cloud, openModal, modal, toast, message, billing, billingOn: () => boolean, signOut, who: () => { email, initials, role, admin, mine } } */
export function createAccountUi(ctx) {
  const { cloud, openModal, modal, toast, message, billing, signOut, who, support } = ctx;

  const busy = (b, on) => { b.disabled = on; b.classList.toggle('busy', on); };
  const button = (text, kind, fn) => {
    const b = h('button', { type: 'button', class: kind }, h('span', { class: 'lbl' }, text), h('span', { class: 'spin', 'aria-hidden': 'true' }));
    b.addEventListener('click', async () => { busy(b, true); try { await fn(); } finally { busy(b, false); } });
    return b;
  };
  const section = (title, ...kids) => h('section', { class: 'am-sec' }, h('h3', {}, title), ...kids);

  function passwordForm() {
    const pw = h('input', { id: 'am-pw', type: 'password', autocomplete: 'new-password', minlength: PASSWORD_MIN, maxlength: PASSWORD_MAX });
    const pw2 = h('input', { id: 'am-pw2', type: 'password', autocomplete: 'new-password', maxlength: PASSWORD_MAX });
    const err = h('p', { class: 'err form-err', id: 'am-pw-err', role: 'alert' });
    const submit = h('button', { type: 'submit', class: 'btn btn-dark btn-sm' }, h('span', { class: 'lbl' }, 'Update password'), h('span', { class: 'spin', 'aria-hidden': 'true' }));
    const form = h('form', { class: 'am-form asset-form', novalidate: true },
      h('div', { class: 'two' },
        h('div', { class: 'field' }, h('label', { for: 'am-pw' }, `New password (at least ${PASSWORD_MIN} characters)`), pw),
        h('div', { class: 'field' }, h('label', { for: 'am-pw2' }, 'Repeat the new password'), pw2)),
      err, h('div', { class: 'modal-actions am-left' }, submit));
    form.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      if (pw.value.length < PASSWORD_MIN) { err.textContent = `Use at least ${PASSWORD_MIN} characters.`; pw.focus(); return; }
      if (pw.value.length > PASSWORD_MAX) { err.textContent = `Use at most ${PASSWORD_MAX} characters.`; pw.focus(); return; }
      if (pw.value !== pw2.value) { err.textContent = 'The two passwords are different.'; pw2.focus(); return; }
      busy(submit, true);
      try { await cloud.updatePassword(pw.value); pw.value = ''; pw2.value = ''; toast('Password updated.'); }
      catch (x) { err.textContent = message(x) || 'Could not save the password.'; }
      finally { busy(submit, false); }
    });
    return form;
  }

  /** Plan and billing: where the plan stands, and the way into the plan screen. */
  function planSection(v) {
    if (v.state === 'comped') return section('Plan and billing', h('p', { class: 'am-line' }, v.label), h('p', { class: 'hint' }, 'Your account has unlimited access. There is nothing to pay.'));
    const sentence = v.state === 'trial' ? `Free trial: ${v.trialDaysLeft} day${v.trialDaysLeft === 1 ? '' : 's'} left. You are charged on ${v.renews} unless you cancel before.`
      : v.state === 'past_due' ? 'Your last payment failed. Update your card in Stripe to keep your plan.'
      : v.state === 'active' ? (v.cancelAtEnd ? `Your plan ends on ${v.renews}. You keep access until then.` : `Active. Next payment on ${v.renews}.`)
      : v.state === 'ended' ? 'Your plan has ended. Your assets are still here; choose a plan to add more.' : 'You are not on a plan yet.';
    const subscribed = ['trial', 'active', 'past_due'].includes(v.state);
    return section('Plan and billing',
      h('div', { class: 'am-plan' }, h('div', {}, h('p', { class: 'am-line' }, v.label), h('p', { class: 'hint' }, sentence, subscribed ? ` Using ${v.used} of ${v.allowed} assets.` : '')),
        h('button', { type: 'button', class: 'btn btn-dark btn-sm', id: 'plan-btn', onclick: () => billing.open() }, subscribed ? 'Manage plan' : 'Choose a plan')));
  }

  /** The very last thing in the menu. It explains what happens, asks once more, and then sends the person to Stripe, where the cancelling is done. */
  function cancelSection(v) {
    if (!['trial', 'active', 'past_due'].includes(v.state)) return null;
    const box = h('section', { class: 'am-sec am-danger' });
    const ask = () => {
      box.replaceChildren(h('h3', {}, 'Cancel subscription'),
        h('p', { class: 'am-line' }, v.state === 'trial' ? 'Cancel before the trial ends and you will not be charged.' : `You keep access until ${v.renews}.`),
        h('p', { class: 'hint' }, 'Nothing is deleted: your assets, documents and reports stay here. You only cannot add more assets after the plan ends. You will confirm on Stripe’s page.'),
        h('div', { class: 'modal-actions am-left' },
          h('button', { type: 'button', class: 'btn btn-dark btn-sm', id: 'am-keep', onclick: rest }, 'Keep my plan'),
          button('Continue to Stripe', 'btn btn-primary btn-sm danger-fill', () => billing.portal())));
    };
    const rest = () => {
      box.replaceChildren(h('h3', {}, 'Cancel subscription'),
        v.cancelAtEnd ? h('p', { class: 'hint' }, `Your plan is set to end on ${v.renews}. You can undo that in Stripe.`) : h('p', { class: 'hint' }, v.state === 'trial' ? 'Not ready to pay? Cancel during the trial and nothing is charged.' : 'You keep access until the end of the period you paid for.'),
        h('div', { class: 'modal-actions am-left' }, v.cancelAtEnd ? button('Manage in Stripe', 'btn btn-dark btn-sm', () => billing.portal()) : h('button', { type: 'button', class: 'btn btn-ghost-danger btn-sm', id: 'am-cancel', onclick: ask }, 'Cancel subscription')));
    };
    rest(); return box;
  }

  function open() {
    const me = who(), v = billing.view(), plans = me.mine && ctx.billingOn();
    const cancel = plans ? cancelSection(v) : null;
    openModal(h('div', { class: 'modal-card wide acct-modal' },
      h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, 'Your account'), h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onclick: () => modal().close() }, '×')),
      h('div', { class: 'am-id' }, h('span', { class: 'acct-av' + (me.admin ? ' admin' : ''), 'aria-hidden': 'true' }, me.initials),
        h('div', {}, h('b', { class: 'am-email' }, me.email), h('span', { class: 'acct-role' + (me.admin ? ' admin' : '') }, me.role)),
        h('button', { type: 'button', class: 'btn btn-dark btn-sm am-out', id: 'am-signout', onclick: () => signOut() }, 'Sign out')),
      section('Password', h('p', { class: 'hint' }, 'Choose a new password for signing in with your email.'), passwordForm()),
      section('Preferences',
        h('div', { class: 'asset-form am-lang' }, h('div', { class: 'field' }, h('label', { for: 'am-lang' }, 'Language'),
          h('select', { id: 'am-lang', disabled: true, 'aria-describedby': 'am-lang-hint' }, h('option', {}, 'English')),
          h('p', { class: 'hint', id: 'am-lang-hint' }, 'More languages are coming. For now Owned Map is in English.')))),
      ...(plans ? [planSection(v)] : []),
      section('Help', h('p', { class: 'hint' }, 'A question, a problem or an idea? We read every message.'),
        h('div', { class: 'modal-actions am-left' }, h('a', { class: 'btn btn-dark btn-sm', id: 'am-support', href: support().href }, `Email ${support().email}`))),
      ...(cancel ? [cancel] : [])));
  }
  return { open };
}
