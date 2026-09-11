import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG, regionEntryMessage } from "../src/game-20260910-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";
import { sanctuaryUnlockedProgress } from "./helpers/sanctuary-fixtures.mjs";

function harness() {
  const game = Object.create(PixelRPG.prototype);
  game.progress = createInitialProgress();
  game.progress.worldProgress = sanctuaryUnlockedProgress();
  game.mapId = "sanctuary-resonance-hall";
  game.player = { name: "성역테스터", x: 520, y: 700, hp: 120, maxHp: 120, mp: 100, maxMp: 100 };
  game.ui = { chapterObjective: { textContent: "" }, renderCommunicationLog() {} };
  game.updateChapterUi = PixelRPG.prototype.updateChapterUi;
  game.updateNpcPrompt = () => {};
  game.updateProgressHud = () => {};
  game.updateInventoryHud = () => {};
  game.updateBlacksmithHud = () => {};
  game.updateHud = () => {};
  game.updateBiome = () => {};
  game.applyProgressionStats = () => {};
  game.notify = () => {};
  game.persistProgress = () => true;
  return game;
}

test("sanctuary story transitions run through the game adapter", () => {
  const game = harness();
  assert.equal(game.applyStoryInteraction("life-resonance"), true);
  assert.deepEqual(game.progress.worldProgress.chapters.sanctuary.activatedResonanceNodeIds, ["life-resonance"]);
});

test("entry messages name every sanctuary map", () => {
  const messages = Object.fromEntries([
    "sanctuary",
    "sanctuary-resonance-hall",
    "sanctuary-origin-archive",
    "sanctuary-zero-boundary",
    "sanctuary-core-heart",
  ].map(id => [id, regionEntryMessage(id)]));
  assert.match(messages.sanctuary, /성역/);
  assert.match(messages["sanctuary-resonance-hall"], /공명/);
  assert.match(messages["sanctuary-origin-archive"], /기록/);
  assert.match(messages["sanctuary-zero-boundary"], /TRINITY|제로/);
  assert.match(messages["sanctuary-core-heart"], /ORIGIN|코어/);
});
