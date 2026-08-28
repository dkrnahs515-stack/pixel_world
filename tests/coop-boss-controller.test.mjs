import test from "node:test";
import assert from "node:assert/strict";
import { createCoopBossController, selectBossTarget } from "../src/coop-boss-controller.js";
import { createBossEncounter } from "../src/coop-boss-state.js";
import { getCoopBossForMap } from "../src/coop-boss-data.js";

function bossSnapshot(overrides = {}) {
  return {
    ...createBossEncounter(getCoopBossForMap("coast"), {
      encounterId: "e", partySize: 2, now: 0, authorityUid: "me", authorityEpoch: 1,
    }),
    ...overrides,
  };
}

function fixture({ uid = "me", authorityUid = "me" } = {}) {
  const published = [];
  let simulationCalls = 0;
  const network = {
    setMap: async () => true,
    ensureEncounter: async () => null,
    tryAcquireAuthority: async () => ({ ok: false }),
    publishState: snapshot => { published.push(snapshot); return Promise.resolve({ ok: true }); },
  };
  const controller = createCoopBossController({
    uid,
    network,
    now: () => 0,
    simulate: (enemies, _target, _dt) => {
      simulationCalls += 1;
      enemies[0].x += 10;
      return { enemies, events: [] };
    },
  });
  const snapshot = bossSnapshot({ authorityUid });
  return { controller, snapshot, published, get simulationCalls() { return simulationCalls; } };
}

test("관리자는 보스 AI를 갱신하고 500ms마다 상태를 발행한다", () => {
  const value = fixture();
  value.controller.receiveSnapshot(value.snapshot);
  value.controller.update(1 / 60, { player: { uid: "me", x: 0, y: 0, hp: 100, mapId: "coast" }, remotePlayers: new Map(), isBlocked: () => false }, 0);
  value.controller.update(1 / 60, { player: { uid: "me", x: 0, y: 0, hp: 100, mapId: "coast" }, remotePlayers: new Map(), isBlocked: () => false }, 499);
  assert.equal(value.published.length, 1);
  value.controller.update(1 / 60, { player: { uid: "me", x: 0, y: 0, hp: 100, mapId: "coast" }, remotePlayers: new Map(), isBlocked: () => false }, 500);
  assert.equal(value.published.length, 2);
  assert.equal(value.simulationCalls, 3);
});

test("관전자는 AI를 실행하지 않고 수신 좌표 사이를 보간한다", () => {
  const value = fixture({ authorityUid: "host" });
  value.controller.receiveSnapshot(bossSnapshot({ authorityUid: "host", x: 100, y: 100, updatedAt: 0 }));
  value.controller.receiveSnapshot(bossSnapshot({ authorityUid: "host", x: 200, y: 100, updatedAt: 500 }));
  value.controller.update(1 / 60, { player: {}, remotePlayers: new Map(), isBlocked: () => false }, 250);
  assert.equal(value.controller.targetableBoss().x, 150);
  assert.equal(value.simulationCalls, 0);
});

test("관전자 보간은 관리자 브라우저 시계가 아니라 로컬 수신 시각을 사용한다", () => {
  let localNow = 10_000;
  const controller = createCoopBossController({
    uid: "guest",
    network: {},
    now: () => localNow,
  });
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "host", x: 100, updatedAt: 9_000_000 }));
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "host", x: 200, updatedAt: 9_000_500 }));
  localNow = 10_250;
  controller.update(1 / 60, { player: {}, remotePlayers: new Map() }, localNow);
  assert.equal(controller.targetableBoss().x, 150);
});

test("authority가 바뀌면 마지막 확정 HP와 위치로 시뮬레이션을 이어간다", () => {
  const value = fixture({ authorityUid: "old" });
  value.controller.receiveSnapshot(bossSnapshot({ authorityUid: "old", hp: 73, x: 800, y: 900 }));
  value.controller.receiveSnapshot(bossSnapshot({ authorityUid: "me", authorityEpoch: 2, hp: 73, x: 800, y: 900 }));
  assert.equal(value.controller.isAuthority(), true);
  assert.deepEqual({ hp: value.controller.targetableBoss().hp, x: value.controller.targetableBoss().x }, { hp: 73, x: 800 });
});

