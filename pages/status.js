async function poll() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'LIDL_JOB_REQUEST' });
    if (response && response.summary) updateUI(response.summary);
  } catch (_) {}
  setTimeout(poll, 2000);
}

function updateUI(s) {
  document.getElementById('statusBadge').textContent = (s.status || 'idle').toUpperCase();
  document.getElementById('jobId').textContent = s.jobId || '—';
  document.getElementById('phase').textContent = s.phase || '—';
  document.getElementById('pages').textContent = s.pagesScanned !== undefined && s.totalPages ? `${s.pagesScanned}/${s.totalPages}` : '—';
  document.getElementById('queue').textContent = s.queueSize ?? 0;
  document.getElementById('inFlight').textContent = s.inFlightCount ?? 0;
  document.getElementById('complete').textContent = s.completedCount ?? 0;
  document.getElementById('failed').textContent = s.failuresCount ?? 0;
  document.getElementById('finalFail').textContent = s.finalFailures ?? 0;
  document.getElementById('recovery').textContent = s.recoveryRound && s.recoveryRounds ? `${s.recoveryRound}/${s.recoveryRounds}` : '—';
  document.getElementById('updated').textContent = s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString() : '—';
  const total = s.stats?.receiptsDiscovered || (s.completedCount + (s.failuresCount || 0));
  const fill = document.getElementById('progressFill');
  if (total > 0) fill.style.width = Math.min((s.completedCount || 0) / total * 100, 100) + '%';
}

document.addEventListener('DOMContentLoaded', poll);
