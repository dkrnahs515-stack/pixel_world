# Active Volcano Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four-map Active Volcano chapter, rescue/general branch, eruption hazard, class hidden weapons, and Pixel Core Sanctuary entry.

**Architecture:** Extend the existing immutable chapter-transition model with a volcano substate and keep story decisions outside the realtime boss state. Add separate volcano world/story/eruption data modules, then adapt the game shell to consume a unified story interaction contract. Move the existing volcano cooperative boss to the final caldera map and version every changed transitive browser module with the `20260903-volcano` physical suffix.

**Tech Stack:** Browser ES modules, Canvas 2D, Node.js 24 built-in test runner, Playwright 1.55, Firebase Realtime Database rules/emulator.

**Spec:** `docs/superpowers/specs/2026-09-03-active-volcano-chapter-design.md`

## Global Constraints

- Preserve the legacy `volcano` mapId as the first volcano map.
- Volcano and sanctuary maps are exactly `2160 × 1800`.
- Rescue preparation requires all three fixed coolant anchor IDs; an underprepared failure route requires an explicit irreversible choice.
- Rescue success grants all three reward-only hidden weapons without auto-equipping them.
- Both rescue outcomes allow the third core fragment and sanctuary unlock.
- Environmental eruption damage remains local and never writes hazard state to Firebase.
- Existing forest, coast, inventory, shop, class, chat, and boss reward behavior must remain compatible.
- Changed browser modules use the exact physical release suffix `20260903-volcano`.

---

### Task 1: Volcano progression, maps, and v7 persistence

**Files:**
- Create: `src/volcano-world-data-20260903-volcano.js`
- Create: `src/region-data-20260903-volcano.js`
- Create: `src/world-data-20260903-volcano.js`
- Create: `src/chapter-progress-20260903-volcano.js`
- Create: `src/progress-storage-20260903-volcano.js`
- Create: `src/quest-state-20260903-volcano.js`
- Create: `tests/volcano-chapter-progress.test.mjs`
- Create: `tests/volcano-world-data.test.mjs`
- Modify: `tests/progress-storage.test.mjs`

**Interfaces:**
- Produces: `createInitialVolcanoChapter()`, `repairVolcanoDevice()`, `collectVolcanoClue()`, `collectCoolantAnchor()`, `chooseVolcanoRoute()`, `recordChapterBossDefeat(progress, regionId)`, `resolveVolcanoCaptain()`, `collectVolcanoCore()`.
- Produces: region/map definitions for `volcano`, `volcano-magma-route`, `volcano-observatory`, `volcano-core-caldera`, and `sanctuary`.

- [ ] **Step 1: Write failing transition and map tests**

```js
test("필수 목표만 다음 활화산 맵을 열고 냉각 쐐기는 구조 분기만 결정한다", () => {
  let progress = unlockedVolcanoProgress();
  progress = repairVolcanoDevice(progress, "ash-gate-pressure-seal").progress;
  progress = collectVolcanoClue(progress, "garen-scorched-insignia").progress;
  assert.equal(isMapUnlocked(progress, "volcano-magma-route"), true);
  assert.equal(progress.chapters.volcano.coolantAnchorIds.length, 0);
});

test("준비 부족은 명시적 proceed만 최종 맵을 열고 구조 루트는 3개 쐐기를 요구한다", () => {
  const ready = observatoryReadyProgress();
  assert.equal(chooseVolcanoRoute(ready, "rescue").progress.chapters.volcano.routeDecision, null);
  assert.equal(chooseVolcanoRoute(ready, "proceed").progress.chapters.volcano.routeDecision, "proceed");
});
```

- [ ] **Step 2: Run tests and confirm missing volcano APIs fail**

Run: `node --test tests/volcano-chapter-progress.test.mjs tests/volcano-world-data.test.mjs`

- [ ] **Step 3: Implement immutable progression and physical map registry**

```js
export function chooseVolcanoRoute(progress, decision) {
  return transition(progress, (next, effects) => {
    const volcano = next.chapters.volcano;
    if (!isObservatoryReady(next) || volcano.routeDecision) return;
    const prepared = hasAll(volcano.coolantAnchorIds, VOLCANO_COOLANT_ANCHOR_IDS);
    if ((decision === "rescue" && !prepared) || !["rescue", "proceed"].includes(decision)) return;
    volcano.routeDecision = decision;
    volcano.eruptionTriggered = true;
    unlockMap(next, effects, "volcano-core-caldera");
  });
}
```

- [ ] **Step 4: Add v7 save and v6 migration tests, then implement migration**

```js
assert.match(progressStorageKey("화산"), /^pixel-world\.progress\.v7:/);
const loaded = loadProgress(storageWithV6Payload, "화산");
assert.equal(loaded.worldProgress.chapters.volcano.routeDecision, null);
assert.equal(loaded.worldProgress.chapters.coast.coreFragmentObtained, true);
```

