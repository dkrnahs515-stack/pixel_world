import test from "node:test";
import assert from "node:assert/strict";
import {
  MEMORY_SOUND_IDS,
  RECORD_FIELD_IDS,
  createInitialSanctuaryChapter,
  normalizeSanctuaryChapter,
  reduceSanctuaryChapter,
} from "../src/sanctuary-progress-20260911-sanctuary.js";

function memoryCollectedChapter() {
  let chapter = createInitialSanctuaryChapter();
  for (const memoryId of MEMORY_SOUND_IDS) {
    chapter = reduceSanctuaryChapter(chapter, { type: "collect-memory", memoryId }).chapter;
  }
  return chapter;
}

const CONTRADICTION_IDS = [
  "false-return-garen-unscarred",
  "false-return-source-erased",
  "false-return-resonance-time",
];

test("sanctuary normalization rejects hostile types and dependent terminal flags", () => {
  const chapter = normalizeSanctuaryChapter({
    activatedCoreIds: "forest-core-casket",
    memorySequence: ["departure-bell", "dawn-bird", "tide-bell", "mine-shift-bell"],
    memoryOrderSolved: "true",
    correctionLinked: true,
    chorusSeparated: true,
    endingChoice: "victory",
    completed: true,
  });
  assert.deepEqual(chapter.activatedCoreIds, []);
  assert.equal(chapter.memoryOrderSolved, false);
  assert.equal(chapter.correctionLinked, false);
  assert.equal(chapter.chorusSeparated, false);
  assert.equal(chapter.endingChoice, null);
  assert.equal(chapter.completed, false);
});

test("only the canonical memory order unlocks the truth sequence", () => {
  const ready = memoryCollectedChapter();
  assert.equal(reduceSanctuaryChapter(ready, {
    type: "submit-memory-sequence",
    sequence: ["dawn-bird", "departure-bell", "tide-bell", "mine-shift-bell"],
  }).chapter.memoryOrderSolved, false);
  assert.equal(reduceSanctuaryChapter(ready, {
    type: "submit-memory-sequence",
    sequence: MEMORY_SOUND_IDS,
  }).chapter.memoryOrderSolved, true);
});

test("false return rejection requires three distinct persisted contradictions in any order", () => {
  let chapter = {
    ...memoryCollectedChapter(),
    activatedCoreIds: ["forest-core-casket", "coast-core-casket", "volcano-core-casket"],
    memorySequence: [...MEMORY_SOUND_IDS],
    memoryOrderSolved: true,
    coreTruthRevealed: true,
  };
  const before = structuredClone(chapter);
  for (const id of [CONTRADICTION_IDS[2], CONTRADICTION_IDS[0]]) {
    chapter = reduceSanctuaryChapter(chapter, { type: "collect-memory", memoryId: id }).chapter;
  }
  assert.deepEqual(before.collectedMemoryIds, MEMORY_SOUND_IDS);
  assert.equal(reduceSanctuaryChapter(chapter, { type: "reject-false-return" }).chapter.falseReturnRejected, false);

  chapter = reduceSanctuaryChapter(chapter, {
    type: "collect-memory",
    memoryId: CONTRADICTION_IDS[1],
  }).chapter;
  chapter = reduceSanctuaryChapter(chapter, {
    type: "collect-memory",
    memoryId: CONTRADICTION_IDS[1],
  }).chapter;
  assert.deepEqual(chapter.collectedMemoryIds.slice(-3), [
    "false-return-resonance-time",
    "false-return-garen-unscarred",
    "false-return-source-erased",
  ]);
  assert.equal(reduceSanctuaryChapter(chapter, { type: "reject-false-return" }).chapter.falseReturnRejected, true);
});

test("normalization cannot assert false return rejection without every contradiction", () => {
  const chapter = normalizeSanctuaryChapter({
    activatedCoreIds: ["forest-core-casket", "coast-core-casket", "volcano-core-casket"],
    collectedMemoryIds: [
      ...MEMORY_SOUND_IDS,
      "false-return-resonance-time",
      "false-return-source-erased",
      "false-return-source-erased",
      "hostile-memory-id",
    ],
    memorySequence: [...MEMORY_SOUND_IDS],
    memoryOrderSolved: true,
    coreTruthRevealed: true,
    falseReturnRejected: true,
  });

  assert.equal(chapter.coreTruthRevealed, true);
  assert.equal(chapter.falseReturnRejected, false);
  assert.deepEqual(chapter.collectedMemoryIds, [
    ...MEMORY_SOUND_IDS,
    "false-return-resonance-time",
    "false-return-source-erased",
  ]);
});

test("record fields normalize to the six canonical ids and only accept validated answers", () => {
  const ready = {
    ...memoryCollectedChapter(),
    activatedCoreIds: ["forest-core-casket", "coast-core-casket", "volcano-core-casket"],
    collectedMemoryIds: [...MEMORY_SOUND_IDS, ...CONTRADICTION_IDS],
    memorySequence: [...MEMORY_SOUND_IDS],
    memoryOrderSolved: true,
    coreTruthRevealed: true,
    falseReturnRejected: true,
    completedRecordFieldIds: ["departure", "witness", "seal", "delay-roan"],
  };
  const normalized = normalizeSanctuaryChapter(ready);
  assert.deepEqual(RECORD_FIELD_IDS, [
    "vanguard-return-state",
    "core-division-cause",
    "delay-roan",
    "delay-sera",
    "delay-garen",
    "delay-lumen",
  ]);
  assert.deepEqual(normalized.completedRecordFieldIds, ["delay-roan"]);

  const wrong = reduceSanctuaryChapter(normalized, {
    type: "complete-record-field",
    fieldId: "core-division-cause",
    answerId: "lumen-broke-core-alone",
  }).chapter;
  assert.deepEqual(wrong.completedRecordFieldIds, ["delay-roan"]);
  const correct = reduceSanctuaryChapter(wrong, {
    type: "complete-record-field",
    fieldId: "core-division-cause",
    answerId: "conflicting-records-self-division",
  }).chapter;
  assert.deepEqual(correct.completedRecordFieldIds, ["delay-roan", "core-division-cause"]);
});

test("chorus separation only accepts the matching eligible contributor claim", () => {
  const chapter = {
    ...createInitialSanctuaryChapter(),
    activatedCoreIds: ["forest-core-casket", "coast-core-casket", "volcano-core-casket"],
    collectedMemoryIds: [...MEMORY_SOUND_IDS, ...CONTRADICTION_IDS],
    memorySequence: [...MEMORY_SOUND_IDS],
    memoryOrderSolved: true,
    coreTruthRevealed: true,
    falseReturnRejected: true,
    completedRecordFieldIds: [...RECORD_FIELD_IDS],
    correctionLinked: true,
  };
  const rejected = reduceSanctuaryChapter(chapter, {
    type: "separate-chorus",
    uid: "player-a",
    claim: { uid: "player-b", eligible: true, encounterId: "chorus-1" },
  });
  const accepted = reduceSanctuaryChapter(chapter, {
    type: "separate-chorus",
    uid: "player-a",
    encounterId: "chorus-1",
    claim: { uid: "player-a", eligible: true, encounterId: "chorus-1" },
  });
  const wrongEncounter = reduceSanctuaryChapter(chapter, {
    type: "separate-chorus",
    uid: "player-a",
    encounterId: "chorus-2",
    claim: { uid: "player-a", eligible: true, encounterId: "chorus-1" },
  });
  assert.equal(rejected.chapter.chorusSeparated, false);
  assert.equal(wrongEncounter.chapter.chorusSeparated, false);
  assert.equal(accepted.chapter.chorusSeparated, true);
});
