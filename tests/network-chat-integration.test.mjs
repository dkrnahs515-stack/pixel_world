import test from "node:test";
import assert from "node:assert/strict";
import { createNetworkAdapter } from "../src/network-20260903-volcano-20260905-upgrade.js";

const VOLCANO_RELEASE_MAP_IDS = Object.freeze([
  "village",
  "forest",
  "coast-beach",
  "coast-wreck-bay",
  "coast-flooded-station",
  "coast-tide-core-cave",
  "volcano",
  "volcano-magma-route",
  "volcano-observatory",
  "volcano-core-caldera",
  "sanctuary",
]);

function firebaseModulesFake() {
  const callbacks = new Map();
  const disconnects = [];
  const queries = [];
  const updates = [];
  const transactionValues = new Map();
  let offlineCalls = 0;
  let onlineCalls = 0;
  let signOutCalls = 0;
  const dbModule = {
    getDatabase: () => ({}),
    goOffline: () => { offlineCalls += 1; },
    goOnline: () => { onlineCalls += 1; },
    ref: (_db, path) => ({ path, key: path.split("/").at(-1) }),
    query: (ref, ...constraints) => {
      const query = { ...ref, constraints };
      queries.push(query);
      return query;
    },
    orderByChild: child => ({ type: "orderByChild", child }),
    equalTo: value => ({ type: "equalTo", value }),
    runTransaction: async (ref, update) => {
      const current = transactionValues.get(ref.path) ?? null;
      const next = update(current);
      if (next === undefined) return { committed: false, snapshot: { val: () => current } };
      transactionValues.set(ref.path, next);
      return { committed: true, snapshot: { val: () => next } };
    },
    onValue: (ref, callback) => {
      callbacks.set(ref.path, callback);
      return () => callbacks.delete(ref.path);
    },
    onDisconnect: ref => {
      const operation = { path: ref.path, removeCalls: 0, cancelCalls: 0 };
      disconnects.push(operation);
      return {
        remove: async () => { operation.removeCalls += 1; },
        cancel: async () => { operation.cancelCalls += 1; },
      };
    },
    update: async (ref, value) => { updates.push({ path: ref.path, value }); },
    remove: async () => {},
    get: async () => ({ val: () => ({}) }),
    push: ref => ({ path: `${ref.path}/new`, key: "new" }),
    serverTimestamp: () => 123,
  };
  return {
    callbacks,
    disconnects,
    queries,
    updates,
    modules: {
      appModule: { getApps: () => [], initializeApp: () => ({}) },
      authModule: {
        getAuth: () => ({ currentUser: null }),
        signInAnonymously: async () => ({ user: { uid: "user-a" } }),
        signOut: async () => { signOutCalls += 1; },
      },
      dbModule,
    },
    transactionValues,
    get offlineCalls() { return offlineCalls; },
    get onlineCalls() { return onlineCalls; },
    get signOutCalls() { return signOutCalls; },
  };
}

