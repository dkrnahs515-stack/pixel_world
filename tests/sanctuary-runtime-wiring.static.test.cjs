const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const main = fs.readFileSync(new URL("../src/main-20260910-sanctuary.js", import.meta?.url || `file://${__filename}`), "utf8");
const game = fs.readFileSync(new URL("../src/game-20260910-sanctuary.js", import.meta?.url || `file://${__filename}`), "utf8");
const world = fs.readFileSync(new URL("../src/world-20260910-sanctuary.js", import.meta?.url || `file://${__filename}`), "utf8");

test("main passes the ending DOM contract into PixelRPG", () => {
  for (const id of [
    "sanctuaryEndingOverlay", "endingChoicePanel", "endingConfirmPanel",
    "endingRestoreButton", "endingSealButton", "endingResonateButton", "endingDeferButton",
    "endingConfirmButton", "endingConfirmCancel", "endingLockedReason", "endingSubtitle",
    "endingCredits", "endingCreditsText", "endingCreditsSkip",
  ]) assert.match(main, new RegExp(`#${id.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`));
  assert.match(game, /new SanctuaryEndingController\s*\(/);
  assert.match(game, /onCreditsComplete:\s*\(\)\s*=>\s*this\.completeSanctuaryCredits\(\)/);
});

test("sanctuary world renders sanctuary story signals instead of volcano-only content", () => {
  assert.match(world, /SANCTUARY_STORY_INTERACTIONS/);
  assert.match(world, /mapId\.startsWith\("sanctuary"\)/);
  assert.match(world, /chapterId:\s*"sanctuary"/);
});

test("game loop explicitly gates ORIGIN behavior for local spectators", () => {
  assert.match(game, /if\s*\(this\.isOriginSpectator\(\)\)[^}]*return/);
  assert.match(game, /origin-zero/);
  assert.match(game, /recordLocalOriginDefeat\(claim\.encounterId\)/);
});
