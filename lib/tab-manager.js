const TAB_TYPES = {
  listing: 'listing',
  worker: 'worker'
};

let tabCounter = 0;

function nextTabId() {
  return `tab_${++tabCounter}_${Date.now()}`;
}

function normalizeTabUrl(input) {
  if (!input || input.startsWith('about:') || input.startsWith('chrome:') || input.startsWith('chrome-extension:')) {
    return input;
  }
  if (!/^https?:\/\//i.test(input)) {
    return 'https://' + input.replace(/^\/+/, '');
  }
  return input;
}

async function createTab(url, type = TAB_TYPES.worker) {
  const normalized = normalizeTabUrl(url);
  const tab = await chrome.tabs.create({ url: normalized, active: false });
  return {
    id: tab.id,
    type,
    url: normalized,
    status: 'created',
    createdAt: Date.now(),
    taskId: null
  };
}

async function navigateTab(tabId, url) {
  const normalized = normalizeTabUrl(url);
  await chrome.tabs.update(tabId, { url: normalized });
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    return true;
  } catch (_) {
    return false;
  }
}

async function getTabUrl(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url;
  } catch (_) {
    return null;
  }
}

async function waitForTabLoad(tabId, timeout = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) { resolve(false); return; }
        if (tab.status === 'complete') { resolve(true); return; }
        if (Date.now() - start > timeout) { resolve(false); return; }
        setTimeout(check, 300);
      });
    };
    check();
  });
}

function getWorkerTab(job, tabId) {
  return job.workers.find(w => w.tabId === tabId);
}

function getWorkerTabById(job, workerId) {
  return job.workers.find(w => w.id === workerId);
}

function getAvailableWorker(job) {
  return job.workers.find(w => w.status === 'idle' && !w.taskId && w.type === TAB_TYPES.worker);
}

function markWorkerActive(job, workerId, taskId) {
  const worker = job.workers.find(w => w.id === workerId);
  if (worker) {
    worker.status = 'active';
    worker.taskId = taskId;
    worker.lastHeartbeat = Date.now();
  }
}

function markWorkerIdle(job, workerId) {
  const worker = job.workers.find(w => w.id === workerId);
  if (worker) {
    worker.status = 'idle';
    worker.taskId = null;
    worker.lastHeartbeat = Date.now();
  }
}

function markWorkerStale(job, workerId) {
  const worker = job.workers.find(w => w.id === workerId);
  if (worker) {
    worker.status = 'stale';
    worker.taskId = null;
  }
}

function heartbeatWorker(job, tabId) {
  const worker = job.workers.find(w => w.tabId === tabId);
  if (worker) {
    worker.lastHeartbeat = Date.now();
  }
}

function getStaleWorkers(job, staleMs = 60000) {
  const now = Date.now();
  return job.workers.filter(w =>
    w.status === 'active' &&
    (now - w.lastHeartbeat) > staleMs
  );
}

function removeWorker(job, tabId) {
  job.workers = job.workers.filter(w => w.tabId !== tabId);
}

function createWorkerEntry(tabId, tabType) {
  return {
    id: nextTabId(),
    tabId,
    type: tabType,
    status: 'idle',
    taskId: null,
    lastHeartbeat: Date.now(),
    createdAt: Date.now()
  };
}

export {
  TAB_TYPES,
  createTab,
  navigateTab,
  closeTab,
  getTabUrl,
  waitForTabLoad,
  getWorkerTab,
  getWorkerTabById,
  getAvailableWorker,
  markWorkerActive,
  markWorkerIdle,
  markWorkerStale,
  heartbeatWorker,
  getStaleWorkers,
  removeWorker,
  createWorkerEntry
};
