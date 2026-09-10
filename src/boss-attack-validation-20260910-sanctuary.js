import { getClassDefinition } from "./class-data-20260905-upgrade.js";
import { normalizeSkillResource, isBossInSkillGeometry } from "./skill-validation-20260905-upgrade.js";
import { statsForLevel } from "./player-progression-20260905-upgrade.js";
import { attackDefinition } from "./combat-20260903-volcano-20260905-upgrade.js";
import { getWeaponDefinition } from "./weapon-data-20260903-volcano-20260905-upgrade.js";

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizedEncounter(value, definition) {
  if (!value || typeof value !== "object" || !definition) return null;
  if (value.bossId !== definition.id || value.mapId !== definition.mapId || typeof value.encounterId !== "string") {
    return null;
  }
  const maxHp = Math.max(1, finite(value.maxHp, definition.baseHp));
  return {
    ...value,
    status: ["alive", "defeated", "respawning"].includes(value.status) ? value.status : "alive",
    x: finite(value.x, definition.x),
    y: finite(value.y, definition.y),
    hp: Math.max(0, Math.min(maxHp, finite(value.hp, maxHp))),
    maxHp,
  };
}

export function validatePlayerBossAttack(request, validation = {}) {
  const definition = validation.bossDefinition;
  const encounter = normalizedEncounter(validation.encounter, definition);
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
  if (!["basic", "strong", "skill-e", "skill-r"].includes(request.attackKind)) return { ok: false, reason: "invalid_attack_kind" };
  const level = player.level === undefined ? 1 : player.level;
  if (!Number.isInteger(level) || level < 1 || level > 10000) return { ok: false, reason: "invalid_level" };
  const attack = attackDefinition(request.attackKind, request.classId, request.weaponId, level);
  const isSkill = request.attackKind === "skill-e" || request.attackKind === "skill-r";
  let castState;
  if (isSkill) {
    if (level < attack.requiredLevel) return { ok: false, reason: "level_locked" };
    if (typeof request.castId !== "string" || !request.castId || request.castId.length > 120 || !Number.isInteger(request.hitIndex) || request.hitIndex < 0 || request.hitIndex >= attack.hitCount) return { ok: false, reason: "invalid_skill_hit" };
    const previous = validation.lastCast;
    const sameCast = previous?.id === request.castId;
    if (sameCast && previous.hits.includes(request.hitIndex)) return { ok: false, reason: "duplicate_skill_hit" };
    if (sameCast && (previous.classId !== request.classId || previous.weaponId !== request.weaponId || previous.level !== level)) return { ok: false, reason: "invalid_skill_cast" };
    const resource = normalizeSkillResource(player.skillResources?.[request.attackKind], statsForLevel(level, player.classId).maxMp);
    if (!resource || resource.castId !== request.castId || resource.direction !== request.direction
      || Math.abs(resource.mpBefore - resource.mpAfter - attack.mpCost) > 1e-6) return { ok: false, reason: "invalid_skill_resource" };
    const now = finite(validation.now, Date.now());
    if (resource.createdAt > now + 1000 || now - resource.createdAt > 6000) return { ok: false, reason: "stale_skill_cast" };
    const movementAllowance = 96 + getClassDefinition(player.classId).stats.moveSpeed * Math.max(0, now - resource.createdAt) / 1000;
    if (Math.hypot(resource.originX - player.x, resource.originY - player.y) > movementAllowance) return { ok: false, reason: "invalid_skill_origin" };
    if (sameCast && JSON.stringify(previous.resource) !== JSON.stringify(resource)) return { ok: false, reason: "invalid_skill_cast" };
    if (!isBossInSkillGeometry(resource, attack, request.hitIndex, encounter, definition)) return { ok: false, reason: "out_of_skill_geometry" };

    if (!sameCast && previous && now - previous.startedAt < attack.cooldown * 1000) return { ok: false, reason: "cooldown" };
    if (sameCast && now - previous.startedAt > (attack.duration + 5) * 1000) return { ok: false, reason: "stale_skill_cast" };
    castState = sameCast ? { ...previous, hits: [...previous.hits, request.hitIndex] } : { id: request.castId, classId: request.classId, weaponId: request.weaponId, level, resource, startedAt: now, hits: [request.hitIndex] };
  }
  const receivedAt = finite(validation.now, Date.now());
  const requestedAt = finite(request.createdAt, Number.NEGATIVE_INFINITY);
  if (requestedAt < receivedAt - 5_000 || requestedAt > receivedAt + 5_000) {
    return { ok: false, reason: "stale_attack" };
  }
  const attackAt = receivedAt;
  if (!isSkill && attackAt - finite(validation.lastAttackAt, Number.NEGATIVE_INFINITY) < attack.cooldown * 1000) {
    return { ok: false, reason: "cooldown" };
  }
  const distance = Math.hypot(request.playerX - encounter.x, request.playerY - encounter.y);
  if (!isSkill && distance > attack.range + 64) return { ok: false, reason: "out_of_range" };
  return {
    ok: true,
    uid: request.uid,
    sequence: request.sequence,
    attackAt,
    damage: attack.damage,
    castState,
    slowDuration: attack.slowDuration,
    slowMultiplier: attack.slowMultiplier,
    cooldown: attack.cooldown,
    range: attack.range,
  };
}
