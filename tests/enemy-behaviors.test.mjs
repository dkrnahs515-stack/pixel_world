import test from "node:test";
import assert from "node:assert/strict";
import { createEnemyInstance, damageEnemy } from "../src/enemies-20260829-coast-20260905-upgrade.js";
import { updateEnemyBehavior } from "../src/enemy-behaviors-20260905-upgrade.js";

function enemyOf(kind, overrides = {}) {
  return Object.assign(
    createEnemyInstance(kind, { x: 0, y: 0 }, `${kind}-1`),
    overrides,
  );
}

function openContext() {
  return {
    isBlocked: () => false,
    moveEnemy(enemy, dx, dy) {
      enemy.x += dx;
      enemy.y += dy;
      return true;
    },
  };
}

test("송곳니 상어는 0.55초 예고 뒤 고정 방향으로 돌진해 한 번 피해를 준다", () => {
  const shark = enemyOf("fang-shark");
  updateEnemyBehavior(shark, { x: 200, y: 0 }, 0.01, openContext());
  assert.equal(shark.behaviorState, "telegraph");
  assert.deepEqual(shark.lockedDirection, { x: 1, y: 0 });

  updateEnemyBehavior(shark, { x: 0, y: 200 }, 0.54, openContext());
  assert.equal(shark.behaviorState, "attack");

  const firstSource = sourceAtCurrentPosition(shark);
  const first = updateEnemyBehavior(shark, { x: shark.x + 5, y: shark.y }, 0.1, openContext());
  const second = updateEnemyBehavior(shark, { x: shark.x + 5, y: shark.y }, 0.1, openContext());
  assertDamageEvent(first.events[0], {
    enemyId: shark.id,
    attackId: `${shark.id}:1`,
    amount: 50,
    source: firstSource,
  });
  assert.deepEqual(firstSource, { x: shark.x, y: shark.y });
  assert.equal(second.events.length, 0);
  assert.equal(shark.attackSequence, 1);
});

test("해적선 상어는 62픽셀 안에서 0.35초 물기를 예고한다", () => {
  const shark = enemyOf("pirate-shark");
  updateEnemyBehavior(shark, { x: 50, y: 0 }, 0.01, openContext());
  assert.equal(shark.behaviorState, "telegraph");
  updateEnemyBehavior(shark, { x: 50, y: 0 }, 0.34, openContext());
  assert.equal(shark.behaviorState, "attack");

  const source = sourceAtCurrentPosition(shark);
  const result = updateEnemyBehavior(shark, { x: 30, y: 0 }, 0.1, openContext());
  assertDamageEvent(result.events[0], {
    enemyId: shark.id,
    attackId: `${shark.id}:1`,
    amount: 55,
    source,
  });
  assert.deepEqual(source, { x: shark.x, y: shark.y });
});

test("해적선 상어는 정확히 62픽셀에서만 물기 예고를 시작한다", () => {
  const atRange = enemyOf("pirate-shark");
  updateEnemyBehavior(atRange, { x: 62, y: 0 }, 0.01, openContext());
  assert.equal(atRange.behaviorState, "telegraph");

  const outsideRange = enemyOf("pirate-shark");
  const result = updateEnemyBehavior(outsideRange, { x: 62.01, y: 0 }, 0.01, openContext());
  assert.equal(outsideRange.behaviorState, "idle");
  assert.deepEqual(result.events, []);
});

test("해적선 상어 물기는 고정된 120도 전방 부채꼴 경계를 지킨다", () => {
  const inside = attackingPirate();
  const boundary = pointAtDegrees(60);
  const insideSource = sourceAtCurrentPosition(inside);
  const insideResult = updateEnemyBehavior(inside, boundary, 0.01, openContext());
  assertDamageEvent(insideResult.events[0], {
    enemyId: inside.id,
    attackId: `${inside.id}:1`,
    amount: 55,
    source: insideSource,
  });
  assert.deepEqual(insideSource, { x: inside.x, y: inside.y });

  const outside = attackingPirate();
  const outsideResult = updateEnemyBehavior(outside, pointAtDegrees(60.1), 0.01, openContext());
  assert.deepEqual(outsideResult.events, []);
});

