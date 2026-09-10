import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialProgress,
  markIntroSeen,
} from "../src/quest-state-20260910-sanctuary.js";
import {
  loadProgress,
  progressStorageKey,
  saveProgress,
  v7ProgressStorageKey,
} from "../src/progress-storage-20260910-sanctuary.js";
import { createInitialProgress as createInitialV7Progress } from "../src/quest-state-20260903-volcano-20260905-upgrade.js";

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

test("brand-new progress starts with the first journey unseen", () => {
  const progress = createInitialProgress();
  assert.equal(progress.introSeen, false);
});

test("markIntroSeen is immutable and idempotent", () => {
  const source = createInitialProgress();
  source.gold = 77;
  const first = markIntroSeen(source);
  const second = markIntroSeen(first);

  assert.equal(source.introSeen, false);
  assert.equal(first.introSeen, true);
  assert.equal(second.introSeen, true);
  assert.equal(first.gold, 77);
  assert.deepEqual(second, first);
  assert.notEqual(first, source);
  assert.notEqual(second, first);
});

test("an existing development v8 payload without introSeen normalizes to false", () => {
  const storage = memoryStorage();
  const nickname = "v8-before-intro";
  const payload = createInitialProgress();
  delete payload.introSeen;
  storage.setItem(progressStorageKey(nickname), JSON.stringify({ version: 8, ...payload }));

  const loaded = loadProgress(storage, nickname);
  assert.equal(loaded.introSeen, false);
});

test("a v7 migration is treated as an existing player and skips the new intro", () => {
  const storage = memoryStorage();
  const nickname = "legacy-v7-player";
  const payload = createInitialV7Progress();
  payload.gold = 321;
  storage.setItem(v7ProgressStorageKey(nickname), JSON.stringify({ version: 7, ...payload }));

  const loaded = loadProgress(storage, nickname);
  assert.equal(loaded.introSeen, true);
  assert.equal(loaded.gold, 321);
});

test("introSeen round-trips without changing existing progress", () => {
  const storage = memoryStorage();
  const nickname = "new-wanderer";
  const source = createInitialProgress();
  source.gold = 44;
  source.inventory.hpPotion = 2;
  source.claimedBossRewardIds = ["forest-boss:receipt"];
  const completed = markIntroSeen(source);

  assert.deepEqual(saveProgress(storage, nickname, completed), { ok: true });
  const loaded = loadProgress(storage, nickname);

  assert.equal(loaded.introSeen, true);
  assert.equal(loaded.gold, 44);
  assert.equal(loaded.inventory.hpPotion, 2);
  assert.deepEqual(loaded.claimedBossRewardIds, ["forest-boss:receipt"]);
  assert.deepEqual(loaded.worldProgress, completed.worldProgress);
  assert.deepEqual(loaded.equipmentByClass, completed.equipmentByClass);
  assert.deepEqual(loaded.quests, completed.quests);
});
