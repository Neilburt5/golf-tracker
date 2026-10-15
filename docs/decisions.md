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

**Decision:** A weather snapshot per round (temperature, precipitation, pressure, wind) comes from Open-Meteo using the **course** coordinates and the round time. It is fetched when online and back-filled after the round if there was no connection. Live wind in V0.5 uses the same service. Terms of use (free for non-commercial use) are verified at phase 14.Terms verified in phase 14 (see D48).

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

## D39 — Every position is validated by age and accuracy

**Decision:** The first position of a capture is never used as is. A position is accepted only when its age (arrival time minus `position.timestamp`) is <= 3 s and its accuracy is <= 20 m. If the window ends without one, the best position with age <= 3 s is returned and shown as approximate, with its accuracy. Stale and coarse are reported as separate conditions. Each stored fix keeps the position's timestamp.

**Reason:** Every window started with positions from the phone's cache (age 8-24 s, in no particular order) and sometimes with recent but coarse positions (accuracy 114-511 m, up to about 276 m from the real spot). In phase 13, 19 of 20 single calls answered in 0.0 s from the cache, and one returned the same position for over 140 s.


---

## D40 — Always high accuracy; the +/- is shown, never assumed

**Decision:** Positions are requested with high accuracy. Accuracy is stored with each fix. A distance between two fixes is shown with an uncertainty derived from both accuracies, and flagged as approximate when it is large (limit to be set in phase 16).

**Reason:** Normal accuracy gave 16-18 m against 3-4 m with high accuracy, with the same latency. In three known legs (50, 100 and 50 m), the distance error (+19, -2, +8 m) stayed below the sum of the two accuracies (38, 43 and 28 m), so the reported accuracy was an honest indicator. Repeated fixes with accuracy <= 4 m at the same spot differed by 0-1.2 m. The test site had worse sky than the course (14-23 m against 3-4 m), so on the course better results are expected, but a known distance on a golf course is still to be checked.

---

## D41 — Page lifecycle: rely only on `visibilitychange`

**Decision:** The app treats `visibilitychange` as the only reliable lifecycle signal. After the page becomes visible again, any pending capture is discarded and a new one is taken. Nothing may assume that code ran while the screen was locked or the app was in the background.

**Reason:** The log shows `visibilitychange` on every lock and app switch, and never `pagehide`, `pageshow`, `freeze` or `resume`. The page survived about 95 s in another app without reloading. After 1-2 minutes locked, a new capture reached a fresh, precise position in 0.6-2.1 s.

---

## D42 — GPS capture works offline

**Decision:** Capture does not depend on the network.

**Reason:** In airplane mode, two captures returned fresh positions in 1.2 s and 0.0 s with accuracy 14 m and 4 m, and the earlier single fixes gave 21-34 m. Accuracy therefore seems to depend on the sky, not on airplane mode. Small samples.

---

## D43 — Location permission is asked once, on the first GPS tap

**Decision:** The app asks for location only when the user first taps a GPS action (a user gesture). It reads the state with the Permissions API. If the state is `denied`, it shows how to re-enable it in iOS Settings; no re-prompt handling is built.

**Reason:** Field test (2026-10-11, iPhone, installed PWA): the iOS prompt appeared on the first tap, and after force-quitting and reopening the app it did not ask again and the state stayed `granted`. Caveat: one device, one session; the "Ask Next Time" setting was not tested.

# D32 amendment — bounded capture window (accepted, confirmed in phase 13b)

**Decision:** A GPS capture is started by a user tap and uses `watchPosition` for a bounded window: it stops by itself at the first position with age <= 3 s and accuracy <= 20 m, and never lasts more than 15 s. The watch is always cleared, including when the page is left or the user cancels. Continuous tracking while walking stays rejected.

