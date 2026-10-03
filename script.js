/* Launch Federation — Supabase-backed front-end. No framework, no build step:
   supabase-js is loaded from CDN in each page, config.js holds the public URL + anon key. */

const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let currentUser = null;

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : undefined;
}
function datafastIds() {
  return { datafastVisitorId: getCookie("datafast_visitor_id"), datafastSessionId: getCookie("datafast_session_id") };
}

sb.auth.getSession().then(({ data }) => { currentUser = data.session?.user || null; renderAuthUI(); renderAuthGate(); if (typeof renderMyListings === "function") renderMyListings(); });
sb.auth.onAuthStateChange((_event, session) => { currentUser = session?.user || null; renderAuthUI(); renderAuthGate(); if (typeof renderMyListings === "function") renderMyListings(); });

/* ---------- auth gate: shown instead of the submit form until signed in ---------- */
function renderAuthGate() {
  const gate = document.getElementById("authGate");
  const form = document.getElementById("submitForm");
  if (!gate || !form) return;
  gate.style.display = currentUser ? "none" : "flex";
  form.style.display = currentUser ? "block" : "none";
}
/* Google Identity Services: sign-in happens on this page (no redirect through
   Supabase's own domain), we just hand the resulting ID token to Supabase. */
async function handleGoogleCredential(response) {
  const { error } = await sb.auth.signInWithIdToken({ provider: "google", token: response.credential });
  if (error) { console.error("Google sign-in failed", error); }
}
function initGoogleSignIn() {
  const div = document.getElementById("googleSignInDiv");
  if (!div || !window.google || !window.GOOGLE_CLIENT_ID) return;
  google.accounts.id.initialize({ client_id: window.GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
  google.accounts.id.renderButton(div, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 300 });
}
if (document.getElementById("googleSignInDiv")) {
  window.addEventListener("load", initGoogleSignIn);
}

const emailGateBtn = document.getElementById("emailSignInGate");
if (emailGateBtn) emailGateBtn.addEventListener("click", () => openAuthModal());

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
  if (!listings.length) { feed.innerHTML = ""; return; }

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

const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M8 12.5l2.5 2.5L16 9" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_STAR = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="star-icon"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>`;
const ICON_COMMENT = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const ICON_UP = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/></svg>`;
const ICON_MEGAPHONE = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 0 0 2 2h1l3 5v-7"/><path d="M9 9 19 4v16L9 15"/></svg>`;

/* Camouflage-toned tag palette — rotates by tag name so the same tag is always the same color. */
const TAG_PALETTE = ["#0b0c08"];
function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

function launchCardHTML(l, i, voted) {
  const initial = l.name.charAt(0).toUpperCase();
  return `
  <div class="launch-card ${l.plan === "premium" ? "is-premium" : ""}">
    <div class="rank">${i + 1}</div>
    <div class="logo" style="background:linear-gradient(135deg,var(--camo-1),var(--camo-2));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:19px">
      ${l.logo_url ? `<img src="${l.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:13px">` : initial}
    </div>
    <div class="launch-main">
      <div class="launch-title-row"><a href="${l.url}" target="_blank" rel="${l.dofollow ? "" : "nofollow"}">${l.name}</a> ${l.plan === "premium" ? `<span class="verified">${ICON_CHECK}</span>` : ""}</div>
      <div class="tagline">${l.tagline}</div>
      <div class="meta-row">
        <button data-toggle-comments="${l.id}" style="display:inline-flex;align-items:center;gap:5px;border:none;background:none;cursor:pointer;color:var(--ink-soft);font:inherit;font-weight:600">${ICON_COMMENT} Comments</button>
        ${(l.tags || []).map(t => `<span class="tag" style="background:${tagColor(t)}">${t}</span>`).join("")}
      </div>
      <div class="comments-panel" id="comments-${l.id}" style="display:none;margin-top:10px"></div>
    </div>
    <button class="upvote-btn ${voted ? "voted" : ""}" data-vote="${l.id}" ${voted ? "disabled" : ""}>
      <span class="arrow">${ICON_UP}</span>${l.votes}
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
      <div class="count" style="display:flex;align-items:center;gap:3px">${ICON_UP}${l.votes}</div>
    </div>`).join("");
}

async function renderStatusBar() {
  const el = document.getElementById("statusBar");
  if (!el) return;
  const thisMonday = mondayOf(new Date());
  const iso = toISODate(thisMonday);
  const { count } = await sb.from("listings").select("id", { count: "exact", head: true }).eq("launch_week", iso).eq("plan", "free");
  const left = Math.max(0, 10 - (count || 0));
  document.getElementById("statSlots").textContent = `${left} / 10`;

  const today = new Date();
  const dow = today.getDay();
  let label;
  if (dow === 1) label = "Today";
  else { const days = (8 - dow) % 7 || 7; label = `In ${days}d`; }
  document.getElementById("statCountdown").textContent = label;
}

