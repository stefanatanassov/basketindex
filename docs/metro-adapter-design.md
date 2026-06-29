# BasketIndex — Metro Bulgaria Adapter Design

Status: proposed  
Scope: Metro Bulgaria (`docs.metro.bg`) API-first adapter for BasketIndex

## Summary

Metro Bulgaria should be implemented as BasketIndex's first API-driven retailer adapter.

The confirmed extraction path is:

1. Open an authenticated Metro tab at `https://docs.metro.bg/`
2. Read `localStorage.accessToken` from the page context
3. Call the invoices API with a user-selected date range
4. Paginate with `start` / `limit=100`
5. For each invoice, call `_links.articles.href`
6. Normalize invoice + article JSON into the BasketIndex schema
7. Export as JSON / CSV through the existing download pipeline

This design explicitly does **not** depend on:

- DOM scraping for invoice or item data
- PDF parsing
- visible UI pagination in the Metro portal
- `.ods` spreadsheet downloads

PDFs remain out of scope for Metro v1 unless real user data later reveals missing fields that materially affect the normalized schema.

## Confirmed Metro findings

### Authentication

- Entry point: `https://docs.metro.bg/`
- Login handled by Metro's auth flow through `idam.metro.bg`
- Access token is stored in `localStorage.accessToken`
- Token is a Bearer JWT with roughly 1 hour lifetime
- SPA appears to refresh auth automatically
- A content script on `docs.metro.bg` can read the token directly

### Listing API

Primary source:

`GET /mriapi/v1/customer/invoices`

Observed query shape:

```text
?from=2019-01-01
&to=2026-06-29
&start=0
&limit=100
&cdmAccountId=<UUID>
&pod=true
```

Confirmed behavior:

- `from` / `to` accept broad historical ranges
- pagination is offset-based with `start` and `limit`
- `numFound` gives the total invoice count
- old invoices are returned for broad ranges
- account tested successfully returned invoices from 2019 through 2026

### Detail / line item API

Per invoice, the listing response includes:

- `_links.self.href`
- `_links.download.href`
- `_links.articles.href`

Primary detail source:

`GET _links.articles.href`

Confirmed behavior:

- 2019 invoices still expose `_links.articles.href`
- 2019 articles endpoint returns `200 OK`
- line items are structured JSON, not rendered HTML or PDF-derived text

## Why Metro is different from Lidl

Lidl is currently modeled as:

- listing page DOM discovery
- receipt detail page DOM extraction
- worker tabs per receipt

Metro wants:

- authenticated token acquisition from one Metro tab
- direct API iteration in the background
- invoice pagination by API offset
- item extraction by per-invoice JSON endpoint

This is a better technical fit than Metro's UI, but it does not match the current core's Lidl-shaped execution model.

## Recommended architecture decision

Implement Metro as a **Metro-specific API adapter** first, not as a generic API-adapter framework.

Reasoning:

- Only Metro currently needs this pattern
- the token acquisition mechanism is retailer-specific
- forcing a general abstraction too early will slow delivery
- the extension already has a planned `metro` slot in the adapter registry

However, the core should be adjusted in a way that leaves room for future API-first adapters.

## Proposed Metro adapter responsibilities

Create `adapters/metro/` with retailer-specific logic only.

Suggested files:

```text
adapters/metro/
├── adapter.js
├── hosts.js
├── auth.js
├── api-client.js
├── listing-extractor.js
├── detail-extractor.js
└── normalizer.js
```

Suggested responsibility split:

- `adapter.js`
  - adapter metadata
  - host patterns
  - action names
  - capability flags for API-driven flow
- `hosts.js`
  - `docs.metro.bg` matching
  - Metro auth/listing URL helpers
- `auth.js`
  - token reading and expiry checks
- `api-client.js`
  - invoice listing fetch
  - articles fetch
  - pagination helpers
- `listing-extractor.js`
  - content script message handlers for auth/token acquisition only
- `detail-extractor.js`
  - optional placeholder or omitted if no Metro detail DOM work is needed
