import { listAdapters, resolveAdapter } from '../core/adapter-registry.js';

const MESSAGE_TYPES = {
  JOB_REQUEST: 'LIDL_JOB_REQUEST',
  JOB_CONTROL: 'LIDL_JOB_CONTROL',
  PROGRESS_UPDATE: 'LIDL_PROGRESS_UPDATE'
};

const CONTROL_ACTIONS = {
  START: 'start',
  PAUSE: 'pause',
  RESUME: 'resume',
  RESET: 'reset',
  EXPORT: 'export',
  SNAPSHOT: 'snapshot'
};

let pollTimer = null;
let currentStatus = 'idle';

document.addEventListener('DOMContentLoaded', () => {
  populateAdapterOptions();
  bindEvents();
  loadSavedConfig();
  refreshJobState();
  pollTimer = setInterval(refreshJobState, 1500);
});

function bindEvents() {
  document.getElementById('startBtn').addEventListener('click', handleStart);
  document.getElementById('pauseBtn').addEventListener('click', handlePause);
  document.getElementById('resumeBtn').addEventListener('click', handleResume);
  document.getElementById('resetBtn').addEventListener('click', handleReset);
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('snapshotBtn').addEventListener('click', handleSnapshot);
  document.getElementById('exportCsvBtn').addEventListener('click', handleExportCsv);
  document.getElementById('detectUrlBtn').addEventListener('click', handleDetectUrl);

  const configInputs = ['adapterId', 'startPage', 'endPage', 'workerCount', 'maxRetries', 'recoveryRounds', 'listingUrl'];
  for (const id of configInputs) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', saveConfig);
      el.addEventListener('input', saveConfig);
    }
  }
}

function saveConfig() {
  const config = {
    adapterId: document.getElementById('adapterId').value || 'lidl',
    startPage: parseInt(document.getElementById('startPage').value) || 1,
    endPage: parseInt(document.getElementById('endPage').value) || 100,
    workerCount: parseInt(document.getElementById('workerCount').value) || 2,
    maxRetries: parseInt(document.getElementById('maxRetries').value) || 3,
    recoveryRounds: parseInt(document.getElementById('recoveryRounds').value) || 2,
    listingUrl: document.getElementById('listingUrl').value
  };
  chrome.storage.local.set({ popupConfig: config });
}

function populateAdapterOptions() {
  const select = document.getElementById('adapterId');
  select.innerHTML = '';

  for (const adapter of listAdapters()) {
    const option = document.createElement('option');
    option.value = adapter.id;
    option.textContent = `${adapter.name} (${adapter.status})`;
    select.appendChild(option);
  }
}

function loadSavedConfig() {
  chrome.storage.local.get('popupConfig', (result) => {
    const c = result.popupConfig;
    if (!c) return;
    if (c.adapterId) document.getElementById('adapterId').value = c.adapterId;
    if (c.startPage) document.getElementById('startPage').value = c.startPage;
    if (c.endPage) document.getElementById('endPage').value = c.endPage;
    if (c.workerCount) document.getElementById('workerCount').value = c.workerCount;
    if (c.maxRetries) document.getElementById('maxRetries').value = c.maxRetries;
    if (c.recoveryRounds !== undefined) document.getElementById('recoveryRounds').value = c.recoveryRounds;
    if (c.listingUrl) document.getElementById('listingUrl').value = c.listingUrl;
  });
}

async function refreshJobState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.JOB_REQUEST });
    if (response && response.summary) {
      updateUI(response.summary);
    }
  } catch (_) {}
}

function getConfig() {
  return {
    adapterId: document.getElementById('adapterId').value || 'lidl',
    startPage: parseInt(document.getElementById('startPage').value) || 1,
    endPage: parseInt(document.getElementById('endPage').value) || 100,
    workerCount: parseInt(document.getElementById('workerCount').value) || 2,
    maxRetries: parseInt(document.getElementById('maxRetries').value) || 3,
    recoveryRounds: parseInt(document.getElementById('recoveryRounds').value) || 2
  };
}

function getListingUrl() {
  return document.getElementById('listingUrl').value.trim();
}

async function handleStart() {
  const config = getConfig();
  const listingUrl = getListingUrl();
  if (!listingUrl) {
    showMessage('Enter a purchase history URL or click Detect', 'error');
    return;
  }
  saveConfig();
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.JOB_CONTROL,
    action: CONTROL_ACTIONS.START,
    config,
    listingBaseUrl: listingUrl
  });
  if (!response || !response.success) {
    showMessage(friendlyError(response), 'error');
  }
  refreshJobState();
}

async function handlePause() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.JOB_CONTROL,
    action: CONTROL_ACTIONS.PAUSE
  });
  if (!response || !response.success) {
    showMessage(friendlyError(response), 'error');
  }
  refreshJobState();
}

async function handleResume() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.JOB_CONTROL,
    action: CONTROL_ACTIONS.RESUME
  });
  if (!response || !response.success) {
    showMessage(friendlyError(response), 'error');
  }
  refreshJobState();
}

async function handleReset() {
  if (!confirm('Reset the current job? This cannot be undone.')) return;
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.JOB_CONTROL,
    action: CONTROL_ACTIONS.RESET
  });
  refreshJobState();
}

async function handleExport() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.JOB_CONTROL,
    action: CONTROL_ACTIONS.EXPORT
  });
  if (response && response.success) {
    showMessage('JSON export started', 'success');
  } else {
    showMessage(friendlyError(response), 'error');
  }
}

