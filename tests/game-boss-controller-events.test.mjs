import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260903-volcano.js";

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
