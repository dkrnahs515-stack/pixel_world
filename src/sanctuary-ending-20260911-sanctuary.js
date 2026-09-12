import { grantProgressReward } from "./player-progression-20260905-upgrade-20260911-sanctuary.js";

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export const SANCTUARY_ENDINGS = freeze({
  seal: {
    sceneId: "sanctuary-seal-vigil",
    titleId: "sanctuary-title-seal",
    title: "봉인의 계승자",
    echoState: "sealed-survivor",
    pages: [
      "세 코어 조각은 하나의 문이 아니라 서로를 감시하는 세 개의 봉인이 된다.",
      "에코는 봉인 안에서 살아남아, 지워질 기록이 생길 때마다 낮은 공명으로 기록관을 부른다.",
    ],
    lastLine: "우리는 지워지지 않도록, 문을 지키기로 했다.",
  },
  restore: {
    sceneId: "sanctuary-name-restoration",
    titleId: "sanctuary-title-restore",
    title: "이름의 복원자",
    echoState: "named-dissolution",
    pages: [
      "분리된 기억들은 보존 원본과 정정 기록을 따라 각자의 이름을 되찾는다.",
      "에코라는 임시 이름은 흩어지지만, 그 안에 섞였던 목소리들은 다시 불릴 자리를 얻는다.",
    ],
    lastLine: "돌아온 것은 과거가 아니라, 다시 불릴 수 있는 이름이었다.",
  },
  release: {
    sceneId: "sanctuary-echo-release",
    titleId: "sanctuary-title-release",
    title: "해방의 기록자",
    echoState: "own-voice",
    pages: [
      "기록관의 문이 열리고, 분리된 기억들은 어느 코어에도 귀속되지 않은 채 새벽으로 흘러간다.",
      "남기로 한 한 줄기의 공명은 빌린 증언을 내려놓고 스스로 에코라는 이름을 선택한다.",
    ],
    lastLine: "에코는 처음으로 누구의 것도 아닌 목소리로 작별을 말했다.",
  },
});

export const SANCTUARY_TITLE_IDS = Object.freeze([
  "sanctuary-title-seal",
  "sanctuary-title-restore",
  "sanctuary-title-release",
]);

export const SANCTUARY_REWARD_COMPONENT_IDS = Object.freeze(
  ["seal", "restore", "release"].flatMap(choice => [
    `sanctuary-ending-${choice}-exp`,
    `sanctuary-ending-${choice}-gold`,
    `sanctuary-ending-${choice}-title`,
  ]),
);

function endingFor(choice) {
  return typeof choice === "string" && Object.hasOwn(SANCTUARY_ENDINGS, choice)
    ? SANCTUARY_ENDINGS[choice]
    : null;
}

function rewardComponentIds(choice) {
  return ["exp", "gold", "title"].map(component => `sanctuary-ending-${choice}-${component}`);
}

function claimedIds(progress) {
  return Array.isArray(progress?.claimedNarrativeRewardIds)
    ? [...new Set(progress.claimedNarrativeRewardIds.filter(id => typeof id === "string"))]
    : [];
}

export function getEndingPreview(choice, captainOutcome) {
  const ending = endingFor(choice);
  if (!ending) return null;
  const captain = captainOutcome === "rescued"
    ? "가렌은 화산의 흉터와 만성 후유증을 안은 채, 살아서 선택의 증인이 된다."
    : "가렌이 남긴 화산 기록은 흉터와 만성 후유증까지 숨기지 않은 증언으로 보존된다.";
  return freeze({
    choice,
    sceneId: ending.sceneId,
    titleId: ending.titleId,
    title: ending.title,
    echoState: ending.echoState,
    captainOutcome: captainOutcome === "rescued" ? "rescued" : "lost",
    garen: { scarred: true, chronicAftereffect: true },
    pages: [...ending.pages, captain],
    lastLine: ending.lastLine,
  });
}

export function missingSanctuaryRewardComponents(progress, choice) {
  const ending = endingFor(choice);
  if (!ending || progress?.worldProgress?.chapters?.sanctuary?.endingChoice !== choice) return [];
  const claimed = claimedIds(progress);
  return rewardComponentIds(choice).filter(id => !claimed.includes(id));
}

function unchangedRewardResult(progress, choice, reason) {
  const ending = endingFor(choice);
  return {
    ok: false,
    reason,
    progress,
    rewardExp: 0,
    rewardGold: 0,
    levelsGained: 0,
    titleGranted: false,
    titleId: ending?.titleId ?? null,
    title: ending?.title ?? null,
    echoState: ending?.echoState ?? null,
  };
}

export function grantSanctuaryEndingReward(progress, choice, options = {}) {
  const ending = endingFor(choice);
  if (!ending) return unchangedRewardResult(progress, choice, "invalid_ending_choice");
  if (progress?.worldProgress?.chapters?.sanctuary?.endingChoice !== choice) {
    return unchangedRewardResult(progress, choice, "ending_choice_locked");
  }

  const allIds = rewardComponentIds(choice);
  const requestedIds = Array.isArray(options.componentIds)
    ? new Set(options.componentIds.filter(id => allIds.includes(id)))
    : new Set(allIds);
  const claimed = claimedIds(progress);
  let next = progress;
  let rewardExp = 0;
  let rewardGold = 0;
  let levelsGained = 0;
  let titleGranted = false;

  for (const componentId of allIds) {
    if (claimed.includes(componentId) || !requestedIds.has(componentId)) continue;
    if (componentId.endsWith("-exp")) {
      const rewarded = grantProgressReward(next, { exp: 300 });
      next = rewarded.progress;
      rewardExp = 300;
      levelsGained += rewarded.levelsGained;
    } else if (componentId.endsWith("-gold")) {
      next = grantProgressReward(next, { gold: 200 }).progress;
      rewardGold = 200;
    } else {
      const earnedTitleIds = Array.isArray(next.earnedTitleIds) ? next.earnedTitleIds : [];
      next = {
        ...next,
        earnedTitleIds: earnedTitleIds.includes(ending.titleId)
          ? [...earnedTitleIds]
          : [...earnedTitleIds, ending.titleId],
      };
      titleGranted = true;
    }
    claimed.push(componentId);
    next = { ...next, claimedNarrativeRewardIds: [...claimed] };
  }

  return {
    ok: true,
    reason: null,
    progress: next,
    rewardExp,
    rewardGold,
    levelsGained,
    titleGranted,
    titleId: ending.titleId,
    title: ending.title,
    echoState: ending.echoState,
    missingComponentIds: missingSanctuaryRewardComponents(next, choice),
  };
}
