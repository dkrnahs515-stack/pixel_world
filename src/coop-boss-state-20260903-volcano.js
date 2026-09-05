import { attackDefinition } from "./combat-20260903-volcano.js";
import { getWeaponDefinition } from "./weapon-data-20260903-volcano.js";
import {
  AUTHORITY_LEASE_MS, REWARD_RETENTION_MS, bossRespawnAt,
  getCoopBossForMap, scaledBossMaxHp,
} from "./coop-boss-data-20260903-volcano.js";

const DIRECTIONS = new Set(["up", "down", "left", "right"]);
const STATUSES = new Set(["alive", "defeated", "respawning"]);

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function rounded(value) {
  return Math.round(value * 10) / 10;
}

export function createBossEncounter(definition, {
  encounterId, partySize = 1, now = Date.now(), authorityUid, authorityEpoch = 1,
} = {}) {
  if (!definition || !getCoopBossForMap(definition.mapId) || typeof authorityUid !== "string" || !authorityUid) return null;
  const normalizedPartySize = Math.max(1, Math.min(10, Math.trunc(Number(partySize) || 1)));
  const maxHp = scaledBossMaxHp(definition.baseHp, normalizedPartySize);
  return {
    encounterId: String(encounterId || `${definition.mapId}-${now}`),
    bossId: definition.id,
    mapId: definition.mapId,
    status: "alive",
    x: definition.x,
    y: definition.y,
    dir: "down",
    moving: false,
    hp: maxHp,
    maxHp,
    phase: 1,
    targetUid: null,
    authorityUid,
    authorityEpoch: Math.max(1, Math.trunc(authorityEpoch || 1)),
    leaseUntil: now + AUTHORITY_LEASE_MS,
    partySize: normalizedPartySize,
    spawnedAt: now,
    defeatedAt: null,
    respawnAt: null,
    contributors: {},
    updatedAt: now,
  };
}

export function normalizeBossEncounter(value) {
  if (!value || typeof value !== "object") return null;
  const definition = getCoopBossForMap(value.mapId);
  if (!definition || value.bossId !== definition.id || typeof value.encounterId !== "string") return null;
  const maxHp = Math.max(1, finite(value.maxHp, definition.baseHp));
  const status = STATUSES.has(value.status) ? value.status : "alive";
  return {
    ...value,
    status,
    x: finite(value.x, definition.x),
    y: finite(value.y, definition.y),
    dir: DIRECTIONS.has(value.dir) ? value.dir : "down",
    moving: Boolean(value.moving),
    hp: rounded(Math.max(0, Math.min(maxHp, finite(value.hp, maxHp)))),
    maxHp: rounded(maxHp),
    phase: Math.max(1, Math.trunc(finite(value.phase, 1))),
    authorityEpoch: Math.max(1, Math.trunc(finite(value.authorityEpoch, 1))),
    leaseUntil: finite(value.leaseUntil),
    partySize: Math.max(1, Math.min(10, Math.trunc(finite(value.partySize, 1)))),
    contributors: value.contributors && typeof value.contributors === "object" ? { ...value.contributors } : {},
  };
}

export function acquireAuthority(value, { uid, now = Date.now() } = {}) {
  const encounter = normalizeBossEncounter(value);
  if (!encounter || typeof uid !== "string" || !uid) return { ok: false, reason: "invalid_authority" };
  if (encounter.authorityUid !== uid && encounter.leaseUntil > now) return { ok: false, reason: "lease_active" };
  const changedOwner = encounter.authorityUid !== uid;
  return {
    ok: true,
    encounter: {
      ...encounter,
      authorityUid: uid,
      authorityEpoch: changedOwner ? encounter.authorityEpoch + 1 : encounter.authorityEpoch,
      leaseUntil: now + AUTHORITY_LEASE_MS,
      updatedAt: now,
    },
  };
}

export function renewAuthority(value, { uid, authorityEpoch, now = Date.now() } = {}) {
  const encounter = normalizeBossEncounter(value);
  if (!encounter || encounter.authorityUid !== uid || encounter.authorityEpoch !== authorityEpoch) {
    return { ok: false, reason: "authority_mismatch" };
  }
  return { ok: true, encounter: { ...encounter, leaseUntil: now + AUTHORITY_LEASE_MS, updatedAt: now } };
}

