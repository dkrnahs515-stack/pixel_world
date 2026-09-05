import test from "node:test";
import assert from "node:assert/strict";
import { createCoopBossNetwork } from "../src/coop-boss-network-20260903-volcano-20260905-upgrade.js";
import { createBossEncounter } from "../src/coop-boss-state-20260903-volcano-20260905-upgrade.js";
import { getCoopBossForMap } from "../src/coop-boss-data-20260903-volcano-20260905-upgrade.js";

function fixture() {
  const listenedPaths = [];
  const unsubscribedPaths = [];
  const writes = [];
  const removes = [];
  const values = new Map();
  const dbModule = {
    ref: (_db, path) => ({ path }),
    onValue: (ref, callback) => {
      listenedPaths.push(ref.path);
      callback({ val: () => values.get(ref.path) ?? null });
      let done = false;
      return () => { if (!done) { done = true; unsubscribedPaths.push(ref.path); } };
    },
    set: async (ref, value) => { writes.push({ path: ref.path, value }); values.set(ref.path, value); },
    update: async (ref, value) => { writes.push({ path: ref.path, value }); values.set(ref.path, value); },
    remove: async ref => { removes.push(ref.path); values.delete(ref.path); },
    runTransaction: async (ref, update) => {
      const current = values.get(ref.path) ?? null;
      const next = update(current);
      if (next === undefined) return { committed: false, snapshot: { val: () => current } };
      values.set(ref.path, next);
      return { committed: true, snapshot: { val: () => next } };
    },
    get: async ref => ({ val: () => values.get(ref.path) ?? null }),
  };
  return {
    listenedPaths, unsubscribedPaths, writes, removes, values,
    options: {
      dbModule, db: {}, roomId: "public", uid: "me", now: () => 7000,
      setTimer: () => 1, clearTimer: () => {},
    },
  };
}

test("setMap은 이전 listener를 해제하고 현재 지역 보스 경로만 구독한다", async () => {
  const fake = fixture();
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast-tide-core-cave");
  await adapter.setMap("forest");
  assert.deepEqual(fake.listenedPaths.filter(path => path.endsWith("/state")), [
    "rooms/public/bosses/coast-tide-core-cave/state",
    "rooms/public/bosses/forest/state",
  ]);
  assert.equal(fake.unsubscribedPaths.filter(path => path.includes("/coast-tide-core-cave/")).length, 4);
});

test("화산 협동 보스는 레거시 volcano가 아니라 화구 물리 맵만 구독한다", async () => {
  const fake = fixture();
  const adapter = createCoopBossNetwork(fake.options);
  assert.equal(await adapter.setMap("volcano"), false);
  assert.equal(await adapter.setMap("volcano-core-caldera"), true);
  assert.equal(fake.listenedPaths.some(path => path.includes("/bosses/volcano/")), false);
  assert.equal(fake.listenedPaths.some(path => path.endsWith("/bosses/volcano-core-caldera/state")), true);
});

test("공격은 자기 UID와 증가 sequence 경로에만 기록한다", async () => {
  const fake = fixture();
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast-tide-core-cave");
  await adapter.sendAttack({ sequence: 7, encounterId: "e", bossId: "coast-core-shark" });
  assert.equal(fake.writes.at(-1).path, "rooms/public/bosses/coast-tide-core-cave/attacks/me/7");
  await adapter.acknowledgeAttack("other", 7);
  assert.equal(fake.removes.at(-1), "rooms/public/bosses/coast-tide-core-cave/attacks/other/7");
});

