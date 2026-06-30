// trends/trends.js
// Trends page — run-scoped, searchable multi-select items, index/percent/nominal.

import { loadRuns, getRunOptions, getItemOptions, getAvailableDateRange, buildAggregateSeries, buildSelectedSeries, collectEvidence, convertToPercentage, convertToIndex, getAllBuckets, getTrendSummary, sanitizeDisplayName } from '../lib/trends.js';
import { encodeQR } from '../lib/qr.js';

const COLORS = ['#4a90d9', '#e8734a', '#3a8a40', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const LANDING_URL = 'https://basketindex.stefanatanasov.dev/';

let runs = [], itemOptions = [];
let selectedIds = new Set();
let isAllItems = true;
let itemsDropdownOpen = false;
let hitAreas = [];  // {x, y, point, series, color} in canvas coords
let evidenceRows = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  runs = await loadRuns();
  if (runs.length === 0) return;

  populateRunFilter();
  initDateRange(null);
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
  document.getElementById('runFilter').addEventListener('change', refreshItems);
  document.getElementById('aggregation').addEventListener('change', renderChart);
  document.getElementById('valueType').addEventListener('change', renderChart);
  document.getElementById('exportPngBtn').addEventListener('click', exportPng);
  document.getElementById('itemsToggle').addEventListener('click', toggleItemsDropdown);
  document.getElementById('itemsSearch').addEventListener('input', (e) => renderItemList(e.target.value));
  document.getElementById('dateFrom').addEventListener('change', () => { validateDateRange(); renderChart(); });
  document.getElementById('dateTo').addEventListener('change', () => { validateDateRange(); renderChart(); });
  document.getElementById('chartCanvas').addEventListener('mousemove', onCanvasMove);
  document.getElementById('chartCanvas').addEventListener('mouseleave', hideTooltip);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('receiptModal').addEventListener('click', (e) => { if (e.target === document.getElementById('receiptModal')) closeModal(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.multi-select')) closeItemsDropdown(); });
}

function refreshItems() {
  const runId = getScopeRunId();
  itemOptions = getItemOptions(runs, runId);
  selectedIds = new Set();
  isAllItems = true;
  initDateRange(runId);
  updateToggleLabel();
  renderItemList(document.getElementById('itemsSearch').value);
  renderChart();
}

function getScopeRunId() {
  const v = document.getElementById('runFilter').value;
  return v === '__ALL__' ? null : v;
}

function initDateRange(scopeRunId) {
  const { minDate, maxDate } = getAvailableDateRange(runs, scopeRunId);
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

function renderChart() {
  const runId = getScopeRunId();
  const agg = getAgg();
  const mode = getValueMode();
  const dateFrom = getDateFrom();
  const dateTo = getDateTo();

  let series;
  if (isAllItems) {
    series = buildAggregateSeries(runs, runId, agg, dateFrom, dateTo);
  } else {
    if (selectedIds.size === 0) {
      document.getElementById('chartContainer').style.display = 'none';
      document.getElementById('evidenceSection').style.display = 'none';
      return;
    }
    series = buildSelectedSeries(runs, runId, Array.from(selectedIds), agg, dateFrom, dateTo);
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
  hitAreas = [];
  for (let si = 0; si < series.length; si++) {
    const s = series[si]; const color = COLORS[si % COLORS.length];
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    let prevX;
    for (let i = 0; i < buckets.length; i++) {
      const pt = s.points.find(p => p.bucket === buckets[i]); if (!pt) continue;
      const x = m.left + xStep * i, y = m.top + ph - ((pt.avgPrice - minV) / range) * ph;
      if (!prevX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      prevX = x; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      hitAreas.push({ x, y, point: pt, series: s, color, si });
    }
    ctx.stroke();
  }

  // Legend
  ctx.textAlign = 'left'; ctx.font = '11px sans-serif'; let ly = m.top + 10;
  for (let si = 0; si < series.length; si++) {
    const s = series[si]; const x = W - m.right + 10;
    ctx.fillStyle = COLORS[si % COLORS.length]; ctx.fillRect(x - 12, ly - 6, 8, 8);
    ctx.fillStyle = '#333';
    const lbl = (s.label || s.name).length > 26 ? (s.label || s.name).slice(0, 23) + '...' : (s.label || s.name);
    ctx.fillText(lbl, x, ly); ly += 14;
    ctx.fillStyle = '#888'; ctx.font = '10px sans-serif';
    const eurStr = (s.totalEur != null && s.totalEur > 0) ? ` · ${s.totalEur.toFixed(2)} €` : '';
    ctx.fillText(`${s.totalObservations} пок.${eurStr}`, x, ly); ly += 14;
    ctx.fillStyle = '#333'; ctx.font = '11px sans-serif';
  }

  ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(LANDING_URL, W - m.right, H - 12);
  encodeQR(ctx, W - 54, H - 54, 42, LANDING_URL);
}

function exportPng() {
  const c = document.getElementById('chartCanvas');
  c.toBlob(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'basketindex-price-trends.png'; a.click(); URL.revokeObjectURL(u); }, 'image/png');
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
  const scaleY = 500 / rect.height;
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
  if (mode === 'nominal') valueLine = `Средна цена за периода: <strong>${pt.origAvgPrice.toFixed(2)} лв</strong>`;
  else if (mode === 'index') valueLine = `Индекс за периода: <strong>${Math.round(pt.avgPrice)}</strong>`;
  else valueLine = `Промяна спрямо началото: <strong>${pt.avgPrice > 0 ? '+' : ''}${Math.round(pt.avgPrice)}%</strong>`;

  const bgnStr = pt.totalBgn > 0 ? `${pt.totalBgn.toFixed(2)} лв` : '';
  const eurStr = pt.totalEur > 0 ? ` · €${pt.totalEur.toFixed(2)}` : '';
  const spendLine = (bgnStr || eurStr) ? `Общо: ${bgnStr}${eurStr}` : '';

  let html = `<span class="tt-label">${escStr(s.label || s.name)}</span>`;
  html += `<span class="tt-period">Период: ${pt.bucketLabel}</span>`;
  html += `<div class="tt-value">${valueLine}</div>`;
  html += `<div class="tt-meta">Покупки: ${pt.observations}</div>`;
  if (spendLine) html += `<div class="tt-meta">${spendLine}</div>`;
  if (pt.observations < 3) html += `<div class="tt-sparse">Ограничени данни: ${pt.observations} покупки</div>`;

  tip.innerHTML = html;
  tip.style.display = '';

  const canvas = document.getElementById('chartCanvas');
  const rect = canvas.getBoundingClientRect();
  let left = hit.x / 900 * rect.width + 12;
  let top = hit.y / 500 * rect.height - 30;

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

  const runId = getScopeRunId();
  const dateFrom = getDateFrom();
  const dateTo = getDateTo();
  const selIds = isAllItems ? null : Array.from(selectedIds);

  const rows = collectEvidence(runs, runId, selIds, dateFrom, dateTo);

  evidenceRows = rows;

  if (!rows.length) {
    sec.style.display = 'none';
    return;
  }

  sec.style.display = '';
  const scopeLabel = runId ? 'едно извличане' : 'всички извличания';
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
