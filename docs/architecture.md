# Architecture

## Overview

Golf Tracker is an offline-first PWA built with TypeScript, React, and Vite. It runs on an iPhone installed from Safari, stores all data locally in IndexedDB (via Dexie), exports rounds to Excel on the device, and (from V0.2) shows history and statistics in an in-app dashboard.

## Layers

Dependencies flow in one direction only:

```text
UI (pages, components)
      ↓
Hooks (view-model logic, autosave)
      ↓
Domain (pure TS)     Data (Dexie + repositories)
```

| Layer | Folder | Responsibility | May import |
|---|---|---|---|
| UI | `src/pages`, `src/components` | Render and capture touches. No business rules. | hooks, domain types |
| Hooks | `src/hooks` | State, orchestration, autosave, navigation between holes, view-models for summary, rounds list and dashboard | domain, data |
| Domain | `src/domain` | Types, calculations, validation, statistics. No React, no IndexedDB. | nothing |
| Data | `src/data` | Dexie schema, repositories, bundled `courses.json` | domain types |
| Services | `src/services` | Excel export, file sharing, JSON backup, storage persistence (later: weather, geolocation wrappers) | domain, data |

The domain layer is the long-term asset: the round summary, Excel export, history, dashboard and analytics all reuse the same calculation functions.

## Folder structure

```text
├── components/    Stepper, YesNoToggle, HoleProgress, SVG charts, ClubGrid, ShotList, ShotsEntry, LiveInfoPanel, ...
├── hooks/         useHoleForm, useRoundSummary, useRounds, useStats, useBackupStatus, useWeather, useGpsTest, useTapSequence, useHoleShots, useHoleClubs, useNow, useLivePosition, useCurrentWind
├── domain/        types, calculations, validation, resume, format, stats, chartScale, lossRanking, backupNudge, weather, gpsCapture, gpsLog, clubs, shots, shotFormat, shotEditing, paths, geo, holeTargets, liveWind
├── data/          db.ts, roundRepository.ts, settingsRepository.ts, courseRepository.ts, courses.json
├── services/      excelExport, shareFile, backup, backupStatus, filenames, storagePersistence, weather, weatherBackfill, geolocation, shotCapture, captureCoordinator, currentWind, windCache, gpsTestStorage
```

## Navigation

`HashRouter` (GitHub Pages cannot serve deep links).

```text
/                  Home
/new               New round (course, tee, range)
/round/:id/hole/:n Hole tracking
/round/:id/summary Summary, finish, export (also the round detail from the dashboard)
/rounds            Rounds list: open, delete (confirmed), export all, backup, restore
/stats             Dashboard (V0.2)
```

```text
Home → New round → Hole 1 ↔ Hole 2 ↔ … ↔ Hole N → Summary → Finish → Export
                       ↑                    (Summary ↔ any hole to correct)
Home "Continue round" reopens the first unplayed hole of the in-progress round
Home → Mis rondas (/rounds) → open round summary / export all / backup / restore
Home → Estadísticas (/stats) → general stats, filters, charts → open round summary
```

No existing route changes when the dashboard is added (D27).

## Data flow and autosave

1. Every change on the hole screen updates local form state immediately.
2. After a short debounce, the change is written to IndexedDB through `roundRepository`.
3. "Save & next" forces an immediate write before navigating.
4. The round remains `in_progress` until the user confirms "Finish round".
5. On app start, Home queries for an `in_progress` round and offers "Continue round".

Totals are never stored. They are computed from the holes on demand, so editing a previous hole can never leave stale totals.

## Dashboard (V0.2)

```text
roundRepository.listRoundsWithHoles
          ↓
domain/stats.ts  (pure functions, built on domain/calculations.ts)
          ↓
hooks/useStats.ts  (loading, filters: course, 9/18)
          ↓
pages/Stats.tsx + SVG chart components
```