Run: `node --test tests/volcano-chapter-progress.test.mjs tests/volcano-world-data.test.mjs tests/progress-storage.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src tests docs/superpowers/specs/2026-09-03-active-volcano-chapter-design.md docs/superpowers/plans/2026-09-03-active-volcano-chapter.md
git commit -m "feat: add volcano chapter progression and maps"
```

### Task 2: Volcano story branch and hidden weapon rewards

**Files:**
- Create: `src/volcano-story-data-20260903-volcano.js`
- Create: `src/story-interactions-20260903-volcano.js`
- Create: `src/story-dialogue-20260903-volcano.js`
- Create: `src/weapon-data-20260903-volcano.js`
- Create: `src/equipment-state-20260903-volcano.js`
- Create: `src/equipment-ui-20260903-volcano.js`
- Create: `src/weapon-rendering-20260903-volcano.js`
- Create: `tests/volcano-story-data.test.mjs`
- Create: `tests/volcano-story-interactions.test.mjs`
- Create: `tests/hidden-weapons.test.mjs`
- Modify: `tests/weapon-data.test.mjs`
- Modify: `tests/equipment-state.test.mjs`
- Modify: `tests/equipment-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1 volcano transitions and world progress.
- Produces: `ALL_STORY_INTERACTIONS`, `storyDialogueModel()`, `actorDialogueModel()`, `grantVolcanoHiddenWeapons(progress)`.

- [ ] **Step 1: Write failing story eligibility and warning tests**

```js
test("준비 부족 진입 대화는 되돌아가기와 영구 포기를 함께 명시한다", () => {
  const model = storyDialogueModel(routeConsole, underpreparedProgress());
  assert.deepEqual(model.actions.map(action => action.id), [
    "story-volcano-route-return",
    "story-volcano-route-proceed",
  ]);
  assert.match(model.pages.join(" "), /대장을 구할 수 없고.*히든 무기/);
});
```

- [ ] **Step 2: Run story tests and confirm the new contract is absent**

Run: `node --test tests/volcano-story-data.test.mjs tests/volcano-story-interactions.test.mjs`

- [ ] **Step 3: Implement volcano data and unified story resolver**

```js
export const ALL_STORY_INTERACTIONS = Object.freeze([
  ...COAST_STORY_INTERACTIONS,
  ...VOLCANO_STORY_INTERACTIONS,
]);

export function resolveStoryInteraction(progress, interactionId, response) {
  const interaction = ALL_STORY_INTERACTIONS.find(value => value.id === interactionId);
  return interaction?.chapterId === "volcano"
    ? resolveVolcanoInteraction(progress, interaction, response)
    : resolveCoastInteraction(progress, interaction, response);
}
```

- [ ] **Step 4: Write failing hidden weapon grant, purchase, sale, UI, and combat tests**

```js
const granted = grantVolcanoHiddenWeapons(progress);
assert.deepEqual(granted.progress.equipmentByClass.warrior.ownedWeaponIds.at(-1), "volcanic-heartblade");
assert.equal(buyWeapon(progress, "warrior", "volcanic-heartblade").reason, "reward_only");
assert.equal(sellWeapon(granted.progress, "warrior", "volcanic-heartblade").reason, "reward_only");
assert.equal(equipmentUiModel(context).buyItems.some(item => item.weapon.rewardOnly), false);
```

- [ ] **Step 5: Implement the three exact tier-8 reward weapons and atomic grant helper**

Run: `node --test tests/hidden-weapons.test.mjs tests/weapon-data.test.mjs tests/equipment-state.test.mjs tests/equipment-ui.test.mjs tests/combat.test.mjs tests/weapon-rendering.test.mjs`

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add volcano rescue branch and hidden weapons"
```

### Task 3: Eruption hazard and game integration

