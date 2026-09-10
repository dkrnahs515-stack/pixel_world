# Pixel Core Sanctuary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Chapter 4 `픽셀 코어 성역` as the Part 1 finale with four new sanctuary maps, v8 persistence, TRINITY and ORIGIN-0 boss fights, three permanent endings, credits/post-credit sequence, and solo/online recovery-safe completion.

**Architecture:** Extend the existing immutable chapter-progress and versioned ES-module release pattern rather than replacing it. Keep TRINITY as a personal/local mid-boss even in online mode, while ORIGIN-0 uses the existing public-room boss transport and authority model with an ORIGIN-specific state wrapper for phases and anchors. Keep ending choice and title in nickname-local v8 progress; Firebase stores only shared encounter state and short-lived defeat claims. Every changed transitive browser module is emitted under the physical suffix `20260910-sanctuary` so GitHub Pages and Firebase Hosting cannot mix old and new module graphs.

**Tech Stack:** Browser ES modules, Canvas 2D, DOM overlays, Node.js 24 built-in test runner, Playwright/Chromium browser smoke, Firebase Realtime Database and Rules Emulator, GitHub Actions, GitHub Pages, Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-09-09-pixel-core-sanctuary-design.md`

## Global Constraints

- Preserve existing `sanctuary` as the Pixel Core Sanctuary entrance map.
- Add exactly four interior maps: `sanctuary-resonance-hall`, `sanctuary-origin-archive`, `sanctuary-zero-boundary`, `sanctuary-core-heart`.
- All five sanctuary maps are exactly `2160 × 1800`; total physical map count becomes 15.
- The player may backtrack through sanctuary interiors until a permanent ending is confirmed.
- Resonance ending requires all three optional origin records; missing records never force a save restart because `결정 보류` remains available after ORIGIN defeat.
- TRINITY is a personal/local encounter in both solo and online play, base HP exactly `800`.
- ORIGIN-0 is the only new shared online boss, solo base HP exactly `1200`, maximum public-room party size remains 10.
- ORIGIN defeat is stored locally before final ending selection and prevents a forced refight while the ending remains undecided.
- Ending choices are exactly `restore`, `seal`, `resonate`; the first confirmed choice is permanent for the nickname.
- Ending rewards are exactly EXP `500`, Gold `1000`, and one non-combat title: `세계의 복원자`, `코어의 수호자`, or `세계의 공명자`.
- Ending reward payout is idempotent and guarded by `endingRewardClaimed`; a storage failure must never duplicate EXP or Gold.
- Coast support choice (`sera`, `echo`, `mari`) changes dialogue only and never locks an ending.
- Volcano captain outcome (`rescued`, `lost`) changes cameo/record presentation only and never locks an ending.
- `TEACHER` remains solo-only and applies to ORIGIN combat in solo mode.
- `BOSSKILLBOSS` must never multiply TRINITY or ORIGIN-0; it remains limited to the existing forest/coast/volcano regional bosses.
- Credits last 30 seconds; skip becomes available only after 5 seconds; the post-credit `UNKNOWN NODE SIGNAL DETECTED / SOURCE: OUTSIDE CORE RANGE` always plays before returning to village.
- No ending-replay feature is added in this implementation.
- No per-player ending data is added to Firebase. Firebase is used only for online presence/chat/shared ORIGIN combat and defeat-claim recovery.
- Preserve all v1-v7 progress, quests, inventory, codes, class equipment, coast/volcano decisions, hidden weapons, and claimed boss receipts during v8 migration.
- Do not rename existing public map IDs, boss IDs, reward-code IDs, class IDs, or weapon IDs.

## File Structure

### New focused modules

- `src/sanctuary-world-data-20260910-sanctuary.js` — sanctuary entrance override plus four interior physical-map definitions and portal graph.
- `src/sanctuary-story-data-20260910-sanctuary.js` — resonance nodes, required archive records, optional origin records, story actors, exact story text keys.
- `src/sanctuary-ending-state-20260910-sanctuary.js` — pure ending eligibility, permanent choice, title, and idempotent reward transitions.
- `src/sanctuary-ending-script-20260910-sanctuary.js` — exact approved restore/seal/resonate dialogue, cameo branches, credits and post-credit frames.
- `src/sanctuary-ending-controller-20260910-sanctuary.js` — DOM cutscene/choice/credits timing, input lock, 5-second skip gate, completion callbacks.
- `src/trinity-boss-20260910-sanctuary.js` — local TRINITY phase/state simulation and render model.
- `src/origin-boss-state-20260910-sanctuary.js` — ORIGIN-specific normalization, four phases, core anchors, defeat-receipt behavior on top of shared boss state.
- `src/origin-boss-controller-20260910-sanctuary.js` — deterministic ORIGIN AI/telegraphs/anchor lifecycle and player-damage events.
- `src/boss-attack-validation-20260910-sanctuary.js` — shared player-to-boss attack validation extracted from the current cooperative boss state so regional bosses and ORIGIN use one security contract.

### Versioned replacements of existing release modules

- `src/region-data-20260910-sanctuary.js`
- `src/world-data-20260910-sanctuary.js`
- `src/chapter-progress-20260910-sanctuary.js`
- `src/progress-storage-20260910-sanctuary.js`
- `src/quest-state-20260910-sanctuary.js`
- `src/story-interactions-20260910-sanctuary.js`
- `src/story-dialogue-20260910-sanctuary.js`
- `src/quest-guidance-20260910-sanctuary.js`
- `src/enemy-definitions-20260910-sanctuary.js`
- `src/enemy-behaviors-20260910-sanctuary.js`
- `src/enemies-20260910-sanctuary.js`
- `src/world-20260910-sanctuary.js`
- `src/coop-boss-data-20260910-sanctuary.js`
- `src/coop-boss-state-20260910-sanctuary.js`
- `src/coop-boss-controller-20260910-sanctuary.js`
- `src/coop-boss-network-20260910-sanctuary.js`
- `src/network-state-20260910-sanctuary.js`
- `src/network-20260910-sanctuary.js`
- `src/qa-mode-20260910-sanctuary.js`
- `src/game-20260910-sanctuary.js`
- `src/main-20260910-sanctuary.js`
- `styles-20260910-sanctuary.css`

### Existing files modified in place

- `index.html` — ending overlay/credits markup, sanctuary QA buttons, new CSS and main-module URLs.
- `database.rules.json` — four sanctuary map IDs and ORIGIN shared-boss validation.
- `.github/workflows/browser-smoke.yml` — sanctuary browser journey.
- `README.md` — 15-map world, Chapter 4, endings and controls/recovery behavior.
- `FIREBASE_SETUP.md` — ORIGIN path/rules contract.

### New/expanded tests

- `tests/sanctuary-chapter-progress.test.mjs`
- `tests/sanctuary-world-data.test.mjs`
- `tests/sanctuary-story-interactions.test.mjs`
- `tests/sanctuary-ending-state.test.mjs`
- `tests/sanctuary-ending-script.test.mjs`
- `tests/trinity-boss.test.mjs`
- `tests/origin-boss-state.test.mjs`
- `tests/origin-boss-controller.test.mjs`
- `tests/game-sanctuary-story.test.mjs`
- `tests/game-sanctuary-combat.test.mjs`
- `tests/game-sanctuary-ending.test.mjs`
- `tests/sanctuary-cache-contract.test.mjs`
- `tests/sanctuary-browser-smoke.cjs`
- Modify existing progress, world, region, boss, network, Firebase rules, QA, CI and static UI tests where the global contract grows from 11 to 15 maps.

---

### Task 1: Sanctuary progression state and v8 persistence

**Files:**
- Create: `src/chapter-progress-20260910-sanctuary.js`
- Create: `src/progress-storage-20260910-sanctuary.js`
- Create: `src/quest-state-20260910-sanctuary.js`
- Create: `tests/sanctuary-chapter-progress.test.mjs`
- Modify: `tests/chapter-progress.test.mjs`
- Modify: `tests/progress-storage.test.mjs`

**Interfaces:**
- Produces: `createInitialSanctuaryChapter(): SanctuaryChapter`.
- Produces: `activateSanctuaryResonanceNode(progress, nodeId): TransitionResult`.
- Produces: `restoreSanctuaryArchive(progress, archiveId): TransitionResult`.
- Produces: `collectOriginRecord(progress, recordId): TransitionResult`.
- Produces: `recordTrinityDefeat(progress): TransitionResult`.
- Produces: `recordOriginDefeat(progress, receiptId): TransitionResult`.
- Produces: `SANCTUARY_RESONANCE_NODE_IDS`, `SANCTUARY_ARCHIVE_IDS`, `SANCTUARY_ORIGIN_RECORD_IDS`.
- Extends `worldProgress.chapters.sanctuary` with `activatedResonanceNodeIds`, `restoredArchiveIds`, `originRecordIds`, `trinityDefeated`, `originDefeated`, `originDefeatReceiptId`, `endingChoice`, `endingRewardClaimed`, `chapterCompleted`.
- Extends player progress with `endingTitle: null | string`.
- Storage key becomes `pixel-world.progress.v8:<nickname>` and exports `v7ProgressStorageKey(nickname)` for migration tests.

- [ ] **Step 1: Write failing initial-state and progression tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  activateSanctuaryResonanceNode,
  collectOriginRecord,
  createInitialWorldProgress,
  recordOriginDefeat,
  recordTrinityDefeat,
  restoreSanctuaryArchive,
} from "../src/chapter-progress-20260910-sanctuary.js";

test("sanctuary starts unlocked only at the entrance after volcano completion", () => {
  const progress = createInitialWorldProgress();
  assert.deepEqual(progress.chapters.sanctuary, {
    activatedResonanceNodeIds: [],
    restoredArchiveIds: [],
    originRecordIds: [],
    trinityDefeated: false,
    originDefeated: false,
    originDefeatReceiptId: null,
    endingChoice: null,
    endingRewardClaimed: false,
    chapterCompleted: false,
  });
});

test("three resonance nodes unlock the archive and three archive truths unlock zero boundary", () => {
  let progress = sanctuaryUnlockedProgress();
  for (const id of ["life-resonance", "memory-resonance", "energy-resonance"]) {
    progress = activateSanctuaryResonanceNode(progress, id).progress;
  }
  assert.ok(progress.unlockedMapIds.includes("sanctuary-origin-archive"));
  for (const id of ["archive-aren-split", "archive-vanguard-entry", "archive-defense-protocol"]) {
    progress = restoreSanctuaryArchive(progress, id).progress;
  }
  assert.ok(progress.unlockedMapIds.includes("sanctuary-zero-boundary"));
});

test("origin records are optional for map progression", () => {
  const ready = zeroBoundaryUnlockedProgress({ originRecordIds: [] });
  const defeated = recordTrinityDefeat(ready).progress;
  assert.ok(defeated.unlockedMapIds.includes("sanctuary-core-heart"));
  assert.deepEqual(defeated.chapters.sanctuary.originRecordIds, []);
});

test("origin defeat persists one receipt and does not choose an ending", () => {
  const result = recordOriginDefeat(originReadyProgress(), "origin-encounter-1").progress;
  assert.equal(result.chapters.sanctuary.originDefeated, true);
  assert.equal(result.chapters.sanctuary.originDefeatReceiptId, "origin-encounter-1");
  assert.equal(result.chapters.sanctuary.endingChoice, null);
});
```

