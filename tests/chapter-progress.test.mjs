import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseChapterSupport,
  collectChapterRecord,
  collectCoastCore,
  completeRegion,
  createInitialWorldProgress,
  isMapUnlocked,
  normalizeWorldProgress,
  recordChapterBossDefeat,
  repairChapterDevice,
  rescueSera,
} from "../src/chapter-progress-20260829-coast.js";

const WRECK_DEVICE_IDS = ["wreck-relay-west", "wreck-relay-deck", "wreck-relay-east"];
const WRECK_RECORD_IDS = [
  "wreck-record-sera",
  "wreck-record-roan",
  "wreck-record-garen",
  "wreck-record-vanguard-captain",
];

function coastReadyForChoice() {
  let progress = completeRegion(createInitialWorldProgress(), "forest").progress;
  progress = repairChapterDevice(progress, "coast-beach-transceiver").progress;
  progress = collectChapterRecord(progress, "sera-distress-current").progress;
  for (const deviceId of WRECK_DEVICE_IDS) {
    progress = repairChapterDevice(progress, deviceId).progress;
  }
  for (const recordId of WRECK_RECORD_IDS) {
    progress = collectChapterRecord(progress, recordId).progress;
  }
  progress = repairChapterDevice(progress, "flooded-station-main-transceiver").progress;
  return collectChapterRecord(progress, "flooded-station-deleted-record").progress;
}

test("initial world progress keeps only allow-listed serializable state", () => {
  const initial = createInitialWorldProgress();
  assert.deepEqual(initial, {
    unlockedRegionIds: ["village", "forest"],
    completedRegionIds: [],
    unlockedMapIds: ["village", "forest"],
    chapters: {
      coast: {
        repairedDeviceIds: [],
        collectedRecordIds: [],
        supportChoice: null,
        seraRescued: false,
        coopBossDefeated: false,
        coreFragmentObtained: false,
        shortcutUnlocked: false,
      },
    },
  });
  assert.deepEqual(normalizeWorldProgress({
    unlockedRegionIds: ["forest", "forest", "unknown"],
    completedRegionIds: ["forest", "unknown"],
    unlockedMapIds: ["coast-wreck-bay", "unknown", "coast-wreck-bay"],
    chapters: { coast: {
      repairedDeviceIds: ["wreck-relay-west", "unknown", "wreck-relay-west"],
      collectedRecordIds: ["sera-distress-current", "unknown"],
      supportChoice: "not-a-choice",
      seraRescued: true,
      coopBossDefeated: 1,
      coreFragmentObtained: "yes",
      shortcutUnlocked: null,
    } },
  }), {
    unlockedRegionIds: ["village", "forest"],
    completedRegionIds: ["forest"],
    unlockedMapIds: ["village", "forest", "coast-wreck-bay"],
    chapters: { coast: {
      repairedDeviceIds: ["wreck-relay-west"],
      collectedRecordIds: ["sera-distress-current"],
      supportChoice: null,
      seraRescued: true,
      coopBossDefeated: true,
      coreFragmentObtained: false,
      shortcutUnlocked: false,
    } },
  });
});

test("string booleans never become accepted coast progression flags", () => {
  const normalized = normalizeWorldProgress({
    chapters: { coast: {
      seraRescued: "true",
      coopBossDefeated: "false",
      coreFragmentObtained: "true",
      shortcutUnlocked: "false",
    } },
  });

  assert.deepEqual({
    seraRescued: normalized.chapters.coast.seraRescued,
    coopBossDefeated: normalized.chapters.coast.coopBossDefeated,
    coreFragmentObtained: normalized.chapters.coast.coreFragmentObtained,
    shortcutUnlocked: normalized.chapters.coast.shortcutUnlocked,
  }, {
    seraRescued: false,
    coopBossDefeated: false,
    coreFragmentObtained: false,
    shortcutUnlocked: false,
  });
});

