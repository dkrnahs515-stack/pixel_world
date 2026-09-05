import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG, regionEntryMessage } from "../src/game-20260903-volcano-20260905-upgrade.js";
import { completeRegion, isMapUnlocked } from "../src/chapter-progress-20260829-coast-20260905-upgrade.js";
import { createInitialProgress } from "../src/quest-state-20260829-coast-20260905-upgrade.js";
import { canUsePortal } from "../src/portal-transition-20260829-coast.js";
import { WORLD_DEFINITIONS } from "../src/world-data-20260829-coast-20260905-upgrade.js";
import { COAST_SUPPORT_FOLLOW_UPS, COAST_TIDE_CORE_REVEAL } from "../src/coast-story-data-20260829-coast-20260905-upgrade.js";

const WRECK_DEVICES = ["wreck-relay-west", "wreck-relay-deck", "wreck-relay-east"];
const WRECK_RECORDS = [
  "wreck-record-sera",
  "wreck-record-roan",
  "wreck-record-garen",
  "wreck-record-vanguard-captain",
];

function storyHarness() {
  const game = Object.create(PixelRPG.prototype);
  const progress = createInitialProgress();
  progress.worldProgress = completeRegion(progress.worldProgress, "forest").progress;
  const saves = [];
  const renderedLogs = [];
  game.progress = progress;
  game.mapId = "coast-beach";
  game.npcs = [];
  game.player = { name: "스토리테스터", hp: 100, maxHp: 100, mp: 100, maxMp: 100 };
  game.processedBossRewardIds = new Set();
  game.persistProgress = () => { saves.push(structuredClone(game.progress)); return true; };
  game.applyProgressionStats = () => {};
  game.updateProgressHud = () => {};
  game.updateHud = () => {};
  game.updateBiome = () => {};
  game.notify = () => {};
  game.ui = {
    chapterObjective: { textContent: "" },
    renderCommunicationLog: records => renderedLogs.push(records),
  };
  return { game, saves, renderedLogs };
}

function completeStory(game, choice) {
  assert.equal(game.applyStoryInteraction("coast-beach-transceiver"), true);
  assert.equal(game.applyStoryInteraction("sera-distress-current", { classification: "current" }), true);
  for (const id of WRECK_DEVICES) assert.equal(game.applyStoryInteraction(id), true);
  for (const id of WRECK_RECORDS) assert.equal(game.applyStoryInteraction(id, { classification: "past" }), true);
  assert.equal(game.applyStoryInteraction("flooded-station-main-transceiver"), true);
  assert.equal(game.applyStoryInteraction("flooded-station-deleted-record", { classification: "past" }), true);
  assert.equal(game.applyStoryInteraction("flooded-station-support", { choice }), true);
  assert.equal(game.processBossReward({
    encounterId: `local:coast:${choice}`,
    bossId: "coast-core-shark",
    mapId: "coast-tide-core-cave",
    rewardExp: 150,
    rewardGold: 100,
  }, "local-player"), true);
  assert.equal(game.applyStoryInteraction("tide-core-rescue-sera"), true);
  assert.equal(game.applyStoryInteraction("tide-core-core-fragment"), true);
}

for (const choice of ["sera", "echo", "mari"]) {
  test(`${choice} support traverses every checkpoint and converges on rescue, core, volcano and shortcut`, () => {
    const { game, saves } = storyHarness();
    completeStory(game, choice);

    const coast = game.progress.worldProgress.chapters.coast;
    assert.equal(coast.supportChoice, choice);
    assert.equal(coast.coopBossDefeated, true);
    assert.equal(coast.seraRescued, true);
    assert.equal(coast.coreFragmentObtained, true);
    assert.equal(coast.shortcutUnlocked, true);
    assert.equal(game.progress.worldProgress.completedRegionIds.includes("coast"), true);
    assert.equal(isMapUnlocked(game.progress.worldProgress, "volcano"), true);
    assert.equal(saves.length, 15);
    assert.equal(game.currentChapterObjective().id, "repair-ash-gate-pressure-seal");
  });
}

