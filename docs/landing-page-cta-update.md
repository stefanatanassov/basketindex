# Landing Page — Install CTA Update

This documents the changes needed on `https://basketindex.stefanatanasov.dev` to add the direct ZIP download path.

## Change 1 — Hero section (add Download ZIP button)

**Find** the CTA line with two items:
```html
<a href="https://github.com/stefanatanassov/basketindex">View on GitHub</a>
Chrome Web Store — Pending review
```

**Replace** with 3 items (ZIP first, then GitHub, then CWS status):
```html
<a href="https://github.com/stefanatanassov/basketindex/releases/download/v0.1.0/basketindex-extension.zip">Download ZIP</a>
<a href="https://github.com/stefanatanassov/basketindex">View on GitHub</a>
Chrome Web Store — Pending review
```

## Change 2 — FAQ "How do I install before store approval?"

**Find:**
```html
<p>Clone the GitHub repository, open Chrome's extension management page (<code>chrome://extensions</code>), enable Developer Mode, and load the unpacked extension from the repo directory.</p>
```

**Replace** with:
```html
<p>Download the <a href="https://github.com/stefanatanassov/basketindex/releases/download/v0.1.0/basketindex-extension.zip">basketindex-extension.zip</a> from the GitHub releases page. Unzip it, open <code>chrome://extensions</code>, enable Developer Mode, click <strong>Load unpacked</strong>, and select the unzipped folder.</p>
```

## Change 3 — "How it works" step 1 "Install"

**Find:**
```html
<p>Add the extension to Chrome. One click when the store listing is live.</p>
```

**Replace** with:
```html
<p>Download the ZIP from GitHub releases, unzip, and load as an unpacked extension in Chrome.</p>
```

## Direct ZIP URL

```
https://github.com/stefanatanassov/basketindex/releases/download/v0.1.0/basketindex-extension.zip
```

Size: 41 KB. Contains 41 runtime files (no docs, no fixtures). Ready to unzip and Load unpacked.