test("missing or malformed unlock arrays recover baseline access without erasing valid progress", () => {
  const cases = [
    {},
    { unlockedRegionIds: "forest", unlockedMapIds: { village: true } },
    { unlockedRegionIds: ["coast", "unknown"], unlockedMapIds: ["coast-wreck-bay", "unknown"] },
  ];

  for (const unlocks of cases) {
    const normalized = normalizeWorldProgress({
      ...unlocks,
      completedRegionIds: ["forest"],
      chapters: { coast: { repairedDeviceIds: ["coast-beach-transceiver"] } },
    });
    assert.deepEqual(normalized.unlockedRegionIds.slice(0, 2), ["village", "forest"]);
    assert.deepEqual(normalized.unlockedMapIds.slice(0, 2), ["village", "forest"]);
    assert.deepEqual(normalized.completedRegionIds, ["forest"]);
    assert.deepEqual(normalized.chapters.coast.repairedDeviceIds, ["coast-beach-transceiver"]);
  }

  const laterUnlocks = normalizeWorldProgress({
    unlockedRegionIds: ["coast", "unknown"],
    unlockedMapIds: ["coast-wreck-bay", "unknown"],
  });
  assert.deepEqual(laterUnlocks.unlockedRegionIds, ["village", "forest", "coast"]);
  assert.deepEqual(laterUnlocks.unlockedMapIds, ["village", "forest", "coast-wreck-bay"]);
});

test("a boolean core receipt repairs every derived terminal unlock idempotently", () => {
  const partial = {
    unlockedRegionIds: ["village", "forest", "coast"],
    completedRegionIds: ["forest"],
    unlockedMapIds: ["village", "forest", "coast-beach", "coast-tide-core-cave"],
    chapters: { coast: {
      repairedDeviceIds: [],
      collectedRecordIds: [],
      supportChoice: "echo",
      seraRescued: true,
      coopBossDefeated: true,
      coreFragmentObtained: true,
      shortcutUnlocked: false,
    } },
  };

  const normalized = normalizeWorldProgress(partial);
  assert.equal(normalized.chapters.coast.shortcutUnlocked, true);
  assert.equal(normalized.completedRegionIds.includes("coast"), true);
  assert.equal(normalized.unlockedRegionIds.includes("volcano"), true);
  assert.equal(normalized.unlockedMapIds.includes("volcano"), true);

  const repaired = collectCoastCore(partial);
  const repeated = collectCoastCore(repaired.progress);
  assert.deepEqual(repeated.progress, repaired.progress);
  assert.deepEqual(repeated.effects, []);
});

test("forest completion opens the coast entry map without mutating prior progress", () => {
  const initial = createInitialWorldProgress();
  assert.equal(isMapUnlocked(initial, "coast-beach"), false);

  const forestDone = completeRegion(initial, "forest");
  assert.equal(isMapUnlocked(forestDone.progress, "coast-beach"), true);
  assert.deepEqual(initial.completedRegionIds, []);
  assert.deepEqual(forestDone.effects, [
    { type: "region-completed", regionId: "forest" },
    { type: "region-unlocked", regionId: "coast" },
    { type: "map-unlocked", mapId: "coast-beach" },
  ]);
});

test("direct coast completion cannot bypass collecting the coast core", () => {
  const coastUnlocked = completeRegion(createInitialWorldProgress(), "forest").progress;
  const bypass = completeRegion(coastUnlocked, "coast");

  assert.equal(bypass.progress.chapters.coast.coreFragmentObtained, false);
  assert.equal(bypass.progress.completedRegionIds.includes("coast"), false);
  assert.equal(isMapUnlocked(bypass.progress, "volcano"), false);
  assert.deepEqual(bypass.effects, []);
});

test("ordered device and record gates unlock each coast map in sequence", () => {
  let progress = completeRegion(createInitialWorldProgress(), "forest").progress;
  progress = repairChapterDevice(progress, "coast-beach-transceiver").progress;
  assert.equal(isMapUnlocked(progress, "coast-wreck-bay"), false);
  progress = collectChapterRecord(progress, "sera-distress-current").progress;
  assert.equal(isMapUnlocked(progress, "coast-wreck-bay"), true);

  for (const deviceId of WRECK_DEVICE_IDS) {
    progress = repairChapterDevice(progress, deviceId).progress;
  }
  assert.equal(isMapUnlocked(progress, "coast-flooded-station"), false);
  for (const recordId of WRECK_RECORD_IDS) {
    progress = collectChapterRecord(progress, recordId).progress;
  }
  assert.equal(isMapUnlocked(progress, "coast-flooded-station"), true);

  progress = repairChapterDevice(progress, "flooded-station-main-transceiver").progress;
  assert.equal(isMapUnlocked(progress, "coast-tide-core-cave"), false);
  progress = collectChapterRecord(progress, "flooded-station-deleted-record").progress;
  assert.equal(isMapUnlocked(progress, "coast-tide-core-cave"), false);
  progress = chooseChapterSupport(progress, "echo").progress;
  assert.equal(isMapUnlocked(progress, "coast-tide-core-cave"), true);
});

