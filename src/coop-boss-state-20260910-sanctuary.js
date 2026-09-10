import * as legacy from "./coop-boss-state-20260903-volcano-20260905-upgrade.js";
import { validatePlayerBossAttack } from "./boss-attack-validation-20260910-sanctuary.js";
import {
  REWARD_RETENTION_MS,
  getCoopBossForMap,
} from "./coop-boss-data-20260910-sanctuary.js";
import {
  acquireOriginAuthority,
  applyOriginAttack,
  createOriginEncounter,
  normalizeOriginEncounter,
  renewOriginAuthority,
} from "./origin-boss-state-20260910-sanctuary.js";

export * from "./coop-boss-state-20260903-volcano-20260905-upgrade.js";
export { validatePlayerBossAttack };

function definitionFor(value) {
  return getCoopBossForMap(value?.mapId);
}

function isFinal(value) {
  return definitionFor(value)?.bossClass === "final";
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function rounded(value) {
  return Math.round(value * 10) / 10;
}

export function createBossEncounter(definition, options = {}) {
  return definition?.bossClass === "final"
    ? createOriginEncounter(definition, options)
    : legacy.createBossEncounter(definition, options);
}

export function normalizeBossEncounter(value) {
  return isFinal(value) ? normalizeOriginEncounter(value) : legacy.normalizeBossEncounter(value);
}

export function acquireAuthority(value, options = {}) {
  return isFinal(value) ? acquireOriginAuthority(value, options) : legacy.acquireAuthority(value, options);
}

export function renewAuthority(value, options = {}) {
  return isFinal(value) ? renewOriginAuthority(value, options) : legacy.renewAuthority(value, options);
}

export function validateBossAttack(request, validation = {}) {
  return validatePlayerBossAttack(request, validation);
}

export function applyBossAttack(value, validated, now = Date.now()) {
  return isFinal(value)
    ? applyOriginAttack(value, validated, now)
    : legacy.applyBossAttack(value, validated, now);
}

export function createRewardClaims(defeatedEncounter, now = Date.now()) {
  if (!isFinal(defeatedEncounter)) return legacy.createRewardClaims(defeatedEncounter, now);
  const encounter = normalizeOriginEncounter(defeatedEncounter);
  if (!encounter || encounter.status !== "defeated") return {};
  const defeatedAt = finite(encounter.defeatedAt, now);
  return Object.fromEntries(Object.keys(encounter.contributors || {}).sort().map(uid => [uid, {
    encounterId: encounter.encounterId,
    bossId: encounter.bossId,
    uid,
    exp: 0,
    gold: 0,
    eligible: true,
    claimedAt: null,
    expiresAt: defeatedAt + REWARD_RETENTION_MS,
  }]));
}

export function createBossPlayerDamageEvent({ encounter: value, targetUid, damage, sequence, now = Date.now() }) {
  if (!isFinal(value)) {
    return legacy.createBossPlayerDamageEvent({ encounter: value, targetUid, damage, sequence, now });
  }
  const encounter = normalizeOriginEncounter(value);
  if (!encounter || typeof targetUid !== "string" || !targetUid || !Number.isInteger(sequence) || sequence < 1) return null;
  const amount = rounded(Math.max(0, Math.min(50, finite(damage))));
  if (!(amount > 0)) return null;
  return {
    eventId: `${encounter.encounterId}:${encounter.authorityEpoch}:${sequence}`,
    encounterId: encounter.encounterId,
    bossId: encounter.bossId,
    targetUid,
    authorityEpoch: encounter.authorityEpoch,
    damage: amount,
    createdAt: now,
  };
}

export function validateBossPlayerDamageEvent(event, { encounter: value, targetUid, now = Date.now() } = {}) {
  if (!isFinal(value)) return legacy.validateBossPlayerDamageEvent(event, { encounter: value, targetUid, now });
  const encounter = normalizeOriginEncounter(value);
  if (!encounter || event?.encounterId !== encounter.encounterId || event?.bossId !== encounter.bossId) {
    return { ok: false, reason: "encounter_mismatch" };
  }
  if (event.authorityEpoch !== encounter.authorityEpoch) return { ok: false, reason: "authority_mismatch" };
  if (event.targetUid !== targetUid) return { ok: false, reason: "target_mismatch" };
  if (!(event.damage > 0) || event.damage > 50) return { ok: false, reason: "invalid_damage" };
  if (!Number.isFinite(event.createdAt) || event.createdAt > now + 5_000) return { ok: false, reason: "invalid_time" };
  return { ok: true, event: { ...event } };
}
