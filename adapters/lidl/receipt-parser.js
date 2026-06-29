// adapters/lidl/receipt-parser.js
// Pure parsing functions for Lidl receipt HTML.
// Accepts a Document (real `document` or `DOMParser`-parsed `htmlPrintedReceipt`)
// via the optional `doc` parameter. All DOM reads go through `doc || document`.
//
// Separated from detail-extractor.js so the API-driven path can parse
// `ticket.htmlPrintedReceipt` from the Lidl API without a browser tab.

function parseFloatBg(str) {
  if (!str) return NaN;
  return parseFloat(str.replace(',', '.').replace(/[^\d.]/g, ''));
}

function extractText(el) {
  return (el ? el.textContent : '').trim();
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

function convertToBgn(eurValue, exchangeRate) {
  if (!exchangeRate || !eurValue) return eurValue;
  return Math.round(eurValue * exchangeRate * 100) / 100;
}

function detectCurrency(doc) {
  const d = doc || document;
  const allSpans = d.querySelectorAll('.purchase_summary > span, .purchase_tender_information > span');
  const lines = Array.from(allSpans).map(s => s.textContent.trim()).filter(Boolean);

  let exchangeRate = null;
  let currencyTotal = null;
  let hasEurLine = false;
  let hasBgnLine = false;

  for (const line of lines) {
    const erMatch = line.match(/1\s*EUR\s*[=]\s*(\d+[.,]\d+)/i);
    if (erMatch) { exchangeRate = parseFloatBg(erMatch[1]); continue; }
    if (line.match(/EUR|евро/i) && !line.match(/1 EUR =/i) && !line.match(/ОБМЕНЕН/i)) hasEurLine = true;
    if (line.match(/[лЛ][вВ]\b|BGN/i) || line.match(/\(\s*лв\s*\)/i)) hasBgnLine = true;
    const amtMatch = line.match(/(?:AMT|СУМА)\s*[:\s]*(\d+[.,]\d{2})\s*(EUR|BGN|ЛВ)/i);
    if (amtMatch) currencyTotal = amtMatch[2].toUpperCase() === 'EUR' ? 'EUR' : 'BGN';
  }

  if (!currencyTotal && hasEurLine && exchangeRate) currencyTotal = 'EUR';
  else if (!currencyTotal && hasBgnLine) currencyTotal = 'BGN';

  const currencyItem = (currencyTotal === 'EUR' && exchangeRate) ? 'EUR' : 'BGN';

  return {
    currency_item: currencyItem,
    currency_total: currencyTotal || 'BGN',
    exchange_rate: exchangeRate || null,
    is_eur_receipt: currencyItem === 'EUR'
  };
}

function buildItem(lineNo, artId, name, rawText, taxType, unitPriceRaw, quantity, lineTotalRaw, unit, method, currencyInfo) {
  const isEur = currencyInfo && currencyInfo.is_eur_receipt;
  const er = currencyInfo ? currencyInfo.exchange_rate : null;
  const unitPriceEur = isEur ? unitPriceRaw : null;
  const lineTotalEur = isEur ? lineTotalRaw : null;
  const unitPriceBgn = isEur ? convertToBgn(unitPriceRaw, er) : unitPriceRaw;
  const lineTotalBgn = isEur ? convertToBgn(lineTotalRaw, er) : lineTotalRaw;

  return {
    line_no: lineNo, article_id: artId || '', name: name || '', raw_text: rawText || '',
    tax_type: taxType || '', price_bgn: lineTotalBgn, price_eur: isEur ? lineTotalRaw : null,
    unit_price_bgn: unitPriceBgn, line_total_bgn: lineTotalBgn,
    unit_price_eur: unitPriceEur, line_total_eur: lineTotalEur,
    quantity: quantity, quantity_unit: unit, currency_item: isEur ? 'EUR' : 'BGN', parse_method: method
  };
}

function extractItemsFromDom(currencyInfo, doc) {
  const d = doc || document;
  const articleSpans = d.querySelectorAll('.purchase_list .article');
  if (articleSpans.length === 0) return null;

  const items = [];
  let lineNo = 0;
  let i = 0;

  while (i < articleSpans.length) {
    const row = articleSpans[i];
    const artId = row.getAttribute('data-art-id') || '';
    const unitPrice = parseFloatBg(row.getAttribute('data-unit-price') || '');
    const taxType = row.getAttribute('data-tax-type') || '';
    const description = row.getAttribute('data-art-description') || '';
    const rowText = extractText(row);
    const nextRow = i + 1 < articleSpans.length ? articleSpans[i + 1] : null;
    const nextArtId = nextRow ? nextRow.getAttribute('data-art-id') || '' : '';
    const isPaired = artId && nextArtId === artId;

    if (isPaired) {
      const name = nextRow.getAttribute('data-art-description') || description;
      const quantity = parseQtyFromLine(rowText);
      const lineTotal = parseLastNumber(extractText(nextRow));
      const qtyUnit = guessUnit(description || name, rowText);
      items.push(buildItem(++lineNo, artId, name, extractText(nextRow), taxType,
        !isNaN(unitPrice) ? unitPrice : (quantity > 0 ? Math.round(lineTotal / quantity * 100) / 100 : lineTotal),
        quantity, lineTotal, qtyUnit, 'dom_paired', currencyInfo));
      i += 2;
    } else {
      const name = description || rowText.split(/\s{2,}/)[0] || rowText;
      const lineTotal = parseLastNumber(rowText);
      const qtyUnit = guessUnit(description || name, '');
      items.push(buildItem(++lineNo, artId, name, rowText, taxType,
        (!isNaN(unitPrice) && unitPrice > 0) ? unitPrice : lineTotal,
        1, lineTotal, qtyUnit, 'dom_single', currencyInfo));
      i++;
    }
  }
  return items;
}

function extractSummaryRows(doc) {
  const d = doc || document;
  const rows = d.querySelectorAll('.purchase_summary > span, [data-testid*="summary"] > span');
  return Array.from(rows).map(r => r.textContent.trim());
}

function extractTenderLines(doc) {
  const d = doc || document;
  const rows = d.querySelectorAll('.purchase_tender_information > span, [data-testid*="tender"] > span');
  return Array.from(rows).map(r => r.textContent.trim());
}

function extractHeaderLines(doc) {
  const d = doc || document;
  const rows = d.querySelectorAll('.header > span, [data-testid*="header"] > span');
  return Array.from(rows).map(r => r.textContent.trim());
}

function extractReceiptDataRows(doc) {
  const d = doc || document;
  const rows = d.querySelectorAll('.receipt_data > span, [data-testid*="receipt-data"] > span');
  return Array.from(rows).map(r => r.textContent.trim());
}

function extractDateTime(doc) {
  const d = doc || document;
  const receiptData = d.querySelector('.receipt_data > span, [data-testid*="receipt-data"] > span');
  if (receiptData) {
    const dateAttr = receiptData.getAttribute('data-date');
    const timeAttr = receiptData.getAttribute('data-time');
    if (dateAttr && timeAttr) return { date: dateAttr, time: timeAttr, datetime_local: `${dateAttr}T${timeAttr}` };
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
  return { date: '', time: '', datetime_local: '' };
}

function extractStoreInfo(doc) {
  const d = doc || document;
  const receiptData = d.querySelector('.receipt_data > span, [data-testid*="receipt-data"] > span');
  const info = { code: '', name: '', address: '', bulstat: '', vat_number: '', usn: '', till: '' };
  if (receiptData) {
    const storeAttr = receiptData.getAttribute('data-store');
    if (storeAttr) info.code = storeAttr;
    const tillAttr = receiptData.getAttribute('data-till');
    if (tillAttr) info.till = tillAttr;
  }
  for (const line of extractHeaderLines(d)) {
    if (line.match(/БУЛСТАТ|bulstat/i)) info.bulstat = line.replace(/.*?[:\s]+/g, '').trim();
    else if (line.match(/ЗДДС|ДДС|VAT|vat/i)) info.vat_number = line.replace(/.*?[:\s]+/g, '').replace(/^No\s*/i, '').trim();
    else if (line.match(/усн|usn/i)) info.usn = line.replace(/.*?[:\s]+/g, '').trim();
    else if (info.name === '' && line.match(/Лидл|lidl/i)) info.name = line.trim();
  }
  return info;
}

function extractReceiptMeta(doc) {
  const d = doc || document;
  const receiptData = d.querySelector('.receipt_data > span, [data-testid*="receipt-data"] > span');
  const fiscalAttr = receiptData ? receiptData.getAttribute('data-fiscal-code') : '';
  const seqAttr = receiptData ? receiptData.getAttribute('data-sequence-number') : '';
  if (fiscalAttr && seqAttr) return { sequence_number: seqAttr, fiscal_code: fiscalAttr };
  return { sequence_number: '', fiscal_code: '' };
}

function extractDiscounts(doc) {
  const d = doc || document;
  const spans = d.querySelectorAll('.purchase_list .discount');
  const discounts = {};
  for (const span of spans) {
    const promoId = span.getAttribute('data-promotion-id') || '';
    if (!promoId) continue;
    if (!discounts[promoId]) discounts[promoId] = { promotion_id: promoId, description: '', amount: 0 };
    const text = span.textContent.trim();
    if (text.includes('ОТСТЪПКИ') || text.includes('отстъпки')) {
      const m = text.match(/(\d+[.,]\d{2})/);
      if (m) discounts[promoId].amount = parseFloatBg(m[1]);
    }
    if (text.includes('промоция') || text.includes('Lidl Plus')) {
      discounts[promoId].description = text.replace(/^#/, '').replace(/#$/, '').trim();
    }
  }
  return Object.values(discounts).filter(d => d.amount > 0 || d.description);
}

function stripCurrency(value) {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d,.\-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractTotals(currencyInfo, doc) {
  const d = doc || document;
  const totalSpan = d.querySelector('.purchase_summary [data-receipt-total]');
  const dataTotal = totalSpan ? parseFloatBg(totalSpan.getAttribute('data-receipt-total') || '') : NaN;
  const tenderSpan = d.querySelector('.purchase_summary [data-tender-description], .purchase_tender_information span');
  let tenderAmount = 0;
  let tenderLabel = '';

  if (tenderSpan) {
    const text = tenderSpan.textContent.trim();
    const amtMatch = text.match(/(\d+[.,]\d{2})\s*(?:EUR|BGN|ЛВ)?\s*$/i);
    if (amtMatch) tenderAmount = parseFloatBg(amtMatch[1]);
    tenderLabel = text;
  }

  const summary = extractSummaryRows(d);
  const tender = extractTenderLines(d);
  let sumParsed = 0;
  for (const line of [...summary, ...tender]) {
    if (line.match(/общо|total|sum/i) && !line.match(/данък|tax|ддс|vat/i)) {
      const num = stripCurrency(line);
      if (num > sumParsed) sumParsed = num;
    }
  }

  const sum = !isNaN(dataTotal) && dataTotal > 0 ? dataTotal : sumParsed;
  const finalSum = sum > 0 ? sum : sumParsed;
  const isEur = currencyInfo && currencyInfo.is_eur_receipt;
  const er = currencyInfo ? currencyInfo.exchange_rate : null;

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

function parseReceipt(doc, receiptId) {
  const currencyInfo = detectCurrency(doc);
  const items = extractItemsFromDom(currencyInfo, doc);
  const itemsResult = items || [];
  const dateTime = extractDateTime(doc);
  const store = extractStoreInfo(doc);
  const totals = extractTotals(currencyInfo, doc);
  const meta = extractReceiptMeta(doc);
  const discounts = extractDiscounts(doc);

  return {
    success: true,
    receipt_id: receiptId || '',
    date: dateTime.date, time: dateTime.time, datetime_local: dateTime.datetime_local,
    store, receipt_meta: meta, totals, items: itemsResult, discounts,
    currency_item: currencyInfo.currency_item,
    currency_total: currencyInfo.currency_total,
    exchange_rate: currencyInfo.exchange_rate,
    raw_sections: {
      header_lines: extractHeaderLines(doc),
      summary_rows: extractSummaryRows(doc),
      tender_lines: extractTenderLines(doc),
      receipt_data_rows: extractReceiptDataRows(doc)
    }
  };
}

export {
  parseReceipt, extractItemsFromDom, detectCurrency, extractTotals,
  extractDateTime, extractStoreInfo, extractReceiptMeta, extractDiscounts,
  buildItem, parseFloatBg, parseLastNumber, parseQtyFromLine, guessUnit,
  convertToBgn, stripCurrency
};
