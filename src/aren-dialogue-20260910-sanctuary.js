import { ADVENTURE_QUEST } from "./quest-state-20260910-sanctuary.js";

const CLOSE_ACTION = "close";

const COAST_RETURN_REACTIONS = Object.freeze({
  sera: "세라의 결단을 믿었군요. 그 신뢰가 구조의 마지막 길을 열었습니다.",
  echo: "에코의 목소리를 사람의 뜻으로 받아들였군요. 기록도 이제 우리 역사의 일부입니다.",
  mari: "마리의 판단을 따랐군요. 모두를 데려오려는 선택이 해안을 다시 이었습니다.",
});

const FIRST_MEETING_BODY = [
  "눈을 떴구려, 낯선 방랑자여. 성역 쪽에서 이상한 빛이 번쩍인 뒤 자네가 초원 가장자리에 쓰러져 있는 걸 발견했네. 그래서 이곳 중앙 초원으로 옮겨 두었지.",
  "하늘을 한번 보게. 공기 중에 떠다니는 저 부서진 픽셀 파편들이 보이나? 대륙의 형태를 붙들고 있던 픽셀 코어에 이상이 생긴 뒤부터 저런 흔적이 곳곳에서 나타나고 있네.",
  "사람들은 코어가 셋으로 갈라져 태고의 숲, 푸른 해안, 활화산에 흩어졌다고 믿고 있지. 그 뒤로 숲의 생명은 뒤틀리고, 해안의 기록은 깨지고, 화산의 에너지는 폭주하기 시작했네. 하지만 나는 이 모든 일이 단순한 폭주 때문만은 아니라고 생각하네.",
  "자, 이 장비를 쥐게나. 조촐한 시작 장비에 불과하지만 자네에게서 성역의 코어와 공명하는 미약한 파동이 느껴지는군.",
  "먼저 연금술사 미아에게 물약 사용법을 확인하고, 대장장이 브란에게 앞으로 사용할 장비를 살펴보게. 그리고 준비가 되면 외부 지역의 슬라임 세 마리를 정리해 주게. 태고의 숲의 왜곡이 더 심해지기 전에 자네가 코어의 반응을 견딜 수 있는지부터 확인해야겠네.",
  "남쪽 푸른 해안에서는 코어 연구원 세라의 조난 신호도 간헐적으로 잡히고 있네. 하지만 그곳으로 가는 길은 태고의 숲의 왜곡을 먼저 잠재워야 열릴 걸세. 서두르되 순서를 잊지 말게. 자네의 여정이 결국 이 세계의 형태를 결정하게 될지도 모르니.",
].join("\n\n");

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
        body: FIRST_MEETING_BODY,
        action: "accept",
        actionLabel: "[모험의 시작] 임무 수락",
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
