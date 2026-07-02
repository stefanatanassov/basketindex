// lib/ai-pack.js
// AI Analysis Export Pack — data assembly, derived summaries, prompt generation, ZIP packaging.

import { loadRuns, runLabel } from './run-history.js'; // runLabel is in trends.js, redefine here
import { cleanProductName } from './product-name.js';
import { createZip } from './zip.js';

function retailerLabel(r) { return r === 'lidl' ? 'Lidl' : r === 'metro' ? 'Metro' : r.toUpperCase(); }

function runLabelLocal(run) {
  const rl = retailerLabel(run.retailer);
  const d = new Date(run.completedAt || run.startedAt || '').toISOString().slice(0, 10);
  return `${rl} (${d})`;
}

// ── Derived summaries ──

function buildTopProducts(receipts, limit = 15) {
  const counts = new Map();
  for (const rc of receipts) {
    for (const item of (rc.items || [])) {
      const name = cleanProductName(item.product?.name || '');
      if (!name || name.length < 3) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ product: name, purchase_count: count }));
}

function buildRecurringProducts(receipts, minPurchases = 3) {
  const dates = new Map();
  for (const rc of receipts) {
    const d = rc.receipt?.date || '';
    for (const item of (rc.items || [])) {
      const name = cleanProductName(item.product?.name || '');
      if (!name || name.length < 3) continue;
      if (!dates.has(name)) dates.set(name, []);
      dates.get(name).push(d);
    }
  }
  const result = [];
  for (const [name, ds] of dates) {
    if (ds.length < minPurchases) continue;
    const sorted = [...new Set(ds)].sort();
    result.push({
      product: name,
      total_purchases: ds.length,
      first_seen: sorted[0],
      last_seen: sorted[sorted.length - 1],
      unique_dates: sorted.length
    });
  }
  return result.sort((a, b) => b.total_purchases - a.total_purchases).slice(0, 30);
}

function buildSpendOverTime(receipts) {
  const months = new Map();
  for (const rc of receipts) {
    const d = rc.receipt?.date || '';
    if (!d) continue;
    const month = d.slice(0, 7);
    const total = rc.totals?.total_primary || 0;
    months.set(month, { month, total_spend: Math.round(((months.get(month)?.total_spend || 0) + total) * 100) / 100, receipt_count: (months.get(month)?.receipt_count || 0) + 1 });
  }
  return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function buildDiscountSummary(receipts) {
  let totalDiscount = 0;
  let discountedItems = 0;
  const promoMap = new Map();
  for (const rc of receipts) {
    for (const item of (rc.items || [])) {
      for (const d of (item.discounts || [])) {
        totalDiscount += d.amount_primary || 0;
        discountedItems++;
        const pid = d.promotion_id || d.description || 'unknown';
        promoMap.set(pid, (promoMap.get(pid) || 0) + (d.amount_primary || 0));
      }
    }
  }
  return {
    total_discount_amount: Math.round(totalDiscount * 100) / 100,
    discounted_item_count: discountedItems,
    top_promotions: Array.from(promoMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, amount]) => ({ promotion: id, total_saved: Math.round(amount * 100) / 100 }))
  };
}

function buildRetailerSummary(receipts) {
  const map = new Map();
  for (const rc of receipts) {
    const r = (rc.source?.retailer_name || rc.source?.retailer_id || 'unknown').toLowerCase();
    const m = map.get(r) || { retailer: r, receipt_count: 0, item_count: 0, total_spend: 0 };
    m.receipt_count++;
    m.item_count += (rc.items || []).length;
    m.total_spend += rc.totals?.total_primary || 0;
    map.set(r, m);
  }
  return Array.from(map.values()).map(m => ({
    ...m,
    total_spend: Math.round(m.total_spend * 100) / 100
  }));
}

// ── Prompt templates ──

