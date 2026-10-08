// How well does a Reddit thread fit Rocketito as the answer?
//
// Rocketito (rocketito.com) — AI SEO platform for local businesses / SMBs / professional services:
//  - tracks AI citations (ChatGPT, Perplexity, Google AI Overviews, Gemini, Copilot), 500+ queries/month
//  - publishes 31 answer-optimized articles a month automatically (WordPress/Wix/Webflow-style publishing)
//  - competitor intelligence, technical AI audit (robots.txt, schema, llm.txt), free checker
//  - $79/mo ($47/mo annual), $1 trial; compares itself to Semrush, Ahrefs, Profound, Otterly, Peec, Surfer, Jasper…
//  - NOT documented: white label, agency/multi-client plans, API  -> those threads are penalised.
//
// A thread is a good place to answer when someone is ASKING for a solution that Rocketito actually provides.
// Each rule: [regex, points, label, angle]. "core" labels are required, so a thread that only mentions
// "dentist" or "$" without a real need never passes.

const RULES = [
  // ---- core: the need matches what Rocketito does
  { core: true, re: /\b(chatgpt|perplexity|gemini|claude|copilot|ai overviews?|ai mode|ai search|llms?|ai assistants?|ai engines?)\b[^.\n]{0,90}\b(recommend|cite[sd]?|citations?|mention(ed|s)?|visib\w*|rank\w*|show(s|ing)? up|appear\w*|found|discover\w*|traffic|source)/i, pts: 6, label: "asks about AI visibility / citations", angle: "AI citation tracking across ChatGPT/Perplexity/AI Overviews" },
  { core: true, re: /\b(recommend|cite[sd]?|citations?|mention(ed|s)?|visib\w*|rank\w*|show(s|ing)? up|appear\w*)\b[^.\n]{0,90}\b(chatgpt|perplexity|gemini|ai overviews?|ai mode|ai search|llms?)/i, pts: 6, label: "asks about AI visibility / citations", angle: "AI citation tracking across ChatGPT/Perplexity/AI Overviews" },
  { core: true, re: /\b(geo|aeo|generative engine optimi[sz]ation|answer engine optimi[sz]ation|llm seo|ai seo|ai citations?)\b/i, pts: 4, label: "GEO / AEO topic", angle: "GEO/AEO platform" },
  { core: true, re: /\b(ai|automat\w+|auto)\b[^.\n]{0,40}\b(blog|content|articles?|writer|writing|posts?)\b[^.\n]{0,60}\bseo\b|\bseo\b[^.\n]{0,40}\b(content|articles?|blog)\b[^.\n]{0,40}\b(ai|automat\w+|tool|software)/i, pts: 5, label: "wants automated SEO content", angle: "31 answer-optimized articles/month, published automatically" },
  { core: true, re: /\b(best|top|recommend(ed|ation)?s?|suggest\w*|which|what|any|looking for|need|alternatives?|vs\.?|worth)\b[^.\n]{0,50}\b(seo|geo|aeo)\b[^.\n]{0,30}\b(tool|software|platform|service|agency|solution)s?\b/i, pts: 5, label: "asks for an SEO/GEO tool", angle: "all-in-one AI SEO tool" },
  { core: true, re: /\b(profound|otterly|peec|rankscale|athena\w*|scrunch|ziptie|geneo|brandlight|trysoro|babylovegrowth|distribb|outrank|rankpill|semrush|ahrefs|surfer|jasper|frase|neuronwriter|clearscope|marketmuse|se ranking|moz)\b[^.\n]{0,60}\b(alternatives?|vs\.?|worth|expensive|pricey|cheaper|cheap|overkill|too much|compar\w+|review)|\b(alternatives?|cheaper|cheap|instead of)\b[^.\n]{0,30}\b(profound|otterly|peec|rankscale|semrush|ahrefs|surfer|jasper|frase|clearscope|marketmuse|moz)\b/i, pts: 5, label: "comparing / replacing a competitor tool", angle: "cheaper, citation-focused alternative ($79/mo, $1 trial)" },
  { core: true, re: /\b(no|zero|few|not getting|lack of|need|want|get|find|attract|more)\b[^.\n]{0,25}\b(customers|clients|patients|leads)\b[^.\n]{0,80}\b(online|google|seo|search|website|chatgpt|ai)\b/i, pts: 4, label: "needs customers from search / AI", angle: "get cited when local customers ask AI" },

  // ---- supporting: audience / context fit
  { re: /\b(local|small business(es)?|smb|solo|startup|dentists?|dental|plumb\w*|hvac|roof\w*|lawyers?|law firms?|attorneys?|real estate|realtors?|restaurants?|coach\w*|contractors?|home services?|chiropract\w*|insurance|financial advisors?|orthodontist\w*)\b/i, pts: 2, label: "local / SMB / service niche", angle: "built for local & professional-service businesses" },
  { re: /\b(can'?t afford|too expensive|on a budget|budget|bootstrap\w*|cheap(est)?|affordable|no time|without (an )?agency|diy|one[- ]person|solo)\b/i, pts: 2, label: "budget / time constrained", angle: "$47–79/mo vs agency retainer" },
  { re: /\b(how (do|can|to)|anyone|any tips|advice|help|recommend)\b/i, pts: 1, label: "asking for help", angle: "" },
  { re: /\?/, pts: 1, label: "is a question", angle: "" },

  // ---- penalties
  { re: /\b(white[\s-]?label|reseller|resell|multi[\s-]?(client|site|location)|client reporting|agency (tool|software|plan)s?|for agencies)\b/i, pts: -5, label: "agency / white-label need (Rocketito doesn't document this)", angle: "" },
  { re: /\b(enterprise|fortune 500|publicly traded|1000\+ employees)\b/i, pts: -3, label: "enterprise scale", angle: "" },
  { re: /\b(i|we)('ve| have)? (built|made|created|launched|developed|shipped)\b|\bintroducing\b|\bshow ?hn\b|\bcheck out (my|our)\b|\bi('m| am) offering\b|\bfor hire\b/i, pts: -6, label: "OP is promoting their own thing", angle: "" },
  { re: /\b(crawl budget|log file|core web vitals|javascript rendering|canonical|hreflang|redirects?|penalt(y|ies)|disavow)\b/i, pts: -3, label: "technical SEO problem, not a tool need", angle: "" },
];

const COMPETITORS = ["profound", "otterly", "peec", "rankscale", "athenahq", "scrunch", "ziptie", "geneo", "brandlight", "trysoro", "babylovegrowth",
  "distribb", "outrank", "rankpill", "semrush", "ahrefs", "surfer", "jasper", "frase", "neuronwriter", "clearscope", "marketmuse", "se ranking", "moz",
  "hubspot", "yoast", "rank math", "writesonic", "copy.ai", "chatgpt", "gumshoe", "evertune", "bluefish"];

function scoreFit(title, body, comments) {
  const head = `${title}\n${body || ""}`;
  let pts = 0, hasCore = false;
  const reasons = [], angles = [];
  for (const r of RULES) {
    if (!r.re.test(head)) continue;
    if (reasons.includes(r.label)) continue; // same label from a twin rule counts once
    pts += r.pts;
    reasons.push(r.label);
    if (r.angle && !angles.includes(r.angle)) angles.push(r.angle);
    if (r.core && r.pts > 0) hasCore = true;
  }
  // What commenters already recommend: tells you who you're replacing and that the thread wants tool names.
  const commentText = (comments || []).join("\n").toLowerCase();
  const toolsInComments = COMPETITORS.filter((c) => c !== "chatgpt" && new RegExp("\\b" + c.replace(/[.]/g, "\\.") + "\\b").test(commentText));
  if (toolsInComments.length >= 2) { pts += 3; reasons.push("commenters are already naming tools"); }
  else if (toolsInComments.length === 1) { pts += 1; reasons.push("a commenter named a tool"); }
  return { fit: pts, hasCore, fitReasons: reasons, angles, toolsInComments };
}

// Cheap English detector: share of very common English words + share of non-Latin letters.
const STOP = new Set("the and to of a in is for that you i it with on my are this how what can be have not but or as at we your do if so they from by an was will about any best which there just me get one all would more".split(" "));
function isEnglish(text) {
  const t = (text || "").slice(0, 1500);
  const letters = t.match(/\p{L}/gu) || [];
  if (letters.length < 15) return true; // too short to judge, don't discard
  const nonLatin = letters.filter((c) => !/[A-Za-zÀ-ɏ]/.test(c)).length;
  if (nonLatin / letters.length > 0.2) return false;
  const words = t.toLowerCase().match(/[a-z']+/g) || [];
  if (words.length < 5) return false;
  return words.filter((w) => STOP.has(w)).length / words.length >= 0.18;
}

module.exports = { scoreFit, isEnglish };
