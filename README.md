# Owned Map

Marketing site and app preview for Owned Map, a global asset intelligence platform.

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
   `http://localhost:4173/app.html` for local work) to *Redirect URLs*. Email sign-in must be enabled. Sign-in is email + password with no public sign-up: turn OFF *Allow new users to sign up* and create each account by hand (Authentication > Users > Add user, tick *Auto Confirm User*).
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
3. Set `SITE_URL` (e.g. `https://ownedmap.example.com`) for the production build so canonical/Open Graph tags and
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

`npm run mock` serves the site and a local stand-in for Supabase (auth, per-user rows, token expiry) on http://localhost:4180/app.html; create an account with `/__user?email=you@example.com&password=secret` and sign in with it. `npm run e2e` drives that app in headless Chrome: sign-in, sample data, add, edit after token expiry, delete, row isolation between users, sign-out.

## Debt, import, exports, documents and reminders

Run `supabase/migrations/20261029000000_debt_documents_reminders.sql` once in the Supabase SQL editor (after `assets.sql`). It adds the debt columns, the `asset_documents` and `asset_reminders` tables with Row Level Security, and a private `asset-docs` storage bucket whose policies keep every user inside their own folder. Until it is applied, assets without debt keep working; documents, reminders and debt need it.

- **Net worth:** each asset can carry a mortgage or loan balance and monthly payment. Portfolio net worth is value minus debt.
- **Import:** `Import CSV` in the app (template included) validates every row with the same rules as the form and shows what will be imported before anything is saved.
- **Exports:** Reports tab: PDF (the browser print dialog, choose "Save as PDF"), Excel `.xlsx` (built in the browser, no library) and CSV.
- **Documents:** up to 10 MB per file, stored in the private bucket (cloud) or in IndexedDB (device mode).
- **Reminders:** always shown in the app. Email alerts need a daily job: set `RESEND_API_KEY`, `REMINDER_FROM` (a sender verified in Resend), `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel. `vercel.json` already schedules `/api/send-reminders` once a day; the build turns on the "email alerts" wording only when `RESEND_API_KEY` and `CRON_SECRET` exist.
- **Local checks:** `npm test` and `npm run e2e` (mock Supabase incl. storage; covers import, documents, reminders, exports and cascading deletes).

## Net worth over time, cash flow, shared ownership, sharing, undo and the first-minute guide

Run `supabase/migrations/20261030000000_ownership_sharing.sql` once (after the earlier migrations). It adds `ownership` and `owner` to assets and the `asset_shares` table. Assets keep working before it is applied; ownership, owner and sharing need it.

- **Portfolio over time:** Performance tab. Built from each asset's value history; every point also stores the debt balance (`b`) from the moment it is known.
- **Update value:** one-click dialog (value and debt) that adds a history point and can create the monthly "Update estimated value" reminder.
- **Ownership:** figures are entered for the whole asset; the product shows and adds up only the owner's share.
- **Cash flow tab:** monthly income, expenses and loan payments (yearly figures divided by 12).
- **Share links:** `Share` in the app creates `/share.html#t=SECRET`. Only a SHA-256 hash is stored; `/api/share` (service role) returns the assets, never notes, documents or reminders, and strips debt if the owner chose so. Links expire and can be revoked.
- **Undo:** deleting hides the asset and deletes it for real after 8 seconds unless Undo is pressed; closing the tab inside that window keeps the asset.

## Document autofill (v4)

`Add an asset` has an "Upload an invoice, deed or contract" box. The PDF or photo goes to `POST /api/extract`, which checks the user is signed in, sends the file to Claude (`claude-opus-5-5`, structured output, no storage), looks the address up on OpenStreetMap Nominatim for exact coordinates, and returns values for the form. Everything is editable; fields filled from the document are highlighted; amounts in a currency other than USD are not converted, only reported. The feature appears only when `ANTHROPIC_API_KEY` is set in Vercel (the build writes `extractor: true` into `assets/config.js`). Limits: 3 MB per PDF (photos are shrunk in the browser), 30 documents per user per hour per server instance.

## v4: currencies, loans, insights, usual reminders, VIN, emergency sheet

Apply `supabase/migrations/20261031000000_currency_rates_settings.sql` (adds `currency`, `debt_rate`, `annual_change` to assets and the `user_settings` table). Assets keep working without it; currency, loan rate, yearly change, goal, concentration level, sale assumptions and emergency contacts need it.

