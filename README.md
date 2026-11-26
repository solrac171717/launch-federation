# Owned Map

**Get customers from LinkedIn on autopilot.** You paste your website and connect your LinkedIn account. Owned Map finds the people who engage with your competitors or write about what you sell, scores how ready each one is to buy (0 to 100), places them on an interactive globe, writes the invitation and two follow-ups, and sends them from your own account once you approve.

> This branch (`leads-pivot`) turned the earlier asset-tracking product into this one. Same stack: Supabase, Vercel, Stripe, OpenAI. It is **not merged and not deployed**; `main` still serves the asset tracker.

## How it works

1. **Business.** `api/analyze.js` reads the website and writes the profile: what is sold, to whom, the phrases buyers use. The person edits it in Settings and adds LinkedIn pages and profiles to watch (competitors, creators).
2. **Account.** "Connect LinkedIn" (`api/linkedin.js`) opens a login page hosted by Unipile. We never see a password or a cookie; Unipile calls our signed notify address with the account id and we keep only that.
3. **Signals.** Every six hours, and on demand, for each connected account (`src/outreach-engine.js`): the people who commented on or reacted to the latest posts of the watched pages, and posts that match the business' phrases. One model call scores them; below 30 is dropped; 70 or more is "worth contacting", gets its place and LinkedIn id read from the profile, and its three messages written (`draftSequence`).
4. **Approval.** The messages wait in the Outreach tab. The person edits and approves a sequence, or turns on "send without asking" in Settings.
5. **Sending.** `api/tick.js`, every ten minutes, sends what is approved and due: invitation first; follow-up 1 a day after they accept; follow-up 2 four days after follow-up 1. Hard caps of 20 invitations and 40 messages per account per day (the person can only lower the invitations), weekdays 08:00 to 18:00 in the person's time zone, a pause between sends from one account, several accounts take turns. Acceptances and replies are polled every 15 minutes; **a reply stops the sequence**.
6. **Everything else.** The globe and country views, the leads table, the funnel, CSV export and read-only share links are unchanged from before.

Hacker News (free Algolia search) is a second source that needs no account.

## Files

- `index.html`, `landing.css`, `leads.css`, `landing.js`: the website. Its globe and lead card are the real app code on invented sample leads.
- `app.html`, `src/leads-main.js`: the app. `src/outreach-ui.js` is the Outreach tab.
- `src/leads-core.js` (what a lead is), `src/outreach-core.js` (the sending rules: caps, hours, plan, funnel), `src/leads-engine.js` (model calls), `src/outreach-engine.js` (the ten-minute job and the scan).
- `src/providers/unipile.js`: the only file that talks to LinkedIn's provider. Another provider is another file with the same functions.
- `api/analyze.js`, `api/signals.js` (Hacker News), `api/linkedin.js` (connect, disconnect, scan), `api/tick.js` (the scheduler's heartbeat). Unchanged from before: `login`, `billing`, `start`, `stripe-webhook`, `welcome`, `share`. Vercel's free plan allows 12 functions; `api/` has 10.
- `supabase/migrations/20261126000000_leads.sql` then `20261127000000_outreach.sql`.

## Setup

1. Supabase SQL editor: run the earlier migrations, then the two files above, in order.
2. Unipile: create an account, note the DSN (for example `api3.unipile.com:13359`) and make an API key.
3. Vercel environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (also at build time), `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (optional `OPENAI_MODEL`), `UNIPILE_DSN`, `UNIPILE_API_KEY`, `CRON_SECRET` (a long random value), `SITE_URL`, plus the Stripe ones that were already there.
4. The scheduler: Vercel's free plan has no frequent cron, so Supabase calls the site. Enable the `pg_cron` and `pg_net` extensions and run the `cron.schedule` snippet at the end of the outreach migration, with the same `CRON_SECRET`.
5. `SUPABASE_URL=... SUPABASE_ANON_KEY=... SITE_URL=https://ownedmap.com npm run build`.

## First run (read this before real customers)

`src/providers/unipile.js` was written from Unipile's public documentation **without a live key**. Check each call once against a real LinkedIn account of your own, with the caps at 3 to 5 a day:

1. Connect: the hosted login opens, and `/api/linkedin?notify=1` creates the row in `linkedin_accounts` (the notify body is read as `{ status: 'CREATION_SUCCESS', account_id }`).
2. Scan: `POST /linkedin/search` (posts), `GET /users/{id}/posts`, `/posts/{id}/comments`, `/posts/{id}/reactions`. If a field name differs, only `asCandidate` and `member` need to change.
3. Profile: `GET /users/{public_identifier}` returns `provider_id`, `location` and `network_distance`.
4. Send: `POST /users/invite` and `POST /chats` (multipart). Note that free accounts only get a few invitation notes a month.
5. Poll: `GET /users/relations` (acceptances) and `GET /messages` (replies).

LinkedIn restricts accounts that send too much, and its terms restrict automated tools. The caps are low on purpose. **Keep them lower still for the first two weeks.** The terms and privacy pages were rewritten for this, and a lawyer should review them before anyone pays.

## Commands

```
npm test                      # unit and API tests (rules, provider client, the ten-minute job, endpoints, leads, billing, SEO map)
node scripts/e2e-leads.mjs    # the whole app in a real headless Chrome against local stand-ins for Supabase, the model, Hacker News,
                              # the geocoder and Unipile: connect LinkedIn, scan, approve, send, accept, follow up, reply
npm run build                 # syntax-checks, copies to dist/, applies SITE_URL, verifies local references
npm start                     # static server + /api routes on http://localhost:4173
npm run mock                  # the stand-in on http://localhost:4180/app.html
```

## Plans and billing

Unchanged: $47 a month with 3 packs, plus $15 for each pack from the 4th to the 10th, $10 for the 11th to the 25th and $5 from the 26th, up to 100 packs, 30% off yearly, a 7-day trial with a card. A pack is 25 leads with a score of 70 or more a month (`LEADS_PER_UNIT`). The allowance is shown, **not enforced**. The Stripe product names still say "assets" until renamed in the dashboard.

## What changed from the asset-tracking product

Removed (code only; old tables untouched): assets, documents and reminders, the CSV import, document reading, the VIN lookup, household access, the emergency sheet, the reminder emails and their cron jobs. The comparison, solution and guide pages under `content/` still build and describe the old product; retiring them is the owner's decision.
