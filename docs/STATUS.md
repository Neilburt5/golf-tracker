# Project Status

_Paste this file at the start of every new conversation, together with the files relevant to the current phase._

## Current version
V0.4 in progress: shot data layer (16) and shot capture UI (17) done. Next: live distances and wind (18).

## Current phase
Phase 18 — Live distances and wind (next up)
## Phases

V0.1
- [x] 0. Planning
- [x] 1. Environment, repo and deployment
- [x] 2. Domain and tests
- [x] 3. Data layer
- [x] 4. UI skeleton (Home, New round)
- [x] 5. Hole tracking screen
- [x] 6. Summary and finish round
- [x] 7. Excel export and JSON backup
- [x] 8. Polish and real-round test

V0.1.x / V0.2
- [x] 9. Export all rounds to one Excel file
- [x] 10. Statistics domain (pure functions + tests)
- [x] 11. Dashboard UI: `/stats`, filters, best/worst, round list
- [x] 12. Charts, "where I lose strokes" breakdowns, backup nudge

V0.3
- [x] 13. GPS field test page + decisions from a real round
- [x] 14. Weather per round
- [x] 15. Course geometry: green centers and landmarks measured on a satellite map

V0.4
- [x] 16. Shot model, club bag, data layer, backup and Excel extension
- [x] 17. Shot capture UI 

V0.5
- [ ] 18. Live distances and wind (next up)

V0.7 (first part)
- [ ] 19. Shot and weather analytics in the dashboard

- [ ] 20. Second real-round test and polish

Phases 13–20 are outlined only; each block is detailed at the start of its first phase (see docs/roadmap.md).

## Key decisions (see docs/decisions.md)

- PWA on iPhone; no Mac, no Apple Developer account.
- TypeScript + React + Vite + Dexie + SheetJS + Vitest, hosted on GitHub Pages.
- Courses from bundled `src/data/courses.json`.
- Per hole: score, putts, fairway, penalties, bunker, up & down, GIR (3-putt derived).
- Rounds of 9 or 18 holes; 9-hole rounds start at hole 1 or 10.
- Totals derived from holes, never stored.
- Dashboard reads Dexie directly; JSON is only backup (D23). Export all = one file, fixed name, finished rounds only (D24).
- Statistics rules for 9/18, incomplete and in-progress rounds (D25); V0.2 scope (D26); `/stats` route (D27); plain SVG charts (D30).
- Roadmap re-cut: V0.3 environment (GPS test, weather, course geometry), V0.4 shots and clubs, V0.5 live distances and wind (D31).
- GPS = one fix per tap, never continuous (D32). Course geometry captured by the user in-app (D33). Weather from Open-Meteo with the course coordinates (D34).
- Elevation/slope discarded (D35). Distances in meters (D36). Shot tracking optional; `score` stays the truth (D37).
- Every phase that adds data extends backup and export (D38).
- Last backup date in localStorage; nudge at 1 / 3 / 30 (D39).
- Last backup date in localStorage; nudge at 1 / 3 / 30 (D49).
- GPS: bounded capture window (D32 amendment); every position validated by age and accuracy (D39); high accuracy, +/- shown (D40); rely only on `visibilitychange` (D41); capture works offline (D42); permission asked once on first GPS tap (D43).
- Weather: fixed window of 5 h / 3 h, aggregated (D44); separate `weather` table, backup v2, WEATHER sheet (D45); optional course `coordinates` (D46); forecast API under 85 days, archive otherwise (D47); Open-Meteo terms and CC BY attribution (D48).
- Course geometry measured by hand on Google Maps satellite view, no in-app tool (D51, amends D33); format with `green` and `landmarks` of kind dogleg / water / bunker / testero (D50); sanity check of 3 km against the course coordinates (D52).
- Shot capture: own screen, club saved before the position (D59); best recent position of the window (D60); no bag screen yet (D61); flow starts on shots (D62); suggested score (D63); distance between fixes (D64).

## Phase 2 results (domain)

