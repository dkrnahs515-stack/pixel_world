export const FIRST_JOURNEY_TIMING = Object.freeze({
  typingIntervalMs: 18,
  autoAdvanceDelayMs: 800,
});

const TAGLINE = "조각난 데이터의 대륙, 당신의 손끝에서 세계의 형태를 되찾습니다.";

function frame(id, kind, text, heading = null) {
  return Object.freeze({ id, kind, heading, text });
}

export const FIRST_JOURNEY_SCRIPT = Object.freeze({
  tagline: TAGLINE,
  frames: Object.freeze([
    frame(
      "system-world-error",
      "system",
      "대륙 전역에서 데이터 파편화가 감지되었습니다.",
      "[SYSTEM // WORLD DATA ERROR]",
    ),
    frame(
      "system-core-warning",
      "system",
      "픽셀 코어와의 연결이 끊어졌습니다.",
      "[WARNING // PIXEL CORE]",
    ),
    frame(
      "system-residual-signal",
      "system",
      "서로 다른 세 개의 코어 반응을 확인했습니다.",
      "[RECOVERY // RESIDUAL SIGNAL]",
    ),
    frame(
      "lore-core",
      "narration",
      "오랜 세월 대륙의 모든 형태와 생명을 유지해 온 중심부의 거대한 심장, 픽셀 코어.",
    ),
    frame(
      "lore-regions",
      "narration",
      "어느 날 성역에서 발생한 붕괴 이후, 태고의 숲과 푸른 해안, 활화산에서 서로 다른 세 개의 코어 반응이 나타났습니다. 사람들은 그것을 세 개의 코어 조각이라 부르기 시작했습니다.",
    ),
    frame(
      "lore-distortion",
      "narration",
      "그날부터 생명은 뒤틀리고, 기록은 깨지고, 에너지는 폭주했습니다. 대륙의 곳곳은 불안정한 데이터와 픽셀 파편에 잠식되기 시작했습니다.",
    ),
    frame(
      "lore-mystery",
      "narration",
      "하지만 코어가 왜 갈라졌는지, 그리고 누가 처음 코어에 손을 댔는지는 아직 아무도 알지 못합니다.",
    ),
    frame(
      "lore-goal",
      "narration",
      "지금까지 알려진 방법은 단 하나. 흩어진 세 개의 코어 조각을 찾아 성역에 도달하고, 그곳에서 이 세계를 되돌릴 방법을 찾는 것입니다.",
    ),
    frame(
      "lore-arrival",
      "narration",
      "그리고 지금— 성역에서 튕겨 나온 마지막 잔류 광자 하나가 중앙 초원에 닿았습니다.",
    ),
    frame("pixel-world-title", "title", TAGLINE, "PIXEL WORLD"),
  ]),
});
