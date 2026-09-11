import test from "node:test";
import assert from "node:assert/strict";

import {
  CHAPTER_01,
  STORY_CLAIM_IDS,
  STORY_CLUE_IDS,
  STORY_COMPARISON_IDS,
  STORY_SCENE_IDS,
} from "../src/story-chapter-01-data.js";

function assertRecursivelyFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }

  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const nestedValue of Object.values(value)) {
    assertRecursivelyFrozen(nestedValue, seen);
  }
}

test("chapter data preserves the ordered investigation identifiers", () => {
  assert.deepEqual(STORY_SCENE_IDS, [
    "duty",
    "disposal-rule",
    "roster-items",
    "radio",
    "compass-compare",
    "time-compare",
    "case-submit",
    "hold-depart",
  ]);
  assert.deepEqual(STORY_CLUE_IDS, [
    "rule-five-years",
    "rule-no-life-signal",
    "rule-no-recovery",
    "roster-four-names",
    "recovered-radio",
    "empty-map-case",
    "replay-lengths",
    "new-received-at",
    "signal-warning",
    "metal-pattern",
    "main-compass-missing",
    "article-18-4",
  ]);
  assert.deepEqual(STORY_COMPARISON_IDS, ["metal-to-compass", "same-final-time"]);
  assert.deepEqual(STORY_CLAIM_IDS, ["investigate-survival", "all-alive"]);
});

test("chapter data preserves the source-backed evidence and limited conclusion", () => {
  assert.equal(CHAPTER_01.facts.receivedAt, "오늘 새벽 4시 52분");
  assert.equal(CHAPTER_01.facts.lastRecordAt, "5년 전 셋째 달 17일 4시 13분 22초");
  assert.deepEqual(CHAPTER_01.facts.replaySeconds, [12, 11]);
  assert.deepEqual(CHAPTER_01.facts.metalPattern, [1, 2]);
  assert.deepEqual(CHAPTER_01.facts.missingNames, ["루멘", "로안", "세라", "가렌"]);
  assert.equal(CHAPTER_01.result, "생존 여부 미확인. 폐기 보류.");
  assert.equal(CHAPTER_01.claims["investigate-survival"].correct, true);
  assert.equal(CHAPTER_01.claims["all-alive"].correct, false);
  assert.match(CHAPTER_01.clues["signal-warning"].document, /우리가 남긴 길을 그대로 따라오지 마/);
  assert.match(CHAPTER_01.clues["article-18-4"].document, /제18조 4항/);
  assert.equal(CHAPTER_01.evidence["new-received-at"].source, "clue");
  assert.equal(CHAPTER_01.evidence["metal-to-compass"].source, "comparison");
  assert.match(CHAPTER_01.feedback["all-alive"], /확정하지 않습니다/);
});

test("artwork metadata keeps the returned signal out of earlier scenes", () => {
  assert.deepEqual(CHAPTER_01.art.theo, {
    path: "./assets/chapter-01/01_제01장_고대 숲의 초보 궁수 테오.png",
    width: 1024,
    height: 1536,
    alt: "고대 숲을 배경으로 선 테오의 공식 삽화",
    description: "테오의 인물 소개를 위한 공식 삽화입니다. 현재 장소는 길드 기록실입니다.",
  });
  assert.equal(CHAPTER_01.art.returnedSignal.width, 1536);
  assert.equal(CHAPTER_01.art.returnedSignal.height, 1024);
  assert.equal(CHAPTER_01.scenes.duty.artId, "theo");
  assert.equal(CHAPTER_01.scenes["hold-depart"].artId, "returnedSignal");
  assert.equal(
    Object.values(CHAPTER_01.scenes).filter(({ artId }) => artId === "returnedSignal").length,
    1,
  );
});

test("scenes declare their prerequisites and all exported data is deeply immutable", () => {
  for (const sceneId of STORY_SCENE_IDS) {
    const scene = CHAPTER_01.scenes[sceneId];
    assert.equal(typeof scene.title, "string");
    assert.equal(typeof scene.copy, "string");
    assert.equal(Array.isArray(scene.requiredClueIds), true);
    assert.equal(Array.isArray(scene.requiredComparisonIds), true);
  }

  assertRecursivelyFrozen(CHAPTER_01);
  assertRecursivelyFrozen(STORY_SCENE_IDS);
  assertRecursivelyFrozen(STORY_CLUE_IDS);
  assertRecursivelyFrozen(STORY_COMPARISON_IDS);
  assertRecursivelyFrozen(STORY_CLAIM_IDS);
});
