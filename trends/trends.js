// trends/trends.js
// Price trends page — loads history, renders chart, exports PNG with QR.

import { loadRuns } from '../lib/run-history.js';
import { buildProductSeries, getAllBuckets } from '../lib/trends.js';
import { t } from '../lib/i18n-helper.js';

const COLORS = ['#4a90d9', '#e8734a', '#3a8a40', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const LANDING_URL = 'https://basketindex.stefanatanasov.dev/';

let currentSeries = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const runs = await loadRuns();
  if (runs.length === 0) return; // empty state already visible

  const series = buildProductSeries(runs, { topN: 10, aggregation: 'quarter', minObservations: 3, minBuckets: 2 });

  if (series.length === 0) {
    document.getElementById('emptyState').querySelector('p').textContent = 'Няма достатъчно повтарящи се продукти за генериране на тенденции.';
    return;
  }

  currentSeries = series;
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('controls').style.display = '';
  document.getElementById('chartContainer').style.display = '';
  document.getElementById('methodology').style.display = '';

  document.getElementById('retailerFilter').addEventListener('change', () => regenerate(runs));
  document.getElementById('aggregation').addEventListener('change', () => regenerate(runs));
  document.getElementById('exportPngBtn').addEventListener('click', exportPng);

  drawChart(series);
}

function regenerate(runs) {
  const retailer = document.getElementById('retailerFilter').value || null;
  const agg = document.getElementById('aggregation').value || 'quarter';
  const series = buildProductSeries(runs, { topN: 10, aggregation: agg, retailer, minObservations: 3, minBuckets: 2 });

  if (series.length === 0) {
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('emptyState').style.display = '';
    document.getElementById('emptyState').querySelector('p').textContent = 'Няма достатъчно повтарящи се продукти за избрания филтър.';
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chartContainer').style.display = '';
  currentSeries = series;
  drawChart(series);
}

function drawChart(series) {
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const margin = { top: 50, right: 300, bottom: 60, left: 80 };
  const pw = W - margin.left - margin.right;
  const ph = H - margin.top - margin.bottom;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('BasketIndex — Ценови тенденции', margin.left, 32);

  ctx.fillStyle = '#666';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Средна платена цена по периоди', margin.left, 50);

  const buckets = getAllBuckets(series);
  if (buckets.length < 2) return;

  // Y-axis
  let maxPrice = 0;
  for (const s of series) {
    for (const p of s.points) {
      if (p.avgPrice > maxPrice) maxPrice = p.avgPrice;
    }
  }
  maxPrice = Math.ceil(maxPrice * 1.15);

  // Grid
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = margin.top + (ph / 4) * i;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(W - margin.right, y);
    ctx.stroke();

    const val = maxPrice - (maxPrice / 4) * i;
    ctx.fillStyle = '#999';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(val * 100) / 100 + ' лв', margin.left - 8, y + 4);
  }

  // X-axis labels
  const xStep = pw / (buckets.length - 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
  for (let i = 0; i < buckets.length; i++) {
    const x = margin.left + xStep * i;
    ctx.fillText(buckets[i], x, H - margin.bottom + 16);
  }

  // Lines + dots
  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const color = COLORS[si % COLORS.length];

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const point = s.points.find(p => p.bucket === bucket);
      if (!point) continue;

      const x = margin.left + xStep * i;
      const y = margin.top + ph - (point.avgPrice / maxPrice) * ph;

      if (i === 0 || !s.points.find(p => p.bucket === buckets[i - 1])) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      // Dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.stroke();
  }

  // Legend
  ctx.textAlign = 'left';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  let ly = margin.top + 10;
  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const x = W - margin.right + 140;
    const y = ly;
    ctx.fillStyle = COLORS[si % COLORS.length];
    ctx.fillRect(x - 12, y - 6, 8, 8);
    ctx.fillStyle = '#333';
    const label = s.name.length > 28 ? s.name.slice(0, 25) + '...' : s.name;
    ctx.fillText(label + ' (' + s.totalObservations + ')', x, y);
    ly += 16;
  }

  // Footer
  ctx.fillStyle = '#aaa';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(LANDING_URL, W - margin.right, H - 12);

  // QR code
  const qrSize = 40;
  drawQR(ctx, W - margin.right + 250, H - margin.bottom - qrSize, qrSize, LANDING_URL);
}

function drawQR(ctx, x, y, size, url) {
  // Simple QR-like square pattern (visual placeholder — real QR would need a library)
  ctx.fillStyle = '#1a1a2e';
  const cells = 7;
  const cs = size / cells;
  // Draw a simplified QR pattern
  const pattern = [
    [1,1,1,1,1,1,0],
    [1,0,0,0,0,1,0],
    [1,0,1,0,1,1,0],
    [1,0,1,0,0,1,0],
    [1,0,0,0,1,1,0],
    [1,1,1,1,0,1,0],
    [0,0,0,0,0,0,0],
  ];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (pattern[r] && pattern[r][c]) {
        ctx.fillRect(x + c * cs, y + r * cs, cs, cs);
      }
    }
  }
  // URL label under QR
  ctx.fillStyle = '#aaa';
  ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('basketindex.stefanatanasov.dev', x + size / 2, y + size + 10);
}

function exportPng() {
  const canvas = document.getElementById('chartCanvas');
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'basketindex-price-trends.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
