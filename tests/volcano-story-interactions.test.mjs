import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_STORY_INTERACTIONS,
  findNearbyStoryInteraction,
  isStoryInteractionEligible,
  resolveStoryInteraction,
} from "../src/story-interactions-20260903-volcano.js";
import {
  actorDialogueModel,
  storyDialogueModel,
} from "../src/story-dialogue-20260903-volcano.js";
import { COAST_STORY_INTERACTIONS } from "../src/coast-story-data-20260829-coast.js";
import { VOLCANO_STORY_INTERACTIONS } from "../src/volcano-story-data-20260903-volcano.js";
import {
  collectCoolantAnchor,
  collectVolcanoClue,
  normalizeWorldProgress,
  recordChapterBossDefeat,
  repairVolcanoDevice,
} from "../src/chapter-progress-20260903-volcano.js";

const MAGMA_DEVICE_IDS = ["magma-valve-west", "magma-valve-central", "magma-valve-east"];
const ANCHOR_IDS = [
  "ash-gate-coolant-anchor",
  "magma-route-coolant-anchor",
  "observatory-coolant-anchor",
];

function unlockedVolcanoProgress() {
  return normalizeWorldProgress({ chapters: { coast: { coreFragmentObtained: true } } });
}

function observatoryReadyProgress({ prepared = false } = {}) {
  let progress = unlockedVolcanoProgress();
  progress = repairVolcanoDevice(progress, "ash-gate-pressure-seal").progress;
  progress = collectVolcanoClue(progress, "garen-scorched-insignia").progress;
  if (prepared) progress = collectCoolantAnchor(progress, ANCHOR_IDS[0]).progress;
  for (const id of MAGMA_DEVICE_IDS) progress = repairVolcanoDevice(progress, id).progress;
  progress = collectVolcanoClue(progress, "garen-escort-record").progress;
  if (prepared) progress = collectCoolantAnchor(progress, ANCHOR_IDS[1]).progress;
  progress = repairVolcanoDevice(progress, "observatory-stabilizer").progress;
  progress = collectVolcanoClue(progress, "captain-transport-order").progress;
  progress = collectVolcanoClue(progress, "captain-core-contact-record").progress;
  if (prepared) progress = collectCoolantAnchor(progress, ANCHOR_IDS[2]).progress;
  return progress;
}

const interaction = id => VOLCANO_STORY_INTERACTIONS.find(value => value.id === id);

test("통합 목록은 기존 해안 상호작용 순서와 활화산 상호작용을 함께 보존한다", () => {
  assert.deepEqual(
    ALL_STORY_INTERACTIONS.slice(0, COAST_STORY_INTERACTIONS.length),
    COAST_STORY_INTERACTIONS,
  );
  assert.deepEqual(ALL_STORY_INTERACTIONS.slice(COAST_STORY_INTERACTIONS.length), VOLCANO_STORY_INTERACTIONS);
  assert.equal(Object.isFrozen(ALL_STORY_INTERACTIONS), true);
});

test("준비 부족 진입 대화는 되돌아가기와 영구 포기를 함께 명시한다", () => {
  const routeConsole = interaction("volcano-route-console");
  const model = storyDialogueModel(routeConsole, observatoryReadyProgress());
  assert.deepEqual(model.actions.map(action => action.id), [
    "story-volcano-route-return",
    "story-volcano-route-proceed",
  ]);
  assert.match(model.pages.join(" "), /대장을 구할 수 없고.*히든 무기/);
  assert.match(model.pages.join(" "), /본편.*진행/);
});

test("냉각 쐐기 3개를 모은 진입 대화는 구조 루트만 제공한다", () => {
  const model = storyDialogueModel(
    interaction("volcano-route-console"),
    observatoryReadyProgress({ prepared: true }),
  );
  assert.deepEqual(model.actions.map(action => action.id), ["story-volcano-route-rescue"]);
  assert.match(model.pages.join(" "), /구조 장비.*완성/);
});