- The dashboard reads Dexie directly; the JSON file is only a backup (D23).
- `domain/stats.ts` applies the rules of D25: in-progress rounds excluded; round-level metrics from complete finished rounds with 9 and 18 holes kept apart; hole-level rates from all played holes of finished rounds; every figure carries its sample size.
- Aggregations: general averages and rates, best/worst round, score-to-par series over time, breakdown by par type, hole number and course, putts with and without GIR.
- Scale: hundreds of rounds are a few thousand hole rows, so loading everything in memory is fine. The schema stays at v1 and no new index is needed for V0.2.
- Charts are plain SVG components, no chart library (D30).
- Layout is responsive (phone and desktop). The in-round screens are not touched.
- Charts are plain SVG components (`ScoreToParChart`, `HorizontalBarChart`). The geometry (axes, points, bar spans) is in `domain/chartScale.ts`; the components only draw it.
- `/stats` is organised in native `<details>` blocks (`CollapsibleSection`): Resumen, Evolución, Dónde pierdo golpes (sub-blocks by par, hole number, putts with/without GIR, course) and Rondas finalizadas.
- Groups with fewer than 5 played holes are flagged "pocos hoyos" and never ranked (`domain/lossRanking.ts`).
- Backup nudge: `domain/backupNudge.ts` (pure) + `services/backupStatus.ts` (localStorage) + `hooks/useBackupStatus.ts`. It uses all rounds, ignoring the dashboard filter (D39).

## Shots and clubs (V0.4, data layer)

```text
Hole (1) → (*) Shot      linked by [roundId+holeNumber]
settings                 { key: 'clubBag', value: ClubCode[] }
```

- `domain/clubs.ts`: fixed catalog of the user's 14 clubs, `parseClubBag` (D54, D55).
- `domain/shots.ts` (pure): `validateShot`, `reconcileHole` (shots + putts + penalties against `score`, informational only) and `withShotDistances` (distance to the next fix of the same hole, uncertainty = sum of both accuracies, approximate above 20 m or with a non-fresh fix) (D57).
- `data/roundRepository.ts`: `saveHoleShots` replaces the shots of one hole in one transaction; list, delete and import handle shots with their round. `data/settingsRepository.ts`: the club bag (D56).
- Backup `schemaVersion` 3 and the Excel `SHOTS` sheet (D58). Shots stay on the device and in the user's own files; no network is involved.
- UI (phase 17): `pages/ShotCapture.tsx` + `hooks/useHoleShots.ts` (own write queue, bounded capture per club tap through `services/shotCapture.ts`), `ClubGrid`, `ShotList`; `ShotsEntry` + `useHoleClubs` on the hole screen. The route is `/round/:roundId/hole/:holeNumber/shots`; the round flow is New round → shots → hole → "Save & next" → next hole's shots (D62).

## Live info (V0.5, phase 18)

```text
courses.json (green, landmarks)     Open-Meteo `current` (course coordinates only)
          ↓                                   ↓
domain/holeTargets.ts               services/currentWind.ts → services/windCache.ts (localStorage)
          ↓                                   ↓
hooks/useLivePosition.ts            hooks/useCurrentWind.ts      hooks/useNow.ts (5 s clock)
          ↓                                   ↓
          components/LiveInfoPanel.tsx (top of the shots screen)
```

- Informational only: the panel never blocks a club tap and renders nothing when the hole has no geometry and no wind is known (D37).
- GPS arbitration lives in `services/captureCoordinator.ts` (D65): a club tap (`startShot`) cancels the live capture; a live capture (`startLive`) is refused while a shot capture runs. `useHoleShots` starts its captures through it; the panel only reads its state.
- Live capture triggers: screen open (permission already `granted`), page visible again, "Actualizar" (D66). No continuous tracking.
- Pure rules: `domain/geo.ts` (bearing), `domain/holeTargets.ts` (targets, distances, position age, `distanceToGreenAtShot` derived and never stored, D67), `domain/liveWind.ts` (cache validation, staleness, headwind/crosswind, text, D68).
- The wind cache is device metadata in localStorage: not in the backup, not in the Excel export. No schema change (v3).
- Shots list shows "Al green: N m ± X" per shot, derived from the shot fix and `courses.json`.

