import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAY_MODE,
  PLAY_MODES,
  PLAY_MODE_PREFERENCE_KEY,
  normalizePlayMode,
  readStoredPlayMode,
  storePlayMode,
  validatePlayMode,
} from "../src/play-mode.js";

function memoryStorage(value = null, { readError = false, writeError = false } = {}) {
  return {
    value,
    getItem(key) {
      if (readError) throw new Error("blocked");
      return key === PLAY_MODE_PREFERENCE_KEY ? this.value : null;
    },
    setItem(key, next) {
      if (writeError) throw new Error("blocked");
      if (key === PLAY_MODE_PREFERENCE_KEY) this.value = next;
    },
  };
}

test("플레이 모드는 솔로와 온라인만 허용하고 기본값은 솔로다", () => {
  assert.deepEqual(PLAY_MODES, ["solo", "online"]);
  assert.equal(DEFAULT_PLAY_MODE, "solo");
  assert.equal(normalizePlayMode("online"), "online");
  assert.equal(normalizePlayMode("invalid"), "solo");
});

test("마지막 유효 모드를 저장하고 잘못된 저장값은 솔로로 읽는다", () => {
  const storage = memoryStorage("invalid");
  assert.equal(readStoredPlayMode(storage), "solo");
  assert.equal(storePlayMode(storage, "online"), true);
  assert.equal(readStoredPlayMode(storage), "online");
  assert.equal(storePlayMode(storage, "invalid"), false);
});

test("저장소 예외는 기본 솔로와 저장 실패로 복구한다", () => {
  assert.equal(readStoredPlayMode(memoryStorage("online", { readError: true })), "solo");
  assert.equal(storePlayMode(memoryStorage(null, { writeError: true }), "online"), false);
  assert.deepEqual(validatePlayMode("online"), { ok: true, playMode: "online" });
  assert.deepEqual(validatePlayMode("invalid"), {
    ok: false,
    field: "playMode",
    error: "플레이 모드를 선택해 주세요.",
  });
});
