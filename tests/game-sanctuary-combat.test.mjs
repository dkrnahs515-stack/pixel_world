import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260910-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";
import { LocalBossController } from "../src/local-boss-controller-20260910-sanctuary.js";
import { originDefeatedProgress, originReadyProgress, zeroBoundaryUnlockedProgress } from "./helpers/sanctuary-fixtures.mjs";

test("local boss controller creates ORIGIN in the core heart without breaking regional bosses", async () => {
  const controller = new LocalBossController({
    now: () => 10_000,
    wallNow: () => 10_000,
    sessionId: "sanctuary-local",
  });
  assert.equal(await controller.setMap("sanctuary-core-heart"), true);
  assert.equal(controller.snapshot?.bossId, "origin-zero");
  assert.equal(controller.snapshot?.hp, 1200);
  assert.equal(controller.renderableBoss()?.kind, "core-sentinel");

  assert.equal(await controller.setMap("forest"), true);
  assert.equal(controller.snapshot?.bossId, "forest-core-troll");
  assert.equal(controller.snapshot?.hp, 600);
});

test("local ORIGIN receipt turns the core-heart client into a spectator", () => {
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "sanctuary-core-heart";
  game.progress = createInitialProgress();
  game.progress.worldProgress = originDefeatedProgress();
  assert.equal(game.isOriginSpectator(), true);

  game.mapId = "sanctuary-zero-boundary";
  assert.equal(game.isOriginSpectator(), false);
});

test("BOSSKILLBOSS cannot multiply sanctuary bosses", () => {
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "sanctuary-zero-boundary";
  game.progress = createInitialProgress();
  game.progress.worldProgress = zeroBoundaryUnlockedProgress();
  game.rewardEffects = { bossCount: 3 };
  assert.equal(game.sanctuaryBossCount("trinity"), 1);
  assert.equal(game.sanctuaryBossCount("origin-zero"), 1);
});

test("online ORIGIN zero-value claim records local defeat before acknowledging", async () => {
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "sanctuary-core-heart";
  game.progress = createInitialProgress();
  game.progress.worldProgress = originReadyProgress();
  game.processedBossRewardIds = new Set();
  game.coopBossNow = () => 1000;
  const calls = [];
  game.persistProgress = () => { calls.push("save"); return true; };
  game.network = {
    uid: "player-1",
    coopBoss: {
      claimReward: async () => { calls.push("ack"); return { ok: true }; },
      expireRewardClaim: async () => {},
    },
  };
  const claim = {
    encounterId: "origin-online-1",
    bossId: "origin-zero",
    uid: "player-1",
    exp: 0,
    gold: 0,
    eligible: true,
    claimedAt: null,
    expiresAt: 5000,
  };
  await game.receiveBossRewardClaims({ "origin-online-1": { "player-1": claim } });
  assert.equal(game.progress.worldProgress.chapters.sanctuary.originDefeated, true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.originDefeatReceiptId, "origin-online-1");
  assert.deepEqual(calls, ["save", "ack"]);
});

test("ORIGIN spectator ignores later shared player-damage events", () => {
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "sanctuary-core-heart";
  game.progress = createInitialProgress();
  game.progress.worldProgress = originDefeatedProgress();
  game.processedBossPlayerDamageIds = new Set();
  let damageCalls = 0;
  game.damagePlayer = () => { damageCalls += 1; };
  game.receiveBossPlayerDamage({ future: { eventId: "future", bossId: "origin-zero", damage: 20 } });
  assert.equal(damageCalls, 0);
});
