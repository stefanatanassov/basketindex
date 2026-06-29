// scripts/validate-fixtures.mjs
// Zero-dependency offline validation for the Lidl adapter's normalization
// pipeline. Loads anonymized raw receipt fixtures, normalizes via
// adapters/lidl/normalizer.js, validates via core/receipt-normalizer.js,
// and compares against expected normalized output.
//
// Usage: node scripts/validate-fixtures.mjs
//
// Validation layer: raw fixture JSON -> normalized -> schema validation
// + comparison against expected normalized JSON.
//
// The HTML -> raw extraction step is NOT validated here because the
// extractor (adapters/lidl/detail-extractor.js) depends on Chrome DOM
// APIs (document.querySelectorAll, MutationObserver) and cannot run
// offline without a browser.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeReceipt } from '../adapters/lidl/normalizer.js';
import { validateNormalized } from '../core/receipt-normalizer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FIXTURES_DIR = resolve(ROOT, 'fixtures', 'lidl');
const METRO_FIXTURES_DIR = resolve(ROOT, 'fixtures', 'metro');
const DETAIL_DIR = resolve(FIXTURES_DIR, 'detail');
const METRO_DETAIL_DIR = resolve(METRO_FIXTURES_DIR, 'detail');
const EXPECTED_DIR = resolve(FIXTURES_DIR, 'expected');
const METRO_EXPECTED_DIR = resolve(METRO_FIXTURES_DIR, 'expected');

let passed = 0;
let failed = 0;
const failures = [];

function loadJson(filepath) {
  try {
    return JSON.parse(readFileSync(filepath, 'utf-8'));
  } catch (err) {
    return null;
  }
}

function deepCompare(actual, expected, path = '') {
  const diffs = [];

  if (typeof actual !== typeof expected) {
    diffs.push(`${path}: type mismatch (${typeof actual} vs ${typeof expected})`);
    return diffs;
  }

  if (actual === null && expected === null) return diffs;

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      diffs.push(`${path}: array length ${actual.length} vs ${expected.length}`);
    }
    const len = Math.min(actual.length, expected.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...deepCompare(actual[i], expected[i], `${path}[${i}]`));
    }
    return diffs;
  }

  if (typeof actual === 'object' && typeof expected === 'object') {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();

    for (const key of actualKeys) {
      if (!(key in expected)) {
        diffs.push(`${path}.${key}: present in actual but missing in expected`);
      }
    }
    for (const key of expectedKeys) {
      if (!(key in actual)) {
        diffs.push(`${path}.${key}: present in expected but missing in actual`);
      }
    }

    for (const key of actualKeys) {
      if (key in expected) {
        if (key === 'imported_at') continue;
        if (key === 'datetime_local' && actual[key] === 'FIXTURE_TIMESTAMP' && expected[key] === 'FIXTURE_TIMESTAMP') continue;
        diffs.push(...deepCompare(actual[key], expected[key], `${path}.${key}`));
      }
    }
    return diffs;
  }

  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Math.abs(actual - expected) > 0.005) {
      diffs.push(`${path}: ${actual} vs ${expected}`);
    }
    return diffs;
  }

  if (actual !== expected) {
    diffs.push(`${path}: "${actual}" vs "${expected}"`);
  }

  return diffs;
}

async function runValidation(rawFile, expectedFile, label, isMetro = false) {
  console.log(`\n=== ${label} ===`);

  const raw = loadJson(rawFile);
  if (!raw) {
    failed++;
    failures.push(`${label}: could not load raw fixture`);
    console.log('  FAIL: could not load raw fixture');
    return;
  }

  let normalized;
  if (isMetro) {
    const { normalizeReceipt: metroNormalize } = await import('../adapters/metro/normalizer.js');
    normalized = metroNormalize(raw.invoice, raw.articles);
  } else {
    normalized = normalizeReceipt(raw);
  }

  const validation = validateNormalized(isMetro ? 'metro' : 'lidl', normalized);

  if (!validation.valid) {
    failed++;
    failures.push(`${label}: schema validation FAILED`);
    console.log('  FAIL: schema validation');
    for (const err of validation.errors) {
      console.log('    -', err);
    }
    return;
  }
  console.log('  PASS: schema validation');

  const expected = loadJson(expectedFile);
  if (!expected) {
    console.log('  WARN: no expected file found; running schema validation only');
    passed++;
    return;
  }

  const diffs = deepCompare(normalized, expected, 'root');
  if (diffs.length > 0) {
    failed++;
    failures.push(`${label}: expected output mismatch (${diffs.length} diffs)`);
    console.log(`  FAIL: expected output mismatch (${diffs.length} diffs):`);
    for (const d of diffs.slice(0, 15)) {
      console.log('    -', d);
    }
    if (diffs.length > 15) console.log(`    ... and ${diffs.length - 15} more`);
  } else {
    passed++;
    console.log('  PASS: expected output matches');
  }
}

async function main() {
  console.log('BasketIndex — Fixture Validation');
  console.log(`Lidl fixtures: ${FIXTURES_DIR}`);
  console.log(`Metro fixtures: ${METRO_FIXTURES_DIR}`);
  console.log('Layer: raw fixture JSON → normalize → validate → compare to expected');

  const detailFiles = readdirSync(DETAIL_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.json'))
    .map(e => e.name);

  const metroDetailFiles = readdirSync(METRO_DETAIL_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.json'))
    .map(e => e.name);

  if (detailFiles.length === 0 && metroDetailFiles.length === 0) {
    console.log('\nNo fixture files found.');
    process.exit(1);
  }

  for (const filename of detailFiles) {
    const rawFile = resolve(DETAIL_DIR, filename);
    const base = basename(filename, '.json');
    const expectedFile = resolve(EXPECTED_DIR, `${base}.normalized.json`);
    await runValidation(rawFile, expectedFile, base, false);
  }

  for (const filename of metroDetailFiles) {
    const rawFile = resolve(METRO_DETAIL_DIR, filename);
    const base = basename(filename, '.json');
    const expectedFile = resolve(METRO_EXPECTED_DIR, `${base}.normalized.json`);
    await runValidation(rawFile, expectedFile, base, true);
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main();