- [ ] **Step 2: Run the new tests and verify missing sanctuary APIs fail**

Run: `node --test tests/sanctuary-chapter-progress.test.mjs`

Expected: FAIL because `chapter-progress-20260910-sanctuary.js` and the sanctuary transitions do not exist yet.

- [ ] **Step 3: Implement the immutable sanctuary state and transitions**

```js
export const SANCTUARY_RESONANCE_NODE_IDS = Object.freeze([
  "life-resonance", "memory-resonance", "energy-resonance",
]);
export const SANCTUARY_ARCHIVE_IDS = Object.freeze([
  "archive-aren-split", "archive-vanguard-entry", "archive-defense-protocol",
]);
export const SANCTUARY_ORIGIN_RECORD_IDS = Object.freeze([
  "origin-record-single-authority",
  "origin-record-sealed-recovery",
  "origin-record-mutual-validation",
]);

export function createInitialSanctuaryChapter() {
  return {
    activatedResonanceNodeIds: [],
    restoredArchiveIds: [],
    originRecordIds: [],
    trinityDefeated: false,
    originDefeated: false,
    originDefeatReceiptId: null,
    endingChoice: null,
    endingRewardClaimed: false,
    chapterCompleted: false,
  };
}
```

Use the existing `transition()`/`unlockMap()` pattern. All setters must be idempotent and normalization must discard unknown IDs while preserving valid terminal flags.

- [ ] **Step 4: Write failing v8 migration and corruption-repair tests**

```js
test("v7 save migrates to v8 without losing volcano, equipment or reward codes", () => {
  const storage = storageWithV7CompletedVolcano();
  const loaded = loadProgressWithStatus(storage, "성역테스트");
  assert.match(progressStorageKey("성역테스트"), /^pixel-world\.progress\.v8:/);
  assert.equal(loaded.progress.worldProgress.chapters.volcano.captainOutcome, "rescued");
  assert.equal(loaded.progress.worldProgress.chapters.volcano.coreFragmentObtained, true);
  assert.ok(loaded.progress.equipmentByClass.warrior.ownedWeaponIds.includes("volcanic-heartblade"));
  assert.deepEqual(loaded.progress.redeemedCodeIds, ["JAEHOON"]);
  assert.equal(loaded.progress.worldProgress.chapters.sanctuary.originDefeated, false);
});

test("invalid ending and duplicate sanctuary ids are repaired on load", () => {
  const loaded = normalizeWorldProgress(corruptSanctuaryProgress());
  assert.equal(loaded.chapters.sanctuary.endingChoice, null);
  assert.equal(new Set(loaded.chapters.sanctuary.originRecordIds).size, loaded.chapters.sanctuary.originRecordIds.length);
});
```

