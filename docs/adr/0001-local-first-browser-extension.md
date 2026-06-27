# ADR 0001: Local-First Browser Extension

**Status**: Accepted

**Date**: 2026-06-23

## Context

We are building a tool that extracts digital receipt data from retailer websites. The data is personal financial information (purchase history, prices, store locations, payment methods). We need to decide where processing and storage happen.

## Decision

BasketIndex will be a **local-first browser extension**. All receipt extraction, processing, and storage happens in the user's browser. No server component exists. No data is transmitted to any external service.

## Alternatives considered

### Server-based SaaS

A web application where the user uploads receipt data or logs in through a proxy, and the server handles extraction and storage.

**Rejected because**:
- Requires handling user credentials or session tokens (security risk).
- Requires storing personal financial data (GDPR / privacy burden).
- Requires ongoing server costs (hosting, database, backups).
- Creates a data breach target.
- Users must trust a third party with their purchase history.

### Hybrid (local extraction + optional cloud sync)

Extract locally, offer optional cloud backup/sync.

**Deferred, not rejected**. This could be added as an opt-in feature in the future, but the core experience must work without any server. Any cloud feature must be:
- Opt-in only.
- Clearly documented.
- Separately permissioned.
- End-to-end encrypted with user-controlled keys.

### Desktop application (Electron / Tauri)

A standalone desktop app instead of a browser extension.

**Rejected for MVP** because:
- A browser extension can leverage the user's existing authenticated retailer session without credential handling.
- Chrome Web Store provides built-in distribution and update mechanisms.
- Installing an unpacked extension has lower friction than installing a desktop app.
- Browser APIs (`chrome.storage`, `chrome.downloads`, `chrome.tabs`) are purpose-built for the task.

## Consequences

### Positive
- Zero server costs.
- Zero data breach surface (no server to breach).
- Strong privacy story: "your data never leaves your browser."
- GDPR compliance is simplified (no cross-border data transfer, no controller/processor relationship).
- Users control their own export files.

### Negative
- No cross-device sync (unless user manually transfers export files).
- Cannot build a public aggregate price database (requires server).
- Storage is limited to `chrome.storage.local` quota (~10MB without `unlimitedStorage`).
- Analytics and crash reporting require opt-in mechanisms or are impossible.
- Feature development must work within browser extension constraints (MV3, service worker lifecycle).
