import test from "node:test";
import assert from "node:assert/strict";
import { createCoopBossController, selectBossTarget } from "../src/coop-boss-controller-20260902-lease.js";
import { createBossEncounter } from "../src/coop-boss-state-20260829-coast.js";
import { getCoopBossForMap } from "../src/coop-boss-data-20260829-coast.js";

function bossSnapshot(overrides = {}) {
  return {
    ...createBossEncounter(getCoopBossForMap("coast-tide-core-cave"), {
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
    wallNow: () => 0,
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
  value.controller.update(1 / 60, { player: { uid: "me", x: 0, y: 0, hp: 100, mapId: "coast-tide-core-cave" }, remotePlayers: new Map(), isBlocked: () => false }, 0);
  value.controller.update(1 / 60, { player: { uid: "me", x: 0, y: 0, hp: 100, mapId: "coast-tide-core-cave" }, remotePlayers: new Map(), isBlocked: () => false }, 499);
  assert.equal(value.published.length, 1);
  value.controller.update(1 / 60, { player: { uid: "me", x: 0, y: 0, hp: 100, mapId: "coast-tide-core-cave" }, remotePlayers: new Map(), isBlocked: () => false }, 500);
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

test("같은 UID의 만료 lease는 재인수 전 authority 동작을 막고 재인수 뒤 재개한다", async () => {
  let acquisitions = 0;
  let simulationCalls = 0;
  const published = [];
  const controller = createCoopBossController({
    uid: "me",
    now: () => 0,
    wallNow: () => 7_000,
    network: {
      tryAcquireAuthority: async () => {
        acquisitions += 1;
        return {
          ok: true,
          encounter: bossSnapshot({ authorityUid: "me", leaseUntil: 13_000 }),
        };
      },
      publishState: async snapshot => { published.push(snapshot); return { ok: true }; },
      cleanupExpired: async () => ({ ok: true }),
    },
    simulate: enemies => {
      simulationCalls += 1;
      return { enemies, events: [] };
    },
  });
  controller.mapId = "coast-tide-core-cave";
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "me", leaseUntil: 6_000 }));
  const context = {
    player: { uid: "me", x: 0, y: 0, hp: 100, mapId: "coast-tide-core-cave" },
    remotePlayers: new Map(),
    isBlocked: () => false,
  };

  controller.update(1 / 60, context, 0);
  assert.equal(simulationCalls, 0);
  assert.equal(published.length, 0);

  assert.equal(await controller.maintainLifecycle(), true);
  assert.equal(acquisitions, 1);
  assert.equal(controller.isAuthority(), true);

  controller.update(1 / 60, context, 0);
  assert.equal(simulationCalls, 1);
  assert.equal(published.length, 1);
});

test("보스 대상은 같은 지역의 가장 가까운 생존자다", () => {
  const target = selectBossTarget({ x: 100, y: 100 }, [
    { uid: "far", x: 500, y: 500, hp: 100, mapId: "coast-tide-core-cave" },
    { uid: "near", x: 120, y: 110, hp: 100, mapId: "coast-tide-core-cave" },
    { uid: "dead", x: 105, y: 105, hp: 0, mapId: "coast-tide-core-cave" },
  ], "coast-tide-core-cave");
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
    attackKind: "basic", player: { x: 1540, y: 1280, mapId: "coast-tide-core-cave" },
    classId: "archer", weaponId: "training-bow", direction: "right",
  });
  await controller.requestHit({
    attackKind: "strong", player: { x: 1540, y: 1280, mapId: "coast-tide-core-cave" },
    classId: "archer", weaponId: "training-bow", direction: "right",
  });
  assert.deepEqual(sent.map(item => item.sequence), [1, 2]);
  assert.equal(sent[0].attackId, "me:e:1");
  assert.equal(Object.hasOwn(sent[0], "damage"), false);
});

