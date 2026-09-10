import { WORLD_DEFINITIONS as VOLCANO_WORLD_DEFINITIONS } from "./world-data-20260903-volcano-20260905-upgrade.js";
import {
  SANCTUARY_MAP_IDS,
  SANCTUARY_WORLD_DEFINITIONS,
} from "./sanctuary-world-data-20260910-sanctuary.js";

export const WORLD_IDS = Object.freeze([
  "village",
  "forest",
  "coast-beach",
  "coast-wreck-bay",
  "coast-flooded-station",
  "coast-tide-core-cave",
  "volcano",
  "volcano-magma-route",
  "volcano-observatory",
  "volcano-core-caldera",
  ...SANCTUARY_MAP_IDS,
]);

export const WORLD_DEFINITIONS = Object.freeze({
  ...VOLCANO_WORLD_DEFINITIONS,
  ...SANCTUARY_WORLD_DEFINITIONS,
});

export function normalizeWorldId(value) {
  if (value === "coast") return "coast-beach";
  return WORLD_IDS.includes(value) ? value : "village";
}

export function getWorldDefinition(mapId) {
  return WORLD_DEFINITIONS[normalizeWorldId(mapId)];
}

export function getTotalWorldArea() {
  return WORLD_IDS.reduce(
    (total, id) => total + WORLD_DEFINITIONS[id].width * WORLD_DEFINITIONS[id].height,
    0,
  );
}

export function getPortalDestination(mapId, portalId) {
  return getWorldDefinition(mapId).portals.find(portal => portal.id === portalId)?.destination || null;
}

export function isSafeWorld(mapId) {
  return getWorldDefinition(mapId).safe;
}