- [ ] **Step 5: Implement v8 read/write and v7→v8 migration**

Set `STORAGE_VERSION = 8`, `STORAGE_PREFIX = "pixel-world.progress.v8:"`, keep explicit v7 through v1 fallback keys, include `endingTitle`, and route all legacy `worldProgress` through the new `normalizeWorldProgress()`.

- [ ] **Step 6: Run focused persistence tests**

Run: `node --test tests/sanctuary-chapter-progress.test.mjs tests/chapter-progress.test.mjs tests/progress-storage.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 7: Commit**

```bash
git add src/chapter-progress-20260910-sanctuary.js src/progress-storage-20260910-sanctuary.js src/quest-state-20260910-sanctuary.js tests/sanctuary-chapter-progress.test.mjs tests/chapter-progress.test.mjs tests/progress-storage.test.mjs
git commit -m "feat: add sanctuary progress and v8 persistence"
```

### Task 2: Five-map sanctuary world and portal graph

**Files:**
- Create: `src/sanctuary-world-data-20260910-sanctuary.js`
- Create: `src/region-data-20260910-sanctuary.js`
- Create: `src/world-data-20260910-sanctuary.js`
- Create: `tests/sanctuary-world-data.test.mjs`
- Modify: `tests/region-data.test.mjs`
- Modify: `tests/world-data.test.mjs`
- Modify: `tests/portal-transition.test.mjs`

**Interfaces:**
- Consumes: Task 1 sanctuary chapter flags and unlocked-map contract.
- Produces: `SANCTUARY_WORLD_DEFINITIONS` for `sanctuary`, `sanctuary-resonance-hall`, `sanctuary-origin-archive`, `sanctuary-zero-boundary`, `sanctuary-core-heart`.
- `REGION_DEFINITIONS.sanctuary.mapIds` contains all five IDs.
- `WORLD_IDS.length === 15`.
- Safe flags: entrance `true`, origin archive `true`; resonance hall, zero boundary and core heart `false`.

- [ ] **Step 1: Write failing map-size, portal and safe-zone tests**

```js
test("sanctuary owns five fixed-size maps and world count is fifteen", () => {
  const ids = REGION_DEFINITIONS.sanctuary.mapIds;
  assert.deepEqual(ids, [
    "sanctuary",
    "sanctuary-resonance-hall",
    "sanctuary-origin-archive",
    "sanctuary-zero-boundary",
    "sanctuary-core-heart",
  ]);
  assert.equal(WORLD_IDS.length, 15);
  for (const id of ids) {
    assert.equal(getWorldDefinition(id).width, 2160);
    assert.equal(getWorldDefinition(id).height, 1800);
  }
});

test("sanctuary portals are bidirectional before ending confirmation", () => {
  assert.equal(getPortalDestination("sanctuary", "to-resonance-hall").mapId, "sanctuary-resonance-hall");
  assert.equal(getPortalDestination("sanctuary-resonance-hall", "to-sanctuary").mapId, "sanctuary");
  assert.equal(getPortalDestination("sanctuary-core-heart", "to-zero-boundary").mapId, "sanctuary-zero-boundary");
});
```

- [ ] **Step 2: Run world tests and verify failure**

Run: `node --test tests/sanctuary-world-data.test.mjs tests/region-data.test.mjs tests/world-data.test.mjs tests/portal-transition.test.mjs`

Expected: FAIL because the four interior IDs are absent.

- [ ] **Step 3: Implement the sanctuary definitions without changing volcano map IDs**

`sanctuary-world-data-20260910-sanctuary.js` imports the current volcano release definitions, clones only the existing sanctuary entrance to add `to-resonance-hall`, and defines the four interiors. Use existing portal requirements with map-unlock flags; do not add a new requirement type.

```js
export const SANCTUARY_MAP_IDS = Object.freeze([
  "sanctuary",
  "sanctuary-resonance-hall",
  "sanctuary-origin-archive",
  "sanctuary-zero-boundary",
  "sanctuary-core-heart",
]);
```

- [ ] **Step 4: Add deterministic collision/portal assertions**

Ensure every spawn point is outside obstacles, every destination lands inside its map, and no reverse portal requires an ending choice.

- [ ] **Step 5: Run focused map tests**

Run: `node --test tests/sanctuary-world-data.test.mjs tests/region-data.test.mjs tests/world-data.test.mjs tests/portal-transition.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sanctuary-world-data-20260910-sanctuary.js src/region-data-20260910-sanctuary.js src/world-data-20260910-sanctuary.js tests/sanctuary-world-data.test.mjs tests/region-data.test.mjs tests/world-data.test.mjs tests/portal-transition.test.mjs
git commit -m "feat: add pixel core sanctuary maps"
```

### Task 3: Sanctuary story interactions, truth records and quest guidance

**Files:**
- Create: `src/sanctuary-story-data-20260910-sanctuary.js`
- Create: `src/story-interactions-20260910-sanctuary.js`
- Create: `src/story-dialogue-20260910-sanctuary.js`
- Create: `src/quest-guidance-20260910-sanctuary.js`
- Create: `tests/sanctuary-story-interactions.test.mjs`
- Modify: `tests/story-interactions.test.mjs`
- Modify: `tests/story-rendering.test.mjs`
- Modify: `tests/quest-guidance.test.mjs`

**Interfaces:**
- Consumes: Task 1 transition functions and Task 2 map IDs.
- Produces: `SANCTUARY_STORY_INTERACTIONS`, `SANCTUARY_STORY_ACTORS`, `getOriginRecords(progress)`, sanctuary-aware `ALL_STORY_INTERACTIONS`, `storyDialogueModel()` and `storyGuidance()`.
- Required resonance interaction IDs: `life-resonance`, `memory-resonance`, `energy-resonance`.
- Required archive interaction IDs: `archive-aren-split`, `archive-vanguard-entry`, `archive-defense-protocol`.
- Optional origin records are exactly the three IDs from Task 1, one in resonance hall, archive and zero boundary respectively.

- [ ] **Step 1: Write failing eligibility and branching tests**

```js
test("archive stays locked until all three resonance nodes are active", () => {
  const interaction = SANCTUARY_STORY_INTERACTIONS.find(v => v.id === "archive-aren-split");
  assert.equal(isStoryInteractionEligible(interaction, oneResonanceProgress()), false);
  assert.equal(isStoryInteractionEligible(interaction, threeResonanceProgress()), true);
});

