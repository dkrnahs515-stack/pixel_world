import test from "node:test";
import assert from "node:assert/strict";
import {
  SANCTUARY_ARCHIVE_IDS,
  SANCTUARY_ORIGIN_RECORD_IDS,
  SANCTUARY_RESONANCE_NODE_IDS,
  activateSanctuaryResonanceNode,
  collectOriginRecord,
  createInitialWorldProgress,
  normalizeWorldProgress,
  recordOriginDefeat,
  recordTrinityDefeat,
  restoreSanctuaryArchive,
} from "../src/chapter-progress-20260910-sanctuary.js";
import {
  originReadyProgress,
  sanctuaryUnlockedProgress,
  zeroBoundaryUnlockedProgress,
} from "./helpers/sanctuary-fixtures.mjs";

test("initial world contains an empty sanctuary chapter state", () => {
  const progress = createInitialWorldProgress();
  assert.deepEqual(progress.chapters.sanctuary, {
    activatedResonanceNodeIds: [],
    restoredArchiveIds: [],
    originRecordIds: [],
    trinityDefeated: false,
    originDefeated: false,
    originDefeatReceiptId: null,
    endingChoice: null,
    endingRewardClaimed: false,
    chapterCompleted: false,
  });
});

test("sanctuary identifiers are fixed and public", () => {
  assert.deepEqual(SANCTUARY_RESONANCE_NODE_IDS, [
    "life-resonance", "memory-resonance", "energy-resonance",
  ]);
  assert.deepEqual(SANCTUARY_ARCHIVE_IDS, [
    "archive-aren-split", "archive-vanguard-entry", "archive-defense-protocol",
  ]);
  assert.deepEqual(SANCTUARY_ORIGIN_RECORD_IDS, [
    "origin-record-single-authority",
    "origin-record-sealed-recovery",
    "origin-record-mutual-validation",
  ]);
});

test("volcano completion exposes sanctuary entrance and resonance hall", () => {
  const progress = sanctuaryUnlockedProgress();
  assert.ok(progress.unlockedRegionIds.includes("sanctuary"));
  assert.ok(progress.unlockedMapIds.includes("sanctuary"));
  assert.ok(progress.unlockedMapIds.includes("sanctuary-resonance-hall"));
  assert.equal(progress.completedRegionIds.includes("sanctuary"), false);
});

test("three resonance nodes unlock archive and are immutable/idempotent", () => {
  let progress = sanctuaryUnlockedProgress();
  const original = structuredClone(progress);
  for (const id of SANCTUARY_RESONANCE_NODE_IDS) {
    progress = activateSanctuaryResonanceNode(progress, id).progress;
  }
  assert.deepEqual(sanctuaryUnlockedProgress(), original);
  assert.ok(progress.unlockedMapIds.includes("sanctuary-origin-archive"));
  const repeated = activateSanctuaryResonanceNode(progress, SANCTUARY_RESONANCE_NODE_IDS[0]);
  assert.deepEqual(repeated.progress, progress);
  assert.deepEqual(repeated.effects, []);
});

test("three required archive records unlock zero boundary", () => {
  let progress = sanctuaryUnlockedProgress();
  for (const id of SANCTUARY_RESONANCE_NODE_IDS) {
    progress = activateSanctuaryResonanceNode(progress, id).progress;
  }
  for (const id of SANCTUARY_ARCHIVE_IDS) {
    progress = restoreSanctuaryArchive(progress, id).progress;
  }
  assert.ok(progress.unlockedMapIds.includes("sanctuary-zero-boundary"));
});

test("origin records are optional for core-heart progression", () => {
  const ready = zeroBoundaryUnlockedProgress({ originRecordIds: [] });
  assert.deepEqual(ready.chapters.sanctuary.originRecordIds, []);
  const defeated = recordTrinityDefeat(ready).progress;
  assert.equal(defeated.chapters.sanctuary.trinityDefeated, true);
  assert.ok(defeated.unlockedMapIds.includes("sanctuary-core-heart"));
  assert.deepEqual(defeated.chapters.sanctuary.originRecordIds, []);
});

test("origin records are unique, allow-listed and never unlock required progression", () => {
  let progress = zeroBoundaryUnlockedProgress({ originRecordIds: [] });
  const before = progress.unlockedMapIds;
  progress = collectOriginRecord(progress, SANCTUARY_ORIGIN_RECORD_IDS[0]).progress;
  const repeated = collectOriginRecord(progress, SANCTUARY_ORIGIN_RECORD_IDS[0]).progress;
  const unknown = collectOriginRecord(repeated, "origin-record-unknown").progress;
  assert.deepEqual(unknown.chapters.sanctuary.originRecordIds, [SANCTUARY_ORIGIN_RECORD_IDS[0]]);
  assert.deepEqual(unknown.unlockedMapIds, before);
});

test("origin defeat stores one receipt and never chooses an ending", () => {
  const result = recordOriginDefeat(originReadyProgress(), "origin-encounter-1").progress;
  assert.equal(result.chapters.sanctuary.originDefeated, true);
  assert.equal(result.chapters.sanctuary.originDefeatReceiptId, "origin-encounter-1");
  assert.equal(result.chapters.sanctuary.endingChoice, null);
  assert.equal(result.chapters.sanctuary.endingRewardClaimed, false);
  assert.equal(result.chapters.sanctuary.chapterCompleted, false);
  const repeated = recordOriginDefeat(result, "origin-encounter-2").progress;
  assert.equal(repeated.chapters.sanctuary.originDefeatReceiptId, "origin-encounter-1");
});

test("normalization removes invalid sanctuary ids and invalid ending strings", () => {
  const source = sanctuaryUnlockedProgress();
  const normalized = normalizeWorldProgress({
    ...source,
    chapters: {
      ...source.chapters,
      sanctuary: {
        ...source.chapters.sanctuary,
        activatedResonanceNodeIds: ["life-resonance", "life-resonance", "unknown"],
        restoredArchiveIds: ["archive-aren-split", "bad"],
        originRecordIds: ["origin-record-single-authority", "bad", "origin-record-single-authority"],
        endingChoice: "unknown-ending",
      },
    },
  });
  assert.deepEqual(normalized.chapters.sanctuary.activatedResonanceNodeIds, ["life-resonance"]);
  assert.deepEqual(normalized.chapters.sanctuary.restoredArchiveIds, ["archive-aren-split"]);
  assert.deepEqual(normalized.chapters.sanctuary.originRecordIds, ["origin-record-single-authority"]);
  assert.equal(normalized.chapters.sanctuary.endingChoice, null);
});
