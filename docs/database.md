# Database (Dexie / IndexedDB)

Database name: `golf-tracker`, schema version 1.

| Table  | Primary key | Indexes                         |
|--------|-------------|---------------------------------|
| rounds | `id`        | `status`, `date`, `updatedAt`   |
| holes  | `id`        | `roundId`, unique `[roundId+holeNumber]` |

- Round (1) → (*) Hole. Totals are never stored (D5).
- `courseName` and `par` are snapshots taken at round creation (D6).
- All hole rows are created when the round is created, with `score: null` meaning "not yet saved".
- Round + holes are created in a single transaction.
- Courses are not in the database; they come from `src/data/courses.json` (D4).
- Schema changes require a new `this.version(n).stores(...)` block, never an edit of version 1.