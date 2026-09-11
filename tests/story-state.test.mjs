import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceStory,
  canAdvance,
  completeComparison,
  createInitialStoryState,
  discoverClue,
  normalizeStoryState,
  submitEvidence,
} from "../src/story-state.js";

const requiredCluesByScene = {
  "disposal-rule": ["rule-five-years", "rule-no-life-signal", "rule-no-recovery"],
  "roster-items": ["roster-four-names", "recovered-radio", "empty-map-case"],
  radio: ["replay-lengths", "new-received-at", "signal-warning", "metal-pattern"],
  "compass-compare": ["main-compass-missing"],
  "case-submit": ["article-18-4"],
};

function moveTo(state, sceneId) {
  let current = state;
  while (current.sceneId !== sceneId) {
    for (const clueId of requiredCluesByScene[current.sceneId] ?? []) {
      current = discoverClue(current, clueId);
    }
    if (current.sceneId === "compass-compare") {
      current = completeComparison(current, "metal-to-compass");
    }
    if (current.sceneId === "time-compare") {
      current = completeComparison(current, "same-final-time");
    }
    const result = advanceStory(current);
    assert.equal(result.ok, true, `expected to advance from ${current.sceneId}`);
    current = result.state;
  }
  return current;
}

function readyCaseState() {
  return discoverClue(moveTo(createInitialStoryState(), "case-submit"), "article-18-4");
}

test("initial state starts at duty with only Theo artwork", () => {
  assert.deepEqual(createInitialStoryState(), {
    schemaVersion: 1,
    sceneId: "duty",
    discoveredClueIds: [],
    completedComparisonIds: [],
    submittedEvidenceIds: [],
    revealedArtIds: ["theo"],
    chapterComplete: false,
  });
});

test("the three disposal-rule clues gate advancement", () => {
  let state = moveTo(createInitialStoryState(), "disposal-rule");
  state = discoverClue(state, "rule-five-years");
  assert.deepEqual(canAdvance(state), {
    ok: false,
    missingIds: ["rule-no-life-signal", "rule-no-recovery"],
  });
  state = discoverClue(state, "rule-no-life-signal");
  state = discoverClue(state, "rule-no-recovery");
  assert.deepEqual(canAdvance(state), { ok: true, missingIds: [] });
});

test("discovering an unknown clue returns canonical state without adding it", () => {
  const state = moveTo(createInitialStoryState(), "disposal-rule");
  const result = discoverClue(state, "invented-clue");
  assert.deepEqual(result.discoveredClueIds, []);
  assert.notEqual(result, state);
});

test("discovering a future clue does not bypass scene order", () => {
  const state = moveTo(createInitialStoryState(), "disposal-rule");
  const result = discoverClue(state, "new-received-at");
  assert.deepEqual(result.discoveredClueIds, []);
});

test("discovering a clue twice is idempotent", () => {
  const state = moveTo(createInitialStoryState(), "disposal-rule");
  const once = discoverClue(state, "rule-five-years");
  const twice = discoverClue(once, "rule-five-years");
  assert.deepEqual(twice.discoveredClueIds, ["rule-five-years"]);
});

test("comparisons require their discovered clues", () => {
  const state = moveTo(createInitialStoryState(), "compass-compare");
  assert.deepEqual(completeComparison(state, "metal-to-compass").completedComparisonIds, []);
});

test("a comparison only completes in its own scene", () => {
  const state = moveTo(createInitialStoryState(), "radio");
  const result = completeComparison(state, "metal-to-compass");
  assert.deepEqual(result.completedComparisonIds, []);
});

test("unknown comparisons are ignored", () => {
  const state = moveTo(createInitialStoryState(), "compass-compare");
  const result = completeComparison(state, "invented-comparison");
  assert.deepEqual(result.completedComparisonIds, []);
});

test("a completed comparison is idempotent", () => {
  let state = moveTo(createInitialStoryState(), "compass-compare");
  state = discoverClue(state, "main-compass-missing");
  const once = completeComparison(state, "metal-to-compass");
  const twice = completeComparison(once, "metal-to-compass");
  assert.deepEqual(twice.completedComparisonIds, ["metal-to-compass"]);
});

test("advance reports the current scene hint and missing IDs", () => {
  const state = moveTo(createInitialStoryState(), "disposal-rule");
  const result = advanceStory(state);
  assert.equal(result.ok, false);
  assert.deepEqual(canAdvance(result.state).missingIds, [
    "rule-five-years",
    "rule-no-life-signal",
    "rule-no-recovery",
  ]);
  assert.match(result.feedback, /규정 카드/);
});

test("advancement moves exactly one declared scene at a time", () => {
  const result = advanceStory(createInitialStoryState());
  assert.equal(result.ok, true);
  assert.equal(result.state.sceneId, "disposal-rule");
});

test("transitions do not mutate their input objects or arrays", () => {
  const state = moveTo(createInitialStoryState(), "disposal-rule");
  const before = structuredClone(state);
  const result = discoverClue(state, "rule-five-years");
  assert.deepEqual(state, before);
  assert.notEqual(result.discoveredClueIds, state.discoveredClueIds);
});

