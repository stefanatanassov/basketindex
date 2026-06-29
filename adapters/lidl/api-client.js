// adapters/lidl/api-client.js
// Lidl API client — listing and detail endpoints.
// Cookie-based auth. Used by the API-driven Lidl execution path.
//
// Note: the Lidl API ignores the `size` parameter and always returns
// exactly 10 items per page. Listing pagination must iterate `page=N`
// based on `totalCount / 10`.

const LIDL_API_BASE = 'https://www.lidl.bg/mre/api/v1/tickets';
const LIDL_PAGE_SIZE = 10; // Fixed by the API, cannot be changed

async function fetchListing(page = 1) {
  const resp = await fetch(`${LIDL_API_BASE}?country=BG&page=${page}`, {
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

  const firstPage = await fetchListing(page);
  totalCount = firstPage.totalCount || 0;

  if (onPage) {
    await onPage(firstPage.items || [], page, totalCount);
  }

  const totalPages = Math.min(Math.ceil(totalCount / LIDL_PAGE_SIZE), maxPages);

  for (page = 2; page <= totalPages; page++) {
    const data = await fetchListing(page);
    if (onPage) {
      await onPage(data.items || [], page, totalCount);
    }
  }

  return totalCount;
}

export { fetchListing, fetchDetail, fetchAllListings, LIDL_PAGE_SIZE };
