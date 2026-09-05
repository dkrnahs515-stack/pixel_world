import { WORLD_DEFINITIONS as COAST_WORLD_DEFINITIONS } from "./world-data-20260829-coast-20260905-upgrade.js";
import { VOLCANO_WORLD_DEFINITIONS } from "./volcano-world-data-20260903-volcano-20260905-upgrade.js";

const village = COAST_WORLD_DEFINITIONS.village;
const villagePortals = village.portals.map(portal => (
  portal.id === "to-volcano"
    ? Object.freeze({
      ...portal,
      destination: Object.freeze({ mapId: "volcano", x: 1080, y: 1460 }),
    })
    : portal
));

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
  "sanctuary",
]);

export const WORLD_DEFINITIONS = Object.freeze({
  ...COAST_WORLD_DEFINITIONS,
  village: Object.freeze({ ...village, portals: Object.freeze(villagePortals) }),
  ...VOLCANO_WORLD_DEFINITIONS,
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