**Reason:** In phase 13, single `getCurrentPosition` calls returned a frozen position for over 140 s after walking 113 m (D39). In phase 13b, 12 of 13 windows returned a fresh, precise position within 2.1 s (median 0.6 s); the other ended at 15 s because accuracy stayed at 21-23 m. Windows were also used after the phone had been locked 1-2 minutes.

## D43 — Location permission is asked once, on the first GPS tap

**Decision:** The app asks for location only when the user first taps a GPS action (a user gesture). It reads the state with the Permissions API. If the state is `denied`, it shows how to re-enable it in iOS Settings; no re-prompt handling is built.

**Reason:** Field test (2026-10-11, iPhone, installed PWA): the iOS prompt appeared on the first tap, and after force-quitting and reopening the app it did not ask again and the state stayed `granted`. Caveat: one device, one session; the "Ask Next Time" setting was not tested.
---
---

# Phase 14 — weather

## D44 — Weather snapshot: fixed window, aggregated

**Decision:** The weather of a round is one aggregate over a window that starts at the hour of `Round.date` and lasts 5 h (18 holes) or 3 h (9 holes). Slots with start < time <= end are used (precipitation of a slot is the sum of the preceding hour). Stored: mean temperature, total precipitation, mean surface pressure, mean wind speed (km/h), wind direction (speed-weighted vector mean, null if calm), max gust, and the number of hours used. Weather is only fetched once the window is over.

**Reason:** The window does not depend on `updatedAt` (finished rounds stay editable, D15), so it is deterministic and testable. Surface pressure (not sea level) is what matters for air density at the ball. Wind is a 10 m grid value, not the wind at the ball (D34).

**Limitation:** The window assumes the round starts when "Empezar ronda" is tapped. `windowStart` is stored so the assumption is visible.

## D45 — Separate `weather` table; backup v2; WEATHER sheet

**Decision:** Dexie v2 adds a `weather` table keyed by `roundId` (1:1). Saving weather does not change `Round.updatedAt`. The JSON backup becomes `schemaVersion` 2 with an optional `weather` per round; v1 files are still accepted. Restore never overwrites, so an existing round does not receive weather from a file (D19, D29). Excel gets a `WEATHER` sheet (one row per round, joined by Round ID), added only when at least one round has weather; ROUND and HOLES are unchanged.

**Reason:** A background fill must not make the backup nudge (D39) think a round was edited. A separate sheet keeps existing analysis pipelines intact and mirrors the planned SHOTS sheet.

**Rejected:** Weather fields inside `Round`; extra columns in ROUND.

## D46 — Course coordinates are an optional field in `courses.json`

**Decision:** `coordinates: { latitude, longitude }`, one point per course, copied by the user from a map. Validated when present. A course without coordinates gets no weather. The weather row stores the coordinates it used.

**Reason:** The weather grid is about 9 km, so one point is enough. Optional keeps old data valid.

## D47 — Weather requests

**Decision:** Rounds started less than 85 days ago use the forecast API with `past_days` (documented maximum 92); older rounds use the archive API with `start_date`/`end_date`. `timeformat=unixtime`, `wind_speed_unit=kmh`. 10 s timeout. At most 5 rounds per run, stopping at the first failure. Triggers: opening Home and opening a round summary. Failures are silent and never block anything; there is no retry loop. The service worker does not cache these requests.

**Reason:** Both endpoints return the same shape. Unix timestamps avoid timezone and DST logic.

## D48 — Open-Meteo terms

**Decision:** Free non-commercial use (private apps without ads or subscriptions qualify; limits 10,000 calls/day, 5,000/hour, 600/minute). Data is CC BY 4.0, so the summary shows "Datos meteorológicos: Open-Meteo.com (CC BY 4.0)" with a link, and the README credits it. Their server logs may keep coordinates for 90 days; only course coordinates are sent. Verified on 2026-10-12.

**Open:** CORS from the installed iOS PWA is verified on the real device.

## D49 — Backup nudge: values and storage (resolves D28)

