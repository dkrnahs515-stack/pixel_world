import test from "node:test";
import assert from "node:assert/strict";
import {
  applyEnemyHitStun,
  createEnemies,
  createEnemyInstance,
  createBossEnemyView,
  createMagmaChildren,
  damageEnemy,
  formatHealthValue,
  updateEnemies,
} from "../src/enemies-20260829-coast.js";

test("the safe village never creates enemies", () => {
  assert.deepEqual(createEnemies("village"), []);
});

test("each exterior region creates its approved enemy roster", () => {
  const volcano = createEnemies("volcano");
  const forest = createEnemies("forest");
  const coast = [
    "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
  ].flatMap(mapId => createEnemies(mapId));

  assert.equal(volcano.length, 13);
  assert.equal(forest.length, 16);
  assert.equal(coast.length, 14);
  assert.deepEqual(
    new Set(forest.map(enemy => enemy.kind)),
    new Set(["forest-slime", "boar", "ancient-boar", "moss-troll", "ancient-mushroom-bug"]),
  );
  assert.deepEqual(
    new Set(coast.map(enemy => enemy.kind)),
    new Set(["crab", "water-slime", "fang-shark", "pirate-shark"]),
  );
  assert.deepEqual(countKinds(volcano, ["magma-slime", "flame-imp"]), [3, 2]);
  assert.deepEqual(countKinds(coast, ["fang-shark", "pirate-shark"]), [3, 2]);
  assert.deepEqual(countKinds(forest, ["ancient-boar", "moss-troll", "ancient-mushroom-bug"]), [2, 2, 3]);
});

test("enemy species receive distinct combat stats", () => {
  const fire = createEnemies("volcano")[0];
  const boar = createEnemies("forest").find(enemy => enemy.kind === "boar");
  const crab = createEnemies("coast-beach").find(enemy => enemy.kind === "crab");
  assert.deepEqual({ hp: fire.hp, damage: fire.contactDamage }, { hp: 4, damage: 12 });
  assert.deepEqual({ hp: boar.hp, speed: boar.speed }, { hp: 6, speed: 112 });
  assert.deepEqual({ hp: crab.hp, radius: crab.radius }, { hp: 5, radius: 20 });
});

test("협동 보스 view는 기존 행동과 외형을 유지하며 공유 상태를 덮어쓴다", () => {
  const view = createBossEnemyView(
    { id: "coast-core-shark", name: "심해 코어 포식자", enemyKind: "pirate-shark" },
    { bossId: "coast-core-shark", x: 500, y: 600, hp: 70, maxHp: 120, status: "alive" },
  );
  assert.equal(view.kind, "pirate-shark");
  assert.equal(view.name, "심해 코어 포식자");
  assert.equal(view.hp, 70);
  assert.equal(view.maxHp, 120);
  assert.equal(view.scale, 1.55);
  assert.equal(view.isCoopBoss, true);
  assert.equal(view.targetable, true);
});

test("a nearby player makes an enemy chase at its species speed", () => {
  const enemy = createEnemies("volcano")[0];
  const { enemies: [updated], events } = updateEnemies(
    [enemy],
    { x: enemy.x + 100, y: enemy.y },
    0.1,
    { isBlocked: () => false },
  );
  assert.ok(Math.abs(updated.x - (enemy.homeX + 9.2)) < 1e-9);
  assert.equal(updated.state, "chasing");
  assert.deepEqual(events, []);
});

test("damage applies hit feedback and death fade to every species", () => {
  const enemy = createEnemies("forest").find(candidate => candidate.kind === "boar");
  const result = damageEnemy(enemy, enemy.hp, { x: 1, y: 0 }, 520);
  assert.equal(result.killed, true);
  assert.equal(enemy.state, "dying");
  assert.equal(enemy.knockbackX, 0);
  assert.equal(updateEnemies([enemy], { x: 0, y: 0 }, 0.66, { isBlocked: () => false }).enemies.length, 0);
});

