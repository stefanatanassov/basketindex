// lib/user-feedback.js
// Returns language-neutral feedback codes + levels. UI layers resolve
// display strings via i18n message keys (lib/i18n-helper.js).

const FEEDBACK_CODES = {
  ready:          { level: 'info',    code: 'ready',               i18nPrefix: 'feedbackReady' },
  discovering:    { level: 'info',    code: 'discovering',         i18nPrefix: 'feedbackDiscovering' },
  processing:     { level: 'info',    code: 'processing',          i18nPrefix: 'feedbackProcessing' },
  recovery:       { level: 'info',    code: 'recovery',            i18nPrefix: 'feedbackRecovery' },
  paused:         { level: 'info',    code: 'paused',              i18nPrefix: 'feedbackPaused' },
  success:        { level: 'success', code: 'success',             i18nPrefix: 'feedbackSuccess' },
  partial:        { level: 'warning', code: 'partial_completion',  i18nPrefix: 'feedbackPartial' },
  timeout:        { level: 'error',   code: 'timeout',             i18nPrefix: 'feedbackTimeout' },
  auth_required:  { level: 'error',   code: 'auth_required',       i18nPrefix: 'feedbackAuth' },
  unavailable:    { level: 'error',   code: 'retailer_unavailable', i18nPrefix: 'feedbackUnavailable' },
  export_unavail: { level: 'warning', code: 'export_unavailable',   i18nPrefix: 'feedbackExport' },
  unknown_error:  { level: 'error',   code: 'unknown_error',       i18nPrefix: 'feedbackUnknown' }
};

function classifyFromJobStatus(status, phase, stats, warnings) {
  if (status === 'idle' || !status) return FEEDBACK_CODES.ready;
  if (status === 'paused') return FEEDBACK_CODES.paused;

  if (status === 'running') {
    if (phase === 'discover') return FEEDBACK_CODES.discovering;
    if (phase === 'recovery') return FEEDBACK_CODES.recovery;
    return FEEDBACK_CODES.processing;
  }

  if (status === 'completed') {
    const failedCount = stats?.receiptsFailed || 0;
    if (failedCount > 0) return FEEDBACK_CODES.partial;
    if (warnings && warnings.length > 0 &&
        warnings.some(w => w.code === 'LIDL_PAGE_WINDOW_TRUNCATED' || w.code === 'PARTIAL_COMPLETION')) {
      return FEEDBACK_CODES.partial;
    }
    return FEEDBACK_CODES.success;
  }

  if (status === 'error') return classifyErrorFromMessage(null, stats?.lastError || '');
  return FEEDBACK_CODES.idle;
}

function classifyErrorFromMessage(errorCode, errorMessage) {
  const msg = (errorMessage || '').toLowerCase();
  if (errorCode === 'timeout' || msg.includes('timeout') || msg.includes('timed out')) return FEEDBACK_CODES.timeout;
  if (errorCode === 'auth' || msg.includes('401') || msg.includes('token') || msg.includes('login') || msg.includes('sign in') || msg.includes('authenticated') || msg.includes('session') || msg.includes('expired')) return FEEDBACK_CODES.auth_required;
  // Lidl relay failures: content script unreachable → likely tab on login page, not purchase-history
  if (msg.includes('relay failed') || msg.includes('relay') && (msg.includes('retries') || msg.includes('tab') || msg.includes('connection'))) return FEEDBACK_CODES.auth_required;
  if (msg.includes('connection') || msg.includes('receiving end')) return FEEDBACK_CODES.auth_required;
  if (msg.includes('unavailable') || msg.includes('not found') || msg.includes('404') || msg.includes('reachable')) return FEEDBACK_CODES.unavailable;
  if (msg.includes('failed to fetch') || msg.includes('network')) return FEEDBACK_CODES.unavailable;
  return FEEDBACK_CODES.unknown_error;
}

function getRunOutcomeCode(run) {
  if (run.status === 'done' && run.summary.failedCount === 0 && run.summary.warningCount === 0) return 'success';
  if (run.status === 'done' && (run.summary.failedCount > 0 || run.summary.warningCount > 0)) return 'partial';
  if (run.status === 'error') return 'error';
  return 'idle';
}

export { FEEDBACK_CODES, classifyFromJobStatus, classifyErrorFromMessage, getRunOutcomeCode };
