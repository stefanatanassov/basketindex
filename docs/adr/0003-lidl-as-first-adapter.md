# ADR 0003: Lidl as First Adapter

**Status**: Accepted

**Date**: 2026-06-23

## Context

The project began as a Lidl-specific receipt exporter for personal use. It has working code for Lidl Bulgaria: DOM extraction, EUR/BGN currency detection, receipt normalization, listing discovery, queue/retry/recovery, and JSON export. The project is now being repositioned as a retailer-agnostic receipt hub called BasketIndex. We need to decide how to handle the existing Lidl code during the architectural transition.

## Decision

**Lidl will be the first adapter, not the product identity.** The existing working code will be preserved and refactored into the adapter structure, not rewritten from scratch. The Lidl adapter will serve as the reference implementation for future adapters.

## Rationale

1. **Working code is valuable.** The Lidl extractor handles a real, complex e-receipt format with edge cases (paired rows, currency conversion, weight-based items, discount lines). Replacing it with an untested rewrite would be risky.

2. **A working adapter validates the interface.** Before designing an abstract adapter interface, we need at least one concrete implementation to ensure the interface is practical. Lidl provides that.

3. **Lidl is a strong first target.** Lidl operates in 22 European countries with similar digital receipt pages. A working Lidl adapter immediately serves a large potential user base.

4. **Preserving extraction logic avoids regressions.** The DOM parsing, currency detection, and receipt normalization logic has been debugged against real receipts. Moving it into an adapter module preserves that correctness while making the architecture cleaner.

## What changes

- The `manifest.json` name will change from "Lidl Receipt Exporter" to "BasketIndex".
- README and documentation will present Lidl as "first supported retailer" rather than "the product".
- The code will be reorganized: Lidl logic moves to `adapters/lidl/`, core logic stays in `core/`.
- The receipt schema will be generalized to support any retailer, not just Lidl.

## What does NOT change

- The Lidl extraction logic itself is not rewritten — it is relocated.
- The exported JSON format for Lidl receipts remains usable.
- The extension still loads and exports Lidl receipts correctly.
- Zero new dependencies are introduced.

## Alternatives considered

### Build a new abstraction from scratch, discard Lidl code

**Rejected because**: The Lidl extractor represents weeks of debugging against real receipts. Discarding it would waste that work and introduce regression risk. The Lidl adapter validates the interface design — an abstract interface without a working implementation is speculative.

### Keep the project Lidl-only

**Rejected because**: The vision is bigger than one retailer. The extraction engine (job management, tab orchestration, storage, export) is generic. Limiting the project to Lidl artificially constrains its value.

### Support Lidl + 3 other retailers from day one

**Rejected because**: Building multiple adapters before validating the architecture with one is premature. The Lidl adapter will surface the real requirements of the adapter interface. Building 3 adapters before that validation risks interface churn.

## Consequences

### Positive
- The project retains all existing functionality.
- The Lidl adapter serves as both a working feature and a reference implementation.
- The adapter interface is grounded in a real, complex retailer integration.
- Contributors adding a second retailer have a concrete example to follow.

### Negative
- The refactor must preserve existing behavior — it cannot be a clean-slate redesign.
- The adapter interface may initially be overfitted to Lidl patterns until a second retailer exposes gaps.
- Some Lidl-specific concepts (e.g., `data-art-quantity` attributes) may influence the normalized schema design.
