# Pixel Core Sanctuary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Chapter 4 `픽셀 코어 성역` as the Part 1 finale with four new sanctuary interior maps, v8 persistence, personal TRINITY combat, shared ORIGIN-0 combat, three permanent endings, credits/post-credit sequence, and recovery-safe solo/online completion.

**Architecture:** Extend the existing immutable chapter-progress and versioned ES-module release pattern. Keep TRINITY as a local/personal mid-boss even while the player is online. Register ORIGIN-0 as a shared boss so the existing public-room authority/network transport can be reused, but wrap the generic shared encounter with ORIGIN-specific phase/anchor state. Keep ending choice, title, and chapter completion in nickname-local v8 progress; Firebase stores only online presence/chat, the shared ORIGIN encounter, and short-lived defeat claims. Every changed transitive browser module is emitted under the physical suffix `20260910-sanctuary` so GitHub Pages and Firebase Hosting cannot mix old and new release graphs.

**Tech Stack:** Browser ES modules, Canvas 2D, DOM overlays, Node.js 24 built-in test runner, Playwright/Chromium browser smoke, Firebase Realtime Database and Rules Emulator, GitHub Actions, GitHub Pages, Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-09-09-pixel-core-sanctuary-design.md`

## Global Constraints

- Preserve existing `sanctuary` as the Pixel Core Sanctuary entrance map.
- Add exactly four interior maps: `sanctuary-resonance-hall`, `sanctuary-origin-archive`, `sanctuary-zero-boundary`, `sanctuary-core-heart`.
- All five sanctuary maps are exactly `2160 × 1800`; total physical map count becomes 15.
- Volcano completion unlocks both the existing sanctuary entrance and the first interior `sanctuary-resonance-hall`; later interiors unlock through Chapter 4 progression.
- Sanctuary interior portals rely on the existing `isMapUnlocked()` destination check. Do not introduce a new portal requirement type.
- The player may backtrack through sanctuary interiors until a permanent ending is confirmed.
- Resonance ending requires all three optional origin records; missing records never force a save restart because `결정 보류` remains available after ORIGIN defeat.
- TRINITY is a personal/local encounter in both solo and online play, base HP exactly `800`.
- ORIGIN-0 is the only new shared online boss, solo base HP exactly `1200`, maximum public-room party size remains 10.
- ORIGIN defeat must be persisted locally before final ending selection and prevents a forced refight while the ending remains undecided.
- After a local ORIGIN defeat receipt is saved, that client becomes a local ORIGIN spectator in `sanctuary-core-heart`: it does not send ORIGIN attacks, accept ORIGIN player-damage events, or render a later shared ORIGIN respawn while it is resolving its ending. Other players remain unaffected.
- Ending choices are exactly `restore`, `seal`, `resonate`; the first confirmed choice is permanent for the nickname.
- Ending rewards are exactly EXP `500`, Gold `1000`, and one non-combat title: `세계의 복원자`, `코어의 수호자`, or `세계의 공명자`.
- Ending reward payout is idempotent and guarded by `endingRewardClaimed`; storage failure must never duplicate EXP or Gold.
- Coast support choice (`sera`, `echo`, `mari`) changes dialogue only and never locks an ending.
- Volcano captain outcome (`rescued`, `lost`) changes cameo/record presentation only and never locks an ending.
- `TEACHER` remains solo-only and applies to ORIGIN combat in solo mode.
- `BOSSKILLBOSS` must never multiply TRINITY or ORIGIN-0; it remains limited to the existing forest/coast/volcano regional bosses.
- Credits last exactly `30_000ms`; skip becomes available only after `5_000ms`; the post-credit `UNKNOWN NODE SIGNAL DETECTED / SOURCE: OUTSIDE CORE RANGE` always plays before returning to village.
- No ending-replay feature is added.
- No per-player ending data is added to Firebase. Firebase is used only for online presence/chat/shared ORIGIN combat and defeat-claim recovery.
- Preserve all v1-v7 progress, quests, inventory, codes, class equipment, coast/volcano decisions, hidden weapons, and claimed boss receipts during v8 migration.
- Do not rename existing public map IDs, boss IDs, reward-code IDs, class IDs, or weapon IDs.

## Shared Interface Contracts

Use these exact plain-object contracts across tasks:

```js
const TransitionResult = { progress: {}, effects: [] };