test("captain outcome changes presentation but never ending eligibility", () => {
  const alive = storyDialogueModel(originArchiveConsole(), sanctuaryStoryProgress({ captainOutcome: "rescued" }));
  const lost = storyDialogueModel(originArchiveConsole(), sanctuaryStoryProgress({ captainOutcome: "lost" }));
  assert.match(alive.pages.join(" "), /선발대장/);
  assert.match(lost.pages.join(" "), /마지막.*기록/);
});

test("coast support choice changes narrator copy only", () => {
  assert.notEqual(
    storyDialogueModel(finalPerspectiveSignal(), supportProgress("sera")).pages.at(-1),
    storyDialogueModel(finalPerspectiveSignal(), supportProgress("echo")).pages.at(-1),
  );
});
```

- [ ] **Step 2: Run story tests and verify failure**

Run: `node --test tests/sanctuary-story-interactions.test.mjs tests/story-interactions.test.mjs tests/quest-guidance.test.mjs`

- [ ] **Step 3: Extend the unified story resolver**

Add sanctuary dispatch beside coast/volcano without altering their behavior. Merge all three chapter substates when a delegated transition returns.

```js
export const ALL_STORY_INTERACTIONS = Object.freeze([
  ...COAST_STORY_INTERACTIONS,
  ...VOLCANO_STORY_INTERACTIONS,
  ...SANCTUARY_STORY_INTERACTIONS,
]);
```

- [ ] **Step 4: Implement exact truth delivery and optional origin-record copy**

The three archive records must reveal, in order: A렌 split the admin powers; the vanguard re-entered; the captain's emergency access triggered the core defense protocol. Optional origin records must contain the three approved principles used by the resonance ending and must not be required to unlock the next map.

- [ ] **Step 5: Add sanctuary objective guidance**

Guidance priority is: activate remaining resonance node → restore remaining required archive → defeat TRINITY → enter core heart → defeat ORIGIN → choose ending or backtrack for missing origin records. When ORIGIN is defeated and records are `<3`, guidance explicitly says `결정 보류 가능 · 원점 기록 n/3`.

- [ ] **Step 6: Run focused story/guidance tests**

Run: `node --test tests/sanctuary-story-interactions.test.mjs tests/story-interactions.test.mjs tests/story-rendering.test.mjs tests/quest-guidance.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sanctuary-story-data-20260910-sanctuary.js src/story-interactions-20260910-sanctuary.js src/story-dialogue-20260910-sanctuary.js src/quest-guidance-20260910-sanctuary.js tests/sanctuary-story-interactions.test.mjs tests/story-interactions.test.mjs tests/story-rendering.test.mjs tests/quest-guidance.test.mjs
git commit -m "feat: add sanctuary truth and story guidance"
```

### Task 4: Sanctuary enemies and local TRINITY encounter

**Files:**
- Create: `src/enemy-definitions-20260910-sanctuary.js`
- Create: `src/enemy-behaviors-20260910-sanctuary.js`
- Create: `src/enemies-20260910-sanctuary.js`
- Create: `src/trinity-boss-20260910-sanctuary.js`
- Create: `tests/trinity-boss.test.mjs`
- Modify: `tests/enemy-definitions.test.mjs`
- Modify: `tests/enemy-behaviors.test.mjs`
- Modify: `tests/enemies.test.mjs`

**Interfaces:**
- Produces enemy kinds `defect-pixel`, `core-sentinel`, `rewrite-echo`.
- Produces `createTrinityEncounter({ now }): TrinityEncounter` with `maxHp: 800`.
- Produces `trinityPhaseForHp(hp, maxHp): "life" | "memory" | "energy" | "mixed"`.
- Produces `advanceTrinityEncounter(state, dt, context): { state, events }`.
- Produces `applyTrinityDamage(state, damage): { state, defeated }`.
- TRINITY state is never serialized to Firebase.

- [ ] **Step 1: Write failing enemy and phase-boundary tests**

```js
test("TRINITY uses the approved 800 HP and phase thresholds", () => {
  const boss = createTrinityEncounter({ now: 0 });
  assert.equal(boss.maxHp, 800);
  assert.equal(trinityPhaseForHp(800, 800), "life");
  assert.equal(trinityPhaseForHp(560, 800), "memory");
  assert.equal(trinityPhaseForHp(320, 800), "energy");
  assert.equal(trinityPhaseForHp(160, 800), "mixed");
});
```

- [ ] **Step 2: Write failing deterministic attack-cycle tests**

For fixed RNG input, assert life emits charge/root, memory emits projectile/decoy, energy emits teleport/eruption, and mixed selects only from the union while respecting telegraph time.

- [ ] **Step 3: Run tests and verify failure**

Run: `node --test tests/trinity-boss.test.mjs tests/enemy-definitions.test.mjs tests/enemy-behaviors.test.mjs tests/enemies.test.mjs`

- [ ] **Step 4: Implement the three enemy behaviors and TRINITY pure state machine**

Do not require Q/E/R to progress; the boss must accept all valid player attack kinds. Clamp HP at zero and emit exactly one `trinity-defeated` event on the positive→zero transition.

- [ ] **Step 5: Add explicit reward-code isolation test**

```js
test("BOSSKILLBOSS never changes TRINITY count", () => {
  assert.equal(trinityEncounterCount({ bossCount: 3 }), 1);
});
```

`trinityEncounterCount()` always returns `1`; it exists to make the exclusion explicit at the integration boundary.

- [ ] **Step 6: Run focused combat tests**

Run: `node --test tests/trinity-boss.test.mjs tests/enemy-definitions.test.mjs tests/enemy-behaviors.test.mjs tests/enemies.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/enemy-definitions-20260910-sanctuary.js src/enemy-behaviors-20260910-sanctuary.js src/enemies-20260910-sanctuary.js src/trinity-boss-20260910-sanctuary.js tests/trinity-boss.test.mjs tests/enemy-definitions.test.mjs tests/enemy-behaviors.test.mjs tests/enemies.test.mjs
git commit -m "feat: add sanctuary enemies and trinity boss"
```

### Task 5: Shared attack validation and ORIGIN-0 four-phase state

**Files:**
- Create: `src/boss-attack-validation-20260910-sanctuary.js`
- Create: `src/coop-boss-data-20260910-sanctuary.js`
- Create: `src/coop-boss-state-20260910-sanctuary.js`
- Create: `src/origin-boss-state-20260910-sanctuary.js`
- Create: `tests/origin-boss-state.test.mjs`
- Modify: `tests/coop-boss-data.test.mjs`
- Modify: `tests/coop-boss-state.test.mjs`

**Interfaces:**
- `getCoopBossForMap(mapId)` now returns all shared bosses including ORIGIN.
- Each boss definition adds `bossClass: "regional" | "final"` and `tripleEligible: boolean`.
- Existing forest/coast/volcano definitions are `bossClass: "regional", tripleEligible: true`.
- ORIGIN definition: `{ id: "origin-zero", mapId: "sanctuary-core-heart", name: "ORIGIN-0 — 최초의 수호자", baseHp: 1200, rewardExp: 0, rewardGold: 0, bossClass: "final", tripleEligible: false }`.
- Produces `validatePlayerBossAttack(request, validation): ValidationResult`; regional `validateBossAttack()` delegates to this unchanged contract.
- Produces `createOriginEncounter(options)`, `normalizeOriginEncounter(value)`, `originPhaseForHp(hp,maxHp)`, `applyOriginAttack(value,validated,now)`.
- ORIGIN encounter extends base shared state with `originPhase`, `anchors`, `rewriteCycle`, `completionClaimWritten`.

- [ ] **Step 1: Extract the existing attack validator behind a failing equivalence test**

```js
test("regional boss attack validation stays byte-for-byte equivalent after extraction", () => {
  const request = validWarriorBasicAttack();
  const validation = regionalBossValidation();
  assert.deepEqual(
    validateBossAttack(request, validation),
    validatePlayerBossAttack(request, validation),
  );
});
```

- [ ] **Step 2: Run the equivalence test and confirm the shared helper is missing**

Run: `node --test tests/coop-boss-state.test.mjs`

- [ ] **Step 3: Move validation logic without changing regional results**

The new helper keeps current UID, player position, sequence, class, weapon, level, MP resource, cast/hit index, cooldown, timestamp, geometry and range checks. `coop-boss-state` retains its public `validateBossAttack()` export as a thin delegate for compatibility.

- [ ] **Step 4: Write failing ORIGIN definition/state tests**

```js
test("ORIGIN is shared but never triple-eligible", () => {
  const origin = getCoopBossForMap("sanctuary-core-heart");
  assert.equal(origin.id, "origin-zero");
  assert.equal(origin.baseHp, 1200);
  assert.equal(origin.bossClass, "final");
  assert.equal(origin.tripleEligible, false);
});

