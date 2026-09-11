import {
  FALSE_RETURN_CONTRADICTION_IDS,
  MEMORY_SOUND_IDS,
  RECORD_FIELD_ANSWER_IDS,
  RECORD_FIELD_IDS,
  SANCTUARY_CORE_IDS,
  TESTIMONY_IDS,
  FUTURE_IDS,
  normalizeSanctuaryChapter,
} from "./sanctuary-progress-20260911-sanctuary.js";
import { SANCTUARY_ENDINGS } from "./sanctuary-ending-20260911-sanctuary.js";

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
  const contradictions = freeze({
    "false-return-garen-unscarred": {
      x: 560, y: 1120, prompt: "F · 가렌 환영의 모순 확인", visualVariant: "silhouette",
      pages: ["환영 속 가렌에게는 화산의 흉터가 없다. 보존 기록과 맞지 않는다."],
    },
    "false-return-source-erased": {
      x: 1080, y: 1280, prompt: "F · 지워진 출처의 모순 확인", visualVariant: "hand",
      pages: ["출처가 완전히 지워졌다는 환영과 달리 삭제 로그에는 초대 기록관의 손자국이 남아 있다."],
    },
    "false-return-resonance-time": {
      x: 1600, y: 1120, prompt: "F · 시각 표기의 모순 확인", visualVariant: "light",
      pages: ["4시 13분 22초를 귀환 사건의 시각으로 부르는 환영은 원본의 공명 시각 표기와 충돌한다."],
    },
  });
  return FALSE_RETURN_CONTRADICTION_IDS.map(id => target(
    "sanctuary-false-return",
    id,
    "sanctuary-memory-archive",
    contradictions[id].x,
    contradictions[id].y,
    contradictions[id].prompt,
    contradictions[id].pages,
    { memoryVisual: true, visualVariant: contradictions[id].visualVariant },
  ));
}

const RETURN_RECORD_FIELD_DEFINITIONS = freeze({
  "vanguard-return-state": {
    label: "선발대 귀환 상태",
    fact: "선발대는 온전히 귀환하지 못했고, 가렌은 화산의 흉터와 영향을 안고 돌아왔다.",
    incomplete: { id: "vanguard-returned-unharmed", label: "선발대 전원이 상처 없이 귀환했다" },
  },
  "core-division-cause": {
    label: "코어 분열 원인",
    fact: "상충하는 귀환 기록을 동시에 실행하려던 코어가 스스로 갈라졌다.",
    incomplete: { id: "lumen-broke-core-alone", label: "루멘 한 사람만이 코어를 파괴했다" },
  },
  "delay-roan": {
    label: "로안의 지연 책임",
    fact: "로안은 숲길을 붙들어 붕괴의 확산을 늦추고 그 지연의 몫을 맡았다.",
    incomplete: { id: "roan-left-before-delay", label: "로안은 지연에 관여하지 않았다" },
  },
  "delay-sera": {
    label: "세라의 지연 책임",
    fact: "세라는 해안 신호를 유지해 귀환 기록의 소실을 늦추고 그 지연의 몫을 맡았다.",
    incomplete: { id: "sera-erased-coast-signal", label: "세라는 해안 신호를 지웠다" },
  },
  "delay-garen": {
    label: "가렌의 지연 책임",
    fact: "가렌은 화산 붕괴를 늦추다 흉터와 영향을 남겼고 그 지연의 몫을 맡았다.",
    incomplete: { id: "garen-delayed-unscarred", label: "가렌은 아무 영향도 받지 않았다" },
  },
  "delay-lumen": {
    label: "루멘의 지연 책임",
    fact: "루멘은 분화를 늦추기 위해 봉인을 건드리는 선택을 했고 자기 몫의 지연 책임을 맡았다.",
    incomplete: { id: "lumen-broke-core-alone", label: "루멘 혼자 코어를 깨뜨렸다" },
  },
});

const LUMEN_SOURCES = freeze({
  rescued: {
    ids: ["lumen-current-testimony"],
    pages: ["현재 생존한 루멘의 증언을 보존 원본과 대조한다."],
  },
  lost: {
    ids: ["lumen-unsent-retreat-order", "lumen-residual-memory"],
    pages: ["미전송 철수 명령서와 봉인에 남은 잔류 기억을 보존 원본과 대조한다."],
  },
});

const CHORUS_COMPLETION_ACCESS = freeze({
  hiddenWeaponRequired: false,
  endingIds: ["seal", "restore", "release"],
  rewardProfileId: "sanctuary-standard",
});

