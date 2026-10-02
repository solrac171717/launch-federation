/* Launch Federation — Supabase-backed front-end. No framework, no build step:
   supabase-js is loaded from CDN in each page, config.js holds the public URL + anon key. */

const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let currentUser = null;

sb.auth.getSession().then(({ data }) => { currentUser = data.session?.user || null; renderAuthUI(); });
sb.auth.onAuthStateChange((_event, session) => { currentUser = session?.user || null; renderAuthUI(); });

/* ---------- date / week helpers ---------- */
function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function isoWeekLabel(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `Week ${weekNo}`;
}
function toISODate(d) { return d.toISOString().slice(0, 10); }

function upcomingMondays(count, startOffsetWeeks = -3) {
  const base = mondayOf(new Date());
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + (startOffsetWeeks + i) * 7);
    out.push(d);
  }
  return out;
}

/* ---------- auth UI (shared modal, injected on every page) ---------- */
function ensureAuthModal() {
  if (document.getElementById("authModal")) return;
  const el = document.createElement("div");
  el.id = "authModal";
  el.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100;align-items:center;justify-content:center";
  el.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;width:320px;max-width:90vw">
      <h3 style="margin:0 0 6px">Sign in</h3>
      <p style="margin:0 0 14px;color:var(--ink-soft);font-size:13px">We'll email you a magic link — no password needed.</p>
      <input id="authEmail" type="email" placeholder="you@email.com" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;margin-bottom:10px">
      <button id="authSend" class="btn btn-black" style="width:100%;justify-content:center">Send magic link</button>
      <div id="authMsg" style="font-size:12.5px;margin-top:10px;color:var(--ink-soft)"></div>
      <button id="authClose" class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:6px">Cancel</button>
    </div>`;
  document.body.appendChild(el);
  document.getElementById("authClose").onclick = () => el.style.display = "none";
  document.getElementById("authSend").onclick = async () => {
    const email = document.getElementById("authEmail").value.trim();
    const msg = document.getElementById("authMsg");
    if (!email) return;
    msg.textContent = "Sending…";
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
    msg.textContent = error ? error.message : "Check your inbox for the link.";
  };
}
function openAuthModal() {
  ensureAuthModal();
  document.getElementById("authModal").style.display = "flex";
}
function renderAuthUI() {
  const el = document.getElementById("authSlot");
  if (!el) return;
  if (currentUser) {
    el.innerHTML = `<button class="btn btn-outline" id="signOutBtn">${currentUser.email.split("@")[0]} · Sign out</button>`;
    document.getElementById("signOutBtn").onclick = () => sb.auth.signOut();
  } else {
    el.innerHTML = `<button class="btn btn-outline" id="signInBtn">Sign in</button>`;
    document.getElementById("signInBtn").onclick = openAuthModal;
  }
}
ensureAuthModal();

/* ---------- index.html: directory feed ---------- */
let WEEK_DATES = [];
let ACTIVE_WEEK_IDX = 3; // index into WEEK_DATES, defaults to "this week"

async function loadWeek(idx) {
  ACTIVE_WEEK_IDX = idx;
  renderWeekTabs();
  const launchWeek = toISODate(WEEK_DATES[idx]);
  const feed = document.getElementById("launchFeed");
  feed.innerHTML = `<p style="color:var(--ink-soft);padding:20px 10px">Loading…</p>`;

  const { data: listings, error } = await sb
    .from("listings")
    .select("*")
    .eq("launch_week", launchWeek)
    .eq("status", "live");

  if (error) { feed.innerHTML = `<p style="color:#b00">${error.message}</p>`; return; }
  if (!listings.length) { feed.innerHTML = `<p style="color:var(--ink-soft);padding:20px 10px">No launches yet for this week. <a href="submit.html">Be the first</a>.</p>`; return; }

  const ids = listings.map(l => l.id);
  const { data: voteRows } = await sb.from("listing_votes").select("*").in("listing_id", ids);
  const votes = Object.fromEntries((voteRows || []).map(v => [v.listing_id, v.votes]));
  const { data: myVotes } = currentUser
    ? await sb.from("votes").select("listing_id").in("listing_id", ids).eq("user_id", currentUser.id)
    : { data: [] };
  const mine = new Set((myVotes || []).map(v => v.listing_id));

  const ranked = listings
    .map(l => ({ ...l, votes: votes[l.id] || 0 }))
    .sort((a, b) => (b.plan === "premium") - (a.plan === "premium") || b.votes - a.votes);

  feed.innerHTML = ranked.map((l, i) => launchCardHTML(l, i, mine.has(l.id))).join("");
  feed.querySelectorAll("[data-vote]").forEach(btn => btn.addEventListener("click", () => castVote(btn.dataset.vote)));
  feed.querySelectorAll("[data-toggle-comments]").forEach(btn => btn.addEventListener("click", () => toggleComments(btn.dataset.toggleComments)));
}

function launchCardHTML(l, i, voted) {
  const initial = l.name.charAt(0).toUpperCase();
  return `
  <div class="launch-card">
    <div class="rank">${i + 1}</div>
    <div class="logo" style="background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px">
      ${l.logo_url ? `<img src="${l.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : initial}
    </div>
    <div class="launch-main">
      <div class="launch-title-row"><a href="${l.url}" target="_blank" rel="${l.dofollow ? "" : "nofollow"}">${l.name}</a> ${l.plan === "premium" ? '<span class="verified">●</span>' : ""}</div>
      <div class="tagline">${l.tagline}</div>
      <div class="meta-row">
        <button data-toggle-comments="${l.id}" style="border:none;background:none;cursor:pointer;color:var(--ink-soft);font:inherit">💬 comments</button>
        ${(l.tags || []).map(t => `<span class="tag">${t}</span>`).join("")}
      </div>
      <div class="comments-panel" id="comments-${l.id}" style="display:none;margin-top:10px"></div>
    </div>
    <button class="upvote-btn ${voted ? "voted" : ""}" data-vote="${l.id}" ${voted ? "disabled" : ""}>
      <span class="arrow">&uarr;</span>${l.votes}
    </button>
  </div>`;
}

async function castVote(listingId) {
  if (!currentUser) return openAuthModal();
  const { error } = await sb.from("votes").insert({ listing_id: listingId, user_id: currentUser.id });
  if (!error) loadWeek(ACTIVE_WEEK_IDX);
}

async function toggleComments(listingId) {
  const panel = document.getElementById(`comments-${listingId}`);
  if (panel.style.display === "block") { panel.style.display = "none"; return; }
  panel.style.display = "block";
  panel.innerHTML = "Loading…";
  const { data: cs } = await sb
    .from("comments")
    .select("body, created_at, profiles(display_name)")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });
  const list = (cs || []).map(c => `<div style="padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
      <strong>${c.profiles?.display_name || "user"}</strong> — ${c.body}
    </div>`).join("") || `<div style="color:var(--ink-soft);font-size:13px">No comments yet.</div>`;
  panel.innerHTML = `
    ${list}
    <div style="display:flex;gap:6px;margin-top:8px">
      <input type="text" placeholder="Add a comment…" id="newComment-${listingId}" style="flex:1;border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:13px">
      <button class="btn btn-outline" style="padding:6px 12px" id="sendComment-${listingId}">Post</button>
    </div>`;
  document.getElementById(`sendComment-${listingId}`).onclick = async () => {
    if (!currentUser) return openAuthModal();
    const input = document.getElementById(`newComment-${listingId}`);
    const body = input.value.trim();
    if (!body) return;
    const { error } = await sb.from("comments").insert({ listing_id: listingId, user_id: currentUser.id, body });
    if (!error) { input.value = ""; toggleComments(listingId); toggleComments(listingId); }
  };
}

