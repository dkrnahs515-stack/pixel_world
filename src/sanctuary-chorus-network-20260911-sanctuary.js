import {
  CHORUS_ACTION_ID_MAX_LENGTH,
  CHORUS_AUTHORITY_RENEW_MS,
  CHORUS_MAP_ID,
  CHORUS_PROCESSED_ACTION_LIMIT,
} from "./sanctuary-chorus-data-20260911-sanctuary.js";
import {
  acquireChorusAuthority,
  applyChorusAction,
  createChorusEncounter,
  createReformedChorusEncounter,
  normalizeChorusEncounter,
  renewChorusAuthority,
  validateChorusAction,
} from "./sanctuary-chorus-state-20260911-sanctuary.js";

const BASE_PATH = `rooms/public/chorus/${CHORUS_MAP_ID}`;
const CLAIM_FIELDS = Object.freeze(["encounterId", "uid", "eligible", "createdAt"]);
const COMBAT_STATE_FIELDS = Object.freeze([
  "status", "phase", "hp", "maxHp",
  "stabilizedAnchorIds", "resolvedTestimonyIds", "severedBondIds",
  "activeRecordId", "currentPatternId", "patternStartedAt", "patternEndsAt", "vulnerableUntil",
  "lumenAssistUsed", "processedActionIds", "contributors", "separatedAt", "reformAt",
]);
const OBJECTIVE_MEMBERSHIP_FIELDS = Object.freeze([
  "stabilizedAnchorIds", "resolvedTestimonyIds", "severedBondIds",
]);

function validKey(value, maxLength = 160) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    && /^[A-Za-z0-9:_-]+$/.test(value);
}

function validActionId(value) {
  return typeof value === "string" && value.length <= CHORUS_ACTION_ID_MAX_LENGTH
    && /^[A-Za-z0-9:_-]+$/.test(value);
}

function withoutUndefined(value) {
  if (Array.isArray(value)) return value.filter(entry => entry !== undefined).map(withoutUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => [key, withoutUndefined(entry)]));
}

function membershipValues(value, predicate = () => true) {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).filter(([, included]) => included === true).map(([id]) => id)
      : [];
  return [...new Set(candidates.filter(predicate))];
}

function membershipMap(values, predicate = () => true) {
  return Object.fromEntries(membershipValues(values, predicate).map(value => [value, true]));
}

function decodeWireEncounter(value, localProcessedActionIds = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const decoded = { ...value };
  for (const field of OBJECTIVE_MEMBERSHIP_FIELDS) decoded[field] = membershipValues(value[field]);
  decoded.processedActionIds = mergeProcessedActionIds(
    localProcessedActionIds,
    [
      ...membershipValues(value.processedActionIds, validActionId),
      ...(validActionId(value.processedActionId) ? [value.processedActionId] : []),
    ],
  );
  delete decoded.processedSequenceByUid;
  decoded.contributors = Object.fromEntries(Object.entries(value.contributors || {}).map(([contributorUid, contributor]) => [
    contributorUid,
    {
      ...contributor,
      actionTypes: membershipValues(contributor?.actionTypes),
    },
  ]));
  return decoded;
}

function encodeWireEncounter(value) {
  const wire = withoutUndefined({ ...value });
  for (const field of OBJECTIVE_MEMBERSHIP_FIELDS) {
    const encoded = membershipMap(value?.[field]);
    if (Object.keys(encoded).length > 0) wire[field] = encoded;
    else delete wire[field];
  }
  delete wire.processedActionIds;
  delete wire.processedSequenceByUid;
  if (!validActionId(wire.processedActionId)
    || !validKey(wire.processedActionUid, 128)
    || !Number.isSafeInteger(wire.processedActionSequence)
    || wire.processedActionSequence < 1) {
    delete wire.processedActionId;
    delete wire.processedActionUid;
    delete wire.processedActionSequence;
  }
  const contributors = Object.fromEntries(Object.entries(value?.contributors || {}).map(([contributorUid, contributor]) => [
    contributorUid,
    {
      firstContributedAt: contributor.firstContributedAt,
      lastContributedAt: contributor.lastContributedAt,
      actionTypes: membershipMap(contributor.actionTypes),
    },
  ]));
  if (Object.keys(contributors).length > 0) wire.contributors = contributors;
  else delete wire.contributors;
  return withoutUndefined(wire);
}