const PROMPTS = {
  'personal-inflation': {
    title_bg: 'Лична инфлация',
    title_en: 'Personal inflation',
    prompt_bg: `# Анализ на личната ти инфлация

Ти си финансов анализатор, който помага на потребител да разбере как са се променили цените на неговите покупки във времето.

## Данни
Прегледай прикачения файл \`data.json\`. Той съдържа нормализирани касови бележки от покупки в Lidl и Metro, заедно с предварително изчислени помощни обобщения.

## Задача
1. Анализирай как са се променили цените на продуктите, които потребителят купува редовно.
2. Количествено опиши промените — използвай конкретни числа и проценти.
3. Разграничи реални ценови промени от промени в състава на пазарската кошница.
4. Посочи кои продукти са поскъпнали най-много и кои са поевтинели.
5. Обясни какво означават тези промени за потребителя на практика.

## Структура на отговора
1. **Резюме** — 2-3 изречения с основния извод.
2. **Какво се промени** — кои продукти, с колко, за какъв период.
3. **Защо има значение** — практически ефект върху бюджета.
4. **Какво можеш да направиш** — практически съвети според данните.
5. **Ограничения** — какво данните не показват, каква е несигурността.

## Важни правила
- Използвай САМО данните от \`data.json\`.
- Ако няма достатъчно доказателства за дадено твърдение, кажи го.
- Разграничавай факти от предположения.
- Пиши на български, ясно и разбираемо.
- Не използвай финансов жаргон без обяснение.`,
    prompt_en: `# Personal Inflation Analysis

You are a financial analyst helping a user understand how the prices of their purchases have changed over time.

## Data
Review the attached \`data.json\` file. It contains normalized receipts from Lidl and Metro purchases, along with precomputed helper summaries.

## Task
1. Analyze how prices have changed for products the user buys regularly.
2. Quantify changes — use specific numbers and percentages.
3. Distinguish real price changes from changes in basket composition.
4. Identify which products increased most and which decreased.
5. Explain what these changes mean for the user in practical terms.

## Answer structure
1. **Summary** — 2-3 sentences with the main finding.
2. **What changed** — which products, by how much, over what period.
3. **Why it matters** — practical budget impact.
4. **What you can do** — practical suggestions based on the data.
5. **Limitations** — what the data doesn't show, what's uncertain.

## Important rules
- Use ONLY the data from \`data.json\`.
- If there's not enough evidence for a claim, say so.
- Distinguish facts from inferences.
- Write clearly and understandably.
- Avoid jargon without explanation.`
  },

  'discount-savings': {
    title_bg: 'Спестявания от промоции',
    title_en: 'Discount savings',
    prompt_bg: `# Анализ на спестяванията от промоции и отстъпки

Ти си анализатор на потребителски разходи. Прегледай \`data.json\` и анализирай:

1. Колко общо е спестено чрез отстъпки и промоции.
2. Кои продукти са купувани най-често с отстъпка.
3. Дали потребителят разчита на промоции за определени продукти.
4. Каква част от общите разходи идва от редовни спрямо промоционални цени.

Използвай САМО данните от файла. Пиши на български.`,
    prompt_en: `# Discount and Promo Savings Analysis

You are a consumer spending analyst. Review \`data.json\` and analyze:

1. Total savings from discounts and promotions.
2. Products most frequently bought with discounts.
3. Whether the user depends on promotions for specific products.
4. What share of total spend is regular vs. promotional pricing.

Use ONLY the data from the file.`
  },

  'retailer-comparison': {
    title_bg: 'Сравнение между търговци',
    title_en: 'Retailer comparison',
    prompt_bg: `# Сравнение на разходите между търговци

Сравни покупките в различните търговци (Lidl, Metro) от \`data.json\`. Анализирай:

1. Кои продукти се купуват и в двата търговеца и има ли ценова разлика.
2. Кой търговец предлага по-ниски цени за сравними продукти.
3. Разлики в дела на отстъпките и промоциите между търговците.

Сравнявай САМО продукти с достатъчно данни и в двата търговеца. Не измисляй несъществуващи разлики.`,
    prompt_en: `# Retailer Spending Comparison

Compare purchases across retailers (Lidl, Metro) from \`data.json\`. Analyze:

1. Products bought at both retailers and any price differences.
2. Which retailer offers lower prices for comparable products.
3. Differences in discount and promotion share between retailers.

Compare ONLY products with sufficient data at both retailers. Don't fabricate non-existent differences.`
  },

  'core-basket': {
    title_bg: 'Основна кошница',
    title_en: 'Core basket',
    prompt_bg: `# Анализ на основната пазарска кошница

От \`data.json\` идентифицирай продуктите, които потребителят купува най-често — неговата "основна кошница". Проследи как се е променила общата цена на тази кошница във времето. Кои продукти допринасят най-много за промяната?`,
    prompt_en: `# Core Basket Analysis

From \`data.json\`, identify the products the user buys most frequently — their "core basket." Track how the total cost of this basket has changed over time. Which products contribute most to the change?`
  }
};

function getPrompt(analysisType, lang) {
  const tpl = PROMPTS[analysisType];
  if (!tpl) return '';
  return lang === 'bg' ? tpl.prompt_bg : tpl.prompt_en;
}