function renderWeekTabs() {
  const el = document.getElementById("weekTabs");
  if (!el) return;
  el.innerHTML = `
    <button class="week-nav-arrow" id="weekPrev" ${ACTIVE_WEEK_IDX === 0 ? "disabled" : ""}>&lsaquo;</button>
    ${WEEK_DATES.map((d, i) => `<button class="week-tab ${i === ACTIVE_WEEK_IDX ? "active" : ""}" data-week="${i}">${isoWeekLabel(d)}</button>`).join("")}
    <button class="week-nav-arrow" id="weekNext" ${ACTIVE_WEEK_IDX === WEEK_DATES.length - 1 ? "disabled" : ""}>&rsaquo;</button>
  `;
  el.querySelectorAll("[data-week]").forEach(b => b.onclick = () => loadWeek(Number(b.dataset.week)));
  document.getElementById("weekPrev").onclick = () => ACTIVE_WEEK_IDX > 0 && loadWeek(ACTIVE_WEEK_IDX - 1);
  document.getElementById("weekNext").onclick = () => ACTIVE_WEEK_IDX < WEEK_DATES.length - 1 && loadWeek(ACTIVE_WEEK_IDX + 1);
}

async function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  if (!el) return;
  const prevMonday = toISODate(upcomingMondays(1, -1)[0]);
  const { data: listings } = await sb.from("listings").select("*").eq("launch_week", prevMonday).eq("status", "live");
  if (!listings || !listings.length) { el.innerHTML = `<p style="color:var(--ink-soft);font-size:13px">No data yet.</p>`; return; }
  const ids = listings.map(l => l.id);
  const { data: voteRows } = await sb.from("listing_votes").select("*").in("listing_id", ids);
  const votes = Object.fromEntries((voteRows || []).map(v => [v.listing_id, v.votes]));
  const top = listings.map(l => ({ ...l, votes: votes[l.id] || 0 })).sort((a, b) => b.votes - a.votes).slice(0, 3);
  el.innerHTML = top.map(l => `
    <div class="leaderboard-item">
      <div class="logo" style="background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${l.name.charAt(0)}</div>
      <div style="min-width:0"><div class="name">${l.name}</div><div class="desc">${l.tagline}</div></div>
      <div class="count">&uarr;${l.votes}</div>
    </div>`).join("");
}

