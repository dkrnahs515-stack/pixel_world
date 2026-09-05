import test from "node:test";
import assert from "node:assert/strict";
import {
  REGION_DEFINITIONS,
  REGION_IDS,
  getRegionForMap,
} from "../src/region-data-20260903-volcano-20260905-upgrade.js";
import {
  WORLD_DEFINITIONS,
  WORLD_IDS,
  getPortalDestination,
  isSafeWorld,
} from "../src/world-data-20260903-volcano-20260905-upgrade.js";

const VOLCANO_MAP_IDS = [
  "volcano",
  "volcano-magma-route",
  "volcano-observatory",
  "volcano-core-caldera",
];

test("활화산 지역은 네 물리 맵이고 성역은 다음 안전 지역이다", () => {
  assert.deepEqual(REGION_IDS, ["village", "forest", "coast", "volcano", "sanctuary"]);
  assert.deepEqual(REGION_DEFINITIONS.volcano.mapIds, VOLCANO_MAP_IDS);
  assert.equal(REGION_DEFINITIONS.volcano.entryMapId, "volcano");
  assert.equal(REGION_DEFINITIONS.volcano.prerequisiteRegionId, "coast");
  assert.deepEqual(REGION_DEFINITIONS.sanctuary.mapIds, ["sanctuary"]);
  assert.equal(REGION_DEFINITIONS.sanctuary.prerequisiteRegionId, "volcano");
  assert.equal(getRegionForMap("volcano-observatory").id, "volcano");
  assert.equal(getRegionForMap("sanctuary").id, "sanctuary");
  assert.equal(Object.isFrozen(REGION_DEFINITIONS.volcano.mapIds), true);
});

test("활화산 네 맵과 성역은 모두 2160 × 1800이며 성역만 안전하다", () => {
  assert.deepEqual(
    VOLCANO_MAP_IDS.map(mapId => [
      WORLD_DEFINITIONS[mapId].name,
      WORLD_DEFINITIONS[mapId].width,
      WORLD_DEFINITIONS[mapId].height,
    ]),
    [
      ["잿불 관문", 2160, 1800],
      ["용암 수송로", 2160, 1800],
      ["붕괴한 관측소", 2160, 1800],
      ["화구 코어 제단", 2160, 1800],
    ],
  );
  assert.equal(WORLD_DEFINITIONS.sanctuary.width, 2160);
  assert.equal(WORLD_DEFINITIONS.sanctuary.height, 1800);
  assert.equal(isSafeWorld("sanctuary"), true);
  assert.deepEqual(WORLD_DEFINITIONS.sanctuary.enemySpawns, []);
  for (const mapId of VOLCANO_MAP_IDS) assert.equal(isSafeWorld(mapId), false);
});

test("물리 월드 레지스트리는 기존 숲과 해안 맵을 보존하고 신규 맵을 한 번씩 등록한다", () => {
  assert.equal(WORLD_IDS.includes("forest"), true);
  assert.equal(WORLD_IDS.includes("coast-tide-core-cave"), true);
  assert.deepEqual(WORLD_IDS.filter(mapId => VOLCANO_MAP_IDS.includes(mapId)), VOLCANO_MAP_IDS);
  assert.equal(WORLD_IDS.filter(mapId => mapId === "sanctuary").length, 1);
});

test("활화산 포탈은 네 맵을 양방향으로 잇고 화구와 성역을 왕복 연결한다", () => {
  const destinations = mapId => WORLD_DEFINITIONS[mapId].portals.map(portal => portal.destination.mapId);
  assert.deepEqual(destinations("volcano"), ["village", "volcano-magma-route"]);
  assert.deepEqual(destinations("volcano-magma-route"), ["volcano", "volcano-observatory"]);
  assert.deepEqual(destinations("volcano-observatory"), ["volcano-magma-route", "volcano-core-caldera"]);
  assert.deepEqual(destinations("volcano-core-caldera"), ["volcano-observatory", "sanctuary"]);
  assert.deepEqual(destinations("sanctuary"), ["volcano-core-caldera"]);
  assert.deepEqual(
    getPortalDestination("volcano-core-caldera", "to-sanctuary"),
    { mapId: "sanctuary", x: 1080, y: 1460 },
  );
});

test("모든 신규 스폰과 포탈 목적지는 해당 물리 맵 경계 안에 있다", () => {
  for (const mapId of [...VOLCANO_MAP_IDS, "sanctuary"]) {
    const world = WORLD_DEFINITIONS[mapId];
    assert.ok(world.spawn.x > 0 && world.spawn.x < world.width);
    assert.ok(world.spawn.y > 0 && world.spawn.y < world.height);
    for (const portal of world.portals) {
      const destination = WORLD_DEFINITIONS[portal.destination.mapId];
      assert.ok(destination);
      assert.ok(portal.destination.x > 0 && portal.destination.x < destination.width);
      assert.ok(portal.destination.y > 0 && portal.destination.y < destination.height);
    }
  }
});
