// Fetches a listing's site and checks whether our badge.svg is actually referenced on the page.
async function checkBadge(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LaunchFederationBadgeBot/1.0 (+https://launchfederation.com)" },
    });
    clearTimeout(timeout);
    if (!resp.ok) return false;
    const html = await resp.text();
    return /launchfederation\.com\/badge(-white)?\.svg/i.test(html);
  } catch (err) {
    return false;
  }
}
module.exports = { checkBadge };
