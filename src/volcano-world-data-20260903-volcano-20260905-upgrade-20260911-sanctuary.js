const VOLCANO_WIDTH = 2160;
const VOLCANO_HEIGHT = 1800;

function portal(id, x, y, label, color, mapId, destinationX, destinationY, requirements = []) {
  return Object.freeze({
    id, x, y, w: 96, h: 96, label, color,
    destination: Object.freeze({ mapId, x: destinationX, y: destinationY }),
    requirements: Object.freeze(requirements.map(requirement => Object.freeze({ ...requirement }))),
  });
}

const sanctuaryRequirement = Object.freeze({
  type: "chapter-flag",
  chapterId: "volcano",
  flag: "sanctuaryUnlocked",
});

export const VOLCANO_WORLD_DEFINITIONS = Object.freeze({
  volcano: Object.freeze({
    id: "volcano",
    name: "잿불 관문",
    width: VOLCANO_WIDTH,
    height: VOLCANO_HEIGHT,
    spawn: Object.freeze({ x: 1080, y: 1460 }),
    safe: false,
    portals: Object.freeze([
      portal("to-village", 1032, 1600, "중앙 마을", "#d8b4fe", "village", 1440, 1180),
      portal("to-magma-route", 1964, 804, "용암 수송로", "#fb923c", "volcano-magma-route", 244, 852),
    ]),
    enemySpawns: Object.freeze([
      { kind: "fire-slime", x: 520, y: 1220 },
      { kind: "fire-slime", x: 1480, y: 1260 },
      { kind: "magma-slime", x: 760, y: 620 },
      { kind: "flame-imp", x: 1580, y: 500 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 260, h: 760, type: "lava" },
      { x: 0, y: 1040, w: 260, h: 760, type: "lava" },
      { x: 760, y: 700, w: 640, h: 300, type: "crater" },
    ]),
  }),
  "volcano-magma-route": Object.freeze({
    id: "volcano-magma-route",
    name: "용암 수송로",
    width: VOLCANO_WIDTH,
    height: VOLCANO_HEIGHT,
    spawn: Object.freeze({ x: 244, y: 852 }),
    safe: false,
    portals: Object.freeze([
      portal("to-ash-gate", 100, 804, "잿불 관문", "#fb923c", "volcano", 1916, 852),
      portal("to-observatory", 1964, 804, "붕괴한 관측소", "#f97316", "volcano-observatory", 244, 852),
    ]),
    enemySpawns: Object.freeze([
      { kind: "fire-slime", x: 560, y: 520 },
      { kind: "magma-slime", x: 1080, y: 1300 },
      { kind: "magma-slime", x: 1580, y: 520 },
      { kind: "flame-imp", x: 1580, y: 1320 },
    ]),
    obstacles: Object.freeze([
      { x: 720, y: 0, w: 220, h: 620, type: "lava" },
      { x: 720, y: 1180, w: 220, h: 620, type: "lava" },
      { x: 1240, y: 520, w: 220, h: 760, type: "lava" },
    ]),
  }),
  "volcano-observatory": Object.freeze({
    id: "volcano-observatory",
    name: "붕괴한 관측소",
    width: VOLCANO_WIDTH,
    height: VOLCANO_HEIGHT,
    spawn: Object.freeze({ x: 244, y: 852 }),
    safe: false,
    portals: Object.freeze([
      portal("to-magma-route", 100, 804, "용암 수송로", "#fb923c", "volcano-magma-route", 1916, 852),
      portal("to-core-caldera", 1964, 804, "화구 코어 제단", "#ef4444", "volcano-core-caldera", 244, 852),
    ]),
    enemySpawns: Object.freeze([
      { kind: "magma-slime", x: 520, y: 1260 },
      { kind: "flame-imp", x: 1480, y: 1280 },
      { kind: "flame-imp", x: 1640, y: 480 },
    ]),
    obstacles: Object.freeze([
      { x: 720, y: 420, w: 720, h: 720, type: "observatory" },
      { x: 0, y: 0, w: 220, h: 560, type: "lava" },
      { x: 0, y: 1240, w: 220, h: 560, type: "lava" },
    ]),
  }),
  "volcano-core-caldera": Object.freeze({
    id: "volcano-core-caldera",
    name: "화구 코어 제단",
    width: VOLCANO_WIDTH,
    height: VOLCANO_HEIGHT,
    spawn: Object.freeze({ x: 244, y: 852 }),
    safe: false,
    portals: Object.freeze([
      portal("to-observatory", 100, 804, "붕괴한 관측소", "#f97316", "volcano-observatory", 1916, 852),
      portal("to-sanctuary", 1032, 100, "픽셀 코어 성역", "#fde68a", "sanctuary", 1080, 1460, [sanctuaryRequirement]),
    ]),
    enemySpawns: Object.freeze([]),
    obstacles: Object.freeze([
      { x: 660, y: 440, w: 840, h: 720, type: "coreCrater" },
      { x: 0, y: 0, w: 240, h: 620, type: "lava" },
      { x: 1920, y: 1180, w: 240, h: 620, type: "lava" },
    ]),
  }),
  sanctuary: Object.freeze({
    id: "sanctuary",
    name: "픽셀 코어 성역 입구",
    width: VOLCANO_WIDTH,
    height: VOLCANO_HEIGHT,
    spawn: Object.freeze({ x: 1080, y: 1460 }),
    safe: true,
    portals: Object.freeze([
      portal("to-core-caldera", 1032, 1600, "화구 코어 제단", "#ef4444", "volcano-core-caldera", 1080, 300),
    ]),
    enemySpawns: Object.freeze([]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 360, h: VOLCANO_HEIGHT, type: "sanctuaryWall" },
      { x: 1800, y: 0, w: 360, h: VOLCANO_HEIGHT, type: "sanctuaryWall" },
      { x: 720, y: 360, w: 720, h: 500, type: "sanctuaryGate" },
    ]),
  }),
});