const CHORUS_BRANCH_PRESENTATIONS = freeze({
  rescued: {
    captainOutcome: "rescued",
    officialStoryRoute: true,
    lumen: {
      mode: "live-voice",
      presentActor: false,
      interruptionId: "false-order-interrupt",
      sourceRecordIds: ["lumen-current-testimony"],
      pages: [
        "살아 있는 루멘의 통신이 합창이 흉내 낸 거짓 명령을 한 번 끊는다.",
        "루멘은 코어 분열의 유일한 원인이 아니라, 봉인을 건드린 자신의 선택과 지연 책임을 직접 증언한다.",
      ],
    },
    completionAccess: CHORUS_COMPLETION_ACCESS,
  },
  lost: {
    captainOutcome: "lost",
    officialStoryRoute: false,
    lumen: {
      mode: "unsent-order",
      presentActor: false,
      interruptionId: null,
      sourceRecordIds: ["lumen-unsent-retreat-order", "lumen-residual-memory"],
      pages: [
        "미전송 철수 명령서가 루멘이 남긴 선택과 책임을 증언한다.",
        "봉인에 남은 잔류 기억이 그 기록을 보완하며, 현재의 인물이나 목소리로 나타나지 않는다.",
      ],
    },
    completionAccess: CHORUS_COMPLETION_ACCESS,
  },
});

export function chorusBranchPresentation(captainOutcome) {
  return CHORUS_BRANCH_PRESENTATIONS[captainOutcome === "rescued" ? "rescued" : "lost"];
}

function recordFieldAnswers(fieldId) {
  const definition = RETURN_RECORD_FIELD_DEFINITIONS[fieldId];
  if (!definition) return [];
  return freeze([
    {
      id: RECORD_FIELD_ANSWER_IDS[fieldId],
      label: definition.fact,
      validated: true,
    },
    {
      ...definition.incomplete,
      validated: false,
    },
  ]);
}

export function answerForRecordField(fieldId, captainOutcome) {
  const answer = recordFieldAnswers(fieldId).find(value => value.validated === true);
  if (!answer) return null;
  const source = fieldId === "delay-lumen"
    ? LUMEN_SOURCES[captainOutcome === "rescued" ? "rescued" : "lost"]
    : { ids: ["sanctuary-preserved-originals"], pages: [] };
  return freeze({ ...answer, sourceRecordIds: [...source.ids], sourcePages: [...source.pages] });
}

function returnRecordTargets() {
  const positions = freeze([
    ["vanguard-return-state", 480, 520],
    ["core-division-cause", 1080, 420],
    ["delay-roan", 1680, 520],
    ["delay-sera", 480, 1120],
    ["delay-garen", 1080, 1220],
    ["delay-lumen", 1680, 1120],
  ]);
  return positions.map(([fieldId, x, y]) => {
    const definition = RETURN_RECORD_FIELD_DEFINITIONS[fieldId];
    return target(
      "sanctuary-record-field",
      fieldId,
      "sanctuary-return-record",
      x,
      y,
      `F · ${definition.label} 기록 검증`,
      [`${definition.label}에 맞는 보존 근거를 선택한다.`],
      {
        fieldId,
        title: definition.label,
        answers: recordFieldAnswers(fieldId),
        sourceByCaptainOutcome: fieldId === "delay-lumen" ? LUMEN_SOURCES : null,
        visualVariant: fieldId === "core-division-cause" ? "grave" : "hand",
      },
    );
  });
}

function correctionConsoleTarget() {
  return [target(
    "sanctuary-correction-link",
    "correction-link-console",
    "sanctuary-return-record",
    1080,
    820,
    "F · 보존 후 정정 연결",
    ["삭제 로그를 지우지 않고 여섯 책임 기록과 두 원본 근거를 정정 링크로 잇는다."],
    { visualVariant: "architecture" },
  )];
}
function futureOpinionTargets() {
  const definitions = freeze({
    forest: {
      x: 520, y: 1080, prompt: "F · 숲의 증언 듣기",
      pages: ["로안의 기록은 기억을 가두는 일과 지키는 일 사이에 남을 책임을 묻는다."],
    },
    coast: {
      x: 1080, y: 880, prompt: "F · 해안의 증언 듣기",
      pages: ["세라의 신호는 이름을 돌려주는 일이 과거를 되풀이하는 일은 아니라고 증언한다."],
    },
    volcano: {
      x: 1640, y: 1080, prompt: "F · 화산의 증언 듣기",
      pages: ["가렌의 기록은 흉터와 후유증까지 남긴 진실만이 해방을 감당할 수 있다고 증언한다."],
    },
  });
  return TESTIMONY_IDS.map(testimonyId => target(
    "sanctuary-testimony",
    `future-testimony-${testimonyId}`,
    "sanctuary-three-futures",
    definitions[testimonyId].x,
    definitions[testimonyId].y,
    definitions[testimonyId].prompt,
    definitions[testimonyId].pages,
    { testimonyId, visualVariant: "silhouette" },
  ));
}

function futurePreviewTargets() {
  const positions = freeze({
    seal: { x: 520, y: 560, label: "봉인" },
    restore: { x: 1080, y: 420, label: "복원" },
    release: { x: 1640, y: 560, label: "해방" },
  });
  return FUTURE_IDS.map(futureId => target(
    "sanctuary-future-preview",
    `future-preview-${futureId}`,
    "sanctuary-three-futures",
    positions[futureId].x,
    positions[futureId].y,
    `F · ${positions[futureId].label}의 미래 보기`,
    [...SANCTUARY_ENDINGS[futureId].pages],
    { futureId, visualVariant: "light" },
  ));
}