test("플레이어와 채팅은 인증 연결을 공유하고 재연결 때 자동 삭제를 다시 예약한다", async () => {
  const fake = firebaseModulesFake();
  const statuses = [];
  const adapter = await createNetworkAdapter({
    playMode: "online",
    onPlayersChanged: () => {},
    onStatusChanged: (status, label) => statuses.push({ status, label }),
    onChatMessagesChanged: () => {},
  }, {
    firebaseConfig: { apiKey: "public-id", databaseURL: "https://example.invalid" },
    loadFirebaseModules: async () => fake.modules,
  });

  assert.equal(adapter.mode, "firebase");
  assert.equal(adapter.chat.mode, "firebase");
  assert.equal(typeof adapter.coopBoss.setMap, "function");
  fake.callbacks.get(".info/connected")({ val: () => true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(fake.disconnects.map(item => item.path).sort(), [
    "rooms/public/chat/user-a",
    "rooms/public/players/user-a",
    "rooms/public/slots/0",
  ]);
  assert.equal(statuses.at(-1).status, "online");
  await adapter.stop();
  assert.equal(fake.onlineCalls, 1);
  assert.equal(fake.signOutCalls, 0);
  assert.equal(fake.offlineCalls, 1);
});

test("현재 채팅은 열한 물리 맵 모두에서 outbound 메시지를 기록한다", async () => {
  const fake = firebaseModulesFake();
  const adapter = await createNetworkAdapter({
    playMode: "online",
    onPlayersChanged: () => {},
    onChatMessagesChanged: () => {},
  }, {
    firebaseConfig: { apiKey: "public-id", databaseURL: "https://example.invalid" },
    loadFirebaseModules: async () => fake.modules,
  });

  const results = [];
  for (const mapId of VOLCANO_RELEASE_MAP_IDS) {
    results.push(await adapter.chat.send({ text: `출발 ${mapId}`, name: "화산대", mapId }));
  }

  assert.deepEqual(results, VOLCANO_RELEASE_MAP_IDS.map(() => ({ ok: true, error: "" })));
  assert.deepEqual(
    fake.updates.map(({ value }) => value.new.mapId),
    VOLCANO_RELEASE_MAP_IDS,
  );
  await adapter.stop();
});

test("현재 채팅은 열한 물리 맵 모두의 inbound 메시지를 전달한다", async () => {
  const fake = firebaseModulesFake();
  const received = [];
  const adapter = await createNetworkAdapter({
    playMode: "online",
    onPlayersChanged: () => {},
    onChatMessagesChanged: messages => received.push(messages),
  }, {
    firebaseConfig: { apiKey: "public-id", databaseURL: "https://example.invalid" },
    loadFirebaseModules: async () => fake.modules,
  });
  const records = Object.fromEntries(VOLCANO_RELEASE_MAP_IDS.map((mapId, index) => [
    `m${index}`,
    { text: `도착 ${mapId}`, name: "화산대", mapId, createdAt: 100 + index },
  ]));

  fake.callbacks.get("rooms/public/chat")({ val: () => ({ "user-b": records }) });

  assert.deepEqual(received.at(-1).map(message => message.mapId), VOLCANO_RELEASE_MAP_IDS);
  await adapter.stop();
});

test("네트워크 게시에는 현재 직업과 해당 장착 무기가 포함된다", async () => {
  const fake = firebaseModulesFake();
  const playerEvents = [];
  const originalPerformance = globalThis.performance;
  let now = 1000;
  globalThis.performance = { now: () => now };
  try {
    const adapter = await createNetworkAdapter({
      playMode: "online",
      onPlayersChanged: (players, metadata) => playerEvents.push({ players, metadata }),
    }, {
      firebaseConfig: { apiKey: "public-id", databaseURL: "https://example.invalid" },
      loadFirebaseModules: async () => fake.modules,
      wallNow: () => 777,
    });
    adapter.publish({
      x: 10,
      y: 20,
      dir: "right",
      moving: false,
      color: "#fff",
      name: "마법사",
      classId: "mage",
      equippedWeaponId: "archmage-staff",
    }, "village");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(fake.updates.length, 1);
    assert.equal(fake.updates[0].value.classId, "mage");
    assert.equal(fake.updates[0].value.equippedWeaponId, "archmage-staff");
    assert.equal(fake.updates[0].value.updatedAt, 123);
    assert.equal(fake.updates[0].value.joinedAt, 123);
    fake.callbacks.get("rooms/public/players/user-a")({ val: () => ({ joinedAt: 123 }) });
    fake.callbacks.get("rooms/public/players")({ val: () => ({}) });
    assert.equal(playerEvents.at(-1).metadata.ownJoinedAt, 123);
    assert.equal(adapter.joinedAt, 123);
    now += 500;
    adapter.publish({
      x: 11, y: 20, dir: "right", moving: true, color: "#fff", name: "마법사",
      classId: "mage", equippedWeaponId: "archmage-staff",
    }, "village");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(Object.hasOwn(fake.updates[1].value, "joinedAt"), false);
    fake.callbacks.get("rooms/public/players/user-a")({ val: () => null });
    assert.equal(adapter.joinedAt, Number.POSITIVE_INFINITY);
    now += 500;
    adapter.publish({
      x: 12, y: 20, dir: "right", moving: true, color: "#fff", name: "마법사",
      classId: "mage", equippedWeaponId: "archmage-staff",
    }, "village");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(fake.updates[2].value.joinedAt, 123);
    await adapter.stop();
  } finally {
    globalThis.performance = originalPerformance;
  }
});

test("플레이어 publish는 검증된 동일 물리 맵으로만 query와 write를 교체한다", async () => {
  const fake = firebaseModulesFake();
  const adapter = await createNetworkAdapter({ playMode: "online", onPlayersChanged: () => {} }, {
    firebaseConfig: { apiKey: "public-id", databaseURL: "https://example.invalid" },
    loadFirebaseModules: async () => fake.modules,
    now: (() => { let value = 0; return () => value += 500; })(),
  });
  assert.equal(fake.queries.length, 1);
  assert.equal(fake.queries[0].constraints[1].value, "village");

  const player = { x: 1, y: 1, dir: "down", moving: false, name: "맵", color: "#fff" };
  for (const invalidMapId of ["coast", "unknown", undefined, null]) {
    adapter.publish(player, invalidMapId);
  }
  adapter.publish({ ...player, x: 2160.1 }, "coast-beach");
  adapter.publish({ ...player, y: 1800.1 }, "coast-beach");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fake.queries.length, 1);
  assert.equal(fake.updates.length, 0);

  adapter.publish(player, "coast-beach");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fake.queries.length, 2);
  assert.equal(fake.updates.length, 1);
  const subscribedMapId = fake.queries.at(-1).constraints[1].value;
  const writtenMapId = fake.updates.at(-1).value.mapId;
  assert.equal(subscribedMapId, "coast-beach");
  assert.equal(writtenMapId, subscribedMapId);
  await adapter.stop();
});

