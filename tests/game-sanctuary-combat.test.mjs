import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260910-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";
import { originDefeatedProgress, zeroBoundaryUnlockedProgress } from "./helpers/sanctuary-fixtures.mjs";

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
