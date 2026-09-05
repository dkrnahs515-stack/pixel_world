import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260903-volcano-20260905-upgrade.js";
import { completeRegion } from "../src/chapter-progress-20260829-coast-20260905-upgrade.js";
import { createInitialProgress } from "../src/quest-state-20260829-coast-20260905-upgrade.js";
import { WORLD_DEFINITIONS } from "../src/world-data-20260829-coast-20260905-upgrade.js";
import { createLocalBossController } from "../src/local-boss-controller-20260829-coast.js";

function portalHarness(progress = createInitialProgress()) {
  const notices = [];
  const game = Object.create(PixelRPG.prototype);
  const portal = WORLD_DEFINITIONS.village.portals.find(candidate => candidate.id === "to-coast");
  game.mapId = "village";
  game.player = { x: portal.x + portal.w / 2, y: portal.y + portal.h / 2 };
  game.progress = progress;
  game.inputEnabled = true;
  game.portalCooldown = 0;
  game.portalTransition = null;
  game.keys = new Set();
  game.clearProjectiles = () => {};
  game.isInteractionOpen = () => false;
  game.notify = message => notices.push(message);
  game.ui = {};
  return { game, notices };
}

function rewardHarness(progress = createInitialProgress()) {
  const game = Object.create(PixelRPG.prototype);
  const saves = [];
  game.progress = progress;
  game.player = { name: "진행테스터", hp: 100, maxHp: 100, mp: 100, maxMp: 100 };
  game.processedBossRewardIds = new Set();
  game.persistProgress = () => { saves.push(structuredClone(game.progress)); return true; };
  game.applyProgressionStats = () => {};
  game.updateQuestHud = () => {};
  game.updateProgressHud = () => {};
  game.updateHud = () => {};
  game.updateBiome = () => {};
  game.updateChapterUi = () => {};
  game.notify = () => {};
  game.ui = {};
  return { game, saves };
}

test("locked coast and volcano portals give feedback without starting a transition", () => {
  const coast = portalHarness();
  coast.game.tryEnterPortal();
  assert.equal(coast.game.portalTransition, null);
  assert.equal(coast.game.portalCooldown, 1);
  assert.match(coast.notices.at(-1), /잠겨|열리지/);

  const volcano = portalHarness();
  const portal = WORLD_DEFINITIONS.village.portals.find(candidate => candidate.id === "to-volcano");
  volcano.game.player.x = portal.x + portal.w / 2;
  volcano.game.player.y = portal.y + portal.h / 2;
  volcano.game.tryEnterPortal();
  assert.equal(volcano.game.portalTransition, null);
  assert.match(volcano.notices.at(-1), /잠겨|열리지/);

  const openedProgress = createInitialProgress();
  openedProgress.worldProgress = completeRegion(openedProgress.worldProgress, "forest").progress;
  const opened = portalHarness(openedProgress);
  opened.game.tryEnterPortal();
  assert.equal(opened.game.portalTransition.destination.mapId, "coast-beach");
});

test("generic F routing prefers the active coast story target and exposes its prompt", () => {
  const progress = createInitialProgress();
  progress.worldProgress = completeRegion(progress.worldProgress, "forest").progress;
  const game = Object.create(PixelRPG.prototype);
  game.running = true;
  game.inputEnabled = true;
  game.chatInputActive = false;
  game.portalTransition = null;
  game.mapId = "coast-beach";
  game.player = { x: 1120, y: 720, respawnTimer: 0 };
  game.progress = progress;
  game.npcs = [];
  game.isInteractionOpen = () => false;
  game.ui = {
    npcPrompt: { hidden: true },
    npcPromptText: { textContent: "" },
  };
  let opened = null;
  game.openStoryInteraction = interaction => { opened = interaction; return true; };

  game.updateNpcPrompt();
  assert.equal(game.nearbyStoryInteraction.id, "coast-beach-transceiver");
  assert.equal(game.ui.npcPrompt.hidden, false);
  assert.equal(game.ui.npcPromptText.textContent, "F · 통신 장치 복구");
  assert.equal(game.openNpcInteraction(), true);
  assert.equal(opened.id, "coast-beach-transceiver");
});

test("accepted story transitions save once while repeated events do not write", () => {
  const progress = createInitialProgress();
  progress.worldProgress = completeRegion(progress.worldProgress, "forest").progress;
  const { game, saves } = rewardHarness(progress);
  game.mapId = "coast-beach";
  game.npcs = [];

  assert.equal(game.applyStoryInteraction("coast-beach-transceiver"), true);
  assert.equal(game.applyStoryInteraction("coast-beach-transceiver"), false);
  assert.deepEqual(game.progress.worldProgress.chapters.coast.repairedDeviceIds, ["coast-beach-transceiver"]);
  assert.equal(saves.length, 1);
});

test("forest first-clear saves its reward receipt and coast unlock atomically once", () => {
  const { game, saves } = rewardHarness();
  const event = {
    type: "boss-defeated",
    encounterId: "local:forest:1",
    bossId: "forest-core-troll",
    mapId: "forest",
    rewardExp: 300,
    rewardGold: 200,
  };

  assert.equal(game.processBossReward(event, "local-player"), true);
  assert.equal(game.processBossReward(event, "local-player"), false);
  assert.equal(game.progress.exp, 0);
  assert.equal(game.progress.level, 3);
  assert.equal(game.progress.gold, 200);
  assert.deepEqual(game.progress.claimedBossRewardIds, ["local:forest:1:local-player"]);
  assert.equal(game.progress.worldProgress.completedRegionIds.includes("forest"), true);
  assert.equal(game.progress.worldProgress.unlockedMapIds.includes("coast-beach"), true);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].worldProgress.unlockedMapIds.includes("coast-beach"), true);
  assert.deepEqual(saves[0].claimedBossRewardIds, ["local:forest:1:local-player"]);
});

test("separate local play sessions can earn legitimate forest rewards without receipt collisions", async () => {
  const { game, saves } = rewardHarness();
  const controllers = ["session-a", "session-b"].map(sessionId => createLocalBossController({ sessionId }));
  for (const controller of controllers) await controller.setMap("forest");

  for (const controller of controllers) {
    assert.equal(game.processBossReward({
      type: "boss-defeated",
      encounterId: controller.snapshot.encounterId,
      bossId: controller.snapshot.bossId,
      mapId: controller.snapshot.mapId,
      rewardExp: 300,
      rewardGold: 200,
    }, "local-player"), true);
  }

  assert.deepEqual(game.progress.claimedBossRewardIds, [
    "local:forest:session-a:1:local-player",
    "local:forest:session-b:1:local-player",
  ]);
  assert.equal(game.progress.gold, 400);
  assert.equal(saves.length, 2);
});

test("an eligible coast boss reward records chapter defeat in the same save", () => {
  const progress = createInitialProgress();
  progress.worldProgress = completeRegion(progress.worldProgress, "forest").progress;
  progress.worldProgress.unlockedMapIds.push(
    "coast-wreck-bay",
    "coast-flooded-station",
    "coast-tide-core-cave",
  );
  const { game, saves } = rewardHarness(progress);

  assert.equal(game.processBossReward({
    encounterId: "local:coast:1",
    bossId: "coast-core-shark",
    mapId: "coast-tide-core-cave",
    rewardExp: 150,
    rewardGold: 100,
  }, "local-player"), true);

  assert.equal(game.progress.worldProgress.chapters.coast.coopBossDefeated, true);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].worldProgress.chapters.coast.coopBossDefeated, true);
});