test("해적선 상어 물기의 총 전진 거리는 34픽셀을 넘지 않는다", () => {
  const shark = attackingPirate();
  const result = updateEnemyBehavior(shark, { x: 100, y: 0 }, 1, openContext());

  assert.ok(Math.hypot(shark.x, shark.y) <= 34);
  assert.equal(shark.behaviorState, "cooldown");
  assert.deepEqual(result.events, []);
});

test("큰 dt 돌진은 이동 경로의 첫 충돌 위치에서 한 번만 피해를 준다", () => {
  const cases = [
    ["fang-shark", 0.45, { x: 100, y: 0 }, { x: 66, y: 0 }, 50],
    ["pirate-shark", 0.18, { x: 40, y: 0 }, { x: 5, y: 0 }, 55],
    ["ancient-boar", 0.5, { x: 100, y: 0 }, { x: 63, y: 0 }, 45],
  ];

  for (const [kind, dt, player, source, amount] of cases) {
    const enemy = enemyOf(kind, {
      behaviorState: "attack",
      lockedDirection: { x: 1, y: 0 },
      attackSequence: 1,
    });
    const result = updateEnemyBehavior(enemy, player, dt, openContext());

    assert.equal(result.events.length, 1, kind);
    assertDamageEvent(result.events[0], {
      enemyId: enemy.id,
      attackId: `${enemy.id}:1`,
      amount,
      source,
    });
    assert.deepEqual({ x: enemy.x, y: enemy.y }, source);
  }
});

test("송곳니와 해적선 상어는 첫 충돌 뒤 다음 프레임에 다시 움직이지 않는다", () => {
  const cases = [
    ["fang-shark", { x: 60, y: 0 }, 0.2, { x: 26, y: 0 }],
    ["pirate-shark", { x: 40, y: 0 }, 0.1, { x: 5, y: 0 }],
  ];

  for (const [kind, player, firstDt, source] of cases) {
    const enemy = enemyOf(kind, {
      behaviorState: "attack",
      lockedDirection: { x: 1, y: 0 },
      attackSequence: 1,
    });
    const first = updateEnemyBehavior(enemy, player, firstDt, openContext());
    assert.equal(first.events.length, 1, kind);
    assertPointClose({ x: enemy.x, y: enemy.y }, source);
    assertPointClose(first.events[0].source, source);

    const second = updateEnemyBehavior(enemy, player, 0.1, openContext());
    assert.deepEqual(second.events, []);
    assertPointClose({ x: enemy.x, y: enemy.y }, source);
    assert.equal(enemy.behaviorState, "cooldown");
  }
});

test("이동이 억제된 겹침 돌진은 피해 없이 시간을 소비하고 일반 겹침은 적중한다", () => {
  const suppressed = enemyOf("fang-shark", {
    behaviorState: "attack",
    lockedDirection: { x: 1, y: 0 },
    attackSequence: 1,
  });
  const suppressedResult = updateEnemyBehavior(suppressed, { x: 0, y: 0 }, 0.45, {
    ...openContext(),
    suppressMovement: true,
  });
  assert.deepEqual(suppressedResult.events, []);
  assert.deepEqual({ x: suppressed.x, y: suppressed.y }, { x: 0, y: 0 });
  assert.equal(suppressed.behaviorState, "cooldown");

  const normal = enemyOf("fang-shark", {
    behaviorState: "attack",
    lockedDirection: { x: 1, y: 0 },
    attackSequence: 1,
  });
  const normalResult = updateEnemyBehavior(normal, { x: 0, y: 0 }, 0.1, openContext());
  assert.equal(normalResult.events.length, 1);
  assert.deepEqual(normalResult.events[0].source, { x: 0, y: 0 });
});

test("알 수 없는 행동은 이벤트 없이 기존 이동으로 위임한다", () => {
  const enemy = enemyOf("fang-shark", { behavior: "unknown-behavior" });
  assert.deepEqual(updateEnemyBehavior(enemy, { x: 10, y: 0 }, 0.1, openContext()), {
    handled: false,
    events: [],
  });
});

test("큰 dt도 같은 공격의 피해 이벤트를 두 번 만들지 않는다", () => {
  const shark = enemyOf("fang-shark", {
    behaviorState: "telegraph",
    behaviorTime: 0.5,
    lockedDirection: { x: 1, y: 0 },
    attackSequence: 1,
  });
  const source = sourceAtCurrentPosition(shark);
  const result = updateEnemyBehavior(shark, { x: 5, y: 0 }, 1.2, openContext());
  assert.equal(result.events.length, 1);
  assertDamageEvent(result.events[0], {
    enemyId: shark.id,
    attackId: `${shark.id}:1`,
    amount: 50,
    source,
  });
  assert.deepEqual(source, { x: shark.x, y: shark.y });
  assert.equal(shark.behaviorState, "cooldown");
});

