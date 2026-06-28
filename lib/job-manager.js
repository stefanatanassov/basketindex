import { loadJob, saveJob, initJob } from './storage.js';
import { enqueue, dequeue, completeReceipt, failReceipt, hasPendingWork, prepareRecoveryRound, requeueInFlight, checkFinalFailures } from './queue.js';
import { TAB_TYPES, createTab, navigateTab, closeTab, waitForTabLoad, getAvailableWorker, markWorkerActive, markWorkerIdle, getStaleWorkers, removeWorker, createWorkerEntry } from './tab-manager.js';
import { MESSAGE_TYPES, sendToTab } from './messaging.js';
import { getAdapter } from '../core/adapter-registry.js';
import { normalizeAndValidate } from '../core/receipt-normalizer.js';

let jobRunTimer = null;

function resolveAdapter(job) {
  if (!job || !job.config || !job.config.adapterId) return null;
  return getAdapter(job.config.adapterId);
}

async function startJob(config, listingBaseUrl) {
  let job = initJob(config, listingBaseUrl);
  job.stats.totalPages = config.endPage - config.startPage + 1;
  job.listingTabId = null;
  await saveJob(job);
  await clearAllWorkerTabs(job);
  await setupWorkerTabs(job);
  runLoop();
}

async function pauseJob(job) {
  job.status = 'paused';
  await saveJob(job);
}

async function resumeJob(job) {
  if (job.status !== 'paused') return;
  job.status = 'running';
  await saveJob(job);
  await recoverWorkersAfterRestart(job);
  runLoop();
}

async function resetJob() {
  const job = await loadJob();
  if (job) {
    await clearAllWorkerTabs(job);
  }
  await chrome.storage.local.remove('currentJob');
}

async function clearAllWorkerTabs(job) {
  for (const worker of job.workers) {
    try { await closeTab(worker.tabId); } catch (_) {}
  }
  job.workers = [];
  if (job.listingTabId) {
    try { await closeTab(job.listingTabId); } catch (_) {}
    job.listingTabId = null;
  }
  await saveJob(job);
}

async function setupWorkerTabs(job) {
  const count = job.config.workerCount;
  for (let i = 0; i < count; i++) {
    const tab = await createTab('about:blank', TAB_TYPES.worker);
    job.workers.push(createWorkerEntry(tab.id, TAB_TYPES.worker));
  }
  await saveJob(job);
}

async function ensureWorkers(job) {
  const activeWorkers = job.workers.filter(w => w.type !== TAB_TYPES.listing && w.status !== 'stale');
  const need = job.config.workerCount - activeWorkers.length;
  for (let i = 0; i < need; i++) {
    try {
      const tab = await createTab('about:blank', TAB_TYPES.worker);
      job.workers.push(createWorkerEntry(tab.id, TAB_TYPES.worker));
    } catch (_) {}
  }
  await saveJob(job);
}

async function recoverWorkersAfterRestart(job) {
  if (!job.listingTabId) return;
  try { await chrome.tabs.get(job.listingTabId); } catch (_) {
    job.listingTabId = null;
  }

  const validWorkers = [];
  for (const worker of job.workers) {
    if (worker.type === TAB_TYPES.listing) continue;
    try {
      await chrome.tabs.get(worker.tabId);
      validWorkers.push(worker);
    } catch (_) {
      if (worker.taskId) {
        job.inFlight = job.inFlight.filter(id => id !== worker.taskId);
      }
    }
  }
  job.workers = validWorkers;

  if (job.inFlight.length > 0) {
    requeueInFlight(job);
  }

  await ensureWorkers(job);
}

async function tryResumeInterruptedJob() {
  const job = await loadJob();
  if (!job || job.status !== 'running') return;
  await recoverWorkersAfterRestart(job);
  runLoop();
}

function runLoop() {
  if (jobRunTimer) clearTimeout(jobRunTimer);
  jobRunTimer = setTimeout(tick, 200);
}

