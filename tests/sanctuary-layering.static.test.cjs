const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css"), "utf8");
const game = fs.readFileSync(path.join(__dirname, "..", "src", "game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js"), "utf8");

function zIndex(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]*z-index:\\s*(\\d+)`));
  return match ? Number(match[1]) : NaN;
}

test("ending overlay is above transient quest banners", () => {
  assert.ok(zIndex(".ending-overlay") > zIndex(".quest-banner"));
  assert.match(game, /new QuestBanner\(this\.ui\?\.endingOverlay\?\.parentElement \|\| document\.body\)/,
    "the fixed HUD stacking context must contain both overlays for their z-index values to be comparable");
});