test("송곳니 상어는 유휴 프레임의 dt를 예고·공격·쿨다운까지 소비한다", () => {
  const exactBoundary = enemyOf("fang-shark");
  const exact = updateEnemyBehavior(exactBoundary, { x: 100, y: 0 }, 1, openContext());
  assert.equal(exact.events.length, 1);
  assert.equal(exactBoundary.behaviorState, "cooldown");
  assertClose(exactBoundary.cooldownRemaining, 2.4);

  const intoCooldown = enemyOf("fang-shark");
  const first = updateEnemyBehavior(intoCooldown, { x: 100, y: 0 }, 1.1, openContext());
  assert.equal(first.events.length, 1);
  assertDamageEvent(first.events[0], {
    enemyId: intoCooldown.id,
    attackId: `${intoCooldown.id}:1`,
    amount: 50,
    source: { x: 66, y: 0 },
  });
  assert.equal(intoCooldown.behaviorState, "cooldown");
  assertClose(intoCooldown.cooldownRemaining, 2.3);

  const veryLarge = enemyOf("fang-shark");
  const many = updateEnemyBehavior(veryLarge, { x: 100, y: 0 }, 340.1, openContext());
  assert.equal(many.events.length, 100);
  assert.equal(new Set(many.events.map(event => event.attackId)).size, 100);
  assert.equal(veryLarge.behaviorState, "telegraph");
  assertClose(veryLarge.behaviorTime, 0.1);
  assert.equal(veryLarge.cooldownRemaining, 0);
});

test("불꽃 도깨비는 0.4초 동안 사라진 뒤 안전한 후보에서 0.25초 재등장한다", () => {
  const imp = enemyOf("flame-imp");
  const player = { x: 300, y: 0 };
  const randomValues = [0, 0, 0.5, 0];
  const context = {
    ...openContext(),
    random: () => randomValues.shift(),
    portals: [{ x: 410, y: 0 }],
  };

  updateEnemyBehavior(imp, player, 0.01, context);
  assert.equal(imp.behaviorState, "vanish");
  assert.equal(imp.targetable, false);

  updateEnemyBehavior(imp, player, 0.39, context);
  assert.equal(imp.behaviorState, "reappear");
  assert.equal(imp.targetable, false);
  assert.ok(Math.abs(imp.x - 190) < 1e-9);
  assert.ok(Math.abs(imp.y) < 1e-9);
  assert.ok(Math.hypot(imp.x - player.x, imp.y - player.y) >= 80);
  assert.ok(Math.hypot(imp.x - 410, imp.y) >= 180);

  const reappearing = updateEnemyBehavior(imp, player, 0.25, context);
  assert.equal(imp.behaviorState, "cooldown");
  assert.equal(imp.targetable, true);
  assert.equal(imp.cooldownRemaining, 3);
  assert.deepEqual(reappearing.events, []);

  updateEnemyBehavior(imp, player, 3, context);
  assert.equal(imp.behaviorState, "idle");
  updateEnemyBehavior(imp, player, 0.01, context);
  assert.equal(imp.behaviorState, "vanish");
});

test("불꽃 도깨비는 여덟 후보가 모두 막히면 원래 위치에 재등장한다", () => {
  const imp = enemyOf("flame-imp", { x: 30, y: 40 });
  let randomCalls = 0;
  const context = {
    ...openContext(),
    isBlocked: () => true,
    random: () => {
      randomCalls += 1;
      return 0;
    },
    portals: [],
  };
  updateEnemyBehavior(imp, { x: 300, y: 0 }, 0.01, context);
  const result = updateEnemyBehavior(imp, { x: 300, y: 0 }, 0.39, context);

  assert.equal(imp.behaviorState, "reappear");
  assert.deepEqual({ x: imp.x, y: imp.y }, { x: 30, y: 40 });
  assert.equal(randomCalls, 16);
  assert.deepEqual(result.events, []);
});

