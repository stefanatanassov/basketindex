import { listAdapters, resolveAdapter } from '../core/adapter-registry.js';
import { classifyFromJobStatus } from '../lib/user-feedback.js';

const MESSAGE_TYPES = {
  JOB_REQUEST: 'LIDL_JOB_REQUEST',
  JOB_CONTROL: 'LIDL_JOB_CONTROL',
  PROGRESS_UPDATE: 'LIDL_PROGRESS_UPDATE'
};

const CONTROL_ACTIONS = {
  START: 'start', PAUSE: 'pause', RESUME: 'resume', RESET: 'reset',
  EXPORT: 'export', SNAPSHOT: 'snapshot', EXPORT_CSV: 'export_csv'
};

const RETAILER_DEFAULTS = {
  lidl: {
    listingUrl: 'https://www.lidl.bg/mre/purchase-history',
    startPage: 1, endPage: 50, workerCount: 2, maxRetries: 3, recoveryRounds: 3
  },
  metro: {
    listingUrl: 'https://docs.metro.bg/',
    workerCount: 2, maxRetries: 3, recoveryRounds: 3
  }
};

let pollTimer = null;
let currentStatus = 'idle';
let isAdvanced = false;

document.addEventListener('DOMContentLoaded', () => {
  populateAdapterOptions();
  bindEvents();
  loadSavedConfig();
  refreshJobState();
  pollTimer = setInterval(refreshJobState, 1500);
});

function bindEvents() {
  document.getElementById('startBtn').addEventListener('click', handleStart);
  document.getElementById('startBtnAdv').addEventListener('click', handleStart);
  document.getElementById('resetBtn').addEventListener('click', handleReset);
  document.getElementById('resetBtnAdv').addEventListener('click', handleReset);
  document.getElementById('pauseBtn').addEventListener('click', handlePause);
  document.getElementById('resumeBtn').addEventListener('click', handleResume);
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('snapshotBtn').addEventListener('click', handleSnapshot);
  document.getElementById('exportCsvBtn').addEventListener('click', handleExportCsv);
  document.getElementById('exportCsvBtnAdv').addEventListener('click', handleExportCsv);
  document.getElementById('detectUrlBtn').addEventListener('click', handleDetectUrl);
  document.getElementById('toggleModeBtn').addEventListener('click', toggleMode);
  document.getElementById('historyLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('history/history.html') });
  });
  document.getElementById('advancedLink').addEventListener('click', (e) => {
    e.preventDefault();
    toggleMode();
  });

  document.getElementById('adapterId').addEventListener('change', () => {
    updateFieldVisibility();
    applyRetailerDefaults();
    saveConfig();
  });

  const configInputs = ['adapterId', 'startPage', 'endPage', 'workerCount', 'maxRetries', 'recoveryRounds', 'listingUrl', 'fromDate', 'toDate'];
  for (const id of configInputs) {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('change', saveConfig); el.addEventListener('input', saveConfig); }
  }

  const toDateEl = document.getElementById('toDate');
  if (toDateEl && !toDateEl.value) toDateEl.value = new Date().toISOString().slice(0, 10);
  updateFieldVisibility();
}

function toggleMode() {
  isAdvanced = !isAdvanced;
  document.getElementById('simpleView').style.display = isAdvanced ? 'none' : '';
  document.getElementById('advancedView').style.display = isAdvanced ? '' : 'none';
  document.getElementById('toggleModeBtn').textContent = isAdvanced ? '←' : '⚙';
}

function applyRetailerDefaults() {
  const adapterId = document.getElementById('adapterId').value;
  const defs = RETAILER_DEFAULTS[adapterId];
  if (!defs) return;
  if (defs.listingUrl) document.getElementById('listingUrl').value = defs.listingUrl;
  if (defs.startPage) document.getElementById('startPage').value = defs.startPage;
  if (defs.endPage) document.getElementById('endPage').value = defs.endPage;
  if (defs.workerCount) document.getElementById('workerCount').value = defs.workerCount;
  if (defs.maxRetries) document.getElementById('maxRetries').value = defs.maxRetries;
  if (defs.recoveryRounds) document.getElementById('recoveryRounds').value = defs.recoveryRounds;
  if (adapterId === 'metro') {
    const fromEl = document.getElementById('fromDate');
    if (fromEl && !fromEl.value) {
      const d = new Date(); d.setFullYear(d.getFullYear() - 7);
      fromEl.value = d.toISOString().slice(0, 10);
    }
  }
  saveConfig();
}

function updateFieldVisibility() {
  const adapterId = document.getElementById('adapterId').value;
  document.querySelectorAll('.lidl-only').forEach(el => { el.style.display = adapterId === 'lidl' ? '' : 'none'; });
  document.querySelectorAll('.metro-only').forEach(el => { el.style.display = adapterId === 'metro' ? '' : 'none'; });
}

