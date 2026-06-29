// adapters/metro/hosts.js
// Canonical source for Metro Bulgaria host/match metadata.
// Run `node scripts/sync-manifest.mjs` after changes.

const METRO_HOST_PATTERNS = ['https://docs.metro.bg/*'];
const METRO_LISTING_MATCHES = ['https://docs.metro.bg/*'];
const METRO_DETAIL_MATCHES = [];

function supportsMetroUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'docs.metro.bg';
  } catch (_) {
    return false;
  }
}

function getMetroEntryUrl() {
  return 'https://docs.metro.bg/';
}

export {
  METRO_HOST_PATTERNS,
  METRO_LISTING_MATCHES,
  METRO_DETAIL_MATCHES,
  supportsMetroUrl,
  getMetroEntryUrl
};