test("불꽃 도깨비 순간이동은 포털 사각형 중심 안전거리와 180픽셀 경계를 사용한다", () => {
  const rejected = enemyOf("flame-imp");
  let unsafeCalls = 0;
  const unsafeCenterContext = {
    ...openContext(),
    random: () => [0, 6 / 7][unsafeCalls++ % 2],
    portals: [{ x: -20, y: 0, w: 100, h: 100 }],
  };
  updateEnemyBehavior(rejected, { x: 0, y: 0 }, 0.01, unsafeCenterContext);
  updateEnemyBehavior(rejected, { x: 0, y: 0 }, 0.39, unsafeCenterContext);
  assert.deepEqual({ x: rejected.x, y: rejected.y }, { x: 0, y: 0 });

  const accepted = enemyOf("flame-imp");
  let boundaryCalls = 0;
  const boundaryContext = {
    ...openContext(),
    random: () => [0, 1][boundaryCalls++ % 2],
    portals: [{ x: 0, y: 0 }],
  };
  updateEnemyBehavior(accepted, { x: 0, y: 0 }, 0.01, boundaryContext);
  updateEnemyBehavior(accepted, { x: 0, y: 0 }, 0.39, boundaryContext);
  assert.deepEqual({ x: accepted.x, y: accepted.y }, { x: 180, y: 0 });
});

test("송곳니 상어는 쿨다운 뒤 두 번째 공격에도 새 ID로 한 번만 피해를 준다", () => {
  const shark = enemyOf("fang-shark");
  const playerNearShark = () => ({ x: shark.x + 5, y: shark.y });

  updateEnemyBehavior(shark, playerNearShark(), 0.01, openContext());
  updateEnemyBehavior(shark, playerNearShark(), 0.54, openContext());
  const firstSource = sourceAtCurrentPosition(shark);
  const first = updateEnemyBehavior(shark, playerNearShark(), 0.1, openContext());
  assertDamageEvent(first.events[0], {
    enemyId: shark.id,
    attackId: `${shark.id}:1`,
    amount: 50,
    source: firstSource,
  });
  assert.deepEqual(firstSource, { x: shark.x, y: shark.y });

  updateEnemyBehavior(shark, playerNearShark(), 0.36, openContext());
  assert.equal(shark.behaviorState, "cooldown");
  updateEnemyBehavior(shark, playerNearShark(), shark.cooldownRemaining, openContext());
  assert.equal(shark.behaviorState, "idle");

  updateEnemyBehavior(shark, playerNearShark(), 0.01, openContext());
  updateEnemyBehavior(shark, playerNearShark(), 0.54, openContext());
  const secondSource = sourceAtCurrentPosition(shark);
  const second = updateEnemyBehavior(shark, playerNearShark(), 0.1, openContext());
  assertDamageEvent(second.events[0], {
    enemyId: shark.id,
    attackId: `${shark.id}:2`,
    amount: 50,
    source: secondSource,
  });
  assert.deepEqual(secondSource, { x: shark.x, y: shark.y });
  assert.notEqual(first.events[0].attackId, second.events[0].attackId);
  assert.equal(first.events.length, 1);
  assert.equal(second.events.length, 1);
});

test("고대 멧돼지는 정확히 330픽셀에서 잠복하고 고정 방향으로 한 번 돌진한다", () => {
  const boar = enemyOf("ancient-boar");
  updateEnemyBehavior(boar, { x: 330, y: 0 }, 0.01, openContext());
  assert.equal(boar.behaviorState, "telegraph");
  assert.equal(boar.targetable, false);
  assert.deepEqual(boar.lockedDirection, { x: 1, y: 0 });

  updateEnemyBehavior(boar, { x: 0, y: 330 }, 0.69, openContext());
  assert.equal(boar.behaviorState, "attack");
  const result = updateEnemyBehavior(boar, { x: boar.x + 5, y: boar.y }, 1, openContext());
  assert.equal(result.events.length, 1);
  assertDamageEvent(result.events[0], {
    enemyId: boar.id,
    attackId: `${boar.id}:1`,
    amount: 45,
    source: { x: 0, y: 0 },
  });
  assert.equal(boar.behaviorState, "cooldown");
  assert.equal(boar.targetable, true);
  assert.equal(boar.cooldownRemaining, 2.9);

  const outside = enemyOf("ancient-boar");
  assert.deepEqual(updateEnemyBehavior(outside, { x: 330.01, y: 0 }, 0.01, openContext()).events, []);
  assert.equal(outside.behaviorState, "idle");
  assert.equal(outside.targetable, true);
});

