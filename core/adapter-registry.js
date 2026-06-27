import { lidlAdapter } from '../adapters/lidl/adapter.js';

const registry = new Map([
  [lidlAdapter.id, lidlAdapter]
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
