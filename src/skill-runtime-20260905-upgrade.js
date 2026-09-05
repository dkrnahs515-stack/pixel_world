import { attackDefinition, directionVector } from "./combat-20260903-volcano-20260905-upgrade.js";

export function tickManaRegen(player, dt) {
  if (!(player.hp > 0) || player.respawnTimer > 0) {
    player.manaRegenElapsed = 0;
    return;
  }
  player.manaRegenElapsed = (player.manaRegenElapsed || 0)
    + Math.max(0, Number.isFinite(dt) ? dt : 0);
  while (player.manaRegenElapsed + 1e-9 >= 2) {
    player.manaRegenElapsed = Math.max(0, player.manaRegenElapsed - 2);
    player.mp = Math.min(player.maxMp, player.mp + Math.max(1, player.maxMp * 0.02));
  }
}

export function skillAvailability(definition, player, cooldown = 0) {
  if ((player.level || 1) < definition.requiredLevel) return "level";
  if (cooldown > 0) return "cooldown";
  if (player.mp < definition.mpCost) return "mana";
  return null;
}

export function createSkillCast(kind, classId, weaponId, level, player, id) {
  const definition = attackDefinition(kind, classId, weaponId, level);
  const vector = directionVector(player.dir);
  return {
    id, kind, classId, weaponId, level, definition,
    elapsed: 0, nextHit: 0, direction: player.dir,
    x: player.x + vector.x * (definition.targetDistance || 0),
    y: player.y + vector.y * (definition.targetDistance || 0),
  };
}

export function advanceSkillCast(cast, dt) {
  cast.elapsed += dt;
  const hits = [];
  while (cast.nextHit < cast.definition.hitCount
    && cast.elapsed + 1e-9 >= cast.definition.windup + cast.nextHit * cast.definition.interval) {
    const hitIndex = cast.nextHit++;
    hits.push({ id: `${cast.id}:${hitIndex}`, castId: cast.id, hitIndex, cast });
  }
  return hits;
}


export function finalizeSkillResource(player, cast, now = Date.now()) {
  const resource = {
    castId: cast.id, mpBefore: player.mp + cast.definition.mpCost, mpAfter: player.mp,
    originX: cast.player.x, originY: cast.player.y, direction: cast.direction, createdAt: now,
  };
  player.skillResources ||= {};
  player.skillResources[cast.kind] = resource;
  cast.player.mp = player.mp;
  cast.player.skillResources = { ...player.skillResources };
  return resource;
}