async function renderComingSoon() {
  const el = document.getElementById("comingSoon");
  const heading = document.getElementById("comingSoonHeading");
  if (!el) return;
  const candidates = upcomingMondays(8, 1); // next 8 weeks, rolling forward past full ones
  for (const weekDate of candidates) {
    const iso = toISODate(weekDate);
    const { count } = await sb.from("listings").select("id", { count: "exact", head: true }).eq("launch_week", iso).eq("plan", "free");
    const slotsLeft = Math.max(0, 10 - (count || 0));
    if (slotsLeft > 0) {
      heading.textContent = `Coming to ${isoWeekLabel(weekDate)}`;
      el.innerHTML = Array.from({ length: slotsLeft }).map((_, i) => `
        <div class="claim-slot">
          <div class="n">${(count || 0) + i + 1}</div>
          <a class="btn btn-black" href="submit.html?week=${iso}">Claim Now for Free</a>
        </div>`).join("");
      return;
    }
  }
  heading.textContent = "Free slots are full for now";
  el.innerHTML = `
    <div class="claim-slot">
      <div class="n">★</div>
      <a class="btn btn-black" href="submit.html">Get a premium slot — unlimited</a>
    </div>`;
}

if (document.getElementById("launchFeed")) {
  WEEK_DATES = upcomingMondays(7, -3);
  loadWeek(3);
  renderLeaderboard();
  renderStatusBar();
  renderAdSlots();
  renderComingSoon();
}

/* ---------- submit.html ---------- */
let SLOT_WEEKS = [];
let selectedWeekIdx = null;
let SLOT_COUNTS = [];
let SLOT_FULL = [];

function updateSlotLabels() {
  const el = document.getElementById("slotGrid");
  if (!el) return;
  const premiumRadio = document.getElementById("planPremium");
  const isPremium = !!(premiumRadio && premiumRadio.checked);
  for (let i = 0; i < SLOT_WEEKS.length; i++) {
    const slotEl = el.querySelector(`[data-w="${i}"]`);
    if (!slotEl) continue;
    const full = SLOT_FULL[i];
    slotEl.classList.toggle("premium-ok", isPremium && full);
    slotEl.querySelector(".n").textContent = isPremium
      ? "Open"
      : (full ? "Full (premium only)" : `${SLOT_COUNTS[i] || 0}/10 free`);
  }
}

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
    SLOT_COUNTS[i] = count || 0;
    SLOT_FULL[i] = full;
    slotEl.classList.toggle("full", full);
    slotEl.addEventListener("click", () => {
      el.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
      slotEl.classList.add("selected");
      selectedWeekIdx = i;
      const freeRadio = document.getElementById("planFree");
      const premiumRadio = document.getElementById("planPremium");
      const hint = document.getElementById("planHint");
      if (freeRadio && premiumRadio && hint) {
        if (full) {
          freeRadio.checked = false; freeRadio.disabled = true;
          premiumRadio.checked = true;
          premiumRadio.dispatchEvent(new Event("change"));
          hint.style.display = "block";
        } else {
          freeRadio.disabled = false;
          hint.style.display = "none";
        }
      }
    });
  }
  updateSlotLabels();

  const params = new URLSearchParams(location.search);
  const wantedWeek = params.get("week");
  if (wantedWeek) {
    const idx = SLOT_WEEKS.findIndex(d => toISODate(d) === wantedWeek);
    const slotEl = idx >= 0 ? el.querySelector(`[data-w="${idx}"]`) : null;
    if (slotEl && !slotEl.classList.contains("full")) {
      slotEl.click();
      slotEl.scrollIntoView({ block: "nearest" });
      const note = document.getElementById("claimNote");
      if (note) note.style.display = "block";
    }
  }
}
renderSlots();

