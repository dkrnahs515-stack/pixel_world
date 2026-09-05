import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG, regionEntryMessage } from "../src/game-20260903-volcano.js";
import {
  normalizeWorldProgress,
  recordChapterBossDefeat,
  resolveVolcanoCaptain,
} from "../src/chapter-progress-20260903-volcano.js";
import { createInitialProgress } from "../src/quest-state-20260903-volcano.js";
import { VOLCANO_STORY_INTERACTIONS } from "../src/volcano-story-data-20260903-volcano.js";
import { getNpcsForWorld } from "../src/npc-data-20260903-volcano.js";
import { canUsePortal } from "../src/portal-transition-20260903-volcano.js";
import { WORLD_DEFINITIONS } from "../src/world-data-20260903-volcano.js";
import {
  createWorldLayer,
  getBiome,
  getStoryRenderablesForMap,
  isWorldPositionBlocked,
} from "../src/world-20260903-volcano.js";

const MAGMA_DEVICES = ["magma-valve-west", "magma-valve-central", "magma-valve-east"];
const ANCHORS = [
  "ash-gate-coolant-anchor",
  "magma-route-coolant-anchor",
  "observatory-coolant-anchor",
];

function storyHarness() {
  const game = Object.create(PixelRPG.prototype);
  game.progress = createInitialProgress();
  game.progress.worldProgress = normalizeWorldProgress({
    chapters: { coast: { coreFragmentObtained: true } },
  });
  game.mapId = "volcano";
  game.player = {
    name: "화산테스터", x: 1080, y: 1460,
    hp: 100, maxHp: 100, mp: 100, maxMp: 100,
  };
  game.npcs = [];
  game.processedBossRewardIds = new Set();
  game.ui = {
    chapterObjective: { textContent: "" },
    renderCommunicationLog() {},
  };
  game.updateChapterUi = PixelRPG.prototype.updateChapterUi;
  game.updateNpcPrompt = () => {};
  game.updateProgressHud = () => {};
  game.updateInventoryHud = () => {};
  game.updateBlacksmithHud = () => {};
  game.updateHud = () => {};
  game.updateBiome = () => {};
  game.applyProgressionStats = () => {};
  game.notify = () => {};
  game.saveCalls = [];
  game.saveSucceeds = true;
  game.persistProgress = () => {
    game.saveCalls.push(structuredClone(game.progress));
    return game.saveSucceeds;
  };
  return game;
}

function prepareObservatory(game, { prepared = false } = {}) {
  assert.equal(game.applyStoryInteraction("ash-gate-pressure-seal"), true);
  assert.equal(game.applyStoryInteraction("garen-scorched-insignia"), true);
  if (prepared) assert.equal(game.applyStoryInteraction(ANCHORS[0]), true);
  for (const id of MAGMA_DEVICES) assert.equal(game.applyStoryInteraction(id), true);
  assert.equal(game.applyStoryInteraction("garen-escort-record"), true);
  if (prepared) assert.equal(game.applyStoryInteraction(ANCHORS[1]), true);
  assert.equal(game.applyStoryInteraction("observatory-stabilizer"), true);
  assert.equal(game.applyStoryInteraction("captain-transport-order"), true);
  assert.equal(game.applyStoryInteraction("captain-core-contact-record"), true);
  if (prepared) assert.equal(game.applyStoryInteraction(ANCHORS[2]), true);
}

const captainBossReward = encounterId => ({
  type: "boss-defeated",
  encounterId,
  bossId: "volcano-core-imp",
  mapId: "volcano-core-caldera",
  rewardExp: 220,
  rewardGold: 150,
});