test("소수 피해는 한 자리로 정규화하고 0 이하에서 처치한다", () => {
  const enemy = createEnemyInstance("fire-slime", { x: 0, y: 0 }, "fraction", { hp: 3 });
  const first = damageEnemy(enemy, 1.3, { x: 1, y: 0 }, 0);
  assert.equal(enemy.hp, 1.7);
  assert.equal(first.damageNumber.value, 1.3);
  const lethal = damageEnemy(enemy, 2.2, { x: 1, y: 0 }, 0);
  assert.equal(enemy.hp, 0);
  assert.equal(enemy.state, "dying");
  assert.equal(lethal.killed, true);
  assert.equal(formatHealthValue(8), "8");
  assert.equal(formatHealthValue(8.7), "8.7");
  assert.equal(formatHealthValue(8.76), "8.8");
  assert.equal(formatHealthValue(-0.1), "0");
});

test("연속 소수 피해에 부동소수점 오차가 누적되지 않는다", () => {
  const enemy = createEnemyInstance("magma-slime", { x: 0, y: 0 }, "decimal", { hp: 10 });
  for (let hit = 0; hit < 3; hit += 1) damageEnemy(enemy, 1.3, { x: 1, y: 0 }, 0);
  assert.equal(enemy.hp, 6.1);
});

test("치명타를 받은 마그마 슬라임 시체는 사망 연출과 분열까지 죽은 위치에 고정된다", () => {
  const parent = createEnemyInstance("magma-slime", { x: 100, y: 100 }, "magma-parent");
  damageEnemy(parent, parent.hp, { x: 1, y: 0 }, 520, () => 0);

  const simulation = updateEnemies([parent], { x: 0, y: 0 }, 0.65, { isBlocked: () => false });

  assert.deepEqual({ x: parent.x, y: parent.y }, { x: 100, y: 100 });
  assert.deepEqual(simulation.events[0].origin, { x: 100, y: 100 });
});

test("치명타가 아닌 적은 기존 넉백 이동을 유지한다", () => {
  const enemy = createEnemyInstance("crab", { x: 100, y: 100 }, "crab");
  damageEnemy(enemy, 1, { x: 1, y: 0 }, 200);

  updateEnemies([enemy], { x: 1000, y: 1000 }, 0.1, { isBlocked: () => false });

  assert.equal(enemy.x, 120);
  assert.equal(enemy.y, 100);
  assert.ok(enemy.knockbackX > 0);
});

test("피격 경직은 AI 추적을 멈추지만 기존 넉백 이동은 유지한다", () => {
  const enemy = createEnemyInstance("crab", { x: 100, y: 100 }, "stunned-crab");
  damageEnemy(enemy, 1, { x: 1, y: 0 }, 200);
  applyEnemyHitStun(enemy, 0.1);

  updateEnemies([enemy], { x: 140, y: 100 }, 0.05, { isBlocked: () => false });

  assert.equal(enemy.x, 110);
  assert.equal(enemy.y, 100);
  assert.equal(enemy.moving, false);
  assert.ok(Math.abs(enemy.hitStunRemaining - 0.05) < 1e-9);
});

test("더 짧은 재피격과 잘못된 지속시간은 남은 경직을 줄이지 않는다", () => {
  const enemy = createEnemyInstance("crab", { x: 100, y: 100 }, "stunned-crab");

  assert.equal(applyEnemyHitStun(enemy, 0.18), true);
  assert.equal(applyEnemyHitStun(enemy, 0.1), true);
  assert.equal(applyEnemyHitStun(enemy, 0), false);
  assert.equal(enemy.hitStunRemaining, 0.18);

  damageEnemy(enemy, enemy.hp, { x: 1, y: 0 }, 0);
  assert.equal(applyEnemyHitStun(enemy, 0.18), false);
  assert.equal(enemy.hitStunRemaining, 0.18);
});

