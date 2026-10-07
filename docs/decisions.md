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

**Decision:** Work is split into phases, each with a verifiable deliverable, tracked in `docs/STATUS.md`. GitHub is the source of truth, not the chat history.

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

---

## D22 — Light theme colours everywhere; chunk-size warning silenced on purpose

**Decision:** `theme_color` / `background_color` and `<meta name="theme-color">` are `#ffffff`. The iOS status bar style is `default` (dark text), not `black-translucent`. Secondary text uses a solid `--muted` colour instead of `opacity`. `build.chunkSizeWarningLimit` is 800 kB.

**Reason:** `black-translucent` draws white status bar text, invisible on a white page. Solid colours stay readable in sunlight and do not compound when nested. The only chunk over 500 kB is the SheetJS bundle (D17), precached once for offline use, so the warning carries no information; the raised limit still warns if the bundle grows unexpectedly.

---

# Block V0.1.x / V0.2 and the re-cut roadmap (planning after V0.1)

## D23 — The dashboard reads Dexie directly; JSON is only backup and transfer

**Decision:** The in-app dashboard computes everything from `listRoundsWithHoles` (IndexedDB) through pure functions in `domain/`. The JSON file is never an intermediate step: a finished round is already in the database and appears in the dashboard immediately. At finish the app offers "Guardar copia" in one tap, never forced.

**Reason:** Data is persisted from the first tap, so a "pass to JSON then to dashboard" step would only add a failure point. iOS web apps cannot silently write or append to files anyway.

**Rejected:** Dashboard fed from exported JSON/Excel files (manual, error-prone, duplicates data); an automatic backup on finish (not possible on iOS without a user gesture and share sheet).

---

## D24 — Export all rounds: one file, fixed name, finished rounds only

**Decision:** Phase 9 adds "Export all" on `/rounds`: one `.xlsx` with the same `ROUND` (one row per round) and `HOLES` (one row per played hole) sheets, all finished rounds, ascending by date, fixed filename. It reuses the existing pure row builders. Single-round export from the summary stays. In-progress rounds are excluded (their data is incomplete; consistent with D25).

**Reason:** Solves "one new Excel per round" with a small change. With the same filename the user can choose "Replace" in Files. Later versions add sheets (e.g. SHOTS) without altering existing ones.

**Rejected:** Appending rows to an existing file (impossible for a web app on iOS); a File System Access based approach (not available in iOS Safari).

---

## D25 — Statistics rules for 9/18-hole, incomplete and in-progress rounds

**Decision:**
- In-progress rounds are excluded from all statistics.
- Round-level metrics (total score, score to par, total putts, per-round averages, best/worst) use finished rounds with every hole played, and 9-hole and 18-hole rounds are never averaged together (a selector chooses which).
- Hole-level rates (GIR %, fairway %, up & down %, 3-putts per hole, penalties per hole, score to par by par type / hole number / course) use all played holes of finished rounds, including finished rounds with unplayed holes (D16).
- Percentages follow D18 (0–100, unrounded, `null` when the denominator is 0). Every figure shows how many rounds/holes it is based on.

**Reason:** Mixing 9 and 18 holes distorts totals; per-hole rates are comparable and make the most of partial rounds without inventing data.

**Rejected:** Normalizing everything per hole (hides round totals the golfer cares about); excluding incomplete rounds from rates (wastes real data).

---

## D26 — V0.2 scope

**Decision:** IN: general statistics, course and 9/18 filters, best/worst round, evolution chart, breakdown by par type, hole number and course, putts with/without GIR, round list opening the existing summary, last-backup date and nudge. OUT: Strokes Gained, handicap, anything needing data not recorded in V0.1, cloud, accounts, in-app course editing.

**Reason:** Solves the real problem (all rounds in one place, general and per-round view) with data already recorded. "Where do I lose strokes" is answered with to-par by par type/hole/course and the rates, without inventing a methodology (Strokes Gained stays V0.6).

---

## D27 — Navigation: new `/stats` route, existing routes untouched

**Decision:** `/stats` is added, with an "Estadísticas" button on Home. `/rounds` stays the list and management screen. Round detail from the dashboard reuses `/round/:id/summary`. No existing hash route changes.

**Reason:** No new detail screen to maintain; no broken bookmarks or in-round flows.

---

## D28 — Backup nudge with last-backup date

**Decision:** The app records the date of the last backup and nudges after N finished rounds (or X days) without one. Where the date is stored (a small Dexie settings table vs localStorage) is decided in phase 12.

**Reason:** As the dataset grows, iOS storage eviction becomes the biggest risk. A reminder costs little.

**Open:** N and X, and the storage location.

---

## D29 — The PC copy is a read-only view; restore edits do not propagate

