// core/receipt-normalizer.js
// Validates and wraps adapter-normalized receipts.
//
// Each adapter's normalizer produces a BasketIndex schema receipt.
// This module validates the output against the schema contract and
// adds any core-level metadata.
//
// See docs/receipt-schema.md for the target schema.

const REQUIRED_TOP_KEYS = [
  'schema_version',
  'source',
  'receipt',
  'store',
  'currency',
  'totals',
  'items'
];

const REQUIRED_SOURCE_KEYS = ['retailer_id', 'source_url'];
const REQUIRED_RECEIPT_KEYS = ['id'];
const REQUIRED_STORE_KEYS = ['code', 'name'];
const REQUIRED_CURRENCY_KEYS = ['primary'];
const REQUIRED_TOTALS_KEYS = ['total_primary'];
const REQUIRED_ITEM_KEYS = ['line_no', 'product', 'quantity', 'pricing'];
const REQUIRED_PRODUCT_KEYS = ['name'];
const REQUIRED_QUANTITY_KEYS = ['value', 'unit'];
const REQUIRED_PRICING_KEYS = ['unit_price_primary', 'line_total_primary'];

function validateNormalized(adapterId, normalized) {
  const errors = [];

  if (!normalized || typeof normalized !== 'object') {
    return { valid: false, errors: ['normalized receipt is not an object'] };
  }

  const checkKeys = (obj, required, path) => {
    for (const key of required) {
      if (obj[key] === undefined || obj[key] === null) {
        errors.push(`${path}.${key} is missing or null`);
      }
    }
  };

  checkKeys(normalized, REQUIRED_TOP_KEYS, 'root');

  if (normalized.schema_version !== '1.0') {
    errors.push(`root.schema_version is "${normalized.schema_version}", expected "1.0"`);
  }

  if (normalized.source) {
    checkKeys(normalized.source, REQUIRED_SOURCE_KEYS, 'source');
    if (normalized.source.retailer_id !== adapterId) {
      errors.push(`source.retailer_id "${normalized.source.retailer_id}" does not match adapter "${adapterId}"`);
    }
  }

  if (normalized.receipt) {
    checkKeys(normalized.receipt, REQUIRED_RECEIPT_KEYS, 'receipt');
  }

  if (normalized.store) {
    checkKeys(normalized.store, REQUIRED_STORE_KEYS, 'store');
  }

  if (normalized.currency) {
    checkKeys(normalized.currency, REQUIRED_CURRENCY_KEYS, 'currency');
  }

  if (normalized.totals) {
    checkKeys(normalized.totals, REQUIRED_TOTALS_KEYS, 'totals');
  }

  if (!Array.isArray(normalized.items)) {
    errors.push('items is not an array');
  } else {
    for (let i = 0; i < normalized.items.length; i++) {
      const item = normalized.items[i];
      const itemPath = `items[${i}]`;
      checkKeys(item, REQUIRED_ITEM_KEYS, itemPath);

      if (item.product) {
        checkKeys(item.product, REQUIRED_PRODUCT_KEYS, `${itemPath}.product`);
      }
      if (item.quantity) {
        checkKeys(item.quantity, REQUIRED_QUANTITY_KEYS, `${itemPath}.quantity`);
      }
      if (item.pricing) {
        checkKeys(item.pricing, REQUIRED_PRICING_KEYS, `${itemPath}.pricing`);
      }

      if (item.pricing && item.quantity && item.quantity.value > 0) {
        const expectedTotal = Math.round(item.pricing.unit_price_primary * item.quantity.value * 100) / 100;
        const actualTotal = Math.round(item.pricing.line_total_primary * 100) / 100;
        if (Math.abs(expectedTotal - actualTotal) > 0.05) {
          errors.push(`${itemPath}: line_total_primary ${actualTotal} != unit_price_primary ${item.pricing.unit_price_primary} × quantity ${item.quantity.value} = ${expectedTotal}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function normalizeAndValidate(adapter, rawReceipt) {
  let normalized;
  try {
    normalized = adapter.normalizeReceipt(rawReceipt);
  } catch (err) {
    return { success: false, error: `Adapter normalization threw: ${err.message}`, raw: rawReceipt };
  }

  const validation = validateNormalized(adapter.id, normalized);

  if (!validation.valid) {
    return {
      success: false,
      error: `Normalization validation failed: ${validation.errors.join('; ')}`,
      normalized: normalized,
      raw: rawReceipt,
      validation_errors: validation.errors
    };
  }

  return {
    success: true,
    normalized: normalized,
    raw: rawReceipt
  };
}

export { normalizeAndValidate, validateNormalized };
