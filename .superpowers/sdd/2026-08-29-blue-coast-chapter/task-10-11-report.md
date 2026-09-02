# Tasks 10–11 Combined Report — Coast Network Security and Browser Progression

## Task 10 — Firebase Physical Map Rules and Boss Arena Safety

### RED

Command:

```sh
node --test tests/network-state.test.mjs tests/chat-state.test.mjs tests/coop-boss-controller.test.mjs tests/coop-boss-state.test.mjs tests/coop-boss-rules.test.mjs
```

Observed 46 tests: 39 passed and 7 failed for the intended old behavior:

- legacy or missing presence map IDs were normalized into a visible physical map;
- an unknown active map fell back to village presence;
- legacy `coast` presence leaked into `coast-beach`;
- `requestHit` sent a request for a player explicitly located on another coast map;
- Database rules still named legacy `coast`, omitted four physical IDs and their 2160×1800 limits, and did not bind attack creation to the stored player map.

The new chat and direct state-validator cases were already green because those pure modules already consumed the seven-ID registry and compared the player map exactly; no unnecessary production rewrite was made there.

### GREEN

- Presence filtering now requires an exact registered active physical map and rejects missing, legacy, unknown and out-of-bounds remote snapshots.
- Four coast map states and chat records preserve exact physical IDs.
- Client boss requests reject an explicitly different player arena; authority validation retains its exact player/encounter map check.
- Realtime Database player/chat rules allow exactly seven physical map IDs, use 2160×1800 coast bounds, reject legacy/unknown IDs and preserve village/forest/volcano bounds.
- Coast boss paths, identities, state bounds, attacks and rewards now use only `coast-tide-core-cave`.
- Attack creation requires the authenticated player's stored physical map to equal the boss arena.
- The emulator fixture covers all four coast IDs, coast bounds, legacy rejection and a wrong-arena attack.

Focused command:

```sh
node --test tests/network-state.test.mjs tests/chat-state.test.mjs tests/chat-network.test.mjs tests/network-chat-integration.test.mjs tests/coop-boss-controller.test.mjs tests/coop-boss-state.test.mjs tests/coop-boss-rules.test.mjs tests/database-rules.test.mjs
```

Result: 61 passed, 0 failed. `tests/firebase-rules-emulator.cjs` also passed `node --check`.

Commit: `6904fbc2f83783a386b98e3509f55d250faa16d8` — `feat: secure coast map and boss synchronization`.

## Task 11 — Entry Asset Version, Documentation and Browser Smoke

### RED

Cache contract:

```sh
node --test tests/firebase-hosting.test.mjs
```

Observed 4 tests: 3 passed and 1 failed because HTML still used `styles.css?v=20260828-coop` and the old physical entry chain.

Workflow and physical QA navigation contracts:

```sh
node --test tests/ci-workflow.test.mjs tests/qa-ui.static.test.cjs
```

Observed 7 tests: 5 passed and 2 failed because the coast browser smoke was absent from CI and the QA navigator still exposed legacy `coast` instead of four physical coast maps.

README contract:

```sh
node --test tests/qa-ui.static.test.cjs
```

Observed 4 tests: 3 passed and 1 failed because the README lacked the four map names and chapter/save/boss behavior.

### GREEN

- Physically renamed `src/main-20260828-coop.js` → `src/main-20260829-coast.js` and `src/game-20260828-coop.js` → `src/game-20260829-coast.js`; old files are absent.
- Updated the HTML entry, stylesheet query token, every source-reading/importing test and the entry-to-game import while preserving Hosting `no-cache` behavior.
- Updated deterministic QA navigation to the four physical coast maps.
- Added `tests/coast-browser-smoke.cjs`: real clicks/keyboard input prepare combat, defeat the solo forest boss, perform every required coast device/record interaction across all four maps, choose Echo, defeat the local coast boss, rescue Sera, collect the core, reload game-produced v6 checkpoints between stages, assert zero console/page errors, and verify a clean online-room-full fallback to solo.
- Existing basic and solo smokes now collect browser console errors as well as uncaught page errors; the old fresh-save browser smoke no longer assumes locked coast/volcano portals are open.
- CI installs Chromium and now runs the coast smoke alongside solo, basic and chat flows.
- README now documents the four physical maps, `F` story controls, record log and choice, solo/local versus online/co-op boss behavior, disconnect full-HP reset, and nickname-scoped v6 plus v1–v5 migration.

Focused results:

- cache/workflow/all static contracts: 48 passed, 0 failed;
- renamed-entry game tests: 164 passed, 0 failed;
- all external-runtime CJS files passed `node --check`.

Commit: `test: cover blue coast browser progression` (the commit containing this report; final SHA is returned in the handoff).

## Batch-End Verification

Command:

