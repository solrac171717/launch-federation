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
  const { kind, listingId, userId, email, datafastVisitorId, datafastSessionId } = req.body || {};
  const origin = `https://${req.headers.host}`;
  const datafastMeta = {
    ...(datafastVisitorId ? { datafast_visitor_id: datafastVisitorId } : {}),
    ...(datafastSessionId ? { datafast_session_id: datafastSessionId } : {}),
  };

  try {
    if (kind === "premium") {
      if (!listingId) return res.status(400).json({ error: "listingId required" });
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: PRICE.premium, quantity: 1 }],
        metadata: { kind: "premium", listingId, ...datafastMeta },
        success_url: `${origin}/submit.html?paid=1`,
        cancel_url: `${origin}/submit.html?canceled=1`,
      });
      return res.status(200).json({ url: session.url });
    }

    if (kind === "premium_new") {
      const { name, tagline, description, url, logoUrl, screenshots, targetMarket, tags, launchWeek } = req.body || {};
      if (!userId || !name || !tagline || !url || !launchWeek) {
        return res.status(400).json({ error: "userId, name, tagline, url and launchWeek are required" });
      }
      const trim500 = (s) => (s || "").toString().slice(0, 480);
      const metadata = {
        kind: "premium_new",
        userId,
        name: trim500(name),
        tagline: trim500(tagline),
        description: trim500(description),
        url: trim500(url),
        logoUrl: trim500(logoUrl),
        targetMarket: trim500(targetMarket),
        tags: trim500(tags),
        launchWeek,
        ...datafastMeta,
      };
      (Array.isArray(screenshots) ? screenshots.slice(0, 5) : []).forEach((s, i) => {
        metadata[`shot${i}`] = trim500(s);
      });
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: PRICE.premium, quantity: 1 }],
        metadata,
        success_url: `${origin}/submit.html?paid=1`,
        cancel_url: `${origin}/submit.html?canceled=1`,
      });
      return res.status(200).json({ url: session.url });
    }

    if (kind === "ad_slot") {
      const { name, tagline, logoUrl, targetUrl } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId required" });
      if (!name || !tagline || !targetUrl) return res.status(400).json({ error: "name, tagline and targetUrl are required" });
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: PRICE.ad_slot, quantity: 1 }],
        customer_email: email,
        metadata: { kind: "ad_slot", userId, name, tagline, logoUrl: logoUrl || "", targetUrl, ...datafastMeta },
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