test("고대 멧돼지는 장애물에 돌진이 막혀도 대상 가능 상태를 복원한다", () => {
  const boar = enemyOf("ancient-boar", {
    behaviorState: "attack",
    lockedDirection: { x: 1, y: 0 },
    attackSequence: 1,
    targetable: false,
  });
  const result = updateEnemyBehavior(boar, { x: 5, y: 0 }, 0.5, {
    ...openContext(),
    moveEnemy: () => false,
  });

  assert.deepEqual(result.events, []);
  assert.equal(boar.behaviorState, "cooldown");
  assert.equal(boar.targetable, true);
  assert.equal(boar.cooldownRemaining, 3.4);
});

test("고대 멧돼지는 적중 즉시 돌진을 끝내고 쿨다운으로 전환한다", () => {
  const boar = enemyOf("ancient-boar", {
    behaviorState: "attack",
    lockedDirection: { x: 1, y: 0 },
    attackSequence: 1,
    targetable: false,
  });
  const result = updateEnemyBehavior(boar, { x: 5, y: 0 }, 0.1, openContext());

  assert.equal(result.events.length, 1);
  assert.equal(boar.behaviorState, "cooldown");
  assert.equal(boar.targetable, true);
  assert.equal(boar.cooldownRemaining, 3.4);
});

test("이끼 트롤은 280픽셀 밖에서만 위장하고 접근하면 즉시 드러난다", () => {
  const troll = enemyOf("moss-troll");
  updateEnemyBehavior(troll, { x: 280.01, y: 0 }, 0.01, openContext());
  assert.equal(troll.camouflaged, true);
  assert.equal(troll.opacity, 0.25);

  updateEnemyBehavior(troll, { x: 280, y: 0 }, 0.01, openContext());
  assert.equal(troll.camouflaged, false);
  assert.equal(troll.opacity, 1);

  troll.state = "returning";
  updateEnemyBehavior(troll, { x: 500, y: 0 }, 0.01, openContext());
  assert.equal(troll.camouflaged, true);
  troll.state = "chasing";
  updateEnemyBehavior(troll, { x: 500, y: 0 }, 0.01, openContext());
  assert.equal(troll.camouflaged, false);
});

test("이끼 트롤은 피격 뒤 3초를 제외한 시간만 초당 4씩 재생하고 최대 HP를 넘지 않는다", () => {
  const troll = enemyOf("moss-troll", { hp: 80, maxHp: 100, lastDamagedAgo: 0 });
  updateEnemyBehavior(troll, { x: 500, y: 0 }, 3, openContext());
  assert.equal(troll.hp, 80);
  updateEnemyBehavior(troll, { x: 500, y: 0 }, 1, openContext());
  assert.equal(troll.hp, 84);
  updateEnemyBehavior(troll, { x: 500, y: 0 }, 10, openContext());
  assert.equal(troll.hp, 100);

  damageEnemy(troll, 1, { x: 1, y: 0 }, 0);
  assert.equal(troll.lastDamagedAgo, 0);
  assert.equal(troll.camouflaged, false);
  updateEnemyBehavior(troll, { x: 500, y: 0 }, 3, openContext());
  assert.equal(troll.hp, 99);
});

test("고대 버섯충은 정확히 240픽셀에서 예고 후 반경 120의 플레이어에게만 한 번 둔화를 요청한다", () => {
  const bug = enemyOf("ancient-mushroom-bug");
  updateEnemyBehavior(bug, { x: 240, y: 0 }, 0.01, openContext());
  assert.equal(bug.behaviorState, "telegraph");
  const result = updateEnemyBehavior(bug, { x: 120, y: 0 }, 2, openContext());
  assert.deepEqual(result.events, [{
    type: "apply-player-status", enemyId: bug.id,
    status: "slow", multiplier: 0.65, duration: 2.5,
  }]);
  assert.equal(bug.behaviorState, "cooldown");
  assertClose(bug.cooldownRemaining, 2.59);

  const outsideTrigger = enemyOf("ancient-mushroom-bug");
  updateEnemyBehavior(outsideTrigger, { x: 240.01, y: 0 }, 0.01, openContext());
  assert.equal(outsideTrigger.behaviorState, "idle");

  const missed = enemyOf("ancient-mushroom-bug");
  updateEnemyBehavior(missed, { x: 240, y: 0 }, 0.01, openContext());
  assert.deepEqual(updateEnemyBehavior(missed, { x: 120.01, y: 0 }, 0.6, openContext()).events, []);
  assert.equal(missed.behaviorState, "cooldown");
});