**Decision:** The date of the last backup is stored in `localStorage` (`golf-tracker:last-backup-at`), not in Dexie. It is recorded when "Guardar copia" ends as shared or downloaded, using the moment the file was built. The nudge shows from the first finished round if there was never a backup; otherwise at 3 finished rounds created or edited after the last backup, or at 30 days with at least 1. In-progress rounds are ignored. Restoring a backup does not set the date.

**Reason:** It is device metadata, not golf data, so it stays out of the backup file and the Excel export. A small localStorage entry avoids a schema change.

**Limitation:** It is lost on reinstall or on another device. `shared` only means the share sheet completed, so the UI says "Última copia", never "verificada".

## Open items

- D28: values of N and X for the backup nudge, and where the last-backup date is stored (phase 12).
- D29: whether restore needs a "replace existing with confirmation" option.
- D33: whether OpenStreetMap golf data is worth researching (check license first).
- D34: verify Open-Meteo terms of use in phase 14.

## D50 — Course geometry format in `courses.json`

**Decision:** Each hole may have `green: { latitude, longitude }` (center of the green) and
`landmarks: [{ kind, latitude, longitude, label? }]`. All optional; courses and holes without
geometry stay valid. No `accuracy` field. `kind` is one of:

- `dogleg`: corner of the fairway where the line of play turns.
- `water`: river or lake. `label` tells them apart (e.g. "río", "lago").
- `bunker`: `label` tells them apart when there are several (e.g. "derecha", "izquierda").
- `testero`: the user's own term (UI label "Testero"). A balcony: a raised spot at the top of
  a slope from which the green is visible below. The player stops there and plays down to the
  green from above. It is a position to play from, not a hazard.

`green` is deliberately not a landmark kind: each hole has one green, and a second place for
it would make "where is the green" ambiguous. Front and back of the green, and the near and far
edges of water, may be added later as extra optional fields without breaking existing data.

**Reason:** Live distances (phase 18) need the center of the green and a few landmarks.

## D51 — Geometry is measured by hand on a satellite map (amends D33)

**Decision:** The user copies the coordinates from Google Maps in satellite view at home and
pastes them into `courses.json`. The in-app "mark point" tool is not built. The bounded GPS
capture (D32 amendment) stays available if satellite measurements prove insufficient.

**Reason:** Walking to a spot during a round is slow and disrupts play, and the ball does not
always land there. Phone GPS gave 14-23 m accuracy in the field test; a satellite image allows
a few meters and any point can be marked, including water. Personal use, no external
database, no scraping, no new code to maintain.

**Rejected:** In-app capture on the course (D33 original).

## D52 — Sanity check of geometry against the course coordinates

**Decision:** If the course has `coordinates`, `validateCourses` rejects any green or landmark
farther than 3000 m from them.

**Reason:** Catches a wrong sign or a mistyped digit when pasting, which would otherwise break
distances silently in phase 18.


---

# Phase 16 — shots and clubs

## D54 — Fixed club catalog: the user's own 14 clubs

**Decision:** Clubs come from a fixed catalog in `domain/clubs.ts`, stored as stable codes: `driver`, `wood3`, `hybrid`, `iron4`-`iron9`, `pw`, `wedge52`, `wedge56`, `wedge64`, `putter`. The Spanish labels are only for the UI ("Driver", "Madera 3", "Híbrido", "Hierro 4"..., "PW", "52º", "56º", "64º", "Putter"). Wedges are named by loft. No custom or free-text clubs.

**Reason:** Analytics (V0.7/V0.8) group by club, so a closed set of codes prevents typos and renames from splitting the data. Excel and JSON hold the code, not the label, so changing a label never changes history.

**Rejected:** Free-text clubs; a club table in the database (the set is fixed and personal). Adding a club later means adding a code to the catalog; old data stays valid.

## D55 — Club bag in a `settings` table; the putter is always in it

