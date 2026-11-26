# Owned Map

Owned Map finds people who are asking for what you sell, scores how ready they are to buy, and shows them on an interactive globe with what they said and a reply you can copy.

You paste your website. It works out what you sell and the phrases buyers use, searches public posts, scores each person from 0 to 100, places them where they are, and drafts a reply in your tone. **Nothing is ever posted, sent or clicked for you.**

> This branch (`leads-pivot`) turned the earlier asset-tracking product into this one. Same stack, same Supabase project, same Vercel project, same Stripe and OpenAI accounts. See "What changed" at the end.

## How it is built

- `index.html` + `landing.css` + `leads.css` + `landing.js`: the website (static, no framework). Its globe and lead card are the real app code running on invented sample leads (`src/leads-demo.js`).
- `app.html` + `src/leads-main.js`: the app. Map (globe and country views), Leads (table, filters, one lead in full with the draft), Activity (funnel and history), Settings (the business, the extension, export).
- `src/leads-core.js`: what a lead is, its validation, database rows, the view the globe reads, the funnel, the monthly allowance. No network, no DOM.
- `src/sources/hn.js`: the first source (Hacker News through the free Algolia API). Every source has one function, `buscarSeñales(keywords) -> candidates`; another source is one more file.
- `src/leads-engine.js`: read a business, score the signals, write the draft, find where the person is. Network access goes through an injected `fetch`, so tests run it against fakes.
- `api/analyze.js`, `api/signals.js`, `api/ingest.js`: the three endpoints. Only signed-in users can call the first two (they cost model calls); `ingest` takes the extension's pairing code.
- `extension/`: a Chrome extension for LinkedIn (see `extension/README.md`). Downloadable from the app at `/downloads/owned-map-extension.zip`.
- Unchanged from before: sign-in (`api/login.js`, `login.html`), plans and billing (`src/billing-core.js`, `api/billing.js`, `api/start.js`, `api/stripe-webhook.js`, `api/welcome.js`), the globe and country views (`src/globe.js`, `src/geoui.js`, `src/regions.js`), read-only share links (`api/share.js`, `share.html`).

The first search is fast on purpose: the app calls `/api/signals` three times in parallel with two phrases each, so the first points reach the globe in about the time of one model call and the rest follow.

## Setup

1. Supabase SQL editor: run the earlier migrations as before, then `supabase/migrations/20261126000000_leads.sql` (tables `business_profiles`, `leads`, `ingest_tokens`; Row Level Security on all three; nothing old is changed).
2. Environment variables on Vercel (all already in use except where noted): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (also at build time, it goes into `assets/config.js`), `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (optional `OPENAI_MODEL`, default `gpt-4o-mini`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, `ADMIN_PASSWORD`.
3. `SUPABASE_URL=... SUPABASE_ANON_KEY=... SITE_URL=https://ownedmap.com npm run build`.

Vercel's free plan allows 12 serverless functions; `api/` (files not starting with `_`) now holds 9.

Without Supabase configured the app runs in "this device only" mode: leads and the business are kept in the browser. Searching needs an account (it calls the model).

## Commands

```
npm test                      # unit and API tests (leads, billing, checkout, SEO map, comparison pages, regions)
node scripts/e2e-leads.mjs    # the whole app in a real headless Chrome against a local stand-in for Supabase,
                              # the model, Hacker News and the geocoder (SHOTS=dir keeps screenshots; CHROME=path if needed)
npm run build                 # syntax-checks, copies to dist/, applies SITE_URL, zips the extension, verifies local references
npm start                     # static server + /api routes on http://localhost:4173
npm run mock                  # the stand-in for Supabase on http://localhost:4180/app.html
```

## Plans and billing

The charge is unchanged: $47 a month with 3 packs, plus $15 for each pack from the 4th to the 10th, $10 for the 11th to the 25th and $5 from the 26th, up to 100 packs, 30% off when paying a year at once, a 7-day trial with a card. A **pack is 25 leads with a score of 70 or more a month** (`LEADS_PER_UNIT` in `src/leads-core.js`), so the base plan includes 75. The words on the website and in the plan screens say leads; Stripe still stores the quantity as before (the checkout field is still called `assets`, and the Stripe product and price names created earlier still say "assets" until you rename them in the Stripe dashboard).

The allowance is shown (`quotaState`), **not enforced**: nobody is limited yet. When you want to enforce it, count `leads` with `score >= 70` created this month for the user (the same count the app uses) in the endpoint or a trigger, as the old asset limit did.

## Leads and the people in them

Leads are made from public posts written by other people. The privacy policy says what is stored and how a person can ask to be removed. The score and the draft come from a language model and can be wrong. A lead is never contacted by Owned Map; the person using the app decides what to say and where.

## What changed from the asset-tracking product

Removed (code only; the old database tables are untouched): assets, documents and reminders, the CSV import of assets, document reading, the VIN lookup, household access, the trusted-person emergency sheet, the reminder emails and their cron jobs, and the dashboard tabs for performance, cash flow and insights. The comparison, solution and guide pages under `content/` still build, because retiring them is a decision for the owner (see the notes in the pull request); they describe the old product.