test("ORIGIN phases are 100-75, 75-50, 50-25 and 25-0", () => {
  assert.equal(originPhaseForHp(1200, 1200), "life");
  assert.equal(originPhaseForHp(899, 1200), "memory");
  assert.equal(originPhaseForHp(599, 1200), "energy");
  assert.equal(originPhaseForHp(299, 1200), "rewrite");
});
```

- [ ] **Step 5: Implement ORIGIN state wrapper and anchor normalization**

Anchor IDs are exactly `origin-anchor-life`, `origin-anchor-memory`, `origin-anchor-energy`. During rewrite phase, `anchors` is a keyed object with `{ active, hp, maxHp, x, y }`. Unknown anchors are removed by normalization. ORIGIN may reach HP zero only after the current rewrite anchor set is cleared; otherwise validated damage is ignored with `blockedByAnchors: true`.

- [ ] **Step 6: Run state and regional regression tests**

Run: `node --test tests/origin-boss-state.test.mjs tests/coop-boss-data.test.mjs tests/coop-boss-state.test.mjs tests/skill-validation.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/boss-attack-validation-20260910-sanctuary.js src/coop-boss-data-20260910-sanctuary.js src/coop-boss-state-20260910-sanctuary.js src/origin-boss-state-20260910-sanctuary.js tests/origin-boss-state.test.mjs tests/coop-boss-data.test.mjs tests/coop-boss-state.test.mjs
git commit -m "feat: add origin shared boss state"
```

### Task 6: ORIGIN AI, authority transfer, online transport and Firebase rules

**Files:**
- Create: `src/origin-boss-controller-20260910-sanctuary.js`
- Create: `src/coop-boss-controller-20260910-sanctuary.js`
- Create: `src/coop-boss-network-20260910-sanctuary.js`
- Create: `src/network-state-20260910-sanctuary.js`
- Create: `src/network-20260910-sanctuary.js`
- Create: `tests/origin-boss-controller.test.mjs`
- Modify: `tests/coop-boss-controller.test.mjs`
- Modify: `tests/coop-boss-network.test.mjs`
- Modify: `tests/network-state.test.mjs`
- Modify: `tests/database-rules.test.mjs`
- Modify: `tests/coop-boss-rules.test.mjs`
- Modify: `tests/firebase-rules-emulator.cjs`
- Modify: `database.rules.json`

**Interfaces:**
- Consumes: Task 5 ORIGIN definition/state and current `rooms/public/bosses/{mapId}` transport.
- Produces `advanceOriginAuthorityState(encounter, dt, context): { encounter, events }`.
- `createCoopBossNetwork().setMap("sanctuary-core-heart")` subscribes to the normal `state`, `attacks`, `playerDamage`, and `rewardClaims` paths.
- ORIGIN uses existing `rewardClaims` only as a zero-value defeat receipt: `exp: 0`, `gold: 0`. Claiming it records local `originDefeated`; it does not call `grantCoopBossReward()`.

- [ ] **Step 1: Write failing deterministic controller tests**

```js
test("rewrite phase telegraphs deletion before damage and creates exactly three anchors", () => {
  const result = advanceOriginAuthorityState(rewriteEncounter(), 0.1, fixedContext());
  assert.equal(result.encounter.originPhase, "rewrite");
  assert.deepEqual(Object.keys(result.encounter.anchors).sort(), [
    "origin-anchor-energy", "origin-anchor-life", "origin-anchor-memory",
  ]);
  assert.equal(result.events.some(event => event.type === "rewrite-impact"), false);
  assert.equal(result.events.some(event => event.type === "rewrite-warning"), true);
});
```

- [ ] **Step 2: Write authority-handoff state preservation test**

An expired lease acquired by a second UID must retain `originPhase`, current HP, anchor HP and rewrite timer while incrementing `authorityEpoch` exactly once.

- [ ] **Step 3: Run ORIGIN/controller/network tests and confirm failure**

Run: `node --test tests/origin-boss-controller.test.mjs tests/coop-boss-controller.test.mjs tests/coop-boss-network.test.mjs tests/network-state.test.mjs`

- [ ] **Step 4: Implement controller phase attacks**

Life: charge/root/close shock. Memory: projectile/wave/decoy. Energy: teleport/eruption/explosion. Rewrite: mixed attacks plus telegraphed deletion zones and three anchors. Controller emits targeted player-damage events through the same authority epoch/sequence contract used by regional bosses.

- [ ] **Step 5: Extend network transport to ORIGIN without creating a second Firebase room model**

`setMap()` accepts ORIGIN because it is in shared boss data. `ensureEncounter()` dispatches to `createOriginEncounter()` for `bossClass === "final"`, otherwise to the existing `createBossEncounter()` path. Reward claims for ORIGIN contain zero currency/EXP and are treated as clear receipts by game integration.

- [ ] **Step 6: Write and implement Firebase allow/deny rules**

Add the four new sanctuary map IDs to player presence bounds. Add `sanctuary-core-heart` to the shared boss map whitelist with boss ID `origin-zero`, max coordinates `2160 × 1800`, party size `1..10`, and nested validation for `originPhase`, three known anchors, finite anchor HP, rewrite timing fields, authority ownership and player attacks. Reject unknown anchor IDs, client-written authority epochs, invalid boss IDs, and ORIGIN writes from players not in `sanctuary-core-heart`.

- [ ] **Step 7: Run static and emulator rule tests**

Run:

```bash
node --test tests/database-rules.test.mjs tests/coop-boss-rules.test.mjs
npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"
```

Expected: all allow cases pass and all deny cases remain denied.

- [ ] **Step 8: Run focused network regression**

Run: `node --test tests/origin-boss-controller.test.mjs tests/coop-boss-controller.test.mjs tests/coop-boss-network.test.mjs tests/network-state.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/origin-boss-controller-20260910-sanctuary.js src/coop-boss-controller-20260910-sanctuary.js src/coop-boss-network-20260910-sanctuary.js src/network-state-20260910-sanctuary.js src/network-20260910-sanctuary.js tests/origin-boss-controller.test.mjs tests/coop-boss-controller.test.mjs tests/coop-boss-network.test.mjs tests/network-state.test.mjs tests/database-rules.test.mjs tests/coop-boss-rules.test.mjs tests/firebase-rules-emulator.cjs database.rules.json
git commit -m "feat: add online origin boss authority and rules"
```

### Task 7: Permanent ending state, idempotent rewards and storage-failure recovery

**Files:**
- Create: `src/sanctuary-ending-state-20260910-sanctuary.js`
- Create: `tests/sanctuary-ending-state.test.mjs`
- Modify: `tests/progress-storage.test.mjs`
- Modify: `tests/player-progression.test.mjs`

**Interfaces:**
- Produces `SANCTUARY_ENDING_CHOICES = ["restore", "seal", "resonate"]`.
- Produces `availableSanctuaryEndings(progress): Array<{ id, unlocked, reason }>`.
- Produces `chooseSanctuaryEnding(progress, choice): { progress, changed, reason }`.
- Produces `sanctuaryEndingTitle(choice): string | null`.
- Produces `grantSanctuaryEndingReward(progress): { progress, changed, reason }`.
- `chooseSanctuaryEnding()` requires `originDefeated === true`, refuses a second choice, and requires all three origin records only for `resonate`.
- `grantSanctuaryEndingReward()` grants exactly EXP 500 + Gold 1000, assigns the exact title, sets `endingRewardClaimed = true` and `chapterCompleted = true`, and is a no-op after the first successful transition.

- [ ] **Step 1: Write failing eligibility tests**

```js
test("resonate alone requires three origin records", () => {
  const choices = availableSanctuaryEndings(originDefeatedProgress({ originRecordIds: [] }));
  assert.equal(choices.find(v => v.id === "restore").unlocked, true);
  assert.equal(choices.find(v => v.id === "seal").unlocked, true);
  assert.equal(choices.find(v => v.id === "resonate").unlocked, false);
  assert.equal(choices.find(v => v.id === "resonate").reason, "origin_records_3_required");
});
```

- [ ] **Step 2: Write failing permanent-choice and reward-idempotency tests**

```js
test("first ending is permanent and reward pays once", () => {
  const chosen = chooseSanctuaryEnding(resonanceReadyProgress(), "resonate").progress;
  assert.equal(chooseSanctuaryEnding(chosen, "restore").changed, false);
  const once = grantSanctuaryEndingReward(chosen).progress;
  const twice = grantSanctuaryEndingReward(once).progress;
  assert.equal(twice.gold, once.gold);
  assert.equal(twice.exp, once.exp);
  assert.equal(twice.endingTitle, "세계의 공명자");
});
```

- [ ] **Step 3: Run and verify failure**

Run: `node --test tests/sanctuary-ending-state.test.mjs tests/progress-storage.test.mjs tests/player-progression.test.mjs`

- [ ] **Step 4: Implement pure ending transitions using existing level-up reward logic**

Call the existing progression reward helper so EXP 500 can cross multiple level thresholds correctly. Never calculate level-up manually in the ending module.

- [ ] **Step 5: Add two-phase storage contract tests**

Model game persistence with two writes: first write stores `endingChoice`; second write stores reward/title. If write 1 fails, in-memory state remains pre-choice and cutscene must not begin. If write 2 fails, reload sees the saved choice with `endingRewardClaimed === false`, and the next reward attempt grants exactly once.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/sanctuary-ending-state.test.mjs tests/progress-storage.test.mjs tests/player-progression.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sanctuary-ending-state-20260910-sanctuary.js tests/sanctuary-ending-state.test.mjs tests/progress-storage.test.mjs tests/player-progression.test.mjs
git commit -m "feat: add permanent sanctuary endings and rewards"
```

