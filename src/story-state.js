import {
  CHAPTER_01,
  STORY_CLAIM_IDS,
  STORY_CLUE_IDS,
  STORY_COMPARISON_IDS,
  STORY_SCENE_IDS,
} from "./story-chapter-01-data.js";

const SCHEMA_VERSION = 1;
const INITIAL_ART_IDS = ["theo"];
const HOLD_ART_IDS = ["theo", "returnedSignal"];
const EVIDENCE_IDS = Object.keys(CHAPTER_01.evidence);
const REQUIRED_EVIDENCE_IDS = CHAPTER_01.claims["investigate-survival"].requiredEvidenceIds;
const OPTIONAL_EVIDENCE_IDS = EVIDENCE_IDS.filter((id) => !REQUIRED_EVIDENCE_IDS.includes(id));

function sceneIndex(sceneId) {
  return STORY_SCENE_IDS.indexOf(sceneId);
}

function firstSceneIndexFor(requiredKey, id) {
  return STORY_SCENE_IDS.findIndex((sceneId) =>
    CHAPTER_01.scenes[sceneId][requiredKey].includes(id),
  );
}

function canonicalIds(ids, allowedIds) {
  const supplied = Array.isArray(ids) ? new Set(ids) : new Set();
  return allowedIds.filter((id) => supplied.has(id));
}

function stateFrom(state) {
  const source = state && typeof state === "object" && !Array.isArray(state) ? state : {};
  const resolvedSceneId = sceneIndex(source.sceneId) >= 0 ? source.sceneId : "duty";
  const revealedArtIds = canonicalIds(source.revealedArtIds, Object.keys(CHAPTER_01.art));

  return {
    schemaVersion: SCHEMA_VERSION,
    sceneId: resolvedSceneId,
    discoveredClueIds: canonicalIds(source.discoveredClueIds, STORY_CLUE_IDS),
    completedComparisonIds: canonicalIds(source.completedComparisonIds, STORY_COMPARISON_IDS),
    submittedEvidenceIds: canonicalIds(source.submittedEvidenceIds, EVIDENCE_IDS),
    revealedArtIds: revealedArtIds.length ? revealedArtIds : [...INITIAL_ART_IDS],
    chapterComplete: source.chapterComplete === true,
  };
}

function cloneState(state, changes = {}) {
  return stateFrom({ ...state, ...changes });
}

function feedbackForInvalidSubmission(claimId) {
  return CHAPTER_01.feedback[claimId] ?? "제출할 수 있는 근거를 확인하세요.";
}

function evidenceIsAvailable(state, evidenceId) {
  const evidence = CHAPTER_01.evidence[evidenceId];
  if (!evidence) {
    return false;
  }
  return evidence.source === "clue"
    ? state.discoveredClueIds.includes(evidence.sourceId)
    : state.completedComparisonIds.includes(evidence.sourceId);
}

function containsExactly(ids, expected) {
  return ids.length === expected.length && ids.every((id, index) => id === expected[index]);
}

function hasNoDuplicates(ids) {
  return Array.isArray(ids) && new Set(ids).size === ids.length;
}

function hasOnlyKnownIds(ids, allowedIds) {
  return ids.every((id) => allowedIds.includes(id));
}

function hasArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function satisfiesCompletedScenes(state) {
  const currentIndex = sceneIndex(state.sceneId);
  for (let index = 0; index < currentIndex; index += 1) {
    const scene = CHAPTER_01.scenes[STORY_SCENE_IDS[index]];
    if (!scene.requiredClueIds.every((id) => state.discoveredClueIds.includes(id))) {
      return false;
    }
    if (!scene.requiredComparisonIds.every((id) => state.completedComparisonIds.includes(id))) {
      return false;
    }
  }
  return true;
}

function respectsSceneAvailability(state) {
  const currentIndex = sceneIndex(state.sceneId);
  if (state.discoveredClueIds.some((id) => firstSceneIndexFor("requiredClueIds", id) > currentIndex)) {
    return false;
  }
  if (state.completedComparisonIds.some((id) => firstSceneIndexFor("requiredComparisonIds", id) > currentIndex)) {
    return false;
  }
  return state.completedComparisonIds.every((id) =>
    CHAPTER_01.comparisons[id].requiredClueIds.every((clueId) => state.discoveredClueIds.includes(clueId)),
  );
}

export function createInitialStoryState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    sceneId: "duty",
    discoveredClueIds: [],
    completedComparisonIds: [],
    submittedEvidenceIds: [],
    revealedArtIds: [...INITIAL_ART_IDS],
    chapterComplete: false,
  };
}

export function discoverClue(state, clueId) {
  const nextState = cloneState(state);
  const clueSceneIndex = firstSceneIndexFor("requiredClueIds", clueId);
  if (!STORY_CLUE_IDS.includes(clueId) || clueSceneIndex > sceneIndex(nextState.sceneId)) {
    return nextState;
  }
  return cloneState(nextState, {
    discoveredClueIds: [...nextState.discoveredClueIds, clueId],
  });
}

export function completeComparison(state, comparisonId) {
  const nextState = cloneState(state);
  const comparisonSceneIndex = firstSceneIndexFor("requiredComparisonIds", comparisonId);
  if (
    !STORY_COMPARISON_IDS.includes(comparisonId) ||
    comparisonSceneIndex !== sceneIndex(nextState.sceneId)
  ) {
    return nextState;
  }
  const comparison = CHAPTER_01.comparisons[comparisonId];
  if (!comparison.requiredClueIds.every((id) => nextState.discoveredClueIds.includes(id))) {
    return nextState;
  }
  return cloneState(nextState, {
    completedComparisonIds: [...nextState.completedComparisonIds, comparisonId],
  });
}

