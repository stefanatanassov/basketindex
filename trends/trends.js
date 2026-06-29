// trends/trends.js
// Price trends page — aggregate/specific items, percentage/nominal, vertical labels.

import { loadRuns, getAvailableItems, buildAggregateSeries, buildSelectedSeries, convertToPercentage, getAllBuckets } from '../lib/trends.js';
import { encodeQR } from '../lib/qr.js';

const COLORS = ['#4a90d9', '#e8734a', '#3a8a40', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const LANDING_URL = 'https://basketindex.stefanatanasov.dev/';

let runs = [];
let availableItems = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  runs = await loadRuns();
  if (runs.length === 0) return;

  availableItems = getAvailableItems(runs, null);
  if (availableItems.length === 0) {
    document.getElementById('emptyState').querySelector('p').textContent = 'Няма достатъчно повтарящи се продукти за генериране на тенденции.';
    return;
  }

  showControls();
  bindEvents();
  renderChart();
}

function showControls() {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('controls').style.display = '';
  document.getElementById('chartContainer').style.display = '';
  document.getElementById('methodology').style.display = '';

  // Populate items dropdown
  const sel = document.getElementById('itemsFilter');
  sel.innerHTML = '<option value="__ALL__" selected>Всички артикули</option>';
  for (const it of availableItems) {
    sel.innerHTML += `<option value="${escAttr(it.name)}">${escHtml(it.name)} (${it.count})</option>`;
  }
}

function bindEvents() {
  document.getElementById('retailerFilter').addEventListener('change', () => { refreshItems(); renderChart(); });
  document.getElementById('aggregation').addEventListener('change', renderChart);
  document.getElementById('valueType').addEventListener('change', renderChart);
  document.getElementById('itemsFilter').addEventListener('change', renderChart);
  document.getElementById('exportPngBtn').addEventListener('click', exportPng);
}

function refreshItems() {
  const retailer = getRetailer();
  availableItems = getAvailableItems(runs, retailer);
  const sel = document.getElementById('itemsFilter');
  sel.innerHTML = '<option value="__ALL__">Всички артикули</option>';
  for (const it of availableItems) {
    sel.innerHTML += `<option value="${escAttr(it.name)}">${escHtml(it.name)} (${it.count})</option>`;
  }
  sel.value = '__ALL__';
}

function getRetailer() {
  return document.getElementById('retailerFilter').value || null;
}

function getAggregation() {
  return document.getElementById('aggregation').value || 'quarter';
}

function isPercentage() {
  return document.getElementById('valueType').value === 'percentage';
}

function getSelectedItems() {
  const sel = document.getElementById('itemsFilter');
  return Array.from(sel.selectedOptions).map(o => o.value).filter(v => v !== '__ALL__');
}

function isAllMode() {
  return document.getElementById('itemsFilter').value === '__ALL__';
}

function renderChart() {
  const retailer = getRetailer();
  const agg = getAggregation();
  const pct = isPercentage();

  let series;
  if (isAllMode()) {
    series = buildAggregateSeries(runs, retailer, agg);
  } else {
    const names = getSelectedItems();
    if (names.length === 0) {
      document.getElementById('chartContainer').style.display = 'none';
      document.getElementById('emptyState').style.display = '';
      document.getElementById('emptyState').querySelector('p').textContent = 'Избери поне един артикул.';
      return;
    }
    series = buildSelectedSeries(runs, retailer, names, agg);
  }

  if (series.length === 0 || series.every(s => s.points.length < 2)) {
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('emptyState').style.display = '';
    document.getElementById('emptyState').querySelector('p').textContent = 'Няма достатъчно данни за избрания филтър.';
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chartContainer').style.display = '';

  if (pct) series = convertToPercentage(series);
  drawChart(series, pct);
}

function drawChart(series, isPct) {
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const margin = { top: 50, right: 280, bottom: 70, left: 80 };
  const pw = W - margin.left - margin.right;
  const ph = H - margin.top - margin.bottom;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('BasketIndex — Ценови тенденции', margin.left, 32);
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.fillText(isPct ? 'Промяна спрямо първия период (%)' : 'Средна цена (лв)', margin.left, 50);

  const buckets = getAllBuckets(series);
  if (buckets.length < 2) return;

  // Y range
  let maxVal = -Infinity, minVal = Infinity;
  for (const s of series) for (const p of s.points) {
    if (p.avgPrice > maxVal) maxVal = p.avgPrice;
    if (p.avgPrice < minVal) minVal = p.avgPrice;
  }
  if (isPct) {
    const abs = Math.max(Math.abs(maxVal), Math.abs(minVal), 5);
    maxVal = Math.ceil(abs * 1.2);
    minVal = -maxVal;
  } else {
    if (minVal > 0) minVal = 0;
    maxVal = Math.ceil(maxVal * 1.15);
  }
  const range = maxVal - minVal;

  // Grid
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = margin.top + (ph / 4) * i;
    ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(W - margin.right, y); ctx.stroke();
    const val = maxVal - (range / 4) * i;
    ctx.fillStyle = '#999'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(isPct ? Math.round(val) + '%' : Math.round(val * 100) / 100 + ' лв', margin.left - 8, y + 4);
  }

  // Zero line for percentage mode
  if (isPct && minVal < 0 && maxVal > 0) {
    const zeroY = margin.top + ph - ((0 - minVal) / range) * ph;
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(margin.left, zeroY); ctx.lineTo(W - margin.right, zeroY); ctx.stroke();
  }

  // X-axis vertical labels (YYYY/MM)
  const xStep = pw / (buckets.length - 1);
  ctx.save();
  for (let i = 0; i < buckets.length; i++) {
    const x = margin.left + xStep * i;
    const label = series[0]?.points.find(p => p.bucket === buckets[i])?.bucketLabel || buckets[i];
    ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.translate(x, H - margin.bottom + 18);
    ctx.rotate(-Math.PI / 3); // -60° for readability
    ctx.fillText(label, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();

  // Lines
  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const color = COLORS[si % COLORS.length];
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    let prevX, prevY;
    for (let i = 0; i < buckets.length; i++) {
      const point = s.points.find(p => p.bucket === buckets[i]);
      if (!point) continue;
      const x = margin.left + xStep * i;
      const y = margin.top + ph - ((point.avgPrice - minVal) / range) * ph;
      if (i === 0 || !prevX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      prevX = x; prevY = y;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.stroke();
  }

  // Legend
  ctx.textAlign = 'left'; ctx.font = '11px sans-serif';
  let ly = margin.top + 10;
  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const x = W - margin.right + 10;
    ctx.fillStyle = COLORS[si % COLORS.length]; ctx.fillRect(x - 12, ly - 6, 8, 8);
    ctx.fillStyle = '#333';
    const label = (s.label || s.name).length > 28 ? (s.label || s.name).slice(0, 25) + '...' : (s.label || s.name);
    ctx.fillText(label + ' (' + s.totalObservations + ')', x, ly);
    ly += 16;
  }

  // Footer + QR
  ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(LANDING_URL, W - margin.right, H - 12);
  encodeQR(ctx, W - 54, H - 54, 42, LANDING_URL);
}

function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

function exportPng() {
  const canvas = document.getElementById('chartCanvas');
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'basketindex-price-trends.png'; a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
