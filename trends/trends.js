// trends/trends.js
// Trends page — run-scoped, searchable multi-select items, index/percent/nominal.

import { loadRuns, getRunOptions, getItemOptions, buildAggregateSeries, buildSelectedSeries, convertToPercentage, convertToIndex, getAllBuckets, getTrendSummary } from '../lib/trends.js';
import { encodeQR } from '../lib/qr.js';

const COLORS = ['#4a90d9', '#e8734a', '#3a8a40', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const LANDING_URL = 'https://basketindex.stefanatanasov.dev/';

let runs = [], itemOptions = [], selectedIds = null, isAllItems = true;
let itemsDropdownOpen = false;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  runs = await loadRuns();
  if (runs.length === 0) return;

  populateRunFilter();
  itemOptions = getItemOptions(runs, null);
  if (itemOptions.length === 0) {
    document.getElementById('emptyState').querySelector('p').textContent = 'Няма достатъчно повтарящи се продукти за генериране на тенденции.';
    return;
  }

  showControls();
  bindEvents();
  renderChart();
}

function populateRunFilter() {
  const sel = document.getElementById('runFilter');
  for (const opt of getRunOptions(runs)) {
    const o = document.createElement('option');
    o.value = opt.runId;
    o.textContent = opt.label;
    sel.appendChild(o);
  }
}

function showControls() {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('controls').style.display = '';
  document.getElementById('chartContainer').style.display = '';
  document.getElementById('methodology').style.display = '';
  document.getElementById('trendSummary').style.display = '';
  renderItemList('');
}

function bindEvents() {
  document.getElementById('runFilter').addEventListener('change', () => { refreshItems(); renderChart(); });
  document.getElementById('aggregation').addEventListener('change', renderChart);
  document.getElementById('valueType').addEventListener('change', renderChart);
  document.getElementById('exportPngBtn').addEventListener('click', exportPng);
  document.getElementById('itemsToggle').addEventListener('click', toggleItemsDropdown);
  document.getElementById('itemsSearch').addEventListener('input', (e) => renderItemList(e.target.value));
  document.addEventListener('click', (e) => { if (!e.target.closest('.multi-select')) closeItemsDropdown(); });
}

function refreshItems() {
  const runId = getScopeRunId();
  itemOptions = getItemOptions(runs, runId);
  selectedIds = null;
  isAllItems = true;
  updateToggleLabel();
  renderItemList(document.getElementById('itemsSearch').value);
}

function getScopeRunId() {
  const v = document.getElementById('runFilter').value;
  return v === '__ALL__' ? null : v;
}

function getValueMode() { return document.getElementById('valueType').value; }
function getAgg() { return document.getElementById('aggregation').value || 'quarter'; }

function renderItemList(search) {
  const list = document.getElementById('itemsList');
  const q = (search || '').toLowerCase();
  const filtered = q ? itemOptions.filter(it => it.label.toLowerCase().includes(q)) : itemOptions;
  list.innerHTML = filtered.map(it => {
    const checked = !isAllItems && selectedIds && selectedIds.includes(it.id);
    return `<label class="multi-item"><input type="checkbox" value="${esc(it.id)}" ${checked ? 'checked' : ''} onchange="window._trendsItemChange()">${esc(it.label)} <span class="multi-count">${it.count}</span></label>`;
  }).join('');
  if (filtered.length === 0) list.innerHTML = '<div class="multi-empty">Няма съвпадения</div>';

  window._trendsItemChange = () => {
    const checks = document.querySelectorAll('#itemsList input:checked');
    selectedIds = Array.from(checks).map(c => c.value);
    isAllItems = selectedIds.length === 0;
    updateToggleLabel();
    renderChart();
  };
}

function toggleItemsDropdown() {
  itemsDropdownOpen = !itemsDropdownOpen;
  document.getElementById('itemsDropdown').style.display = itemsDropdownOpen ? '' : 'none';
  if (itemsDropdownOpen) {
    document.getElementById('itemsSearch').focus();
    renderItemList(document.getElementById('itemsSearch').value);
  }
}

function closeItemsDropdown() {
  itemsDropdownOpen = false;
  document.getElementById('itemsDropdown').style.display = 'none';
}

function updateToggleLabel() {
  const btn = document.getElementById('itemsToggle');
  if (isAllItems) btn.textContent = 'Всички артикули';
  else btn.textContent = `${selectedIds.length} избрани`;
}

