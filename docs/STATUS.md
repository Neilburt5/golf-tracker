# Project Status

_Paste this file at the start of every new conversation, together with the files relevant to the current phase._

## Current version
V0.1 (in progress)

## Current phase
**Phase 4 — UI skeleton: Home and New Round** (next up)

## Phases

- [x] 0. Planning
- [x] 1. Environment, repo and deployment
- [x] 2. Domain and tests
- [x] 3. Data layer
- [x] 4. UI skeleton (Home, New round)
- [ ] 5. Hole tracking screen
- [ ] 6. Summary and finish round
- [ ] 7. Excel export and JSON backup
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
  - `saveHole` overwrites an existing hole and bumps `Round.updatedAt`. It does NOT validate; the hook decides the validation mode (phase 5).
  - `createRound` rejects an unknown tee and a hole range that doesn't fit the course (e.g. back nine on a 9-hole course), writing nothing.
  - `courses.json` is validated at load (`validateCourses`): unique ids, 9/18 holes, consecutive hole numbers, par 3-6, at least one tee.
  - `finishRound` is idempotent and allows unplayed holes. **Decision:** the summary screen WARNS about holes without score (e.g. "3 holes without score") but does not block finishing.
  - `getInProgressRound` returns the most recently updated in-progress round.
- Pending for later phases:
  - Phase 4: block "back nine" for 9-hole courses in the New Round UI (the repository also rejects it).
  - Phase 5: set `fairway` to `null` on par 3 in the hole screen/hook; choose validation mode on autosave vs "Save & next".
  - Phase 6: unplayed-holes warning before finishing.
  - Phase 7: `listRounds` and JSON backup/restore (not implemented yet); `deleteRound` only with a confirmation flow, when needed.
  - `navigator.storage.persist()` request: verify it exists in `main.tsx`; add it if not.
  - `crypto.randomUUID()` needs a secure context (HTTPS or localhost). Over a LAN IP on the iPhone, creating a round will fail; test saving on the deployed site, or add a UUID fallback.

## Phase 4 results (UI skeleton)

- Added dependency: `react-router-dom` (HashRouter). Routes: `/`, `/new`, `/round/:roundId/hole/:holeNumber` (placeholder).
- Home: "Continuar ronda" (if in progress) + "Nueva ronda"; keeps online status and build time from phase 1.
- New Round: course, tee, range (full / front / back); warns if a round is already in progress; the old round is NOT deleted.
- Added `domain/resume.ts` + 5 tests.
- Pending: phase 5 hole screen (fairway null on par 3, validation mode); `listRounds` / delete flow for orphaned in-progress rounds (phase 7 or V0.2); the summary route does not exist yet.

## Environment

- OS: Windows (no Mac)
- Editor: VS Code
- Project folder: `C:\golf-tracker\golf-tracker`
- Repo: `golf-tracker` (GitHub) — "https://neilburt5.github.io/golf-tracker/"
- Deployed URL: "https://github.com/Neilburt5/golf-tracker/settings/pages"

## Open problems

- (none)

## Next conversation template

> We are in phase 4 (UI skeleton: Home and New Round). Phase 3 is done. I attach PROMPT.md and STATUS.md. Goal: implement the Home and New Round screens with HashRouter routes, using the existing `roundRepository` and `courseRepository`. Follow section 23 of the prompt. Spanish UI.