- `src/domain/types.ts`, `calculations.ts`, `validation.ts` implemented; 26 Vitest tests passing (`tests/`).
- `tsc -b` and `npm run lint` clean. CI build and deploy to GitHub Pages working.
- Choices made in phase 2:
  - Stats count only "played" holes (those with a saved score).
  - Percentages are 0-100, unrounded, and `null` when the denominator is 0.
  - `validateHole` has two modes: `requireScore: false` for autosave drafts, `true` for "Save & next".
  - `score` is total strokes including penalties; `penaltyStrokes` is a separate stat.

## Phase 3 results (data layer)

- Added dependencies: `dexie` (IndexedDB), `fake-indexeddb` (dev, tests only).
- Implemented `src/data/db.ts` (Dexie schema v1: `rounds`, `holes`), `roundRepository.ts`, `courseRepository.ts`, and `courses.json` (real course: Club de Golf Retamares).
- 50 Vitest tests passing (26 domain + 24 data). `tsc -b` and `npm run lint` clean.
- Schema documented in `docs/database.md`.
- Choices made in phase 3:
  - Repositories are factories (`createRoundRepository(db, clock)`) so tests use an isolated database and a deterministic clock; the app uses the default instances.
  - All hole rows are created when the round is created (`score: null` = not yet saved), in one transaction with the round.
  - Initial hole values: `fairway` is `null` on par 3 and `false` otherwise; `upAndDown` is `null`; everything else `0`/`false`.
  - `saveHole` overwrites an existing hole and bumps `Round.updatedAt`. It does NOT validate; the hook decides the validation mode.
  - `createRound` rejects an unknown tee and a hole range that doesn't fit the course, writing nothing.
  - `courses.json` is validated at load (`validateCourses`): unique ids, 9/18 holes, consecutive hole numbers, par 3-6, at least one tee.
  - `finishRound` is idempotent and allows unplayed holes (see D16).
  - `getInProgressRound` returns the most recently updated in-progress round.
- `crypto.randomUUID()` needs a secure context (HTTPS or localhost). Over a LAN IP on the iPhone, creating a round will fail; test saving on the deployed site, or add a UUID fallback.

## Phase 4 results (UI skeleton)

- Added dependency: `react-router-dom` (HashRouter).
- Home: "Continuar ronda" (if in progress) + "Nueva ronda"; keeps online status and build time from phase 1.
- New Round: course, tee, range (full / front / back); warns if a round is already in progress; the old round is NOT deleted.
- Added `domain/resume.ts` + 5 tests.
- Fix after iPhone test: links styled as buttons showed Safari's purple `:visited` colour; added explicit `a.btn-*:visited` rules, 12px gap between options and a yellow + ✓ selected state. Tested on the deployed site: OK.

## Phase 5 results (hole tracking)

- Stepper, YesNoToggle and HoleProgress components, `useHoleForm` hook with debounced, ordered autosave (flush on `visibilitychange` / `pagehide`), and the hole tracking screen.
- Fairway is forced to `null` on par 3; autosave validates with `requireScore: false`, "Save & next" with `requireScore: true`.

## Phase 6 results (summary and finish round)

- `unplayedHoles` in `domain/calculations.ts`, `domain/format.ts` (`formatToPar`, `formatPercentage`), `hooks/useRoundSummary.ts`, and the real `pages/RoundSummary.tsx`. 4 new tests in `tests/summary.test.ts`.
- Light, high-contrast theme (white background, black buttons, yellow/orange warnings). Colours are variables in `:root` of `index.css`.
- Finishing with unplayed holes is allowed after an inline confirmation that names them (D16). Finished rounds stay editable (D15).

## Phase 7 results (Excel export, rounds list, JSON backup)

