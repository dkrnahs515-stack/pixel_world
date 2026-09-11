import test from "node:test";
import assert from "node:assert/strict";
import {
  ANCHOR_IDS,
  BOND_IDS,
  CHORUS_AUTHORITY_LEASE_MS,
  CHORUS_AUTHORITY_RENEW_MS,
  CHORUS_TESTIMONIES,
} from "../src/sanctuary-chorus-data-20260911-sanctuary.js";
import {
  acquireChorusAuthority,
  applyChorusAction,
  createChorusCompletionClaims,
  createChorusEncounter,
  createPersonalChorusState,
  normalizeChorusEncounter,
  reducePersonalChorusState,
  renewChorusAuthority,
  validateChorusAction,
} from "../src/sanctuary-chorus-state-20260911-sanctuary.js";

function context(encounter, authenticatedUid, now, overrides = {}) {
  return { encounter, authenticatedUid, now, ...overrides };
}

function action(encounter, uid, type, createdAt, fields = {}) {
  return {
    id: `${type}:${uid}:${createdAt}:${Object.values(fields).join(":")}`,
    encounterId: encounter.encounterId,
    authorityEpoch: encounter.authorityEpoch,
    phase: encounter.phase,
    uid,
    type,
    createdAt,
    ...fields,
  };
}

function applyValid(encounter, request, now = request.createdAt, extraContext = {}) {
  const validated = validateChorusAction(
    request,
    context(encounter, request.uid, now, extraContext),
  );
  assert.equal(validated.ok, true, validated.reason);
  return applyChorusAction(encounter, validated, now).encounter;
}

function anchorsEncounter() {
  return createChorusEncounter({ encounterId: "chorus-1", authorityUid: "host", now: 1000 });
}

function onslaughtEncounter() {
  let encounter = anchorsEncounter();
  for (const anchorId of ANCHOR_IDS) {
    encounter = applyValid(encounter, action(encounter, "anchor-player", "anchor-stabilize", 1200, {
      fragmentId: anchorId,
      anchorId,
    }));
  }
  for (const testimony of CHORUS_TESTIMONIES) {
    encounter = applyValid(encounter, action(encounter, "testimony-player", "testimony-resolve", 1300, {
      testimonyId: testimony.id,
      verdict: testimony.verdict,
    }));
  }
  return encounter;
}

test("cohesion changes only through phase objectives", () => {
  let encounter = anchorsEncounter();
  const strike = action(encounter, "striker", "fragment-strike", 1100, {
    fragmentId: "forest",
    damage: 999,
  });
  encounter = applyValid(encounter, strike, 1100);
  assert.equal(encounter.hp, 100);

  for (const anchorId of ANCHOR_IDS) {
    encounter = applyValid(encounter, action(encounter, "anchor-player", "anchor-stabilize", 1200, {
      fragmentId: anchorId,
      anchorId,
    }));
  }
  assert.deepEqual([encounter.phase, encounter.hp], ["testimonies", 70]);

  for (const testimony of CHORUS_TESTIMONIES) {
    encounter = applyValid(encounter, action(encounter, "testimony-player", "testimony-resolve", 1300, {
      testimonyId: testimony.id,
      verdict: testimony.verdict,
    }));
  }
  assert.deepEqual([encounter.phase, encounter.hp], ["onslaught", 40]);

  let finalEvents = [];
  for (const [index, bondId] of BOND_IDS.entries()) {
    const recordAt = 1400 + index * 200;
    encounter = applyValid(encounter, action(encounter, "recorder", "record-activate", recordAt, {
      recordId: bondId,
    }));
    const cut = action(encounter, "cutter", "bond-cut", recordAt + 100, { bondId });
    const validated = validateChorusAction(cut, context(encounter, "cutter", cut.createdAt));
    assert.equal(validated.ok, true, validated.reason);
    const result = applyChorusAction(encounter, validated, cut.createdAt);
    encounter = result.encounter;
    finalEvents = result.events;
  }
  assert.deepEqual([encounter.phase, encounter.status, encounter.hp], ["separated", "separated", 0]);
  assert.ok(finalEvents.every(event => !["death", "defeat", "explosion", "corpse"].includes(event.type)));
});

