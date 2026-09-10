import { getWorldDefinition } from "./world-data-20260910-sanctuary.js";
import { getEnemyDefinition } from "./enemy-definitions-20260910-sanctuary.js";

export * from "./enemies-20260829-coast-20260905-upgrade.js";

export function createEnemies(mapId) {
  return getWorldDefinition(mapId).enemySpawns
    .map((spawn, index) => createEnemyInstance(
      spawn.kind,
      spawn,
      `${mapId}-enemy-${index + 1}`,
      { step: index * 1.7 },
    ))
    .filter(Boolean);
}

export function createEnemyInstance(kind, spawn, id, overrides = {}) {
  const type = getEnemyDefinition(kind);
  if (!type) return null;
  const hp = overrides.hp ?? type.hp;
  return {
    id,
    kind,
    name: overrides.name ?? type.name,
    level: overrides.level ?? type.level,
    x: spawn.x,
    y: spawn.y,
    prevX: spawn.x,
    prevY: spawn.y,
    homeX: spawn.x,
    homeY: spawn.y,
    hp,
    maxHp: overrides.maxHp ?? hp,
    speed: type.speed,
    contactDamage: type.damage,
    radius: type.radius,
    color: type.color,
    accent: type.accent,
    behavior: type.behavior,
    behaviorState: "idle",
    behaviorTime: 0,
    cooldownRemaining: 0,
    attackSequence: 0,
    attackApplied: false,
    lastDamagedAgo: Number.POSITIVE_INFINITY,
    infoVisibleRemaining: 0,
    generation: overrides.generation ?? type.generation ?? 0,
    targetable: overrides.targetable ?? true,
    contactMode: type.contactMode,
    contactCooldownDuration: type.contactCooldown ?? 1,
    state: "idle",
    moving: false,
    step: overrides.step ?? 0,
    hitFlash: 0,
    shake: 0,
    deathTime: 0,
    opacity: 1,
    scale: overrides.scale ?? 1,
    knockbackX: 0,
    knockbackY: 0,
    contactCooldown: 0,
    hitStunRemaining: 0,
    ...(overrides.isCoopBoss ? { isCoopBoss: true } : {}),
  };
}
