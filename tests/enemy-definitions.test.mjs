import test from "node:test";
import assert from "node:assert/strict";
import { getEnemyDefinition } from "../src/enemy-definitions-20260905-upgrade.js";
import { createEnemyInstance } from "../src/enemies-20260829-coast-20260905-upgrade.js";

const expected = {
  "fang-shark": ["송곳니 상어", 25, 50, 100, 20, "fang-charge"],
  "pirate-shark": ["해적선 상어", 35, 55, 106, 21, "pirate-bite"],
  "magma-slime": ["마그마 슬라임", 10, 20, 78, 18, "magma-split"],
  "flame-imp": ["불꽃 도깨비", 40, 60, 148, 16, "flame-teleport"],
  "ancient-boar": ["고대 멧돼지", 55, 45, 105, 23, "burrow-charge"],
  "moss-troll": ["이끼 트롤", 100, 50, 58, 28, "camouflage-regeneration"],
  "ancient-mushroom-bug": ["고대 버섯충", 45, 35, 82, 18, "spore-slow"],
};

const expectedLevels = {
  "forest-slime": 1,
  "fire-slime": 2,
  "water-slime": 2,
  crab: 3,
  "magma-slime-small": 4,
  boar: 4,
  "magma-slime": 5,
  "fang-shark": 7,
  "pirate-shark": 9,
  "ancient-boar": 11,
  "ancient-mushroom-bug": 13,
  "flame-imp": 15,
  "moss-troll": 18,
};

test("신규 7종은 확정 능력치와 행동을 가진다", () => {
  for (const [kind, values] of Object.entries(expected)) {
    const type = getEnemyDefinition(kind);
    assert.deepEqual([type.name, type.hp, type.damage, type.speed, type.radius, type.behavior], values.map((value, index) => index === 1 ? value * 4 : value));
  }
  assert.equal(getEnemyDefinition("unknown"), null);
  assert.equal(getEnemyDefinition("toString"), null);
});

test("모든 몬스터 인스턴스는 종별 고정 난이도 레벨을 제공한다", () => {
  for (const [kind, level] of Object.entries(expectedLevels)) {
    const enemy = createEnemyInstance(kind, { x: 10, y: 20 }, `level-${kind}`);
    assert.equal(enemy.level, level, `${kind} should expose level ${level}`);
  }
});

test("인스턴스 팩터리는 정의 기반 전투 상태와 지정 재정의를 적용한다", () => {
  const enemy = createEnemyInstance(
    "magma-slime-small",
    { x: 950, y: 2500 },
    "volcano-enemy-9",
    { hp: 2, step: 1.7 },
  );

  assert.deepEqual(enemy, {
    id: "volcano-enemy-9", kind: "magma-slime-small", name: "작은 마그마 슬라임", level: 4,
    x: 950, y: 2500, prevX: 950, prevY: 2500, homeX: 950, homeY: 2500,
    hp: 2, maxHp: 2, speed: 95, contactDamage: 20, radius: 12,
    color: "#1b1719", accent: "#ffc857",
    behavior: "legacy-contact", behaviorState: "idle", behaviorTime: 0,
    cooldownRemaining: 0, attackSequence: 0, attackApplied: false,
    lastDamagedAgo: Number.POSITIVE_INFINITY, infoVisibleRemaining: 0,
    generation: 1, targetable: true, contactMode: "contact", contactCooldownDuration: 1,
    state: "idle", moving: false, step: 1.7,
    hitFlash: 0, shake: 0, deathTime: 0, opacity: 1, scale: 1,
    knockbackX: 0, knockbackY: 0, contactCooldown: 0, hitStunRemaining: 0,
  });
  assert.equal(createEnemyInstance("unknown", { x: 0, y: 0 }, "none"), null);
  assert.equal(createEnemyInstance("toString", { x: 0, y: 0 }, "none"), null);
});
