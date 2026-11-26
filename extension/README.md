# Owned Map for LinkedIn (Chrome extension)

It reads the LinkedIn posts and profiles you are **already looking at** and sends them to your own Owned Map account, where they are scored and (for profiles) placed on the globe.

What it does **not** do: it never sends a message or an invitation, never clicks, scrolls, searches or opens a profile for you, and it does not read anything on pages you did not open. Automating LinkedIn is against LinkedIn's terms; this reads only your own screen. You stay responsible for how you use your account.

## Install (Chrome)

1. Download `owned-map-extension.zip` from your site (`/downloads/owned-map-extension.zip`) and unzip it, or use this folder.
2. Chrome → Extensions → turn on **Developer mode** → **Load unpacked** → choose the folder.
3. In the app: **Settings → LinkedIn → Connect the extension**, copy the code, open the extension's icon and paste it.
4. Use LinkedIn as usual: open the feed or a content search. Leads appear in the app within a minute. Open a lead's profile and, when the place is found, the lead appears on the globe.

## What is verified and what is not

- The code that sends data and the server that scores it are tested (`test/leads.test.js`, `scripts/e2e-leads.mjs`).
- **The page selectors in `lib.js` were written against LinkedIn's markup as it was documented, and were not tested on a live LinkedIn page** (that needs a signed-in account). LinkedIn changes its markup often. If posts or locations stop coming through, adjust the lists at the top of `lib.js`; nothing else needs to change. `scripts/e2e-leads.mjs` checks the extractor against a sample page that mimics that markup.
- It is not published on the Chrome Web Store; that needs a review and a one-time developer fee.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3. Only `storage` permission, and only ownedmap.com and linkedin.com hosts. |
| `lib.js` | Reads posts and the profile location from the page (pure functions). |
| `content-posts.js` | On the feed and content search: batches posts (at most 20 every 30 seconds). |
| `content-profile.js` | On a profile you opened: sends its place. |
| `background.js` | Sends to `/api/ingest` with your pairing code. The code never reaches the LinkedIn page. |
| `popup.html`, `popup.js` | Paste the code, see how many leads were found, disconnect. |
