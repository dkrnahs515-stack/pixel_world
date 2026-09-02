import test from "node:test";
import assert from "node:assert/strict";
import { createLocalBossController } from "../src/local-boss-controller-20260829-coast.js";

function coastPlayer(overrides = {}) {
  return {
    uid: "solo", x: 1560, y: 1280, hp: 100,
    mapId: "coast-tide-core-cave", classId: "warrior", equippedWeaponId: "starter-sword",
    ...overrides,
  };
}

test("local controller creates a one-player coast encounter and skips maps without bosses", async () => {
  const controller = createLocalBossController();

  assert.equal(await controller.setMap("village"), false);
  assert.equal(controller.snapshot, null);
  assert.equal(await controller.setMap("coast-tide-core-cave"), true);
  assert.equal(controller.snapshot.maxHp, 120);
  assert.match(controller.snapshot.encounterId, /^local:coast:/);
  assert.equal(controller.targetableBoss().id, "coast-core-shark");
});

test("fresh local controller sessions receive distinct stable serializable encounter IDs", async () => {
  const first = createLocalBossController({ sessionId: "session-a" });
  const second = createLocalBossController({ sessionId: "session-b" });

  await first.setMap("forest");
  await second.setMap("forest");

  assert.equal(first.snapshot.encounterId, "local:forest:session-a:1");
  assert.equal(second.snapshot.encounterId, "local:forest:session-b:1");
  assert.notEqual(first.snapshot.encounterId, second.snapshot.encounterId);
  assert.equal(JSON.parse(JSON.stringify(first.snapshot)).encounterId, first.snapshot.encounterId);
  const stableEncounterId = first.snapshot.encounterId;
  first.targetableBoss();
  assert.equal(first.snapshot.encounterId, stableEncounterId);
});

test("local controller derives damage, range, and cooldown from the equipped attack definition", async () => {
  let now = 1_000;
  const controller = createLocalBossController({ wallNow: () => now });
  await controller.setMap("coast-tide-core-cave");

  const first = await controller.requestHit({
    attackKind: "basic", player: coastPlayer(), classId: "warrior", weaponId: "starter-sword",
    direction: "right", damage: 999,
  });
  assert.deepEqual(first, { ok: true, damage: 1 });
  assert.equal(controller.snapshot.hp, 119);
  assert.equal((await controller.requestHit({
    attackKind: "basic", player: coastPlayer(), classId: "warrior", weaponId: "starter-sword", direction: "right",
  })).reason, "cooldown");
  now += 500;
  assert.equal((await controller.requestHit({
    attackKind: "basic", player: coastPlayer({ x: 1_340 }), classId: "warrior", weaponId: "starter-sword", direction: "right",
  })).reason, "out_of_range");
});

test("local controller emits one defeat reward and forwards boss damage to the local player", async () => {
  const controller = createLocalBossController({
    wallNow: () => 2_000,
    simulate: enemies => ({
      enemies,
      events: [{ type: "damage-player", attackId: "shark:1", amount: 12 }],
    }),
  });
  await controller.setMap("coast-tide-core-cave");
  controller.snapshot.hp = 1;
  controller.view.hp = 1;

  await controller.requestHit({
    attackKind: "basic", player: coastPlayer(), classId: "warrior", weaponId: "starter-sword", direction: "right",
  });
  assert.deepEqual(controller.consumeEvents(), [{
    type: "boss-defeated", encounterId: controller.snapshot.encounterId, bossId: "coast-core-shark",
    mapId: "coast-tide-core-cave", rewardExp: 150, rewardGold: 100,
  }]);
  assert.deepEqual(controller.consumeEvents(), []);

  await controller.setMap("coast-tide-core-cave");
  controller.update(1 / 60, { player: coastPlayer(), isBlocked: () => false });
  assert.deepEqual(controller.consumeEvents(), [{
    type: "damage-player", attackId: "shark:1", amount: 12 }]);
});

test("clear resets the encounter and a recreated local controller starts at full health", async () => {
  const first = createLocalBossController();
  await first.setMap("coast-tide-core-cave");
  await first.requestHit({
    attackKind: "basic", player: coastPlayer(), classId: "warrior", weaponId: "starter-sword", direction: "right",
  });
  first.clear();
  assert.equal(first.snapshot, null);
  assert.equal(first.renderableBoss(), null);

  const recreated = createLocalBossController();
  await recreated.setMap("coast-tide-core-cave");
  assert.equal(recreated.snapshot.hp, 120);
  assert.equal(recreated.snapshot.maxHp, 120);
});
