import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rollPhysicalRelease } from "../scripts/roll-physical-release.mjs";

test("rollPhysicalRelease copies the complete reachable graph without touching sources", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "pixel-release-"));
  await mkdir(join(rootDir, "src"));
  await writeFile(join(rootDir, "src/main-old.js"), 'import "./child-old.js";\n');
  await writeFile(join(rootDir, "src/child-old.js"), "export const value = 1;\n");
  await writeFile(join(rootDir, "styles-old.css"), ":root{--x:1}\n");
  const result = await rollPhysicalRelease({ rootDir, sourceEntry: "src/main-old.js", sourceCss: "styles-old.css", suffix: "new" });
  assert.deepEqual(result.files.sort(), ["src/child-old-new.js", "src/main-old-new.js"]);
  assert.match(await readFile(join(rootDir, "src/main-old-new.js"), "utf8"), /child-old-new\.js/);
  assert.equal(await readFile(join(rootDir, "src/main-old.js"), "utf8"), 'import "./child-old.js";\n');
});

test("rollPhysicalRelease rejects an escaped dependency before out-of-root IO", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "pixel-release-"));
  await mkdir(join(rootDir, "src"));
  await writeFile(join(rootDir, "src/main-old.js"), 'import "../../outside.js";\n');
  await assert.rejects(() => rollPhysicalRelease({ rootDir, sourceEntry: "src/main-old.js", sourceCss: "styles-old.css", suffix: "new" }), /release path escaped rootDir/);
});
