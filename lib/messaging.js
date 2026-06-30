const MESSAGE_TYPES = {
  EXTRACT_LISTING: 'LIDL_EXTRACT_LISTING',
  EXTRACT_DETAIL: 'LIDL_EXTRACT_DETAIL',
  CHECK_AUTH: 'LIDL_CHECK_AUTH',
  AUTH_RESULT: 'LIDL_AUTH_RESULT',
  LISTING_RESULT: 'LIDL_LISTING_RESULT',
  DETAIL_RESULT: 'LIDL_DETAIL_RESULT',
  ERROR: 'LIDL_CONTENT_ERROR',
  JOB_UPDATE: 'LIDL_JOB_UPDATE',
  JOB_REQUEST: 'LIDL_JOB_REQUEST',
  JOB_CONTROL: 'LIDL_JOB_CONTROL',
  PROGRESS_UPDATE: 'LIDL_PROGRESS_UPDATE',
  EXPORT_REQUEST: 'LIDL_EXPORT_REQUEST',
  LOG: 'LIDL_LOG'
};

const CONTROL_ACTIONS = {
  START: 'start',
  PAUSE: 'pause',
  RESUME: 'resume',
  RESET: 'reset',
  EXPORT: 'export',
  SNAPSHOT: 'snapshot',
  EXPORT_CSV: 'export_csv',
  FOLLOWUP: 'followup'
};

async function sendToTab(tabId, message) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (err) {
    return { success: false, error: `Message failed to tab ${tabId}: ${err.message}` };
  }
}

async function sendToPopup(message) {
  try {
    await chrome.runtime.sendMessage(message);
  } catch (_) {}
}

function onPopupMessage(handler) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id === chrome.runtime.id) {
      handler(message, sendResponse);
      return true;
    }
    return false;
  });
}

export { MESSAGE_TYPES, CONTROL_ACTIONS, sendToTab, sendToPopup, onPopupMessage };
