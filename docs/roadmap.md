# BasketIndex — Roadmap

## Phase 0 — Freeze current working version

**Goal**: Protect the current Lidl exporter baseline before any redesign.

- [ ] Preserve current extension behavior exactly as-is.
- [ ] Document current tested flow end-to-end.
- [ ] Confirm extension still loads unpacked in Chrome.
- [ ] Confirm Lidl BG export produces valid JSON.
- [ ] Confirm existing exported JSON files remain usable.
- [ ] Take a tagged snapshot in git: `v0.1.0-lidl-prototype`.

**Done when**: Extension loads unpacked, Lidl BG export works, and existing JSON is parseable.

---

## Phase 1 — Public identity and positioning

**Goal**: Position the project as BasketIndex, not a Lidl-only tool.

- [ ] Rename extension display name to "BasketIndex" (keep manifest `name` as-is during prototype).
- [ ] Add independent-retailer disclaimer to README and popup.
- [ ] Rewrite README description to center the receipt hub mission.
- [ ] Add privacy-first wording throughout docs.
- [ ] File naming and internal references use neutral language.

**Done when**: Docs and README clearly present BasketIndex as a receipt hub, not a Lidl utility.

---

## Phase 2 — Repo skeleton and open-source foundation

**Goal**: Make the project understandable to outsiders.

- [ ] README with project identity, mission, supported retailers table.
- [ ] LICENSE file (MIT or Apache 2.0).
- [ ] docs/vision.md.
- [ ] docs/roadmap.md (this file).
- [ ] docs/architecture.md.
- [ ] docs/privacy-model.md.
- [ ] docs/security-notes.md.
- [ ] docs/contributor-guide.md.
- [ ] docs/receipt-schema.md.
- [ ] docs/adapter-interface.md.
- [ ] docs/refactor-plan.md.
- [ ] Architecture Decision Records (ADR) for key choices.

**Done when**: A new contributor understands the mission and architecture within 2 minutes of reading.

---

## Phase 3 — Normalized receipt schema

**Goal**: Define a retailer-neutral data model.

**Entities to define**:
- Retailer
- Store
- Receipt
- ReceiptItem
- Payment
- Discount
- Tax
- Currency
- ImportMetadata

**Done when**: Lidl receipt data can be represented in the normalized schema without leaking Lidl-specific selectors, URL patterns, or DOM assumptions into the core model.

---

## Phase 4 — Core + adapter refactor

**Goal**: Separate the generic extension engine from retailer-specific logic.

**Target structure**:
```
extension/
├── manifest.json
├── service-worker.js
├── core/
│   ├── storage.js
│   ├── queue.js
│   ├── job-manager.js
│   ├── tab-manager.js
│   ├── download.js
│   ├── messaging.js
│   ├── adapter-registry.js
│   └── receipt-normalizer.js
├── adapters/
│   └── lidl/
│       ├── adapter.js
│       ├── hosts.js
│       ├── listing-extractor.js
│       ├── detail-extractor.js
│       ├── selectors.js
│       └── normalizer.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── pages/
    └── status.html
```

**Done when**:
- Lidl-specific selectors, URLs, DOM extraction, and receipt normalization live exclusively under `adapters/lidl/`.
- Core handles job lifecycle, queue, storage, tabs, export, messaging, and progress UI without retailer knowledge.
- A new adapter can be added by creating one new directory without touching core files.

---

## Phase 5 — Hardening before public code release

**Goal**: Make the extension safe, reviewable, and contributor-friendly.

- [ ] Review storage quota; consider `unlimitedStorage` permission.
- [ ] Add CSV export alongside JSON.
- [ ] Improve discount line handling.
- [ ] Improve local error reporting with structured error types.
- [ ] Document every permission and its justification.
- [ ] Audit for any analytics, telemetry, or external requests.
- [ ] Confirm zero remote code execution.

**Done when**: A reviewer can understand exactly what data is accessed, where it's stored, and what leaves the browser.

---

## Phase 6 — Fixtures and validation

**Goal**: Protect parser correctness during refactors.

- [ ] Create anonymized HTML fixtures from real Lidl receipt pages.
- [ ] Create expected normalized JSON outputs for each fixture.
- [ ] Add a lightweight validation script (Node.js, no browser needed).
- [ ] Run validation as part of pre-commit or CI.

**Done when**: Basic Lidl parsing can be tested without manually opening real receipts in a browser.

---

## Phase 7 — Public documentation

**Goal**: Make the project easy to trust and contribute to.

- [ ] Complete README with install instructions, architecture diagram, supported retailers table.
- [ ] CONTRIBUTING.md with adapter contribution guide.
- [ ] SECURITY.md with reporting process.
- [ ] Privacy documentation confirming no data collection.
- [ ] Adapter contribution guide (how to add a new retailer).

**Done when**: A stranger can understand the project and contribute safely without prior context.

---

## Phase 8 — Launch-ready MVP

**Goal**: Have a usable extension for real users.

**Must include**:
- Lidl adapter (tested on BG, with EUR/BGN support).
- Local-only processing.
- JSON export.
- CSV export.
- Pause/resume.
- Retry/recovery.
- Progress UI.
- Generic receipt schema.
- Privacy documentation.
- Clear retailer disclaimer.

**Explicitly exclude for MVP**:
- Cloud sync.
- User accounts.
- AI/ML analysis.
- Public aggregate price database.
- OCR/paper receipt scanning.
- Mobile app.
- Multi-retailer support beyond Lidl.
- SaaS dashboard or web app.

---

## Phase 9 — Soft launch

**Goal**: Validate with a small trusted group.

**Success criteria**:
- At least 10 successful full exports from real users.
- At least 3 different Lidl accounts (different users).
- Real feedback collected and triaged.
- Known bug list maintained.
- Zero reports of sensitive data leakage.

---

## Phase 10 — Public launch

**Goal**: Release publicly with confidence.

**Assets**:
- Public GitHub repository.
- Chrome Web Store listing.
- Simple landing page (GitHub Pages).
- Demo video or animated GIF showing full flow.
- Screenshots of popup and export output.
- FAQ addressing common concerns.
- Privacy page linked from Chrome Web Store listing.

---

## Post-launch

- Community adapter contributions.
- Multi-retailer support (Kaufland, Billa, Fantastico, etc.).
- Optional local-only analysis dashboard.
- Integration adapters for budgeting apps (YNAB, Toshl, etc.).