test("alive 보스 상태 게시 전에 Firebase가 거부하는 undefined 필드를 재귀적으로 제거한다", async () => {
  const fake = fixture();
  const containsUndefined = value => value && typeof value === "object"
    && Object.values(value).some(entry => entry === undefined || containsUndefined(entry));
  fake.options.dbModule.update = async (ref, value) => {
    if (containsUndefined(value)) throw new Error("Firebase rejects undefined values");
    fake.writes.push({ path: ref.path, value });
  };
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast-tide-core-cave");
  const encounter = {
    ...createBossEncounter(getCoopBossForMap("coast-tide-core-cave"), {
      encounterId: "alive", partySize: 1, now: 0, authorityUid: "me", authorityEpoch: 1,
    }),
    defeatedAt: undefined,
    respawnAt: undefined,
    contributors: { me: { firstHitAt: 1_000, lastHitAt: undefined } },
  };

  await assert.doesNotReject(adapter.publishState(encounter));
  const { defeatedAt: _defeatedAt, respawnAt: _respawnAt, ...definedEncounter } = encounter;

  assert.deepEqual(fake.writes.at(-1), {
    path: "rooms/public/bosses/coast-tide-core-cave/state",
    value: {
      ...definedEncounter,
      contributors: { me: { firstHitAt: 1_000 } },
    },
  });
  assert.equal(Object.hasOwn(fake.writes.at(-1).value, "defeatedAt"), false);
  assert.equal(Object.hasOwn(fake.writes.at(-1).value, "respawnAt"), false);
});

test("만료된 lease만 transaction으로 인수하고 epoch를 올린다", async () => {
  const fake = fixture();
  const current = createBossEncounter(getCoopBossForMap("coast-tide-core-cave"), {
    encounterId: "e", partySize: 2, now: 0, authorityUid: "host", authorityEpoch: 3,
  });
  fake.values.set("rooms/public/bosses/coast-tide-core-cave/state", current);
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast-tide-core-cave");
  const result = await adapter.tryAcquireAuthority();
  assert.equal(result.ok, true);
  assert.equal(result.encounter.authorityUid, "me");
  assert.equal(result.encounter.authorityEpoch, 4);
});

test("stop은 보스 관련 listener와 timer를 한 번만 정리한다", async () => {
  const fake = fixture();
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("volcano-core-caldera");
  await adapter.stop();
  await adapter.stop();
  assert.equal(fake.unsubscribedPaths.length, 4);
});

test("처치 후 180초와 reward claim 조정이 모두 끝나야 새 encounter가 생성된다", async () => {
  let timestamp = 180999;
  const fake = fixture();
  fake.options.now = () => timestamp;
  fake.values.set("rooms/public/bosses/coast-tide-core-cave/state", {
    ...createBossEncounter(getCoopBossForMap("coast-tide-core-cave"), {
      encounterId: "old", partySize: 1, now: 0, authorityUid: "host", authorityEpoch: 1,
    }),
    status: "defeated", hp: 0, defeatedAt: 1000, respawnAt: 181000,
  });
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast-tide-core-cave");
  assert.equal(await adapter.ensureEncounter({ partySize: 1 }), null);
  timestamp = 181000;
  assert.equal(await adapter.ensureEncounter({ partySize: 4 }), null);
  const acquired = await adapter.tryAcquireAuthority();
  assert.equal(acquired.ok, true);
  assert.equal(await adapter.ensureEncounter({ partySize: 4 }), null);
  const spawned = await adapter.ensureEncounter({ partySize: 4, reconciledEncounterId: "old" });
  assert.notEqual(spawned.encounterId, "old");
  assert.equal(spawned.authorityEpoch, acquired.encounter.authorityEpoch);
  assert.equal(spawned.partySize, 4);
});

