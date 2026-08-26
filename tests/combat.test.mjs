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

test("기본 공격은 확정된 64픽셀·120도 범위를 제공한다", () => {
  assert.deepEqual(attackDefinition("basic"), {
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

test("strong attack exposes the approved combat behavior", () => {
  assert.deepEqual(attackDefinition("strong"), {
    damage: 3,
    cooldown: 4,
    range: 96,
    arcDegrees: 150,
    windup: 0.22,
    duration: 0.4,
    mpCost: 20,
    knockback: 520,
    hitStun: 0.18,
    hitStop: 0.065,
  });
});
