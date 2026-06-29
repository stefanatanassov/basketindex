// lib/user-feedback.js
// Maps raw job states, error codes, and warning codes into user-facing
// feedback objects for the popup Simple view and run history summaries.
//
// Categories: info, success, warning, error
// Each feedback entry has: level, code, title, message, hint (optional)

const FEEDBACK_MAP = {
  idle: {
    level: 'info',
    code: 'idle',
    title: 'Ready',
    message: 'Choose a retailer and start an extraction.',
    hint: null
  },

  discovering: {
    level: 'info',
    code: 'discovering',
    title: 'Discovering receipts',
    message: 'BasketIndex is finding your available receipts.',
    hint: null
  },

  processing: {
    level: 'info',
    code: 'processing',
    title: 'Processing receipts',
    message: 'BasketIndex is extracting and preparing your data.',
    hint: null
  },

  recovery: {
    level: 'info',
    code: 'recovery',
    title: 'Retrying a few receipts',
    message: 'BasketIndex is retrying receipts that did not complete on the first attempt.',
    hint: null
  },

  paused: {
    level: 'info',
    code: 'paused',
    title: 'Paused',
    message: 'Extraction is paused. Resume to continue.',
    hint: null
  },

  success: {
    level: 'success',
    code: 'success',
    title: 'Export ready',
    message: 'Your receipts were processed successfully.',
    hint: 'Export CSV or open History to review the run.'
  },

  partial_completion: {
    level: 'warning',
    code: 'partial_completion',
    title: 'Export completed with some issues',
    message: 'Most receipts were processed, but some could not be extracted.',
    hint: 'Open History to review the run and export what is available.'
  },

  timeout: {
    level: 'error',
    code: 'timeout',
    title: 'Retailer page did not respond in time',
    message: 'BasketIndex could not complete the request in time.',
    hint: 'Try Start again. If the retailer page is asking you to sign in, finish that first.'
  },

  auth_required: {
    level: 'error',
    code: 'auth_required',
    title: 'Sign-in required',
    message: 'BasketIndex needs an active retailer session before it can continue.',
    hint: 'Open the retailer page, sign in, then try again.'
  },

  retailer_unavailable: {
    level: 'error',
    code: 'retailer_unavailable',
    title: 'Retailer page is unavailable',
    message: 'BasketIndex could not access the retailer page or data right now.',
    hint: 'Try again shortly. If the problem persists, check that the retailer website is accessible.'
  },

  export_unavailable: {
    level: 'warning',
    code: 'export_unavailable',
    title: 'Export not ready yet',
    message: 'There is no completed extraction available to export.',
    hint: 'Start an extraction first or wait for the current one to finish.'
  },

  unknown_error: {
    level: 'error',
    code: 'unknown_error',
    title: 'Something went wrong',
    message: 'BasketIndex encountered an unexpected issue.',
    hint: 'Try again. If the problem persists, reload the extension in chrome://extensions.'
  }
};

function classifyFromJobStatus(status, phase, stats, warnings) {
  if (status === 'idle' || !status) return FEEDBACK_MAP.idle;

  if (status === 'paused') return FEEDBACK_MAP.paused;

  if (status === 'running') {
    if (phase === 'discover') return FEEDBACK_MAP.discovering;
    if (phase === 'recovery') return FEEDBACK_MAP.recovery;
    return FEEDBACK_MAP.processing;
  }

  if (status === 'completed') {
    const failedCount = stats?.receiptsFailed || 0;
    if (failedCount > 0) return FEEDBACK_MAP.partial_completion;
    if (warnings && warnings.length > 0) {
      // Partial if there are warnings indicating incomplete data
      if (warnings.some(w => w.code === 'LIDL_PAGE_WINDOW_TRUNCATED' || w.code === 'PARTIAL_COMPLETION')) {
        return FEEDBACK_MAP.partial_completion;
      }
    }
    return FEEDBACK_MAP.success;
  }

  if (status === 'error') {
    return classifyError(jobState?.lastErrorCode, jobState?.lastError);
  }

  return FEEDBACK_MAP.idle;
}

function classifyError(errorCode, errorMessage) {
  const msg = (errorMessage || '').toLowerCase();

  if (errorCode === 'timeout' || msg.includes('timeout') || msg.includes('timed out')) {
    return FEEDBACK_MAP.timeout;
  }

  if (errorCode === 'auth' || msg.includes('401') || msg.includes('token') ||
      msg.includes('login') || msg.includes('sign in') || msg.includes('authenticated') ||
      msg.includes('session') || msg.includes('expired')) {
    return FEEDBACK_MAP.auth_required;
  }

  if (msg.includes('relay') || msg.includes('connection') || msg.includes('tab') ||
      msg.includes('content script') || msg.includes('receiving end')) {
    return FEEDBACK_MAP.timeout;
  }

  if (msg.includes('unavailable') || msg.includes('not found') || msg.includes('404') ||
      msg.includes('reachable')) {
    return FEEDBACK_MAP.retailer_unavailable;
  }

  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return FEEDBACK_MAP.retailer_unavailable;
  }

  return FEEDBACK_MAP.unknown_error;
}

function getRunOutcomeSummary(run) {
  if (run.status === 'done' && run.summary.failedCount === 0 && run.summary.warningCount === 0) {
    return FEEDBACK_MAP.success;
  }
  if (run.status === 'done' && (run.summary.failedCount > 0 || run.summary.warningCount > 0)) {
    return FEEDBACK_MAP.partial_completion;
  }
  if (run.status === 'error') {
    const firstWarning = (run.warnings || [])[0];
    return classifyError(null, firstWarning ? firstWarning.message : '');
  }
  return FEEDBACK_MAP.idle;
}

export { FEEDBACK_MAP, classifyFromJobStatus, classifyError, getRunOutcomeSummary };