- Added dependency: SheetJS 0.20.3, vendored in `vendor/` (D17). Verified against the SheetJS docs: the npm registry copy is outdated.
- Data layer: `listRoundsWithHoles`, `deleteRound`, `importRound` in `roundRepository.ts`; `RoundWithHoles` type in the domain. Schema unchanged (v1).
- Services: `filenames.ts` (slug, local date), `excelExport.ts` (pure row builders + workbook + file), `shareFile.ts` (injectable decision logic, real browser wiring on top), `backup.ts` (create, strict `parseBackup`, `restoreBackup`).
- UI: `/rounds` screen (`pages/Rounds.tsx`, `hooks/useRounds.ts`) with open, inline-confirmed delete, "Guardar copia" and "Restaurar copia"; "Mis rondas" link on Home; "Exportar a Excel" button on the summary.
- Removed the duplicate `navigator.storage.persist()` call from `main.tsx`; `services/storagePersistence.ts` is the single place.
- `docs/decisions.md`: duplicated D13/D14 renumbered (now D13-D16); D17-D21 added for this phase.
- 134 Vitest tests passing. `tsc -b` and `npm run lint` clean. Export and backup/restore checked manually on the desktop browser (xlsx opens in Excel with correct sheets, totals and empty cells; backup restore skips existing rounds).
- Choices made in phase 7: see D17-D21. In short: only played holes are exported, restore never overwrites, delete is always confirmed, files are built synchronously so the iOS share sheet keeps the tap gesture.
- `npm run build` warns that the main chunk is over 500 kB (about 723 kB, 233 kB gzipped) because of SheetJS. Expected and harmless (precached for offline use).
- Checked on the iPhone (deployed site): share sheet and file save for the Excel and the JSON backup, restore of the `.json` from Files (existing rounds skipped), and offline operation in airplane mode. Note: the `.xlsx` cannot be restored; only the `.json` backup can (the file picker greys out other files by design).

## Phase 8 results (polish and real-round test)

- Theme colours aligned to the light theme; status bar style `default` (D22).
- `.muted` and similar text now use a solid colour (`--muted`); warning/ok text darkened.
- Chunk-size warning limit raised to 800 kB with a comment (D22).
- Added `docs/real-round-checklist.md`.
- Update prompt ("new version available") verified on the iPhone.
- Real round on the course: under 10 s per hole, one-hand use OK, readable in sunlight, data survived screen lock and app switching, GIR suggestion accurate, no recording problems.
- Phase closed. The real pain found: one Excel file per round and no view of all rounds together; this starts the next block.

## Phase 9 results (export all)

- `selectRoundsForExport`, `buildAllRoundsWorkbook`, `createAllRoundsExcelFile` and `ALL_ROUNDS_FILENAME` in `services/excelExport.ts`; the single-round workbook now shares `workbookFromRows` with it.
- "Exportar todo a Excel" on `/rounds`: finished rounds only, ascending by date (then createdAt, then id), fixed filename `golf-tracker-todas-las-rondas.xlsx`. Built synchronously from the rounds already in memory (D21). No new dependencies, schema unchanged.
- Tests in `tests/excelExportAll.test.ts` (ordering, in-progress excluded, 9/18 holes, back nine numbering, unplayed holes, empty cells, file round trip).
- Checked on the iPhone (deployed site): share sheet opens on the first tap, file saves to Files, "Replace" works with the fixed name. (Ajusta esta línea si algo salió distinto.)

## Phase 10 results (statistics domain)

- `src/domain/stats.ts` (pure, built on `calculations.ts`) and `tests/stats.test.ts`. No new dependencies, schema unchanged.
- Choices: `roundLevel` is `null` until a 9/18 length is chosen (D25); best/worst by score to par, ties to the earliest round; complete round = finished, `holes.length === numberOfHoles`, all played; hole-level `rounds` = finished rounds with at least one played hole; course name from the latest round.
- Every figure carries its sample size (`Rate`, `PerHole`, `HoleStats.holes`, `RoundLevelStats.rounds`).

## Phase 11 results (dashboard UI)

