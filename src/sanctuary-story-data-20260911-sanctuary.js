import {
  MEMORY_SOUND_IDS,
  SANCTUARY_CORE_IDS,
} from "./sanctuary-progress-20260911-sanctuary.js";

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function target(type, id, mapId, x, y, prompt, pages, extra = {}) {
  return freeze({
    id,
    interactionId: id,
    chapterId: "sanctuary",
    type,
    mapId,
    x,
    y,
    interactionRadius: 84,
    prompt,
    pages,
    ...extra,
  });
}

function coreCasketTargets() {
  const positions = freeze({
    "forest-core-casket": { x: 780, y: 860, region: "태고의 숲", visualVariant: "light" },
    "coast-core-casket": { x: 1080, y: 700, region: "푸른 해안", visualVariant: "light" },
    "volcano-core-casket": { x: 1380, y: 860, region: "활화산", visualVariant: "light" },
  });
  return SANCTUARY_CORE_IDS.map(id => target(
    "sanctuary-core-casket",
    id,
    "sanctuary",
    positions[id].x,
    positions[id].y,
    `F · ${positions[id].region} 코어 안치`,
    [`${positions[id].region}의 코어 조각이 석관 안에서 흰빛으로 이어진다.`],
    { visualVariant: positions[id].visualVariant },
  ));
}

function memorySoundTargets() {
  const memories = freeze({
    "departure-bell": {
      x: 560, y: 1240, label: "출발 종", visualVariant: "architecture",
      pages: ["얼굴 없는 역사의 실루엣 너머로 출발 종이 먼저 울린다."],
    },
    "dawn-bird": {
      x: 820, y: 820, label: "새벽 새", visualVariant: "silhouette",
      pages: ["희미한 새의 그림자가 새벽빛을 가르며 두 번째 소리를 남긴다."],
    },
    "tide-bell": {
      x: 1340, y: 820, label: "조수 종", visualVariant: "hand",
      pages: ["누군가의 손만 남은 기억이 물결에 잠긴 종을 세 번째로 흔든다."],
    },
    "mine-shift-bell": {
      x: 1600, y: 1240, label: "광산 교대 종", visualVariant: "architecture",
      pages: ["빈 광산 회랑에서 교대 종이 마지막으로 짧게 울린다."],
    },
  });
  return MEMORY_SOUND_IDS.map(id => target(
    "sanctuary-memory-sound",
    id,
    "sanctuary-memory-archive",
    memories[id].x,
    memories[id].y,
    `F · ${memories[id].label} 기억 수집`,
    memories[id].pages,
    { memoryId: id, memoryVisual: true, visualVariant: memories[id].visualVariant },
  ));
}

function sequenceConsoleTarget() {
  return target(
    "sanctuary-memory-sequence",
    "memory-sequence-console",
    "sanctuary-memory-archive",
    1080,
    420,
    "F · 기억 소리 배열",
    ["네 소리를 기억이 남긴 순서대로 배열해야 잠긴 회랑이 열린다."],
    { visualVariant: "architecture" },
  );
}

export const SANCTUARY_ARCHIVE_RECORDS = freeze([
  {
    id: "false-return-resonance-time",
    chapterId: "sanctuary",
    title: "거짓 귀환 기록의 공명 시각",
    speaker: "기억 회랑 보존 기록",
    timelineOrder: 70,
    memoryVisual: true,
    visualVariant: "light",
    pages: [
      "4시 13분 22초는 귀환 사건이 일어난 때가 아니라 픽셀 코어가 서로를 부른 공명 시각으로 보존되어 있다.",
    ],
  },
  {
    id: "first-archivist-deletion-log",
    chapterId: "sanctuary",
    title: "초대 기록관의 삭제 로그",
    speaker: "초대 기록관의 잔향",
    timelineOrder: 80,
    memoryVisual: true,
    visualVariant: "hand",
    pages: [
      "초대 기록관은 상충하는 귀환 기록들이 모두 진실이라고 명령하는 상황에서 기록을 지우려 했다.",
      "그 선택은 잘못이었지만, 한 사람의 악의만으로 설명할 수 없는 압박과 두려움이 함께 남아 있다.",
    ],
  },
  {
    id: "core-self-division-original",
    chapterId: "sanctuary",
    title: "코어 자기 분열 원본",
    speaker: "픽셀 코어 원본 기록",
    timelineOrder: 90,
    memoryVisual: true,
    visualVariant: "grave",
    pages: [
      "서로 양립할 수 없는 귀환 명령을 동시에 돌려보내려다 코어는 스스로 갈라졌다.",
      "루멘을 포함한 여러 선택과 충돌이 균열을 넓혔으며, 어느 한 존재만을 파괴자로 확정할 수 없다.",
    ],
  },
]);

