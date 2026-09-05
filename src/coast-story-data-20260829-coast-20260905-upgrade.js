function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

const device = (id, mapId, x, y, name, pages) => freeze({
  id,
  interactionId: id,
  type: "device",
  mapId,
  x,
  y,
  name,
  interactionRadius: 76,
  prompt: "F · 통신 장치 복구",
  pages,
});

const record = (id, mapId, x, y, speaker, signalKind, timelineOrder, pages) => freeze({
  id,
  interactionId: id,
  type: "record",
  mapId,
  x,
  y,
  speaker,
  required: true,
  signalKind,
  timelineOrder,
  interactionRadius: 76,
  prompt: "F · 신호 분류",
  pages,
});

export const COAST_DEVICES = freeze([
  device("coast-beach-transceiver", "coast-beach", 1120, 720, "해변 송수신기", [
    "마리: 이 송수신기는 아직 숨 쉬고 있어.",
    "잡음 사이에 세라의 구조 신호가 있어.",
  ]),
  device("wreck-relay-west", "coast-wreck-bay", 500, 760, "서쪽 중계기", [
    "서쪽 회선이 잠깐 빛난다.",
  ]),
  device("wreck-relay-deck", "coast-wreck-bay", 1080, 520, "갑판 중계기", [
    "난파선 갑판 아래에서 파형이 이어진다.",
  ]),
  device("wreck-relay-east", "coast-wreck-bay", 1640, 820, "동쪽 중계기", [
    "동쪽 회선이 통신소 방향을 가리킨다.",
  ]),
  device("flooded-station-main-transceiver", "coast-flooded-station", 1080, 420, "주 통신 장치", [
    "에코: 삭제된 기록도 여기 남아 있어.",
    "마리: 누군가 의도적으로 선을 끊었어.",
  ]),
]);

export const COAST_RECORDS = freeze([
  record("sera-distress-current", "coast-beach", 1330, 820, "세라", "current", 60, [
    "세라: 들린다면, 조수 코어로 오지 마.",
    "세라: 그래도 누군가는 이 신호를 찾아야 해.",
  ]),
  record("wreck-record-sera", "coast-wreck-bay", 620, 1120, "세라", "past", 10, [
    "세라: 코어 조각이 파도와 공명하고 있어.",
  ]),
  record("wreck-record-roan", "coast-wreck-bay", 900, 500, "로안", "past", 20, [
    "로안: 구조대는 만에서 대기한다.",
  ]),
  record("wreck-record-garen", "coast-wreck-bay", 1320, 1120, "가렌", "past", 30, [
    "가렌: 기록의 시간대가 서로 다르다.",
  ]),
  record("wreck-record-vanguard-captain", "coast-wreck-bay", 1680, 1220, "선발대장", "past", 40, [
    "선발대장: 코어는 활화산으로 옮긴다.",
  ]),
  record("flooded-station-deleted-record", "coast-flooded-station", 1320, 1120, "세라", "past", 50, [
    "세라: 통신망이 에코를 깨우고 있어.",
    "세라: 모두를 지키려면 회선을 끊어야 해.",
  ]),
]);

export const COAST_TIDE_CORE_REVEAL = freeze({
  id: "tide-core-echo-reveal",
  mapId: "coast-tide-core-cave",
  actorId: "echo",
  pages: ["에코: 나는 침수된 통신 기록과 코어 조각의 의식이 결합해 생겼어."],
});

export const COAST_STORY_ACTORS = freeze([
  {
    id: "mari",
    name: "마리",
    role: "guide",
    renderMode: "npc",
    placements: [
      { mapId: "coast-beach", x: 850, y: 620 },
      { mapId: "coast-flooded-station", x: 620, y: 1160 },
    ],
    pages: ["마리: 신호가 끊겨도 길은 남아 있어."],
  },
  {
    id: "sera",
    name: "세라",
    role: "rescued",
    renderMode: "npc",
    placements: [{ mapId: "coast-tide-core-cave", x: 1580, y: 720 }],
    visibleAfter: "seraRescued",
    pages: ["세라: 에코는 적이 아니라, 남겨진 목소리야."],
  },
  {
    id: "echo",
    name: "에코",
    role: "signal",
    renderMode: "signal",
    placements: [
      { mapId: "coast-beach", x: 1120, y: 720 },
      { mapId: "coast-wreck-bay", x: 1080, y: 520 },
      { mapId: "coast-flooded-station", x: 1080, y: 420 },
      { mapId: "coast-tide-core-cave", x: 1540, y: 780 },
    ],
    pages: ["에코: 나는 기록과 조각 사이에 남은 파형이야."],
  },
]);