**Files:**
- Create: `src/volcano-eruption-20260903-volcano.js`
- Create: `src/world-20260903-volcano.js`
- Create: `src/npc-data-20260903-volcano.js`
- Create: `src/portal-transition-20260903-volcano.js`
- Create: `src/coop-boss-data-20260903-volcano.js`
- Create: `src/local-boss-controller-20260903-volcano.js`
- Create: `src/coop-boss-state-20260903-volcano.js`
- Create: `src/coop-boss-controller-20260903-volcano.js`
- Create: `src/game-20260903-volcano.js`
- Create: `tests/volcano-eruption.test.mjs`
- Create: `tests/game-volcano-story.test.mjs`
- Create: `tests/game-volcano-eruption.test.mjs`
- Modify: `tests/coop-boss-data.test.mjs`
- Modify: `tests/game-coop-boss-combat.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-2 maps, story transitions, and hidden reward helper.
- Produces: `createVolcanoEruptionState()`, `advanceVolcanoEruption()`, `drawVolcanoEruption()`, and complete PixelRPG interaction handling.

- [ ] **Step 1: Write failing deterministic eruption cycle tests**

```js
const warning = advanceVolcanoEruption(createVolcanoEruptionState(), 5.5, context);
assert.equal(warning.state.phase, "warning");
assert.deepEqual(warning.state.target, { x: 1150, y: 900 });
const impact = advanceVolcanoEruption(warning.state, 1.5, context);
assert.deepEqual(impact.events, [{ type: "eruption-impact", damage: 20, radius: 110, x: 1150, y: 900 }]);
```

- [ ] **Step 2: Run eruption tests and confirm failure**

Run: `node --test tests/volcano-eruption.test.mjs tests/game-volcano-eruption.test.mjs`

- [ ] **Step 3: Implement the 8-second state machine and Canvas telegraph**

```js
export function advanceVolcanoEruption(state, dt, context) {
  if (!context.active || context.paused) return { state, events: [] };
  // Consume dt across idle, warning, impact, and recovery boundaries and emit one impact per cycle.
}
```

- [ ] **Step 4: Write failing full rescue/general game adapter tests**

```js
assert.equal(game.applyStoryInteraction("caldera-rescue-captain"), true);
assert.equal(game.progress.worldProgress.chapters.volcano.captainOutcome, "rescued");
assert.ok(game.progress.equipmentByClass.mage.ownedWeaponIds.includes("leyflame-core-staff"));
assert.equal(saveCalls, 1);
```

- [ ] **Step 5: Integrate story actions, NPC visibility, chapter HUD, boss defeat, atomic reward rollback, eruption update/render, and entry messages**

Run: `node --test tests/game-volcano-story.test.mjs tests/game-volcano-eruption.test.mjs tests/volcano-eruption.test.mjs tests/game-boss-controller-events.test.mjs tests/game-local-boss.test.mjs`

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: integrate volcano eruption and captain rescue"
```

### Task 4: Online security, release graph, browser journey, and documentation

**Files:**
- Create: `src/network-state-20260903-volcano.js`
- Create: `src/network-20260903-volcano.js`
- Create: `src/coop-boss-network-20260903-volcano.js`
- Create: `src/main-20260903-volcano.js`
- Create: `tests/volcano-cache-contract.test.mjs`
- Create: `tests/volcano-browser-smoke.cjs`
- Modify: `database.rules.json`
- Modify: `tests/database-rules.test.mjs`
- Modify: `tests/coop-boss-rules.test.mjs`
- Modify: `tests/firebase-rules-emulator.cjs`
- Modify: `.github/workflows/browser-smoke.yml`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `FIREBASE_SETUP.md`

**Interfaces:**
- Consumes: all Task 1-3 release modules.
- Produces: deployed `main-20260903-volcano.js` entry graph and Firebase allow/deny contract for eleven physical maps.

- [ ] **Step 1: Write failing presence, boss-map, hidden-weapon rule, cache graph, and workflow tests**

```js
assert.equal(serializePlayerState(player, "volcano-core-caldera").mapId, "volcano-core-caldera");
assert.equal(getCoopBossForMap("volcano"), null);
assert.equal(getCoopBossForMap("volcano-core-caldera").id, "volcano-core-imp");
assert.match(workflow, /tests\/volcano-browser-smoke\.cjs/);
```

- [ ] **Step 2: Run rule and cache tests and confirm failure**

Run: `node --test tests/network-state.test.mjs tests/database-rules.test.mjs tests/coop-boss-rules.test.mjs tests/volcano-cache-contract.test.mjs tests/ci-workflow.test.mjs`

- [ ] **Step 3: Update Firebase rules and network modules**

```js
const ONLINE_MAP_IDS = Object.freeze([
  "village", "forest",
  "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
  "volcano", "volcano-magma-route", "volcano-observatory", "volcano-core-caldera",
  "sanctuary",
]);
```

- [ ] **Step 4: Version changed physical modules and update imports, HTML, tests, and cache contract**

Run: `node --test tests/volcano-cache-contract.test.mjs tests/firebase-hosting.test.mjs`

- [ ] **Step 5: Add the rescue and general-route browser journey and wire CI**

```bash
python3 -m http.server 4173
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/volcano-browser-smoke.cjs
```

- [ ] **Step 6: Update player and Firebase documentation, then run complete verification**

```bash
node --test tests/*.test.mjs tests/*.static.test.cjs
for file in src/*.js; do node --check "$file"; done
npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"
```

- [ ] **Step 7: Commit**

```bash
git add .github database.rules.json index.html README.md FIREBASE_SETUP.md src tests
git commit -m "feat: ship active volcano chapter"
```
