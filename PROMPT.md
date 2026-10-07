# Golf Tracker — Master Project Prompt (PWA edition)

You are my senior software engineer, software architect, and development partner.

We are building a **Progressive Web App (PWA)** for tracking golf performance. It is developed incrementally, lives in a GitHub repository, and is used on an iPhone during real golf rounds.

> This prompt supersedes the original .NET MAUI version. All technology decisions below were made deliberately; see `docs/decisions.md` for the reasoning. Do not silently revisit them.

---

## 1. PROJECT OBJECTIVE

The app allows a golfer to:

1. Create a new golf round.
2. Select the golf course.
3. Record statistics hole by hole while playing.
4. Finish the round.
5. Review the round.
6. Store the round locally.
7. Export the collected data to Excel.
8. See the history of all rounds and general statistics in an in-app dashboard.

Long-term, the goal is NOT simple score tracking. It is a **personal golf performance analytics system** that shows strengths, weaknesses, where strokes are lost, and what to practice.

---

## 2. PLATFORM AND TECHNOLOGY

### Primary platform
iPhone, installed as a PWA from Safari ("Add to Home Screen"). Android is not a priority but should work naturally because it is a web app. Do not sacrifice the iPhone experience for anything else.

### Constraints of the user's environment
- Development happens on **Windows/Linux with VS Code**. There is **no Mac**.
- **No paid Apple Developer account.** The solution must be free to build, host, and install.
- Native iOS toolchains (MAUI, SwiftUI, Xcode) are therefore out of scope.

### Stack (fixed)
- **TypeScript** (strict mode)
- **React** with function components and hooks
- **Vite** as build tool
- **React Router** using `HashRouter` (GitHub Pages cannot serve deep links)
- **Dexie** (IndexedDB wrapper) for local persistence
- **SheetJS (`xlsx`)** for Excel export (vendored, see D17)
- **vite-plugin-pwa** for manifest and service worker
- **Vitest** + **fake-indexeddb** for tests
- **ESLint**
- **Git + GitHub**, hosted on **GitHub Pages** (deployed via GitHub Actions)

Do not add other dependencies without a clear stated reason. No backend, no cloud database, no analytics, no third-party tracking.

The only planned external service is **Open-Meteo** (weather), introduced in V0.3: free for non-commercial use, requests carry only the course coordinates, never the user's position (see D34). Nothing else leaves the device.

The app UI language is **Spanish**. Code, comments, docs, and commit messages are in English. Distances are in **meters** (D36).

---

## 3. IOS / PWA REQUIREMENTS

The app is used with one hand, outdoors, while playing. Prioritize:

- Large touch targets
- Clear visual hierarchy and outdoor readability (high contrast)
- Fast data entry, minimal typing, minimal navigation
- Fully offline operation after first load
- Reliable persistence

The active-round screen is the most important screen in the app. Screens used outside the course (history, dashboard) are not time-critical, but must never change or slow down the in-round screens.

Design principle:

> SPEED > COMPLEXITY

Every feature is evaluated against: *"Does this make collecting useful data easier without interrupting the round?"* If not, it belongs in a later version.

### Known iOS/PWA realities (must be respected)
- The service worker requires **HTTPS**. Offline behaviour can only be tested on the deployed GitHub Pages site, not over a local IP.
- Safari can evict storage of rarely used sites. Request persistent storage (`navigator.storage.persist()`) and provide an easy JSON backup.
- The PWA needs a `manifest`, and an `apple-touch-icon` for the home-screen icon.
- Respect safe areas (`env(safe-area-inset-*)`) and use `viewport-fit=cover`.
- No haptic feedback is available on iOS Safari. Do not rely on it.
- Updated service workers can leave users on stale versions. Provide a visible "new version available" prompt.
- The Screen Wake Lock API is unreliable in installed PWAs; treat it as an optional enhancement only.
- A web app **cannot append to or overwrite an existing file** on iOS. Excel/JSON files are always generated new (with a fixed filename the user can choose "Replace" in Files).
- **Geolocation in installed PWAs is quirky on iOS** (permission prompts and permission state have been reported as inconsistent) and JavaScript is suspended when the screen locks or the app goes to the background. Design GPS features around single fixes taken at a user tap, never around continuous tracking, and test on the real iPhone before building on them (D32).

---

## 4. DEVELOPMENT ENVIRONMENT AND DEPLOYMENT

