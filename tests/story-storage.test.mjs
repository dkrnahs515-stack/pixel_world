import test from "node:test";
import assert from "node:assert/strict";

import { createInitialStoryState } from "../src/story-state.js";
import {
  STORY_SAVE_KEY,
  clearStoryProgress,
  hasStoryProgress,
  loadStoryProgress,
  saveStoryProgress,
} from "../src/story-storage.js";

const RPG_PROGRESS_KEY = "pixel-world.progress.v7:테오";

function memoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  const storage = {
    reads: [],
    writes: [],
    removals: [],
    getItem(key) {
      storage.reads.push(key);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      storage.writes.push({ key, value });
      values.set(key, value);
    },
    removeItem(key) {
      storage.removals.push(key);
      values.delete(key);
    },
  };
  return storage;
}

function throwingStorage(operation) {
  const storage = memoryStorage();
  storage[operation] = () => {
    throw new Error(`${operation} blocked`);
  };
  return storage;
}

function storedState(overrides = {}) {
  return { ...createInitialStoryState(), sceneId: "disposal-rule", ...overrides };
}

test("story progress uses its isolated key and never accesses RPG progress", () => {
  const storage = memoryStorage();
  const state = storedState();

  assert.deepEqual(saveStoryProgress(storage, state), { ok: true, error: "" });
  assert.deepEqual(storage.writes.map(({ key }) => key), [STORY_SAVE_KEY]);

  const loaded = loadStoryProgress(storage);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.state.sceneId, "disposal-rule");
  assert.deepEqual(storage.reads, [STORY_SAVE_KEY]);
  assert.equal([...storage.reads, ...storage.writes.map(({ key }) => key)].includes(RPG_PROGRESS_KEY), false);
});

test("saving writes only the seven canonical fields in stable order and does not mutate input", () => {
  const storage = memoryStorage();
  const state = {
    ...storedState(),
    extraCallerField: "discarded",
    discoveredClueIds: [],
  };
  const before = structuredClone(state);

  assert.deepEqual(saveStoryProgress(storage, state), { ok: true, error: "" });
  assert.equal(storage.writes[0].value, JSON.stringify({
    schemaVersion: 1,
    sceneId: "disposal-rule",
    discoveredClueIds: [],
    completedComparisonIds: [],
    submittedEvidenceIds: [],
    revealedArtIds: ["theo"],
    chapterComplete: false,
  }));
  assert.deepEqual(state, before);
});

test("empty storage returns a fresh initial state", () => {
  const result = loadStoryProgress(memoryStorage());

  assert.equal(result.status, "empty");
  assert.deepEqual(result.state, createInitialStoryState());
});

test("an empty stored value returns a fresh initial state", () => {
  const result = loadStoryProgress(memoryStorage({ [STORY_SAVE_KEY]: "" }));

  assert.equal(result.status, "empty");
  assert.deepEqual(result.state, createInitialStoryState());
});

test("a valid stored checkpoint is normalized and loaded", () => {
  const checkpoint = storedState();
  const storage = memoryStorage({ [STORY_SAVE_KEY]: JSON.stringify(checkpoint) });

  const result = loadStoryProgress(storage);
  assert.equal(result.status, "loaded");
  assert.deepEqual(result.state, checkpoint);
});

test("malformed JSON recovers to an initial state without changing storage", () => {
  const raw = "{";
  const storage = memoryStorage({ [STORY_SAVE_KEY]: raw });

  const result = loadStoryProgress(storage);
  assert.equal(result.status, "recovered");
  assert.deepEqual(result.state, createInitialStoryState());
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(storage.removals, []);
});

test("invalid IDs in a parseable checkpoint recover to an initial state", () => {
  const storage = memoryStorage({
    [STORY_SAVE_KEY]: JSON.stringify(storedState({ discoveredClueIds: ["unknown-clue"] })),
  });

  const result = loadStoryProgress(storage);
  assert.equal(result.status, "recovered");
  assert.deepEqual(result.state, createInitialStoryState());
});

test("impossible parseable progression recovers to an initial state", () => {
  const storage = memoryStorage({
    [STORY_SAVE_KEY]: JSON.stringify(storedState({ chapterComplete: true })),
  });

  const result = loadStoryProgress(storage);
  assert.equal(result.status, "recovered");
  assert.deepEqual(result.state, createInitialStoryState());
});

test("an unsupported schema preserves exact bytes without writing or removing", () => {
  const raw = '{ "schemaVersion" : 2, "future" : true }';
  const storage = memoryStorage({ [STORY_SAVE_KEY]: raw });

  const result = loadStoryProgress(storage);
  assert.equal(result.status, "unsupported");
  assert.deepEqual(result.state, createInitialStoryState());
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(storage.removals, []);
});

test("a get failure recovers instead of throwing", () => {
  const result = loadStoryProgress(throwingStorage("getItem"));

  assert.equal(result.status, "recovered");
  assert.deepEqual(result.state, createInitialStoryState());
});

test("a set failure returns a Korean save error without mutating the input", () => {
  const state = storedState();
  const before = structuredClone(state);

  const result = saveStoryProgress(throwingStorage("setItem"), state);
  assert.equal(result.ok, false);
  assert.match(result.error, /저장할 수 없습니다/);
  assert.deepEqual(state, before);
});

test("an invalid state returns a Korean save error and never writes", () => {
  const storage = memoryStorage();

  const result = saveStoryProgress(storage, storedState({ sceneId: "not-a-scene" }));
  assert.equal(result.ok, false);
  assert.match(result.error, /저장할 수 없습니다/);
  assert.deepEqual(storage.writes, []);
});

test("clearing removes exactly the isolated story key", () => {
  const storage = memoryStorage({ [STORY_SAVE_KEY]: "saved", [RPG_PROGRESS_KEY]: "rpg" });

  assert.deepEqual(clearStoryProgress(storage), { ok: true, error: "" });
  assert.deepEqual(storage.removals, [STORY_SAVE_KEY]);
  assert.equal(storage.reads.includes(RPG_PROGRESS_KEY), false);
});

test("a remove failure returns a Korean clear error", () => {
  const result = clearStoryProgress(throwingStorage("removeItem"));

  assert.equal(result.ok, false);
  assert.match(result.error, /삭제할 수 없습니다/);
});

test("hasStoryProgress distinguishes empty, present, and inaccessible storage", () => {
  assert.equal(hasStoryProgress(memoryStorage()), false);
  assert.equal(hasStoryProgress(memoryStorage({ [STORY_SAVE_KEY]: "{" })), true);
  assert.equal(hasStoryProgress(throwingStorage("getItem")), false);
});

test("separate fallback loads receive separate initial objects and arrays", () => {
  const storage = memoryStorage({ [STORY_SAVE_KEY]: "{" });
  const first = loadStoryProgress(storage).state;
  const second = loadStoryProgress(storage).state;

  first.discoveredClueIds.push("rule-five-years");
  assert.notEqual(first, second);
  assert.notEqual(first.discoveredClueIds, second.discoveredClueIds);
  assert.deepEqual(second, createInitialStoryState());
});
