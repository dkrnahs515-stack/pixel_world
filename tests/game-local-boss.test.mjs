import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260903-volcano-20260905-upgrade.js";
import { LocalBossController } from "../src/local-boss-controller-20260903-volcano-20260905-upgrade.js";

function harness(mapId = "forest") {
  const game = Object.create(PixelRPG.prototype);
  game.mapId = mapId;
  game.sessionMode = "solo";
  game.remotePlayers = new Map();
  game.network = { uid: "local-player", coopBoss: null };
  game.coopBossController = null;
  game.updateCoopBossHud = () => {};
  return game;
}

test("solo selects a local one-player boss controller without constructing the Firebase controller", async () => {
  const game = harness();
  let onlineConstructions = 0;
  game.createOnlineBossController = () => { onlineConstructions += 1; return null; };

  assert.equal(await game.replaceBossControllerForMode("solo"), true);
  assert.equal(onlineConstructions, 0);
  assert.ok(game.coopBossController instanceof LocalBossController);
  assert.equal(game.coopBossController.snapshot.partySize, 1);
  assert.equal(game.coopBossController.snapshot.hp, 600);
  assert.equal(game.coopBossController.snapshot.maxHp, 600);
});

test("disconnect discards the cooperative snapshot and starts a fresh full-HP local encounter", async () => {
  const game = harness();
  let clears = 0;
  const sharedSnapshot = {
    encounterId: "firebase:forest:old",
    bossId: "forest-core-troll",
    mapId: "forest",
    hp: 7,
    maxHp: 310,
  };
  game.sessionMode = "online";
  game.coopBossController = { snapshot: sharedSnapshot, clear() { clears += 1; } };
  game.network = { stop: async () => {} };
  game.ui = { playerCount: { textContent: "2" } };
  game.chatMessages = [];
  game.chat = { setMode() {}, renderMessages() {} };
  game.receiveChatMessages = () => {};
  game.remotePlayers = new Map();
  game.notify = () => {};

  assert.equal(await game.fallbackToSolo("connection_lost"), true);
  assert.equal(clears, 1);
  assert.ok(game.coopBossController instanceof LocalBossController);
  assert.notEqual(game.coopBossController.snapshot.encounterId, sharedSnapshot.encounterId);
  assert.equal(game.coopBossController.snapshot.hp, 600);
  assert.equal(game.coopBossController.snapshot.maxHp, 600);
});

test("fallback 뒤 retained online snapshot callback은 local controller와 solo state를 건드리지 않는다", async () => {
  const game = harness();
  let onlineSnapshots = 0;
  game.sessionMode = "online";
  game.bossNetworkGeneration = 4;
  game.coopBossController = {
    receiveSnapshot() { onlineSnapshots += 1; },
    clear() {},
  };
  game.network = { stop: async () => {} };
  game.ui = { playerCount: { textContent: "2" } };
  game.chatMessages = [];
  game.chat = { setMode() {}, renderMessages() {} };
  game.receiveChatMessages = () => {};
  game.notify = () => {};
  const retainedCallbacks = game.createBossNetworkCallbacks(4);

  await game.fallbackToSolo("connection_lost");
  const localController = game.coopBossController;
  const localSnapshot = structuredClone(localController.snapshot);

  assert.doesNotThrow(() => retainedCallbacks.onBossChanged({
    encounterId: "late-online",
    bossId: "forest-core-troll",
    mapId: "forest",
    hp: 1,
  }));
  assert.equal(onlineSnapshots, 0);
  assert.strictEqual(game.coopBossController, localController);
  assert.deepEqual(game.coopBossController.snapshot, localSnapshot);
  assert.equal(game.sessionMode, "solo");
});

test("current online async callback rejection is caught and reported", async () => {
  const game = harness();
  const reports = [];
  game.sessionMode = "online";
  game.bossNetworkGeneration = 7;
  game.coopBossController = {
    receiveAttackRequests: async () => { throw new Error("simulated async callback failure"); },
  };
  game.reportBossCallbackError = (message, error) => reports.push([message, error.message]);
  const callbacks = game.createBossNetworkCallbacks(7);

  callbacks.onBossAttackRequestsChanged({ fighter: {} });
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.deepEqual(reports, [["협동 보스 공격 요청 처리 실패", "simulated async callback failure"]]);
});
