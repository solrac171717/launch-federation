// Stripe webhook: on checkout.session.completed, marks the listing live/dofollow (premium)
// or activates an ad slot (ad_slot). Uses the Supabase service_role key to bypass RLS —
// this is the only place that key is used, and it never reaches the client.
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
        .update({ status: "live", dofollow: true })
        .eq("id", listingId);
      if (error) console.error("premium update failed", error);
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
