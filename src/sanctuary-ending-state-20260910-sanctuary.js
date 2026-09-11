import {
  SANCTUARY_ORIGIN_RECORD_IDS,
  completeRegion,
  normalizeWorldProgress,
} from "./chapter-progress-20260910-sanctuary.js";
import { grantProgressReward } from "./player-progression-20260905-upgrade.js";

export const SANCTUARY_ENDING_CHOICES = Object.freeze([
  "restore",
  "seal",
  "resonate",
]);

const ENDING_TITLES = Object.freeze({
  restore: "세계의 복원자",
  seal: "코어의 수호자",
  resonate: "세계의 공명자",
});

function normalizedPlayerProgress(progress) {
  return {
    ...progress,
    worldProgress: normalizeWorldProgress(progress?.worldProgress),
  };
}

function sanctuaryState(progress) {
  return normalizeWorldProgress(progress?.worldProgress).chapters.sanctuary;
}

function originRecordCount(sanctuary) {
  const ids = new Set(Array.isArray(sanctuary?.originRecordIds) ? sanctuary.originRecordIds : []);
  return SANCTUARY_ORIGIN_RECORD_IDS.filter(id => ids.has(id)).length;
}

export function sanctuaryEndingTitle(choice) {
  return Object.hasOwn(ENDING_TITLES, choice) ? ENDING_TITLES[choice] : null;
}

export function availableSanctuaryEndings(progress) {
  const sanctuary = sanctuaryState(progress);
  const originReady = sanctuary.originDefeated === true;
  const resonateReady = originReady && originRecordCount(sanctuary) === SANCTUARY_ORIGIN_RECORD_IDS.length;
  return SANCTUARY_ENDING_CHOICES.map(id => ({
    id,
    unlocked: originReady && (id !== "resonate" || resonateReady),
    reason: !originReady
      ? "origin_not_defeated"
      : (id === "resonate" && !resonateReady ? "origin_records_3_required" : null),
  }));
}

export function chooseSanctuaryEnding(progress, choice) {
  const next = normalizedPlayerProgress(progress);
  const sanctuary = next.worldProgress.chapters.sanctuary;
  if (!SANCTUARY_ENDING_CHOICES.includes(choice)) {
    return { progress: next, changed: false, reason: "invalid_choice" };
  }
  if (!sanctuary.originDefeated) {
    return { progress: next, changed: false, reason: "origin_not_defeated" };
  }
  if (sanctuary.endingChoice) {
    return { progress: next, changed: false, reason: "ending_already_chosen" };
  }
  if (choice === "resonate" && originRecordCount(sanctuary) < SANCTUARY_ORIGIN_RECORD_IDS.length) {
    return { progress: next, changed: false, reason: "origin_records_3_required" };
  }

  next.worldProgress = normalizeWorldProgress({
    ...next.worldProgress,
    chapters: {
      ...next.worldProgress.chapters,
      sanctuary: {
        ...sanctuary,
        endingChoice: choice,
      },
    },
  });
  return { progress: next, changed: true, reason: null };
}

export function grantSanctuaryEndingReward(progress) {
  const next = normalizedPlayerProgress(progress);
  const sanctuary = next.worldProgress.chapters.sanctuary;
  if (!sanctuary.endingChoice) {
    return { progress: next, changed: false, reason: "ending_not_chosen" };
  }
  if (sanctuary.endingRewardClaimed) {
    return { progress: next, changed: false, reason: "reward_already_claimed" };
  }

  const title = sanctuaryEndingTitle(sanctuary.endingChoice);
  if (!title) {
    return { progress: next, changed: false, reason: "invalid_choice" };
  }

  const rewarded = grantProgressReward(next, { exp: 500, gold: 1000 }).progress;
  let worldProgress = normalizeWorldProgress({
    ...rewarded.worldProgress,
    chapters: {
      ...rewarded.worldProgress.chapters,
      sanctuary: {
        ...rewarded.worldProgress.chapters.sanctuary,
        endingRewardClaimed: true,
        chapterCompleted: true,
      },
    },
  });
  worldProgress = completeRegion(worldProgress, "sanctuary").progress;

  return {
    progress: {
      ...rewarded,
      endingTitle: title,
      worldProgress,
    },
    changed: true,
    reason: null,
  };
}
