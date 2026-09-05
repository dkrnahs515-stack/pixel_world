import test from "node:test";
import assert from "node:assert/strict";
import { createCoopBossController } from "../src/coop-boss-controller-20260903-volcano-20260905-upgrade.js";
import { createLocalBossController } from "../src/local-boss-controller-20260903-volcano-20260905-upgrade.js";
import { createBossEncounter } from "../src/coop-boss-state-20260903-volcano-20260905-upgrade.js";
import { getCoopBossForMap } from "../src/coop-boss-data-20260903-volcano-20260905-upgrade.js";

function snapshot(mapId, overrides = {}) {
  return {
    ...createBossEncounter(getCoopBossForMap(mapId), {
      encounterId: "encounter-1", partySize: 1, now: 0,
      authorityUid: "host", authorityEpoch: 1,
    }),
    ...overrides,
  };
}

test("same authority encounter snapshot retains live AI state while a new encounter resets it", () => {
  const controller = createCoopBossController({
    uid: "host", network: {}, now: () => 0, wallNow: () => 0,
  });
  controller.receiveSnapshot(snapshot("volcano-core-caldera"));
  const originalView = controller.view;
  controller.view.cooldownRemaining = 2.8;
  controller.view.attackSequence = 7;

  controller.receiveSnapshot(snapshot("volcano-core-caldera", { updatedAt: 500 }));
  assert.equal(controller.view, originalView);
  assert.equal(controller.view.cooldownRemaining, 2.8);
  assert.equal(controller.view.attackSequence, 7);

  controller.receiveSnapshot(snapshot("volcano-core-caldera", {
    encounterId: "encounter-2", authorityEpoch: 2, updatedAt: 1_000,
  }));
  assert.notEqual(controller.view, originalView);
  assert.equal(controller.view.cooldownRemaining, 0);
  assert.equal(controller.view.attackSequence, 0);
});

for (const mapId of ["forest", "volcano-core-caldera"]) {
  test(`${mapId} local boss deals cooldown-bound contact damage`, async () => {
    const controller = createLocalBossController({ wallNow: () => 0, sessionId: "contact" });
    await controller.setMap(mapId);
    const player = {
      uid: "solo", mapId, hp: 100,
      x: controller.view.x, y: controller.view.y, radius: 16,
    };

    const first = controller.update(1 / 60, { player, isBlocked: () => false, random: () => 0.5 });
    const second = controller.update(1 / 60, { player, isBlocked: () => false, random: () => 0.5 });
    assert.equal(first.filter(event => event.type === "damage-player").length, 1);
    assert.equal(second.filter(event => event.type === "damage-player").length, 0);
    assert.equal(controller.consumeEvents().filter(event => event.type === "damage-player").length, 1);
  });
}

test("online authority sends contact damage to the overlapping target UID once per cooldown", () => {
  const sent = [];
  const controller = createCoopBossController({
    uid: "host", wallNow: () => 0, now: () => 0,
    network: {
      publishState: async () => ({ ok: true }),
      sendPlayerDamage: (uid, event) => { sent.push({ uid, event }); return Promise.resolve(); },
    },
  });
  controller.receiveSnapshot(snapshot("forest"));
  const target = {
    uid: "guest", mapId: "forest", hp: 100,
    x: controller.view.x, y: controller.view.y, radius: 16,
  };
  const context = { player: { ...target, uid: "host", x: 0, y: 0 }, remotePlayers: new Map([[target.uid, target]]) };

  controller.update(1 / 60, context, 0);
  controller.update(1 / 60, context, 16);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].uid, "guest");
  assert.equal(sent[0].event.damage, controller.view.contactDamage);
});

test("online contact damage reaches every overlapping player in the same cooldown pulse", () => {
  const sent = [];
  const controller = createCoopBossController({
    uid: "host", wallNow: () => 0, now: () => 0,
    network: {
      publishState: async () => ({ ok: true }),
      sendPlayerDamage: (uid, event) => { sent.push({ uid, event }); return Promise.resolve(); },
    },
  });
  controller.receiveSnapshot(snapshot("forest"));
  const overlapping = uid => ({
    uid, mapId: "forest", hp: 100,
    x: controller.view.x, y: controller.view.y, radius: 16,
  });
  controller.update(1 / 60, {
    player: overlapping("host"),
    remotePlayers: new Map([["guest", overlapping("guest")]]),
  }, 0);

  assert.deepEqual(sent.map(item => item.uid).sort(), ["guest", "host"]);
});

test("the first contact hit is delivered again after a new encounter resets attack sequence", () => {
  const sent = [];
  const controller = createCoopBossController({
    uid: "host", wallNow: () => 0, now: () => 0,
    network: {
      publishState: async () => ({ ok: true }),
      sendPlayerDamage: (uid, event) => { sent.push({ uid, event }); return Promise.resolve(); },
    },
  });
  const player = { uid: "host", mapId: "forest", hp: 100, radius: 16 };
  controller.receiveSnapshot(snapshot("forest"));
  player.x = controller.view.x;
  player.y = controller.view.y;
  controller.update(1 / 60, { player, remotePlayers: new Map() }, 0);

  controller.receiveSnapshot(snapshot("forest", { encounterId: "encounter-2", authorityEpoch: 2 }));
  player.x = controller.view.x;
  player.y = controller.view.y;
  controller.update(1 / 60, { player, remotePlayers: new Map() }, 16);

  assert.equal(sent.length, 2);
  assert.notEqual(sent[0].event.encounterId, sent[1].event.encounterId);
});
