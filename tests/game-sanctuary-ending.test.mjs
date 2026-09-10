import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260910-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";
import { originDefeatedProgress, resonanceReadyProgress } from "./helpers/sanctuary-fixtures.mjs";

function endingHarness(worldProgress) {
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "sanctuary-core-heart";
  game.progress = createInitialProgress();
  game.progress.worldProgress = worldProgress;
  game.progress.endingTitle = null;
  game.player = { name: "엔딩테스터" };
  game.persisted = [];
  game.persistProgress = () => { game.persisted.push(structuredClone(game.progress)); return true; };
  game.endingController = {
    opened: null,
    played: null,
    credits: null,
    openChoice(model) { this.opened = model; return true; },
    playEnding(script) { this.played = script; return true; },
    startCredits(credits, postCredit) { this.credits = { credits, postCredit }; return true; },
    close() {},
  };
  game.notify = () => {};
  game.updateProgressHud = () => {};
  game.updateChapterUi = () => {};
  return game;
}

test("ORIGIN defeat can open choice with resonate locked and defer available", () => {
  const game = endingHarness(originDefeatedProgress({ originRecordIds: [] }));
  assert.equal(game.openSanctuaryEndingChoice(), true);
  const resonate = game.endingController.opened.choices.find(choice => choice.id === "resonate");
  assert.equal(resonate.unlocked, false);
  assert.equal(game.endingController.opened.deferAllowed, true);
});

test("confirmed ending saves permanent choice before reward and pays once", () => {
  const game = endingHarness(resonanceReadyProgress());
  assert.equal(game.confirmSanctuaryEnding("resonate"), true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, "resonate");
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingRewardClaimed, true);
  assert.equal(game.progress.endingTitle, "세계의 공명자");
  assert.equal(game.persisted.length, 2);
  assert.equal(game.persisted[0].worldProgress.chapters.sanctuary.endingRewardClaimed, false);
  assert.equal(game.persisted[1].worldProgress.chapters.sanctuary.endingRewardClaimed, true);

  const before = { exp: game.progress.exp, gold: game.progress.gold };
  assert.equal(game.retrySanctuaryEndingReward(), false);
  assert.deepEqual({ exp: game.progress.exp, gold: game.progress.gold }, before);
});