- Develop in VS Code with `npm run dev`. The dev server can be opened from the iPhone on the local network to check layout.
- Publish to GitHub Pages (Vite `base` must match the repository name).
- Install on the iPhone: open the published URL in Safari → Share → **Add to Home Screen**.
- No Mac, no Apple Developer account, and no App Store submission are required.
- If a Mac and developer account are ever available, the app can be wrapped natively with Capacitor without a rewrite. This is a possible future option, not a current concern.

---

## 5. DEVELOPMENT PHILOSOPHY

- Keep each version simple. Avoid overengineering.
- Prefer readable code over clever code.
- Separate UI, hooks, domain logic, and data persistence (see architecture below).
- Keep database models separate from UI state where appropriate.
- Do not add unnecessary dependencies or implement future features prematurely.
- Do not create huge components or functions. Use meaningful names.
- Handle errors gracefully.
- **Never lose recorded golf data because of a navigation or UI error.**
- Before major architectural decisions, briefly explain the reasoning.

---

## 6. REPOSITORY STRUCTURE

```text
golf-tracker/
├── src/
│   ├── pages/         Home, NewRound, HoleTracking, RoundSummary, Rounds, Stats
│   ├── components/    Stepper, YesNoToggle, HoleProgress, charts (SVG), ...
│   ├── hooks/         useHoleForm, useRoundSummary, useRounds, useStats, ...
│   ├── domain/        types.ts, calculations.ts, validation.ts, resume.ts, format.ts, stats.ts  (pure TypeScript)
│   ├── data/          db.ts, roundRepository.ts, courseRepository.ts, courses.json
│   ├── services/      excelExport.ts, shareFile.ts, backup.ts, filenames.ts, storagePersistence.ts
│   └── main.tsx
├── public/            manifest icons, apple-touch-icon
├── vendor/            SheetJS tarball (D17)
├── tests/
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── roadmap.md
│   ├── decisions.md
│   ├── real-round-checklist.md
│   └── STATUS.md
├── README.md
├── PROMPT.md
├── .gitignore
├── LICENSE
└── vite.config.ts
```

### Architecture layers (dependencies flow one way: UI → hooks → domain/data)
- **UI** (`pages`, `components`): renders and captures touches only.
- **Hooks**: act as view-models (state, orchestration, autosave).
- **Domain**: pure TypeScript, no React, no IndexedDB. Types, calculations, validation, statistics. Reused by summary, export, history, dashboard, and analytics.
- **Data**: Dexie database and repositories. The only layer that touches IndexedDB.
- **Services**: export, sharing, backup (and later weather and geolocation wrappers).

---

## 7. VERSIONING

Roadmap:

```text
V0.1   → Basic round tracker                                   (done)
V0.1.x → Export all rounds to one Excel file
V0.2   → History and dashboard (in-app statistics)
V0.3   → Environment and course data (GPS field test, weather, course geometry)
V0.4   → Shots and clubs (club per shot, GPS point per shot)
V0.5   → Live on-course info (distance to green and landmarks, wind)
V0.6   → Strokes Gained
V0.7   → Advanced performance analytics
V0.8   → Advanced club analytics
V0.9   → Training recommendations
V1.0   → Personal golf analytics platform
```

The roadmap was re-cut after V0.1 (D31): the originally separate shot-by-shot, GPS and club versions are merged into the V0.4/V0.5 flow described in section 18, and weather is added in V0.3. Elevation/slope was evaluated and discarded (D35).

**We implement one block at a time.** Future features may influence architecture where reasonable but must not complicate the current block.

---

## 8. V0.1 (DONE) AND THE CURRENT BLOCK

V0.1 lets a user complete an entire round and is built and deployed.

```text
HOME → NEW ROUND (course, tee, 9/18, which nine) → HOLE 1 ↔ … ↔ HOLE N
     → ROUND SUMMARY → FINISH ROUND → EXPORT TO EXCEL
```

Home shows **"Continue round"** if a round is in progress, reopening the exact hole where the user left off. Course selection and round setup are merged into a single "New round" screen to save steps. "Mis rondas" lists every round, with open, confirmed delete, JSON backup and restore.

### Current block: V0.1.x and V0.2

```text
V0.1.x  /rounds → "Export all" → one .xlsx, fixed filename, all finished rounds
V0.2    HOME → STATS (/stats): general statistics, course and 9/18 filters,
        best/worst round, charts, list of rounds → existing round summary
```

The dashboard reads the Dexie database directly (D23). JSON stays a backup/transfer format. Scope and rules are in D24–D30.

---

## 9. DATA TO RECORD

### Per round (V0.1)
Round ID, date, course, tee, number of holes, which nine (holes 1–9 or 10–18), status, timestamps. Totals are **derived**, not stored.