function truthRecordTargets() {
  const records = freeze([
    ["truth-resonance-time", "false-return-resonance-time", 560, 480, "light"],
    ["truth-first-archivist-log", "first-archivist-deletion-log", 1080, 660, "hand"],
    ["truth-core-self-division", "core-self-division-original", 1600, 480, "grave"],
  ]);
  return records.map(([id, recordId, x, y, visualVariant]) => {
    const record = SANCTUARY_ARCHIVE_RECORDS.find(value => value.id === recordId);
    return target(
      "sanctuary-truth-record",
      id,
      "sanctuary-memory-archive",
      x,
      y,
      "F · 보존 원본 확인",
      record.pages,
      {
        archiveRecordId: recordId,
        memoryVisual: true,
        visualVariant,
        revealsCoreTruth: id === "truth-core-self-division",
      },
    );
  });
}

function falseReturnContradictionTargets() {
  return [
    target("sanctuary-false-return", "false-return-garen-unscarred", "sanctuary-memory-archive", 560, 1120, "F · 가렌 환영의 모순 확인", [
      "환영 속 가렌에게는 화산의 흉터가 없다. 보존 기록과 맞지 않는다.",
    ], { memoryVisual: true, visualVariant: "silhouette", resolvesFalseReturn: false }),
    target("sanctuary-false-return", "false-return-source-erased", "sanctuary-memory-archive", 1080, 1280, "F · 지워진 출처의 모순 확인", [
      "출처가 완전히 지워졌다는 환영과 달리 삭제 로그에는 초대 기록관의 손자국이 남아 있다.",
    ], { memoryVisual: true, visualVariant: "hand", resolvesFalseReturn: false }),
    target("sanctuary-false-return", "false-return-resonance-time", "sanctuary-memory-archive", 1600, 1120, "F · 시각 표기의 모순 확인", [
      "4시 13분 22초를 귀환 사건의 시각으로 부르는 환영은 원본의 공명 시각 표기와 충돌한다.",
    ], { memoryVisual: true, visualVariant: "light", resolvesFalseReturn: true }),
  ];
}

// Chapter 13 interaction groups are deliberately empty until their own task adds
// record fields, the Chorus encounter, future previews, and ending resolution.
function returnRecordTargets() { return []; }
function correctionConsoleTarget() { return []; }
function futureOpinionTargets() { return []; }
function futurePreviewTargets() { return []; }
function endingConsoleTarget() { return []; }

export const SANCTUARY_STORY_INTERACTIONS = freeze([
  ...coreCasketTargets(),
  ...memorySoundTargets(),
  sequenceConsoleTarget(),
  ...truthRecordTargets(),
  ...falseReturnContradictionTargets(),
  ...returnRecordTargets(),
  ...correctionConsoleTarget(),
  ...futureOpinionTargets(),
  ...futurePreviewTargets(),
  ...endingConsoleTarget(),
]);

export function getSanctuaryStoryContent(mapId) {
  if (!["sanctuary", "sanctuary-memory-archive", "sanctuary-return-record", "sanctuary-three-futures"].includes(mapId)) {
    return null;
  }
  const interactions = SANCTUARY_STORY_INTERACTIONS.filter(value => value.mapId === mapId);
  return freeze({
    mapId,
    interactions,
    records: SANCTUARY_ARCHIVE_RECORDS.filter(record => interactions.some(
      interaction => interaction.archiveRecordId === record.id,
    )),
  });
}

export function getCollectedSanctuaryRecords(worldProgress) {
  return worldProgress?.chapters?.sanctuary?.coreTruthRevealed === true
    ? [...SANCTUARY_ARCHIVE_RECORDS]
    : [];
}

function objective(id, label, mapId, interactionIds = []) {
  return freeze({ id, label, mapId, interactionIds });
}

export function getSanctuaryChapterObjective(worldProgress) {
  const sanctuary = worldProgress?.chapters?.sanctuary || {};
  const activated = sanctuary.activatedCoreIds || [];
  const memories = sanctuary.collectedMemoryIds || [];
  if (!SANCTUARY_CORE_IDS.every(id => activated.includes(id))) {
    return objective("activate-sanctuary-cores", "세 코어 조각을 성역 석관에 안치한다.", "sanctuary", SANCTUARY_CORE_IDS);
  }
  if (!MEMORY_SOUND_IDS.every(id => memories.includes(id))) {
    return objective("collect-memory-sounds", "기억 회랑의 네 소리를 수집한다.", "sanctuary-memory-archive", MEMORY_SOUND_IDS);
  }
  if (!sanctuary.memoryOrderSolved) {
    return objective("solve-memory-order", "네 소리를 기억의 순서대로 배열한다.", "sanctuary-memory-archive", ["memory-sequence-console"]);
  }
  if (!sanctuary.coreTruthRevealed) {
    return objective("reveal-core-truth", "세 보존 원본을 대조해 코어의 진실을 복원한다.", "sanctuary-memory-archive", [
      "truth-resonance-time", "truth-first-archivist-log", "truth-core-self-division",
    ]);
  }
  if (!sanctuary.falseReturnRejected) {
    return objective("reject-false-return", "거짓 귀환 환영의 세 모순을 확인한다.", "sanctuary-memory-archive", [
      "false-return-garen-unscarred", "false-return-source-erased", "false-return-resonance-time",
    ]);
  }
  return objective("chapter-12-complete", "기억 회랑의 원본을 보존했다. 마지막 귀환 기록실로 향한다.", "sanctuary-return-record");
}
