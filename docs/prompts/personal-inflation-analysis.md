# Personal Inflation Analysis Prompt

Copy this prompt into ChatGPT, Claude, or any AI analysis tool alongside your exported BasketIndex receipt data (JSON or CSV) to get a personal inflation analysis.

## How to use

1. Export your receipts from BasketIndex (JSON or CSV).
2. Copy the prompt below into an AI tool of your choice.
3. Paste or attach your receipt data alongside the prompt.
4. Review the analysis — AI can make mistakes. Treat it as exploratory, not financial advice.

---

## The prompt

```
I have exported my personal grocery shopping receipts from Lidl over a period
of time. The data is structured: each receipt has a date, store info,
currency details, and a list of items with product IDs, names, quantities,
unit prices, and line totals (in both EUR and BGN where applicable).

Please analyze this data for personal inflation insights. Specifically:

1. TIME RANGE
   - Identify the earliest and latest receipt dates.
   - Count how many receipts and how many distinct shopping trips.
   - Note any large gaps in the date range.

2. REPEAT PURCHASES
   - Find products that appear in at least 3 different receipts.
   - For each repeat product:
     - Show the date and unit price for each occurrence.
     - Calculate the percentage change between the first and last purchase.
     - Flag any unusual spikes or drops (more than 20% change between
       consecutive purchases).

3. PRICE CHANGE OBSERVATIONS
   - For repeat products, estimate the personal inflation rate:
     (last_price - first_price) / first_price × 100, annualized if the
     period is longer than a few months.
   - Group results by product category if you can infer categories from
     product names (dairy, produce, meat, beverages, packaged goods, etc.).
   - Compare against the general consumer inflation rate for context if
     you have that knowledge.

4. BASKET ANALYSIS
   - Pick a subset of 5-10 commonly purchased products that appear across
     the full time range.
   - Calculate the total cost of this "basket" on the earliest receipt.
   - Calculate the total cost of the same basket on the latest receipt.
   - Report the basket inflation rate.

5. SPENDING PATTERNS
   - Total spending per month (or per receipt if the dataset is small).
   - Average items per receipt.
   - Most expensive single receipt.
   - Any seasonal patterns you notice.

6. UNCERTAINTIES AND LIMITATIONS
   - Be explicit about what this analysis CANNOT tell me:
     - Same product may change package size or formulation.
     - Promotional prices look like price drops but are temporary.
     - A small sample of receipts is not statistically significant.
     - Products bought infrequently are not reliable for trend analysis.
     - Store location changes can affect pricing.
   - Flag any conclusions that are speculative vs. well-supported.

7. ACTIONABLE TAKEAWAYS
   - Based on the data, what 3-5 observations are most useful for my
     personal budgeting or shopping decisions?
   - Are there products where the price trend suggests I should consider
     alternatives or buy in bulk when on promotion?

IMPORTANT: This is my personal shopping data. Do not draw conclusions
about broader economic conditions. Focus on what I personally experienced.
If you are unsure about any calculation, say so rather than guessing.
```

---

## Notes

- **BasketIndex does not include built-in AI analysis.** This prompt is a template for you to use with the AI tool of your choice.
- Prices in the export are denominated in both EUR and BGN (for Bulgarian Lidl receipts post-2026 euro adoption). The `_primary` fields are in the receipt's native currency; the `_secondary` fields are the converted equivalent.
- For pre-2026 Bulgarian receipts, all prices are in BGN only, with `_secondary` fields set to `null`.
- **This is not financial advice.** AI-generated analysis is experimental and may contain errors. Verify important conclusions against your own receipt PDFs.