test("repair and record checkpoints keep the next portal locked until complete and unlocked on revisit", () => {
  const { game, saves } = storyHarness();
  const beachToWreck = WORLD_DEFINITIONS["coast-beach"].portals.find(portal => portal.id === "to-wreck-bay");
  const wreckToBeach = WORLD_DEFINITIONS["coast-wreck-bay"].portals.find(portal => portal.id === "to-beach");

  assert.equal(game.currentChapterObjective().id, "repair-beach-transceiver");
  assert.equal(game.applyStoryInteraction("coast-beach-transceiver"), true);
  assert.equal(game.currentChapterObjective().id, "collect-distress-signal");
  assert.equal(canUsePortal(beachToWreck, game.progress.worldProgress), false);
  assert.equal(game.applyStoryInteraction("coast-beach-transceiver"), false);
  assert.equal(saves.length, 1);

  assert.equal(game.applyStoryInteraction("sera-distress-current", { classification: "past" }), false);
  assert.equal(saves.length, 1);
  assert.equal(game.applyStoryInteraction("sera-distress-current", { classification: "current" }), true);
  assert.equal(canUsePortal(beachToWreck, game.progress.worldProgress), true);
  assert.equal(canUsePortal(wreckToBeach, game.progress.worldProgress), true);

  for (const id of WRECK_DEVICES.slice(0, -1)) game.applyStoryInteraction(id);
  for (const id of WRECK_RECORDS) game.applyStoryInteraction(id, { classification: "past" });
  assert.equal(isMapUnlocked(game.progress.worldProgress, "coast-flooded-station"), false);
  game.applyStoryInteraction(WRECK_DEVICES.at(-1));
  assert.equal(isMapUnlocked(game.progress.worldProgress, "coast-flooded-station"), true);

  game.applyStoryInteraction("flooded-station-main-transceiver");
  game.applyStoryInteraction("flooded-station-deleted-record", { classification: "past" });
  assert.equal(isMapUnlocked(game.progress.worldProgress, "coast-tide-core-cave"), false);
  game.applyStoryInteraction("flooded-station-support", { choice: "echo" });
  assert.equal(isMapUnlocked(game.progress.worldProgress, "coast-tide-core-cave"), true);
});

test("collected communication records are rendered in chronological story order", () => {
  const { game, renderedLogs } = storyHarness();
  game.applyStoryInteraction("coast-beach-transceiver");
  game.applyStoryInteraction("sera-distress-current", { classification: "current" });
  for (const id of WRECK_DEVICES) game.applyStoryInteraction(id);
  for (const id of WRECK_RECORDS) game.applyStoryInteraction(id, { classification: "past" });
  game.applyStoryInteraction("flooded-station-main-transceiver");
  game.applyStoryInteraction("flooded-station-deleted-record", { classification: "past" });
  game.updateChapterUi();

  assert.deepEqual(
    renderedLogs.at(-1).map(record => record.id),
    [
      "wreck-record-sera",
      "wreck-record-roan",
      "wreck-record-garen",
      "wreck-record-vanguard-captain",
      "flooded-station-deleted-record",
      "sera-distress-current",
    ],
  );
});

test("all four physical coast maps announce their own region entry", () => {
  assert.deepEqual(Object.fromEntries([
    "coast-beach",
    "coast-wreck-bay",
    "coast-flooded-station",
    "coast-tide-core-cave",
  ].map(mapId => [mapId, regionEntryMessage(mapId)])), {
    "coast-beach": "푸른 해변에 도착했습니다. 게와 물방울 슬라임을 조심하세요.",
    "coast-wreck-bay": "난파선 만에 도착했습니다. 흩어진 중계 신호를 찾으세요.",
    "coast-flooded-station": "침수된 통신소에 도착했습니다. 끊긴 기록을 복구하세요.",
    "coast-tide-core-cave": "조수 코어 동굴에 도착했습니다. 깊은 물결의 보스를 조심하세요.",
  });
});

