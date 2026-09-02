import { COAST_WORLD_DEFINITIONS } from "./coast-world-data-20260829-coast.js";

export const WORLD_IDS = Object.freeze([
  "village", "volcano", "forest",
  "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
]);

const villagePortals = Object.freeze([
  {
    id: "to-forest", x: 570, y: 410, w: 96, h: 96,
    label: "태고의 숲", color: "#53d769",
    destination: Object.freeze({ mapId: "forest", x: 2160, y: 3260 }),
  },
  {
    id: "to-volcano", x: 2214, y: 410, w: 96, h: 96,
    label: "활화산", color: "#ff7043",
    destination: Object.freeze({ mapId: "volcano", x: 2160, y: 3260 }),
  },
  {
    id: "to-coast", x: 1392, y: 1620, w: 96, h: 96,
    label: "해안가", color: "#38bdf8",
    destination: Object.freeze({ mapId: "coast-beach", x: 1080, y: 320 }),
  },
]);

function returnPortal(id, x, y) {
  return Object.freeze({
    id, x, y, w: 96, h: 96,
    label: "중앙 마을", color: "#d8b4fe",
    destination: Object.freeze({ mapId: "village", x: 1440, y: 1180 }),
  });
}

export const WORLD_DEFINITIONS = Object.freeze({
  village: Object.freeze({
    id: "village",
    name: "중앙 마을",
    width: 2880,
    height: 1800,
    spawn: Object.freeze({ x: 1440, y: 1110 }),
    safe: true,
    portals: villagePortals,
    enemySpawns: Object.freeze([]),
    obstacles: Object.freeze([
      { x: 1120, y: 180, w: 640, h: 250, type: "townHall" },
      { x: 240, y: 650, w: 690, h: 430, type: "farm" },
      { x: 2020, y: 610, w: 560, h: 350, type: "shops" },
      { x: 1080, y: 1320, w: 720, h: 240, type: "tradePost" },
    ]),
  }),
  volcano: Object.freeze({
    id: "volcano",
    name: "끓어오르는 활화산",
    width: 4320,
    height: 3600,
    spawn: Object.freeze({ x: 2160, y: 3260 }),
    safe: false,
    portals: Object.freeze([returnPortal("to-village", 2112, 3320)]),
    enemySpawns: Object.freeze([
      { kind: "fire-slime", x: 1250, y: 2850 },
      { kind: "fire-slime", x: 1750, y: 2480 },
      { kind: "fire-slime", x: 2580, y: 2630 },
      { kind: "fire-slime", x: 3150, y: 2860 },
      { kind: "fire-slime", x: 1120, y: 1720 },
      { kind: "fire-slime", x: 2110, y: 1510 },
      { kind: "fire-slime", x: 3050, y: 1680 },
      { kind: "fire-slime", x: 2190, y: 820 },
      { kind: "magma-slime", x: 950, y: 2500 },
      { kind: "magma-slime", x: 2240, y: 2260 },
      { kind: "magma-slime", x: 3350, y: 2580 },
      { kind: "flame-imp", x: 1040, y: 1120 },
      { kind: "flame-imp", x: 3260, y: 1260 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 760, h: 3600, type: "lava" },
      { x: 3560, y: 0, w: 760, h: 3600, type: "lava" },
      { x: 1560, y: 620, w: 1200, h: 620, type: "crater" },
      { x: 1200, y: 1960, w: 520, h: 340, type: "lava" },
      { x: 2700, y: 2050, w: 520, h: 360, type: "lava" },
    ]),
  }),
  forest: Object.freeze({
    id: "forest",
    name: "태고의 숲",
    width: 4320,
    height: 3600,
    spawn: Object.freeze({ x: 2160, y: 3260 }),
    safe: false,
    portals: Object.freeze([returnPortal("to-village", 2112, 3320)]),
    enemySpawns: Object.freeze([
      { kind: "forest-slime", x: 980, y: 2820 },
      { kind: "forest-slime", x: 1660, y: 2430 },
      { kind: "forest-slime", x: 2670, y: 2580 },
      { kind: "forest-slime", x: 3380, y: 2800 },
      { kind: "forest-slime", x: 2060, y: 1640 },
      { kind: "boar", x: 1120, y: 1460 },
      { kind: "boar", x: 3180, y: 1510 },
      { kind: "boar", x: 1640, y: 780 },
      { kind: "boar", x: 2780, y: 730 },
      { kind: "ancient-boar", x: 850, y: 2440 },
      { kind: "ancient-boar", x: 3440, y: 2460 },
      { kind: "moss-troll", x: 920, y: 1040 },
      { kind: "moss-troll", x: 3380, y: 1050 },
      { kind: "ancient-mushroom-bug", x: 1650, y: 1430 },
      { kind: "ancient-mushroom-bug", x: 2560, y: 1470 },
      { kind: "ancient-mushroom-bug", x: 2160, y: 2500 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 640, h: 3600, type: "trees" },
      { x: 3680, y: 0, w: 640, h: 3600, type: "trees" },
      { x: 1660, y: 500, w: 1000, h: 690, type: "greatTree" },
      { x: 820, y: 1800, w: 700, h: 420, type: "pond" },
      { x: 2820, y: 1840, w: 650, h: 390, type: "pond" },
    ]),
  }),
  ...COAST_WORLD_DEFINITIONS,
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
