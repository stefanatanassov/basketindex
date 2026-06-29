import { loadRuns, deleteRun, clearHistory } from '../lib/run-history.js';
import { getRunOutcomeSummary } from '../lib/user-feedback.js';

let runs = [];

document.addEventListener('DOMContentLoaded', async () => {
  await load();
  document.getElementById('clearAllBtn').addEventListener('click', handleClearAll);
});

async function load() {
  runs = await loadRuns();
  render();
}

function render() {
  const list = document.getElementById('runList');
  const empty = document.getElementById('emptyState');

  if (runs.length === 0) {
    list.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = runs.map(run => renderCard(run)).join('');

  // Bind buttons after render
  for (const run of runs) {
    document.getElementById(`csv-${run.runId}`)?.addEventListener('click', () => exportRunCsv(run));
    document.getElementById(`json-${run.runId}`)?.addEventListener('click', () => exportRunJson(run));
    document.getElementById(`del-${run.runId}`)?.addEventListener('click', () => handleDelete(run.runId));
  }
}

function renderCard(run) {
  const warningsHtml = (run.warnings || []).map(w =>
    `<div class="warning">${esc(w.message)}</div>`
  ).join('');

  const feedback = getRunOutcomeSummary(run);
  const retailerName = (run.retailer || 'unknown').toUpperCase();
  const dateStr = new Date(run.completedAt || run.startedAt).toLocaleString();

  return `
    <div class="run-card">
      <div class="run-header">
        <span class="run-retailer">${esc(retailerName)}</span>
        <span class="badge badge-${run.status === 'done' ? 'done' : 'error'}">${run.status}</span>
        <span class="run-date">${esc(dateStr)}</span>
      </div>
      <div class="run-outcome outcome-${feedback.level}">${esc(feedback.title)}</div>
      <div class="run-stats">
        <span>Receipts: <strong>${run.summary.receiptCount}</strong></span>
        <span>Items: <strong>${run.summary.itemCount}</strong></span>
        ${run.summary.failedCount > 0 ? `<span>Failed: <strong>${run.summary.failedCount}</strong></span>` : ''}
      </div>
      ${warningsHtml ? `<div class="warnings">${warningsHtml}</div>` : ''}
      <div class="run-actions">
        <button id="csv-${run.runId}" class="btn btn-export">Export CSV</button>
        <button id="json-${run.runId}" class="btn btn-primary">Export JSON</button>
        <button id="del-${run.runId}" class="btn btn-danger">Delete</button>
      </div>
    </div>`;
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function exportRunCsv(run) {
  const receipts = run.results || [];
  if (receipts.length === 0) return;

  const cols = [
    'receipt_id', 'receipt_date', 'receipt_time', 'retailer', 'store_code', 'store_name',
    'receipt_currency', 'secondary_currency', 'exchange_rate',
    'line_no', 'product_id', 'product_name', 'category',
    'quantity_value', 'quantity_unit',
    'unit_price_eur', 'line_total_eur',
    'unit_price_bgn', 'line_total_bgn',
    'tax_type'
  ];

  function escCsv(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  const rows = [cols.map(escCsv).join(',')];
  for (const r of receipts) {
    const src = r.source || {};
    const rec = r.receipt || {};
    const store = r.store || {};
    const cur = r.currency || {};
    for (const item of (r.items || [])) {
      const p = item.product || {};
      const q = item.quantity || {};
      const pr = item.pricing || {};
      const t = item.tax || {};
      rows.push([
        rec.id, rec.date, rec.time, src.retailer_name, store.code, store.name,
        cur.primary, cur.secondary, cur.exchange_rate,
        item.line_no, p.retailer_product_id, p.name, p.category,
        q.value, q.unit,
        pr.unit_price_eur, pr.line_total_eur,
        pr.unit_price_bgn, pr.line_total_bgn,
        t.type
      ].map(escCsv).join(','));
    }
  }

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const reader = new FileReader();
  reader.onloadend = () => {
    const b64 = reader.result.split(',')[1];
    chrome.downloads.download({
      url: `data:text/csv;base64,${b64}`,
      filename: `basketindex-run-${run.runId}.csv`,
      saveAs: true
    });
  };
  reader.readAsDataURL(blob);
}

function exportRunJson(run) {
  const data = { runId: run.runId, retailer: run.retailer, startedAt: run.startedAt, config: run.configSnapshot, summary: run.summary, receipts: run.results || [] };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const reader = new FileReader();
  reader.onloadend = () => {
    const b64 = reader.result.split(',')[1];
    chrome.downloads.download({
      url: `data:application/json;base64,${b64}`,
      filename: `basketindex-run-${run.runId}.json`,
      saveAs: true
    });
  };
  reader.readAsDataURL(blob);
}

async function handleDelete(runId) {
  if (!confirm('Delete this run? This cannot be undone.')) return;
  await deleteRun(runId);
  await load();
}

async function handleClearAll() {
  if (!confirm('Delete all extraction history? Active jobs are not affected.')) return;
  await clearHistory();
  await load();
}
