import test from "node:test";
import assert from "node:assert/strict";
import * as progression from "../src/player-progression.js";
import { getCoopBossForMap } from "../src/coop-boss-data-20260829-coast.js";

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

test("협동 보스 보상은 정의된 EXP와 Gold를 그대로 적용한다", () => {
  const result = progression.grantCoopBossReward(
    { ...base(), exp: 90, gold: 10 },
    getCoopBossForMap("coast-tide-core-cave"),
  );
  assert.equal(result.rewardExp, 150);
  assert.equal(result.rewardGold, 100);
  assert.equal(result.progress.level, 2);
  assert.equal(result.progress.exp, 140);
  assert.equal(result.progress.gold, 110);
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

test("신규 부모 몬스터는 난수와 무관한 고정 보상을 지급한다", () => {
  const fixedCases = [
    ["fang-shark", 20, 15, "송곳니 상어"],
    ["pirate-shark", 25, 20, "해적선 상어"],
    ["magma-slime", 15, 10, "마그마 슬라임"],
    ["flame-imp", 40, 25, "불꽃 도깨비"],
    ["ancient-boar", 30, 20, "고대 멧돼지"],
    ["moss-troll", 50, 35, "이끼 트롤"],
    ["ancient-mushroom-bug", 35, 25, "고대 버섯충"],
  ];

  for (const [kind, exp, gold, label] of fixedCases) {
    for (const random of [() => 0, () => 0.999999]) {
      assert.deepEqual(progression.getMonsterReward(kind, random), {
        kind, label, exp, gold,
      });
    }
  }
  assert.equal(progression.getMonsterReward("magma-slime-small", () => 0), null);
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

test("레벨과 직업에 따라 최대 HP와 MP를 계산한다", () => {
  assert.deepEqual(statsForLevel(1, "warrior"), { maxHp: 120, maxMp: 80 });
  assert.deepEqual(statsForLevel(30, "warrior"), { maxHp: 468, maxMp: 196 });
  assert.deepEqual(statsForLevel(1, "archer"), { maxHp: 100, maxMp: 100 });
  assert.deepEqual(statsForLevel(30, "archer"), { maxHp: 390, maxMp: 245 });
  assert.deepEqual(statsForLevel(1, "mage"), { maxHp: 80, maxMp: 140 });
  assert.deepEqual(statsForLevel(30, "mage"), { maxHp: 312, maxMp: 343 });
  assert.deepEqual(statsForLevel(1, "invalid"), { maxHp: 120, maxMp: 80 });
});
