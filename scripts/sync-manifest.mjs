// scripts/sync-manifest.mjs
// Zero-dependency sync script: reads adapter host/match metadata and
// writes manifest.json arrays. Run after adding/removing retailer hosts.
//
// Usage: node scripts/sync-manifest.mjs
//
// Adapters contribute host/match data through their hosts.js module.
// When adding a new retailer adapter, add its hosts.js import below.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

async function loadAdapterHosts(adapterId) {
  const module = await import(resolve(ROOT, `adapters/${adapterId}/hosts.js`));
  return {
    hostPatterns: module[`${adapterId.toUpperCase()}_HOST_PATTERNS`] || [],
    listingMatches: module[`${adapterId.toUpperCase()}_LISTING_MATCHES`] || [],
    detailMatches: module[`${adapterId.toUpperCase()}_DETAIL_MATCHES`] || [],
    countryCount: (module[`${adapterId.toUpperCase()}_COUNTRY_HOSTS`] || []).length
  };
}

async function main() {
  const adapterIds = ['lidl'];

  const allHosts = [];
  const allListing = [];
  const allDetail = [];

  for (const id of adapterIds) {
    try {
      const data = await loadAdapterHosts(id);
      allHosts.push(...data.hostPatterns);
      allListing.push(...data.listingMatches);
      allDetail.push(...data.detailMatches);
      console.log(`  ${id}: ${data.countryCount} countries → ${data.hostPatterns.length} host patterns`);
    } catch (err) {
      console.error(`  ${id}: SKIPPED (${err.message})`);
    }
  }

  const manifestPath = resolve(ROOT, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  let changed = false;

  const sortedHosts = [...new Set(allHosts)].sort();
  const currentHosts = [...manifest.host_permissions].sort();
  if (JSON.stringify(sortedHosts) !== JSON.stringify(currentHosts)) {
    manifest.host_permissions = sortedHosts;
    changed = true;
  }

  const sortedListing = [...new Set(allListing)].sort();
  const manifestListing = manifest.content_scripts.find(cs => cs.js.some(s => s.includes('listing-extractor')));
  if (manifestListing) {
    const currentListing = [...manifestListing.matches].sort();
    if (JSON.stringify(sortedListing) !== JSON.stringify(currentListing)) {
      manifestListing.matches = sortedListing;
      changed = true;
    }
  }

  const sortedDetail = [...new Set(allDetail)].sort();
  const manifestDetail = manifest.content_scripts.find(cs => cs.js.some(s => s.includes('detail-extractor')));
  if (manifestDetail) {
    const currentDetail = [...manifestDetail.matches].sort();
    if (JSON.stringify(sortedDetail) !== JSON.stringify(currentDetail)) {
      manifestDetail.matches = sortedDetail;
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`\nmanifest.json updated.`);
    console.log(`  host_permissions: ${sortedHosts.length} hosts`);
    console.log(`  listing matches:  ${sortedListing.length}`);
    console.log(`  detail matches:   ${sortedDetail.length}`);
  } else {
    console.log(`\nmanifest.json already in sync.`);
  }
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