test("blocked terrain prevents enemy knockback", () => {
  const enemy = createEnemies("coast-beach")[0];
  damageEnemy(enemy, 1, { x: 1, y: 0 }, 230);
  const { enemies: [updated] } = updateEnemies([enemy], { x: enemy.x + 100, y: enemy.y }, 0.1, { isBlocked: () => true });
  assert.equal(updated.x, enemy.homeX);
  assert.equal(updated.y, enemy.homeY);
});

test("송곳니 상어는 막힌 돌진을 안전하게 끝내고 이벤트를 만들지 않는다", () => {
  const shark = createEnemies("coast-wreck-bay").find(enemy => enemy.kind === "fang-shark");
  shark.behaviorState = "attack";
  shark.lockedDirection = { x: 1, y: 0 };
  const simulation = updateEnemies(
    [shark],
    { x: shark.x + 5, y: shark.y },
    0.1,
    { isBlocked: () => true },
  );
  assert.equal(shark.behaviorState, "cooldown");
  assert.deepEqual(simulation.events, []);
});

test("대각선 돌진은 X축·Y축·종점 중 어느 하나만 막혀도 위치를 바꾸지 않는다", () => {
  const cases = [
    ["X-axis leg", (x, y) => x > 0 && y === 0],
    ["Y-axis leg", (x, y) => x === 0 && y > 0],
    ["final endpoint", (x, y) => x > 0 && y > 0],
  ];

  for (const [name, isBlocked] of cases) {
    const shark = chargingDiagonally(`${name}-shark`);
    const simulation = updateEnemies([shark], { x: -500, y: -500 }, 0.1, { isBlocked });

    assert.deepEqual({ x: shark.x, y: shark.y }, { x: 0, y: 0 }, name);
    assert.equal(shark.behaviorState, "cooldown", name);
    assert.deepEqual(simulation.events, [], name);
  }
});

test("비어 있는 대각선 돌진은 두 좌표를 함께 이동한다", () => {
  const shark = chargingDiagonally("clear-diagonal-shark");
  const simulation = updateEnemies([shark], { x: -500, y: -500 }, 0.1, {
    isBlocked: () => false,
  });
  const expected = 42 * Math.SQRT1_2;

  assert.ok(Math.abs(shark.x - expected) < 1e-9);
  assert.ok(Math.abs(shark.y - expected) < 1e-9);
  assert.equal(shark.behaviorState, "attack");
  assert.deepEqual(simulation.events, []);
});

test("알 수 없는 행동은 기존 추적 이동으로 폴백한다", () => {
  const enemy = createEnemies("coast-beach")[0];
  enemy.behavior = "unknown-behavior";
  const startX = enemy.x;
  const simulation = updateEnemies(
    [enemy],
    { x: enemy.x + 100, y: enemy.y },
    0.1,
    { isBlocked: () => false },
  );
  assert.equal(simulation.enemies[0].x, startX + enemy.speed * 0.1);
  assert.deepEqual(simulation.events, []);
});

test("마그마 슬라임은 사망 순간 난수 경계로 분열 수와 자식 HP를 한 번만 정한다", () => {
  for (const [sample, count, childHp] of [[0, 2, 5], [0.5, 3, 3]]) {
    const parent = createEnemyInstance("magma-slime", { x: 100, y: 100 }, `parent-${count}`);
    damageEnemy(parent, 10, { x: 1, y: 0 }, 0, () => sample);
    const first = updateEnemies([parent], { x: 0, y: 0 }, 0.66, {
      isBlocked: () => false,
      random: () => 0.999999,
      portals: [],
    });

    assert.deepEqual(first.events, [{
      type: "spawn-enemies", enemyId: `parent-${count}`, kind: "magma-slime-small",
      count, childHp, origin: { x: 100, y: 100 },
    }]);
    assert.equal(first.enemies.length, 0);
    assert.deepEqual(updateEnemies([parent], { x: 0, y: 0 }, 1, {
      isBlocked: () => false, random: () => sample, portals: [],
    }).events, []);
  }
});

