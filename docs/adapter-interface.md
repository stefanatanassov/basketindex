# BasketIndex — Adapter Interface

This document defines the proposed contract for retailer adapters. An adapter is a module that the core engine loads to handle a specific retailer's receipt pages.

## Adapter object shape

```js
export const retailerAdapter = {
  // Unique identifier, e.g. 'lidl', 'kaufland-bg', 'billa-at'
  id: 'lidl',

  // Human-readable name
  name: 'Lidl',

  // ISO 3166-1 alpha-2 country codes this adapter supports
  supportedCountries: ['BG', 'DE', 'RO', 'GR'],

  // Optional: semantic version of this adapter
  version: '1.0.0',

  // --- HOST DETECTION ---

  /**
   * Given a URL, return true if this adapter can handle pages from this domain.
   * Called by the core to auto-detect which adapter to use based on the
   * purchase-history URL the user provides.
   */
  supportsUrl(url) { return boolean; },

  /**
   * Return the host patterns that should trigger content script injection
   * for this retailer. Used to build the manifest's content_scripts matches
   * and for dynamic injection via scripting.executeScript.
   */
  hostPatterns() { return string[]; },

  // --- DISCOVERY ---

  /**
   * Given a purchase-history base URL and a page number, return the full
   * URL for that listing page. Handles retailer-specific pagination patterns.
   */
  getPurchaseHistoryUrl(baseUrl, pageNumber) { return string; },

  /**
   * Called on a purchase-history page. Extract receipt URLs and IDs from
   * the current document. Returns an array of { receipt_id, url } objects.
   * Called via content script message from the listing tab.
   */
  discoverReceiptUrls(document) { return [{ receipt_id, url }]; },

  // --- EXTRACTION ---

  /**
   * Called on a receipt detail page. Extract the full receipt data from
   * the current document in the adapter's native format. The core engine
   * will then normalize it via normalizeReceipt().
   * Called via content script message from a worker tab.
   */
  extractReceipt(document, expectedReceiptId) { return rawReceipt; },

  // --- NORMALIZATION ---

  /**
   * Convert an adapter-native raw receipt into the BasketIndex normalized
   * receipt schema. See docs/receipt-schema.md for the target format.
   */
  normalizeReceipt(rawReceipt) { return NormalizedReceipt; },

  // --- AUTH ---

  /**
   * Optional: check whether the current page appears to be authenticated
   * for this retailer. Returns { authenticated: boolean, reason?: string }.
   * Used to show guidance if the user is logged out.
   */
  checkAuth(document) { return { authenticated, reason }; },

  // --- OPTIONAL HOOKS ---

  /**
   * Optional: return a list of CSS selectors or DOM queries needed for
   * extraction. Useful for documentation and debugging.
   */
  getSelectors() { return { listing: {...}, detail: {...} }; },

  /**
   * Optional: called before extraction begins. Can be used for adapter-
   * specific setup (e.g., dismissing cookie banners, waiting for specific
   * elements, handling redirects).
   */
  async beforeExtract(document) {},

  /**
   * Optional: return any special permissions this adapter needs beyond
   * the core set (e.g., additional host permissions for a retailer's
   * authentication domain).
   */
  extraPermissions() { return []; }
};
```

## Method semantics

### supportsUrl(url) → boolean

Called by the core engine when the user provides a purchase-history URL. The core iterates through registered adapters and selects the first one whose `supportsUrl` returns `true`.

```js
// Example Lidl adapter
supportsUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes('lidl.') && u.pathname.includes('purchase-history');
  } catch { return false; }
}
```

### hostPatterns() → string[]

Returns Chrome match patterns for content script injection. These are used both for manifest-declared content scripts and programmatic injection.

```js
hostPatterns() {
  return [
    '*://*.lidl.bg/*',
    '*://*.lidl.de/*',
    // ...
  ];
}
```

### getPurchaseHistoryUrl(baseUrl, pageNumber) → string

Builds the full URL for a specific listing page. Encapsulates retailer-specific query parameters.

```js
getPurchaseHistoryUrl(baseUrl, pageNumber) {
  const url = new URL(baseUrl);
  url.searchParams.set('page', String(pageNumber));
  return url.href;
}
```

### discoverReceiptUrls(document) → [{receipt_id, url}]

Runs in the content script context of a purchase-history page. Must be a pure function of the document — all state is managed by the core.

The returned array should be deduplicated by receipt_id. Each object contains:
- `receipt_id` — unique identifier for the receipt (usually from the URL parameter)
- `url` — full absolute URL to the receipt detail page

### extractReceipt(document, expectedReceiptId) → rawReceipt

Runs in the content script context of a receipt detail page. Returns adapter-native receipt data. The core passes the expected receipt ID for cross-validation.

The raw receipt can have any internal shape — it only needs to be understood by the adapter's own `normalizeReceipt` function.

### normalizeReceipt(rawReceipt) → NormalizedReceipt

Maps the adapter's internal receipt format to the BasketIndex normalized schema. See `docs/receipt-schema.md`.

This is called in the service worker context (not content script), after the raw receipt has been transmitted via message passing.

### checkAuth(document) → {authenticated, reason?}

Optional. Called to detect whether the user is logged in. Returns `{ authenticated: false, reason: 'Login form detected' }` when a login form or auth redirect is present.

## Loader semantics

The core engine discovers adapters via a registry:

```js
// core/adapter-registry.js
import { lidlAdapter } from '../adapters/lidl/adapter.js';

const registry = new Map();
registry.set('lidl', lidlAdapter);

export function getAdapter(id) {
  return registry.get(id);
}

export function resolveAdapter(url) {
  for (const adapter of registry.values()) {
    if (adapter.supportsUrl(url)) return adapter;
  }
  return null;
}

export function listAdapters() {
  return Array.from(registry.values()).map(a => ({
    id: a.id, name: a.name, supportedCountries: a.supportedCountries
  }));
}
```

## Content script injection

Content scripts are declared in two tiers:

1. **Core content scripts** (always injected): lightweight helper for adapter-agnostic tasks like readiness checks.
2. **Adapter content scripts** (conditionally injected): injected programmatically via `chrome.scripting.executeScript` when an adapter is activated, scoped to the current tab.

The core engine injects the adapter's `extractReceipt` function into worker tabs dynamically, rather than declaring all adapters' content scripts in the manifest. This keeps the manifest small and avoids unnecessary injection on non-matching pages.

## Error handling

All adapter methods should throw descriptive errors. The core engine catches adapter errors and maps them to job-level error states:

- `AdapterAuthError` — user needs to log in.
- `AdapterParseError` — DOM structure changed or unexpected format.
- `AdapterTimeoutError` — page took too long to load.
- `AdapterUnsupportedError` — this retailer/country combination is not supported.

## Testing

Adapters should be testable in isolation:

1. Anonymized HTML fixtures for listing and detail pages.
2. Expected raw receipt output from `extractReceipt`.
3. Expected normalized receipt output from `normalizeReceipt`.
4. Node.js test runner (no browser required for fixture tests).

See `docs/contributor-guide.md` for fixture contribution guidelines.
