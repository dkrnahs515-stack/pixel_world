import test from "node:test";
import assert from "node:assert/strict";
import * as storageApi from "../src/progress-storage.js";
import { createInitialProgress } from "../src/quest-state.js";
import { createInitialEquipmentByClass } from "../src/equipment-state.js";

const {
  legacyProgressStorageKey,
  loadProgress,
  loadProgressWithStatus,
  progressStorageKey,
  saveProgress,
  v2ProgressStorageKey,
  v3ProgressStorageKey,
  v4ProgressStorageKey,
} = storageApi;

function memoryStorage() {
  const values = new Map();
  const writes = [];
  return {
    writes,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
      writes.push([key, String(value)]);
    },
  };
}

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

function validV3(overrides = {}) {
  const initial = createInitialProgress();
  return {
    version: 3,
    level: initial.level,
    exp: initial.exp,
    nextLevelExp: initial.nextLevelExp,
    gold: initial.gold,
    inventory: initial.inventory,
    completedQuests: initial.completedQuests,
    quests: initial.quests,
    ...overrides,
  };
}

test("v5 키를 사용하고 모든 이전 버전 키의 닉네임 공백을 정규화한다", () => {
  const encoded = "%EC%95%84%EB%A0%8C%20%EB%AA%A8%ED%97%98%EA%B0%80";
  assert.equal(progressStorageKey("  아렌   모험가  "), `pixel-world.progress.v5:${encoded}`);
  assert.equal(v4ProgressStorageKey("  아렌   모험가  "), `pixel-world.progress.v4:${encoded}`);
  assert.equal(v3ProgressStorageKey("  아렌   모험가  "), `pixel-world.progress.v3:${encoded}`);
  assert.equal(v2ProgressStorageKey("  아렌   모험가  "), `pixel-world.progress.v2:${encoded}`);
  assert.equal(legacyProgressStorageKey("  아렌   모험가  "), `pixel-world.progress.v1:${encoded}`);
});

test("서로 다른 닉네임은 장비를 포함한 별도 진행 데이터를 사용한다", () => {
  const storage = memoryStorage();
  const progress = {
    ...createInitialProgress(),
    exp: 15,
    equipmentByClass: {
      ...createInitialEquipmentByClass(),
      warrior: {
        ownedWeaponIds: ["starter-sword", "katana"],
        equippedWeaponId: "katana",
      },
    },
  };
  assert.deepEqual(saveProgress(storage, "아렌", progress), { ok: true });
  assert.equal(loadProgress(storage, "아렌").exp, 15);
  assert.equal(loadProgress(storage, "아렌").equipmentByClass.warrior.equippedWeaponId, "katana");
  assert.deepEqual(loadProgress(storage, "다른 모험가"), createInitialProgress());
});

test("정상 v5 진행은 직업별 장비 배열까지 복제해 왕복한다", () => {
  const storage = memoryStorage();
  const source = {
    ...createInitialProgress(),
    level: 25,
    nextLevelExp: 2500,
    gold: 451,
    equipmentByClass: {
      ...createInitialEquipmentByClass(),
      warrior: {
        ownedWeaponIds: ["starter-sword", "katana", "masterwork-katana"],
        equippedWeaponId: "masterwork-katana",
      },
    },
  };
  assert.deepEqual(saveProgress(storage, "아렌", source), { ok: true });
  const loaded = loadProgress(storage, "아렌");
  assert.deepEqual(loaded, source);
  assert.notEqual(loaded.equipmentByClass, source.equipmentByClass);
  assert.notEqual(
    loaded.equipmentByClass.warrior.ownedWeaponIds,
    source.equipmentByClass.warrior.ownedWeaponIds,
  );
  assert.deepEqual(JSON.parse(storage.getItem(progressStorageKey("아렌"))), {
    version: 5,
    ...source,
  });
});

