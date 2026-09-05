import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseVolcanoRoute,
  collectCoolantAnchor,
  collectVolcanoClue,
  collectVolcanoCore,
  createInitialVolcanoChapter,
  createInitialWorldProgress,
  isMapUnlocked,
  normalizeWorldProgress,
  recordChapterBossDefeat,
  repairVolcanoDevice,
  resolveVolcanoCaptain,
} from "../src/chapter-progress-20260903-volcano-20260905-upgrade.js";

const MAGMA_DEVICE_IDS = [
  "magma-valve-west",
  "magma-valve-central",
  "magma-valve-east",
];
const COOLANT_ANCHOR_IDS = [
  "ash-gate-coolant-anchor",
  "magma-route-coolant-anchor",
  "observatory-coolant-anchor",
];

function unlockedVolcanoProgress() {
  return normalizeWorldProgress({
    chapters: { coast: { coreFragmentObtained: true } },
  });
}

function magmaRouteProgress() {
  let progress = unlockedVolcanoProgress();
  progress = repairVolcanoDevice(progress, "ash-gate-pressure-seal").progress;
  return collectVolcanoClue(progress, "garen-scorched-insignia").progress;
}

function observatoryProgress() {
  let progress = magmaRouteProgress();
  for (const deviceId of MAGMA_DEVICE_IDS) {
    progress = repairVolcanoDevice(progress, deviceId).progress;
  }
  return collectVolcanoClue(progress, "garen-escort-record").progress;
}

function observatoryReadyProgress() {
  let progress = observatoryProgress();
  progress = repairVolcanoDevice(progress, "observatory-stabilizer").progress;
  progress = collectVolcanoClue(progress, "captain-transport-order").progress;
  return collectVolcanoClue(progress, "captain-core-contact-record").progress;
}

test("활화산 초기 상태는 직렬화 가능한 허용 필드만 가진다", () => {
  assert.deepEqual(createInitialVolcanoChapter(), {
    repairedDeviceIds: [],
    collectedClueIds: [],
    coolantAnchorIds: [],
    routeDecision: null,
    eruptionTriggered: false,
    coopBossDefeated: false,
    captainOutcome: null,
    hiddenWeaponRewardClaimed: false,
    coreFragmentObtained: false,
    sanctuaryUnlocked: false,
  });
  assert.deepEqual(createInitialWorldProgress().chapters.volcano, createInitialVolcanoChapter());
});

test("필수 목표만 다음 활화산 맵을 열고 냉각 쐐기는 구조 분기만 결정한다", () => {
  let progress = unlockedVolcanoProgress();
  progress = repairVolcanoDevice(progress, "ash-gate-pressure-seal").progress;
  assert.equal(isMapUnlocked(progress, "volcano-magma-route"), false);
  progress = collectVolcanoClue(progress, "garen-scorched-insignia").progress;
  assert.equal(isMapUnlocked(progress, "volcano-magma-route"), true);
  assert.equal(progress.chapters.volcano.coolantAnchorIds.length, 0);

  for (const deviceId of MAGMA_DEVICE_IDS) {
    progress = repairVolcanoDevice(progress, deviceId).progress;
  }
  assert.equal(isMapUnlocked(progress, "volcano-observatory"), false);
  progress = collectVolcanoClue(progress, "garen-escort-record").progress;
  assert.equal(isMapUnlocked(progress, "volcano-observatory"), true);
});

