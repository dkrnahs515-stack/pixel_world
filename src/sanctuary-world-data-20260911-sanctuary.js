const SANCTUARY_WIDTH = 2160;
const SANCTUARY_HEIGHT = 1800;

function freeze(value) {
  if (value && typeof value === "object" && Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  }
  return value;
}

function portal(id, x, y, label, color, mapId, destinationX, destinationY, requirements = []) {
  return freeze({
    id, x, y, w: 96, h: 96, label, color,
    destination: { mapId, x: destinationX, y: destinationY },
    requirements,
  });
}

function world(id, name, safe, portals, obstacles, caskets = []) {
  return freeze({
    id,
    name,
    width: SANCTUARY_WIDTH,
    height: SANCTUARY_HEIGHT,
    spawn: { x: 1080, y: 900 },
    safe,
    portals,
    enemySpawns: [],
    obstacles,
    caskets,
  });
}

const sanctuaryWalls = [
  { x: 0, y: 0, w: 360, h: SANCTUARY_HEIGHT, type: "sanctuaryWall" },
  { x: 1800, y: 0, w: 360, h: SANCTUARY_HEIGHT, type: "sanctuaryWall" },
];

export const SANCTUARY_MAP_IDS = Object.freeze([
  "sanctuary",
  "sanctuary-memory-archive",
  "sanctuary-return-record",
  "sanctuary-three-futures",
]);

export const SANCTUARY_CASKETS = freeze([
  { id: "forest-core-casket", regionId: "forest", x: 780, y: 860, color: "#4ade80" },
  { id: "coast-core-casket", regionId: "coast", x: 1080, y: 700, color: "#38bdf8" },
  { id: "volcano-core-casket", regionId: "volcano", x: 1380, y: 860, color: "#fb923c" },
]);

export const SANCTUARY_OVERLAY_ANCHORS = freeze({
  caskets: SANCTUARY_CASKETS.map(casket => ({ mapId: "sanctuary", ...casket })),
});

export const SANCTUARY_WORLD_DEFINITIONS = freeze({
  sanctuary: world("sanctuary", "픽셀 코어 성역 입구", true, [
    portal("to-core-caldera", 1032, 1600, "화구 코어 제단", "#ef4444", "volcano-core-caldera", 1080, 300),
    portal("to-memory-archive", 1032, 100, "기억 회랑", "#67e8f9", "sanctuary-memory-archive", 1080, 1500),
  ], sanctuaryWalls, SANCTUARY_CASKETS),
  "sanctuary-memory-archive": world("sanctuary-memory-archive", "기억 회랑", false, [
    portal("to-sanctuary", 1032, 1600, "픽셀 코어 성역 입구", "#67e8f9", "sanctuary", 1080, 300),
    portal("to-return-record", 1032, 100, "마지막 귀환 기록실", "#67e8f9", "sanctuary-return-record", 1080, 1500),
  ], sanctuaryWalls),
  "sanctuary-return-record": world("sanctuary-return-record", "마지막 귀환 기록실", false, [
    portal("to-memory-archive", 1032, 1600, "기억 회랑", "#67e8f9", "sanctuary-memory-archive", 1080, 300),
    portal("to-three-futures", 1032, 100, "세 개의 미래", "#f8fafc", "sanctuary-three-futures", 1080, 1500),
  ], sanctuaryWalls),
  "sanctuary-three-futures": world("sanctuary-three-futures", "세 개의 미래", true, [
    portal("to-return-record", 1032, 1600, "마지막 귀환 기록실", "#67e8f9", "sanctuary-return-record", 1080, 300),
  ], sanctuaryWalls),
});

export function getSanctuaryWorldDefinition(mapId) {
  return Object.hasOwn(SANCTUARY_WORLD_DEFINITIONS, mapId)
    ? SANCTUARY_WORLD_DEFINITIONS[mapId]
    : null;
}
