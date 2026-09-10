import test from "node:test";
import assert from "node:assert/strict";
import { CoopBossController } from "../src/coop-boss-controller-20260910-sanctuary.js";
import { rewriteOriginEncounter } from "./helpers/sanctuary-fixtures.mjs";

function networkHarness() {
  const published = [];
  const damage = [];
  return {
    published,
    damage,
    async setMap(mapId) { return mapId === "sanctuary-core-heart"; },
    async ensureEncounter() { return null; },
    async tryAcquireAuthority() { return { ok: false, reason: "not_needed" }; },
    async publishState(snapshot) { published.push(snapshot); return { ok: true }; },
    async sendPlayerDamage(uid, event) { damage.push([uid, event]); return { ok: true }; },
    async writeRewardClaims() { return { ok: true, failedUids: [] }; },
    async cleanupExpired() { return { ok: true, removed: 0 }; },
  };
}

test("shared boss controller accepts and simulates ORIGIN rewrite state", async () => {
  const network = networkHarness();
  const controller = new CoopBossController({
    uid: "player-a",
    network,
    now: () => 10_000,
    wallNow: () => 10_000,
  });
  assert.equal(await controller.setMap("sanctuary-core-heart", { deferEncounter: true }), true);
  assert.equal(controller.receiveSnapshot(rewriteOriginEncounter({
    authorityUid: "player-a",
    leaseUntil: 20_000,
    anchors: {},
    rewriteCycle: { phase: "idle", elapsed: 0, sequence: 0 },
  })), true);
  assert.ok(controller.renderableBoss());
  assert.equal(controller.renderableBoss().kind, "core-sentinel");

  const events = controller.update(0.1, {
    player: {
      uid: "player-a",
      mapId: "sanctuary-core-heart",
      x: 900,
      y: 900,
      hp: 120,
      radius: 14,
    },
    remotePlayers: new Map(),
    random: () => 0.25,
  }, 10_000);

  assert.equal(events.some(event => event.type === "rewrite-warning"), true);
  assert.deepEqual(Object.keys(controller.snapshot.anchors).sort(), [
    "origin-anchor-energy",
    "origin-anchor-life",
    "origin-anchor-memory",
  ]);
  assert.equal(controller.targetableBoss() !== null, true);
  assert.equal(network.published.length, 1);
});

test("regional boss runtime still accepts the old forest encounter shape", async () => {
  const network = networkHarness();
  network.setMap = async mapId => mapId === "forest";
  const controller = new CoopBossController({
    uid: "player-a",
    network,
    now: () => 10_000,
    wallNow: () => 10_000,
  });
  await controller.setMap("forest", { deferEncounter: true });
  assert.equal(controller.receiveSnapshot({
    encounterId: "forest-1",
    bossId: "forest-core-troll",
    mapId: "forest",
    status: "alive",
    x: 2160,
    y: 1400,
    dir: "down",
    moving: false,
    hp: 600,
    maxHp: 600,
    phase: 1,
    targetUid: null,
    authorityUid: "player-a",
    authorityEpoch: 1,
    leaseUntil: 20_000,
    partySize: 1,
    spawnedAt: 0,
    defeatedAt: null,
    respawnAt: null,
    contributors: {},
    updatedAt: 10_000,
  }), true);
  assert.equal(controller.renderableBoss().kind, "moss-troll");
});
