import test from "node:test";
import assert from "node:assert/strict";
import {
  legacyProgressStorageKey,
  loadProgress,
  loadProgressWithStatus,
  progressStorageKey,
} from "../src/progress-storage-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { createInitialSanctuaryChapter } from "../src/sanctuary-progress-20260911-sanctuary.js";

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

function oldVersionKey(version, nickname) {
  return `pixel-world.progress.v${version}:${encodeURIComponent(nickname)}`;
}

function validFixture(version) {
  if (version === 1) {
    return {
      version,
      exp: 15,
      quests: { adventureStart: { status: "completed", progress: 3 } },
    };
  }

  const progress = createInitialProgress();
  progress.gold = 347;
  progress.worldProgress.chapters.volcano.captainOutcome = "lost";
  progress.worldProgress.chapters.volcano.coopBossDefeated = true;
  if (version === 2) {
    return {
      version,
      level: progress.level,
      exp: progress.exp,
      nextLevelExp: progress.nextLevelExp,
      gold: progress.gold,
      completedQuests: progress.completedQuests,
      quests: progress.quests,
      worldProgress: progress.worldProgress,
    };
  }
  if (version === 3) {
    return {
      version,
      level: progress.level,
      exp: progress.exp,
      nextLevelExp: progress.nextLevelExp,
      gold: progress.gold,
      inventory: progress.inventory,
      completedQuests: progress.completedQuests,
      quests: progress.quests,
      worldProgress: progress.worldProgress,
    };
  }
  if (version === 4) {
    return {
      ...progress,
      version,
      equipment: { ownedWeaponIds: ["starter-sword"], equippedWeaponId: "starter-sword" },
    };
  }
  return { ...progress, version };
}

for (const version of [1, 2, 3, 4, 5, 6, 7]) {
  test(`migrates v${version} without losing existing progression`, () => {
    const storage = memoryStorage();
    const fixture = validFixture(version);
    storage.setItem(oldVersionKey(version, "기록자"), JSON.stringify(fixture));

    const loaded = loadProgressWithStatus(storage, "기록자");

    assert.equal(loaded.progress.gold, fixture.gold || 0);
    assert.deepEqual(
      loaded.progress.worldProgress.chapters.sanctuary,
      createInitialSanctuaryChapter(),
    );
    if (version > 1) {
      assert.equal(loaded.progress.worldProgress.chapters.volcano.captainOutcome, "lost");
    }
    assert.equal(JSON.parse(storage.getItem("pixel-world.progress.v8:%EA%B8%B0%EB%A1%9D%EC%9E%90")).version, 8);
    assert.deepEqual(JSON.parse(storage.getItem(oldVersionKey(version, "기록자"))), fixture);
    assert.equal(loaded.migrationWriteFailed, false);
  });
}

test("v8 normalizes invalid sanctuary arrays booleans and ending choices", () => {
  const storage = memoryStorage();
  const payload = createInitialProgress();
  payload.gold = 91;
  payload.earnedTitleIds = ["sanctuary-title-seal", "sanctuary-title-seal", "other"];
  payload.claimedNarrativeRewardIds = [
    "sanctuary-ending-seal-exp",
    "sanctuary-ending-seal-exp",
    "other",
  ];
  payload.worldProgress.chapters.sanctuary = {
    memorySequence: "departure-bell",
    memoryOrderSolved: "true",
    endingChoice: "erase",
    completed: true,
  };
  storage.setItem("pixel-world.progress.v8:%EC%98%A4%EC%97%BC%EB%90%9C%EC%A0%80%EC%9E%A5", JSON.stringify({ version: 8, ...payload }));

  const loaded = loadProgress(storage, "오염된저장");
  const sanctuary = loaded.worldProgress.chapters.sanctuary;

  assert.equal(loaded.gold, 91);
  assert.deepEqual(sanctuary.memorySequence, []);
  assert.equal(sanctuary.memoryOrderSolved, false);
  assert.equal(sanctuary.endingChoice, null);
  assert.equal(sanctuary.completed, false);
  assert.deepEqual(loaded.earnedTitleIds, ["sanctuary-title-seal"]);
  assert.deepEqual(loaded.claimedNarrativeRewardIds, ["sanctuary-ending-seal-exp"]);
});

test("v7 migration reports a write failure while retaining the recovered progress", () => {
  const fixture = validFixture(7);
  const storage = {
    getItem(key) {
      return key === oldVersionKey(7, "쓰기 실패") ? JSON.stringify(fixture) : null;
    },
    setItem() {
      throw new Error("storage blocked");
    },
  };

  const loaded = loadProgressWithStatus(storage, "쓰기 실패");

  assert.equal(loaded.progress.gold, fixture.gold);
  assert.equal(loaded.migrationWriteFailed, true);
});

test("malformed v8 data recovers to the initial sanctuary progress", () => {
  const storage = memoryStorage();
  storage.setItem("pixel-world.progress.v8:%EC%86%90%EC%83%81", "{broken");

  assert.deepEqual(loadProgress(storage, "손상"), createInitialProgress());
  assert.equal(legacyProgressStorageKey("손상"), "pixel-world.progress.v1:%EC%86%90%EC%83%81");
});
