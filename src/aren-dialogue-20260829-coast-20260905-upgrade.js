import { ADVENTURE_QUEST } from "./quest-state-20260829-coast-20260905-upgrade.js";

const CLOSE_ACTION = "close";

const COAST_RETURN_REACTIONS = Object.freeze({
  sera: "세라의 결단을 믿었군요. 그 신뢰가 구조의 마지막 길을 열었습니다.",
  echo: "에코의 목소리를 사람의 뜻으로 받아들였군요. 기록도 이제 우리 역사의 일부입니다.",
  mari: "마리의 판단을 따랐군요. 모두를 데려오려는 선택이 해안을 다시 이었습니다.",
});

function withCoastReturnReaction(progress, model) {
  const worldProgress = progress?.worldProgress;
  const coast = worldProgress?.chapters?.coast;
  const reaction = worldProgress?.completedRegionIds?.includes("coast")
    && coast?.coreFragmentObtained === true
    ? COAST_RETURN_REACTIONS[coast.supportChoice]
    : null;
  return reaction ? { ...model, body: `${model.body}\n\n${reaction}` } : model;
}

export function arenDialogueModel(progress) {
  const quest = progress.quests[ADVENTURE_QUEST.id];

  switch (quest.status) {
    case "available":
      return withCoastReturnReaction(progress, {
        title: "현자 아렌",
        body: "외부 지역의 슬라임 세 마리를 처치해 주세요.",
        action: "accept",
        actionLabel: "퀘스트 수락",
      });
    case "active":
      return withCoastReturnReaction(progress, {
        title: "현자 아렌",
        body: `슬라임 처치 진행 상황: ${quest.progress}/${ADVENTURE_QUEST.required}`,
        action: CLOSE_ACTION,
        actionLabel: "대화 마치기",
      });
    case "ready_to_report":
      return withCoastReturnReaction(progress, {
        title: "현자 아렌",
        body: "슬라임 세 마리를 모두 처치했군요. 이제 임무를 보고하세요.",
        action: "complete",
        actionLabel: "완료 보고",
      });
    default:
      return withCoastReturnReaction(progress, {
        title: "현자 아렌",
        body: "훌륭합니다. 계속해서 모험가로서 성장해 나가세요.",
        action: CLOSE_ACTION,
        actionLabel: "대화 마치기",
      });
  }
}
