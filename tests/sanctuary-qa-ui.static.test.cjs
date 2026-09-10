const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = readFileSync(path.join(__dirname, "../src/main-20260910-sanctuary.js"), "utf8");
const game = readFileSync(path.join(__dirname, "../src/game-20260910-sanctuary.js"), "utf8");

test("QA panel exposes all sanctuary maps", () => {
  for (const mapId of [
    "sanctuary",
    "sanctuary-resonance-hall",
    "sanctuary-origin-archive",
    "sanctuary-zero-boundary",
    "sanctuary-core-heart",
  ]) {
    assert.match(html, new RegExp(`data-qa-world="${mapId}"`));
  }
});

test("QA panel exposes every sanctuary setup action", () => {
  for (const setupId of [
    "origin-records-3",
    "trinity-ready",
    "origin-ready",
    "ending-restore-ready",
    "ending-seal-ready",
    "ending-resonate-ready",
  ]) {
    assert.match(html, new RegExp(`data-qa-sanctuary-setup="${setupId}"`));
  }
});

test("new main and game wire sanctuary QA setup buttons", () => {
  assert.match(main, /qaSanctuarySetupButtons:\s*\[\.\.\.document\.querySelectorAll\("\[data-qa-sanctuary-setup\]"\)\]/);
  assert.match(game, /qaSanctuarySetupButtons/);
  assert.match(game, /qaPrepareSanctuary\(button\.dataset\.qaSanctuarySetup\)/);
  assert.match(game, /prepareSanctuaryQaProgress/);
});