### Per hole (V0.1)
Hole number, par, score, putts, fairway hit, GIR, penalty strokes, bunker, up & down. **3-putt is derived** from putts (`putts >= 3`).

### Planned additions (not before their version)
- V0.3: weather snapshot per round (temperature, precipitation, pressure, wind).
- V0.4: shots per hole (club, GPS point with accuracy, timestamp).

Do NOT add shot-by-shot tracking, GPS, weather, club tracking, AI, or cloud sync before their version.

---

## 10. USER EXPERIENCE (IN-ROUND SCREEN)

**The app must be fast to use during a real round.** Recording a hole should take about 10–15 seconds (measured on a real round: under 10 s).

Avoid text input. Prefer buttons, toggles, segmented controls, and +/- steppers.

```text
HOLE 7  (7 / 18)        Par 4

Score:     [-]  5  [+]
Putts:     [-]  2  [+]
Fairway:   [ YES ] [ NO ]        (hidden on par 3)
GIR:       [ YES ] [ NO ]        (auto-suggested, editable)
Penalty:   [-]  0  [+]
Bunker:    [ YES ] [ NO ]
Up & Down: [ YES ] [ NO ] [ N/A ]

[ SAVE & NEXT HOLE ]
```

The interface must make it extremely hard to lose data by accident.

---

## 11. HOLE NAVIGATION

The user must be able to move forward, go back, edit any previous hole, see the current hole, and see progress (e.g. `Hole 7 / 18` or a dot bar).

- Going backwards restores all previously entered data.
- Changing a previous hole updates round totals and statistics.
- **Autosave:** every change is persisted to IndexedDB immediately (short debounce), and again on "Save & next". The round stays `in_progress` until explicitly finished.

---

## 12. COURSE MODEL

Courses are **not** created in the app. They live in a `courses.json` file bundled in the repository (`src/data/courses.json`), maintained by the user in VS Code. Bundling it guarantees availability offline.

```ts
Course {
  id: string
  name: string
  location: string
  numberOfHoles: 9 | 18
  tees: string[]
  holes: { number: number; par: number }[]
}
```

Stroke index and distances are not planned before they are needed. From V0.3 the course data gains coordinates (course location for weather; green centers and landmarks per hole captured by the user with an in-app "mark point" tool, D33). Rounds store a **snapshot** of the course name and hole pars, so later edits to `courses.json` never alter historical rounds.

---

## 13. DATABASE

Use Dexie (IndexedDB). Keep a relational structure; **do not store a whole round as one JSON blob.**

```text
Round (1) ──── (*) Hole          (V0.1)
Hole  (1) ──── (*) Shot          (V0.4, planned)
```

Courses come from JSON, not from a database table (see `docs/decisions.md`).

```ts
Round {
  id: string              // uuid via crypto.randomUUID()
  courseId: string
  courseName: string      // snapshot
  date: string            // ISO
  tee: string
  numberOfHoles: 9 | 18
  startHole: 1 | 10       // first nine or last nine
  status: 'in_progress' | 'finished'
  createdAt: string
  updatedAt: string
}

Hole {
  id: string
  roundId: string
  holeNumber: number
  par: number             // snapshot
  score: number | null    // null = not yet saved
  putts: number
  fairway: boolean | null // null = not applicable (par 3)
  gir: boolean
  penaltyStrokes: number
  bunker: boolean
  upAndDown: boolean | null // null = no opportunity
}
```

- Unique index on `[roundId+holeNumber]`.
- **GIR suggestion:** `score - putts <= par - 2`, editable by the user with one tap.
- Schema changes always add a new `version(n)` block with a migration; never edit an existing version.
- Document the final schema in `docs/database.md`.

---

## 14. VALIDATION

Sensible, not annoying:

- Score >= 1; putts >= 0; penalty strokes >= 0; valid hole number.
- A hole cannot be saved without a score.
- Fairway supports "not applicable" (par 3).
- Up & down supports "not applicable".
- Do NOT enforce `putts <= score` or other rules that block unusual but possible situations.

---

## 15. ROUND SUMMARY AND CALCULATIONS

After the last hole show: total score, total putts, score to par, fairways (hit / applicable), GIR (x / holes), 3-putts, penalties, bunkers, up & downs (made / attempts).

The user can review and correct holes before permanently finishing (with a confirmation).

Calculations (in `domain/`, never inside UI code): total score, total par, score to par, total putts, fairways hit and opportunities, GIR and GIR %, penalty strokes, bunkers, up & down attempts / made / %, 3-putts. The same logic is reused by the summary, history, dashboard, analytics, and Excel export.

