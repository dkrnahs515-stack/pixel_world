export const POST_CREDIT_LINES = Object.freeze([
  "UNKNOWN NODE SIGNAL DETECTED",
  "SOURCE: OUTSIDE CORE RANGE",
]);

const ENDINGS = Object.freeze({
  restore: Object.freeze({ endingTitle: "원래의 세계", rewardTitle: "세계의 복원자", protocol: "RESTORE" }),
  seal: Object.freeze({ endingTitle: "지켜낸 현재", rewardTitle: "코어의 수호자", protocol: "SEAL" }),
  resonate: Object.freeze({ endingTitle: "새로운 세계", rewardTitle: "세계의 공명자", protocol: "RESONANCE" }),
});

function frame(speaker, text, extra = {}) {
  return Object.freeze({ speaker, text, ...extra });
}

function branchCaptain(choice, outcome) {
  if (outcome === "rescued") {
    if (choice === "restore") {
      return [frame("선발대장", "되돌릴 수 없는 것도 있을 거다. 우리가 했던 일도. 잃은 것들도. 그렇지만…… 이번에는 누군가의 실수를 덮기 위해 코어를 움직인 게 아니군. 앞으로 나아가기 위해 움직였어. 그거면 됐다.")];
    }
    if (choice === "seal") {
      return [frame("선발대장", "이번에는 누구도 다른 사람을 대신해서 결정하지 않았군. 아렌도 아니고. 나도 아니고. 코어도 아니야. 불완전해도…… 우리가 직접 지킬 수 있다면. 그걸로 충분하다.")];
    }
    return [frame("선발대장", "끝까지 살아서 이걸 보게 될 줄은 몰랐군. 우리는 코어한테 명령하려다가 실패했다. 아렌은 코어를 통제하려 했고. 나도 결국 똑같은 짓을 했지. 그런데 넌…… 코어에게 함께 선택하는 방법을 가르친 셈이군.")];
  }
  if (outcome === "lost") {
    return [frame("선발대장 기록", "누군가 여기까지 온다면…… 우리가 실패한 이유만은 기억해 줘. 코어보다 무서웠던 건…… 우리가 정답을 알고 있다고 믿었던 거니까.")];
  }
  return [];
}

function resonateSupport(choice) {
  if (choice === "sera") {
    return [frame("세라", "기록보다 중요한 건 결국 여기 남은 사람들이겠지. 이번에는…… 세계가 사람의 목소리를 듣게 된 것 같아.")];
  }
  if (choice === "echo") {
    return [frame("에코", "데이터 충돌 없음. 기록 삭제 없음. 서로 다른 정보의 동시 존재…… 정상 상태로 판정합니다. 서로 다른 진실이 동시에 존재할 수 있다는 결과를 확인했습니다.")];
  }
  if (choice === "mari") {
    return [frame("마리", "완벽한 답은 아닐지도 몰라. 그래도…… 지금까지 나온 답 중에서는 가장 오래 버틸 수 있을 것 같네.")];
  }
  return [];
}

const COMMON_INTRO = Object.freeze([
  frame("연출", "ORIGIN-0의 마지막 체력이 사라지는 순간 화면이 짧게 멈춘다. 수호자의 몸이 픽셀 조각으로 붕괴해 중앙 코어로 흡수되고, 세 코어 조각이 플레이어 주위를 회전한다."),
  frame("ORIGIN", "전투 종료."),
  frame("ORIGIN", "생명 관리자 권한 확인."),
  frame("ORIGIN", "기억 관리자 권한 확인."),
  frame("ORIGIN", "에너지 관리자 권한 확인."),
  frame("ORIGIN", "세 권한의 단일 사용자 귀속을 확인했습니다."),
  frame("ORIGIN", "최종 결정 권한을 이관합니다."),
  frame("기억 플래시", "젊은 아렌이 코어 앞에서 세 권한을 분리한다. 선발대장이 쓰러진 대원을 돌아보며 긴급 접속 장치를 작동한다. 숲·해안·활화산의 폭주와 플레이어가 세 조각을 회수한 장면이 연속해서 스친다."),
  frame("ORIGIN", "최초 관리자 아렌. 세계 재작성 권한을 분할했습니다."),
  frame("ORIGIN", "후속 접근자. 선발대장. 관리자 권한에 강제 접근했습니다. 방어 프로토콜이 작동했습니다."),
  frame("ORIGIN", "그리고 현재. 세 권한은 다시 한 사용자에게 모였습니다."),
  frame("ORIGIN", "세계룰 다시 쓸 수 있습니다. 세계를 봉인할 수 있습니다. 또는 새로운 규칙을 정의할 수 있습니다."),
]);

