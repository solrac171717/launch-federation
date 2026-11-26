// On a LinkedIn profile the person has opened: reads the place written under the name and tells Owned Map, so that lead can appear on the globe.
// Only the pages the person visits themselves; it never opens a profile on its own.
(function () {
  let tries = 0, done = false;
  const url = () => location.href.split('?')[0].split('#')[0].replace(/\/$/, '');
  function look() {
    if (done) return;
    const place = window.OwnedMapLib.extractLocation(document);
    if (place) { done = true; chrome.runtime.sendMessage({ type: 'profile', profile: { url: url(), location: place } }); return; }
    if (++tries < 8) setTimeout(look, 1000); // the top card can take a moment to draw
  }
  look();
})();