test("v4의 장비 목록과 장착값만 손상되면 나머지를 유지하며 시작 검으로 정규화한다", () => {
  const storage = memoryStorage();
  storage.setItem(v4ProgressStorageKey("아렌"), JSON.stringify({
    version: 4,
    ...createInitialProgress(),
    level: 10,
    nextLevelExp: 1000,
    gold: 321,
    equipment: {
      ownedWeaponIds: ["katana", "katana", "unknown"],
      equippedWeaponId: "unknown",
    },
  }));
  const loaded = loadProgress(storage, "아렌");
  assert.equal(loaded.level, 10);
  assert.equal(loaded.gold, 321);
  assert.deepEqual(loaded.equipmentByClass.warrior, {
    ownedWeaponIds: ["starter-sword", "katana"],
    equippedWeaponId: "starter-sword",
  });
});

test("유효한 v3는 진행과 물약을 유지하고 초기 장비를 추가해 v5로 이전한다", () => {
  const storage = memoryStorage();
  const oldValue = validV3({
    level: 2,
    exp: 10,
    nextLevelExp: 200,
    gold: 35,
    inventory: { hpPotion: 2, mpPotion: 3 },
    quests: { adventureStart: { status: "active", progress: 1 } },
  });
  storage.setItem(v3ProgressStorageKey("아렌"), JSON.stringify(oldValue));
  const loaded = loadProgress(storage, "아렌");
  assert.equal(loaded.level, 2);
  assert.equal(loaded.exp, 10);
  assert.equal(loaded.gold, 35);
  assert.deepEqual(loaded.inventory, { hpPotion: 2, mpPotion: 3 });
  assert.deepEqual(loaded.equipmentByClass, createInitialEquipmentByClass());
  assert.deepEqual(JSON.parse(storage.getItem(progressStorageKey("아렌"))), {
    version: 5,
    ...loaded,
  });
  assert.deepEqual(JSON.parse(storage.getItem(v3ProgressStorageKey("아렌"))), oldValue);
});

test("기본 진행이 손상된 v4는 정상 v3에서 복구한다", () => {
  const storage = memoryStorage();
  storage.setItem(v4ProgressStorageKey("아렌"), JSON.stringify({
    version: 4,
    ...createInitialProgress(),
    gold: -1,
  }));
  storage.setItem(v3ProgressStorageKey("아렌"), JSON.stringify(validV3({ gold: 77 })));
  const loaded = loadProgress(storage, "아렌");
  assert.equal(loaded.gold, 77);
  assert.deepEqual(loaded.equipmentByClass, createInitialEquipmentByClass());
});

test("v2 진행은 빈 인벤토리와 초기 장비를 추가해 v5로 이전한다", () => {
  const storage = memoryStorage();
  const oldValue = validV2({
    level: 2,
    exp: 10,
    nextLevelExp: 200,
    gold: 35,
    quests: { adventureStart: { status: "active", progress: 1 } },
  });
  storage.setItem(v2ProgressStorageKey("아렌"), JSON.stringify(oldValue));
  const loaded = loadProgress(storage, "아렌");
  assert.equal(loaded.level, 2);
  assert.equal(loaded.gold, 35);
  assert.deepEqual(loaded.inventory, { hpPotion: 0, mpPotion: 0 });
  assert.deepEqual(loaded.equipmentByClass, createInitialEquipmentByClass());
  assert.deepEqual(JSON.parse(storage.getItem(progressStorageKey("아렌"))), {
    version: 5,
    ...loaded,
  });
  assert.deepEqual(JSON.parse(storage.getItem(v2ProgressStorageKey("아렌"))), oldValue);
});

test("v1 진행은 기존 보상을 유지하고 초기 장비를 추가해 v5로 이전한다", () => {
  const storage = memoryStorage();
  const oldValue = {
    version: 1,
    exp: 15,
    quests: { adventureStart: { status: "completed", progress: 3 } },
  };
  storage.setItem(legacyProgressStorageKey("아렌"), JSON.stringify(oldValue));
  const loaded = loadProgress(storage, "아렌");
  assert.deepEqual(loaded, {
    level: 1,
    exp: 15,
    nextLevelExp: 100,
    gold: 0,
    inventory: { hpPotion: 0, mpPotion: 0 },
    equipmentByClass: createInitialEquipmentByClass(),
    claimedBossRewardIds: [],
    completedQuests: ["adventureStart"],
    quests: { adventureStart: { status: "completed", progress: 3 } },
  });
  assert.deepEqual(JSON.parse(storage.getItem(progressStorageKey("아렌"))), {
    version: 5,
    ...loaded,
  });
  assert.deepEqual(JSON.parse(storage.getItem(legacyProgressStorageKey("아렌"))), oldValue);
});

