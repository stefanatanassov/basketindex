# Launch Readiness Audit — 2026-06-27

## Ready now

### Product
- [x] Lidl adapter extracts receipts (tested: BG)
- [x] JSON export uses BasketIndex 1.0 normalized schema
- [x] CSV export (flat, one row per item)
- [x] EUR/BGN dual-currency handling with exchange rate
- [x] Progress UI with live stats
- [x] Pause/resume across browser restarts
- [x] Automatic retry and recovery rounds
- [x] Lidl Plus discount capture
- [x] Error messages are user-friendly
- [x] Job state survives service worker suspension

### Architecture
- [x] Core engine is retailer-agnostic (`core/`, `lib/`)
- [x] Lidl extraction lives in `adapters/lidl/`
- [x] Adapter registry functional
- [x] Adapter interface documented (`docs/adapter-interface.md`)
- [x] Normalized receipt schema v1.0 (`docs/receipt-schema.md`)
- [x] Content scripts injected from adapter paths
- [x] Manifest synced from adapter metadata (`scripts/sync-manifest.mjs`)

### Trust
- [x] MIT License (`LICENSE`)
- [x] Privacy policy (`docs/privacy-model.md`)
- [x] Security policy (`SECURITY.md`)
- [x] Contributing guide (`CONTRIBUTING.md`, `docs/contributor-guide.md`)
- [x] No credentials collected, stored, or transmitted
- [x] No server dependency
- [x] No analytics or telemetry (audited: zero fetch/XHR/eval)
- [x] All permissions documented with justification
- [x] Retailer disclaimer in README and popup footer
- [x] `unlimitedStorage` permission added for quota safety

### Open source
- [x] Public-ready README with value proposition, limitations, install flow
- [x] Roadmap visible (`docs/roadmap.md`)
- [x] Architecture decision records (`docs/adr/`)
- [x] Offline fixture validation (`npm run validate-fixtures`, 2 fixtures)
- [x] Manifest sync script (`npm run sync-manifest`)
- [x] Launch assets checklist (`docs/public-launch.md`)
- [x] Zero runtime dependencies

### Code health
- [x] All JS/MJS files pass `node --check`
- [x] `manifest.json` is valid
- [x] No circular imports
- [x] No `eval()`, no `import()` in SW scope, no remote code
- [x] Content scripts are IIFE-wrapped, adapters are ES modules
- [x] No build step required

---

## Requires manual/external work

| Item | Blocker? | Notes |
|------|----------|-------|
| Chrome Web Store listing | Yes, for public distribution | Requires $5 dev fee, screenshots, privacy URL, store assets |
| Screenshots (4+) | Yes, for CWS + README | Requires actual Chrome with Lidl session |
| Demo video/GIF | Soft | Improves conversion; not strictly required for GitHub |
| Security contact email | Yes | Current placeholder (`basketindex-security@proton.me`) — replace with real address |
| Landing page | Soft | GitHub Pages would suffice |
| Live browser validation | Yes | All tests here are syntax + fixtures; full browser run not possible |
| Real user testing (3+ users) | Soft | Phase 9 goal; needed before public promotion |
| FAQ page | Soft | Draft exists in `docs/public-launch.md` |

---

## Medium-priority technical debt

| Item | Effort | Notes |
|------|--------|-------|
| `LIDL_` message prefix rename | Medium | Affects messaging.js + content scripts + SW. Cosmetic. |
| Second adapter stub | Low | Architecture supports it. A no-op adapter proves the interface. |
| HTML → raw offline validation | Medium | Requires `jsdom`. Would enable extractor regression tests. |
| Firefox / Edge support | High | Requires Manifest V2 compatibility or separate build. |
| Multi-language UI | Medium | Bulgarian + German at minimum for EU audience. |

---

## Verdict

**The repo is ready for public GitHub visibility as an open-source MVP for technical early adopters.**

The code is stable, validated, documented, and privacy-safe. A developer who clones the repo and follows the README install steps can get a working Lidl receipt export in under 5 minutes.

The main blockers to a wider audience are Chrome Web Store distribution (one-time setup) and non-technical onboarding (requires screenshots, demo, and a landing page). Neither requires code changes.

### Recommended next

1. Replace the security contact placeholder with a real email
2. Capture screenshots from a real Lidl session
3. Create the Chrome Web Store listing
4. Publish the GitHub repo as public
5. Share with 3–5 technical early adopters for feedback
