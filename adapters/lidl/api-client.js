// adapters/lidl/api-client.js
// Lidl API client — listing and detail endpoints.
// Cookie-based auth. Used by the API-driven Lidl execution path.

const LIDL_API_BASE = 'https://www.lidl.bg/mre/api/v1/tickets';

async function fetchListing(page = 1, size = 100) {
  const resp = await fetch(`${LIDL_API_BASE}?country=BG&page=${page}&size=${size}`, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });

  if (!resp.ok) {
    throw new Error(`Lidl listing API returned ${resp.status}`);
  }

  return await resp.json();
}

async function fetchDetail(receiptId) {
  const resp = await fetch(`${LIDL_API_BASE}/${receiptId}?country=BG&languageCode=bg-BG`, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });

  if (!resp.ok) {
    throw new Error(`Lidl detail API returned ${resp.status} for ${receiptId}`);
  }

  return await resp.json();
}

async function fetchAllListings(onPage, maxPages = 100) {
  let page = 1;
  let totalCount = 0;

  // Fetch first page to get totalCount
  const firstPage = await fetchListing(page, 100);
  totalCount = firstPage.totalCount || 0;

  if (onPage) {
    await onPage(firstPage.items || [], page, totalCount);
  }

  const totalPages = Math.ceil(totalCount / 100);
  const pagesToFetch = Math.min(totalPages, maxPages);

  for (page = 2; page <= pagesToFetch; page++) {
    const data = await fetchListing(page, 100);
    if (onPage) {
      await onPage(data.items || [], page, totalCount);
    }
  }

  return totalCount;
}

export { fetchListing, fetchDetail, fetchAllListings };