/* ---------- submit.html: plan cards + badge section ---------- */
(function () {
  const planFree = document.getElementById("planFree");
  const planPremium = document.getElementById("planPremium");
  const choiceFree = document.getElementById("planChoiceFree");
  const choicePremium = document.getElementById("planChoicePremium");
  const badgeSection = document.getElementById("badgeSection");
  if (!planFree || !planPremium) return;

  function syncPlanUI() {
    choiceFree.classList.toggle("selected", planFree.checked);
    choicePremium.classList.toggle("selected", planPremium.checked);
    if (badgeSection) badgeSection.style.display = planFree.checked ? "block" : "none";
    updateSlotLabels();
  }
  planFree.addEventListener("change", syncPlanUI);
  planPremium.addEventListener("change", syncPlanUI);
  syncPlanUI();

  const img = document.getElementById("sBadgePreviewImg");
  const pre = document.getElementById("sBadgeSnippet");
  const btnBlack = document.getElementById("sBadgeBtnBlack");
  const btnWhite = document.getElementById("sBadgeBtnWhite");
  function snippetText(file) {
    return `<a href="https://launchfederation.com" rel="dofollow">\n  <img src="https://launchfederation.com/${file}" alt="Featured on Launch Federation">\n</a>`;
  }
  function setVariant(file) {
    img.src = file;
    pre.textContent = snippetText(file);
    btnBlack.className = file === "badge.svg" ? "btn btn-black" : "btn btn-outline";
    btnWhite.className = file === "badge-white.svg" ? "btn btn-black" : "btn btn-outline";
  }
  if (btnBlack) btnBlack.addEventListener("click", () => setVariant("badge.svg"));
  if (btnWhite) btnWhite.addEventListener("click", () => setVariant("badge-white.svg"));

  const copyStatus = document.getElementById("copyBadgeStatus");
  const copyBadgeBtn = document.getElementById("copyBadgeCodeBtn");
  if (copyBadgeBtn) copyBadgeBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(pre.textContent);
    copyStatus.textContent = "Badge code copied."; copyStatus.style.color = "#1a7f3c";
  });

  const copyAiBtn = document.getElementById("copyAiInstructionsBtn");
  if (copyAiBtn) copyAiBtn.addEventListener("click", async () => {
    const file = img.src.includes("badge-white") ? "badge-white.svg" : "badge.svg";
    const instructions = `Add this exact badge to this website so it's visible in the rendered HTML (footer or homepage), inside <body>:\n\n${snippetText(file)}\n\nDo not change the href or img src. Keep it visible — don't hide it with CSS (no display:none, visibility:hidden, or 0 opacity/size). It must stay on the live page permanently, since it's checked weekly by Launch Federation.`;
    await navigator.clipboard.writeText(instructions);
    copyStatus.textContent = "AI instructions copied."; copyStatus.style.color = "#1a7f3c";
  });

  const verifyBtn = document.getElementById("verifyBadgeNowBtn");
  const verifyStatus = document.getElementById("verifyBadgeStatus");
  if (verifyBtn) verifyBtn.addEventListener("click", async () => {
    const url = document.getElementById("urlInput")?.value.trim();
    if (!url) { verifyStatus.textContent = "Enter your website URL above first."; verifyStatus.style.color = "#b00"; return; }
    verifyStatus.textContent = "Checking your site…"; verifyStatus.style.color = "var(--ink-soft)";
    try {
      const resp = await fetch("/api/check-badge-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const out = await resp.json();
      if (out.verified) { verifyStatus.textContent = "✓ Badge found — you're good to submit."; verifyStatus.style.color = "#1a7f3c"; }
      else { verifyStatus.textContent = "Badge not found yet on that page. Add it, then verify again."; verifyStatus.style.color = "#b00"; }
    } catch (err) {
      verifyStatus.textContent = "Couldn't check that URL."; verifyStatus.style.color = "#b00";
    }
  });
})();

async function autofillFromUrl() {
  const url = document.getElementById("urlInput");
  const status = document.getElementById("autofillStatus");
  if (!url || !url.value.trim()) { status.textContent = "Enter a URL first."; status.style.color = "#b00"; return; }
  status.textContent = "Reading your site…"; status.style.color = "var(--ink-soft)";
  try {
    const resp = await fetch("/api/autofill", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.value.trim() }),
    });
    const data = await resp.json();
    if (data.error) { status.textContent = data.error; status.style.color = "#b00"; return; }
    if (data.title) document.getElementById("fieldTitle").value = data.title;
    if (data.description) {
      document.getElementById("fieldTagline").value = data.description.slice(0, 90);
      document.getElementById("fieldDescription").value = data.description;
    }
    if (data.logo) {
      document.getElementById("fieldLogoUrlAuto").value = data.logo;
      const hint = document.getElementById("logoFileHint");
      if (hint) hint.textContent = "Found a logo on your site — it'll be used unless you upload your own below.";
    }
    status.textContent = "Auto-filled from your site — target market and tags aren't detected automatically, add those yourself. Review before submitting.";
    status.style.color = "#1a7f3c";
  } catch (err) {
    status.textContent = "Could not reach the autofill service."; status.style.color = "#b00";
  }
}
const autofillBtn = document.getElementById("autofillBtn");
if (autofillBtn) autofillBtn.addEventListener("click", autofillFromUrl);

