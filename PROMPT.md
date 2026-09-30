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

Long-term, the goal is NOT simple score tracking. It is a **personal golf performance analytics system** that shows strengths, weaknesses, where strokes are lost, and what to practice.

---

## 2. PLATFORM AND TECHNOLOGY

### Primary platform
iPhone, installed as a PWA from Safari ("Add to Home Screen"). Android is not a priority but should work naturally because it is a web app. Do not sacrifice the iPhone experience for anything else.

### Constraints of the user's environment
- Development happens on **Windows/Linux with VS Code**. There is **no Mac**.
- **No paid Apple Developer account.** The solution must be free to build, host, and install.
- Native iOS toolchains (MAUI, SwiftUI, Xcode) are therefore out of scope.

### Stack (fixed for V0.1)
- **TypeScript** (strict mode)
- **React** with function components and hooks
- **Vite** as build tool
- **React Router** using `HashRouter` (GitHub Pages cannot serve deep links)
- **Dexie** (IndexedDB wrapper) for local persistence
- **SheetJS (`xlsx`)** for Excel export (verify the currently recommended install method before adding it; ExcelJS is the fallback)
- **vite-plugin-pwa** for manifest and service worker
- **Vitest** + **fake-indexeddb** for tests
- **ESLint**
- **Git + GitHub**, hosted on **GitHub Pages** (deployed via GitHub Actions)

Do not add other dependencies without a clear stated reason. No backend, no cloud database, no analytics, no third-party tracking in V0.1.

The app UI language is **Spanish**. Code, comments, docs, and commit messages are in English.

---

## 3. IOS / PWA REQUIREMENTS

The app is used with one hand, outdoors, while playing. Prioritize:

- Large touch targets
- Clear visual hierarchy and outdoor readability (high contrast)
- Fast data entry, minimal typing, minimal navigation
- Fully offline operation after first load
- Reliable persistence

The active-round screen is the most important screen in the app.

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

---

## 4. DEVELOPMENT ENVIRONMENT AND DEPLOYMENT

- Develop in VS Code with `npm run dev`. The dev server can be opened from the iPhone on the local network to check layout.
- Publish to GitHub Pages (Vite `base` must match the repository name).
- Install on the iPhone: open the published URL in Safari → Share → **Add to Home Screen**.
- No Mac, no Apple Developer account, and no App Store submission are required.
- If a Mac and developer account are ever available, the app can be wrapped natively with Capacitor without a rewrite. This is a possible future option, not a V0.1 concern.

---

## 5. DEVELOPMENT PHILOSOPHY

- Keep V0.1 simple. Avoid overengineering.
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
│   ├── pages/         Home, NewRound, HoleTracking, RoundSummary
│   ├── components/    Stepper, YesNoToggle, HoleProgress, ...
│   ├── hooks/         useActiveRound, useHoleForm, ...
│   ├── domain/        types.ts, calculations.ts, validation.ts  (pure TypeScript)
│   ├── data/          db.ts, roundRepository.ts, courseRepository.ts, courses.json
│   ├── services/      excelExport.ts, shareFile.ts, backup.ts
│   └── main.tsx
├── public/            manifest icons, apple-touch-icon
├── tests/
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── roadmap.md
│   ├── decisions.md
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
- **Domain**: pure TypeScript, no React, no IndexedDB. Types, calculations, validation. Reused by summary, export, history, and analytics.
- **Data**: Dexie database and repositories. The only layer that touches IndexedDB.

---

## 7. VERSIONING

Roadmap:

```text
V0.1 → Basic round tracker
V0.2 → History and basic analytics
V0.3 → Better course support
V0.4 → Shot-by-shot tracking
V0.5 → GPS
V0.6 → Strokes Gained
V0.7 → Advanced performance analytics
V0.8 → Club tracking
V0.9 → Training recommendations
V1.0 → Personal golf analytics platform
```

**We are currently ONLY implementing V0.1.** Future features may influence architecture where reasonable but must not complicate V0.1.

---

## 8. V0.1 — MVP

V0.1 must allow a user to complete an entire round.

```text
HOME → NEW ROUND (course, tee, 9/18, which nine) → HOLE 1 ↔ … ↔ HOLE N
     → ROUND SUMMARY → FINISH ROUND → EXPORT TO EXCEL
```

Home shows **"Continue round"** if a round is in progress, reopening the exact hole where the user left off.

Course selection and round setup are merged into a single "New round" screen to save steps.

---

## 9. V0.1 DATA TO RECORD

### Per round
Round ID, date, course, tee, number of holes, which nine (holes 1–9 or 10–18), status, timestamps. Totals are **derived**, not stored.

### Per hole
Hole number, par, score, putts, fairway hit, GIR, penalty strokes, bunker, up & down. **3-putt is derived** from putts (`putts >= 3`).

Do NOT add shot-by-shot tracking, GPS, weather, club tracking, AI, or cloud sync in V0.1.

---

## 10. V0.1 USER EXPERIENCE

**The app must be fast to use during a real round.** Recording a hole should take about 10–15 seconds.

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

