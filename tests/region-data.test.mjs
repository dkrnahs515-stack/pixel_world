import test from "node:test";
import assert from "node:assert/strict";
import {
  REGION_DEFINITIONS,
  REGION_IDS,
  getRegionDefinition,
  getRegionForMap,
} from "../src/region-data-20260829-coast-20260905-upgrade.js";

test("the immutable region registry separates coast story membership from physical maps", () => {
  assert.deepEqual(REGION_IDS, ["village", "forest", "coast", "volcano"]);
  assert.deepEqual(REGION_DEFINITIONS.coast.mapIds, [
    "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
  ]);
  assert.equal(REGION_DEFINITIONS.coast.entryMapId, "coast-beach");
  assert.equal(REGION_DEFINITIONS.coast.prerequisiteRegionId, "forest");
  assert.equal(Object.isFrozen(REGION_DEFINITIONS), true);
  assert.equal(Object.isFrozen(REGION_DEFINITIONS.coast.mapIds), true);
});

test("region lookups return their definition or null for unknown region and map IDs", () => {
  assert.equal(getRegionDefinition("forest").id, "forest");
  assert.equal(getRegionForMap("coast-wreck-bay").id, "coast");
  assert.equal(getRegionDefinition("unknown"), null);
  assert.equal(getRegionDefinition("toString"), null);
  assert.equal(getRegionDefinition("__proto__"), null);
  assert.equal(getRegionForMap("unknown"), null);
});
