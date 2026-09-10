import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const REQUIRED_RELEASE_FILES = new Set([
  "main-20260910-sanctuary.js",
  "game-20260910-sanctuary.js",
  "qa-mode-20260910-sanctuary.js",
  "network-20260910-sanctuary.js",
  "network-state-20260910-sanctuary.js",
  "coop-boss-network-20260910-sanctuary.js",
  "coop-boss-controller-20260910-sanctuary.js",
  "coop-boss-state-20260910-sanctuary.js",
  "coop-boss-data-20260910-sanctuary.js",
  "world-20260910-sanctuary.js",
  "world-data-20260910-sanctuary.js",
  "region-data-20260910-sanctuary.js",
  "chapter-progress-20260910-sanctuary.js",
  "progress-storage-20260910-sanctuary.js",
  "quest-state-20260910-sanctuary.js",
  "quest-guidance-20260910-sanctuary.js",
  "story-interactions-20260910-sanctuary.js",
  "story-dialogue-20260910-sanctuary.js",
  "enemy-definitions-20260910-sanctuary.js",
  "enemy-behaviors-20260910-sanctuary.js",
  "enemies-20260910-sanctuary.js",
  "first-journey-script-20260910-sanctuary.js",
  "first-journey-controller-20260910-sanctuary.js",
  "aren-dialogue-20260910-sanctuary.js",
  "sanctuary-world-data-20260910-sanctuary.js",
  "sanctuary-story-data-20260910-sanctuary.js",
  "sanctuary-ending-state-20260910-sanctuary.js",
  "sanctuary-ending-script-20260910-sanctuary.js",
  "sanctuary-ending-controller-20260910-sanctuary.js",
  "trinity-boss-20260910-sanctuary.js",
  "origin-boss-state-20260910-sanctuary.js",
  "origin-boss-controller-20260910-sanctuary.js",
  "boss-attack-validation-20260910-sanctuary.js",
]);

const LOGICAL_STEMS = [...REQUIRED_RELEASE_FILES].map(name => name.replace(/-20260910-sanctuary\.js$/, ""));

function importsOf(file) {
  const source = fs.readFileSync(file, "utf8");
  return [...source.matchAll(/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["'](\.\.?\/[^"']+)["']/g)]
    .map(match => match[1]);
}

function walk(entry) {
  const visited = new Set();
  const stack = [entry];
  while (stack.length) {
    const current = stack.pop();
    const normalized = path.normalize(current);
    if (visited.has(normalized)) continue;
    visited.add(normalized);
    for (const specifier of importsOf(normalized)) {
      const resolved = path.resolve(path.dirname(normalized), specifier);
      if (!resolved.startsWith(SRC) || !fs.existsSync(resolved)) continue;
      stack.push(resolved);
    }
  }
  return visited;
}

test("sanctuary release uses the new physical HTML entries", () => {
  assert.match(indexHtml, /href=["']\.\/styles-20260910-sanctuary\.css["']/);
  assert.match(indexHtml, /src=["']\.\/src\/main-20260910-sanctuary\.js["']/);
  assert.doesNotMatch(indexHtml, /main-20260903-volcano-20260905-upgrade\.js/);
});

test("every Task 1-10 changed JavaScript module is reachable through the sanctuary entry graph", () => {
  const graph = walk(path.join(SRC, "main-20260910-sanctuary.js"));
  const names = new Set([...graph].map(file => path.basename(file)));
  for (const required of REQUIRED_RELEASE_FILES) {
    assert.ok(names.has(required), `${required} is not reachable from the release entry graph`);
  }
});

test("changed logical modules never fall back to an older physical copy inside the release graph", () => {
  const graph = walk(path.join(SRC, "main-20260910-sanctuary.js"));
  for (const file of graph) {
    for (const specifier of importsOf(file)) {
      const basename = path.basename(specifier);
      const stem = LOGICAL_STEMS.find(value => basename.startsWith(`${value}-`) || basename === `${value}.js`);
      if (!stem) continue;
      const expected = `${stem}-20260910-sanctuary.js`;
      assert.equal(basename, expected, `${path.basename(file)} imports stale changed module ${basename}`);
    }
  }
});