async function uploadListingImage(file, prefix) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${currentUser.id}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from("listing-images").upload(path, file, { contentType: file.type || "image/png" });
  if (error) throw error;
  const { data } = sb.storage.from("listing-images").getPublicUrl(path);
  return data.publicUrl;
}

const screenshotsInputEl = document.getElementById("fieldScreenshots");
if (screenshotsInputEl) screenshotsInputEl.addEventListener("change", () => {
  const hint = document.getElementById("screenshotsHint");
  if (screenshotsInputEl.files.length > 5) {
    hint.textContent = "Only the first 5 images will be uploaded.";
    hint.style.color = "#b00";
  } else {
    hint.textContent = "Shown on your product page.";
    hint.style.color = "var(--ink-soft)";
  }
});

const submitBtn = document.getElementById("submitListingBtn");
if (submitBtn) submitBtn.addEventListener("click", async () => {
  const statusEl = document.getElementById("submitStatus");
  if (!currentUser) { openAuthModal(); return; }
  if (selectedWeekIdx === null) { statusEl.textContent = "Pick a launch week first."; statusEl.style.color = "#b00"; return; }
  const plan = document.querySelector('input[name="plan"]:checked').value;

  const name = document.getElementById("fieldTitle").value.trim();
  const tagline = document.getElementById("fieldTagline").value.trim();
  const description = document.getElementById("fieldDescription").value.trim();
  const url = document.getElementById("urlInput").value.trim();
  const targetMarket = document.getElementById("fieldMarket").value.trim();
  const tags = document.getElementById("fieldTags").value.split(",").map(t => t.trim()).filter(Boolean);
  const launchWeek = toISODate(SLOT_WEEKS[selectedWeekIdx]);
  if (!name || !tagline || !url) { statusEl.textContent = "Name, tagline and URL are required."; statusEl.style.color = "#b00"; return; }

  const logoFile = document.getElementById("fieldLogoFile")?.files?.[0] || null;
  const logoUrlAuto = document.getElementById("fieldLogoUrlAuto")?.value || "";
  const screenshotFiles = screenshotsInputEl && screenshotsInputEl.files ? Array.from(screenshotsInputEl.files).slice(0, 5) : [];

  statusEl.textContent = "Uploading images…"; statusEl.style.color = "var(--ink-soft)";
  let logoUrl = logoUrlAuto || null;
  const screenshots = [];
  try {
    if (logoFile) logoUrl = await uploadListingImage(logoFile, "logo");
    for (const f of screenshotFiles) screenshots.push(await uploadListingImage(f, "shot"));
  } catch (err) {
    statusEl.textContent = "Image upload failed: " + err.message; statusEl.style.color = "#b00"; return;
  }

  if (plan === "free") {
    statusEl.textContent = "Submitting…"; statusEl.style.color = "var(--ink-soft)";
    const row = {
      user_id: currentUser.id, name, tagline, description, url,
      logo_url: logoUrl, screenshots, target_market: targetMarket, tags,
      plan, launch_week: launchWeek, status: "live", dofollow: false,
    };
    const { error } = await sb.from("listings").insert(row);
    if (error) { statusEl.textContent = error.message; statusEl.style.color = "#b00"; return; }
    statusEl.textContent = "Submitted! Install the badge (see badge.html) — it's checked weekly to keep your dofollow link.";
    statusEl.style.color = "#1a7f3c";
    return;
  }

  // Premium: go straight to checkout — the listing is only created once payment succeeds (via webhook).
  statusEl.textContent = "Redirecting to payment…"; statusEl.style.color = "var(--ink-soft)";
  const resp = await fetch("/api/create-checkout", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "premium_new",
      userId: currentUser.id,
      name, tagline, description, url,
      logoUrl: logoUrl || "",
      screenshots,
      targetMarket, tags: tags.join(","),
      launchWeek,
      ...datafastIds(),
    }),
  });
  const out = await resp.json();
  if (out.url) { location.href = out.url; return; }
  statusEl.textContent = out.error || "Could not start checkout."; statusEl.style.color = "#b00";
});

