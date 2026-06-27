# BasketIndex — Refactor Plan

This document describes the concrete steps to migrate from the current Lidl-specific prototype to the Phase 4 target architecture. It is a plan, not a prescription — details may evolve.

## Principles

1. **Preserve behavior first**: The current extension must continue working throughout the refactor.
2. **Extract, don't rewrite**: Move Lidl logic into an adapter; do not rewrite working extraction code.
3. **Core must stay retailer-agnostic**: After refactor, no file in `core/` should reference Lidl, Kaufland, or any specific retailer.
4. **One adapter at a time**: Complete the Lidl adapter and stabilize it before attempting any other retailer.

## Step-by-step plan

### Step 1 — Create file structure

Create the target directories without moving any files:

```
extension/
├── core/           (empty)
├── adapters/
│   └── lidl/       (empty)
```

Leave all current files in place. The extension must still load and work.

### Step 2 — Define the adapter interface

Create `core/adapter-registry.js` with the registry and the adapter contract (see `docs/adapter-interface.md`). This file imports nothing and exports only the registry functions. It can be checked into the tree without affecting runtime behavior.

Create `adapters/lidl/adapter.js` as a stub that satisfies the interface but delegates to the existing code via temporary re-exports. This stub imports from the current `content/` and `lib/` files so no behavior changes.

### Step 3 — Create the Lidl adapter

Move Lidl-specific code from `content/` and `lib/` into `adapters/lidl/`:

| Current file | Target file | Notes |
|-------------|-------------|-------|
| `content/detail-extractor.js` | `adapters/lidl/detail-extractor.js` | Lidl DOM extraction |
| `content/listing-extractor.js` | `adapters/lidl/listing-extractor.js` | Lidl URL discovery |
| `content/shared.js` | split: core helpers → `core/`, Lidl helpers → `adapters/lidl/` | `waitForElement`, `waitForStability` are generic |
| `lib/selectors.js` | `adapters/lidl/selectors.js` | All Lidl-specific selectors |

Create `adapters/lidl/normalizer.js` that converts Lidl raw receipts to the BasketIndex normalized schema. This is new code — no existing code to move.

Create `adapters/lidl/hosts.js` that exports the Lidl-specific host patterns and URL construction logic.

### Step 4 — Make the core retailer-agnostic

Extract generic logic into `core/`:

| Current file | Target file | Notes |
|-------------|-------------|-------|
| `lib/storage.js` | `core/storage.js` | Remove Lidl-specific job fields; add adapter-aware fields |
| `lib/queue.js` | `core/queue.js` | Already retailer-agnostic; minor cleanup |
| `lib/job-manager.js` | `core/job-manager.js` | Replace hardcoded Lidl flow with adapter-driven flow |
| `lib/tab-manager.js` | `core/tab-manager.js` | Already retailer-agnostic |
| `lib/download.js` | `core/download.js` | Add CSV exporter; make export format adapter-aware |
| `lib/messaging.js` | `core/messaging.js` | Add adapter-related message types |

Create `core/receipt-normalizer.js` — calls an adapter's `normalizeReceipt` and validates the output against the normalized schema.

### Step 5 — Update manifest

Update `manifest.json` to reference the new file structure. Content script declarations should reference adapter-specific scripts. Host permissions may need to be broadened from hardcoded Lidl domains to a more extensible pattern.

### Step 6 — Update service worker

Refactor `service-worker.js` to use the adapter registry. Instead of hardcoded Lidl tab creation and extraction, it should:

1. Load the selected adapter from the registry.
2. Use `adapter.getPurchaseHistoryUrl` for listing navigation.
3. Use `adapter.discoverReceiptUrls` for receipt discovery.
4. Use `adapter.extractReceipt` for detail extraction.
5. Use `adapter.normalizeReceipt` + `receipt-normalizer.js` for output.

### Step 7 — Update popup

Add a retailer selector to the popup UI. The popup should list available adapters and let the user choose. The current Lidl-only path should be the default until more adapters exist.

### Step 8 — Validate

- Lidl export produces the same JSON as before the refactor.
- The normalized schema output matches the expected schema.
- No regression in pause/resume, retry/recovery, export.

### Step 9 — Remove deprecated code

Once the adapter-driven path is stable, remove the old Lidl-specific files from their original locations. Update imports across the tree.

### Step 10 — Add fixtures and tests

Create anonymized HTML fixtures, expected outputs, and a validation script. Run validation to confirm parsing correctness.

## What stays the same

- MV3 service worker architecture.
- `chrome.storage.local` for persistence.
- Zero server dependency.
- Zero external dependencies.
- Popup-based UI.
- Content script injection model.
- Tab management strategy.
- Queue/retry/recovery logic (generalized, not rewritten).