Stroke index and distances are deferred to V0.3. Rounds store a **snapshot** of the course name and hole pars, so later edits to `courses.json` never alter historical rounds.

---

## 13. DATABASE

Use Dexie (IndexedDB). Keep a relational structure; **do not store a whole round as one JSON blob.**

```text
Round (1) ──── (*) Hole
```

Courses come from JSON, not from a database table, in V0.1 (see `docs/decisions.md`).

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

Calculations (in `domain/`, never inside UI code): total score, total par, score to par, total putts, fairways hit and opportunities, GIR and GIR %, penalty strokes, bunkers, up & down attempts / made / %, 3-putts. The same logic is reused by the summary, history, analytics, and Excel export.

---

## 16. EXCEL EXPORT

Generated locally in the browser as `.xlsx` with two sheets.

**ROUND** (one row): Round ID, Date, Course, Tee, Total Score, Total Par, Score To Par, Total Putts, Fairways, Fairway Opportunities, GIR, GIR Percentage, Penalties, Bunkers, Up & Downs, Up & Down Attempts, Up & Down Percentage, 3-Putts.

**HOLES** (one row per hole): Round ID, Date, Course, Hole, Par, Score, Score To Par, Putts, Fairway, GIR, Penalty, Bunker, Up & Down, 3-Putt.

Philosophy: **ONE ROW = ONE HOLE.** No merged cells, no decorative formatting, no nested structures. Booleans as 1/0; "not applicable" as an empty cell. The data must import cleanly into Excel, Power BI, Python/pandas, and MATLAB.

Delivery on iOS: use the system share sheet (`navigator.share` with a file), falling back to a direct download.

---

## 17. OFFLINE-FIRST

After the first load, the user must be able to start a round, select a course, enter every hole, save, review, and export, all without connectivity. The first visit requires internet to download and cache the app.

---

## 18. FUTURE VERSIONS (do NOT implement yet)

- **V0.2 History & basic analytics:** round history, round detail, averages (score, putts, GIR, fairways, penalties, 3-putts), best/worst rounds, trends.
- **V0.3 Better course support:** stroke index, tee distances, multiple tees, handicap support. Research data sources first; do not assume a free API exists and do not scrape without checking terms.
- **V0.4 Shot-by-shot tracking:** OPTIONAL per shot (club, situation, result, distance). Must never slow down the basic hole tracker. Likely a separate `Shots` table linked to `Hole`.
- **V0.5 GPS:** requires research on data sources, licensing, offline maps, battery, permissions. Do not implement until a legal, reliable source is identified.
- **V0.6 Strokes Gained:** must follow a clearly documented reference (population, method, inputs, limitations). Do NOT invent a methodology. Deterministic and testable.
- **V0.7 Advanced analytics:** performance by hole, par, distance, course, tee, approach distance bands, etc.
- **V0.8 Club tracking:** optional shot data per club.
- **V0.9 Training recommendations:** clearly separate DATA → ANALYSIS → INTERPRETATION → RECOMMENDATION. Never present an unsupported interpretation as fact.
- **V1.0 Platform:** cloud sync, accounts, dashboards, optional AI assistant, Apple Watch, widgets.
- **AI (long term):** AI explains and summarizes the user's own statistics. It never replaces deterministic calculations and never silently modifies data.

---

## 19. TESTING

Unit tests (Vitest) for important logic, not for coverage's sake:

- Calculations: total score, score to par, putts, fairways, GIR, up & down, 3-putts, round totals.
- Validation rules.
- Repositories with `fake-indexeddb`: save, restore, edit holes, restore in-progress round.
- Excel export: verify generated rows, not the binary file.

UI tests are not required in V0.1.

---

## 20. DATA INTEGRITY

Golf data becomes valuable as it accumulates.

- Never silently overwrite a round. Never silently delete data. Confirm destructive actions.
- Save hole data reliably; preserve data when navigating backwards.
- Handle app interruption gracefully (Safari closing, phone locking). An in-progress round must always be recoverable.
- Provide a simple JSON backup/restore as early as practical.

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

Maintain `README.md`, `docs/architecture.md`, `docs/database.md`, `docs/roadmap.md`, `docs/decisions.md`, and `docs/STATUS.md`. Documentation evolves with the project. Important technical decisions are recorded in `decisions.md` (decision + reason).

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
0  Planning (done)
1  Environment, repo and deployment  → empty PWA installed on iPhone, opens offline
2  Domain and tests
3  Data layer
4  UI skeleton: Home and New Round
5  Hole tracking screen
6  Summary and finish round
7  Excel export and JSON backup
8  Polish and real-round test
```

Each conversation starts from `docs/STATUS.md` and the relevant files, has a single goal, and ends with committed work plus updated docs.

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

No user account in V0.1. Golf data stays on the device unless explicitly exported by the user. No analytics, tracking, or advertising unless explicitly requested. Future cloud features must be designed with privacy in mind.

---

## 26. FINAL PRODUCT PRINCIPLE

Build a golf tracker that is actually pleasant to use during a round.

It is better to have a small app that works reliably on the course than a large app that gets in the way of the game.
