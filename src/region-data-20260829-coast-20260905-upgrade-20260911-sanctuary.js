export const REGION_IDS = Object.freeze(["village", "forest", "coast", "volcano"]);

function defineRegion(id, entryMapId, mapIds, prerequisiteRegionId) {
  return Object.freeze({
    id,
    entryMapId,
    mapIds: Object.freeze(mapIds),
    prerequisiteRegionId,
  });
}

export const REGION_DEFINITIONS = Object.freeze({
  village: defineRegion("village", "village", ["village"], null),
  forest: defineRegion("forest", "forest", ["forest"], "village"),
  coast: defineRegion("coast", "coast-beach", [
    "coast-beach",
    "coast-wreck-bay",
    "coast-flooded-station",
    "coast-tide-core-cave",
  ], "forest"),
  volcano: defineRegion("volcano", "volcano", ["volcano"], "coast"),
});

export function getRegionDefinition(regionId) {
  return Object.hasOwn(REGION_DEFINITIONS, regionId) ? REGION_DEFINITIONS[regionId] : null;
}

export function getRegionForMap(mapId) {
  return REGION_IDS
    .map(regionId => REGION_DEFINITIONS[regionId])
    .find(region => region.mapIds.includes(mapId)) || null;
}
