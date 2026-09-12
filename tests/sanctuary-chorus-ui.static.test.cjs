const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const css = readFileSync(
  path.join(__dirname, "../styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css"),
  "utf8",
);

function mediaBlock(maxWidth) {
  const marker = `@media (max-width: ${maxWidth}px)`;
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, `${marker} must exist`);
  const next = css.indexOf("\n@media ", start + marker.length);
  return css.slice(start, next === -1 ? css.length : next);
}

test("mobile chorus HUD keeps the movement axis clear with a compact quest row", () => {
  const mobile = mediaBlock(520);
  assert.match(mobile, /\.chorus-hud\s*\{[^}]*top:\s*var\(--player-panel-stack-top\)/);
  assert.match(mobile, /\.hud:has\(\.chorus-hud:not\(\[hidden\]\)\) \.quest-tracker\s*\{[^}]*top:\s*calc\(var\(--player-panel-stack-top\) \+ 114px\)/);
  assert.match(mobile, /\.quest-tracker\s*\{[^}]*grid-template-columns:\s*auto minmax\(0,1fr\) auto/);
  assert.match(mobile, /\.quest-tracker small, \.quest-tracker #questProgress\s*\{\s*display:\s*none/);
  assert.match(mobile, /\.quest-tracker \.chapter-objective\s*\{[^}]*text-overflow:\s*ellipsis/);
});

test("the 521 to 620 pixel range also stacks the quest below an active chorus HUD", () => {
  const narrow = mediaBlock(620);
  assert.match(narrow, /\.quest-tracker\s*\{[^}]*top:\s*var\(--player-panel-stack-top\)[^}]*\}/);
  assert.match(narrow, /\.hud:has\(\.chorus-hud:not\(\[hidden\]\)\) \.quest-tracker\s*\{[^}]*top:\s*calc\(var\(--player-panel-stack-top\) \+ 124px\)/);
});
