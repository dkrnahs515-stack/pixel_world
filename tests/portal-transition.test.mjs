import test from "node:test";
import assert from "node:assert/strict";
import { createInitialWorldProgress, completeRegion } from "../src/chapter-progress-20260829-coast.js";
import { WORLD_DEFINITIONS } from "../src/world-data-20260829-coast.js";
import { advancePortalTransition, canUsePortal, createPortalTransition } from "../src/portal-transition-20260829-coast.js";

const portal = { destination: { mapId: "forest", x: 2160, y: 3260 } };

test("portal travel swaps regions once at the midpoint and ends after half a second", () => {
  let tick = advancePortalTransition(createPortalTransition(portal), 0.2);
  assert.equal(tick.shouldSwap, false);
  assert.equal(tick.finished, false);

  tick = advancePortalTransition(tick.state, 0.06);
  assert.equal(tick.shouldSwap, true);
  assert.equal(tick.finished, false);

  tick = advancePortalTransition(tick.state, 0.3);
  assert.equal(tick.shouldSwap, false);
  assert.equal(tick.finished, true);
});

test("portal travel copies its destination and carries a one-second reuse lock", () => {
  const state = createPortalTransition(portal);
  portal.destination.x = 999;
  assert.deepEqual(state.destination, { mapId: "forest", x: 2160, y: 3260 });
  assert.equal(state.cooldownAfter, 1);
});

test("portal locks are evaluated from their destination map without coast-specific transition logic", () => {
  const villageCoast = WORLD_DEFINITIONS.village.portals.find(portal => portal.id === "to-coast");
  const villageVolcano = WORLD_DEFINITIONS.village.portals.find(portal => portal.id === "to-volcano");
  const beachToWreck = WORLD_DEFINITIONS["coast-beach"].portals.find(portal => portal.id === "to-wreck-bay");
  const wreckToBeach = WORLD_DEFINITIONS["coast-wreck-bay"].portals.find(portal => portal.id === "to-beach");

  const initial = createInitialWorldProgress();
  assert.equal(canUsePortal(villageCoast, initial), false);
  assert.equal(canUsePortal(villageVolcano, initial), false);
  assert.equal(canUsePortal(wreckToBeach, initial), false);

  const coastOpen = completeRegion(initial, "forest").progress;
  assert.equal(canUsePortal(villageCoast, coastOpen), true);
  assert.equal(canUsePortal(beachToWreck, coastOpen), false);
});

test("only completed coast progress enables the beach-to-cave shortcut", () => {
  const shortcut = WORLD_DEFINITIONS["coast-beach"].portals.find(portal => portal.id === "shortcut-to-tide-core");
  const progress = createInitialWorldProgress();
  progress.unlockedMapIds.push("coast-beach", "coast-tide-core-cave");
  assert.equal(canUsePortal(shortcut, progress), false);
  progress.chapters.coast.shortcutUnlocked = true;
  assert.equal(canUsePortal(shortcut, progress), true);
});
