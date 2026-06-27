# Contributing to BasketIndex

Thanks for your interest in contributing. BasketIndex is an open-source, local-first receipt data hub. We welcome contributions of code, documentation, retailer adapters, and anonymized test fixtures.

## Code of Conduct

Be respectful. Assume good intent. Keep discussions focused on the project.

## Bug reports

When opening a bug report, include:

- Which Lidl country/domain you used (e.g., `lidl.bg`, `lidl.de`)
- What you did (page range, worker count)
- What you expected vs. what happened
- Console errors if visible (right-click extension → Inspect popup)
- Whether the issue is reproducible

## Feature requests

Feature requests are welcome. Tag them with `enhancement`. Good feature requests explain:

- What problem the feature solves
- Whether it could be implemented local-first (required for core features)
- Whether it requires new permissions (if so, why)

## Questions and discussion

Use GitHub Discussions for questions about using BasketIndex, adding adapters, or understanding the architecture.

Before asking, check:
- [README](README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/adapter-interface.md](docs/adapter-interface.md)
- [docs/contributor-guide.md](docs/contributor-guide.md)

## Security vulnerabilities

**Do not open a public issue.** See [SECURITY.md](SECURITY.md) for private reporting instructions.

## Adapter contribution ideas

Want to add a retailer? Great. Before writing code:

1. Open a discussion describing the retailer and how their digital receipts work
2. Confirm the retailer shows receipts in a browser (not app-only)
3. Share anonymized HTML structure if possible
4. Then follow the adapter guide in [`docs/adapter-interface.md`](docs/adapter-interface.md)

Be respectful. Assume good intent. Keep discussions focused on the project.

## How to contribute

The full contributor guide is at [`docs/contributor-guide.md`](docs/contributor-guide.md). It covers:

- How to contribute documentation improvements
- How to contribute a retailer adapter (step-by-step)
- How to provide anonymized fixtures
- How to avoid leaking personal receipt data
- How to keep changes local-first and privacy-safe

## Quick start: fixture validation

```bash
npm run validate-fixtures
```

This validates that the Lidl adapter's normalized output matches expected results. It runs offline with zero dependencies beyond Node.js.

## Quick start: manifest sync

If you add or remove countries in an adapter's `hosts.js`:

```bash
npm run sync-manifest
```

This regenerates `manifest.json` host permissions and content script matches from adapter metadata.

## What we look for

- **Privacy by default**: No analytics, no telemetry, no credential collection, no server.
- **Local-first**: All processing happens in the browser. If a feature needs a server, it must be opt-in.
- **Keep it small**: No new dependencies without clear justification.
- **Test with fixtures**: Anonymized fixtures protect against regressions without requiring live retailer sessions.

## Before submitting

1. Run `npm run validate-fixtures` and confirm all pass.
2. Run `node --check` on any new or changed JavaScript files.
3. Do not include real receipt data, credentials, or personal identifiers in any commit.
4. Review the [security notes](docs/security-notes.md) for contributor safety guidelines.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [LICENSE](LICENSE)).
