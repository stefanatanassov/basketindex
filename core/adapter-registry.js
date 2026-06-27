import { lidlAdapter } from '../adapters/lidl/adapter.js';

const kauflandAdapter = {
  id: 'kaufland',
  name: 'Kaufland',
  supportedCountries: [],
  status: 'planned',
  supportsUrl() { return false; },
  hostPatterns() { return []; },
  getPurchaseHistoryUrl() { return ''; },
  getListingAction() { return ''; },
  getDetailAction() { return ''; },
  normalizeReceipt(r) { return r; }
};

const metroAdapter = {
  id: 'metro',
  name: 'METRO',
  supportedCountries: [],
  status: 'planned',
  supportsUrl() { return false; },
  hostPatterns() { return []; },
  getPurchaseHistoryUrl() { return ''; },
  getListingAction() { return ''; },
  getDetailAction() { return ''; },
  normalizeReceipt(r) { return r; }
};

const registry = new Map([
  [lidlAdapter.id, lidlAdapter],
  [kauflandAdapter.id, kauflandAdapter],
  [metroAdapter.id, metroAdapter]
]);

function getAdapter(id) {
  return registry.get(id) || null;
}

function resolveAdapter(url) {
  for (const adapter of registry.values()) {
    if (adapter.supportsUrl(url)) {
      return adapter;
    }
  }
  return null;
}

function listAdapters() {
  return Array.from(registry.values()).map((adapter) => ({
    id: adapter.id,
    name: adapter.name,
    supportedCountries: adapter.supportedCountries,
    status: adapter.status || 'prototype'
  }));
}

export { getAdapter, resolveAdapter, listAdapters };