### Task 8: Exact ending scripts, final-choice UI, credits and post-credit sequence

**Files:**
- Create: `src/sanctuary-ending-script-20260910-sanctuary.js`
- Create: `src/sanctuary-ending-controller-20260910-sanctuary.js`
- Create: `styles-20260910-sanctuary.css`
- Create: `tests/sanctuary-ending-script.test.mjs`
- Create: `tests/sanctuary-ending-controller.test.mjs`
- Modify: `index.html`
- Modify: `tests/ui.static.test.cjs`

**Interfaces:**
- Produces `sanctuaryEndingScript({ choice, captainOutcome, supportChoice, playerName }): EndingScript` using the exact approved Korean dialogue in the spec.
- Produces `SanctuaryEndingController` with `openChoice(model)`, `playEnding(script)`, `skipCredits()`, `close()`, `active`, and callbacks `onChoose`, `onDefer`, `onCreditsComplete`.
- Credits duration exactly `30_000ms`, skip disabled until `5_000ms` elapsed.
- `결정 보류` closes the choice overlay and restores normal sanctuary control without setting `endingChoice`.

- [ ] **Step 1: Write failing copy-integrity tests**

Assert each ending contains its exact title, final narrator passage, title reward label and branch-specific cameo. Assert post-credit frames contain exactly `UNKNOWN NODE SIGNAL DETECTED` and `SOURCE: OUTSIDE CORE RANGE`.

- [ ] **Step 2: Write failing timing and accessibility tests**

