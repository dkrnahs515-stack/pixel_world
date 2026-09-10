import test from "node:test";
import assert from "node:assert/strict";
import {
  SANCTUARY_STORY_INTERACTIONS,
  getOriginRecords,
} from "../src/sanctuary-story-data-20260910-sanctuary.js";
import {
  isStoryInteractionEligible,
  resolveStoryInteraction,
} from "../src/story-interactions-20260910-sanctuary.js";
import { storyDialogueModel } from "../src/story-dialogue-20260910-sanctuary.js";
import {
  sanctuaryObjective,
  storyGuidance,
} from "../src/quest-guidance-20260910-sanctuary.js";
import {
  SANCTUARY_ARCHIVE_IDS,
  SANCTUARY_ORIGIN_RECORD_IDS,
  SANCTUARY_RESONANCE_NODE_IDS,
  activateSanctuaryResonanceNode,
  collectOriginRecord,
  normalizeWorldProgress,
  recordOriginDefeat,
  recordTrinityDefeat,
  restoreSanctuaryArchive,
} from "../src/chapter-progress-20260910-sanctuary.js";
import {
  oneResonanceProgress,
  originReadyProgress,
  sanctuaryUnlockedProgress,
  threeResonanceProgress,
  zeroBoundaryUnlockedProgress,
} from "./helpers/sanctuary-fixtures.mjs";

function interaction(id) {
  return SANCTUARY_STORY_INTERACTIONS.find(value => value.id === id);
}

function progressVariant({ captainOutcome = "rescued", supportChoice = "echo" } = {}) {
  const progress = zeroBoundaryUnlockedProgress();
  return normalizeWorldProgress({
    ...progress,
    chapters: {
      ...progress.chapters,
      coast: { ...progress.chapters.coast, supportChoice },
      volcano: {
        ...progress.chapters.volcano,
        captainOutcome,
        hiddenWeaponRewardClaimed: captainOutcome === "rescued",
      },
    },
  });
}

test("archive interactions stay locked until all three resonance nodes are activated", () => {
  const firstArchive = interaction("archive-aren-split");
  assert.equal(isStoryInteractionEligible(firstArchive, oneResonanceProgress()), false);
  assert.equal(isStoryInteractionEligible(firstArchive, threeResonanceProgress()), true);
});

test("required archive truths are presented in fixed order", () => {
  let progress = threeResonanceProgress();
  const first = interaction(SANCTUARY_ARCHIVE_IDS[0]);
  const second = interaction(SANCTUARY_ARCHIVE_IDS[1]);
  assert.equal(isStoryInteractionEligible(first, progress), true);
  assert.equal(isStoryInteractionEligible(second, progress), false);
  progress = resolveStoryInteraction(progress, first.id).progress;
  assert.equal(isStoryInteractionEligible(second, progress), true);
});

test("captain outcome changes presentation but not progression action", () => {
  const finalArchive = interaction("archive-defense-protocol");
  const rescued = storyDialogueModel(finalArchive, progressVariant({ captainOutcome: "rescued" }));
  const lost = storyDialogueModel(finalArchive, progressVariant({ captainOutcome: "lost" }));
  assert.match(rescued.pages.join(" "), /선발대장.*직접.*접속/);
  assert.match(lost.pages.join(" "), /마지막 통신 기록|최종 기록/);
  assert.deepEqual(rescued.actions, lost.actions);
});

test("coast support choice changes only the perspective line", () => {
  const finalArchive = interaction("archive-defense-protocol");
  const models = ["sera", "echo", "mari"].map(supportChoice => (
    storyDialogueModel(finalArchive, progressVariant({ supportChoice }))
  ));
  assert.match(models[0].pages.at(-1), /사람|목소리|구조/);
  assert.match(models[1].pages.at(-1), /기록|데이터|진실/);
  assert.match(models[2].pages.at(-1), /안정|재건|유지/);
  assert.deepEqual(models[0].actions, models[1].actions);
  assert.deepEqual(models[1].actions, models[2].actions);
});

test("optional origin records never gate core-heart progression", () => {
  let progress = zeroBoundaryUnlockedProgress({ originRecordIds: [] });
  assert.deepEqual(getOriginRecords(progress), []);
  progress = recordTrinityDefeat(progress).progress;
  assert.ok(progress.unlockedMapIds.includes("sanctuary-core-heart"));
  assert.deepEqual(progress.chapters.sanctuary.originRecordIds, []);
});

test("origin record copy contains the three resonance-ending principles", () => {
  const pages = SANCTUARY_ORIGIN_RECORD_IDS.map(id => interaction(id).pages.join(" "));
  assert.match(pages[0], /한 사람.*판단.*종속/);
  assert.match(pages[1], /완전히 끊.*회복/);
  assert.match(pages[2], /서로.*확인.*대화/);
});

test("sanctuary objective follows the approved progression priority", () => {
  assert.match(sanctuaryObjective(sanctuaryUnlockedProgress()).text, /공명.*0\/3/);
  assert.match(sanctuaryObjective(threeResonanceProgress()).text, /기록.*0\/3/);
  assert.match(sanctuaryObjective(zeroBoundaryUnlockedProgress()).text, /TRINITY/);
  assert.match(sanctuaryObjective(originReadyProgress()).text, /ORIGIN-0/);
});

test("after ORIGIN defeat with missing records guidance explicitly offers defer", () => {
  let progress = zeroBoundaryUnlockedProgress({ originRecordIds: [
    SANCTUARY_ORIGIN_RECORD_IDS[0],
    SANCTUARY_ORIGIN_RECORD_IDS[1],
  ] });
  progress = recordTrinityDefeat(progress).progress;
  progress = recordOriginDefeat(progress, "origin-encounter-1").progress;
  const objective = sanctuaryObjective(progress);
  assert.equal(objective.text, "결정 보류 가능 · 원점 기록 2/3");
  assert.equal(objective.targetMapId, "sanctuary-zero-boundary");
});

test("story guidance includes sanctuary completion arrays in marker state", () => {
  let progress = sanctuaryUnlockedProgress();
  progress = activateSanctuaryResonanceNode(progress, SANCTUARY_RESONANCE_NODE_IDS[0]).progress;
  const result = storyGuidance({
    interactions: SANCTUARY_STORY_INTERACTIONS,
    worldProgress: progress,
    mapId: "sanctuary-resonance-hall",
    player: { x: 1080, y: 1480 },
    camera: { x: 600, y: 900, width: 960, height: 540 },
    world: { width: 2160, height: 1800 },
    minimap: { width: 220, height: 140 },
  });
  assert.equal(result.markers.find(value => value.id === SANCTUARY_RESONANCE_NODE_IDS[0]).completed, true);
  assert.match(result.objective.text, /공명.*1\/3/);
});
