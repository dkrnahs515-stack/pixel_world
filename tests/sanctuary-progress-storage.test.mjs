import test from "node:test";
import assert from "node:assert/strict";
import {
  loadProgressWithStatus,
  progressStorageKey,
  saveProgress,
  v7ProgressStorageKey,
} from "../src/progress-storage-20260910-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";
import { sanctuaryUnlockedProgress } from "./helpers/sanctuary-fixtures.mjs";

function memoryStorage({ failOnWrite = null } = {}) {
  const values = new Map();
  const writes = [];
  return {
    writes,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      const nextIndex = writes.length + 1;
      if (failOnWrite === nextIndex) throw new Error("storage write blocked");
      values.set(key, String(value));
      writes.push([key, String(value)]);
    },
  };
}

function completedV7Progress() {
  const progress = createInitialProgress();
  progress.level = 30;
  progress.exp = 77;
  progress.nextLevelExp = 3000;
  progress.gold = 712;
  progress.inventory = { hpPotion: 4, mpPotion: 3 };
  progress.redeemedCodeIds = ["JAEHOON"];
  progress.claimedBossRewardIds = ["forest-core-troll:player-a"];
  progress.equipmentByClass.warrior = {
    ownedWeaponIds: ["starter-sword", "volcanic-heartblade"],
    equippedWeaponId: "volcanic-heartblade",
  };
  progress.worldProgress = sanctuaryUnlockedProgress();
  progress.worldProgress.chapters.volcano = {
    ...progress.worldProgress.chapters.volcano,
    captainOutcome: "rescued",
    hiddenWeaponRewardClaimed: true,
    coreFragmentObtained: true,
    sanctuaryUnlocked: true,
  };
  delete progress.worldProgress.chapters.sanctuary;
  progress.worldProgress.unlockedMapIds = progress.worldProgress.unlockedMapIds.filter(
    id => id !== "sanctuary-resonance-hall",
  );
  delete progress.endingTitle;
  return progress;
}

test("v7 save migrates to v8 without losing existing player progress", () => {
  const storage = memoryStorage();
  const v7 = completedV7Progress();
  storage.setItem(v7ProgressStorageKey("성역테스트"), JSON.stringify({ version: 7, ...v7 }));

  const loaded = loadProgressWithStatus(storage, "성역테스트");

  assert.match(progressStorageKey("성역테스트"), /^pixel-world\.progress\.v8:/);
  assert.equal(loaded.migrationWriteFailed, false);
  assert.equal(loaded.progress.level, 30);
  assert.equal(loaded.progress.gold, 712);
  assert.deepEqual(loaded.progress.inventory, { hpPotion: 4, mpPotion: 3 });
  assert.deepEqual(loaded.progress.redeemedCodeIds, ["JAEHOON"]);
  assert.deepEqual(loaded.progress.claimedBossRewardIds, ["forest-core-troll:player-a"]);
  assert.equal(loaded.progress.equipmentByClass.warrior.equippedWeaponId, "volcanic-heartblade");
  assert.equal(loaded.progress.worldProgress.chapters.volcano.captainOutcome, "rescued");
  assert.equal(loaded.progress.worldProgress.chapters.volcano.coreFragmentObtained, true);
  assert.deepEqual(loaded.progress.worldProgress.chapters.sanctuary, {
    activatedResonanceNodeIds: [],
    restoredArchiveIds: [],
    originRecordIds: [],
    trinityDefeated: false,
    originDefeated: false,
    originDefeatReceiptId: null,
    endingChoice: null,
    endingRewardClaimed: false,
    chapterCompleted: false,
  });
  assert.equal(loaded.progress.endingTitle, null);
  assert.equal(JSON.parse(storage.getItem(progressStorageKey("성역테스트"))).version, 8);
});

test("v7 migration write failure still returns migrated in-memory progress", () => {
  const source = completedV7Progress();
  const v7Key = v7ProgressStorageKey("저장실패");
  let readCount = 0;
  const values = new Map([[v7Key, JSON.stringify({ version: 7, ...source })]]);
  const storage = {
    getItem(key) {
      readCount += 1;
      return values.get(key) ?? null;
    },
    setItem() {
      throw new Error("quota");
    },
  };
  const loaded = loadProgressWithStatus(storage, "저장실패");
  assert.equal(loaded.migrationWriteFailed, true);
  assert.equal(loaded.progress.worldProgress.chapters.sanctuary.originDefeated, false);
  assert.ok(readCount >= 2);
});

test("v8 save accepts only the three exact ending title values", () => {
  const storage = memoryStorage();
  const progress = createInitialProgress();
  progress.endingTitle = "세계의 복원자";
  assert.deepEqual(saveProgress(storage, "복원", progress), { ok: true });

  const invalid = createInitialProgress();
  invalid.endingTitle = "임의 칭호";
  assert.deepEqual(saveProgress(storage, "잘못된칭호", invalid), { ok: false });
});