export const COAST_SUPPORT_FOLLOW_UPS = freeze({
  sera: {
    mari: "마리: 세라의 선택을 믿고 구조 신호를 따라가자.",
    sera: "세라: 내 결정을 믿어 줘서 고마워.",
    echo: "에코: 세라의 선택도 기록 속에 남겨 둘게.",
  },
  echo: {
    mari: "마리: 에코의 목소리도 구조 신호로 받아들일게.",
    sera: "세라: 에코가 남은 기록을 지킬 수 있게 도와줘.",
    echo: "에코: 내 목소리를 믿어 줘서 고마워.",
  },
  mari: {
    mari: "마리: 길을 열고 모두를 함께 데려올게.",
    sera: "세라: 마리의 판단이라면 믿을 수 있어.",
    echo: "에코: 마리의 길을 따라 신호를 이어 갈게.",
  },
});

export const COAST_OBJECTIVES = freeze([
  {
    id: "coast-beach-investigation",
    mapId: "coast-beach",
    label: "해변 송수신기와 구조 신호를 조사한다.",
    investigationZone: { x: 1200, y: 780, radius: 220 },
    interactionIds: ["coast-beach-transceiver", "sera-distress-current"],
  },
  {
    id: "wreck-bay-investigation",
    mapId: "coast-wreck-bay",
    label: "세 중계기와 과거 기록을 복구한다.",
    investigationZone: { x: 1080, y: 860, radius: 250 },
    interactionIds: [
      "wreck-relay-west",
      "wreck-relay-deck",
      "wreck-relay-east",
      "wreck-record-sera",
      "wreck-record-roan",
      "wreck-record-garen",
      "wreck-record-vanguard-captain",
    ],
  },
  {
    id: "flooded-station-investigation",
    mapId: "coast-flooded-station",
    label: "주 통신 장치와 삭제 기록을 확인한다.",
    investigationZone: { x: 1100, y: 780, radius: 240 },
    interactionIds: [
      "flooded-station-main-transceiver",
      "flooded-station-deleted-record",
      "flooded-station-support",
    ],
  },
  {
    id: "tide-core-investigation",
    mapId: "coast-tide-core-cave",
    label: "세라를 구출하고 해안 코어 조각을 회수한다.",
    investigationZone: { x: 1580, y: 820, radius: 260 },
    interactionIds: ["tide-core-rescue-sera", "tide-core-core-fragment"],
  },
]);

const OBJECTIVE_MAP_BY_STEP_ID = freeze({
  "repair-beach-transceiver": "coast-beach",
  "collect-distress-signal": "coast-beach",
  "repair-wreck-relays": "coast-wreck-bay",
  "collect-wreck-records": "coast-wreck-bay",
  "repair-flooded-station": "coast-flooded-station",
  "collect-deleted-record": "coast-flooded-station",
  "choose-support": "coast-flooded-station",
  "defeat-tide-core-boss": "coast-tide-core-cave",
  "rescue-sera": "coast-tide-core-cave",
  "collect-coast-core": "coast-tide-core-cave",
});

const SUPPORT_CHOICES = freeze([
  { id: "sera", label: "세라를 지지한다" },
  { id: "echo", label: "에코를 지지한다" },
  { id: "mari", label: "마리를 지지한다" },
]);

export const COAST_STORY_INTERACTIONS = freeze([
  ...COAST_DEVICES,
  ...COAST_RECORDS,
  {
    id: "flooded-station-support",
    type: "support",
    mapId: "coast-flooded-station",
    x: 1480,
    y: 1120,
    interactionRadius: 88,
    prompt: "F · 누구의 말을 지지할지 선택",
    choices: SUPPORT_CHOICES,
    pages: ["세 목소리 모두 조수 코어를 향한다."],
  },
  {
    ...COAST_TIDE_CORE_REVEAL,
    type: "reveal",
    x: 1540,
    y: 780,
    interactionRadius: 48,
    prompt: "F · 에코 신호 듣기",
  },
  {
    id: "tide-core-rescue-sera",
    type: "rescue",
    mapId: "coast-tide-core-cave",
    x: 1580,
    y: 720,
    interactionRadius: 84,
    prompt: "F · 세라 구출",
    pages: ["세라를 붙잡고 물가에서 끌어낸다."],
  },
  {
    id: "tide-core-core-fragment",
    type: "core",
    mapId: "coast-tide-core-cave",
    x: 1600,
    y: 940,
    interactionRadius: 84,
    prompt: "F · 해안 코어 조각 회수",
    pages: ["해안 코어 조각이 잔잔하게 빛난다."],
  },
]);

