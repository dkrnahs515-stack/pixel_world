import test from "node:test";
import assert from "node:assert/strict";
import {
  SANCTUARY_ENDING_CHOICES,
  availableSanctuaryEndings,
  chooseSanctuaryEnding,
  grantSanctuaryEndingReward,
  sanctuaryEndingTitle,
} from "../src/sanctuary-ending-state-20260910-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";
import {
  originDefeatedProgress,
  resonanceReadyProgress,
} from "./helpers/sanctuary-fixtures.mjs";

function playerWithWorld(worldProgress, overrides = {}) {
  return {
    ...createInitialProgress(),
    ...overrides,
    worldProgress,
  };
}

test("ending ids and title mapping are exact", () => {
  assert.deepEqual(SANCTUARY_ENDING_CHOICES, ["restore", "seal", "resonate"]);
  assert.equal(sanctuaryEndingTitle("restore"), "세계의 복원자");
  assert.equal(sanctuaryEndingTitle("seal"), "코어의 수호자");
  assert.equal(sanctuaryEndingTitle("resonate"), "세계의 공명자");
  assert.equal(sanctuaryEndingTitle("unknown"), null);
});

test("only resonate requires all three origin records", () => {
  const progress = playerWithWorld(originDefeatedProgress({ originRecordIds: [] }));
  const choices = availableSanctuaryEndings(progress);
  assert.deepEqual(choices, [
    { id: "restore", unlocked: true, reason: null },
    { id: "seal", unlocked: true, reason: null },
    { id: "resonate", unlocked: false, reason: "origin_records_3_required" },
  ]);
});

test("resonate unlocks at exactly three origin records", () => {
  const progress = playerWithWorld(resonanceReadyProgress());
  assert.equal(availableSanctuaryEndings(progress).find(value => value.id === "resonate").unlocked, true);
});

test("ending cannot be chosen before ORIGIN defeat", () => {
  const progress = createInitialProgress();
  const result = chooseSanctuaryEnding(progress, "restore");
  assert.equal(result.changed, false);
  assert.equal(result.reason, "origin_not_defeated");
});

test("first confirmed ending is permanent", () => {
  const progress = playerWithWorld(resonanceReadyProgress());
  const first = chooseSanctuaryEnding(progress, "resonate");
  assert.equal(first.changed, true);
  assert.equal(first.progress.worldProgress.chapters.sanctuary.endingChoice, "resonate");
  const second = chooseSanctuaryEnding(first.progress, "restore");
  assert.equal(second.changed, false);
  assert.equal(second.reason, "ending_already_chosen");
  assert.equal(second.progress.worldProgress.chapters.sanctuary.endingChoice, "resonate");
});

test("locked resonate choice does not mutate progress", () => {
  const progress = playerWithWorld(originDefeatedProgress({ originRecordIds: [] }));
  const result = chooseSanctuaryEnding(progress, "resonate");
  assert.equal(result.changed, false);
  assert.equal(result.reason, "origin_records_3_required");
  assert.equal(result.progress.worldProgress.chapters.sanctuary.endingChoice, null);
});

test("ending reward grants exactly 500 EXP and 1000 Gold once", () => {
  const progress = playerWithWorld(resonanceReadyProgress(), {
    level: 1,
    exp: 90,
    nextLevelExp: 100,
    gold: 250,
  });
  const chosen = chooseSanctuaryEnding(progress, "resonate").progress;
  const once = grantSanctuaryEndingReward(chosen);
  assert.equal(once.changed, true);
  assert.equal(once.progress.gold, 1250);
  assert.equal(once.progress.level, 3);
  assert.equal(once.progress.exp, 290);
  assert.equal(once.progress.nextLevelExp, 300);
  assert.equal(once.progress.endingTitle, "세계의 공명자");
  assert.equal(once.progress.worldProgress.chapters.sanctuary.endingRewardClaimed, true);
  assert.equal(once.progress.worldProgress.chapters.sanctuary.chapterCompleted, true);
  assert.equal(once.progress.worldProgress.completedRegionIds.includes("sanctuary"), true);

  const twice = grantSanctuaryEndingReward(once.progress);
  assert.equal(twice.changed, false);
  assert.equal(twice.reason, "reward_already_claimed");
  assert.equal(twice.progress.gold, 1250);
  assert.equal(twice.progress.exp, 290);
});

test("reward requires a confirmed ending", () => {
  const progress = playerWithWorld(originDefeatedProgress());
  const result = grantSanctuaryEndingReward(progress);
  assert.equal(result.changed, false);
  assert.equal(result.reason, "ending_not_chosen");
});
