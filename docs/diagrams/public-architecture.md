# BasketIndex — Public Architecture Diagram

## Architecture Assessment (short)

BasketIndex is a Chrome MV3 browser extension with three runtime layers:

1. **Popup UI** — user configures page range and starts the export.
2. **Service Worker** — orchestrates the job: opens browser tabs on the user's already-authenticated retailer pages, dispatches content scripts, manages a receipt queue with retry/recovery, and persists state to `chrome.storage.local`.
3. **Adapter layer** (`adapters/lidl/`) — content scripts that read the retailer's receipt page DOM and extract structured data. Lidl is the first adapter; the architecture supports adding more retailers by creating new adapter directories without changing the core engine.

The privacy-first design comes from what is **absent**: no server, no credential collection, no analytics, no cloud storage. All data stays in the user's browser. Export is user-initiated via the Chrome downloads API.

### Data flow (simplified)

```
User's browser (already logged in to retailer)
    │
    ▼
Purchase-history pages → listing extractor → receipt URLs
    │
    ▼
Receipt detail pages   → detail extractor   → structured receipt data
    │
    ▼
chrome.storage.local   → job state, receipt queue, completed data
    │
    ▼
Downloads API          → JSON / CSV files on user's disk
    │
    ▼
User's own tools       → spreadsheet, Python, ChatGPT, Claude (optional)
```

---

## Diagram: PlantUML source

Copy this into any PlantUML renderer (plantuml.com, VS Code plugin, etc.)

```plantuml
@startuml
!theme plain
skinparam backgroundColor #FAFAFA
skinparam defaultFontSize 12
skinparam shadowing false
skinparam ArrowColor #4a90d9

title BasketIndex — How your receipts become your data

actor User

rectangle "Your browser\n(already logged in to Lidl)" as Browser #E8F0FE {
  rectangle "BasketIndex\nExtension" as Extension #FFFFFF {
    component "Popup UI\n(config & controls)" as Popup
    component "Service Worker\n(orchestrator)" as SW
    component "Lidl Adapter\n(content scripts)" as Adapter
  }
  database "Local Storage\n(chrome.storage.local)" as Storage #F0F0F0
}

cloud "Lidl Purchase\nHistory & Receipt\nPages" as Lidl #FFF3CD

rectangle "Your Computer" as Computer #F8F9FA {
  file "JSON Export" as JSON #D4EDDA
  file "CSV Export" as CSV #D4EDDA
}

rectangle "Your Analysis Tools\n(optional, your choice)" as Analysis #E2E3E5 {
  component "Spreadsheet" as Sheet
  component "AI Chat\n(ChatGPT, Claude)" as AI
  component "Python / R\nScripts" as Python
}

User --> Popup : "Start export\n(choose page range)"
Popup --> SW : "config + listing URL"
SW --> Lidl : "navigates tabs\n(uses your existing\nlogin session)"
Lidl --> Adapter : "reads receipt\npage DOM"
Adapter --> SW : "structured\nreceipt data"
SW --> Storage : "saves progress\nsurvives restarts"
Storage --> JSON : "Export JSON"
Storage --> CSV : "Export CSV"
JSON --> Sheet : "import"
CSV --> Python : "import"
JSON --> AI : "paste + prompt"

note right of Lidl
  **No separate login needed**
  You're already signed in
  to Lidl in your browser
end note

note bottom of Storage
  **No server. No cloud.**
  Everything stays in
  your browser.
end note

note bottom of Analysis
  **Not built into BasketIndex.**
  You choose your own tools.
  BasketIndex just gives you
  clean, structured data.
end note

@enduml
```

### Diagram title

**"BasketIndex — How your receipts become your data"**

### Explanatory copy for a public post

> BasketIndex runs entirely in your browser. It reads your Lidl purchase history pages using your existing login session — no separate accounts, no password sharing. The extension extracts your receipts into structured JSON and CSV, storing everything locally. When you click Export, the files save to your computer. From there, you can analyze them with any tool you choose — a spreadsheet, a Python script, or an AI chat tool like ChatGPT or Claude.
>
> No server. No analytics. Your data, your tools.

### Lighter version recommendation

For a social post where vertical space is tight (e.g., Twitter/X, LinkedIn), use this simplified 4-box version:

```plantuml
@startuml
!theme plain
skinparam backgroundColor #FAFAFA
skinparam shadowing false

title BasketIndex — Local-first receipt export

actor User
rectangle "Your Browser" as Browser #E8F0FE {
  rectangle "BasketIndex\nExtension" as Ext
  database "Local\nStorage" as Db
}
cloud "Lidl Receipt\nPages" as Lidl
file "JSON / CSV\nExport" as Export
rectangle "Your Tools\n(spreadsheet, AI, etc.)" as Tools #E2E3E5

User --> Ext : Start
Ext --> Lidl : reads pages
Lidl --> Ext : receipt data
Ext --> Db : saves locally
Db --> Export : you click Export
Export --> Tools : you analyze

note bottom of Browser : No server. No cloud. No analytics.
@enduml
```

The lighter version fits in a single tweet or as a GitHub social preview image while still communicating the core privacy message.