test("손상된 상위 버전을 건너뛰고 v2와 v1을 차례로 복구한다", () => {
  const storage = memoryStorage();
  storage.setItem(progressStorageKey("아렌"), "{broken");
  storage.setItem(v3ProgressStorageKey("아렌"), "{broken");
  storage.setItem(v2ProgressStorageKey("아렌"), JSON.stringify(validV2()));
  assert.equal(loadProgress(storage, "아렌").exp, 12);

  const legacyOnly = memoryStorage();
  legacyOnly.setItem(progressStorageKey("아렌"), "{broken");
  legacyOnly.setItem(v3ProgressStorageKey("아렌"), "{broken");
  legacyOnly.setItem(v2ProgressStorageKey("아렌"), "{broken");
  legacyOnly.setItem(legacyProgressStorageKey("아렌"), JSON.stringify({
    version: 1,
    exp: 7,
    quests: { adventureStart: { status: "active", progress: 1 } },
  }));
  assert.equal(loadProgress(legacyOnly, "아렌").exp, 7);
});

test("유효하지 않은 진행 데이터는 장비를 포함한 기본값으로 복구된다", () => {
  const valid = { version: 5, ...createInitialProgress() };
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
    { ...valid, quests: { adventureStart: { status: "available", progress: 1 } } },
    { ...valid, quests: { adventureStart: { status: "active", progress: 3 } } },
    { ...valid, quests: { adventureStart: { status: "completed", progress: 2 } } },
  ];
  for (const value of invalidValues) {
    const storage = memoryStorage();
    storage.setItem(progressStorageKey("아렌"), JSON.stringify(value));
    assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
  }
});

test("저장 실패와 이전 쓰기 실패를 결과로 알리되 복구된 세션 상태는 유지한다", () => {
  const failingStorage = {
    getItem(key) {
      if (key !== v3ProgressStorageKey("아렌")) return null;
      return JSON.stringify(validV3({ exp: 15 }));
    },
    setItem() {
      throw new Error("storage blocked");
    },
  };
  const migrated = loadProgressWithStatus(failingStorage, "아렌");
  assert.equal(migrated.progress.exp, 15);
  assert.deepEqual(migrated.progress.equipmentByClass, createInitialEquipmentByClass());
  assert.equal(migrated.migrationWriteFailed, true);
  assert.deepEqual(saveProgress(failingStorage, "아렌", createInitialProgress()), { ok: false });
  assert.deepEqual(saveProgress({}, "아렌", createInitialProgress()), { ok: false });
  assert.deepEqual(saveProgress(null, "아렌", createInitialProgress()), { ok: false });
});

test("v5 키를 사용하고 v4 키를 별도 이전 소스로 노출한다", () => {
  const encoded = "%EC%95%84%EB%A0%8C%20%EB%AA%A8%ED%97%98%EA%B0%80";
  assert.equal(progressStorageKey("  아렌   모험가  "), `pixel-world.progress.v5:${encoded}`);
  assert.equal(
    storageApi.v4ProgressStorageKey?.("  아렌   모험가  "),
    `pixel-world.progress.v4:${encoded}`,
  );
});

