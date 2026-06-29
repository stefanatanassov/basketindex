// adapters/metro/auth.js
// Token acquisition from Metro's localStorage for API-driven extraction.

const METRO_TOKEN_KEY = 'accessToken';

function readTokenFromPage() {
  try {
    const token = localStorage.getItem(METRO_TOKEN_KEY);
    return token || null;
  } catch (_) {
    return null;
  }
}

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return Date.now() > exp - 60000; // 1 minute buffer
  } catch (_) {
    return true;
  }
}

function getAccountIdFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Metro's JWT has cdm.person in keyMap
    return payload?.keyMap?.cdm?.person || null;
  } catch (_) {
    return null;
  }
}

export { readTokenFromPage, isTokenExpired, getAccountIdFromToken, METRO_TOKEN_KEY };
