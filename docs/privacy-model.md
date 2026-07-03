# BasketIndex — Privacy Model

## Summary

BasketIndex is designed to be **local-first and privacy-preserving by default**. Your receipt data never leaves your browser unless you explicitly choose to export it.

## What we do

- Read receipt pages in your browser using your existing authenticated session.
- Extract structured data from those pages.
- Store extracted receipts in your browser's local storage (`chrome.storage.local`).
- Allow you to export receipts as JSON or CSV files to your local disk.

## What we do NOT do

- **Do not collect your Lidl (or any retailer) username or password.** You log in to the retailer's website normally in your browser. The extension operates inside your existing session — it never sees your credentials.
- **Do not upload your receipt data to any server.** There is no BasketIndex server. All processing happens in your browser.
- **Do not include analytics, telemetry, or tracking.** The extension makes no network requests except for navigating browser tabs to retailer pages (the same pages you would visit manually).
- **Do not share your data with third parties.** There is no third party. The code is open-source; you can inspect exactly what it does.
- **Do not store data in the cloud.** Your receipts live in your browser's local storage. If you uninstall the extension, the data is deleted.
- **Do not use cookies or persistent identifiers.** The extension does not set cookies, does not fingerprint your browser, and does not track your behavior across sites.

## How data flows

```
Your browser tab (retailer page)
        │
        ▼
Content script reads DOM (local, in-browser)
        │
        ▼
Service worker receives structured data (local, in-browser)
        │
        ▼
chrome.storage.local (local, on-disk in your browser profile)
        │
        ▼
chrome.downloads API (you choose where to save the file)
```

At no point does data leave your machine through any BasketIndex-controlled channel.

## What you control

- **When to start an export.** The extension only extracts receipts when you explicitly click "Start".
- **What page range to export.** You choose which pages of your purchase history to scan.
- **When to export files.** You click "Export JSON" or "Snapshot" to save data to disk.
- **Where files are saved.** The Chrome downloads API prompts you to choose a save location (or uses your default downloads folder).
- **Whether to keep or delete data.** Uninstalling the extension removes all stored receipt data. You can also click "Reset" to clear the current job.

## Permissions explained

| Permission | Why we need it | What we do NOT do with it |
|-----------|---------------|--------------------------|
| `storage` | Save job progress and extracted receipts locally | Do not sync to cloud; Chrome manages this locally |
| `downloads` | Trigger JSON/CSV file downloads when you click Export | Do not download anything automatically |
| `tabs` | Open and manage browser tabs for receipt pages | Do not read your other tabs or browsing history |
| Host permissions | Read retailer receipt pages when you navigate to them | Do not access any other part of the retailer's website |

## EU / GDPR considerations

The extension operates entirely on the user's device and does not transmit personal data to any external party. Under GDPR:

- **No data controller relationship**: BasketIndex does not collect or process personal data on behalf of a controller.
- **User as data subject**: The user controls their own data at all times.
- **No cross-border transfer**: Data stays on the user's device.
- **Right to deletion**: Uninstalling the extension deletes all stored data.

## Future considerations

If BasketIndex ever adds optional features that involve network communication (e.g., cloud backup, aggregate price sharing), those features will be:

1. **Opt-in only** — disabled by default.
2. **Clearly documented** — what data is transmitted, to where, and why.
3. **Separately permissioned** — new features will request new permissions with clear explanations.

## Independent project

BasketIndex is an independent open-source project. It is **not affiliated with, endorsed by, or connected to Lidl, Kaufland, or any retailer**. The use of retailer names is for compatibility description only.