test("보스 대상은 같은 지역의 가장 가까운 생존자다", () => {
  const target = selectBossTarget({ x: 100, y: 100 }, [
    { uid: "far", x: 500, y: 500, hp: 100, mapId: "coast" },
    { uid: "near", x: 120, y: 110, hp: 100, mapId: "coast" },
    { uid: "dead", x: 105, y: 105, hp: 0, mapId: "coast" },
  ], "coast");
  assert.equal(target.uid, "near");
});

test("requestHit은 피해량 없이 증가 sequence 공격 요청을 보낸다", async () => {
  const sent = [];
  const controller = createCoopBossController({
    uid: "me",
    network: { sendAttack: request => { sent.push(request); return Promise.resolve({ ok: true }); } },
    wallNow: () => 1234,
  });
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "host" }));
  await controller.requestHit({
    attackKind: "basic", player: { x: 2100, y: 2400 },
    classId: "archer", weaponId: "training-bow", direction: "right",
  });
  await controller.requestHit({
    attackKind: "strong", player: { x: 2100, y: 2400 },
    classId: "archer", weaponId: "training-bow", direction: "right",
  });
  assert.deepEqual(sent.map(item => item.sequence), [1, 2]);
  assert.equal(sent[0].attackId, "me:e:1");
  assert.equal(Object.hasOwn(sent[0], "damage"), false);
});

test("관리자 AI 피해 이벤트는 대상 UID 경로에 한 번만 전송한다", () => {
  const sent = [];
  const controller = createCoopBossController({
    uid: "me",
    network: {
      publishState: async () => ({ ok: true }),
      sendPlayerDamage: (uid, event) => { sent.push({ uid, event }); return Promise.resolve(); },
    },
    simulate: enemies => ({
      enemies,
      events: [
        { type: "damage-player", attackId: "boss:1", amount: 12 },
        { type: "damage-player", attackId: "boss:1", amount: 12 },
      ],
    }),
    wallNow: () => 2000,
  });
  controller.receiveSnapshot(bossSnapshot());
  const context = { player: { uid: "me", x: 100, y: 100, hp: 100, mapId: "coast" }, remotePlayers: new Map(), isBlocked: () => false };
  controller.update(1 / 60, context, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].uid, "me");
  assert.equal(sent[0].event.damage, 12);
});

test("처치한 첫 공격은 모든 contributor의 동일 보상 claim을 기록한다", async () => {
  const claimsWritten = [];
  const controller = createCoopBossController({
    uid: "host",
    network: {
      publishState: async () => ({ ok: true }),
      acknowledgeAttack: async () => {},
      writeRewardClaims: async (encounterId, claims) => claimsWritten.push({ encounterId, claims }),
    },
    wallNow: () => 2000,
  });
  controller.receiveSnapshot(bossSnapshot({
    authorityUid: "host", hp: 0.5,
    contributors: { earlier: { firstHitAt: 1000, lastHitAt: 1000 } },
  }));
  controller.players.set("finisher", {
    uid: "finisher", x: 2100, y: 2400, hp: 100, mapId: "coast",
    classId: "archer", equippedWeaponId: "training-bow",
  });
  await controller.receiveAttackRequests({ finisher: { 1: {
    attackId: "finisher:e:1", sequence: 1, uid: "finisher", encounterId: "e",
    bossId: "coast-core-shark", mapId: "coast", classId: "archer",
    weaponId: "training-bow", attackKind: "basic", playerX: 2100, playerY: 2400,
    direction: "right", createdAt: 2000,
  } } });
  assert.equal(claimsWritten.length, 1);
  assert.deepEqual(Object.keys(claimsWritten[0].claims), ["earlier", "finisher"]);
  assert.equal(claimsWritten[0].claims.earlier.gold, claimsWritten[0].claims.finisher.gold);
});

test("만료 데이터 정리는 현재 관리자가 된 뒤에만 실행하고 실패해도 지역 입장을 유지한다", async () => {
  const definition = bossSnapshot({ authorityUid: "host" });
  let cleanupCalls = 0;
  const spectator = createCoopBossController({
    uid: "guest",
    network: {
      setMap: async () => true,
      ensureEncounter: async () => definition,
      tryAcquireAuthority: async () => ({ ok: false, reason: "lease_active" }),
      cleanupExpired: async () => { cleanupCalls += 1; },
    },
  });
  assert.equal(await spectator.setMap("coast"), true);
  assert.equal(cleanupCalls, 0);

  const authority = createCoopBossController({
    uid: "me",
    network: {
      setMap: async () => true,
      ensureEncounter: async () => bossSnapshot({ authorityUid: "me" }),
      cleanupExpired: async () => { cleanupCalls += 1; throw new Error("permission denied"); },
    },
  });
  assert.equal(await authority.setMap("coast"), true);
  assert.equal(cleanupCalls, 1);
});

