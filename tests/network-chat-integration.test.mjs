import test from "node:test";
import assert from "node:assert/strict";
import { createNetworkAdapter } from "../src/network.js";

function firebaseModulesFake() {
  const callbacks = new Map();
  const disconnects = [];
  const updates = [];
  const dbModule = {
    getDatabase: () => ({}),
    ref: (_db, path) => ({ path, key: path.split("/").at(-1) }),
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
    updates,
    modules: {
      appModule: { getApps: () => [], initializeApp: () => ({}) },
      authModule: { getAuth: () => ({ currentUser: null }), signInAnonymously: async () => ({ user: { uid: "user-a" } }) },
      dbModule,
    },
  };
}

test("플레이어와 채팅은 인증 연결을 공유하고 재연결 때 자동 삭제를 다시 예약한다", async () => {
  const fake = firebaseModulesFake();
  const statuses = [];
  const adapter = await createNetworkAdapter({
    onPlayersChanged: () => {},
    onStatusChanged: (status, label) => statuses.push({ status, label }),
    onChatMessagesChanged: () => {},
  }, {
    firebaseConfig: { apiKey: "public-id", databaseURL: "https://example.invalid" },
    loadFirebaseModules: async () => fake.modules,
  });

  assert.equal(adapter.mode, "firebase");
  assert.equal(adapter.chat.mode, "firebase");
  fake.callbacks.get(".info/connected")({ val: () => true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(fake.disconnects.map(item => item.path).sort(), [
    "rooms/public/chat/user-a",
    "rooms/public/players/user-a",
  ]);
  assert.equal(statuses.at(-1).status, "online");
  await adapter.stop();
});

test("네트워크 게시에는 현재 직업과 해당 장착 무기가 포함된다", async () => {
  const fake = firebaseModulesFake();
  const originalPerformance = globalThis.performance;
  let now = 1000;
  globalThis.performance = { now: () => now };
  try {
    const adapter = await createNetworkAdapter({ onPlayersChanged: () => {} }, {
      firebaseConfig: { apiKey: "public-id", databaseURL: "https://example.invalid" },
      loadFirebaseModules: async () => fake.modules,
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
    await adapter.stop();
    now += 100;
  } finally {
    globalThis.performance = originalPerformance;
  }
});
