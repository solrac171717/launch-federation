# Owned Map for LinkedIn (Chrome extension)

It reads the LinkedIn posts and profiles you are **already looking at** and sends them to your own Owned Map account, where they are scored and (for profiles) placed on the globe.

What it does **not** do: it never logs in for you, never sends anything to our servers except the posts and the profile places it read, and it never contacts a lead you did not queue yourself in the app. It acts only in your own browser, with your own LinkedIn session. We never see your LinkedIn password or session.

**Sending (v0.2).** In the app, on a lead with a LinkedIn profile, press **Queue on LinkedIn** (or queue the new leads in the Leads tab). The extension then opens one profile at a time, with a pause of one to two and a half minutes between them, up to the daily limit you set in its popup (default 15, never more than 25). It presses Connect and writes the 200-character note, or, if you are already connected, writes the message. By default it stops there and you press **Send**; tick "Press Send for me" to let it do that too. It never sends a bare invitation, and it skips a profile when it does not find the buttons. **This breaks LinkedIn's terms on automated tools and LinkedIn can limit an account that sends too much; use it at your own risk and start with a few a day.**

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
| `manifest.json` | Manifest V3. `storage` and `alarms` permissions, and only ownedmap.com and linkedin.com hosts. |
| `lib.js` | Reads posts and the profile location from the page (pure functions). |
| `content-posts.js` | On the feed and content search: batches posts (at most 20 every 30 seconds). |
| `content-app.js` | On the Owned Map app page: takes the leads you queue and tells the page the extension is installed. |
| `content-outreach.js` | On a profile in your queue: opens the invitation or the message and writes the text. |
| `content-profile.js` | On a profile you opened: sends its place. |
| `background.js` | Sends to `/api/ingest` with your pairing code. The code never reaches the LinkedIn page. |
| `popup.html`, `popup.js` | Paste the code, see how many leads were found, disconnect. |