- **Currencies** (`src/fx.js`): each asset is entered in its own currency; everything is shown and added up in US dollars. Daily ECB rates from frankfurter.dev (free), cached on the device; if they cannot be loaded the last cached ones are used and a banner says so, and with none at all assets are shown unconverted with a warning (no rate is ever invented). History is converted at today's rate. Document autofill now keeps the document's currency.
- **Loan calculator** (`src/finance.js` `amortize`): payoff date, interest still to pay, effect of extra payments; can save rate and payment to the asset.
- **Insights tab**: net-worth goal, 1/5/10 year projections (only from the yearly change and loan terms the user typed), concentration warnings with a level the user sets, returns ranking.
- **Value that moves on its own**: `annual_change` % per asset, applied from the day the value was last confirmed.
- **If sold**: sale price, selling costs and tax assumptions, what is kept after paying the loan, and the effect on net worth.
- **The usual reminders** (`standardFor` in `src/reminders.js`): per kind of asset, with placeholder dates the user is asked to correct.
- **VIN lookup** (`api/vin.js`): free NHTSA vPIC database, US-market vehicles.
- **Emergency sheet** (`src/emergency.js`): printable page with assets, locations, documents by name, upcoming dates and the contacts the user saved.

## Map drill-down (Country view)

In **Country**, the map splits the country into its regions (US states, Canadian provinces, Spain's autonomous communities, Italian and French regions, UK regions, German Länder, Japanese prefectures...). Regions with assets are tinted and carry a bubble with the number of assets. Click a bubble, a region or a card to zoom into the region (cities appear as bubbles), then into a city (the individual assets). The breadcrumb, `Esc` and the Globe/Country toggle take you back. The numbers in the header follow the place you are in.

- Outlines: `assets/regions/<CC>.js`, generated by `npm run make-regions` from Natural Earth 1:10m admin-1 (public domain), simplified, with Spain, Italy, France and the UK merged up to regions people name. Loaded only when a country is opened.
- Which region an asset belongs to is decided from its latitude and longitude (`src/regions.js`). The cities in the built-in list are placed once at build time against the full-resolution outlines (`assets/regions/cities.js`), so a point on a border (Manhattan / New Jersey) lands on the right side; a typed address right on a border may be off by about a kilometre.
- Mainland only, like the country outlines: Alaska, Hawaii, the Canary Islands and other far-flung territories are listed under the country but not drawn.

## Household access (partner or family)

The owner invites a person by email as **Can view** or **Can edit** (Reports, "Household access"). The app produces a one-time link
(`app.html#invite=<secret>`) that the owner sends by hand; only a SHA-256 hash of the secret is stored, and it expires after 7 days.
The invited person chooses a password (or signs in, if the email already has an account) and sees the portfolio in their own account;
a selector in the sidebar switches between their own portfolio and the shared ones.

- The rules live in the database: `supabase/migrations/20261101000000_household_access.sql` (table `account_members`, functions `can_read`/`can_edit`,
  new policies for assets, documents, reminders and the file bucket). A viewer cannot write even by calling the database directly; the e2e test checks it.
- `api/invite.js` (service role) previews an invitation and accepts it, creating the account for the invited email when it does not exist. It needs no new variable.
- Members cannot create share links, invite others, print the owner's emergency sheet or load sample data.
- Apply the migration once (SQL editor, or the Supabase assistant) before using the feature; without it the sidebar selector simply does not appear.

## Trusted person (emergency access)

Reports, "Trusted person": the owner chooses one person and a time (30 days to 1 year). That person has no account: they hold a private link
(`heir.html#t=<secret>`; only a SHA-256 hash is stored). The link does nothing until the sheet is **open**, which happens when the owner has not visited the app
for the chosen time, or when the owner presses "Release it now". Every visit of the owner (the app calls `touch()` on load) moves the clock and closes it again.

- The rules are in `src/heir-core.js` (pure, shared by the app and the server) and the table `emergency_access` (`supabase/migrations/20261102000000_trusted_person.sql`, owner-only RLS).
- `api/heir.js` (service role) decides at the moment of each visit. It returns the assets with debt, the **names** of documents (never files or storage paths), open reminders and the owner's emergency contacts and note. Unknown, paused and removed links all answer 404; a closed one answers 403 "locked".
- `api/heir-check.js` (daily cron, 13:30 UTC) emails the owner 14 days before it opens and tells the trusted person once that it is open (never with the link). It needs the same email variables as the reminders: `RESEND_API_KEY`, `REMINDER_FROM`, `CRON_SECRET`. Without them the feature still works, but nobody is emailed.
- The owner sees a banner if the sheet was opened since their last visit.
- Apply the migration once. It is not a will and does not transfer ownership; the screen says so, and it asks for an explicit confirmation before creating the link. Have a lawyer review how it fits with local rules before selling it.
