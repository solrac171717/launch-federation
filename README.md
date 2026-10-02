# Launch Federation

A weekly SaaS launch directory (ScrollLaunch-style). Founders submit their product, get a
permanent page and a dofollow backlink on the free plan (badge required, re-verified weekly),
or skip the queue with a $7 premium 7-day listing. Sidebar ad slots sell for $15/mo. Ten free
slots open every Monday; once they're full, only premium listings can launch that week.

## What's in this repo right now

A static front-end only, styled after the reference screenshot (white background, black text,
ScrollLaunch-style cards): `index.html` (directory feed), `submit.html` (submission form),
`pricing.html`, `advertise.html`, `badge.html`. All data in `script.js` is mock/in-memory —
nothing is persisted, no accounts exist yet.

## What's not built yet (needs your accounts/credentials — I can't create these for you)

- **Auth + database** (users, listings, upvotes, comments). Suggest Supabase or a similar
  Postgres-backed BaaS.
- **Payments** for the $7 premium listing and $15/mo ad slots. Needs a Stripe account and keys.
- **URL auto-fill**: a real scraper/API that reads a submitted site's title, meta description,
  OG image, and suggests tags — the current "Auto-fill" button on `submit.html` is a mocked demo.
- **Weekly slot scheduling**: enforcing the 10-free-slots-per-Monday limit server-side.
- **Badge verification cron**: a weekly job that fetches each free listing's site, confirms the
  badge/link is present, and flips the backlink to `nofollow` if not.
- **Hosting for the backend**: this repo can stay on GitHub Pages for the static site, but
  anything above needs a server (Vercel/Render/Fly.io, etc.).

## Domain

`CNAME` file is set to `launchfederation.com` for GitHub Pages. At your DNS provider, point:
- `launchfederation.com` (apex) → GitHub Pages A records: `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`
- `www.launchfederation.com` → CNAME to `solrac171717.github.io`

Then enable GitHub Pages for this repo (Settings → Pages → source: `main` branch, `/ (root)`)
and set the custom domain to `launchfederation.com` there.
