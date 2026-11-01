// The login page: Google sign-in goes through Supabase (provider "google") and comes back to the app, which finishes the session from the URL.
// The cards on the right are plain data. Each testimonial has a stock portrait chosen by the gender of the name; a testimonial without `photo` shows the person's initials instead.
import { CONFIG } from './assets/config.js';

const TESTIMONIALS = [
  { photo: "assets/t-michael.jpg", name: "Michael Anderson", role: "Individual Investor · Real Estate & Vehicles", quote: "I've always struggled to keep track of all my assets across different platforms. Owned Map brings everything together in one place and makes it incredibly easy to understand my overall portfolio. I honestly wish I had started using it sooner." },
  { photo: "assets/t-sarah.jpg", name: "Sarah Mitchell", role: "Real Estate Investor · Residential Properties", quote: "Managing multiple properties used to mean endless spreadsheets and scattered documents. Now I can see their values, performance and income in seconds. The map view is brilliant, and the financial overview is exactly what I needed." },
  { photo: "assets/t-james.jpg", name: "James Richardson", role: "Business Owner · Commercial Real Estate & Equipment", quote: "Owned Map has completely changed how I monitor my business assets. Having property, equipment and vehicles organized in one dashboard saves me hours every month. It's simple, professional and surprisingly intuitive." },
  { photo: "assets/t-emily.jpg", name: "Emily Thompson", role: "Private Investor · Property & Land", quote: "I love being able to see my entire portfolio geographically. It gives me a much clearer picture of where my investments are concentrated and how they're performing. Everything feels more organized and accessible." },
  { photo: "assets/t-robert.jpg", name: "Robert Williams", role: "Entrepreneur · Real Estate & Luxury Vehicles", quote: "The biggest benefit is having one reliable overview of everything I own. I can quickly check estimated values, acquisition costs and performance without opening five different files. A genuinely useful tool for anyone with multiple assets." },
  { photo: "assets/t-daniel.jpg", name: "Daniel Foster", role: "Individual Investor · Diversified Portfolio", quote: "The visual experience is what sold me. Instead of looking through complicated spreadsheets, I can simply open Owned Map and see my assets around the world. It makes portfolio management feel effortless." },
  { photo: "assets/t-olivia.jpg", name: "Olivia Bennett", role: "Property Investor · Residential & Commercial", quote: "I particularly appreciate the financial breakdown for each property. Being able to compare income, expenses, yields and estimated values makes it much easier to understand how my investments are doing. Everything is beautifully presented." },
  { photo: "assets/t-christopher.jpg", name: "Christopher Hayes", role: "Portfolio Manager · Private Assets", quote: "I was looking for a straightforward way to consolidate information about different types of assets. Owned Map does exactly that. The reporting features are especially useful when I need a quick snapshot of the entire portfolio." },
  { photo: "assets/t-victoria.jpg", name: "Victoria Clarke", role: "Business Owner · Real Estate & Marine Assets", quote: "What I like most is that I'm not limited to tracking properties. I can include my boat, vehicles and other valuable assets too. Finally, everything has a home in one organized and easy-to-use platform." },
  { photo: "assets/t-andrew.jpg", name: "Andrew Cooper", role: "Real Estate Entrepreneur · Multi-property Owner", quote: "Owned Map has made tracking my properties much less time-consuming. The ability to see acquisition costs alongside current estimated values is particularly helpful. It's become one of the first things I check when reviewing my portfolio." },
  { photo: "assets/t-benjamin.jpg", name: "Benjamin Parker", role: "Individual Investor · Real Estate & Aircraft", quote: "I own assets in several locations, and keeping everything organized was becoming increasingly difficult. Owned Map gives me a global overview without unnecessary complexity. The interface is clean, fast and very easy to navigate." },
  { photo: "assets/t-charlotte.jpg", name: "Charlotte Morgan", role: "Wealth Manager · Private Investment Portfolio", quote: "The ability to generate portfolio reports in different formats is a huge advantage. I can get a clear overview of asset allocation, estimated values and income without manually preparing everything. A very practical solution." },
  { photo: "assets/t-matthew.jpg", name: "Matthew Edwards", role: "Entrepreneur · Commercial Property & Vehicles", quote: "Before Owned Map, I had no simple way to see the full picture of my assets. Now I can understand their value, location and performance at a glance. It has brought a lot more clarity to managing what I own." },
  { photo: "assets/t-jessica.jpg", name: "Jessica Turner", role: "Private Investor · Global Real Estate", quote: "Having investments across different countries makes organization challenging. Owned Map makes it easy to visualize everything on a single global map. I especially love how quickly I can switch between individual assets and the complete portfolio." },
  { photo: "assets/t-william.jpg", name: "William Scott", role: "Business Owner · Industrial Equipment & Real Estate", quote: "This is exactly the kind of tool I was missing. I can track very different assets using the same consistent system, which makes everything easier to manage. The financial overview and export options are excellent." },
  { photo: "assets/t-alexander.jpg", name: "Alexander Brooks", role: "Individual Investor · Luxury Assets & Property", quote: "I appreciate how simple Owned Map makes something that is usually quite complicated. My properties, cars and other investments are all visible in one place. It gives me a much better understanding of my overall net worth." },
  { photo: "assets/t-natalie.jpg", name: "Natalie Reynolds", role: "Real Estate Investor · Rental Properties", quote: "The income and expense tracking is incredibly useful. I can see how each property performs individually and compare yields across my portfolio. It's a much cleaner way to stay on top of my investments." },
  { photo: "assets/t-jonathan.jpg", name: "Jonathan Pierce", role: "Entrepreneur · International Asset Portfolio", quote: "I've tried several tools to organize my assets, but most were either too complicated or too limited. Owned Map strikes the perfect balance. It brings everything together while keeping the experience incredibly straightforward." },
  { photo: "assets/t-rebecca.jpg", name: "Rebecca Collins", role: "Private Investor · Property, Land & Marine Assets", quote: "The platform gives me a level of visibility I didn't have before. I can quickly review where my assets are, what they're worth and how they've changed over time. It makes managing a diversified portfolio much more convenient." },
  { photo: "assets/t-thomas.jpg", name: "Thomas Harrison", role: "High-Net-Worth Individual · Diversified Assets", quote: "Owned Map has become my go-to place for understanding my assets. I no longer need to piece together information from different spreadsheets and documents. One map, one overview and a much clearer picture of everything I own." },
];

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
const initials = name => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const HUES = [215, 200, 230, 250, 190, 265];
const card = (t, i) => {
  const c = el('figure', 'lg-card');
  const stars = el('span', 'lg-stars', '\u2605\u2605\u2605\u2605\u2605'); stars.setAttribute('role', 'img'); stars.setAttribute('aria-label', '5 out of 5 stars');
  let av;
  if (t.photo) { av = el('img', 'lg-av'); av.src = t.photo; av.alt = ''; av.width = 44; av.height = 44; av.loading = 'lazy'; }
  else { av = el('span', 'lg-av lg-ini', initials(t.name)); av.style.setProperty('--h', HUES[i % HUES.length]); av.setAttribute('aria-hidden', 'true'); }
  const who = el('div', 'lg-who'); who.append(el('b', 'lg-name', t.name), el('span', 'lg-role', t.role));
  const foot = el('figcaption', 'lg-foot'); foot.append(av, who);
  c.append(stars, el('blockquote', 'lg-cp', `\u201c${t.quote}\u201d`), foot);
  return c;
};

// two copies of the list, scrolled by half its height, make the loop seamless
const col = document.getElementById('lg-col'), track = el('div', 'lg-track');
[0, 1].forEach(i => { const g = el('div', 'lg-group'); if (i) g.setAttribute('aria-hidden', 'true'); TESTIMONIALS.forEach((t, k) => g.append(card(t, k))); track.append(g); });
col.append(track);

const google = document.getElementById('lg-google'), msg = document.getElementById('lg-msg');
const base = String(CONFIG.supabaseUrl || '').replace(/\/$/, '');
if (base) {
  google.href = `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${location.origin}/app.html`)}`;
} else {
  google.addEventListener('click', e => { e.preventDefault(); msg.hidden = false; msg.textContent = 'Google sign-in is not set up on this site yet. Use your email and password below.'; });
}
