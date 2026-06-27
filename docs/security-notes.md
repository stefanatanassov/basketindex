# BasketIndex — Security Notes

## For users

### Credential safety

- BasketIndex **never asks for your retailer username or password**.
- You log in to your retailer's website directly in your browser, just as you normally would.
- The extension reads receipt pages through your existing authenticated browser session.
- At no point can the extension access your credentials — they are managed by the retailer's website and your browser's password manager.

### Data safety

- Receipt data is stored locally in your browser's `chrome.storage.local`.
- No data is uploaded to any server.
- No analytics or telemetry code exists in the extension.
- You control when and where to export receipt data.
- Uninstalling the extension removes all stored data.

### Permission safety

- All extension permissions are documented with justification in `manifest.json` and `docs/privacy-model.md`.
- The extension requests the narrowest permissions necessary.
- Host permissions are scoped to retailer receipt domains only.

### What to watch for

- Only install BasketIndex from the official Chrome Web Store listing or by loading the unpacked extension from the official GitHub repository.
- Review the permissions prompt when installing. It should only request `storage`, `downloads`, `tabs`, `scripting`, and retailer-specific host permissions.
- The extension should never request permissions like `cookies`, `webRequest`, `identity`, or broad `<all_urls>` host access.

## For contributors and developers

### Do not:

- **Ask users for credentials** in any form (UI prompts, console, storage, etc.).
- **Upload real receipts** to GitHub issues, pull requests, or discussions. Receipts contain personally identifiable information (store location, timestamps, payment card last 4 digits).
- **Add analytics, telemetry, or tracking** of any kind.
- **Add remote code execution** — no `eval()`, no dynamic script loading from external URLs, no `import()` from non-local sources.
- **Add hidden network requests** — every network request the extension makes should be a direct consequence of a user action (starting an export, navigating a tab to a retailer page).
- **Broaden permissions** without documented justification and a clear privacy impact assessment.

### Do:

- **Use anonymized HTML fixtures** for testing. Strip all personally identifiable data: store codes that identify specific locations, card numbers, timestamps that could identify a specific transaction, and any unique identifiers that could be traced to a real person.
- **Keep data local by default.** Any feature that involves network communication must be opt-in, clearly documented, and separately permissioned.
- **Handle errors privately.** Error messages in the UI should be helpful but should not expose raw DOM content, URLs with session tokens, or stack traces that reveal internal paths.
- **Review dependency additions carefully.** The project currently has zero dependencies. Any new dependency must be justified, reviewed, and pinned to a specific version.

### Reporting security issues

If you discover a security vulnerability in BasketIndex:

1. **Do not open a public issue.**
2. Email the maintainer directly (contact information in the repository's security policy).
3. Allow reasonable time for a fix before public disclosure.
4. The project follows coordinated vulnerability disclosure practices.

### Supply chain

- The extension has **zero runtime dependencies** (no npm packages, no CDN scripts, no external libraries).
- All code runs in the browser's isolated extension context.
- Content scripts are injected only into retailer pages matching specific URL patterns.
- The service worker communicates only with the extension's own popup and content scripts — not with external pages or servers.
