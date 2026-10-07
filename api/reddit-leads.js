// GET (admin only, Bearer token) — pulls fresh Reddit posts from the RSS feeds of relevant subreddits
// plus a few site-wide searches, scores each one for how well it fits a Rocketito reply, and returns
// the best ones. Falls back to the Pullpush archive when Reddit itself blocks this server.
const { createClient } = require("@supabase/supabase-js");

const SUBREDDITS = [
  "smallbusiness", "Entrepreneur", "startups", "EntrepreneurRideAlong", "sweatystartup", "agency",
  "SEO", "bigseo", "localseo", "TechSEO", "marketing", "DigitalMarketing", "AskMarketing", "content_marketing",
  "GrowthHacking", "SaaS", "dentistry", "Dentistry", "lawfirm", "Lawyertalk", "HVAC", "Plumbing", "Roofing",
  "realtors", "RealEstate", "ChiropracticCare", "Contractor", "landscaping", "aeo", "GEO_optimization",
];

const SEARCHES = [
  "recommended by ChatGPT business",
  "show up in ChatGPT local business",
  "AI search visibility tool",
  "no customers local business how to get clients",
  "get more clients online local service",
  "AEO GEO tool recommendation",
  "Profound alternative",
  "AI Overviews losing traffic",
];

// [regex, points, label] — what makes a post a good place to mention Rocketito.
const SIGNALS = [
  [/\b(chatgpt|perplexity|gemini|claude|ai overviews?|ai search|llms?)\b.{0,60}\b(recommend|cite|citation|mention|visib|rank|show(ing)? up|find us|find me)/i, 5, "asks about AI search visibility"],
  [/\b(recommend|cite|citation|mention|visib|rank|show(ing)? up)\b.{0,60}\b(chatgpt|perplexity|gemini|ai overviews?|ai search)/i, 5, "asks about AI search visibility"],
  [/\b(geo|aeo|generative engine|answer engine)\b/i, 3, "mentions GEO/AEO"],
  [/\b(profound|otterly|peec|semrush|ahrefs|surfer|outrank|jasper|marketmuse)\b.{0,40}\b(alternative|vs\.?|worth|expensive|pricey|cheaper)/i, 4, "comparing SEO / AI tools"],
  [/\b(alternative|cheaper|cheap)\b.{0,30}\b(profound|otterly|peec|semrush|ahrefs|surfer|outrank)/i, 4, "looking for a tool alternative"],
  [/\b(no|zero|any|don'?t have|lack|need|want|get|find|attract|more)\b.{0,25}\b(customers|clients|patients|leads)\b/i, 4, "needs customers / leads"],
  [/\b(how (do|can|to)|anyone know|any tips|advice|help)\b.{0,60}\b(customers|clients|patients|leads|marketing|seo)\b/i, 3, "asks how to get clients"],
  [/\b(just (started|opened|launched)|starting|new)\b.{0,40}\b(business|practice|firm|clinic|company|shop)\b/i, 3, "new local business"],
  [/\b(local (business|service|seo)|dentist|dental|law firm|lawyer|attorney|plumber|plumbing|hvac|roofer|roofing|real estate agent|chiropractor|contractor)\b/i, 2, "local / professional service"],
  [/\b(seo|organic|content|blog|articles?)\b.{0,40}\b(tool|software|automate|automation|ai)\b/i, 2, "SEO content tooling"],
  [/\b(tool|software|platform|recommend(ation)?s?|suggest)\b.{0,30}\b(seo|marketing|content|visibility|leads)\b/i, 2, "asks for a tool"],
  [/\b(is|are)\b.{0,20}\bseo\b.{0,25}\b(dead|worth|still work)/i, 2, "doubts classic SEO"],
  [/\?/, 1, "is a question"],
];
const PENALTIES = [
  [/\b(i|we)('ve| have)? (built|made|created|launched|developed|shipped)\b|\bintroducing\b|\bshow ?hn\b|\bcheck out (my|our)\b|\bgiveaway\b|\bhiring\b|\bfor hire\b|\bi('m| am) offering\b|\bfree (audit|tool)\b/i, -8, "self-promo"],
  [/\b(alternatives?)\b.{0,15}\b(in|for) (20\d\d|agencies)\b/i, -6, "listicle"],
];

const decode = (s) => (s || "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const stripHtml = (s) => decode(decode(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function parseAtom(xml) {
  const out = [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  for (const e of entries) {
    const get = (re) => { const m = e.match(re); return m ? m[1] : ""; };
    const link = get(/<link[^>]+href="([^"]+)"/);
    const sub = get(/<category[^>]+term="([^"]+)"/);
    const body = stripHtml(get(/<content[^>]*>([\s\S]*?)<\/content>/))
      .replace(/submitted by\s+\/?u\/\S+\s*\[link\]\s*\[comments\]/i, "").trim();
    out.push({
      id: get(/<id>([^<]+)<\/id>/),
      title: decode(get(/<title>([\s\S]*?)<\/title>/)).trim(),
      url: decode(link),
      subreddit: sub,
      author: get(/<author>\s*<name>\/?u?\/?([^<]+)<\/name>/),
      created: get(/<updated>([^<]+)<\/updated>/),
      body: body.slice(0, 600),
    });
  }
  return out;
}

async function fetchRss(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36", Accept: "application/atom+xml,application/xml" },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return parseAtom(await r.text());
  } finally { clearTimeout(t); }
}