function restoreScenes(captainOutcome) {
  return Object.freeze([
    frame("선택 확인", "세 권한을 다시 하나로 합칩니다. 코어는 사건 이전의 안정 규칙으로 돌아갑니다. 지금의 세계에 남은 일부 변형도 함께 사라질 수 있습니다. 이 선택을 기록하시겠습니까?"),
    frame("연출", "플레이어가 세 조각을 중앙 코어 앞으로 보낸다. 세 조각이 하나의 흰 빛으로 합쳐지고 코어의 균열이 순서대로 메워진다."),
    frame("ORIGIN", "관리자 명령 확인. RESTORE. 복원 프로토콜을 시작합니다."),
    frame("태고의 숲", "폭주하던 거대한 뿌리가 움직임을 멈추고 생명 에너지가 숲으로 퍼진다. 연못의 물이 다시 맑아진다."),
    frame("푸른 해안", "통신소의 잡음이 끊기고 서로 다른 시간을 가리키던 기록 장치들이 같은 방향으로 움직인다. 파도 소리가 잔잔해진다."),
    frame("활화산", "화구에서 솟아오르던 붉은 에너지가 약해지고 분화 경고가 사라진다. 흔들리던 땅이 멈춘다."),
    frame("중앙 마을", "사람들이 하늘을 바라본다. 멀리 떠 있던 픽셀 균열이 천천히 닫힌다."),
    frame("아렌", "……끝났구나. 내가 시작했던 일을. 결국 네가 끝냈어."),
    frame("아렌", "예전의 나는 세계를 지키려면…… 내가 정답을 정해야 한다고 생각했다. 코어가 위험하다면 내가 나누고. 문제가 생기면 내가 고치고. 그게 세계를 지키는 방법이라고 믿었지."),
    frame("아렌", "하지만 마지막 선택은…… 내 것이 아니었구나."),
    frame("아렌", "네가 선택했기에. 이 세계는 다시 시작할 수 있다."),
    ...branchCaptain("restore", captainOutcome),
    frame("내레이션", "세계는 안정된 흐름을 되찾았다. 그러나 복원되었다는 것은 아무 일도 없었다는 뜻이 아니다. 상처는 남고. 기억도 남는다. 그리고 기억하는 사람이 있는 한, 선택의 흔적 역시 사라지지 않는다."),
    frame("ENDING", "원래의 세계"),
    frame("칭호 획득", "세계의 복원자"),
  ]);
}

function sealScenes(captainOutcome) {
  return Object.freeze([
    frame("선택 확인", "세 권한을 다시 합치지 않습니다. 지금 존재하는 세계를 유지한 채 코어의 일방적인 세계 재작성 권한을 봉인합니다. 세계는 완벽하게 과거로 돌아가지 않습니다. 이 선택을 기록하시겠습니까?"),
    frame("연출", "세 조각이 코어를 향해 이동하다 멈춘 뒤 서로 반대 방향으로 흩어진다. 심장부의 세 방향에서 기둥이 솟아오르고 각 기둥에 하나씩 조각이 자리 잡는다."),
    frame("ORIGIN", "관리자 명령 확인. SEAL. 세계 재작성 권한을 폐쇄합니다."),
    frame("태고의 숲", "거대한 변이 나무는 남지만 더 이상 주변 생명을 집어삼키지 않는다. 그 주변에서 새로운 식물이 자란다."),
    frame("푸른 해안", "과거의 통신 기록 일부는 남아 있지만 현재 통신과 더 이상 충돌하지 않는다."),
    frame("활화산", "용암은 계속 흐르고 화산도 남는다. 그러나 통제할 수 없던 폭주는 멈춘다."),
    frame("아렌", "완벽하게 고치지 않는 것도…… 선택이구나."),
    frame("아렌", "나는 늘 세계를 원래대로 돌려놓는 것만 생각했다. 원래 모습. 정상적인 상태. 틀리지 않은 답. ……하지만 지금 이 모습도. 이곳에서 살아온 사람들에게는 이미 세계겠지."),
    ...branchCaptain("seal", captainOutcome),
    frame("내레이션", "세계의 상처는 지워지지 않았다. 대신 그 상처가 다시 세계 전체를 삼키지 못하도록 문이 닫혔다. 사람들은 완벽하지 않은 현재를 자신들의 힘으로 지켜가기 시작했다. 고쳐진 세계가 아니라. 지켜내는 세계가 되었다."),
    frame("ENDING", "지켜낸 현재"),
    frame("칭호 획득", "코어의 수호자"),
  ]);
}