const SanctuaryChapter = {
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

const EndingChoiceModel = {
  choices: [
    { id: "restore", unlocked: true, reason: null },
    { id: "seal", unlocked: true, reason: null },
    { id: "resonate", unlocked: false, reason: "origin_records_3_required" },
  ],
  deferAllowed: true,
};
```

Test fixture factories used below live in `tests/helpers/sanctuary-fixtures.mjs`; do not leave helper names implicit. The helper exports are:

```js
export function sanctuaryUnlockedProgress(overrides = {}) { /* completed volcano + sanctuary entrance/hall unlocked */ }
export function oneResonanceProgress() { /* sanctuaryUnlockedProgress with life-resonance */ }
export function threeResonanceProgress() { /* all three resonance node IDs */ }
export function zeroBoundaryUnlockedProgress({ originRecordIds = [] } = {}) { /* three resonance + three required archive IDs */ }
export function originReadyProgress({ originRecordIds = [] } = {}) { /* zero boundary ready + trinityDefeated + core heart unlocked */ }
export function originDefeatedProgress({ originRecordIds = [], receiptId = "origin-encounter-1" } = {}) { /* originReady + local defeat receipt */ }
export function resonanceReadyProgress() { /* originDefeatedProgress with all three origin records */ }
export function validWarriorBossAttack(overrides = {}) { /* valid warrior basic attack request against fixture encounter */ }
export function regionalBossValidation(overrides = {}) { /* current forest regional validation context */ }
export function rewriteOriginEncounter(overrides = {}) { /* ORIGIN at 20% HP with authority and rewrite state */ }
export function fixedOriginContext(overrides = {}) { /* deterministic players, clock and RNG for controller tests */ }
```

Each helper constructs data through exported normalizers/initializers rather than copying production logic. Where a helper needs an unlocked terminal state, it composes public transition functions in sequence.

## File Structure

### New focused modules

- `src/sanctuary-world-data-20260910-sanctuary.js` — sanctuary entrance override plus four interior physical-map definitions and portal graph.
- `src/sanctuary-story-data-20260910-sanctuary.js` — resonance nodes, required archive records, optional origin records, story actors and story text.
- `src/sanctuary-ending-state-20260910-sanctuary.js` — pure ending eligibility, permanent choice, title and idempotent reward transitions.
- `src/sanctuary-ending-script-20260910-sanctuary.js` — exact approved restore/seal/resonate dialogue, cameo branches, credits and post-credit frames.
- `src/sanctuary-ending-controller-20260910-sanctuary.js` — DOM cutscene/choice/credits timing, input lock, skip gate and completion callbacks.
- `src/trinity-boss-20260910-sanctuary.js` — local TRINITY phase/state simulation and render model.
- `src/origin-boss-state-20260910-sanctuary.js` — ORIGIN-specific normalization, four phases, core anchors and defeat behavior on top of shared boss state.
- `src/origin-boss-controller-20260910-sanctuary.js` — deterministic ORIGIN AI, telegraphs, anchor lifecycle and player-damage events.
- `src/boss-attack-validation-20260910-sanctuary.js` — player-to-boss attack validation extracted from the current cooperative boss state so regional bosses and ORIGIN use one security contract.
- `tests/helpers/sanctuary-fixtures.mjs` — shared test factories defined above.

### Versioned replacements of current release modules

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
- `database.rules.json` — four new sanctuary map IDs and ORIGIN shared-boss validation.
- `.github/workflows/browser-smoke.yml` — sanctuary browser journey.
- `README.md` — 15-map world, Chapter 4, endings and recovery behavior.
- `FIREBASE_SETUP.md` — ORIGIN shared path/rules contract.

### New tests

- `tests/sanctuary-chapter-progress.test.mjs`
- `tests/sanctuary-world-data.test.mjs`
- `tests/sanctuary-story-interactions.test.mjs`
- `tests/sanctuary-ending-state.test.mjs`
- `tests/sanctuary-ending-script.test.mjs`
- `tests/sanctuary-ending-controller.test.mjs`
- `tests/trinity-boss.test.mjs`
- `tests/origin-boss-state.test.mjs`
- `tests/origin-boss-controller.test.mjs`
- `tests/game-sanctuary-story.test.mjs`
- `tests/game-sanctuary-combat.test.mjs`
- `tests/game-sanctuary-ending.test.mjs`
- `tests/sanctuary-cache-contract.test.mjs`
- `tests/sanctuary-browser-smoke.cjs`

---

### Task 1: Sanctuary progression state, fixtures and v8 persistence

**Files:**
- Create: `src/chapter-progress-20260910-sanctuary.js`
- Create: `src/progress-storage-20260910-sanctuary.js`
- Create: `src/quest-state-20260910-sanctuary.js`
- Create: `tests/helpers/sanctuary-fixtures.mjs`
- Create: `tests/sanctuary-chapter-progress.test.mjs`
- Modify: `tests/chapter-progress.test.mjs`
- Modify: `tests/progress-storage.test.mjs`

**Interfaces:**
- Produces `createInitialSanctuaryChapter()` returning the exact `SanctuaryChapter` shape above.
- Produces `activateSanctuaryResonanceNode(progress, nodeId)`, `restoreSanctuaryArchive(progress, archiveId)`, `collectOriginRecord(progress, recordId)`, `recordTrinityDefeat(progress)`, `recordOriginDefeat(progress, receiptId)`; all return `TransitionResult`.
- Produces `SANCTUARY_RESONANCE_NODE_IDS`, `SANCTUARY_ARCHIVE_IDS`, `SANCTUARY_ORIGIN_RECORD_IDS`.
- Extends player progress with `endingTitle: null | "세계의 복원자" | "코어의 수호자" | "세계의 공명자"`.
- Storage key becomes `pixel-world.progress.v8:<nickname>` and exports `v7ProgressStorageKey(nickname)`.

- [ ] **Step 1: Create the shared progress fixture module**

Implement the seven progress factories declared in Shared Interface Contracts by composing the public transitions. `sanctuaryUnlockedProgress()` starts from a valid completed-volcano world and normalizes it; it never manually inserts an impossible region state.

- [ ] **Step 2: Write failing initial-state and progression tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  activateSanctuaryResonanceNode,
  createInitialWorldProgress,
  recordOriginDefeat,
  recordTrinityDefeat,
  restoreSanctuaryArchive,
} from "../src/chapter-progress-20260910-sanctuary.js";
import {
  sanctuaryUnlockedProgress,
  zeroBoundaryUnlockedProgress,
  originReadyProgress,
} from "./helpers/sanctuary-fixtures.mjs";

test("initial world contains an empty sanctuary chapter state", () => {
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

test("volcano completion exposes entrance and resonance hall", () => {
  const progress = sanctuaryUnlockedProgress();
  assert.ok(progress.unlockedMapIds.includes("sanctuary"));
  assert.ok(progress.unlockedMapIds.includes("sanctuary-resonance-hall"));
});

test("three resonance nodes unlock archive and three required archives unlock zero boundary", () => {
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

test("origin records are optional for core-heart progression", () => {
  const ready = zeroBoundaryUnlockedProgress({ originRecordIds: [] });
  const defeated = recordTrinityDefeat(ready).progress;
  assert.ok(defeated.unlockedMapIds.includes("sanctuary-core-heart"));
  assert.deepEqual(defeated.chapters.sanctuary.originRecordIds, []);
});

test("origin defeat stores one receipt and never chooses an ending", () => {
  const result = recordOriginDefeat(originReadyProgress(), "origin-encounter-1").progress;
  assert.equal(result.chapters.sanctuary.originDefeated, true);
  assert.equal(result.chapters.sanctuary.originDefeatReceiptId, "origin-encounter-1");
  assert.equal(result.chapters.sanctuary.endingChoice, null);
});
```

- [ ] **Step 3: Run the new tests and verify failure**

Run: `node --test tests/sanctuary-chapter-progress.test.mjs`

Expected: FAIL because the `20260910-sanctuary` progression module and APIs do not exist.

- [ ] **Step 4: Implement immutable sanctuary state and transitions**

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
```

Use the existing `transition()`/`unlockMap()` pattern. Normalization removes unknown/duplicate IDs, repairs terminal prerequisites, and never turns an invalid ending string into a valid choice. Completing volcano adds `sanctuary` and `sanctuary-resonance-hall` to unlocked maps.

- [ ] **Step 5: Write failing v8 migration and corruption-repair tests**

Create a literal valid v7 payload inside `tests/progress-storage.test.mjs` containing completed volcano, `captainOutcome: "rescued"`, volcanic hidden weapons, `redeemedCodeIds: ["JAEHOON"]`, inventory, quests, class equipment, and claimed boss receipts. Store it under `v7ProgressStorageKey()` and assert the v8 load preserves each field while adding an empty sanctuary chapter and `endingTitle: null`.

Create a corrupt v8 payload with duplicate/unknown sanctuary IDs and `endingChoice: "unknown"`; assert normalization removes invalid values without erasing valid coast/volcano state.

- [ ] **Step 6: Implement v8 read/write and v7→v8 migration**

Set `STORAGE_VERSION = 8`, `STORAGE_PREFIX = "pixel-world.progress.v8:"`, keep explicit v7 through v1 fallback keys, validate `endingTitle` against the three exact title strings, and route every loaded `worldProgress` through the new normalizer.

- [ ] **Step 7: Run focused persistence tests**

Run: `node --test tests/sanctuary-chapter-progress.test.mjs tests/chapter-progress.test.mjs tests/progress-storage.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 8: Commit**

```bash
git add src/chapter-progress-20260910-sanctuary.js src/progress-storage-20260910-sanctuary.js src/quest-state-20260910-sanctuary.js tests/helpers/sanctuary-fixtures.mjs tests/sanctuary-chapter-progress.test.mjs tests/chapter-progress.test.mjs tests/progress-storage.test.mjs
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
- Consumes Task 1 unlocked-map contract.
- Produces `SANCTUARY_MAP_IDS` and `SANCTUARY_WORLD_DEFINITIONS` for the five exact sanctuary IDs.
- `REGION_DEFINITIONS.sanctuary.mapIds` contains those five IDs in traversal order.
- `WORLD_IDS.length === 15`.
- Safe flags are entrance `true`, origin archive `true`, resonance hall `false`, zero boundary `false`, core heart `false`.

- [ ] **Step 1: Write failing map-size, world-count and portal tests**

```js
test("sanctuary owns five 2160x1800 maps and world count is fifteen", () => {
  assert.deepEqual(REGION_DEFINITIONS.sanctuary.mapIds, [
    "sanctuary",
    "sanctuary-resonance-hall",
    "sanctuary-origin-archive",
    "sanctuary-zero-boundary",
    "sanctuary-core-heart",
  ]);
  assert.equal(WORLD_IDS.length, 15);
  for (const id of REGION_DEFINITIONS.sanctuary.mapIds) {
    assert.equal(getWorldDefinition(id).width, 2160);
    assert.equal(getWorldDefinition(id).height, 1800);
  }
});

test("sanctuary travel is bidirectional and uses destination unlocks", () => {
  assert.equal(getPortalDestination("sanctuary", "to-resonance-hall").mapId, "sanctuary-resonance-hall");
  assert.equal(getPortalDestination("sanctuary-resonance-hall", "to-sanctuary").mapId, "sanctuary");
  assert.equal(getPortalDestination("sanctuary-core-heart", "to-zero-boundary").mapId, "sanctuary-zero-boundary");
});
```

- [ ] **Step 2: Run map tests and verify failure**

Run: `node --test tests/sanctuary-world-data.test.mjs tests/region-data.test.mjs tests/world-data.test.mjs tests/portal-transition.test.mjs`

Expected: FAIL because the four interior map IDs are absent.

- [ ] **Step 3: Implement sanctuary world definitions**

`sanctuary-world-data-20260910-sanctuary.js` imports the current volcano world data, clones only the existing `sanctuary` entrance to add `to-resonance-hall`, then defines the four interiors. Extra portal `requirements` arrays stay empty; `canUsePortal()` already checks `isMapUnlocked(destination.mapId)` before evaluating optional chapter flags.

- [ ] **Step 4: Add deterministic geometry assertions**

For every sanctuary map, test that spawn and every portal destination are within `0..2160 × 0..1800` and outside blocking obstacles. Test that locked archive/zero/core destinations reject portal use before the corresponding Task 1 transition and become usable after it.

- [ ] **Step 5: Run focused world tests**

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
- Consumes Task 1 transitions and Task 2 map IDs.
- Produces `SANCTUARY_STORY_INTERACTIONS`, `SANCTUARY_STORY_ACTORS`, `getOriginRecords(progress)`, sanctuary-aware `ALL_STORY_INTERACTIONS`, `storyDialogueModel()` and `storyGuidance()`.
- Required resonance IDs are `life-resonance`, `memory-resonance`, `energy-resonance`.
- Required archive IDs are `archive-aren-split`, `archive-vanguard-entry`, `archive-defense-protocol`.
- Optional origin record placement is `origin-record-single-authority` in resonance hall, `origin-record-sealed-recovery` in origin archive, `origin-record-mutual-validation` in zero boundary.

- [ ] **Step 1: Write failing story eligibility test using shared fixtures**

```js
test("archive interactions are unavailable before all three resonance nodes", () => {
  const interaction = SANCTUARY_STORY_INTERACTIONS.find(v => v.id === "archive-aren-split");
  assert.equal(isStoryInteractionEligible(interaction, oneResonanceProgress()), false);
  assert.equal(isStoryInteractionEligible(interaction, threeResonanceProgress()), true);
});
```

- [ ] **Step 2: Write failing previous-choice presentation tests**

Build two valid world-progress values from `zeroBoundaryUnlockedProgress()` and change only `chapters.volcano.captainOutcome` between `rescued` and `lost`; assert the rescued model includes a live captain transmission while the lost model includes the captain's final recording. Repeat with `chapters.coast.supportChoice` set to `sera`, `echo`, and `mari`; assert only the perspective line changes and all three models expose identical progression actions.

- [ ] **Step 3: Run story tests and verify failure**

Run: `node --test tests/sanctuary-story-interactions.test.mjs tests/story-interactions.test.mjs tests/quest-guidance.test.mjs`

- [ ] **Step 4: Extend unified story dispatch**

```js
export const ALL_STORY_INTERACTIONS = Object.freeze([
  ...COAST_STORY_INTERACTIONS,
  ...VOLCANO_STORY_INTERACTIONS,
  ...SANCTUARY_STORY_INTERACTIONS,
]);
```

Add a sanctuary branch in eligibility, nearby lookup and resolution. When delegated coast/volcano logic returns, preserve sanctuary state; when sanctuary logic returns, preserve coast and volcano exactly.

- [ ] **Step 5: Implement approved truth sequence and optional records**

The three required archive interactions reveal in order: 아렌 split life/memory/energy authority; the vanguard re-entered the sanctuary; the captain's emergency access triggered the defense protocol. The three optional origin records use the approved principles from the spec and affect only `resonate` eligibility.

- [ ] **Step 6: Add sanctuary objective guidance**

Guidance priority is exact: remaining resonance node → remaining required archive → TRINITY → core heart → ORIGIN → final choice. When ORIGIN is defeated with fewer than three origin records, show `결정 보류 가능 · 원점 기록 n/3` and point to the nearest missing record when the player is in a sanctuary interior.

- [ ] **Step 7: Run focused story/guidance tests**

Run: `node --test tests/sanctuary-story-interactions.test.mjs tests/story-interactions.test.mjs tests/story-rendering.test.mjs tests/quest-guidance.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/sanctuary-story-data-20260910-sanctuary.js src/story-interactions-20260910-sanctuary.js src/story-dialogue-20260910-sanctuary.js src/quest-guidance-20260910-sanctuary.js tests/sanctuary-story-interactions.test.mjs tests/story-interactions.test.mjs tests/story-rendering.test.mjs tests/quest-guidance.test.mjs
git commit -m "feat: add sanctuary truth and story guidance"
```

### Task 4: Sanctuary enemies and personal TRINITY encounter

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
- Produces `createTrinityEncounter({ now = Date.now() })`, `trinityPhaseForHp(hp,maxHp)`, `advanceTrinityEncounter(state,dt,context)`, `applyTrinityDamage(state,damage)`, `trinityEncounterCount(rewardEffects)`.
- `createTrinityEncounter()` returns `{ id:"trinity", hp:800, maxHp:800, phase:"life", ...transientState }`.
- TRINITY is never serialized to Firebase; `trinityEncounterCount()` always returns `1`.

- [ ] **Step 1: Write failing enemy and phase-boundary tests**

```js
test("TRINITY uses 800 HP and approved phase thresholds", () => {
  const boss = createTrinityEncounter({ now: 0 });
  assert.equal(boss.maxHp, 800);
  assert.equal(trinityPhaseForHp(800, 800), "life");
  assert.equal(trinityPhaseForHp(559, 800), "memory");
  assert.equal(trinityPhaseForHp(319, 800), "energy");
  assert.equal(trinityPhaseForHp(159, 800), "mixed");
});
```

Threshold implementation is `>70% life`, `>40% memory`, `>20% energy`, otherwise mixed; exact boundary tests cover 70%, 40% and 20%.

- [ ] **Step 2: Write failing deterministic attack-cycle tests**

Construct literal context `{ player:{x:1080,y:900}, arena:{width:2160,height:1800}, rng:()=>0.25, now:0 }`. Assert life emits charge/root, memory emits projectile/decoy, energy emits teleport/eruption, and mixed emits only attacks from the union. Every damaging event is preceded by a non-damaging telegraph event.

- [ ] **Step 3: Run tests and verify failure**

Run: `node --test tests/trinity-boss.test.mjs tests/enemy-definitions.test.mjs tests/enemy-behaviors.test.mjs tests/enemies.test.mjs`

- [ ] **Step 4: Implement enemy behavior and TRINITY state machine**

All valid player attack kinds can damage TRINITY; Q/E/R improve efficiency but are not required. Clamp HP at zero and emit exactly one `trinity-defeated` event when HP crosses from positive to zero.

- [ ] **Step 5: Add explicit reward-code isolation test**

```js
test("BOSSKILLBOSS never changes TRINITY count", () => {
  assert.equal(trinityEncounterCount({ bossCount: 3 }), 1);
});
```

- [ ] **Step 6: Run focused combat tests**

Run: `node --test tests/trinity-boss.test.mjs tests/enemy-definitions.test.mjs tests/enemy-behaviors.test.mjs tests/enemies.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/enemy-definitions-20260910-sanctuary.js src/enemy-behaviors-20260910-sanctuary.js src/enemies-20260910-sanctuary.js src/trinity-boss-20260910-sanctuary.js tests/trinity-boss.test.mjs tests/enemy-definitions.test.mjs tests/enemy-behaviors.test.mjs tests/enemies.test.mjs
git commit -m "feat: add sanctuary enemies and trinity boss"
```

### Task 5: Shared attack validator and ORIGIN-0 encounter state

**Files:**
- Create: `src/boss-attack-validation-20260910-sanctuary.js`
- Create: `src/coop-boss-data-20260910-sanctuary.js`
- Create: `src/coop-boss-state-20260910-sanctuary.js`
- Create: `src/origin-boss-state-20260910-sanctuary.js`
- Create: `tests/origin-boss-state.test.mjs`
- Modify: `tests/coop-boss-data.test.mjs`
- Modify: `tests/coop-boss-state.test.mjs`

**Interfaces:**
- `getCoopBossForMap(mapId)` returns all shared bosses including ORIGIN.
- Every shared boss definition gains `bossClass: "regional" | "final"` and `tripleEligible: boolean`.
- Existing forest/coast/volcano bosses are `bossClass:"regional", tripleEligible:true`.
- ORIGIN definition is exactly `{ id:"origin-zero", mapId:"sanctuary-core-heart", name:"ORIGIN-0 — 최초의 수호자", baseHp:1200, rewardExp:0, rewardGold:0, bossClass:"final", tripleEligible:false }` plus spawn coordinates.
- Produces `validatePlayerBossAttack(request,validation)`; existing `validateBossAttack()` remains exported as a delegate.
- Produces `createOriginEncounter(options)`, `normalizeOriginEncounter(value)`, `originPhaseForHp(hp,maxHp)`, `applyOriginAttack(value,validated,now)`.
- ORIGIN state extends base shared state with `originPhase`, `anchors`, `rewriteCycle`, `completionClaimWritten`.

- [ ] **Step 1: Complete shared boss fixtures**

In `tests/helpers/sanctuary-fixtures.mjs`, implement `validWarriorBossAttack`, `regionalBossValidation`, and `rewriteOriginEncounter` with literal timestamps/coordinates and existing starter weapon/class IDs. Keep the regional fixture on the forest boss so extraction is tested against a pre-Chapter-4 encounter.

- [ ] **Step 2: Write failing validator-equivalence test**

```js
test("regional validation is unchanged after shared-validator extraction", () => {
  const request = validWarriorBossAttack();
  const validation = regionalBossValidation();
  assert.deepEqual(validateBossAttack(request, validation), validatePlayerBossAttack(request, validation));
});
```

- [ ] **Step 3: Run and verify missing helper failure**

Run: `node --test tests/coop-boss-state.test.mjs`

- [ ] **Step 4: Extract current validation logic without changing behavior**

Move current UID, map, player position, sequence, class, weapon, level, MP resource, cast ID/hit index, cooldown, timestamp, geometry and range checks into `validatePlayerBossAttack`. Leave `coop-boss-state.validateBossAttack()` as a delegate.

- [ ] **Step 5: Write failing ORIGIN definition/phase/anchor tests**

```js
test("ORIGIN is shared and never triple eligible", () => {
  const origin = getCoopBossForMap("sanctuary-core-heart");
  assert.equal(origin.id, "origin-zero");
  assert.equal(origin.baseHp, 1200);
  assert.equal(origin.bossClass, "final");
  assert.equal(origin.tripleEligible, false);
});

test("ORIGIN uses four quarter-health phases", () => {
  assert.equal(originPhaseForHp(1200, 1200), "life");
  assert.equal(originPhaseForHp(899, 1200), "memory");
  assert.equal(originPhaseForHp(599, 1200), "energy");
  assert.equal(originPhaseForHp(299, 1200), "rewrite");
});
```

Phase implementation is `>75% life`, `>50% memory`, `>25% energy`, otherwise rewrite; exact 75/50/25 boundaries are separate assertions.

- [ ] **Step 6: Implement ORIGIN wrapper and anchor normalization**

Anchor IDs are exactly `origin-anchor-life`, `origin-anchor-memory`, `origin-anchor-energy`. In rewrite phase `anchors` is a keyed object whose values are `{ active:boolean, hp:number, maxHp:number, x:number, y:number }`. Unknown IDs are discarded. While any rewrite anchor is active, damage that would finish ORIGIN is blocked and returns `blockedByAnchors:true`; after all anchors are inactive, HP may reach zero exactly once.

- [ ] **Step 7: Run state and regression tests**

Run: `node --test tests/origin-boss-state.test.mjs tests/coop-boss-data.test.mjs tests/coop-boss-state.test.mjs tests/skill-validation.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/boss-attack-validation-20260910-sanctuary.js src/coop-boss-data-20260910-sanctuary.js src/coop-boss-state-20260910-sanctuary.js src/origin-boss-state-20260910-sanctuary.js tests/helpers/sanctuary-fixtures.mjs tests/origin-boss-state.test.mjs tests/coop-boss-data.test.mjs tests/coop-boss-state.test.mjs
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
- Consumes Task 5 ORIGIN state and current `rooms/public/bosses/{mapId}` transport.
- Produces `advanceOriginAuthorityState(encounter,dt,context)` returning `{ encounter, events }`.
- `createCoopBossNetwork().setMap("sanctuary-core-heart")` subscribes to normal `state`, `attacks`, `playerDamage`, `rewardClaims` paths.
- ORIGIN uses existing `rewardClaims` as zero-value defeat receipts (`exp:0`, `gold:0`); game integration records local ORIGIN completion instead of granting a boss reward.

- [ ] **Step 1: Finish deterministic ORIGIN fixture context**

Implement `fixedOriginContext()` in `tests/helpers/sanctuary-fixtures.mjs` with two players, fixed `now`, fixed RNG and 2160×1800 arena bounds. No test reads wall-clock time directly.

- [ ] **Step 2: Write failing telegraph/anchor controller test**

```js
test("rewrite phase warns before impact and creates exactly three anchors", () => {
  const result = advanceOriginAuthorityState(rewriteOriginEncounter(), 0.1, fixedOriginContext());
  assert.deepEqual(Object.keys(result.encounter.anchors).sort(), [
    "origin-anchor-energy", "origin-anchor-life", "origin-anchor-memory",
  ]);
  assert.equal(result.events.some(event => event.type === "rewrite-warning"), true);
  assert.equal(result.events.some(event => event.type === "rewrite-impact"), false);
});
```

- [ ] **Step 3: Write authority-handoff preservation test**

Create ORIGIN with expired `leaseUntil`, active memory phase and one damaged anchor. Acquire with a second UID through the existing authority transition. Assert HP, `originPhase`, anchor HP and rewrite timer stay identical while `authorityUid` changes and `authorityEpoch` increments exactly once.

- [ ] **Step 4: Run controller/network tests and verify failure**

Run: `node --test tests/origin-boss-controller.test.mjs tests/coop-boss-controller.test.mjs tests/coop-boss-network.test.mjs tests/network-state.test.mjs`

- [ ] **Step 5: Implement four ORIGIN attack families**

Life emits charge/root/close shock. Memory emits projectile/wave/decoy. Energy emits teleport/eruption/explosion. Rewrite mixes those families plus deletion-zone warning→impact and the three anchors. All targeted damage events use existing authority epoch and monotonically increasing sequence contracts.

- [ ] **Step 6: Extend shared network encounter creation**

`setMap()` accepts ORIGIN through shared boss data. `ensureEncounter()` dispatches to `createOriginEncounter()` when `definition.bossClass === "final"`, otherwise to existing `createBossEncounter()`. Keep the existing Firebase path hierarchy and 2Hz state publication.

- [ ] **Step 7: Write Firebase allow/deny tests before editing rules**

Add static/emulator cases that allow valid player presence on four new map IDs, allow authority-owned ORIGIN state/attack/damage/zero-value claim writes, and deny unknown map IDs, unknown anchor IDs, invalid `originPhase`, wrong boss ID, out-of-bounds positions, authority-epoch forgery, and attacks from a player whose presence map is not `sanctuary-core-heart`.

- [ ] **Step 8: Implement Firebase rules**

Add four new map IDs to the 2160×1800 presence whitelist. Add `sanctuary-core-heart` to shared boss rules with boss ID `origin-zero`, party size `1..10`, known phase values, known anchor IDs and finite anchor fields. Keep existing forest/coast/volcano allow/deny behavior unchanged.

- [ ] **Step 9: Run rules and network verification**

```bash
node --test tests/origin-boss-controller.test.mjs tests/coop-boss-controller.test.mjs tests/coop-boss-network.test.mjs tests/network-state.test.mjs tests/database-rules.test.mjs tests/coop-boss-rules.test.mjs
npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"
```

Expected: zero failures and emulator exit `0`.

- [ ] **Step 10: Commit**

```bash
git add src/origin-boss-controller-20260910-sanctuary.js src/coop-boss-controller-20260910-sanctuary.js src/coop-boss-network-20260910-sanctuary.js src/network-state-20260910-sanctuary.js src/network-20260910-sanctuary.js tests/helpers/sanctuary-fixtures.mjs tests/origin-boss-controller.test.mjs tests/coop-boss-controller.test.mjs tests/coop-boss-network.test.mjs tests/network-state.test.mjs tests/database-rules.test.mjs tests/coop-boss-rules.test.mjs tests/firebase-rules-emulator.cjs database.rules.json
git commit -m "feat: add online origin boss authority and rules"
```

### Task 7: Permanent ending state and idempotent rewards

**Files:**
- Create: `src/sanctuary-ending-state-20260910-sanctuary.js`
- Create: `tests/sanctuary-ending-state.test.mjs`
- Modify: `tests/progress-storage.test.mjs`
- Modify: `tests/player-progression.test.mjs`

**Interfaces:**
- Produces `SANCTUARY_ENDING_CHOICES = ["restore","seal","resonate"]`.
- Produces `availableSanctuaryEndings(progress)` returning the `EndingChoiceModel.choices` shape.
- Produces `chooseSanctuaryEnding(progress,choice)` returning `{ progress, changed, reason }`.
- Produces `sanctuaryEndingTitle(choice)` returning one exact title string or `null`.
- Produces `grantSanctuaryEndingReward(progress)` returning `{ progress, changed, reason }`.
- `chooseSanctuaryEnding()` requires local `originDefeated`, refuses a second choice, and requires all three origin records only for `resonate`.
- `grantSanctuaryEndingReward()` grants EXP 500 + Gold 1000 through existing level-up reward logic, assigns title, sets `endingRewardClaimed=true` and `chapterCompleted=true`, and becomes a no-op after success.

- [ ] **Step 1: Write failing eligibility test**

```js
test("only resonate requires all three origin records", () => {
  const choices = availableSanctuaryEndings(originDefeatedProgress({ originRecordIds: [] }));
  assert.equal(choices.find(v => v.id === "restore").unlocked, true);
  assert.equal(choices.find(v => v.id === "seal").unlocked, true);
  assert.equal(choices.find(v => v.id === "resonate").unlocked, false);
  assert.equal(choices.find(v => v.id === "resonate").reason, "origin_records_3_required");
});
```

- [ ] **Step 2: Write failing permanent-choice and reward-idempotency test**

```js
test("first ending is permanent and reward pays exactly once", () => {
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

- [ ] **Step 4: Implement pure ending transitions**

Use the current progression reward helper for EXP so a 500-point grant can cross multiple level thresholds. Do not compute next-level thresholds in the ending module.

- [ ] **Step 5: Add two-write storage recovery tests**

Use an in-memory storage stub whose `setItem()` can fail on a specified call index. Call 1 persists `endingChoice`; call 2 persists reward/title. Assert failure on call 1 leaves pre-choice state and no cutscene eligibility; failure on call 2 leaves a reloadable chosen ending with `endingRewardClaimed=false`; retry grants exactly once and sets the marker.

- [ ] **Step 6: Run focused ending/persistence tests**

Run: `node --test tests/sanctuary-ending-state.test.mjs tests/progress-storage.test.mjs tests/player-progression.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sanctuary-ending-state-20260910-sanctuary.js tests/sanctuary-ending-state.test.mjs tests/progress-storage.test.mjs tests/player-progression.test.mjs
git commit -m "feat: add permanent sanctuary endings and rewards"
```

### Task 8: Exact ending scripts, final-choice UI, credits and post-credit

**Files:**
- Create: `src/sanctuary-ending-script-20260910-sanctuary.js`
- Create: `src/sanctuary-ending-controller-20260910-sanctuary.js`
- Create: `styles-20260910-sanctuary.css`
- Create: `tests/sanctuary-ending-script.test.mjs`
- Create: `tests/sanctuary-ending-controller.test.mjs`
- Modify: `index.html`
- Modify: `tests/ui.static.test.cjs`

**Interfaces:**
- Produces `sanctuaryEndingScript({ choice, captainOutcome, supportChoice, playerName })` returning `{ commonIntro, choiceConfirmation, scenes, credits, postCredit }`.
- Produces `SanctuaryEndingController` with `openChoice(model)`, `playEnding(script)`, `skipCredits()`, `close()`, getter `active`, callbacks `onChoose`, `onDefer`, `onCreditsComplete`.
- Credits timer is `30_000ms`; skip gate is `5_000ms`.
- `결정 보류` invokes `onDefer()` and never writes an ending choice.

- [ ] **Step 1: Write failing script-integrity tests**

Read the approved spec text as a fixture and assert generated scripts contain exact ending headings `원래의 세계`, `지켜낸 현재`, `새로운 세계`; exact titles; 아렌/captain/support cameo branches; final narrator paragraphs; and post-credit strings. Assert `resonate` contains all three optional-record principles.

- [ ] **Step 2: Write failing controller timing test with injected fake clock**

Construct controller with `{ now:()=>clock.now, setTimer:clock.setTimer, clearTimer:clock.clearTimer }`. Start credits, advance to 4,999ms and assert `skipCredits() === false`; advance to 5,000ms and assert `skipCredits() === true`; assert skip still transitions through post-credit before `onCreditsComplete`.

- [ ] **Step 3: Write failing static markup/accessibility test**

Assert `index.html` contains a labelled final-choice dialog, restore/seal/resonate buttons, locked-reason live region, `결정 보류`, ending subtitle live region, credits container and skip button. Player-controlled strings are rendered via text nodes in the controller.

- [ ] **Step 4: Run and verify failure**

Run: `node --test tests/sanctuary-ending-script.test.mjs tests/sanctuary-ending-controller.test.mjs tests/ui.static.test.cjs`

- [ ] **Step 5: Implement exact approved copy and data structure**

Copy dialogue from spec sections `엔딩 공통 진입 컷신`, `복원`, `봉인`, `공명`, `크레딧`, `POST CREDIT` verbatim into structured arrays. Share identical common lines once; keep captain/support branches keyed by existing saved IDs.

- [ ] **Step 6: Implement DOM controller and CSS**

Controller exposes input-lock state while common intro, choice confirmation, ending, credits or post-credit is active. Final-choice confirmation is two-step. Resonance stays visible but disabled with `원점 기록 3/3 필요` until eligible. Escape player name by assigning `textContent` only.

- [ ] **Step 7: Run focused UI/script tests**

Run: `node --test tests/sanctuary-ending-script.test.mjs tests/sanctuary-ending-controller.test.mjs tests/ui.static.test.cjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/sanctuary-ending-script-20260910-sanctuary.js src/sanctuary-ending-controller-20260910-sanctuary.js styles-20260910-sanctuary.css index.html tests/sanctuary-ending-script.test.mjs tests/sanctuary-ending-controller.test.mjs tests/ui.static.test.cjs
git commit -m "feat: add sanctuary endings credits and cutscenes"
```

### Task 9: World rendering, game-shell integration, spectator recovery and QA

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
- Consumes Tasks 1-8.
- `PixelRPG` owns one local TRINITY state/controller and uses shared coop boss network for ORIGIN only when `originDefeated === false`.
- ORIGIN zero-value claim becomes `recordOriginDefeat(worldProgress, encounterId)` followed by `saveProgress()`; no EXP/Gold is granted on boss defeat.
- `isOriginSpectator()` is true when current map is core heart and local `originDefeated` is true. Spectators ignore shared ORIGIN rendering, outgoing attacks and incoming ORIGIN damage while keeping normal sanctuary navigation/final-choice interaction.
- If `originDefeated === true && endingChoice === null`, interacting with the core opens final choice instead of spawning/joining ORIGIN.
- `endingTitle` is local HUD data only; do not add it to online presence/Firebase.

- [ ] **Step 1: Write failing full sanctuary story adapter test**

Use a game harness with deterministic storage and call the same story interaction APIs used by F-key gameplay. Progress entrance → three resonance nodes → three required archives → zero boundary → TRINITY defeat → core heart. Assert each successful immutable transition writes once and forced storage failure restores previous progress.

- [ ] **Step 2: Write failing three-class combat tests**

For warrior, archer and mage, build valid level-10 fixtures so basic/Q/E/R are unlocked. Assert each attack kind can reduce TRINITY and solo ORIGIN HP when geometry is valid. Assert death/respawn clears transient skill/boss state. With `TEACHER` redeemed in solo, ORIGIN player damage is ignored; with online mode the same code produces no immortality.

- [ ] **Step 3: Write failing BOSSKILLBOSS isolation test**

Instantiate a solo game with redeemed code `BOSSKILLBOSS`. Travel to zero boundary and assert one TRINITY state. Travel to core heart and assert one ORIGIN state. Keep an existing forest regression asserting regional triple-boss effect remains three.

- [ ] **Step 4: Write failing ORIGIN receipt/spectator/reconnect tests**

Online claim arrives → local receipt save succeeds → claim is acknowledged → `isOriginSpectator()` becomes true → later shared ORIGIN state is ignored. Reload same nickname → no refight → core interaction opens choice. For forced local receipt-save failure, do not acknowledge/remove the remote claim so reconnect can retry.

- [ ] **Step 5: Write failing defer/backtrack test**

Start from local ORIGIN defeat with two origin records. Assert resonate locked. Invoke `결정 보류`, leave core heart through reverse portals, collect `origin-record-mutual-validation`, return without spawning ORIGIN, and assert resonate unlocked at 3/3.

- [ ] **Step 6: Implement sanctuary rendering and orchestration**

Render four distinct interiors, story signals, origin-record markers, TRINITY, ORIGIN telegraphs/anchors and core interaction. Keep phase math in boss modules and ending text/timing in ending modules; `game` coordinates input, state, save, rendering and network callbacks.

- [ ] **Step 7: Implement two-phase final-choice persistence**

On final confirmation call `chooseSanctuaryEnding`, save choice, and begin chosen ending only after save success. Then call `grantSanctuaryEndingReward` and save reward/title. Reward-save failure leaves saved choice intact with `endingRewardClaimed=false`; retry after ending and on next load until one save succeeds. Never grant again when marker is true.

- [ ] **Step 8: Return to village after post-credit**

On `onCreditsComplete`, set map to `village`, reset transient combat/skill/boss states, restore controls, show `PIXEL WORLD — 제1부 완료`, and render saved title on local player HUD. Preserve entire sanctuary chapter state.

- [ ] **Step 9: Extend QA tools**

Add travel buttons for all five sanctuary maps plus setup actions for `원점 기록 3/3`, TRINITY-ready, ORIGIN-ready and each ending-ready state. QA mutations execute only when current QA mode is enabled.

- [ ] **Step 10: Run focused game integration tests**

```bash
node --test tests/game-sanctuary-story.test.mjs tests/game-sanctuary-combat.test.mjs tests/game-sanctuary-ending.test.mjs tests/game-qa.test.mjs tests/qa-mode.test.mjs tests/qa-ui.static.test.cjs
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/world-20260910-sanctuary.js src/qa-mode-20260910-sanctuary.js src/game-20260910-sanctuary.js src/main-20260910-sanctuary.js index.html tests/game-sanctuary-story.test.mjs tests/game-sanctuary-combat.test.mjs tests/game-sanctuary-ending.test.mjs tests/game-qa.test.mjs tests/qa-mode.test.mjs tests/qa-ui.static.test.cjs
git commit -m "feat: integrate pixel core sanctuary finale"
```

### Task 10: Cache-safe release graph, browser journeys and documentation

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
- Cache contract traverses entry graph and rejects any changed parent that still imports an older copy of a changed child.
- Browser smoke uses production interaction APIs except explicit QA setup actions.

- [ ] **Step 1: Write failing cache and HTML-entry tests**

```js
test("sanctuary release uses the new physical entries", () => {
  assert.match(indexHtml, /styles-20260910-sanctuary\.css/);
  assert.match(indexHtml, /src\/main-20260910-sanctuary\.js/);
  assert.doesNotMatch(indexHtml, /main-20260903-volcano-20260905-upgrade\.js/);
});
```

- [ ] **Step 2: Run and verify current old entry fails new contract**

Run: `node --test tests/sanctuary-cache-contract.test.mjs tests/firebase-hosting.test.mjs tests/ci-workflow.test.mjs`

- [ ] **Step 3: Complete transitive physical import graph**

Starting from `main-20260910-sanctuary.js`, traverse imports recursively. Every module changed by Tasks 1-9 is referenced by its `20260910-sanctuary` physical filename. Unchanged stable modules may keep current `20260905-upgrade` URLs. Cache test records changed-module set explicitly and fails on a stale edge.

- [ ] **Step 4: Implement primary solo browser journey**

Create/load completed-volcano QA save, enter sanctuary, activate three resonance nodes, restore three required archives, collect all three optional origin records, defeat TRINITY, defeat ORIGIN, select `resonate`, verify choice/reward persist once, verify credit skip disabled before 5 seconds, complete post-credit, and land in village with `세계의 공명자`.

- [ ] **Step 5: Implement alternate-ending recovery journey**

Defeat ORIGIN with two origin records, verify resonate locked, select `결정 보류`, backtrack for record 3, return without ORIGIN refight, choose `restore`, reload, and assert title persists and EXP 500/Gold 1000 are not paid again. Pure ending-state tests cover `seal` behavior and exact Task 8 script tests cover its copy.

- [ ] **Step 6: Implement two-browser online ORIGIN journey**

Two authenticated contexts enter core heart, share one ORIGIN encounter/HP, verify authority transfer when current authority exits, finish fight, receive separate local defeat receipts, enter spectator state, and choose different endings. Assert one nickname's ending never changes the other nickname's save. Assert TEACHER and BOSSKILLBOSS neither appear in shared presence nor alter ORIGIN count/immortality.

- [ ] **Step 7: Wire browser CI**

Add `tests/sanctuary-browser-smoke.cjs` after existing volcano smoke in `.github/workflows/browser-smoke.yml` so village/forest/coast/volcano journeys remain gates before finale journey.

- [ ] **Step 8: Update docs**

README documents 15 maps, sanctuary progression, TRINITY local behavior, ORIGIN shared behavior, v8 save key, three permanent endings, 3/3 resonance requirement, `결정 보류`, spectator recovery, credits/post-credit and titles. FIREBASE_SETUP documents `rooms/public/bosses/sanctuary-core-heart`, ORIGIN rule fields and confirms endings/titles are never stored in Firebase.

- [ ] **Step 9: Run complete Node, syntax and diff verification**

```bash
node --test tests/*.test.mjs tests/*.static.test.cjs
for file in src/*.js; do node --check "$file"; done
node --check tests/sanctuary-browser-smoke.cjs
git diff --check
```

Expected: every command exits `0` and Node reports zero failures.

- [ ] **Step 10: Run Firebase emulator verification**

```bash
npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"
```

Expected: exit `0`.

- [ ] **Step 11: Run local browser smoke on exact branch head**

Start `python3 -m http.server 4173` in one terminal, then run:

```bash
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/browser-smoke.cjs
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/coast-browser-smoke.cjs
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/volcano-browser-smoke.cjs
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/sanctuary-browser-smoke.cjs
```

Expected: all four commands exit `0`.

- [ ] **Step 12: Commit release verification assets**

```bash
git add .github/workflows/browser-smoke.yml index.html README.md FIREBASE_SETUP.md tests/sanctuary-cache-contract.test.mjs tests/sanctuary-browser-smoke.cjs tests/ci-workflow.test.mjs tests/firebase-hosting.test.mjs
git commit -m "test: verify pixel core sanctuary release"
```

### Task 11: PR gate and deployed-service verification

**Files:**
- No planned new implementation file. A defect found here is fixed in its owning module together with a regression test before merge.

**Interfaces:**
- Consumes verified Task 1-10 implementation branch.
- Produces one PR into `main`; merge occurs only after all required CI checks succeed.

- [ ] **Step 1: Bring branch onto latest main before final verification**

```bash
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: latest `origin/main` is an ancestor, diff is clean and changes are limited to Chapter 4, its release dependencies, tests and docs.

- [ ] **Step 2: Re-run Task 10 verification on exact PR head**

Record fresh Node test total, JS syntax count, Firebase emulator result and all four browser smoke results. Older branch or PR results are not evidence for final head.

- [ ] **Step 3: Open one PR**

Title: `feat: add pixel core sanctuary finale`

Body summarizes four sanctuary interiors, v8 migration, TRINITY, shared ORIGIN-0, three permanent endings, recovery-safe defer/spectator path, credits/post-credit, solo-only TEACHER, regional-only BOSSKILLBOSS, Firebase rule changes and fresh verification evidence.

- [ ] **Step 4: Require CI gates before merge**

Required successful results: `Verify game`, Firebase Realtime Database emulator/rules test, solo/online browser smoke, and configured Pages/deployment checks. Do not merge with a required check failed, cancelled, unexpectedly skipped or still pending.

- [ ] **Step 5: After merge verify deployment records against merge SHA**

Confirm successful GitHub Pages deployment, Firebase Hosting deployment and Firebase Database Rules deployment all reference actual merge SHA.

- [ ] **Step 6: Perform deployed smoke with a fresh QA nickname**

Verify entry, solo sanctuary load, one sanctuary story interaction, online room entry/exit and no console-blocking error. Do not use an existing player's nickname for destructive ending QA.

- [ ] **Step 7: Report final evidence**

Report merge SHA, exact CI conclusions, deployment conclusions, fresh test counts, browser journey outcomes and known non-blocking limitations. Make no completion claim without corresponding fresh result.
