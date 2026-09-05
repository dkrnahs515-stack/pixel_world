function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

const storyTarget = (type, id, mapId, x, y, prompt, pages, extra = {}) => freeze({
  id,
  interactionId: id,
  chapterId: "volcano",
  type,
  mapId,
  x,
  y,
  interactionRadius: 82,
  prompt,
  pages,
  ...extra,
});

export const VOLCANO_DEVICES = freeze([
  storyTarget("volcano-device", "ash-gate-pressure-seal", "volcano", 520, 920, "F · 압력 봉인장치 복구", [
    "압력 봉인장치를 재가동하자 용암 수송로의 압력이 낮아진다.",
  ]),
  storyTarget("volcano-device", "magma-valve-west", "volcano-magma-route", 520, 540, "F · 서쪽 용암 밸브 복구", [
    "서쪽 용암 밸브가 잠기며 수송로의 열기가 가라앉는다.",
  ]),
  storyTarget("volcano-device", "magma-valve-central", "volcano-magma-route", 1080, 900, "F · 중앙 용암 밸브 복구", [
    "중앙 용암 밸브의 압력계가 안정 범위로 돌아온다.",
  ]),
  storyTarget("volcano-device", "magma-valve-east", "volcano-magma-route", 1640, 1260, "F · 동쪽 용암 밸브 복구", [
    "동쪽 용암 밸브가 닫히고 관측소로 향하는 길이 안정된다.",
  ]),
  storyTarget("volcano-device", "observatory-stabilizer", "volcano-observatory", 1640, 560, "F · 관측소 안정기 복구", [
    "무너진 관측소의 안정기가 마지막 기록을 복원한다.",
  ]),
]);

export const VOLCANO_STORY_CLUES = freeze([
  storyTarget("volcano-clue", "garen-scorched-insignia", "volcano", 1500, 1180, "F · 그을린 인장 확인", [
    "가렌의 그을린 인장이다. 그는 대장을 지키며 더 깊은 곳으로 향했다.",
  ], { speaker: "가렌" }),
  storyTarget("volcano-clue", "garen-escort-record", "volcano-magma-route", 1540, 560, "F · 호위 기록 확인", [
    "가렌: 대장의 명령대로 코어 조각을 호위한다. 냉각 쐐기는 길마다 남긴다.",
  ], { speaker: "가렌" }),
  storyTarget("volcano-clue", "captain-transport-order", "volcano-observatory", 580, 1280, "F · 운반 명령 확인", [
    "선발대장: 가렌, 해안에서 회수한 코어 조각을 활화산 관측소로 운반하라.",
  ], { speaker: "선발대장" }),
  storyTarget("volcano-clue", "captain-core-contact-record", "volcano-observatory", 1640, 1280, "F · 코어 접촉 기록 확인", [
    "기록의 답은 선발대장 자신이다. 즉시 폭발을 막기 위해 봉인을 어기고 코어에 직접 손댔다.",
    "코어의 변이 파동이 접촉 직후 대장에게 옮겨 갔다.",
  ], { speaker: "관측소 기록" }),
]);

export const VOLCANO_COOLANT_ANCHORS = freeze([
  storyTarget("volcano-coolant", "ash-gate-coolant-anchor", "volcano", 430, 420, "F · 잿불 냉각 쐐기 회수", [
    "가렌이 남긴 첫 번째 냉각 쐐기를 회수했다.",
  ]),
  storyTarget("volcano-coolant", "magma-route-coolant-anchor", "volcano-magma-route", 1080, 1380, "F · 수송로 냉각 쐐기 회수", [
    "수송로의 두 번째 냉각 쐐기를 회수했다.",
  ]),
  storyTarget("volcano-coolant", "observatory-coolant-anchor", "volcano-observatory", 520, 480, "F · 관측소 냉각 쐐기 회수", [
    "관측소의 세 번째 냉각 쐐기를 회수했다.",
  ]),
]);

const VOLCANO_BRANCH_INTERACTIONS = freeze([
  storyTarget("volcano-route", "volcano-route-console", "volcano-observatory", 1700, 900, "F · 화구 진입 경로 확정", [
    "화구 진입 제어장치가 응답한다.",
  ]),
  storyTarget("volcano-captain", "volcano-captain-outcome", "volcano-core-caldera", 1560, 780, "F · 선발대장에게 다가가기", [
    "오염된 선발대장의 숨이 희미하게 이어진다.",
  ]),
  storyTarget("volcano-core", "volcano-core-fragment", "volcano-core-caldera", 1080, 1210, "F · 세 번째 코어 조각 회수", [
    "세 번째 코어 조각이 공명하며 픽셀 코어 성역의 문을 연다.",
  ]),
]);

export const VOLCANO_STORY_INTERACTIONS = freeze([
  ...VOLCANO_DEVICES,
  ...VOLCANO_STORY_CLUES,
  ...VOLCANO_COOLANT_ANCHORS,
  ...VOLCANO_BRANCH_INTERACTIONS,
]);

export const VOLCANO_STORY_ACTORS = freeze([
  {
    id: "garen",
    name: "가렌",
    role: "vanguard-escort",
    placements: [
      { mapId: "volcano", x: 1500, y: 1180 },
      { mapId: "volcano-magma-route", x: 1540, y: 560 },
    ],
    pages: ["가렌: 대장을 구하려면 내가 흩어 둔 냉각 쐐기 세 개가 모두 필요하다."],
  },
  {
    id: "vanguard-captain",
    name: "선발대장",
    role: "corrupted-captain",
    placements: [{ mapId: "volcano-core-caldera", x: 1560, y: 780 }],
    pages: ["선발대장: 조각을 빼앗으려던 게 아니다. 분화를 막을 시간이 없었다."],
  },
]);

const VOLCANO_MAP_IDS = freeze([
  "volcano",
  "volcano-magma-route",
  "volcano-observatory",
  "volcano-core-caldera",
]);

export function getVolcanoStoryContent(mapId) {
  if (!VOLCANO_MAP_IDS.includes(mapId)) return null;
  return freeze({
    mapId,
    devices: VOLCANO_DEVICES.filter(value => value.mapId === mapId),
    clues: VOLCANO_STORY_CLUES.filter(value => value.mapId === mapId),
    coolantAnchors: VOLCANO_COOLANT_ANCHORS.filter(value => value.mapId === mapId),
    actors: VOLCANO_STORY_ACTORS
      .filter(actor => actor.placements.some(placement => placement.mapId === mapId))
      .map(actor => ({
        ...actor,
        placements: actor.placements.filter(placement => placement.mapId === mapId),
      })),
    interactions: VOLCANO_STORY_INTERACTIONS.filter(value => value.mapId === mapId),
  });
}
