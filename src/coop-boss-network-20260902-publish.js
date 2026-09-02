import { getCoopBossForMap } from "./coop-boss-data-20260829-coast.js";
import {
  acquireAuthority, claimReward as claimRewardState, createBossEncounter,
  renewAuthority as renewAuthorityState,
} from "./coop-boss-state-20260829-coast.js";

const IMMUTABLE_REWARD_CLAIM_FIELDS = [
  "encounterId", "bossId", "uid", "exp", "gold", "eligible", "expiresAt",
];

function matchesImmutableRewardClaim(current, intended) {
  return current && intended && IMMUTABLE_REWARD_CLAIM_FIELDS
    .every(field => current[field] === intended[field]);
}

function withoutUndefined(value) {
  if (Array.isArray(value)) {
    return value.filter(entry => entry !== undefined).map(withoutUndefined);
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => [key, withoutUndefined(entry)]));
}

export function createCoopBossNetwork({
  dbModule, db, roomId, uid,
  onBossChanged = () => {},
  onAttackRequestsChanged = () => {},
  onPlayerDamageChanged = () => {},
  onRewardClaimsChanged = () => {},
  now = () => Date.now(),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = handle => clearTimeout(handle),
}) {
  let mapId = "village";
  let stopped = false;
  let unsubscribers = [];
  let renewalTimer = null;
  let authorityEpoch = null;

  const basePath = () => `rooms/${roomId}/bosses/${mapId}`;
  const pathRef = suffix => dbModule.ref(db, `${basePath()}/${suffix}`);

  const clearRenewal = () => {
    if (renewalTimer !== null) clearTimer(renewalTimer);
    renewalTimer = null;
    authorityEpoch = null;
  };

  const clearListeners = () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    clearRenewal();
  };

  const listen = (suffix, callback) => {
    const unsubscribe = dbModule.onValue(pathRef(suffix), snapshot => callback(snapshot.val() ?? null));
    unsubscribers.push(unsubscribe);
  };

  const scheduleRenewal = epoch => {
    clearRenewal();
    authorityEpoch = epoch;
    const tick = async () => {
      if (stopped || authorityEpoch !== epoch) return;
      const result = await api.renewAuthority(epoch);
      if (!result.ok || stopped) {
        clearRenewal();
        return;
      }
      renewalTimer = setTimer(tick, 2_000);
    };
    renewalTimer = setTimer(tick, 2_000);
  };

  const api = {
    get mapId() { return mapId; },

    async setMap(nextMapId) {
      clearListeners();
      mapId = getCoopBossForMap(nextMapId) ? nextMapId : "village";
      if (mapId === "village" || stopped) {
        onBossChanged(null);
        onAttackRequestsChanged({});
        onPlayerDamageChanged({});
        onRewardClaimsChanged({});
        return false;
      }
      listen("state", onBossChanged);
      listen("attacks", value => onAttackRequestsChanged(value || {}));
      listen(`playerDamage/${uid}`, value => onPlayerDamageChanged(value || {}));
      listen("rewardClaims", value => onRewardClaimsChanged(value || {}));
      return true;
    },

    async ensureEncounter({ partySize = 1, reconciledEncounterId = null } = {}) {
      const definition = getCoopBossForMap(mapId);
      if (!definition || partySize < 1) return null;
      const stateRef = pathRef("state");
      const timestamp = now();
      const transaction = await dbModule.runTransaction(stateRef, current => {
        const respawnDue = current?.status !== "alive" && Number(current?.respawnAt) <= timestamp;
        if (current && !respawnDue) return undefined;
        if (current && current.authorityUid !== uid) return undefined;
        if (current?.status === "defeated" && current.encounterId !== reconciledEncounterId) return undefined;
        return createBossEncounter(definition, {
          encounterId: `${mapId}-${timestamp}-${uid.slice(0, 8)}`,
          partySize,
          now: timestamp,
          authorityUid: uid,
          authorityEpoch: current?.authorityEpoch || 1,
        });
      });
      const encounter = transaction.committed ? transaction.snapshot.val() : null;
      if (encounter?.authorityUid === uid) scheduleRenewal(encounter.authorityEpoch);
      return encounter;
    },

    async tryAcquireAuthority() {
      if (!getCoopBossForMap(mapId)) return { ok: false, reason: "no_boss" };
      let outcome = { ok: false, reason: "transaction_aborted" };
      const transaction = await dbModule.runTransaction(pathRef("state"), current => {
        outcome = acquireAuthority(current, { uid, now: now() });
        return outcome.ok ? outcome.encounter : undefined;
      });
      if (!transaction.committed) return outcome;
      const encounter = transaction.snapshot.val();
      scheduleRenewal(encounter.authorityEpoch);
      return { ok: true, encounter };
    },

    async renewAuthority(epoch = authorityEpoch) {
      let outcome = { ok: false, reason: "transaction_aborted" };
      const transaction = await dbModule.runTransaction(pathRef("state"), current => {
        outcome = renewAuthorityState(current, { uid, authorityEpoch: epoch, now: now() });
        return outcome.ok ? outcome.encounter : undefined;
      });
      return transaction.committed ? { ok: true, encounter: transaction.snapshot.val() } : outcome;
    },

    async publishState(snapshot) {
      if (!snapshot || snapshot.authorityUid !== uid) return { ok: false, reason: "not_authority" };
      await dbModule.update(pathRef("state"), withoutUndefined(snapshot));
      return { ok: true };
    },

    async sendAttack(request) {
      if (!getCoopBossForMap(mapId) || !Number.isInteger(request?.sequence) || request.sequence < 1) {
        return { ok: false, reason: "invalid_attack" };
      }
      await dbModule.set(pathRef(`attacks/${uid}/${request.sequence}`), { ...request, uid, mapId });
      return { ok: true };
    },

    async acknowledgeAttack(requestUid, sequence) {
      await dbModule.remove(pathRef(`attacks/${requestUid}/${sequence}`));
    },

    async sendPlayerDamage(targetUid, event) {
      await dbModule.set(pathRef(`playerDamage/${targetUid}/${event.eventId}`), event);
    },

    async acknowledgePlayerDamage(eventId) {
      await dbModule.remove(pathRef(`playerDamage/${uid}/${eventId}`));
    },

    async writeRewardClaims(encounterId, claims) {
      const results = await Promise.all(Object.entries(claims || {}).map(async ([claimUid, claim]) => {
        let outcome = { ok: false, reason: "transaction_aborted" };
        try {
          const transaction = await dbModule.runTransaction(
            pathRef(`rewardClaims/${encounterId}/${claimUid}`),
            current => {
              if (current != null) {
                outcome = matchesImmutableRewardClaim(current, claim)
                  ? { ok: true, reason: "already_exists" }
                  : { ok: false, reason: "claim_conflict" };
                return undefined;
              }
              outcome = { ok: true, reason: "created" };
              return claim;
            },
          );
          return { uid: claimUid, ...outcome, transaction };
        } catch (error) {
          return { uid: claimUid, ok: false, error };
        }
      }));
      return {
        ok: results.every(result => result.ok),
        failedUids: results.filter(result => !result.ok).map(result => result.uid),
        results,
      };
    },

    async claimReward(encounterId, claim) {
      let outcome = { ok: false, reason: "transaction_aborted" };
      const transaction = await dbModule.runTransaction(
        pathRef(`rewardClaims/${encounterId}/${uid}`),
        current => {
          outcome = claimRewardState(current || claim, now());
          return outcome.ok ? outcome.claim : undefined;
        },
      );
      return transaction.committed ? { ok: true, claim: transaction.snapshot.val() } : outcome;
    },

    async expireRewardClaim(encounterId) {
      await dbModule.remove(pathRef(`rewardClaims/${encounterId}/${uid}`));
    },

    async cleanupExpired() {
      if (!getCoopBossForMap(mapId) || typeof dbModule.get !== "function") return { ok: true, removed: 0 };
      const timestamp = now();
      const [claimsSnapshot, attacksSnapshot, damageSnapshot] = await Promise.all([
        dbModule.get(pathRef("rewardClaims")),
        dbModule.get(pathRef("attacks")),
        dbModule.get(pathRef("playerDamage")),
      ]);
      const removals = [];
      for (const [encounterId, claims] of Object.entries(claimsSnapshot.val() || {})) {
        for (const [claimUid, claim] of Object.entries(claims || {})) {
          if (Number(claim?.expiresAt) <= timestamp) {
            removals.push(dbModule.remove(pathRef(`rewardClaims/${encounterId}/${claimUid}`)));
          }
        }
      }
      const staleBefore = timestamp - 10_000;
      for (const [requestUid, requests] of Object.entries(attacksSnapshot.val() || {})) {
        for (const [sequence, request] of Object.entries(requests || {})) {
          if (Number(request?.createdAt) <= staleBefore) {
            removals.push(dbModule.remove(pathRef(`attacks/${requestUid}/${sequence}`)));
          }
        }
      }
      for (const [targetUid, events] of Object.entries(damageSnapshot.val() || {})) {
        for (const [eventId, event] of Object.entries(events || {})) {
          if (Number(event?.createdAt) <= staleBefore) {
            removals.push(dbModule.remove(pathRef(`playerDamage/${targetUid}/${eventId}`)));
          }
        }
      }
      await Promise.all(removals);
      return { ok: true, removed: removals.length };
    },

    async stop() {
      if (stopped) return;
      stopped = true;
      clearListeners();
    },
  };

  return api;
}
