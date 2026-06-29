// lib/trends.js
// Price trend computation from BasketIndex run history.
// Works offline from stored normalized receipts — no live retailer needed.

import { loadRuns } from './run-history.js';

function normalizeName(name) {
  return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function getQuarter(dateStr) {
  const d = new Date(dateStr);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function getYear(dateStr) {
  return new Date(dateStr).getFullYear().toString();
}

function getMonth(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildProductSeries(runs, options = {}) {
  const retailer = options.retailer || null;
  const aggregation = options.aggregation || 'quarter'; // 'quarter', 'year', 'month'

  const getBucket = aggregation === 'year' ? getYear : (aggregation === 'month' ? getMonth : getQuarter);

  // Collect all items from all runs
  const productData = new Map();

  for (const run of runs) {
    if (retailer && run.retailer !== retailer) continue;
    const receipts = run.results || [];
    for (const receipt of receipts) {
      const date = receipt.receipt?.date || receipt.receipt?.datetime_local?.slice(0, 10) || '';
      if (!date) continue;
      const bucket = getBucket(date);

      for (const item of (receipt.items || [])) {
        const name = normalizeName(item.product?.name || '');
        if (!name || name.length < 3) continue;

        if (!productData.has(name)) {
          productData.set(name, { name, buckets: new Map(), totalObservations: 0 });
        }

        const pd = productData.get(name);
        const unitPrice = item.pricing?.unit_price_bgn
          || item.pricing?.line_total_bgn
          || item.pricing?.unit_price_eur
          || item.pricing?.unit_price_primary
          || 0;

        if (unitPrice <= 0) continue;

        if (!pd.buckets.has(bucket)) {
          pd.buckets.set(bucket, { prices: [], quantities: [] });
        }
        const b = pd.buckets.get(bucket);
        b.prices.push(unitPrice);
        b.quantities.push(item.quantity?.value || 1);
        pd.totalObservations++;
      }
    }
  }

  // Build series: filter to products with enough data
  const minObs = options.minObservations || 3;
  const minBuckets = options.minBuckets || 2;

  const series = [];
  for (const pd of productData.values()) {
    if (pd.totalObservations < minObs) continue;
    if (pd.buckets.size < minBuckets) continue;

    const sortedBuckets = Array.from(pd.buckets.keys()).sort();
    const points = sortedBuckets.map(bucket => {
      const b = pd.buckets.get(bucket);
      const avgPrice = b.prices.reduce((a, x) => a + x, 0) / b.prices.length;
      return { bucket, avgPrice: Math.round(avgPrice * 100) / 100, observations: b.prices.length };
    });

    series.push({
      name: pd.name,
      totalObservations: pd.totalObservations,
      bucketCount: pd.buckets.size,
      points
    });
  }

  // Sort by total observations, take top N
  series.sort((a, b) => b.totalObservations - a.totalObservations);
  const topN = options.topN || 10;

  return series.slice(0, topN);
}

function getAllBuckets(series) {
  const buckets = new Set();
  for (const s of series) {
    for (const p of s.points) {
      buckets.add(p.bucket);
    }
  }
  return Array.from(buckets).sort();
}

export { buildProductSeries, getAllBuckets, loadRuns, normalizeName, getQuarter };
