// On the Owned Map app page only: carries the leads the person chose to contact from the page to the extension, and tells the page the extension is there.
// The page never sees the pairing code, and nothing is queued unless the person pressed the button for that lead.
(function () {
  const post = m => window.postMessage({ source: 'ownedmap-ext', ...m }, location.origin);
  window.addEventListener('message', e => {
    if (e.source !== window || e.origin !== location.origin || e.data?.source !== 'ownedmap-app') return;
    if (e.data.type === 'ping') chrome.runtime.sendMessage({ type: 'status' }, s => post({ type: 'ready', ...(s || {}) }));
    else if (e.data.type === 'queue' && Array.isArray(e.data.items)) chrome.runtime.sendMessage({ type: 'queue', items: e.data.items.slice(0, 25) }, s => post({ type: 'queued', ...(s || {}) }));
  });
  post({ type: 'hello' });
})();
