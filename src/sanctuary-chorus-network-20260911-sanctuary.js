import {
  CHORUS_AUTHORITY_RENEW_MS,
  CHORUS_MAP_ID,
  CHORUS_PROCESSED_ACTION_LIMIT,
} from "./sanctuary-chorus-data-20260911-sanctuary.js";
import {
  acquireChorusAuthority,
  createChorusEncounter,
  normalizeChorusEncounter,
  renewChorusAuthority,
} from "./sanctuary-chorus-state-20260911-sanctuary.js";

const BASE_PATH = `rooms/public/chorus/${CHORUS_MAP_ID}`;
const CLAIM_FIELDS = Object.freeze(["encounterId", "uid", "eligible", "createdAt"]);
const COMBAT_STATE_FIELDS = Object.freeze([
  "status", "phase", "hp", "maxHp",
  "stabilizedAnchorIds", "resolvedTestimonyIds", "severedBondIds",
  "activeRecordId", "currentPatternId", "patternStartedAt", "patternEndsAt", "vulnerableUntil",
  "lumenAssistUsed", "processedActionIds", "contributors", "separatedAt", "reformAt",
]);

function validKey(value, maxLength = 160) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(value);
}

function withoutUndefined(value) {
  if (Array.isArray(value)) return value.filter(entry => entry !== undefined).map(withoutUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => [key, withoutUndefined(entry)]));
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

