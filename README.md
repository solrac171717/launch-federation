# ATLAS

Marketing site and app preview for ATLAS, a global asset intelligence platform.

- `index.html` + `landing.css` + `landing.js` — the landing page (static, no framework, no map SDK).
- `app.html` + `src/app.js` — the working app preview: a local-first world map of holdings with KPIs,
  allocation, per-asset pages, CSV/JSON export and backup/restore. Data lives in browser `localStorage`.
- `api/early-access.js` — serverless endpoint that stores early-access leads.
- `src/demo-data.js` — the *illustrative* sample portfolio used by the landing-page previews. Every figure
  (NOI, yields, totals) is computed from the same records, and `test/lead.test.js` checks they agree.

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
```
