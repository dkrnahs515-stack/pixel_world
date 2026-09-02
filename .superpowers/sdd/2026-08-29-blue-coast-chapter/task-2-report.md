# Task 2: Save Version 6 and Legacy Migration

## Files changed

- `src/quest-state.js`
  - Adds a serializable initial `worldProgress` and clones normalized world progress through quest transitions.
- `src/progress-storage.js`
  - Writes v6 saves, exports the v5 key, loads v6 then v5 through v1 in order, and normalizes chapter state during every serialization/migration path.
- `tests/quest-state.test.mjs`
  - Covers initial world progress and reference-independent quest transitions.
- `tests/progress-storage.test.mjs`
  - Covers v6 keys, v5 write-forward migration, preserved legacy fields/receipts/equipment, normalized invalid and duplicate chapter values, and corrupt chapter recovery.
- `tests/game-qa.test.mjs`
  - Direct compatibility update only: its two persisted-save assertions now expect the required v6 format.

## RED / GREEN evidence

1. `node --test tests/quest-state.test.mjs`
   - RED: new world-progress test failed because `initial.worldProgress` was `undefined`.
   - GREEN: 8/8 passed after adding the initial value and cloned normalized state.
2. `node --test tests/progress-storage.test.mjs`
   - RED: v6 tests failed on the old v5 primary key, missing `v5ProgressStorageKey`, missing serialized `worldProgress`, and full-progress fallback on corrupt chapter data.
   - GREEN: focused quest/storage suite passed 28/28 after the v6 reader/writer and migration path were added.

## Verification

- Focused quest/storage: `node --test tests/quest-state.test.mjs tests/progress-storage.test.mjs` — 28 passed, 0 failed.
- Equipment/progression compatibility: matching equipment/progression MJS files — 31 passed, 0 failed.
- Full MJS suite: `node --test tests/*.test.mjs` — 459 passed, 0 failed.
- Syntax: `for file in src/*.js; do node --check "$file" || exit 1; done` — passed.
- `git diff --check` — passed.

## Self-review

- Primary persistence key is now `pixel-world.progress.v6:<encoded nickname>` and `v5ProgressStorageKey` remains exported as a read-only migration source.
- Migration checks v6, v5, v4, v3, v2, then v1; migrated data writes forward only to v6 and never removes the prior save.
- Chapter values are normalized independently of valid base progress, inventory, boss receipts, and per-class equipment, so a corrupt chapter does not reset them.
- No production files outside the Task 2 scope changed.

## Concerns

- `tests/game-qa.test.mjs` is the only compatibility test changed outside the requested Task 2 files. It was necessary because the full MJS suite correctly asserted the persisted format version and still expected v5. No production compatibility changes were needed.
