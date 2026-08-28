import test from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG as C } from "../src/config.js";
import { PixelRPG } from "../src/game-20260828-classes.js";
import { createEnemyInstance } from "../src/enemies.js";
import { applyPlayerSlow, createCombatStatusEffects, playerMovementMultiplier } from "../src/player-combat.js";

function statusGame() {
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "village";
  game.inputEnabled = true;
  game.chatInputActive = false;
  game.keys = new Set(["ArrowRight"]);
  game.player = {
    x: 1440,
    y: 1110,
    prevX: 1440,
    prevY: 1110,
    moving: false,
    step: 0,
    dir: "right",
    respawnTimer: 0,
    statusEffects: createCombatStatusEffects(),
  };
  game.isInteractionOpen = () => false;
  return game;
}

test("둔화된 플레이어의 ArrowRight 1초 이동은 속도 배율을 사용한다", () => {
  const game = statusGame();
  applyPlayerSlow(game.player, 0.65, 2.5);

  game.updatePlayerMovement(1);

  assert.equal(game.player.x, 1440 + C.PLAYER_SPEED * 0.65);
  assert.equal(game.player.y, 1110);
});

test("직업 이동속도가 있으면 공통 기본값 대신 현재 직업 속도를 사용한다", () => {
  const game = statusGame();
  game.player.speed = 265;

  game.updatePlayerMovement(1);

  assert.equal(game.player.x, 1440 + 265);
  assert.equal(game.player.y, 1110);
});

test("세계 전환은 플레이어 둔화를 제거한다", () => {
  const game = statusGame();
  applyPlayerSlow(game.player, 0.65, 2.5);
  game.projectiles = [{ id: "before-switch" }];
  game.explosionEffects = [{ id: "before-switch-effect" }];
  game.hitStopRemaining = 0.065;
  game.remotePlayers = new Map();
  game.ui = { playerCount: { textContent: "" } };
  game.camera = { x: 0, y: 0, prevX: 0, prevY: 0 };
  game.drawMinimapBase = () => {};
  game.updateBiome = () => {};
  game.notify = () => {};

  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
  globalThis.document = {
    createElement() {
      const context = new Proxy({}, {
        get(target, property) {
          if (!(property in target)) target[property] = () => ({ addColorStop() {} });
          return target[property];
        },
      });
      return { getContext: () => context };
    },
  };

  game.switchWorld("forest", 2160, 3260, false);

  assert.equal(playerMovementMultiplier(game.player), 1);
  assert.deepEqual(game.player.statusEffects, createCombatStatusEffects());
  assert.equal(game.hitStopRemaining, 0);
  assert.deepEqual(game.projectiles, []);
  assert.deepEqual(game.explosionEffects, []);
});

test("같은 공격 ID의 상어 피해 이벤트는 플레이어 HP를 한 번만 낮춘다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { hp: 100 };
  game.processedEnemyAttackIds = new Set();
  game.damagePlayer = amount => {
    game.player.hp -= amount;
    return { applied: true };
  };

  game.applyEnemyEvents([
    { type: "damage-player", enemyId: "fang-1", attackId: "fang-1:1", amount: 50, source: { x: 0, y: 0 } },
    { type: "damage-player", enemyId: "fang-1", attackId: "fang-1:1", amount: 50, source: { x: 0, y: 0 } },
  ]);

  assert.equal(game.player.hp, 50);
  assert.deepEqual([...game.processedEnemyAttackIds], ["fang-1:1"]);
});

test("치명적인 적 피해 뒤의 이벤트는 처리하거나 공격 ID를 기록하지 않는다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.processedEnemyAttackIds = new Set();
  let calls = 0;
  game.damagePlayer = () => ({ applied: true, died: ++calls === 1 });

  game.applyEnemyEvents([
    { type: "damage-player", enemyId: "fang-1", attackId: "fang-1:1", amount: 50, source: { x: 0, y: 0 } },
    { type: "damage-player", enemyId: "boar-1", attackId: "boar-1:1", amount: 45, source: { x: 10, y: 0 } },
  ]);

  assert.equal(calls, 1);
  assert.deepEqual([...game.processedEnemyAttackIds], ["fang-1:1"]);
});

