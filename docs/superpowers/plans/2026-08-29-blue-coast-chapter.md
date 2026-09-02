# Blue Coast Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable region/chapter progression layer and implement the four-map Blue Coast story with solo and online regional bosses while preserving all existing gameplay systems.

**Architecture:** Physical worlds stay in the existing Canvas world registry, while region prerequisites and serializable chapter state live in focused data and pure-state modules. The game integrates a common boss-controller contract: Firebase-backed cooperative encounters online and a network-free local controller in solo. Story actors, signals, records, dialogue and objective zones are data-driven so the same framework can host the future volcano chapter.

**Tech Stack:** Browser-native ES modules, Canvas 2D, DOM/CSS overlays, browser `localStorage`, Firebase Realtime Database, Node.js 24 built-in test runner, Playwright smoke tests.

**Spec:** `docs/superpowers/specs/2026-08-29-blue-coast-chapter-design.md`

## Global Constraints

- Do not replace the current game engine or framework.
- Preserve the three classes, 21 weapons, shops, inventory, progression, chat, mobile controls and personal normal-monster simulation.
- Keep online boss authority transfer, contributor reward, 2Hz state publishing and 180-second respawn.
- Solo mode must not load Firebase or send Firebase requests.
- Existing v1 through v5 nickname-scoped saves must load without losing valid progress.
- Story state must contain serializable values only.
- Deployment, pushing, PR creation and `main` merge are outside this plan.
- Write every behavior test first and observe the expected failure before production code.

---

### Task 1: Reusable Region Registry and Chapter Progress

**Files:**
- Create: `src/region-data-20260829-coast.js`
- Create: `src/chapter-progress-20260829-coast.js`
- Test: `tests/region-data.test.mjs`
- Test: `tests/chapter-progress.test.mjs`

**Interfaces:**
- Produces: `REGION_IDS`, `REGION_DEFINITIONS`, `getRegionDefinition(regionId)`, `getRegionForMap(mapId)`.
- Produces: `createInitialWorldProgress()`, `normalizeWorldProgress(value)`, `isMapUnlocked(progress, mapId)`, `completeRegion(progress, regionId)`.
- Produces coast transitions: `repairChapterDevice`, `collectChapterRecord`, `chooseChapterSupport`, `recordChapterBossDefeat`, `rescueSera`, `collectCoastCore`.

- [ ] **Step 1: Write failing registry tests**

```js
assert.deepEqual(REGION_DEFINITIONS.coast.mapIds, [
  "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
]);
assert.equal(REGION_DEFINITIONS.coast.prerequisiteRegionId, "forest");
assert.equal(getRegionForMap("coast-wreck-bay").id, "coast");
```

- [ ] **Step 2: Run `node --test tests/region-data.test.mjs` and verify missing-module failure**
- [ ] **Step 3: Implement the immutable registry and safe null lookups**
- [ ] **Step 4: Run the registry test and verify it passes**
- [ ] **Step 5: Write failing pure-progress tests**

```js
const initial = createInitialWorldProgress();
assert.equal(isMapUnlocked(initial, "coast-beach"), false);
const forestDone = completeRegion(initial, "forest");
assert.equal(isMapUnlocked(forestDone.progress, "coast-beach"), true);
assert.deepEqual(initial.completedRegionIds, []);
```

Add independent tests for ordered device/record gates, immutable idempotent transitions, all three support choices, boss-before-rescue, rescue-before-core, volcano unlock and shortcut activation.

- [ ] **Step 6: Run `node --test tests/chapter-progress.test.mjs` and verify missing exports fail**
- [ ] **Step 7: Implement minimal allow-listed state normalization and transitions**
- [ ] **Step 8: Run both tests and verify green**
- [ ] **Step 9: Commit `feat: add reusable region chapter progression`**

### Task 2: Save Version 6 and Legacy Migration

**Files:**
- Modify: `src/quest-state-20260829-coast.js`
- Modify: `src/progress-storage-20260829-coast.js`
- Modify: `tests/quest-state.test.mjs`
- Modify: `tests/progress-storage.test.mjs`

