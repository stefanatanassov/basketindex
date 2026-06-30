// trends/trends.js
// Trends page — multi-select runs + searchable multi-select items, index/percent/nominal.

import { loadRuns, getRunOptions, getItemOptions, getAvailableDateRange, buildAggregateSeries, buildSelectedSeries, collectEvidence, convertToPercentage, convertToIndex, getAllBuckets, getTrendSummary, sanitizeDisplayName, getRichestRun, getTopProductId } from '../lib/trends.js';
import { encodeQR } from '../lib/qr.js';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#ca8a04', '#4f46e5', '#059669'];
const LANDING_URL = 'https://basketindex.stefanatanasov.dev/';

let runs = [], itemOptions = [], runOptions = [];
let selectedIds = new Set();
let isAllItems = true;
let selectedRunIds = new Set();
let isAllRuns = false;
let itemsDropdownOpen = false;
let runsDropdownOpen = false;
let hitAreas = [];
let evidenceRows = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  runs = await loadRuns();
  if (runs.length === 0) return;

  runOptions = getRunOptions(runs);
  renderRunList('');

  // Default to richest run
  const richest = getRichestRun(runs);
  if (richest) {
    selectedRunIds = new Set([richest.runId]);
    isAllRuns = false;
    updateRunsToggleLabel();
    initDateRange(selectedRunIds);
    itemOptions = getItemOptions(runs, selectedRunIds);
    const topId = getTopProductId(runs, selectedRunIds);
    if (topId) {
      selectedIds = new Set([topId]);
      isAllItems = false;
      updateToggleLabel();
    }
  } else {
    isAllRuns = true;
    selectedRunIds = new Set();
    initDateRange(null);
    itemOptions = getItemOptions(runs, null);
  }

  if (itemOptions.length === 0) {
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
  document.getElementById('trendSummary').style.display = '';
  renderItemList('');
}

function bindEvents() {
  document.getElementById('aggregation').addEventListener('change', renderChart);
  document.getElementById('valueType').addEventListener('change', renderChart);
  document.getElementById('exportPngBtn').addEventListener('click', exportAnalysisPng);
  document.getElementById('exportSocialBtn').addEventListener('click', exportSocialCard);
  document.getElementById('itemsToggle').addEventListener('click', toggleItemsDropdown);
  document.getElementById('itemsSearch').addEventListener('input', (e) => renderItemList(e.target.value));
  document.getElementById('runsToggle').addEventListener('click', toggleRunsDropdown);
  document.getElementById('runsSearch').addEventListener('input', (e) => renderRunList(e.target.value));
  document.getElementById('dateFrom').addEventListener('change', () => { validateDateRange(); renderChart(); });
  document.getElementById('dateTo').addEventListener('change', () => { validateDateRange(); renderChart(); });
  document.getElementById('chartCanvas').addEventListener('mousemove', onCanvasMove);
  document.getElementById('chartCanvas').addEventListener('mouseleave', hideTooltip);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('receiptModal').addEventListener('click', (e) => { if (e.target === document.getElementById('receiptModal')) closeModal(); });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.multi-select')) { closeItemsDropdown(); closeRunsDropdown(); }
  });
}

// --- Run multi-select ---

function toggleRunsDropdown() {
  runsDropdownOpen = !runsDropdownOpen;
  document.getElementById('runsDropdown').style.display = runsDropdownOpen ? '' : 'none';
  if (runsDropdownOpen) {
    document.getElementById('runsSearch').focus();
    renderRunList(document.getElementById('runsSearch').value);
  }
}

function closeRunsDropdown() {
  runsDropdownOpen = false;
  document.getElementById('runsDropdown').style.display = 'none';
}

