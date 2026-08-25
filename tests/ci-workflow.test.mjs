import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

test("PR과 main 변경은 전체 게임 테스트와 JavaScript 문법 검사를 자동 실행한다", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/verify-game.yml", import.meta.url),
    "utf8",
  );

  assert.match(
    workflow,
    /^on:\n  pull_request:\n    branches: \["main"\]\n  push:\n    branches: \["main"\]\n  workflow_dispatch:$/m,
  );
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.equal((workflow.match(/^\s*permissions:/gm) || []).length, 1);

  const testCommand = workflow
    .split("\n")
    .map(line => line.trim())
    .find(line => line.startsWith("run: node --test"));
  assert.equal(
    testCommand,
    "run: node --test tests/*.test.mjs tests/*.static.test.cjs",
  );
  assert.doesNotMatch(workflow, /tests\/\*\.cjs/);
  assert.match(
    workflow,
    /^      - name: Check JavaScript syntax\n        shell: bash\n        run: \|\n          for file in src\/\*\.js; do\n            node --check "\$file"\n          done$/m,
  );

  const testDirectory = new URL(".", import.meta.url);
  const commonJsTests = (await readdir(testDirectory))
    .filter(name => name.endsWith(".cjs"));

  for (const filename of commonJsTests) {
    const source = await readFile(new URL(filename, testDirectory), "utf8");
    const usesPlaywright = source.includes('require("playwright")');
    assert.equal(
      filename.endsWith(".static.test.cjs"),
      !usesPlaywright,
      `${filename} must use the static suffix exactly when it does not require Playwright`,
    );
  }
});