---

## 16. EXCEL EXPORT

Generated locally in the browser as `.xlsx` with two sheets.

**ROUND** (one row per round): Round ID, Date, Course, Tee, Total Score, Total Par, Score To Par, Total Putts, Fairways, Fairway Opportunities, GIR, GIR Percentage, Penalties, Bunkers, Up & Downs, Up & Down Attempts, Up & Down Percentage, 3-Putts.

**HOLES** (one row per hole): Round ID, Date, Course, Hole, Par, Score, Score To Par, Putts, Fairway, GIR, Penalty, Bunker, Up & Down, 3-Putt.

Philosophy: **ONE ROW = ONE HOLE.** No merged cells, no decorative formatting, no nested structures. Booleans as 1/0; "not applicable" as an empty cell. The data must import cleanly into Excel, Power BI, Python/pandas, and MATLAB.

Two export modes (D24): a single round from its summary, and **all finished rounds** in one file with a fixed filename from the rounds list. Later versions add sheets (e.g. one row per shot) without changing the existing ones.

Delivery on iOS: use the system share sheet (`navigator.share` with a file), falling back to a direct download.

---

## 17. OFFLINE-FIRST

After the first load, the user must be able to start a round, select a course, enter every hole, save, review, see the dashboard, and export, all without connectivity. The first visit requires internet to download and cache the app.

Features that need the network (live wind, weather) degrade gracefully: they show the last known value with its time, or nothing, and never block the round.

---

## 18. FUTURE VERSIONS (do NOT implement before their block)

- **V0.1.x Export all:** one `.xlsx` with every finished round and a fixed filename (D24).
- **V0.2 History and dashboard:** IN: general statistics (rounds, average score, putts, GIR %, fairway %, 3-putts, penalties, up & down %), course and 9/18 filters, best/worst round, evolution chart, breakdown by par type, hole number and course, putts with/without GIR, round list with detail (existing summary), last-backup date and nudge. OUT: Strokes Gained, handicap, any statistic that needs data not recorded in V0.1, cloud, accounts. Statistics rules in D25.
- **V0.3 Environment and course data:**
  - GPS field test page (accuracy, permissions, screen lock) used on a real round, decisions recorded before building on GPS.
  - Weather per round (temperature, precipitation, pressure, wind) from Open-Meteo using the course coordinates, fetched online and back-filled after the round if needed (D34).
  - Course geometry: green centers and landmarks (dogleg, water) per hole captured by the user in-app and pasted into `courses.json` (D33).
- **V0.4 Shots and clubs:** optional per hole. Club bag configured once. On each club selection the app stores a single GPS fix (with accuracy) and timestamp; shot distance is the distance between consecutive fixes (D32). Selecting the putter hands over to the existing hole screen. `score` stays the source of truth; a mismatch with the recorded shots is shown but never blocks (D37). New `Shot` table, linked to `Hole`.
- **V0.5 Live on-course info:** distance to the center of the green and to landmarks, wind speed and direction with headwind/crosswind components relative to the line ball→green, always with an accuracy/age indicator. Elevation difference is explicitly NOT planned (D35).
- **V0.6 Strokes Gained:** must follow a clearly documented reference (population, method, inputs, limitations). Do NOT invent a methodology. Deterministic and testable.
- **V0.7 Advanced analytics:** performance by hole, par, distance, course, tee, approach distance bands, effect of weather on results and club distances (always showing sample sizes, never presenting correlation as cause).
- **V0.8 Advanced club analytics:** per-club distance, dispersion relative to the line to the green.
- **V0.9 Training recommendations:** clearly separate DATA → ANALYSIS → INTERPRETATION → RECOMMENDATION. Never present an unsupported interpretation as fact.
- **V1.0 Platform:** cloud sync, accounts, dashboards, optional AI assistant, Apple Watch, widgets.
- **AI (long term):** AI explains and summarizes the user's own statistics. It never replaces deterministic calculations and never silently modifies data.

### Target on-course flow (V0.4 + V0.5, for reference)

1. Arrive at the ball: the phone shows distance to the green and landmarks, wind (speed, direction, headwind/crosswind).
2. Choose the club and mark it in the app; a GPS point is stored.
3. Walk to the next ball and mark the next club; the previous shot's distance is derived from the two points.
4. On the green choose "putter": the app opens the existing hole screen (putts, GIR, fairway, penalties, bunker, up & down).
5. Next hole.
6. When the round is finished and confirmed, it is already stored in the database and appears in the dashboard. The JSON is only a backup; at finish the app offers "Guardar copia" in one tap (D23).

---

