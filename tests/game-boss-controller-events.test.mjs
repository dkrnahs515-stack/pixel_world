import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260903-volcano-20260905-upgrade.js";
import { PixelRPG as SanctuaryPixelRPG } from "../src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { createSanctuaryChorusController } from "../src/sanctuary-chorus-controller-20260911-sanctuary.js";
import { createChorusEncounter } from "../src/sanctuary-chorus-state-20260911-sanctuary.js";
import {
  chooseVolcanoRoute,
  normalizeWorldProgress,
  recordChapterBossDefeat,
} from "../src/chapter-progress-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import {
  createInitialProgress,
} from "../src/quest-state-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import {
  grantVolcanoHiddenWeapons,
} from "../src/equipment-state-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import {
  loadProgress,
  saveProgress,
} from "../src/progress-storage-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";

function loadedRescuedProgress() {
  let worldProgress = normalizeWorldProgress({
    chapters: {
      coast: { coreFragmentObtained: true },
      volcano: {
        repairedDeviceIds: [
          "ash-gate-pressure-seal",
          "magma-valve-west",
          "magma-valve-central",
          "magma-valve-east",
          "observatory-stabilizer",
        ],
        collectedClueIds: [
          "garen-scorched-insignia",
          "garen-escort-record",
          "captain-transport-order",
          "captain-core-contact-record",
        ],
        coolantAnchorIds: [
          "ash-gate-coolant-anchor",
          "magma-route-coolant-anchor",
          "observatory-coolant-anchor",
        ],
      },
    },
    unlockedMapIds: ["volcano-observatory"],
  });
  worldProgress = chooseVolcanoRoute(worldProgress, "rescue").progress;
  worldProgress = recordChapterBossDefeat(worldProgress, "volcano").progress;
  const granted = grantVolcanoHiddenWeapons({ ...createInitialProgress(), worldProgress });
  assert.equal(granted.ok, true);
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  assert.equal(saveProgress(storage, "합창 구조대", granted.progress).ok, true);
  return loadProgress(storage, "합창 구조대");
}

function harness(controller) {
  const game = Object.create(PixelRPG.prototype);
  const damage = [];
  const rewards = [];
  game.coopBossController = controller;
  game.damagePlayer = amount => damage.push(amount);
  game.processBossReward = event => { rewards.push(event.encounterId); return true; };
  return { game, damage, rewards };
}

const damageEvent = { type: "damage-player", attackId: "boss:1", amount: 12 };
const defeatEvent = {
  type: "boss-defeated",
  encounterId: "encounter-1",
  bossId: "forest-core-troll",
  mapId: "forest",
  rewardExp: 300,
  rewardGold: 200,
};

test("one game adapter consumes LocalBossController-style buffered events exactly once", () => {
  const buffered = [damageEvent, defeatEvent];
  const controller = {
    update: () => buffered,
    consumeEvents: () => buffered,
    renderableBoss: () => ({ id: "forest-core-troll" }),
  };
  const { game, damage, rewards } = harness(controller);

  assert.deepEqual(game.updateBossController(1 / 60, {}, 10), buffered);
  assert.deepEqual(damage, [12]);
  assert.deepEqual(rewards, ["encounter-1"]);
});

test("the same game adapter consumes CoopBossController-style update-returned events exactly once", () => {
  const returned = [damageEvent, defeatEvent];
  const controller = {
    update: () => returned,
    renderableBoss: () => ({ id: "forest-core-troll" }),
  };
  const { game, damage, rewards } = harness(controller);

  assert.deepEqual(game.updateBossController(1 / 60, {}, 10), returned);
  assert.deepEqual(damage, [12]);
  assert.deepEqual(rewards, ["encounter-1"]);
});

test("sanctuary combat target collection keeps chorus separate from the generic boss controller", () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  game.coopBossController = { targetableBosses: () => [{ id: "forest-core-troll" }] };
  game.chorusController = { targetableBosses: () => [{ id: "unnamed-chorus", isChorusTarget: true }] };

  assert.deepEqual(game.targetableBosses().map(target => target.id), ["forest-core-troll", "unnamed-chorus"]);
});

