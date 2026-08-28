import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASS_PREFERENCE_KEY,
  entryButtonLabel,
  getBrowserStorage,
  readStoredClassId,
  storeClassId,
  validateEntrySelection,
} from "../src/class-selection.js";

test("브라우저 저장소 getter 자체가 차단돼도 null로 복구한다", () => {
  const blockedGlobal = {};
  Object.defineProperty(blockedGlobal, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  });
  assert.equal(getBrowserStorage(blockedGlobal), null);
  assert.equal(getBrowserStorage({ localStorage: storageWith(null) }).getItem(CLASS_PREFERENCE_KEY), null);
});

function storageWith(value, { readError = false, writeError = false } = {}) {
  const writes = [];
  return {
    writes,
    getItem(key) {
      if (readError) throw new Error("blocked");
      return key === CLASS_PREFERENCE_KEY ? value : null;
    },
    setItem(key, next) {
      if (writeError) throw new Error("blocked");
      writes.push([key, next]);
    },
  };
}

test("유효한 마지막 직업만 브라우저 선호에서 복구한다", () => {
  assert.equal(CLASS_PREFERENCE_KEY, "pixelWorldClassId");
  assert.equal(readStoredClassId(storageWith("archer")), "archer");
  assert.equal(readStoredClassId(storageWith("unknown")), null);
  assert.equal(readStoredClassId(storageWith(null)), null);
  assert.equal(readStoredClassId(storageWith("mage", { readError: true })), null);
});

test("직업 선호 저장은 유효한 값과 저장소 예외를 결과로 구분한다", () => {
  const storage = storageWith(null);
  assert.deepEqual(storeClassId(storage, "mage"), { ok: true });
  assert.deepEqual(storage.writes, [[CLASS_PREFERENCE_KEY, "mage"]]);
  assert.deepEqual(storeClassId(storage, "unknown"), { ok: false });
  assert.deepEqual(storeClassId(storageWith(null, { writeError: true }), "warrior"), { ok: false });
});

test("입장 검증은 닉네임과 명시적인 세 직업 선택을 모두 요구한다", () => {
  assert.deepEqual(validateEntrySelection("", "warrior"), {
    ok: false,
    field: "nickname",
    error: "닉네임을 입력해 주세요.",
  });
  assert.deepEqual(validateEntrySelection("용사", null), {
    ok: false,
    field: "classId",
    error: "플레이할 직업을 선택해 주세요.",
  });
  assert.deepEqual(validateEntrySelection("용사", "unknown"), {
    ok: false,
    field: "classId",
    error: "플레이할 직업을 선택해 주세요.",
  });
  assert.deepEqual(validateEntrySelection("  용사   일행  ", "mage"), {
    ok: true,
    nickname: "용사 일행",
    classId: "mage",
  });
});

test("입장 버튼은 선택 전 안내와 선택한 직업명을 표시한다", () => {
  assert.equal(entryButtonLabel(null), "직업을 선택해 주세요");
  assert.equal(entryButtonLabel("warrior"), "검사로 입장");
  assert.equal(entryButtonLabel("archer"), "궁수로 입장");
  assert.equal(entryButtonLabel("mage"), "마법사로 입장");
  assert.equal(entryButtonLabel("unknown"), "직업을 선택해 주세요");
});