test("wrong personal actions cannot mutate shared encounter", () => {
  const shared = anchorsEncounter();
  const wrong = action(shared, "a", "anchor-stabilize", 2000, {
    fragmentId: "forest",
    anchorId: "coast",
  });
  const result = applyChorusAction(
    shared,
    validateChorusAction(wrong, context(shared, "a", 2000)),
    2000,
  );
  assert.deepEqual(result.encounter, shared);
  assert.deepEqual(result.events, []);
  assert.equal(result.personalEvent.type, "contamination");
  assert.equal(result.personalEvent.id, `${wrong.id}:contamination`);
});

test("contamination overload returns the fragment and recovers to 50", () => {
  const result = reducePersonalChorusState({
    ...createPersonalChorusState(),
    contamination: 90,
    carriedFragmentId: "forest",
  }, { id: "mistake-1", type: "contamination", amount: 10 }, 5000);
  assert.equal(result.state.contamination, 50);
  assert.equal(result.state.carriedFragmentId, null);
  assert.equal(result.state.confusedUntil, 8000);
  assert.equal(result.state.attackLockedUntil, 8000);
  assert.equal(result.state.movementSlowUntil, 8000);
  assert.deepEqual(result.events, [{ type: "fragment-return", fragmentId: "forest" }]);
});

test("personal contamination is clamped, deduped by event id, and runtime-only", () => {
  const first = reducePersonalChorusState({
    contamination: -20,
    carriedFragmentId: "unknown",
    processedContaminationEventIds: ["old", "old", 7],
    confusedUntil: -1,
    attackLockedUntil: Number.POSITIVE_INFINITY,
    movementSlowUntil: "later",
    persistencePath: "forbidden",
  }, { id: "mistake-2", type: "contamination", amount: 15 }, 1000);
  assert.deepEqual(first.state, {
    contamination: 15,
    carriedFragmentId: null,
    processedContaminationEventIds: ["old", "mistake-2"],
    confusedUntil: 0,
    attackLockedUntil: 0,
    movementSlowUntil: 0,
  });
  const duplicate = reducePersonalChorusState(first.state, {
    id: "mistake-2", type: "contamination", amount: 80,
  }, 2000);
  assert.deepEqual(duplicate.state, first.state);
  assert.deepEqual(duplicate.events, []);
});

test("validation rejects hostile ids, phases, epochs, encounters, timestamps, and duplicate objectives", () => {
  let encounter = anchorsEncounter();
  const valid = action(encounter, "a", "anchor-stabilize", 2000, {
    fragmentId: "forest",
    anchorId: "forest",
  });
  const checks = [
    action(encounter, "a", "damage", 2000, { damage: 100 }),
    { ...valid, encounterId: "other" },
    { ...valid, authorityEpoch: encounter.authorityEpoch - 1 },
    { ...valid, phase: "onslaught" },
    { ...valid, uid: "intruder" },
    { ...valid, anchorId: "void" },
    { ...valid, createdAt: -4001 },
    { ...valid, createdAt: 7001 },
  ];
  for (const request of checks) {
    const validated = validateChorusAction(request, context(encounter, "a", 2000));
    assert.equal(validated.ok, false);
    assert.equal(applyChorusAction(encounter, validated, 2000).encounter.hp, 100);
  }
  encounter = applyValid(encounter, valid, 2000);
  assert.equal(validateChorusAction(
    action(encounter, "a", "anchor-stabilize", 2100, { fragmentId: "forest", anchorId: "forest" }),
    context(encounter, "a", 2100),
  ).reason, "duplicate_objective");
});

