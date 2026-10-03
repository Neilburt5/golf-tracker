# Database (Dexie / IndexedDB)

Database name: `golf-tracker`, schema version 1 (unchanged in phase 7).

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

## Repository operations (`roundRepository`)

| Operation | Notes |
|---|---|
| `createRound` | Round + all holes in one transaction. Rejects unknown tee or a hole range that does not fit the course. |
| `getRound`, `getHoles` | Holes ordered by hole number. |
| `getInProgressRound` | Most recently updated in-progress round. |
| `listRoundsWithHoles` | Every round with its holes, newest first (by date, then `updatedAt`). One read transaction. Used by the rounds list and the backup. |
| `saveHole` | Overwrites an existing hole, bumps `Round.updatedAt`. Does not validate. |
| `finishRound` | Idempotent. Allows unplayed holes (D16). |
| `deleteRound` | Deletes the round and its holes in one transaction. Idempotent. Always behind a UI confirmation (D20). |
| `importRound` | Insert only. Returns `'skipped'` if the round id already exists, never overwrites. Rolls back if the holes cannot be written. |

## Backup file format (JSON)

```json
{
  "app": "golf-tracker",
  "schemaVersion": 1,
  "exportedAt": "2026-04-01T12:00:00.000Z",
  "rounds": [{ "round": { }, "holes": [ ] }]
}
```

- `round` and `holes` use exactly the `Round` and `Hole` types of `domain/types.ts`.
- `schemaVersion` is the version of the backup format, independent from the Dexie schema version. A file with a newer `schemaVersion` than the app supports is rejected.
- Each round must contain exactly its own holes (`startHole` to `startHole + numberOfHoles - 1`, one each). Hole ids and round ids must be unique within the file.
- Restore rules: see D19.