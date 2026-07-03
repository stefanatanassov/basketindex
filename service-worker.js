import { loadJob, saveJob } from './core/storage.js';
// The SW resolves the adapter on START and passes adapterId to the job.
// The job-manager uses adapter.getPurchaseHistoryUrl(), adapter.getListingAction(),
// and adapter.getDetailAction() for all listing/discovery/extraction message dispatching.
// Content scripts are injected via manifest-declared content_scripts — no dynamic
// injection required. Metro uses API-based extraction through token relay.
import { startJob, pauseJob, resumeJob, resetJob, tryResumeInterruptedJob } from './core/job-manager.js';
import { MESSAGE_TYPES, CONTROL_ACTIONS } from './core/messaging.js';
import { triggerJsonDownload, triggerSnapshotDownload, triggerCsvDownload } from './core/download.js';
import { failReceipt } from './core/queue.js';
import { getAdapter, resolveAdapter } from './core/adapter-registry.js';
import { getLatestRun } from './lib/run-history.js';
import { loadRuns } from './lib/run-history.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('BasketIndex installed');
});

chrome.runtime.onStartup.addListener(() => {
  tryResumeInterruptedJob();
});

(function init() {
  tryResumeInterruptedJob();
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;

  handlePopupMessage(message, sendResponse);
  return true;
});