test("record activation replay cannot extend its window, emit again, or update its contributor", () => {
  const encounter = onslaughtEncounter();
  const request = action(encounter, "recorder", "record-activate", 2000, { recordId: "roan" });
  const firstValidation = validateChorusAction(request, context(encounter, "recorder", 2000));
  assert.equal(firstValidation.ok, true);
  const first = applyChorusAction(encounter, firstValidation, 2000);
  assert.equal(first.encounter.vulnerableUntil, 5000);
  assert.equal(first.encounter.contributors.recorder.lastContributedAt, 2000);
  assert.equal(first.events.length, 1);

  const replayValidation = validateChorusAction(request, context(first.encounter, "recorder", 2100));
  assert.deepEqual(replayValidation, {
    ok: false,
    reason: "duplicate_action",
    personalEvent: null,
  });
  const replay = applyChorusAction(first.encounter, replayValidation, 2100);
  assert.deepEqual(replay.encounter, first.encounter);
  assert.deepEqual(replay.events, []);
  assert.equal(replay.encounter.vulnerableUntil, 5000);
  assert.equal(replay.encounter.contributors.recorder.lastContributedAt, 2000);
});

test("fragment strike replay cannot update contribution timestamps", () => {
  const encounter = anchorsEncounter();
  const request = action(encounter, "striker", "fragment-strike", 1100, { fragmentId: "forest" });
  const first = applyChorusAction(
    encounter,
    validateChorusAction(request, context(encounter, "striker", 1100)),
    1100,
  );
  assert.equal(first.encounter.contributors.striker.lastContributedAt, 1100);
  assert.deepEqual(first.events, []);

  const replayValidation = validateChorusAction(request, context(first.encounter, "striker", 1200));
  assert.equal(replayValidation.reason, "duplicate_action");
  const replay = applyChorusAction(first.encounter, replayValidation, 1200);
  assert.deepEqual(replay.encounter, first.encounter);
  assert.deepEqual(replay.events, []);
  assert.equal(replay.encounter.contributors.striker.lastContributedAt, 1100);
});

test("shared actions require bounded IDs before personal or shared validation", () => {
  const encounter = anchorsEncounter();
  const base = action(encounter, "a", "anchor-stabilize", 2000, {
    fragmentId: "forest",
    anchorId: "coast",
  });
  for (const invalidId of [undefined, "", "x".repeat(161), 7]) {
    const request = { ...base, id: invalidId };
    assert.deepEqual(validateChorusAction(request, context(encounter, "a", 2000)), {
      ok: false,
      reason: "invalid_action_id",
      personalEvent: null,
    });
  }
});

test("processed action normalization keeps the newest 256 unique bounded IDs", () => {
  const encounter = anchorsEncounter();
  const chronologicalIds = Array.from({ length: 300 }, (_, index) => `action-${index}`);
  const normalized = normalizeChorusEncounter({
    ...encounter,
    processedActionIds: [
      "repeat",
      "",
      9,
      "x".repeat(161),
      ...chronologicalIds,
      "repeat",
    ],
  });
  assert.equal(normalized.processedActionIds.length, 256);
  assert.equal(normalized.processedActionIds[0], "action-45");
  assert.equal(normalized.processedActionIds.at(-1), "repeat");
  assert.equal(normalized.processedActionIds.filter(id => id === "repeat").length, 1);

  const fresh = action(normalized, "striker", "fragment-strike", 2000, { fragmentId: "forest" });
  const applied = applyChorusAction(
    normalized,
    validateChorusAction(fresh, context(normalized, "striker", 2000)),
    2000,
  ).encounter;
  assert.equal(applied.processedActionIds.length, 256);
  assert.equal(applied.processedActionIds[0], "action-46");
  assert.equal(applied.processedActionIds.at(-1), fresh.id);
});

