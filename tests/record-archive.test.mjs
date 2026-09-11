import test from "node:test";
import assert from "node:assert/strict";
import {
  collectRecordArchiveEntries,
  orderedArchiveRecords,
} from "../src/record-archive-20260911-sanctuary.js";

function coastRecordsFixture() {
  return [60, 10, 50, 20, 40, 30].map(timelineOrder => ({
    id: `coast-${timelineOrder}`,
    timelineOrder,
    pages: [`해안 ${timelineOrder}`],
  }));
}

function sanctuaryRecordsFixture() {
  return [{ id: "sanctuary-70", timelineOrder: 70, pages: ["성역 70"] }];
}

test("archive keeps the incorrect source beside its correction", () => {
  const originalFixture = {
    id: "first-archivist-deletion-log",
    chapterId: "sanctuary",
    timelineOrder: 70,
    pages: ["원본"],
  };
  const correctionFixture = {
    id: "sanctuary-correction-link",
    chapterId: "sanctuary",
    timelineOrder: 80,
    correctsRecordId: "first-archivist-deletion-log",
    evidenceRecordIds: ["core-self-division-original", "false-return-resonance-time"],
    pages: ["정정"],
  };

  const records = collectRecordArchiveEntries({
    coastRecords: [],
    sanctuaryRecords: [originalFixture, correctionFixture],
  });
  const original = records.find(value => value.id === "first-archivist-deletion-log");
  const correction = records.find(value => value.id === "sanctuary-correction-link");

  assert.equal(Boolean(original), true);
  assert.equal(correction.correctsRecordId, original.id);
  assert.deepEqual(correction.evidenceRecordIds.sort(), [
    "core-self-division-original",
    "false-return-resonance-time",
  ]);
});

test("coast records retain timeline order in the generic archive", () => {
  const records = orderedArchiveRecords(collectRecordArchiveEntries({
    coastRecords: coastRecordsFixture(),
    sanctuaryRecords: sanctuaryRecordsFixture(),
  }));

  assert.deepEqual(
    records.filter(value => value.chapterId === "coast").map(value => value.timelineOrder),
    [10, 20, 30, 40, 50, 60],
  );
});