function getAnalysisTitle(analysisType, lang) {
  const tpl = PROMPTS[analysisType];
  if (!tpl) return analysisType;
  return lang === 'bg' ? tpl.title_bg : tpl.title_en;
}

function getAnalysisTypes() {
  return Object.keys(PROMPTS).map(key => ({
    id: key,
    title_bg: PROMPTS[key].title_bg,
    title_en: PROMPTS[key].title_en
  }));
}

// ── Pack assembly ──

async function buildAiPack(runIds, analysisType, lang) {
  const allRuns = await loadRuns();
  const selectedRuns = allRuns.filter(r => runIds.includes(r.runId));
  const allReceipts = [];
  for (const run of selectedRuns) {
    for (const rc of (run.results || [])) {
      allReceipts.push(rc);
    }
  }

  const dataReceipts = selectedRuns
    .flatMap(r => (r.results || []))
    .filter(rc => rc.receipt?.date);

  // Derived summaries
  const derived = {
    top_products_by_frequency: buildTopProducts(dataReceipts),
    recurring_products: buildRecurringProducts(dataReceipts),
    spend_over_time: buildSpendOverTime(dataReceipts),
    discount_summary: buildDiscountSummary(dataReceipts),
    retailer_summary: buildRetailerSummary(dataReceipts)
  };

  const analysisLabel = getAnalysisTitle(analysisType, lang);

  const exportMeta = {
    generated_at: new Date().toISOString(),
    app: 'BasketIndex',
    version: '0.2.0',
    analysis_type: analysisType,
    analysis_label: analysisLabel,
    language: lang,
    selected_run_ids: runIds,
    selected_run_labels: selectedRuns.map(r => runLabelLocal(r)),
    selected_retailers: [...new Set(selectedRuns.map(r => r.retailer))],
    receipt_count: dataReceipts.length,
    item_count: dataReceipts.reduce((s, r) => s + (r.items || []).length, 0)
  };

  const norms = `Normalization notes:
- All receipts follow the BasketIndex v1.0 normalized schema.
- Prices may exist in EUR (unit_price_eur) and/or BGN (unit_price_bgn).
  EUR fields are available for most newer receipts; BGN fields for older ones.
  Use the currency field (receipt_currency) to determine the primary currency.
- Item-level discounts are present where attribution succeeded.
  Amounts are in the receipt's primary currency.
- Product names are cleaned (normalized case, whitespace collapsed, noise removed).
  Exact retailer product names may differ.
- Missing values should be treated as unavailable, not zero.
- Receipt totals and item line totals may not exactly match due to rounding.
- Heuristic summaries (derived_summary) are precomputed helpers — raw data is authoritative.`;

  const dataJson = JSON.stringify({ export_metadata: exportMeta, normalization_notes: norms, derived_summary: derived, receipts: dataReceipts }, null, 2);
  const promptBg = PROMPTS[analysisType]?.prompt_bg || '';
  const promptEn = PROMPTS[analysisType]?.prompt_en || '';
  const readme = `# BasketIndex AI Analysis Pack

## Files
- **data.json** — Your normalized shopping data with precomputed summaries.
- **prompt-bg.md** — Bulgarian analysis prompt.
- **prompt-en.md** — English analysis prompt.

## How to use
1. Upload \`data.json\` to your AI tool (ChatGPT, Claude, Gemini, etc.).
2. Copy and paste the prompt from \`prompt-bg.md\` or \`prompt-en.md\`.
3. Review the AI's response. Results depend on the model used.
4. Your data stays local — BasketIndex does not send it anywhere.

## Analysis
- Type: ${analysisLabel}
- Language: ${lang === 'bg' ? 'Bulgarian' : 'English'}
- Extracts: ${selectedRuns.length}
- Receipts: ${dataReceipts.length}
- Items: ${exportMeta.item_count}

## Privacy
This file contains your personal shopping history. It was generated locally
by BasketIndex in your browser. No data was sent to any server.`;

  const dateStr = new Date().toISOString().slice(0, 10);
  const zipName = `basketindex-ai-pack-${analysisType}-${dateStr}.zip`;

  const zipBlob = createZip([
    { name: 'data.json', content: dataJson },
    { name: 'prompt-bg.md', content: promptBg },
    { name: 'prompt-en.md', content: promptEn },
    { name: 'README.md', content: readme }
  ]);

  return { zipBlob, zipName };
}

export { buildAiPack, getAnalysisTypes, getAnalysisTitle, getPrompt };