test("requestHit은 누락·레거시·미등록·다른 물리 전투장 플레이어 요청을 전송하지 않는다", async () => {
  const sent = [];
  const controller = createCoopBossController({
    uid: "me",
    network: { sendAttack: request => { sent.push(request); return Promise.resolve({ ok: true }); } },
    wallNow: () => 1234,
  });
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "host" }));

  for (const mapId of [undefined, "coast", "unknown", "coast-flooded-station"]) {
    const result = await controller.requestHit({
      attackKind: "basic",
      player: { x: 1540, y: 1280, ...(mapId === undefined ? {} : { mapId }) },
      classId: "archer",
      weaponId: "training-bow",
      direction: "right",
    });
    assert.deepEqual(result, { ok: false, reason: "wrong_arena" }, String(mapId));
  }
  assert.equal(sent.length, 0);
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
  const context = { player: { uid: "me", x: 100, y: 100, hp: 100, mapId: "coast-tide-core-cave" }, remotePlayers: new Map(), isBlocked: () => false };
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
    uid: "finisher", x: 1540, y: 1280, hp: 100, mapId: "coast-tide-core-cave",
    classId: "archer", equippedWeaponId: "training-bow",
  });
  await controller.receiveAttackRequests({ finisher: { 1: {
    attackId: "finisher:e:1", sequence: 1, uid: "finisher", encounterId: "e",
    bossId: "coast-core-shark", mapId: "coast-tide-core-cave", classId: "archer",
    weaponId: "training-bow", attackKind: "basic", playerX: 1540, playerY: 1280,
    direction: "right", createdAt: 2000,
  } } });
  assert.equal(claimsWritten.length, 1);
  assert.deepEqual(Object.keys(claimsWritten[0].claims), ["earlier", "finisher"]);
  assert.equal(claimsWritten[0].claims.earlier.gold, claimsWritten[0].claims.finisher.gold);
});

test("경로 sequence와 payload sequence가 다르면 피해 없이 실제 경로를 acknowledge한다", async () => {
  const acknowledged = [];
  const controller = createCoopBossController({
    uid: "host",
    network: {
      publishState: async () => ({ ok: true }),
      acknowledgeAttack: async (uid, sequence) => acknowledged.push([uid, sequence]),
    },
    wallNow: () => 2000,
  });
  controller.receiveSnapshot(bossSnapshot({ authorityUid: "host", hp: 100 }));
  controller.players.set("fighter", {
    uid: "fighter", x: 1540, y: 1280, hp: 100, mapId: "coast-tide-core-cave",
    classId: "archer", equippedWeaponId: "training-bow",
  });

  const applied = await controller.receiveAttackRequests({ fighter: { 99: {
    attackId: "fighter:e:1", sequence: 1, uid: "fighter", encounterId: "e",
    bossId: "coast-core-shark", mapId: "coast-tide-core-cave", classId: "archer",
    weaponId: "training-bow", attackKind: "basic", playerX: 1540, playerY: 1280,
    direction: "right", createdAt: 2000,
  } } });

  assert.equal(applied, 0);
  assert.equal(controller.snapshot.hp, 100);
  assert.deepEqual(acknowledged, [["fighter", "99"]]);
});

test("처치 state 뒤 claim 실패는 공격 처리를 reject하지 않고 같은 authority가 재조정한다", async () => {
  let claimAttempts = 0;
  const acknowledged = [];
  const errors = [];
  const controller = createCoopBossController({
    uid: "host",
    network: {
      publishState: async () => ({ ok: true }),
      acknowledgeAttack: async (uid, sequence) => acknowledged.push([uid, sequence]),
      writeRewardClaims: async () => {
        claimAttempts += 1;
        if (claimAttempts === 1) throw new Error("simulated partial claim failure");
        return { ok: true, failedUids: [] };
      },
    },
    reportError: (message, error) => errors.push([message, error.message]),
    wallNow: () => 2000,
  });
  controller.receiveSnapshot(bossSnapshot({
    authorityUid: "host", hp: 0.5,
    contributors: { earlier: { firstHitAt: 1000, lastHitAt: 1000 } },
  }));
  controller.players.set("finisher", {
    uid: "finisher", x: 1540, y: 1280, hp: 100, mapId: "coast-tide-core-cave",
    classId: "archer", equippedWeaponId: "training-bow",
  });

  const applied = await controller.receiveAttackRequests({ finisher: { 1: {
    attackId: "finisher:e:1", sequence: 1, uid: "finisher", encounterId: "e",
    bossId: "coast-core-shark", mapId: "coast-tide-core-cave", classId: "archer",
    weaponId: "training-bow", attackKind: "basic", playerX: 1540, playerY: 1280,
    direction: "right", createdAt: 2000,
  } } });

  assert.equal(applied, 1);
  assert.equal(controller.snapshot.status, "defeated");
  assert.deepEqual(acknowledged, [["finisher", "1"]]);
  assert.equal(errors.length, 1);
  assert.equal(await controller.reconcileRewardClaims({ force: true }), true);
  assert.equal(claimAttempts, 2);
});

