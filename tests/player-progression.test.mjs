import test from "node:test";
import assert from "node:assert/strict";
import * as progression from "../src/player-progression.js";

const {
  grantProgressReward,
  nextLevelExp,
  statsForLevel,
} = progression;

const base = () => ({ level: 1, exp: 0, nextLevelExp: 100, gold: 0 });

test("다음 레벨 필요 EXP는 현재 레벨의 100배다", () => {
  assert.equal(nextLevelExp(1), 100);
  assert.equal(nextLevelExp(3), 300);
});

test("초과 EXP는 이월되고 한 보상으로 여러 번 레벨업한다", () => {
  const result = grantProgressReward(
    { ...base(), exp: 90 },
    { exp: 320, gold: 7 },
  );
  assert.deepEqual(result.progress, {
    level: 3,
    exp: 110,
    nextLevelExp: 300,
    gold: 7,
  });
  assert.equal(result.levelsGained, 2);
});

test("몬스터별 EXP와 Gold 최솟값·최댓값을 계산한다", () => {
  const cases = [
    ["fire-slime", 3, 1, 3, "불꽃 슬라임"],
    ["forest-slime", 4, 2, 4, "숲 슬라임"],
    ["water-slime", 5, 2, 5, "물방울 슬라임"],
    ["boar", 7, 3, 6, "멧돼지"],
    ["crab", 8, 4, 7, "게"],
  ];

  for (const [kind, exp, min, max, label] of cases) {
    assert.deepEqual(progression.getMonsterReward?.(kind, () => 0), {
      kind,
      label,
      exp,
      gold: min,
    });
    assert.equal(progression.getMonsterReward?.(kind, () => 0.999999)?.gold, max);
  }
});

test("종류별 사냥 보상을 진행 데이터에 반영하고 알 수 없는 종류는 거부한다", () => {
  const result = progression.grantHuntingReward(base(), "boar", () => 0);
  assert.equal(result.rewardExp, 7);
  assert.equal(result.rewardGold, 3);
  assert.equal(result.progress.exp, 7);
  assert.equal(result.progress.gold, 3);
  assert.equal(progression.getMonsterReward?.("unknown", () => 0), null);
  assert.equal(progression.grantHuntingReward(base(), "unknown", () => 0), null);
});

test("레벨별 최대 HP와 MP를 계산한다", () => {
  assert.deepEqual(statsForLevel(1), { maxHp: 100, maxMp: 100 });
  assert.deepEqual(statsForLevel(4), { maxHp: 130, maxMp: 115 });
});
