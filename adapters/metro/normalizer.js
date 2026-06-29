// adapters/metro/normalizer.js
// Maps Metro invoice + article JSON to BasketIndex normalized receipt schema.

function inferUnit(article) {
  if (article.weightItem) return 'kg';
  if (article.pieceNetWeight && article.pieceNetWeight > 0) return 'kg';
  return 'pcs';
}

function buildDiscount(article) {
  const gross = article.itemColliGrossAmount;
  const discounted = article.itemColliPriceGrossDiscounted;
  if (gross && discounted && gross !== discounted && discounted > 0) {
    const diff = Math.round((gross - discounted) * (article.quantity || 1) * 100) / 100;
    if (diff > 0) {
      return [{
        description: 'Item discount',
        promotion_id: null,
        amount_primary: diff,
        amount_secondary: null,
        applied_to_lines: [article.invoiceLineSequenceNumber]
      }];
    }
  }
  return [];
}

function normalizeReceipt(invoice, articles) {
  const items = (articles || []).map((art) => ({
    line_no: art.invoiceLineSequenceNumber,
    product: {
      retailer_product_id: String(art.itemNumber || ''),
      name: art.description || '',
      category: null
    },
    quantity: {
      value: art.quantity || 1,
      unit: inferUnit(art)
    },
    pricing: {
      unit_price_primary: art.itemColliGrossAmount || (art.quantity > 0 ? Math.round(art.totalAmount / art.quantity * 100) / 100 : art.totalAmount),
      line_total_primary: art.totalAmount,
      unit_price_secondary: null,
      line_total_secondary: null,
      unit_price_eur: art.itemColliGrossAmount || (art.quantity > 0 ? Math.round(art.totalAmount / art.quantity * 100) / 100 : art.totalAmount),
      line_total_eur: art.totalAmount,
      unit_price_bgn: null,
      line_total_bgn: null
    },
    tax: {
      type: art.packagePrintCode || '',
      rate: null
    },
    discounts: buildDiscount(art),
    raw: {
      text: art.description || '',
      adapter_parse_method: 'metro_api'
    }
  }));

  const discountTotal = items.reduce((sum, item) => {
    return sum + item.discounts.reduce((s, d) => s + (d.amount_primary || 0), 0);
  }, 0);

  return {
    schema_version: '1.0',
    import_metadata: {
      imported_at: new Date().toISOString(),
      importer: 'basketindex-extension',
      importer_version: '0.1.0',
      adapter_id: 'metro',
      adapter_version: '0.1.0'
    },
    source: {
      retailer_id: 'metro',
      retailer_name: 'METRO',
      country: 'BG',
      country_name: 'Bulgaria',
      source_url: `https://docs.metro.bg/` // no per-invoice stable URL
    },
    receipt: {
      id: invoice.transactionId || invoice.invoiceNumber || '',
      date: (invoice.invoiceDate || '').slice(0, 10),
      time: (invoice.invoiceDate || '').slice(11, 19),
      datetime_local: invoice.invoiceDate || ''
    },
    store: {
      code: String(invoice.customerStoreId || ''),
      name: 'METRO',
      address: null,
      tax_id: null,
      company_id: null
    },
    currency: {
      primary: invoice.currency || 'EUR',
      secondary: null,
      exchange_rate: null,
      exchange_rate_source: null
    },
    totals: {
      subtotal_primary: invoice.netAmount || null,
      subtotal_secondary: null,
      total_primary: invoice.totalAmount,
      total_secondary: null,
      discount_total_primary: discountTotal || 0,
      discount_total_secondary: null
    },
    items,
    payments: [],
    discounts: []
  };
}

export { normalizeReceipt };
