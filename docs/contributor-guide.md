# BasketIndex — Contributor Guide

## How to contribute docs

Documentation improvements are the easiest way to start contributing:

1. Read `docs/vision.md` to understand the project's goals.
2. Read `docs/architecture.md` to understand how the extension works.
3. Find a doc that could be clearer and open a pull request with improvements.
4. Keep the tone factual, neutral, and beginner-friendly.

## How to contribute a retailer adapter

Adding support for a new retailer is the highest-impact contribution. Here's the process:

### 1. Check if the retailer is a good fit

A retailer is a good adapter candidate if:
- Digital receipts are accessible through a normal browser login (no CAPTCHA, no app-only).
- Receipt pages have consistent HTML structure that can be parsed with DOM selectors.
- The retailer operates in at least one country.
- You have access to real receipts for testing.

### 2. Understand the adapter interface

Read `docs/adapter-interface.md`. An adapter implements a standard set of functions: URL support detection, listing page discovery, detail page extraction, and receipt normalization.

### 3. Create the adapter directory

Create `adapters/<retailer-id>/` with these files:

```
adapters/<retailer-id>/
├── adapter.js           — implements the adapter interface
├── hosts.js             — URL patterns and host permissions
├── listing-extractor.js — content script for purchase-history pages
├── detail-extractor.js  — content script for receipt detail pages
├── selectors.js         — CSS selectors for this retailer's DOM
└── normalizer.js        — maps raw receipt to normalized schema
```

### 4. Test with real receipts

Extract real receipts from your own account and verify the output. Do NOT commit real receipt data.

### 5. Provide anonymized fixtures

Create anonymized HTML fixtures and expected JSON outputs for testing. See the fixture guidelines below.

### 6. Register the adapter

Add your adapter to `core/adapter-registry.js`.

### 7. Open a pull request

Include:
- The adapter code.
- Anonymized fixtures and expected outputs.
- A brief description of which countries and receipt formats you tested.
- Any retailer-specific quirks or limitations.

## How to provide anonymized fixtures

Fixtures are snapshot HTML files from real receipt pages with all personally identifiable information removed.

### What to strip

- **Store codes** that identify specific locations → replace with `0000000`.
- **Receipt IDs** that could identify a transaction → replace with `00000000000000000000000`.
- **Timestamps** → shift to a generic date like `2024-01-01`.
- **Card last 4 digits** → replace with `0000`.
- **Fiscal codes / tax IDs** → replace with generic values.
- **Any unique identifiers** that appear in the raw text.

### What to keep

- **HTML structure** — the exact DOM tree, class names, data attributes, and element hierarchy.
- **Number of items** — keep the same count so pagination/grouping logic works.
- **Prices** — can be preserved (prices are not personally identifiable in isolation) or shifted by a constant factor.
- **Product names and descriptions** — these are public product information.

### Fixture file naming

```
fixtures/lidl-bg-listing-page-1.html       — a purchase-history page
fixtures/lidl-bg-detail-receipt-2024.html  — a receipt detail page
fixtures/lidl-bg-expected-normalized.json  — expected output
```

## How to avoid leaking personal receipt data

- **Never paste raw receipt text** into GitHub issues, comments, or pull request descriptions.
- **Never upload screenshots** of real receipts (they contain store codes, timestamps, and card info).
- **Never commit files** containing real receipt URLs with valid session tokens.
- **Use the anonymization script** (when available) to strip PII from fixtures.
- **If in doubt, ask** before sharing any data that might contain personal information.

## How to keep changes local-first and privacy-safe

- **New features must work without a server.** If a feature requires a backend, it must be opt-in and disabled by default.
- **No analytics, no telemetry, no tracking.** Ever.
- **Permissions must be justified.** Every new permission request must have a clear, documented reason.
- **No credential collection.** The extension must never ask for or store retailer usernames or passwords.
- **Review the privacy model** (`docs/privacy-model.md`) before proposing a feature that handles data differently.

## Code style

- The project currently uses vanilla JavaScript (ES modules for the service worker, IIFE for content scripts).
- Zero dependencies — not even a linter or formatter is required. Keep it that way.
- Follow the existing patterns: async/await, try/catch for error handling, chrome.* APIs for browser interaction.
- Content scripts are wrapped in IIFEs and communicate via `chrome.runtime.sendMessage`.

## Getting help

- Read the architecture docs first.
- Check open issues for similar questions.
- Open a discussion if you need guidance before writing code.
