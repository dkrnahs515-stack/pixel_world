import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const RELEASE_SUFFIX = "20260829-coast";
const RELEASE_MODULE_BASENAMES = Object.freeze([
  "aren-dialogue",
  "chapter-progress",
  "chat-bubble-layout",
  "chat-controller",
  "chat-network",
  "chat-state",
  "coast-story-data",
  "coast-world-data",
  "communication-log",
  "coop-boss-controller",
  "coop-boss-data",
  "coop-boss-network",
  "coop-boss-state",
  "dialogue-controller",
  "enemies",
  "local-boss-controller",
  "network-state",
  "network",
  "npc-data",
  "portal-transition",
  "progress-storage",
  "quest-state",
  "region-data",
  "story-dialogue",
  "story-interactions",
  "world-data",
  "world",
]);

function relativeModuleSpecifiers(source) {
  const pattern = /(?:import|export)\s+(?:[^"';]*?\s+from\s+)?["'](\.\/[^"']+\.js)["']/g;
  return [...source.matchAll(pattern)].map(match => match[1]);
}

async function reachableModuleUrls(entryUrl) {
  const reachable = new Set();
  async function visit(moduleUrl) {
    if (reachable.has(moduleUrl.href)) return;
    reachable.add(moduleUrl.href);
    const source = await readFile(moduleUrl, "utf8");
    for (const specifier of relativeModuleSpecifiers(source)) {
      await visit(new URL(specifier, moduleUrl));
    }
  }
  await visit(entryUrl);
  return reachable;
}

test("the coast entry graph uses one physical release URL for every changed transitive module", async () => {
  const reachable = await reachableModuleUrls(
    new URL("../src/main-20260829-coast.js", import.meta.url),
  );
  const violations = {
    missingReleaseUrls: [],
    reachablePreReleaseUrls: [],
    duplicatePreReleaseFiles: [],
  };

  for (const basename of RELEASE_MODULE_BASENAMES) {
    const releaseUrl = new URL(`../src/${basename}-${RELEASE_SUFFIX}.js`, import.meta.url);
    const preReleaseUrl = new URL(`../src/${basename}.js`, import.meta.url);
    if (!reachable.has(releaseUrl.href)) violations.missingReleaseUrls.push(releaseUrl.pathname);
    if (reachable.has(preReleaseUrl.href)) violations.reachablePreReleaseUrls.push(preReleaseUrl.pathname);
    if (existsSync(preReleaseUrl)) violations.duplicatePreReleaseFiles.push(preReleaseUrl.pathname);
  }

  assert.deepEqual(violations, {
    missingReleaseUrls: [],
    reachablePreReleaseUrls: [],
    duplicatePreReleaseFiles: [],
  });
});
