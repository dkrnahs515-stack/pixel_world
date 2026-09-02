import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260829-coast.js";
import { createEnemyInstance } from "../src/enemies-20260829-coast.js";
import { createInitialProgress } from "../src/quest-state-20260829-coast.js";

function fakeNode() {
  return {
    textContent: "",
    hidden: false,
    style: {},
    classList: {
      values: new Set(),
      contains(value) { return this.values.has(value); },
      toggle(value, enabled) {
        if (enabled) this.values.add(value);
        else this.values.delete(value);
      },
    },
  };
}

function combatGame(classId, weaponId) {
  const game = Object.create(PixelRPG.prototype);
  game.classId = classId;
  game.running = true;
  game.inputEnabled = true;
  game.portalTransition = null;
  game.attackState = null;
  game.basicCooldown = 0;
  game.strongCooldown = 0;
  game.projectiles = [];
  game.explosionEffects = [];
  game.projectileSequence = 0;
  game.processedProjectileHitIds = new Set();
  game.player = {
    classId,
    equippedWeaponId: weaponId,
    x: 100,
    y: 100,
    dir: "right",
    moving: false,
    mp: 140,
    maxMp: 140,
    respawnTimer: 0,
  };
  game.enemies = [];
  game.damageNumbers = [];
  game.hitEffects = [];
  game.hitStopRemaining = 0;
  game.isInteractionOpen = () => false;
  game.updateHud = () => {};
  game.notify = message => { game.lastNotice = message; };
  game.recordEnemyKill = () => null;
  game.commitEnemyKillEffects = () => {};
  return game;
}

test("세션 직업은 현재 레벨 능력치·이동속도·마지막 직업 장비를 복구한다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.progress = {
    ...createInitialProgress(),
    level: 30,
    nextLevelExp: 3000,
    equipmentByClass: {
      ...createInitialProgress().equipmentByClass,
      archer: {
        ownedWeaponIds: ["training-bow", "hunter-bow"],
        equippedWeaponId: "hunter-bow",
      },
    },
  };
  game.player = {};

  game.configureClassSession("archer");

  assert.equal(game.classId, "archer");
  assert.equal(game.player.classId, "archer");
  assert.equal(game.player.speed, 265);
  assert.equal(game.player.hp, 390);
  assert.equal(game.player.maxHp, 390);
  assert.equal(game.player.mp, 245);
  assert.equal(game.player.maxMp, 245);
  assert.equal(game.player.equippedWeaponId, "hunter-bow");
  assert.equal(Object.hasOwn(game.progress, "classId"), false);
});

test("알 수 없는 세션 직업은 검사와 시작 검으로 복구된다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.progress = createInitialProgress();
  game.player = {};

  game.configureClassSession("unknown");

  assert.equal(game.classId, "warrior");
  assert.equal(game.player.classId, "warrior");
  assert.equal(game.player.speed, 230);
  assert.equal(game.player.equippedWeaponId, "starter-sword");
});

test("검사 Ctrl은 근접 공격 상태를 만들고 Q는 MP를 써서 360도 적을 한 번씩 맞힌다", () => {
  const game = combatGame("warrior", "starter-sword");
  game.tryAttack("basic");
  assert.equal(game.attackState.definition.delivery, "melee");
  assert.equal(game.projectiles.length, 0);

  game.attackState = null;
  game.basicCooldown = 0;
  game.enemies = [
    createEnemyInstance("moss-troll", { x: 150, y: 100 }, "front"),
    createEnemyInstance("moss-troll", { x: 50, y: 100 }, "back"),
  ];
  game.tryAttack("strong");
  game.updateAttack(0.22);

  assert.equal(game.player.mp, 120);
  assert.equal(game.strongCooldown, 4);
  assert.deepEqual(game.enemies.map(enemy => enemy.hp), [98, 98]);
});

