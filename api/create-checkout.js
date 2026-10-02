// POST { kind: "premium", listingId } or { kind: "ad_slot", userId, email }
// Creates a Stripe Checkout Session and returns its URL. The client redirects to it.
const Stripe = require("stripe");

const PRICE = {
  premium: "price_1UMAPCAXc6wDABc5Kv6osLoY",
  ad_slot: "price_1UMAQ8AXc6wDABc5CrHvwbDT",
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { kind, listingId, userId, email } = req.body || {};
  const origin = `https://${req.headers.host}`;

  try {
    if (kind === "premium") {
      if (!listingId) return res.status(400).json({ error: "listingId required" });
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: PRICE.premium, quantity: 1 }],
        metadata: { kind: "premium", listingId },
        success_url: `${origin}/submit.html?paid=1`,
        cancel_url: `${origin}/submit.html?canceled=1`,
      });
      return res.status(200).json({ url: session.url });
    }

    if (kind === "ad_slot") {
      if (!userId) return res.status(400).json({ error: "userId required" });
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: PRICE.ad_slot, quantity: 1 }],
        customer_email: email,
        metadata: { kind: "ad_slot", userId },
        subscription_data: { metadata: { kind: "ad_slot", userId } },
        success_url: `${origin}/advertise.html?paid=1`,
        cancel_url: `${origin}/advertise.html?canceled=1`,
      });
      return res.status(200).json({ url: session.url });
    }

    return res.status(400).json({ error: "Unknown kind" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