test("알 수 없는 적 이벤트는 게임 상태를 바꾸지 않는다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { hp: 100 };
  game.processedEnemyAttackIds = new Set();
  game.damagePlayer = () => assert.fail("unknown event must not damage the player");

  game.applyEnemyEvents([{ type: "unknown", attackId: "ignored" }]);

  assert.equal(game.player.hp, 100);
  assert.deepEqual([...game.processedEnemyAttackIds], []);
});

test("능력형 적은 기존 접촉 피해를 사용하지 않고 종별 접촉 쿨다운을 사용한다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { x: 0, y: 0 };
  const abilityEnemy = { x: 0, y: 0, radius: 20, state: "idle", contactCooldown: 0, contactMode: "ability" };
  const contactEnemy = {
    x: 0, y: 0, radius: 20, state: "idle", contactCooldown: 0,
    contactMode: "contact", contactDamage: 12, contactCooldownDuration: 1.2,
  };
  game.enemies = [abilityEnemy, contactEnemy];
  let calls = 0;
  game.damagePlayer = () => ({ applied: ++calls === 1, died: false });

  game.applyEnemyContactDamage();

  assert.equal(calls, 1);
  assert.equal(contactEnemy.contactCooldown, 1.2);
});

test("사라진 불꽃 도깨비는 기존 접촉 피해 경로에서도 피해를 주지 않는다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { x: 0, y: 0 };
  game.enemies = [{
    x: 0, y: 0, radius: 16, state: "vanish", targetable: false,
    contactMode: "contact", contactCooldown: 0, contactDamage: 60, contactCooldownDuration: 1.2,
  }];
  game.damagePlayer = () => assert.fail("vanished enemy must not use contact damage");

  game.applyEnemyContactDamage();

  assert.equal(game.enemies[0].contactCooldown, 0);
});

test("피격 경직 중인 몬스터는 플레이어와 겹쳐도 접촉 피해를 주지 않는다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { x: 0, y: 0 };
  game.enemies = [{
    x: 0, y: 0, radius: 20, state: "idle", targetable: true,
    contactMode: "contact", contactCooldown: 0, contactDamage: 12,
    contactCooldownDuration: 1, hitStunRemaining: 0.1,
  }];
  game.damagePlayer = () => assert.fail("stunned enemy must not use contact damage");

  game.applyEnemyContactDamage();

  assert.equal(game.enemies[0].contactCooldown, 0);
});

test("targetable이 false인 적은 플레이어 공격의 대상이 아니다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { x: 0, y: 0, dir: "right" };
  game.enemies = [{ state: "idle", targetable: false, x: 10, y: 0 }];
  game.damageNumbers = [];
  game.recordEnemyKill = () => assert.fail("untargetable enemy must not award a kill");
  game.commitEnemyKillEffects = () => {};

  game.applyAttackHits({ range: 100, arcDegrees: 180, damage: 10, knockback: 0 });

  assert.equal(game.enemies[0].state, "idle");
});

test("실제 명중은 공격 종류가 포함된 충격 효과와 피해 숫자를 만든다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { x: 0, y: 0, dir: "right" };
  game.enemies = [createEnemyInstance("moss-troll", { x: 120, y: 0 }, "troll-hit")];
  game.hitEffects = [];
  game.damageNumbers = [];
  game.hitStopRemaining = 0;
  game.recordEnemyKill = () => assert.fail("one point of damage must not kill the troll");
  game.commitEnemyKillEffects = () => {};

  game.applyAttackHits({
    range: 96, arcDegrees: 150, damage: 1, knockback: 0,
    hitStun: 0.18, hitStop: 0.065,
  }, "strong");

  assert.equal(game.enemies[0].hp, 99);
  assert.equal(game.hitEffects.length, 1);
  assert.equal(game.hitEffects[0].kind, "strong");
  assert.equal(game.damageNumbers[0].kind, "strong");
  assert.equal(game.enemies[0].hitStunRemaining, 0.18);
  assert.equal(game.hitStopRemaining, 0.065);
});

