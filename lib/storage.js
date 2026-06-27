const STORAGE_KEY_JOB = 'currentJob';
const STORAGE_KEY_STATS = 'jobStats';

const initialJob = {
  jobId: '',
  createdAt: '',
  updatedAt: '',
  status: 'idle',
  phase: 'done',
  config: {
    startPage: 1,
    endPage: 100,
    workerCount: 2,
    maxRetries: 3,
    recoveryRounds: 2
  },
  listingBaseUrl: '',
  listingTabId: null,
  currentDiscoveryPage: 0,
  pagesDiscovered: [],
  queue: [],
  inFlight: [],
  completed: [],
  completedIds: [],
  failuresById: {},
  finalFailures: [],
  workers: [],
  stats: {
    totalPages: 0,
    pagesScanned: 0,
    receiptsDiscovered: 0,
    receiptsCompleted: 0,
    receiptsFailed: 0,
    retryCount: 0,
    recoveryRound: 0
  }
};

async function loadJob() {
  const result = await chrome.storage.local.get(STORAGE_KEY_JOB);
  if (result[STORAGE_KEY_JOB]) {
    return result[STORAGE_KEY_JOB];
  }
  return null;
}

async function saveJob(job) {
  job.updatedAt = new Date().toISOString();
  const data = {};
  data[STORAGE_KEY_JOB] = job;
  await chrome.storage.local.set(data);
}

async function clearJob() {
  await chrome.storage.local.remove(STORAGE_KEY_JOB);
}

function createJob(config = {}, listingBaseUrl = '') {
  const id = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();
  const job = JSON.parse(JSON.stringify(initialJob));
  job.jobId = id;
  job.createdAt = now;
  job.updatedAt = now;
  job.status = 'idle';
  job.phase = 'done';
  job.config = { ...initialJob.config, ...config };
  job.listingBaseUrl = listingBaseUrl;
  return job;
}

function initJob(config = {}, listingBaseUrl = '') {
  const job = createJob(config, listingBaseUrl);
  job.status = 'running';
  job.phase = 'discover';
  job.currentDiscoveryPage = config.startPage || 1;
  return job;
}

function getJobSummary(job) {
  if (!job) return { status: 'idle', phase: 'done', message: 'No active job' };
  return {
    jobId: job.jobId,
    status: job.status,
    phase: job.phase,
    config: job.config,
    stats: job.stats,
    queueSize: job.queue.length,
    inFlightCount: job.inFlight.length,
    workersActive: job.workers.filter(w => w.status === 'active').length,
    failuresCount: Object.keys(job.failuresById).length,
    completedCount: job.completedIds.length,
    updatedAt: job.updatedAt
  };
}

export { loadJob, saveJob, clearJob, createJob, initJob, getJobSummary, initialJob, STORAGE_KEY_JOB };
