import { loadRuns } from '../lib/run-history.js';
import { buildAiPack, getAnalysisTypes } from '../lib/ai-pack.js';

let runs = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  runs = await loadRuns();
  if (!runs.length) return;
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('main').style.display = '';

  renderRunCheckboxes();
  renderAnalysisTypes();
  document.getElementById('generateBtn').addEventListener('click', handleGenerate);
  // Enable button if at least one run is checked
  document.querySelectorAll('#runCheckboxes input').forEach(cb =>
    cb.addEventListener('change', updateButton)
  );
}

function runLabelLocal(run) {
  const rl = run.retailer === 'lidl' ? 'Лидл' : run.retailer === 'metro' ? 'МЕТРО' : run.retailer.toUpperCase();
  const cov = run.coverage || {};
  let covStr = '';
  if (cov.fromDate && cov.toDate) covStr = ` (${cov.fromDate} – ${cov.toDate})`;
  const ic = run.summary?.itemCount ? ` · ${run.summary.itemCount} арт.` : '';
  return `${rl}${covStr}${ic}`;
}

function renderRunCheckboxes() {
  const list = document.getElementById('runCheckboxes');
  const topRuns = runs.slice(0, 12); // Show most recent

  list.innerHTML = topRuns.map((run, i) => `
    <div class="checkbox-item">
      <input type="checkbox" id="run-${i}" value="${run.runId}" checked>
      <label for="run-${i}">${runLabelLocal(run)}</label>
    </div>
  `).join('');

  updateButton();
}

function renderAnalysisTypes() {
  const sel = document.getElementById('analysisType');
  for (const t of getAnalysisTypes()) {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.title_bg + ' / ' + t.title_en;
    sel.appendChild(o);
  }
}

function getSelectedRunIds() {
  const cbs = document.querySelectorAll('#runCheckboxes input:checked');
  return Array.from(cbs).map(cb => cb.value);
}

function updateButton() {
  document.getElementById('generateBtn').disabled = getSelectedRunIds().length === 0;
}

async function handleGenerate() {
  const runIds = getSelectedRunIds();
  if (!runIds.length) return;

  const analysisType = document.getElementById('analysisType').value;
  const lang = document.getElementById('language').value;
  const btn = document.getElementById('generateBtn');
  const status = document.getElementById('status');

  btn.disabled = true;
  status.textContent = 'Генериране...';

  try {
    const { zipBlob, zipName } = await buildAiPack(runIds, analysisType, lang);
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result.split(',')[1];
      chrome.downloads.download({
        url: `data:application/zip;base64,${b64}`,
        filename: zipName,
        saveAs: true
      });
      status.textContent = 'Готово!';
      btn.disabled = false;
    };
    reader.readAsDataURL(zipBlob);
  } catch (err) {
    status.textContent = 'Грешка: ' + err.message;
    btn.disabled = false;
  }
}