- `normalizer.js`
  - maps invoice + articles JSON into BasketIndex normalized schema

## Core changes required

### 1. Support adapter-specific execution modes

The core currently assumes:

- listing tab discovers receipt URLs
- worker tabs navigate to detail pages

Metro needs a second mode:

- listing tab exists only to provide authenticated page context
- service worker performs API calls directly
- no worker tabs needed for detail extraction

Recommendation:

Add an adapter capability/mode field, for example:

```js
executionMode: 'dom_listing_dom_detail' | 'api_listing_api_detail'
```

Metro would use `api_listing_api_detail`.

### 2. Add token acquisition handshake

The service worker needs a way to request the token from the Metro tab.

Suggested message flow:

1. Service worker opens or reuses a Metro tab
2. Metro content script receives `METRO_GET_AUTH`
3. Content script reads `localStorage.accessToken`
4. Content script returns `{ accessToken, expiresAt? }`
5. Service worker stores token only in in-memory job state, not long-term persisted storage

Recommendation:

- Persist minimal auth state only if necessary
- prefer in-memory storage for the active token
- if persistence is unavoidable, store expiry and clear aggressively

### 3. Add adapter-driven listing fetch

Instead of forcing all adapters into `getPurchaseHistoryUrl(baseUrl, pageNumber)`, allow Metro to define a listing fetch loop.

Suggested adapter methods:

```js
getInitialScanConfig(config) { ... }
fetchListingPage(context) { ... }
fetchReceiptDetail(context, receiptRef) { ... }
```

For Metro:

- `fetchListingPage` calls invoices API with `start` / `limit`
- `fetchReceiptDetail` calls articles API for one invoice

This can be introduced incrementally without rewriting Lidl.

### 4. Allow date-range config in popup/core

Metro should not use `startPage` / `endPage`.

Required UX change:

- per-adapter config fields
- Metro fields:
  - `fromDate`
  - `toDate`
- Lidl keeps:
  - `startPage`
  - `endPage`

Short-term pragmatic approach:

- reuse `listingUrl` for Metro as entry URL
- show/hide date fields based on selected adapter
- ignore Lidl page-range fields when adapter is `metro`

### 5. Keep export pipeline unchanged

Existing JSON / CSV export should remain unchanged.

Metro should normalize into the same schema the download pipeline already expects.

## Metro data mapping

### Listing invoice object

Useful observed fields:

- `transactionId`
- `invoiceNumber`
- `invoiceDate`
- `totalAmount`
- `netAmount`
- `currency`
- `customerStoreId`
- `_links.articles.href`

### Articles object

Useful observed fields:

- `description`
- `itemNumber`
- `itemInputString`
- `invoiceLineSequenceNumber`
- `quantity`
- `sellingUnit`
- `totalAmount`
- `netAmount`
- `itemColliGrossAmount`
- `itemColliNetAmount`
- `itemColliPriceGrossDiscounted`
- `itemTotalGrossDiscountedAmount`
- `packagePrintCode`
- `pieceNetWeight`
- `weightItem`
- `transactionId`

### Initial BasketIndex mapping

Recommended v1 mapping:

- `source.retailer_id` → `"metro"`
- `source.retailer_name` → `"METRO"`
- `source.country` → `"BG"`
- `receipt.id` → `transactionId`
- `receipt.date/time/datetime_local` → `invoiceDate`
- `store.code` → `customerStoreId`
- `currency.primary` → `"EUR"`
- `currency.secondary` → `null`
- `totals.total_primary` → invoice `totalAmount`
- `totals.subtotal_primary` → invoice `netAmount`
- `items[].line_no` → `invoiceLineSequenceNumber`
- `items[].product.retailer_product_id` → `itemNumber`
- `items[].product.name` → `description`
- `items[].quantity.value` → `quantity`
- `items[].quantity.unit` → inferred from `weightItem`, `pieceNetWeight`, `sellingUnit`
- `items[].pricing.unit_price_primary` → `itemColliGrossAmount`
- `items[].pricing.line_total_primary` → `totalAmount`
- `items[].tax.type` → `packagePrintCode`
- `items[].discounts` → inferred from discounted vs non-discounted amounts

