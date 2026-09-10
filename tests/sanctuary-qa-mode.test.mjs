import test from "node:test";
import assert from "node:assert/strict";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";
import {
  SANCTUARY_QA_MAP_IDS,
  SANCTUARY_QA_SETUP_IDS,
  prepareSanctuaryQaProgress,
} from "../src/qa-mode-20260910-sanctuary.js";

const EXPECTED_MAPS = [
  "sanctuary",
  "sanctuary-resonance-hall",
  "sanctuary-origin-archive",
  "sanctuary-zero-boundary",
  "sanctuary-core-heart",
];
const EXPECTED_SETUPS = [
  "origin-records-3",
  "trinity-ready",
  "origin-ready",
  "ending-restore-ready",
  "ending-seal-ready",
  "ending-resonate-ready",
];

test("sanctuary QA exposes all five travel maps and six setup actions", () => {
  assert.deepEqual([...SANCTUARY_QA_MAP_IDS], EXPECTED_MAPS);
  assert.deepEqual([...SANCTUARY_QA_SETUP_IDS], EXPECTED_SETUPS);
});

test("TRINITY-ready setup advances only to zero boundary", () => {
  const source = createInitialProgress();
  const before = structuredClone(source);
  const result = prepareSanctuaryQaProgress(source, "trinity-ready");
  const sanctuary = result.progress.worldProgress.chapters.sanctuary;

  assert.equal(result.ok, true);
  assert.equal(result.mapId, "sanctuary-zero-boundary");
  assert.equal(result.openEndingChoice, false);
  assert.equal(sanctuary.activatedResonanceNodeIds.length, 3);
  assert.equal(sanctuary.restoredArchiveIds.length, 3);
  assert.equal(sanctuary.trinityDefeated, false);
  assert.equal(sanctuary.originDefeated, false);
  assert.deepEqual(source, before);
});

test("ORIGIN-ready setup unlocks core heart without recording ORIGIN defeat", () => {
  const result = prepareSanctuaryQaProgress(createInitialProgress(), "origin-ready");
  const sanctuary = result.progress.worldProgress.chapters.sanctuary;

  assert.equal(result.ok, true);
  assert.equal(result.mapId, "sanctuary-core-heart");
  assert.equal(sanctuary.trinityDefeated, true);
  assert.equal(sanctuary.originDefeated, false);
  assert.equal(sanctuary.endingChoice, null);
});

test("origin-records-3 setup collects all optional records without defeating ORIGIN", () => {
  const result = prepareSanctuaryQaProgress(createInitialProgress(), "origin-records-3");
  const sanctuary = result.progress.worldProgress.chapters.sanctuary;

  assert.equal(result.ok, true);
  assert.equal(result.mapId, "sanctuary-zero-boundary");
  assert.deepEqual([...sanctuary.originRecordIds].sort(), [
    "origin-record-mutual-validation",
    "origin-record-sealed-recovery",
    "origin-record-single-authority",
  ]);
  assert.equal(sanctuary.originDefeated, false);
});

test("ending-ready setups preserve permanent-choice rules and identify the target ending", () => {
  for (const [setupId, endingId, recordCount] of [
    ["ending-restore-ready", "restore", 0],
    ["ending-seal-ready", "seal", 0],
    ["ending-resonate-ready", "resonate", 3],
  ]) {
    const result = prepareSanctuaryQaProgress(createInitialProgress(), setupId);
    const sanctuary = result.progress.worldProgress.chapters.sanctuary;
    assert.equal(result.ok, true, setupId);
    assert.equal(result.mapId, "sanctuary-core-heart", setupId);
    assert.equal(result.openEndingChoice, true, setupId);
    assert.equal(result.focusEndingId, endingId, setupId);
    assert.equal(sanctuary.originDefeated, true, setupId);
    assert.equal(sanctuary.endingChoice, null, setupId);
    assert.equal(sanctuary.endingRewardClaimed, false, setupId);
    assert.equal(sanctuary.originRecordIds.length, recordCount, setupId);
  }
});

test("unknown setup is rejected without changing progress", () => {
  const source = createInitialProgress();
  const result = prepareSanctuaryQaProgress(source, "unknown-setup");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unknown_setup");
  assert.equal(result.progress, source);
});
