// Runs on a schedule (see vercel.json) — re-checks every free listing's badge and flips
// its backlink to nofollow if the badge is missing.
const { createClient } = require("@supabase/supabase-js");
const { checkBadge } = require("../lib/badgeCheck");

module.exports = async (req, res) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: listings, error } = await sb.from("listings").select("id,url").eq("plan", "free").eq("status", "live");
  if (error) return res.status(500).json({ error: error.message });

  let verified = 0, missing = 0;
  for (const l of listings || []) {
    const found = await checkBadge(l.url);
    await sb.from("listings").update({
      badge_status: found ? "verified" : "missing",
      badge_checked_at: new Date().toISOString(),
      dofollow: found,
    }).eq("id", l.id);
    found ? verified++ : missing++;
  }

  res.status(200).json({ checked: (listings || []).length, verified, missing });
};