test("배포 rules에서 기존 immutable claim은 성공으로 보고 누락 claim만 생성한다", async () => {
  const fake = fixture();
  const existingPath = "rooms/public/bosses/coast-tide-core-cave/rewardClaims/e/earlier";
  const missingPath = "rooms/public/bosses/coast-tide-core-cave/rewardClaims/e/finisher";
  const immutableClaim = {
    encounterId: "e", bossId: "coast-core-shark", uid: "earlier",
    exp: 150, gold: 100, eligible: true, claimedAt: null, expiresAt: 86_402_000,
  };
  fake.values.set(existingPath, { ...immutableClaim, claimedAt: 8_000 });
  fake.options.dbModule.runTransaction = async (ref, update) => {
    const current = fake.values.get(ref.path) ?? null;
    const next = update(current);
    if (current !== null && next !== undefined) {
      throw new Error("PERMISSION_DENIED: authority cannot rewrite an existing reward claim");
    }
    if (next === undefined) return { committed: false, snapshot: { val: () => current } };
    fake.values.set(ref.path, next);
    return { committed: true, snapshot: { val: () => next } };
  };
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast-tide-core-cave");

  const result = await adapter.writeRewardClaims("e", {
    earlier: immutableClaim,
    finisher: { ...immutableClaim, uid: "finisher" },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failedUids, []);
  assert.equal(fake.values.get(existingPath).claimedAt, 8_000);
  assert.deepEqual(fake.values.get(missingPath), { ...immutableClaim, uid: "finisher" });
});

test("cleanup은 24시간 만료 claim과 10초 지난 처리 이벤트만 삭제한다", async () => {
  const fake = fixture();
  fake.options.now = () => 100000;
  fake.values.set("rooms/public/bosses/coast-tide-core-cave/rewardClaims", {
    old: { me: { expiresAt: 99999 } }, keep: { me: { expiresAt: 100001 } },
  });
  fake.values.set("rooms/public/bosses/coast-tide-core-cave/attacks", {
    a: { 1: { createdAt: 89999 }, 2: { createdAt: 90001 } },
  });
  fake.values.set("rooms/public/bosses/coast-tide-core-cave/playerDamage", {
    me: { old: { createdAt: 89999 }, keep: { createdAt: 90001 } },
  });
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast-tide-core-cave");
  await adapter.cleanupExpired();
  assert.ok(fake.removes.includes("rooms/public/bosses/coast-tide-core-cave/rewardClaims/old/me"));
  assert.ok(fake.removes.includes("rooms/public/bosses/coast-tide-core-cave/attacks/a/1"));
  assert.ok(fake.removes.includes("rooms/public/bosses/coast-tide-core-cave/playerDamage/me/old"));
  assert.equal(fake.removes.some(path => path.endsWith("/keep") || path.endsWith("/2")), false);
});

test("부분 실패한 contributor claim 쓰기는 나머지를 계속 기록하고 재시도로 빈 claim만 보완한다", async () => {
  const fake = fixture();
  const originalTransaction = fake.options.dbModule.runTransaction;
  let failFinisher = true;
  fake.options.dbModule.runTransaction = async (ref, update) => {
    if (failFinisher && ref.path.endsWith("/rewardClaims/e/finisher")) {
      throw new Error("simulated claim failure");
    }
    return originalTransaction(ref, update);
  };
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast-tide-core-cave");
  const claims = {
    earlier: { encounterId: "e", uid: "earlier", claimedAt: null },
    finisher: { encounterId: "e", uid: "finisher", claimedAt: null },
    later: { encounterId: "e", uid: "later", claimedAt: null },
  };

  const partial = await adapter.writeRewardClaims("e", claims);

  assert.equal(partial.ok, false);
  assert.deepEqual(partial.failedUids, ["finisher"]);
  assert.equal(fake.values.has("rooms/public/bosses/coast-tide-core-cave/rewardClaims/e/earlier"), true);
  assert.equal(fake.values.has("rooms/public/bosses/coast-tide-core-cave/rewardClaims/e/later"), true);
  assert.equal(fake.values.has("rooms/public/bosses/coast-tide-core-cave/rewardClaims/e/finisher"), false);

  fake.values.set("rooms/public/bosses/coast-tide-core-cave/rewardClaims/e/earlier", {
    ...claims.earlier,
    claimedAt: 8_000,
  });
  failFinisher = false;
  const retried = await adapter.writeRewardClaims("e", claims);

  assert.equal(retried.ok, true);
  assert.equal(fake.values.get("rooms/public/bosses/coast-tide-core-cave/rewardClaims/e/earlier").claimedAt, 8_000);
  assert.deepEqual(fake.values.get("rooms/public/bosses/coast-tide-core-cave/rewardClaims/e/finisher"), claims.finisher);
});
