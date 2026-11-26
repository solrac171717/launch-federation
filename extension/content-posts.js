// On the LinkedIn feed and on content search: reads the posts that are on screen and hands them to the background worker, in small batches.
// It does not scroll, click, search or load anything by itself: it only reads what the person is already looking at.
(function () {
  const sent = new Set(), queue = [];
  let timer = 0;

  function collect() {
    for (const p of window.OwnedMapLib.extractPosts(document)) if (!sent.has(p.externalId)) { sent.add(p.externalId); queue.push(p); }
    if (queue.length && !timer) timer = setTimeout(flush, 4000); // a few seconds, so posts that load together travel together
  }
  function flush() {
    timer = 0;
    const items = queue.splice(0, 20);
    if (items.length) chrome.runtime.sendMessage({ type: 'posts', items });
    if (queue.length) timer = setTimeout(flush, 30_000); // never faster than 20 posts every 30 seconds
  }

  new MutationObserver(() => collect()).observe(document.body, { childList: true, subtree: true });
  collect();
})();