function populateAdapterOptions() {
  const select = document.getElementById('adapterId');
  select.innerHTML = '';
  for (const adapter of listAdapters()) {
    const option = document.createElement('option');
    option.value = adapter.id;
    option.textContent = adapter.status === 'planned' ? `${adapter.name} — Planned` : `${adapter.name} — Available`;
    if (adapter.status === 'planned') option.disabled = true;
    select.appendChild(option);
  }
}

function loadSavedConfig() {
  chrome.storage.local.get('popupConfig', (result) => {
    const c = result.popupConfig;
    if (!c) return;
    if (c.adapterId) { document.getElementById('adapterId').value = c.adapterId; updateFieldVisibility(); }
    if (c.startPage) document.getElementById('startPage').value = c.startPage;
    if (c.endPage) document.getElementById('endPage').value = c.endPage;
    if (c.workerCount) document.getElementById('workerCount').value = c.workerCount;
    if (c.maxRetries) document.getElementById('maxRetries').value = c.maxRetries;
    if (c.recoveryRounds !== undefined) document.getElementById('recoveryRounds').value = c.recoveryRounds;
    if (c.listingUrl) document.getElementById('listingUrl').value = c.listingUrl;
    if (c.fromDate) document.getElementById('fromDate').value = c.fromDate;
    if (c.toDate) document.getElementById('toDate').value = c.toDate;
  });
}

function saveConfig() {
  const adapterId = document.getElementById('adapterId').value || 'lidl';
  const config = {
    adapterId, startPage: parseInt(document.getElementById('startPage').value) || 1,
    endPage: parseInt(document.getElementById('endPage').value) || 50,
    workerCount: parseInt(document.getElementById('workerCount').value) || 2,
    maxRetries: parseInt(document.getElementById('maxRetries').value) || 3,
    recoveryRounds: parseInt(document.getElementById('recoveryRounds').value) || 3,
    listingUrl: document.getElementById('listingUrl').value
  };
  if (adapterId === 'metro') {
    config.fromDate = document.getElementById('fromDate').value || '2019-01-01';
    config.toDate = document.getElementById('toDate').value || new Date().toISOString().slice(0, 10);
  }
  chrome.storage.local.set({ popupConfig: config });
}

function getConfig() {
  const adapterId = document.getElementById('adapterId').value || 'lidl';
  const config = {
    adapterId, startPage: parseInt(document.getElementById('startPage').value) || 1,
    endPage: parseInt(document.getElementById('endPage').value) || 50,
    workerCount: parseInt(document.getElementById('workerCount').value) || 2,
    maxRetries: parseInt(document.getElementById('maxRetries').value) || 3,
    recoveryRounds: parseInt(document.getElementById('recoveryRounds').value) || 3
  };
  if (adapterId === 'metro') {
    config.fromDate = document.getElementById('fromDate').value || '2019-01-01';
    config.toDate = document.getElementById('toDate').value || new Date().toISOString().slice(0, 10);
  }
  return config;
}

function getListingUrl() {
  const adapterId = document.getElementById('adapterId').value;
  if (adapterId === 'metro') return 'https://docs.metro.bg/';
  const defs = RETAILER_DEFAULTS[adapterId];
  return document.getElementById('listingUrl').value.trim() || (defs && defs.listingUrl) || 'https://www.lidl.bg/mre/purchase-history';
}

async function handleStart() {
  const config = getConfig();
  applyRetailerDefaults();
  const listingUrl = getListingUrl();
  if (!listingUrl && config.adapterId !== 'metro') {
    showMessage('Enter a purchase history URL or click Detect', 'error');
    return;
  }
  saveConfig();
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.JOB_CONTROL, action: CONTROL_ACTIONS.START, config, listingBaseUrl: listingUrl });
  if (!response || !response.success) showMessage(friendlyError(response), 'error');
  refreshJobState();
}

async function handlePause() {
  const resp = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.JOB_CONTROL, action: CONTROL_ACTIONS.PAUSE });
  if (!resp || !resp.success) showMessage(friendlyError(resp), 'error');
  refreshJobState();
}

async function handleResume() {
  const resp = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.JOB_CONTROL, action: CONTROL_ACTIONS.RESUME });
  if (!resp || !resp.success) showMessage(friendlyError(resp), 'error');
  refreshJobState();
}

async function handleReset() {
  applyRetailerDefaults();
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('simplePercent').textContent = '—';
  document.getElementById('simpleSubline').textContent = 'Ready';
  showMessage('Form reset to defaults.', 'info');
}

async function handleExport() {
  const resp = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.JOB_CONTROL, action: CONTROL_ACTIONS.EXPORT });
  if (resp && resp.success) showMessage('JSON export started', 'success');
  else showMessage(friendlyError(resp), 'error');
}

async function handleSnapshot() {
  const resp = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.JOB_CONTROL, action: CONTROL_ACTIONS.SNAPSHOT });
  if (resp && resp.success) showMessage('Snapshot export started', 'success');
  else showMessage(friendlyError(resp), 'error');
}

