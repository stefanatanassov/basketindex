// lib/run-history.js
// Immutable per-run persistence. Completed runs are stored as separate
// records under basketindex.runs. Active job state lives separately
// under currentJob (storage.js). Never mixed.

import { t } from './i18n-helper.js';

const RUNS_KEY = 'basketindex.runs';
const LATEST_RUN_KEY = 'basketindex.latestRunId';

async function loadRuns() {
  const result = await chrome.storage.local.get(RUNS_KEY);
  return result[RUNS_KEY] || [];
}

async function saveRuns(runs) {
  await chrome.storage.local.set({ [RUNS_KEY]: runs });
}

async function addRun(run) {
  const runs = await loadRuns();
  runs.unshift(run);
  await saveRuns(runs);
  await chrome.storage.local.set({ [LATEST_RUN_KEY]: run.runId });
}

async function getRun(runId) {
  const runs = await loadRuns();
  return runs.find(r => r.runId === runId) || null;
}

async function getLatestRun() {
  const result = await chrome.storage.local.get(LATEST_RUN_KEY);
  const latestId = result[LATEST_RUN_KEY];
  if (!latestId) return null;
  return getRun(latestId);
}

async function deleteRun(runId) {
  let runs = await loadRuns();
  runs = runs.filter(r => r.runId !== runId);
  await saveRuns(runs);
  // Update latestRunId if the deleted run was the latest
  const latest = await chrome.storage.local.get(LATEST_RUN_KEY);
  if (latest[LATEST_RUN_KEY] === runId) {
    const newLatest = runs.length > 0 ? runs[0].runId : '';
    await chrome.storage.local.set({ [LATEST_RUN_KEY]: newLatest });
  }
}

async function clearHistory() {
  await chrome.storage.local.set({ [RUNS_KEY]: [], [LATEST_RUN_KEY]: '' });
}

function makeRunId() {
  return 'run_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15) + '_' + Math.random().toString(36).slice(2, 6);
}

function buildRunRecord(job) {
  const normalized = (job.completed || []).filter(c => c._normalized).map(c => c._normalized);
  const rawReceipts = job.completed || [];
  const warnings = [];

  // Lidl page-window warning
  if (job.config.adapterId === 'lidl' && job.stats.pagesScanned >= job.config.endPage) {
    warnings.push({
      code: 'LIDL_PAGE_WINDOW_TRUNCATED',
      message: t('warningLidlPageWindow', [String(job.config.endPage)])
    });
  }

  // Partial completion warning
  const failedCount = Object.keys(job.failuresById || {}).length;
  if (failedCount > 0) {
    warnings.push({
      code: 'PARTIAL_COMPLETION',
      message: t('warningPartialCompletion', [String(failedCount)])
    });
  }

  // Item count from normalized receipts
  let itemCount = 0;
  for (const r of normalized) {
    itemCount += (r.items || []).length;
  }

  // Compute coverage from actual receipt dates
  let coverageFrom = null, coverageTo = null;
  for (const r of normalized) {
    const d = r.receipt?.date || r.receipt?.datetime_local?.slice(0, 10) || '';
    if (!d) continue;
    if (!coverageFrom || d < coverageFrom) coverageFrom = d;
    if (!coverageTo || d > coverageTo) coverageTo = d;
  }

  const derivedFromRunId = job.config.derivedFromRunId || null;
  const runType = derivedFromRunId ? 'followup' : 'snapshot';

  return {
    runId: makeRunId(),
    retailer: job.config.adapterId || 'unknown',
    status: job.status === 'completed' ? 'done' : (job.status === 'error' ? 'error' : 'partial'),
    runType,
    derivedFromRunId,
    startedAt: job.createdAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    configSnapshot: {
      adapterId: job.config.adapterId,
      startPage: job.config.startPage,
      endPage: job.config.endPage,
      fromDate: job.config.fromDate,
      toDate: job.config.toDate,
      maxRetries: job.config.maxRetries,
      recoveryRounds: job.config.recoveryRounds,
    },
    summary: {
      receiptCount: normalized.length || rawReceipts.length,
      itemCount,
      failedCount,
      warningCount: warnings.length
    },
    coverage: {
      fromDate: coverageFrom || job.config.fromDate || null,
      toDate: coverageTo || job.config.toDate || null
    },
    warnings,
    results: normalized
  };
}

export { loadRuns, addRun, getRun, getLatestRun, deleteRun, clearHistory, buildRunRecord, makeRunId };