**Interfaces:**
- Consumes: `createInitialWorldProgress`, `normalizeWorldProgress`.
- Produces: v6 `progressStorageKey`, `v5ProgressStorageKey`, v1-v5 migration and v6 round trip.

- [ ] **Step 1: Add failing initial-progress assertions for `worldProgress`**
- [ ] **Step 2: Run `node --test tests/quest-state.test.mjs` and observe missing field failure**
- [ ] **Step 3: Add `worldProgress: createInitialWorldProgress()` and clone it through quest transitions**
- [ ] **Step 4: Run the quest-state tests and verify green**
- [ ] **Step 5: Add failing v6 storage tests**

```js
assert.equal(progressStorageKey("세라"), "pixel-world.progress.v6:%EC%84%B8%EB%9D%BC");
assert.equal(v5ProgressStorageKey("세라"), "pixel-world.progress.v5:%EC%84%B8%EB%9D%BC");
```

Cover v5 migration preserving level, Gold, inventory, equipment, quest and boss receipts; v6 round trip; missing chapter fields; invalid choice; duplicated IDs; and a corrupt chapter subsection that does not erase valid equipment.

- [ ] **Step 6: Run `node --test tests/progress-storage.test.mjs` and observe v5-key and missing-field failures**
- [ ] **Step 7: Implement v6 constants, v5 loader, normalized serialization and legacy write-forward**
- [ ] **Step 8: Run storage, quest, equipment and progression tests**
- [ ] **Step 9: Commit `feat: persist chapter progress in v6 saves`**

### Task 3: Four Physical Coast Worlds and Locked Travel

**Files:**
- Create: `src/coast-world-data-20260829-coast.js`
- Modify: `src/world-data-20260829-coast.js`
- Modify: `src/world-20260829-coast.js`
- Modify: `src/portal-transition-20260829-coast.js`
- Modify: `tests/world-data.test.mjs`
- Modify: `tests/world.test.mjs`
- Modify: `tests/world-layer-cache.test.mjs`
- Modify: `tests/portal-transition.test.mjs`

**Interfaces:**
- Consumes: region map IDs and `isMapUnlocked`.
- Produces: `COAST_WORLD_DEFINITIONS`, seven physical `WORLD_IDS`, legacy `coast` normalization to `coast-beach`, `canUsePortal(portal, worldProgress)`.

- [ ] **Step 1: Replace the old four-world expectation with failing seven-world and preserved-total-area assertions**

```js
assert.equal(getTotalWorldArea(), 2880 * 1800 * 10);
assert.deepEqual(WORLD_IDS.filter(id => id.startsWith("coast-")), [
  "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
]);
```

- [ ] **Step 2: Add failing tests for bidirectional sequential portals, village locks, volcano lock and completion shortcut**
- [ ] **Step 3: Run the focused world tests and verify failures reflect the old single coast**
- [ ] **Step 4: Implement four 2160×1800 definitions using existing coast enemies and traversable landmarks**
- [ ] **Step 5: Register four procedural renderers and preserve half-resolution layer caching**
- [ ] **Step 6: Implement generic portal gate evaluation without changing transition timing**
- [ ] **Step 7: Run world, collision, enemy and portal tests**
- [ ] **Step 8: Commit `feat: split blue coast into four gated maps`**

### Task 4: Coast Story Data and Interactable Resolution

**Files:**
- Create: `src/coast-story-data-20260829-coast.js`
- Create: `src/story-interactions-20260829-coast.js`
- Test: `tests/coast-story-data.test.mjs`
- Test: `tests/story-interactions.test.mjs`

**Interfaces:**
- Produces: `COAST_DEVICES`, `COAST_RECORDS`, `COAST_STORY_ACTORS`, `COAST_OBJECTIVES`, `getCoastStoryContent(mapId)`.
- Produces: `findNearbyStoryInteraction(interactions, player, worldProgress)`, `storyInteractionPrompt(interaction)`, `resolveStoryInteraction(progress, interactionId, response)`.

