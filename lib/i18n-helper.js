// lib/i18n-helper.js
// Thin wrapper around chrome.i18n.getMessage for convenient use.
// t(key) returns the localized string for the given message key.

function t(key, substitutions) {
  if (!chrome.i18n) return key;
  const msg = chrome.i18n.getMessage(key, substitutions);
  // empty string is valid for optional messages like hints
  if (msg === key && key.length > 0) {
    console.warn(`[i18n] Missing key: "${key}"`);
    return key;
  }
  return msg;
}

export { t };
