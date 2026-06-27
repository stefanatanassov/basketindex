# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in BasketIndex, please **do not open a public issue**.

Instead, email the maintainer at:

**basketindex-security@proton.me** *(placeholder — replace with real contact before public launch)*

We follow coordinated vulnerability disclosure. You can expect:

- Acknowledgment within 72 hours
- A fix timeline within 10 business days
- Credit in the release notes (with your permission)

## Scope

BasketIndex is a client-side Chrome extension. The attack surface is limited to the browser's extension sandbox.

### In scope

- Bugs that expose user receipt data to unauthorized parties
- Permission escalation vulnerabilities
- Cross-origin data leakage through content scripts
- Storage-related data integrity issues
- Any code path that transmits data off-device without user consent

### Out of scope

- Issues in retailer websites (Lidl, etc.) that the extension reads from
- Phishing attacks that trick users into installing a modified extension
- Browser-level vulnerabilities not specific to this extension
- Attacks requiring physical access to the user's machine

## Security design

BasketIndex is designed with a minimal security footprint:

- **No server**: All processing in the browser. No data transmission.
- **No credentials**: The extension never asks for or stores retailer usernames or passwords.
- **No analytics**: No telemetry, no tracking, no external network requests beyond retailer page navigation.
- **No remote code**: All code ships in the extension package. No dynamic script loading.
- **Content scripts are scoped**: Injected only on retailer receipt pages matching specific URL patterns.

Full security notes: [`docs/security-notes.md`](docs/security-notes.md)

## Supported versions

Only the latest version of the extension is supported. The extension has no long-term-support branches.

## Dependencies

BasketIndex currently has **zero runtime dependencies** (no npm packages, no CDN scripts, no external libraries). This minimizes supply-chain attack surface.

If a dependency is added in the future, it must be:
- Reviewed and pinned to a specific version
- Justified in the pull request
- From a well-known, actively maintained source
