import { loadRuns, deleteRun, clearHistory } from '../lib/run-history.js';
import { t } from '../lib/i18n-helper.js';
import { CONTROL_ACTIONS, MESSAGE_TYPES } from '../lib/messaging.js';

let runs = [];

document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  await load();
  document.getElementById('clearAllBtn').addEventListener('click', handleClearAll);
  document.getElementById('trendsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('trends/trends.html') });
  });
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

  for (const run of runs) {
    document.getElementById(`csv-${run.runId}`)?.addEventListener('click', () => exportRunCsv(run));
    document.getElementById(`json-${run.runId}`)?.addEventListener('click', () => exportRunJson(run));
    document.getElementById(`del-${run.runId}`)?.addEventListener('click', () => handleDelete(run.runId));
    document.getElementById(`followup-${run.runId}`)?.addEventListener('click', () => handleFollowup(run));
  }
}

// Set localized HTML content on load
function applyI18n() {
  document.title = t('historyTitle');
  document.querySelector('.subtitle').textContent = t('historySubtitle');
  document.getElementById('clearAllBtn').textContent = t('historyClearAll');
  document.querySelector('#emptyState p:first-child').textContent = t('historyEmpty');
  document.querySelector('#emptyState p:last-child').textContent = t('historyEmptyHint');
}

function renderCard(run) {
  const retailerName = t('retailer' + (run.retailer || 'unknown').charAt(0).toUpperCase() + (run.retailer || 'unknown').slice(1)) || (run.retailer || 'unknown').toUpperCase();
  const dateStr = new Date(run.completedAt || run.startedAt).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });

  // Status badge
  let statusLabel, statusClass;
  if (run.status === 'info') {
    statusLabel = t('historyNoNewData') || 'Без нови';
    statusClass = 'badge-info';
  } else if (run.status === 'done') {
    statusLabel = t('runStatusDone');
    statusClass = 'badge-done';
  } else {
    statusLabel = t('runStatusError');
    statusClass = 'badge-error';
  }

  // Outcome / type / dedup line
  let sublineParts = [];

  if (run.runType === 'followup') {
    const fm = run.followupMeta || {};
    if (run.status === 'info') {
      sublineParts.push(t('historyFollowup') + t('historyNoNewReceipts'));
    } else if (fm.hasNewReceipts) {
      sublineParts.push(t('historyFollowup'));
      sublineParts.push(`добавени: ${fm.addedReceiptCount || 0}`);
      if (fm.duplicateReceiptCount > 0) sublineParts.push(`дубликати: ${fm.duplicateReceiptCount}`);
    } else {
      sublineParts.push(t('historyFollowup'));
    }

    // Parent reference: compact inline
    if (run.derivedFromRunId) {
      const parentRun = runs.find(r => r.runId === run.derivedFromRunId);
      if (parentRun) {
        const parentDate = new Date(parentRun.completedAt || parentRun.startedAt).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' });
        sublineParts.push(`от ${parentDate}`);
      }
    }
  } else {
    // Snapshot: show coverage
    const cov = run.coverage || {};
    if (cov.fromDate && cov.toDate) {
      sublineParts.push(`${cov.fromDate} → ${cov.toDate}`);
    }
  }

  const sublineHtml = sublineParts.length ? `<div class="run-subline">${sublineParts.join(' · ')}</div>` : '';

  // Stats: compact
  const hasDedup = run.followupMeta && run.followupMeta.addedReceiptCount != null;
  const showReceipts = hasDedup ? run.followupMeta.addedReceiptCount : run.summary.receiptCount;

  // Warnings: only if non-zero
  const warningsHtml = run.summary.warningCount > 0 && run.warnings && run.warnings.length > 0
    ? `<div class="warnings">${run.warnings.map(w => `<div class="warning">${esc(w.message)}</div>`).join('')}</div>`
    : '';

  // Follow-up button: only on the latest run per retailer (not on follow-ups)
  const isLatest = isLatestRunForRetailer(run);
  const showFollowup = !run.derivedFromRunId && run.status === 'done' && isLatest;

  return `
    <div class="run-card">
      <div class="run-header">
        <span class="run-retailer">${esc(retailerName)}</span>
        <span class="badge ${statusClass}">${esc(statusLabel)}</span>
        <span class="run-date">${dateStr}</span>
      </div>
      ${sublineHtml}
      <div class="run-stats">
        <span>${t('historyReceipts')}: <strong>${showReceipts}</strong></span>
        <span>${t('historyItems')}: <strong>${run.summary.itemCount}</strong></span>
      </div>
      ${warningsHtml}
      <div class="run-actions">
        ${showFollowup ? `<button id="followup-${run.runId}" class="btn btn-followup">${t('historyFollowupAction')}</button>` : ''}
        <button id="csv-${run.runId}" class="btn btn-export">${t('historyCsv')}</button>
        <button id="json-${run.runId}" class="btn btn-primary">${t('historyJson')}</button>
        <button id="del-${run.runId}" class="btn btn-danger">${t('historyDelete')}</button>
      </div>
    </div>`;
}

function isLatestRunForRetailer(run) {
  const snapshots = runs.filter(r => r.retailer === run.retailer && !r.derivedFromRunId && r.status === 'done');
  if (snapshots.length === 0) return false;
  const latest = snapshots.reduce((a, b) =>
    new Date(a.completedAt || a.startedAt) > new Date(b.completedAt || b.startedAt) ? a : b
  );
  return latest.runId === run.runId;
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
  if (!confirm(t('historyConfirmDelete'))) return;
  await deleteRun(runId);
  await load();
}

async function handleClearAll() {
  if (!confirm(t('historyConfirmClearAll'))) return;
  await clearHistory();
  await load();
}

async function handleFollowup(run) {
  try {
    const resp = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.JOB_CONTROL,
      action: CONTROL_ACTIONS.FOLLOWUP,
      runId: run.runId
    });
    if (resp && resp.success) {
      chrome.action.openPopup();
    } else {
      alert(resp?.error || 'Неуспешно стартиране на последващо извличане.');
    }
  } catch (err) {
    alert('Грешка при стартиране: ' + err.message);
  }
}