function sameClaim(left, right) {
  return CLAIM_FIELDS.every(field => left?.[field] === right?.[field]);
}

function containsAll(haystack, needles) {
  const values = new Set(haystack);
  return needles.every(value => values.has(value));
}

function mergeProcessedActionIds(current, incoming) {
  return [...new Set([...(current || []), ...(incoming || [])])].slice(-CHORUS_PROCESSED_ACTION_LIMIT);
}

function normalizeProcessedSequences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([actionUid, sequence]) => (
    validKey(actionUid, 128)
    && Number.isSafeInteger(sequence)
    && sequence >= 1
  )));
}

function mergeContributors(current = {}, incoming = {}) {
  const merged = {};
  for (const contributorUid of new Set([...Object.keys(current), ...Object.keys(incoming)])) {
    const previous = current[contributorUid];
    const next = incoming[contributorUid];
    if (!previous) {
      merged[contributorUid] = next;
      continue;
    }
    if (!next) {
      merged[contributorUid] = previous;
      continue;
    }
    merged[contributorUid] = {
      firstContributedAt: previous.firstContributedAt,
      lastContributedAt: Math.max(previous.lastContributedAt, next.lastContributedAt),
      actionTypes: membershipValues([...previous.actionTypes, ...next.actionTypes]),
    };
  }
  return merged;
}

function filterProcessedActions(value, processedSequences) {
  const filtered = {};
  for (const [actionUid, actions] of Object.entries(value || {})) {
    const confirmedSequence = processedSequences[actionUid] || 0;
    const pending = Object.fromEntries(Object.entries(actions || {})
      .filter(([sequence]) => Number(sequence) > confirmedSequence));
    if (Object.keys(pending).length > 0) filtered[actionUid] = pending;
  }
  return filtered;
}

function sameCombatState(left, right) {
  return COMBAT_STATE_FIELDS.every(field => JSON.stringify(left?.[field]) === JSON.stringify(right?.[field]));
}

function sameQueuedAction(left, right) {
  const canonical = value => JSON.stringify(Object.fromEntries(
    Object.entries(withoutUndefined(value || {})).sort(([a], [b]) => a.localeCompare(b)),
  ));
  return canonical(left) === canonical(right);
}

function actionlessRevisionIsMaintenance(current, incoming) {
  return incoming.status === current.status
    && incoming.phase === current.phase
    && incoming.hp === current.hp
    && incoming.lumenAssistUsed === current.lumenAssistUsed
    && JSON.stringify(incoming.stabilizedAnchorIds) === JSON.stringify(current.stabilizedAnchorIds)
    && JSON.stringify(incoming.resolvedTestimonyIds) === JSON.stringify(current.resolvedTestimonyIds)
    && JSON.stringify(incoming.severedBondIds) === JSON.stringify(current.severedBondIds)
    && JSON.stringify(incoming.contributors) === JSON.stringify(current.contributors)
    && incoming.separatedAt === current.separatedAt
    && incoming.reformAt === current.reformAt;
}

