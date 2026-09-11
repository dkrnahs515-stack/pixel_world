const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const css = readFileSync(
  path.join(__dirname, "../styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css"),
  "utf8",
);

test("mobile chorus HUD reserves a separate vertical slot below the player panel", () => {
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.chorus-hud\s*\{[^}]*top:\s*var\(--player-panel-stack-top\)/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.hud:has\(\.chorus-hud:not\(\[hidden\]\)\) \.quest-tracker\s*\{[^}]*top:\s*calc\(var\(--player-panel-stack-top\) \+ 124px\)/);
});
