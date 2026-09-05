const COAST_WIDTH = 2160;
const COAST_HEIGHT = 1800;

function portal(id, x, y, label, color, mapId, destinationX, destinationY, requirements = []) {
  return Object.freeze({
    id, x, y, w: 96, h: 96, label, color,
    destination: Object.freeze({ mapId, x: destinationX, y: destinationY }),
    requirements: Object.freeze(requirements.map(requirement => Object.freeze({ ...requirement }))),
  });
}

const toVillage = () => portal(
  "to-village", 984, 100, "중앙 마을", "#d8b4fe", "village", 1440, 1180,
);

const shortcutRequirement = Object.freeze({
  type: "chapter-flag",
  chapterId: "coast",
  flag: "shortcutUnlocked",
});

export const COAST_WORLD_DEFINITIONS = Object.freeze({
  "coast-beach": Object.freeze({
    id: "coast-beach",
    name: "푸른 해변",
    width: COAST_WIDTH,
    height: COAST_HEIGHT,
    spawn: Object.freeze({ x: 1080, y: 320 }),
    safe: false,
    portals: Object.freeze([
      toVillage(),
      portal("to-wreck-bay", 1964, 804, "난파선 만", "#38bdf8", "coast-wreck-bay", 244, 852),
      portal("shortcut-to-tide-core", 1460, 1280, "조수 코어 지름길", "#7dd3fc", "coast-tide-core-cave", 1640, 1408, [shortcutRequirement]),
    ]),
    enemySpawns: Object.freeze([
      { kind: "crab", x: 540, y: 740 },
      { kind: "crab", x: 1460, y: 720 },
      { kind: "crab", x: 1720, y: 1120 },
      { kind: "water-slime", x: 620, y: 1250 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 1500, w: COAST_WIDTH, h: 300, type: "deepWater" },
      { x: 0, y: 0, w: 280, h: 580, type: "cliff" },
      { x: 1880, y: 0, w: 280, h: 580, type: "cliff" },
      { x: 760, y: 1000, w: 460, h: 220, type: "tidePool" },
    ]),
  }),
  "coast-wreck-bay": Object.freeze({
    id: "coast-wreck-bay",
    name: "난파선 만",
    width: COAST_WIDTH,
    height: COAST_HEIGHT,
    spawn: Object.freeze({ x: 244, y: 852 }),
    safe: false,
    portals: Object.freeze([
      portal("to-beach", 100, 804, "푸른 해변", "#38bdf8", "coast-beach", 1916, 852),
      portal("to-flooded-station", 1964, 804, "침수된 통신소", "#22d3ee", "coast-flooded-station", 244, 852),
    ]),
    enemySpawns: Object.freeze([
      { kind: "crab", x: 480, y: 1120 },
      { kind: "crab", x: 1580, y: 1190 },
      { kind: "water-slime", x: 620, y: 1380 },
      { kind: "fang-shark", x: 1580, y: 1380 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 1500, w: COAST_WIDTH, h: 300, type: "deepWater" },
      { x: 840, y: 600, w: 500, h: 420, type: "wreck" },
      { x: 0, y: 0, w: 260, h: 500, type: "cliff" },
      { x: 1900, y: 0, w: 260, h: 500, type: "cliff" },
    ]),
  }),
  "coast-flooded-station": Object.freeze({
    id: "coast-flooded-station",
    name: "침수된 통신소",
    width: COAST_WIDTH,
    height: COAST_HEIGHT,
    spawn: Object.freeze({ x: 244, y: 852 }),
    safe: false,
    portals: Object.freeze([
      portal("to-wreck-bay", 100, 804, "난파선 만", "#38bdf8", "coast-wreck-bay", 1916, 852),
      portal("to-tide-core-cave", 1964, 804, "조수 코어 동굴", "#67e8f9", "coast-tide-core-cave", 480, 852),
    ]),
    enemySpawns: Object.freeze([
      { kind: "water-slime", x: 420, y: 1240 },
      { kind: "water-slime", x: 1640, y: 1180 },
      { kind: "fang-shark", x: 480, y: 520 },
      { kind: "pirate-shark", x: 1740, y: 1370 },
    ]),
    obstacles: Object.freeze([
      { x: 740, y: 500, w: 680, h: 600, type: "station" },
      { x: 0, y: 1420, w: COAST_WIDTH, h: 380, type: "deepWater" },
      { x: 0, y: 0, w: 280, h: 420, type: "cliff" },
      { x: 1880, y: 0, w: 280, h: 420, type: "cliff" },
    ]),
  }),
  "coast-tide-core-cave": Object.freeze({
    id: "coast-tide-core-cave",
    name: "조수 코어 동굴",
    width: COAST_WIDTH,
    height: COAST_HEIGHT,
    spawn: Object.freeze({ x: 480, y: 852 }),
    safe: false,
    portals: Object.freeze([
      portal("to-flooded-station", 320, 804, "침수된 통신소", "#22d3ee", "coast-flooded-station", 1916, 852),
      portal("shortcut-to-beach", 1724, 1360, "푸른 해변 지름길", "#7dd3fc", "coast-beach", 1340, 1328, [shortcutRequirement]),
    ]),
    enemySpawns: Object.freeze([
      { kind: "fang-shark", x: 1540, y: 460 },
      { kind: "pirate-shark", x: 1660, y: 1130 },
    ]),
    obstacles: Object.freeze([
      { x: 700, y: 500, w: 760, h: 700, type: "corePool" },
      { x: 0, y: 0, w: 300, h: COAST_HEIGHT, type: "caveWall" },
      { x: 1860, y: 0, w: 300, h: COAST_HEIGHT, type: "caveWall" },
      { x: 0, y: 1540, w: COAST_WIDTH, h: 260, type: "caveWall" },
    ]),
  }),
});