async function handleSnapshot() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.JOB_CONTROL,
    action: CONTROL_ACTIONS.SNAPSHOT
  });
  if (response && response.success) {
    showMessage('Snapshot export started', 'success');
  } else {
    showMessage(friendlyError(response), 'error');
  }
}

async function handleExportCsv() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.JOB_CONTROL,
    action: CONTROL_ACTIONS.EXPORT_CSV
  });
  if (response && response.success) {
    showMessage('CSV export started', 'success');
  } else {
    showMessage(friendlyError(response), 'error');
  }
}

async function handleDetectUrl() {
  showMessage('Detecting purchase history tab...', 'info');
  try {
    const tabs = await chrome.tabs.query({});
    let matchingTab = null;
    for (const tab of tabs) {
      if (tab.url && resolveAdapter(tab.url)) {
        matchingTab = tab;
        break;
      }
    }
    if (matchingTab) {
      const adapter = resolveAdapter(matchingTab.url);
      let url = matchingTab.url;
      url = url.replace(/[?&]page=\d+/g, '').replace(/[?&]p=\d+/g, '');
      if (url.endsWith('?') || url.endsWith('&')) url = url.slice(0, -1);
      if (adapter) {
        document.getElementById('adapterId').value = adapter.id;
      }
      document.getElementById('listingUrl').value = url;
      saveConfig();
      showMessage(`Detected: ${url}`, 'info');
    } else {
      showMessage('No supported purchase-history tab found. Open one first.', 'error');
    }
  } catch (err) {
    showMessage('Detection failed: ' + err.message, 'error');
  }
}

function updateUI(summary) {
  currentStatus = summary.status || 'idle';

  const badge = document.getElementById('jobStatusBadge');
  badge.textContent = capitalize(currentStatus);
  badge.className = 'badge badge-' + currentStatus;

  document.getElementById('statPhase').textContent = summary.phase || '—';
  const pagesText = summary.pagesScanned !== undefined && summary.totalPages
    ? `${summary.pagesScanned}/${summary.totalPages}`
    : '—';
  document.getElementById('statPages').textContent = pagesText;
  document.getElementById('statQueue').textContent = summary.queueSize ?? 0;
  document.getElementById('statInFlight').textContent = summary.inFlightCount ?? 0;
  document.getElementById('statComplete').textContent = summary.completedCount ?? 0;
  document.getElementById('statFailed').textContent = summary.failuresCount ?? 0;
  document.getElementById('statFinalFail').textContent = summary.finalFailures ?? 0;

  const recoveryText = summary.recoveryRound && summary.recoveryRounds
    ? `${summary.recoveryRound}/${summary.recoveryRounds}`
    : '—';
  document.getElementById('statRecovery').textContent = recoveryText;

  updateProgressBar(summary);
  updateButtons(summary.status);
}

function updateProgressBar(summary) {
  const bar = document.getElementById('progressBar');
  const total = summary.stats?.receiptsDiscovered || (summary.completedCount + (summary.failuresCount || 0));
  if (total > 0) {
    const pct = ((summary.completedCount || 0) / total) * 100;
    bar.style.width = Math.min(pct, 100) + '%';
  } else {
    bar.style.width = '0%';
  }
}

function updateButtons(status) {
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportBtn');
  const snapshotBtn = document.getElementById('snapshotBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');

  const hasData = currentStatus !== 'idle';

  switch (status) {
    case 'idle':
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      resumeBtn.disabled = true;
      resetBtn.disabled = true;
      exportBtn.disabled = !hasData;
      snapshotBtn.disabled = !hasData;
      exportCsvBtn.disabled = !hasData;
      break;
    case 'running':
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      resumeBtn.disabled = true;
      resetBtn.disabled = false;
      exportBtn.disabled = false;
      snapshotBtn.disabled = false;
      exportCsvBtn.disabled = false;
      break;
    case 'paused':
      startBtn.disabled = true;
      pauseBtn.disabled = true;
      resumeBtn.disabled = false;
      resetBtn.disabled = false;
      exportBtn.disabled = false;
      snapshotBtn.disabled = false;
      exportCsvBtn.disabled = false;
      break;
    case 'completed':
    case 'error':
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      resumeBtn.disabled = true;
      resetBtn.disabled = false;
      exportBtn.disabled = false;
      snapshotBtn.disabled = false;
      exportCsvBtn.disabled = false;
      break;
  }
}

function showMessage(text, type) {
  const el = document.getElementById('lastMessage');
  el.textContent = text;
  el.style.color = type === 'error' ? '#d33' : type === 'info' ? '#4a90d9' : type === 'success' ? '#28a745' : '#888';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.textContent = ''; }, 8000);
}

function friendlyError(response) {
  if (!response) return 'No response from extension. Try reloading the extension in chrome://extensions.';
  const err = response.error || '';
  if (err.includes('running')) return 'A job is already running. Pause or reset it first.';
  if (err.includes('paused')) return 'No paused job to resume.';
  if (err.includes('No supported retailer')) return 'Could not match this URL to a supported retailer. Open a Lidl purchase-history page first.';
  if (err.includes('Config')) return 'Please fill in all configuration fields before starting.';
  if (err.includes('completed receipts')) return 'No receipts have been exported yet. Wait for the job to finish processing.';
  return err || 'An unexpected error occurred. Check the console for details.';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
