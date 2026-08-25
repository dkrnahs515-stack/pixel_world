import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPlayerDamage,
  applyPlayerSlow,
  createCombatStatusEffects,
  playerMovementMultiplier,
  respawnPlayer,
  tickPlayerStatus,
} from "../src/player-combat.js";

function player(overrides = {}) {
  return {
    x: 1500,
    y: 1200,
    prevX: 1500,
    prevY: 1200,
    hp: 100,
    maxHp: 100,
    mp: 40,
    maxMp: 100,
    invulnerable: 0,
    hitFlash: 0,
    respawnTimer: 0,
    ...overrides,
  };
}

test("contact damage reduces HP and starts one second of invulnerability", () => {
  const target = player();
  assert.deepEqual(applyPlayerDamage(target, 10), { applied: true, died: false });
  assert.equal(target.hp, 90);
  assert.equal(target.invulnerable, 1);
  assert.equal(target.hitFlash, 0.18);
});

test("damage is ignored during invulnerability", () => {
  const target = player({ invulnerable: 0.5 });
  assert.deepEqual(applyPlayerDamage(target, 10), { applied: false, died: false });
  assert.equal(target.hp, 100);
});

test("lethal damage starts the 1.2 second respawn countdown", () => {
  const target = player({ hp: 10 });
  assert.deepEqual(applyPlayerDamage(target, 10), { applied: true, died: true });
  assert.equal(target.hp, 0);
  assert.equal(target.respawnTimer, 1.2);
});

test("status timers count down without becoming negative", () => {
  const target = player({ invulnerable: 0.5, hitFlash: 0.1 });
  tickPlayerStatus(target, 0.2);
  assert.equal(target.invulnerable, 0.3);
  assert.equal(target.hitFlash, 0);
});

test("포자 둔화는 0.65 배율로 적용되고 중첩 없이 시간을 갱신한다", () => {
  const target = player({ statusEffects: createCombatStatusEffects() });

  assert.equal(applyPlayerSlow(target, 0.65, 2.5), true);
  tickPlayerStatus(target, 1);
  assert.equal(playerMovementMultiplier(target), 0.65);
  assert.equal(target.statusEffects.slow.remaining, 1.5);

  assert.equal(applyPlayerSlow(target, 0.8, 2.5), true);
  assert.equal(target.statusEffects.slow.multiplier, 0.65);
  assert.equal(target.statusEffects.slow.remaining, 2.5);
});

test("포자 둔화는 유효하지 않은 값이나 부활 중인 대상에게 적용하지 않는다", () => {
  const target = player({ statusEffects: createCombatStatusEffects() });
  const before = structuredClone(target.statusEffects);

  for (const [multiplier, duration] of [[0, 2.5], [1.01, 2.5], [Infinity, 2.5], [0.65, 0], [0.65, Infinity]]) {
    assert.equal(applyPlayerSlow(target, multiplier, duration), false);
    assert.deepEqual(target.statusEffects, before);
  }

  target.respawnTimer = 1;
  assert.equal(applyPlayerSlow(target, 0.65, 2.5), false);
  assert.deepEqual(target.statusEffects, before);
});

test("둔화는 시간이 끝나거나 부활하면 정상 속도로 복원된다", () => {
  const target = player({ statusEffects: createCombatStatusEffects() });

  applyPlayerSlow(target, 0.65, 0.1);
  tickPlayerStatus(target, 0.2);
  assert.equal(playerMovementMultiplier(target), 1);
  assert.deepEqual(target.statusEffects, createCombatStatusEffects());

  applyPlayerSlow(target, 0.65, 2.5);
  respawnPlayer(target);
  assert.equal(playerMovementMultiplier(target), 1);
  assert.deepEqual(target.statusEffects, createCombatStatusEffects());
});

test("respawn restores position, HP, MP, and frame history", () => {
  const target = player({ hp: 0, mp: 0, respawnTimer: 0.01 });
  respawnPlayer(target);
  assert.deepEqual(
    { x: target.x, y: target.y, prevX: target.prevX, prevY: target.prevY },
    { x: 1440, y: 1110, prevX: 1440, prevY: 1110 },
  );
  assert.equal(target.hp, 100);
  assert.equal(target.mp, 100);
  assert.equal(target.respawnTimer, 0);
});

test("respawn accepts the safe-world spawn selected by the game", () => {
  const target = player({ hp: 0, mp: 0, respawnTimer: 0.01 });
  respawnPlayer(target, { x: 320, y: 480 });
  assert.deepEqual(
    { x: target.x, y: target.y, prevX: target.prevX, prevY: target.prevY },
    { x: 320, y: 480, prevX: 320, prevY: 480 },
  );
  assert.equal(target.hp, 100);
  assert.equal(target.mp, 100);
});

test("부활은 레벨에서 갱신된 최대 HP와 MP까지 회복한다", () => {
  const target = {
    x: 0, y: 0, prevX: 0, prevY: 0,
    hp: 0, maxHp: 120, mp: 1, maxMp: 110,
    invulnerable: 1, hitFlash: 1, respawnTimer: 1,
  };
  respawnPlayer(target, { x: 4, y: 5 });
  assert.equal(target.hp, 120);
  assert.equal(target.mp, 110);
});