function renderRunList(search) {
  const list = document.getElementById('runsList');
  const q = (search || '').toLowerCase();
  const filtered = q ? runOptions.filter(r => r.label.toLowerCase().includes(q)) : runOptions;

  list.innerHTML = '';
  for (const ro of filtered) {
    const label = document.createElement('label');
    label.className = 'multi-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = ro.runId;
    cb.checked = !isAllRuns && selectedRunIds.has(ro.runId);
    cb.addEventListener('change', () => onRunToggle(ro.runId, cb.checked));
    label.appendChild(cb);
    label.appendChild(document.createTextNode(ro.label));
    list.appendChild(label);
  }
  if (filtered.length === 0) {
    list.innerHTML = '<div class="multi-empty">Няма съвпадения</div>';
  }
}

function onRunToggle(runId, checked) {
  if (checked) {
    selectedRunIds.add(runId);
    isAllRuns = false;
  } else {
    selectedRunIds.delete(runId);
    if (selectedRunIds.size === 0) isAllRuns = true;
  }
  updateRunsToggleLabel();
  refreshItems();
}

function updateRunsToggleLabel() {
  const btn = document.getElementById('runsToggle');
  if (isAllRuns) btn.textContent = 'Всички извличания';
  else if (selectedRunIds.size === 1) {
    const ro = runOptions.find(r => r.runId === [...selectedRunIds][0]);
    btn.textContent = ro ? ro.label : '1 избрано';
  } else {
    btn.textContent = `${selectedRunIds.size} избрани`;
  }
}

function getScopeRunIds() {
  return isAllRuns ? null : selectedRunIds;
}

function refreshItems() {
  const scopeRunIds = getScopeRunIds();
  itemOptions = getItemOptions(runs, scopeRunIds);
  initDateRange(scopeRunIds);
  renderItemList(document.getElementById('itemsSearch').value);
  renderChart();
}

// --- Item multi-select ---

function renderItemList(search) {
  const list = document.getElementById('itemsList');
  const q = (search || '').toLowerCase();
  const filtered = q ? itemOptions.filter(it => it.label.toLowerCase().includes(q)) : itemOptions;

  list.innerHTML = '';
  for (const it of filtered) {
    const label = document.createElement('label');
    label.className = 'multi-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = it.id;
    cb.checked = !isAllItems && selectedIds.has(it.id);
    cb.addEventListener('change', () => onItemToggle(it.id, cb.checked));
    label.appendChild(cb);
    label.appendChild(document.createTextNode(it.label + ' '));
    const count = document.createElement('span');
    count.className = 'multi-count';
    count.textContent = it.count;
    label.appendChild(count);
    list.appendChild(label);
  }
  if (filtered.length === 0) {
    list.innerHTML = '<div class="multi-empty">Няма съвпадения</div>';
  }
}

function onItemToggle(id, checked) {
  if (checked) {
    selectedIds.add(id);
    isAllItems = false;
  } else {
    selectedIds.delete(id);
    if (selectedIds.size === 0) isAllItems = true;
  }
  updateToggleLabel();
  renderChart();
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
  else btn.textContent = `${selectedIds.size} избрани`;
}

// --- Date range ---

function initDateRange(scopeRunIds) {
  const { minDate, maxDate } = getAvailableDateRange(runs, scopeRunIds);
  document.getElementById('dateFrom').value = minDate || '';
  document.getElementById('dateTo').value = maxDate || '';
}

function getDateFrom() { return document.getElementById('dateFrom').value || null; }
function getDateTo() { return document.getElementById('dateTo').value || null; }

let validatingDates = false;
function validateDateRange() {
  if (validatingDates) return;
  const from = getDateFrom();
  const to = getDateTo();
  if (from && to && from > to) {
    validatingDates = true;
    document.getElementById('dateFrom').value = to;
    document.getElementById('dateTo').value = from;
    validatingDates = false;
  }
}

function getValueMode() { return document.getElementById('valueType').value; }
function getAgg() { return document.getElementById('aggregation').value || 'quarter'; }

// --- Chart ---

