import { createInitialStoryState, normalizeStoryState } from "./story-state.js";

export const STORY_SAVE_KEY = "pixel-world.story.v1";

function initialResult(status) {
  return { state: createInitialStoryState(), status };
}

function canonicalStoryState(state) {
  return {
    schemaVersion: state.schemaVersion,
    sceneId: state.sceneId,
    discoveredClueIds: [...state.discoveredClueIds],
    completedComparisonIds: [...state.completedComparisonIds],
    submittedEvidenceIds: [...state.submittedEvidenceIds],
    revealedArtIds: [...state.revealedArtIds],
    chapterComplete: state.chapterComplete,
  };
}

export function loadStoryProgress(storage) {
  let rawValue;
  try {
    rawValue = storage.getItem(STORY_SAVE_KEY);
  } catch {
    return initialResult("recovered");
  }

  if (rawValue === null || rawValue === "") {
    return initialResult("empty");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return initialResult("recovered");
  }

  if (
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Object.hasOwn(parsed, "schemaVersion") &&
    parsed.schemaVersion !== 1
  ) {
    return initialResult("unsupported");
  }

  const state = normalizeStoryState(parsed);
  return state === null ? initialResult("recovered") : { state, status: "loaded" };
}

export function saveStoryProgress(storage, state) {
  const normalized = normalizeStoryState(state);
  if (normalized === null) {
    return { ok: false, error: "진행을 저장할 수 없습니다." };
  }

  try {
    storage.setItem(STORY_SAVE_KEY, JSON.stringify(canonicalStoryState(normalized)));
    return { ok: true, error: "" };
  } catch {
    return { ok: false, error: "진행을 저장할 수 없습니다." };
  }
}

export function clearStoryProgress(storage) {
  try {
    storage.removeItem(STORY_SAVE_KEY);
    return { ok: true, error: "" };
  } catch {
    return { ok: false, error: "저장된 진행을 삭제할 수 없습니다." };
  }
}

export function hasStoryProgress(storage) {
  try {
    return storage.getItem(STORY_SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
