# BasketIndex — Launch Checklist

This checklist tracks what must be true before each launch milestone.

## Phase 0 — Freeze baseline

- [ ] Extension loads unpacked in Chrome.
- [ ] Lidl BG export produces valid JSON.
- [ ] Pause/resume works within a single session.
- [ ] Retry and recovery rounds execute.
- [ ] Existing exported JSON files parse correctly.
- [ ] Tagged snapshot exists in git.

## Phase 1 — Identity

- [ ] README presents project as "BasketIndex" not "Lidl Exporter".
- [ ] Independent retailer disclaimer in README and popup footer.
- [ ] Privacy-first language throughout docs.
- [ ] Manifest `name` updated to "BasketIndex".

## Phase 2 — Open-source foundation

- [ ] README complete (identity, install, supported retailers, links).
- [ ] LICENSE file committed (MIT or Apache 2.0).
- [ ] `docs/vision.md` complete.
- [ ] `docs/roadmap.md` complete.
- [ ] `docs/architecture.md` complete.
- [ ] `docs/privacy-model.md` complete.
- [ ] `docs/security-notes.md` complete.
- [ ] `docs/contributor-guide.md` complete.
- [ ] `docs/receipt-schema.md` complete.
- [ ] `docs/adapter-interface.md` complete.
- [ ] `docs/refactor-plan.md` complete.
- [ ] ADRs for key decisions committed.
- [ ] New contributor can understand the project in < 2 minutes.

## Phase 3-4 — Architecture

- [ ] Generic receipt schema defined and documented.
- [ ] Adapter interface defined and documented.
- [ ] Core engine is retailer-agnostic (no Lidl references in `core/`).
- [ ] Lidl logic lives exclusively in `adapters/lidl/`.
- [ ] Adapter registry functional.
- [ ] A second adapter stub exists (proves the interface works).

## Phase 5 — Hardening

- [ ] CSV export works alongside JSON.
- [ ] Discount lines captured and normalized.
- [ ] Storage quota reviewed; `unlimitedStorage` added if needed.
- [ ] All permissions documented with justification.
- [ ] Zero analytics or telemetry code present.
- [ ] Zero remote code execution paths.
- [ ] Structured error reporting (not raw stack traces to users).

## Phase 6 — Fixtures and validation

- [ ] Anonymized HTML fixtures exist for Lidl BG listing + detail pages.
- [ ] Expected normalized JSON exists for each fixture.
- [ ] Validation script runs and passes.
- [ ] Fixture tests can run without a browser.

## Phase 7 — Public docs

- [ ] README install instructions are clear and tested.
- [ ] Architecture diagram in docs.
- [ ] CONTRIBUTING.md published.
- [ ] SECURITY.md published.
- [ ] Privacy page ready for Chrome Web Store link.
- [ ] Adapter contribution guide understandable to a new developer.

## Phase 8 — Launch-ready MVP

### Product
- [ ] Lidl adapter works on tested countries.
- [ ] JSON export produces valid, normalized output.
- [ ] CSV export produces valid, normalized output.
- [ ] EUR/BGN dual-currency handling correct.
- [ ] Progress UI shows meaningful status.
- [ ] Errors are understandable in plain language.
- [ ] Pause/resume works across browser restarts.
- [ ] Retry/recovery handles failures gracefully.

### Architecture
- [ ] Core is retailer-neutral.
- [ ] Lidl code lives in adapter directory.
- [ ] Generic receipt schema used for output.
- [ ] Adapter interface implemented and documented.

### Trust
- [ ] Privacy policy exists and is linked from extension.
- [ ] Security policy exists.
- [ ] No credentials collected, stored, or transmitted.
- [ ] No server dependency.
- [ ] No extension analytics.
- [ ] All permissions documented with justification.
- [ ] Retailer disclaimer present in popup and README.

### Open source
- [ ] License selected and committed.
- [ ] CONTRIBUTING.md published.
- [ ] Good first issues tagged.
- [ ] Roadmap visible in repository.

## Phase 10 — Public launch

### Assets
- [ ] Public GitHub repository (clean history, no secrets).
- [ ] Chrome Web Store listing submitted.
- [ ] Landing page (GitHub Pages or similar).
- [ ] Demo video or animated GIF (30-60 seconds, full flow).
- [ ] Screenshots (popup, export output, error states).
- [ ] FAQ page.

### Community
- [ ] Feedback channel established (GitHub Discussions or similar).
- [ ] Known limitations page published.
- [ ] First-time contributor guide tested by at least one external person.

### Quality
- [ ] Tested by at least 3 independent users.
- [ ] At least 10 successful full exports from real accounts.
- [ ] No known data integrity issues.
- [ ] No known privacy leaks.
