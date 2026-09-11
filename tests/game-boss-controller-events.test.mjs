import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260903-volcano-20260905-upgrade.js";
import { PixelRPG as SanctuaryPixelRPG } from "../src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";

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