test("빗나간 공격은 히트 스톱을 만들지 않고 치명타와 다중 명중은 한 번의 길이만 유지한다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { x: 0, y: 0, dir: "right" };
  game.hitEffects = [];
  game.damageNumbers = [];
  game.hitStopRemaining = 0;
  game.recordEnemyKill = () => null;
  game.commitEnemyKillEffects = () => {};
  const definition = {
    range: 96, arcDegrees: 150, damage: 10, knockback: 0,
    hitStun: 0.18, hitStop: 0.065,
  };

  game.enemies = [createEnemyInstance("moss-troll", { x: 500, y: 0 }, "miss")];
  game.applyAttackHits(definition, "strong");
  assert.equal(game.hitStopRemaining, 0);

  game.enemies = [
    createEnemyInstance("fire-slime", { x: 60, y: -10 }, "lethal-1"),
    createEnemyInstance("fire-slime", { x: 60, y: 10 }, "lethal-2"),
  ];
  game.applyAttackHits(definition, "strong");
  assert.equal(game.enemies.every(enemy => enemy.state === "dying"), true);
  assert.equal(game.hitStopRemaining, 0.065);
});

test("분열 이벤트는 지도별 동적 ID로 안전한 위치의 자식만 한 번 추가한다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "volcano";
  game.enemies = [];
  game.processedEnemyAttackIds = new Set();
  game.player = { x: 0, y: 0, hp: 100 };
  game.damagePlayer = () => assert.fail("split events must not damage the player");

  game.applyEnemyEvents([{
    type: "spawn-enemies", enemyId: "volcano-enemy-9", kind: "magma-slime-small",
    count: 3, childHp: 3, origin: { x: 950, y: 2500 },
  }]);

  assert.ok(game.enemies.length > 0 && game.enemies.length <= 3);
  assert.deepEqual(
    game.enemies.map(enemy => enemy.id),
    game.enemies.map((_, index) => `volcano-dynamic-${index + 1}`),
  );
  for (const child of game.enemies) {
    assert.deepEqual(
      { kind: child.kind, hp: child.hp, maxHp: child.maxHp, generation: child.generation, contactDamage: child.contactDamage },
      { kind: "magma-slime-small", hp: 3, maxHp: 3, generation: 1, contactDamage: 20 },
    );
  }

  const childCount = game.enemies.length;
  game.applyEnemyEvents([{
    type: "spawn-enemies", enemyId: "volcano-enemy-9", kind: "magma-slime-small",
    count: 3, childHp: 3, origin: { x: 950, y: 2500 },
  }]);
  assert.equal(game.enemies.length, childCount);

  const parent = createEnemyInstance("magma-slime", { x: 1, y: 1 }, "parent");
  assert.equal(parent.generation, 0);
});

test("유효한 포자 둔화 이벤트만 실제 플레이어 상태에 적용하고 성공시에만 알린다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { respawnTimer: 0, statusEffects: createCombatStatusEffects() };
  game.enemies = [];
  const notices = [];
  game.notify = message => notices.push(message);

  game.applyEnemyEvents([{ type: "apply-player-status", enemyId: "bug-1", status: "slow", multiplier: 0.65, duration: 2.5 }]);
  assert.equal(playerMovementMultiplier(game.player), 0.65);
  assert.equal(game.player.statusEffects.slow.remaining, 2.5);
  assert.deepEqual(notices, ["포자에 노출되어 이동속도가 감소했습니다."]);

  game.applyEnemyEvents([{ type: "apply-player-status", enemyId: "bug-1", status: "slow", multiplier: 0.65, duration: 2.5 }]);
  assert.equal(game.player.statusEffects.slow.remaining, 2.5);
  assert.equal(game.player.statusEffects.slow.multiplier, 0.65);
  assert.equal(notices.length, 2);
});

test("놓친 포자와 잘못된 상태 이벤트는 플레이어 상태나 알림을 바꾸지 않는다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.player = { respawnTimer: 1, statusEffects: createCombatStatusEffects() };
  game.enemies = [];
  const notices = [];
  game.notify = message => notices.push(message);
  const before = structuredClone(game.player.statusEffects);

  game.applyEnemyEvents([
    { type: "apply-player-status", enemyId: "bug-1", status: "slow", multiplier: 0.65, duration: 2.5 },
    { type: "apply-player-status", enemyId: "bug-1", status: "poison", multiplier: 0.65, duration: 2.5 },
    { type: "apply-player-status", enemyId: "bug-1", status: "slow", multiplier: 0, duration: 2.5 },
    { type: "apply-player-status", enemyId: "bug-1", status: "slow", multiplier: 0.65, duration: 0 },
    { type: "unknown", status: "slow", multiplier: 0.65, duration: 2.5 },
  ]);

  assert.deepEqual(game.player.statusEffects, before);
  assert.deepEqual(notices, []);
});