function renderChart() {
  const scopeRunIds = getScopeRunIds();
  const agg = getAgg();
  const mode = getValueMode();
  const dateFrom = getDateFrom();
  const dateTo = getDateTo();

  let series;
  if (isAllItems) {
    series = buildAggregateSeries(runs, scopeRunIds, agg, dateFrom, dateTo);
  } else {
    if (selectedIds.size === 0) {
      document.getElementById('chartContainer').style.display = 'none';
      document.getElementById('evidenceSection').style.display = 'none';
      return;
    }
    series = buildSelectedSeries(runs, scopeRunIds, Array.from(selectedIds), agg, dateFrom, dateTo);
  }

  if (!series.length || series.every(s => s.points.length < 2)) {
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('trendSummary').style.display = 'none';
    document.getElementById('evidenceSection').style.display = 'none';
    showEmptyMessage('Няма достатъчно данни за избрания период.');
    return;
  }

  hideEmptyMessage();

  document.getElementById('chartContainer').style.display = '';
  document.getElementById('trendSummary').style.display = '';

  if (mode === 'percentage') series = convertToPercentage(series);
  else if (mode === 'index') series = convertToIndex(series);

  drawChart(series, mode);
  document.getElementById('trendSummary').innerHTML = getTrendSummary(series, mode);
  renderEvidence();
}

