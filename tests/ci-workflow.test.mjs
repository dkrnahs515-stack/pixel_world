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
    const usesExternalRuntime = source.includes('require("playwright")')
      || source.includes('require("@firebase/rules-unit-testing")');
    assert.equal(
      filename.endsWith(".static.test.cjs"),
      !usesExternalRuntime,
      `${filename} must use the static suffix exactly when it does not require an external runtime`,
    );
  }
});

test("Firebase 규칙은 emulator allow/deny 검사를 PR에서 실행한다", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/firebase-rules-test.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /@firebase\/rules-unit-testing@5\.0\.0/);
  assert.match(workflow, /firebase emulators:exec --only database/);
  assert.match(workflow, /tests\/firebase-rules-emulator\.cjs/);
});

test("브라우저 smoke는 정적 서버에서 솔로·기본·채팅·해안·활화산 흐름을 함께 실행한다", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/browser-smoke.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /python3 -m http\.server 4173/);
  assert.match(workflow, /tests\/solo-mode-smoke\.cjs/);
  assert.match(workflow, /tests\/browser-smoke\.cjs/);
  assert.match(workflow, /tests\/chat-game-smoke\.cjs/);
  assert.match(workflow, /tests\/coast-browser-smoke\.cjs/);
  assert.match(workflow, /tests\/volcano-browser-smoke\.cjs/);
});