test("분열 자식은 유효한 후보에만 생성되고 동적 ID를 낭비하거나 재분열하지 않는다", () => {
  let sequence = 0;
  const children = createMagmaChildren({
    type: "spawn-enemies", enemyId: "parent", kind: "magma-slime-small",
    count: 3, childHp: 3, origin: { x: 0, y: 0 },
  }, {
    isBlocked: (x, y) => Math.abs(x + 34) > 1e-9 || Math.abs(y) > 1e-9,
    createId: () => `child-${++sequence}`,
  });

  assert.deepEqual(children.map(child => ({
    id: child.id, kind: child.kind, hp: child.hp, generation: child.generation, x: child.x, y: child.y,
  })), [{ id: "child-1", kind: "magma-slime-small", hp: 3, generation: 1, x: -34, y: 0 }]);
  damageEnemy(children[0], 3, { x: 0, y: 1 }, 0, () => 0);
  assert.deepEqual(updateEnemies(children, { x: 0, y: 0 }, 0.66, {
    isBlocked: () => false, random: () => 0, portals: [],
  }).events, []);
});

test("분열 요청 수는 정수 0~3으로 제한하고 잘못된 값은 ID를 소비하지 않는다", () => {
  const createChildren = count => {
    let ids = 0;
    const children = createMagmaChildren({
      type: "spawn-enemies", enemyId: "parent", kind: "magma-slime-small",
      count, childHp: 3, origin: { x: 0, y: 0 },
    }, {
      isBlocked: () => false,
      createId: () => `child-${++ids}`,
    });
    return { children, ids };
  };

  const oversized = createChildren(99);
  assert.equal(oversized.children.length, 3);
  assert.deepEqual(oversized.children.map(child => child.id), ["child-1", "child-2", "child-3"]);

  const fractional = createChildren(2.8);
  assert.equal(fractional.children.length, 2);
  assert.deepEqual(fractional.children.map(child => child.id), ["child-1", "child-2"]);

  for (const count of [0, -1, Number.NaN, "3"]) {
    const invalid = createChildren(count);
    assert.deepEqual(invalid.children, []);
    assert.equal(invalid.ids, 0);
  }
});

test("불꽃 도깨비는 순간이동 쿨다운 중에도 종별 고속 추적을 유지한다", () => {
  const imp = createEnemyInstance("flame-imp", { x: 0, y: 0 }, "imp", {
    behaviorState: "cooldown",
  });
  imp.behaviorState = "cooldown";
  imp.cooldownRemaining = 3;
  const simulation = updateEnemies([imp], { x: 100, y: 0 }, 0.1, {
    isBlocked: () => false, random: () => 0, portals: [],
  });

  assert.equal(simulation.enemies[0].x, 14.8);
  assert.equal(simulation.enemies[0].behaviorState, "cooldown");
  assert.equal(simulation.enemies[0].contactCooldownDuration, 1.2);
});

test("불꽃 도깨비가 같은 프레임에 재등장해도 전체 dt만큼 추적 이동하지 않는다", () => {
  const imp = createEnemyInstance("flame-imp", { x: 0, y: 0 }, "imp");
  updateEnemies([imp], { x: 300, y: 0 }, 0.65, {
    isBlocked: () => false,
    random: () => 0,
    portals: [],
  });

  assert.deepEqual({ x: imp.x, y: imp.y }, { x: 410, y: 0 });
  assert.equal(imp.behaviorState, "cooldown");
  assert.ok(Math.abs(imp.cooldownRemaining - 3) < 1e-9);
});

test("이끼 트롤의 접촉 피해는 1.2초 간격을 유지한다", () => {
  const troll = createEnemyInstance("moss-troll", { x: 0, y: 0 }, "troll");
  assert.equal(troll.contactMode, "contact");
  assert.equal(troll.contactCooldownDuration, 1.2);
});

