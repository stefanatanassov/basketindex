// adapters/metro/shared.js
// Metro content script — injected on docs.metro.bg for auth token acquisition.
// No DOM extraction needed. Token is read from localStorage.

(() => {
  const METRO_MESSAGES = {
    GET_AUTH: 'METRO_GET_AUTH',
    CHECK_AUTH: 'METRO_CHECK_AUTH',
    AUTH_RESULT: 'METRO_AUTH_RESULT'
  };

  function readToken() {
    try {
      return localStorage.getItem('accessToken') || null;
    } catch (_) {
      return null;
    }
  }

  function isPageAuthenticated() {
    const token = readToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      return Date.now() < exp - 60000;
    } catch (_) {
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === METRO_MESSAGES.GET_AUTH) {
      const token = readToken();
      if (token) {
        sendResponse({ success: true, token, authenticated: true });
      } else {
        sendResponse({ success: false, error: 'No access token found. Please log in at docs.metro.bg.', authenticated: false });
      }
      return false;
    }

    if (message.type === METRO_MESSAGES.CHECK_AUTH) {
      sendResponse({ authenticated: isPageAuthenticated() });
      return false;
    }
  });
})();