test("불꽃 도깨비는 유휴 프레임의 dt를 사라짐·재등장·쿨다운 경계 너머로 소비한다", () => {
  const player = { x: 300, y: 0 };
  const context = { ...openContext(), random: () => 0, portals: [] };

  const exactBoundary = enemyOf("flame-imp");
  const exact = updateEnemyBehavior(exactBoundary, player, 0.65, context);
  assert.deepEqual(exact.events, []);
  assert.equal(exactBoundary.behaviorState, "cooldown");
  assert.equal(exactBoundary.targetable, true);
  assertClose(exactBoundary.cooldownRemaining, 3);

  const afterCooldown = enemyOf("flame-imp");
  const surplus = updateEnemyBehavior(afterCooldown, player, 3.75, context);
  assert.deepEqual(surplus.events, []);
  assert.equal(afterCooldown.behaviorState, "vanish");
  assert.equal(afterCooldown.targetable, false);
  assertClose(afterCooldown.behaviorTime, 0.1);
  assert.equal(afterCooldown.cooldownRemaining, 0);

  const veryLarge = enemyOf("flame-imp");
  const many = updateEnemyBehavior(veryLarge, player, 36.55, context);
  assert.deepEqual(many.events, []);
  assert.equal(veryLarge.behaviorState, "vanish");
  assert.equal(veryLarge.targetable, false);
  assertClose(veryLarge.behaviorTime, 0.05);
  assert.equal(veryLarge.cooldownRemaining, 0);
});

test("고대 버섯충은 유휴 프레임의 dt를 예고·둔화·쿨다운까지 소비한다", () => {
  const player = { x: 100, y: 0 };

  const exactBoundary = enemyOf("ancient-mushroom-bug");
  const exact = updateEnemyBehavior(exactBoundary, player, 0.6, openContext());
  assert.equal(exact.events.length, 1);
  assert.equal(exactBoundary.behaviorState, "cooldown");
  assertClose(exactBoundary.cooldownRemaining, 4);

  const intoCooldown = enemyOf("ancient-mushroom-bug");
  const first = updateEnemyBehavior(intoCooldown, player, 0.7, openContext());
  assert.equal(first.events.length, 1);
  assert.deepEqual(first.events[0], {
    type: "apply-player-status",
    enemyId: intoCooldown.id,
    status: "slow",
    multiplier: 0.65,
    duration: 2.5,
  });
  assert.equal(intoCooldown.behaviorState, "cooldown");
  assertClose(intoCooldown.cooldownRemaining, 3.9);

  const veryLarge = enemyOf("ancient-mushroom-bug");
  const many = updateEnemyBehavior(veryLarge, player, 46.1, openContext());
  assert.equal(many.events.length, 10);
  assert.ok(many.events.every(event => event.type === "apply-player-status"));
  assert.equal(veryLarge.behaviorState, "telegraph");
  assertClose(veryLarge.behaviorTime, 0.1);
  assert.equal(veryLarge.cooldownRemaining, 0);
});

function attackingPirate() {
  return enemyOf("pirate-shark", {
    behaviorState: "attack",
    lockedDirection: { x: 1, y: 0 },
    attackSequence: 1,
  });
}

function pointAtDegrees(degrees, distance = 30) {
  const radians = degrees * Math.PI / 180;
  return { x: Math.cos(radians) * distance, y: Math.sin(radians) * distance };
}

function sourceAtCurrentPosition(enemy) {
  return { x: enemy.x, y: enemy.y };
}

function assertPointClose(actual, expected) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-9);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-9);
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not close to ${expected}`);
}

function assertDamageEvent(event, { enemyId, attackId, amount, source }) {
  assert.equal(event.type, "damage-player");
  assert.equal(event.enemyId, enemyId);
  assert.equal(event.attackId, attackId);
  assert.ok(event.attackId.length > 0);
  assert.equal(event.amount, amount);
  assert.deepEqual(event.source, source);
}