for (const scenario of [
  { classId: "archer", weaponId: "training-bow", kind: "basic", projectileKind: "arrow", mp: 140 },
  { classId: "archer", weaponId: "training-bow", kind: "strong", projectileKind: "piercing-arrow", mp: 115 },
  { classId: "mage", weaponId: "training-staff", kind: "basic", projectileKind: "magic-bolt", mp: 140 },
  { classId: "mage", weaponId: "training-staff", kind: "strong", projectileKind: "explosive-bolt", mp: 110 },
]) {
  test(`${scenario.classId} ${scenario.kind} 공격은 플레이어 밖에서 ${scenario.projectileKind} 한 발을 만든다`, () => {
    const game = combatGame(scenario.classId, scenario.weaponId);
    game.tryAttack(scenario.kind);

    assert.equal(game.attackState?.definition.delivery, "projectile");
    assert.equal(game.projectiles.length, 1);
    assert.equal(game.projectiles[0].kind, scenario.projectileKind);
    assert.ok(Math.hypot(game.projectiles[0].x - game.player.x, game.projectiles[0].y - game.player.y) > 14);
    assert.equal(game.player.mp, scenario.mp);
  });
}

test("원거리 공격 자세는 지속시간 뒤 끝나며 근접 판정을 만들지 않는다", () => {
  const game = combatGame("archer", "training-bow");
  game.enemies = [createEnemyInstance("moss-troll", { x: 130, y: 100 }, "near")];
  const hpBefore = game.enemies[0].hp;
  game.tryAttack("basic");
  game.updateAttack(1);
  assert.equal(game.attackState, null);
  assert.equal(game.enemies[0].hp, hpBefore);
});

test("MP 부족과 재사용 대기 중에는 직업 Q 투사체를 만들지 않는다", () => {
  const noMp = combatGame("mage", "training-staff");
  noMp.player.mp = 29;
  noMp.tryAttack("strong");
  assert.equal(noMp.projectiles.length, 0);
  assert.match(noMp.lastNotice, /MP/);

  const cooldown = combatGame("archer", "training-bow");
  cooldown.strongCooldown = 1;
  cooldown.tryAttack("strong");
  assert.equal(cooldown.projectiles.length, 0);
  assert.match(cooldown.lastNotice, /1\.0초/);
});

test("투사체 피해 이벤트는 같은 적에게 한 번만 기존 피해·경직 효과를 적용한다", () => {
  const game = combatGame("archer", "training-bow");
  game.enemies = [createEnemyInstance("moss-troll", { x: 150, y: 100 }, "target")];
  const event = {
    projectileId: "p1",
    enemyId: "target",
    kind: "piercing-arrow",
    damage: 1.98,
    knockback: 230,
    directionX: 1,
    directionY: 0,
    hitStun: 0.18,
    hitStop: 0.065,
  };

  game.applyProjectileHits([event, event]);

  assert.equal(game.enemies[0].hp, 98);
  assert.equal(game.enemies[0].hitStunRemaining, 0.18);
  assert.equal(game.damageNumbers.length, 1);
  assert.equal(game.hitEffects.length, 1);
});

test("투사체 초기화는 이동 중인 탄과 폭발 효과·중복 처리 기록을 함께 제거한다", () => {
  const game = combatGame("mage", "training-staff");
  game.projectiles = [{ id: "p1" }];
  game.explosionEffects = [{ id: "e1" }];
  game.processedProjectileHitIds.add("p1:enemy");

  game.clearProjectiles();

  assert.deepEqual(game.projectiles, []);
  assert.deepEqual(game.explosionEffects, []);
  assert.equal(game.processedProjectileHitIds.size, 0);
});

test("HUD는 현재 직업 Q 이름과 MP 비용을 사용한다", () => {
  const game = combatGame("mage", "training-staff");
  game.player.hp = 80;
  game.player.maxHp = 80;
  game.player.mp = 29;
  game.player.maxMp = 140;
  game.ui = {
    hpText: fakeNode(), mpText: fakeNode(), hpBar: fakeNode(), mpBar: fakeNode(),
    strongSlot: fakeNode(), strongCooldown: fakeNode(),
    strongSkillName: fakeNode(), strongSkillCost: fakeNode(),
  };
  delete game.updateHud;

  game.updateHud();

  assert.equal(game.ui.strongSkillName.textContent, "폭발 마법탄");
  assert.equal(game.ui.strongSkillCost.textContent, "MP 30");
  assert.equal(game.ui.strongSlot.classList.contains("unavailable"), true);
});