function drawChart(series, mode) {
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  const W = 900, H = 540;
  const margin = { top: 80, right: 50, bottom: 55, left: 70 };
  const innerPad = 6;
  const pw = W - margin.left - margin.right - innerPad * 2;
  const ph = H - margin.top - margin.bottom;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fafbfc'; ctx.fillRect(0, 0, W, H);

  // Title — centered
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 20px -apple-system, sans-serif';
  ctx.fillText('BasketIndex  ·  Ценови тенденции', W / 2, margin.top - 48);

  // Subtitle — centered
  ctx.fillStyle = '#555'; ctx.font = '13px -apple-system, sans-serif';
  const subtitles = {
    index: 'Индекс  ·  100 = начален период  ·  над 100 = по-скъпо',
    percentage: 'Процентна промяна спрямо началния период',
    nominal: 'Средна платена цена в лева за всеки период'
  };
  ctx.fillText(subtitles[mode] || '', W / 2, margin.top - 28);

  // Context line — centered
  const s0 = series[0];
  const allObs = series.reduce((s, ser) => s + ser.totalObservations, 0);
  const buckets = getAllBuckets(series);
  const firstLabel = s0.points.find(p => p.bucket === buckets[0])?.bucketLabel || buckets[0];
  const lastLabel = s0.points.find(p => p.bucket === buckets[buckets.length - 1])?.bucketLabel || buckets[buckets.length - 1];
  const modeLabel = mode === 'index' ? 'Индекс' : mode === 'percentage' ? 'Проценти' : 'лв';
  const ctxLine = series.length === 1 ? (s0.label || s0.name) : `${series.length} серии`;
  ctx.fillStyle = '#888'; ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText(`${ctxLine}  ·  ${firstLabel}  –  ${lastLabel}  ·  ${allObs} покупки  ·  ${modeLabel}`, W / 2, margin.top - 12);
  ctx.textAlign = 'left';

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
  const range = maxV - minV || 1;

  const plotLeft = margin.left + innerPad;
  const plotRight = W - margin.right - innerPad;

  // Plot area background
  ctx.fillStyle = '#fff';
  ctx.fillRect(margin.left, margin.top, W - margin.left - margin.right, ph);
  ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1;
  ctx.strokeRect(margin.left, margin.top, W - margin.left - margin.right, ph);

  // Grid
  ctx.strokeStyle = '#eef0f2'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = margin.top + (ph / 4) * i;
    ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(margin.left + W - margin.left - margin.right, y); ctx.stroke();
    const val = maxV - (range / 4) * i;
    ctx.fillStyle = '#777'; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'right';
    const lbl = mode === 'nominal' ? (val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)) + ' лв' : Math.round(val) + (mode === 'percentage' ? '%' : '');
    ctx.fillText(lbl, margin.left - 8, y + 4);
  }

  // Baseline
  const baseline = mode === 'index' ? 100 : 0;
  if ((baseline >= minV && baseline <= maxV) || mode === 'index') {
    const by = margin.top + ph - ((baseline - minV) / range) * ph;
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(margin.left, by); ctx.lineTo(margin.left + W - margin.left - margin.right, by); ctx.stroke();
    ctx.setLineDash([]);
  }

  // X-axis labels
  const xStep = (plotRight - plotLeft) / (buckets.length - 1);
  ctx.save();
  for (let i = 0; i < buckets.length; i++) {
    const x = plotLeft + xStep * i;
    const label = series[0]?.points.find(p => p.bucket === buckets[i])?.bucketLabel || buckets[i];
    ctx.fillStyle = '#777'; ctx.font = '10px -apple-system, sans-serif'; ctx.textAlign = 'right';
    ctx.translate(x, H - margin.bottom + 16); ctx.rotate(-Math.PI / 3);
    ctx.fillText(label, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();

  // Lines + points — two-pass: all lines first, then all points on top
  hitAreas = [];

  // Pass 1: draw all lines
  for (let si = 0; si < series.length; si++) {
    const s = series[si]; const color = COLORS[si % COLORS.length];
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
    let started = false;
    for (let i = 0; i < buckets.length; i++) {
      const pt = s.points.find(p => p.bucket === buckets[i]); if (!pt) continue;
      const x = plotLeft + xStep * i;
      const y = margin.top + ph - ((pt.avgPrice - minV) / range) * ph;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Pass 2: draw points on top of lines
  for (let si = 0; si < series.length; si++) {
    const s = series[si]; const color = COLORS[si % COLORS.length];
    for (let i = 0; i < buckets.length; i++) {
      const pt = s.points.find(p => p.bucket === buckets[i]); if (!pt) continue;
      const x = plotLeft + xStep * i;
      const y = margin.top + ph - ((pt.avgPrice - minV) / range) * ph;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      hitAreas.push({ x, y, point: pt, series: s, color, si });
    }
  }

  // Legend — compact, single-line per series
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  let lx = plotLeft;
  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const name = s.label || s.name || '';
    const shortName = name.length > 22 ? name.slice(0, 19) + '…' : name;
    const txt = shortName + ' (' + s.totalObservations + ')' + (s.totalEur > 0 ? ' · €' + s.totalEur.toFixed(2) : '');
    const tw = ctx.measureText(txt).width;
    if (lx + tw + 20 > plotRight && lx > plotLeft) { lx = plotLeft; }
    ctx.fillStyle = COLORS[si % COLORS.length];
    ctx.fillRect(lx, H - margin.bottom + 8, 8, 8);
    ctx.fillStyle = '#555';
    ctx.fillText(txt, lx + 12, H - margin.bottom + 16);
    lx += tw + 20;
  }

  // Footer
  ctx.textAlign = 'right';
  ctx.fillStyle = '#aaa'; ctx.font = '10px -apple-system, sans-serif';
  ctx.fillText('basketindex.stefanatanasov.dev', plotRight, H - 6);
}

function exportAnalysisPng() {
  const c = document.getElementById('chartCanvas');
  c.toBlob(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'basketindex-trends-analysis.png'; a.click(); URL.revokeObjectURL(u); }, 'image/png');
}

function exportSocialCard() {
  const screenCanvas = document.getElementById('chartCanvas');
  const W = 1200, H = 630;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Get current series data from screen
  const mode = getValueMode();
  const scopeRunIds = getScopeRunIds();
  const agg = getAgg();
  const dateFrom = getDateFrom();
  const dateTo = getDateTo();
  let series;
  if (isAllItems) {
    series = buildAggregateSeries(runs, scopeRunIds, agg, dateFrom, dateTo);
  } else {
    series = buildSelectedSeries(runs, scopeRunIds, Array.from(selectedIds), agg, dateFrom, dateTo);
  }
  if (mode === 'percentage') series = convertToPercentage(series);
  else if (mode === 'index') series = convertToIndex(series);
  if (!series.length) { alert('Няма данни за генериране на social card.'); return; }

  const s0 = series[0];
  const lastPt = s0.points[s0.points.length - 1];
  const buckets = getAllBuckets(series);

  function bucketToMonthYear(bucketKey) {
    const pt = s0.points.find(p => p.bucket === bucketKey);
    const label = pt?.bucketLabel || bucketKey;
    // Convert '2026/04' or '2026-04' to '04.2026'; '2026' stays '2026'
    const m1 = label.match(/^(\d{4})[\/\-](\d{2})$/);
    if (m1) return `${m1[2]}.${m1[1]}`;
    return label;
  }

  // Background
  ctx.fillStyle = '#0f0f1a'; ctx.fillRect(0, 0, W, H);

  // Accent bar
  ctx.fillStyle = '#4a90d9'; ctx.fillRect(0, 0, W, 6);

  // Brand
  ctx.fillStyle = '#888'; ctx.font = '14px -apple-system, sans-serif';
  ctx.fillText('BasketIndex', 60, 60);

  // Headline
  ctx.fillStyle = '#fff'; ctx.font = 'bold 32px -apple-system, sans-serif';
  const label = s0.label || s0.name || '';
  const headline = label.length > 45 ? label.slice(0, 42) + '...' : label;
  ctx.fillText(headline, 60, 120);

  // Date range subtitle
  ctx.fillStyle = '#999'; ctx.font = '16px -apple-system, sans-serif';
  const rangeStr = buckets.length > 1
    ? `${bucketToMonthYear(buckets[0])} – ${bucketToMonthYear(buckets[buckets.length - 1])}`
    : '';
  ctx.fillText(rangeStr, 60, 155);

  // Key statistic
  let statText = '';
  if (mode === 'nominal') statText = lastPt.avgPrice.toFixed(2) + ' лв';
  else if (mode === 'index') {
    const d = Math.round(lastPt.avgPrice - 100);
    statText = (d > 0 ? '+' : '') + d + '%';
  } else statText = (lastPt.avgPrice > 0 ? '+' : '') + Math.round(lastPt.avgPrice) + '%';

  ctx.fillStyle = '#4a90d9'; ctx.font = 'bold 72px -apple-system, sans-serif';
  ctx.fillText(statText, 60, 260);

  // Interpretation
  let interp = '';
  if (mode === 'index' || mode === 'percentage') {
    const d = mode === 'index' ? Math.round(lastPt.avgPrice - 100) : Math.round(lastPt.avgPrice);
    if (d > 0) interp = 'спрямо началото на периода';
    else if (d < 0) interp = 'спрямо началото на периода';
    else interp = 'без промяна спрямо началото на периода';
  } else {
    interp = 'средна платена цена в последния период';
  }
  ctx.fillStyle = '#777'; ctx.font = '16px -apple-system, sans-serif';
  ctx.fillText(interp, 60, 295);

  // Mini chart (sparkline area)
  if (buckets.length > 1) {
    const plotX = 60, plotW = W - 120, plotY = 330, plotH = 200;
    const allPts = s0.points;
    let minV2 = Infinity, maxV2 = -Infinity;
    for (const p of allPts) { if (p.avgPrice < minV2) minV2 = p.avgPrice; if (p.avgPrice > maxV2) maxV2 = p.avgPrice; }
    const vRange = maxV2 - minV2 || 1;
    // Axis line
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(plotX, plotY + plotH); ctx.lineTo(plotX + plotW, plotY + plotH); ctx.stroke();
    // Sparkline
    ctx.strokeStyle = '#4a90d9'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < allPts.length; i++) {
      const x = plotX + (plotW / (allPts.length - 1)) * i;
      const y = plotY + plotH - ((allPts[i].avgPrice - minV2) / vRange) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Fill below
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(74, 144, 217, 0.12)';
    ctx.fill();
    // Endpoint dot
    const lastX = plotX + plotW;
    const lastY = plotY + plotH - ((lastPt.avgPrice - minV2) / vRange) * plotH;
    ctx.fillStyle = '#4a90d9'; ctx.beginPath(); ctx.arc(lastX, lastY, 6, 0, Math.PI * 2); ctx.fill();
  }

  // Footer
  ctx.fillStyle = '#555'; ctx.font = '12px -apple-system, sans-serif';
  ctx.fillText('basketindex.stefanatanasov.dev', W - 60, H - 30);

  // Disclaimer
  ctx.textAlign = 'right';
  ctx.fillStyle = '#444'; ctx.font = '10px -apple-system, sans-serif';
  ctx.fillText('Базирано на реални покупки · не е официален инфлационен анализ', W - 60, H - 15);

  c.toBlob(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'basketindex-social-card.png'; a.click(); URL.revokeObjectURL(u); }, 'image/png');
}