**Decision:** Dexie v3 adds a `settings` table (primary key `key`). The club bag is one row `{ key: 'clubBag', value: ClubCode[] }`. Until the user saves a bag, the repository returns every club of the catalog. `parseClubBag` validates (non-empty, known codes, no repeats), returns catalog order and always includes the putter, because the putter is the marker that ends a hole's shots. The bag goes into the JSON backup (`clubBag`, optional). On restore it is applied only if the device has no bag of its own (never overwrites, D19). It is not in the Excel export (not tabular).

**Reason:** A generic key/value table avoids a schema change for every future setting. Having the bag in the backup means a reinstall does not lose it.

**Rejected:** localStorage (as in D49): the last backup date is device metadata with no value for analysis, while the bag is user configuration that belongs in the backup.

## D56 — Shot model

**Decision:** `Shot { id, roundId, holeNumber, sequence, club, fix, createdAt }` with `fix: { latitude, longitude, accuracy, fixedAt, fresh } | null`.

- A shot is linked to its hole by `[roundId+holeNumber]`, the natural key that the `holes` table already treats as unique, not by `Hole.id`.
- `sequence` is 1-based and assigned by the repository from the array order. `saveHoleShots` replaces all the shots of a hole in one transaction, so deleting or reordering never collides with the unique index `[roundId+holeNumber+sequence]`.
- `fix` is null when there is no GPS (permission denied or capture failed); the club is still recorded.
- `fresh` is true when the fix met age <= 3 s and accuracy <= 20 m (D39); false is the best position of the window.
- A putter shot is a position marker only: it ends the previous shot's distance and is not counted as a stroke. Putts still come from `Hole.putts` (D37).
- `saveHoleShots` bumps `Round.updatedAt`: shots are user data, unlike the weather fill (D45), so the backup nudge counts them.
- No limit on the number of shots per hole and no rule tied to the score.

**Reason:** Keeps `score` the source of truth and makes any capture mistake recoverable by replacing the hole's list.

## D57 — Reconciliation with the score and shot distances

**Decision:** (`domain/shots.ts`, pure functions)

- `reconcileHole`: expected strokes = non-putter shots + `putts` + `penaltyStrokes`, compared with `score` (which already includes penalties). Status: `not_tracked` (no shots, not a mismatch), `not_played` (no score), `match`, `missing` (score higher), `extra` (score lower). Informational only: it never blocks saving.
- The distance of a shot is the haversine distance from its fix to the next shot's fix on the same hole. It is null for the last shot, a putter marker, a missing fix, or across holes.
- Uncertainty = sum of the two accuracies (D40).
- A distance is flagged approximate when its uncertainty is above `APPROXIMATE_UNCERTAINTY_M` = 20 m (about 10 m per fix), or when either fix is not `fresh`.

**Reason:** The sum is what D40 validated on three known legs (errors 19, 2 and 8 m against sums of 38, 43 and 28 m). 20 m separates the expected course values (3-4 m per fix, about 8 m in total) from the test site (28-43 m). To be revisited after the second real round (phase 20).

**Limitation:** A shot played after a penalty drop makes the previous shot's distance meaningless; there is no flag for it yet.

## D58 — Backup `schemaVersion` 3 and the Excel SHOTS sheet

**Decision:**

- Backup: `schemaVersion` 3 adds an optional `clubBag` (top level) and optional `shots` per round. Versions 1 and 2 are still accepted; versions above 3 are rejected. Shots are validated field by field, unknown fields are dropped, ids and `[hole, sequence]` must be unique. Shots travel with their round and are never imported into an existing round (D19, D29). An empty `shots` list is the same as none.
- Excel: a `SHOTS` sheet, one row per shot, added only when at least one shot exists. Sheet order: ROUND, HOLES, WEATHER, SHOTS. Columns: Round ID, Date, Course, Hole, Shot, Club (code), Latitude, Longitude, Accuracy m, Fix Time, Fresh Fix (1/0), Distance m, Distance Uncertainty m, Approximate (1/0). Meters with one decimal. Cells that cannot be computed are empty. Every recorded shot is exported, including on holes without a score (a shot row is data, unlike the empty rows of D18). Export-all keeps D24 (finished rounds only).

