import test from "node:test";
import assert from "node:assert/strict";
import {
  createProjectile,
  updateProjectiles,
} from "../src/projectile-combat.js";

const openWorld = {
  isBlocked: () => false,
  worldBounds: { width: 2000, height: 1000 },
  enemies: [],
};

function enemy(id, x, y = 100, overrides = {}) {
  return { id, x, y, radius: 12, hp: 10, targetable: true, ...overrides };
}

test("투사체는 생성 시 직업·무기 공격 수치와 정규화 방향을 고정한다", () => {
  const projectile = createProjectile({
    id: "p1",
    kind: "piercing-arrow",
    classId: "archer",
    weaponId: "training-bow",
    x: 20,
    y: 100,
    direction: "right",
  });

  assert.deepEqual({
    id: projectile.id,
    kind: projectile.kind,
    classId: projectile.classId,
    weaponId: projectile.weaponId,
    prevX: projectile.prevX,
    prevY: projectile.prevY,
    x: projectile.x,
    y: projectile.y,
    directionX: projectile.directionX,
    directionY: projectile.directionY,
    speed: projectile.speed,
    maxRange: projectile.maxRange,
    distanceTravelled: projectile.distanceTravelled,
    damage: projectile.damage,
    maxHits: projectile.maxHits,
    hitEnemyIds: projectile.hitEnemyIds,
  }, {
    id: "p1",
    kind: "piercing-arrow",
    classId: "archer",
    weaponId: "training-bow",
    prevX: 20,
    prevY: 100,
    x: 20,
    y: 100,
    directionX: 1,
    directionY: 0,
    speed: 616,
    maxRange: 486,
    distanceTravelled: 0,
    damage: 1.98,
    maxHits: 5,
    hitEnemyIds: [],
  });
});

for (const [kind, classId, weaponId] of [
  ["arrow", "archer", "training-bow"],
  ["magic-bolt", "mage", "training-staff"],
]) {
  test(`${kind}은 큰 dt에서도 선분 위 첫 적만 맞히고 제거된다`, () => {
    const projectile = createProjectile({
      id: kind,
      kind,
      classId,
      weaponId,
      x: 20,
      y: 100,
      direction: "right",
    });
    const enemies = [enemy("first", 100), enemy("second", 200)];
    const result = updateProjectiles([projectile], 0.5, { ...openWorld, enemies });

    assert.deepEqual(result.hits.map(hit => hit.enemyId), ["first"]);
    assert.equal(result.projectiles.length, 0);
    assert.equal(enemies[0].hp, 10);
  });
}

test("관통 화살은 같은 적을 한 번만, 서로 다른 적은 최대 다섯 번 맞힌다", () => {
  const projectile = createProjectile({
    id: "piercing",
    kind: "piercing-arrow",
    classId: "archer",
    weaponId: "training-bow",
    x: 20,
    y: 100,
    direction: "right",
  });
  const enemies = Array.from({ length: 6 }, (_, index) => enemy(`enemy-${index}`, 70 + index * 60));
  const first = updateProjectiles([projectile], 0.25, { ...openWorld, enemies });
  const second = updateProjectiles(first.projectiles, 0.75, { ...openWorld, enemies });

  assert.deepEqual(
    [...first.hits, ...second.hits].map(hit => hit.enemyId),
    ["enemy-0", "enemy-1", "enemy-2", "enemy-3", "enemy-4"],
  );
  assert.equal(second.projectiles.length, 0);
});

test("폭발 마법탄은 첫 적에서 폭발하고 반경 안의 각 적에게 한 번씩 피해 이벤트를 만든다", () => {
  const projectile = createProjectile({
    id: "explosive",
    kind: "explosive-bolt",
    classId: "mage",
    weaponId: "training-staff",
    x: 20,
    y: 100,
    direction: "right",
  });
  const enemies = [
    enemy("trigger", 120),
    enemy("nearby", 175),
    enemy("outside", 240),
    enemy("dead", 130, 100, { hp: 0 }),
    enemy("hidden", 140, 100, { targetable: false }),
  ];
  const result = updateProjectiles([projectile], 0.5, { ...openWorld, enemies });

  assert.equal(result.projectiles.length, 0);
  assert.equal(result.explosions.length, 1);
  assert.equal(result.explosions[0].radius, 96);
  assert.deepEqual(result.hits.map(hit => hit.enemyId), ["trigger", "nearby"]);
  assert.equal(enemies[0].hp, 10);
});