test("지역에 남은 관전자는 lease 만료 뒤 관리자 권한을 인수한다", async () => {
  let wallNow = 7_000;
  let acquisitions = 0;
  const controller = createCoopBossController({
    uid: "guest",
    wallNow: () => wallNow,
    network: {
      tryAcquireAuthority: async () => {
        acquisitions += 1;
        return { ok: true, encounter: bossSnapshot({ authorityUid: "guest", authorityEpoch: 2, leaseUntil: 13_000 }) };
      },
      cleanupExpired: async () => ({ ok: true }),
    },
  });
  controller.mapId = "coast";
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "host", leaseUntil: 6_000 }));
  assert.equal(await controller.maintainLifecycle(), true);
  assert.equal(acquisitions, 1);
  assert.equal(controller.isAuthority(), true);
});

test("관리자 인수 실패는 1초 동안 다시 요청하지 않아 Firebase transaction 폭주를 막는다", async () => {
  let wallNow = 7_000;
  let acquisitions = 0;
  const controller = createCoopBossController({
    uid: "guest",
    wallNow: () => wallNow,
    network: { tryAcquireAuthority: async () => { acquisitions += 1; return { ok: false }; } },
  });
  controller.mapId = "coast";
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "host", leaseUntil: 6_000 }));
  await controller.maintainLifecycle();
  wallNow = 7_999;
  await controller.maintainLifecycle();
  assert.equal(acquisitions, 1);
  wallNow = 8_000;
  await controller.maintainLifecycle();
  assert.equal(acquisitions, 2);
});

test("lease 만료 시 현재 지역에 가장 먼저 입장한 참가자만 관리자 인수를 요청한다", async () => {
  let acquisitions = 0;
  const controller = createCoopBossController({
    uid: "guest",
    wallNow: () => 7_000,
    network: { tryAcquireAuthority: async () => { acquisitions += 1; return { ok: false }; } },
  });
  controller.mapId = "coast";
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "host", leaseUntil: 6_000 }));
  controller.setParticipants([
    { uid: "guest", joinedAt: 2_000 },
    { uid: "early", joinedAt: 1_000 },
  ]);
  await controller.maintainLifecycle();
  assert.equal(acquisitions, 0);
  controller.setParticipants([{ uid: "guest", joinedAt: 2_000 }]);
  await controller.maintainLifecycle();
  assert.equal(acquisitions, 1);
});

test("앞선 참가자가 멈추면 다음 순번은 제한 시간 뒤 관리자 인수를 시도한다", async () => {
  let wallNow = 7_000;
  let acquisitions = 0;
  const controller = createCoopBossController({
    uid: "second",
    wallNow: () => wallNow,
    network: { tryAcquireAuthority: async () => { acquisitions += 1; return { ok: false }; } },
  });
  controller.mapId = "coast";
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "host", leaseUntil: 6_000 }));
  controller.setParticipants([
    { uid: "first", joinedAt: 1_000 },
    { uid: "second", joinedAt: 2_000 },
  ]);
  await controller.maintainLifecycle();
  assert.equal(acquisitions, 0);
  wallNow = 7_500;
  await controller.maintainLifecycle();
  assert.equal(acquisitions, 1);
});

test("관리자는 처치 3분 뒤 현재 참가자 수로 보스를 자동 재생성한다", async () => {
  let ensuredPartySize = null;
  const controller = createCoopBossController({
    uid: "me",
    wallNow: () => 181_000,
    network: {
      ensureEncounter: async ({ partySize }) => {
        ensuredPartySize = partySize;
        return bossSnapshot({ encounterId: "next", authorityUid: "me", authorityEpoch: 3, partySize });
      },
      cleanupExpired: async () => ({ ok: true }),
    },
  });
  controller.mapId = "coast";
  controller.setPartySize(4);
  controller.receiveSnapshot(bossSnapshot({
    authorityUid: "me", authorityEpoch: 3, status: "defeated", hp: 0, respawnAt: 181_000,
  }));
  assert.equal(await controller.maintainLifecycle(), true);
  assert.equal(ensuredPartySize, 4);
  assert.equal(controller.snapshot.encounterId, "next");
  assert.equal(controller.snapshot.status, "alive");
});