## Courses

Courses are read from `src/data/courses.json`, bundled into the app so they are always available offline. When a round is created, the course name and the par of each hole are copied into the round (snapshot), so later edits to the JSON never alter past rounds.

From V0.3 the course data gains coordinates: the course location (for weather) and, per hole, the green center and landmarks captured with the in-app "mark point" tool (D33).

## Planned evolution (V0.3–V0.5)

Outline only; each block is detailed at the start of its first phase.

GPS test page (phase 13) and weather (phase 14) are done; see D32 amendment, D39-D43 and D44-D48.
- **Shots (phase 16 done, UI in phase 17):** a `shots` table linked to `Hole` by `[roundId+holeNumber]` (club code, nullable GPS fix with accuracy, fix time and a `fresh` flag) and a `settings` table with the club bag. Shot distance is derived from consecutive fixes in `domain/shots.ts`. `Hole.score` remains the source of truth: `reconcileHole` only reports (D37, D56, D57). Shot capture is optional per hole and hands over to the existing hole screen at the putter.
- **Live info (phase 18, done):** see the section above and D65-D69.
- **Persistence:** each new table or field adds a new Dexie `version(n)` with migration. The backup `schemaVersion` is bumped and older files are still accepted. Export gains new sheets (e.g. one row per shot) without changing existing ones (D38).
- **Privacy:** GPS fixes stay on the device. Weather requests use the course coordinates, never the user's position (D34).
- **Not planned:** elevation/slope (D35).

## PWA

- `vite-plugin-pwa` generates the manifest and the service worker (precaching app shell and assets).
- The user is shown a prompt when a new version is available.
- The app requests persistent storage (`navigator.storage.persist()`), in `services/storagePersistence.ts` only.
- Layout respects iOS safe areas (`viewport-fit=cover`, `env(safe-area-inset-*)`).
- Theme colours are light and solid for outdoor readability (D22).

## Excel export

`services/excelExport.ts` builds a workbook with SheetJS: sheet `ROUND` (one row per round) and sheet `HOLES` (one row per played hole), plus `WEATHER` and `SHOTS` only when there is data for them (D45, D58); sheet order ROUND, HOLES, WEATHER, SHOTS. The row-building logic is pure and unit-tested; writing the file and sharing it (`navigator.share`, fallback to download) are thin wrappers. Two modes: one round from its summary, and all finished rounds in one file with a fixed filename from `/rounds` (D24).

## Testing

Vitest for domain calculations, statistics, validation, repositories (with `fake-indexeddb`), backup parsing (old and new `schemaVersion`), and export row generation. No UI tests.

## Known risks

1. iOS may evict IndexedDB for rarely used sites. Mitigation: installed PWA, persistent storage request, JSON backup, backup nudge (D28).
2. Service worker can serve stale versions. Mitigation: update prompt.
3. Offline behaviour can only be tested on the HTTPS deployment.
4. Screen may lock during a round. Wake Lock is optional and unreliable in installed PWAs.
5. Restore never overwrites, so edits to an existing round do not reach another device's copy (D29).
6. GPS permission behaviour in installed iOS PWAs is inconsistent and JavaScript stops when the screen locks; verified before use (D32).
7. GPS accuracy is several meters, so shot distances are approximate and always shown with their accuracy.
8. Wind from the weather service is a grid value at 10 m, not the wind at the ball.
9. Statistics from few rounds are not conclusive; sample sizes are always shown.
10. The last backup date lives in localStorage (D39): it is lost on reinstall and `shared` does not prove the file reached Files.
11. Weather from a grid cell, filled only when the app is opened; Open-Meteo availability is not guaranteed (D48)
12. Live distances depend on a fresh position; the panel always shows the age and accuracy and never presents a stale value as current (D66). A club tap cancels the live capture (D65).
13. The live wind is a 10 m grid value cached in localStorage, shown for at most 3 h with its time (D68).