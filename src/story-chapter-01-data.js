function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return Object.freeze(value);
}

export const STORY_SCENE_IDS = deepFreeze([
  "duty",
  "disposal-rule",
  "roster-items",
  "radio",
  "compass-compare",
  "time-compare",
  "case-submit",
  "hold-depart",
]);

export const STORY_CLUE_IDS = deepFreeze([
  "rule-five-years",
  "rule-no-life-signal",
  "rule-no-recovery",
  "roster-four-names",
  "recovered-radio",
  "empty-map-case",
  "replay-lengths",
  "new-received-at",
  "signal-warning",
  "metal-pattern",
  "main-compass-missing",
  "article-18-4",
]);

export const STORY_COMPARISON_IDS = deepFreeze([
  "metal-to-compass",
  "same-final-time",
]);

export const STORY_CLAIM_IDS = deepFreeze([
  "investigate-survival",
  "all-alive",
]);

export const CHAPTER_01 = deepFreeze({
  id: "chapter-01",
  title: "돌아오지 않은 이름들",
  facts: {
    receivedAt: "오늘 새벽 4시 52분",
    lastRecordAt: "5년 전 셋째 달 17일 4시 13분 22초",
    replaySeconds: [12, 11],
    metalPattern: [1, 2],
    missingNames: ["루멘", "로안", "세라", "가렌"],
  },
  result: "생존 여부 미확인. 폐기 보류.",
  art: {
    theo: {
      path: "./assets/chapter-01/01_제01장_고대 숲의 초보 궁수 테오.png",
      width: 1024,
      height: 1536,
      alt: "고대 숲을 배경으로 선 테오의 공식 삽화",
      description: "테오의 인물 소개를 위한 공식 삽화입니다. 숲은 인물 소개 배경입니다.",
    },
    returnedSignal: {
      path: "./assets/chapter-01/02_제01장_지워질 네 이름, 돌아온 신호.png",
      width: 1536,
      height: 1024,
      alt: "지워질 네 이름과 돌아온 신호를 담은 공식 삽화",
      description: "명부 폐기 보류와 태고의 숲 조사 임무가 정해진 뒤 공개되는 공식 삽화입니다.",
    },
  },
  scenes: {
    duty: {
      title: "첫 임무",
      copy: "정식 모험가가 된 첫날, 테오는 길드 기록실에서 실종자 명부 폐기 업무를 받는다.",
      document: "실종자 명부의 폐기 여부를 확인한다.",
      artId: "theo",
      requiredClueIds: [],
      requiredComparisonIds: [],
      hint: "폐기 기준부터 확인한다.",
    },
    "disposal-rule": {
      title: "폐기 기준 확인",
      copy: "규정 카드의 세 조건을 모두 확인해야 한다.",
      document: "실종 뒤 5년, 생존 신호 없음, 회수 가능성 없음.",
      requiredClueIds: ["rule-five-years", "rule-no-life-signal", "rule-no-recovery"],
      requiredComparisonIds: [],
      hint: "규정 카드의 세 조건을 모두 확인한다.",
    },
    "roster-items": {
      title: "명부와 회수품",
      copy: "루멘, 로안, 세라, 가렌의 명부와 회수품을 조사한다.",
      document: "부러진 선발대 공용 통신기와 로안의 빈 지도통이 회수품으로 남아 있다.",
      requiredClueIds: ["roster-four-names", "recovered-radio", "empty-map-case"],
      requiredComparisonIds: [],
      hint: "명부와 두 회수품을 모두 확인한다.",
    },
    radio: {
      title: "통신기 점검",
      copy: "폐기 전 최종 상태 확인 규정에 따라 통신기를 점검한다.",
      document: "첫 재생은 12초, 두 번째 재생은 11초다.",
      requiredClueIds: ["replay-lengths", "new-received-at", "signal-warning", "metal-pattern"],
      requiredComparisonIds: [],
      hint: "재생 기록, 새 수신, 경고, 금속음을 각각 확인한다.",
    },
    "compass-compare": {
      title: "나침반 소리 대조",
      copy: "출정 기록 0-1의 나침반 소리와 현재 금속음을 대조한다.",
      document: "로안의 주 나침반 덮개는 깨져 한 번, 두 번 부딪힌다.",
      requiredClueIds: ["metal-pattern", "main-compass-missing"],
      requiredComparisonIds: ["metal-to-compass"],
      hint: "주 나침반의 소리와 회수품 목록을 함께 대조한다.",
    },
    "time-compare": {
      title: "세 지역 기록 비교",
      copy: "태고의 숲, 푸른 해안, 활화산의 최종 보고 시각을 비교한다.",
      document: "세 기록의 마지막 시각은 모두 5년 전 셋째 달 17일 4시 13분 22초다.",
      requiredClueIds: [],
      requiredComparisonIds: ["same-final-time"],
      hint: "세 지역 기록의 마지막 시각을 대조한다.",
    },
    "case-submit": {
      title: "폐기 보류 근거 제출",
      copy: "새 수신, 나침반 소리의 대응, 현장기록 규정으로 폐기 보류 근거를 제출한다.",
      document: "이 자료는 재조사가 필요하다는 근거이며, 선발대 전원의 생존을 확정하지 않는다.",
      requiredClueIds: ["new-received-at", "article-18-4"],
      requiredComparisonIds: ["metal-to-compass", "same-final-time"],
      hint: "확정할 수 있는 범위의 근거만 제출한다.",
    },
    "hold-depart": {
      title: "폐기 보류와 숲 조사 임무",
      copy: "네 이름의 명부는 폐기 보류되고, 최소 인원의 태고의 숲 조사 임무가 편성된다.",
      document: "생존 여부 미확인. 폐기 보류.",
      artId: "returnedSignal",
      requiredClueIds: [],
      requiredComparisonIds: [],
      hint: "통신기의 태고의 숲 방향 표시와 조사 임무 조건을 확인한다.",
    },
  },
  clues: {
    "rule-five-years": {
      title: "실종 기간",
      document: "실종 뒤 5년.",
    },
    "rule-no-life-signal": {
      title: "생존 신호",
      document: "생존 신호 없음.",
    },
    "rule-no-recovery": {
      title: "회수 가능성",
      document: "회수 가능성 없음.",
    },
    "roster-four-names": {
      title: "실종자 명부",
      document: "루멘, 로안, 세라, 가렌.",
    },
    "recovered-radio": {
      title: "회수된 통신기",
      document: "부러진 선발대 공용 통신기.",
    },
    "empty-map-case": {
      title: "빈 지도통",
      document: "로안의 빈 지도통.",
    },
    "replay-lengths": {
      title: "재생 길이",
      document: "첫 재생 12초, 두 번째 재생 11초.",
    },
    "new-received-at": {
      title: "새 수신 기록",
      document: "오늘 새벽 4시 52분의 새 수신 기록.",
    },
    "signal-warning": {
      title: "신호의 경고",
      document: "우리가 남긴 길을 그대로 따라오지 마.",
    },
    "metal-pattern": {
      title: "금속음",
      document: "짧게 한 번, 이어서 두 번 울리는 금속음.",
    },
    "main-compass-missing": {
      title: "주 나침반 미회수",
      document: "로안의 주 나침반은 회수품 목록에 없다.",
    },
    "article-18-4": {
      title: "현장기록 규정",
      document: "“길드 현장기록 규정 제18조 4항. 실종자의 현재 생존 가능성을 나타내는 신호가 확인되면 폐기 절차를 중단하고, 최소 인원의 확인대를 편성한다.”",
    },
  },
  comparisons: {
    "metal-to-compass": {
      title: "금속음과 주 나침반",
      requiredClueIds: ["metal-pattern", "main-compass-missing"],
      result: "현재 신호가 로안과 관련되었을 가능성이 있어 재조사가 필요하다. 생존을 확정하지 않는다.",
    },
    "same-final-time": {
      title: "세 지역의 최종 시각",
      requiredClueIds: [],
      result: "태고의 숲, 푸른 해안, 활화산의 마지막 기록 시각이 모두 같다.",
    },
  },
  evidence: {
    "new-received-at": {
      source: "clue",
      sourceId: "new-received-at",
      label: "새벽의 새 수신 기록",
    },
    "metal-to-compass": {
      source: "comparison",
      sourceId: "metal-to-compass",
      label: "로안의 주 나침반 소리와의 대응",
    },
    "article-18-4": {
      source: "clue",
      sourceId: "article-18-4",
      label: "길드 현장기록 규정 제18조 4항",
    },
    "same-final-time": {
      source: "comparison",
      sourceId: "same-final-time",
      label: "세 지역의 동일한 최종 시각",
    },
  },
  claims: {
    "investigate-survival": {
      title: "생존 여부를 조사해야 한다",
      correct: true,
      requiredEvidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
      feedback: "새 수신과 대응 기록은 생존 여부를 재조사할 근거가 된다.",
    },
    "all-alive": {
      title: "선발대 전원이 살아 있다",
      correct: false,
      requiredEvidenceIds: [],
      feedback: "현재 자료는 선발대 전원의 생존을 확정하지 않습니다.",
    },
  },
  feedback: {
    incompletePrerequisites: "아직 확인할 자료가 남아 있습니다.",
    "investigate-survival": "새 수신과 대응 기록은 생존 여부를 재조사할 근거가 된다.",
    "all-alive": "현재 자료는 선발대 전원의 생존을 확정하지 않습니다.",
  },
});
