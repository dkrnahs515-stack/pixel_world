import test from "node:test";
import assert from "node:assert/strict";
import { createCoopBossController } from "../src/coop-boss-controller-20260902-lease.js";
import { getCoopBossForMap } from "../src/coop-boss-data-20260829-coast.js";
import { createBossEncounter } from "../src/coop-boss-state-20260829-coast.js";
import { createLocalBossController } from "../src/local-boss-controller-20260829-coast.js";

const MAP_ID = "coast-tide-core-cave";
const PLAYER = Object.freeze({
  uid: "player", x: 1500, y: 1280, hp: 100, mapId: MAP_ID,
  classId: "warrior", equippedWeaponId: "starter-sword",
});
const BOSS_EVENT = Object.freeze({ type: "boss-phase", phase: 2 });

function simulation(enemies) {
  return { enemies, events: [BOSS_EVENT] };
}

async function controllerFixtures() {
  const local = createLocalBossController({ simulate: simulation, wallNow: () => 0 });
  await local.setMap(MAP_ID);

  const online = createCoopBossController({
    uid: "player",
    network: { publishState: async () => ({ ok: true }) },
    simulate: simulation,
    now: () => 0,
    wallNow: () => 0,
  });
  online.receiveSnapshot(createBossEncounter(getCoopBossForMap(MAP_ID), {
    encounterId: "online-contract",
    authorityUid: "player",
    now: 0,
  }));

  return [
    ["local", local, { player: PLAYER, isBlocked: () => false }],
    ["online", online, { player: PLAYER, remotePlayers: new Map(), isBlocked: () => false }],
  ];
}

test("local and online boss adapters expose the same single-delivery event contract", async () => {
  for (const [name, controller, context] of await controllerFixtures()) {
    assert.equal(typeof controller.consumeEvents, "function", `${name} consumeEvents`);
    assert.deepEqual(controller.update(1 / 60, context, 0), [BOSS_EVENT], `${name} update fallback`);
    assert.deepEqual(controller.consumeEvents(), [BOSS_EVENT], `${name} buffered delivery`);
    assert.deepEqual(controller.consumeEvents(), [], `${name} no double delivery`);
  }
});