test("melee hits route chorus targets through the chorus attack adapter", () => {
  const requests = [];
  const game = Object.create(SanctuaryPixelRPG.prototype);
  game.player = { x: 100, y: 100, dir: "right", mapId: "sanctuary-return-record" };
  game.mapId = "sanctuary-return-record";
  game.classId = "warrior";
  game.progress = { level: 1 };
  game.enemies = [];
  game.attackState = { requestedBossIds: new Set() };
  game.coopBossController = { requestHit: () => { throw new Error("generic boss path used"); } };
  game.chorusController = {
    targetableBosses: () => [{
      id: "unnamed-chorus", x: 140, y: 100, radius: 24, hp: 100,
      targetable: true, isCoopBoss: true, isChorusTarget: true,
    }],
    requestAttack: request => { requests.push(request); return { ok: true }; },
  };
  game.commitEnemyKillEffects = () => {};
  game.requestHitStop = () => {};

  game.applyAttackHits({ range: 90, arcDegrees: 120, damage: 9, knockback: 0, hitStun: 0, hitStop: 0 }, "strong");

  assert.equal(requests.length, 1);
  assert.equal(requests[0].targetId, "unnamed-chorus");
  assert.equal(requests[0].attackKind, "strong");
});

test("an expired chorus projectile hit is rejected by chorus instead of leaking into the generic boss path", () => {
  const routed = [];
  const game = Object.create(SanctuaryPixelRPG.prototype);
  game.player = { x: 100, y: 100 };
  game.mapId = "sanctuary-return-record";
  game.chorusController = {
    targetableBosses: () => [],
    requestAttack: request => { routed.push(["chorus", request.targetId]); return { ok: false }; },
  };
  game.coopBossController = {
    requestHit: request => { routed.push(["generic", request.targetId]); return { ok: true }; },
  };

  game.requestBossTargetHitById("chorus-bond-roan", { attackKind: "basic" });

  assert.deepEqual(routed, [["chorus", "chorus-bond-roan"]]);
});

test("F interaction gives a nearby chorus objective priority over story interactions", () => {
  const calls = [];
  const game = Object.create(SanctuaryPixelRPG.prototype);
  game.running = true;
  game.inputEnabled = true;
  game.chatInputActive = false;
  game.portalTransition = null;
  game.player = { respawnTimer: 0, x: 700, y: 1120 };
  game.nearbyChorusInteraction = { type: "anchor" };
  game.nearbyStoryInteraction = { id: "record-field" };
  game.chorusController = { interact: player => { calls.push(["chorus", player.x]); return { ok: true }; } };
  game.openStoryInteraction = () => { calls.push(["story"]); return true; };

  assert.equal(game.openNpcInteraction(), true);
  assert.deepEqual(calls, [["chorus", 700]]);
});

test("chorus update applies only its local damage event and never grants a generic boss reward", () => {
  const damage = [];
  const rewards = [];
  const game = Object.create(SanctuaryPixelRPG.prototype);
  game.player = { x: 100, y: 100 };
  game.chorusController = {
    update: () => ({
      events: [
        { type: "damage-player", eventId: "pattern-1", amount: 14, source: { x: 1080, y: 900 } },
        { type: "chorus-separated", encounterId: "chorus-1" },
      ],
    }),
    renderModel: () => ({ shared: { phase: "separated" }, personal: {} }),
  };
  game.damagePlayer = amount => { damage.push(amount); return { applied: true, died: false }; };
  game.processBossReward = value => rewards.push(value);
  game.updateChorusHud = () => {};

  game.updateChorusController(1 / 60, {}, 2000);

  assert.deepEqual(damage, [14]);
  assert.deepEqual(rewards, []);
});

test("the game syncs loaded captain branch class and owned equipment into the live Chorus controller", () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  game.progress = loadedRescuedProgress();
  game.progress.worldProgress.chapters.sanctuary.correctionLinked = true;
  game.classId = "archer";
  game.mapId = "sanctuary-return-record";
  game.chorusController = createSanctuaryChorusController({ uid: "local-player", now: () => 2000 });

  game.syncChorusMap();

  const model = game.chorusController.renderModel();
  assert.equal(model.branch.lumen.mode, "live-voice");
  assert.deepEqual(model.lumenAssist.availableAnchorIds, ["forest", "coast", "volcano"]);
  assert.equal(game.chorusController.classId, "archer");
});