test("이끼 트롤 위장은 최종 이동 상태를 따르고 재생은 프레임마다 한 번만 적용한다", () => {
  const troll = createEnemyInstance("moss-troll", { x: 0, y: 0 }, "troll", {
    hp: 80,
    maxHp: 100,
  });
  troll.lastDamagedAgo = 2.9;

  updateEnemies([troll], { x: 300, y: 0 }, 0.2, { isBlocked: () => false });
  assert.equal(troll.state, "chasing");
  assert.equal(troll.camouflaged, false);
  assert.equal(troll.opacity, 1);
  assert.ok(Math.abs(troll.hp - 80.4) < 1e-9);

  updateEnemies([troll], { x: 500, y: 0 }, 0.1, { isBlocked: () => false });
  assert.equal(troll.state, "returning");
  assert.equal(troll.camouflaged, true);
  assert.equal(troll.opacity, 0.25);
  assert.ok(Math.abs(troll.hp - 80.8) < 1e-9);

  const atBoundary = createEnemyInstance("moss-troll", { x: 0, y: 0 }, "boundary");
  updateEnemies([atBoundary], { x: 280, y: 0 }, 0.01, { isBlocked: () => false });
  assert.equal(atBoundary.state, "chasing");
  assert.equal(atBoundary.camouflaged, false);
  assert.equal(atBoundary.opacity, 1);
});

test("넉백 중인 상어도 예고와 공격 시간을 진행하되 능력 이동을 중복하지 않는다", () => {
  const shark = createEnemyInstance("fang-shark", { x: 0, y: 0 }, "shark");
  shark.behaviorState = "telegraph";
  shark.behaviorTime = 0.5;
  shark.lockedDirection = { x: 1, y: 0 };
  shark.knockbackX = 100;

  updateEnemies([shark], { x: 1000, y: 0 }, 0.05, { isBlocked: () => false });
  assert.equal(shark.behaviorState, "attack");
  assert.equal(shark.x, 5);

  shark.knockbackX = 100;
  updateEnemies([shark], { x: 1000, y: 0 }, 0.45, { isBlocked: () => false });
  assert.equal(shark.behaviorState, "cooldown");
  assert.equal(shark.x, 50);
});

test("넉백 중인 이끼 트롤 재생은 경과 시간마다 한 번만 적용된다", () => {
  const troll = createEnemyInstance("moss-troll", { x: 0, y: 0 }, "troll", {
    hp: 80,
    maxHp: 100,
  });
  troll.lastDamagedAgo = 2.9;
  troll.knockbackX = 100;

  updateEnemies([troll], { x: 1000, y: 0 }, 0.2, { isBlocked: () => false });

  assert.ok(Math.abs(troll.hp - 80.4) < 1e-9);
});

test("넉백 중 완료된 불꽃 도깨비 사라짐은 순간이동을 미루고 해제 뒤 한 번만 이동한다", () => {
  const imp = createEnemyInstance("flame-imp", { x: 0, y: 0 }, "imp");
  imp.behaviorState = "vanish";
  imp.behaviorTime = 0.39;
  imp.targetable = false;
  imp.knockbackX = 100;
  const context = { isBlocked: () => false, random: () => 0, portals: [] };

  updateEnemies([imp], { x: 300, y: 0 }, 0.1, context);
  assert.deepEqual({ x: imp.x, y: imp.y }, { x: 10, y: 0 });
  assert.equal(imp.behaviorState, "vanish");
  assert.equal(imp.behaviorTime, 0.4);
  assert.equal(imp.targetable, false);

  imp.knockbackX = 0;
  updateEnemies([imp], { x: 300, y: 0 }, 0.01, context);
  assert.deepEqual({ x: imp.x, y: imp.y }, { x: 410, y: 0 });
  assert.equal(imp.behaviorState, "reappear");
  assert.equal(imp.targetable, false);
});

function chargingDiagonally(id) {
  const shark = createEnemyInstance("fang-shark", { x: 0, y: 0 }, id);
  shark.behaviorState = "attack";
  shark.lockedDirection = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  shark.attackSequence = 1;
  return shark;
}

function countKinds(enemies, kinds) {
  return kinds.map(kind => enemies.filter(enemy => enemy.kind === kind).length);
}
