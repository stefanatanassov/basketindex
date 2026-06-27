// CANONICAL SOURCE: Lidl host/match metadata.
// When adding or removing countries, edit LIDL_COUNTRY_HOSTS below,
// then run: node scripts/sync-manifest.mjs
// This updates manifest.json host_permissions and content_scripts.matches
// from these arrays. Do not manually edit the manifest's Lidl arrays.
//
// See docs/adapter-interface.md for how new retailer adapters contribute
// their host/match metadata via their own hosts.js module.

const LIDL_COUNTRY_HOSTS = [
  'lidl.bg',
  'lidl.com',
  'lidl.de',
  'lidl.co.uk',
  'lidl.fr',
  'lidl.it',
  'lidl.es',
  'lidl.nl',
  'lidl.pl',
  'lidl.cz',
  'lidl.sk',
  'lidl.hu',
  'lidl.ro',
  'lidl.gr',
  'lidl.pt',
  'lidl.ie',
  'lidl.at',
  'lidl.lt',
  'lidl.lv',
  'lidl.si',
  'lidl.hr',
  'lidl.rs',
  'lidl.ee',
  'lidl.fi',
  'lidl.se',
  'lidl.dk',
  'lidl.no'
];

const LIDL_HOST_PATTERNS = LIDL_COUNTRY_HOSTS.map((host) => `https://*.${host}/*`);
const LIDL_LISTING_MATCHES = LIDL_COUNTRY_HOSTS.map((host) => `https://*.${host}/*/purchase-history*`);
const LIDL_DETAIL_MATCHES = LIDL_COUNTRY_HOSTS.map((host) => `https://*.${host}/*/purchase-detail*`);

function supportsLidlUrl(url) {
  try {
    const parsed = new URL(url);
    return LIDL_COUNTRY_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch (_) {
    return false;
  }
}

function buildLidlPurchaseHistoryUrl(baseUrl, pageNumber) {
  const url = new URL(baseUrl);
  url.searchParams.set('page', String(pageNumber));
  return url.href;
}

export {
  LIDL_COUNTRY_HOSTS,
  LIDL_HOST_PATTERNS,
  LIDL_LISTING_MATCHES,
  LIDL_DETAIL_MATCHES,
  supportsLidlUrl,
  buildLidlPurchaseHistoryUrl
};