### Known gaps acceptable for v1

These are not blockers:

- store name
- store address
- payment method
- customer address
- exact VAT rate mapping when only tax code is available

The Metro normalizer should leave unknown optional fields as `null`.

## Historical coverage

Metro historical extraction is confirmed through the API.

Verified:

- broad date filters return older invoices
- `numFound` increased from recent-window results to full-history results
- 2019 invoices were returned
- 2019 invoices exposed `_links.articles.href`
- 2019 articles endpoint returned structured article JSON

Conclusion:

Metro historical coverage does **not** require PDFs.

## Pagination strategy

Do not paginate the visible Metro UI.

Use API pagination only:

```js
start = 0;
limit = 100;
while (start < numFound) {
  // fetch invoices
  start += limit;
}
```

This is simpler and more reliable than:

- clicking next buttons
- changing page size in the UI
- waiting for SPA rerenders

## Token handling guidance

Recommended Metro v1 behavior:

- read token from `localStorage.accessToken`
- decode JWT expiry if convenient
- before each batch, check whether the token is missing or near expiry
- if invalid, pause the job and ask the user to revisit/login at `docs.metro.bg`

Avoid:

- long-term persistence of the raw token in storage
- complex refresh-token logic inside the extension
- background auth flows independent of the retailer site

## Error handling

Metro-specific failure cases to handle explicitly:

- Metro tab not open and no token available
- token missing from localStorage
- token expired mid-run
- invoices API returns `401`
- articles API returns `401`
- articles API returns partial or empty data for one invoice
- invoice count changes while scanning

Recommended behavior:

- fail loudly with retailer-specific guidance
- keep already completed receipts
- allow resume after re-authentication

## Testing strategy

### Fixture goals

Add Metro API fixtures, not HTML fixtures, for v1.

Suggested structure:

```text
fixtures/metro/
├── listing/
│   ├── invoices-page-1.json
│   └── invoices-full-history-sample.json
├── detail/
│   ├── articles-2026-sample.json
│   └── articles-2019-sample.json
└── expected/
    ├── receipt-2026.normalized.json
    └── receipt-2019.normalized.json
```

### Validation goals

Validate:

- invoice listing parsing
- article payload parsing
- normalized output shape
- 2019 history compatibility
- discount inference
- quantity/unit inference

## Implementation phases

### Phase A — design-safe scaffolding

- add Metro design note
- add Metro adapter directory
- add Metro host metadata
- add Metro registry entry state from `planned` to `prototype`

### Phase B — token + listing prototype

- inject Metro content script on `docs.metro.bg`
- read token from localStorage
- fetch invoices API in a narrow date range
- persist raw invoice references to job state

### Phase C — articles + normalization

- fetch `_links.articles.href` for each invoice
- produce normalized Metro receipts
- ensure JSON export works end to end

### Phase D — popup and UX alignment

- add Metro-specific date range fields
- hide Lidl page-range fields when Metro is selected
- add Metro-specific auth / re-login messaging

### Phase E — fixtures and hardening

- capture anonymized Metro API fixtures
- add validation coverage
- test token expiry and resume behavior

## Non-goals for Metro v1

- PDF parsing
- `.ods` import path
- generic multi-retailer API framework
- automatic token refresh beyond Metro's own SPA session
- perfect store metadata enrichment

## Recommended implementation order

1. Minimal core change for adapter execution mode
2. Metro token acquisition content script
3. Invoices API integration
4. Articles API integration
5. Metro normalizer
6. Popup date-range UX
7. Fixtures and validation

## Open questions

These should not block initial implementation, but should be recorded:

- exact mapping of `packagePrintCode` to VAT rate
- best unit mapping for `sellingUnit` and `weightItem`
- whether store metadata is available through `_links.self.href`
- whether token should live only in service-worker memory or also in resumable job state

