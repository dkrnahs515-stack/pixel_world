# Task 7 — Solo Regional Boss Controller

## RED

- Added data coverage requiring the coast boss to resolve only from
  `coast-tide-core-cave`, while forest and volcano retain their definitions.
- Added local-controller coverage for a no-boss map, one-player HP and local
  encounter IDs, definition-derived damage/range/cooldown, exactly one defeat
  reward, forwarded player-damage events, `clear()`, and a fresh controller
  encounter.
- Confirmed the initial failure with:

  ```sh
  node --test tests/coop-boss-data.test.mjs tests/local-boss-controller.test.mjs
  ```

  The coast lookup returned `null`, and Node reported the missing
  `src/local-boss-controller.js` module.

## GREEN

- Rebound the coast boss definition and co-op fixtures to
  `coast-tide-core-cave`; forest and volcano remain unchanged.
- Added `LocalBossController` with the common adapter methods:
  `setMap`, `update`, `targetableBoss`, `renderableBoss`, `requestHit`,
  `consumeEvents`, and `clear`.
- Local encounters use `createBossEncounter(..., { partySize: 1 })`, IDs of
  `local:<regionId>:<sequence>`, the normal enemy view/simulation, and no
  network dependency.
- Hits are checked by the existing `validateBossAttack` and applied by
  `applyBossAttack`; supplied damage is never read. This derives damage,
  cooldown, and range from the existing combat/weapon definitions.

## Verification

- Focused local/co-op/combat/projectile run: 69 passed, 0 failed.
- Full MJS run: `node --test tests/*.test.mjs` — 488 passed, 0 failed.
- Syntax: `node --check src/local-boss-controller.js`,
  `node --check src/coop-boss-data.js`, and
  `node --check tests/local-boss-controller.test.mjs` passed.
- Diff hygiene: `git diff --check` passed.

## Self-review

- A defeated encounter becomes untargetable and emits one
  `boss-defeated` event with the definition reward; further hit requests are
  rejected as unavailable.
- Enemy AI `damage-player` events are forwarded locally once per attack ID.
- `clear()` removes the snapshot, view, pending events, attack timing, and
  AI damage de-duplication state. A new controller recreates the boss at full
  one-player HP.

## Concern / intentional boundary

This task does not select the local controller in the game loop or apply its
events to player progression/UI. That integration is intentionally deferred to
the subsequent game integration task.

## Review fix round 1 — reachable coast arena

### RED

- Added a regression test covering every regional boss definition against its
  bound physical world. It creates the runtime boss view, uses the larger of
  the boss and player collision radii, checks map bounds, then checks actual
  world traversability.
- Confirmed the failure with `node --test tests/coop-boss-data.test.mjs`:
  `coast-tide-core-cave boss must fit horizontally`.

### GREEN

- Moved only the coast boss from `(2160, 2400)` to the traversable east-side
  Tide Core cave arena at `(1600, 1280)`. The position is outside the central
  core pool and cave walls, while forest and volcano coordinates are unchanged.
- Updated coast combat fixtures to use the moved encounter point; controller
  behavior is otherwise unchanged.

### Verification

- Focused boss/world/collision suites: 47 passed, 0 failed.
- Full MJS suite (single post-fix run): 489 passed, 0 failed.
