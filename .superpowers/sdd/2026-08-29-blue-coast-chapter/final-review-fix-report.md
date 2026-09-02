# Blue Coast final merge-review fix report

Date: 2026-09-02

Branch: `feature/blue-coast-chapter`

Implementation commit: `7e3b4d18aab6e82297518a4444aa907b57c38d16` (`fix: close blue coast merge review findings`)

## Scope and method

This wave addresses all four findings in `final-review-fix-brief.md`. Each behavior received a regression test before its production change, the test was run against the unfixed implementation to capture a meaningful RED failure, and focused plus full-suite verification was run after the minimal fixes. No push, PR, merge, deployment, emulator write, or subagent work was performed.

## Finding 1: transitive ES-module cache safety

### Root cause

Only `main-20260829-coast.js` and `game-20260829-coast.js` had release-specific physical URLs. The versioned game file still imported branch-modified modules such as `portal-transition.js`, `progress-storage.js`, and `world-data.js` through their pre-release URLs. Nested importers also retained old URLs. A browser could therefore combine the fresh entry files with stale transitive modules and either fail startup (for example, an old portal module without `canUsePortal`) or silently run old save/world behavior.

A graph inspection found 55 runtime modules reachable from the coast entry. Twenty-three were already changed by the branch, including the two versioned entry files. Six otherwise unchanged modules were cache-dependent ancestors of changed modules and also required physical versioning; leaving any ancestor unversioned would allow its cached source to request an old child URL.

### RED

Command:

```bash
node --test tests/coast-cache-contract.test.mjs
```

Result: exit 1; 0 passed, 1 failed. The recursive contract reported all 27 nested release modules as missing their `-20260829-coast.js` URLs, reachable through pre-release unversioned URLs, and still present as duplicate pre-release physical files.

### Exact changes

- Added `tests/coast-cache-contract.test.mjs`. It recursively follows static relative imports/exports from `main-20260829-coast.js`, requires every release module URL to be reachable, rejects every pre-release URL, and rejects an old duplicate source file.
- Physically renamed 27 modules to the `-20260829-coast.js` release suffix. The set contains all branch-modified reachable modules plus the required ancestor closure: chapter/story/world data, portal and save state, local/online boss modules, chat/network ancestors, enemy/world ancestors, dialogue/NPC/log modules, and related registries.
- Kept one implementation per module by removing the old unversioned physical files rather than copying source.
- Updated every source import/export and every affected test import/path. The versioned entry and game modules now lead to versioned changed descendants at every nested boundary.
- Preserved the original URLs of 26 runtime modules unchanged from `origin/main` because they are not ancestors of a changed release module.
- Updated the Blue Coast implementation plan, `README.md`, and `FIREBASE_SETUP.md` to document the recursive physical-version and cache-contract rule. `index.html` required no change because it already points at `main-20260829-coast.js`; the existing verify workflow required no command change because its `tests/*.test.mjs` glob automatically includes the new contract.

### GREEN

Command:

```bash
node --test tests/coast-cache-contract.test.mjs tests/firebase-hosting.test.mjs
```

Result: exit 0; 5 passed, 0 failed.

Independent graph audit after the rename:

- source modules: 55
- entry-reachable modules: 55
- release-versioned reachable modules: 29 (main/game plus 27 transitive modules)
- preserved unversioned reachable modules: 26
- unresolved imports: 0
- old duplicate physical files: 0
- missing release files: 0
- unexpected versioned modules: 0

## Finding 2: corrupt world-progress unlock arrays

### Root cause

`normalizeWorldProgressValue` used nullish fallback before calling `uniqueAllowed`. Missing values recovered because `undefined ?? initial` selected the initial arrays, but non-array values were not nullish and reached `uniqueAllowed`, which returned `[]`. Valid arrays that omitted mandatory baseline IDs were also accepted without repairing village/forest invariants. This could preserve otherwise valid common progress while leaving the player without mandatory region/map access.

### RED

Command:

```bash
node --test tests/chapter-progress.test.mjs tests/progress-storage.test.mjs
```

Result: exit 1; 33 passed, 2 failed. Both the direct normalizer and v6 load/migration regression tests received `[]` for malformed top-level unlock arrays where `["village", "forest"]` was required.

### Exact changes

- Added a `requiredUnlocks` normalization helper that starts with mandatory baseline IDs, appends only array input, then applies the existing registry allow-list and de-duplication behavior.
- Applied it to both `unlockedRegionIds` and `unlockedMapIds`.
- Added direct normalization coverage for missing arrays, non-array values, missing baseline IDs, invalid registry entries, valid later coast unlock preservation, valid completed-region preservation, and valid chapter substate preservation.
- Added v6 storage coverage proving malformed/missing unlock arrays recover baseline access without erasing level, Gold, class equipment, completed regions, or valid coast device progress.
- Updated the earlier allow-list expectation to include the now-mandatory village/forest invariants.

### GREEN

Command:

```bash
node --test tests/chapter-progress.test.mjs tests/progress-storage.test.mjs tests/game-chapter-progress.test.mjs
```