test("관측소는 안정기와 두 기록을 모두 요구하고 준비 부족은 명시적 proceed만 최종 맵을 연다", () => {
  let progress = observatoryProgress();
  progress = repairVolcanoDevice(progress, "observatory-stabilizer").progress;
  progress = collectVolcanoClue(progress, "captain-transport-order").progress;
  assert.equal(chooseVolcanoRoute(progress, "proceed").progress.chapters.volcano.routeDecision, null);

  const ready = collectVolcanoClue(progress, "captain-core-contact-record").progress;
  assert.equal(chooseVolcanoRoute(ready, "rescue").progress.chapters.volcano.routeDecision, null);
  assert.equal(isMapUnlocked(ready, "volcano-core-caldera"), false);

  const returned = chooseVolcanoRoute(ready, "return");
  assert.deepEqual(returned.progress, ready);
  assert.deepEqual(returned.effects, []);

  const proceeded = chooseVolcanoRoute(ready, "proceed");
  assert.equal(proceeded.progress.chapters.volcano.routeDecision, "proceed");
  assert.equal(proceeded.progress.chapters.volcano.eruptionTriggered, true);
  assert.equal(isMapUnlocked(proceeded.progress, "volcano-core-caldera"), true);
});

test("세 맵의 냉각 쐐기를 모두 모으면 구조 루트를 열고 확정 뒤에는 쐐기와 분기를 바꿀 수 없다", () => {
  let progress = magmaRouteProgress();
  progress = collectCoolantAnchor(progress, COOLANT_ANCHOR_IDS[0]).progress;
  for (const deviceId of MAGMA_DEVICE_IDS) {
    progress = repairVolcanoDevice(progress, deviceId).progress;
  }
  progress = collectVolcanoClue(progress, "garen-escort-record").progress;
  progress = collectCoolantAnchor(progress, COOLANT_ANCHOR_IDS[1]).progress;
  progress = repairVolcanoDevice(progress, "observatory-stabilizer").progress;
  progress = collectVolcanoClue(progress, "captain-transport-order").progress;
  progress = collectVolcanoClue(progress, "captain-core-contact-record").progress;
  progress = collectCoolantAnchor(progress, COOLANT_ANCHOR_IDS[2]).progress;

  const rescued = chooseVolcanoRoute(progress, "rescue");
  assert.equal(rescued.progress.chapters.volcano.routeDecision, "rescue");
  assert.equal(isMapUnlocked(rescued.progress, "volcano-core-caldera"), true);

  const changed = chooseVolcanoRoute(rescued.progress, "proceed");
  const lateAnchor = collectCoolantAnchor(rescued.progress, "ash-gate-coolant-anchor");
  assert.deepEqual(changed.progress, rescued.progress);
  assert.deepEqual(lateAnchor.progress, rescued.progress);
});

test("활화산 전이는 원본을 바꾸지 않고 잘못됐거나 반복된 이벤트에 멱등이다", () => {
  const initial = unlockedVolcanoProgress();
  const invalid = repairVolcanoDevice(initial, "unknown-device");
  assert.notStrictEqual(invalid.progress, initial);
  assert.deepEqual(invalid.progress, initial);
  assert.deepEqual(invalid.effects, []);

  const repaired = repairVolcanoDevice(initial, "ash-gate-pressure-seal");
  const repeated = repairVolcanoDevice(repaired.progress, "ash-gate-pressure-seal");
  assert.deepEqual(repeated.progress, repaired.progress);
  assert.deepEqual(initial.chapters.volcano.repairedDeviceIds, []);
});

test("최종 맵 보스와 고정 분기 결과 뒤에만 코어를 회수해 성역을 연다", () => {
  const routed = chooseVolcanoRoute(observatoryReadyProgress(), "proceed").progress;
  const tooSoon = resolveVolcanoCaptain(routed);
  assert.equal(tooSoon.progress.chapters.volcano.captainOutcome, null);

  const defeated = recordChapterBossDefeat(routed, "volcano");
  assert.equal(defeated.progress.chapters.volcano.coopBossDefeated, true);
  const lost = resolveVolcanoCaptain(defeated.progress);
  assert.equal(lost.progress.chapters.volcano.captainOutcome, "lost");
  assert.equal(lost.progress.chapters.volcano.hiddenWeaponRewardClaimed, false);

  const collected = collectVolcanoCore(lost.progress);
  assert.equal(collected.progress.chapters.volcano.coreFragmentObtained, true);
  assert.equal(collected.progress.chapters.volcano.sanctuaryUnlocked, true);
  assert.equal(collected.progress.completedRegionIds.includes("volcano"), true);
  assert.equal(collected.progress.unlockedRegionIds.includes("sanctuary"), true);
  assert.equal(isMapUnlocked(collected.progress, "sanctuary"), true);
});

