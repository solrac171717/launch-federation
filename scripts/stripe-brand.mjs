// Puts the Owned Map name and logo on the Stripe product and prices. Run once per Stripe mode (test, live):
//   STRIPE_SECRET_KEY=sk_... SITE_URL=https://your-site node scripts/stripe-brand.mjs
// The logo must be reachable on the web, so deploy the site first. The account logo, colours and statement descriptor are set in the Stripe Dashboard (Settings, Branding).
import { stripeClient, brandStripe } from '../api/_stripe.js';

const site = process.env.SITE_URL;
if (!site) { console.error('Set SITE_URL to the public address of the site, e.g. https://ownedmap.app'); process.exit(1); }
const r = await brandStripe(stripeClient({ env: process.env }), site);
console.log(r.product ? `Updated product ${r.product} and ${r.prices} price(s).` : 'No Owned Map product in this Stripe account yet: it is created on the first checkout, with the logo.');
