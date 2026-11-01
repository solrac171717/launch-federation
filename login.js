// The login page: Google sign-in goes through Supabase (provider "google") and comes back to the app, which finishes the session from the URL.
// The cards on the right are plain data: replace TESTIMONIALS with real customer quotes ({ quote, name, role }) when you have them.
import { CONFIG } from './assets/config.js';

const TESTIMONIALS = [
  { icon: 'map', title: 'See it all at once', text: 'Houses, cars, boats and aircraft on one interactive map, exactly where they are.' },
  { icon: 'doc', title: 'Add assets from a document', text: 'Upload a deed, invoice or contract and the details fill in. You check and edit.' },
  { icon: 'chart', title: 'Know what each asset earns', text: 'Value, income, expenses and yield side by side, plus your net worth.' },
  { icon: 'share', title: 'Share with your accountant', text: 'A private read-only link. No account needed, and you can turn it off any time.' },
  { icon: 'file', title: 'Reports in one click', text: 'Download a PDF report, an Excel workbook or a CSV of your whole portfolio.' },
  { icon: 'globe', title: 'Assets in any country', text: 'Switch between the globe and country views, with every currency converted.' },
];
const ICONS = {
  map: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  doc: 'M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6',
  chart: 'M4 20V10 M10 20V4 M16 20v-8 M22 20H2',
  share: 'M4 12v7h16v-7 M12 16V4 M8 8l4-4 4 4',
  file: 'M6 3h9l4 4v14H6z M9 12h7 M9 16h7 M9 8h3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
};

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
const card = t => {
  const c = el('figure', 'lg-card');
  if (t.icon) {
    const ic = el('span', 'lg-ic'); ic.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[t.icon] || ICONS.map}"/></svg>`;
    c.append(ic, el('b', 'lg-ct', t.title), el('p', 'lg-cp', t.text));
  } else {
    c.append(el('blockquote', 'lg-cp', `“${t.quote}”`), el('figcaption', 'lg-who', `${t.name}${t.role ? ` · ${t.role}` : ''}`));
  }
  return c;
};

// two copies of the list, scrolled by half its height, make the loop seamless
const col = document.getElementById('lg-col'), track = el('div', 'lg-track');
[0, 1].forEach(i => { const g = el('div', 'lg-group'); if (i) g.setAttribute('aria-hidden', 'true'); TESTIMONIALS.forEach(t => g.append(card(t))); track.append(g); });
col.append(track);

const google = document.getElementById('lg-google'), msg = document.getElementById('lg-msg');
const base = String(CONFIG.supabaseUrl || '').replace(/\/$/, '');
if (base) {
  google.href = `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${location.origin}/app.html`)}`;
} else {
  google.addEventListener('click', e => { e.preventDefault(); msg.hidden = false; msg.textContent = 'Google sign-in is not set up on this site yet. Use your email and password below.'; });
}
