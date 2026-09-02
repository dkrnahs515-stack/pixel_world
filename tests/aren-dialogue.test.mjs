import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptAdventureQuest,
  createInitialProgress,
  recordAdventureKill,
} from "../src/quest-state-20260829-coast.js";
import { arenDialogueModel } from "../src/aren-dialogue-20260829-coast.js";

test("아렌 대화는 퀘스트 상태에 맞는 행동을 제공한다", () => {
  assert.equal(arenDialogueModel(createInitialProgress()).action, "accept");

  const active = acceptAdventureQuest(createInitialProgress());
  assert.match(arenDialogueModel(active).body, /0\/3/);
  assert.equal(arenDialogueModel(active).action, "close");
});

test("보고 가능과 완료 상태는 각각 완료 보고와 닫기 행동을 제공한다", () => {
  let progress = acceptAdventureQuest(createInitialProgress());
  for (const enemyKind of ["fire-slime", "forest-slime", "water-slime"]) {
    progress = recordAdventureKill(progress, enemyKind);
  }

  assert.deepEqual(arenDialogueModel(progress), {
    title: "현자 아렌",
    body: "슬라임 세 마리를 모두 처치했군요. 이제 임무를 보고하세요.",
    action: "complete",
    actionLabel: "완료 보고",
  });

  progress.quests.adventureStart.status = "completed";
  assert.equal(arenDialogueModel(progress).action, "close");
  assert.equal(arenDialogueModel(progress).actionLabel, "대화 마치기");
});

test("해안 완료 뒤 아렌은 퀘스트 행동을 보존하며 support choice에 따라 반응한다", () => {
  const expected = {
    sera: "세라의 결단을 믿었군요. 그 신뢰가 구조의 마지막 길을 열었습니다.",
    echo: "에코의 목소리를 사람의 뜻으로 받아들였군요. 기록도 이제 우리 역사의 일부입니다.",
    mari: "마리의 판단을 따랐군요. 모두를 데려오려는 선택이 해안을 다시 이었습니다.",
  };
  const bodies = [];
  for (const choice of ["sera", "echo", "mari"]) {
    const progress = createInitialProgress();
    progress.worldProgress.completedRegionIds.push("coast");
    progress.worldProgress.chapters.coast.coreFragmentObtained = true;
    progress.worldProgress.chapters.coast.supportChoice = choice;

    const model = arenDialogueModel(progress);

    assert.equal(model.action, "accept");
    assert.match(model.body, new RegExp(expected[choice]));
    bodies.push(model.body);
  }
  assert.equal(new Set(bodies).size, 3);
});