- [ ] **Step 1: Write failing literal-data contract tests for five repair targets, required records, three actors and four map objectives**
- [ ] **Step 2: Run the data test and verify missing-module failure**
- [ ] **Step 3: Implement frozen data with stable IDs, 180-260px investigation zones and short Korean dialogue pages**
- [ ] **Step 4: Run the data test and verify green**
- [ ] **Step 5: Write failing resolver tests for nearest eligible target, locked target exclusion, retryable signal classification and non-mutating story events**
- [ ] **Step 6: Run the resolver test and verify missing behavior**
- [ ] **Step 7: Implement resolver functions over chapter-progress transitions**
- [ ] **Step 8: Run both tests and commit `feat: add coast story data and interactions`**

### Task 5: Multi-Action Dialogue and Communication Log UI

**Files:**
- Modify: `src/dialogue-controller-20260829-coast.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main-20260828-coop.js`
- Modify: `tests/dialogue-controller.test.mjs`
- Create: `tests/coast-ui.static.test.cjs`
- Modify: `tests/quest-ui.static.test.cjs`

**Interfaces:**
- Consumes: existing `{ action, actionLabel }` models and new `{ pages, actions }` models.
- Produces: dialogue action container, record-log overlay, chapter objective text and accessible focus order.

- [ ] **Step 1: Add failing dialogue tests proving old Aren models still work and three choices call distinct action IDs**
- [ ] **Step 2: Run `node --test tests/dialogue-controller.test.mjs` and verify the three-action case fails**
- [ ] **Step 3: Extend the controller to normalize legacy one-action models and render real action buttons**
- [ ] **Step 4: Run the controller and Aren dialogue tests**
- [ ] **Step 5: Add failing static tests for chapter tracker, communication-log dialog, three-choice container, ARIA labels and mobile one-column layout**
- [ ] **Step 6: Run the static tests and verify selectors are absent**
- [ ] **Step 7: Add minimal DOM/CSS and entry bindings without changing existing overlay order**
- [ ] **Step 8: Run UI static tests and commit `feat: add story dialogue and signal log ui`**

### Task 6: Story Actors, Signals and Canvas Guidance

**Files:**
- Modify: `src/npc-data-20260829-coast.js`
- Modify: `src/npcs.js`
- Modify: `src/world-20260829-coast.js`
- Test: `tests/npcs.test.mjs`
- Create: `tests/story-rendering.test.mjs`

**Interfaces:**
- Consumes: coast actor and objective-zone data.
- Produces: map-scoped Mari and rescued-Sera NPC instances, `drawStorySignal`, `drawInvestigationZone`.

- [ ] **Step 1: Add failing NPC tests for Mari placements, Sera post-rescue visibility and Echo exclusion from physical NPCs**
- [ ] **Step 2: Run NPC tests and observe missing coast actors**
- [ ] **Step 3: Implement story actor instances with `actorId` and existing nearest-NPC behavior**
- [ ] **Step 4: Add failing Canvas command tests for signal waveform, pixel face and broad investigation ring**
- [ ] **Step 5: Implement the minimal renderers and register them in the existing entity/render order**
- [ ] **Step 6: Run NPC, rendering and Canvas tests**
- [ ] **Step 7: Commit `feat: render coast actors signals and objectives`**

### Task 7: Network-Free Local Regional Boss Controller

**Files:**
- Create: `src/local-boss-controller-20260829-coast.js`
- Modify: `src/coop-boss-data-20260829-coast.js`
- Test: `tests/local-boss-controller.test.mjs`
- Modify: `tests/coop-boss-data.test.mjs`

**Interfaces:**
- Consumes: boss definitions, `scaledBossMaxHp`, enemy view/simulation and existing attack definitions.
- Produces the common controller methods `setMap`, `update`, `targetableBoss`, `renderableBoss`, `requestHit`, `consumeEvents`, `clear`.
- Produces local events `{ type: "boss-defeated", encounterId, bossId, mapId, rewardExp, rewardGold }` and `{ type: "damage-player", ... }`.