if (document.getElementById("launchFeed")) {
  WEEK_DATES = upcomingMondays(7, -3);
  loadWeek(3);
  renderLeaderboard();
}

/* ---------- submit.html ---------- */
let SLOT_WEEKS = [];
let selectedWeekIdx = null;

async function renderSlots() {
  const el = document.getElementById("slotGrid");
  if (!el) return;
  SLOT_WEEKS = upcomingMondays(5, 1);
  el.innerHTML = SLOT_WEEKS.map((d, i) => `<div class="slot" data-w="${i}">${isoWeekLabel(d)}<span class="n">…</span></div>`).join("");

  for (let i = 0; i < SLOT_WEEKS.length; i++) {
    const iso = toISODate(SLOT_WEEKS[i]);
    const { count } = await sb.from("listings").select("id", { count: "exact", head: true }).eq("launch_week", iso).eq("plan", "free");
    const slotEl = el.querySelector(`[data-w="${i}"]`);
    const full = (count || 0) >= 10;
    slotEl.classList.toggle("full", full);
    slotEl.querySelector(".n").textContent = full ? "Full (premium only)" : `${count || 0}/10 free`;
    if (!full) slotEl.addEventListener("click", () => {
      el.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
      slotEl.classList.add("selected");
      selectedWeekIdx = i;
    });
  }
}
renderSlots();

function fakeAutofill() {
  const url = document.getElementById("urlInput");
  const status = document.getElementById("autofillStatus");
  if (!url || !url.value) return;
  status.textContent = "Reading your site…";
  status.style.color = "var(--ink-soft)";
  setTimeout(() => {
    document.getElementById("fieldTitle").value = document.getElementById("fieldTitle").value || "Your Product Name";
    document.getElementById("fieldTagline").value = document.getElementById("fieldTagline").value || "A short, punchy one-line description";
    document.getElementById("fieldDescription").value = document.getElementById("fieldDescription").value || "A longer description — edit freely before submitting.";
    document.getElementById("fieldMarket").value = document.getElementById("fieldMarket").value || "SaaS founders / Indie makers";
    document.getElementById("fieldTags").value = document.getElementById("fieldTags").value || "AI, Productivity";
    status.textContent = "Auto-filled (demo) from " + url.value + " — this still needs a real scraper, see README. Review before submitting.";
    status.style.color = "#8a5a00";
  }, 700);
}
const autofillBtn = document.getElementById("autofillBtn");
if (autofillBtn) autofillBtn.addEventListener("click", fakeAutofill);

const submitBtn = document.getElementById("submitListingBtn");
if (submitBtn) submitBtn.addEventListener("click", async () => {
  const statusEl = document.getElementById("submitStatus");
  if (!currentUser) { openAuthModal(); return; }
  if (selectedWeekIdx === null) { statusEl.textContent = "Pick a launch week first."; statusEl.style.color = "#b00"; return; }
  const plan = document.querySelector('input[name="plan"]:checked').value;
  const row = {
    user_id: currentUser.id,
    name: document.getElementById("fieldTitle").value.trim(),
    tagline: document.getElementById("fieldTagline").value.trim(),
    description: document.getElementById("fieldDescription").value.trim(),
    url: document.getElementById("urlInput").value.trim(),
    logo_url: document.getElementById("fieldLogoUrl")?.value.trim() || null,
    target_market: document.getElementById("fieldMarket").value.trim(),
    tags: document.getElementById("fieldTags").value.split(",").map(t => t.trim()).filter(Boolean),
    plan,
    launch_week: toISODate(SLOT_WEEKS[selectedWeekIdx]),
    status: "live",
    dofollow: plan === "premium",
  };
  if (!row.name || !row.tagline || !row.url) { statusEl.textContent = "Name, tagline and URL are required."; statusEl.style.color = "#b00"; return; }
  statusEl.textContent = "Submitting…"; statusEl.style.color = "var(--ink-soft)";
  const { error } = await sb.from("listings").insert(row);
  if (error) { statusEl.textContent = error.message; statusEl.style.color = "#b00"; return; }
  statusEl.textContent = plan === "premium"
    ? "Submitted! (Payment for the $7 premium listing isn't wired up yet — see README.)"
    : "Submitted! Install the badge (see badge.html) — it's checked weekly to keep your dofollow link.";
  statusEl.style.color = "#1a7f3c";
});
