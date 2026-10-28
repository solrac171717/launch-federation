# ATLAS

Marketing site and app preview for ATLAS, a global asset intelligence platform.

- `index.html` + `landing.css` + `landing.js` — the visual-first landing page (static, no framework, no map SDK). The form asks only for email + consent; `src/lead.js` still accepts optional name, portfolio size, asset types and investor type.
- `app.html` + `app.css` + `src/app-main.js` — **the app**: the same dashboard as the website preview (Map with Globe/Country,
  Assets, Performance, Reports), running on the user's own assets. Add, edit and delete assets, sign in by email link,
  CSV export. Storage is Supabase when configured, otherwise the visitor's browser (see "The app" below).
- `src/dashboard.js` — the dashboard itself. The landing page mounts it on sample data; the app mounts it on real data.
  Shared pieces live in `src/ui.js` (formatters, cards, charts), `src/geoui.js` (Globe/Country switcher) and `src/globe.js`.
- `api/early-access.js` — serverless endpoint that stores early-access leads.
- `src/demo-data.js` — the *illustrative* sample portfolio used by the landing-page previews. Every figure
  (NOI, yields, totals) is computed from the same records, and `test/lead.test.js` checks they agree.

## The app (`app.html`)

Data model: one row per asset (`supabase/assets.sql`). Value history is stored with the asset and grows each time its
estimated value changes, which is what the Performance chart plots.

**Without configuration** the app runs in "this device only" mode: assets are saved in the browser's `localStorage`.
Nothing is uploaded and nobody signs in.

**With Supabase** (users sign in and their assets follow them across devices):

1. In the Supabase SQL editor run `supabase/assets.sql`. It creates `public.assets` with Row Level Security, so every
   user can only read and write their own rows. Nothing is readable by anonymous visitors.
2. Authentication → URL Configuration: set *Site URL* to your site and add `https://YOUR-SITE/app.html` (and
   `http://localhost:4173/app.html` for local work) to *Redirect URLs*. Email sign-in (magic link) must be enabled.
3. Build with the **public anon key** (never the service-role key):
   `SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=... npm run build`. On Vercel set both as environment
   variables. The build writes them to `dist/assets/config.js`. For local development edit `assets/config.js` by hand.
4. Supabase's built-in email sender is limited to a few messages per hour. For real use, configure your own SMTP
   under Authentication → SMTP Settings.

Asset types, categories and the built-in city list are in `src/types.js` and `src/places.js`. Country outlines for the
Country view are generated with `npm run make-countries`.

## Early-access form (needs configuration)

The form posts to `/api/early-access`, which writes to Supabase with a server-side key. Until configured the
endpoint answers `503` and the form tells the visitor that nothing was saved — it never fakes success.

1. Run `supabase/early_access.sql` in your Supabase project (RLS is enabled; only the service role writes).
2. Set env vars on the host (e.g. Vercel): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `SITE_URL` (e.g. `https://atlas.example.com`) for the production build so canonical/Open Graph tags and
   `sitemap.xml` are emitted.

Not included yet: rate limiting, email confirmation, a consent banner, Privacy Policy and Terms pages.

## Analytics

`landing.js` exposes a provider-agnostic `analytics.track()` (events: `landing_page_view`, `primary_cta_click`,
`secondary_cta_click`, `early_access_form_start|submit|success|error`, `faq_expand`). It sends nothing unless
`window.atlasConsent === true` **and** Plausible or gtag is present on the page. Never pass financial data.

## Headline variants

Default is Variant A. Preview B or C with `?hv=B` / `?hv=C` (copy lives in `HEADLINES` in `landing.js`).

## Commands

```
npm test         # maths, validation, API handler and demo-data coherence tests
npm run build    # syntax-checks, copies to dist/, applies SITE_URL, verifies local references
npm start        # static server + /api routes on http://localhost:4173
npm run make-map # regenerate assets/world-map.js (dot map + marker positions)
npm run make-countries # regenerate assets/countries.js (outlines + dot grids for the Country view)
```

## Testing the signed-in app without a Supabase project

`npm run mock` serves the site and a local stand-in for Supabase (auth, per-user rows, token expiry) on http://localhost:4180/app.html; the magic link is available at `/__link?email=you@example.com`. `npm run e2e` drives that app in headless Chrome: sign-in, sample data, add, edit after token expiry, delete, row isolation between users, sign-out.
