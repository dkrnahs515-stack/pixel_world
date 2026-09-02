import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260902-publish.js";

function fixture(classId, weaponId) {
  const requests = [];
  const boss = { id: "coast-core-shark", x: 100, y: 100, radius: 32, hp: 120, targetable: true, isCoopBoss: true };
  const game = Object.create(PixelRPG.prototype);
  game.classId = classId;
  game.mapId = "coast-tide-core-cave";
  game.player = { x: 50, y: 100, dir: "right", equippedWeaponId: weaponId };
  game.enemies = [];
  game.damageNumbers = [];
  game.hitEffects = [];
  game.processedProjectileHitIds = new Set();
  game.requestHitStop = () => {};
  game.commitEnemyKillEffects = () => {};
  game.coopBossController = {
    targetableBoss: () => boss,
    requestHit: payload => { requests.push(payload); return Promise.resolve({ ok: true }); },
  };
  return { game, requests, boss };
}

test("검사 근접 적중은 보스 공격 요청을 한 번 보내고 로컬 HP를 줄이지 않는다", () => {
  const value = fixture("warrior", "starter-sword");
  value.game.attackState = { coopBossRequested: false };
  value.game.applyAttackHits({ damage: 1, range: 70, arcDegrees: 120, knockback: 0, hitStun: 0, hitStop: 0 }, "basic");
  value.game.applyAttackHits({ damage: 1, range: 70, arcDegrees: 120, knockback: 0, hitStun: 0, hitStop: 0 }, "basic");
  assert.equal(value.requests.length, 1);
  assert.equal(value.requests[0].classId, "warrior");
  assert.equal(value.requests[0].player.mapId, "coast-tide-core-cave");
  assert.equal(Object.hasOwn(value.game.player, "mapId"), false);
  assert.equal(Object.hasOwn(value.requests[0], "damage"), false);
  assert.equal(value.boss.hp, 120);
});

for (const scenario of [
  { classId: "archer", weaponId: "training-bow", kind: "arrow", attackKind: "basic" },
  { classId: "mage", weaponId: "training-staff", kind: "explosive-bolt", attackKind: "strong" },
]) {
  test(`${scenario.classId} 투사체 적중은 보스 요청으로만 보낸다`, () => {
    const value = fixture(scenario.classId, scenario.weaponId);
    value.game.applyProjectileHits([{
      projectileId: "p1", enemyId: value.boss.id, targetType: "coop-boss",
      kind: scenario.kind, classId: scenario.classId, weaponId: scenario.weaponId,
      direction: "right", damage: 999,
    }]);
    assert.equal(value.requests.length, 1);
    assert.equal(value.requests[0].attackKind, scenario.attackKind);
    assert.equal(value.requests[0].player.mapId, "coast-tide-core-cave");
    assert.equal(Object.hasOwn(value.game.player, "mapId"), false);
    assert.equal(value.boss.hp, 120);
  });
}

test("같은 보스 피해 eventId는 플레이어 HP에 한 번만 적용하고 삭제한다", async () => {
  const acknowledged = [];
  const current = {
    encounterId: "e", bossId: "coast-core-shark", mapId: "coast-tide-core-cave", status: "alive",
    x: 100, y: 100, hp: 120, maxHp: 120, authorityUid: "host", authorityEpoch: 2,
    leaseUntil: 7000, partySize: 2, contributors: {},
  };
  const game = Object.create(PixelRPG.prototype);
  game.player = { hp: 100 };
  game.network = { uid: "me", coopBoss: { acknowledgePlayerDamage: id => { acknowledged.push(id); return Promise.resolve(); } } };
  game.coopBossController = { snapshot: current, renderableBoss: () => ({ x: 100, y: 100 }) };
  game.processedBossPlayerDamageIds = new Set();
  game.damagePlayer = amount => { game.player.hp -= amount; return { applied: true, died: false }; };
  const event = { eventId: "e:2:1", encounterId: "e", bossId: "coast-core-shark", targetUid: "me", authorityEpoch: 2, damage: 12, createdAt: 1000 };
  game.receiveBossPlayerDamage({ [event.eventId]: event });
  game.receiveBossPlayerDamage({ [event.eventId]: event });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(game.player.hp, 88);
  assert.deepEqual(acknowledged, [event.eventId]);
});