test("revisited story actors open the support-dependent follow-up model", () => {
  const { game } = storyHarness();
  game.progress.worldProgress.unlockedMapIds.push("coast-wreck-bay", "coast-flooded-station");
  game.progress.worldProgress.chapters.coast.repairedDeviceIds.push("flooded-station-main-transceiver");
  game.progress.worldProgress.chapters.coast.collectedRecordIds.push("flooded-station-deleted-record");
  game.applyStoryInteraction("flooded-station-support", { choice: "mari" });
  let model = null;
  game.keys = new Set();
  game.player.moving = true;
  game.dialogue = {
    open(value) { model = value; },
    actionButtons() { return []; },
  };
  game.updateNpcPrompt = () => {};

  assert.equal(game.openNpcDialogue({ actorId: "mari", role: "guide" }), true);
  assert.equal(model.pages.length, 2);
  assert.match(model.pages[1], /마리:/);

  const mari = { actorId: "mari", role: "guide", x: 850, y: 620, interactionRadius: 80 };
  game.running = true;
  game.inputEnabled = true;
  game.chatInputActive = false;
  game.portalTransition = null;
  game.player = { ...game.player, x: 850, y: 620, respawnTimer: 0 };
  game.npcs = [mari];
  game.nearbyStoryInteraction = null;
  let routed = null;
  game.openNpcDialogue = npc => { routed = npc; return true; };
  assert.equal(game.openNpcInteraction(), true);
  assert.equal(routed, mari);
});

test("generic F near the cave Echo signal opens the reveal and resolves its accepted follow-up", () => {
  const { game, saves } = storyHarness();
  game.progress.worldProgress.unlockedMapIds.push("coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave");
  game.progress.worldProgress.chapters.coast.supportChoice = "echo";
  game.mapId = "coast-tide-core-cave";
  game.running = true;
  game.inputEnabled = true;
  game.chatInputActive = false;
  game.portalTransition = null;
  game.player = { ...game.player, x: 1540, y: 780, respawnTimer: 0, moving: true };
  game.npcs = [];
  game.keys = new Set();
  game.attackState = { kind: "basic" };
  game.isInteractionOpen = () => false;
  game.ui.npcPrompt = { hidden: true };
  game.ui.npcPromptText = { textContent: "" };
  let model = null;
  let closed = 0;
  game.dialogue = {
    open(value) { model = value; },
    actionButtons() { return []; },
  };
  game.closeNpcDialogue = () => { closed += 1; game.pendingStoryInteraction = null; return true; };

  game.updateNpcPrompt();
  assert.equal(game.nearbyStoryInteraction.id, COAST_TIDE_CORE_REVEAL.id);
  assert.match(game.ui.npcPromptText.textContent, /에코|신호/);
  assert.equal(game.openNpcInteraction(), true);
  assert.deepEqual(model.pages, [
    ...COAST_TIDE_CORE_REVEAL.pages,
    COAST_SUPPORT_FOLLOW_UPS.echo.echo,
  ]);
  assert.deepEqual(model.actions.map(action => action.id), ["story-complete"]);

  game.handleDialogueAction("story-complete");
  assert.equal(closed, 1);
  assert.equal(saves.length, 0);
});

test("Echo's signal interaction does not mask rescued Sera's nearby follow-up", () => {
  const { game } = storyHarness();
  game.progress.worldProgress.unlockedMapIds.push("coast-tide-core-cave");
  game.progress.worldProgress.chapters.coast.supportChoice = "echo";
  game.progress.worldProgress.chapters.coast.seraRescued = true;
  game.mapId = "coast-tide-core-cave";
  game.running = true;
  game.inputEnabled = true;
  game.chatInputActive = false;
  game.portalTransition = null;
  game.player = { ...game.player, x: 1580, y: 720, respawnTimer: 0, moving: false };
  const sera = {
    actorId: "sera", role: "rescued", name: "세라",
    mapId: game.mapId, x: 1580, y: 720, interactionRadius: 80,
  };
  game.npcs = [sera];
  game.keys = new Set();
  game.isInteractionOpen = () => false;
  game.ui.npcPrompt = { hidden: true };
  game.ui.npcPromptText = { textContent: "" };
  let model = null;
  game.dialogue = {
    open(value) { model = value; },
    actionButtons() { return []; },
  };

  game.updateNpcPrompt();
  assert.equal(game.nearbyStoryInteraction, null);
  assert.equal(game.nearbyNpc, sera);
  assert.equal(game.openNpcInteraction(), true);
  assert.equal(model.pages.at(-1), COAST_SUPPORT_FOLLOW_UPS.echo.sera);
});
