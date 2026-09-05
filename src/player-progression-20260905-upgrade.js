import { DEFAULT_CLASS_ID, getClassDefinition, normalizeClassId } from "./class-data-20260905-upgrade.js";

export const MONSTER_REWARDS = Object.freeze({
  "fire-slime": Object.freeze({ label: "불꽃 슬라임", exp: 3, goldMin: 1, goldMax: 3 }),
  "forest-slime": Object.freeze({ label: "숲 슬라임", exp: 4, goldMin: 2, goldMax: 4 }),
  "water-slime": Object.freeze({ label: "물방울 슬라임", exp: 5, goldMin: 2, goldMax: 5 }),
  boar: Object.freeze({ label: "멧돼지", exp: 7, goldMin: 3, goldMax: 6 }),
  crab: Object.freeze({ label: "게", exp: 8, goldMin: 4, goldMax: 7 }),
  "fang-shark": Object.freeze({ label: "송곳니 상어", exp: 20, goldMin: 15, goldMax: 15 }),
  "pirate-shark": Object.freeze({ label: "해적선 상어", exp: 25, goldMin: 20, goldMax: 20 }),
  "magma-slime": Object.freeze({ label: "마그마 슬라임", exp: 15, goldMin: 10, goldMax: 10 }),
  "flame-imp": Object.freeze({ label: "불꽃 도깨비", exp: 40, goldMin: 25, goldMax: 25 }),
  "ancient-boar": Object.freeze({ label: "고대 멧돼지", exp: 30, goldMin: 20, goldMax: 20 }),
  "moss-troll": Object.freeze({ label: "이끼 트롤", exp: 50, goldMin: 35, goldMax: 35 }),
  "ancient-mushroom-bug": Object.freeze({ label: "고대 버섯충", exp: 35, goldMin: 25, goldMax: 25 }),
});

export function nextLevelExp(level) {
  return level * 100;
}

export function statsForLevel(level, classId = DEFAULT_CLASS_ID) {
  const rules = getClassDefinition(normalizeClassId(classId)).stats;
  return {
    attackBonus: (level - 1) * rules.attackPerLevel,
    maxHp: rules.baseMaxHp + (level - 1) * rules.maxHpPerLevel,
    maxMp: rules.baseMaxMp + (level - 1) * rules.maxMpPerLevel,
  };
}

export function grantProgressReward(progress, { exp = 0, gold = 0 } = {}) {
  const next = { ...progress, exp: progress.exp + exp, gold: progress.gold + gold };
  let levelsGained = 0;
  while (next.exp >= next.nextLevelExp) {
    next.exp -= next.nextLevelExp;
    next.level += 1;
    next.nextLevelExp = nextLevelExp(next.level);
    levelsGained += 1;
  }
  return { progress: next, levelsGained };
}

export function getMonsterReward(enemyKind, random = Math.random) {
  const definition = MONSTER_REWARDS[enemyKind];
  if (!definition) return null;
  const sample = Math.min(0.9999999999999999, Math.max(0, random()));
  const gold = definition.goldMin
    + Math.floor(sample * (definition.goldMax - definition.goldMin + 1));
  return {
    kind: enemyKind,
    label: definition.label,
    exp: definition.exp,
    gold,
  };
}

export function grantHuntingReward(progress, enemyKind, random = Math.random) {
  const reward = getMonsterReward(enemyKind, random);
  if (!reward) return null;
  const result = grantProgressReward(progress, {
    exp: reward.exp,
    gold: reward.gold,
  });
  return {
    ...result,
    enemyKind: reward.kind,
    label: reward.label,
    rewardExp: reward.exp,
    rewardGold: reward.gold,
  };
}

export function grantCoopBossReward(progress, bossDefinition) {
  if (!bossDefinition || !(bossDefinition.rewardExp >= 0) || !(bossDefinition.rewardGold >= 0)) return null;
  const result = grantProgressReward(progress, {
    exp: bossDefinition.rewardExp,
    gold: bossDefinition.rewardGold,
  });
  return {
    ...result,
    bossId: bossDefinition.id,
    label: bossDefinition.name,
    rewardExp: bossDefinition.rewardExp,
    rewardGold: bossDefinition.rewardGold,
  };
}
