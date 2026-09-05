import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const RELEASE_SUFFIX = "20260903-volcano";
const RELEASE_MODULE_BASENAMES = Object.freeze([
  "chapter-progress",
  "chat-bubble-layout",
  "chat-controller",
  "chat-network",
  "chat-state",
  "combat",
  "coop-boss-controller",
  "coop-boss-data",
  "coop-boss-network",
  "coop-boss-state",
  "equipment-state",
  "equipment-ui",
  "game",
  "local-boss-controller",
  "main",
  "network",
  "network-state",
  "npc-data",
  "portal-transition",
  "progress-storage",
  "projectile-combat",
  "qa-mode",
  "quest-state",
  "region-data",
  "story-dialogue",
  "story-interactions",
  "volcano-eruption",
  "volcano-story-data",
  "volcano-world-data",
  "weapon-data",
  "weapon-rendering",
  "world",
  "world-data",
]);
const IMMUTABLE_COMPOSITION_FILES = new Set([
  "chapter-progress-20260829-coast.js",
  "equipment-state.js",
  "npc-data-20260829-coast.js",
  "quest-state-20260829-coast.js",
  "region-data-20260829-coast.js",
  "story-dialogue-20260829-coast.js",
  "story-interactions-20260829-coast.js",
  "weapon-data.js",
  "world-20260829-coast.js",
  "world-data-20260829-coast.js",
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
  if (existsSync(entryUrl)) await visit(entryUrl);
  return reachable;
}

test("the volcano entry graph reaches every changed module through a physical release URL", async () => {
  const entryUrl = new URL(`../src/main-${RELEASE_SUFFIX}.js`, import.meta.url);
  const reachable = await reachableModuleUrls(entryUrl);
  const missing = [];
  const supersededReachable = [];
  for (const basename of RELEASE_MODULE_BASENAMES) {
    const releaseUrl = new URL(`../src/${basename}-${RELEASE_SUFFIX}.js`, import.meta.url);
    if (!existsSync(releaseUrl) || !reachable.has(releaseUrl.href)) missing.push(basename);
    const datedRelease = new RegExp(`^${basename.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}-\\d{8}-.+\\.js$`);
    for (const candidate of reachable) {
      const filename = new URL(candidate).pathname.split("/").at(-1);
      if (!IMMUTABLE_COMPOSITION_FILES.has(filename) && (filename === `${basename}.js`
        || datedRelease.test(filename) && filename !== `${basename}-${RELEASE_SUFFIX}.js`)) {
        supersededReachable.push(filename);
      }
    }
  }
  assert.deepEqual({ missing, supersededReachable }, { missing: [], supersededReachable: [] });
});

test("legacy combat URLs stay on legacy weapon data while the volcano graph uses physical release URLs", async () => {
  const legacyWeaponUrl = new URL("../src/weapon-data.js", import.meta.url);
  const volcanoWeaponUrl = new URL(`../src/weapon-data-${RELEASE_SUFFIX}.js`, import.meta.url);
  const legacyCombatUrl = new URL("../src/combat.js", import.meta.url);
  const legacyProjectileUrl = new URL("../src/projectile-combat.js", import.meta.url);
  const volcanoCombatUrl = new URL(`../src/combat-${RELEASE_SUFFIX}.js`, import.meta.url);
  const volcanoProjectileUrl = new URL(`../src/projectile-combat-${RELEASE_SUFFIX}.js`, import.meta.url);
  const legacyCombatGraph = await reachableModuleUrls(legacyCombatUrl);
  const legacyProjectileGraph = await reachableModuleUrls(legacyProjectileUrl);
  const volcanoCombatGraph = await reachableModuleUrls(volcanoCombatUrl);
  const volcanoProjectileGraph = await reachableModuleUrls(volcanoProjectileUrl);

  assert.equal(legacyCombatGraph.has(legacyWeaponUrl.href), true);
  assert.equal(legacyCombatGraph.has(volcanoWeaponUrl.href), false);
  assert.equal(legacyProjectileGraph.has(legacyWeaponUrl.href), true);
  assert.equal(legacyProjectileGraph.has(volcanoWeaponUrl.href), false);
  assert.equal(volcanoCombatGraph.has(volcanoWeaponUrl.href), true);
  assert.equal(volcanoCombatGraph.has(legacyCombatUrl.href), false);
  assert.equal(volcanoProjectileGraph.has(volcanoWeaponUrl.href), true);
  assert.equal(volcanoProjectileGraph.has(volcanoCombatUrl.href), true);
  assert.equal(volcanoProjectileGraph.has(legacyProjectileUrl.href), false);
});

test("HTML uses query-free physical volcano CSS and JavaScript entry files", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /href="\.\/styles-20260903-volcano\.css"/);
  assert.match(html, /src="\.\/src\/main-20260903-volcano\.js"/);
  assert.doesNotMatch(html, /(?:styles|main)[^"']*\?v=/);
  assert.equal(existsSync(new URL("../styles-20260903-volcano.css", import.meta.url)), true);
});
