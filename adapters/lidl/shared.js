(() => {
  const LIDL_RECEIPT_MESSAGES = {
    EXTRACT_LISTING: 'LIDL_EXTRACT_LISTING',
    EXTRACT_DETAIL: 'LIDL_EXTRACT_DETAIL',
    LISTING_RESULT: 'LIDL_LISTING_RESULT',
    DETAIL_RESULT: 'LIDL_DETAIL_RESULT',
    CHECK_AUTH: 'LIDL_CHECK_AUTH',
    AUTH_RESULT: 'LIDL_AUTH_RESULT',
    ERROR: 'LIDL_CONTENT_ERROR',
    PARSE_RECEIPT_HTML: 'LIDL_PARSE_RECEIPT_HTML',
    FETCH_LISTING: 'LIDL_FETCH_LISTING',
    FETCH_DETAIL: 'LIDL_FETCH_DETAIL'
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

  // Handle HTML-string receipt parsing for API-driven Lidl mode.
  // The service worker sends HTML from the detail API; we parse it
  // with DOMParser (available in content script, not SW context).
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === LIDL_RECEIPT_MESSAGES.PARSE_RECEIPT_HTML) {
      const receiptId = message.receiptId || '';
      const html = message.html || '';

      (async () => {
        try {
          let htmlStr = html;
          // If the SW sends '__FETCH__', fetch the detail API ourselves
          if (htmlStr === '__FETCH__') {
            const resp = await fetch(
              `https://www.lidl.bg/mre/api/v1/tickets/${receiptId}?country=BG&languageCode=bg-BG`,
              { credentials: 'include' }
            );
            if (!resp.ok) {
              sendResponse({ success: false, error: `Detail API returned ${resp.status}` });
              return;
            }
            const data = await resp.json();
            htmlStr = data.ticket?.htmlPrintedReceipt || '';
            if (!htmlStr) {
              sendResponse({ success: false, error: 'No htmlPrintedReceipt in response' });
              return;
            }
          }

          const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
          const result = window._parseLidlReceiptHtml(doc, receiptId);
          sendResponse(result || { success: false, error: 'Parse produced no result' });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message.type === LIDL_RECEIPT_MESSAGES.FETCH_LISTING) {
      const page = message.page || 1;
      fetch(`https://www.lidl.bg/mre/api/v1/tickets?country=BG&page=${page}`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.type === LIDL_RECEIPT_MESSAGES.FETCH_DETAIL) {
      const id = message.receiptId || '';
      fetch(`https://www.lidl.bg/mre/api/v1/tickets/${id}?country=BG&languageCode=bg-BG`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });

  // Inline parser for Lidl receipt HTML (mirrors receipt-parser.js logic
  // for use in content-script context where ES module imports are unavailable).
  window._parseLidlReceiptHtml = function(doc, receiptId) {
    function pf(str) { if (!str) return NaN; return parseFloat(str.replace(',', '.').replace(/[^\d.]/g, '')); }
    function et(el) { return (el ? el.textContent : '').trim(); }
    function pln(text) { const m = text.match(/(\d+[.,]\d{2})/g); return m ? pf(m[m.length - 1]) : 0; }
    function pqf(text) { const m = text.match(/^(\d+[.,]\d{3})/); return m ? pf(m[1]) : 1; }
    function gu(desc, ql) { const c = ((desc||'') + ' ' + (ql||'')).toUpperCase(); if (/НА\s*КГ|КГ\b|KG\b/.test(c)) return 'kg'; if (/[.,]\d{3}\s*x/i.test(ql||'')) return 'kg'; return 'pcs'; }
    function ctb(ev, er) { if (!er || !ev) return ev; return Math.round(ev * er * 100) / 100; }

    function dc(d) {
      const allSpans = d.querySelectorAll('.purchase_summary > span, .purchase_tender_information > span');
      const lines = Array.from(allSpans).map(s => s.textContent.trim()).filter(Boolean);
      let er = null, ct = null, he = false, hb = false;
      for (const l of lines) {
        const m = l.match(/1\s*EUR\s*[=]\s*(\d+[.,]\d+)/i); if (m) { er = pf(m[1]); continue; }
        if (l.match(/EUR|евро/i) && !l.match(/1 EUR =/i) && !l.match(/ОБМЕНЕН/i)) he = true;
        if (l.match(/[лЛ][вВ]\b|BGN/i) || l.match(/\(\s*лв\s*\)/i)) hb = true;
        const am = l.match(/(?:AMT|СУМА)\s*[:\s]*(\d+[.,]\d{2})\s*(EUR|BGN|ЛВ)/i);
        if (am) ct = am[2].toUpperCase() === 'EUR' ? 'EUR' : 'BGN';
      }
      if (!ct && he && er) ct = 'EUR'; else if (!ct && hb) ct = 'BGN';
      return { currency_item: (ct === 'EUR' && er) ? 'EUR' : 'BGN', currency_total: ct || 'BGN', exchange_rate: er || null, is_eur_receipt: (ct === 'EUR' && er) };
    }

    const ci = dc(doc);
    const isEur = ci.is_eur_receipt;
    const er = ci.exchange_rate;

    const articleSpans = doc.querySelectorAll('.purchase_list .article');
    const items = [];
    let ln = 0, i = 0;
    while (i < articleSpans.length) {
      const row = articleSpans[i];
      const artId = row.getAttribute('data-art-id') || '';
      const up = pf(row.getAttribute('data-unit-price') || '');
      const tt = row.getAttribute('data-tax-type') || '';
      const desc = row.getAttribute('data-art-description') || '';
      const rt = et(row);
      const nx = i + 1 < articleSpans.length ? articleSpans[i + 1] : null;
      const na = nx ? nx.getAttribute('data-art-id') || '' : '';
      const paired = artId && na === artId;
      if (paired) {
        const qty = pqf(rt);
        const lt = pln(et(nx));
        const nm = nx.getAttribute('data-art-description') || desc;
        const un = gu(desc || nm, rt);
        items.push({ line_no: ++ln, article_id: artId, name: nm, raw_text: et(nx), tax_type: tt, price_bgn: isEur ? ctb(lt, er) : lt, price_eur: isEur ? lt : null, unit_price_bgn: isEur && !isNaN(up) ? ctb(up, er) : (!isNaN(up) ? up : (qty > 0 ? Math.round(lt / qty * 100) / 100 : lt)), line_total_bgn: isEur ? ctb(lt, er) : lt, unit_price_eur: isEur ? (!isNaN(up) ? up : (qty > 0 ? Math.round(lt / qty * 100) / 100 : lt)) : null, line_total_eur: isEur ? lt : null, quantity: qty, quantity_unit: un, currency_item: ci.currency_item, parse_method: 'api_relay' });
        i += 2;
      } else {
        const nm = desc || rt.split(/\s{2,}/)[0] || rt;
        const lt = pln(rt);
        items.push({ line_no: ++ln, article_id: artId, name: nm, raw_text: rt, tax_type: tt, price_bgn: isEur ? ctb(lt, er) : lt, price_eur: isEur ? lt : null, unit_price_bgn: isEur && !isNaN(up) && up > 0 ? ctb(up, er) : (isEur ? ctb(lt, er) : lt), line_total_bgn: isEur ? ctb(lt, er) : lt, unit_price_eur: isEur ? (!isNaN(up) && up > 0 ? up : lt) : null, line_total_eur: isEur ? lt : null, quantity: 1, quantity_unit: gu(desc || nm, ''), currency_item: ci.currency_item, parse_method: 'api_relay' });
        i++;
      }
    }

    const rd = doc.querySelector('.receipt_data > span, [data-testid*="receipt-data"] > span');
    const da = rd ? rd.getAttribute('data-date') : '';
    const ta = rd ? rd.getAttribute('data-time') : '';
    const sc = rd ? rd.getAttribute('data-store') || '' : '';
    const tl = rd ? rd.getAttribute('data-till') || '' : '';
    const hls = Array.from(doc.querySelectorAll('.header > span')).map(s => s.textContent.trim());
    let bs = '', vn = '';
    for (const l of hls) {
      if (l.match(/БУЛСТАТ|bulstat/i)) bs = l.replace(/.*?[:\s]+/g, '').trim();
      else if (l.match(/ЗДДС|ДДС|VAT|vat/i)) vn = l.replace(/.*?[:\s]+/g, '').replace(/^No\s*/i, '').trim();
    }

    const ts = doc.querySelector('.purchase_summary [data-receipt-total]');
    const dt = ts ? pf(ts.getAttribute('data-receipt-total') || '') : NaN;
    const sum = !isNaN(dt) && dt > 0 ? dt : items.reduce((a, x) => a + (x.line_total_bgn || x.price_bgn || 0), 0);

    return {
      success: true,
      receipt_id: receiptId,
      date: da, time: ta, datetime_local: da && ta ? `${da}T${ta}` : '',
      store: { code: sc, name: '', address: '', bulstat: bs, vat_number: vn, usn: '', till: tl },
      receipt_meta: { sequence_number: rd ? rd.getAttribute('data-sequence-number') || '' : '', fiscal_code: rd ? rd.getAttribute('data-fiscal-code') || '' : '' },
      totals: { currency_primary: ci.currency_item === 'EUR' ? 'EUR' : 'BGN', sum: Math.round(sum * 100) / 100, sum_eur: ci.is_eur_receipt ? Math.round(sum * 100) / 100 : null, sum_bgn: ci.is_eur_receipt && er ? Math.round(sum * er * 100) / 100 : Math.round(sum * 100) / 100 },
      items,
      currency_item: ci.currency_item, currency_total: ci.currency_total, exchange_rate: ci.exchange_rate,
      source_url: `https://www.lidl.bg/mre/purchase-detail?t=${receiptId}`,
      raw_sections: { header_lines: hls, summary_rows: [], tender_lines: [], receipt_data_rows: [] }
    };
  };
})();
