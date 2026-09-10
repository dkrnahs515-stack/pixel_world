function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function storyTarget(type, id, mapId, x, y, name, prompt, pages, extra = {}) {
  return freeze({
    id,
    interactionId: id,
    chapterId: "sanctuary",
    type,
    mapId,
    x,
    y,
    name,
    interactionRadius: 110,
    prompt,
    pages,
    ...extra,
  });
}

export const SANCTUARY_RESONANCE_NODES = freeze([
  storyTarget(
    "sanctuary-resonance",
    "life-resonance",
    "sanctuary-resonance-hall",
    520,
    700,
    "생명의 공명",
    "F · 생명의 관리자 권한 공명",
    [
      "태고의 숲의 생명 코드가 회랑에 겹쳐 보인다.",
      "뿌리와 변이 생명체의 잔상이 하나의 관리자 신호로 수렴한다.",
    ],
  ),
  storyTarget(
    "sanctuary-resonance",
    "memory-resonance",
    "sanctuary-resonance-hall",
    1080,
    940,
    "기억의 공명",
    "F · 기억의 관리자 권한 공명",
    [
      "푸른 해안의 통신 파편이 시간 순서대로 다시 배열된다.",
      "왜곡되었던 기록이 하나의 기억 관리자 신호로 수렴한다.",
    ],
  ),
  storyTarget(
    "sanctuary-resonance",
    "energy-resonance",
    "sanctuary-resonance-hall",
    1640,
    700,
    "에너지의 공명",
    "F · 에너지 관리자 권한 공명",
    [
      "활화산의 분화 에너지가 붉은 격자로 재현된다.",
      "폭주하던 제어 코드가 하나의 에너지 관리자 신호로 수렴한다.",
    ],
  ),
]);

export const SANCTUARY_ARCHIVES = freeze([
  storyTarget(
    "sanctuary-archive",
    "archive-aren-split",
    "sanctuary-origin-archive",
    1080,
    520,
    "원점 기록 · 최초 분할",
    "F · 아렌의 최초 기록 복원",
    [
      "젊은 아렌: 코어가 세계 전체를 한 번에 다시 쓰지 못하도록 권한을 나눈다.",
      "생명·기억·에너지. 세 관리자 권한을 서로 다른 지역에 봉인한다.",
    ],
    { order: 0, speaker: "아렌" },
  ),
  storyTarget(
    "sanctuary-archive",
    "archive-vanguard-entry",
    "sanctuary-origin-archive",
    1080,
    900,
    "원점 기록 · 선발대 재진입",
    "F · 선발대 성역 기록 복원",
    [
      "선발대는 수년 뒤 불안정해진 픽셀 코어의 원인을 조사하기 위해 성역에 재진입했다.",
      "성역 붕괴가 시작되자 대원들의 퇴로가 먼저 끊겼다.",
    ],
    { order: 1, speaker: "선발대 기록" },
  ),
  storyTarget(
    "sanctuary-archive",
    "archive-defense-protocol",
    "sanctuary-origin-archive",
    1080,
    1260,
    "원점 기록 · 방어 프로토콜",
    "F · 최종 방어 기록 복원",
    [
      "선발대장의 긴급 접근 직후 코어는 관리자 권한 탈취 시도를 감지했다.",
      "최종 방어 프로토콜이 세 권한을 각 지역으로 밀어내며 숲·해안·활화산의 폭주가 시작됐다.",
    ],
    { order: 2, speaker: "ORIGIN 기록" },
  ),
]);

export const SANCTUARY_ORIGIN_RECORDS = freeze([
  storyTarget(
    "sanctuary-origin-record",
    "origin-record-single-authority",
    "sanctuary-resonance-hall",
    1700,
    420,
    "원점 기록 1 · 단일 권한",
    "F · 숨겨진 원점 기록 확인",
    ["한 사람이 모든 권한을 가지면 세계는 한 사람의 판단에 종속된다."],
    { optional: true, principle: "single-authority" },
  ),
  storyTarget(
    "sanctuary-origin-record",
    "origin-record-sealed-recovery",
    "sanctuary-origin-archive",
    420,
    360,
    "원점 기록 2 · 완전 봉인",
    "F · 숨겨진 원점 기록 확인",
    ["권한을 완전히 끊으면 세계는 스스로 회복할 수 없다."],
    { optional: true, principle: "sealed-recovery" },
  ),
  storyTarget(
    "sanctuary-origin-record",
    "origin-record-mutual-validation",
    "sanctuary-zero-boundary",
    1080,
    720,
    "원점 기록 3 · 상호 검증",
    "F · 숨겨진 원점 기록 확인",
    ["서로 다른 권한이 서로를 확인할 때 오류는 명령이 아니라 대화가 된다."],
    { optional: true, principle: "mutual-validation" },
  ),
]);

export const SANCTUARY_STORY_INTERACTIONS = freeze([
  ...SANCTUARY_RESONANCE_NODES,
  ...SANCTUARY_ARCHIVES,
  ...SANCTUARY_ORIGIN_RECORDS,
]);

export const SANCTUARY_STORY_ACTORS = freeze([
  {
    id: "origin-system",
    name: "ORIGIN",
    role: "core-defense-system",
    placements: [
      { mapId: "sanctuary-origin-archive", x: 1080, y: 900 },
      { mapId: "sanctuary-core-heart", x: 1080, y: 700 },
    ],
    pages: ["ORIGIN: 관리자 권한의 접근 기록을 복원합니다."],
  },
]);

export function getOriginRecords(worldProgress) {
  const ids = new Set(worldProgress?.chapters?.sanctuary?.originRecordIds || []);
  return SANCTUARY_ORIGIN_RECORDS.filter(record => ids.has(record.id));
}
