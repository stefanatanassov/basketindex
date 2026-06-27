# BasketIndex — Vision

## Why this project exists

Every person who shops generates a personal economic dataset: what they buy, how much they pay, where they shop, and what they pay with. This data belongs to the shopper, but today it is locked inside retailer portals, paper receipts, and bank statements — none of which are designed for personal financial analysis.

BasketIndex exists to give that data back to the shopper in a structured, analyzable, private form.

## What we believe

### User-owned shopping data

Your purchase history is yours. You should be able to export it, analyze it, and use it for your own purposes without asking permission from a retailer.

### Inflation awareness

When prices rise, the first evidence appears in individual receipts before it shows up in national statistics. A personal receipt archive is the most honest inflation index a person can own.

### Personal budgeting

Structured receipt data enables real spending awareness: how much did I spend on dairy last month? What is my actual grocery inflation rate? Am I paying more for the same basket of goods?

### Local-first trust model

BasketIndex runs entirely in your browser. No server processes your receipts. No cloud stores your data. No analytics track your usage. You control your own export files. If you want to share or analyze elsewhere, that is your choice — not a default.

### Open-source contribution model

Retailers change their websites. New retailers appear. No single developer can maintain adapters for every store in every country. The only sustainable model is an open-source hub where contributors can add and maintain retailer adapters independently, while benefiting from a shared, stable extraction engine.

## Why Lidl is only the first integration

The current prototype works with Lidl because:

- Lidl's digital receipt pages have clean, structured DOM with `data-*` attributes.
- Lidl operates in 22 European countries with similar page structure.
- Lidl's digital receipts are accessible through a standard browser login — no CAPTCHA, no app-only access, no API key required.
- The developer had access to Lidl receipts for testing.

Lidl is the proof of concept, not the product identity. The architecture is being designed so that adding a new retailer requires writing one new adapter directory — not rewriting the core engine.

## What BasketIndex is not

- Not a replacement for your bank's transaction history.
- Not a price comparison engine across retailers.
- Not a budgeting app (though it can feed data into one).
- Not affiliated with Lidl or any retailer.
- Not a service that uploads or stores your data.
- Not a commercial SaaS product (open-source, community-driven).

## Long-term goal

A local-first browser extension that any shopper can use to export structured receipt data from any retailer that provides digital receipts in a browser. An open hub of community-maintained retailer adapters. A personal inflation index that each user owns.