async function handleExportCsv() {
  const resp = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.JOB_CONTROL, action: CONTROL_ACTIONS.EXPORT_CSV });
  if (resp && resp.success) showMessage('CSV export started', 'success');
  else showMessage(friendlyError(resp), 'error');
}

async function handleDetectUrl() {
  showMessage('Detecting Lidl tab...', 'info');
  try {
    const tabs = await chrome.tabs.query({});
    let lidlTab = null;
    for (const tab of tabs) { if (tab.url && tab.url.includes('lidl.') && tab.url.includes('purchase-history')) { lidlTab = tab; break; } }
    if (lidlTab) {
      let url = lidlTab.url; url = url.replace(/[?&]page=\d+/g, '').replace(/[?&]p=\d+/g, '');
      if (url.endsWith('?') || url.endsWith('&')) url = url.slice(0, -1);
      document.getElementById('listingUrl').value = url; saveConfig();
      showMessage(`Detected: ${url}`, 'info');
    } else { showMessage('No Lidl purchase-history tab found.', 'error'); }
  } catch (err) { showMessage('Detection failed: ' + err.message, 'error'); }
}

async function refreshJobState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.JOB_REQUEST });
    if (response && response.summary) updateUI(response.summary);
  } catch (_) {}
}

function updateUI(summary) {
  currentStatus = summary.status || 'idle';

  // Simple view: progress
  const complete = summary.completedCount || 0;
  const total = summary.stats?.receiptsDiscovered || 0;
  const pct = total > 0 ? Math.round(complete / total * 100) : 0;

  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressBarAdv').style.width = pct + '%';
  document.getElementById('simplePercent').textContent = total > 0 ? pct + '%' : '—';

  // Status subline
  let subline = 'Ready';
  if (currentStatus === 'running') {
    subline = total > 0 ? `Processed ${complete} of ${total} receipts` : 'Discovering receipts...';
  } else if (currentStatus === 'completed') {
    subline = total > 0 ? `Export ready: ${total} receipts` : 'Job completed';
  } else if (currentStatus === 'error') {
    subline = 'Error — see details below';
  } else if (currentStatus === 'paused') {
    subline = 'Paused';
  }
  document.getElementById('simpleSubline').textContent = subline;

  // Feedback panel
  const feedback = classifyFromJobStatus(currentStatus, summary.phase, summary.stats, summary.warnings);
  const panel = document.getElementById('feedbackPanel');
  document.getElementById('feedbackTitle').textContent = feedback.title;
  document.getElementById('feedbackBody').textContent = feedback.message;
  document.getElementById('feedbackHint').textContent = feedback.hint || '';
  panel.className = 'feedback-panel feedback-' + (feedback.level || 'info');

  // Advanced view: detailed stats
  const badge = document.getElementById('jobStatusBadge');
  badge.textContent = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
  badge.className = 'badge badge-' + currentStatus;

  document.getElementById('statPhase').textContent = summary.phase || '—';
  document.getElementById('statPages').textContent = summary.pagesScanned !== undefined && summary.totalPages ? `${summary.pagesScanned}/${summary.totalPages}` : '—';
  document.getElementById('statQueue').textContent = summary.queueSize ?? 0;
  document.getElementById('statInFlight').textContent = summary.inFlightCount ?? 0;
  document.getElementById('statComplete').textContent = complete;
  document.getElementById('statFailed').textContent = summary.failuresCount ?? 0;
  document.getElementById('statFinalFail').textContent = summary.finalFailures ?? 0;
  document.getElementById('statRecovery').textContent = summary.recoveryRound && summary.recoveryRounds ? `${summary.recoveryRound}/${summary.recoveryRounds}` : '—';

  // Buttons
  const hasData = complete > 0;
  const isRunning = currentStatus === 'running';
  const isPaused = currentStatus === 'paused';
  const isDone = currentStatus === 'completed' || currentStatus === 'error' || currentStatus === 'idle';

  setBtn('startBtn', isDone); setBtn('startBtnAdv', isDone);
  setBtn('pauseBtn', isRunning); setBtn('resumeBtn', isPaused);
  setBtn('resetBtn', !isDone || hasData); setBtn('resetBtnAdv', !isDone || hasData);
  setBtn('exportBtn', hasData); setBtn('snapshotBtn', hasData);
  setBtn('exportCsvBtn', hasData); setBtn('exportCsvBtnAdv', hasData);
}

function setBtn(id, enabled) {
  const el = document.getElementById(id);
  if (el) el.disabled = !enabled;
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
  if (err.includes('No supported retailer')) return 'Could not match this URL to a supported retailer. Open a retailer page first.';
  if (err.includes('Config')) return 'Please fill in all configuration fields before starting.';
  if (err.includes('No completed receipts')) return 'No receipts to export. Try reducing the page range.';
  if (err.includes('Normalized receipt data')) return 'Receipt data is in an older format. Re-run the export.';
  return err || 'An unexpected error occurred.';
}
