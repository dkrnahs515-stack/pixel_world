import test from "node:test";
import assert from "node:assert/strict";
import { REGION_DEFINITIONS } from "../src/region-data-20260910-sanctuary.js";
import {
  WORLD_IDS,
  getPortalDestination,
  getWorldDefinition,
  isSafeWorld,
} from "../src/world-data-20260910-sanctuary.js";
import { canUsePortal } from "../src/portal-transition-20260910-sanctuary.js";
import {
  SANCTUARY_ARCHIVE_IDS,
  SANCTUARY_RESONANCE_NODE_IDS,
  activateSanctuaryResonanceNode,
  restoreSanctuaryArchive,
} from "../src/chapter-progress-20260910-sanctuary.js";
import { sanctuaryUnlockedProgress } from "./helpers/sanctuary-fixtures.mjs";

const SANCTUARY_MAP_IDS = [
  "sanctuary",
  "sanctuary-resonance-hall",
  "sanctuary-origin-archive",
  "sanctuary-zero-boundary",
  "sanctuary-core-heart",
];

test("sanctuary owns five 2160x1800 maps and world count is fifteen", () => {
  assert.deepEqual(REGION_DEFINITIONS.sanctuary.mapIds, SANCTUARY_MAP_IDS);
  assert.equal(WORLD_IDS.length, 15);
  for (const id of SANCTUARY_MAP_IDS) {
    assert.equal(getWorldDefinition(id).width, 2160);
    assert.equal(getWorldDefinition(id).height, 1800);
  }
});

test("sanctuary safe flags match the approved chapter pacing", () => {
  assert.equal(isSafeWorld("sanctuary"), true);
  assert.equal(isSafeWorld("sanctuary-resonance-hall"), false);
  assert.equal(isSafeWorld("sanctuary-origin-archive"), true);
  assert.equal(isSafeWorld("sanctuary-zero-boundary"), false);
  assert.equal(isSafeWorld("sanctuary-core-heart"), false);
});

test("sanctuary travel graph is bidirectional", () => {
  assert.equal(getPortalDestination("sanctuary", "to-resonance-hall").mapId, "sanctuary-resonance-hall");
  assert.equal(getPortalDestination("sanctuary-resonance-hall", "to-sanctuary").mapId, "sanctuary");
  assert.equal(getPortalDestination("sanctuary-resonance-hall", "to-origin-archive").mapId, "sanctuary-origin-archive");
  assert.equal(getPortalDestination("sanctuary-origin-archive", "to-resonance-hall").mapId, "sanctuary-resonance-hall");
  assert.equal(getPortalDestination("sanctuary-origin-archive", "to-zero-boundary").mapId, "sanctuary-zero-boundary");
  assert.equal(getPortalDestination("sanctuary-zero-boundary", "to-origin-archive").mapId, "sanctuary-origin-archive");
  assert.equal(getPortalDestination("sanctuary-zero-boundary", "to-core-heart").mapId, "sanctuary-core-heart");
  assert.equal(getPortalDestination("sanctuary-core-heart", "to-zero-boundary").mapId, "sanctuary-zero-boundary");
});

test("every sanctuary spawn and portal destination stays inside map bounds", () => {
  for (const id of SANCTUARY_MAP_IDS) {
    const world = getWorldDefinition(id);
    assert.ok(world.spawn.x >= 0 && world.spawn.x <= world.width);
    assert.ok(world.spawn.y >= 0 && world.spawn.y <= world.height);
    for (const portal of world.portals) {
      assert.ok(portal.x >= 0 && portal.x + portal.w <= world.width);
      assert.ok(portal.y >= 0 && portal.y + portal.h <= world.height);
      const target = getWorldDefinition(portal.destination.mapId);
      assert.ok(portal.destination.x >= 0 && portal.destination.x <= target.width);
      assert.ok(portal.destination.y >= 0 && portal.destination.y <= target.height);
    }
  }
});

test("destination unlocks gate sanctuary interior portals", () => {
  let progress = sanctuaryUnlockedProgress();
  const hall = getWorldDefinition("sanctuary-resonance-hall");
  const archivePortal = hall.portals.find(portal => portal.id === "to-origin-archive");
  assert.equal(canUsePortal(archivePortal, progress), false);

  for (const id of SANCTUARY_RESONANCE_NODE_IDS) {
    progress = activateSanctuaryResonanceNode(progress, id).progress;
  }
  assert.equal(canUsePortal(archivePortal, progress), true);

  const archive = getWorldDefinition("sanctuary-origin-archive");
  const zeroPortal = archive.portals.find(portal => portal.id === "to-zero-boundary");
  assert.equal(canUsePortal(zeroPortal, progress), false);
  for (const id of SANCTUARY_ARCHIVE_IDS) {
    progress = restoreSanctuaryArchive(progress, id).progress;
  }
  assert.equal(canUsePortal(zeroPortal, progress), true);
});
