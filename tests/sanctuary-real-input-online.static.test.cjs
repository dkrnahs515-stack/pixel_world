const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const source = readFileSync(
  require.resolve("./sanctuary-real-input-smoke.cjs"),
  "utf8",
);

test("authenticated smoke derives online privileges through the shipped reward API", () => {
  assert.doesNotMatch(source, /window\.__game\.rewardEffects/);
  assert.match(
    source,
    /import\(['"]\/src\/reward-codes-20260905-upgrade\.js['"]\)/,
  );
  assert.match(source, /rewardCodeEffects\(window\.__game\.progress,\s*['"]online['"]\)/);
});
