// lib/i18n-helper.js
// Thin wrapper around chrome.i18n.getMessage for convenient use.
// t(key) returns the localized string for the given message key.

function t(key, substitutions) {
  if (!chrome.i18n) return key;
  return chrome.i18n.getMessage(key, substitutions) || key;
}

export { t };
