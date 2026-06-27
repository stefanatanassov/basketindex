(() => {
  // TODO(BasketIndex Phase 4): split raw Lidl DOM extraction from normalized receipt output.
  // Currently this file mixes Lidl-specific DOM parsing (selectors, currency detection,
  // paired-row handling) with receipt data assembly. After Phase 4:
  //   - adapters/lidl/detail-extractor.js: raw DOM extraction (extractReceipt)
  //   - adapters/lidl/normalizer.js: maps raw Lidl receipt to normalized BasketIndex schema
  //   - core/receipt-normalizer.js: validates and writes the generic receipt schema

  const { LIDL_RECEIPT_MESSAGES, waitForElement, waitForStability, parseReceiptIdFromUrl, stripCurrency } = window.LidlReceiptShared;

  function extractText(el) {
    return (el ? el.textContent : '').trim();
  }

  function parseFloatBg(str) {
    if (!str) return NaN;
    return parseFloat(str.replace(',', '.').replace(/[^\d.]/g, ''));
  }

  const FIXED_EXCHANGE_RATE = 1.95583;

  function detectCurrency() {
    const allSpans = document.querySelectorAll('.purchase_summary > span, .purchase_tender_information > span');
    const lines = Array.from(allSpans).map(s => s.textContent.trim()).filter(Boolean);

    let exchangeRate = null;
    let currencyTotal = null;
    let hasEurLine = false;
    let hasBgnLine = false;

    for (const line of lines) {
      const erMatch = line.match(/1\s*EUR\s*[=]\s*(\d+[.,]\d+)/i);
      if (erMatch) {
        exchangeRate = parseFloatBg(erMatch[1]);
        continue;
      }

      if (line.match(/EUR|евро/i) && !line.match(/1 EUR =/i) && !line.match(/ОБМЕНЕН/i)) {
        hasEurLine = true;
      }
      if (line.match(/[лЛ][вВ]\b|BGN/i) || line.match(/\(\s*лв\s*\)/i)) {
        hasBgnLine = true;
      }

      const amtMatch = line.match(/(?:AMT|СУМА)\s*[:\s]*(\d+[.,]\d{2})\s*(EUR|BGN|ЛВ)/i);
      if (amtMatch) {
        currencyTotal = amtMatch[2].toUpperCase() === 'EUR' ? 'EUR' : 'BGN';
      }
    }

    if (!currencyTotal && hasEurLine && exchangeRate) {
      currencyTotal = 'EUR';
    } else if (!currencyTotal && hasBgnLine) {
      currencyTotal = 'BGN';
    }

    const currencyItem = (currencyTotal === 'EUR' && exchangeRate) ? 'EUR' : 'BGN';

    return {
      currency_item: currencyItem,
      currency_total: currencyTotal || 'BGN',
      exchange_rate: exchangeRate || null,
      is_eur_receipt: currencyItem === 'EUR'
    };
  }

  function convertToBgn(eurValue, exchangeRate) {
    if (!exchangeRate || !eurValue) return eurValue;
    return Math.round(eurValue * exchangeRate * 100) / 100;
  }

  function parseLastNumber(text) {
    const nums = text.match(/(\d+[.,]\d{2})/g);
    if (!nums || nums.length === 0) return 0;
    return parseFloatBg(nums[nums.length - 1]);
  }

  function parseQtyFromLine(text) {
    const m = text.match(/^(\d+[.,]\d{3})/);
    if (m) return parseFloatBg(m[1]);
    return 1;
  }

  function guessUnit(description, qtyUnitLine) {
    const combined = (description + ' ' + (qtyUnitLine || '')).toUpperCase();
    if (/НА\s*КГ|КГ\b|KG\b/.test(combined)) return 'kg';
    if (/НА\s*БР|БР\b|PCS\b/.test(combined)) return 'pcs';
    if (/\d+\s*Л\b|L\b/.test(combined)) return 'l';
    if (/[.,]\d{3}\s*x/i.test(qtyUnitLine || '')) return 'kg';
    return 'pcs';
  }

  function buildItem(lineNo, artId, name, rawText, taxType, unitPriceRaw, quantity, lineTotalRaw, unit, method, currencyInfo) {
    const isEur = currencyInfo && currencyInfo.is_eur_receipt;
    const er = currencyInfo ? currencyInfo.exchange_rate : null;

    const unitPriceEur = isEur ? unitPriceRaw : null;
    const lineTotalEur = isEur ? lineTotalRaw : null;
    const unitPriceBgn = isEur ? convertToBgn(unitPriceRaw, er) : unitPriceRaw;
    const lineTotalBgn = isEur ? convertToBgn(lineTotalRaw, er) : lineTotalRaw;

    return {
      line_no: lineNo,
      article_id: artId || '',
      name: name || '',
      raw_text: rawText || '',
      tax_type: taxType || '',
      price_bgn: lineTotalBgn,
      price_eur: isEur ? lineTotalRaw : null,
      unit_price_bgn: unitPriceBgn,
      line_total_bgn: lineTotalBgn,
      unit_price_eur: unitPriceEur,
      line_total_eur: lineTotalEur,
      quantity: quantity,
      quantity_unit: unit,
      currency_item: isEur ? 'EUR' : 'BGN',
      parse_method: method
    };
  }

  function extractItemsFromDom(currencyInfo) {
    const articleSpans = document.querySelectorAll('.purchase_list .article');
    if (articleSpans.length === 0) return null;

    const items = [];
    let lineNo = 0;
    let i = 0;

    while (i < articleSpans.length) {
      const row = articleSpans[i];
      const artId = row.getAttribute('data-art-id') || '';
      const unitPriceAttr = row.getAttribute('data-unit-price') || '';
      const unitPrice = parseFloatBg(unitPriceAttr);
      const taxType = row.getAttribute('data-tax-type') || '';
      const description = row.getAttribute('data-art-description') || '';
      const rowText = extractText(row);

      const nextRow = i + 1 < articleSpans.length ? articleSpans[i + 1] : null;
      const nextArtId = nextRow ? nextRow.getAttribute('data-art-id') || '' : '';
      const isPaired = artId && nextArtId === artId;

      if (isPaired) {
        const qtyLineText = rowText;
        const detailRow = nextRow;
        const detailText = extractText(detailRow);
        const name = detailRow.getAttribute('data-art-description') || description;
        const quantity = parseQtyFromLine(qtyLineText);
        const lineTotal = parseLastNumber(detailText);
        const qtyUnit = guessUnit(description || name, qtyLineText);

        items.push(buildItem(
          ++lineNo, artId, name, detailText, taxType,
          !isNaN(unitPrice) ? unitPrice : (quantity > 0 ? Math.round(lineTotal / quantity * 100) / 100 : lineTotal),
          quantity, lineTotal, qtyUnit, 'dom_paired', currencyInfo
        ));
        i += 2;
      } else {
        const name = description || rowText.split(/\s{2,}/)[0] || rowText;
        const lineTotal = parseLastNumber(rowText);
        const qtyUnit = guessUnit(description || name, '');

        items.push(buildItem(
          ++lineNo, artId, name, rowText, taxType,
          (!isNaN(unitPrice) && unitPrice > 0) ? unitPrice : lineTotal,
          1, lineTotal, qtyUnit, 'dom_single', currencyInfo
        ));
        i++;
      }
    }
    return items;
  }

  function extractItemsFallback(currencyInfo) {
    const rows = document.querySelectorAll('[data-testid*="article"], [class*="purchase_item"]');
    if (rows.length === 0) {
      const alt = document.querySelectorAll('[data-testid^="ticket-"] li, [data-testid^="ticket-"] tr');
      if (alt.length > 0) return extractItemsFromAltRows(alt, currencyInfo);
    }

    const items = [];
    let lineNo = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const text = extractText(row);
      if (!text) continue;
      lineNo++;
      const arts = parseQuantityAndPriceFallback(text, extractSpanTexts(row));
      items.push(buildItem(
        lineNo, '', text, text, '', arts.unit_price_bgn, arts.quantity,
        arts.line_total_bgn, arts.quantity_unit, arts.parse_method, currencyInfo
      ));
    }
    return items;
  }

  function extractSpanTexts(row) {
    return Array.from(row.querySelectorAll('span')).map(s => s.textContent.trim()).filter(Boolean);
  }

  function extractItemsFromAltRows(rows, currencyInfo) {
    const items = [];
    let idx = 0;
    for (const row of rows) {
      const text = extractText(row);
      if (!text) continue;
      idx++;
      const arts = parseQuantityAndPriceFallback(text, []);
      items.push(buildItem(
        idx, '', text, text, '', arts.unit_price_bgn, arts.quantity,
        arts.line_total_bgn, arts.quantity_unit, arts.parse_method, currencyInfo
      ));
    }
    return items;
  }

  function parseQuantityAndPriceFallback(rawText, allSpanTexts) {
    const text = rawText.replace(/\s+/g, ' ').trim();
    const allNums = [];
    for (const t of allSpanTexts) {
      const n = parseFloatBg(t);
      if (!isNaN(n) && n > 0) allNums.push(n);
    }
    if (allNums.length === 0) {
      const numsInText = text.match(/(\d+[.,]\d{2,3}|\d+)/g);
      if (numsInText) {
        for (const m of numsInText) {
          const n = parseFloatBg(m);
          if (!isNaN(n) && n > 0) allNums.push(n);
        }
      }
    }

    const result = {
      quantity: 1,
      unit_price_bgn: 0,
      line_total_bgn: 0,
      quantity_unit: 'pcs',
      parse_method: 'fallback_single'
    };

    const clean = text
      .replace(/[Бб]\b\s*$/g, '')
      .replace(/\bлв\b/gi, '')
      .replace(/\bbgn\b/gi, '')
      .trim();

    const tripleX = clean.match(/(\d+[.,]\d{3}|\d+)\s*[xXхХ]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})(?:\s*[=]?\s*)/);
    if (tripleX) {
      const qty = parseFloatBg(tripleX[1]);
      const unit = parseFloatBg(tripleX[2]);
      const total = parseFloatBg(tripleX[3]);
      const tol = qty < 1 ? 0.05 : 0.02;
      if (!isNaN(unit) && !isNaN(total) && Math.abs(qty * unit - total) < tol) {
        result.quantity = Math.round(qty * 1000) / 1000;
        result.unit_price_bgn = unit;
        result.line_total_bgn = total;
        result.quantity_unit = qty < 1 || /кг|kg/i.test(text) ? 'kg' : 'pcs';
        result.parse_method = qty === Math.floor(qty) ? 'fallback_triple_x_count' : 'fallback_triple_x_weight';
        return result;
      }
    }

    if (allNums.length === 2) {
      const a = allNums[0];
      const b = allNums[1];
      for (const q of [2, 3, 4, 5, 6, 8, 10, 12]) {
        if (Math.abs(q * a - b) < 0.02) {
          result.quantity = q;
          result.unit_price_bgn = a;
          result.line_total_bgn = b;
          result.parse_method = 'fallback_two_nums';
          return result;
        }
        if (Math.abs(q * b - a) < 0.02) {
          result.quantity = q;
          result.unit_price_bgn = b;
          result.line_total_bgn = a;
          result.parse_method = 'fallback_two_nums_swapped';
          return result;
        }
      }
    }

    if (allNums.length >= 1) {
      const price = allNums[allNums.length - 1];
      result.unit_price_bgn = price;
      result.line_total_bgn = price;
      result.quantity = 1;
      result.parse_method = 'fallback_single_price';
      return result;
    }

    return result;
  }

  function extractItems(currencyInfo) {
    const domItems = extractItemsFromDom(currencyInfo);
    if (domItems && domItems.length > 0) return domItems;
    return extractItemsFallback(currencyInfo);
  }

  function extractSummaryRows() {
    const rows = document.querySelectorAll('.purchase_summary > span, [data-testid*="summary"] > span');
    const result = [];
    for (const row of rows) result.push(row.textContent.trim());
    return result;
  }

  function extractReceiptDataRows() {
    const rows = document.querySelectorAll('.receipt_data > span, [data-testid*="receipt-data"] > span');
    const result = [];
    for (const row of rows) result.push(row.textContent.trim());
    return result;
  }

  function extractTenderLines() {
    const rows = document.querySelectorAll('.purchase_tender_information > span, [data-testid*="tender"] > span');
    const result = [];
    for (const row of rows) result.push(row.textContent.trim());
    return result;
  }

  function extractHeaderLines() {
    const rows = document.querySelectorAll('.header > span, [data-testid*="header"] > span');
    const result = [];
    for (const row of rows) result.push(row.textContent.trim());
    return result;
  }

  function extractStoreInfo() {
    const receiptData = document.querySelector('.receipt_data > span, [data-testid*="receipt-data"] > span');
    const info = { code: '', name: '', address: '', bulstat: '', vat_number: '', usn: '', till: '' };

    if (receiptData) {
      const storeAttr = receiptData.getAttribute('data-store');
      if (storeAttr) info.code = storeAttr;
      const tillAttr = receiptData.getAttribute('data-till');
      if (tillAttr) info.till = tillAttr;
    }

    const header = extractHeaderLines();
    for (const line of header) {
      if (line.match(/БУЛСТАТ|bulstat/i)) {
        info.bulstat = line.replace(/.*?[:\s]+/g, '').trim();
      } else if (line.match(/ЗДДС|ДДС|VAT|vat/i)) {
        info.vat_number = line.replace(/.*?[:\s]+/g, '').replace(/^No\s*/i, '').trim();
      } else if (line.match(/усн|usn/i)) {
        info.usn = line.replace(/.*?[:\s]+/g, '').trim();
      } else if (info.name === '' && line.match(/Лидл|lidl/i)) {
        info.name = line.trim();
      }
    }

    if (info.name === '') {
      const nameEl = document.querySelector('[data-testid*="store-name"], h2, h3');
      if (nameEl) info.name = nameEl.textContent.trim();
    }
    if (info.address === '') {
      const addrEl = document.querySelector('[class*="address"], [data-testid*="address"]');
      if (addrEl) info.address = addrEl.textContent.trim();
    }

    return info;
  }

  function extractTotals(currencyInfo) {
    const totalSpan = document.querySelector('.purchase_summary [data-receipt-total]');
    const dataTotal = totalSpan ? parseFloatBg(totalSpan.getAttribute('data-receipt-total') || '') : NaN;
    const tenderSpan = document.querySelector('.purchase_summary [data-tender-description], .purchase_tender_information span');
    let tenderAmount = 0;
    if (tenderSpan) {
      const text = tenderSpan.textContent.trim();
      const amtMatch = text.match(/(\d+[.,]\d{2})\s*(?:EUR|BGN|ЛВ)?\s*$/i);
      if (amtMatch) tenderAmount = parseFloatBg(amtMatch[1]);
    }

    const summary = extractSummaryRows();
    const tender = extractTenderLines();
    const allLines = [...summary, ...tender];
    let sumParsed = 0;
    let tenderLabel = '';
    for (const line of allLines) {
      if (line.match(/общо|total|sum/i) && !line.match(/данък|tax|ддс|vat/i)) {
        const num = stripCurrency(line);
        if (num > sumParsed) sumParsed = num;
      }
      if (line.match(/платено|tender|paid|карта|cash|в брой/i)) {
        const num = stripCurrency(line);
        if (num > 0 && tenderAmount === 0) tenderAmount = num;
        tenderLabel = line;
      }
    }
    if (tenderLabel && tenderSpan) tenderLabel = tenderSpan.textContent.trim();

    const sum = !isNaN(dataTotal) && dataTotal > 0 ? dataTotal : sumParsed;
    const items = extractItems(currencyInfo);
    let checkSum = sum;
    if (checkSum === 0) checkSum = items.reduce((acc, i) => acc + (i.line_total_bgn || i.price_bgn || 0), 0);

    const isEur = currencyInfo && currencyInfo.is_eur_receipt;
    const er = currencyInfo ? currencyInfo.exchange_rate : null;
    const finalSum = sum > 0 ? sum : checkSum;

    return {
      currency_primary: isEur ? 'EUR' : 'BGN',
      sum: Math.round(finalSum * 100) / 100,
      sum_eur: isEur ? Math.round(finalSum * 100) / 100 : (er ? Math.round(finalSum / er * 100) / 100 : null),
      sum_bgn: isEur && er ? Math.round(finalSum * er * 100) / 100 : Math.round(finalSum * 100) / 100,
      tender_total_eur: isEur ? Math.round(tenderAmount * 100) / 100 : (er ? Math.round(tenderAmount / er * 100) / 100 : null),
      tender_total_bgn: isEur && er ? Math.round(tenderAmount * er * 100) / 100 : Math.round(tenderAmount * 100) / 100,
      tender_label: tenderLabel
    };
  }

  function extractDateTime() {
    const receiptData = document.querySelector('.receipt_data > span, [data-testid*="receipt-data"] > span');
    if (receiptData) {
      const dateAttr = receiptData.getAttribute('data-date');
      const timeAttr = receiptData.getAttribute('data-time');
      if (dateAttr && timeAttr) {
        return {
          date: dateAttr,
          time: timeAttr,
          datetime_local: `${dateAttr}T${timeAttr}`
        };
      }
      const text = receiptData.textContent.trim();
      const dtMatch = text.match(/(\d{1,2}[./]\d{1,2}[./]\d{2,4}).*?(\d{1,2}:\d{2}:\d{2})/);
      if (dtMatch) {
        const parts = dtMatch[1].split(/[./]/);
        if (parts.length === 3) {
          const yyyy = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          const mm = parts[1].padStart(2, '0');
          const dd = parts[0].padStart(2, '0');
          return { date: `${yyyy}-${mm}-${dd}`, time: dtMatch[2], datetime_local: `${yyyy}-${mm}-${dd}T${dtMatch[2]}` };
        }
      }
    }
    const dateEl = document.querySelector('.date, [data-testid*="date"], time, [datetime]');
    if (dateEl) {
      const datetime = dateEl.getAttribute('datetime');
      if (datetime) return { date: datetime.slice(0, 10), time: datetime.slice(11, 19), datetime_local: datetime };
    }
    return { date: '', time: '', datetime_local: '' };
  }

  function extractReceiptMeta() {
    const receiptData = document.querySelector('.receipt_data > span, [data-testid*="receipt-data"] > span');
    const fiscalAttr = receiptData ? receiptData.getAttribute('data-fiscal-code') : '';
    const seqAttr = receiptData ? receiptData.getAttribute('data-sequence-number') : '';
    if (fiscalAttr && seqAttr) {
      return { sequence_number: seqAttr, fiscal_code: fiscalAttr };
    }
    const header = extractHeaderLines();
    const allLines = [...header, ...(receiptData ? [receiptData.textContent.trim()] : [])];
    let sequence = '';
    let fiscal = '';
    for (const line of allLines) {
      if (line.match(/номер|number|№|#/i) || line.match(/фискал|fiscal/i)) {
        const num = line.match(/[\d-]{6,}/);
        if (num) {
          if (line.match(/фискал|fiscal/i)) fiscal = num[0];
          else sequence = num[0];
        }
      }
    }
    return { sequence_number: sequence, fiscal_code: fiscal };
  }

  function extractDiscounts() {
    const discountSpans = document.querySelectorAll('.purchase_list .discount');
    const discounts = {};
    for (const span of discountSpans) {
      const promoId = span.getAttribute('data-promotion-id') || '';
      if (!promoId) continue;
      if (!discounts[promoId]) {
        discounts[promoId] = { promotion_id: promoId, description: '', amount: 0 };
      }
      const text = span.textContent.trim();
      if (text.includes('ОТСТЪПКИ') || text.includes('отстъпки')) {
        const amtMatch = text.match(/(\d+[.,]\d{2})/);
        if (amtMatch) discounts[promoId].amount = parseFloatBg(amtMatch[1]);
      }
      if (text.includes('промоция') || text.includes('Lidl Plus')) {
        discounts[promoId].description = text.replace(/^#/, '').replace(/#$/, '').trim();
      }
    }
    return Object.values(discounts).filter(d => d.amount > 0 || d.description);
  }

  async function extractDetail(expectedReceiptId) {
    const container = await waitForElement('[data-testid^="ticket-"], .ticket, [class*="ticket"]', 8000);
    if (!container) {
      return { success: false, error: 'Receipt container not found', receipt_id_url: parseReceiptIdFromUrl() };
    }

    const receiptIdFromUrl = parseReceiptIdFromUrl();
    if (expectedReceiptId && receiptIdFromUrl !== expectedReceiptId) {
      return {
        success: false,
        error: `Receipt ID mismatch: expected ${expectedReceiptId}, got ${receiptIdFromUrl}`,
        receipt_id_url: receiptIdFromUrl
      };
    }

    const stable = await waitForStability('[data-testid^="ticket-"]', 500, 3, 15000);
    if (!stable) {
    }

    const currencyInfo = detectCurrency();
    const items = extractItems(currencyInfo);
    const discounts = extractDiscounts();
    const dateTime = extractDateTime();
    const store = extractStoreInfo();
    const totals = extractTotals(currencyInfo);
    const meta = extractReceiptMeta();

    return {
      success: true,
      receipt_id: receiptIdFromUrl || expectedReceiptId || '',
      source_url: window.location.href,
      date: dateTime.date,
      time: dateTime.time,
      datetime_local: dateTime.datetime_local,
      store,
      receipt_meta: meta,
      totals,
      items,
      discounts,
      currency_item: currencyInfo.currency_item,
      currency_total: currencyInfo.currency_total,
      exchange_rate: currencyInfo.exchange_rate,
      raw_sections: {
        header_lines: extractHeaderLines(),
        summary_rows: extractSummaryRows(),
        tender_lines: extractTenderLines(),
        receipt_data_rows: extractReceiptDataRows()
      }
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === LIDL_RECEIPT_MESSAGES.EXTRACT_DETAIL) {
      (async () => {
        try {
          const result = await extractDetail(message.receiptId);
          sendResponse(result);
        } catch (err) {
          sendResponse({
            success: false,
            error: err.message,
            receipt_id_url: parseReceiptIdFromUrl()
          });
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
