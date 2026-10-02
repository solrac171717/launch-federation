/* Launch Federation — static front-end demo.
   All data below is in-memory mock data. Nothing here is persisted or real yet:
   no accounts, no payments, no database. See README.md for what's next. */

const WEEKS = ["Week 38", "Week 39", "Week 40", "Week 41", "Week 42", "Week 43"];
const CURRENT_WEEK = 2; // index into WEEKS ("Week 40")

const LAUNCHES = [
  { name: "Rocketito", letter: "R", color: "#111", tagline: "AI SEO agent that writes and publishes articles for local businesses", rating: 5.0, reviews: 4, comments: 6, tags: ["AI", "SEO", "SaaS"], votes: 41, verified: true, plan: "premium" },
  { name: "PromptTessor", letter: "P", color: "#2b2b2b", tagline: "Generate, optimize, and manage AI prompts in one workspace", rating: 5.0, reviews: 2, comments: 2, tags: ["AI", "Productivity"], votes: 38, verified: true, plan: "premium" },
  { name: "Shotbase", letter: "S", color: "#3a6ff7", tagline: "The last screenshot & screen recording tool you'll need", rating: 5.0, reviews: 2, comments: 9, tags: ["Other"], votes: 32, verified: true, plan: "premium" },
  { name: "Find AI Credits", letter: "F", color: "#111", tagline: "Find free AI credits before they expire", rating: 5.0, reviews: 2, comments: 3, tags: ["AI", "DevTool"], votes: 24, verified: true, plan: "free" },
  { name: "Serafind", letter: "S", color: "#16a34a", tagline: "SEO and backlink exchange on autopilot", rating: 5.0, reviews: 1, comments: 8, tags: ["SEO Tools", "SaaS", "Marketing"], votes: 21, verified: true, plan: "free" },
  { name: "QApilot MCP CLI", letter: "Q", color: "#111", tagline: "Automate Android tests with plain English", rating: 4.8, reviews: 6, comments: 4, tags: ["DevTool", "AI"], votes: 19, verified: false, plan: "free" },
  { name: "Cadencz", letter: "C", color: "#e11d48", tagline: "Generate a week of platform-native content in minutes", rating: 4.7, reviews: 3, comments: 1, tags: ["Marketing"], votes: 14, verified: false, plan: "free" },
];

const LEADERBOARD = LAUNCHES.slice(0, 3).map(l => ({ ...l, votes: l.votes + 8 }));

function initials(l) {
  return `<div class="logo" style="background:${l.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px">${l.letter}</div>`;
}

function renderWeekTabs() {
  const el = document.getElementById("weekTabs");
  if (!el) return;
  el.innerHTML = `
    <button class="week-nav-arrow" ${CURRENT_WEEK === 0 ? "disabled" : ""}>&lsaquo;</button>
    ${WEEKS.map((w, i) => `<button class="week-tab ${i === CURRENT_WEEK ? "active" : ""}">${w}</button>`).join("")}
    <button class="week-nav-arrow">&rsaquo;</button>
  `;
}

function renderLaunches() {
  const el = document.getElementById("launchFeed");
  if (!el) return;
  el.innerHTML = LAUNCHES.map((l, i) => `
    <div class="launch-card" data-i="${i}">
      <div class="rank">${i + 1}</div>
      ${initials(l)}
      <div class="launch-main">
        <div class="launch-title-row">
          ${l.name} ${l.verified ? '<span class="verified">●</span>' : ""}
        </div>
        <div class="tagline">${l.tagline}</div>
        <div class="meta-row">
          <span>★ ${l.rating.toFixed(1)} · ${l.reviews}</span>
          <span>💬 ${l.comments}</span>
          ${l.tags.map(t => `<span class="tag">${t}</span>`).join("")}
        </div>
      </div>
      <button class="upvote-btn" data-vote="${i}">
        <span class="arrow">&uarr;</span>${l.votes}
      </button>
    </div>
    ${i === 2 ? sponsoredBanner() : ""}
  `).join("");

  el.querySelectorAll("[data-vote]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.vote);
      if (btn.classList.contains("voted")) return;
      LAUNCHES[i].votes += 1;
      btn.classList.add("voted");
      btn.innerHTML = `<span class="arrow">&uarr;</span>${LAUNCHES[i].votes}`;
    });
  });
}

function sponsoredBanner() {
  return `
    <div class="sponsored-banner">
      <div class="label">SPONSORED</div>
      <h3>Discover products and the founders behind them</h3>
      <div style="font-size:12.5px;color:var(--ink-soft);font-weight:700">YOUR BRAND HERE</div>
    </div>`;
}

function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  if (!el) return;
  el.innerHTML = LEADERBOARD.map(l => `
    <div class="leaderboard-item">
      ${initials(l)}
      <div style="min-width:0">
        <div class="name">${l.name}</div>
        <div class="desc">${l.tagline}</div>
      </div>
      <div class="count">&uarr;${l.votes}</div>
    </div>
  `).join("");
}

function initWeekTabClicks() {
  document.addEventListener("click", (e) => {
    if (e.target.matches(".week-tab")) {
      document.querySelectorAll(".week-tab").forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
    }
  });
}

if (document.getElementById("launchFeed")) {
  renderWeekTabs();
  renderLaunches();
  renderLeaderboard();
  initWeekTabClicks();
}

/* ---- submit.html: slot picker + fake autofill ---- */
const SLOT_WEEKS = ["Week 41", "Week 42", "Week 43", "Week 44"];
function renderSlots() {
  const el = document.getElementById("slotGrid");
  if (!el) return;
  el.innerHTML = SLOT_WEEKS.map((w, i) => {
    const takenCount = [10, 7, 3, 0][i];
    const full = takenCount >= 10;
    return `<div class="slot ${full ? "full" : ""}" data-w="${i}">${w}<span class="n">${full ? "Full" : `${takenCount}/10`}</span></div>`;
  }).join("");
  el.querySelectorAll(".slot:not(.full)").forEach(s => {
    s.addEventListener("click", () => {
      el.querySelectorAll(".slot").forEach(x => x.classList.remove("selected"));
      s.classList.add("selected");
    });
  });
}
renderSlots();

function fakeAutofill() {
  const url = document.getElementById("urlInput");
  const status = document.getElementById("autofillStatus");
  const fields = ["fieldTitle", "fieldTagline", "fieldDescription", "fieldMarket", "fieldTags"];
  if (!url || !url.value) return;
  status.textContent = "Reading your site…";
  status.style.color = "var(--ink-soft)";
  setTimeout(() => {
    document.getElementById("fieldTitle").value = "Your Product Name";
    document.getElementById("fieldTagline").value = "A short, punchy one-line description";
    document.getElementById("fieldDescription").value = "A longer description pulled from your site's meta tags and homepage copy — edit freely before submitting.";
    document.getElementById("fieldMarket").value = "SaaS founders / Indie makers";
    document.getElementById("fieldTags").value = "AI, Productivity";
    status.textContent = "Auto-filled from " + url.value + " — review and edit before publishing.";
    status.style.color = "#1a7f3c";
  }, 900);
}
const autofillBtn = document.getElementById("autofillBtn");
if (autofillBtn) autofillBtn.addEventListener("click", fakeAutofill);