export function validateBossAttack(request, validation = {}) {
  const encounter = normalizeBossEncounter(validation.encounter);
  const definition = validation.bossDefinition;
  if (!encounter || encounter.status !== "alive" || !definition
    || request?.encounterId !== encounter.encounterId || request?.bossId !== encounter.bossId
    || request?.mapId !== encounter.mapId || definition.id !== encounter.bossId) {
    return { ok: false, reason: "encounter_mismatch" };
  }
  if (request.uid !== validation.authenticatedUid) return { ok: false, reason: "uid_mismatch" };
  const player = validation.player;
  if (!player || player.uid !== request.uid || player.mapId !== encounter.mapId
    || !Number.isFinite(player.x) || !Number.isFinite(player.y)
    || !Number.isFinite(request.playerX) || !Number.isFinite(request.playerY)) {
    return { ok: false, reason: "invalid_player" };
  }
  if (Math.hypot(request.playerX - player.x, request.playerY - player.y) > 96) return { ok: false, reason: "invalid_player_position" };
  if (!Number.isInteger(request.sequence) || request.sequence <= finite(validation.lastSequence, 0)) {
    return { ok: false, reason: "duplicate_sequence" };
  }
  if (request.classId !== player.classId) return { ok: false, reason: "invalid_class" };
  const weapon = getWeaponDefinition(request.weaponId);
  if (!weapon || weapon.classId !== request.classId || request.weaponId !== player.equippedWeaponId) {
    return { ok: false, reason: "invalid_weapon" };
  }
  if (request.attackKind !== "basic" && request.attackKind !== "strong") return { ok: false, reason: "invalid_attack_kind" };
  const attack = attackDefinition(request.attackKind, request.classId, request.weaponId);
  const receivedAt = finite(validation.now, Date.now());
  const requestedAt = finite(request.createdAt, Number.NEGATIVE_INFINITY);
  if (requestedAt < receivedAt - 5_000 || requestedAt > receivedAt + 5_000) {
    return { ok: false, reason: "stale_attack" };
  }
  const attackAt = receivedAt;
  if (attackAt - finite(validation.lastAttackAt, Number.NEGATIVE_INFINITY) < attack.cooldown * 1000) {
    return { ok: false, reason: "cooldown" };
  }
  const distance = Math.hypot(request.playerX - encounter.x, request.playerY - encounter.y);
  if (distance > attack.range + 64) return { ok: false, reason: "out_of_range" };
  return {
    ok: true,
    uid: request.uid,
    sequence: request.sequence,
    attackAt,
    damage: attack.damage,
    cooldown: attack.cooldown,
    range: attack.range,
  };
}

export function applyBossAttack(value, validated, now = Date.now()) {
  const encounter = normalizeBossEncounter(value);
  if (!encounter || encounter.status !== "alive" || !validated?.ok || !(validated.damage > 0)) {
    return { encounter: encounter || value, applied: false, defeated: false };
  }
  const hp = rounded(Math.max(0, encounter.hp - validated.damage));
  const previous = encounter.contributors[validated.uid];
  const contributors = {
    ...encounter.contributors,
    [validated.uid]: {
      firstHitAt: previous?.firstHitAt ?? now,
      lastHitAt: now,
    },
  };
  const defeated = encounter.hp > 0 && hp === 0;
  return {
    applied: true,
    defeated,
    encounter: {
      ...encounter,
      hp,
      contributors,
      status: defeated ? "defeated" : encounter.status,
      defeatedAt: defeated ? now : encounter.defeatedAt,
      respawnAt: defeated ? bossRespawnAt(now) : encounter.respawnAt,
      moving: defeated ? false : encounter.moving,
      updatedAt: now,
    },
  };
}

export function createRewardClaims(defeatedEncounter, now = Date.now()) {
  const encounter = normalizeBossEncounter(defeatedEncounter);
  if (!encounter || encounter.status !== "defeated") return {};
  const definition = getCoopBossForMap(encounter.mapId);
  const defeatedAt = finite(encounter.defeatedAt, now);
  return Object.fromEntries(Object.keys(encounter.contributors).sort().map(uid => [uid, {
    encounterId: encounter.encounterId,
    bossId: encounter.bossId,
    uid,
    exp: definition.rewardExp,
    gold: definition.rewardGold,
    eligible: true,
    claimedAt: null,
    expiresAt: defeatedAt + REWARD_RETENTION_MS,
  }]));
}

export function claimReward(claim, now = Date.now()) {
  if (!claim || claim.eligible !== true) return { ok: false, reason: "ineligible" };
  if (claim.claimedAt != null) return { ok: false, reason: "already_claimed" };
  if (!Number.isFinite(claim.expiresAt) || now > claim.expiresAt) return { ok: false, reason: "expired" };
  return { ok: true, claim: { ...claim, claimedAt: now } };
}

export function createBossPlayerDamageEvent({ encounter: value, targetUid, damage, sequence, now = Date.now() }) {
  const encounter = normalizeBossEncounter(value);
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
  const encounter = normalizeBossEncounter(value);
  if (!encounter || event?.encounterId !== encounter.encounterId || event?.bossId !== encounter.bossId) {
    return { ok: false, reason: "encounter_mismatch" };
  }
  if (event.authorityEpoch !== encounter.authorityEpoch) return { ok: false, reason: "authority_mismatch" };
  if (event.targetUid !== targetUid) return { ok: false, reason: "target_mismatch" };
  if (!(event.damage > 0) || event.damage > 50) return { ok: false, reason: "invalid_damage" };
  if (!Number.isFinite(event.createdAt) || event.createdAt > now + 5_000) return { ok: false, reason: "invalid_time" };
  return { ok: true, event: { ...event } };
}
