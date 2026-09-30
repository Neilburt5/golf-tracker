# Project Status

_Paste this file at the start of every new conversation, together with the files relevant to the current phase._

## Current version
V0.1 (in progress)

## Current phase
**Phase 1 — Environment, repo and deployment** (next up)

## Phases

- [x] 0. Planning
- [ ] 1. Environment, repo and deployment
- [ ] 2. Domain and tests
- [ ] 3. Data layer
- [ ] 4. UI skeleton (Home, New round)
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

## Environment

- OS: Windows/Linux (no Mac)
- Editor: VS Code
- Repo: `golf-tracker` (GitHub) — _not created yet_
- Deployed URL: _not deployed yet_

## Open problems

- (none)

## Next conversation template

> We are in phase 1 (environment, repo and deployment). Phase 0 is done. I attach PROMPT.md and STATUS.md. Goal: get an empty PWA published on GitHub Pages and installed on my iPhone, opening offline. Follow section 23 of the prompt.
