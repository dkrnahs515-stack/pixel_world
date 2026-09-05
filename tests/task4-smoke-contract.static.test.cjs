const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const read = filename => readFileSync(path.join(__dirname, filename), "utf8");
const coastSmoke = read("coast-browser-smoke.cjs");
const volcanoSmoke = read("volcano-browser-smoke.cjs");
const emulatorFixture = read("firebase-rules-emulator.cjs");

test("coast browser checkpoints use only the deployed v7 save", () => {
  assert.doesNotMatch(coastSmoke, /pixel-world\.progress\.v6|v6 progress checkpoint|version, 6/);
  assert.match(coastSmoke, /pixel-world\.progress\.v7/);
  assert.match(coastSmoke, /v7 progress checkpoint is missing/);
  assert.match(coastSmoke, /initial\.version, 7/);
});

test("volcano boss combat observes a successful Q separately from Ctrl", () => {
  const helper = volcanoSmoke.match(
    /async function pressStrongAndAssert\(page, label\) \{([\s\S]*?)\n\}/,
  )?.[1] || "";
  const fight = volcanoSmoke.match(
    /async function fightCaptain\(page, label\) \{([\s\S]*?)\n\}/,
  )?.[1] || "";

  assert.match(helper, /#mpText/);
  assert.match(helper, /keyboard\.press\("q"\)/);
  assert.match(helper, /waitForFunction/);
  assert.match(helper, /#strongCooldown/);
  assert.match(helper, /assert\.equal\([^;]*beforeMp - 20/);
  assert.match(fight, /pressStrongAndAssert\(page, label\)/);
  assert.match(fight, /keyboard\.press\("Control"\)/);
  assert.doesNotMatch(fight, /keyboard\.press\("Control"\);\s*if[^\n]*keyboard\.press\("q"\)/);
});

test("volcano route portal movement waits for the destination instead of a fixed duration", () => {
  const helper = volcanoSmoke.match(
    /async function moveUntilMap\(page, key, name\) \{([\s\S]*?)\n\}/,
  )?.[1] || "";
  const chooseRoute = volcanoSmoke.match(
    /async function chooseRoute\(page, prepared\) \{([\s\S]*?)\n\}/,
  )?.[1] || "";

  assert.match(helper, /keyboard\.down\(key\)/);
  assert.match(helper, /expectMap\(page, name\)/);
  assert.match(helper, /finally/);
  assert.match(helper, /keyboard\.up\(key\)/);
  assert.match(chooseRoute, /moveUntilMap\(page, "ArrowRight", "화구 코어 제단"\)/);
  assert.doesNotMatch(chooseRoute, /move\(page, "ArrowRight", 1500\)/);
});

test("emulator success attacks get a fresh timestamp from the request factory", () => {
  assert.match(emulatorFixture, /function attackRequest\(sequence, overrides = \{\}\)/);
  assert.match(emulatorFixture, /createdAt: Date\.now\(\)/);
  assert.match(emulatorFixture, /assertSucceeds\([\s\S]*?attackRequest\(1\)/);
  assert.match(emulatorFixture, /assertSucceeds\([\s\S]*?attackRequest\(9,/);
  assert.doesNotMatch(emulatorFixture, /const createdAt = Date\.now\(\)/);
});
