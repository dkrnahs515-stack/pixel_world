export const PROGRESSION_RULES = Object.freeze({
  baseMaxHp: 100,
  baseMaxMp: 100,
  maxHpPerLevel: 10,
  maxMpPerLevel: 5,
});

export const MONSTER_REWARDS = Object.freeze({
  "fire-slime": Object.freeze({ label: "불꽃 슬라임", exp: 3, goldMin: 1, goldMax: 3 }),
  "forest-slime": Object.freeze({ label: "숲 슬라임", exp: 4, goldMin: 2, goldMax: 4 }),
  "water-slime": Object.freeze({ label: "물방울 슬라임", exp: 5, goldMin: 2, goldMax: 5 }),
  boar: Object.freeze({ label: "멧돼지", exp: 7, goldMin: 3, goldMax: 6 }),
  crab: Object.freeze({ label: "게", exp: 8, goldMin: 4, goldMax: 7 }),
});

export function nextLevelExp(level) {
  return level * 100;
}

export function statsForLevel(level) {
  return {
    maxHp: PROGRESSION_RULES.baseMaxHp + (level - 1) * PROGRESSION_RULES.maxHpPerLevel,
    maxMp: PROGRESSION_RULES.baseMaxMp + (level - 1) * PROGRESSION_RULES.maxMpPerLevel,
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
