// On a LinkedIn profile that the person queued from the app: opens the invitation (or the message) and types the text they approved.
// It runs only for a profile in the person's own queue, at most the daily limit they set, one at a time and with pauses.
// By default it stops with the text filled in and the person presses Send; with "send it for me" on, it presses Send too.
(function () {
  const L = window.OwnedMapLib;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a);
  async function until(fn, ms = 9000) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(250); } return null; }
  async function human(el) { el.scrollIntoView({ block: 'center' }); await sleep(rnd(500, 1400)); el.click(); await sleep(rnd(700, 1600)); }
  function type(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, text);
    else { document.execCommand('selectAll', false); document.execCommand('insertText', false, text); }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function run(job, auto) {
    let act = await until(() => { const a = L.profileAction(document); return a.kind === 'none' ? null : a; }, 12000);
    if (!act) return { result: 'failed', reason: 'no_buttons' };
    if (act.kind === 'pending') return { result: 'failed', reason: 'already_pending' };
    if (act.kind === 'more') {
      await human(act.el);
      const c = await until(() => L.menuConnect(document), 4000);
      if (!c) return { result: 'failed', reason: 'no_connect' };
      act = { kind: 'connect', el: c };
    }
    if (act.kind === 'message') {
      await human(act.el);
      const m = await until(() => { const x = L.messageBox(document); return x.box ? x : null; }, 8000);
      if (!m) return { result: 'failed', reason: 'no_composer' };
      type(m.box, job.text); await sleep(rnd(800, 1800));
      if (!auto) return { result: 'prefilled', kind: 'message' };
      const s = await until(() => L.messageBox(document).send, 4000); if (!s) return { result: 'prefilled', kind: 'message' };
      await human(s); return { result: 'sent', kind: 'message' };
    }
    await human(act.el);
    const d = await until(() => { const x = L.inviteDialog(document); return x.addNote || x.note ? x : null; }, 8000);
    if (!d) return { result: 'failed', reason: 'no_dialog' };
    if (!d.note) await human(d.addNote);
    const n = await until(() => L.inviteDialog(document).note, 5000);
    if (!n) return { result: 'failed', reason: 'no_note_option' }; // free accounts only get a few notes a month: a bare invitation is never sent on the person's behalf
    type(n, job.note); await sleep(rnd(800, 1800));
    if (!auto) return { result: 'prefilled', kind: 'invite' };
    const s = await until(() => L.inviteDialog(document).send, 4000); if (!s) return { result: 'prefilled', kind: 'invite' };
    await human(s); return { result: 'sent', kind: 'invite' };
  }

  chrome.runtime.sendMessage({ type: 'job', url: location.href }, async res => {
    if (!res?.job) return;
    let out; try { out = await run(res.job, !!res.auto); } catch { out = { result: 'failed', reason: 'error' }; }
    chrome.runtime.sendMessage({ type: 'result', id: res.job.id, ...out });
  });
})();
