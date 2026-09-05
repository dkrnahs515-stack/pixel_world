import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_DEFINITIONS,
  WORLD_IDS,
  getPortalDestination,
  getTotalWorldArea,
  isSafeWorld,
  normalizeWorldId,
} from "../src/world-data-20260829-coast-20260905-upgrade.js";
import { findActivePortal, isWorldPositionBlocked } from "../src/world-20260829-coast-20260905-upgrade.js";

const PLAYER_RADIUS = 14;
const PORTAL_EXIT_SAFE_MARGIN = 32;

test("four regions total exactly ten times the original playable area", () => {
  assert.equal(getTotalWorldArea(), 2880 * 1800 * 10);
  assert.deepEqual(WORLD_IDS, [
    "village", "volcano", "forest",
    "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
  ]);
  assert.deepEqual(WORLD_IDS.filter(id => id.startsWith("coast-")), [
    "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
  ]);
  assert.deepEqual(
    WORLD_IDS.map(id => [WORLD_DEFINITIONS[id].width, WORLD_DEFINITIONS[id].height]),
    [
      [2880, 1800], [4320, 3600], [4320, 3600],
      [2160, 1800], [2160, 1800], [2160, 1800], [2160, 1800],
    ],
  );
});

test("the village is the only safe region and has no enemy spawns", () => {
  assert.equal(isSafeWorld("village"), true);
  assert.equal(WORLD_DEFINITIONS.village.enemySpawns.length, 0);
  assert.equal(isSafeWorld("volcano"), false);
  assert.equal(isSafeWorld("forest"), false);
  for (const mapId of WORLD_IDS.filter(id => id.startsWith("coast-"))) {
    assert.equal(isSafeWorld(mapId), false);
  }
});

test("new regional spawns are traversable and away from portal centers", () => {
  const newKinds = new Set([
    "fang-shark", "pirate-shark", "magma-slime", "flame-imp",
    "ancient-boar", "moss-troll", "ancient-mushroom-bug",
  ]);
  for (const mapId of ["volcano", "forest", ...WORLD_IDS.filter(id => id.startsWith("coast-"))]) {
    const world = WORLD_DEFINITIONS[mapId];
    for (const spawn of world.enemySpawns.filter(candidate => newKinds.has(candidate.kind))) {
      assert.equal(isWorldPositionBlocked(mapId, spawn.x, spawn.y, 0), false);
      for (const portal of world.portals) {
        assert.ok(Math.hypot(spawn.x - (portal.x + portal.w / 2), spawn.y - (portal.y + portal.h / 2)) > 180);
      }
    }
  }
});

test("every physical world spawn and portal endpoint is traversable at the player collision radius", () => {
  for (const mapId of WORLD_IDS) {
    const world = WORLD_DEFINITIONS[mapId];
    assert.equal(
      isWorldPositionBlocked(mapId, world.spawn.x, world.spawn.y, PLAYER_RADIUS),
      false,
      `${mapId} spawn must be traversable`,
    );
    for (const portal of WORLD_DEFINITIONS[mapId].portals) {
      const destination = getPortalDestination(mapId, portal.id);
      assert.ok(destination);
      const target = WORLD_DEFINITIONS[destination.mapId];
      assert.ok(target);
      assert.ok(destination.x > 0 && destination.x < target.width);
      assert.ok(destination.y > 0 && destination.y < target.height);
      assert.equal(
        isWorldPositionBlocked(destination.mapId, destination.x, destination.y, PLAYER_RADIUS),
        false,
        `${mapId}/${portal.id} destination must be traversable`,
      );
      assert.equal(
        isWorldPositionBlocked(mapId, portal.x + portal.w / 2, portal.y + portal.h / 2, PLAYER_RADIUS),
        false,
        `${mapId}/${portal.id} center must be traversable`,
      );
    }
  }
});

test("every coast portal destination and related spawn clears reciprocal portal hitboxes", () => {
  const coastMapIds = WORLD_IDS.filter(mapId => mapId.startsWith("coast-"));
  for (const sourceMapId of coastMapIds) {
    for (const portal of WORLD_DEFINITIONS[sourceMapId].portals) {
      const destination = portal.destination;
      assert.equal(
        findActivePortal(destination.mapId, destination.x, destination.y, PLAYER_RADIUS),
        null,
        `${sourceMapId}/${portal.id} must arrive clear of a reciprocal portal`,
      );
      assert.equal(
        findActivePortal(
          destination.mapId,
          destination.x,
          destination.y,
          PLAYER_RADIUS + PORTAL_EXIT_SAFE_MARGIN,
        ),
        null,
        `${sourceMapId}/${portal.id} must preserve the portal exit safety margin`,
      );
    }
  }

  for (const mapId of coastMapIds) {
    const spawn = WORLD_DEFINITIONS[mapId].spawn;
    assert.equal(
      findActivePortal(mapId, spawn.x, spawn.y, PLAYER_RADIUS),
      null,
      `${mapId} spawn must clear every portal`,
    );
    assert.equal(
      findActivePortal(mapId, spawn.x, spawn.y, PLAYER_RADIUS + PORTAL_EXIT_SAFE_MARGIN),
      null,
      `${mapId} spawn must preserve the portal exit safety margin`,
    );
  }
});

test("unknown values normalize to the village and legacy coast restores at the beach", () => {
  assert.equal(normalizeWorldId(undefined), "village");
  assert.equal(normalizeWorldId("desert"), "village");
  assert.equal(normalizeWorldId("coast"), "coast-beach");
});

test("coast portals connect each sequential map in both directions plus the completed shortcut", () => {
  const portalIds = mapId => WORLD_DEFINITIONS[mapId].portals.map(portal => portal.id);
  assert.deepEqual(portalIds("coast-beach"), ["to-village", "to-wreck-bay", "shortcut-to-tide-core"]);
  assert.deepEqual(portalIds("coast-wreck-bay"), ["to-beach", "to-flooded-station"]);
  assert.deepEqual(portalIds("coast-flooded-station"), ["to-wreck-bay", "to-tide-core-cave"]);
  assert.deepEqual(portalIds("coast-tide-core-cave"), ["to-flooded-station", "shortcut-to-beach"]);
});
