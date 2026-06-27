# BasketIndex

> **Your shopping receipts, your data, your analysis.**

BasketIndex is an open-source Chrome extension that exports your digital shopping receipts as structured JSON and CSV — straight from your existing retailer login. No separate accounts. No uploads. No analytics. Your purchase history stays in your browser.

**Right now**: Working prototype with Lidl Bulgaria.  
**The goal**: A community-built receipt hub with adapters for any retailer that shows receipts in a browser.

---

## Who should use this now

BasketIndex is ready for **technical early adopters** who:

- Have a Lidl Plus account and want their receipt data locally
- Are comfortable loading an unpacked Chrome extension
- Want structured, analyzable purchase data (JSON/CSV)
- Care about privacy and local-first tools

**Not ready for**: non-technical users, mass-market distribution, or multi-retailer exports yet.

---

## What you get

| Feature | Status |
|---------|--------|
| Structured JSON export (BasketIndex 1.0 schema) | Working |
| CSV export (flat, one row per item) | Working |
| EUR/BGN dual-currency handling | Working |
| Pause/resume across browser restarts | Working |
| Automatic retry and recovery rounds | Working |
| Configurable concurrency (1-4 workers) | Working |
| Lidl Plus discount capture | Working |
| Normalized receipt schema (retailer-neutral) | Working |
| Adapter architecture (add retailers via plugins) | Working |
| Offline fixture validation | Working |
| Mobile app / cloud sync / OCR | Not planned for MVP |
| Multi-retailer support | Roadmap, not yet |

---

## What you can do with your export

Once you've exported your receipt data (JSON or CSV), you can use it for:

- **Personal budgeting** — Track monthly grocery spending, category breakdowns, and trends over time.
- **Price tracking** — Monitor prices of repeat purchases across weeks, months, or years. Spot before-and-after changes around the 2026 euro adoption in Bulgaria.
- **Personal inflation analysis** — Use your exported data with an AI tool of your choice (ChatGPT, Claude, etc.) to analyze your own shopping inflation. We provide a copy-paste prompt to get started: [`docs/prompts/personal-inflation-analysis.md`](docs/prompts/personal-inflation-analysis.md).

BasketIndex itself does **not** include built-in AI or automatic analysis. It gives you structured, machine-readable exports that you control. The prompt is a starting template — you use it with the tool you choose.

**This is not financial advice.** All analysis is for your own exploratory use. AI tools can make mistakes — verify conclusions against your receipt data.

---

## Supported retailers

| Retailer | Status | Countries tested | Notes |
|----------|--------|-----------------|-------|
| **Lidl** | Working adapter | BG | EUR/BGN, discount capture, paired-row items |
| Others | Planned | — | Community adapter contributions welcome |

---

## Known limitations

- **Lidl-only for now.** The adapter architecture supports multiple retailers, but only Lidl has a working adapter today.
- **Tested on Lidl Bulgaria.** Other Lidl countries may have different DOM structures — the [selector module](adapters/lidl/selectors.js) is the place to adjust.
- **No cloud backup.** All data is stored in your browser's local storage. Uninstalling the extension deletes your data.
- **Storage quota.** `chrome.storage.local` has limits. Very large exports (hundreds of receipts) may hit the quota. We added `unlimitedStorage` to mitigate this.
- **Desktop Chrome only.** No Firefox, Edge, or mobile support yet.
- **Chrome Web Store listing submitted and pending review.** Until approved, install via "Load unpacked" in Developer Mode.
- **Security contact is a placeholder.** See [SECURITY.md](SECURITY.md) — replace before production use.

---

## Privacy

- **No server.** All processing happens in your browser.
- **No credentials.** You log in to Lidl normally. The extension never sees your password.
- **No analytics.** No telemetry, no tracking, no external requests of any kind.
- **No cloud.** Receipt data is stored in `chrome.storage.local` on your machine.
- **You control export.** Data leaves your browser only when you click "Export" and pick a save location.

Full privacy model: [`docs/privacy-model.md`](docs/privacy-model.md)

---

## Installation

### Load the unpacked extension

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked**
5. Select the repository folder
6. The BasketIndex icon appears in your toolbar

No build step. No dependencies. No npm install needed for the extension itself.

### Verify it works

1. Open your Lidl purchase history page (e.g. `https://www.lidl.bg/mre/purchase-history`) and sign in normally
2. Click the BasketIndex icon in your toolbar
3. The extension auto-detects your Lidl tab — or paste the listing URL manually
4. Set a small page range (1–2) for a quick test
5. Click **Start** — watch receipts appear in the status panel
6. Click **Export JSON** or **Export CSV**

### Troubleshooting first export

