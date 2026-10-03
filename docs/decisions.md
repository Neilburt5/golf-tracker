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

## D13 — Resume hole is derived, not stored

**Decision:** "Continue round" opens the first hole without a saved score, or the last hole if all have one (`domain/resume.ts`).

**Reason:** Avoids a stored "current hole" that could go stale; consistent with D5.

**Limitation:** If the user goes back to edit an earlier hole and closes the app, Continue still opens the first unplayed hole.

---

## D14 — Hole range as a single control

**Decision:** New Round offers "18 holes / Front nine / Back nine" (only "9 holes" on a 9-hole course) instead of separate 9/18 and which-nine controls.

**Reason:** One tap, and "back nine on a 9-hole course" is impossible by construction.

---

## D15 — Finished rounds stay editable in V0.1

**Decision:** A finished round can still be corrected from its summary.

**Reason:** Totals are derived, so corrections are always consistent, and fixing a typo after the round is a real need. An explicit lock/unlock is revisited with History in V0.2.

---

## D16 — Finishing with unplayed holes is allowed after confirmation

**Decision:** The confirmation names the holes without score; they do not count in statistics.

**Reason:** Blocking would force inventing data; silently allowing it would hide a mistake.

---

## D17 — SheetJS is vendored from the SheetJS CDN

**Decision:** SheetJS 0.20.3 is installed from a tarball committed to `vendor/` (`"xlsx": "file:vendor/xlsx-0.20.3.tgz"`). Only `utils`, `write` and `read` are imported (named imports).

**Reason:** The `xlsx` package on the npm registry is outdated (0.18.5); the SheetJS CDN is the authoritative source. Vendoring keeps the GitHub Actions build independent of the CDN and is what the SheetJS docs recommend for stability.

**Trade-offs:** Updating SheetJS means downloading a new tarball by hand. The library makes the main bundle about 720 kB (about 233 kB gzipped), which triggers Vite's chunk-size warning. It is downloaded once and precached for offline use; code-splitting was rejected because the library would have to load before the tap handler runs (see D21).

**Alternative considered:** ExcelJS (not needed).

---

## D18 — Export contents: played holes only, percentages 0-100

**Decision:** The HOLES sheet has one row per played hole (holes with a saved score). The ROUND row uses the same played holes. Percentages are 0-100, unrounded, and an empty cell when there is nothing to divide by. Dates are text `YYYY-MM-DD` in local time.

**Reason:** Consistent with the statistics rule from phase 2. Rows for unplayed holes would be full of empty cells that look like data. Text dates do not depend on the locale of Excel, and pandas/Power BI parse them without trouble.

---

## D19 — Backup restore never overwrites and validates before writing

**Decision:** A backup is `{ app, schemaVersion, exportedAt, rounds: [{ round, holes }] }`. Restoring first validates the whole file (`parseBackup`, unknown fields dropped), then inserts round by round. A round whose id already exists is skipped, never overwritten. Each round is written in one transaction, so a failing round leaves nothing behind and does not stop the others. The UI reports imported / already existed / failed.

**Reason:** Golf data is a long-term asset (prompt section 20). A restore must never destroy newer edits, and a damaged or foreign file must never leave half a round in the database.

**Limitation:** Restoring an `in_progress` round makes it a candidate for "Continue round" (the most recently updated one wins).

---

## D20 — Rounds list with inline-confirmed deletion

**Decision:** `/rounds` lists every round, newest first, and is the only place where rounds are deleted. Deleting needs an inline confirmation that names the round, warns that it cannot be undone and suggests a backup first. No `window.confirm`.

**Reason:** Prompt section 20: never silently delete data, confirm destructive actions. It also gives access to finished and abandoned in-progress rounds that were unreachable before. The inline pattern matches "Finalizar ronda".

---

## D21 — Files are built synchronously and shared straight from the tap

**Decision:** `createExcelFile` and `createBackupFile` are synchronous and work on data already in memory. The tap handler calls `shareFile` without awaiting anything first. `shareFile` uses `navigator.share` with a file when `canShare` allows it, treats closing the share sheet (`AbortError`) as "cancelled" (no download), and falls back to a download on any other failure.

**Reason:** iOS Safari only opens the share sheet while the tap is still a fresh user gesture; awaiting a database read first can make it fail. The fallback guarantees an export is never lost silently.

## D22 — Light theme colours everywhere; chunk-size warning silenced on purpose

**Decision:** `theme_color` / `background_color` and `<meta name="theme-color">` are `#ffffff`. The iOS status bar style is `default` (dark text), not `black-translucent`. Secondary text uses a solid `--muted` colour instead of `opacity`. `build.chunkSizeWarningLimit` is 800 kB.

**Reason:** `black-translucent` draws white status bar text, invisible on a white page. Solid colours stay readable in sunlight and do not compound when nested. The only chunk over 500 kB is the SheetJS bundle (D17), precached once for offline use, so the warning carries no information; the raised limit still warns if the bundle grows unexpectedly.
---

## Open items

- (none)