function renderChart() {
  const runId = getScopeRunId();
  const agg = getAgg();
  const mode = getValueMode();

  let series;
  if (isAllItems) {
    series = buildAggregateSeries(runs, runId, agg);
  } else {
    if (!selectedIds || selectedIds.length === 0) {
      document.getElementById('chartContainer').style.display = 'none';
      return;
    }
    series = buildSelectedSeries(runs, runId, selectedIds, agg);
  }

  if (!series.length || series.every(s => s.points.length < 2)) {
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('trendSummary').style.display = 'none';
    return;
  }

  document.getElementById('chartContainer').style.display = '';
  document.getElementById('trendSummary').style.display = '';

  if (mode === 'percentage') series = convertToPercentage(series);
  else if (mode === 'index') series = convertToIndex(series);

  drawChart(series, mode);
  document.getElementById('trendSummary').innerHTML = getTrendSummary(series, mode);
}

function drawChart(series, mode) {
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  const W = 900, H = 500;
  const m = { top: 50, right: 280, bottom: 70, left: 80 };
  const pw = W - m.left - m.right, ph = H - m.top - m.bottom;

  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('BasketIndex — Ценови тенденции', m.left, 32);
  ctx.fillStyle = '#666'; ctx.font = '12px sans-serif';
  const subtitles = { index: 'Индекс (100 = начален период)', percentage: 'Промяна спрямо първия период (%)', nominal: 'Средна цена (лв)' };
  ctx.fillText(subtitles[mode] || '', m.left, 50);

  const buckets = getAllBuckets(series);
  if (buckets.length < 2) return;

  let maxV = -Infinity, minV = Infinity;
  for (const s of series) for (const p of s.points) { if (p.avgPrice > maxV) maxV = p.avgPrice; if (p.avgPrice < minV) minV = p.avgPrice; }

  if (mode === 'percentage') {
    const abs = Math.max(Math.abs(maxV), Math.abs(minV), 5);
    maxV = Math.ceil(abs * 1.2); minV = -maxV;
  } else if (mode === 'index') {
    minV = Math.min(90, Math.floor(minV / 5) * 5);
    maxV = Math.max(130, Math.ceil(maxV / 5) * 5);
  } else {
    if (minV > 0) minV = 0;
    maxV = Math.ceil(maxV * 1.15);
  }
  const range = maxV - minV;

  // Grid
  ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = m.top + (ph / 4) * i;
    ctx.beginPath(); ctx.moveTo(m.left, y); ctx.lineTo(W - m.right, y); ctx.stroke();
    const val = maxV - (range / 4) * i;
    ctx.fillStyle = '#999'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    const label = mode === 'nominal' ? Math.round(val * 100) / 100 + ' лв' : Math.round(val) + (mode === 'percentage' ? '%' : '');
    ctx.fillText(label, m.left - 8, y + 4);
  }

  // Zero / 100 baseline
  const baseline = mode === 'index' ? 100 : 0;
  if ((baseline >= minV && baseline <= maxV) || mode === 'index') {
    const by = m.top + ph - ((baseline - minV) / range) * ph;
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.left, by); ctx.lineTo(W - m.right, by); ctx.stroke();
  }

  // X-axis vertical
  const xStep = pw / (buckets.length - 1);
  ctx.save();
  for (let i = 0; i < buckets.length; i++) {
    const x = m.left + xStep * i;
    const label = series[0]?.points.find(p => p.bucket === buckets[i])?.bucketLabel || buckets[i];
    ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.translate(x, H - m.bottom + 18); ctx.rotate(-Math.PI / 3);
    ctx.fillText(label, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();

  // Lines
  for (let si = 0; si < series.length; si++) {
    const s = series[si]; const color = COLORS[si % COLORS.length];
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    let prevX;
    for (let i = 0; i < buckets.length; i++) {
      const pt = s.points.find(p => p.bucket === buckets[i]); if (!pt) continue;
      const x = m.left + xStep * i, y = m.top + ph - ((pt.avgPrice - minV) / range) * ph;
      if (!prevX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      prevX = x; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.stroke();
  }

  // Legend
  ctx.textAlign = 'left'; ctx.font = '11px sans-serif'; let ly = m.top + 10;
  for (let si = 0; si < series.length; si++) {
    const s = series[si]; const x = W - m.right + 10;
    ctx.fillStyle = COLORS[si % COLORS.length]; ctx.fillRect(x - 12, ly - 6, 8, 8);
    ctx.fillStyle = '#333';
    const lbl = (s.label || s.name).length > 28 ? (s.label || s.name).slice(0, 25) + '...' : (s.label || s.name);
    ctx.fillText(lbl + ' (' + s.totalObservations + ')', x, ly); ly += 16;
  }

  ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(LANDING_URL, W - m.right, H - 12);
  encodeQR(ctx, W - 54, H - 54, 42, LANDING_URL);
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function exportPng() {
  const c = document.getElementById('chartCanvas');
  c.toBlob(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'basketindex-price-trends.png'; a.click(); URL.revokeObjectURL(u); }, 'image/png');
}
