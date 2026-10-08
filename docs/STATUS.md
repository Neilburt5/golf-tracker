# Project Status

_Paste this file at the start of every new conversation, together with the files relevant to the current phase._

## Current version
V0.1 and V0.2 done (export all, history and dashboard, charts, backup nudge). Next block: V0.3 (environment and course data).

## Current phase
**Phase 13 — GPS field test page + decisions from a real round** (next up)

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
- [ ] 13. GPS field test page + decisions from a real round
- [ ] 14. Weather per round
- [ ] 15. Course geometry: coordinates and "mark point" tool

V0.4
- [ ] 16. Shot model, club bag, data layer, backup and Excel extension
- [ ] 17. Shot capture UI

V0.5
- [ ] 18. Live distances and wind

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

## Next conversation template

> We are in phase 13 (GPS field test page). Phases 0-12 are done and deployed/committed; V0.2 is complete. The V0.3 plan is in PROMPT.md (sections 3, 7, 18, 25), docs/roadmap.md and decisions D31-D35. I attach PROMPT.md, STATUS.md, decisions.md, architecture.md, roadmap.md, `App.tsx`, `main.tsx`, `Home.tsx`, `index.css` and `BigButton.tsx`.
>
> Goal: a hidden test page (not linked from the main flow) to check on the real iPhone, installed as a PWA, how single GPS fixes behave (D32): permission prompt and permission state, accuracy in meters, time to get a fix, behaviour after the screen locks and after the app goes to the background, and behaviour in airplane mode. The page logs each fix (timestamp, latitude, longitude, accuracy) on screen and lets me copy the log. One fix per tap, never `watchPosition`.
> - Before coding: explain the plan, the files, and the checklist I should follow on the course.
> - Out of scope: storing fixes in the database, weather, course geometry, any change to the in-round screens. No new dependencies, schema unchanged.
> - Output of the phase: a written list of findings and decisions recorded in `docs/decisions.md` before building anything on GPS (phases 15-18 depend on them).
>
> UI language is Spanish; code, comments and commits in English. Follow section 23 of the prompt and finish with the STATUS.md block and the commit commands.