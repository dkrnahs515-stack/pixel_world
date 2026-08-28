import test from "node:test";
import assert from "node:assert/strict";
import {
  attackDefinition,
  directionVector,
  isTargetInAttackArc,
} from "../src/combat.js";

test("directionVector maps all player directions", () => {
  assert.deepEqual(directionVector("up"), { x: 0, y: -1 });
  assert.deepEqual(directionVector("down"), { x: 0, y: 1 });
  assert.deepEqual(directionVector("left"), { x: -1, y: 0 });
  assert.deepEqual(directionVector("right"), { x: 1, y: 0 });
});

test("basic attack includes a close target in front and rejects one behind", () => {
  const origin = { x: 100, y: 100 };
  assert.equal(isTargetInAttackArc(origin, "right", { x: 145, y: 100 }, 52, 100), true);
  assert.equal(isTargetInAttackArc(origin, "right", { x: 70, y: 100 }, 52, 100), false);
});

test("검사 기본 공격은 장착 검의 피해·사거리와 기존 전방 부채꼴을 사용한다", () => {
  assert.deepEqual(attackDefinition("basic", "warrior", "starter-sword"), {
    delivery: "melee",
    damage: 1,
    cooldown: 0.5,
    range: 64,
    arcDegrees: 120,
    windup: 0,
    duration: 0.18,
    mpCost: 0,
    knockback: 230,
    hitStun: 0.1,
    hitStop: 0.035,
  });
});

test("공격 궤적에 몬스터 몸체 가장자리가 닿으면 중심점이 밖이어도 명중한다", () => {
  const origin = { x: 100, y: 100 };

  assert.equal(isTargetInAttackArc(origin, "right", { x: 100, y: 100, radius: 20 }, 64, 120), true);
  assert.equal(isTargetInAttackArc(origin, "right", { x: 184, y: 100, radius: 20 }, 64, 120), true);
  assert.equal(isTargetInAttackArc(origin, "right", { x: 184.01, y: 100, radius: 20 }, 64, 120), false);
});

test("공격각 가장자리도 몬스터 반지름만큼 실제 몸체 교차를 허용한다", () => {
  const origin = { x: 100, y: 100 };
  const targetAtDegrees = degrees => ({
    x: 100 + Math.cos(degrees * Math.PI / 180) * 67,
    y: 100 + Math.sin(degrees * Math.PI / 180) * 67,
    radius: 10,
  });

  assert.equal(isTargetInAttackArc(origin, "right", targetAtDegrees(68), 64, 120), true);
  assert.equal(isTargetInAttackArc(origin, "right", targetAtDegrees(70), 64, 120), false);
});

test("거리와 각도를 동시에 벗어난 원은 부채꼴 모서리와 실제로 교차할 때만 명중한다", () => {
  const origin = { x: 100, y: 100 };
  const targetAt = (distance, degrees) => ({
    x: 100 + Math.cos(degrees * Math.PI / 180) * distance,
    y: 100 + Math.sin(degrees * Math.PI / 180) * distance,
    radius: 28,
  });

  assert.equal(isTargetInAttackArc(origin, "right", targetAt(84, 75), 64, 120), true);
  assert.equal(isTargetInAttackArc(origin, "right", targetAt(90, 78), 64, 120), false);
});

test("attack arc rejects targets outside its range and angle", () => {
  const origin = { x: 100, y: 100 };
  assert.equal(isTargetInAttackArc(origin, "up", { x: 100, y: 47 }, 52, 100), false);
  assert.equal(isTargetInAttackArc(origin, "right", { x: 100, y: 145 }, 52, 100), false);
});

test("검사 Q는 장착 검 피해의 두 배로 360도 회전 베기를 한다", () => {
  assert.deepEqual(attackDefinition("strong", "warrior", "starter-sword"), {
    delivery: "melee",
    damage: 2,
    cooldown: 4,
    range: 92,
    arcDegrees: 360,
    windup: 0.22,
    duration: 0.4,
    mpCost: 20,
    knockback: 520,
    hitStun: 0.18,
    hitStop: 0.065,
  });
});