async function fetchPullpush(q) {
  const after = Math.floor(Date.now() / 1000) - 3 * 86400;
  const url = "https://api.pullpush.io/reddit/search/submission/?" + new URLSearchParams({ q, size: "40", sort: "desc", sort_type: "created_utc", after: String(after) });
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const { data } = await r.json();
  return (data || [])
    .filter((p) => !p.removed_by_category && p.selftext !== "[removed]" && p.selftext !== "[deleted]")
    .map((p) => ({
      id: "t3_" + p.id,
      title: p.title || "",
      url: "https://www.reddit.com" + p.permalink,
      subreddit: p.subreddit,
      author: p.author,
      created: new Date(p.created_utc * 1000).toISOString(),
      body: (p.selftext || "").replace(/\s+/g, " ").slice(0, 600),
    }));
}


// Official API (app-only token). Needs REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET; avoids the datacenter blocks
// that Reddit applies to the public RSS feeds.
const UA = "web:rocketito-leads:1.0 (by /u/" + (process.env.REDDIT_USERNAME || "rocketito") + ")";
let tokenCache = { token: "", exp: 0 };
async function redditToken() {
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const basic = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const r = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { Authorization: "Basic " + basic, "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("Reddit token HTTP " + r.status);
  const j = await r.json();
  if (!j.access_token) throw new Error("Reddit token error: " + (j.error || "unknown"));
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return tokenCache.token;
}
async function fetchApi(path) {
  const token = await redditToken();
  const r = await fetch("https://oauth.reddit.com" + path + (path.includes("?") ? "&" : "?") + "raw_json=1", {
    headers: { Authorization: "Bearer " + token, "User-Agent": UA },
  });
  if (!r.ok) throw new Error("Reddit API HTTP " + r.status);
  const j = await r.json();
  return (j.data?.children || []).map((c) => c.data)
    .filter((p) => p && !p.removed_by_category && p.selftext !== "[removed]" && p.selftext !== "[deleted]")
    .map((p) => ({
      id: "t3_" + p.id,
      title: p.title || "",
      url: "https://www.reddit.com" + p.permalink,
      subreddit: p.subreddit,
      author: p.author,
      created: new Date(p.created_utc * 1000).toISOString(),
      body: (p.selftext || "").replace(/\s+/g, " ").slice(0, 600),
      comments: p.num_comments,
      upvotes: p.score,
    }));
}
const HAS_API = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);

function score(post) {
  const text = post.title + " " + post.body;
  let pts = 0;
  const reasons = [];
  for (const [re, p, label] of [...SIGNALS, ...PENALTIES]) {
    if (re.test(text) && !reasons.includes(label)) { pts += p; reasons.push(label); }
  }
  return { score: pts, reasons };
}

// Runs promises with limited concurrency so Reddit doesn't see a burst of 40 requests at once.
async function pool(tasks, size) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]().then((v) => ({ ok: true, v }), (e) => ({ ok: false, e: e.message }));
    }
  }));
  return results;
}

let cache = { key: "", at: 0, body: null };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sign in first." });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userData?.user) return res.status(401).json({ error: "Invalid session." });
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!profile?.is_admin) return res.status(403).json({ error: "Admins only." });

  const cacheKey = `${req.query?.min}|${req.query?.hours}`;
  if (cache.key === cacheKey && Date.now() - cache.at < 90000) return res.status(200).json(cache.body);

  const minScore = Math.max(0, parseInt(req.query?.min, 10) || 5);
  const maxAgeHours = Math.min(24 * 14, parseInt(req.query?.hours, 10) || 72);

  // Several subreddits per feed (r/a+b+c) keeps this to ~8 requests, which Reddit tolerates far better than 38.
  const chunks = [];
  for (let i = 0; i < SUBREDDITS.length; i += 10) chunks.push(SUBREDDITS.slice(i, i + 10).join("+"));
  const tasks = HAS_API
    ? [
        ...chunks.map((c) => () => fetchApi(`/r/${c}/new?limit=100`)),
        ...SEARCHES.map((q) => () => fetchApi(`/search?${new URLSearchParams({ q, sort: "new", t: "week", limit: "50" })}`)),
      ]
    : [
        ...chunks.map((c) => () => fetchRss(`https://www.reddit.com/r/${c}/new.rss?limit=100`)),
        ...SEARCHES.slice(0, 5).map((q) => () => fetchRss(`https://www.reddit.com/search.rss?${new URLSearchParams({ q, sort: "new", t: "week" })}`)),
      ];
  let results = await pool(tasks, 2);
  let source = HAS_API ? "reddit-api" : "reddit";
  const failed = results.filter((r) => !r.ok).length;
  const firstError = (results.find((r) => !r.ok) || {}).e;

  // Reddit blocks many datacenter IPs. If most feeds failed, use the archive so the page isn't empty.
  if (failed > tasks.length / 2) {
    source = "archive";
    results = await pool(SEARCHES.concat(["need customers local business", "get clients dentist lawyer plumber"]).map((q) => () => fetchPullpush(q)), 2);
  }

  const cutoff = Date.now() - maxAgeHours * 3600 * 1000;
  const seen = new Map();
  for (const r of results) {
    if (!r.ok) continue;
    for (const p of r.v) {
      if (!p.url || seen.has(p.url)) continue;
      if (new Date(p.created).getTime() < cutoff) continue;
      const s = score(p);
      if (s.score < minScore) continue;
      seen.set(p.url, { ...p, ...s });
    }
  }
  const leads = [...seen.values()].sort((a, b) => b.score - a.score || new Date(b.created) - new Date(a.created)).slice(0, 80);
  const body = { leads, source, feedsOk: results.length - results.filter((r) => !r.ok).length, feedsTotal: results.length, firstError, fetchedAt: new Date().toISOString() };
  if (source !== "archive") cache = { key: cacheKey, at: Date.now(), body };
  res.status(200).json(body);
};