test("chapter transitions are immutable and idempotent for invalid or repeated events", () => {
  const initial = createInitialWorldProgress();
  const invalid = repairChapterDevice(initial, "unknown-device");
  assert.notStrictEqual(invalid.progress, initial);
  assert.deepEqual(invalid.progress, initial);
  assert.deepEqual(invalid.effects, []);

  const unlocked = completeRegion(initial, "forest").progress;
  const repaired = repairChapterDevice(unlocked, "coast-beach-transceiver");
  const repeated = repairChapterDevice(repaired.progress, "coast-beach-transceiver");
  assert.notStrictEqual(repeated.progress, repaired.progress);
  assert.deepEqual(repeated.progress, repaired.progress);
  assert.deepEqual(repeated.effects, []);
  assert.deepEqual(unlocked.chapters.coast.repairedDeviceIds, []);
});

test("region completion never duplicates an already unlocked successor", () => {
  const villageDone = completeRegion(createInitialWorldProgress(), "village");
  assert.deepEqual(villageDone.progress.unlockedRegionIds, ["village", "forest"]);
  assert.deepEqual(villageDone.effects, [{ type: "region-completed", regionId: "village" }]);
});

test("each support choice is accepted once and opens the tide core cave", () => {
  for (const choice of ["sera", "echo", "mari"]) {
    const ready = coastReadyForChoice();
    const selected = chooseChapterSupport(ready, choice);
    const repeated = chooseChapterSupport(selected.progress, "sera");
    assert.equal(selected.progress.chapters.coast.supportChoice, choice);
    assert.equal(isMapUnlocked(selected.progress, "coast-tide-core-cave"), true);
    assert.deepEqual(repeated.progress, selected.progress);
    assert.deepEqual(repeated.effects, []);
    assert.equal(ready.chapters.coast.supportChoice, null);
  }
});

test("the coast boss must be defeated before Sera can be rescued", () => {
  const ready = chooseChapterSupport(coastReadyForChoice(), "sera").progress;
  const wrongRegion = recordChapterBossDefeat(ready, "forest");
  const tooSoon = rescueSera(wrongRegion.progress);
  assert.equal(tooSoon.progress.chapters.coast.seraRescued, false);
  assert.deepEqual(tooSoon.effects, []);

  const defeated = recordChapterBossDefeat(ready, "coast");
  const rescued = rescueSera(defeated.progress);
  assert.equal(rescued.progress.chapters.coast.coopBossDefeated, true);
  assert.equal(rescued.progress.chapters.coast.seraRescued, true);
});

test("core collection requires Sera's rescue and completes coast with volcano and shortcut effects", () => {
  const ready = chooseChapterSupport(coastReadyForChoice(), "mari").progress;
  const defeated = recordChapterBossDefeat(ready, "coast").progress;
  const tooSoon = collectCoastCore(defeated);
  assert.equal(tooSoon.progress.chapters.coast.coreFragmentObtained, false);
  assert.deepEqual(tooSoon.effects, []);

  const rescued = rescueSera(defeated).progress;
  const completed = collectCoastCore(rescued);
  assert.equal(completed.progress.chapters.coast.coreFragmentObtained, true);
  assert.equal(completed.progress.chapters.coast.shortcutUnlocked, true);
  assert.equal(completed.progress.completedRegionIds.includes("coast"), true);
  assert.equal(isMapUnlocked(completed.progress, "volcano"), true);
  assert.deepEqual(completed.effects, [
    { type: "region-completed", regionId: "coast" },
    { type: "region-unlocked", regionId: "volcano" },
    { type: "map-unlocked", mapId: "volcano" },
    { type: "shortcut-unlocked", shortcutId: "coast-beach-to-tide-core" },
  ]);

  const repeated = collectCoastCore(completed.progress);
  assert.deepEqual(repeated.progress, completed.progress);
  assert.deepEqual(repeated.effects, []);
});
