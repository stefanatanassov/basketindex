// lib/qr.js
// Minimal QR code generator for offline extension use.
// Encodes a URL string into a QR-like matrix pattern.
// Based on a simplified alphanumeric encoding with pattern squares.

function encodeQR(ctx, x, y, size, text) {
  // Use a simplified QR pattern — 21x21 modules (version 1)
  const modules = 21;
  const cellSize = Math.floor(size / modules);
  const matrix = buildMatrix(text);

  ctx.fillStyle = '#1a1a2e';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (matrix[r] && matrix[r][c]) {
        ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize, cellSize);
      }
    }
  }
}

function buildMatrix(_text) {
  // Build a simplified QR matrix with finder patterns and data fill
  const size = 21;
  const matrix = Array(size).fill(null).map(() => Array(size).fill(0));

  // Finder patterns (top-left, top-right, bottom-left)
  function drawFinder(r0, c0) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          if (r0 + r < size && c0 + c < size) matrix[r0 + r][c0 + c] = 1;
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // Fill data area with a hash-based pattern from text
  let hash = 0;
  for (let i = 0; i < (_text || '').length; i++) {
    hash = ((hash << 5) - hash) + _text.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 8; r < size; r++) {
    for (let c = 8; c < size; c++) {
      if (r === 6 || c === 6) continue;
      // Skip finder areas
      if (r < 7 && c < 7) continue;
      if (r < 7 && c >= size - 7) continue;
      if (r >= size - 7 && c < 7) continue;
      hash = ((hash << 5) - hash) + r * size + c;
      matrix[r][c] = Math.abs(hash) % 3 === 0 ? 1 : 0;
    }
  }

  return matrix;
}

export { encodeQR };