**Reason:** D38: data that exists in the app must exist in the backup and the export, with ROUND, HOLES and WEATHER unchanged for existing pipelines.

---

# Phase 17 — shot capture

## D59 — Shots live on their own screen; the club is saved before the position

**Decision:** Shot capture is a separate screen, `/round/:roundId/hole/:holeNumber/shots`; the hole screen only gets a link back to it (`ShotsEntry`). A club tap starts the bounded capture synchronously (D43), saves the shot at once with `fix: null`, and attaches the position when the capture ends. The hook (`useHoleShots`) has its own serial write queue; `useHoleForm` is not touched. Each write stores a snapshot of the list taken when it is queued, so a pending write can never overwrite another hole. Captures are cancelled when the screen is left or the page is hidden (D41); the club stays with `fix: null`, with no automatic retry. A late capture for a deleted shot is ignored. Editing is limited to changing the club and deleting (with inline confirmation); new shots are always appended.

**Reason:** The hole screen is the critical one and its 10 s flow is proven; GPS must never delay or lose a club (D37).

**Rejected:** Shot controls inside the hole screen; waiting for the position before saving the shot; inserting or reordering shots (the mismatch line already reports a forgotten one).

## D60 — The capture window returns the most accurate recent position

**Decision:** At the end of the window, `startShortCapture` returns the most accurate position with age <= 3 s, marked `fresh: false`. If positions arrived but all were stale it fails with `reason: 'only_stale'`; if none arrived, `reason: 'no_position'` (D39: stale and coarse are reported separately). Before, it returned the latest position.

**Reason:** Phase 13 notes: return the best position of the window, not the last one, and never use a stale position.

## D61 — No club bag screen yet

**Decision:** The shots screen reads the bag with `getClubBag()` (default: the full catalog). A configuration screen is deferred until the user changes their bag; `saveClubBag` already exists. When a backup restores a bag, the restore message on `/rounds` says so (`clubBagRestored`).

**Reason:** The user's bag is the full catalog; a screen would be unused code.

## D62 — The round flow starts on the shots screen

**Decision:** New round, "Continue round" and "Save & next" open the shots screen of a hole that has no score. A hole that already has a score opens on the hole screen (progress dots, "Anterior", editing an earlier hole). "Continue round" reopens the shots screen of the first unplayed hole, or the hole screen of the last hole when everything is played (`findResumeTarget`, `resumePath`). The last hole goes to the summary. The shots screen has "Ir al hoyo" at any time, so shots can be skipped.

**Reason:** Matches the on-course flow of section 18: shots, putter, hole data, next hole.

## D63 — Suggested score from the shots

**Decision:** While a hole has no score and at least one non-putter shot is recorded, the first tap on the score stepper starts at shots + putts + penalties instead of par, and the hint says "Sugerido N (según golpes)". It is only a starting value: it never blocks saving and `score` stays the source of truth (D37). The mismatch with the score is shown on the shots screen and on the hole screen.

**Limitation:** If a shot tap was forgotten, the suggestion is low; the mismatch line shows it after the score is saved.

## D64 — Shot distance stays the distance between fixes

**Decision:** The distance of a shot is the haversine distance between its fix and the next one (D57), not the difference of the distances to the green. After the putter marker, the last shot ends at the ball's position on the green. If the putter has no position, phase 18 may fall back to the distance to the green recorded when the shot was played, computed from the shot fix and the green in `courses.json` (no schema change).

**Reason:** A difference of distances to the green only measures progress towards the green, not the length of the shot, and it carries the error of two fixes too.