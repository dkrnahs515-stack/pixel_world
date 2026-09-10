import { VOLCANO_WORLD_DEFINITIONS } from "./volcano-world-data-20260903-volcano-20260905-upgrade.js";

const WIDTH = 2160;
const HEIGHT = 1800;

function portal(id, x, y, label, color, mapId, destinationX, destinationY) {
  return Object.freeze({
    id,
    x,
    y,
    w: 96,
    h: 96,
    label,
    color,
    destination: Object.freeze({ mapId, x: destinationX, y: destinationY }),
    requirements: Object.freeze([]),
  });
}

const entrance = VOLCANO_WORLD_DEFINITIONS.sanctuary;

export const SANCTUARY_MAP_IDS = Object.freeze([
  "sanctuary",
  "sanctuary-resonance-hall",
  "sanctuary-origin-archive",
  "sanctuary-zero-boundary",
  "sanctuary-core-heart",
]);

export const SANCTUARY_WORLD_DEFINITIONS = Object.freeze({
  sanctuary: Object.freeze({
    ...entrance,
    portals: Object.freeze([
      ...entrance.portals,
      portal(
        "to-resonance-hall",
        1032,
        100,
        "공명 회랑",
        "#a5f3fc",
        "sanctuary-resonance-hall",
        1080,
        1480,
      ),
    ]),
  }),
  "sanctuary-resonance-hall": Object.freeze({
    id: "sanctuary-resonance-hall",
    name: "공명 회랑",
    width: WIDTH,
    height: HEIGHT,
    spawn: Object.freeze({ x: 1080, y: 1480 }),
    safe: false,
    portals: Object.freeze([
      portal("to-sanctuary", 1032, 1600, "성역 입구", "#fde68a", "sanctuary", 1080, 300),
      portal("to-origin-archive", 1032, 100, "원점 기록고", "#c4b5fd", "sanctuary-origin-archive", 1080, 1480),
    ]),
    enemySpawns: Object.freeze([
      { kind: "defect-pixel", x: 520, y: 1160 },
      { kind: "defect-pixel", x: 1640, y: 1160 },
      { kind: "core-sentinel", x: 1080, y: 620 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 260, h: HEIGHT, type: "sanctuaryVoid" },
      { x: WIDTH - 260, y: 0, w: 260, h: HEIGHT, type: "sanctuaryVoid" },
      { x: 620, y: 760, w: 220, h: 220, type: "resonancePillar" },
      { x: 970, y: 600, w: 220, h: 220, type: "resonancePillar" },
      { x: 1320, y: 760, w: 220, h: 220, type: "resonancePillar" },
    ]),
  }),
  "sanctuary-origin-archive": Object.freeze({
    id: "sanctuary-origin-archive",
    name: "원점 기록고",
    width: WIDTH,
    height: HEIGHT,
    spawn: Object.freeze({ x: 1080, y: 1480 }),
    safe: true,
    portals: Object.freeze([
      portal("to-resonance-hall", 1032, 1600, "공명 회랑", "#a5f3fc", "sanctuary-resonance-hall", 1080, 300),
      portal("to-zero-boundary", 1032, 100, "제로 경계", "#f0abfc", "sanctuary-zero-boundary", 1080, 1480),
    ]),
    enemySpawns: Object.freeze([]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 220, h: HEIGHT, type: "archiveWall" },
      { x: WIDTH - 220, y: 0, w: 220, h: HEIGHT, type: "archiveWall" },
      { x: 420, y: 520, w: 360, h: 160, type: "archiveShelf" },
      { x: 1380, y: 520, w: 360, h: 160, type: "archiveShelf" },
      { x: 420, y: 980, w: 360, h: 160, type: "archiveShelf" },
      { x: 1380, y: 980, w: 360, h: 160, type: "archiveShelf" },
    ]),
  }),
  "sanctuary-zero-boundary": Object.freeze({
    id: "sanctuary-zero-boundary",
    name: "제로 경계",
    width: WIDTH,
    height: HEIGHT,
    spawn: Object.freeze({ x: 1080, y: 1480 }),
    safe: false,
    portals: Object.freeze([
      portal("to-origin-archive", 1032, 1600, "원점 기록고", "#c4b5fd", "sanctuary-origin-archive", 1080, 300),
      portal("to-core-heart", 1032, 100, "코어 심장부", "#fef08a", "sanctuary-core-heart", 1080, 1480),
    ]),
    enemySpawns: Object.freeze([
      { kind: "defect-pixel", x: 480, y: 1260 },
      { kind: "core-sentinel", x: 1680, y: 1260 },
      { kind: "rewrite-echo", x: 560, y: 620 },
      { kind: "rewrite-echo", x: 1600, y: 620 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 180, h: HEIGHT, type: "zeroVoid" },
      { x: WIDTH - 180, y: 0, w: 180, h: HEIGHT, type: "zeroVoid" },
      { x: 520, y: 820, w: 280, h: 180, type: "deletedTile" },
      { x: 1360, y: 820, w: 280, h: 180, type: "deletedTile" },
    ]),
  }),
  "sanctuary-core-heart": Object.freeze({
    id: "sanctuary-core-heart",
    name: "코어 심장부",
    width: WIDTH,
    height: HEIGHT,
    spawn: Object.freeze({ x: 1080, y: 1480 }),
    safe: false,
    portals: Object.freeze([
      portal("to-zero-boundary", 1032, 1600, "제로 경계", "#f0abfc", "sanctuary-zero-boundary", 1080, 300),
    ]),
    enemySpawns: Object.freeze([]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 160, h: HEIGHT, type: "coreVoid" },
      { x: WIDTH - 160, y: 0, w: 160, h: HEIGHT, type: "coreVoid" },
      { x: 890, y: 560, w: 380, h: 280, type: "pixelCore" },
    ]),
  }),
});
