# BasketIndex — Public Architecture Diagram

## Architecture

BasketIndex is a Chrome MV3 browser extension with four runtime layers:

1. **Popup UI** — user selects retailer, configures extraction, and starts jobs.
2. **Service Worker** — orchestrates extraction: manages browser tabs, dispatches adapters, handles retry/recovery, and persists state to `chrome.storage.local`.
3. **Adapter layer** (`adapters/lidl/`, `adapters/metro/`) — retailer-specific extraction logic. Lidl uses DOM scraping on receipt pages; Metro uses API calls (token-based). Both produce BasketIndex's normalized receipt schema.
4. **Analysis UI** — History page (run archive, follow-up extraction, export), Trends page (price trend charts, tooltips, evidence table, social card export).

The privacy-first design comes from what is **absent**: no server, no credential collection, no analytics, no cloud storage. All data stays in the user's browser. Export is user-initiated via the Chrome downloads API.

### Data flow

```
User's browser (already logged in to retailer)
    │
    ▼
Popup UI              → config + start extraction
    │
    ▼
Service Worker        → orchestrates discovery + extraction
    │
    ├── Lidl adapter  → DOM scraping on purchase pages
    └── Metro adapter → token-based API extraction
    │
    ▼
chrome.storage.local  → run history, normalized receipts
    │
    ├── History page  → export CSV / JSON / follow-up runs
    └── Trends page   → price trends, evidence table, social card
    │
    ▼
User's own tools      → spreadsheet, Python, AI chat (optional)
```

---

## Diagram: PlantUML source

```plantuml
@startuml
!theme plain
skinparam backgroundColor #FAFAFA
skinparam defaultFontSize 12
skinparam shadowing false
skinparam ArrowColor #4a90d9

title BasketIndex — How your receipts become your data

actor User

rectangle "Your Browser" as Browser #E8F0FE {
  rectangle "BasketIndex Extension" as Extension #FFFFFF {
    component "Popup UI\n(config & start)" as Popup
    component "Service Worker\n(orchestrator)" as SW
    component "Lidl Adapter\n(DOM scraping)" as LidlA
    component "Metro Adapter\n(token API)" as MetroA
    component "History Page\n(run archive)" as History
    component "Trends Page\n(price analysis)" as Trends
  }
  database "Local Storage\n(chrome.storage.local)" as Storage #F0F0F0
}

cloud "Retailer Sites\n(Lidl, Metro)" as Retailer #FFF3CD

rectangle "Your Computer" as Computer #F8F9FA {
  file "JSON / CSV\nExport" as Export #D4EDDA
  file "Trends PNG\n& Social Card" as Img #D4EDDA
}

rectangle "Your Analysis Tools\n(optional)" as Analysis #E2E3E5 {
  component "Spreadsheet" as Sheet
  component "AI Chat" as AI
  component "Python / R" as Python
}

User --> Popup : "Choose retailer\nStart extraction"
Popup --> SW : "config + listing URL"
SW --> Retailer : "navigates tabs\n(uses your existing\nlogin session)"
Retailer --> LidlA : "reads receipt\npage DOM"
Retailer --> MetroA : "fetches invoices\nvia API"
LidlA --> SW : "structured receipt data"
MetroA --> SW : "structured receipt data"
SW --> Storage : "persists run history\nsurvives restarts"
Storage --> History : "export CSV/JSON\nfollow-up runs"
Storage --> Trends : "price trends\nmulti-series charts"
History --> Export : "download"
Trends --> Img : "export"

Export --> Sheet : "import"
Export --> Python : "import"
Export --> AI : "paste + prompt"

note right of Retailer
  **No separate login needed**
  You're already signed in
  to the retailer in your
  browser
end note

note bottom of Storage
  **No server. No cloud.**
  Everything stays in
  your browser.
end note

note bottom of Analysis
  **Not built into BasketIndex.**
  You choose your tools.
  BasketIndex gives you
  clean, structured data.
end note

@enduml
```

### Diagram title

**"BasketIndex — How your receipts become your data"**

### Explanatory copy

> BasketIndex runs entirely in your browser. It reads your purchase history from Lidl and Metro using your existing login — no separate accounts, no password sharing. The extension extracts your receipts into structured JSON and CSV, storing everything locally. History keeps your runs organized with follow-up extraction support. Trends visualizes price changes over time, and you can export analysis graphics or social share cards. From there, you can analyze your data with any tool you choose — a spreadsheet, Python, or an AI assistant.
>
> No server. No analytics. Your data, your tools.

### Simplified version

```plantuml
@startuml
!theme plain
skinparam backgroundColor #FAFAFA
skinparam shadowing false

title BasketIndex — Local-first receipt export

actor User
rectangle "Your Browser" as Browser #E8F0FE {
  rectangle "BasketIndex Extension" as Ext
  database "Local Storage" as Db
}
cloud "Lidl & Metro\nReceipt Pages" as Retailer
file "JSON / CSV\nExport" as Export
file "Trends PNG\nSocial Card" as Img
rectangle "Your Tools\n(spreadsheet, AI, etc.)" as Tools #E2E3E5

User --> Ext : Start
Ext --> Retailer : reads pages (DOM + API)
Retailer --> Ext : receipt data
Ext --> Db : saves locally
Db --> Export : export CSV/JSON
Db --> Img : export trends
Export --> Tools : you analyze

note bottom of Browser : No server. No cloud. No analytics.
@enduml
```