async function tick() {
  const job = await loadJob();
  if (!job || job.status === 'paused' || job.status === 'completed' || job.status === 'error') {
    jobRunTimer = null;
    return;
  }

  try {
    switch (job.phase) {
      case 'discover':
        await doDiscover(job);
        break;
      case 'process':
        await doProcess(job);
        break;
      case 'recovery':
        await doRecovery(job);
        break;
      case 'done':
        await finalizeJob(job);
        jobRunTimer = null;
        return;
    }
  } catch (err) {
    console.error('Job tick error:', err);
    job.status = 'error';
    try { await saveJob(job); } catch (_) {}
    jobRunTimer = null;
    return;
  }

  jobRunTimer = setTimeout(tick, 300);
}

async function doDiscover(job) {
  const page = job.currentDiscoveryPage;
  const endPage = job.config.endPage;
  const adapter = resolveAdapter(job);

  if (page > endPage) {
    job.phase = 'process';
    job.stats.pagesScanned = job.pagesDiscovered.length;
    await ensureWorkers(job);
    await saveJob(job);
    return;
  }

  const listingUrl = adapter
    ? adapter.getPurchaseHistoryUrl(job.listingBaseUrl, page)
    : buildListingUrlFallback(job.listingBaseUrl, page);

  const listingTabId = job.listingTabId;
  if (!listingTabId) {
    const listingTab = await createTab(listingUrl, TAB_TYPES.listing);
    job.listingTabId = listingTab.id;
    job.workers.push(createWorkerEntry(listingTab.id, TAB_TYPES.listing));
    await saveJob(job);
    await waitForTabLoad(job.listingTabId, 15000);
  } else {
    try {
      await chrome.tabs.get(listingTabId);
      await navigateTab(listingTabId, listingUrl);
      await waitForTabLoad(listingTabId, 15000);
    } catch (_) {
      job.listingTabId = null;
      const listingTab = await createTab(listingUrl, TAB_TYPES.listing);
      job.listingTabId = listingTab.id;
      job.workers.push(createWorkerEntry(listingTab.id, TAB_TYPES.listing));
      await saveJob(job);
      await waitForTabLoad(job.listingTabId, 15000);
    }
  }

  await new Promise(r => setTimeout(r, 1000));

  const listingAction = adapter ? adapter.getListingAction() : MESSAGE_TYPES.EXTRACT_LISTING;
  const result = await Promise.race([
    sendToTab(job.listingTabId, { type: listingAction }),
    new Promise(r => setTimeout(() => r({ success: false, error: 'Listing extraction timed out' }), 25000))
  ]);

  if (result && result.success) {
    const pageEntry = {
      page,
      url: listingUrl,
      receiptCount: result.receiptCount,
      receipts: result.receipts,
      scannedAt: new Date().toISOString()
    };
    job.pagesDiscovered.push(pageEntry);

    if (result.receiptCount === 0) {
      job.currentDiscoveryPage = endPage + 1;
      job.phase = 'process';
      job.stats.pagesScanned = job.pagesDiscovered.length;
      await saveJob(job);
      return;
    }

    enqueue(job, result.receipts);
    job.currentDiscoveryPage = page + 1;
    job.stats.pagesScanned = job.pagesDiscovered.length;
    await saveJob(job);
  } else {
    job.pagesDiscovered.push({
      page,
      url: listingUrl,
      receiptCount: 0,
      receipts: [],
      error: result ? result.error : 'No response from listing extractor',
      scannedAt: new Date().toISOString()
    });
    job.currentDiscoveryPage = page + 1;
    await saveJob(job);
  }
}