test("the prepared route rescues the captain, grants all hidden weapons once, and opens sanctuary", () => {
  const game = storyHarness();
  assert.equal(game.currentChapterObjective().id, "repair-ash-gate-pressure-seal");
  prepareObservatory(game, { prepared: true });
  assert.equal(game.currentChapterObjective().id, "choose-volcano-route");
  assert.equal(game.applyStoryInteraction("volcano-route-console", { decision: "rescue" }), true);
  assert.equal(game.progress.worldProgress.chapters.volcano.eruptionTriggered, true);
  assert.equal(game.processBossReward(captainBossReward("rescue-encounter"), "local-player"), true);
  assert.equal(game.progress.worldProgress.chapters.volcano.coopBossDefeated, true);

  game.saveCalls = [];
  assert.equal(game.applyStoryInteraction("volcano-captain-outcome"), true);
  const volcano = game.progress.worldProgress.chapters.volcano;
  assert.equal(volcano.captainOutcome, "rescued");
  assert.equal(volcano.hiddenWeaponRewardClaimed, true);
  assert.deepEqual(Object.fromEntries(Object.entries(game.progress.equipmentByClass).map(
    ([classId, equipment]) => [classId, equipment.ownedWeaponIds.at(-1)],
  )), {
    warrior: "volcanic-heartblade",
    archer: "ember-tracker-bow",
    mage: "leyflame-core-staff",
  });
  assert.equal(game.saveCalls.length, 1);

  assert.equal(game.applyStoryInteraction("volcano-core-fragment"), true);
  assert.equal(game.progress.worldProgress.chapters.volcano.coreFragmentObtained, true);
  assert.equal(game.progress.worldProgress.chapters.volcano.sanctuaryUnlocked, true);
  assert.equal(game.currentChapterObjective().id, "volcano-completed");
});

test("the captain appears immediately when the caldera boss reward is persisted", () => {
  const game = storyHarness();
  prepareObservatory(game, { prepared: true });
  assert.equal(game.applyStoryInteraction("volcano-route-console", { decision: "rescue" }), true);
  game.mapId = "volcano-core-caldera";
  game.npcs = getNpcsForWorld(game.mapId, game.progress.worldProgress);
  assert.equal(game.npcs.some(npc => npc.actorId === "vanguard-captain"), false);

  assert.equal(game.processBossReward(captainBossReward("captain-refresh-encounter"), "local-player"), true);

  assert.equal(game.npcs.some(npc => npc.actorId === "vanguard-captain"), true);
});

test("the underprepared return is non-mutating while explicit proceed preserves the main route without weapons", () => {
  const game = storyHarness();
  prepareObservatory(game);
  const beforeReturn = structuredClone(game.progress);
  game.saveCalls = [];
  assert.equal(game.applyStoryInteraction("volcano-route-console", { decision: "return" }), true);
  assert.deepEqual(game.progress, beforeReturn);
  assert.equal(game.saveCalls.length, 0);

  assert.equal(game.applyStoryInteraction("volcano-route-console", { decision: "proceed" }), true);
  assert.equal(game.progress.worldProgress.chapters.volcano.routeDecision, "proceed");
  assert.equal(game.processBossReward(captainBossReward("proceed-encounter"), "local-player"), true);
  assert.equal(game.applyStoryInteraction("volcano-captain-outcome"), true);
  assert.equal(game.progress.worldProgress.chapters.volcano.captainOutcome, "lost");
  assert.equal(game.progress.worldProgress.chapters.volcano.hiddenWeaponRewardClaimed, false);
  assert.equal(game.progress.equipmentByClass.warrior.ownedWeaponIds.includes("volcanic-heartblade"), false);
  assert.equal(game.applyStoryInteraction("volcano-core-fragment"), true);
  assert.equal(game.progress.worldProgress.chapters.volcano.sanctuaryUnlocked, true);
});

test("captain rescue rolls back both story state and all-class equipment when its one save fails", () => {
  const game = storyHarness();
  prepareObservatory(game, { prepared: true });
  game.applyStoryInteraction("volcano-route-console", { decision: "rescue" });
  game.processBossReward(captainBossReward("rollback-encounter"), "local-player");
  const before = game.progress;
  const snapshot = structuredClone(before);
  game.saveCalls = [];
  game.saveSucceeds = false;

  assert.equal(game.applyStoryInteraction("volcano-captain-outcome"), false);
  assert.strictEqual(game.progress, before);
  assert.deepEqual(game.progress, snapshot);
  assert.equal(game.saveCalls.length, 1);
  for (const equipment of Object.values(game.progress.equipmentByClass)) {
    assert.equal(equipment.ownedWeaponIds.some(id => [
      "volcanic-heartblade", "ember-tracker-bow", "leyflame-core-staff",
    ].includes(id)), false);
  }
});

