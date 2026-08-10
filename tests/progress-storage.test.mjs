import test from "node:test";
import assert from "node:assert/strict";
import * as storageApi from "../src/progress-storage.js";
import { createInitialProgress } from "../src/quest-state.js";

const {
  legacyProgressStorageKey,
  loadProgress,
  progressStorageKey,
  saveProgress,
} = storageApi;

const normalizedName = "%EC%95%84%EB%A0%8C";
const v2Key = () => `pixel-world.progress.v2:${normalizedName}`;
const v3Key = () => `pixel-world.progress.v3:${normalizedName}`;

function validV2(overrides = {}) {
  return {
    version: 2,
    level: 1,
    exp: 12,
    nextLevelExp: 100,
    gold: 18,
    completedQuests: [],
    quests: { adventureStart: { status: "available", progress: 0 } },
    ...overrides,
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("서로 다른 닉네임은 별도 진행 데이터를 사용한다", () => {
  const storage = memoryStorage();
  saveProgress(storage, "아렌", { ...createInitialProgress(), exp: 15 });

  assert.equal(loadProgress(storage, "아렌").exp, 15);
  assert.equal(loadProgress(storage, "다른 모험가").exp, 0);
});

test("v3 키를 사용하고 닉네임 공백을 정규화한다", () => {
  assert.equal(
    progressStorageKey("  아렌   모험가  "),
    "pixel-world.progress.v3:%EC%95%84%EB%A0%8C%20%EB%AA%A8%ED%97%98%EA%B0%80",
  );
  assert.equal(storageApi.v2ProgressStorageKey?.("아렌"), v2Key());
});

test("정상 v1 진행을 v3로 이전하고 원본은 유지한다", () => {
  const storage = memoryStorage();
  const oldValue = {
    version: 1,
    exp: 15,
    quests: { adventureStart: { status: "completed", progress: 3 } },
  };
  storage.setItem(legacyProgressStorageKey("아렌"), JSON.stringify(oldValue));

  const migrated = loadProgress(storage, "아렌");
  assert.deepEqual(migrated, {
    level: 1,
    exp: 15,
    nextLevelExp: 100,
    gold: 0,
    inventory: { hpPotion: 0, mpPotion: 0 },
    completedQuests: ["adventureStart"],
    quests: { adventureStart: { status: "completed", progress: 3 } },
  });
  assert.deepEqual(JSON.parse(storage.getItem(progressStorageKey("아렌"))), {
    version: 3,
    ...migrated,
  });
  assert.deepEqual(JSON.parse(storage.getItem(legacyProgressStorageKey("아렌"))), oldValue);
});

test("손상된 v3가 있으면 정상 v1에서 복구한다", () => {
  const storage = memoryStorage();
  storage.setItem(progressStorageKey("아렌"), "{broken");
  storage.setItem(legacyProgressStorageKey("아렌"), JSON.stringify({
    version: 1,
    exp: 0,
    quests: { adventureStart: { status: "active", progress: 1 } },
  }));

  assert.equal(loadProgress(storage, "아렌").quests.adventureStart.progress, 1);
});

test("손상되거나 유효하지 않은 저장 데이터는 기본값으로 복구된다", () => {
  const storage = memoryStorage();
  storage.setItem(progressStorageKey("아렌"), "{broken");
  assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
});

test("유효하지 않은 v3 진행 데이터는 기본값으로 복구된다", () => {
  const valid = {
    version: 3,
    ...createInitialProgress(),
  };
  const invalidValues = [
    { ...valid, level: 0 },
    { ...valid, exp: -1 },
    { ...valid, exp: 100 },
    { ...valid, nextLevelExp: 101 },
    { ...valid, gold: -1 },
    { ...valid, inventory: { hpPotion: -1, mpPotion: 0 } },
    { ...valid, inventory: { hpPotion: 100, mpPotion: 0 } },
    { ...valid, inventory: { hpPotion: 1.5, mpPotion: 0 } },
    { ...valid, inventory: { hpPotion: 0 } },
    {
      ...valid,
      completedQuests: ["adventureStart", "adventureStart"],
      quests: { adventureStart: { status: "completed", progress: 3 } },
    },
    {
      ...valid,
      completedQuests: ["adventureStart", "otherQuest"],
      quests: { adventureStart: { status: "completed", progress: 3 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "completed", progress: 3 } },
    },
    {
      ...valid,
      completedQuests: ["adventureStart"],
      quests: { adventureStart: { status: "active", progress: 1 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "available", progress: 1 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "active", progress: 3 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "ready_to_report", progress: 0 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "completed", progress: 2 } },
    },
  ];

  for (const value of invalidValues) {
    const storage = memoryStorage();
    storage.setItem(progressStorageKey("아렌"), JSON.stringify(value));
    assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
  }
});

test("유효하지 않은 v1 진행 데이터는 기본값으로 복구된다", () => {
  const storage = memoryStorage();
  storage.setItem(legacyProgressStorageKey("아렌"), JSON.stringify({
    version: 1,
    exp: 100,
    quests: { adventureStart: { status: "active", progress: 1 } },
  }));

  assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
});

test("저장 데이터는 버전 필드를 포함하고 저장 실패는 결과로 알린다", () => {
  const storage = memoryStorage();
  const progress = { ...createInitialProgress(), exp: 15 };
  assert.deepEqual(saveProgress(storage, "아렌", progress), { ok: true });
  assert.deepEqual(
    JSON.parse(storage.getItem(progressStorageKey("아렌"))),
    { version: 3, ...progress },
  );

  const failingStorage = {
    setItem() {
      throw new Error("storage blocked");
    },
  };
  assert.deepEqual(saveProgress(failingStorage, "아렌", progress), { ok: false });
  assert.deepEqual(saveProgress({}, "아렌", progress), { ok: false });
  assert.deepEqual(saveProgress(null, "아렌", progress), { ok: false });
});

test("v1 이전 쓰기가 실패하면 이전 상태에 실패 원인을 포함한다", async () => {
  const { loadProgressWithStatus } = await import("../src/progress-storage.js");
  assert.equal(typeof loadProgressWithStatus, "function");
  const legacy = JSON.stringify({
    version: 1,
    exp: 15,
    quests: { adventureStart: { status: "completed", progress: 3 } },
  });
  const storage = {
    getItem(key) {
      return key === legacyProgressStorageKey("아렌") ? legacy : null;
    },
    setItem() {
      throw new Error("storage blocked");
    },
  };

  const result = loadProgressWithStatus(storage, "아렌");

  assert.equal(result.progress.exp, 15);
  assert.deepEqual(result.progress.completedQuests, ["adventureStart"]);
  assert.equal(result.migrationWriteFailed, true);
});

test("v2 진행은 상태를 유지하고 빈 인벤토리를 추가해 v3로 이전한다", () => {
  const storage = memoryStorage();
  const oldValue = validV2({
    level: 2,
    exp: 10,
    nextLevelExp: 200,
    gold: 35,
    quests: { adventureStart: { status: "active", progress: 1 } },
  });
  storage.setItem(v2Key(), JSON.stringify(oldValue));

  const loaded = loadProgress(storage, "아렌");

  assert.equal(loaded.level, 2);
  assert.equal(loaded.exp, 10);
  assert.equal(loaded.gold, 35);
  assert.deepEqual(loaded.quests, oldValue.quests);
  assert.deepEqual(loaded.inventory, { hpPotion: 0, mpPotion: 0 });
  assert.deepEqual(JSON.parse(storage.getItem(v3Key())), {
    version: 3,
    ...loaded,
  });
  assert.deepEqual(JSON.parse(storage.getItem(v2Key())), oldValue);
});

test("손상된 v3가 있어도 유효한 v2 진행으로 복구한다", () => {
  const storage = memoryStorage();
  const oldValue = validV2();
  storage.setItem(v3Key(), "{broken");
  storage.setItem(v2Key(), JSON.stringify(oldValue));

  const loaded = loadProgress(storage, "아렌");

  assert.equal(loaded.exp, 12);
  assert.equal(loaded.gold, 18);
  assert.deepEqual(loaded.inventory, { hpPotion: 0, mpPotion: 0 });
});