test("wrong testimony is personal while expired or mismatched bond windows are shared no-ops", () => {
  let encounter = anchorsEncounter();
  for (const anchorId of ANCHOR_IDS) {
    encounter = applyValid(encounter, action(encounter, "a", "anchor-stabilize", 1200, {
      fragmentId: anchorId,
      anchorId,
    }));
  }
  const testimony = CHORUS_TESTIMONIES[0];
  const wrongAnswer = action(encounter, "a", "testimony-resolve", 1300, {
    testimonyId: testimony.id,
    verdict: testimony.verdict === "fact" ? "unsupported" : "fact",
  });
  const wrongResult = applyChorusAction(
    encounter,
    validateChorusAction(wrongAnswer, context(encounter, "a", 1300)),
    1300,
  );
  assert.deepEqual(wrongResult.encounter, encounter);
  assert.equal(wrongResult.personalEvent.type, "contamination");

  encounter = onslaughtEncounter();
  encounter = applyValid(encounter, action(encounter, "recorder", "record-activate", 2000, {
    recordId: "roan",
  }));
  const mismatch = action(encounter, "cutter", "bond-cut", 2100, { bondId: "sera" });
  assert.equal(validateChorusAction(mismatch, context(encounter, "cutter", 2100)).reason, "bond_not_vulnerable");
  const expired = action(encounter, "cutter", "bond-cut", encounter.vulnerableUntil + 1, { bondId: "roan" });
  assert.equal(validateChorusAction(expired, context(encounter, "cutter", expired.createdAt)).reason, "bond_not_vulnerable");
  const replayedAfterWindow = action(encounter, "cutter", "bond-cut", encounter.vulnerableUntil - 100, {
    bondId: "roan",
  });
  assert.equal(validateChorusAction(
    replayedAfterWindow,
    context(encounter, "cutter", encounter.vulnerableUntil + 1),
  ).reason, "bond_not_vulnerable");
});

test("normalization removes hostile fields and derives safe objective boundaries", () => {
  const source = anchorsEncounter();
  const normalized = normalizeChorusEncounter({
    ...source,
    hp: -900,
    phase: "separated",
    status: "defeated",
    stabilizedAnchorIds: { volcano: true, forest: true, void: true, coast: false },
    resolvedTestimonyIds: [CHORUS_TESTIMONIES[0].id, "unknown", CHORUS_TESTIMONIES[0].id],
    severedBondIds: ["roan", "unknown"],
    activeRecordId: "unknown",
    currentPatternId: 44,
    contributors: {
      good: { firstContributedAt: 900, lastContributedAt: 1000, actionTypes: ["fragment-strike", "damage"] },
      "": { firstContributedAt: 1 },
    },
    networkPath: "forbidden",
  });
  assert.equal(normalized.phase, "anchors");
  assert.equal(normalized.status, "active");
  assert.equal(normalized.hp, 80);
  assert.deepEqual(normalized.stabilizedAnchorIds, ["forest", "volcano"]);
  assert.deepEqual(normalized.resolvedTestimonyIds, []);
  assert.deepEqual(normalized.severedBondIds, []);
  assert.equal(normalized.activeRecordId, null);
  assert.equal(normalized.currentPatternId, null);
  assert.deepEqual(Object.keys(normalized.contributors), ["good"]);
  assert.deepEqual(normalized.contributors.good.actionTypes, ["fragment-strike"]);
  assert.equal("networkPath" in normalized, false);
});

test("authority can be renewed by its epoch and taken over only after the five-second lease", () => {
  const encounter = createChorusEncounter({
    encounterId: "chorus-authority",
    authorityUid: "host",
    authorityEpoch: 4,
    now: 1000,
  });
  assert.equal(CHORUS_AUTHORITY_LEASE_MS, 5000);
  assert.equal(CHORUS_AUTHORITY_RENEW_MS, 2000);
  assert.equal(encounter.leaseUntil, 6000);
  assert.equal(acquireChorusAuthority(encounter, { uid: "next", now: 5999 }).reason, "lease_active");
  const acquired = acquireChorusAuthority(encounter, { uid: "next", now: 6000 });
  assert.equal(acquired.ok, true);
  assert.equal(acquired.encounter.authorityEpoch, 5);
  assert.equal(acquired.encounter.leaseUntil, 11000);
  const withLedger = normalizeChorusEncounter({
    ...acquired.encounter,
    processedActionIds: ["host:4:1", "host:4:2"],
  });
  const retained = acquireChorusAuthority(withLedger, { uid: "third", now: 11000 });
  assert.deepEqual(retained.encounter.processedActionIds, ["host:4:1", "host:4:2"]);
  assert.equal(renewChorusAuthority(acquired.encounter, {
    uid: "next", authorityEpoch: 4, now: 7000,
  }).reason, "authority_mismatch");
  const renewed = renewChorusAuthority(acquired.encounter, {
    uid: "next", authorityEpoch: 5, now: 7000,
  });
  assert.equal(renewed.encounter.leaseUntil, 12000);
  assert.equal(renewChorusAuthority(acquired.encounter, {
    uid: "next", authorityEpoch: 5, now: 11000,
  }).reason, "lease_expired");
  const sameOwnerTakeover = acquireChorusAuthority(acquired.encounter, { uid: "next", now: 11000 });
  assert.equal(sameOwnerTakeover.encounter.authorityEpoch, 6);
});

