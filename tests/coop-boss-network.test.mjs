import test from "node:test";
import assert from "node:assert/strict";
import { createCoopBossNetwork } from "../src/coop-boss-network.js";
import { createBossEncounter } from "../src/coop-boss-state.js";
import { getCoopBossForMap } from "../src/coop-boss-data.js";

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
  await adapter.setMap("coast");
  await adapter.setMap("forest");
  assert.deepEqual(fake.listenedPaths.filter(path => path.endsWith("/state")), [
    "rooms/public/bosses/coast/state",
    "rooms/public/bosses/forest/state",
  ]);
  assert.equal(fake.unsubscribedPaths.filter(path => path.includes("/coast/")).length, 4);
});

test("공격은 자기 UID와 증가 sequence 경로에만 기록한다", async () => {
  const fake = fixture();
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast");
  await adapter.sendAttack({ sequence: 7, encounterId: "e", bossId: "coast-core-shark" });
  assert.equal(fake.writes.at(-1).path, "rooms/public/bosses/coast/attacks/me/7");
  await adapter.acknowledgeAttack("other", 7);
  assert.equal(fake.removes.at(-1), "rooms/public/bosses/coast/attacks/other/7");
});

test("만료된 lease만 transaction으로 인수하고 epoch를 올린다", async () => {
  const fake = fixture();
  const current = createBossEncounter(getCoopBossForMap("coast"), {
    encounterId: "e", partySize: 2, now: 0, authorityUid: "host", authorityEpoch: 3,
  });
  fake.values.set("rooms/public/bosses/coast/state", current);
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast");
  const result = await adapter.tryAcquireAuthority();
  assert.equal(result.ok, true);
  assert.equal(result.encounter.authorityUid, "me");
  assert.equal(result.encounter.authorityEpoch, 4);
});

test("stop은 보스 관련 listener와 timer를 한 번만 정리한다", async () => {
  const fake = fixture();
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("volcano");
  await adapter.stop();
  await adapter.stop();
  assert.equal(fake.unsubscribedPaths.length, 4);
});

test("처치 후 180초가 되어야 새 encounter가 생성된다", async () => {
  let timestamp = 180999;
  const fake = fixture();
  fake.options.now = () => timestamp;
  fake.values.set("rooms/public/bosses/coast/state", {
    ...createBossEncounter(getCoopBossForMap("coast"), {
      encounterId: "old", partySize: 1, now: 0, authorityUid: "host", authorityEpoch: 1,
    }),
    status: "defeated", hp: 0, defeatedAt: 1000, respawnAt: 181000,
  });
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast");
  assert.equal(await adapter.ensureEncounter({ partySize: 1 }), null);
  timestamp = 181000;
  assert.equal(await adapter.ensureEncounter({ partySize: 4 }), null);
  const acquired = await adapter.tryAcquireAuthority();
  assert.equal(acquired.ok, true);
  const spawned = await adapter.ensureEncounter({ partySize: 4 });
  assert.notEqual(spawned.encounterId, "old");
  assert.equal(spawned.authorityEpoch, acquired.encounter.authorityEpoch);
  assert.equal(spawned.partySize, 4);
});

test("cleanup은 24시간 만료 claim과 10초 지난 처리 이벤트만 삭제한다", async () => {
  const fake = fixture();
  fake.options.now = () => 100000;
  fake.values.set("rooms/public/bosses/coast/rewardClaims", {
    old: { me: { expiresAt: 99999 } }, keep: { me: { expiresAt: 100001 } },
  });
  fake.values.set("rooms/public/bosses/coast/attacks", {
    a: { 1: { createdAt: 89999 }, 2: { createdAt: 90001 } },
  });
  fake.values.set("rooms/public/bosses/coast/playerDamage", {
    me: { old: { createdAt: 89999 }, keep: { createdAt: 90001 } },
  });
  const adapter = createCoopBossNetwork(fake.options);
  await adapter.setMap("coast");
  await adapter.cleanupExpired();
  assert.ok(fake.removes.includes("rooms/public/bosses/coast/rewardClaims/old/me"));
  assert.ok(fake.removes.includes("rooms/public/bosses/coast/attacks/a/1"));
  assert.ok(fake.removes.includes("rooms/public/bosses/coast/playerDamage/me/old"));
  assert.equal(fake.removes.some(path => path.endsWith("/keep") || path.endsWith("/2")), false);
});
