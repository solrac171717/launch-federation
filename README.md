# ATLAS

A private, local-first world map of your investments. Add holdings (stocks, crypto, property, cash…),
tag each with a country of exposure, and ATLAS shows exposure by country on a world map, allocation by
asset class, per-asset detail pages and a holdings table.

- **Real data only.** Values and P&L are computed from what you enter (`src/calc.js`). Crypto assets with a
  CoinGecko id get live prices and 90-day history; other assets use your manual price and the prices ATLAS
  has recorded over time. Portfolio history is one recorded value per day — nothing is back-filled or invented.
- **Persistence:** browser `localStorage`. Use **Backup** / **Restore** (JSON) to move data between browsers,
  and **Export CSV** for spreadsheets. There is no server and no account, so nothing leaves your browser
  except price requests to CoinGecko and map geometry from jsDelivr.

```
npm test        # unit tests for the maths, formatting, validation and CSV export
npm run build   # syntax-checks modules, copies to dist/, verifies local references
npm start       # static server on http://localhost:4173
```