test("활화산 eligibility와 resolver는 공개 전이에 위임해 맵 해금과 영구 분기를 지킨다", () => {
  const initial = unlockedVolcanoProgress();
  const pressureSeal = interaction("ash-gate-pressure-seal");
  assert.equal(isStoryInteractionEligible(pressureSeal, initial), true);
  const repaired = resolveStoryInteraction(initial, pressureSeal.id);
  assert.equal(repaired.outcome, "completed");
  assert.deepEqual(initial.chapters.volcano.repairedDeviceIds, []);
  assert.equal(isStoryInteractionEligible(pressureSeal, repaired.progress), false);

  const ready = observatoryReadyProgress();
  const returned = resolveStoryInteraction(ready, "volcano-route-console", { decision: "return" });
  assert.equal(returned.outcome, "returned");
  assert.deepEqual(returned.progress, ready);
  const proceeded = resolveStoryInteraction(ready, "volcano-route-console", { decision: "proceed" });
  assert.equal(proceeded.outcome, "completed");
  assert.equal(proceeded.progress.chapters.volcano.routeDecision, "proceed");
  assert.equal(proceeded.progress.unlockedMapIds.includes("volcano-core-caldera"), true);
  assert.equal(resolveStoryInteraction(proceeded.progress, "volcano-route-console", { decision: "rescue" }).outcome, "unavailable");
});

test("대장 결과 뒤에만 코어 회수가 열리고 일반 루트도 성역을 연다", () => {
  let progress = resolveStoryInteraction(
    observatoryReadyProgress(),
    "volcano-route-console",
    { decision: "proceed" },
  ).progress;
  const core = interaction("volcano-core-fragment");
  assert.equal(isStoryInteractionEligible(core, progress), false);
  progress = recordChapterBossDefeat(progress, "volcano").progress;
  assert.equal(isStoryInteractionEligible(interaction("volcano-captain-outcome"), progress), true);
  progress = resolveStoryInteraction(progress, "volcano-captain-outcome").progress;
  assert.equal(progress.chapters.volcano.captainOutcome, "lost");
  assert.equal(isStoryInteractionEligible(core, progress), true);
  const collected = resolveStoryInteraction(progress, core.id);
  assert.equal(collected.progress.chapters.volcano.coreFragmentObtained, true);
  assert.equal(collected.progress.chapters.volcano.sanctuaryUnlocked, true);
});

test("근접 탐색과 배우 대화는 활화산 대상과 기존 해안 배우를 모두 지원한다", () => {
  const target = interaction("ash-gate-pressure-seal");
  const nearby = findNearbyStoryInteraction(
    ALL_STORY_INTERACTIONS,
    { mapId: target.mapId, x: target.x, y: target.y },
    unlockedVolcanoProgress(),
  );
  assert.equal(nearby.id, target.id);
  assert.match(actorDialogueModel("garen", unlockedVolcanoProgress()).pages.join(" "), /냉각 쐐기/);
  assert.equal(actorDialogueModel("mari", unlockedVolcanoProgress()).title, "마리");
});

test("통합 resolver의 해안 변경과 확인 응답은 기존 활화산 전체 상태를 보존한다", () => {
  const volcanoState = {
    repairedDeviceIds: ["ash-gate-pressure-seal"],
    collectedClueIds: ["garen-scorched-insignia"],
    coolantAnchorIds: ["ash-gate-coolant-anchor"],
    routeDecision: "proceed",
    eruptionTriggered: true,
    coopBossDefeated: true,
    captainOutcome: "lost",
    hiddenWeaponRewardClaimed: false,
    coreFragmentObtained: true,
    sanctuaryUnlocked: true,
  };
  const initial = normalizeWorldProgress({
    unlockedMapIds: ["coast-beach", "volcano"],
    chapters: { coast: {}, volcano: volcanoState },
  });
  const repaired = resolveStoryInteraction(initial, "coast-beach-transceiver");
  assert.equal(repaired.outcome, "completed");
  assert.deepEqual(repaired.progress.chapters.volcano, initial.chapters.volcano);
  assert.deepEqual(repaired.progress.chapters.coast.repairedDeviceIds, ["coast-beach-transceiver"]);

  const revealReady = normalizeWorldProgress({
    ...initial,
    unlockedMapIds: [...initial.unlockedMapIds, "coast-tide-core-cave"],
    chapters: {
      ...initial.chapters,
      coast: { ...initial.chapters.coast, supportChoice: "sera" },
    },
  });
  const acknowledged = resolveStoryInteraction(revealReady, "tide-core-echo-reveal");
  assert.equal(acknowledged.outcome, "acknowledged");
  assert.deepEqual(acknowledged.progress.chapters.volcano, revealReady.chapters.volcano);
  assert.deepEqual(acknowledged.progress, revealReady);
});
