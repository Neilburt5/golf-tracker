# Technical Decisions

Format: **Decision**, **Reason**, and alternatives where relevant.

---

## D1 — Build a PWA instead of a native iOS app

**Decision:** The app is a Progressive Web App installed on the iPhone from Safari.

**Reason:** The developer has no Mac and does not want to pay for an Apple Developer account. .NET MAUI (iOS) and SwiftUI both require a Mac with Xcode to build and sign. A PWA can be developed on Windows/Linux, hosted for free, works offline, and installs to the home screen.

**Trade-offs:** No haptic feedback, no background execution, and iOS may evict storage of rarely used web apps. Mitigated by installing to the home screen, requesting persistent storage, and providing a JSON backup.

**Future option:** Wrap with Capacitor if a Mac and developer account become available.

---

## D2 — TypeScript + React + Vite instead of Blazor WebAssembly

**Decision:** Use TypeScript, React, and Vite.

**Reason:** IndexedDB, file sharing, and the service worker live in the browser, so some JavaScript would be needed even with Blazor. TypeScript has mature libraries for IndexedDB (Dexie) and Excel (SheetJS), a lighter first load, simpler PWA update handling, and far more documentation for mobile PWAs. The V0.1 scope is small, so the cost of learning TypeScript coming from C# is low.

**Alternative considered:** Blazor WebAssembly (C#), which would reuse existing C# experience but has a heavier initial download and less PWA/IndexedDB documentation.

---

## D3 — Dexie (IndexedDB) instead of SQLite

**Decision:** Persist locally with Dexie on IndexedDB, keeping a relational structure (Round → Hole).

**Reason:** IndexedDB is native to browsers and works offline without extra runtimes. In-browser SQLite (WASM) adds complexity and weight not justified for V0.1. The relational modelling principle from the original prompt is preserved: no whole-round JSON blobs.

---

## D4 — Courses live in a bundled `courses.json`

**Decision:** Courses are maintained by the user in `src/data/courses.json` and bundled with the app. There is no course table and no course editor in V0.1.

**Reason:** Entering pars on a phone is slow and error-prone; editing a JSON in VS Code is easy. Bundling (rather than fetching from `public/`) guarantees availability offline. Rounds store a snapshot of the course name and pars, so the JSON can change freely.

---

## D5 — Totals are derived, never stored

**Decision:** Round totals and statistics are computed from hole data on demand.

**Reason:** Editing a previous hole can never leave stale totals. Calculation logic lives in `domain/` and is reused by the summary, export, history, and analytics.

---

## D6 — Snapshot par and course name in rounds and holes

**Decision:** `Hole.par` and `Round.courseName` are copied at round creation.

**Reason:** Historical rounds must not change if a course definition is corrected later.

---

## D7 — Hole data recorded in V0.1

**Decision:** Score, putts, fairway, penalty strokes, bunker, up & down, and GIR. 3-putt is derived from putts (`putts >= 3`). GIR is auto-suggested as `score - putts <= par - 2` and can be corrected with one tap.

**Reason:** Matches the original specification while minimizing taps during play. Fairway is `null` for par 3; up & down is `null` when there was no opportunity.

---

## D8 — Support 9-hole rounds on 18-hole courses, first or last nine

**Decision:** A round has `numberOfHoles` (9 or 18) and `startHole` (1 or 10).

**Reason:** The user sometimes plays the front nine and sometimes the back nine. Hole numbers are stored as real course hole numbers (1–9 or 10–18) so analysis by hole stays correct.

---

## D9 — HashRouter

**Decision:** Use React Router with `HashRouter`.

**Reason:** GitHub Pages cannot serve deep links for single-page apps.

---

## D10 — Excel export format: one row = one hole

**Decision:** Two sheets (`ROUND`, `HOLES`), no merged cells or decoration, booleans as 1/0, "not applicable" as empty cells, delivered through the iOS share sheet with a download fallback.

**Reason:** Analysis-friendly data for Excel, Power BI, and pandas. The dataset is treated as a long-term asset.

---

## D11 — Project organized in phases, one conversation per phase

**Decision:** Work is split into phases 0–8, each with a verifiable deliverable, tracked in `docs/STATUS.md`. GitHub is the source of truth, not the chat history.

**Reason:** Keeps conversations focused, avoids very long threads, and ensures nothing is lost if a conversation ends.

---

## D12 — Offline behaviour is verified only on the HTTPS deployment

**Decision:** Offline testing is done against the published GitHub Pages site.

**Reason:** Service workers require HTTPS. The local dev server over a LAN IP cannot be used to validate offline behaviour on iOS. This is why deployment to the iPhone is phase 1.

---

## Open items

- SheetJS: verify the currently recommended installation method (the npm registry package has been outdated). Fallback: ExcelJS.