function showEmptyMessage(msg) {
  const el = document.getElementById('chartContainer');
  let box = document.getElementById('emptyChartMsg');
  if (!box) {
    box = document.createElement('div');
    box.id = 'emptyChartMsg';
    box.className = 'empty-chart-msg';
    el.parentNode.insertBefore(box, el.nextSibling);
  }
  box.textContent = msg;
  box.style.display = '';
}

function hideEmptyMessage() {
  const box = document.getElementById('emptyChartMsg');
  if (box) box.style.display = 'none';
}

function onCanvasMove(e) {
  const canvas = document.getElementById('chartCanvas');
  const rect = canvas.getBoundingClientRect();
  const scaleX = 900 / rect.width;
  const scaleY = 540 / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  let best = null, bestDist = 18;
  for (const h of hitAreas) {
    const d = Math.sqrt((h.x - mx) ** 2 + (h.y - my) ** 2);
    if (d < bestDist) { bestDist = d; best = h; }
  }

  if (best) showTooltip(e, best);
  else hideTooltip();
}

function showTooltip(e, hit) {
  const tip = document.getElementById('tooltip');
  const mode = getValueMode();
  const pt = hit.point;
  const s = hit.series;

  let valueLine = '';
  let interpLine = '';
  if (mode === 'nominal') {
    valueLine = `Средна цена за периода: <strong>${pt.origAvgPrice.toFixed(2)} лв</strong>`;
  } else if (mode === 'index') {
    valueLine = `Индекс за периода: <strong>${Math.round(pt.avgPrice)}</strong>`;
    const d = Math.round(pt.avgPrice - 100);
    if (d > 0) interpLine = `≈ ${d}% по-скъпо от началото`;
    else if (d < 0) interpLine = `≈ ${Math.abs(d)}% по-евтино от началото`;
    else interpLine = `≈ без промяна спрямо началото`;
  } else {
    valueLine = `Промяна спрямо началото: <strong>${pt.avgPrice > 0 ? '+' : ''}${Math.round(pt.avgPrice)}%</strong>`;
    const a = Math.abs(Math.round(pt.avgPrice));
    interpLine = pt.avgPrice > 0 ? `≈ ${a}% по-скъпо от началото`
      : pt.avgPrice < 0 ? `≈ ${a}% по-евтино от началото`
      : `≈ без промяна спрямо началото`;
  }

  const bgnStr = pt.totalBgn > 0 ? `${pt.totalBgn.toFixed(2)} лв` : '';
  const eurStr = pt.totalEur > 0 ? ` · €${pt.totalEur.toFixed(2)}` : '';
  const spendLine = (bgnStr || eurStr) ? `Общо: ${bgnStr}${eurStr}` : '';

  let html = `<span class="tt-label">${escStr(s.label || s.name)}</span>`;
  html += `<span class="tt-period">Период: ${pt.bucketLabel}</span>`;
  html += `<div class="tt-value">${valueLine}</div>`;
  if (interpLine) html += `<div class="tt-interp">${interpLine}</div>`;
  html += `<div class="tt-meta">Покупки: ${pt.observations}</div>`;
  if (spendLine) html += `<div class="tt-meta">${spendLine}</div>`;
  if (pt.observations < 3) html += `<div class="tt-sparse">Ограничени данни: ${pt.observations} покупки</div>`;

  tip.innerHTML = html;
  tip.style.display = '';

  const canvas = document.getElementById('chartCanvas');
  const rect = canvas.getBoundingClientRect();
  let left = hit.x / 900 * rect.width + 12;
  let top = hit.y / 540 * rect.height - 30;

  if (left + 260 > rect.right) left = hit.x / 900 * rect.width - 12 - 260;
  if (top < 0) top = 5;
  if (top + 140 > rect.bottom) top = rect.height - 150;

  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

function renderEvidence() {
  const sec = document.getElementById('evidenceSection');
  const table = document.getElementById('evidenceTable');
  const meta = document.getElementById('evidenceMeta');

  const scopeRunIds = getScopeRunIds();
  const dateFrom = getDateFrom();
  const dateTo = getDateTo();
  const selIds = isAllItems ? null : Array.from(selectedIds);

  const rows = collectEvidence(runs, scopeRunIds, selIds, dateFrom, dateTo);

  evidenceRows = rows;

  if (!rows.length) {
    sec.style.display = 'none';
    return;
  }

  sec.style.display = '';
  const scopeLabel = isAllRuns ? 'всички извличания' : `${selectedRunIds.size} избрани`;
  const itemLabel = isAllItems ? 'всички артикули' : `${selectedIds.size} избрани`;
  const rangeLabel = dateFrom || dateTo ? ` (${dateFrom || 'начало'} – ${dateTo || 'край'})` : '';
  meta.textContent = `${rows.length} покупки · ${scopeLabel} · ${itemLabel}${rangeLabel}`;

  const header = `<table><thead><tr>
    <th>Търговец</th><th>Дата</th><th>Продукт</th><th>Кол.</th><th>Ед. цена</th><th>Общо</th><th>Валута</th><th>Източник</th>
  </tr></thead><tbody>`;

  let body = '';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rl = retailerLabel(r.retailer);
    let linkHtml;
    if (r.receiptLink) {
      linkHtml = `<a class="ev-link" href="${escAttr(r.receiptLink)}" target="_blank" rel="noopener">преглед</a>`;
    } else if (r.needsModal) {
      linkHtml = `<button class="ev-modal-btn" data-ev-idx="${i}">преглед</button>`;
    } else {
      linkHtml = '';
    }
    body += `<tr>
      <td>${escStr(rl)}</td>
      <td>${escStr(r.receiptDate)}</td>
      <td>${escStr(r.productName)}</td>
      <td>${r.quantity}</td>
      <td class="ev-price">${formatMoney(r.unitPricePrimary, '')}</td>
      <td class="ev-price">${formatMoney(r.lineTotalPrimary, '')}</td>
      <td class="ev-currency">${escStr(r.primaryCurrency || '—')}</td>
      <td>${linkHtml}</td>
    </tr>`;
  }

  table.innerHTML = header + body + '</tbody></table>';

  table.querySelectorAll('.ev-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.evIdx);
      openReceiptModal(evidenceRows[idx]);
    });
  });
}

