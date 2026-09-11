import test from "node:test";
import assert from "node:assert/strict";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";
import { campaignObjective } from "../src/quest-guidance-20260910-sanctuary.js";
import { arenDialogueModel } from "../src/aren-dialogue-20260910-sanctuary.js";

function withQuestStatus(status, questProgress = 0) {
  const progress = createInitialProgress();
  progress.quests.adventureStart = { status, progress: questProgress };
  if (status === "completed") progress.completedQuests = ["adventureStart"];
  return progress;
}

function completeRegions(progress, ...regionIds) {
  progress.worldProgress.completedRegionIds = [...regionIds];
  return progress;
}

test("Aren first meeting establishes forest-first progression without spoiling the sanctuary truth", () => {
  const model = arenDialogueModel(createInitialProgress());
  assert.equal(model.title, "현자 아렌");
  assert.equal(model.action, "accept");
  assert.equal(model.actionLabel, "[모험의 시작] 임무 수락");
  assert.match(model.body, /중앙 초원/);
  assert.match(model.body, /태고의 숲/);
  assert.match(model.body, /푸른 해안/);
  assert.match(model.body, /활화산/);
  assert.match(model.body, /연금술사 미아/);
  assert.match(model.body, /물약 사용법/);
  assert.match(model.body, /대장장이 브란/);
  assert.match(model.body, /슬라임 세 마리/);
  assert.match(model.body, /세라/);
  assert.match(model.body, /숲.*먼저|태고의 숲.*길/);
  assert.match(model.body, /단순한 폭주.*아니|원인.*단순/);
  assert.doesNotMatch(model.body, /아렌.*관리자 권한.*분리/);
  assert.doesNotMatch(model.body, /무료.*물약|물약.*무료/);
});

test("campaign objective follows the first quest states", () => {
  assert.equal(campaignObjective(withQuestStatus("available"), "village").text,
    "아렌에게 대륙의 상황을 듣는다.");
  assert.equal(campaignObjective(withQuestStatus("active", 1), "forest").text,
    "외부 지역의 슬라임 3마리를 처치한다.");
  assert.equal(campaignObjective(withQuestStatus("ready_to_report", 3), "village").text,
    "아렌에게 임무를 보고한다.");
  assert.equal(campaignObjective(withQuestStatus("completed", 3), "forest").text,
    "태고의 숲의 코어 반응을 추적한다.");
});

test("advanced world progress is never sent back to Chapter 1 by a stale starter quest", () => {
  const advanced = completeRegions(withQuestStatus("available", 0), "forest", "coast", "volcano");
  assert.deepEqual(campaignObjective(advanced, "village"), {
    eyebrow: "CHAPTER 4",
    text: "픽셀 코어 성역으로 향한다.",
    targetMapId: "sanctuary",
  });
});

test("campaign objective advances through coast, volcano, sanctuary and epilogue", () => {
  const forestDone = completeRegions(withQuestStatus("completed", 3), "forest");
  assert.deepEqual(campaignObjective(forestDone, "village"), {
    eyebrow: "CHAPTER 2",
    text: "푸른 해안의 세라 신호를 추적한다.",
    targetMapId: "coast-beach",
  });

  const coastDone = completeRegions(withQuestStatus("completed", 3), "forest", "coast");
  assert.equal(campaignObjective(coastDone, "coast-beach").text,
    "활화산의 선발대를 추적한다.");

  const volcanoDone = completeRegions(withQuestStatus("completed", 3), "forest", "coast", "volcano");
  assert.deepEqual(campaignObjective(volcanoDone, "village"), {
    eyebrow: "CHAPTER 4",
    text: "픽셀 코어 성역으로 향한다.",
    targetMapId: "sanctuary",
  });

  volcanoDone.worldProgress.chapters.sanctuary.activatedResonanceNodeIds = ["life-resonance"];
  assert.deepEqual(campaignObjective(volcanoDone, "sanctuary-resonance-hall"), {
    eyebrow: "CHAPTER 4",
    text: "공명 장치를 활성화하세요 (1/3)",
    targetMapId: "sanctuary-resonance-hall",
  });

  volcanoDone.worldProgress.chapters.sanctuary.chapterCompleted = true;
  volcanoDone.worldProgress.chapters.sanctuary.endingChoice = "restore";
  volcanoDone.worldProgress.chapters.sanctuary.endingRewardClaimed = true;
  assert.deepEqual(campaignObjective(volcanoDone, "village"), {
    eyebrow: "EPILOGUE",
    text: "PIXEL WORLD 제1부 완료",
    targetMapId: "village",
  });
});