**Decision:** To view the dashboard on a computer, open the same URL and use "Restaurar copia". The computer's copy is a read-only view. Because restore never overwrites (D19), edits to a round that already exists on the computer are not applied.

**Reason:** No backend or accounts (prompt section 25). The limitation is accepted for now.

**Open:** A "replace existing with confirmation" option on restore may be added if the limitation hurts.

---

## D30 — Charts are plain SVG

**Decision:** Charts are small SVG components with no chart library.

**Reason:** No new dependency (prompt section 24); the needed charts are simple (line, bars). Revisit only if a chart cannot be built reasonably.

---

## D31 — Roadmap re-cut: V0.3 environment, V0.4 shots and clubs, V0.5 live info

**Decision:** The originally separate shot-by-shot (V0.4), GPS (V0.5) and club tracking (V0.8) versions are merged into the on-course flow of V0.4 (shots + clubs + GPS point per shot) and V0.5 (live distances and wind). Weather is added to V0.3 together with a GPS field test and course geometry. V0.8 becomes advanced club analytics.

**Reason:** The user's real on-course flow combines these features; building them as separate versions would produce unusable intermediate screens. The dashboard comes first so the real pain (many Excel files) is solved before the heavier work.

---

## D32 — GPS: one fix per user tap, never continuous tracking

**Decision:** On each club selection the app stores a single GPS fix with its accuracy and timestamp. The distance of a shot is the distance between two consecutive fixes. A field test (phase 13) on the real iPhone precedes any dependency on GPS.

**Reason:** JavaScript is suspended when the screen locks or the app goes to the background, so continuous tracking while walking is unreliable. Single fixes use little battery and work with the phone in the pocket. Geolocation in installed iOS PWAs has been reported to behave inconsistently with permissions, so it must be verified on the device. Phone GPS accuracy is typically several meters, so accuracy is stored and shown.

**Rejected:** `watchPosition` while walking (unreliable in the background, battery cost).

---

## D33 — Course geometry captured by the user in-app

**Decision:** Green centers and landmarks (dogleg, water) per hole are captured by the user standing at the spot with a "mark point" tool, which outputs coordinates to paste into `courses.json`. No external course database, no map tiles.

**Reason:** No free, legally verified course data source is known (prompt: do not assume one exists, do not scrape). It works offline and only requires mapping the courses actually played.

**Open:** OpenStreetMap golf data may be researched later; its license must be checked first.

---

## D34 — Weather from Open-Meteo using the course coordinates, fetched online or back-filled

**Decision:** A weather snapshot per round (temperature, precipitation, pressure, wind) comes from Open-Meteo using the **course** coordinates and the round time. It is fetched when online and back-filled after the round if there was no connection. Live wind in V0.5 uses the same service. Terms of use (free for non-commercial use) are verified at phase 14.

**Reason:** The service is keyless, free for non-commercial use and has current and historical endpoints. Using course coordinates means the user's position never leaves the device, and back-filling removes the dependency on coverage during the round. Wind is a 10 m grid value, not the wind at the ball, so it is shown as an orientation with its time.

**Rejected:** Sending the device position; requiring a connection during the round.

---

## D35 — Elevation / slope is discarded

**Decision:** The "elevation difference from here to the hole" feature is not planned.

**Reason:** Phone GPS altitude is usually too imprecise for differences of a few meters, and Safari does not expose a barometer. Promising it would mislead club choice.

**Rejected:** Experimental version with an accuracy warning; hand-entered tee/green altitudes (low value for the effort).

---

## D36 — Distances in meters

**Decision:** All distances are in meters.

**Reason:** User preference; no unit toggle needed.

---

## D37 — Shot tracking is optional per hole; `score` stays the source of truth

**Decision:** Shot capture can be skipped on any hole. The recorded shots plus putts and penalties are compared with `score`; a mismatch is shown but never blocks saving. Selecting the putter hands over to the existing hole screen, and putts are still entered with the existing stepper.

**Reason:** Speed over completeness (prompt section 3); the golfer may forget a tap, and data must never be lost or blocked by a reconciliation rule.

---

## D38 — Every phase that adds stored data extends backup and export

**Decision:** In the same phase that adds data, the JSON backup (still accepting older `schemaVersion` files), the Excel export (new sheets/columns, existing ones unchanged) and their tests are extended. Dexie changes always add a new `version(n)` block with migration.

**Reason:** Prevents data that exists in the app but not in backups, which is the biggest risk as the dataset grows.

---

## Open items

- D28: values of N and X for the backup nudge, and where the last-backup date is stored (phase 12).
- D29: whether restore needs a "replace existing with confirmation" option.
- D33: whether OpenStreetMap golf data is worth researching (check license first).
- D34: verify Open-Meteo terms of use in phase 14.