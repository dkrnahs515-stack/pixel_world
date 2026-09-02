import test from "node:test";
import assert from "node:assert/strict";
import { getCoopBossForMap } from "../src/coop-boss-data-20260829-coast.js";
import {
  acquireAuthority, applyBossAttack, claimReward, createBossEncounter,
  createRewardClaims, normalizeBossEncounter, renewAuthority, validateBossAttack,
  createBossPlayerDamageEvent, validateBossPlayerDamageEvent,
} from "../src/coop-boss-state-20260829-coast.js";

function encounter(overrides = {}) {
  return {
    ...createBossEncounter(getCoopBossForMap("coast-tide-core-cave"), {
      encounterId: "coast-1000-a", partySize: 3, now: 1000,
      authorityUid: "host", authorityEpoch: 1,
    }),
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    attackId: "archer:e:1", sequence: 1, uid: "archer",
    encounterId: "coast-1000-a", bossId: "coast-core-shark", mapId: "coast-tide-core-cave",
    classId: "archer", weaponId: "training-bow", attackKind: "basic",
    playerX: 1540, playerY: 1280, direction: "right", createdAt: 2000,
    ...overrides,
  };
}

test("encounter는 참가자 수로 HP를 고정하고 6초 authority lease를 만든다", () => {
  const value = encounter();
  assert.equal(value.maxHp, 252);
  assert.equal(value.hp, 252);
  assert.equal(value.leaseUntil, 7000);
  assert.equal(value.status, "alive");
  assert.deepEqual(value.contributors, {});
  assert.equal(normalizeBossEncounter({ ...value, hp: 9999 }).hp, 252);
});

test("살아 있는 lease는 빼앗지 못하고 만료 후 epoch를 올려 이전한다", () => {
  const current = encounter({ authorityUid: "host", authorityEpoch: 4, leaseUntil: 7000 });
  assert.equal(acquireAuthority(current, { uid: "next", now: 6999 }).ok, false);
  const acquired = acquireAuthority(current, { uid: "next", now: 7000 });
  assert.equal(acquired.ok, true);
  assert.equal(acquired.encounter.authorityUid, "next");
  assert.equal(acquired.encounter.authorityEpoch, 5);
  const renewed = renewAuthority(acquired.encounter, { uid: "next", authorityEpoch: 5, now: 8000 });
  assert.equal(renewed.encounter.leaseUntil, 14000);
});

test("공격 피해는 요청값이 아니라 직업과 무기 정의로 계산하고 sequence를 중복 처리하지 않는다", () => {
  const current = encounter();
  const validation = {
    encounter: current,
    bossDefinition: getCoopBossForMap("coast-tide-core-cave"),
    authenticatedUid: "archer",
    player: { uid: "archer", x: 1540, y: 1280, mapId: "coast-tide-core-cave", classId: "archer", equippedWeaponId: "training-bow" },
    lastSequence: 0,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    now: 2000,
  };
  const validated = validateBossAttack(request({ damage: 999 }), validation);
  assert.equal(validated.ok, true);
  assert.equal(validated.damage, 0.9);
  const applied = applyBossAttack(current, validated, 2000);
  assert.equal(applied.encounter.hp, 251.1);
  assert.equal(applied.encounter.contributors.archer.firstHitAt, 2000);
  assert.equal(validateBossAttack(request(), { ...validation, lastSequence: 1 }).reason, "duplicate_sequence");
  assert.equal(validateBossAttack(request({ weaponId: "training-staff" }), validation).reason, "invalid_weapon");
});

test("공격 검증은 플레이어가 같은 해안 지역의 다른 물리 맵에 있으면 거부한다", () => {
  const current = encounter();
  const result = validateBossAttack(request(), {
    encounter: current,
    bossDefinition: getCoopBossForMap("coast-tide-core-cave"),
    authenticatedUid: "archer",
    player: {
      uid: "archer",
      x: 1540,
      y: 1280,
      mapId: "coast-flooded-station",
      classId: "archer",
      equippedWeaponId: "training-bow",
    },
    lastSequence: 0,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    now: 2000,
  });
  assert.deepEqual(result, { ok: false, reason: "invalid_player" });
});