/* ---------- advertise.html: ad slot checkout ---------- */
const bookAdSlotBtn = document.getElementById("bookAdSlotBtn");
if (bookAdSlotBtn) bookAdSlotBtn.addEventListener("click", async () => {
  const statusEl = document.getElementById("adSlotStatus");
  if (!currentUser) return openAuthModal();
  const name = document.getElementById("adName").value.trim();
  const tagline = document.getElementById("adTagline").value.trim();
  const logoFile = document.getElementById("adLogoFile")?.files?.[0] || null;
  const targetUrl = document.getElementById("adTargetUrl").value.trim();
  if (!name || !tagline || !targetUrl) {
    statusEl.textContent = "Name, tagline and link are required."; statusEl.style.color = "#b00"; return;
  }
  statusEl.textContent = "Uploading logo…"; statusEl.style.color = "var(--ink-soft)";
  let logoUrl = "";
  try {
    if (logoFile) logoUrl = await uploadListingImage(logoFile, "ad-logo");
  } catch (err) {
    statusEl.textContent = "Logo upload failed: " + err.message; statusEl.style.color = "#b00"; return;
  }
  statusEl.textContent = "Redirecting to payment…"; statusEl.style.color = "var(--ink-soft)";
  const resp = await fetch("/api/create-checkout", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "ad_slot", userId: currentUser.id, email: currentUser.email, name, tagline, logoUrl, targetUrl, ...datafastIds() }),
  });
  const out = await resp.json();
  if (out.url) { location.href = out.url; return; }
  statusEl.textContent = out.error || "Could not start checkout."; statusEl.style.color = "#b00";
});

/* ---------- badge.html: verify your own free listings ---------- */
async function renderMyListings() {
  const el = document.getElementById("myListings");
  if (!el) return;
  if (!currentUser) {
    el.innerHTML = `<button class="btn btn-outline" id="myListingsSignIn">Sign in to check your listings</button>`;
    document.getElementById("myListingsSignIn").onclick = openAuthModal;
    return;
  }
  const { data: listings } = await sb.from("listings").select("*").eq("user_id", currentUser.id).eq("plan", "free");
  if (!listings || !listings.length) { el.innerHTML = `<p style="color:var(--ink-soft);font-size:13.5px">You don't have any free listings yet.</p>`; return; }
  el.innerHTML = listings.map(l => `
    <div style="display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:10px">
      <strong style="flex:1">${l.name}</strong>
      <span id="badgeStatus-${l.id}" style="font-size:12.5px;color:var(--ink-soft)">${badgeStatusLabel(l.badge_status)}</span>
      <button class="btn btn-outline" data-verify="${l.id}" style="padding:6px 14px;font-size:12.5px">Verify now</button>
    </div>`).join("");
  el.querySelectorAll("[data-verify]").forEach(btn => btn.addEventListener("click", async () => {
    const id = btn.dataset.verify;
    const label = document.getElementById(`badgeStatus-${id}`);
    label.textContent = "Checking…";
    btn.disabled = true;
    const resp = await fetch("/api/verify-badge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: id }),
    });
    const out = await resp.json();
    label.textContent = out.verified ? "✓ Verified — dofollow active" : "Badge not found — still nofollow";
    label.style.color = out.verified ? "#1a7f3c" : "#b00";
    btn.disabled = false;
  }));
}
function badgeStatusLabel(status) {
  if (status === "verified") return "✓ Verified — dofollow active";
  if (status === "missing") return "Badge not found — nofollow";
  return "Not checked yet";
}

/* ---------- index.html: real ad slots in the sidebar ---------- */
async function renderAdSlots() {
  const el = document.getElementById("adSlots");
  if (!el) return;
  const { data: ads, error } = await sb.from("ad_slots_public").select("*").order("created_at", { ascending: false }).limit(4);
  const bought = (ads || []).map(ad => `
    <div class="ad-card">
      <div class="ad-top">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <div class="logo" style="width:36px;height:36px;flex:none;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">
            ${ad.logo_url ? `<img src="${ad.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:9px">` : (ad.name || "?").charAt(0).toUpperCase()}
          </div>
          <strong style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ad.name || ""}</strong>
        </div>
        <a class="btn btn-outline" href="${ad.target_url}" target="_blank" rel="noopener sponsored" style="padding:4px 10px;font-size:12px;flex:none">Visit</a>
      </div>
      <h4>${ad.tagline || ""}</h4>
    </div>`).join("");
  const emptySlotsNeeded = Math.max(0, 2 - (ads ? ads.length : 0));
  const empty = Array.from({ length: emptySlotsNeeded }).map(() => `
    <div class="ad-slot-empty">
      <div class="icon" style="justify-content:center">${ICON_MEGAPHONE}</div>
      <strong>Your ad here</strong>
      <div class="price">From $15/mo</div>
      <div style="margin-top:10px"><a class="btn btn-outline" href="advertise.html" style="font-size:12.5px;padding:6px 14px">Book this slot</a></div>
    </div>`).join("");
  el.innerHTML = bought + empty;
}