test("장착 무기는 기본 공격 피해·사거리와 강공격 쿨다운만 바꾼다", () => {
  const basic = attackDefinition("basic", "warrior", "reinforced-masterwork-katana");
  assert.deepEqual(
    {
      damage: basic.damage,
      range: basic.range,
      cooldown: basic.cooldown,
      arcDegrees: basic.arcDegrees,
      hitStun: basic.hitStun,
      hitStop: basic.hitStop,
    },
    {
      damage: 2.5,
      range: 78,
      cooldown: 0.5,
      arcDegrees: 120,
      hitStun: 0.1,
      hitStop: 0.035,
    },
  );
  const strong = attackDefinition("strong", "warrior", "reinforced-katana");
  assert.deepEqual(
    {
      damage: strong.damage,
      range: strong.range,
      cooldown: strong.cooldown,
      mpCost: strong.mpCost,
      hitStun: strong.hitStun,
      hitStop: strong.hitStop,
    },
    {
      damage: 2.6,
      range: 104,
      cooldown: 3.8,
      mpCost: 20,
      hitStun: 0.18,
      hitStop: 0.065,
    },
  );
  assert.equal(attackDefinition("basic", "warrior", "unknown").range, 64);
  assert.equal(attackDefinition("strong", "warrior", "unknown").cooldown, 4);
});

test("궁수 기본 공격과 Q는 활의 투사체 수치를 사용한다", () => {
  const basic = attackDefinition("basic", "archer", "hunter-bow");
  assert.deepEqual({
    delivery: basic.delivery,
    projectileKind: basic.projectileKind,
    cooldown: basic.cooldown,
    damage: basic.damage,
    range: basic.range,
    speed: basic.speed,
    mpCost: basic.mpCost,
  }, {
    delivery: "projectile",
    projectileKind: "arrow",
    cooldown: 0.55,
    damage: 1,
    range: 380,
    speed: 580,
    mpCost: 0,
  });

  const strong = attackDefinition("strong", "archer", "training-bow");
  assert.deepEqual({
    delivery: strong.delivery,
    projectileKind: strong.projectileKind,
    damage: strong.damage,
    range: strong.range,
    speed: strong.speed,
    maxHits: strong.maxHits,
    mpCost: strong.mpCost,
    cooldown: strong.cooldown,
  }, {
    delivery: "projectile",
    projectileKind: "piercing-arrow",
    damage: 1.98,
    range: 486,
    speed: 616,
    maxHits: 5,
    mpCost: 25,
    cooldown: 4.5,
  });
});

test("마법사 기본 공격과 Q는 지팡이의 마법탄·폭발 수치를 사용한다", () => {
  const basic = attackDefinition("basic", "mage", "apprentice-staff");
  assert.deepEqual({
    delivery: basic.delivery,
    projectileKind: basic.projectileKind,
    cooldown: basic.cooldown,
    damage: basic.damage,
    range: basic.range,
    speed: basic.speed,
    mpCost: basic.mpCost,
  }, {
    delivery: "projectile",
    projectileKind: "magic-bolt",
    cooldown: 0.65,
    damage: 1.1,
    range: 315,
    speed: 440,
    mpCost: 0,
  });

  const strong = attackDefinition("strong", "mage", "training-staff");
  assert.deepEqual({
    delivery: strong.delivery,
    projectileKind: strong.projectileKind,
    damage: strong.damage,
    range: strong.range,
    speed: strong.speed,
    explosionRadius: strong.explosionRadius,
    mpCost: strong.mpCost,
    cooldown: strong.cooldown,
  }, {
    delivery: "projectile",
    projectileKind: "explosive-bolt",
    damage: 2.4,
    range: 375,
    speed: 420,
    explosionRadius: 96,
    mpCost: 30,
    cooldown: 5,
  });
});

test("알 수 없는 직업과 다른 직업 무기는 검사 기본 장비로 안전하게 복구한다", () => {
  const definition = attackDefinition("basic", "unknown", "training-bow");
  assert.equal(definition.delivery, "melee");
  assert.equal(definition.damage, 1);
  assert.equal(definition.range, 64);
});
