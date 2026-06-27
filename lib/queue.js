function enqueue(job, receipts) {
  const existing = new Set(job.queue.map(r => r.receipt_id));
  for (const r of receipts) {
    if (!existing.has(r.receipt_id) && !job.completedIds.includes(r.receipt_id)) {
      job.queue.push({
        receipt_id: r.receipt_id,
        url: r.url,
        attempts: 0,
        lastError: null,
        enqueuedAt: new Date().toISOString()
      });
      existing.add(r.receipt_id);
    }
  }
  job.stats.receiptsDiscovered = job.completedIds.length + job.queue.length + job.inFlight.length;
}

function dequeue(job) {
  const next = job.queue.shift();
  if (!next) return null;
  next.attempts = (next.attempts || 0) + 1;
  job.inFlight.push(next.receipt_id);
  return next;
}

function completeReceipt(job, receiptId, receiptData) {
  job.inFlight = job.inFlight.filter(id => id !== receiptId);
  if (!job.completedIds.includes(receiptId)) {
    job.completedIds.push(receiptId);
    job.completed.push(receiptData);
    job.stats.receiptsCompleted++;
  }
  delete job.failuresById[receiptId];
}

function failReceipt(job, receiptId, error, maxRetries) {
  job.inFlight = job.inFlight.filter(id => id !== receiptId);
  if (!job.failuresById[receiptId]) {
    job.failuresById[receiptId] = {
      receipt_id: receiptId,
      attempts: 0,
      errors: [],
      firstFailedAt: new Date().toISOString()
    };
  }
  const record = job.failuresById[receiptId];
  record.attempts++;
  record.errors.push({ error, at: new Date().toISOString() });

  if (record.attempts < maxRetries) {
    const originalUrl = findOriginalUrl(job, receiptId);
    job.queue.push({
      receipt_id: receiptId,
      url: originalUrl || '',
      attempts: record.attempts,
      lastError: error,
      enqueuedAt: new Date().toISOString()
    });
  }
  job.stats.receiptsFailed = Object.keys(job.failuresById).length;
  checkFinalFailures(job, maxRetries);
}

function checkFinalFailures(job, maxRetries) {
  job.finalFailures = [];
  for (const [id, record] of Object.entries(job.failuresById)) {
    if (record.attempts >= maxRetries) {
      job.finalFailures.push({ receipt_id: id, attempts: record.attempts, errors: record.errors });
    }
  }
}

function findOriginalUrl(job, receiptId) {
  const found = job.queue.find(r => r.receipt_id === receiptId);
  if (found) return found.url;
  const inFlightItem = job.inFlight.find(id => id === receiptId);
  if (inFlightItem) {
    const worker = job.workers.find(w => w.taskId === receiptId);
  }
  for (const page of job.pagesDiscovered) {
    for (const r of page.receipts || []) {
      if (r.receipt_id === receiptId) return r.url;
    }
  }
  return '';
}

function getQueueStats(job) {
  return {
    queued: job.queue.length,
    inFlight: job.inFlight.length,
    completed: job.completedIds.length,
    failed: Object.keys(job.failuresById).length,
    finalFailures: job.finalFailures.length
  };
}

function requeueInFlight(job) {
  for (const receiptId of [...job.inFlight]) {
    job.inFlight = job.inFlight.filter(id => id !== receiptId);
    const url = findOriginalUrl(job, receiptId);
    if (url) {
      job.queue.unshift({
        receipt_id: receiptId,
        url,
        attempts: 0,
        lastError: 'Requeued after tab loss',
        enqueuedAt: new Date().toISOString()
      });
    }
  }
}

function hasPendingWork(job) {
  return job.queue.length > 0 || job.inFlight.length > 0;
}

function prepareRecoveryRound(job) {
  const recoveryIds = Object.keys(job.failuresById).filter(
    id => job.failuresById[id].attempts < job.config.maxRetries
  );
  for (const receiptId of recoveryIds) {
    const url = findOriginalUrl(job, receiptId);
    if (url && !job.queue.find(r => r.receipt_id === receiptId)) {
      job.queue.push({
        receipt_id: receiptId,
        url,
        attempts: job.failuresById[receiptId].attempts,
        lastError: 'Recovery re-queue',
        enqueuedAt: new Date().toISOString()
      });
    }
  }
  return recoveryIds.length;
}

export {
  enqueue,
  dequeue,
  completeReceipt,
  failReceipt,
  getQueueStats,
  requeueInFlight,
  hasPendingWork,
  prepareRecoveryRound,
  checkFinalFailures,
  findOriginalUrl
};