function resonateScenes(captainOutcome, supportChoice) {
  return Object.freeze([
    frame("선택 확인", "코어와 세 권한 어느 쪽에도 단독 명령권을 주지 않습니다. 서로가 서로를 승인해야만 세계를 바꿀 수 있는 새로운 규칙을 만듭니다. 세계는 과거의 상태로 돌아가지 않으며 지금까지의 변화도 남습니다. 이 선택을 기록하시겠습니까?"),
    frame("연출", "세 조각이 중앙의 코어로 이동하다 플레이어가 손을 뻗는 순간 멈춘다. 세 조각은 코어를 중심으로 삼각형을 만든다."),
    frame("원점 기록 1", "한 사람이 모든 권한을 가지면 세계는 한 사람의 판단에 종속된다."),
    frame("원점 기록 2", "권한을 완전히 끊으면 세계는 스스로 회복할 수 없다."),
    frame("원점 기록 3", "서로 다른 권한이 서로를 확인할 때 오류는 명령이 아니라 대화가 된다."),
    frame("연출", "생명에서 기억으로, 기억에서 에너지로, 에너지에서 생명으로 빛이 이어지고 세 조각 모두가 중앙 코어와 연결된다."),
    frame("ORIGIN", "…… 기존 관리자 계층과 일치하지 않는 명령입니다. 검증 중."),
    frame("ORIGIN", "단일 관리자. 없음. 최상위 단독 권한. 없음. 세 관리자 권한 상호 검증. 확인. 코어 재작성 권한 상호 승인 조건. 확인."),
    frame("ORIGIN", "새로운 프로토콜을 생성합니다."),
    frame("ORIGIN", "명령이 아니라…… 공명으로 전환합니다."),
    frame("태고의 숲", "변이된 생명체는 사라지지 않는다. 폭주하던 생명 코드는 안정되고 새로운 식물과 생명체가 자연스럽게 숲의 일부로 자리 잡는다."),
    frame("푸른 해안", "과거와 현재의 기록이 동시에 보이지만 서로를 덮어쓰지 않는다. 과거 기록은 역사로 남고 현재 통신은 계속된다."),
    frame("활화산", "붉은 코어 에너지가 용암의 흐름과 같은 박자로 움직인다. 화산은 살아 있지만 폭주는 안정적인 에너지 순환으로 바뀐다."),
    frame("아렌", "…… 코어가 세계를 지배하는 것도 아니고. 우리가 코어를 지배하는 것도 아니군. 서로 바뀔 수 있지만. 서로를 멈출 수도 있어. ……나는 왜 이 방법을 생각하지 못했을까."),
    ...resonateSupport(supportChoice),
    ...branchCaptain("resonate", captainOutcome),
    frame("아렌", "이제…… 이 세계에는 한 명의 관리자가 필요하지 않을지도 모르겠구나."),
    frame("내레이션", "세계는 과거로 돌아가지 않았다. 상처도. 변화도. 기억도 사라지지 않았다. 대신 서로 다른 힘이 하나의 답을 강요하지 않는 새로운 규칙이 시작되었다. 누군가가 세계를 결정하는 시대가 끝나고. 픽셀 월드는 처음으로 자신의 변화를 함께 선택하기 시작했다."),
    frame("ENDING", "새로운 세계"),
    frame("칭호 획득", "세계의 공명자"),
  ]);
}

function creditsFor(playerName, ending) {
  const safeName = String(playerName || "모험가").slice(0, 24);
  return Object.freeze({
    durationMs: 30_000,
    skipAfterMs: 5_000,
    lines: Object.freeze([
      "PIXEL WORLD",
      "제1부 · 부서진 코어",
      `모험가 ${safeName}`,
      ending.rewardTitle,
      "기획",
      "세계·시스템 설계",
      "전투·직업 설계",
      "스토리",
      "온라인 시스템",
      "플레이 테스트",
      "그리고",
      "이 세계의 마지막 결정을 내린 플레이어",
      safeName,
      "제1부 종료",
      "당신이 선택한 세계는 계속됩니다.",
    ]),
  });
}

export function sanctuaryEndingScript({ choice, captainOutcome = null, supportChoice = null, playerName = "모험가" } = {}) {
  const ending = ENDINGS[choice];
  if (!ending) return null;
  const scenes = choice === "restore"
    ? restoreScenes(captainOutcome)
    : choice === "seal"
      ? sealScenes(captainOutcome)
      : resonateScenes(captainOutcome, supportChoice);
  return Object.freeze({
    choice,
    protocol: ending.protocol,
    endingTitle: ending.endingTitle,
    rewardTitle: ending.rewardTitle,
    commonIntro: COMMON_INTRO,
    choiceConfirmation: scenes[0].text,
    scenes,
    credits: creditsFor(playerName, ending),
    postCredit: Object.freeze({
      durationMs: 2_000,
      lines: POST_CREDIT_LINES,
      strongerThirdPulse: choice === "resonate",
    }),
  });
}