function statePatch(current, next, processedAction = null) {
  const patch = {};
  for (const field of COMBAT_STATE_FIELDS) {
    if (OBJECTIVE_MEMBERSHIP_FIELDS.includes(field)) {
      const currentIds = new Set(current?.[field] || []);
      for (const id of next[field] || []) {
        if (!currentIds.has(id)) patch[`${field}/${id}`] = true;
      }
    } else if (field === "processedActionIds") {
      continue;
    } else if (field === "contributors") {
      for (const [contributorUid, contributor] of Object.entries(next.contributors || {})) {
        const previous = current?.contributors?.[contributorUid];
        if (!previous) {
          patch[`contributors/${contributorUid}/firstContributedAt`] = contributor.firstContributedAt;
          patch[`contributors/${contributorUid}/lastContributedAt`] = contributor.lastContributedAt;
        } else if (previous.lastContributedAt !== contributor.lastContributedAt) {
          patch[`contributors/${contributorUid}/lastContributedAt`] = contributor.lastContributedAt;
        }
        const previousTypes = new Set(previous?.actionTypes || []);
        for (const type of contributor.actionTypes) {
          if (!previousTypes.has(type)) patch[`contributors/${contributorUid}/actionTypes/${type}`] = true;
        }
      }
    } else if (JSON.stringify(current?.[field]) !== JSON.stringify(next[field])) {
      patch[field] = next[field];
    }
  }
  for (const field of ["combatRevision", "leaseUntil", "updatedAt"]) {
    if (current?.[field] !== next[field]) patch[field] = next[field];
  }
  if (processedAction) {
    patch[`processedSequenceByUid/${processedAction.uid}`] = processedAction.sequence;
    patch.processedActionId = processedAction.id;
    patch.processedActionUid = processedAction.uid;
    patch.processedActionSequence = processedAction.sequence;
  }
  return withoutUndefined(patch);
}

