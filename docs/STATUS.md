# Project Status

_Paste this file at the start of every new conversation, together with the files relevant to the current phase._

## Current version
V0.1 (in progress)

## Current phase
Phase 8 — Polish done; real-round test on the course pending

## Phases

- [x] 0. Planning
- [x] 1. Environment, repo and deployment
- [x] 2. Domain and tests
- [x] 3. Data layer
- [x] 4. UI skeleton (Home, New round)
- [x] 5. Hole tracking screen
- [x] 6. Summary and finish round
- [x] 7. Excel export and JSON backup
- [ ] 8. Polish and real-round test

## Key decisions (see docs/decisions.md)

- PWA on iPhone; no Mac, no Apple Developer account.
- TypeScript + React + Vite + Dexie + SheetJS + Vitest, hosted on GitHub Pages.
- Courses from bundled `src/data/courses.json`.
- Per hole: score, putts, fairway, penalties, bunker, up & down, GIR (3-putt derived).
- Rounds of 9 or 18 holes; 9-hole rounds start at hole 1 or 10.
- Totals derived from holes, never stored.

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

## Phase 8 results (polish)

- Theme colours aligned to the light theme; status bar style `default` (D22).
- `.muted` and similar text now use a solid colour (`--muted`); warning/ok text darkened.
- Chunk-size warning limit raised to 800 kB with a comment (D22).
- Added `docs/real-round-checklist.md`.
- Pending: real-round test on a course; fill in the findings.

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
- `crypto.randomUUID()` needs a secure context (only matters when testing over a LAN IP); optional fallback not implemented.

## Pending for phase 8

- Check the "new version available" prompt on the iPhone after the deploy.
- Real-round test on a course, following `docs/real-round-checklist.md`: speed of entry (target 10-15 s per hole), one-hand use, outdoor readability (including the new `--muted` colour and status bar).
- Turn the findings into V0.1.x fixes.

## Next conversation template

> We are in phase 8 (Polish and real-round test). Phase 7 is done and deployed. I attach the project files and the results of my iPhone tests (share sheet for Excel and backup, restore, offline, update prompt). Goal: fix what the iPhone tests revealed, then the polish items listed under "Pending for phase 8" in STATUS.md (manifest theme colours, `.muted` contrast, chunk-size warning), and prepare a checklist for the real-round test on the course. Follow section 23 of the prompt. Spanish UI.