test("defeated snapshot의 새 authority도 누락 contributor claim을 재조정한다", async () => {
  const writes = [];
  const controller = createCoopBossController({
    uid: "successor",
    network: {
      writeRewardClaims: async (encounterId, claims) => {
        writes.push({ encounterId, claims });
        return { ok: true, failedUids: [] };
      },
    },
    wallNow: () => 20_000,
  });

  controller.receiveSnapshot(bossSnapshot({
    status: "defeated", hp: 0, defeatedAt: 2_000, respawnAt: 182_000,
    authorityUid: "successor", authorityEpoch: 2, leaseUntil: 26_000,
    contributors: {
      earlier: { firstHitAt: 1_000, lastHitAt: 1_500 },
      finisher: { firstHitAt: 2_000, lastHitAt: 2_000 },
    },
  }));
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].claims), ["earlier", "finisher"]);
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
  assert.equal(await spectator.setMap("coast-tide-core-cave"), true);
  assert.equal(cleanupCalls, 0);

  const authority = createCoopBossController({
    uid: "me",
    wallNow: () => 0,
    network: {
      setMap: async () => true,
      ensureEncounter: async () => bossSnapshot({ authorityUid: "me" }),
      cleanupExpired: async () => { cleanupCalls += 1; throw new Error("permission denied"); },
    },
  });
  assert.equal(await authority.setMap("coast-tide-core-cave"), true);
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
  controller.mapId = "coast-tide-core-cave";
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
  controller.mapId = "coast-tide-core-cave";
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
  controller.mapId = "coast-tide-core-cave";
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
  controller.mapId = "coast-tide-core-cave";
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
      writeRewardClaims: async () => ({ ok: true, failedUids: [] }),
      ensureEncounter: async ({ partySize }) => {
        ensuredPartySize = partySize;
        return bossSnapshot({
          encounterId: "next", authorityUid: "me", authorityEpoch: 3,
          leaseUntil: 187_000, partySize,
        });
      },
      cleanupExpired: async () => ({ ok: true }),
    },
  });
  controller.mapId = "coast-tide-core-cave";
  controller.setPartySize(4);
  controller.receiveSnapshot(bossSnapshot({
    authorityUid: "me", authorityEpoch: 3, leaseUntil: 187_000,
    status: "defeated", hp: 0, respawnAt: 181_000,
  }));
  assert.equal(await controller.maintainLifecycle(), true);
  assert.equal(ensuredPartySize, 4);
  assert.equal(controller.snapshot.encounterId, "next");
  assert.equal(controller.snapshot.status, "alive");
});

test("누락 contributor claim이 남아 있으면 respawn으로 마지막 복구 근거를 지우지 않는다", async () => {
  let wallNow = 181_000;
  let claimAttempts = 0;
  let encounterEnsures = 0;
  const controller = createCoopBossController({
    uid: "me",
    wallNow: () => wallNow,
    reportError: () => {},
    network: {
      writeRewardClaims: async () => {
        claimAttempts += 1;
        return claimAttempts < 2
          ? { ok: false, failedUids: ["fighter"] }
          : { ok: true, failedUids: [] };
      },
      ensureEncounter: async () => {
        encounterEnsures += 1;
        return bossSnapshot({
          encounterId: "next", authorityUid: "me", authorityEpoch: 4, leaseUntil: 188_000,
        });
      },
      cleanupExpired: async () => ({ ok: true }),
    },
  });
  controller.mapId = "coast-tide-core-cave";
  controller.receiveSnapshot(bossSnapshot({
    authorityUid: "me",
    authorityEpoch: 3,
    leaseUntil: 187_000,
    status: "defeated",
    hp: 0,
    defeatedAt: 1_000,
    respawnAt: 181_000,
    contributors: { fighter: { firstHitAt: 900, lastHitAt: 1_000 } },
  }));

  assert.equal(await controller.maintainLifecycle(), false);
  assert.equal(encounterEnsures, 0);
  assert.equal(controller.snapshot.encounterId, "e");

  wallNow += 1_000;
  assert.equal(await controller.maintainLifecycle(), true);
  assert.equal(encounterEnsures, 1);
  assert.equal(controller.snapshot.encounterId, "next");
});