```js
test("credits cannot be skipped before five seconds and always complete through post-credit", () => {
  const controller = endingControllerHarness();
  controller.playEnding(script);
  clock.advance(4_999);
  assert.equal(controller.skipCredits(), false);
  clock.advance(1);
  assert.equal(controller.skipCredits(), true);
  assert.equal(harness.postCreditPlayed, true);
});
```

Static HTML test must verify a labelled modal choice surface, three ending buttons, locked-reason text region, `결정 보류`, credits skip button and live subtitle region.

- [ ] **Step 3: Run tests and verify failure**

Run: `node --test tests/sanctuary-ending-script.test.mjs tests/sanctuary-ending-controller.test.mjs tests/ui.static.test.cjs`

- [ ] **Step 4: Implement script data from the approved spec without paraphrasing**

Store shared common-intro lines once and branch data separately, but rendered dialogue must match the approved script. Player name is escaped through text nodes, never `innerHTML`.

- [ ] **Step 5: Implement DOM controller and CSS**

During common intro/ending/credits set an explicit input-lock flag consumed by the game shell. Choice buttons perform the second confirmation before invoking `onChoose(choice)`. The resonance button remains visible but disabled with `원점 기록 3/3 필요` until eligible.

- [ ] **Step 6: Run focused UI/script tests**

Run: `node --test tests/sanctuary-ending-script.test.mjs tests/sanctuary-ending-controller.test.mjs tests/ui.static.test.cjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sanctuary-ending-script-20260910-sanctuary.js src/sanctuary-ending-controller-20260910-sanctuary.js styles-20260910-sanctuary.css index.html tests/sanctuary-ending-script.test.mjs tests/sanctuary-ending-controller.test.mjs tests/ui.static.test.cjs
git commit -m "feat: add sanctuary endings credits and cutscenes"
```

### Task 9: Game-shell integration, ORIGIN defeat recovery, titles and QA tools

**Files:**
- Create: `src/world-20260910-sanctuary.js`
- Create: `src/qa-mode-20260910-sanctuary.js`
- Create: `src/game-20260910-sanctuary.js`
- Create: `src/main-20260910-sanctuary.js`
- Create: `tests/game-sanctuary-story.test.mjs`
- Create: `tests/game-sanctuary-combat.test.mjs`
- Create: `tests/game-sanctuary-ending.test.mjs`
- Modify: `tests/game-qa.test.mjs`
- Modify: `tests/qa-mode.test.mjs`
- Modify: `tests/qa-ui.static.test.cjs`
- Modify: `index.html`

**Interfaces:**
- Consumes all Task 1-8 modules.
- `PixelRPG` owns one local TRINITY controller and uses shared coop boss controller/network only for ORIGIN in online mode.
- ORIGIN zero-value claim becomes `recordOriginDefeat(worldProgress, encounterId)` followed by `saveProgress()`; no EXP/Gold is granted at boss defeat.
- If local `originDefeated` is true and `endingChoice` is null, entering/interacting with the core opens final choice instead of spawning ORIGIN.
- Ending title is rendered under/near the local nickname and included in online presence only as display-safe optional text if and only if Firebase rules explicitly allow the three exact title strings; otherwise title remains local UI only. Default implementation is local UI only to avoid expanding presence data unnecessarily.

- [ ] **Step 1: Write failing full sanctuary progression adapter test**

Drive the game adapter from sanctuary entrance through three resonance nodes, archive truths, TRINITY defeat and core-heart entry. Assert each transition saves exactly once and failed storage restores the prior progress object.

- [ ] **Step 2: Write failing solo TRINITY/ORIGIN tests for all three classes**

For warrior, archer and mage, assert basic/Q/E/R valid attacks reduce boss HP, death/respawn resets transient casts, and `TEACHER` prevents solo ORIGIN damage without affecting online players.

- [ ] **Step 3: Write failing BOSSKILLBOSS isolation test**

```js
test("BOSSKILLBOSS remains regional-only in sanctuary", () => {
  const game = gameWithCodes(["BOSSKILLBOSS"]);
  game.travelTo("sanctuary-zero-boundary");
  assert.equal(game.activeTrinityBosses.length, 1);
  game.travelTo("sanctuary-core-heart");
  assert.equal(game.activeOriginBosses.length, 1);
});
```

- [ ] **Step 4: Write failing defeat/reconnect/defer tests**

Cover: online ORIGIN claim arrives → local receipt save succeeds → disconnect → reload → ORIGIN does not respawn → final choice opens. Cover `결정 보류` → walk back to origin record → collect 3/3 → return → resonate unlocks. Cover storage failure on receipt save by leaving the remote claim unconsumed/retryable rather than acknowledging success.

- [ ] **Step 5: Implement sanctuary rendering and game integration**

Add distinct visual treatment for the four interiors, story signals, record markers, deletion telegraphs, TRINITY and ORIGIN. Keep the large `game` shell orchestration-only: phase math remains in boss modules; ending copy/timing remains in ending modules.

- [ ] **Step 6: Integrate permanent ending save and idempotent reward retry**

On final confirmation: call `chooseSanctuaryEnding`, persist choice, then begin the chosen ending. After successful choice persistence, call `grantSanctuaryEndingReward` and persist reward state. If reward persistence fails, keep the choice but leave `endingRewardClaimed` false; retry before/after credits and again at next load until one save succeeds. Never re-run reward on a progress object where the marker is true.

- [ ] **Step 7: Return to village after post-credit and render title**

After `onCreditsComplete`, set current map to `village`, reset transient combat/skill states, restore controls, show the Part 1 completion banner and display `endingTitle` on the local HUD. Do not clear sanctuary progress.

- [ ] **Step 8: Extend QA tools**

Add buttons for all five sanctuary maps and helpers for `원점 기록 3/3`, TRINITY approach, ORIGIN approach, and each ending-ready state. QA helpers may mutate test progress only when QA mode is explicitly enabled.

- [ ] **Step 9: Run focused game integration tests**

Run:

```bash
node --test tests/game-sanctuary-story.test.mjs tests/game-sanctuary-combat.test.mjs tests/game-sanctuary-ending.test.mjs tests/game-qa.test.mjs tests/qa-mode.test.mjs tests/qa-ui.static.test.cjs
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/world-20260910-sanctuary.js src/qa-mode-20260910-sanctuary.js src/game-20260910-sanctuary.js src/main-20260910-sanctuary.js index.html tests/game-sanctuary-story.test.mjs tests/game-sanctuary-combat.test.mjs tests/game-sanctuary-ending.test.mjs tests/game-qa.test.mjs tests/qa-mode.test.mjs tests/qa-ui.static.test.cjs
git commit -m "feat: integrate pixel core sanctuary finale"
```

### Task 10: Cache-safe release graph, browser journeys, documentation and full verification

