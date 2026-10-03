// Stripe webhook: on checkout.session.completed, creates/updates the paid listing as
// "scheduled" (awaiting admin approval, dofollow already set) or activates an ad slot.
// Uses the Supabase service_role key to bypass RLS — this is the only place that key
// is used, and it never reaches the client.
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

module.exports.config = { api: { bodyParser: false } };

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];
  const raw = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { kind, listingId, userId } = session.metadata || {};

    if (kind === "premium" && listingId) {
      const { error } = await sb.from("listings")
        .update({ status: "scheduled", dofollow: true })
        .eq("id", listingId);
      if (error) console.error("premium update failed", error);
    }

    if (kind === "premium_new" && userId) {
      const meta = session.metadata || {};
      const screenshots = [];
      for (let i = 0; i < 5; i++) {
        if (meta[`shot${i}`]) screenshots.push(meta[`shot${i}`]);
      }
      const { error } = await sb.from("listings").insert({
        user_id: userId,
        name: meta.name || "",
        tagline: meta.tagline || "",
        description: meta.description || "",
        url: meta.url || "",
        logo_url: meta.logoUrl || null,
        screenshots,
        target_market: meta.targetMarket || "",
        tags: (meta.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
        plan: "premium",
        launch_week: meta.launchWeek,
        status: "scheduled",
        dofollow: true,
      });
      if (error) console.error("premium_new insert failed", error);
    }

    if (kind === "ad_slot" && userId) {
      const { name, tagline, logoUrl, targetUrl } = session.metadata || {};
      const { error } = await sb.from("ad_slots").insert({
        user_id: userId,
        stripe_subscription_id: session.subscription || null,
        stripe_customer_id: session.customer || null,
        status: "active",
        name: name || null,
        tagline: tagline || null,
        logo_url: logoUrl || null,
        target_url: targetUrl || null,
      });
      if (error) console.error("ad_slot insert failed", error);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const { error } = await sb.from("ad_slots")
      .update({ status: "canceled" })
      .eq("stripe_subscription_id", sub.id);
    if (error) console.error("ad_slot cancel failed", error);
  }

  res.status(200).json({ received: true });
};