test("completion claims are created only for contributors of a separated encounter", () => {
  let encounter = onslaughtEncounter();
  for (const [index, bondId] of BOND_IDS.entries()) {
    const at = 2000 + index * 200;
    encounter = applyValid(encounter, action(encounter, "recorder", "record-activate", at, { recordId: bondId }));
    encounter = applyValid(encounter, action(encounter, "cutter", "bond-cut", at + 100, { bondId }));
  }
  const claims = createChorusCompletionClaims(encounter, 9000);
  assert.deepEqual(Object.keys(claims), ["anchor-player", "cutter", "recorder", "testimony-player"]);
  assert.deepEqual(claims.cutter, {
    encounterId: "chorus-1",
    uid: "cutter",
    eligible: true,
    createdAt: 9000,
  });
  assert.deepEqual(createChorusCompletionClaims({ ...encounter, status: "active" }, 9000), claims);
  assert.deepEqual(createChorusCompletionClaims(anchorsEncounter(), 9000), {});
});

test("optional Lumen assist is eligible once and counts as an anchor contribution", () => {
  let encounter = anchorsEncounter();
  const request = action(encounter, "a", "lumen-assist", 1500, { anchorId: "forest" });
  assert.equal(validateChorusAction(request, context(encounter, "a", 1500)).ok, false);
  encounter = applyValid(encounter, request, 1500, { lumenAssistEligible: true });
  assert.equal(encounter.hp, 90);
  assert.equal(encounter.lumenAssistUsed, true);
  assert.deepEqual(encounter.stabilizedAnchorIds, ["forest"]);
  assert.deepEqual(encounter.contributors.a.actionTypes, ["lumen-assist"]);
  assert.equal(validateChorusAction(
    action(encounter, "a", "lumen-assist", 1600, { anchorId: "coast" }),
    context(encounter, "a", 1600, { lumenAssistEligible: true }),
  ).reason, "duplicate_objective");
});

test("combat revision advances only for shared combat mutations and survives lease takeover", () => {
  let encounter = createChorusEncounter({
    encounterId: "chorus-revision",
    authorityUid: "host",
    now: 1000,
  });
  assert.equal(encounter.combatRevision, 0);
  const request = action(encounter, "host", "fragment-strike", 1100, { fragmentId: "forest" });
  encounter = applyValid(encounter, request, 1100);
  assert.equal(encounter.combatRevision, 1);

  const renewed = renewChorusAuthority(encounter, {
    uid: "host",
    authorityEpoch: encounter.authorityEpoch,
    now: 5999,
  });
  assert.equal(renewed.encounter.combatRevision, 1);
  const acquired = acquireChorusAuthority(renewed.encounter, { uid: "next", now: 11000 });
  assert.equal(acquired.encounter.combatRevision, 1);
  assert.equal(normalizeChorusEncounter({ ...encounter, combatRevision: -9 }).combatRevision, 0);
});

test("lease renewal preserves combat time so an already issued vulnerable bond cut remains valid", () => {
  let encounter = onslaughtEncounter();
  const recordAt = encounter.updatedAt + 100;
  encounter = applyValid(encounter, action(encounter, "recorder", "record-activate", recordAt, {
    recordId: "roan",
  }));
  const combatUpdatedAt = encounter.updatedAt;
  const cut = action(encounter, "cutter", "bond-cut", recordAt + 100, { bondId: "roan" });

  const renewed = renewChorusAuthority(encounter, {
    uid: "host",
    authorityEpoch: encounter.authorityEpoch,
    now: recordAt + 150,
  });

  assert.equal(renewed.ok, true);
  assert.equal(renewed.encounter.updatedAt, combatUpdatedAt);
  assert.equal(validateChorusAction(cut, context(renewed.encounter, "cutter", recordAt + 150)).ok, true);
});
