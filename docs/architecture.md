# BasketIndex — Architecture

## Current architecture (Phase 0 prototype)

The current extension is a working Lidl-specific Chrome MV3 extension with zero dependencies.

### Component diagram

```
                        ┌──────────────────┐
                        │    Popup UI       │
                        │ (popup.html/css/js)│
                        └────────┬─────────┘
                                 │ chrome.runtime.sendMessage
                        ┌────────▼─────────┐
                        │  Service Worker   │
                        │ (service-worker.js)│
                        │  ┌─────────────┐  │
                        │  │ job-manager  │  │
                        │  │ queue        │  │
                        │  │ tab-manager  │  │
                        │  │ storage      │  │
                        │  │ download     │  │
                        │  └─────────────┘  │
                        └──┬────┬─────┬─────┘
                           │    │     │  chrome.tabs.sendMessage
              ┌────────────┘    │     └──────────┐
              ▼                 ▼                ▼
        ┌──────────┐    ┌──────────┐      ┌──────────┐
        │ Listing  │    │ Worker 1 │ ...  │ Worker N │
        │ Tab      │    │ (detail) │      │ (detail) │
        └────┬─────┘    └────┬─────┘      └────┬─────┘
             │                │                  │
             ▼                ▼                  ▼
        listing CS       detail CS           detail CS
        (listing-        (detail-            (detail-
        extractor.js)    extractor.js)       extractor.js)
             │                │                  │
             └────────────────┼──────────────────┘
                              ▼
                     ┌────────────────┐
                     │chrome.storage  │
                     │   .local       │
                     └────────────────┘
                              │
                              ▼
                     ┌────────────────┐
                     │ JSON download  │
                     │ (downloads API)│
                     └────────────────┘
```

### Flow

1. **User opens popup**, configures page range and worker count, clicks Start.
2. **Popup sends START** command to service worker with config + Lidl purchase-history URL.
3. **Service worker creates job** in `chrome.storage.local`, opens N worker tabs at `about:blank`, opens 1 listing tab at the purchase-history page.
4. **Listing tab** loads → content script extracts all receipt URLs from the current page → returns deduplicated list to SW.
5. **SW enqueues** receipt URLs, advances listing tab to next page, repeats until page range exhausted.
6. **Worker tabs** navigate to receipt detail URLs one at a time → content script extracts full receipt JSON → returns to SW.
7. **SW saves** each completed receipt to job state, marks receipt done.
8. **Failed receipts** are retried up to `maxRetries` per receipt, with automatic recovery rounds after main queue empties.
9. **User clicks Export JSON** → SW builds export bundle from `job.completed` → triggers `chrome.downloads.download`.
10. **Job state survives** browser restart and SW suspension via `chrome.storage.local`.

### Current limitation

The current codebase has **Lidl assumptions baked into core files**:

- `content/detail-extractor.js` — Lidl-specific selectors, DOM patterns, Bulgarian receipt format.
- `content/listing-extractor.js` — Lidl-specific URL patterns and page selectors.
- `lib/selectors.js` — All selectors are Lidl-specific.
- `lib/job-manager.js` — Warehouse of Lidl assumptions in listing discovery and detail processing.
- `lib/storage.js` — Job model includes Lidl-oriented fields.
- `manifest.json` — Host permissions hardcoded to Lidl domains.
- `service-worker.js` — No adapter abstraction, directly drives Lidl flow.

To add a second retailer, a developer would need to rewrite significant portions of the extension. This is the structural limitation Phase 4 addresses.

---

## Target architecture (Phase 4+)

### Component diagram

```
                        ┌──────────────────┐
                        │    Popup UI       │
                        │ (retailer picker  │
                        │  + config + status)│
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Service Worker   │
                        │                   │
                        │ ┌───────────────┐ │
                        │ │  Core Engine   │ │
                        │ │ ─────────────  │ │
                        │ │ job-manager    │ │
                        │ │ queue          │ │
                        │ │ tab-manager    │ │
                        │ │ storage        │ │
                        │ │ messaging      │ │
                        │ │ download       │ │
                        │ │ receipt-norm.  │ │
                        │ └───────┬───────┘ │
                        │         │         │
                        │ ┌───────▼───────┐ │
                        │ │Adapter Registry│ │
                        │ │ ─────────────  │ │
                        │ │ lidl/adapter   │ │
                        │ │ kaufland/adap. │ │
                        │ │ billa/adapter  │ │
                        │ │ ...            │ │
                        │ └───────────────┘ │
                        └───────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Content Scripts  │
                        │ (per-adapter      │
                        │  injected on       │
                        │  retailer pages)   │
                        └───────────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │chrome.storage  │
                        │   .local       │
                        └────────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │ Export formats │
                        │ JSON, CSV, ... │
                        └────────────────┘
```

### Key architectural change

The adapter registry becomes the single point of retailer-aware logic. The core engine knows nothing about Lidl, Kaufland, or any specific retailer. It knows about jobs, queues, tabs, storage, and export formats.

When a user selects a retailer and starts an export:

1. Core engine loads the adapter from the registry.
2. Adapter provides: URL discovery, DOM extraction functions, normalizer.
3. Core engine drives the job lifecycle using the adapter's functions.
4. Adapter returns raw receipts in a retailer-specific format.
5. Core engine's `receipt-normalizer.js` maps raw receipts to the generic schema.
6. Exporters write the normalized receipts to JSON/CSV.

### Adapter contract

See [docs/adapter-interface.md](adapter-interface.md) for the full adapter specification.

### Normalized receipt schema

See [docs/receipt-schema.md](receipt-schema.md) for the retailer-neutral data model.

---

## Storage strategy

`chrome.storage.local` remains the persistence layer. Job state, receipts, and adapter configuration all live in browser-local storage. No server component is introduced.

The refactor may split storage into namespaced keys:
- `jobState` — active job metadata and progress.
- `receipts` — completed normalized receipts.
- `config` — user preferences (selected retailer, export settings).

---

## Security boundaries

- All receipt processing happens in the browser.
- No network requests are made by the extension beyond the user's own browser tabs navigating to retailer pages.
- No credentials are ever collected or stored.
- Export files are triggered via the Chrome downloads API; the user chooses where to save them.
- No analytics, no telemetry, no error reporting to external services.