const MAP_IDS = freeze([
  "coast-beach",
  "coast-wreck-bay",
  "coast-flooded-station",
  "coast-tide-core-cave",
]);

export function getCoastStoryContent(mapId) {
  if (!MAP_IDS.includes(mapId)) return null;
  return freeze({
    mapId,
    devices: COAST_DEVICES.filter(device => device.mapId === mapId),
    records: COAST_RECORDS.filter(record => record.mapId === mapId),
    actors: COAST_STORY_ACTORS
      .filter(actor => actor.placements.some(placement => placement.mapId === mapId))
      .map(actor => freeze({
        ...actor,
        placements: actor.placements
          .filter(placement => placement.mapId === mapId)
          .map(placement => ({ ...placement })),
      })),
    objective: COAST_OBJECTIVES.find(objective => objective.mapId === mapId),
    interactions: COAST_STORY_INTERACTIONS.filter(interaction => interaction.mapId === mapId),
    reveal: COAST_TIDE_CORE_REVEAL.mapId === mapId ? COAST_TIDE_CORE_REVEAL : null,
  });
}

function coastChapter(worldProgress) {
  return worldProgress?.chapters?.coast || {};
}

function includesAll(values, required) {
  return required.every(value => values.includes(value));
}

export function getCoastChapterObjective(worldProgress) {
  const unlockedMapIds = worldProgress?.unlockedMapIds || [];
  const completedRegionIds = worldProgress?.completedRegionIds || [];
  const coast = coastChapter(worldProgress);
  const repaired = coast.repairedDeviceIds || [];
  const records = coast.collectedRecordIds || [];
  if (completedRegionIds.includes("coast") && coast.coreFragmentObtained) {
    return freeze({ id: "coast-completed", label: "푸른 해안을 완료했다. 활화산으로 향한다." });
  }
  if (!unlockedMapIds.includes("coast-beach")) {
    return freeze({ id: "defeat-forest-boss", label: "태고의 숲 보스를 처치해 해안을 연다." });
  }
  if (!repaired.includes("coast-beach-transceiver")) {
    return freeze({ id: "repair-beach-transceiver", label: "해변 송수신기를 복구한다." });
  }
  if (!records.includes("sera-distress-current")) {
    return freeze({ id: "collect-distress-signal", label: "세라의 현재 구조 신호를 확인한다." });
  }
  const wreckDevices = ["wreck-relay-west", "wreck-relay-deck", "wreck-relay-east"];
  const wreckRecords = [
    "wreck-record-sera",
    "wreck-record-roan",
    "wreck-record-garen",
    "wreck-record-vanguard-captain",
  ];
  if (!includesAll(repaired, wreckDevices)) {
    return freeze({ id: "repair-wreck-relays", label: "난파선 만의 세 중계기를 복구한다." });
  }
  if (!includesAll(records, wreckRecords)) {
    return freeze({ id: "collect-wreck-records", label: "난파선 만의 과거 기록을 모두 수집한다." });
  }
  if (!repaired.includes("flooded-station-main-transceiver")) {
    return freeze({ id: "repair-flooded-station", label: "침수된 통신소의 주 통신 장치를 복구한다." });
  }
  if (!records.includes("flooded-station-deleted-record")) {
    return freeze({ id: "collect-deleted-record", label: "통신소의 삭제 기록을 확인한다." });
  }
  if (!coast.supportChoice) {
    return freeze({ id: "choose-support", label: "세라·에코·마리 중 누구를 지지할지 정한다." });
  }
  if (!coast.coopBossDefeated) {
    return freeze({ id: "defeat-tide-core-boss", label: "조수 코어 동굴의 보스를 처치한다." });
  }
  if (!coast.seraRescued) {
    return freeze({ id: "rescue-sera", label: "조수 코어 동굴에서 세라를 구출한다." });
  }
  return freeze({ id: "collect-coast-core", label: "해안 코어 조각을 회수한다." });
}

export function getActiveCoastInvestigationObjective(mapId, worldProgress) {
  const step = getCoastChapterObjective(worldProgress);
  if (OBJECTIVE_MAP_BY_STEP_ID[step.id] !== mapId) return null;
  return COAST_OBJECTIVES.find(objective => objective.mapId === mapId) || null;
}

export function getCollectedCoastRecords(worldProgress) {
  const collectedIds = coastChapter(worldProgress).collectedRecordIds || [];
  return COAST_RECORDS
    .filter(record => collectedIds.includes(record.id))
    .sort((left, right) => left.timelineOrder - right.timelineOrder);
}
