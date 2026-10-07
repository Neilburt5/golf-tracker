# Roadmap

## Current version

**V0.1 — done and deployed.** Current block: **V0.1.x + V0.2** (export all, history and dashboard).

## Versions

| Version | Goal | Status |
|---|---|---|
| V0.1 | Basic round tracker: play a full round, review, save locally, export to Excel, JSON backup | Done |
| V0.1.x | Export all rounds to one Excel file | Next |
| V0.2 | History and dashboard (in-app statistics) | Planned |
| V0.3 | Environment and course data: GPS field test, weather per round, course geometry | Planned |
| V0.4 | Shots and clubs: club per shot, GPS point per shot | Planned |
| V0.5 | Live on-course info: distance to green and landmarks, wind | Planned |
| V0.6 | Strokes Gained (needs a documented reference methodology) | Planned |
| V0.7 | Advanced performance analytics (first part: shot and weather analytics in phase 19) | Planned |
| V0.8 | Advanced club analytics | Planned |
| V0.9 | Training recommendations | Planned |
| V1.0 | Personal golf analytics platform (sync, accounts, dashboards, optional AI) | Planned |

The roadmap was re-cut after V0.1 (D31). The originally separate shot-by-shot (V0.4), GPS (V0.5) and club tracking (V0.8) versions are merged into the V0.4/V0.5 on-course flow, weather is new, and elevation/slope was discarded (D35).

## Phases

| # | Phase | Deliverable | Status |
|---|---|---|---|
| 0 | Planning | PROMPT.md, architecture, roadmap, decisions, status | Done |
| 1 | Environment, repo, deployment | Empty PWA on GitHub Pages, installed on iPhone, opens offline | Done |
| 2 | Domain and tests | `types`, `calculations`, `validation`, passing Vitest suite | Done |
| 3 | Data layer | Dexie schema, repositories, `courses.json` loader, repository tests | Done |
| 4 | UI skeleton | Home and New round, routing, round creation | Done |
| 5 | Hole tracking | Fast hole screen, back/forward navigation, autosave, restore | Done |
| 6 | Summary and finish | Totals and stats, correct previous holes, finish with confirmation, continue round | Done |
| 7 | Excel and backup | `.xlsx` export, iOS share sheet, JSON backup/restore, rounds list | Done |
| 8 | Polish and real-round test | Theme/contrast polish, checklist, one real round on the course | Done |
| 9 | Export all rounds | One `.xlsx` with every finished round, fixed filename, button in `/rounds`, tests on the generated rows | Next |
| 10 | Statistics domain | `domain/stats.ts`: aggregates, 9/18 separation, incomplete/in-progress rules, by par type / hole / course, trend series; Vitest suite; no UI | Pending |
| 11 | Dashboard UI | `/stats` with general cards, course and 9/18 filters, best/worst round, round list opening the existing summary; "Estadísticas" button on Home | Pending |
| 12 | Charts and breakdowns | Plain-SVG charts (score-to-par evolution, par-type, hole-number, putts with/without GIR); last-backup date and nudge | Pending |
| 13 | GPS field test | Hidden test page logging fixes with accuracy; checks permission behaviour, screen lock, accuracy on the course; decisions recorded | Pending |
| 14 | Weather per round | Course coordinates, Open-Meteo fetch online and back-fill after the round; shown in summary, Excel, dashboard; schema migration | Pending |
| 15 | Course geometry | Green centers and landmarks per hole; in-app "mark point" tool that outputs coordinates for `courses.json` | Pending |
| 16 | Shot data layer | `Shot` table, club bag settings, validation and reconciliation with score, backup and Excel (SHOTS sheet) extension; tests, no UI | Pending |
| 17 | Shot capture UI | Choose club, store GPS point, putter hands over to the hole screen; edit/delete shots; works without GPS permission | Pending |
| 18 | Live distances and wind | Distance to green and landmarks, headwind/crosswind, accuracy and age indicators, offline fallback | Pending |
| 19 | Shot and weather analytics | Average distance per club, left/right relative to the line to the green, weather effects with visible sample sizes | Pending |
| 20 | Second real-round test and polish | Field checklist, findings turned into fixes | Pending |

Phases 13–20 are outlined; each block is detailed at the start of its first phase.

## Deferred or discarded

- Deferred: Strokes Gained (V0.6), handicap and stroke index, tee distances, training recommendations, cloud sync and accounts, native iOS packaging (needs a Mac and Apple Developer account).
- Discarded: elevation difference "from here to the hole" (phone GPS altitude is unreliable and Safari has no barometer; D35).
- Not possible on iOS web: appending rows to an existing Excel file (D24).

## Backlog from real use

Findings from real rounds go here.

- Phase 8 real round: under 10 s per hole, one-hand use fine, readable in sunlight, data survived screen lock and app switching, GIR suggestion accurate, no recording problems. Pain point that started V0.1.x/V0.2: one Excel file per round.