import test from "node:test";
import assert from "node:assert/strict";
import { claimRoomSlot, PUBLIC_ROOM_CAPACITY } from "../src/room-capacity.js";

function firebaseSlots(initial = {}) {
  const values = Array.from({ length: PUBLIC_ROOM_CAPACITY }, (_, index) => initial[index] ?? null);
  const disconnects = [];
  const dbModule = {
    ref: (_db, path) => ({ path, index: Number(path.split("/").at(-1)) }),
    runTransaction: async (ref, update) => {
      const next = update(values[ref.index]);
      if (next === undefined) return { committed: false, snapshot: { val: () => values[ref.index] } };
      values[ref.index] = next;
      return { committed: true, snapshot: { val: () => next } };
    },
    onDisconnect: ref => {
      const handle = { ref, removed: 0, cancelled: 0 };
      disconnects.push(handle);
      return {
        remove: async () => { handle.removed += 1; },
        cancel: async () => { handle.cancelled += 1; },
      };
    },
    remove: async ref => { values[ref.index] = null; },
  };
  return { values, disconnects, dependencies: { dbModule, db: {} } };
}

test("0부터 첫 빈 슬롯을 자기 UID로 확보한다", async () => {
  const fake = firebaseSlots({ 0: "other", 1: null });
  const result = await claimRoomSlot({ ...fake.dependencies, roomId: "public", uid: "me" });
  assert.equal(result.ok, true);
  assert.equal(result.slotIndex, 1);
  assert.equal(fake.values[1], "me");
  assert.equal(fake.disconnects[0].removed, 1);
});

test("열 슬롯이 모두 차면 room_full을 반환한다", async () => {
  const fake = firebaseSlots(Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index, `u${index}`])));
  const result = await claimRoomSlot({ ...fake.dependencies, roomId: "public", uid: "me" });
  assert.deepEqual(result, { ok: false, reason: "room_full" });
});

test("release는 자기 슬롯만 한 번 제거한다", async () => {
  const fake = firebaseSlots({ 0: null });
  const result = await claimRoomSlot({ ...fake.dependencies, roomId: "public", uid: "me" });
  await result.release();
  await result.release();
  assert.equal(fake.values[0], null);
  assert.equal(fake.disconnects[0].cancelled, 1);
});