test("respawn 시각 뒤 authority 인수도 claim 실패 시 defeated contributor를 유지하고 재시도한다", async () => {
  let wallNow = 181_000;
  let claimAttempts = 0;
  let encounterEnsures = 0;
  const controller = createCoopBossController({
    uid: "successor",
    wallNow: () => wallNow,
    reportError: () => {},
    network: {
      tryAcquireAuthority: async () => ({
        ok: true,
        encounter: bossSnapshot({
          authorityUid: "successor", authorityEpoch: 2, leaseUntil: 187_000,
          status: "defeated", hp: 0, defeatedAt: 1_000, respawnAt: 181_000,
          contributors: { fighter: { firstHitAt: 900, lastHitAt: 1_000 } },
        }),
      }),
      writeRewardClaims: async () => {
        claimAttempts += 1;
        return claimAttempts < 2
          ? { ok: false, failedUids: ["fighter"] }
          : { ok: true, failedUids: [] };
      },
      ensureEncounter: async ({ reconciledEncounterId }) => {
        encounterEnsures += 1;
        assert.equal(reconciledEncounterId, "e");
        return bossSnapshot({
          encounterId: "next", authorityUid: "successor", authorityEpoch: 2, leaseUntil: 188_000,
        });
      },
      cleanupExpired: async () => ({ ok: true }),
    },
  });
  controller.mapId = "coast-tide-core-cave";
  controller.receiveSnapshot(bossSnapshot({
    authorityUid: "host", leaseUntil: 180_000,
    status: "defeated", hp: 0, defeatedAt: 1_000, respawnAt: 181_000,
    contributors: { fighter: { firstHitAt: 900, lastHitAt: 1_000 } },
  }));

  await controller.maintainLifecycle();
  assert.equal(claimAttempts, 1);
  assert.equal(encounterEnsures, 0);
  assert.equal(controller.snapshot.encounterId, "e");
  assert.deepEqual(Object.keys(controller.snapshot.contributors), ["fighter"]);

  wallNow += 1_000;
  await controller.maintainLifecycle();
  assert.equal(claimAttempts, 2);
  assert.equal(encounterEnsures, 1);
  assert.equal(controller.snapshot.encounterId, "next");
});

test("이전 encounter claim 성공은 대기 중 수신한 새 defeated encounter의 respawn을 허용하지 않는다", async () => {
  let wallNow = 181_000;
  let resolveFirstClaim;
  let markFirstClaimStarted;
  const firstClaimStarted = new Promise(resolve => { markFirstClaimStarted = resolve; });
  const claimWrites = [];
  const encounterEnsures = [];
  const controller = createCoopBossController({
    uid: "successor",
    wallNow: () => wallNow,
    network: {
      tryAcquireAuthority: async () => ({
        ok: true,
        encounter: bossSnapshot({
          encounterId: "a", authorityUid: "successor", authorityEpoch: 2,
          leaseUntil: 187_000, status: "defeated", hp: 0,
          defeatedAt: 1_000, respawnAt: 181_000,
          contributors: { alpha: { firstHitAt: 900, lastHitAt: 1_000 } },
        }),
      }),
      writeRewardClaims: async encounterId => {
        claimWrites.push(encounterId);
        if (encounterId !== "a") return { ok: true, failedUids: [] };
        markFirstClaimStarted();
        return new Promise(resolve => { resolveFirstClaim = resolve; });
      },
      ensureEncounter: async ({ reconciledEncounterId }) => {
        encounterEnsures.push(reconciledEncounterId);
        return bossSnapshot({
          encounterId: "next", authorityUid: "successor", authorityEpoch: 3, leaseUntil: 188_000,
        });
      },
      cleanupExpired: async () => ({ ok: true }),
    },
  });
  controller.mapId = "coast-tide-core-cave";
  controller.receiveSnapshot(bossSnapshot({
    encounterId: "a", authorityUid: "host", leaseUntil: 180_000,
    status: "defeated", hp: 0, defeatedAt: 1_000, respawnAt: 181_000,
    contributors: { alpha: { firstHitAt: 900, lastHitAt: 1_000 } },
  }));

  const takeover = controller.maintainLifecycle();
  await firstClaimStarted;
  controller.receiveSnapshot(bossSnapshot({
    encounterId: "b", authorityUid: "successor", authorityEpoch: 3,
    leaseUntil: 187_000, status: "defeated", hp: 0,
    defeatedAt: 2_000, respawnAt: 181_000,
    contributors: { beta: { firstHitAt: 1_900, lastHitAt: 2_000 } },
  }));
  resolveFirstClaim({ ok: true, failedUids: [] });
  await takeover;

  assert.deepEqual(claimWrites, ["a"]);
  assert.deepEqual(encounterEnsures, []);
  assert.equal(controller.snapshot.encounterId, "b");
  assert.deepEqual(Object.keys(controller.snapshot.contributors), ["beta"]);

  wallNow += 1_000;
  await controller.maintainLifecycle();
  assert.deepEqual(claimWrites, ["a", "b"]);
  assert.deepEqual(encounterEnsures, ["b"]);
  assert.equal(controller.snapshot.encounterId, "next");
});