test("all-alive is rejected without losing collected clues", () => {
  const state = readyCaseState();
  const result = submitEvidence(state, {
    claimId: "all-alive",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
  });
  assert.equal(result.accepted, false);
  assert.deepEqual(result.state.discoveredClueIds, state.discoveredClueIds);
  assert.match(result.feedback, /확정하지 않습니다/);
});

test("the exact three core evidence items accept the investigation claim", () => {
  const result = submitEvidence(readyCaseState(), {
    claimId: "investigate-survival",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
  });
  assert.equal(result.accepted, true);
  assert.equal(result.state.sceneId, "hold-depart");
  assert.deepEqual(result.state.submittedEvidenceIds, [
    "new-received-at",
    "metal-to-compass",
    "article-18-4",
  ]);
  assert.deepEqual(result.state.revealedArtIds, ["theo", "returnedSignal"]);
  assert.equal(result.state.chapterComplete, false);
});

test("same-final-time is accepted as optional supporting evidence", () => {
  const result = submitEvidence(readyCaseState(), {
    claimId: "investigate-survival",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4", "same-final-time"],
  });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.submittedEvidenceIds, [
    "new-received-at",
    "metal-to-compass",
    "article-18-4",
    "same-final-time",
  ]);
});

test("duplicated evidence cannot fake a complete submission", () => {
  const result = submitEvidence(readyCaseState(), {
    claimId: "investigate-survival",
    evidenceIds: ["new-received-at", "new-received-at", "article-18-4"],
  });
  assert.equal(result.accepted, false);
  assert.equal(result.state.sceneId, "case-submit");
});

test("named evidence is rejected when its source was not actually collected", () => {
  const state = {
    ...readyCaseState(),
    discoveredClueIds: ["new-received-at", "article-18-4"],
    completedComparisonIds: [],
  };
  const result = submitEvidence(state, {
    claimId: "investigate-survival",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
  });
  assert.equal(result.accepted, false);
  assert.equal(result.state.sceneId, "case-submit");
});

