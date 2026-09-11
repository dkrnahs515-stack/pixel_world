import test from "node:test";
import assert from "node:assert/strict";
import { COAST_STORY_INTERACTIONS, getCoastStoryContent } from "../src/coast-story-data-20260829-coast-20260905-upgrade-20260911-sanctuary.js";
import {
  ALL_STORY_INTERACTIONS,
  findNearbyStoryInteraction,
  resolveStoryInteraction,
  storyInteractionPrompt,
} from "../src/story-interactions-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import {
  collectChapterRecord,
  completeRegion,
  createInitialWorldProgress,
  repairChapterDevice,
  progressSanctuary,
} from "../src/chapter-progress-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { SANCTUARY_STORY_INTERACTIONS } from "../src/sanctuary-story-data-20260911-sanctuary.js";

const WRECK_DEVICE_IDS = ["wreck-relay-west", "wreck-relay-deck", "wreck-relay-east"];
const WRECK_RECORD_IDS = [
  "wreck-record-sera",
  "wreck-record-roan",
  "wreck-record-garen",
  "wreck-record-vanguard-captain",
];

function unlockedBeachProgress() {
  return completeRegion(createInitialWorldProgress(), "forest").progress;
}

function floodedStationReady() {
  let progress = unlockedBeachProgress();
  progress = repairChapterDevice(progress, "coast-beach-transceiver").progress;
  progress = collectChapterRecord(progress, "sera-distress-current").progress;
  for (const id of WRECK_DEVICE_IDS) progress = repairChapterDevice(progress, id).progress;
  for (const id of WRECK_RECORD_IDS) progress = collectChapterRecord(progress, id).progress;
  progress = repairChapterDevice(progress, "flooded-station-main-transceiver").progress;
  return collectChapterRecord(progress, "flooded-station-deleted-record").progress;
}

test("the resolver finds the nearest eligible map-scoped story target and supplies its F prompt", () => {
  const interaction = findNearbyStoryInteraction(
    COAST_STORY_INTERACTIONS,
    { mapId: "coast-beach", x: 1128, y: 722 },
    unlockedBeachProgress(),
  );

  assert.equal(interaction.id, "coast-beach-transceiver");
  assert.equal(storyInteractionPrompt(interaction), "F · 통신 장치 복구");
  assert.equal(storyInteractionPrompt(null), "");
});

test("locked or already completed targets are excluded from nearby story interaction selection", () => {
  const locked = findNearbyStoryInteraction(
    COAST_STORY_INTERACTIONS,
    { mapId: "coast-flooded-station", x: 1080, y: 420 },
    unlockedBeachProgress(),
  );
  assert.equal(locked, null);

  const repaired = resolveStoryInteraction(unlockedBeachProgress(), "coast-beach-transceiver");
  const completed = findNearbyStoryInteraction(
    getCoastStoryContent("coast-beach").interactions,
    { mapId: "coast-beach", x: 1330, y: 820 },
    repaired.progress,
  );
  assert.equal(completed.id, "sera-distress-current");
});

test("incorrect signal classification is retryable and never loses the required record", () => {
  const before = unlockedBeachProgress();
  const wrong = resolveStoryInteraction(before, "sera-distress-current", { classification: "past" });

  assert.equal(wrong.outcome, "retryable");
  assert.equal(wrong.retryable, true);
  assert.notStrictEqual(wrong.progress, before);
  assert.deepEqual(wrong.progress, before);
  assert.deepEqual(wrong.effects, []);

  const correct = resolveStoryInteraction(before, "sera-distress-current", { classification: "current" });
  assert.equal(correct.outcome, "completed");
  assert.equal(correct.retryable, false);
  assert.deepEqual(correct.progress.chapters.coast.collectedRecordIds, ["sera-distress-current"]);
});

test("story resolution delegates immutable chapter transitions and all support choices retain the same cave gate", () => {
  const before = unlockedBeachProgress();
  const repaired = resolveStoryInteraction(before, "coast-beach-transceiver");
  assert.equal(repaired.outcome, "completed");
  assert.notStrictEqual(repaired.progress, before);
  assert.deepEqual(before.chapters.coast.repairedDeviceIds, []);

  for (const choice of ["sera", "echo", "mari"]) {
    const selected = resolveStoryInteraction(floodedStationReady(), "flooded-station-support", { choice });
    assert.equal(selected.outcome, "completed");
    assert.equal(selected.progress.chapters.coast.supportChoice, choice);
    assert.equal(selected.progress.unlockedMapIds.includes("coast-tide-core-cave"), true);
  }
});

test("the unified story list preserves coast order and appends sanctuary interactions", () => {
  assert.deepEqual(ALL_STORY_INTERACTIONS.slice(0, COAST_STORY_INTERACTIONS.length), COAST_STORY_INTERACTIONS);
  assert.deepEqual(ALL_STORY_INTERACTIONS.slice(-SANCTUARY_STORY_INTERACTIONS.length), SANCTUARY_STORY_INTERACTIONS);
});

test("completed core caskets disappear from nearby selection while memory sounds remain map scoped", () => {
  let progress = createInitialWorldProgress();
  const casket = SANCTUARY_STORY_INTERACTIONS.find(value => value.id === "forest-core-casket");
  assert.equal(findNearbyStoryInteraction(
    ALL_STORY_INTERACTIONS,
    { mapId: casket.mapId, x: casket.x, y: casket.y },
    progress,
  ).id, casket.id);
  progress = progressSanctuary(progress, { type: "activate-core", coreId: casket.id }).progress;
  assert.notEqual(findNearbyStoryInteraction(
    ALL_STORY_INTERACTIONS,
    { mapId: casket.mapId, x: casket.x, y: casket.y },
    progress,
  )?.id, casket.id);
});