export function createChorusNetwork({
  dbModule,
  db,
  roomId,
  uid,
  callbacks = {},
  now = () => Date.now(),
  timers = {},
} = {}) {
  if (!dbModule || !db || roomId !== "public" || !validKey(uid, 128)) {
    throw new TypeError("valid Firebase chorus network options are required");
  }

  const setTimer = timers.set || ((callback, delay) => setTimeout(callback, delay));
  const clearTimer = timers.clear || (handle => clearTimeout(handle));
  const onStateChanged = callbacks.onStateChanged || (() => {});
  const onActionsChanged = callbacks.onActionsChanged || (() => {});
  const onCompletionClaimsChanged = callbacks.onCompletionClaimsChanged || (() => {});
  let mapId = null;
  let stopped = false;
  let unsubscribers = [];
  let claimUnsubscriber = null;
  let claimEncounterId = null;
  let renewalTimer = null;
  let renewalEpoch = null;
  let reformTimer = null;
  let reformEncounterId = null;
  let latestState = null;
  let latestActions = {};
  let processedSequenceByUid = {};
  let stateSnapshotReady = false;
  let sequenceSnapshotReady = false;
  let actionsSnapshotReady = false;
  let pendingActions = null;
  let stateMutationQueue = Promise.resolve();
  const actionCleanupPromises = new Map();

  const pathRef = suffix => dbModule.ref(db, suffix ? `${BASE_PATH}/${suffix}` : BASE_PATH);
  const readCurrentState = async () => {
    if (latestState) return latestState;
    if (typeof dbModule.get !== "function") return null;
    const [snapshot, sequenceSnapshot] = await Promise.all([
      dbModule.get(pathRef("state")),
      dbModule.get(pathRef("processedSequences")),
    ]);
    const wire = snapshot.val();
    processedSequenceByUid = {
      ...normalizeProcessedSequences(wire?.processedSequenceByUid),
      ...normalizeProcessedSequences(sequenceSnapshot.val()),
    };
    return normalizeChorusEncounter(decodeWireEncounter(wire));
  };

  const clearRenewal = () => {
    if (renewalTimer !== null) clearTimer(renewalTimer);
    renewalTimer = null;
    renewalEpoch = null;
  };

  const clearReform = () => {
    if (reformTimer !== null) clearTimer(reformTimer);
    reformTimer = null;
    reformEncounterId = null;
  };

  const clearSubscriptions = () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    if (claimUnsubscriber) claimUnsubscriber();
    claimUnsubscriber = null;
    claimEncounterId = null;
    clearRenewal();
    clearReform();
  };

  const subscribeToOwnClaim = encounterId => {
    const nextEncounterId = validKey(encounterId) ? encounterId : null;
    if (nextEncounterId === claimEncounterId) return;
    if (claimUnsubscriber) claimUnsubscriber();
    claimUnsubscriber = null;
    claimEncounterId = nextEncounterId;
    if (!active() || !nextEncounterId) {
      onCompletionClaimsChanged({});
      return;
    }
    claimUnsubscriber = dbModule.onValue(
      pathRef(`completionClaims/${nextEncounterId}/${uid}`),
      snapshot => {
        const claim = snapshot.val();
        onCompletionClaimsChanged(claim ? { [uid]: claim } : {});
      },
    );
  };

  const active = () => !stopped && mapId === CHORUS_MAP_ID;
  const enqueueStateMutation = operation => {
    const result = stateMutationQueue.then(operation, operation);
    stateMutationQueue = result.catch(() => {});
    return result;
  };
  const isAuthority = (
    encounter = latestState,
    timestamp = now(),
    authorityEpoch = encounter?.authorityEpoch,
  ) => Boolean(
    encounter
    && encounter.authorityUid === uid
    && Number.isInteger(encounter.authorityEpoch)
    && encounter.authorityEpoch === authorityEpoch
    && encounter.leaseUntil > timestamp,
  );

  const forgetAction = (requestUid, sequence) => {
    const entries = latestActions[requestUid];
    if (!entries || !Object.hasOwn(entries, String(sequence))) return;
    delete entries[String(sequence)];
    if (Object.keys(entries).length === 0) delete latestActions[requestUid];
  };

  const cleanupConfirmedActions = () => {
    if (!active() || !stateSnapshotReady || !isAuthority()) return;
    const authorityEpoch = latestState.authorityEpoch;
    for (const [requestUid, entries] of Object.entries(latestActions)) {
      const confirmedSequence = processedSequenceByUid[requestUid] || 0;
      for (const sequenceKey of Object.keys(entries || {})) {
        const sequence = Number(sequenceKey);
        if (!Number.isSafeInteger(sequence) || sequence < 1
          || String(sequence) !== sequenceKey || sequence > confirmedSequence) continue;
        void api.acknowledgeAction(requestUid, sequence, authorityEpoch).catch(() => {});
      }
    }
  };

  const receiveActionsSnapshot = value => {
    latestActions = structuredClone(value || {});
    actionsSnapshotReady = true;
    onActionsChanged(filterProcessedActions(latestActions, processedSequenceByUid));
    cleanupConfirmedActions();
  };

  const scheduleRenewal = epoch => {
    clearRenewal();
    if (!active() || latestState?.status !== "active") return;
    renewalEpoch = epoch;
    const tick = async () => {
      if (!active() || renewalEpoch !== epoch) return;
      const result = await api.renewAuthority(epoch);
      if (!result.ok || !active()) {
        clearRenewal();
        return;
      }
      renewalTimer = setTimer(tick, CHORUS_AUTHORITY_RENEW_MS);
    };
    renewalTimer = setTimer(tick, CHORUS_AUTHORITY_RENEW_MS);
  };

  const scheduleReform = encounter => {
    clearReform();
    if (!active() || encounter?.status !== "separated"
      || !Number.isFinite(encounter.reformAt)) return;
    reformEncounterId = encounter.encounterId;
    const tick = async () => {
      reformTimer = null;
      if (!active() || latestState?.encounterId !== reformEncounterId
        || latestState?.status !== "separated") return;
      try {
        await api.ensureEncounter();
      } catch {
        if (active() && latestState?.encounterId === reformEncounterId
          && latestState?.status === "separated") {
          reformTimer = setTimer(tick, 1_000);
        }
      }
    };
    reformTimer = setTimer(tick, Math.max(0, encounter.reformAt - now()));
  };

  const rememberState = value => {
    const localProcessedActionIds = latestState && latestState.encounterId === value?.encounterId
      ? latestState.processedActionIds
      : [];
    const stateSequences = normalizeProcessedSequences(value?.processedSequenceByUid);
    for (const [actionUid, sequence] of Object.entries(stateSequences)) {
      processedSequenceByUid[actionUid] = Math.max(processedSequenceByUid[actionUid] || 0, sequence);
    }
    const encounter = normalizeChorusEncounter(decodeWireEncounter(value, localProcessedActionIds));
    latestState = encounter;
    stateSnapshotReady = true;
    subscribeToOwnClaim(encounter?.encounterId);
    if (encounter?.status === "separated") {
      clearRenewal();
      if (reformEncounterId !== encounter.encounterId || reformTimer === null) scheduleReform(encounter);
    } else if (isAuthority(encounter) && renewalEpoch !== encounter.authorityEpoch) {
      clearReform();
      scheduleRenewal(encounter.authorityEpoch);
    } else if (!isAuthority(encounter)) {
      clearRenewal();
      clearReform();
    }
    onStateChanged(encounter);
    if (pendingActions && sequenceSnapshotReady) {
      receiveActionsSnapshot(pendingActions);
      pendingActions = null;
    } else cleanupConfirmedActions();
  };

  const api = {
    get mapId() { return mapId; },
    get latestState() { return latestState ? structuredClone(latestState) : null; },
    get processedSequenceByUid() { return structuredClone(processedSequenceByUid); },
    get isAuthority() { return isAuthority(); },

    async setMap(nextMapId) {
      clearSubscriptions();
      mapId = nextMapId === CHORUS_MAP_ID ? CHORUS_MAP_ID : null;
      latestState = null;
      latestActions = {};
      processedSequenceByUid = {};
      stateSnapshotReady = false;
      sequenceSnapshotReady = false;
      actionsSnapshotReady = false;
      pendingActions = null;
      actionCleanupPromises.clear();
      if (!active()) {
        onStateChanged(null);
        onActionsChanged({});
        onCompletionClaimsChanged({});
        return false;
      }
      unsubscribers.push(dbModule.onValue(pathRef("state"), snapshot => rememberState(snapshot.val() ?? null)));
      unsubscribers.push(dbModule.onValue(pathRef("processedSequences"), snapshot => {
        const incoming = normalizeProcessedSequences(snapshot.val());
        for (const [actionUid, sequence] of Object.entries(incoming)) {
          processedSequenceByUid[actionUid] = Math.max(processedSequenceByUid[actionUid] || 0, sequence);
        }
        sequenceSnapshotReady = true;
        if (pendingActions && stateSnapshotReady) {
          receiveActionsSnapshot(pendingActions);
          pendingActions = null;
        } else cleanupConfirmedActions();
      }));
      unsubscribers.push(dbModule.onValue(pathRef("actions"), snapshot => {
        const actions = snapshot.val() || {};
        if (!stateSnapshotReady || !sequenceSnapshotReady) {
          pendingActions = structuredClone(actions);
          return;
        }
        receiveActionsSnapshot(actions);
      }));
      return true;
    },

    async ensureEncounter() {
      if (!active()) return null;
      return enqueueStateMutation(async () => {
        if (!active()) return null;
        const current = await readCurrentState();
        if (current) {
          const timestamp = now();
          const reformed = createReformedChorusEncounter(current, { uid, now: timestamp });
          if (reformed && current.leaseUntil <= timestamp) {
            const transaction = await dbModule.runTransaction(pathRef("state"), wireCurrent => {
              const observed = normalizeChorusEncounter(decodeWireEncounter(wireCurrent));
              if (!observed || observed.encounterId !== current.encounterId
                || observed.combatRevision !== current.combatRevision
                || observed.reformAt !== current.reformAt
                || observed.leaseUntil > timestamp) return undefined;
              const wire = encodeWireEncounter(reformed);
              return wire;
            });
            if (!transaction.committed) {
              latestState = normalizeChorusEncounter(decodeWireEncounter(transaction.snapshot.val()));
              return latestState ? structuredClone(latestState) : null;
            }
            const wire = transaction.snapshot.val();
            latestState = normalizeChorusEncounter(decodeWireEncounter(wire));
            stateSnapshotReady = true;
            subscribeToOwnClaim(latestState.encounterId);
            clearReform();
            scheduleRenewal(latestState.authorityEpoch);
            onStateChanged(latestState);
            cleanupConfirmedActions();
            return structuredClone(latestState);
          }
          latestState = current;
          return structuredClone(current);
        }
        const timestamp = now();
        const encounter = createChorusEncounter({
          encounterId: `sanctuary-chorus-${Math.trunc(timestamp)}-${uid.slice(0, 12)}`,
          authorityUid: uid,
          now: timestamp,
        });
        if (!encounter) return null;
        await dbModule.update(pathRef("state"), encodeWireEncounter(encounter));
        if (encounter) {
          latestState = encounter;
          clearReform();
          if (isAuthority(encounter)) scheduleRenewal(encounter.authorityEpoch);
        }
        return encounter;
      });
    },

    async tryAcquireAuthority() {
      if (!active()) return { ok: false, reason: "inactive" };
      return enqueueStateMutation(async () => {
        if (!active()) return { ok: false, reason: "inactive" };
        const current = await readCurrentState();
        const outcome = acquireChorusAuthority(current, { uid, now: now() });
        if (!outcome.ok) return outcome;
        const patch = {
          authorityUid: outcome.encounter.authorityUid,
          authorityEpoch: outcome.encounter.authorityEpoch,
          leaseUntil: outcome.encounter.leaseUntil,
          updatedAt: outcome.encounter.updatedAt,
        };
        await dbModule.update(pathRef("state"), patch);
        latestState = normalizeChorusEncounter({ ...current, ...patch });
        scheduleRenewal(latestState.authorityEpoch);
        cleanupConfirmedActions();
        return { ok: true, encounter: latestState };
      });
    },

    async renewAuthority(epoch = renewalEpoch) {
      if (!active()) return { ok: false, reason: "inactive" };
      return enqueueStateMutation(async () => {
        if (!active()) return { ok: false, reason: "inactive" };
        const outcome = renewChorusAuthority(latestState, { uid, authorityEpoch: epoch, now: now() });
        if (!outcome.ok) return outcome;
        const patch = { leaseUntil: outcome.encounter.leaseUntil };
        await dbModule.update(pathRef("state"), patch);
        latestState = normalizeChorusEncounter({ ...latestState, ...patch });
        return { ok: true, encounter: latestState };
      });
    },

    async publishState(value, { processedAction = null } = {}) {
      const incoming = normalizeChorusEncounter(value);
      if (!active() || !incoming || !isAuthority(latestState, now(), incoming?.authorityEpoch)
        || incoming.authorityUid !== uid
        || incoming.authorityEpoch !== latestState.authorityEpoch
        || incoming.encounterId !== latestState.encounterId) {
        return { ok: false, reason: "not_authority" };
      }
      return enqueueStateMutation(async () => {
        if (!active()) return { ok: false, reason: "inactive" };
        const current = normalizeChorusEncounter(latestState);
        if (!current || current.authorityUid !== uid
          || current.authorityEpoch !== incoming.authorityEpoch
          || current.encounterId !== incoming.encounterId) {
          return { ok: false, reason: "authority_changed" };
        }
        if (current.leaseUntil <= now()) return { ok: false, reason: "lease_expired" };
        const olderRevision = incoming.combatRevision < current.combatRevision;
        const skippedRevision = incoming.combatRevision > current.combatRevision + 1;
        const conflictingSameRevision = incoming.combatRevision === current.combatRevision
          && !sameCombatState(incoming, current);
        if (olderRevision || skippedRevision || conflictingSameRevision
          || !containsAll(incoming.stabilizedAnchorIds, current.stabilizedAnchorIds)
          || !containsAll(incoming.resolvedTestimonyIds, current.resolvedTestimonyIds)
          || !containsAll(incoming.severedBondIds, current.severedBondIds)) {
          return { ok: false, reason: "stale_state" };
        }
        const addedProcessedActionIds = incoming.processedActionIds
          .filter(actionId => !current.processedActionIds.includes(actionId));
        if (addedProcessedActionIds.length > 0 && !processedAction) {
          return { ok: false, reason: "processed_action_required" };
        }
        if (processedAction && (
          addedProcessedActionIds.length !== 1
          || addedProcessedActionIds[0] !== processedAction.id
          || !validActionId(processedAction.id)
          || !validKey(processedAction.uid, 128)
          || !Number.isSafeInteger(processedAction.sequence)
          || processedAction.sequence < 1
          || processedAction.sequence <= (processedSequenceByUid[processedAction.uid] || 0)
          || processedAction.encounterId !== current.encounterId
          || processedAction.authorityEpoch !== current.authorityEpoch
          || processedAction.phase !== current.phase
        )) {
          return { ok: false, reason: "processed_action_mismatch" };
        }
        if (processedAction) {
          const queuedAction = latestActions?.[processedAction.uid]?.[String(processedAction.sequence)];
          if (!queuedAction || !sameQueuedAction(queuedAction, processedAction)) {
            return { ok: false, reason: "queued_action_mismatch" };
          }
          const validation = validateChorusAction(processedAction, {
            encounter: current,
            authenticatedUid: processedAction.uid,
            now: processedAction.createdAt,
            lumenAssistEligible: true,
          });
          if (!validation.ok) return { ok: false, reason: "queued_action_invalid" };
          const expected = applyChorusAction(current, validation, processedAction.createdAt).encounter;
          if (!sameCombatState(expected, incoming)) {
            return { ok: false, reason: "action_state_mismatch" };
          }
        } else if (incoming.combatRevision === current.combatRevision + 1
          && !actionlessRevisionIsMaintenance(current, incoming)) {
          return { ok: false, reason: "processed_action_required" };
        }
        let next = normalizeChorusEncounter(withoutUndefined({
          ...incoming,
          leaseUntil: Math.max(current.leaseUntil, incoming.leaseUntil),
          updatedAt: incoming.combatRevision > current.combatRevision
            ? incoming.updatedAt
            : current.updatedAt,
          processedActionIds: mergeProcessedActionIds(current.processedActionIds, incoming.processedActionIds),
          contributors: mergeContributors(current.contributors, incoming.contributors),
        }));
        if (processedAction) {
          next = normalizeChorusEncounter({
            ...next,
            processedActionId: processedAction.id,
            processedActionUid: processedAction.uid,
            processedActionSequence: processedAction.sequence,
          });
        }
        const stateChanges = statePatch(current, next, processedAction);
        const patch = Object.fromEntries(Object.entries(stateChanges)
          .map(([field, fieldValue]) => [`state/${field}`, fieldValue]));
        if (processedAction) patch[`processedSequences/${processedAction.uid}`] = processedAction.sequence;
        if (Object.keys(patch).length > 0) await dbModule.update(pathRef(""), patch);
        if (processedAction) processedSequenceByUid[processedAction.uid] = processedAction.sequence;
        latestState = next;
        if (latestState.status === "separated") {
          clearRenewal();
          scheduleReform(latestState);
        }
        cleanupConfirmedActions();
        return {
          ok: true,
          encounter: latestState,
          processedSequenceByUid: structuredClone(processedSequenceByUid),
        };
      });
    },

    async sendAction(request) {
      if (!active() || !Number.isInteger(request?.sequence) || request.sequence < 1
        || !validKey(String(request.sequence), 24) || !validActionId(request?.id)
        || !validKey(request?.encounterId)) {
        return { ok: false, reason: "invalid_action" };
      }
      const sequenceTransaction = await dbModule.runTransaction(pathRef(`actionSequences/${uid}`), current => {
        const previous = Number.isInteger(current) && current >= 0 ? current : 0;
        return previous + 1;
      });
      if (!sequenceTransaction.committed) return { ok: false, reason: "sequence_allocation_failed" };
      const sequence = sequenceTransaction.snapshot.val();
      const action = withoutUndefined({ ...request, uid, sequence });
      await dbModule.set(pathRef(`actions/${uid}/${sequence}`), action);
      latestActions[uid] ||= {};
      latestActions[uid][String(sequence)] = structuredClone(action);
      return { ok: true, action };
    },

    async acknowledgeAction(requestUid, sequence, authorityEpoch = latestState?.authorityEpoch) {
      if (!active() || !isAuthority(latestState, now(), authorityEpoch) || !validKey(requestUid, 128)
        || !Number.isInteger(Number(sequence)) || Number(sequence) < 1) {
        return { ok: false, reason: "not_authority" };
      }
      if ((processedSequenceByUid[requestUid] || 0) < Number(sequence)) {
        return { ok: false, reason: "not_processed" };
      }
      const numericSequence = Number(sequence);
      if (actionsSnapshotReady
        && !Object.hasOwn(latestActions[requestUid] || {}, String(numericSequence))) {
        return { ok: true, reason: "already_removed" };
      }
      const cleanupKey = `${latestState.encounterId}:${requestUid}:${numericSequence}`;
      if (actionCleanupPromises.has(cleanupKey)) return actionCleanupPromises.get(cleanupKey);
      const cleanup = dbModule.remove(pathRef(`actions/${requestUid}/${numericSequence}`))
        .then(() => {
          forgetAction(requestUid, numericSequence);
          return { ok: true };
        })
        .finally(() => actionCleanupPromises.delete(cleanupKey));
      actionCleanupPromises.set(cleanupKey, cleanup);
      return cleanup;
    },

    async writeCompletionClaims(encounterId, claims) {
      if (!validKey(encounterId) || !isAuthority() || latestState?.status !== "separated"
        || latestState.encounterId !== encounterId) {
        return { ok: false, reason: "not_authority", results: [] };
      }
      const results = await Promise.all(Object.entries(claims || {}).map(async ([claimUid, claim]) => {
        if (!validKey(claimUid, 128) || claim?.uid !== claimUid
          || claim?.encounterId !== encounterId || claim?.eligible !== true) {
          return { uid: claimUid, ok: false, reason: "invalid_claim" };
        }
        let outcome = { ok: false, reason: "transaction_aborted" };
        const transaction = await dbModule.runTransaction(pathRef(`completionClaims/${encounterId}/${claimUid}`), current => {
          if (current != null) {
            outcome = sameClaim(current, claim)
              ? { ok: true, reason: "already_exists" }
              : { ok: false, reason: "claim_conflict" };
            return undefined;
          }
          outcome = { ok: true, reason: "created" };
          return withoutUndefined(claim);
        });
        return { uid: claimUid, ...outcome, transaction };
      }));
      return {
        ok: results.every(result => result.ok),
        failedUids: results.filter(result => !result.ok).map(result => result.uid),
        results,
      };
    },

    async acknowledgeCompletionClaim(encounterId) {
      if (!active()) return { ok: false, reason: "inactive" };
      if (!validKey(encounterId)) return { ok: false, reason: "invalid_claim" };
      let outcome = { ok: false, reason: "claim_missing" };
      const transaction = await dbModule.runTransaction(pathRef(`completionClaims/${encounterId}/${uid}`), current => {
        if (!current || current.uid !== uid || current.encounterId !== encounterId || current.eligible !== true) {
          return undefined;
        }
        if (current.acknowledgedAt != null) {
          outcome = { ok: true, reason: "already_acknowledged", claim: current };
          return undefined;
        }
        const claim = { ...current, acknowledgedAt: dbModule.serverTimestamp() };
        outcome = { ok: true, reason: "acknowledged", claim };
        return claim;
      });
      return transaction.committed
        ? { ok: true, claim: transaction.snapshot.val() }
        : outcome;
    },

    async stop() {
      if (stopped) return;
      stopped = true;
      clearSubscriptions();
      latestState = null;
    },
  };

  return api;
}