test("v4 검 장비를 검사 슬롯으로 옮기고 다른 직업은 기본 장비로 시작한다", () => {
  const storage = memoryStorage();
  const v4 = {
    version: 4,
    level: 25,
    exp: 77,
    nextLevelExp: 2500,
    gold: 451,
    inventory: { hpPotion: 2, mpPotion: 3 },
    equipment: {
      ownedWeaponIds: ["starter-sword", "katana", "masterwork-katana"],
      equippedWeaponId: "masterwork-katana",
    },
    completedQuests: [],
    quests: { adventureStart: { status: "active", progress: 2 } },
  };
  storage.setItem(storageApi.v4ProgressStorageKey?.("아렌"), JSON.stringify(v4));

  const migrated = loadProgress(storage, "아렌");

  assert.equal(migrated.level, 25);
  assert.equal(migrated.exp, 77);
  assert.equal(migrated.gold, 451);
  assert.deepEqual(migrated.inventory, { hpPotion: 2, mpPotion: 3 });
  assert.deepEqual(migrated.quests, v4.quests);
  assert.deepEqual(migrated.equipmentByClass, {
    ...createInitialEquipmentByClass(),
    warrior: {
      ownedWeaponIds: ["starter-sword", "katana", "masterwork-katana"],
      equippedWeaponId: "masterwork-katana",
    },
  });
  assert.deepEqual(JSON.parse(storage.getItem(progressStorageKey("아렌"))), {
    version: 5,
    ...migrated,
  });
  assert.deepEqual(JSON.parse(storage.getItem(storageApi.v4ProgressStorageKey("아렌"))), v4);
});

test("v5 직업 장비 하나가 손상되면 공통 진행과 다른 직업 장비를 유지한다", () => {
  const storage = memoryStorage();
  const equipmentByClass = {
    warrior: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "katana" },
    archer: { ownedWeaponIds: ["hunter-bow", "unknown"], equippedWeaponId: "unknown" },
    mage: { ownedWeaponIds: ["training-staff", "archmage-staff"], equippedWeaponId: "archmage-staff" },
  };
  storage.setItem(progressStorageKey("아렌"), JSON.stringify({
    version: 5,
    ...createInitialProgress(),
    level: 30,
    nextLevelExp: 3000,
    gold: 777,
    equipmentByClass,
  }));

  const loaded = loadProgress(storage, "아렌");

  assert.equal(loaded.level, 30);
  assert.equal(loaded.gold, 777);
  assert.deepEqual(loaded.equipmentByClass.warrior, equipmentByClass.warrior);
  assert.deepEqual(loaded.equipmentByClass.archer, {
    ownedWeaponIds: ["training-bow", "hunter-bow"],
    equippedWeaponId: "training-bow",
  });
  assert.deepEqual(loaded.equipmentByClass.mage, equipmentByClass.mage);
});

test("v5 저장은 세 직업 장비를 독립 배열로 왕복한다", () => {
  const storage = memoryStorage();
  const source = {
    ...createInitialProgress(),
    gold: 99,
    equipmentByClass: {
      warrior: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "katana" },
      archer: { ownedWeaponIds: ["training-bow", "hunter-bow"], equippedWeaponId: "hunter-bow" },
      mage: { ownedWeaponIds: ["training-staff", "apprentice-staff"], equippedWeaponId: "apprentice-staff" },
    },
  };
  delete source.equipment;

  assert.deepEqual(saveProgress(storage, "아렌", source), { ok: true });
  const loaded = loadProgress(storage, "아렌");
  assert.deepEqual(loaded, source);
  for (const classId of ["warrior", "archer", "mage"]) {
    assert.notEqual(loaded.equipmentByClass[classId], source.equipmentByClass[classId]);
    assert.notEqual(
      loaded.equipmentByClass[classId].ownedWeaponIds,
      source.equipmentByClass[classId].ownedWeaponIds,
    );
  }
});

test("협동 보상 영수증은 진행과 원자적으로 저장되고 기존 v5에는 빈 목록을 보완한다", () => {
  const storage = memoryStorage();
  const progress = { ...createInitialProgress(), claimedBossRewardIds: ["boss-1:uid", "boss-2:uid"] };
  assert.deepEqual(saveProgress(storage, "협동", progress), { ok: true });
  assert.deepEqual(loadProgress(storage, "협동").claimedBossRewardIds, ["boss-1:uid", "boss-2:uid"]);

  const legacyV5 = { version: 5, ...createInitialProgress() };
  delete legacyV5.claimedBossRewardIds;
  storage.setItem(progressStorageKey("기존"), JSON.stringify(legacyV5));
  assert.deepEqual(loadProgress(storage, "기존").claimedBossRewardIds, []);
});