| Problem | Likely fix |
|---------|------------|
| "No supported retailer" error | Open your Lidl purchase-history page in a tab first, then click Start |
| Receipts show 0 extracted | You may not be logged in — sign in to Lidl in your browser |
| "Receipt container not found" | Lidl's DOM may differ from the tested BG structure. Check [selectors](adapters/lidl/selectors.js) |
| Export button stays disabled | Wait for the job to complete. Progress is shown in the status panel |
| Extension doesn't appear | Confirm Developer Mode is ON in `chrome://extensions` |
| Empty or partial export | Try reducing workers to 1 and retrying the page range |

---

## Features

- **Local-first**: All receipt data stays in your browser
- **Resumable**: State survives browser restarts and service worker suspension
- **Automatic retries**: Failed receipts retried with configurable attempts per receipt
- **Recovery rounds**: Full passes through failures after the main queue empties
- **Configurable concurrency**: 1–4 worker tabs. Default 2 balances speed and reliability
- **Dual-currency**: EUR/BGN handling for Bulgarian Lidl receipts (2026 euro adoption)
- **Normalized output**: BasketIndex 1.0 schema — same shape regardless of retailer
- **JSON + CSV export**: Structured and spreadsheet-ready formats
- **Adapter architecture**: Add retailers by creating adapter directories, not rewriting the core
- **Zero runtime dependencies**: No npm packages, no CDN scripts, no build step

---

## Architecture

```
Popup → Service Worker → Adapter Registry → Lidl Adapter
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              Listing Tab  Worker 1...N  Content Scripts
                    │           │           │
                    └───────────┼───────────┘
                                ▼
                       chrome.storage.local
                                │
                                ▼
                    JSON / CSV export (downloads API)
```

Full architecture: [`docs/architecture.md`](docs/architecture.md)

---

## Where we are on the roadmap

BasketIndex is roughly at **Phase 7–8 of 10**:

- ✓ Phase 0–4: Lidl extraction, adapter architecture, normalized schema
- ✓ Phase 5–6: CSV export, E2E/BGN, discounts, fixtures, validation
- ✓ Phase 7: Documentation, LICENSE, CONTRIBUTING, SECURITY
- → **Now**: Launch prep — README polish, early-adopter onboarding, repo credibility
- → Next: Chrome Web Store listing, demo, public promotion

Full roadmap: [`docs/roadmap.md`](docs/roadmap.md)

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/vision.md`](docs/vision.md) | Why this project exists |
| [`docs/roadmap.md`](docs/roadmap.md) | Phased development plan |
| [`docs/architecture.md`](docs/architecture.md) | Component diagrams and data flow |
| [`docs/adapter-interface.md`](docs/adapter-interface.md) | How to add a new retailer adapter |
| [`docs/receipt-schema.md`](docs/receipt-schema.md) | Normalized receipt data model v1.0 |
| [`docs/refactor-plan.md`](docs/refactor-plan.md) | How we moved from Lidl-only to adapter-driven |
| [`docs/privacy-model.md`](docs/privacy-model.md) | Full privacy guarantees |
| [`docs/security-notes.md`](docs/security-notes.md) | Security practices |
| [`docs/contributor-guide.md`](docs/contributor-guide.md) | How to contribute |
| [`docs/launch-checklist.md`](docs/launch-checklist.md) | Launch readiness per phase |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |
| [`fixtures/README.md`](fixtures/README.md) | Test fixture documentation |

---

## Permissions

| Permission | Why we need it |
|-----------|---------------|
| `storage` + `unlimitedStorage` | Save job progress and receipts locally |
| `downloads` | Trigger JSON/CSV file downloads when you click Export |
| `tabs` | Open and manage browser tabs for receipt pages |
| `scripting` | Inject content scripts into retailer receipt pages |
| Host permissions (Lidl domains) | Access receipt pages on Lidl websites |

No `cookies`. No `webRequest`. No `identity`. No remote code. No analytics.

---

## Reporting issues and contributing

- **Bug reports**: Open a GitHub issue. Include which Lidl country/domain you tested.
- **Feature requests**: Open a GitHub Discussion or issue.
- **Security vulnerabilities**: See [SECURITY.md](SECURITY.md) — do not open a public issue.
- **Contributing code**: See [CONTRIBUTING.md](CONTRIBUTING.md) and [`docs/contributor-guide.md`](docs/contributor-guide.md).
- **Adding a retailer adapter**: See [`docs/adapter-interface.md`](docs/adapter-interface.md).

---

## Disclaimer

BasketIndex is an independent open-source project. **It is not affiliated with, endorsed by, or connected to Lidl or any retailer.** Retailer names are used for compatibility description only. All trademarks belong to their respective owners.

---

## License

MIT. See [LICENSE](LICENSE) for full terms.
