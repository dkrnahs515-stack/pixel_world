import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260910-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";

function harness() {
  const game = Object.create(PixelRPG.prototype);
  game.qaEnabled = true;
  game.running = true;
  game.inputEnabled = false;
  game.progress = createInitialProgress();
  game.mapId = "village";
  game.ui = {
    qaOverlay: { hidden: false },
    endingRestoreButton: { focus() { game.focusedEnding = "restore"; } },
    endingSealButton: { focus() { game.focusedEnding = "seal"; } },
    endingResonateButton: { focus() { game.focusedEnding = "resonate"; } },
  };
  game.player = { name: "QA", respawnTimer: 0, moving: false };
  game.keys = new Set();
  game.persistCount = 0;
  game.persistProgress = () => { game.persistCount += 1; return true; };
  game.closeQaPanel = () => { game.ui.qaOverlay.hidden = true; return true; };
  game.switchWorld = (mapId) => { game.mapId = mapId; return true; };
  game.openSanctuaryEndingChoice = () => { game.choiceOpened = true; return true; };
  game.notify = message => { game.lastNotice = message; };
  return game;
}

test("QA sanctuary setup is available only in an open QA session", () => {
  const game = harness();
  assert.equal(game.qaPrepareSanctuary("trinity-ready"), true);

  const disabled = harness();
  disabled.qaEnabled = false;
  assert.equal(disabled.qaPrepareSanctuary("trinity-ready"), false);

  const closed = harness();
  closed.ui.qaOverlay.hidden = true;
  assert.equal(closed.qaPrepareSanctuary("trinity-ready"), false);
});

test("QA TRINITY-ready setup saves once then moves to zero boundary", () => {
  const game = harness();
  assert.equal(game.qaPrepareSanctuary("trinity-ready"), true);
  assert.equal(game.persistCount, 1);
  assert.equal(game.mapId, "sanctuary-zero-boundary");
  assert.equal(game.ui.qaOverlay.hidden, true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.trinityDefeated, false);
  assert.match(game.lastNotice, /TRINITY/);
});

test("QA ending-ready setup opens the final choice and focuses requested ending", () => {
  const game = harness();
  assert.equal(game.qaPrepareSanctuary("ending-resonate-ready"), true);
  assert.equal(game.mapId, "sanctuary-core-heart");
  assert.equal(game.choiceOpened, true);
  assert.equal(game.focusedEnding, "resonate");
  assert.equal(game.progress.worldProgress.chapters.sanctuary.originRecordIds.length, 3);
});

test("QA sanctuary setup rolls progress back when save fails", () => {
  const game = harness();
  const before = structuredClone(game.progress);
  game.persistProgress = () => false;
  assert.equal(game.qaPrepareSanctuary("origin-ready"), false);
  assert.deepEqual(game.progress, before);
  assert.equal(game.mapId, "village");
  assert.equal(game.ui.qaOverlay.hidden, false);
});