test("오래되거나 미래인 공격은 거부하고 수신 시각으로 재생 쿨다운을 판정한다", () => {
  const current = encounter();
  const base = {
    uid: "a", encounterId: current.encounterId, bossId: current.bossId, mapId: current.mapId,
    classId: "warrior", weaponId: "starter-sword", attackKind: "basic",
    playerX: current.x - 40, playerY: current.y, sequence: 1,
  };
  const validation = {
    encounter: current, bossDefinition: getCoopBossForMap("coast-tide-core-cave"), authenticatedUid: "a",
    player: { uid: "a", x: current.x - 40, y: current.y, hp: 100, mapId: "coast-tide-core-cave", classId: "warrior", equippedWeaponId: "starter-sword" },
    lastSequence: 0, lastAttackAt: Number.NEGATIVE_INFINITY, now: 10_000,
  };
  assert.equal(validateBossAttack({ ...base, createdAt: 4_999 }, validation).reason, "stale_attack");
  assert.equal(validateBossAttack({ ...base, createdAt: 15_001 }, validation).reason, "stale_attack");
  const accepted = validateBossAttack({ ...base, createdAt: 7_000 }, validation);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.attackAt, 10_000);
  assert.equal(validateBossAttack({ ...base, sequence: 2, createdAt: 9_000 }, {
    ...validation, lastSequence: 1, lastAttackAt: 10_000,
  }).reason, "cooldown");
});

test("첫 0 HP 공격만 처치 시각과 3분 재등장을 만든다", () => {
  const current = encounter({ hp: 0.5 });
  const result = applyBossAttack(current, { ok: true, uid: "a", damage: 1, sequence: 1 }, 5000);
  assert.equal(result.defeated, true);
  assert.equal(result.encounter.status, "defeated");
  assert.equal(result.encounter.defeatedAt, 5000);
  assert.equal(result.encounter.respawnAt, 185000);
  assert.equal(applyBossAttack(result.encounter, { ok: true, uid: "b", damage: 1, sequence: 1 }, 6000).defeated, false);
});

test("모든 기여자는 동일 claim을 받고 한 번만 수령하며 24시간 뒤 만료한다", () => {
  const defeated = encounter({
    hp: 0, status: "defeated", defeatedAt: 1000,
    contributors: { a: { firstHitAt: 1, lastHitAt: 2 }, b: { firstHitAt: 2, lastHitAt: 3 } },
  });
  const claims = createRewardClaims(defeated, 1000);
  assert.deepEqual(Object.keys(claims), ["a", "b"]);
  assert.equal(claims.a.exp, claims.b.exp);
  assert.equal(claims.a.gold, claims.b.gold);
  const first = claimReward(claims.a, 2000);
  assert.equal(first.ok, true);
  assert.equal(claimReward(first.claim, 3000).reason, "already_claimed");
  assert.equal(claimReward(claims.b, 86401001).reason, "expired");
});

test("보스 피해 이벤트는 encounter·epoch·대상과 50 피해 상한을 고정한다", () => {
  const current = encounter({ authorityEpoch: 2 });
  const event = createBossPlayerDamageEvent({
    encounter: current, targetUid: "target", damage: 88, sequence: 3, now: 2000,
  });
  assert.equal(event.eventId, "coast-1000-a:2:3");
  assert.equal(event.damage, 50);
  assert.equal(validateBossPlayerDamageEvent(event, {
    encounter: current, targetUid: "target", now: 2000,
  }).ok, true);
  assert.equal(validateBossPlayerDamageEvent({ ...event, authorityEpoch: 1 }, {
    encounter: current, targetUid: "target", now: 2000,
  }).reason, "authority_mismatch");
});
