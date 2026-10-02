// POST { url } — checks a URL for our badge without touching the database.
// Used on submit.html so founders can verify the badge before the listing even exists.
const { checkBadge } = require("../lib/badgeCheck");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url required" });

  const found = await checkBadge(url);
  res.status(200).json({ verified: found });
};