test("class and equipment changes refresh Chorus assist eligibility without replacing its encounter", () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  game.progress = loadedRescuedProgress();
  game.progress.worldProgress.chapters.sanctuary.correctionLinked = true;
  game.classId = "warrior";
  game.player = { classId: "warrior", equippedWeaponId: "starter-sword", skillResources: {} };
  game.skillCasts = [];
  game.sessionMode = "solo";
  game.applyProgressionStats = () => {};
  game.mapId = "sanctuary-return-record";
  game.chorusController = createSanctuaryChorusController({ uid: "local-player", now: () => 2000 });
  game.syncChorusMap();
  const encounterId = game.chorusController.snapshot.encounterId;

  game.progress.equipmentByClass.mage.ownedWeaponIds = [];
  game.configureClassSession("mage");
  assert.equal(game.chorusController.snapshot.encounterId, encounterId);
  assert.equal(game.chorusController.classId, "mage");
  assert.equal(game.chorusController.renderModel().lumenAssist, null);

  game.progress.equipmentByClass.mage.ownedWeaponIds.push("leyflame-core-staff");
  game.syncChorusMap();
  assert.deepEqual(game.chorusController.renderModel().lumenAssist.availableAnchorIds, ["forest", "coast", "volcano"]);
});

test("the actual game F handler uses a nearby rescued assist and lost never exposes it", async () => {
  const rescued = Object.create(SanctuaryPixelRPG.prototype);
  rescued.progress = loadedRescuedProgress();
  rescued.progress.worldProgress.chapters.sanctuary.correctionLinked = true;
  rescued.classId = "warrior";
  rescued.mapId = "sanctuary-return-record";
  rescued.player = { x: 700, y: 1120, respawnTimer: 0 };
  rescued.chorusController = createSanctuaryChorusController({ uid: "local-player", now: () => 2000 });
  rescued.running = true;
  rescued.inputEnabled = true;
  rescued.chatInputActive = false;
  rescued.portalTransition = null;
  rescued.nearbyStoryInteraction = null;
  rescued.npcs = [];
  rescued.ui = { npcPrompt: { hidden: true }, npcPromptText: { textContent: "" } };
  rescued.isInteractionOpen = () => false;
  rescued.notify = () => {};
  rescued.syncChorusMap();
  rescued.updateNpcPrompt();

  assert.equal(rescued.nearbyChorusInteraction.type, "lumen-assist");
  assert.equal(rescued.openNpcInteraction(), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rescued.chorusController.snapshot.lumenAssistUsed, true);
  assert.deepEqual(rescued.chorusController.snapshot.stabilizedAnchorIds, ["forest"]);

  const lost = Object.create(SanctuaryPixelRPG.prototype);
  lost.progress = structuredClone(rescued.progress);
  lost.progress.worldProgress.chapters.volcano.captainOutcome = "lost";
  lost.classId = "warrior";
  lost.mapId = "sanctuary-return-record";
  lost.player = { x: 1080, y: 1120, respawnTimer: 0 };
  lost.chorusController = createSanctuaryChorusController({ uid: "local-player", now: () => 2000 });
  lost.running = true;
  lost.inputEnabled = true;
  lost.chatInputActive = false;
  lost.portalTransition = null;
  lost.npcs = [];
  lost.ui = { npcPrompt: { hidden: true }, npcPromptText: { textContent: "" } };
  lost.isInteractionOpen = () => false;
  lost.syncChorusMap();
  lost.updateNpcPrompt();
  assert.equal(lost.nearbyChorusInteraction, null);
});

test("the one-time rescued controller interruption reaches the visible dialogue UI", () => {
  const opened = [];
  const game = Object.create(SanctuaryPixelRPG.prototype);
  game.classId = "warrior";
  game.progress = loadedRescuedProgress();
  game.keys = new Set(["ArrowRight"]);
  game.player = { moving: true };
  game.ui = { message: {} };
  game.dialogue = {
    open(model) { opened.push(model); },
    actionButtons() { return []; },
  };
  game.processedChorusEventIds = new Set();
  game.updateChorusHud = () => {};
  const seed = {
    ...createChorusEncounter({ encounterId: "chorus-1", authorityUid: "local-player", now: 1000 }),
    stabilizedAnchorIds: ["forest", "coast", "volcano"],
  };
  game.chorusController = createSanctuaryChorusController({
    uid: "local-player",
    captainOutcome: "rescued",
    seedSnapshot: seed,
    now: () => 3000,
  });
  game.chorusController.setMap("sanctuary-return-record", { correctionLinked: true });

  game.updateChorusController(1 / 60, {}, 3000);
  game.updateChorusController(1 / 60, {}, 3001);

  assert.equal(opened.length, 1);
  assert.equal(opened[0].title, "루멘의 생존 통신");
  assert.match(opened[0].pages.join(" "), /거짓 명령/);
  assert.deepEqual(opened[0].actions, []);
  assert.deepEqual([...game.keys], []);
  assert.equal(game.player.moving, false);
});