test("volcano dialogue actions route prepared entry through the unified game adapter", () => {
  const game = storyHarness();
  prepareObservatory(game, { prepared: true });
  const route = VOLCANO_STORY_INTERACTIONS.find(value => value.id === "volcano-route-console");
  let model = null;
  let closed = 0;
  game.keys = new Set();
  game.attackState = null;
  game.dialogue = {
    open(value) { model = value; },
    actionButtons() { return []; },
  };
  game.closeNpcDialogue = () => { closed += 1; game.pendingStoryInteraction = null; };

  assert.equal(game.openStoryInteraction(route), true);
  assert.deepEqual(model.actions.map(action => action.id), ["story-volcano-route-rescue"]);
  game.handleDialogueAction("story-volcano-route-rescue");
  assert.equal(game.progress.worldProgress.chapters.volcano.routeDecision, "rescue");
  assert.equal(closed, 1);
});

test("volcano NPC visibility, portal gates, world collision, and story markers use the new physical maps", () => {
  const game = storyHarness();
  const initial = game.progress.worldProgress;
  assert.equal(getNpcsForWorld("volcano", initial).some(npc => npc.actorId === "garen"), true);
  assert.equal(getNpcsForWorld("volcano-magma-route", initial).some(npc => npc.actorId === "garen"), false);
  assert.equal(getNpcsForWorld("volcano-core-caldera", initial).some(npc => npc.actorId === "vanguard-captain"), false);

  prepareObservatory(game, { prepared: true });
  game.applyStoryInteraction("volcano-route-console", { decision: "rescue" });
  const calderaPortal = WORLD_DEFINITIONS["volcano-observatory"].portals.find(
    portal => portal.id === "to-core-caldera",
  );
  assert.equal(canUsePortal(calderaPortal, game.progress.worldProgress), true);
  let defeated = recordChapterBossDefeat(game.progress.worldProgress, "volcano").progress;
  assert.equal(getNpcsForWorld("volcano-core-caldera", defeated).some(
    npc => npc.actorId === "vanguard-captain",
  ), true);
  defeated = resolveVolcanoCaptain({
    ...defeated,
    chapters: {
      ...defeated.chapters,
      volcano: { ...defeated.chapters.volcano, routeDecision: "proceed" },
    },
  }).progress;
  assert.equal(getNpcsForWorld("volcano-core-caldera", defeated).some(
    npc => npc.actorId === "vanguard-captain",
  ), false);

  const sanctuaryPortal = WORLD_DEFINITIONS["volcano-core-caldera"].portals.find(
    portal => portal.id === "to-sanctuary",
  );
  assert.equal(canUsePortal(sanctuaryPortal, game.progress.worldProgress), false);
  assert.equal(getBiome("volcano-observatory"), "붕괴한 관측소");
  assert.equal(isWorldPositionBlocked("volcano-observatory", 1080, 800, 14), true);
  assert.equal(isWorldPositionBlocked("volcano-observatory", 244, 852, 14), false);
  assert.equal(getStoryRenderablesForMap("volcano-observatory", game.progress.worldProgress).signals.length > 0, true);
});

function noOpCanvasContext() {
  return new Proxy({}, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === "measureText") return () => ({ width: 0 });
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
}

test("all new physical worlds create deterministic half-scale canvas layers", () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      const context = noOpCanvasContext();
      return { width: 0, height: 0, getContext: () => context };
    },
  };
  try {
    for (const mapId of [
      "volcano", "volcano-magma-route", "volcano-observatory", "volcano-core-caldera", "sanctuary",
    ]) {
      const layer = createWorldLayer(mapId);
      assert.deepEqual([layer.width, layer.height], [1080, 900], mapId);
    }
  } finally {
    globalThis.document = previousDocument;
  }
});

test("entry messages name every volcano chapter map and preserve the coast", () => {
  assert.deepEqual(Object.fromEntries([
    "volcano",
    "volcano-magma-route",
    "volcano-observatory",
    "volcano-core-caldera",
    "sanctuary",
    "coast-beach",
  ].map(mapId => [mapId, regionEntryMessage(mapId)])), {
    volcano: "잿불 관문에 도착했습니다. 압력 봉인장치를 복구하세요.",
    "volcano-magma-route": "용암 수송로에 도착했습니다. 세 용암 밸브를 찾으세요.",
    "volcano-observatory": "붕괴한 관측소에 도착했습니다. 분화 낙하 지점을 조심하세요.",
    "volcano-core-caldera": "화구 코어 제단에 도착했습니다. 오염된 선발대장을 막으세요.",
    sanctuary: "세 코어 조각이 픽셀 코어 성역의 문을 열었습니다.",
    "coast-beach": "푸른 해변에 도착했습니다. 게와 물방울 슬라임을 조심하세요.",
  });
});
