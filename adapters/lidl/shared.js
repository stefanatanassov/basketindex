(() => {
  const LIDL_RECEIPT_MESSAGES = {
    EXTRACT_LISTING: 'LIDL_EXTRACT_LISTING',
    EXTRACT_DETAIL: 'LIDL_EXTRACT_DETAIL',
    LISTING_RESULT: 'LIDL_LISTING_RESULT',
    DETAIL_RESULT: 'LIDL_DETAIL_RESULT',
    CHECK_AUTH: 'LIDL_CHECK_AUTH',
    AUTH_RESULT: 'LIDL_AUTH_RESULT',
    ERROR: 'LIDL_CONTENT_ERROR'
  };

  function waitForElement(selector, timeout = 8000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const el = document.querySelector(selector);
      if (el) { resolve(el); return; }
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); resolve(found); return; }
        if (Date.now() - start > timeout) { observer.disconnect(); resolve(null); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  function waitForStability(selector, interval = 500, rounds = 3, maxTimeout = 15000) {
    return new Promise((resolve) => {
      const start = Date.now();
      let lastCount = -1;
      let stableRounds = 0;
      const check = () => {
        if (Date.now() - start > maxTimeout) { resolve(false); return; }
        const el = document.querySelector(selector);
        if (!el) { stableRounds = 0; setTimeout(check, interval); return; }
        const textLen = (el.textContent || '').trim().length;
        if (textLen === lastCount && textLen > 0) {
          stableRounds++;
          if (stableRounds >= rounds) { resolve(true); return; }
        } else {
          stableRounds = 0;
        }
        lastCount = textLen;
        setTimeout(check, interval);
      };
      check();
    });
  }

  function checkAuth() {
    const hasLogin = document.querySelector('form[action*="login"], input[type="password"]');
    const hasLogout = document.querySelector('a[href*="logout"], [data-testid="logout"]');
    const hasUserMenu = document.querySelector('[data-testid="user-menu"], .user-menu');
    if (hasLogin && !hasLogout && !hasUserMenu) return { authenticated: false, reason: 'Login form detected' };
    if (hasLogout || hasUserMenu) return { authenticated: true };
    const url = window.location.href;
    if (url.includes('login') || url.includes('auth')) return { authenticated: false, reason: 'On login/auth page' };
    if (url.includes('purchase-history') || url.includes('purchase-detail')) return { authenticated: true };
    return { authenticated: false, reason: 'Cannot determine auth state', url };
  }

  function parseReceiptIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('t') || null;
  }

  function stripCurrency(value) {
    if (!value) return 0;
    const cleaned = value.replace(/[^\d,.\-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  const sharedApi = {
    LIDL_RECEIPT_MESSAGES,
    waitForElement,
    waitForStability,
    checkAuth,
    parseReceiptIdFromUrl,
    stripCurrency
  };

  window.LidlReceiptShared = sharedApi;
  window.BasketIndexShared = sharedApi;
})();