async function doProcess(job) {
  if (!hasPendingWork(job) && job.inFlight.length === 0) {
    job.stats.recoveryRound = 1;
    const count = prepareRecoveryRound(job);
    if (count === 0) {
      job.phase = 'done';
    } else {
      job.phase = 'recovery';
    }
    await saveJob(job);
    return;
  }

  await handleStaleWorkers(job);

  if (job.queue.length === 0) return;

  const worker = getAvailableWorker(job);
  if (!worker) return;

  const task = dequeue(job);
  if (!task) return;

  markWorkerActive(job, worker.id, task.receipt_id);
  await saveJob(job);

  await navigateTab(worker.tabId, task.url);
  const loaded = await waitForTabLoad(worker.tabId, 20000);

  if (!loaded) {
    markWorkerIdle(job, worker.id);
    failReceipt(job, task.receipt_id, 'Tab load timeout', job.config.maxRetries);
    await saveJob(job);
    return;
  }

  await new Promise(r => setTimeout(r, 1500));

  const adapter = resolveAdapter(job);
  const detailAction = adapter ? adapter.getDetailAction() : MESSAGE_TYPES.EXTRACT_DETAIL;
  const result = await Promise.race([
    sendToTab(worker.tabId, {
      type: detailAction,
      receiptId: task.receipt_id
    }),
    new Promise(r => setTimeout(() => r({ success: false, error: 'Extraction timed out' }), 30000))
  ]);

  markWorkerIdle(job, worker.id);

  if (result && result.success) {
    if (adapter) {
      const normResult = normalizeAndValidate(adapter, result);
      if (normResult.success) {
        result._normalized = normResult.normalized;
      } else {
        console.warn('Normalization warning:', normResult.error);
        result._normalized = null;
        result._normalization_error = normResult.error;
      }
    }
    completeReceipt(job, task.receipt_id, result);
  } else {
    const errorMsg = result ? result.error : 'No response from detail extractor';
    failReceipt(job, task.receipt_id, errorMsg, job.config.maxRetries);
  }

  await saveJob(job);
}

async function doRecovery(job) {
  if (job.stats.recoveryRound > job.config.recoveryRounds) {
    job.phase = 'done';
    await saveJob(job);
    return;
  }

  if (!hasPendingWork(job) && job.inFlight.length === 0) {
    job.stats.recoveryRound++;
    const newItems = prepareRecoveryRound(job);
    if (newItems === 0) {
      job.phase = 'done';
    }
    await saveJob(job);
    return;
  }

  await doProcess(job);
}

async function handleStaleWorkers(job) {
  const stale = getStaleWorkers(job, 35000);
  for (const worker of stale) {
    if (worker.taskId) {
      failReceipt(job, worker.taskId, 'Worker became stale', job.config.maxRetries);
      job.inFlight = job.inFlight.filter(id => id !== worker.taskId);
    }
    removeWorker(job, worker.tabId);
    try { await closeTab(worker.tabId); } catch (_) {}
  }
  if (stale.length > 0) {
    await saveJob(job);
    await ensureWorkers(job);
  }
}

async function finalizeJob(job) {
  job.status = 'completed';
  job.phase = 'done';
  checkFinalFailures(job, job.config.maxRetries);
  try {
    await saveJob(job);
  } catch (err) {
    console.error('Failed to save completed job:', err.message);
  }
  notifyPopup(job);
}

async function notifyPopup(job) {
  try {
    const msg = {
      type: MESSAGE_TYPES.PROGRESS_UPDATE,
      summary: {
        status: job.status,
        phase: job.phase,
        queueSize: job.queue.length,
        inFlightCount: job.inFlight.length,
        completedCount: job.completedIds.length,
        failuresCount: Object.keys(job.failuresById).length,
        finalFailures: job.finalFailures.length,
        pagesScanned: job.stats.pagesScanned,
        totalPages: job.stats.totalPages,
        recoveryRound: job.stats.recoveryRound,
        recoveryRounds: job.config.recoveryRounds
      }
    };
    await chrome.runtime.sendMessage(msg).catch(() => {});
  } catch (_) {}
}

function buildListingUrlFallback(baseUrl, page) {
  let str = baseUrl.trim();
  if (!/^https?:\/\//i.test(str)) {
    str = 'https://' + str.replace(/^\/+/, '');
  }
  try {
    const url = new URL(str);
    url.searchParams.set('page', String(page));
    return url.href;
  } catch (_) {
    const sep = str.includes('?') ? '&' : '?';
    return `${str}${sep}page=${page}`;
  }
}

export { startJob, pauseJob, resumeJob, resetJob, tryResumeInterruptedJob };
