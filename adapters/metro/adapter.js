// adapters/metro/adapter.js
// Metro Bulgaria adapter for BasketIndex.
// API-driven: token from localStorage, invoices + articles via REST API.

import {
  METRO_HOST_PATTERNS,
  METRO_LISTING_MATCHES,
  supportsMetroUrl,
  getMetroEntryUrl
} from './hosts.js';

import { readTokenFromPage, isTokenExpired, getAccountIdFromToken } from './auth.js';
import { normalizeReceipt } from './normalizer.js';

const metroAdapter = {
  id: 'metro',
  name: 'METRO',
  supportedCountries: ['BG'],
  version: '0.1.0',
  status: 'prototype',

  // API-driven mode — no DOM listing/discovery needed
  executionMode: 'api_listing_api_detail',

  supportsUrl(url) {
    try {
      return supportsMetroUrl(url);
    } catch (_) {
      return false;
    }
  },

  hostPatterns() {
    return METRO_HOST_PATTERNS.slice();
  },

  listingMatches() {
    return METRO_LISTING_MATCHES.slice();
  },

  detailMatches() {
    return [];
  },

  // Content scripts for Metro — auth token acquisition only
  listingScripts() {
    return ['adapters/metro/shared.js'];
  },

  detailScripts() {
    return [];
  },

  getEntryUrl() {
    return getMetroEntryUrl();
  },

  // Adapter-specific config fields
  getConfigFields() {
    return {
      fromDate: { label: 'From Date', type: 'date', default: '2019-01-01' },
      toDate: { label: 'To Date', type: 'date', default: new Date().toISOString().slice(0, 10) }
    };
  },

  getListingAction() {
    return 'METRO_GET_AUTH';
  },

  getDetailAction() {
    return '';
  },

  getAuthAction() {
    return 'METRO_CHECK_AUTH';
  },

  normalizeReceipt(rawReceipt) {
    return normalizeReceipt(rawReceipt.invoice, rawReceipt.articles);
  }
};

export { metroAdapter, readTokenFromPage, isTokenExpired, getAccountIdFromToken };
