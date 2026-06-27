// adapters/lidl/normalizer.js
// Maps a raw Lidl receipt (from detail-extractor.js) to the BasketIndex
// normalized receipt schema defined in docs/receipt-schema.md.
//
// See core/receipt-normalizer.js for the validation layer that calls this.

const LIDL_ADAPTER_VERSION = '0.1.0';

function convertToBgn(eurValue, exchangeRate) {
  if (!exchangeRate || !eurValue) return eurValue;
  return Math.round(eurValue * exchangeRate * 100) / 100;
}

function extractCardLastFour(rawLines) {
  for (const line of rawLines) {
    const m = line.match(/[X*]{4,}-[X*]{4,}-[X*]{4,}-(\d{4})/);
    if (m) return m[1];
  }
  return null;
}

function parsePaymentMethod(rawLines, totals) {
  let method = '';
  for (const line of rawLines) {
    if (line.match(/КРЕДИТНА|ДЕБИТНА|VISA|MASTERCARD|MAESTRO|CARD|КАРТА/i)) {
      method = line.trim();
      break;
    }
  }
  if (!method && totals.tender_label) {
    method = totals.tender_label;
  }
  return method || 'Unknown';
}

function extractCountry(sourceUrl) {
  try {
    const host = new URL(sourceUrl).hostname;
    const parts = host.split('.');
    const tld = parts[parts.length - 1];
    if (tld.length === 2) return tld.toUpperCase();
  } catch (_) {}
  return 'BG';
}

const COUNTRY_NAMES = {
  BG: 'Bulgaria', DE: 'Germany', RO: 'Romania', GR: 'Greece',
  FR: 'France', IT: 'Italy', ES: 'Spain', PT: 'Portugal',
  NL: 'Netherlands', PL: 'Poland', CZ: 'Czech Republic',
  SK: 'Slovakia', HU: 'Hungary', AT: 'Austria',
  LT: 'Lithuania', LV: 'Latvia', EE: 'Estonia',
  FI: 'Finland', SE: 'Sweden', DK: 'Denmark', NO: 'Norway',
  SI: 'Slovenia', HR: 'Croatia', RS: 'Serbia',
  IE: 'Ireland', UK: 'United Kingdom'
};

function normalizeReceipt(raw) {
  const country = extractCountry(raw.source_url || '');
  const isEur = raw.currency_item === 'EUR';
  const er = raw.exchange_rate || null;

  const items = (raw.items || []).map((item) => ({
    line_no: item.line_no,
    product: {
      retailer_product_id: item.article_id || '',
      name: item.name || '',
      category: null
    },
    quantity: {
      value: item.quantity || 1,
      unit: item.quantity_unit || 'pcs'
    },
    pricing: {
      unit_price_primary: isEur ? (item.unit_price_eur || item.unit_price_bgn) : item.unit_price_bgn,
      line_total_primary: isEur ? (item.line_total_eur || item.line_total_bgn) : item.line_total_bgn,
      unit_price_secondary: isEur ? item.unit_price_bgn : null,
      line_total_secondary: isEur ? item.line_total_bgn : null
    },
    tax: {
      type: item.tax_type || '',
      rate: null
    },
    discounts: [],
    raw: {
      text: item.raw_text || '',
      adapter_parse_method: item.parse_method || 'unknown'
    }
  }));

  const tenderLines = (raw.raw_sections && raw.raw_sections.tender_lines) || [];
  const cardLastFour = extractCardLastFour(tenderLines);
  const payMethod = parsePaymentMethod(tenderLines, raw.totals || {});

  const payments = [{
    method: payMethod,
    amount_primary: raw.totals
      ? (isEur ? raw.totals.tender_total_eur || raw.totals.sum_eur : raw.totals.tender_total_bgn || raw.totals.sum_bgn)
      : 0,
    amount_secondary: raw.totals
      ? (isEur ? raw.totals.tender_total_bgn : null)
      : null,
    card_last_four: cardLastFour
  }];

  const discounts = [];
  if (raw.discounts && Array.isArray(raw.discounts)) {
    for (const d of raw.discounts) {
      discounts.push({
        description: d.description || '',
        promotion_id: d.promotion_id || null,
        amount_primary: isEur ? d.amount : null,
        amount_secondary: isEur ? convertToBgn(d.amount, er) : d.amount,
        applied_to_lines: []
      });
    }
  }

  const totals = raw.totals || {};
  const primaryTotal = isEur ? (totals.sum_eur || totals.sum) : (totals.sum_bgn || totals.sum);
  const secondaryTotal = isEur ? totals.sum_bgn : null;
  const discountTotalPrimary = Math.round(discounts.reduce((acc, d) => acc + (d.amount_primary || 0), 0) * 100) / 100;
  const discountTotalSecondary = discounts.some(d => d.amount_secondary != null)
    ? Math.round(discounts.reduce((acc, d) => acc + (d.amount_secondary || 0), 0) * 100) / 100
    : null;

  return {
    schema_version: '1.0',
    import_metadata: {
      imported_at: new Date().toISOString(),
      importer: 'basketindex-extension',
      importer_version: '0.1.0',
      adapter_id: 'lidl',
      adapter_version: LIDL_ADAPTER_VERSION
    },
    source: {
      retailer_id: 'lidl',
      retailer_name: 'Lidl',
      country: country,
      country_name: COUNTRY_NAMES[country] || country,
      source_url: raw.source_url || ''
    },
    receipt: {
      id: raw.receipt_id || '',
      date: raw.date || '',
      time: raw.time || '',
      datetime_local: raw.datetime_local || ''
    },
    store: {
      code: (raw.store && raw.store.code) || '',
      name: (raw.store && raw.store.name) || '',
      address: (raw.store && raw.store.address) || '',
      tax_id: (raw.store && raw.store.vat_number) || '',
      company_id: (raw.store && raw.store.bulstat) || ''
    },
    currency: {
      primary: isEur ? 'EUR' : 'BGN',
      secondary: isEur ? 'BGN' : null,
      exchange_rate: er,
      exchange_rate_source: er ? 'receipt' : null
    },
    totals: {
      subtotal_primary: primaryTotal,
      subtotal_secondary: secondaryTotal,
      total_primary: primaryTotal,
      total_secondary: secondaryTotal,
      discount_total_primary: discountTotalPrimary || 0,
      discount_total_secondary: discountTotalSecondary || null
    },
    items: items,
    payments: payments,
    discounts: discounts
  };
}

export { normalizeReceipt };