test("솔로 adapter는 Firebase 모듈을 불러오지 않는다", async () => {
  let loads = 0;
  const adapter = await createNetworkAdapter(
    { playMode: "solo" },
    {
      firebaseConfig: { apiKey: "x", databaseURL: "https://example.invalid" },
      loadFirebaseModules: async () => {
        loads += 1;
        throw new Error("should not load");
      },
    },
  );
  assert.equal(loads, 0);
  assert.equal(adapter.mode, "solo");
  assert.equal(adapter.uid, "local-player");
  assert.equal(adapter.coopBoss, null);
});

test("온라인 이후 5초 연속 끊김만 connection_lost를 한 번 전달한다", async () => {
  const fake = firebaseModulesFake();
  const timers = new Map();
  let timerId = 0;
  const lost = [];
  const adapter = await createNetworkAdapter({
    playMode: "online",
    onConnectionLost: reason => lost.push(reason),
  }, {
    firebaseConfig: { apiKey: "public-id", databaseURL: "https://example.invalid" },
    loadFirebaseModules: async () => fake.modules,
    setTimer: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimer: id => timers.delete(id),
  });
  const connected = fake.callbacks.get(".info/connected");
  connected({ val: () => false });
  assert.equal(timers.size, 0);
  connected({ val: () => true });
  await new Promise(resolve => setTimeout(resolve, 0));
  connected({ val: () => false });
  assert.equal([...timers.values()][0].delay, 5000);
  connected({ val: () => true });
  assert.equal(timers.size, 0);
  connected({ val: () => false });
  const timer = [...timers.values()][0];
  timer.callback();
  timer.callback();
  assert.deepEqual(lost, ["connection_lost"]);
  await adapter.stop();
});

test("공개방이 가득 차면 인증과 Database 연결을 정리한 뒤 솔로로 전환한다", async () => {
  const fake = firebaseModulesFake();
  for (let slot = 0; slot < 10; slot += 1) {
    fake.transactionValues.set(`rooms/public/slots/${slot}`, `user-${slot}`);
  }
  const adapter = await createNetworkAdapter({ playMode: "online" }, {
    firebaseConfig: { apiKey: "public-id", databaseURL: "https://example.invalid" },
    loadFirebaseModules: async () => fake.modules,
  });
  assert.equal(adapter.mode, "solo");
  assert.equal(adapter.reason, "room_full");
  assert.equal(fake.signOutCalls, 0);
  assert.equal(fake.offlineCalls, 1);
});