export function canAdvance(state) {
  const nextState = cloneState(state);
  const scene = CHAPTER_01.scenes[nextState.sceneId];
  const missingIds = [
    ...scene.requiredClueIds.filter((id) => !nextState.discoveredClueIds.includes(id)),
    ...scene.requiredComparisonIds.filter((id) => !nextState.completedComparisonIds.includes(id)),
  ];
  return { ok: missingIds.length === 0, missingIds };
}

export function advanceStory(state) {
  const nextState = cloneState(state);
  const scene = CHAPTER_01.scenes[nextState.sceneId];
  const advanceCheck = canAdvance(nextState);
  if (!advanceCheck.ok) {
    return { ok: false, state: nextState, feedback: scene.hint };
  }

  if (nextState.sceneId === "case-submit") {
    return { ok: false, state: nextState, feedback: scene.hint };
  }

  if (nextState.sceneId === "hold-depart") {
    return {
      ok: true,
      state: cloneState(nextState, { chapterComplete: true }),
      feedback: CHAPTER_01.result,
    };
  }

  const nextSceneId = STORY_SCENE_IDS[sceneIndex(nextState.sceneId) + 1];
  return {
    ok: true,
    state: cloneState(nextState, { sceneId: nextSceneId }),
    feedback: "",
  };
}

export function submitEvidence(state, submission) {
  const nextState = cloneState(state);
  const claimId = submission?.claimId;
  const evidenceIds = submission?.evidenceIds;
  const rejected = (feedback) => ({ accepted: false, state: nextState, feedback });

  if (nextState.sceneId !== "case-submit") {
    return rejected(CHAPTER_01.scenes[nextState.sceneId].hint);
  }
  if (!canAdvance(nextState).ok) {
    return rejected(CHAPTER_01.scenes["case-submit"].hint);
  }
  if (!satisfiesCompletedScenes(nextState) || !respectsSceneAvailability(nextState)) {
    return rejected(CHAPTER_01.feedback.incompletePrerequisites);
  }
  if (!STORY_CLAIM_IDS.includes(claimId) || claimId !== "investigate-survival") {
    return rejected(feedbackForInvalidSubmission(claimId));
  }
  if (!hasArray(evidenceIds) || !hasNoDuplicates(evidenceIds) || !hasOnlyKnownIds(evidenceIds, EVIDENCE_IDS)) {
    return rejected(feedbackForInvalidSubmission(claimId));
  }
  if (!REQUIRED_EVIDENCE_IDS.every((id) => evidenceIds.includes(id))) {
    return rejected(feedbackForInvalidSubmission(claimId));
  }
  if (!evidenceIds.every((id) => REQUIRED_EVIDENCE_IDS.includes(id) || OPTIONAL_EVIDENCE_IDS.includes(id))) {
    return rejected(feedbackForInvalidSubmission(claimId));
  }
  if (!evidenceIds.every((id) => evidenceIsAvailable(nextState, id))) {
    return rejected(feedbackForInvalidSubmission(claimId));
  }

  return {
    accepted: true,
    state: cloneState(nextState, {
      sceneId: "hold-depart",
      submittedEvidenceIds: evidenceIds,
      revealedArtIds: HOLD_ART_IDS,
      chapterComplete: false,
    }),
    feedback: CHAPTER_01.feedback[claimId],
  };
}

export function normalizeStoryState(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  if (
    value.schemaVersion !== SCHEMA_VERSION ||
    typeof value.sceneId !== "string" ||
    typeof value.chapterComplete !== "boolean" ||
    !hasArray(value.discoveredClueIds) ||
    !hasArray(value.completedComparisonIds) ||
    !hasArray(value.submittedEvidenceIds) ||
    !hasArray(value.revealedArtIds)
  ) {
    return null;
  }
  if (
    sceneIndex(value.sceneId) < 0 ||
    !hasNoDuplicates(value.discoveredClueIds) ||
    !hasNoDuplicates(value.completedComparisonIds) ||
    !hasNoDuplicates(value.submittedEvidenceIds) ||
    !hasNoDuplicates(value.revealedArtIds) ||
    !hasOnlyKnownIds(value.discoveredClueIds, STORY_CLUE_IDS) ||
    !hasOnlyKnownIds(value.completedComparisonIds, STORY_COMPARISON_IDS) ||
    !hasOnlyKnownIds(value.submittedEvidenceIds, EVIDENCE_IDS) ||
    !hasOnlyKnownIds(value.revealedArtIds, Object.keys(CHAPTER_01.art))
  ) {
    return null;
  }

  const inputIsHoldDepart = value.sceneId === "hold-depart";
  if (!containsExactly(value.revealedArtIds, inputIsHoldDepart ? HOLD_ART_IDS : INITIAL_ART_IDS)) {
    return null;
  }

  const state = stateFrom(value);
  const isHoldDepart = state.sceneId === "hold-depart";
  if (!satisfiesCompletedScenes(state) || !respectsSceneAvailability(state)) {
    return null;
  }
  if (!containsExactly(state.revealedArtIds, isHoldDepart ? HOLD_ART_IDS : INITIAL_ART_IDS)) {
    return null;
  }
  if (!isHoldDepart && (state.submittedEvidenceIds.length > 0 || state.chapterComplete)) {
    return null;
  }
  if (isHoldDepart) {
    const validSubmittedEvidence = REQUIRED_EVIDENCE_IDS.every((id) => state.submittedEvidenceIds.includes(id)) &&
      state.submittedEvidenceIds.every((id) => REQUIRED_EVIDENCE_IDS.includes(id) || OPTIONAL_EVIDENCE_IDS.includes(id)) &&
      state.submittedEvidenceIds.every((id) => evidenceIsAvailable(state, id));
    if (!validSubmittedEvidence) {
      return null;
    }
  }
  return state;
}
