// POST { url } — fetches the given site and extracts title, description and a logo image
// from its meta tags / favicon. Best-effort: sites that block bots or time out return an error.
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  let { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url required" });
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LaunchFederationBot/1.0; +https://launchfederation.com)" },
    });
    clearTimeout(timeout);
    if (!resp.ok) return res.status(400).json({ error: `That site responded with ${resp.status}.` });

    const html = await resp.text();
    const finalUrl = resp.url || url;

    const pick = (re) => { const m = html.match(re); return m ? m[1].trim() : null; };
    const attr = (prop) => pick(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"))
      || pick(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${prop}["']`, "i"));
    const metaName = (name) => pick(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))
      || pick(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, "i"));
    const decode = (s) => s
      ? s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      : s;

    const title = decode(attr("og:title") || pick(/<title[^>]*>([^<]+)<\/title>/i));
    const description = decode(attr("og:description") || metaName("description"));
    const ogImage = attr("og:image");
    const icon = pick(/<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i)
      || pick(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["']/i);

    const origin = new URL(finalUrl).origin;
    const toAbsolute = (src) => {
      if (!src) return null;
      try { return new URL(src, origin).href; } catch { return null; }
    };
    const logo = toAbsolute(ogImage) || toAbsolute(icon) || `${origin}/favicon.ico`;

    res.status(200).json({ title: title || "", description: description || "", logo, url: finalUrl });
  } catch (err) {
    res.status(500).json({ error: "Could not read that site — it may be blocking bots or timing out." });
  }
};
