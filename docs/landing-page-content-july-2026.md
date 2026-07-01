# BasketIndex — Landing Page Content (July 2026)

This file contains the updated content for `https://basketindex.stefanatanasov.dev`.

## Hero

**Tagline**: Export your purchase history. Understand your spending. Your data, your control.

**Subtitle**: BasketIndex is a local-first Chrome extension that extracts your digital shopping receipts from Lidl and Metro. No servers. No accounts. Just your data, in your browser, under your control.

**Badge**: Stable Beta

**CTA row**:
- [Download ZIP](https://github.com/stefanatanassov/basketindex/releases/download/v0.1.0/basketindex-extension.zip)
- [View on GitHub](https://github.com/stefanatanassov/basketindex)
- Chrome Web Store — Pending review

---

## What is BasketIndex?

BasketIndex is a Chrome extension that extracts your online shopping receipts from Lidl and Metro, stores them locally, and helps you understand your spending patterns over time.

It does three things well:

1. **Extract** — Capture your purchase history from Lidl and Metro using your existing browser session. No separate login, no password sharing.

2. **Understand** — See price trends over time for the products you actually buy. Switch between nominal prices, index values, and percentage changes. Inspect the data behind every chart point.

3. **Export** — Download your receipts as structured JSON or CSV. Use the social card export to share your trends. Take your data anywhere — spreadsheets, Python, or AI analysis tools.

All processing happens in your browser. Nothing leaves your machine unless you explicitly export it.

---

## How it works

1. **Open the popup** — Select Lidl or Metro, configure your extraction, and start.

2. **Extract receipts** — The extension reads your purchase history using your existing login. No passwords, no accounts. For Lidl, it scans receipt pages. For Metro, it uses their API.

3. **Explore your data** — Open History to see all your extraction runs. Start follow-up runs to add newer receipts without duplicating. Export as JSON or CSV anytime.

4. **Watch your trends** — The Trends page shows price changes over time for your most-bought products. See what's rising, what's falling, and by how much. Every data point is traceable to a real receipt.

5. **Share or analyze** — Export an analysis chart or a social share card. Download your data and use it with spreadsheets, Python, or AI tools. BasketIndex gives you the data — you choose what to do with it.

---

## Features

### Receipt extraction
- **Lidl** — DOM-based extraction from purchase history and detail pages
- **Metro** — Token-based API extraction from invoices and articles

### History & run management
- Immutable run archive — every extraction is preserved
- Follow-up runs — refresh with newer receipts, duplicates automatically filtered
- Coverage tracking — see exactly which dates each run covers
- Export CSV, JSON per run

### Price trends
- Per-product price tracking across time
- Three modes: Nominal (EUR), Index, Percentage
- Multi-series comparison — select multiple products and compare trends
- Interactive tooltips with period details, observation counts, and spend totals
- Evidence table — every chart point traceable to real receipts
- Extract selection — filter by specific extractions
- Date range filtering with baseline reset

### Exports
- Analysis chart PNG — clean, readable price trend graphic
- Social share card — portrait-format shareable card with trends, QR, and branding
- CSV and JSON bulk export per run

### Privacy & trust
- No server, no cloud storage — everything in Chrome local storage
- No analytics, no telemetry, no tracking
- No account required — uses your existing retailer session
- Open source (MIT) — every line auditable
- Receipts stored with retailer source URLs for verification

---

## Supported retailers

| Retailer | Status | Extraction method |
|----------|--------|-------------------|
| Lidl | Active | DOM scraping of purchase history + receipt detail pages |
| Metro | Active | Token-based API — invoice listing + article detail |
| Kaufland | Planned | Future adapter |

The architecture supports adding new retailers as self-contained adapter modules.

---

## Current release status

BasketIndex is in **Stable Beta** as of July 2026.

What "stable beta" means:
- Core extraction works reliably for Lidl and Metro
- All major features are implemented: extraction, history, trends, exports
- The code is tested, documented, and open source
- Chrome Web Store listing is pending review
- Manual installation works today (download ZIP, load unpacked)

---

## Open source

BasketIndex is fully open source under the MIT license. Every line of code is on GitHub.

- Zero runtime dependencies — no npm packages at runtime
- No build step — clone and load as unpacked extension
- Adapter architecture — add new retailers without touching the core engine

[GitHub Repository](https://github.com/stefanatanassov/basketindex)

---

## FAQ

### Which retailers are supported?
Lidl and Metro. Kaufland is planned. The adapter architecture makes adding new retailers straightforward — each is a self-contained module.

### Where is my data stored?
Entirely in your browser's `chrome.storage.local`. BasketIndex uses the Chrome Storage API. Nothing is sent to any server. Uninstalling the extension deletes the data.

### Can I export my data?
Yes. JSON and CSV export are built in. Export per-extraction-run, or use Trends to export analysis graphics and social share cards.

### Is this affiliated with Lidl, Metro, or any retailer?
No. BasketIndex is an independent open-source project. It is not affiliated with, endorsed by, or connected to any retailer. Retailer names are used for compatibility description only.

### Does BasketIndex include AI or calculate inflation?
No. BasketIndex exports your receipt data in a structured format. You can analyze that data with any tool — ChatGPT, Claude, a spreadsheet, or your own code. The Trends page shows price changes based on your actual paid prices, but BasketIndex does not claim to calculate official inflation, provide economic analysis, or give financial advice.

### How do I install it?
Download the [basketindex-extension.zip](https://github.com/stefanatanassov/basketindex/releases/download/v0.1.0/basketindex-extension.zip) from GitHub releases. Unzip it, open `chrome://extensions`, enable Developer Mode, click **Load unpacked**, and select the unzipped folder. The extension is ~41 KB and loads instantly.

### Can I contribute?
Yes. See [CONTRIBUTING.md](https://github.com/stefanatanassov/basketindex/blob/main/CONTRIBUTING.md) and the [adapter interface documentation](https://github.com/stefanatanassov/basketindex/blob/main/docs/adapter-interface.md).

---

**Disclaimer**: BasketIndex is an independent open-source project and is not affiliated with, sponsored by, or endorsed by Lidl, Metro, Google, or any other retailer or browser vendor. All retailer names and logos are trademarks of their respective owners.
