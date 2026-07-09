# BasketIndex — Privacy Policy

*Last updated: July 8, 2026*

## Summary

BasketIndex is a **local-first Chrome extension** for personal receipt extraction and analysis. Your receipt data never leaves your browser unless you explicitly choose to export it. There is no BasketIndex server, no cloud storage, no analytics, and no third-party data sharing.

---

## How BasketIndex Works

1. You open the extension popup and select a supported retailer (Lidl or Metro).
2. You configure the extraction and click **Start**.
3. BasketIndex accesses the retailer's purchase history pages using your existing authenticated browser session. You authenticate directly with the retailer — BasketIndex never asks for or sees your password.
4. Receipt data is extracted and normalized locally in your browser.
5. Extracted data is stored in `chrome.storage.local` on your device.
6. You can review extraction history, explore price trends, prepare AI analysis packs, or export your data as CSV, JSON, or shareable graphics.
7. All processing is local. No BasketIndex cloud exists for receipt storage.

---

## What We Do

- Read retailer receipt pages in your browser using your existing authenticated session.
- Extract structured data (products, prices, dates, discounts, merchants) from those pages.
- Store extracted receipts in your browser's local storage (`chrome.storage.local`).
- Allow you to export receipts as JSON or CSV files to your local disk.
- Generate local AI analysis packs containing your data and prompt templates — for use with AI tools of your choice.

---

## What We Do NOT Do

- **Do not collect your retailer username or password.** You log in to the retailer's website normally. The extension operates inside your existing session.
- **Do not upload your receipt data to any server.** There is no BasketIndex server.
- **Do not include analytics, telemetry, or tracking.** The extension makes no network requests except to retailer pages and APIs (the same services you would access manually).
- **Do not share your data with third parties.** No advertisers, no data brokers, no partners.
- **Do not store data in the cloud.** Your receipts live in your browser's local storage. Uninstalling the extension deletes the data.
- **Do not use cookies or persistent identifiers.** The extension does not set cookies, does not fingerprint your browser, and does not track your behavior across sites.
- **Do not use your data for AI model training.** No BasketIndex AI models exist. The AI Analysis Export Pack creates a local ZIP file for you to upload to an AI tool of your choice — BasketIndex does not process the data through any AI system.
- **Do not execute remote code.** All JavaScript is bundled in the extension. No eval(), no remote script loading, no CDN dependencies.

---

## Data We Process

When you use BasketIndex, the following information may be extracted from your retailer purchase history:

- Purchase history (receipts)
- Receipt dates and times
- Merchant / retailer names (Lidl, Metro)
- Store codes and locations
- Product names and retailer product IDs
- Quantities, units, and prices
- Receipt totals and currency information
- Discounts and promotions applied to items

**All processing occurs locally in your browser.** This data is required solely for the extension's functionality (extraction, history, trends analysis, export). BasketIndex does not collect unrelated browsing information.

---

## Authentication

- You authenticate directly with Lidl or Metro through their own login pages.
- BasketIndex never asks for, stores, or sees your password.
- The extension uses your browser's existing authenticated session to access your purchase history.
- For Metro, the extension reads a session token already present in your browser's `localStorage` on `docs.metro.bg` to access your invoices via the Metro API.
- Authentication tokens remain part of your retailer session. They are used exclusively to retrieve your own purchase history and are never stored, logged, or transmitted elsewhere by BasketIndex.

---

## Local Storage

The following information is stored locally in `chrome.storage.local` on your device:

- Extraction run history (runs you have completed)
- Normalized receipt data for each extraction
- Job configuration and progress state
- Popup configuration preferences
- Language preference

All stored data remains on your device. You can clear it by uninstalling the extension or by using the "Изчисти всички" (Clear All) option in the History page.

---

## Data Sharing

BasketIndex **does not**:

- Sell user data to any party
- Share user data with advertisers or data brokers
- Transfer receipt data to any server
- Use user data for marketing purposes
- Use user data for profiling or behavioral analysis
- Use user data for AI model training

The only way your data leaves your device is through **explicit user-initiated export** (CSV, JSON, analysis chart PNG, social share card PNG, or AI analysis ZIP pack). You control where those files are saved.

---

## Network Communication

BasketIndex makes network requests only to:

- **Lidl domains** (`*.lidl.bg`, `*.lidl.com`, `*.lidl.de`, and other European Lidl TLDs) — to access purchase history and receipt detail pages, and to call Lidl's receipt API endpoints
- **Metro domains** (`docs.metro.bg`, `mriapi.einvoice.metro.cloud`) — to authenticate via browser session and retrieve invoice/article data through Metro's API

**All requests are for the sole purpose of retrieving your receipt information.** BasketIndex does not download executable code, does not execute remote scripts, and does not make requests to any analytics, advertising, or tracking services.

---

## Permissions Explained

| Permission | Why We Need It | What We Do NOT Do |
|-----------|---------------|--------------------|
| `storage` | Save extraction progress and receipt data locally | Do not sync to cloud; Chrome manages this locally |
| `unlimitedStorage` | Allow storage of extensive receipt history beyond the default 10 MB quota | No impact on privacy — data remains local |
| `downloads` | Trigger file downloads when you click Export (CSV, JSON, AI pack ZIP) | Do not download anything automatically |
| `tabs` | Open and manage browser tabs for retailer receipt pages; navigate to extension pages | Do not read your other tabs or browsing history |
| Host permissions | Read retailer receipt pages and call retailer APIs on domains you visit | Do not access unrelated parts of retailer websites; content scripts are scoped to specific page paths |

---

## Your Control

You have full control over your data:

- **Start extraction** only when you choose.
- **Delete individual extraction runs** from the History page.
- **Clear all extraction history** with one action.
- **Export data** as CSV, JSON, charts, or AI packs — saved where you choose.
- **Uninstall the extension** — all stored data is deleted immediately.

---

## EU / GDPR Considerations

The extension operates entirely on the user's device and does not transmit personal data to any external party. Under GDPR:

- **No data controller relationship**: BasketIndex does not collect or process personal data on behalf of a controller.
- **User as data subject**: You control your own data at all times.
- **No cross-border transfer**: Data stays on your device.
- **Right to deletion**: Uninstalling the extension deletes all stored data. You can also clear individual runs at any time.

---

## Independent Project

BasketIndex is an independent open-source project (MIT license). It is **not affiliated with, endorsed by, or connected to Lidl, Metro, Kaufland, Google, or any retailer or browser vendor**. Retailer names are used for compatibility description only.

---

## Contact

- **GitHub**: https://github.com/stefanatanassov/basketindex
- **Website**: https://basketindex.stefanatanasov.dev/
- **Security issues**: https://github.com/stefanatanassov/basketindex/blob/main/SECURITY.md