function sameCombatState(left, right) {
  return COMBAT_STATE_FIELDS.every(field => JSON.stringify(left?.[field]) === JSON.stringify(right?.[field]));
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
  let renewalTimer = null;
  let renewalEpoch = null;
  let latestState = null;
  let stateMutationQueue = Promise.resolve();

  const pathRef = suffix => dbModule.ref(db, suffix ? `${BASE_PATH}/${suffix}` : BASE_PATH);

  const clearRenewal = () => {
    if (renewalTimer !== null) clearTimer(renewalTimer);
    renewalTimer = null;
    renewalEpoch = null;
  };

  const clearSubscriptions = () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    clearRenewal();
  };

  const active = () => !stopped && mapId === CHORUS_MAP_ID;
  const enqueueStateMutation = operation => {
    const result = stateMutationQueue.then(operation, operation);
    stateMutationQueue = result.catch(() => {});
    return result;
  };
  const isAuthority = (encounter = latestState) => Boolean(
    encounter
    && encounter.authorityUid === uid
    && Number.isInteger(encounter.authorityEpoch),
  );

  const scheduleRenewal = epoch => {
    clearRenewal();
    if (!active()) return;
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

  const rememberState = value => {
    const encounter = normalizeChorusEncounter(value);
    latestState = encounter;
    if (isAuthority(encounter) && renewalEpoch !== encounter.authorityEpoch) {
      scheduleRenewal(encounter.authorityEpoch);
    } else if (!isAuthority(encounter)) {
      clearRenewal();
    }
    onStateChanged(encounter);
  };

  const api = {
    get mapId() { return mapId; },
    get latestState() { return latestState ? structuredClone(latestState) : null; },
    get isAuthority() { return isAuthority(); },

    async setMap(nextMapId) {
      clearSubscriptions();
      mapId = nextMapId === CHORUS_MAP_ID ? CHORUS_MAP_ID : null;
      latestState = null;
      if (!active()) {
        onStateChanged(null);
        onActionsChanged({});
        onCompletionClaimsChanged({});
        return false;
      }
      unsubscribers.push(dbModule.onValue(pathRef("state"), snapshot => rememberState(snapshot.val() ?? null)));
      unsubscribers.push(dbModule.onValue(pathRef("actions"), snapshot => onActionsChanged(snapshot.val() || {})));
      unsubscribers.push(dbModule.onValue(pathRef(`completionClaims/${uid}`), snapshot => {
        const claim = snapshot.val();
        onCompletionClaimsChanged(claim ? { [uid]: claim } : {});
      }));
      return true;
    },

    async ensureEncounter() {
      if (!active()) return null;
      return enqueueStateMutation(async () => {
        if (!active()) return null;
        const timestamp = now();
        const transaction = await dbModule.runTransaction(pathRef("state"), current => {
          const encounter = normalizeChorusEncounter(current);
          if (encounter) return undefined;
          return createChorusEncounter({
            encounterId: `sanctuary-chorus-${Math.trunc(timestamp)}-${uid.slice(0, 12)}`,
            authorityUid: uid,
            now: timestamp,
          });
        });
        const encounter = normalizeChorusEncounter(transaction.snapshot.val());
        if (encounter) {
          latestState = encounter;
          if (isAuthority(encounter)) scheduleRenewal(encounter.authorityEpoch);
        }
        return encounter;
      });
    },

    async tryAcquireAuthority() {
      if (!active()) return { ok: false, reason: "inactive" };
      return enqueueStateMutation(async () => {
        if (!active()) return { ok: false, reason: "inactive" };
        let outcome = { ok: false, reason: "transaction_aborted" };
        const transaction = await dbModule.runTransaction(pathRef("state"), current => {
          outcome = acquireChorusAuthority(current, { uid, now: now() });
          return outcome.ok ? outcome.encounter : undefined;
        });
        if (!transaction.committed) return outcome;
        latestState = normalizeChorusEncounter(transaction.snapshot.val());
        scheduleRenewal(latestState.authorityEpoch);
        return { ok: true, encounter: latestState };
      });
    },

    async renewAuthority(epoch = renewalEpoch) {
      if (!active()) return { ok: false, reason: "inactive" };
      return enqueueStateMutation(async () => {
        if (!active()) return { ok: false, reason: "inactive" };
        let outcome = { ok: false, reason: "transaction_aborted" };
        const transaction = await dbModule.runTransaction(pathRef("state"), current => {
          outcome = renewChorusAuthority(current, { uid, authorityEpoch: epoch, now: now() });
          return outcome.ok ? outcome.encounter : undefined;
        });
        if (!transaction.committed) return outcome;
        latestState = normalizeChorusEncounter(transaction.snapshot.val());
        return { ok: true, encounter: latestState };
      });
    },

    async publishState(value) {
      const incoming = normalizeChorusEncounter(value);
      if (!active() || !incoming || !isAuthority(latestState)
        || incoming.authorityUid !== uid
        || incoming.authorityEpoch !== latestState.authorityEpoch
        || incoming.encounterId !== latestState.encounterId) {
        return { ok: false, reason: "not_authority" };
      }
      return enqueueStateMutation(async () => {
        if (!active()) return { ok: false, reason: "inactive" };
        let outcome = { ok: false, reason: "authority_changed" };
        const transaction = await dbModule.runTransaction(pathRef("state"), currentValue => {
          const current = normalizeChorusEncounter(currentValue);
          if (!current || current.authorityUid !== uid
            || current.authorityEpoch !== incoming.authorityEpoch
            || current.encounterId !== incoming.encounterId) return undefined;
          const olderRevision = incoming.combatRevision < current.combatRevision;
          const conflictingSameRevision = incoming.combatRevision === current.combatRevision
            && !sameCombatState(incoming, current);
          if (olderRevision || conflictingSameRevision
            || !containsAll(incoming.stabilizedAnchorIds, current.stabilizedAnchorIds)
            || !containsAll(incoming.resolvedTestimonyIds, current.resolvedTestimonyIds)
            || !containsAll(incoming.severedBondIds, current.severedBondIds)) {
            outcome = { ok: false, reason: "stale_state" };
            return undefined;
          }
          outcome = { ok: true };
          return withoutUndefined({
            ...incoming,
            leaseUntil: Math.max(current.leaseUntil, incoming.leaseUntil),
            updatedAt: incoming.combatRevision > current.combatRevision
              ? incoming.updatedAt
              : current.updatedAt,
            processedActionIds: mergeProcessedActionIds(current.processedActionIds, incoming.processedActionIds),
          });
        });
        if (!transaction.committed) return outcome;
        latestState = normalizeChorusEncounter(transaction.snapshot.val());
        return { ok: true, encounter: latestState };
      });
    },

    async sendAction(request) {
      if (!active() || !Number.isInteger(request?.sequence) || request.sequence < 1
        || !validKey(String(request.sequence), 24)) {
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
      return { ok: true, action };
    },

    async acknowledgeAction(requestUid, sequence) {
      if (!isAuthority() || !validKey(requestUid, 128)
        || !Number.isInteger(Number(sequence)) || Number(sequence) < 1) {
        return { ok: false, reason: "not_authority" };
      }
      await dbModule.remove(pathRef(`actions/${requestUid}/${Number(sequence)}`));
      return { ok: true };
    },

    async writeCompletionClaims(encounterId, claims) {
      if (!isAuthority() || latestState?.status !== "separated"
        || latestState.encounterId !== encounterId) {
        return { ok: false, reason: "not_authority", results: [] };
      }
      const results = await Promise.all(Object.entries(claims || {}).map(async ([claimUid, claim]) => {
        if (!validKey(claimUid, 128) || claim?.uid !== claimUid
          || claim?.encounterId !== encounterId || claim?.eligible !== true) {
          return { uid: claimUid, ok: false, reason: "invalid_claim" };
        }
        let outcome = { ok: false, reason: "transaction_aborted" };
        const transaction = await dbModule.runTransaction(pathRef(`completionClaims/${claimUid}`), current => {
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
      let outcome = { ok: false, reason: "claim_missing" };
      const transaction = await dbModule.runTransaction(pathRef(`completionClaims/${uid}`), current => {
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