```sh
node --test tests/*.test.mjs tests/*.static.test.cjs
for file in src/*.js; do node --check "$file"; done
for file in tests/*.cjs; do node --check "$file"; done
git diff --check
```

Result: 561 passed, 0 failed, 0 skipped/cancelled/todo. Every source JS and test CJS file passed syntax checking, `git diff --check` passed, and the worktree was clean before adding this report.

## Environment Constraints

Firebase emulator was attempted once with the repository workflow command:

```sh
npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"
```

It could not start because no local Firebase executable/package was available: `npm error could not determine executable to run` (exit 1). The unchanged CI workflow installs pinned `firebase-tools@15.26.0`, `@firebase/rules-unit-testing@5.0.0` and `firebase@12.6.0` before running the fixture.

Playwright/http-server was attempted once with:

```sh
python3 -m http.server 4173 >/tmp/pixel-world-task11-server.log 2>&1 & server_pid=$!; trap 'kill "$server_pid" 2>/dev/null || true' EXIT; PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/coast-browser-smoke.cjs
```

The installed Playwright package could not launch because the local Chromium executable was absent at `/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell` (exit 1). The CI workflow installs Chromium with `npx playwright install --with-deps chromium` before running the smoke. No emulator or browser success is claimed locally.

## Self-Review

- Confirmed the seven physical IDs and map-specific bounds are enforced independently in runtime filtering and Database rules; legacy `coast` remains only a local world/save compatibility normalization, never an online accepted ID.
- Confirmed the coast boss channel is only `coast-tide-core-cave`; forest/volcano boss identities, rewards, 2Hz publishing, lease transfer and 180-second respawn contracts remain green.
- Confirmed attack deletion/acknowledgement remains available to authority while only attack creation requires the player's stored arena.
- Confirmed Hosting still uses `no-cache` for JS/CSS and the stylesheet/main/game version tokens match exactly.
- Confirmed old physical entry files are absent and all runnable imports resolve through the renamed game module.
- Strengthened the browser smoke during review so coast checkpoint reloads use saves produced by real story interactions rather than injected chapter state. Only combat level/potions are seeded to make the two real boss fights deterministic and bounded.
- Remaining environment concern: emulator semantics and the rendered Playwright flow require their pinned CI executables; local verification covers the same rule expressions behaviorally, all static contracts and all script syntax, but does not substitute for those two CI jobs.

## Fix Round 1 — Exact Outbound Presence and Boss Request Arena

### RED

Command:

```sh
node --test tests/network-state.test.mjs tests/network-chat-integration.test.mjs tests/coop-boss-controller.test.mjs tests/game-coop-boss-combat.test.mjs
```

Observed 36 tests: 29 passed and 7 failed for the two confirmed review findings:

- outbound serialization normalized legacy `coast`, unknown and missing map IDs instead of rejecting them, and accepted coordinates outside the selected map's exact bounds;
- invalid publishes changed the Firebase map query before serialization and could write a normalized map different from the raw subscribed map;
- boss requests accepted a missing player map; and
- both melee and projectile game call sites passed the saved player object without the active physical arena ID.

### GREEN

- `serializePlayerState` now returns `null` unless the supplied map ID is one of the seven exact physical IDs and both coordinates are finite and inside that map's inclusive bounds.
- `normalizeWorldId` is unchanged for offline save and travel compatibility, but is no longer used for outbound presence serialization.
- `publish` serializes first, exits without querying or writing on invalid state, and uses `serialized.mapId` for both the Firebase query and the presence write. The integration test compares the actual query constraint with the written map ID.
- `requestHit` now requires `player.mapId` to equal the controller's configured arena, rejecting missing, legacy, unknown and other physical IDs before incrementing or sending an attack.
- Both melee and projectile call sites send a transient `{ ...this.player, mapId: this.mapId }` request player, preserving the saved player schema.
- Realtime Database rules remain unchanged as defense in depth.

Focused command:

```sh
node --test tests/network-state.test.mjs tests/network-chat-integration.test.mjs tests/coop-boss-controller.test.mjs tests/game-coop-boss-combat.test.mjs tests/coop-boss-rules.test.mjs tests/database-rules.test.mjs
```

Result: 49 passed, 0 failed.

Full runnable and static verification:

```sh
node --test tests/*.test.mjs tests/*.static.test.cjs
for file in src/*.js; do node --check "$file"; done
for file in tests/*.cjs; do node --check "$file"; done
git diff --check
```

Result: 563 passed, 0 failed, 0 skipped/cancelled/todo; 55 source JS files and 16 test CJS files passed syntax checking; `git diff --check` passed.

The earlier environment constraints are unchanged: the Firebase emulator and rendered Playwright coast flow still require the missing pinned local executables recorded above and were not re-attempted in this fix round.
