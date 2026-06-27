(() => {
  const { LIDL_RECEIPT_MESSAGES, waitForElement } = window.LidlReceiptShared;

  function extractReceiptLinks() {
    const links = document.querySelectorAll('a[href*="/mre/purchase-detail?t="], a[href*="purchase-detail?t="]');
    const receipts = [];
    const seenIds = new Set();

    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;
      try {
        const url = new URL(href, window.location.origin);
        const receiptId = url.searchParams.get('t');
        if (!receiptId || seenIds.has(receiptId)) continue;
        seenIds.add(receiptId);
        receipts.push({
          receipt_id: receiptId,
          url: url.href,
          label: (link.textContent || '').trim()
        });
      } catch (_) {}
    }

    return receipts;
  }

  function extractPageNumber() {
    const url = new URL(window.location.href);
    const page = url.searchParams.get('page') || url.searchParams.get('p');
    if (page) return parseInt(page, 10);
    const activePage = document.querySelector('.pagination .active, [aria-current="page"]');
    if (activePage) {
      const num = parseInt(activePage.textContent.trim(), 10);
      if (!isNaN(num)) return num;
    }
    const pathMatch = window.location.pathname.match(/[?&]page[=/](\d+)/);
    if (pathMatch) return parseInt(pathMatch[1], 10);
    return 1;
  }

  function extractListing() {
    const receipts = extractReceiptLinks();
    const pageNumber = extractPageNumber();
    const totalLinks = document.querySelectorAll('a[href*="/mre/purchase-detail?t="]').length;

    return {
      page: pageNumber,
      url: window.location.href,
      receiptCount: receipts.length,
      totalLinksOnPage: totalLinks,
      receipts
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === LIDL_RECEIPT_MESSAGES.EXTRACT_LISTING) {
      (async () => {
        try {
          const container = await waitForElement('.purchase-history, [data-testid="purchase-history"], a[href*="purchase-detail"]', 10000);
          if (!container) {
            sendResponse({ success: false, error: 'Listing page content not found', page: extractPageNumber() });
            return;
          }
          const result = extractListing();
          sendResponse({ success: true, ...result });
        } catch (err) {
          sendResponse({ success: false, error: err.message, page: extractPageNumber() });
        }
      })();
      return true;
    }

    if (message.type === LIDL_RECEIPT_MESSAGES.CHECK_AUTH) {
      const result = window.LidlReceiptShared.checkAuth();
      sendResponse(result);
      return false;
    }
  });
})();
