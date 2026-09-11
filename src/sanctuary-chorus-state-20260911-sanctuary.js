import {
  ANCHOR_IDS,
  BOND_IDS,
  CHORUS_ACTION_ID_MAX_LENGTH,
  CHORUS_ACTION_TIME_TOLERANCE_MS,
  CHORUS_AUTHORITY_LEASE_MS,
  CHORUS_BOSS_ID,
  CHORUS_CONFUSION_MS,
  CHORUS_CONTAMINATION_PER_MISTAKE,
  CHORUS_CONTRIBUTION_TYPES,
  CHORUS_MAP_ID,
  CHORUS_MAX_HP,
  CHORUS_PATTERN_IDS,
  CHORUS_PROCESSED_ACTION_LIMIT,
  CHORUS_VULNERABLE_MS,
  RECORD_IDS,
  TESTIMONY_IDS,
  TESTIMONY_VERDICT_BY_ID,
  TESTIMONY_VERDICTS,
} from "./sanctuary-chorus-data-20260911-sanctuary.js";

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegativeTime(value, fallback = 0) {
  return Math.max(0, finite(value, fallback));
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.trunc(finite(value, fallback)));
}

function validId(value, maxLength = 160) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function validActionId(value) {
  return validId(value, CHORUS_ACTION_ID_MAX_LENGTH)
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function normalizeProcessedActionIds(value) {
  if (!Array.isArray(value)) return [];
  const newest = [];
  const seen = new Set();
  for (let index = value.length - 1; index >= 0 && newest.length < CHORUS_PROCESSED_ACTION_LIMIT; index -= 1) {
    const id = value[index];
    if (!validActionId(id) || seen.has(id)) continue;
    seen.add(id);
    newest.unshift(id);
  }
  return newest;
}

function allowedIds(value, allowed) {
  const candidates = Array.isArray(value)
    ? value
    : objectValue(value)
      ? Object.entries(value).filter(([, included]) => included === true).map(([id]) => id)
      : [];
  const found = new Set(candidates.filter(id => allowed.includes(id)));
  return allowed.filter(id => found.has(id));
}

function normalizeContributor(value) {
  const source = objectValue(value) || {};
  const actionTypes = allowedIds(source.actionTypes, CHORUS_CONTRIBUTION_TYPES);
  if (actionTypes.length === 0) return null;
  const firstContributedAt = nonNegativeTime(source.firstContributedAt);
  return {
    firstContributedAt,
    lastContributedAt: Math.max(firstContributedAt, nonNegativeTime(source.lastContributedAt, firstContributedAt)),
    actionTypes,
  };
}

function normalizeContributors(value) {
  const source = objectValue(value) || {};
  const contributors = {};
  for (const uid of Object.keys(source).sort()) {
    if (!validId(uid, 128)) continue;
    const contributor = normalizeContributor(source[uid]);
    if (contributor) contributors[uid] = contributor;
  }
  return contributors;
}

function objectiveState(value) {
  const stabilizedAnchorIds = allowedIds(value.stabilizedAnchorIds, ANCHOR_IDS);
  const resolvedTestimonyIds = stabilizedAnchorIds.length === ANCHOR_IDS.length
    ? allowedIds(value.resolvedTestimonyIds, TESTIMONY_IDS)
    : [];
  const severedBondIds = resolvedTestimonyIds.length === TESTIMONY_IDS.length
    ? allowedIds(value.severedBondIds, BOND_IDS)
    : [];
  if (severedBondIds.length === BOND_IDS.length) {
    return {
      stabilizedAnchorIds,
      resolvedTestimonyIds,
      severedBondIds,
      phase: "separated",
      status: value.status === "reforming" ? "reforming" : "separated",
      hp: 0,
    };
  }
  if (resolvedTestimonyIds.length === TESTIMONY_IDS.length) {
    return {
      stabilizedAnchorIds,
      resolvedTestimonyIds,
      severedBondIds,
      phase: "onslaught",
      status: "active",
      hp: 40 - severedBondIds.length * 10,
    };
  }
  if (stabilizedAnchorIds.length === ANCHOR_IDS.length) {
    return {
      stabilizedAnchorIds,
      resolvedTestimonyIds,
      severedBondIds,
      phase: "testimonies",
      status: "active",
      hp: 70 - resolvedTestimonyIds.length * 5,
    };
  }
  return {
    stabilizedAnchorIds,
    resolvedTestimonyIds,
    severedBondIds,
    phase: "anchors",
    status: "active",
    hp: 100 - stabilizedAnchorIds.length * 10,
  };
}

export function createChorusEncounter({
  encounterId,
  authorityUid,
  authorityEpoch = 1,
  now = Date.now(),
} = {}) {
  if (!validId(encounterId) || !validId(authorityUid, 128) || !Number.isFinite(now)) return null;
  return {
    encounterId,
    bossId: CHORUS_BOSS_ID,
    mapId: CHORUS_MAP_ID,
    status: "active",
    phase: "anchors",
    hp: CHORUS_MAX_HP,
    maxHp: CHORUS_MAX_HP,
    stabilizedAnchorIds: [],
    resolvedTestimonyIds: [],
    severedBondIds: [],
    activeRecordId: null,
    currentPatternId: null,
    patternStartedAt: 0,
    patternEndsAt: 0,
    vulnerableUntil: 0,
    lumenAssistUsed: false,
    combatRevision: 0,
    processedActionIds: [],
    contributors: {},
    authorityUid,
    authorityEpoch: Math.max(1, Math.trunc(finite(authorityEpoch, 1))),
    leaseUntil: now + CHORUS_AUTHORITY_LEASE_MS,
    spawnedAt: now,
    updatedAt: now,
    separatedAt: null,
    reformAt: null,
  };
}

export function normalizeChorusEncounter(value) {
  const source = objectValue(value);
  if (!source || source.bossId !== CHORUS_BOSS_ID || source.mapId !== CHORUS_MAP_ID
    || !validId(source.encounterId) || !validId(source.authorityUid, 128)) return null;
  const objectives = objectiveState(source);
  const onslaught = objectives.phase === "onslaught";
  const separated = objectives.phase === "separated";
  return {
    encounterId: source.encounterId,
    bossId: CHORUS_BOSS_ID,
    mapId: CHORUS_MAP_ID,
    status: objectives.status,
    phase: objectives.phase,
    hp: objectives.hp,
    maxHp: CHORUS_MAX_HP,
    stabilizedAnchorIds: objectives.stabilizedAnchorIds,
    resolvedTestimonyIds: objectives.resolvedTestimonyIds,
    severedBondIds: objectives.severedBondIds,
    activeRecordId: onslaught && RECORD_IDS.includes(source.activeRecordId) ? source.activeRecordId : null,
    currentPatternId: onslaught && CHORUS_PATTERN_IDS.includes(source.currentPatternId) ? source.currentPatternId : null,
    patternStartedAt: onslaught ? nonNegativeTime(source.patternStartedAt) : 0,
    patternEndsAt: onslaught ? nonNegativeTime(source.patternEndsAt) : 0,
    vulnerableUntil: onslaught ? nonNegativeTime(source.vulnerableUntil) : 0,
    lumenAssistUsed: source.lumenAssistUsed === true,
    combatRevision: nonNegativeInteger(source.combatRevision),
    processedActionIds: normalizeProcessedActionIds(source.processedActionIds),
    contributors: normalizeContributors(source.contributors),
    authorityUid: source.authorityUid,
    authorityEpoch: Math.max(1, Math.trunc(finite(source.authorityEpoch, 1))),
    leaseUntil: nonNegativeTime(source.leaseUntil),
    spawnedAt: nonNegativeTime(source.spawnedAt),
    updatedAt: nonNegativeTime(source.updatedAt),
    separatedAt: separated ? nonNegativeTime(source.separatedAt, source.updatedAt) : null,
    reformAt: separated && Number.isFinite(source.reformAt) ? nonNegativeTime(source.reformAt) : null,
  };
}

function cloneEncounter(encounter) {
  return {
    ...encounter,
    stabilizedAnchorIds: [...encounter.stabilizedAnchorIds],
    resolvedTestimonyIds: [...encounter.resolvedTestimonyIds],
    severedBondIds: [...encounter.severedBondIds],
    processedActionIds: [...encounter.processedActionIds],
    contributors: Object.fromEntries(Object.entries(encounter.contributors).map(([uid, contributor]) => [uid, {
      ...contributor,
      actionTypes: [...contributor.actionTypes],
    }])),
  };
}

function rejection(reason, personalEvent = null) {
  return { ok: false, reason, personalEvent };
}

function contaminationEvent(action) {
  const sourceId = validId(action.id) ? action.id : `${action.type}:${action.uid}:${action.createdAt}`;
  return {
    id: `${sourceId}:contamination`,
    type: "contamination",
    amount: CHORUS_CONTAMINATION_PER_MISTAKE,
  };
}

export function validateChorusAction(action, context = {}) {
  const request = objectValue(action);
  const encounter = normalizeChorusEncounter(context.encounter);
  if (!request || !encounter || encounter.status !== "active") return rejection("invalid_encounter");
  if (!validActionId(request.id)) return rejection("invalid_action_id");
  if (request.encounterId !== encounter.encounterId) return rejection("encounter_mismatch");
  if (request.authorityEpoch !== encounter.authorityEpoch) return rejection("authority_mismatch");
  if (!validId(request.uid, 128) || request.uid !== context.authenticatedUid) return rejection("uid_mismatch");
  if (request.phase !== encounter.phase) return rejection("phase_mismatch");
  if (encounter.processedActionIds.includes(request.id)) return rejection("duplicate_action");
  const now = finite(context.now, Date.now());
  if (!Number.isFinite(request.createdAt)
    || request.createdAt < now - CHORUS_ACTION_TIME_TOLERANCE_MS
    || request.createdAt > now + CHORUS_ACTION_TIME_TOLERANCE_MS) return rejection("stale_action");

  switch (request.type) {
    case "fragment-strike":
      if (encounter.phase !== "anchors") return rejection("phase_mismatch");
      if (!ANCHOR_IDS.includes(request.fragmentId)) return rejection("invalid_id");
      break;
    case "anchor-stabilize":
      if (encounter.phase !== "anchors") return rejection("phase_mismatch");
      if (!ANCHOR_IDS.includes(request.fragmentId) || !ANCHOR_IDS.includes(request.anchorId)) return rejection("invalid_id");
      if (request.fragmentId !== request.anchorId) return rejection("wrong_anchor", contaminationEvent(request));
      if (encounter.stabilizedAnchorIds.includes(request.anchorId)) return rejection("duplicate_objective");
      break;
    case "testimony-resolve":
      if (encounter.phase !== "testimonies") return rejection("phase_mismatch");
      if (!TESTIMONY_IDS.includes(request.testimonyId) || !TESTIMONY_VERDICTS.includes(request.verdict)) return rejection("invalid_id");
      if (request.verdict !== TESTIMONY_VERDICT_BY_ID[request.testimonyId]) {
        return rejection("wrong_testimony", contaminationEvent(request));
      }
      if (encounter.resolvedTestimonyIds.includes(request.testimonyId)) return rejection("duplicate_objective");
      break;
    case "record-activate": {
      if (encounter.phase !== "onslaught") return rejection("phase_mismatch");
      if (!RECORD_IDS.includes(request.recordId)) return rejection("invalid_id");
      const nextBondId = BOND_IDS.find(id => !encounter.severedBondIds.includes(id));
      if (request.recordId !== nextBondId) return rejection("record_out_of_order");
      break;
    }
    case "bond-cut":
      if (encounter.phase !== "onslaught") return rejection("phase_mismatch");
      if (!BOND_IDS.includes(request.bondId)) return rejection("invalid_id");
      if (encounter.severedBondIds.includes(request.bondId)) return rejection("duplicate_objective");
      if (encounter.activeRecordId !== request.bondId
        || request.createdAt < encounter.updatedAt
        || now < encounter.updatedAt
        || !(encounter.vulnerableUntil >= request.createdAt)
        || !(encounter.vulnerableUntil >= now)) return rejection("bond_not_vulnerable");
      break;
    case "lumen-assist":
      if (encounter.phase !== "anchors") return rejection("phase_mismatch");
      if (!ANCHOR_IDS.includes(request.anchorId)) return rejection("invalid_id");
      if (context.lumenAssistEligible !== true) return rejection("assist_ineligible");
      if (encounter.lumenAssistUsed || encounter.stabilizedAnchorIds.includes(request.anchorId)) {
        return rejection("duplicate_objective");
      }
      break;
    default:
      return rejection("invalid_action_type");
  }
  return { ok: true, action: { ...request }, personalEvent: null };
}

function addObjective(values, id) {
  if (!values.includes(id)) values.push(id);
}

function applyObjectiveAction(encounter, action, now, events) {
  switch (action.type) {
    case "anchor-stabilize":
      addObjective(encounter.stabilizedAnchorIds, action.anchorId);
      events.push({ type: "anchor-stabilized", anchorId: action.anchorId, createdAt: now });
      break;
    case "testimony-resolve":
      addObjective(encounter.resolvedTestimonyIds, action.testimonyId);
      events.push({ type: "testimony-resolved", testimonyId: action.testimonyId, createdAt: now });
      break;
    case "record-activate":
      encounter.activeRecordId = action.recordId;
      encounter.vulnerableUntil = now + CHORUS_VULNERABLE_MS;
      events.push({ type: "record-activated", recordId: action.recordId, vulnerableUntil: encounter.vulnerableUntil });
      break;
    case "bond-cut":
      addObjective(encounter.severedBondIds, action.bondId);
      encounter.activeRecordId = null;
      encounter.vulnerableUntil = 0;
      events.push({ type: "bond-separated", bondId: action.bondId, createdAt: now });
      break;
    case "lumen-assist":
      encounter.lumenAssistUsed = true;
      addObjective(encounter.stabilizedAnchorIds, action.anchorId);
      events.push({ type: "anchor-stabilized", anchorId: action.anchorId, assistedBy: "lumen", createdAt: now });
      break;
    default:
      break;
  }
}

function recordContribution(encounter, uid, type, now) {
  if (!validId(uid, 128) || !CHORUS_CONTRIBUTION_TYPES.includes(type)) return;
  const previous = encounter.contributors[uid];
  encounter.contributors[uid] = {
    firstContributedAt: previous?.firstContributedAt ?? now,
    lastContributedAt: now,
    actionTypes: previous?.actionTypes.includes(type)
      ? [...previous.actionTypes]
      : [...(previous?.actionTypes || []), type],
  };
}

export function applyChorusAction(value, validated, now = Date.now()) {
  const encounter = normalizeChorusEncounter(value);
  if (!validated?.ok || !encounter || encounter.status !== "active") {
    return { encounter: encounter || value, events: [], personalEvent: validated?.personalEvent || null };
  }
  const action = objectValue(validated.action);
  if (!action || !validActionId(action.id) || encounter.processedActionIds.includes(action.id)
    || !CHORUS_CONTRIBUTION_TYPES.includes(action.type)) {
    return { encounter, events: [], personalEvent: null };
  }
  const next = cloneEncounter(encounter);
  const events = [];
  next.processedActionIds = [...next.processedActionIds, action.id].slice(-CHORUS_PROCESSED_ACTION_LIMIT);
  next.combatRevision += 1;
  applyObjectiveAction(next, action, now, events);
  recordContribution(next, action.uid, action.type, now);
  next.updatedAt = now;
  let normalized = normalizeChorusEncounter(next);
  if (normalized.phase !== encounter.phase) {
    events.push({ type: "phase-changed", phase: normalized.phase, createdAt: now });
  }
  if (normalized.phase === "separated" && encounter.phase !== "separated") {
    normalized = normalizeChorusEncounter({ ...normalized, separatedAt: now });
    events.push({ type: "chorus-separated", createdAt: now });
  }
  return { encounter: normalized, events, personalEvent: null };
}

export function createPersonalChorusState() {
  return {
    contamination: 0,
    carriedFragmentId: null,
    processedContaminationEventIds: [],
    confusedUntil: 0,
    attackLockedUntil: 0,
    movementSlowUntil: 0,
  };
}

function normalizePersonalChorusState(value) {
  const source = objectValue(value) || {};
  const processed = Array.isArray(source.processedContaminationEventIds)
    ? [...new Set(source.processedContaminationEventIds.filter(id => validId(id)))]
    : [];
  return {
    contamination: Math.max(0, Math.min(100, finite(source.contamination))),
    carriedFragmentId: ANCHOR_IDS.includes(source.carriedFragmentId) ? source.carriedFragmentId : null,
    processedContaminationEventIds: processed,
    confusedUntil: nonNegativeTime(source.confusedUntil),
    attackLockedUntil: nonNegativeTime(source.attackLockedUntil),
    movementSlowUntil: nonNegativeTime(source.movementSlowUntil),
  };
}

export function reducePersonalChorusState(value, event, now = Date.now()) {
  const state = normalizePersonalChorusState(value);
  const incoming = objectValue(event);
  if (!incoming || incoming.type !== "contamination" || !validId(incoming.id)
    || !(incoming.amount > 0) || !Number.isFinite(incoming.amount)
    || state.processedContaminationEventIds.includes(incoming.id)) return { state, events: [] };
  const next = {
    ...state,
    processedContaminationEventIds: [...state.processedContaminationEventIds, incoming.id],
    contamination: Math.min(100, state.contamination + incoming.amount),
  };
  const events = [];
  if (next.contamination >= 100) {
    if (next.carriedFragmentId) events.push({ type: "fragment-return", fragmentId: next.carriedFragmentId });
    const until = finite(now, Date.now()) + CHORUS_CONFUSION_MS;
    next.contamination = 50;
    next.carriedFragmentId = null;
    next.confusedUntil = until;
    next.attackLockedUntil = until;
    next.movementSlowUntil = until;
  }
  return { state: next, events };
}

export function acquireChorusAuthority(value, { uid, now = Date.now() } = {}) {
  const encounter = normalizeChorusEncounter(value);
  if (!encounter || !validId(uid, 128) || !Number.isFinite(now)) return rejection("invalid_authority");
  if (encounter.authorityUid !== uid && encounter.leaseUntil > now) return rejection("lease_active");
  const startsNewEpoch = encounter.authorityUid !== uid || encounter.leaseUntil <= now;
  return {
    ok: true,
    encounter: {
      ...encounter,
      authorityUid: uid,
      authorityEpoch: startsNewEpoch ? encounter.authorityEpoch + 1 : encounter.authorityEpoch,
      leaseUntil: now + CHORUS_AUTHORITY_LEASE_MS,
      updatedAt: now,
    },
  };
}

export function renewChorusAuthority(value, { uid, authorityEpoch, now = Date.now() } = {}) {
  const encounter = normalizeChorusEncounter(value);
  if (!encounter || encounter.authorityUid !== uid || encounter.authorityEpoch !== authorityEpoch
    || !Number.isFinite(now)) return rejection("authority_mismatch");
  if (encounter.leaseUntil <= now) return rejection("lease_expired");
  return {
    ok: true,
    encounter: {
      ...encounter,
      leaseUntil: now + CHORUS_AUTHORITY_LEASE_MS,
    },
  };
}

export function createChorusCompletionClaims(value, now = Date.now()) {
  const encounter = normalizeChorusEncounter(value);
  if (!encounter || encounter.status !== "separated" || !Number.isFinite(now)) return {};
  return Object.fromEntries(Object.keys(encounter.contributors).sort().map(uid => [uid, {
    encounterId: encounter.encounterId,
    uid,
    eligible: true,
    createdAt: now,
  }]));
}