async function handlePopupMessage(message, sendResponse) {
  const { type, action, config, listingBaseUrl } = message;

  if (type === MESSAGE_TYPES.JOB_REQUEST) {
    const job = await loadJob();
    if (job) {
      sendResponse({
        summary: {
          jobId: job.jobId,
          status: job.status,
          phase: job.phase,
          config: job.config,
          stats: job.stats,
          queueSize: job.queue.length,
          inFlightCount: job.inFlight.length,
          completedCount: job.completedIds.length,
          failuresCount: Object.keys(job.failuresById).length,
          finalFailures: job.finalFailures.length,
          pagesScanned: job.stats.pagesScanned,
          totalPages: job.stats.totalPages,
          recoveryRound: job.stats.recoveryRound,
          recoveryRounds: job.config.recoveryRounds,
          updatedAt: job.updatedAt,
          listingTabId: job.listingTabId || null,
          adapterId: job.config?.adapterId || null,
          lastError: job._lastError || null
        }
      });
      return;
    }
    sendResponse({ summary: { status: 'idle', phase: 'done' } });
    return;
  }

  if (type === MESSAGE_TYPES.JOB_CONTROL) {
    switch (action) {
      case CONTROL_ACTIONS.START: {
        if (!config) {
          sendResponse({ success: false, error: 'Config is required' });
          return;
        }
        const selectedAdapter = config.adapterId ? getAdapter(config.adapterId) : null;
        const resolvedAdapter = selectedAdapter || (listingBaseUrl ? resolveAdapter(listingBaseUrl) : null);
        if (!resolvedAdapter) {
          sendResponse({ success: false, error: 'No supported retailer adapter matched' });
          return;
        }
        if (!listingBaseUrl && resolvedAdapter.id !== 'metro') {
          sendResponse({ success: false, error: 'Listing URL is required for this retailer' });
          return;
        }
        const existing = await loadJob();
        if (existing && existing.status === 'running') {
          sendResponse({ success: false, error: 'A job is already running. Pause or reset it first.' });
          return;
        }
        await startJob({ ...config, adapterId: resolvedAdapter.id }, listingBaseUrl);
        const job = await loadJob();
        sendResponse({ success: true, summary: {
          adapterId: job.config.adapterId,
          status: job.status, phase: job.phase,
          stats: job.stats,
          queueSize: job.queue.length,
          inFlightCount: job.inFlight.length,
          completedCount: job.completedIds.length,
          failuresCount: Object.keys(job.failuresById).length,
          finalFailures: job.finalFailures.length,
          pagesScanned: job.stats.pagesScanned,
          totalPages: job.stats.totalPages,
          recoveryRound: job.stats.recoveryRound,
          recoveryRounds: job.config.recoveryRounds
        }});
        return;
      }

      case CONTROL_ACTIONS.PAUSE: {
        const job = await loadJob();
        if (!job || job.status !== 'running') {
          sendResponse({ success: false, error: 'No running job to pause' });
          return;
        }
        await pauseJob(job);
        sendResponse({ success: true, summary: { status: 'paused', phase: job.phase } });
        return;
      }

      case CONTROL_ACTIONS.RESUME: {
        const job = await loadJob();
        if (!job || job.status !== 'paused') {
          sendResponse({ success: false, error: 'No paused job to resume' });
          return;
        }
        await resumeJob(job);
        sendResponse({ success: true, summary: { status: 'running', phase: job.phase } });
        return;
      }

      case CONTROL_ACTIONS.RESET: {
        await resetJob();
        sendResponse({ success: true, summary: { status: 'idle', phase: 'done' } });
        return;
      }

      case CONTROL_ACTIONS.EXPORT: {
        const job = await loadJob();
        if (!job || job.completed.length === 0) {
          sendResponse({ success: false, error: 'No completed receipts to export. If the job shows "completed" but has 0 receipts, try reducing the page range and starting again.' });
          return;
        }
        triggerJsonDownload(job);
        sendResponse({ success: true, message: 'Export started' });
        return;
      }

      case CONTROL_ACTIONS.SNAPSHOT: {
        const job = await loadJob();
        if (!job || job.completed.length === 0) {
          sendResponse({ success: false, error: 'No receipts to snapshot' });
          return;
        }
        triggerSnapshotDownload(job);
        sendResponse({ success: true, message: 'Snapshot export started' });
        return;
      }

      case CONTROL_ACTIONS.EXPORT_CSV: {
        const job = await loadJob();
        if (!job || job.completed.length === 0) {
          sendResponse({ success: false, error: 'No completed receipts to export. If the job shows completed with 0 receipts, try reducing the page range.' });
          return;
        }
        if (!job.completed.some(c => c._normalized)) {
          sendResponse({ success: false, error: 'Normalized receipt data not available. Re-run the export to regenerate receipts in the current format.' });
          return;
        }
        triggerCsvDownload(job);
        sendResponse({ success: true, message: 'CSV export started' });
        return;
      }

      case CONTROL_ACTIONS.FOLLOWUP: {
        const { runId } = message;
        if (!runId) {
          sendResponse({ success: false, error: 'Run ID is required for follow-up' });
          return;
        }
        const runs = await loadRuns();
        const baseRun = runs.find(r => r.runId === runId);
        if (!baseRun) {
          sendResponse({ success: false, error: 'Base run not found' });
          return;
        }

        const retailer = baseRun.retailer;
        const cov = baseRun.coverage || {};
        const today = new Date().toISOString().slice(0, 10);
        const fromDate = cov.toDate || baseRun.configSnapshot?.toDate || today;

        const followupConfig = {
          adapterId: retailer,
          derivedFromRunId: runId,
          startPage: 1,
          endPage: 50,
          workerCount: 2,
          maxRetries: 3,
          recoveryRounds: 3
        };

        if (retailer === 'lidl') {
          followupConfig.startPage = baseRun.configSnapshot?.startPage || 1;
          followupConfig.endPage = baseRun.configSnapshot?.endPage || 50;
        } else if (retailer === 'metro') {
          followupConfig.fromDate = fromDate;
          followupConfig.toDate = today;
        }

        const listingUrl = retailer === 'metro' ? 'https://docs.metro.bg/'
          : retailer === 'lidl' ? 'https://www.lidl.bg/mre/purchase-history' : '';

        const existing = await loadJob();
        if (existing && existing.status === 'running') {
          sendResponse({ success: false, error: 'A job is already running. Pause or reset it first.' });
          return;
        }

        await startJob(followupConfig, listingUrl);
        const job = await loadJob();
        sendResponse({ success: true, summary: {
          adapterId: job.config.adapterId,
          status: job.status, phase: job.phase,
          stats: job.stats,
          queueSize: job.queue.length,
          inFlightCount: job.inFlight.length,
          completedCount: job.completedIds.length,
          failuresCount: Object.keys(job.failuresById).length,
          finalFailures: job.finalFailures.length,
          pagesScanned: job.stats.pagesScanned,
          totalPages: job.stats.totalPages,
          recoveryRound: job.stats.recoveryRound,
          recoveryRounds: job.config.recoveryRounds
        }});
        return;
      }

      default:
        sendResponse({ success: false, error: `Unknown action: ${action}` });
        return;
    }
  }

  sendResponse({ success: false, error: 'Unknown message type' });
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const job = await loadJob();
  if (!job) return;

  let modified = false;

  if (job.listingTabId === tabId) {
    job.listingTabId = null;
    modified = true;
  }

  const workerIdx = job.workers.findIndex(w => w.tabId === tabId);
  if (workerIdx >= 0) {
    const worker = job.workers[workerIdx];
    if (worker.taskId) {
      failReceipt(job, worker.taskId, 'Worker tab closed', job.config.maxRetries);
      job.inFlight = job.inFlight.filter(id => id !== worker.taskId);
    }
    job.workers.splice(workerIdx, 1);
    modified = true;
  }

  if (modified) {
    await saveJob(job);
  }
});
