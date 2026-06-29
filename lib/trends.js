// lib/trends.js
// Price trend computation from BasketIndex run history.

import { loadRuns } from './run-history.js';

const QUARTER_MONTHS = { 1: '01', 2: '04', 3: '07', 4: '10' };

function normalizeName(name) {
  return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
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

function getYearKey(dateStr) {
  return new Date(dateStr).getFullYear().toString();
}

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function extractUnitPrice(item) {
  return item.pricing?.unit_price_bgn
    || item.pricing?.line_total_bgn
    || item.pricing?.unit_price_eur
    || item.pricing?.unit_price_primary
    || 0;
}

function collectAllItems(runs, retailer) {
  // Returns array of { date, bucket, name, unitPrice, quantity }
  const items = [];
  const getBucket = o => o === 'year' ? getYearKey : o === 'month' ? getMonthKey : getQuarterKey;

  for (const run of runs) {
    if (retailer && run.retailer !== retailer) continue;
    for (const receipt of (run.results || [])) {
      const date = receipt.receipt?.date || receipt.receipt?.datetime_local?.slice(0, 10) || '';
      if (!date) continue;
      const bucket = getBucket('quarter')(date);
      for (const it of (receipt.items || [])) {
        const name = normalizeName(it.product?.name || '');
        if (!name || name.length < 3) continue;
        const price = extractUnitPrice(it);
        if (price <= 0) continue;
        items.push({ date, bucket, name, unitPrice: price, quantity: it.quantity?.value || 1 });
      }
    }
  }
  return items;
}

function getAvailableItems(runs, retailer) {
  const counts = new Map();
  for (const it of collectAllItems(runs, retailer)) {
    counts.set(it.name, (counts.get(it.name) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function buildAggregateSeries(runs, retailer, aggregation) {
  const getBucket = o => o === 'year' ? getYearKey : o === 'month' ? getMonthKey : getQuarterKey;
  const bucketFn = getBucket(aggregation);
  const bucketData = new Map();

  for (const it of collectAllItems(runs, retailer)) {
    const b = bucketFn(it.date);
    if (!bucketData.has(b)) bucketData.set(b, []);
    bucketData.get(b).push(it.unitPrice);
  }

  const points = [];
  for (const [bucket, prices] of Array.from(bucketData.entries()).sort()) {
    const avg = prices.reduce((a, x) => a + x, 0) / prices.length;
    points.push({ bucket, bucketLabel: getQuarterLabel(bucket), avgPrice: Math.round(avg * 100) / 100, observations: prices.length });
  }

  return [{
    name: 'ALL_ITEMS',
    label: 'Всички артикули',
    totalObservations: points.reduce((s, p) => s + p.observations, 0),
    bucketCount: points.length,
    points
  }];
}

function buildSelectedSeries(runs, retailer, selectedNames, aggregation) {
  const getBucket = o => o === 'year' ? getYearKey : o === 'month' ? getMonthKey : getQuarterKey;
  const bucketFn = getBucket(aggregation);
  const nameSet = new Set(selectedNames.map(normalizeName));
  const productData = new Map();

  for (const it of collectAllItems(runs, retailer)) {
    if (!nameSet.has(it.name)) continue;
    if (!productData.has(it.name)) productData.set(it.name, { name: it.name, buckets: new Map(), totalObservations: 0 });
    const pd = productData.get(it.name);
    const b = bucketFn(it.date);
    if (!pd.buckets.has(b)) pd.buckets.set(b, []);
    pd.buckets.get(b).push(it.unitPrice);
    pd.totalObservations++;
  }

  const series = [];
  for (const pd of productData.values()) {
    if (pd.totalObservations < 3 || pd.buckets.size < 2) continue;
    const sortedBuckets = Array.from(pd.buckets.keys()).sort();
    const points = sortedBuckets.map(b => {
      const prices = pd.buckets.get(b);
      const avg = prices.reduce((a, x) => a + x, 0) / prices.length;
      return { bucket: b, bucketLabel: getQuarterLabel(b), avgPrice: Math.round(avg * 100) / 100, observations: prices.length };
    });
    series.push({ name: pd.name, label: pd.name, totalObservations: pd.totalObservations, bucketCount: pd.buckets.size, points });
  }

  series.sort((a, b) => b.totalObservations - a.totalObservations);
  return series;
}

function convertToPercentage(series) {
  return series.map(s => {
    const base = s.points[0]?.avgPrice || 1;
    if (base <= 0) return s;
    return {
      ...s,
      points: s.points.map(p => ({
        ...p,
        avgPrice: Math.round(((p.avgPrice - base) / base) * 10000) / 100
      }))
    };
  });
}

function getAllBuckets(series) {
  const buckets = new Set();
  for (const s of series) for (const p of s.points) buckets.add(p.bucket);
  return Array.from(buckets).sort();
}

export {
  loadRuns, getAvailableItems, buildAggregateSeries, buildSelectedSeries,
  convertToPercentage, getAllBuckets, normalizeName, getQuarterLabel
};
