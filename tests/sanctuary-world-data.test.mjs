import test from "node:test";
import assert from "node:assert/strict";
import {
  SANCTUARY_CASKETS,
  SANCTUARY_MAP_IDS,
  SANCTUARY_OVERLAY_ANCHORS,
  SANCTUARY_WORLD_DEFINITIONS,
  getSanctuaryWorldDefinition,
} from "../src/sanctuary-world-data-20260911-sanctuary.js";
import { createInitialWorldProgress } from "../src/chapter-progress-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { canUsePortal } from "../src/portal-transition-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";

test("sanctuary contains four 2160x1800 maps and exactly three core caskets", () => {
  assert.deepEqual(SANCTUARY_MAP_IDS, [
    "sanctuary",
    "sanctuary-memory-archive",
    "sanctuary-return-record",
    "sanctuary-three-futures",
  ]);
  for (const id of SANCTUARY_MAP_IDS) {
    assert.deepEqual(
      [SANCTUARY_WORLD_DEFINITIONS[id].width, SANCTUARY_WORLD_DEFINITIONS[id].height],
      [2160, 1800],
    );
    assert.strictEqual(getSanctuaryWorldDefinition(id), SANCTUARY_WORLD_DEFINITIONS[id]);
  }
  assert.equal(getSanctuaryWorldDefinition("unknown"), null);
  assert.deepEqual(SANCTUARY_CASKETS.map(value => value.id), [
    "forest-core-casket", "coast-core-casket", "volcano-core-casket",
  ]);
  assert.equal(Object.isFrozen(SANCTUARY_OVERLAY_ANCHORS), true);
});

test("locked sanctuary portals stay physical and only their usability changes", () => {
  const entrance = SANCTUARY_WORLD_DEFINITIONS.sanctuary;
  const portal = entrance.portals.find(value => value.id === "to-memory-archive");
  assert.equal(Boolean(portal), true);
  assert.equal(canUsePortal(portal, createInitialWorldProgress()), false);
  const ready = {
    ...createInitialWorldProgress(),
    unlockedMapIds: [
      ...createInitialWorldProgress().unlockedMapIds,
      "sanctuary-memory-archive",
    ],
  };
  assert.equal(canUsePortal(portal, ready), true);
  assert.deepEqual(entrance.obstacles, SANCTUARY_WORLD_DEFINITIONS.sanctuary.obstacles);
});

test("sanctuary portals and center travel axes remain clear of static obstacles", () => {
  for (const mapId of SANCTUARY_MAP_IDS) {
    const world = SANCTUARY_WORLD_DEFINITIONS[mapId];
    for (let y = 96; y < world.height; y += 96) {
      assert.equal(
        world.obstacles.some(obstacle => 1080 >= obstacle.x && 1080 <= obstacle.x + obstacle.w && y >= obstacle.y && y <= obstacle.y + obstacle.h),
        false,
        `${mapId} center travel axis must remain clear`,
      );
    }
    for (const portal of world.portals) {
      assert.equal(
        world.obstacles.some(obstacle => (
          portal.x < obstacle.x + obstacle.w
          && portal.x + portal.w > obstacle.x
          && portal.y < obstacle.y + obstacle.h
          && portal.y + portal.h > obstacle.y
        )),
        false,
        `${mapId}/${portal.id} must not overlap an obstacle`,
      );
    }
  }
});