- `listCourseOptions` (+ `CourseOption`) in `domain/stats.ts`, the only domain change; 7 tests in `tests/courseOptions.test.ts`.
- `hooks/useStats.ts`: loads rounds once via `listRoundsWithHoles`, holds the filter (default 18 holes, all courses), returns `stats` (from `calculateStats`), course options and the filtered finished rounds.
- `pages/Stats.tsx` at `/stats`: course select, 18 / 9 / Ambas control, summary cards with sample sizes, best/worst round (need at least 2 complete rounds), per-hole cards, list of finished rounds (newest first) opening `/round/:id/summary`. Empty states: no finished rounds, none for the filter, fewer than 3 rounds; hint when `roundLevel` is null or has no complete round.
- "Estadísticas" button on Home, `/stats` route in `App.tsx`; dashboard CSS appended to `index.css` (wider layout on desktop only for `.stats-screen`).
- No new dependencies, schema unchanged, in-round screens untouched.
- Choices: "Rondas finalizadas" counts all finished rounds of the filter; score averages use complete rounds only; low-sample notice uses finished rounds (< 3).
- Pending checks: ticking the iPhone test on the deployed site.
- Next: phase 12 (charts, breakdowns by par / hole / course, putts with/without GIR, backup nudge). Move the number formatters to `domain/format.ts` then.

## Phase 12 results (charts, breakdowns, backup nudge)

- Plain-SVG charts: `ScoreToParChart` (last 30 rounds, only with a 9/18 length) and `HorizontalBarChart`; geometry in `domain/chartScale.ts`. No new dependencies, schema unchanged (v1).
- "Dónde pierdo golpes" on `/stats` (`LossBreakdowns`): by par, hole number, putts with/without GIR and course (only if more than one course), all with sample sizes. Groups under 5 holes are flagged "pocos hoyos" (dashed bar) and excluded from the highlights (`domain/lossRanking.ts`, `LOW_SAMPLE_HOLES`).
- `/stats` organised in native `<details>` blocks (`CollapsibleSection`): Resumen, Evolución, Dónde pierdo golpes (open) and Rondas finalizadas (closed).
- Backup nudge (D39): last backup date in localStorage (`services/backupStatus.ts`), recorded when "Guardar copia" ends shared/downloaded, using the moment the file was built. `domain/backupNudge.ts` nudges from the 1st finished round if never backed up, otherwise at 3 unprotected rounds (finished, `updatedAt` after the backup) or 30 days with at least 1. Yellow card at the top of `/stats`; "Última copia" line on `/stats` and `/rounds`.
- `formatDecimal`, `formatSignedDecimal` moved from `Stats.tsx` to `domain/format.ts`; `plural`, `formatShortDate`, `formatDayMonth` added.
- `/rounds`: the Excel and backup sections have separate messages (before they shared one).
- 54 new tests (format, backupNudge, chartScale, backupStatus, lossRanking). In-round screens, backup format, Excel export and `stats.ts` untouched.
- Choices: ranking helper lives in a new `domain/lossRanking.ts` instead of `stats.ts`; restoring a backup does not set the backup date; in-progress rounds are ignored by the nudge.
- Known caveat: `shared` means the share sheet completed, not that the file reached Files, so the UI says "Última copia", never "verificada".
- V0.2 block complete.

## Phase 13 results (GPS field test page) — DONE

- Hidden page `/gps-test` (tap the Build line on Home 5 times). Two ways to get a position: a single fix per tap, and a bounded short capture window started by a tap (phase 13b).
- Findings: single `getCurrentPosition` calls can return a stale cached position (frozen for 140 s while walking 113 m). The bounded `watchPosition` window returned a fresh, precise position in 0.6 s median (12 of 13 within 2.1 s). Every window begins with stale and coarse positions, so age <= 3 s and accuracy <= 20 m must be checked. Distance error on three known legs: +19, -2, +8 m with fixes of 14-23 m accuracy. Works with the screen locked and offline. Permission is asked once.
- Decisions recorded: D32 amendment, D39-D43. D32's "never watchPosition" is now "no continuous tracking; bounded capture window only".
- To carry into phases 15-18: reuse `startShortCapture`; return the best position of the window (not the latest); report stale and coarse separately.
- Still unverified: a known distance on a golf course with open sky.

## Phase 13 results (GPS field test)

