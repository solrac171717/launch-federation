// Local tool: runs Google searches in your real Chrome, keeps the queries where a Reddit thread ranks
// in the top N organic results, then checks that the subreddit lets you recommend tools without
// getting flagged as spam. Output: results/<date>.json + results/<date>.md
//
//   node index.js                     all queries in queries.txt
//   node index.js --top 2             Reddit must be position <= 2 (default 2)
//   node index.js --caution           also list subreddits with soft warnings (not only clean ones)
//   node index.js --queries my.txt    another query file
//   node index.js --limit 5           only the first 5 queries (to test)
//   node index.js --fresh             ignore the cached subreddit rules
const fs = require("fs");
const path = require("path");
const { scoreFit, isEnglish } = require("./fit");
const puppeteer = require("puppeteer-core");

const args = process.argv.slice(2);
const flag = (n) => args.includes("--" + n);
const opt = (n, d) => { const i = args.indexOf("--" + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const TOP = parseInt(opt("top", "2"), 10);
const MINFIT = parseInt(opt("minfit", "7"), 10);
const MAXAGE = parseInt(opt("maxage", "120"), 10); // days; Reddit archives threads at ~180 days, so older ones can't be commented anyway
const SCAN = 10; // how deep we look for Reddit, just to report near-misses
const LIMIT = parseInt(opt("limit", "0"), 10);
const QUERY_FILE = path.resolve(__dirname, opt("queries", "queries.txt"));
const OUT_DIR = path.join(__dirname, "results");
const PROFILE_DIR = path.join(__dirname, ".chrome-profile"); // keeps Google/Reddit cookies so captchas are rare
const RULES_CACHE = path.join(__dirname, ".rules-cache.json");

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => a + Math.random() * (b - a);

// ---------- subreddit rule analysis ----------
// BLOCK: the rules forbid promoting / linking / recommending your own product.
const BLOCK = [
  [/no\s+(self[\s-]*)?promo(tion|tional)?/i, "no promotion"],
  [/self[\s-]*promo(tion|tional)?/i, "self-promotion rule"],
  [/\bpromot(e|ing|ion|ional)\b/i, "promotion rule"],
  [/\badvertis(e|ing|ement|ements)\b/i, "advertising rule"],
  [/\bsolicit(ing|ation)?\b/i, "solicitation rule"],
  [/\bshill(ing)?\b/i, "shilling rule"],
  [/\b(no|ban(ned)?|prohibit(ed)?|don'?t)\b[^.\n]{0,30}\b(links?|urls?)\b/i, "links restricted"],
  [/\b(no|ban(ned)?|prohibit(ed)?|don'?t)\b[^.\n]{0,40}\b(products?|tools?|services?|brands?|apps?|software)\b/i, "products/tools restricted"],
  [/\bcommercial\b/i, "commercial content rule"],
  [/\bmarketing (content|material)|\bno marketing\b/i, "no marketing"],
  [/\baffiliate|referral/i, "affiliate/referral rule"],
  [/\bbrand (account|mention)/i, "brand mention rule"],
];
// CAUTION: not a ban, but you can get flagged if you ignore it.
const CAUTION = [
  [/\bspam(ming|mer|my)?\b/i, "spam rule"],
  [/\b9\s*:\s*1\b|10\s*%|90\s*%|ratio/i, "9:1 / ratio rule"],
  [/\bdisclos(e|ure)|affiliat(ed|ion) with\b|conflict of interest/i, "disclosure required"],
  [/\bmust\b[^.\n]{0,40}\b(karma|account age|days old)\b|\bminimum (karma|account age)/i, "karma/age requirement"],
  [/\bbot|automod/i, "automod active"],
  [/\boff[\s-]*topic|low[\s-]*effort/i, "low-effort rule"],
];

function analyzeSub(about, rules) {
  const kind = about.subreddit_type || "public";
  const reasons = [];
  if (kind !== "public" && kind !== "restricted") {
    return { verdict: "BLOCKED", flags: ["subreddit is " + kind], evidence: [] };
  }
  const ruleTexts = (rules || []).map((r) => `${r.short_name || ""}. ${r.description || ""}`.trim());
  // Also read the sidebar text — many subs hide promo rules there.
  const corpus = [...ruleTexts, about.public_description || "", about.submit_text || ""];
  const hard = new Set(), soft = new Set(), evidence = [];
  for (const text of corpus) {
    if (!text) continue;
    for (const [re, label] of BLOCK) {
      const m = text.match(re);
      if (m) { hard.add(label); evidence.push(label + ": …" + snippet(text, m.index) + "…"); }
    }
    for (const [re, label] of CAUTION) if (re.test(text)) soft.add(label);
  }
  if (kind === "restricted") soft.add("restricted sub (only approved users can post; comments usually open)");
  if (about.over18) soft.add("NSFW");
  const verdict = hard.size ? "BLOCKED" : soft.size ? "CAUTION" : "OK";
  return { verdict, flags: [...hard, ...soft], evidence: evidence.slice(0, 4), reasons };
}
const snippet = (t, i) => t.slice(Math.max(0, i - 40), i + 110).replace(/\s+/g, " ").trim();

// ---------- browser helpers ----------
async function launch() {
  const exe = CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!exe) throw new Error("Chrome/Edge not found. Set CHROME_PATH to its executable.");
  return puppeteer.launch({
    executablePath: exe,
    headless: false, // headless Chrome gets captcha'd by Google almost immediately
    userDataDir: PROFILE_DIR,
    defaultViewport: null,
    args: ["--no-first-run", "--disable-blink-features=AutomationControlled", "--window-size=1200,900"],
    ignoreDefaultArgs: ["--enable-automation"],
  });
}

async function waitIfBlocked(page, label) {
  const blocked = () => /\/sorry\/|captcha|recaptcha/i.test(page.url());
  if (!blocked()) return;
  console.log(`\n  !! Google is asking for a captcha (${label}). Solve it in the Chrome window — waiting up to 5 min…`);
  const t0 = Date.now();
  while (blocked() && Date.now() - t0 < 300000) await sleep(1500);
  await sleep(1500);
}

async function googleSearch(page, q) {
  await page.bringToFront();
  const url = "https://www.google.com/search?" + new URLSearchParams({ q, hl: "en", gl: "us", lr: "lang_en", num: "10", pws: "0" });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitIfBlocked(page, q);
  // EU consent wall
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /accept all|reject all|aceptar todo|rechazar todo/i.test(x.innerText));
    if (b) b.click();
  }).catch(() => {});
  await page.waitForSelector("#search, #rso", { timeout: 20000 }).catch(() => {});
  // Organic results = anchors wrapping an <h3>, in DOM order. Ads, People-also-ask and videos carriers are skipped.
  return page.evaluate(() => {
    const out = [], seen = new Set();
    for (const h3 of document.querySelectorAll("#rso h3, #search h3")) {
      const a = h3.closest("a");
      if (!a || !a.href || seen.has(a.href)) continue;
      if (a.closest("[data-text-ad], #tads, #tadsb, [data-initq], .related-question-pair")) continue;
      seen.add(a.href);
      let box = a;
      for (let i = 0; i < 6 && box.parentElement && box.innerText.length < 80; i++) box = box.parentElement;
      out.push({ title: h3.innerText.trim(), url: a.href, text: box.innerText.slice(0, 200) });
    }
    return out;
  });
}

// Google hides result links behind encrypted /goto?url=… redirects. Follow one in a scratch tab and stop at the
// first hop that leaves Google, so we learn the real URL without loading the target page.
async function resolveGoogleLink(page, href) {
  await page.bringToFront();
  if (!/^https?:\/\/(www\.)?google\.[^/]+\/(goto|url)\?/.test(href)) return href;
  let resolved = null;
  const onReq = (req) => {
    const u = req.url();
    if (!resolved && !/^https?:\/\/([^/]*\.)?(google|gstatic|googleapis)\.[a-z.]+\//.test(u)) { resolved = u; req.abort().catch(() => {}); }
    else req.continue().catch(() => {});
  };
  await page.setRequestInterception(true);
  page.on("request", onReq);
  try { await page.goto(href, { waitUntil: "domcontentloaded", timeout: 20000 }); } catch (e) { /* aborted on purpose */ }
  page.off("request", onReq);
  await page.setRequestInterception(false);
  return resolved || href;
}

// Fetch a Reddit JSON endpoint from inside a reddit.com page so cookies/headers look like a normal visit.
const reddit = { browser: null, page: null };
async function openRedditTab() {
  if (reddit.page) await reddit.page.close().catch(() => {});
  reddit.page = await reddit.browser.newPage();
  await reddit.page.goto("https://www.reddit.com/", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
}
async function redditJson(url, retried = false) {
  try {
    await reddit.page.bringToFront(); // background tabs get throttled/discarded by Chrome
    return await reddit.page.evaluate(async (u) => {
      try {
        const r = await fetch(u, { headers: { Accept: "application/json" }, credentials: "include" });
        if (!r.ok) return { __error: "HTTP " + r.status };
        return await r.json();
      } catch (e) { return { __error: String(e) }; }
    }, url);
  } catch (e) {
    if (retried) return { __error: e.message };
    await openRedditTab(); // detached frame / closed tab: start a fresh one and retry once
    return redditJson(url, true);
  }
}

const redditThreadRe = /^https?:\/\/(?:www\.|old\.|new\.)?reddit\.com\/r\/([^/]+)\/comments\/([a-z0-9]+)/i;

async function main() {
  const queries = fs.readFileSync(QUERY_FILE, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const todo = LIMIT ? queries.slice(0, LIMIT) : queries;
  const rulesCache = !flag("fresh") && fs.existsSync(RULES_CACHE) ? JSON.parse(fs.readFileSync(RULES_CACHE, "utf8")) : {};
  const browser = await launch();
  let gPage = (await browser.pages())[0] || (await browser.newPage());
  reddit.browser = browser;
  await openRedditTab();
  let sPage = await browser.newPage();

  const rows = [], nearMisses = [];
  try {
    for (let i = 0; i < todo.length; i++) {
      const q = todo[i];
      process.stdout.write(`[${i + 1}/${todo.length}] ${q} … `);
      let results;
      try { results = await googleSearch(gPage, q); }
      catch (e) {
        // The tab can get detached (Chrome restores/recycles it): open a fresh one and retry once.
        try { await gPage.close().catch(() => {}); gPage = await browser.newPage(); results = await googleSearch(gPage, q); }
        catch (e2) { console.log("search failed: " + e2.message); continue; }
      }

      const hits = [];
      for (let idx = 0; idx < Math.min(SCAN, results.length); idx++) {
        const r = results[idx];
        // Only Reddit-labelled results need their redirect resolved.
        if (!/reddit/i.test(r.text + r.url)) continue;
        let real = await resolveGoogleLink(sPage, r.url).catch(() => r.url);
        if (/^https?:\/\/(www\.)?google\./.test(real)) {
          // Resolution failed (scratch tab went stale): retry once in a fresh tab instead of silently missing a hit.
          await sPage.close().catch(() => {});
          sPage = await browser.newPage();
          real = await resolveGoogleLink(sPage, r.url).catch(() => r.url);
          if (/^https?:\/\/(www\.)?google\./.test(real)) { process.stdout.write(`(could not resolve #${idx + 1}) `); continue; }
        }
        const m = real.match(redditThreadRe);
        if (m) hits.push({ position: idx + 1, title: r.title, url: real.split("?")[0], subreddit: m[1], postId: m[2] });
      }
      const top = hits.filter((h) => h.position <= TOP);
      for (const h of hits) if (h.position > TOP) nearMisses.push({ query: q, ...h });
      console.log(`[${results.length} organic] ` + (top.length ? `Reddit at #${top.map((h) => h.position).join(", #")}` : hits.length ? `Reddit only at #${hits.map((h) => h.position).join(", #")}` : "no Reddit"));

      for (const h of top) {
        const key = h.subreddit.toLowerCase();
        if (!rulesCache[key]) {
          const [about, rules] = [
            await redditJson(`https://www.reddit.com/r/${h.subreddit}/about.json?raw_json=1`),
            await redditJson(`https://www.reddit.com/r/${h.subreddit}/about/rules.json?raw_json=1`),
          ];
          await sleep(jitter(800, 1600));
          if (about.__error || !about.data) rulesCache[key] = { verdict: "UNKNOWN", flags: ["could not read subreddit: " + (about.__error || "no data")], evidence: [], subscribers: null };
          else rulesCache[key] = { ...analyzeSub(about.data, rules.rules), subscribers: about.data.subscribers, title: about.data.title, rulesRead: !rules.__error };
          if (rulesCache[key].rulesRead === false && rulesCache[key].verdict === "OK") rulesCache[key].verdict = "CAUTION", rulesCache[key].flags.push("rules could not be read — check manually");
          fs.writeFileSync(RULES_CACHE, JSON.stringify(rulesCache, null, 1));
        }
        // Thread-level check: archived/locked threads can't take new comments.
        const t = await redditJson(`https://www.reddit.com/comments/${h.postId}.json?limit=25&sort=top&raw_json=1`);
        const post = t && t[0] && t[0].data && t[0].data.children && t[0].data.children[0] && t[0].data.children[0].data;
        const thread = post
          ? { archived: !!post.archived, locked: !!post.locked, removed: !!post.removed_by_category, comments: post.num_comments, ageDays: Math.round((Date.now() / 1000 - post.created_utc) / 86400) }
          : { unknown: true };
        const comments = ((t && t[1] && t[1].data && t[1].data.children) || []).filter((c) => c.kind === "t1").map((c) => c.data.body || "");
        const fit = post ? scoreFit(post.title || h.title, post.selftext || "", comments) : { fit: 0, hasCore: false, fitReasons: ["thread unreadable"], angles: [], toolsInComments: [] };
        // Must be recent and in English to be worth a reply.
        const skip = [];
        if (post && !isEnglish(`${post.title}\n${post.selftext || ""}\n${comments.slice(0, 3).join("\n")}`)) skip.push("not in English");
        if (thread.ageDays > MAXAGE) skip.push(`older than ${MAXAGE} days (${thread.ageDays}d)`);
        const excerpt = post ? (post.selftext || "").replace(/\s+/g, " ").slice(0, 280) : "";
        const sub = rulesCache[key];
        let verdict = sub.verdict;
        const flags = [...sub.flags];
        if (thread.archived) { verdict = "BLOCKED"; flags.push("thread archived (no new comments)"); }
        if (thread.locked) { verdict = "BLOCKED"; flags.push("thread locked"); }
        if (thread.removed) { verdict = "BLOCKED"; flags.push("thread removed"); }
        rows.push({ query: q, ...h, ...fit, skip, excerpt, verdict, flags, evidence: sub.evidence, subscribers: sub.subscribers, thread });
        await sleep(jitter(600, 1200));
      }
      await sleep(jitter(5000, 10000)); // be gentle with Google
    }
  } catch (e) {
    console.log("\nStopped early: " + e.message + " — writing the report with what was collected.");
  } finally {
    await browser.close().catch(() => {});
  }
  report(rows, todo.length, nearMisses);
}

function report(rows, nQueries, nearMisses) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT_DIR, stamp + ".json"), JSON.stringify(rows, null, 2));

  const fits = (r) => r.hasCore && r.fit >= MINFIT && !r.skip.length;
  const show = rows.filter((r) => fits(r) && (r.verdict === "OK" || (flag("caution") && r.verdict === "CAUTION")));
  show.sort((a, b) => (a.verdict === b.verdict ? 0 : a.verdict === "OK" ? -1 : 1) || b.fit - a.fit || a.position - b.position);
  const lowFit = rows.filter((r) => !fits(r) && (r.verdict === "OK" || r.verdict === "CAUTION"));
  const count = (v) => rows.filter((r) => r.verdict === v).length;

  let md = `# Reddit in Google top ${TOP} — ${stamp}\n\n`;
  md += `${nQueries} queries · ${rows.length} Reddit threads in the top ${TOP} · **${count("OK")} OK** · ${count("CAUTION")} caution · ${count("BLOCKED")} blocked · ${count("UNKNOWN")} unknown\n\n`;
  md += `OK = no promo/link/product restriction found in the rules or sidebar. **Fit** = how well Rocketito answers what the thread asks (min ${MINFIT}, and it must express a core need). Read the rules before commenting; be useful first, mention Rocketito second.\n\n`;
  for (const r of show) {
    md += `## ${r.verdict === "OK" ? "✅" : "⚠️"} #${r.position} · r/${r.subreddit}${r.subscribers ? ` (${r.subscribers.toLocaleString()} members)` : ""}\n`;
    md += `- **Query:** ${r.query}\n- **Thread:** [${r.title}](${r.url})\n- **Fit ${r.fit}:** ${r.fitReasons.join("; ")}\n`;
    if (r.angles.length) md += `- **Pitch angle:** ${r.angles.join(" · ")}\n`;
    if (r.toolsInComments.length) md += `- Tools already named in comments: ${r.toolsInComments.join(", ")}\n`;
    if (r.excerpt) md += `- OP: "${r.excerpt}…"\n`;
    md += r.thread.unknown ? "- Thread status: unknown\n" : `- Thread: ${r.thread.comments} comments, ${r.thread.ageDays} days old\n`;
    if (r.flags.length) md += `- Warnings: ${r.flags.join("; ")}\n`;
    md += "\n";
  }
  if (!show.length) md += "_Nothing passed the filter. Try more queries, `--top 3`, or `--caution`._\n";
  if (lowFit.length) {
    md += `\n---\n\n## Open to comment but Rocketito doesn't fit (${lowFit.length})\n\n`;
    for (const r of lowFit) md += `- fit ${r.fit} · r/${r.subreddit} · [${r.title}](${r.url}) — ${[...r.skip, ...r.fitReasons].join("; ") || "no signals"}\n`;
  }
  const blocked = rows.filter((r) => r.verdict === "BLOCKED" || r.verdict === "UNKNOWN");
  if (blocked.length) {
    md += `\n---\n\n## Discarded (${blocked.length})\n\n`;
    for (const r of blocked) md += `- r/${r.subreddit} · "${r.query}" · #${r.position} — ${r.flags.join("; ")}${r.evidence[0] ? `  \n  > ${r.evidence[0]}` : ""}\n`;
  }
  if (nearMisses.length) {
    md += `\n---\n\n## Reddit ranks, but below the top ${TOP} (${nearMisses.length})\n\nRe-run with \`--top ${Math.max(...nearMisses.map((n) => n.position))}\` to analyse these too.\n\n`;
    for (const n of nearMisses) md += `- #${n.position} · r/${n.subreddit} · "${n.query}" — [${n.title}](${n.url})\n`;
  }
  const mdPath = path.join(OUT_DIR, stamp + ".md");
  fs.writeFileSync(mdPath, md);

  console.log(`\n${show.length ? "" : "Nothing passed the filter.\n"}`);
  for (const r of show) console.log(`${r.verdict === "OK" ? "OK     " : "CAUTION"} fit ${r.fit} #${r.position} r/${r.subreddit.padEnd(22)} ${r.query}\n        ${r.url}`);
  console.log(`\n${count("OK")} OK, ${count("CAUTION")} caution, ${count("BLOCKED")} blocked, ${count("UNKNOWN")} unknown`);
  console.log("Report: " + mdPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
