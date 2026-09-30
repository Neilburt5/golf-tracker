# Golf Tracker

Personal golf performance tracker, built as an offline-first PWA for iPhone.

- Live app: https://neilburt5.github.io/golf-tracker/
- Install: open the URL in Safari → Share → Add to Home Screen.

## Stack

TypeScript, React, Vite, vite-plugin-pwa. Planned: Dexie (IndexedDB), SheetJS, Vitest.

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # production build
npm run preview  # serve the build at http://localhost:4173/golf-tracker/
```

Every push to `main` is deployed to GitHub Pages by GitHub Actions.

## Documentation

- `PROMPT.md`: master project prompt
- `docs/STATUS.md`: current phase and progress
- `docs/decisions.md`: technical decisions
- `docs/architecture.md`: architecture
