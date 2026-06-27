// TODO(BasketIndex Phase 4): move Lidl selectors under adapters/lidl/selectors.js.
// All selectors below are Lidl-specific. During the Phase 4 refactor, this file
// should be relocated to adapters/lidl/selectors.js and the core engine should
// use adapter-provided selectors via the adapter interface.

const SELECTORS = {
  listing: {
    receiptLinks: 'a[href*="/mre/purchase-detail?t="], a[href*="purchase-detail?t="]',
    paginationNext: '[data-testid="pagination-next"], button[aria-label*="next" i], .pagination a[rel="next"]',
    paginationContainer: '.pagination, [data-testid="pagination"]',
    pageContent: '.purchase-history, [data-testid="purchase-history"]',
    noResults: '[data-testid="no-results"], .no-receipts'
  },

  detail: {
    wrapper: '[data-testid^="ticket-"], .ticket, [class*="ticket"]',
    itemRows: '.purchase_list .article, [data-testid*="article"], [class*="purchase_item"]',
    summaryRows: '.purchase_summary > span, [data-testid*="summary"] > span',
    receiptDataRows: '.receipt_data > span, [data-testid*="receipt-data"] > span',
    tenderRows: '.purchase_tender_information > span, [data-testid*="tender"] > span',
    headerRows: '.header > span, [data-testid*="header"] > span',
    itemDomQuantity: '[class*="quantity"], [data-testid*="quantity"], [class*="qty"], [data-testid*="qty"]',
    itemDomUnitPrice: '[class*="unit-price"], [data-testid*="unit-price"], [class*="single-price"]',
    itemDomLineTotal: '[class*="line-total"], [data-testid*="line-total"], [class*="total-row"]',
    metadata: {
      storeCode: '.store-code, [data-testid*="store-code"]',
      storeName: '.store-name, [data-testid*="store-name"]',
      storeAddress: '.store-address, [data-testid*="store-address"]',
      bulstat: '.bulstat, [data-testid*="bulstat"]',
      vatNumber: '.vat-number, [data-testid*="vat-number"]',
      usn: '.usn, [data-testid*="usn"]',
      till: '.till, [data-testid*="till"]',
      sequenceNumber: '.sequence-number, [data-testid*="sequence"]',
      fiscalCode: '.fiscal-code, [data-testid*="fiscal"]'
    },
    dateTime: '.date, [data-testid*="date"], time, [datetime]',
    total: '.total, [data-testid*="total"], .purchase_total',
    tenderLabel: '.tender-label, [data-testid*="tender-label"]',
    tenderAmount: '.tender-amount, [data-testid*="tender-amount"]'
  },

  auth: {
    loginForm: 'form[action*="login"], input[type="password"]',
    logoutLink: 'a[href*="logout"], [data-testid="logout"]',
    userMenu: '[data-testid="user-menu"], .user-menu, [aria-label*="account" i]'
  }
};

const EXTRACTION_TIMEOUTS = {
  pageLoad: 10000,
  elementAppear: 8000,
  stabilityPoll: 500,
  stabilityRounds: 3,
  perReceipt: 30000,
  listingPage: 15000
};

const DEFAULTS = {
  concurrency: 2,
  maxRetries: 3,
  recoveryRounds: 2,
  tabReuseDelay: 500
};

export { SELECTORS, EXTRACTION_TIMEOUTS, DEFAULTS };