function escStr(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function retailerLabel(r) { return r === 'lidl' ? 'Лидл' : r === 'metro' ? 'МЕТРО' : r.toUpperCase(); }
function normalizeMatchText(text) { return sanitizeDisplayName(text || '').toUpperCase().replace(/\s+/g, ' ').trim(); }

function formatMoney(value, currency) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const amount = Number(value).toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
}

function getItemPrimaryPricing(item, quantity) {
  const pricing = item.pricing || {};
  const primaryCurrency = pricing.unit_price_bgn != null || pricing.line_total_bgn != null
    ? 'лв'
    : pricing.unit_price_eur != null || pricing.line_total_eur != null
      ? 'EUR'
      : '';
  const unitPrice = pricing.unit_price_primary
    ?? pricing.unit_price_bgn
    ?? pricing.unit_price_eur
    ?? pricing.line_total_primary
    ?? 0;
  const lineTotal = pricing.line_total_primary
    ?? pricing.line_total_bgn
    ?? pricing.line_total_eur
    ?? (unitPrice * (quantity || 1));

  return { unitPrice, lineTotal, primaryCurrency };
}

function openReceiptModal(row) {
  const run = runs.find(r => r.runId === row.runId);
  const receipts = (run && run.results) || [];
  const receipt = receipts.find(rc => (rc.receipt?.id || '') === row.receiptId);
  if (!receipt) return;

  const rl = retailerLabel(row.retailer);
  document.getElementById('modalTitle').textContent = `Касова бележка — ${rl}`;
  const totals = receipt.totals || {};
  const store = receipt.store || {};
  const currency = receipt.currency || {};
  const selectedProductKey = normalizeMatchText(row.productName);

  let html = `<div class="detail-row"><span class="detail-label">Търговец</span><span class="detail-value">${escStr(rl)}</span></div>`;
  html += `<div class="detail-row"><span class="detail-label">Дата</span><span class="detail-value">${escStr(receipt.receipt?.datetime_local || row.receiptDate)}</span></div>`;
  if (row.receiptId) html += `<div class="detail-row"><span class="detail-label">Номер</span><span class="detail-value">${escStr(row.receiptId)}</span></div>`;
  if (store.code) html += `<div class="detail-row"><span class="detail-label">Обект</span><span class="detail-value">${escStr(store.code)}${store.name ? ' — ' + escStr(store.name) : ''}</span></div>`;
  if (totals.total_primary != null) {
    const ccy = currency.primary || '';
    html += `<div class="detail-row"><span class="detail-label">Общо</span><span class="detail-value">${Number(totals.total_primary).toFixed(2)} ${escStr(ccy)}</span></div>`;
  }
  if (row.retailer === 'metro') {
    const dateStr = row.receiptDate ? row.receiptDate.split('-').reverse().join('.') : '';
    let guidance = 'Няма пряк линк към конкретна фактура в METRO Docs. ';
    if (dateStr) {
      guidance += `Филтрирай документите за дата <strong>${escStr(dateStr)}</strong>`;
      guidance += row.receiptId
        ? ` и сравни номера на фактурата<strong> (${escStr(row.receiptId)})</strong>.`
        : '.';
    } else if (row.receiptId) {
      guidance += `Сравни номера на фактурата<strong> (${escStr(row.receiptId)})</strong>.`;
    }
    html += `<div class="detail-note">${guidance}</div>`;
  }

  const items = receipt.items || [];
  if (items.length) {
    html += '<h4>Артикули</h4><div class="detail-items">';
    for (const it of items) {
      const name = sanitizeDisplayName(it.product?.name || '');
      if (!name || name.length < 3) continue;
      const qty = it.quantity?.value || 1;
      const { unitPrice, lineTotal, primaryCurrency } = getItemPrimaryPricing(it, qty);
      const isSelected = normalizeMatchText(name) === selectedProductKey;
      html += `<div class="detail-item${isSelected ? ' detail-item-highlight' : ''}"><span class="detail-item-name">${escStr(name)}</span><span class="detail-item-qty">×${qty}</span><span class="detail-item-price">${formatMoney(unitPrice, primaryCurrency)}</span><span class="detail-item-total">${formatMoney(lineTotal, primaryCurrency)}</span></div>`;
    }
    html += '</div>';
  }

  const rid = receipt.receipt?.id || '';
  if (rid && row.retailer === 'lidl') {
    html += `<div style="margin-top:12px"><a class="ev-link" href="https://www.lidl.bg/mre/purchase-detail?t=${escAttr(rid)}" target="_blank" rel="noopener">Отвори в Lidl</a></div>`;
  } else if (row.retailer === 'metro') {
    html += `<div class="detail-actions"><a class="ev-link" href="https://docs.metro.bg/" target="_blank" rel="noopener">Отвори METRO Docs</a></div>`;
  }

  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('receiptModal').style.display = '';
}

function closeModal() {
  document.getElementById('receiptModal').style.display = 'none';
}
