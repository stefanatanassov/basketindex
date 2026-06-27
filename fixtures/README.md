# Fixtures

Anonymized test data for the BasketIndex offline validation pipeline.

## Directory structure

```
fixtures/lidl/
├── detail/          Raw extracted receipt JSON (output of detail-extractor.js)
│   ├── receipt-eur-2026.json   EUR dual-currency receipt (6 items)
│   └── receipt-bgn-2024.json   BGN single-currency receipt (7 items)
├── expected/        Expected normalized BasketIndex schema output
│   ├── receipt-eur-2026.normalized.json
│   └── receipt-bgn-2024.normalized.json
└── listing/         Raw listing page results (not yet validated)
    └── listing-page-1.json
```

## Validation

```bash
npm run validate-fixtures
```

Validates: raw fixture JSON → `adapters/lidl/normalizer.js` → `core/receipt-normalizer.js` → compare to expected output.

## Coverage

| Path | Fixture | Status |
|------|---------|--------|
| EUR dual-currency | receipt-eur-2026 | Validated |
| BGN single-currency | receipt-bgn-2024 | Validated |
| Paired items (qty) | Both fixtures | Validated |
| Single items (qty=1) | Both fixtures | Validated |
| Weight-based items (kg) | Both fixtures | Validated |
| Card payment extraction | Both fixtures | Validated |
| Listing page | listing-page-1 | Fixture exists, no validator yet |
| Discount lines | — | Not yet captured |
| HTML → raw parsing | — | Requires browser (out of scope) |

## Anonymization

All fixtures have been stripped of personally identifiable information:
- Receipt IDs, store codes, fiscal codes → generic `000...` values
- Card last 4 digits → `0000`
- TID / auth codes → generic
- Addresses → placeholder street names
- **Preserved**: product names, prices, quantities, tax types (public retail data, not PII)

See `docs/contributor-guide.md` for the full anonymization protocol.

## Adding a fixture

1. Copy a real raw receipt JSON (from the extension's export or console)
2. Scrub all PII following the guide in `docs/contributor-guide.md`
3. Place the raw fixture in `fixtures/lidl/detail/`
4. Generate the expected normalized output:
   ```bash
   node -e "
   import { normalizeReceipt } from '../adapters/lidl/normalizer.js';
   import { readFileSync, writeFileSync } from 'fs';
   const raw = JSON.parse(readFileSync('fixtures/lidl/detail/your-file.json','utf-8'));
   const n = normalizeReceipt(raw);
   n.import_metadata.imported_at = 'FIXTURE_TIMESTAMP';
   writeFileSync('fixtures/lidl/expected/your-file.normalized.json', JSON.stringify(n, null, 2));
   "
   ```
5. Run `npm run validate-fixtures` to confirm it passes