test("forged case-submit evidence is rejected without bypassing required investigation history", () => {
  const state = {
    schemaVersion: 1,
    sceneId: "case-submit",
    discoveredClueIds: ["new-received-at", "article-18-4"],
    completedComparisonIds: ["metal-to-compass"],
    submittedEvidenceIds: [],
    revealedArtIds: ["theo"],
    chapterComplete: false,
  };
  const before = structuredClone(state);
  const result = submitEvidence(state, {
    claimId: "investigate-survival",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
  });
  assert.equal(result.accepted, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
  assert.match(result.feedback, /근거/);
});

test("forged case-submit evidence is rejected when same-final-time is absent", () => {
  const state = {
    schemaVersion: 1,
    sceneId: "case-submit",
    discoveredClueIds: [
      "rule-five-years",
      "rule-no-life-signal",
      "rule-no-recovery",
      "roster-four-names",
      "recovered-radio",
      "empty-map-case",
      "replay-lengths",
      "new-received-at",
      "signal-warning",
      "metal-pattern",
      "main-compass-missing",
      "article-18-4",
    ],
    completedComparisonIds: ["metal-to-compass"],
    submittedEvidenceIds: [],
    revealedArtIds: ["theo"],
    chapterComplete: false,
  };
  const before = structuredClone(state);
  assert.deepEqual(canAdvance(state), { ok: false, missingIds: ["same-final-time"] });

  const result = submitEvidence(state, {
    claimId: "investigate-survival",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
  });

  assert.equal(result.accepted, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
  assert.match(result.feedback, /근거/);
});

test("case-submit cannot advance directly to late artwork without evidence submission", () => {
  const result = advanceStory(readyCaseState());
  assert.equal(result.ok, false);
  assert.equal(result.state.sceneId, "case-submit");
});

test("hold-depart completes chapter one in place and is idempotent", () => {
  const accepted = submitEvidence(readyCaseState(), {
    claimId: "investigate-survival",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
  }).state;
  const complete = advanceStory(accepted);
  const repeat = advanceStory(complete.state);
  assert.equal(complete.ok, true);
  assert.equal(complete.state.sceneId, "hold-depart");
  assert.equal(complete.state.chapterComplete, true);
  assert.deepEqual(repeat, { ok: true, state: complete.state, feedback: complete.feedback });
});

test("normalization accepts every valid checkpoint and returns fresh canonical arrays", () => {
  const checkpoints = [
    createInitialStoryState(),
    moveTo(createInitialStoryState(), "disposal-rule"),
    moveTo(createInitialStoryState(), "roster-items"),
    moveTo(createInitialStoryState(), "radio"),
    moveTo(createInitialStoryState(), "compass-compare"),
    moveTo(createInitialStoryState(), "time-compare"),
    readyCaseState(),
    submitEvidence(readyCaseState(), {
      claimId: "investigate-survival",
      evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
    }).state,
  ];
  checkpoints.push(advanceStory(checkpoints.at(-1)).state);

  for (const checkpoint of checkpoints) {
    const normalized = normalizeStoryState(checkpoint);
    assert.notEqual(normalized, checkpoint);
    assert.notEqual(normalized.discoveredClueIds, checkpoint.discoveredClueIds);
    assert.deepEqual(normalized, checkpoint);
  }
});

test("normalization accepts literal partially investigated current-scene checkpoints", () => {
  const priorRules = ["rule-five-years", "rule-no-life-signal", "rule-no-recovery"];
  const priorRoster = ["roster-four-names", "recovered-radio", "empty-map-case"];
  const priorRadio = ["replay-lengths", "new-received-at", "signal-warning", "metal-pattern"];
  const partialCheckpoints = [
    {
      schemaVersion: 1,
      sceneId: "disposal-rule",
      discoveredClueIds: ["rule-five-years"],
      completedComparisonIds: [],
      submittedEvidenceIds: [],
      revealedArtIds: ["theo"],
      chapterComplete: false,
    },
    {
      schemaVersion: 1,
      sceneId: "roster-items",
      discoveredClueIds: [...priorRules, "roster-four-names"],
      completedComparisonIds: [],
      submittedEvidenceIds: [],
      revealedArtIds: ["theo"],
      chapterComplete: false,
    },
    {
      schemaVersion: 1,
      sceneId: "radio",
      discoveredClueIds: [...priorRules, ...priorRoster, "replay-lengths", "new-received-at"],
      completedComparisonIds: [],
      submittedEvidenceIds: [],
      revealedArtIds: ["theo"],
      chapterComplete: false,
    },
    {
      schemaVersion: 1,
      sceneId: "compass-compare",
      discoveredClueIds: [...priorRules, ...priorRoster, ...priorRadio, "main-compass-missing"],
      completedComparisonIds: [],
      submittedEvidenceIds: [],
      revealedArtIds: ["theo"],
      chapterComplete: false,
    },
    {
      schemaVersion: 1,
      sceneId: "time-compare",
      discoveredClueIds: [...priorRules, ...priorRoster, ...priorRadio, "main-compass-missing"],
      completedComparisonIds: ["metal-to-compass"],
      submittedEvidenceIds: [],
      revealedArtIds: ["theo"],
      chapterComplete: false,
    },
    {
      schemaVersion: 1,
      sceneId: "case-submit",
      discoveredClueIds: [...priorRules, ...priorRoster, ...priorRadio, "main-compass-missing"],
      completedComparisonIds: ["metal-to-compass", "same-final-time"],
      submittedEvidenceIds: [],
      revealedArtIds: ["theo"],
      chapterComplete: false,
    },
  ];

  for (const checkpoint of partialCheckpoints) {
    const normalized = normalizeStoryState(checkpoint);
    assert.notEqual(normalized, checkpoint);
    assert.deepEqual(normalized, checkpoint);
  }
});

test("normalization rejects malformed, unknown, duplicate, and impossible state", () => {
  const valid = readyCaseState();
  const cases = [
    null,
    [],
    "state",
    { ...valid, schemaVersion: 2 },
    { ...valid, sceneId: "chapter-two" },
    { ...valid, discoveredClueIds: "new-received-at" },
    { ...valid, discoveredClueIds: [...valid.discoveredClueIds, "unknown"] },
    { ...valid, discoveredClueIds: [...valid.discoveredClueIds, "new-received-at"] },
    { ...valid, completedComparisonIds: ["metal-to-compass", "metal-to-compass"] },
    { ...valid, revealedArtIds: ["returnedSignal", "theo"] },
    { ...valid, revealedArtIds: ["theo", "returnedSignal"] },
    { ...valid, chapterComplete: true },
    { ...valid, sceneId: "time-compare", completedComparisonIds: [] },
    { ...valid, sceneId: "compass-compare", discoveredClueIds: valid.discoveredClueIds.filter((id) => id !== "metal-pattern") },
    { ...valid, completedComparisonIds: ["same-final-time"] },
    { ...valid, submittedEvidenceIds: ["new-received-at"] },
  ];
  for (const value of cases) {
    assert.equal(normalizeStoryState(value), null);
  }
});

test("normalization rejects returned signal and submission outside hold-depart", () => {
  const state = createInitialStoryState();
  assert.equal(normalizeStoryState({ ...state, revealedArtIds: ["theo", "returnedSignal"] }), null);
  assert.equal(normalizeStoryState({ ...state, submittedEvidenceIds: ["new-received-at"] }), null);
});

test("normalization rejects a hold-depart checkpoint with reversed artwork order", () => {
  const holdDepart = submitEvidence(readyCaseState(), {
    claimId: "investigate-survival",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
  }).state;
  assert.equal(
    normalizeStoryState({ ...holdDepart, revealedArtIds: ["returnedSignal", "theo"] }),
    null,
  );
});
