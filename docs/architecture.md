# Architecture (V0.1)

## Overview

Golf Tracker is an offline-first PWA built with TypeScript, React, and Vite. It runs on an iPhone installed from Safari, stores all data locally in IndexedDB (via Dexie), and exports rounds to Excel on the device.

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
| Hooks | `src/hooks` | State, orchestration, autosave, navigation between holes | domain, data |
| Domain | `src/domain` | Types, calculations, validation. No React, no IndexedDB. | nothing |
| Data | `src/data` | Dexie schema, repositories, bundled `courses.json` | domain types |
| Services | `src/services` | Excel export, file sharing, JSON backup | domain, data |

The domain layer is the long-term asset: the round summary, Excel export, history (V0.2), and analytics all reuse the same calculation functions.

## Folder structure

```text
src/
├── pages/         Home, NewRound, HoleTracking, RoundSummary
├── components/    Stepper, YesNoToggle, HoleProgress, ...
├── hooks/         useActiveRound, useHoleForm, ...
├── domain/        types.ts, calculations.ts, validation.ts
├── data/          db.ts, roundRepository.ts, courseRepository.ts, courses.json
├── services/      excelExport.ts, shareFile.ts, backup.ts
└── main.tsx
```

## Navigation

`HashRouter` (GitHub Pages cannot serve deep links).

```text
/                  Home
/new               New round (course, tee, 9/18, which nine)
/round/:id/hole/:n Hole tracking
/round/:id/summary Summary, finish, export
```

```text
Home → New round → Hole 1 ↔ Hole 2 ↔ … ↔ Hole N → Summary → Finish → Export
                       ↑                    (Summary ↔ any hole to correct)
Home "Continue round" reopens the current hole of the in-progress round
```

## Data flow and autosave

1. Every change on the hole screen updates local form state immediately.
2. After a short debounce, the change is written to IndexedDB through `roundRepository`.
3. "Save & next" forces an immediate write before navigating.
4. The round remains `in_progress` until the user confirms "Finish round".
5. On app start, Home queries for an `in_progress` round and offers "Continue round".

Totals are never stored. They are computed from the holes on demand, so editing a previous hole can never leave stale totals.

## Courses

Courses are read from `src/data/courses.json`, bundled into the app so they are always available offline. When a round is created, the course name and the par of each hole are copied into the round (snapshot), so later edits to the JSON never alter past rounds.

## PWA

- `vite-plugin-pwa` generates the manifest and the service worker (precaching app shell and assets).
- The user is shown a prompt when a new version is available.
- The app requests persistent storage (`navigator.storage.persist()`).
- Layout respects iOS safe areas (`viewport-fit=cover`, `env(safe-area-inset-*)`).

## Excel export

`services/excelExport.ts` builds a workbook with SheetJS: sheet `ROUND` (one row) and sheet `HOLES` (one row per hole). The row-building logic is a pure function (unit-tested); writing the file and sharing it (`navigator.share`, fallback to download) are thin wrappers.

## Testing

Vitest for domain calculations, validation, repositories (with `fake-indexeddb`), and export row generation. No UI tests in V0.1.

## Known risks

1. iOS may evict IndexedDB for rarely used sites. Mitigation: installed PWA, persistent storage request, JSON backup.
2. Service worker can serve stale versions. Mitigation: update prompt.
3. Offline behaviour can only be tested on the HTTPS deployment.
4. Screen may lock during a round. Wake Lock is optional and unreliable in installed PWAs.
5. Future shot-by-shot tracking (V0.4) should be a separate `Shots` table linked to `Hole`, leaving the current model untouched.
