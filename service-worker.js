import { loadJob, saveJob } from './core/storage.js';
// TODO(BasketIndex Phase 4): Full adapter-driven extraction.
// The SW resolves the adapter on START and passes adapterId to the job.
// The job-manager now uses adapter.getPurchaseHistoryUrl(), adapter.getListingAction(),
// and adapter.getDetailAction() for all listing/discovery/extraction message dispatching.
// Remaining: move content script injection from static manifest declarations to
// dynamic adapter-driven injection via chrome.scripting.executeScript.
import { startJob, pauseJob, resumeJob, resetJob, tryResumeInterruptedJob } from './core/job-manager.js';
import { MESSAGE_TYPES, CONTROL_ACTIONS } from './core/messaging.js';
import { triggerJsonDownload, triggerSnapshotDownload, triggerCsvDownload } from './core/download.js';
import { failReceipt } from './core/queue.js';
import { getAdapter, resolveAdapter } from './core/adapter-registry.js';

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
          updatedAt: job.updatedAt
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
        if (!config || !listingBaseUrl) {
          sendResponse({ success: false, error: 'Config and listing base URL are required' });
          return;
        }
        const selectedAdapter = config.adapterId ? getAdapter(config.adapterId) : null;
        const resolvedAdapter = selectedAdapter || resolveAdapter(listingBaseUrl);
        if (!resolvedAdapter) {
          sendResponse({ success: false, error: 'No supported retailer adapter matched this purchase history URL' });
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
          sendResponse({ success: false, error: 'No completed receipts to export' });
          return;
        }
        triggerCsvDownload(job);
        sendResponse({ success: true, message: 'CSV export started' });
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
