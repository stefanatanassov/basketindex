// BasketIndex download/export utilities.
// Provides JSON and CSV export for normalized BasketIndex receipts.

function normalizeExportReceipts(completed) {
  return completed.map((entry) => {
    if (entry._normalized) {
      return entry._normalized;
    }
    return entry;
  });
}

function buildExportData(job) {
  const receipts = normalizeExportReceipts(job.completed);
  return {
    export_metadata: {
      schema_version: '1.0',
      job_id: job.jobId,
      exported_at: new Date().toISOString(),
      config: job.config,
      stats: job.stats,
      total_receipts: receipts.length,
      total_failed: job.finalFailures.length
    },
    receipts: receipts,
    failures: job.finalFailures
  };
}

function triggerJsonDownload(job, filename = null) {
  const data = buildExportData(job);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64 = reader.result.split(',')[1];
    const name = filename ||
      `basketindex-receipts-${job.stats.receiptsCompleted}_of_${job.stats.receiptsDiscovered}_${new Date().toISOString().slice(0, 10)}.json`;
    chrome.downloads.download({
      url: `data:application/json;base64,${base64}`,
      filename: name,
      saveAs: true
    });
  };
  reader.readAsDataURL(blob);
}

function triggerSnapshotDownload(job) {
  const snapshotName =
    `basketindex-receipts-snapshot-${job.stats.receiptsCompleted}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  triggerJsonDownload(job, snapshotName);
}

const CSV_COLUMNS = [
  'receipt_id', 'receipt_date', 'receipt_time', 'retailer', 'store_code', 'store_name',
  'currency_primary', 'currency_secondary', 'exchange_rate',
  'line_no', 'product_id', 'product_name', 'category',
  'quantity_value', 'quantity_unit',
  'unit_price_primary', 'line_total_primary',
  'unit_price_secondary', 'line_total_secondary',
  'tax_type'
];

function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function receiptsToCsvRows(receipts) {
  const rows = [];
  for (const receipt of receipts) {
    const src = receipt.source || {};
    const r = receipt.receipt || {};
    const store = receipt.store || {};
    const currency = receipt.currency || {};
    const items = receipt.items || [];

    for (const item of items) {
      const product = item.product || {};
      const qty = item.quantity || {};
      const pricing = item.pricing || {};
      const tax = item.tax || {};

      rows.push([
        r.id || '',
        r.date || '',
        r.time || '',
        src.retailer_name || '',
        store.code || '',
        store.name || '',
        currency.primary || '',
        currency.secondary || '',
        currency.exchange_rate || '',
        item.line_no || '',
        product.retailer_product_id || '',
        product.name || '',
        product.category || '',
        qty.value || '',
        qty.unit || '',
        pricing.unit_price_primary || '',
        pricing.line_total_primary || '',
        pricing.unit_price_secondary || '',
        pricing.line_total_secondary || '',
        tax.type || ''
      ].map(escapeCsvField).join(','));
    }
  }
  return rows;
}

function buildCsvContent(receipts) {
  const header = CSV_COLUMNS.map(escapeCsvField).join(',');
  const rows = receiptsToCsvRows(receipts);
  return [header, ...rows].join('\n');
}

function triggerCsvDownload(job, filename = null) {
  const receipts = normalizeExportReceipts(job.completed);
  const csv = buildCsvContent(receipts);

  if (receipts.length === 0) return;

  const blob = new Blob([csv], { type: 'text/csv' });
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64 = reader.result.split(',')[1];
    const name = filename ||
      `basketindex-receipts-${job.stats.receiptsCompleted}_of_${job.stats.receiptsDiscovered}_${new Date().toISOString().slice(0, 10)}.csv`;
    chrome.downloads.download({
      url: `data:text/csv;base64,${base64}`,
      filename: name,
      saveAs: true
    });
  };
  reader.readAsDataURL(blob);
}

export { buildExportData, triggerJsonDownload, triggerSnapshotDownload, triggerCsvDownload };