function endingConsoleTarget() {
  return [target(
    "sanctuary-ending-console",
    "sanctuary-ending-console",
    "sanctuary-three-futures",
    1080,
    1280,
    "F · 남겨진 기억의 운명 정하기",
    ["세 미래를 모두 확인했다. 선택은 한 번 기록되면 다른 미래로 덮어쓸 수 없다."],
    { visualVariant: "architecture" },
  )];
}

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
  const chapter = worldProgress?.chapters?.sanctuary;
  if (chapter?.coreTruthRevealed !== true) return [];
  const correction = createCorrectionArchiveRecord(chapter);
  return correction ? [...SANCTUARY_ARCHIVE_RECORDS, correction] : [...SANCTUARY_ARCHIVE_RECORDS];
}

export function createCorrectionArchiveRecord(chapter) {
  if (normalizeSanctuaryChapter(chapter).correctionLinked !== true) return null;
  return freeze({
    id: "sanctuary-correction-link",
    chapterId: "sanctuary",
    recordKind: "correction",
    correctsRecordId: "first-archivist-deletion-log",
    evidenceRecordIds: ["core-self-division-original", "false-return-resonance-time"],
    title: "보존 후 정정된 마지막 귀환 기록",
    pages: ["기존 기록을 보존한 채 여섯 책임 기록과 원본 근거를 연결했다."],
  });
}

function objective(id, label, mapId, interactionIds = []) {
  return freeze({ id, label, mapId, interactionIds });
}

export function getSanctuaryChapterObjective(worldProgress) {
  const sanctuary = worldProgress?.chapters?.sanctuary || {};
  const activated = sanctuary.activatedCoreIds || [];
  const memories = sanctuary.collectedMemoryIds || [];
  if (!SANCTUARY_CORE_IDS.every(id => activated.includes(id))) {
    return objective("activate-three-cores", "세 코어 조각을 성역 석관에 안치한다.", "sanctuary", SANCTUARY_CORE_IDS);
  }
  if (!MEMORY_SOUND_IDS.every(id => memories.includes(id))) {
    return objective("collect-four-sounds", "기억 회랑의 네 소리를 수집한다.", "sanctuary-memory-archive", MEMORY_SOUND_IDS);
  }
  if (!sanctuary.memoryOrderSolved) {
    return objective("restore-memory-order", "네 소리를 기억의 순서대로 배열한다.", "sanctuary-memory-archive", ["memory-sequence-console"]);
  }
  if (!sanctuary.coreTruthRevealed) {
    return objective("restore-three-originals", "세 보존 원본을 대조해 코어의 진실을 복원한다.", "sanctuary-memory-archive", [
      "truth-resonance-time", "truth-first-archivist-log", "truth-core-self-division",
    ]);
  }
  if (!sanctuary.falseReturnRejected) {
    return objective(
      "reject-false-return",
      "거짓 귀환 환영의 세 모순을 확인한다.",
      "sanctuary-memory-archive",
      FALSE_RETURN_CONTRADICTION_IDS,
    );
  }
  const completedFields = sanctuary.completedRecordFieldIds || [];
  if (!RECORD_FIELD_IDS.every(id => completedFields.includes(id))) {
    return objective(
      "complete-six-fields",
      "여섯 책임 기록을 보존 근거로 검증한다.",
      "sanctuary-return-record",
      RECORD_FIELD_IDS,
    );
  }
  if (!sanctuary.correctionLinked) {
    return objective(
      "link-correction",
      "원본을 보존한 채 마지막 귀환 기록의 정정 링크를 만든다.",
      "sanctuary-return-record",
      ["correction-link-console"],
    );
  }
  if (!sanctuary.chorusSeparated) {
    return objective("separate-chorus", "무명의 합창에서 기억들을 분리한다.", "sanctuary-return-record");
  }
  const testimonies = sanctuary.collectedTestimonyIds || [];
  if (!TESTIMONY_IDS.every(id => testimonies.includes(id))) {
    return objective(
      "collect-three-testimonies",
      "세 지역에 남은 증언을 듣는다.",
      "sanctuary-three-futures",
      TESTIMONY_IDS.map(id => `future-testimony-${id}`),
    );
  }
  const previews = sanctuary.previewedFutureIds || [];
  if (!FUTURE_IDS.every(id => previews.includes(id))) {
    return objective(
      "preview-three-futures",
      "봉인·복원·해방의 미래를 모두 확인한다.",
      "sanctuary-three-futures",
      FUTURE_IDS.map(id => `future-preview-${id}`),
    );
  }
  if (!sanctuary.endingChoice) {
    return objective(
      "choose-future",
      "남겨진 기억의 운명을 정한다.",
      "sanctuary-three-futures",
      ["sanctuary-ending-console"],
    );
  }
  return objective(
    "sanctuary-ending-recorded",
    "선택한 미래가 기록되었다.",
    "sanctuary-three-futures",
    ["sanctuary-ending-console"],
  );
}
