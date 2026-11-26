// Reading what LinkedIn already shows on the page. Pure functions over the DOM: nothing here clicks, scrolls, types or sends anything.
// LinkedIn changes its markup often, so every field tries a few selectors and a missing one is left empty rather than guessed.
// If a field stops coming through, this is the only file to adjust (see README.md).
(function (root) {
  const first = (el, sels) => { for (const s of sels) { const n = el.querySelector(s); if (n && n.textContent.trim()) return n; } return null; };
  const clean = t => String(t || '').replace(/\s+/g, ' ').trim();

  const POST = ['[data-urn^="urn:li:activity:"]', '[data-id^="urn:li:activity:"]', 'div.feed-shared-update-v2', 'li.reusable-search__result-container [data-urn]'];
  const TEXT = ['.update-components-text', '.feed-shared-update-v2__description', '.feed-shared-text', '[data-test-id="main-feed-activity-card__commentary"]', '.break-words'];
  const NAME = ['.update-components-actor__title span[aria-hidden="true"]', '.update-components-actor__name span[aria-hidden="true"]', '.update-components-actor__title', '.feed-shared-actor__name'];
  const HEADLINE = ['.update-components-actor__description span[aria-hidden="true"]', '.update-components-actor__description', '.feed-shared-actor__description'];
  const LOCATION = ['.text-body-small.inline.t-black--light.break-words', 'main section .text-body-small.t-black--light', '[data-generated-suggestion-target] + div .text-body-small'];

  /** The posts in view: [{ externalId, authorName, authorRole, authorUrl, text, url }]. Posts without enough text, or without an id, are skipped. */
  function extractPosts(doc) {
    const seen = new Set(), out = [];
    for (const sel of POST) for (const el of doc.querySelectorAll(sel)) {
      const urn = el.getAttribute('data-urn') || el.getAttribute('data-id') || '';
      if (!/^urn:li:(activity|ugcPost|share):\d+/.test(urn) || seen.has(urn)) continue;
      const text = clean((first(el, TEXT) || {}).textContent);
      if (text.length < 25) continue;
      seen.add(urn);
      const link = el.querySelector('a[href*="/in/"]');
      out.push({
        externalId: urn, text: text.slice(0, 1500),
        authorName: clean((first(el, NAME) || {}).textContent).slice(0, 120), authorRole: clean((first(el, HEADLINE) || {}).textContent).slice(0, 160),
        authorUrl: link ? new URL(link.getAttribute('href'), 'https://www.linkedin.com').href.split('?')[0] : '',
        url: `https://www.linkedin.com/feed/update/${urn}/`,
      });
    }
    return out;
  }

  /** The place written on the top card of a profile page ("Austin, Texas, United States"), or ''. */
  function extractLocation(doc) {
    const n = first(doc, LOCATION); const t = n ? clean(n.textContent) : '';
    return t.length >= 2 && t.length <= 120 && !/connections?|followers?|contact info/i.test(t) ? t : '';
  }

  /* ---- the buttons on a profile (used only for a lead the person queued themselves) ---- */
  const label = el => clean(el.getAttribute('aria-label') || el.textContent).toLowerCase();
  const clickables = scope => [...scope.querySelectorAll('button, a[role="button"], div[role="button"], [role="menuitem"]')].filter(b => !b.disabled && b.getAttribute('aria-disabled') !== 'true');
  const pick = (scope, test) => clickables(scope).find(b => test(label(b)));
  /** 'pending', 'connect' (a Connect button in view), 'message' (already connected), 'more' (Connect may be under More) or 'none'. */
  function profileAction(doc) {
    const top = doc.querySelector('main') || doc;
    if (pick(top, l => /^pending\b|^withdraw/.test(l))) return { kind: 'pending' };
    const connect = pick(top, l => /^connect$|^invite .* to connect/.test(l));
    if (connect) return { kind: 'connect', el: connect };
    const message = pick(top, l => /^message\b/.test(l));
    if (message) return { kind: 'message', el: message };
    const more = pick(top, l => /^more( actions)?$/.test(l));
    return more ? { kind: 'more', el: more } : { kind: 'none' };
  }
  /** With the More menu open: its Connect entry. */
  const menuConnect = doc => pick(doc, l => /^connect$|^invite .* to connect/.test(l));
  /** The pieces of the invitation dialog: the Add a note button, the note box, the Send button. */
  function inviteDialog(doc) {
    const d = doc.querySelector('[role="dialog"]') || doc;
    return { addNote: pick(d, l => /^add a note/.test(l)), note: d.querySelector('textarea#custom-message, textarea[name="message"], textarea'), send: pick(d, l => /^send( invitation| now)?$/.test(l)) };
  }
  /** The message composer and its Send button. */
  function messageBox(doc) {
    const box = doc.querySelector('.msg-form__contenteditable, div[role="textbox"][contenteditable="true"]');
    const form = box && (box.closest('form') || box.closest('[role="dialog"]') || doc);
    return { box, send: form ? pick(form, l => /^send$/.test(l)) : null };
  }
  /** What an invitation note can hold (LinkedIn allows 200 characters): whole sentences while they fit, else cut at a word. */
  function noteFrom(text, max = 200) {
    const t = clean(text); if (t.length <= max) return t;
    const parts = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [t]; let out = '';
    for (const p of parts) { if ((out + p).trim().length > max) break; out += p; }
    if (out.trim()) return out.trim();
    const cut = t.slice(0, max); return cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).trim();
  }

  root.OwnedMapLib = { extractPosts, extractLocation, profileAction, menuConnect, inviteDialog, messageBox, noteFrom };
})(typeof window !== 'undefined' ? window : globalThis);