- Hidden page `/gps-test` (tap the build line on Home 5 times): `pages/GpsTest.tsx`, `hooks/useGpsTest.ts`, `hooks/useTapSequence.ts`, `domain/gpsCapture.ts`, `domain/gpsLog.ts`, `services/geolocation.ts`, `services/gpsTestStorage.ts`. No schema change, no new dependencies, in-round screens untouched.
- Findings recorded as D32 amendment and D39-D43: single `getCurrentPosition` calls return stale or coarse positions; a bounded `watchPosition` window (<= 15 s, accept age <= 3 s and accuracy <= 20 m) gave a fresh precise fix in a median 0.6 s; high accuracy gives 3-4 m against 16-18 m; `visibilitychange` is the only reliable lifecycle signal; capture works offline.
- Caveats: one device, one session, test site with worse sky than the course. A known distance on the course is still to be checked.

## Phase 14 results (weather per round)

- New: `domain/weather.ts`, `services/weather.ts`, `services/weatherBackfill.ts`, `hooks/useWeather.ts`, `components/WeatherCard.tsx`.
- Dexie v2 adds the `weather` table (1:1 with rounds). Saving weather does not touch `Round.updatedAt`. Backup `schemaVersion` 2 (v1 files still accepted). Excel gets a `WEATHER` sheet only when at least one round has weather; ROUND and HOLES unchanged. `courses.json` gains optional `coordinates`.
- Weather shows in the round summary (with Open-Meteo attribution) and as one line per round in `/rounds`. Aggregate weather analytics stay in phase 19.
- It is fetched when Home or a summary is opened, once the round window is over; failures are silent and never block anything. No new dependencies; in-round screens untouched.
- 324 Vitest tests passing. `tsc -b` and `npm run lint` clean.
- Choice made while testing: the "newer schema version" backup test now uses 3, since 2 is the current version.
- Real-device checks (tick when done):
  - [x] Online: weather card appears in a finished round's summary, values plausible (surface pressure about 920-950 hPa at Retamares).
  - [x] CORS and fetch work from the installed PWA on the iPhone.
  - [x] Update with existing rounds: all rounds still there (v1 to v2 migration).
  - [x] Airplane mode: "Clima pendiente", app normal; fills later when online.
  - [x] Backup JSON has `schemaVersion: 2` and `weather`; restoring a new and an old backup works.
  - [x] Excel has the `WEATHER` sheet; ROUND and HOLES unchanged.

  ## Phase 15 results (course geometry)

- Plan changed during the phase: instead of an in-app "mark point" tool, the user copies coordinates from Google Maps in satellite view at home (D51). Walking to a spot during a round is slow and disrupts play, and satellite gives a few meters of accuracy against 14-23 m from the phone.
- `CourseHole` gains optional `green` and `landmarks` (`Landmark`, `LandmarkKind`, `GeoPoint` in `domain/types.ts`). `validateCourses` checks ranges, `kind`, `label` and a distance sanity check against the course coordinates (`MAX_DISTANCE_FROM_COURSE_M` = 3000). Courses and holes without geometry stay valid.
- `courses.json`: all 18 greens of Retamares and their landmarks (doglegs of holes 1 and 7, bunkers, river of hole 6, lake of hole 10, testeros of holes 5 and 15).
- Tests in `tests/courseGeometry.test.ts`. No new dependencies, schema unchanged, in-round screens untouched.
- Choices: `green` is not a landmark kind (D50); `testero` is the user's own term for a balcony from which the green is played (D50); `distanceMeters` is imported from `domain/gpsLog.ts` (move it to its own file if the GPS test page is ever removed).
- Pending: front and back of the green, and near/far edges of the river and lake, to be measured later (likely D53). The distances to each point are not used until phase 18.

## Phase 16 results (shot data layer)

