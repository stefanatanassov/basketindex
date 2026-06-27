# ADR 0002: Retailer Adapter Architecture

**Status**: Accepted

**Date**: 2026-06-23

## Context

The current prototype is hardcoded for Lidl. Every file — selectors, URL discovery, DOM extraction, receipt normalization — assumes Lidl Bulgaria's specific HTML structure and page patterns. To support additional retailers, we need a way to add retailer-specific logic without rewriting the core engine each time.

## Decision

BasketIndex will use a **retailer adapter architecture**. Each retailer is implemented as a separate adapter module that conforms to a standard interface. The core engine is retailer-agnostic — it orchestrates jobs, manages tabs, handles storage, and drives export, but never references a specific retailer by name.

The adapter interface defines:
- URL detection (`supportsUrl`)
- Host patterns (`hostPatterns`)
- Listing page navigation (`getPurchaseHistoryUrl`)
- Receipt URL discovery (`discoverReceiptUrls`)
- Receipt detail extraction (`extractReceipt`)
- Receipt normalization (`normalizeReceipt`)
- Authentication detection (`checkAuth`)

The full interface is documented in `docs/adapter-interface.md`.

## Alternatives considered

### Single codebase with if/else branching

Add `if (retailer === 'lidl')` branches throughout the code.

**Rejected because**:
- Every new retailer adds branches to every file — exponential complexity.
- Testing one retailer's code requires understanding others.
- Contributors for different retailers would conflict on the same files.
- The core diverges into an unmaintainable monolith.

### Microservice-style independent extensions

Each retailer gets its own Chrome extension.

**Rejected because**:
- Duplicates all core logic (storage, queue, tab management, export).
- User must install multiple extensions for multiple retailers.
- No shared receipt schema or export format.
- Maintenance burden multiplies with each retailer.

### Plugin system with dynamic loading

Adapters are separate files loaded at runtime via dynamic imports or user-installed plugins.

**Rejected for MVP** because:
- MV3 service workers restrict dynamic imports (`import()` is forbidden in ServiceWorkerGlobalScope).
- A plugin system adds complexity (versioning, compatibility checks, sandboxing).
- For the initial set of retailers (3-5), static imports with a registry are simpler and more reliable.

**May be revisited** if the number of adapters grows beyond what's practical in a single extension package.

## Consequences

### Positive
- Clean separation of concerns: core engine vs. retailer logic.
- New retailers can be added by creating one directory without touching core files.
- Adapters can be tested in isolation with HTML fixtures.
- Contributors can focus on one retailer without understanding the entire codebase.
- The adapter interface serves as documentation for what a retailer integration requires.

### Negative
- All adapters ship in the same extension (larger download, more content scripts).
- Content script injection must be managed carefully to avoid injecting unnecessary scripts.
- The adapter interface is a new abstraction that must be learned by contributors.
- Maintaining the interface as new retailers expose edge cases requires discipline.