Result: exit 0; 41 passed, 0 failed.

## Finding 3: portal destination overlap

### Root cause

Several sequential arrival coordinates reused `x = 196`, exactly the right edge of reciprocal 96-pixel portals starting at `x = 100`, so `findActivePortal(..., PLAYER_RADIUS)` still detected the portal. Both deep-shortcut destinations were inside reciprocal portal rectangles. Related map spawns reused overlapping arrivals. Other sequential arrivals had only incidental clearance and no behavioral margin contract.

### RED

Command:

```bash
node --test tests/world-data.test.mjs tests/world.test.mjs
```

Result: exit 1; 9 passed, 1 failed. The first failing assertion showed `coast-beach/to-wreck-bay` arriving inside the Wreck Bay `to-beach` portal instead of returning `null` from `findActivePortal`.

### Exact changes

- Moved west-side sequential arrivals and the Wreck Bay/Flooded Station spawns from `x = 196` to `x = 244`.
- Moved the Tide Core Cave sequential arrival/spawn from `x = 460` to `x = 480`.
- Moved the Beach-to-Cave shortcut destination from `(1772, 1408)` to `(1640, 1408)`.
- Moved the Cave-to-Beach shortcut destination from `(1508, 1328)` to `(1340, 1328)`.
- Retained traversable, in-bounds east-side sequential arrivals at `(1916, 852)`; the new test proves their clearance as well.
- Added table-like traversal over every portal originating in all four coast maps (including the village return), asserting the required `findActivePortal(destinationMap, x, y, PLAYER_RADIUS) === null` behavior.
- Added the same assertion for every related coast spawn and a stronger check with an additional 32-pixel safe margin.
- Preserved portal IDs, requirements, destinations, sequential unlock order, reverse revisits, and both completed-shortcut directions.

### GREEN

Command:

```bash
node --test tests/world-data.test.mjs tests/world.test.mjs tests/collision.test.mjs tests/portal-transition.test.mjs
```

Result: exit 0; 18 passed, 0 failed.

## Finding 4: common boss event contract

### Root cause

`LocalBossController` buffered events and exposed `consumeEvents()`, while `CoopBossController.update()` drained `pendingEvents` internally and returned the drained array without defining `consumeEvents()`. The game retained a fallback for update-returned events, but the two adapters did not implement the advertised common interface. Adding only a method without changing the drain point would also have caused the game to prefer an empty consumed array over the returned events.

### RED

Command:

```bash
node --test tests/boss-controller-contract.test.mjs tests/local-boss-controller.test.mjs tests/coop-boss-controller.test.mjs tests/game-boss-controller-events.test.mjs
```

Result: exit 1; 28 passed, 1 failed. The shared contract observed `typeof online.consumeEvents === "undefined"` instead of `"function"`.

### Exact changes

- Added `tests/boss-controller-contract.test.mjs`, which runs one real common contract over local and online controller instances.
- Changed online `update()` to return only the events produced by that update while retaining them in `pendingEvents`, matching the local adapter and preserving update-return fallback compatibility.
- Added online `consumeEvents()` to atomically return and clear the pending buffer.
- Proved both adapters return the fallback events, deliver the buffered events once, and return `[]` on the second consume; the game adapter continues to prefer `consumeEvents()` when present and does not double-deliver.

### GREEN

Command:

```bash
node --test tests/boss-controller-contract.test.mjs tests/local-boss-controller.test.mjs tests/coop-boss-controller.test.mjs tests/game-boss-controller-events.test.mjs
```

Result: exit 0; 29 passed, 0 failed.

## Full verification

Focused total: 93 passed, 0 failed across the final cache, progress, portal/collision, and controller command groups.

Standard Node suite:

```bash
node --test tests/*.test.mjs tests/*.static.test.cjs
```

Result: exit 0; 590 passed, 0 failed, 0 skipped, 0 todo.

JavaScript syntax:

```bash
for file in src/*.js; do node --check "$file"; done
```

Result: exit 0; all 55 source modules checked with no output.

Whitespace/patch validation:

```bash
git diff --check
git diff --cached --check
```

Result: exit 0; no output.

## Self-review

- Re-read all four requirements against the staged diff before committing.
- Confirmed the cache version set is the minimal reverse ancestor closure: all changed runtime descendants are protected while unrelated unchanged module URLs stay stable.
- Confirmed no old/pre-release duplicate source files remain and every static relative import resolves.
- Confirmed normalization preserves later allow-listed unlocks and unrelated common progress while always restoring village/forest map and region access.
- Confirmed every coast-origin portal destination and every coast spawn is traversable, in bounds, outside portal collision at player radius, and outside a further 32-pixel margin.
- Confirmed the controller contract uses real adapter behavior with only the simulation boundary substituted; no assertion is made on mock existence or call bookkeeping.
- Confirmed no unrelated pre-existing worktree changes were present at task start or included in the implementation commit.

## Concerns

No known correctness concerns remain. The required verification was Node/static-only; Playwright browser smoke and Firebase emulator suites were not rerun in this final wave, and no deployment was attempted.