test("구조 분기는 대장 구출과 히든 무기 수령 상태를 함께 확정한다", () => {
  let progress = observatoryReadyProgress();
  progress.chapters.volcano.coolantAnchorIds = [...COOLANT_ANCHOR_IDS];
  progress = chooseVolcanoRoute(progress, "rescue").progress;
  progress = recordChapterBossDefeat(progress, "volcano").progress;
  const resolved = resolveVolcanoCaptain(progress);

  assert.equal(resolved.progress.chapters.volcano.captainOutcome, "rescued");
  assert.equal(resolved.progress.chapters.volcano.hiddenWeaponRewardClaimed, true);
});

test("정규화는 손상값을 버리고 명시된 종단 파생 관계를 복구한다", () => {
  const normalized = normalizeWorldProgress({
    chapters: {
      coast: { coreFragmentObtained: true },
      volcano: {
        repairedDeviceIds: ["ash-gate-pressure-seal", "unknown", "ash-gate-pressure-seal"],
        collectedClueIds: "captain-core-contact-record",
        coolantAnchorIds: ["observatory-coolant-anchor", "unknown"],
        routeDecision: "escape",
        eruptionTriggered: "true",
        coopBossDefeated: "true",
        captainOutcome: "lost",
        hiddenWeaponRewardClaimed: false,
        coreFragmentObtained: true,
        sanctuaryUnlocked: false,
      },
    },
  });

  assert.deepEqual(normalized.chapters.volcano.repairedDeviceIds, ["ash-gate-pressure-seal"]);
  assert.deepEqual(normalized.chapters.volcano.collectedClueIds, []);
  assert.deepEqual(normalized.chapters.volcano.coolantAnchorIds, ["observatory-coolant-anchor"]);
  assert.equal(normalized.chapters.volcano.routeDecision, null);
  assert.equal(normalized.chapters.volcano.eruptionTriggered, false);
  assert.equal(normalized.chapters.volcano.coopBossDefeated, true);
  assert.equal(normalized.chapters.volcano.captainOutcome, "lost");
  assert.equal(normalized.chapters.volcano.sanctuaryUnlocked, true);
  assert.equal(normalized.completedRegionIds.includes("volcano"), true);
  assert.equal(isMapUnlocked(normalized, "sanctuary"), true);
});

test("히든 무기 수령 표시는 구조 성공과 보스 처치를 복구한다", () => {
  const normalized = normalizeWorldProgress({
    chapters: { volcano: { hiddenWeaponRewardClaimed: true } },
  });
  assert.equal(normalized.chapters.volcano.captainOutcome, "rescued");
  assert.equal(normalized.chapters.volcano.coopBossDefeated, true);
});

test("정규화는 세 냉각 쐐기가 없는 rescue만 지우고 준비된 rescue와 proceed는 보존한다", () => {
  const underprepared = normalizeWorldProgress({
    chapters: { volcano: {
      coolantAnchorIds: ["ash-gate-coolant-anchor", "magma-route-coolant-anchor"],
      routeDecision: "rescue",
    } },
  });
  assert.equal(underprepared.chapters.volcano.routeDecision, null);

  const prepared = normalizeWorldProgress({
    chapters: { volcano: {
      coolantAnchorIds: [...COOLANT_ANCHOR_IDS],
      routeDecision: "rescue",
    } },
  });
  assert.equal(prepared.chapters.volcano.routeDecision, "rescue");

  const proceed = normalizeWorldProgress({
    chapters: { volcano: {
      coolantAnchorIds: [],
      routeDecision: "proceed",
    } },
  });
  assert.equal(proceed.chapters.volcano.routeDecision, "proceed");
});