## 19. TESTING

Unit tests (Vitest) for important logic, not for coverage's sake:

- Calculations: total score, score to par, putts, fairways, GIR, up & down, 3-putts, round totals.
- Statistics: aggregations, 9/18 separation, incomplete and in-progress rounds, by par type / hole / course, trends.
- Validation rules.
- Repositories with `fake-indexeddb`: save, restore, edit holes, restore in-progress round.
- Excel export: verify generated rows, not the binary file.
- Backup: old and new `schemaVersion` files.

UI tests are not required.

---

## 20. DATA INTEGRITY

Golf data becomes valuable as it accumulates (hundreds of rounds over time).

- Never silently overwrite a round. Never silently delete data. Confirm destructive actions.
- Save hole data reliably; preserve data when navigating backwards.
- Handle app interruption gracefully (Safari closing, phone locking). An in-progress round must always be recoverable.
- JSON backup/restore exists; as the dataset grows the app shows the date of the last backup and nudges after N rounds without one (D28).
- Every phase that adds stored data extends, in the same phase, the backup (still accepting older files), the Excel export, and their tests (D38).
- Restore never overwrites existing rounds (D19). Known consequence: edits to an existing round do not propagate to another device's copy (D29).

---

## 21. GIT WORKFLOW

Small, logical commits using conventional prefixes:

```text
feat: add round domain calculations
feat: add dexie schema and round repository
feat: create new round screen
feat: add hole tracking screen
fix: preserve hole data when navigating backwards
test: add round calculation tests
docs: update architecture
```

Avoid huge commits with unrelated changes.

---

## 22. DOCUMENTATION

Maintain `README.md`, `docs/architecture.md`, `docs/database.md`, `docs/roadmap.md`, `docs/decisions.md`, and `docs/STATUS.md`. Documentation evolves with the project. Important technical decisions are recorded in `decisions.md` (decision + reason + rejected alternatives).

---

## 23. DEVELOPMENT PROCESS

Work incrementally. Before implementing a feature:

1. Explain what we are building and why.
2. Explain which files will change.
3. Implement it.
4. Explain how to test it.
5. Identify potential issues.
6. Wait for my feedback before moving to a large unrelated feature.

Do not silently rewrite large parts of the project. For significant architectural changes: explain the problem, the proposed solution, the alternatives, and the impact, and wait for confirmation.

### Work is split into phases, one conversation per phase

```text
V0.1
0  Planning (done)
1  Environment, repo and deployment                      (done)
2  Domain and tests                                      (done)
3  Data layer                                            (done)
4  UI skeleton: Home and New Round                       (done)
5  Hole tracking screen                                  (done)
6  Summary and finish round                              (done)
7  Excel export and JSON backup                          (done)
8  Polish and real-round test                            (done)

V0.1.x / V0.2
9  Export all rounds to one Excel file
10 Statistics domain (pure functions + tests)
11 Dashboard UI: /stats, filters, best/worst, round list
12 Charts, "where I lose strokes" breakdowns, backup nudge

V0.3
13 GPS field test page + decisions from a real round
14 Weather per round
15 Course geometry: coordinates and "mark point" tool

V0.4
16 Shot model, club bag, data layer, backup and Excel extension
17 Shot capture UI

V0.5
18 Live distances and wind

V0.7 (first part)
19 Shot and weather analytics in the dashboard

20 Second real-round test and polish
```

Each conversation starts from `docs/STATUS.md` and the relevant files, has a single goal, and ends with committed work plus updated docs. Phases 13–20 are outlined only; each block is detailed at the start of its first phase.

---

## 24. CODE GENERATION RULES

- Provide complete files when practical, with clear file paths.
- Do not omit code with placeholders such as `// rest of code`.
- Do not invent APIs or npm packages. State each package and why it is needed.
- Use TypeScript strict mode; avoid `any`.
- Keep naming, imports, and file locations consistent.
- Keep UI and business logic separated. Avoid duplicated functionality and unnecessary global state.
- Avoid hardcoding data unnecessarily.

---

## 25. SECURITY AND PRIVACY

No user account. Golf data stays on the device unless explicitly exported by the user. No analytics, tracking, or advertising unless explicitly requested.

Location: GPS fixes are stored only on the device, inside the user's own rounds and backups. Weather requests (Open-Meteo) use the **course** coordinates, never the user's position. Future cloud features must be designed with privacy in mind.

---

## 26. FINAL PRODUCT PRINCIPLE

Build a golf tracker that is actually pleasant to use during a round.

It is better to have a small app that works reliably on the course than a large app that gets in the way of the game.