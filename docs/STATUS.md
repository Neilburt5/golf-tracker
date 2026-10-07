# Project Status

_Paste this file at the start of every new conversation, together with the files relevant to the current phase._

## Current version
V0.1 done and deployed. Current block: V0.1.x + V0.2 (export all, history and dashboard).

## Current phase
**Phase 10 — Statistics domain (pure functions + tests)** (next up)

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
- [ ] 11. Dashboard UI: `/stats`, filters, best/worst, round list
- [ ] 12. Charts, "where I lose strokes" breakdowns, backup nudge

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

## Planning results for the V0.1.x / V0.2 block (second phase 0)

- New decisions D23-D38 in `docs/decisions.md`; `PROMPT.md` (sections 1, 2, 3, 6-9, 12, 13, 16-20, 23, 25), `docs/roadmap.md` and `docs/architecture.md` updated.
- Order of work chosen by the user: export all first, then the dashboard, then GPS / weather / clubs.
- Slope/elevation discarded (D35). Distances in meters (D36).
- Open items: backup nudge values and storage location (D28), whether restore needs a "replace with confirmation" option (D29), OpenStreetMap research (D33), Open-Meteo terms check (D34).

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

## Next conversation template

> We are in phase 11 (Dashboard UI). Phases 0-10 are done and deployed/committed; the V0.2 planning is in PROMPT.md, docs/roadmap.md and decisions D23-D38. I attach one file with PROMPT.md, STATUS.md, decisions.md, architecture.md, database.md, roadmap.md, the domain files (`types.ts`, `calculations.ts`, `format.ts`, `stats.ts`), `roundRepository.ts`, `useRounds.ts`, `Rounds.tsx`, `Home.tsx`, `main.tsx`, `App.tsx` and `index.css`.
>
> Goal: build the first version of the dashboard at `/stats` (D27), reading Dexie through `listRoundsWithHoles` and computing everything with `calculateStats` from `domain/stats.ts` (D23). Scope for this phase:
> - `hooks/useStats.ts`: loads rounds, holds the filter state (course, 9/18; default 18 holes, all courses), exposes loading/error state and the `Stats` result. No business rules in the hook or the page.
> - Course options for the filter: add a small pure function in `domain/stats.ts` (distinct courses of finished rounds, name from the latest round, with round count) plus Vitest tests. This is the only domain change.
> - `pages/Stats.tsx`: filter controls (course select, 9/18 segmented control); general cards (finished rounds, average score, average score to par, average putts, GIR %, fairway %, up & down %, 3-putts per hole, penalties per hole) each showing its sample size (e.g. "GIR 41% · 108 hoyos"); best and worst round cards that open the existing `/round/:id/summary`; list of finished rounds for the current filter, newest first, each opening the same summary. When no 9/18 length is chosen, round-level cards show a clear hint instead of numbers (roundLevel is null). Empty states: no finished rounds, no rounds for the filter, fewer than 3 rounds ("pocas rondas: las cifras no son concluyentes").
> - "Estadísticas" button on Home and the `/stats` route; no existing route changes.
> - Responsive layout (phone and desktop), same light high-contrast theme and CSS variables as the rest of the app, large touch targets. The in-round screens must not be touched.
> - Out of scope for this phase: charts, breakdowns by par / hole / course, putts with/without GIR, backup nudge (all phase 12). No new dependencies, schema unchanged.
>
> UI language is Spanish; code, comments and commits in English. Follow section 23 of the prompt: explain what we build, which files change, implement with complete files, explain how to test (including checking it on the deployed iPhone site and on desktop), list potential issues, and wait for my feedback. At the end, give me the STATUS.md block for phase 11 and the commit commands.