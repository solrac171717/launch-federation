// Creates, in Stripe, every price the plans need (Owner, Family and the extra asset, each monthly and yearly), or reports that they already exist.
// Nothing here is required: the first checkout creates them anyway. Run it once if you want them to exist (and be visible in the Stripe dashboard) before that.
//   STRIPE_SECRET_KEY=sk_live_... npm run stripe:setup        (or put STRIPE_SECRET_KEY in a git-ignored .env.local)
// The key never leaves this machine except to talk to api.stripe.com. Safe to run again: it only creates what is missing.
import { readFileSync, existsSync } from 'node:fs';
import { stripeClient, ensurePrices } from '../api/_stripe.js';
import { priceDefs, usd } from '../src/billing-core.js';

const env = { ...process.env };
if (!env.STRIPE_SECRET_KEY && existsSync('.env.local')) {
  const line = readFileSync('.env.local', 'utf8').split(/\r?\n/).find(l => /^STRIPE_SECRET_KEY\s*=/.test(l));
  if (line) env.STRIPE_SECRET_KEY = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}
if (!env.STRIPE_SECRET_KEY) { console.error('Set STRIPE_SECRET_KEY (in the environment or in .env.local).'); process.exit(1); }

const mode = env.STRIPE_SECRET_KEY.startsWith('sk_live') || env.STRIPE_SECRET_KEY.startsWith('rk_live') ? 'LIVE' : 'TEST';
console.log(`Stripe mode: ${mode}`);
const ids = await ensurePrices(stripeClient({ env }));
for (const d of priceDefs()) console.log(`${d.key.padEnd(30)} ${usd(d.cents).padStart(9)} / ${d.interval.padEnd(5)} ${ids[d.key]}`);
console.log('Done.');
