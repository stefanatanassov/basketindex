import {
  LIDL_HOST_PATTERNS,
  LIDL_COUNTRY_HOSTS,
  LIDL_LISTING_MATCHES,
  LIDL_DETAIL_MATCHES,
  supportsLidlUrl,
  buildLidlPurchaseHistoryUrl
} from './hosts.js';
import { normalizeReceipt as normalizeLidlReceipt } from './normalizer.js';

// Run `node scripts/sync-manifest.mjs` after changing hosts.js to keep
// manifest.json host_permissions and content_scripts.matches in sync.

const lidlAdapter = {
  id: 'lidl',
  name: 'Lidl',
  supportedCountries: LIDL_COUNTRY_HOSTS.map((host) => host.split('.').pop().toUpperCase()).filter((code) => code.length === 2),
  version: '0.1.0',
  status: 'prototype',

  supportsUrl(url) {
    try {
      const parsed = new URL(url);
      return supportsLidlUrl(url) && parsed.pathname.includes('purchase-history');
    } catch (_) {
      return false;
    }
  },

  hostPatterns() {
    return LIDL_HOST_PATTERNS.slice();
  },

  getPurchaseHistoryUrl(baseUrl, pageNumber) {
    return buildLidlPurchaseHistoryUrl(baseUrl, pageNumber);
  },

  // Content script match patterns for manifest injection.
  // These are the URL patterns that trigger content script injection.
  listingMatches() {
    return LIDL_LISTING_MATCHES.slice();
  },

  detailMatches() {
    return LIDL_DETAIL_MATCHES.slice();
  },

  // Content script paths relative to extension root.
  // The manifest uses these to inject scripts into Lidl pages.
  listingScripts() {
    return ['adapters/lidl/shared.js', 'adapters/lidl/listing-extractor.js'];
  },

  detailScripts() {
    return ['adapters/lidl/shared.js', 'adapters/lidl/detail-extractor.js'];
  },

  // TODO(BasketIndex Phase 4): Wire core job-manager to call these methods
  // via message passing instead of hardcoding the EXTRACT_LISTING/EXTRACT_DETAIL
  // message types in service-worker.js.

  // discoverReceiptUrls runs in the listing content script context.
  // Currently dispatched via LIDL_EXTRACT_LISTING message in content/listing-extractor.js.
  // After full Phase 4 wiring, the core will call this via adapter abstraction.
  getListingAction() {
    return 'LIDL_EXTRACT_LISTING';
  },

  // extractReceipt runs in the detail content script context.
  // Currently dispatched via LIDL_EXTRACT_DETAIL message in content/detail-extractor.js.
  getDetailAction() {
    return 'LIDL_EXTRACT_DETAIL';
  },

  // checkAuth runs in any Lidl page content script context.
  getAuthAction() {
    return 'LIDL_CHECK_AUTH';
  },

  // Normalize a raw Lidl receipt into the BasketIndex normalized schema.
  // Currently a passthrough. Phase 4 full wiring will implement a proper
  // normalizer in adapters/lidl/normalizer.js and route through here.
  normalizeReceipt(rawReceipt) {
    return normalizeLidlReceipt(rawReceipt);
  }
};

export { lidlAdapter };
