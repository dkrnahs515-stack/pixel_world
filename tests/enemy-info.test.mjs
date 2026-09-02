import test from "node:test";
import assert from "node:assert/strict";
import * as enemies from "../src/enemies-20260829-coast.js";

const { createEnemyInstance, damageEnemy, updateEnemies } = enemies;

function shouldShowEnemyInfo(...args) {
  assert.equal(typeof enemies.shouldShowEnemyInfo, "function");
  return enemies.shouldShowEnemyInfo(...args);
}

function enemy(kind = "fang-shark") {
  return createEnemyInstance(kind, { x: 100, y: 100 }, `info-${kind}`);
}

test("몬스터 정보는 플레이어와 420픽셀 이내에서만 기본 표시된다", () => {
  const candidate = enemy();

  assert.equal(shouldShowEnemyInfo(candidate, { x: 520, y: 100 }), true);
  assert.equal(shouldShowEnemyInfo(candidate, { x: 520.01, y: 100 }), false);
});

test("피격된 몬스터 정보는 원거리에서도 3초 동안 유지된다", () => {
  const candidate = enemy();
  const distantPlayer = { x: 1000, y: 1000 };

  damageEnemy(candidate, 1, { x: 1, y: 0 }, 0);
  assert.equal(shouldShowEnemyInfo(candidate, distantPlayer), true);

  updateEnemies([candidate], distantPlayer, 2.99, { isBlocked: () => false });
  assert.equal(shouldShowEnemyInfo(candidate, distantPlayer), true);

  updateEnemies([candidate], distantPlayer, 0.01, { isBlocked: () => false });
  assert.equal(shouldShowEnemyInfo(candidate, distantPlayer), false);
});

test("사망·위장·잠복·순간이동 비노출 상태는 이름과 체력을 숨긴다", () => {
  const player = { x: 100, y: 100 };
  const dying = enemy();
  dying.state = "dying";
  const camouflaged = enemy("moss-troll");
  camouflaged.camouflaged = true;
  const burrowing = enemy("ancient-boar");
  burrowing.behaviorState = "telegraph";
  const vanished = enemy("flame-imp");
  vanished.behaviorState = "vanish";

  assert.equal(shouldShowEnemyInfo(dying, player), false);
  assert.equal(shouldShowEnemyInfo(camouflaged, player), false);
  assert.equal(shouldShowEnemyInfo(burrowing, player), false);
  assert.equal(shouldShowEnemyInfo(vanished, player), false);
});