- [ ] **Step 1: Add failing data tests binding the coast boss only to `coast-tide-core-cave` while preserving forest and volcano definitions**
- [ ] **Step 2: Add failing local-controller tests**

```js
await controller.setMap("coast-tide-core-cave");
assert.equal(controller.snapshot.maxHp, 120);
assert.match(controller.snapshot.encounterId, /^local:coast:/);
```

Cover no-boss village maps, real attack range/cooldown, one defeat event, local player damage, clear/reset, and a fresh full-HP encounter after controller recreation.

- [ ] **Step 3: Run focused tests and verify missing controller/new map binding failures**
- [ ] **Step 4: Implement the controller using existing combat definitions rather than accepting client damage values**
- [ ] **Step 5: Run local, coop, combat and projectile tests**
- [ ] **Step 6: Commit `feat: add solo regional boss controller`**

### Task 8: Game Integration, Forest Unlock and Disconnect Reset

**Files:**
- Modify: `src/game-20260828-coop.js`
- Modify: `src/main-20260828-coop.js`
- Create: `tests/game-chapter-progress.test.mjs`
- Create: `tests/game-local-boss.test.mjs`
- Modify: `tests/game-play-mode.test.mjs`
- Modify: `tests/game-coop-boss-reward.test.mjs`

**Interfaces:**
- Consumes: common chapter transitions, story interaction resolver and both boss controllers.
- Produces: mode-selected boss controller, persistent region completion, story prompts, record log and gated portal feedback.

- [ ] **Step 1: Add failing game tests for locked coast/volcano portals and forest first-clear opening coast**
- [ ] **Step 2: Add failing solo tests proving no Firebase adapter is used, 1-player boss appears and reward persists once**
- [ ] **Step 3: Add failing disconnect test proving the cooperative snapshot is discarded and a new local snapshot has full HP**
- [ ] **Step 4: Run the focused tests and confirm failures come from missing integration**
- [ ] **Step 5: Replace the village-only `F` guard with generic nearest interaction routing while preserving shop/blacksmith/Aren behavior**
- [ ] **Step 6: Select `LocalBossController` in solo and `CoopBossController` online; process their defeat/reward events through one method**
- [ ] **Step 7: Persist forest completion, coast boss completion and all story transitions atomically with their local reward**
- [ ] **Step 8: On fallback, clear the cooperative controller and create a fresh local controller without copying snapshot state**
- [ ] **Step 9: Run game progression, modes, shops, inventory, classes and boss tests**
- [ ] **Step 10: Commit `feat: integrate chapter flow and solo bosses`**

### Task 9: Complete Four-Map Story Flow and Choice Convergence

**Files:**
- Modify: `src/game-20260828-coop.js`
- Modify: `src/coast-story-data-20260829-coast.js`
- Modify: `src/story-dialogue-20260829-coast.js`
- Create: `tests/game-coast-story.test.mjs`
- Create: `tests/coast-dialogue.test.mjs`

**Interfaces:**
- Consumes all previous chapter, interaction, dialogue and boss interfaces.
- Produces the playable Beach → Wreck Bay → Flooded Station → Tide Core Cave sequence and choice-dependent follow-up models.

- [ ] **Step 1: Write a failing table-driven test for all three support choices from fresh coast progress to volcano unlock**
- [ ] **Step 2: Add failing checkpoint tests for each repair/record prerequisite and already-unlocked revisit**
- [ ] **Step 3: Add failing dialogue tests proving choice changes only approved follow-up lines**
- [ ] **Step 4: Run focused tests and verify missing flow failures**
- [ ] **Step 5: Implement objective advancement, map unlock effects, Sera rescue and core collection with one save per accepted event**
- [ ] **Step 6: Render communication-log entries from collected record IDs in chronological story order**
- [ ] **Step 7: Run all story tests and commit `feat: complete blue coast story chapter`**

### Task 10: Firebase Physical Map Rules and Boss Arena Safety

