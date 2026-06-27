# Public Launch Assets Needed

This document lists what needs to be created before public promotion (GitHub public, Chrome Web Store, social sharing). Nothing below exists yet — these are placeholders describing what to make.

## Screenshots

At least 4 screenshots needed (1280x800 or similar):

| # | What to capture | Notes |
|---|-----------------|-------|
| 1 | Popup UI — idle state, config filled in | Shows the full extension popup |
| 2 | Popup UI — running job, progress visible | Shows stats grid, progress bar, phase label |
| 3 | Export result — JSON file opened in editor | Shows structured normalized receipt data |
| 4 | CSV export — opened in spreadsheet | Shows flat table with receipt + item columns |

## Demo video / GIF

30–60 seconds showing the full flow:

1. Open Lidl purchase-history page (already logged in)
2. Open BasketIndex popup
3. Click Detect → URL auto-fills
4. Set page range 1–2, click Start
5. Watch receipts complete
6. Click Export JSON
7. Show the downloaded JSON file opened

Tools: LICEcap (GIF), OBS (video), or Chrome's built-in screen recorder.

## Chrome Web Store listing

Required metadata for publishing on the Chrome Web Store:

### Store listing fields

| Field | Content |
|-------|---------|
| **Name** | BasketIndex |
| **Short description** (132 chars) | Export your digital shopping receipts as structured JSON and CSV. Local-first. No server. No accounts. Open-source. |
| **Description** | Adapt from README — value proposition, features, supported retailers, privacy guarantees, disclaimer |
| **Category** | Productivity |
| **Language** | English (add Bulgarian, German later) |
| **Screenshots** | 4 from above |
| **Promotional tile** | Small (440x280), Large (920x680), Marquee (1400x560) |
| **Privacy policy URL** | Link to `docs/privacy-model.md` on GitHub (or a hosted page) |
| **Website / Support** | GitHub repository URL |
| **Developer email** | TBD — must be a real, monitored address |

### Checklist before publishing

- [ ] Extension loads and exports correctly
- [ ] All permissions justified in description
- [ ] Privacy policy URL resolves
- [ ] Screenshots are current and accurate
- [ ] No debug logging in production code
- [ ] No placeholder security contact (or clearly marked)
- [ ] Manifest version bumped from 0.1.0
- [ ] Developer email monitored

## Landing page

A simple landing page (GitHub Pages or similar) with:

- Project name and tagline
- What it does (3 bullet points)
- Screenshot or GIF
- Install instructions
- Link to GitHub repository
- Privacy / security links
- Disclaimer

## Social / community

- GitHub Discussions enabled for Q&A
- "Good first issue" labels on beginner-friendly issues
- A pinned issue explaining how to add a retailer adapter

## FAQ

Common questions to pre-answer:

1. **Why does this need my Lidl login?** — It doesn't. You log in to Lidl in your browser normally. The extension reads the pages you're already viewing.
2. **Where is my data stored?** — Only in your browser's local storage. Uninstalling the extension deletes it.
3. **Can I use this for multiple Lidl accounts?** — Yes, in separate Chrome profiles.
4. **Will this work with Kaufland/Billa/etc.?** — Not yet. See the [adapter contribution guide](docs/adapter-interface.md) to help add one.
5. **Is this legal?** — Reading data from pages you're authorized to view in your own browser is generally permissible. The extension does not circumvent any access controls. If a retailer explicitly prohibits automated reading in their terms, users should review those terms.