test("폭발 마법탄은 벽·월드 경계·최대 사거리에서도 폭발한다", () => {
  const makeBolt = (id, x = 20, weaponId = "training-staff") => createProjectile({
    id,
    kind: "explosive-bolt",
    classId: "mage",
    weaponId,
    x,
    y: 100,
    direction: "right",
  });

  const wall = updateProjectiles([makeBolt("wall")], 1, {
    ...openWorld,
    isBlocked: x => x >= 100,
  });
  const boundary = updateProjectiles([makeBolt("boundary", 90)], 1, {
    ...openWorld,
    worldBounds: { width: 100, height: 200 },
  });
  const range = updateProjectiles([makeBolt("range")], 1, openWorld);

  assert.equal(wall.explosions.length, 1);
  assert.equal(boundary.explosions.length, 1);
  assert.equal(range.explosions.length, 1);
  assert.equal(range.explosions[0].x, 395);
});

test("일반 투사체는 벽·경계·최대 사거리에서 피해 없이 제거된다", () => {
  const makeArrow = id => createProjectile({
    id,
    kind: "arrow",
    classId: "archer",
    weaponId: "training-bow",
    x: 20,
    y: 100,
    direction: "right",
  });
  const wall = updateProjectiles([makeArrow("wall")], 1, {
    ...openWorld,
    isBlocked: x => x >= 100,
  });
  const boundary = updateProjectiles([makeArrow("boundary")], 1, {
    ...openWorld,
    worldBounds: { width: 100, height: 200 },
  });
  const range = updateProjectiles([makeArrow("range")], 1, openWorld);

  for (const result of [wall, boundary, range]) {
    assert.equal(result.projectiles.length, 0);
    assert.deepEqual(result.hits, []);
    assert.deepEqual(result.explosions, []);
  }
});

test("사망·표적 불가 적은 무시하고 입력 객체와 적 HP를 변경하지 않는다", () => {
  const projectile = createProjectile({
    id: "immutable",
    kind: "arrow",
    classId: "archer",
    weaponId: "training-bow",
    x: 20,
    y: 100,
    direction: "right",
  });
  const enemies = [
    enemy("dead", 70, 100, { hp: 0 }),
    enemy("hidden", 100, 100, { targetable: false }),
    enemy("alive", 140),
  ];
  const snapshot = structuredClone(projectile);
  const result = updateProjectiles([projectile], 0.5, { ...openWorld, enemies });

  assert.deepEqual(result.hits.map(hit => hit.enemyId), ["alive"]);
  assert.deepEqual(projectile, snapshot);
  assert.deepEqual(enemies.map(value => value.hp), [0, 10, 10]);
});

test("협동 보스 충돌은 일반 적과 구분된 targetType으로 보고한다", () => {
  const projectile = createProjectile({
    id: "boss-arrow", kind: "arrow", classId: "archer", weaponId: "training-bow",
    x: 20, y: 100, direction: "right",
  });
  const boss = enemy("coast-core-shark", 100, 100, { isCoopBoss: true, hp: 120 });
  const result = updateProjectiles([projectile], 0.5, { ...openWorld, bosses: [boss] });
  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0].targetType, "coop-boss");
  assert.equal(result.hits[0].enemyId, "coast-core-shark");
  assert.equal(boss.hp, 120);
});

test("비정상 좌표·방향·속도·사거리·수명의 투사체는 즉시 제거한다", () => {
  const valid = createProjectile({
    id: "valid",
    kind: "arrow",
    classId: "archer",
    weaponId: "training-bow",
    x: 20,
    y: 100,
    direction: "right",
  });
  const invalidProjectiles = [
    { ...valid, id: "x", x: Number.NaN },
    { ...valid, id: "direction", directionX: Infinity },
    { ...valid, id: "speed", speed: -1 },
    { ...valid, id: "range", maxRange: Number.NaN },
    { ...valid, id: "lifetime", distanceTravelled: -1 },
    { ...valid, id: "hits", hitEnemyIds: null },
  ];
  const result = updateProjectiles(invalidProjectiles, 1 / 144, openWorld);
  assert.deepEqual(result, { projectiles: [], hits: [], explosions: [] });
});
