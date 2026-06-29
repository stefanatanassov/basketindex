// adapters/metro/api-client.js
// Metro API calls — invoices listing and per-invoice articles.
// Uses Bearer token auth. Runs in service worker context.

const METRO_API_BASE = 'https://docs.metro.bg/mriapi/v1/customer';
const PAGE_SIZE = 100;

async function fetchInvoices(token, accountId, fromDate, toDate, start = 0) {
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
    start: String(start),
    limit: String(PAGE_SIZE),
    cdmAccountId: accountId,
    pod: 'true'
  });

  const resp = await fetch(`${METRO_API_BASE}/invoices?${params}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });

  if (!resp.ok) {
    throw new Error(`Invoices API returned ${resp.status}`);
  }

  return await resp.json();
}

function rewriteHost(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'mriapi.einvoice.metro.cloud') {
      u.hostname = 'docs.metro.bg';
    }
    return u.href;
  } catch (_) {
    return url;
  }
}

async function fetchArticles(token, articlesHref) {
  // Rewrite mriapi.einvoice.metro.cloud → docs.metro.bg to stay within
  // the extension's host permissions (manifest only allows docs.metro.bg).
  const url = rewriteHost(articlesHref);
  const resp = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token }
  });

  if (!resp.ok) {
    throw new Error(`Articles API returned ${resp.status}`);
  }

  return await resp.json();
}

async function fetchAllInvoices(token, accountId, fromDate, toDate, onPage) {
  let start = 0;
  let numFound = 0;
  let allInvoices = [];

  do {
    const data = await fetchInvoices(token, accountId, fromDate, toDate, start);
    const invoices = data._embedded?.customerInvoices || [];
    numFound = data.numFound || 0;

    if (onPage) {
      await onPage(invoices, start, numFound);
    }

    allInvoices = allInvoices.concat(invoices);
    start += PAGE_SIZE;
  } while (start < numFound);

  return allInvoices;
}

export { fetchInvoices, fetchArticles, fetchAllInvoices, PAGE_SIZE };
