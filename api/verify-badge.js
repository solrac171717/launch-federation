// POST { listingId } — fetches the listing's site, checks for our badge, and updates
// badge_status / dofollow accordingly. Called on demand from badge.html.
const { createClient } = require("@supabase/supabase-js");
const { checkBadge } = require("../lib/badgeCheck");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { listingId } = req.body || {};
  if (!listingId) return res.status(400).json({ error: "listingId required" });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: listing, error } = await sb.from("listings").select("id,url").eq("id", listingId).single();
  if (error || !listing) return res.status(404).json({ error: "Listing not found" });

  const found = await checkBadge(listing.url);
  const { error: upErr } = await sb.from("listings").update({
    badge_status: found ? "verified" : "missing",
    badge_checked_at: new Date().toISOString(),
    dofollow: found,
  }).eq("id", listingId);
  if (upErr) return res.status(500).json({ error: upErr.message });

  res.status(200).json({ verified: found });
};
