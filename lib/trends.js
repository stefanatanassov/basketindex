// lib/trends.js
// Price trend computation from BasketIndex run history.
// Supports run-scoped filtering, namespaced item ids, index/percent/nominal.

import { loadRuns } from './run-history.js';

const QUARTER_MONTHS = { 1: '01', 2: '04', 3: '07', 4: '10' };

function normalizeName(name) {
  return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function sanitizeDisplayName(text) {
  return (text || '')
    .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQuarterKey(dateStr) {
  const d = new Date(dateStr);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function getQuarterLabel(bucket) {
  const m = bucket.match(/^(\d{4})-Q(\d)$/);
  if (!m) return bucket;
  return `${m[1]}/${QUARTER_MONTHS[parseInt(m[2])] || '01'}`;
}

function getYearKey(dateStr) { return new Date(dateStr).getFullYear().toString(); }
function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function extractUnitPrice(item) {
  return item.pricing?.unit_price_bgn || item.pricing?.line_total_bgn
    || item.pricing?.unit_price_eur || item.pricing?.unit_price_primary || 0;
}

function extractEurPrice(item) {
  const eur = item.pricing?.unit_price_eur ?? item.pricing?.line_total_eur;
  if (eur && eur > 0) return eur;
  const bgn = item.pricing?.unit_price_bgn ?? item.pricing?.line_total_bgn;
  if (bgn && bgn > 0) return Math.round(bgn / 1.95583 * 100) / 100;
  return 0;
}

function retailerLabel(r) { return r === 'lidl' ? 'Лидл' : r === 'metro' ? 'МЕТРО' : r.toUpperCase(); }

function runLabel(run) {
  const retailer = retailerLabel(run.retailer);
  const d = new Date(run.startedAt || run.completedAt || '').toISOString().slice(0, 16).replace('T', ' ');
  return `${retailer} · ${d}`;
}

function itemDisplayId(runId, name) { return `${runId}::${name}`; }
function parseItemId(id) { const idx = id.indexOf('::'); return { runId: id.slice(0, idx), name: id.slice(idx + 2) }; }

function getRunOptions(runs) {
  return runs.map(r => ({ runId: r.runId, label: runLabel(r), retailer: r.retailer }));
}

function getItemOptions(runs, scopeRunId) {
  const items = new Map();
  for (const run of runs) {
    if (scopeRunId && run.runId !== scopeRunId) continue;
    for (const receipt of (run.results || [])) {
      for (const it of (receipt.items || [])) {
        const name = normalizeName(it.product?.name || '');
        if (!name || name.length < 3) continue;
        const displayName = sanitizeDisplayName(it.product?.name || '');
        const displayId = itemDisplayId(run.runId, name);
        if (!items.has(displayId)) {
          items.set(displayId, {
            id: displayId, runId: run.runId, name, displayName, retailer: run.retailer,
            count: 0, label: `${retailerLabel(run.retailer)} · ${displayName || name}`
          });
        }
        items.get(displayId).count++;
      }
    }
  }
  return Array.from(items.values()).filter(it => it.count >= 3).sort((a, b) => b.count - a.count);
}

function getAvailableDateRange(runs, scopeRunId) {
  let minDate = null, maxDate = null;
  for (const run of runs) {
    if (scopeRunId && run.runId !== scopeRunId) continue;
    for (const receipt of (run.results || [])) {
      const d = receipt.receipt?.date || receipt.receipt?.datetime_local?.slice(0, 10) || '';
      if (!d) continue;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    }
  }
  return { minDate, maxDate };
}

function collectItems(runs, scopeRunId, selectedIds, dateFrom, dateTo) {
  const collected = [];
  const idSet = selectedIds && selectedIds.length > 0 ? new Set(selectedIds) : null;
  const isAll = !idSet;

  for (const run of runs) {
    if (scopeRunId && run.runId !== scopeRunId) continue;
    for (const receipt of (run.results || [])) {
      const date = receipt.receipt?.date || receipt.receipt?.datetime_local?.slice(0, 10) || '';
      if (!date) continue;
      if (dateFrom && date < dateFrom) continue;
      if (dateTo && date > dateTo) continue;
      for (const it of (receipt.items || [])) {
        const name = normalizeName(it.product?.name || '');
        if (!name || name.length < 3) continue;
        const displayName = sanitizeDisplayName(it.product?.name || '');
        const did = itemDisplayId(run.runId, name);
        if (!isAll && !idSet.has(did)) continue;
        const price = extractUnitPrice(it);
        if (price <= 0) continue;
        collected.push({ date, bucket: getQuarterKey(date), name, displayName: displayName || name, displayId: did, runId: run.runId, unitPrice: price, eurPrice: extractEurPrice(it), quantity: it.quantity?.value || 1, retailer: run.retailer });
      }
    }
  }
  return collected;
}

function buildAggregateSeries(runs, scopeRunId, aggregation, dateFrom, dateTo) {
  const fn = aggregation === 'year' ? getYearKey : aggregation === 'month' ? getMonthKey : getQuarterKey;
  const items = collectItems(runs, scopeRunId, null, dateFrom, dateTo);
  const bucketData = new Map();
  let totalEur = 0;
  for (const it of items) {
    const b = fn(it.date);
    if (!bucketData.has(b)) bucketData.set(b, { prices: [], eurPrices: [], bgnPrices: [] });
    const bd = bucketData.get(b);
    bd.prices.push(it.unitPrice);
    bd.eurPrices.push(it.eurPrice);
    bd.bgnPrices.push(it.unitPrice);
    totalEur += it.eurPrice;
  }
  const points = [];
  for (const [bucket, bd] of Array.from(bucketData.entries()).sort()) {
    const avg = bd.prices.reduce((a, x) => a + x, 0) / bd.prices.length;
    points.push({
      bucket, bucketLabel: getQuarterLabel(bucket),
      avgPrice: Math.round(avg * 100) / 100,
      origAvgPrice: Math.round(avg * 100) / 100,
      observations: bd.prices.length,
      totalBgn: Math.round(bd.bgnPrices.reduce((a, x) => a + x, 0) * 100) / 100,
      totalEur: Math.round(bd.eurPrices.reduce((a, x) => a + x, 0) * 100) / 100
    });
  }
  return [{ name: 'ALL', label: 'Всички артикули', totalObservations: points.reduce((s, p) => s + p.observations, 0), totalEur: Math.round(totalEur * 100) / 100, bucketCount: points.length, points }];
}

function buildSelectedSeries(runs, scopeRunId, selectedIds, aggregation, dateFrom, dateTo) {
  const fn = aggregation === 'year' ? getYearKey : aggregation === 'month' ? getMonthKey : getQuarterKey;
  const items = collectItems(runs, scopeRunId, selectedIds, dateFrom, dateTo);
  const seriesMap = new Map();
  for (const it of items) {
    if (!seriesMap.has(it.displayId)) seriesMap.set(it.displayId, { name: it.displayId, label: `${retailerLabel(it.retailer)} · ${it.displayName}`, runId: it.runId, retailer: it.retailer, buckets: new Map(), totalObservations: 0, totalEur: 0, totalBgn: 0 });
    const s = seriesMap.get(it.displayId);
    const b = fn(it.date);
    if (!s.buckets.has(b)) s.buckets.set(b, { prices: [], eurPrices: [], bgnPrices: [] });
    const bd = s.buckets.get(b);
    bd.prices.push(it.unitPrice);
    bd.eurPrices.push(it.eurPrice);
    bd.bgnPrices.push(it.unitPrice);
    s.totalObservations++;
    s.totalEur += it.eurPrice;
    s.totalBgn += it.unitPrice;
  }
  const series = [];
  for (const s of seriesMap.values()) {
    if (s.totalObservations < 3 || s.buckets.size < 2) continue;
    const sorted = Array.from(s.buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const points = sorted.map(([b, bd]) => {
      const avg = bd.prices.reduce((a, x) => a + x, 0) / bd.prices.length;
      return {
        bucket: b, bucketLabel: getQuarterLabel(b),
        avgPrice: Math.round(avg * 100) / 100,
        origAvgPrice: Math.round(avg * 100) / 100,
        observations: bd.prices.length,
        totalBgn: Math.round(bd.bgnPrices.reduce((a, x) => a + x, 0) * 100) / 100,
        totalEur: Math.round(bd.eurPrices.reduce((a, x) => a + x, 0) * 100) / 100
      };
    });
    series.push({ name: s.name, label: s.label, runId: s.runId, retailer: s.retailer, totalObservations: s.totalObservations, totalEur: Math.round(s.totalEur * 100) / 100, totalBgn: Math.round(s.totalBgn * 100) / 100, bucketCount: s.buckets.size, points });
  }
  return series.sort((a, b) => b.totalObservations - a.totalObservations);
}

function getReceiptLink(receipt) {
  const retailer = (receipt.source?.retailer_id || '').toLowerCase();
  if (retailer === 'metro') return null;
  const url = receipt.source?.source_url || '';
  if (url) return url;
  const rid = receipt.receipt?.id || '';
  if (!rid) return '';
  return `https://www.lidl.bg/mre/purchase-detail?t=${encodeURIComponent(rid)}`;
}

function getReceiptMetaLink(receipt) {
  const retailer = (receipt.source?.retailer_id || '').toLowerCase();
  return retailer !== 'metro' ? getReceiptLink(receipt) : null;
}

function collectEvidence(runs, scopeRunId, selectedIds, dateFrom, dateTo) {
  const rows = [];
  const idSet = selectedIds && selectedIds.length > 0 ? new Set(selectedIds) : null;
  const isAll = !idSet;

  for (const run of runs) {
    if (scopeRunId && run.runId !== scopeRunId) continue;
    for (const receipt of (run.results || [])) {
      const date = receipt.receipt?.date || receipt.receipt?.datetime_local?.slice(0, 10) || '';
      if (!date) continue;
      if (dateFrom && date < dateFrom) continue;
      if (dateTo && date > dateTo) continue;
      for (const it of (receipt.items || [])) {
        const name = normalizeName(it.product?.name || '');
        if (!name || name.length < 3) continue;
        const displayName = sanitizeDisplayName(it.product?.name || '');
        const did = itemDisplayId(run.runId, name);
        if (!isAll && !idSet.has(did)) continue;
        const price = extractUnitPrice(it);
        if (price <= 0) continue;
        rows.push({
          runId: run.runId,
          runIdx: runs.indexOf(run),
          retailer: run.retailer,
          runLabel: runLabel(run),
          receiptId: receipt.receipt?.id || '',
          receiptDate: date,
          storeCode: receipt.store?.code || '',
          storeName: receipt.store?.name || '',
          productName: displayName || name,
          productLabel: `${retailerLabel(run.retailer)} · ${displayName || name}`,
          quantity: it.quantity?.value || 1,
          unitPriceBgn: it.pricing?.unit_price_bgn ?? 0,
          lineTotalBgn: it.pricing?.line_total_bgn ?? 0,
          unitPriceEur: it.pricing?.unit_price_eur ?? 0,
          lineTotalEur: it.pricing?.line_total_eur ?? 0,
          receiptLink: getReceiptLink(receipt),
          needsModal: !getReceiptLink(receipt)
        });
      }
    }
  }
  return rows;
}

function convertToPercentage(series) {
  return series.map(s => {
    const base = s.points[0]?.avgPrice || 1;
    if (base <= 0) return s;
    return { ...s, points: s.points.map(p => ({ ...p, avgPrice: Math.round(((p.avgPrice - base) / base) * 10000) / 100 })) };
  });
}

function convertToIndex(series) {
  return series.map(s => {
    const base = s.points[0]?.avgPrice || 1;
    if (base <= 0) return s;
    return { ...s, points: s.points.map(p => ({ ...p, avgPrice: Math.round((p.avgPrice / base) * 10000) / 100 })) };
  });
}

function getAllBuckets(series) {
  const buckets = new Set();
  for (const s of series) for (const p of s.points) buckets.add(p.bucket);
  return Array.from(buckets).sort();
}

function getTrendSummary(series, mode) {
  if (!series.length || series[0].points.length < 2) return '';
  const last = series[0].points[series[0].points.length - 1].avgPrice;
  if (mode === 'index') return `Индексът на средната цена е <strong>${Math.round(last)}</strong> спрямо 100 в началния период.`;
  if (mode === 'percentage') {
    return last >= 0 ? `Средната цена е с <strong>+${Math.round(last)}%</strong> спрямо началния период.`
      : `Средната цена е с <strong>${Math.round(last)}%</strong> спрямо началния период.`;
  }
  return `Средна цена: <strong>${series[0].points[series[0].points.length - 1].avgPrice.toFixed(2)} лв</strong>.`;
}

export { loadRuns, getRunOptions, getItemOptions, getAvailableDateRange, buildAggregateSeries, buildSelectedSeries, collectEvidence, convertToPercentage, convertToIndex, getAllBuckets, getTrendSummary, getQuarterLabel, sanitizeDisplayName };