**Files:**
- Modify: `src/network-state-20260829-coast.js`
- Modify: `src/chat-state-20260829-coast.js`
- Modify: `src/chat-network-20260829-coast.js`
- Modify: `src/coop-boss-controller-20260829-coast.js`
- Modify: `src/coop-boss-state-20260829-coast.js`
- Modify: `database.rules.json`
- Modify: `tests/network-state.test.mjs`
- Modify: `tests/chat-state.test.mjs`
- Modify: `tests/coop-boss-controller.test.mjs`
- Modify: `tests/coop-boss-state.test.mjs`
- Modify: `tests/coop-boss-rules.test.mjs`
- Modify: `tests/firebase-rules-emulator.cjs`

**Interfaces:**
- Consumes seven physical world IDs and boss arena definitions.
- Produces exact-map presence/chat filtering and rejects boss requests from players outside the configured arena.

- [ ] **Step 1: Add failing player/chat tests for all four coast map IDs and 2160×1800 bounds**
- [ ] **Step 2: Add failing boss validation tests rejecting a player whose physical map differs from the boss arena**
- [ ] **Step 3: Add failing rule tests for accepted new IDs, rejected legacy/unknown IDs and out-of-bounds positions**
- [ ] **Step 4: Run unit rule tests and observe old allow-list failures**
- [ ] **Step 5: Update serialization, filtering, boss arena checks and database rules**
- [ ] **Step 6: Run unit tests and Firebase emulator tests**
- [ ] **Step 7: Commit `feat: secure coast map and boss synchronization`**

### Task 11: Entry Asset Version, Documentation and Browser Smoke

**Files:**
- Rename: `src/main-20260828-coop.js` to `src/main-20260829-coast.js`
- Rename: `src/game-20260828-coop.js` to `src/game-20260829-coast.js`
- Rename every changed transitive runtime module and cache-dependent ancestor to one authoritative `*-20260829-coast.js` physical file
- Modify: `index.html`
- Modify: tests importing the versioned game entry
- Create: `tests/coast-cache-contract.test.mjs`
- Modify: `README.md`
- Modify: `tests/firebase-hosting.test.mjs`
- Modify: `tests/browser-smoke.cjs`
- Modify: `tests/solo-mode-smoke.cjs`
- Create: `tests/coast-browser-smoke.cjs`
- Modify: `.github/workflows/browser-smoke.yml`

**Interfaces:**
- Produces a recursively cache-safe entry graph and browser flows for solo forest unlock, four coast maps, one choice, local boss completion and online fallback safety.

- [ ] **Step 1: Add failing static cache-contract assertions for the new physical entry and transitive runtime filenames**
- [ ] **Step 2: Rename entry and changed transitive files, then update recursive imports/index only after the failure is observed**
- [ ] **Step 3: Add a Playwright coast smoke that uses real keyboard/click interaction, reloads saved checkpoints and asserts zero console errors**
- [ ] **Step 4: Run the new smoke against `python3 -m http.server 4173`**
- [ ] **Step 5: Extend README with four maps, story controls, solo/online boss differences and save v6 behavior**
- [ ] **Step 6: Run static, browser-smoke and README contract tests**
- [ ] **Step 7: Commit `test: cover blue coast browser progression`**

### Task 12: Full Verification and Branch Handoff

**Files:**
- Verify all modified files

**Interfaces:**
- Produces a clean, committed feature branch with no deployment or merge.

- [ ] **Step 1: Run `node --test tests/*.test.mjs tests/*.static.test.cjs`**
- [ ] **Step 2: Run `for file in src/*.js; do node --check "$file"; done`**
- [ ] **Step 3: Run Firebase Database emulator tests with the repository workflow command**
- [ ] **Step 4: Run solo, standard, chat and coast Playwright smoke tests**
- [ ] **Step 5: Run `git diff --check` and inspect `git diff origin/main...HEAD`**
- [ ] **Step 6: Confirm no Firebase request in solo, no console error, three choices converge and all legacy saves load**
- [ ] **Step 7: Apply `superpowers:requesting-code-review`, resolve findings through TDD, then rerun verification**
- [ ] **Step 8: Apply `superpowers:finishing-a-development-branch` and report the local branch without pushing, deploying or merging**