**Files:**
- Create: `tests/sanctuary-cache-contract.test.mjs`
- Create: `tests/sanctuary-browser-smoke.cjs`
- Modify: `.github/workflows/browser-smoke.yml`
- Modify: `tests/ci-workflow.test.mjs`
- Modify: `tests/firebase-hosting.test.mjs`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `FIREBASE_SETUP.md`

**Interfaces:**
- Browser entry is exactly `./src/main-20260910-sanctuary.js`.
- CSS entry is exactly `./styles-20260910-sanctuary.css`.
- The cache contract walks the new entry graph and rejects changed modules that still resolve through an unversioned or stale physical URL where a `20260910-sanctuary` replacement is required.
- Browser smoke covers solo and online sanctuary flows without bypassing production interaction APIs except explicit QA setup helpers.

- [ ] **Step 1: Write failing cache-contract and HTML-entry tests**

```js
test("sanctuary release uses one physical release graph", () => {
  assert.match(indexHtml, /styles-20260910-sanctuary\.css/);
  assert.match(indexHtml, /src\/main-20260910-sanctuary\.js/);
  assert.doesNotMatch(indexHtml, /main-20260903-volcano-20260905-upgrade\.js/);
});
```

- [ ] **Step 2: Run release tests and confirm the old entry fails the new expectation**

Run: `node --test tests/sanctuary-cache-contract.test.mjs tests/firebase-hosting.test.mjs tests/ci-workflow.test.mjs`

- [ ] **Step 3: Complete every transitive physical import update**

Start at `main-20260910-sanctuary.js`, traverse every changed import, and point it to the `20260910-sanctuary` file created by earlier tasks. Unchanged stable modules may retain their existing `20260905-upgrade` URL. The test must prove no changed parent imports an older copy of a changed child.

- [ ] **Step 4: Implement solo browser journey**

The Chromium journey creates/loads a completed-volcano save, enters sanctuary, activates three resonance nodes, restores three archive truths, collects all three origin records, defeats TRINITY, defeats ORIGIN, selects `resonate`, confirms title/reward once, verifies credits skip is unavailable before 5 seconds, completes post-credit, and lands in village with `세계의 공명자`.

- [ ] **Step 5: Implement alternate-ending/recovery browser journey**

A second solo journey defeats ORIGIN with only two origin records, verifies resonate is locked, selects `결정 보류`, backtracks for record 3, returns without an ORIGIN refight, and selects `restore` or `seal`. Reload must preserve the chosen title and must not grant another 500 EXP/1000 Gold.

- [ ] **Step 6: Implement two-browser online ORIGIN journey**

Two authenticated browser contexts enter `sanctuary-core-heart`, share one ORIGIN encounter/HP, verify authority transfer after the current authority leaves, finish the encounter, receive separate local defeat receipts, and make different ending choices. Assert one player's ending never changes the other player's local save. Also assert `TEACHER`/`BOSSKILLBOSS` do not appear in shared presence or multiply ORIGIN.

- [ ] **Step 7: Wire browser CI**

Add `tests/sanctuary-browser-smoke.cjs` to `.github/workflows/browser-smoke.yml` after the existing volcano smoke so earlier-region regressions are caught before the finale journey.

- [ ] **Step 8: Update README and Firebase setup docs**

Document all 15 maps, sanctuary flow, TRINITY local behavior, ORIGIN shared behavior, v8 save key, three endings, permanent choice, record-gated resonance, `결정 보류`, credits, titles, and the `rooms/public/bosses/sanctuary-core-heart` online path. Explicitly state that ending choice/title remain local and are not server economy data.

- [ ] **Step 9: Run complete Node and syntax verification**

```bash
node --test tests/*.test.mjs tests/*.static.test.cjs
for file in src/*.js; do node --check "$file"; done
node --check tests/sanctuary-browser-smoke.cjs
git diff --check
```

Expected: every command exits `0`; test summary reports zero failures.

- [ ] **Step 10: Run Firebase emulator verification**

```bash
npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"
```

Expected: exit `0`, including ORIGIN allow/deny cases.

- [ ] **Step 11: Run local browser smoke before PR**

```bash
python3 -m http.server 4173
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/browser-smoke.cjs
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/coast-browser-smoke.cjs
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/volcano-browser-smoke.cjs
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/sanctuary-browser-smoke.cjs
```

Expected: all four journeys exit `0`.

- [ ] **Step 12: Commit the release graph and verification assets**

```bash
git add .github/workflows/browser-smoke.yml index.html README.md FIREBASE_SETUP.md tests/sanctuary-cache-contract.test.mjs tests/sanctuary-browser-smoke.cjs tests/ci-workflow.test.mjs tests/firebase-hosting.test.mjs
git commit -m "test: verify pixel core sanctuary release"
```

### Task 11: PR gate and deployed-service verification

**Files:**
- No new implementation files unless verification discovers a defect; any correction must add/adjust a regression test in the responsible task's test file.

**Interfaces:**
- Consumes: verified Task 1-10 branch.
- Produces: one reviewable PR into `main`; merge occurs only after all required CI checks succeed.

- [ ] **Step 1: Compare the implementation branch with latest `main`**

Run:

```bash
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: branch contains latest main ancestry, diff check is clean, and changes are limited to Chapter 4/release dependencies/docs/tests.

- [ ] **Step 2: Re-run the complete verification commands from Task 10 on the exact PR head**

Do not reuse older results. Record the fresh Node test total, JS syntax count, Firebase emulator result and four browser smoke results in the PR body.

- [ ] **Step 3: Open PR**

Title: `feat: add pixel core sanctuary finale`

PR body must summarize: four sanctuary interiors, v8 migration, TRINITY, shared ORIGIN-0, three permanent endings, recovery-safe defer path, credits/post-credit, solo-only TEACHER, regional-only BOSSKILLBOSS, Firebase rule changes, and fresh verification results.

- [ ] **Step 4: Require these CI gates before merge**

- `Verify game`
- `Realtime Database emulator rules` / Firebase rules test
- `Solo and online browser smoke`
- GitHub Pages build/deploy checks applicable to the PR/merge configuration

No merge on a pending, skipped unexpectedly, cancelled or failed required check.

- [ ] **Step 5: After merge, verify production deployment records**

Confirm the merge SHA is the head for successful GitHub Pages deployment, Firebase Hosting deployment, and Firebase Database Rules deployment.

- [ ] **Step 6: Perform deployed smoke without mutating another player's save**

Use a fresh QA nickname. Verify entry, solo sanctuary load, one story interaction, and online room entry/exit. Full destructive ending QA remains covered by the browser test save/QA harness rather than a real player's nickname.

- [ ] **Step 7: Report final evidence**

Report exact merge SHA, CI conclusions, deployment conclusions, fresh test counts, browser journey outcomes, and any known non-blocking limitations. Do not claim a deployment or test passed without the corresponding fresh result.