- New: `domain/clubs.ts` (catalog, `parseClubBag`), `domain/shots.ts` (`validateShot`, `reconcileHole`, `withShotDistances`, `APPROXIMATE_UNCERTAINTY_M`), `data/settingsRepository.ts`. Changed: `domain/types.ts` (`Shot`, `ShotFix`, `ShotInput`, `ClubBagSetting`, `RoundWithHoles.shots`), `data/db.ts` (Dexie v3: `shots`, `settings`), `data/roundRepository.ts` (`getHoleShots`, `getRoundShots`, `saveHoleShots`; list, delete and import handle shots), `services/backup.ts` (schemaVersion 3, optional `clubBag` and per-round `shots`), `services/excelExport.ts` (`SHOTS` sheet).
- Wiring (data only, no UI change): `useRounds` returns `clubBag` and passes `settingsRepository` to `restoreBackup`; `Rounds.tsx` passes the bag to `createBackupFile`; `useRoundSummary` returns `shots`; `RoundSummary.tsx` passes them to `createExcelFile`. Export-all already included shots through `listRoundsWithHoles`.
- 398 Vitest tests passing (35 files). `tsc -b` and `npm run lint` clean. New suites: `shots`, `clubBag`, `shotRepository` (includes the v2 to v3 migration), `backupShots`, `excelShots`. The "newer schema version" cases of `backup.test.ts` and `backupWeather.test.ts` now use 4, since 3 is the current version.
- No UI, no new dependencies, in-round screens untouched.
- Choices made: see D54-D58. In short: fixed catalog (the user's own 14 clubs, which is also the default bag), bag in `settings` (putter forced in), the shots of a hole are replaced as a whole (`sequence` comes from the array order), a putter shot is a marker without a stroke or a distance, uncertainty = sum of both accuracies (D40), approximate above 20 m or with a non-fresh fix, every recorded shot is exported (also on holes without score), `saveHoleShots` bumps `Round.updatedAt` (unlike the weather fill).
- Until phase 17 saves a bag, backups have no `clubBag`; until the first shot is recorded, there is no `SHOTS` sheet. Restoring a backup applies the file's bag only if the device has none; the restore message on `/rounds` does not mention it yet.
- Real-device checks (tick when done, after the deploy):
  - [ ] Update with existing rounds: all rounds still there (v2 to v3 migration).
  - [ ] Backup JSON has `schemaVersion: 3`; restoring a new and an old (v1/v2) backup works.
  - [ ] Excel of a round and "Exportar todo" have the same sheets as before (no `SHOTS` yet).
  - [ ] Airplane mode: `/rounds` and the summary open normally.


## Phase 17 results (shot capture UI)

- New: `domain/shotEditing.ts`, `domain/shotFormat.ts`, `domain/paths.ts`, `services/shotCapture.ts`, `hooks/useHoleShots.ts`, `hooks/useHoleClubs.ts`, `components/ClubGrid.tsx`, `ShotList.tsx`, `ShotsEntry.tsx`, `pages/ShotCapture.tsx` (route `/round/:roundId/hole/:holeNumber/shots`).
- Changed: `services/geolocation.ts` (best recent position, `reason`), `domain/resume.ts` (`findResumeTarget`, `resumePath`), `hooks/useActiveRound.ts`, `hooks/useNewRoundForm.ts`, `pages/Home.tsx`, `pages/HoleTracking.tsx` (suggested score, link to shots, "Save & next" opens the next hole's shots), `pages/Rounds.tsx` (`clubBagRestored` in the restore message), `App.tsx`, `index.css`.
- No schema change (v3), no new dependencies; `useHoleForm` untouched.
- Choices: see D59-D64. A header area on the shots screen is reserved for phase 18 (distance to the green and wind).
- Real-device checks (tick when done, after the deploy):
  - [ ] New round opens the shots screen of the first hole; a club tap adds the shot at once.
  - [ ] First GPS tap asks for permission once; with permission denied the clubs are still saved and the banner explains how to enable it.
  - [ ] Distances between shots look plausible on the course; short shots are flagged "aprox.".
  - [ ] Putter marks the position and goes to the hole screen; the score hint is correct.
  - [ ] "Save & next" opens the next hole's shots; the last hole opens the summary.
  - [ ] Lock the screen mid-capture: the club stays, the position is missing, nothing is lost.
  - [ ] Airplane mode: shots are recorded normally.
  - [ ] Backup and "Exportar todo" include the shots (`SHOTS` sheet).
## Planning results for the V0.1.x / V0.2 block (second phase 0)

- New decisions D23-D38 in `docs/decisions.md`; `PROMPT.md` (sections 1, 2, 3, 6-9, 12, 13, 16-20, 23, 25), `docs/roadmap.md` and `docs/architecture.md` updated.
- Order of work chosen by the user: export all first, then the dashboard, then GPS / weather / clubs.
- Slope/elevation discarded (D35). Distances in meters (D36).
- Open items: backup nudge values and storage location (D28), whether restore needs a "replace with confirmation" option (D29), OpenStreetMap research (D33), Open-Meteo terms check (D34).
- D28: resolved by D39.
## Environment

- OS: Windows (no Mac)
- Editor: VS Code
- Project folder: `C:\golf-tracker\golf-tracker`
- Repo: https://github.com/Neilburt5/golf-tracker
- Deployed URL: https://neilburt5.github.io/golf-tracker/

## Open problems

- (none)

## Known limitations

- (D13) Continue round opens the first unplayed hole even after editing an earlier one.
- (D19) Restoring an in-progress round can change which round "Continue round" opens.
- (D29) Restore never overwrites: edits to an existing round do not reach another device's copy.
- `crypto.randomUUID()` needs a secure context (only matters when testing over a LAN IP); optional fallback not implemented.
- (D39) The last backup date lives in localStorage of this device: after a reinstall or on another device it is empty and the nudge shows again. If localStorage is blocked, the date is not recorded.
- (D57) A shot played after a penalty drop makes the previous shot's distance meaningless; there is no flag for it yet.

## Next conversation template

> We are in phase 17 (shot capture UI). Phases 0-16 are done and deployed/committed. The V0.4 plan is in PROMPT.md (sections 9, 13, 16, 18, 20), docs/roadmap.md and decisions D32 (with its amendment), D36, D37, D39-D43 and D54-D58. I attach contexto-fase17.txt with PROMPT.md, STATUS.md, decisions.md, architecture.md, database.md, roadmap.md, package.json, the data layer (db, roundRepository, settingsRepository), the domain (types, clubs, shots, gpsCapture, gpsLog, validation, calculations), the geolocation service (`startShortCapture`), the hole tracking screen with its hook and components, the GPS test page as the pattern for using the capture window, and index.css.
>
> Goal: shot capture on the hole screen. Optional, never blocking; `score` stays the source of truth (D37).
> - Club buttons from the club bag. One tap = one shot: store the club and a position from the bounded capture window (`startShortCapture`), with `fresh` true/false per D39. Works without GPS permission and offline (shot saved with `fix: null`).
> - Choosing the putter saves a position marker (D56) and hands over to the existing hole screen; putts stay with the stepper.
> - List of the hole's shots with edit and delete (`saveHoleShots` replaces the whole list of the hole). Show the reconciliation with `score` (`reconcileHole`) and the distances with ± uncertainty, flagging approximate ones (`withShotDistances`). A mismatch never blocks "Save & next".
> - The user's club set is exactly the full catalog, which is also the default bag. Decide in the plan whether a bag configuration screen is needed now or can wait; `saveClubBag` already exists.
> - Show in the restore message of `/rounds` when the club bag was restored (`clubBagRestored`).
> - Before coding: explain the plan, the files, the flow of the hole screen (one hand, under 10 s per shot), the states (capturing, no permission, offline, capture failed) and how capture runs without blocking autosave. Ask me anything blocking.
> - Out of scope: live distances to the green and wind (phase 18), analytics (phase 19). The schema is v3: no schema change unless justified (never edit an existing version).
> - Known limitation: a penalty drop makes the previous shot's distance meaningless (no flag yet).
> - Pending from phase 15 (optional): front and back of the green, and near/far edges of water (likely D53).
>
> UI language is Spanish; code, comments and commits in English. Follow section 23 of the prompt and finish with the STATUS.md block and the commit commands.