# BasketIndex — Normalized Receipt Schema

Version: 1.0-draft

This schema defines the retailer-neutral data model that all adapters normalize into. Analysis tools, export formats, and downstream consumers should depend on this schema, not on adapter-specific raw formats.

## Schema

```json
{
  "schema_version": "1.0",
  "import_metadata": {
    "imported_at": "2026-06-23T12:00:00Z",
    "importer": "basketindex-extension",
    "importer_version": "0.1.0",
    "adapter_id": "lidl",
    "adapter_version": "1.0.0"
  },
  "source": {
    "retailer_id": "lidl",
    "retailer_name": "Lidl",
    "country": "BG",
    "country_name": "Bulgaria",
    "source_url": "https://www.lidl.bg/mre/purchase-detail?t=03000126220260606205279"
  },
  "receipt": {
    "id": "03000126220260606205279",
    "date": "2026-06-06",
    "time": "19:56:41",
    "datetime_local": "2026-06-06T19:56:41"
  },
  "store": {
    "code": "0000126",
    "name": "Лидл Равда 126",
    "address": "с. Равда, Кръстовище Е87 и с. Равда",
    "tax_id": "BG131071587",
    "company_id": "131071587"
  },
  "currency": {
    "primary": "EUR",
    "secondary": "BGN",
    "exchange_rate": 1.95583,
    "exchange_rate_source": "receipt"
  },
  "totals": {
    "subtotal_primary": 66.01,
    "subtotal_secondary": 129.10,
    "total_primary": 62.86,
    "total_secondary": 122.94,
    "discount_total_primary": 3.15,
    "discount_total_secondary": 6.16
  },
  "items": [
    {
      "line_no": 1,
      "product": {
        "retailer_product_id": "0082410",
        "name": "ЧЕРИ ДОМАТИ 250Г.",
        "category": null
      },
      "quantity": {
        "value": 2.0,
        "unit": "pcs"
      },
      "pricing": {
        "unit_price_primary": 1.79,
        "line_total_primary": 3.58,
        "unit_price_secondary": 3.50,
        "line_total_secondary": 7.00
      },
      "tax": {
        "type": "B",
        "rate": null
      },
      "discounts": [],
      "raw": {
        "text": "ЧЕРИ ДОМАТИ 250Г.                     3,58 B",
        "adapter_parse_method": "dom_paired"
      }
    }
  ],
  "payments": [
    {
      "method": "КРЕДИТНА/ДЕБИТНА КАРТА",
      "amount_primary": 62.86,
      "amount_secondary": 122.94,
      "card_last_four": "3634"
    }
  ],
  "discounts": [
    {
      "description": "Lidl Plus промоция",
      "promotion_id": "100001000-BG-TEMPLATE-BGOF000397142-1",
      "amount_primary": 1.80,
      "amount_secondary": 3.52,
      "applied_to_lines": [1]
    }
  ]
}
```

## Field definitions

### import_metadata

| Field | Type | Description |
|-------|------|-------------|
| `imported_at` | ISO 8601 | When the receipt was imported by the extension |
| `importer` | string | Always `"basketindex-extension"` |
| `importer_version` | string | Extension version at import time |
| `adapter_id` | string | Which adapter produced this data |
| `adapter_version` | string | Adapter version at import time |

### source

| Field | Type | Description |
|-------|------|-------------|
| `retailer_id` | string | Unique retailer identifier |
| `retailer_name` | string | Human-readable retailer name |
| `country` | string | ISO 3166-1 alpha-2 |
| `country_name` | string | Human-readable country name |
| `source_url` | string | Full URL of the receipt page |

### receipt

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique receipt identifier from retailer |
| `date` | YYYY-MM-DD | Receipt date |
| `time` | HH:MM:SS | Receipt time (local) |
| `datetime_local` | ISO 8601 | Full local datetime |

### store

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Retailer's store code |
| `name` | string | Store name |
| `address` | string | Full store address |
| `tax_id` | string | VAT / tax identification number |
| `company_id` | string | Company / corporate registration number |

### currency

| Field | Type | Description |
|-------|------|-------------|
| `primary` | string | ISO 4217 code of receipt's main currency |
| `secondary` | string | ISO 4217 code of secondary currency (for dual-currency receipts like EUR/BGN) |
| `exchange_rate` | number \| null | Exchange rate printed on receipt, or null if single-currency |
| `exchange_rate_source` | string | `"receipt"` if from receipt, `"fixed"` if known constant |

### totals

All monetary fields are in the currency indicated by the field suffix (`_primary`, `_secondary`).

| Field | Type | Description |
|-------|------|-------------|
| `subtotal_primary` | number | Pre-discount subtotal |
| `subtotal_secondary` | number \| null | Pre-discount subtotal in secondary currency |
| `total_primary` | number | Final total (after discounts) |
| `total_secondary` | number \| null | Final total in secondary currency |
| `discount_total_primary` | number | Sum of all discounts applied |
| `discount_total_secondary` | number \| null | Discount total in secondary currency |

### items[].product

| Field | Type | Description |
|-------|------|-------------|
| `retailer_product_id` | string | Retailer's article/product identifier |
| `name` | string | Product name as printed on receipt |
| `category` | string \| null | Optional product category (may be inferred later) |

### items[].quantity

| Field | Type | Description |
|-------|------|-------------|
| `value` | number | Numeric quantity |
| `unit` | string | `"pcs"`, `"kg"`, `"l"`, `"g"`, etc. |

### items[].pricing

| Field | Type | Description |
|-------|------|-------------|
| `unit_price_primary` | number | Price per unit in primary currency |
| `line_total_primary` | number | Line total in primary currency |
| `unit_price_secondary` | number \| null | Price per unit in secondary currency |
| `line_total_secondary` | number \| null | Line total in secondary currency |

### items[].tax

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Tax category code (retailer-specific: "A", "B", etc.) |
| `rate` | number \| null | Tax rate as a decimal (e.g., 0.20 for 20%) |

### items[].discounts

Array of discounts applied to this line. Each discount:

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Discount description |
| `promotion_id` | string \| null | Retailer's promotion identifier |
| `amount_primary` | number | Discount amount in primary currency |
| `amount_secondary` | number \| null | Discount amount in secondary currency |

### items[].raw

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Original text from receipt |
| `adapter_parse_method` | string | How the adapter parsed this line (for debugging) |

### payments[]

| Field | Type | Description |
|-------|------|-------------|
| `method` | string | Payment method description |
| `amount_primary` | number | Amount paid in primary currency |
| `amount_secondary` | number \| null | Amount paid in secondary currency |
| `card_last_four` | string \| null | Last 4 digits of card, if applicable |

### discounts[] (receipt-level)

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Discount program name |
| `promotion_id` | string \| null | Retailer's unique promotion ID |
| `amount_primary` | number | Total discount amount |
| `amount_secondary` | number \| null | Total discount in secondary currency |
| `applied_to_lines` | number[] | Line numbers this discount applies to |

## Design principles

1. **Currency-agnostic fields**: Use `_primary`/`_secondary` suffixes rather than hardcoded currency codes in field names. The `currency` block tells you which currency each suffix maps to.
2. **Nullable for optional data**: Many real receipts lack metadata (store address, tax IDs, product IDs). Null means "not available" rather than "empty string".
3. **raw preserves fidelity**: The `raw` block and `raw_text` on items preserve the original receipt text. Tools can always fall back to raw text if structured fields are empty.
4. **No retailer-specific fields at top level**: The schema does not have `lidl_plus_discount` or `kaufland_card_payment` fields. Retailer-specific concepts are represented through the generic `discounts`, `payments`, and `raw` structures.
