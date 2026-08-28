import { normalizeClassId } from "./class-data.js";
import { attackDefinition, directionVector } from "./combat.js";
import { resolveWeaponDefinition } from "./weapon-data.js";

const EPSILON = 1e-7;
const BLOCK_SAMPLE_DISTANCE = 4;

function projectileAttackKind(kind) {
  return kind === "piercing-arrow" || kind === "explosive-bolt" ? "strong" : "basic";
}

function isLiveTarget(enemy) {
  return enemy
    && typeof enemy.id === "string"
    && Number.isFinite(enemy.x)
    && Number.isFinite(enemy.y)
    && Number.isFinite(enemy.hp)
    && enemy.hp > 0
    && enemy.targetable !== false;
}

function segmentCircleIntersection(startX, startY, endX, endY, target) {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  const radius = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
  const offsetX = startX - target.x;
  const offsetY = startY - target.y;
  if (offsetX * offsetX + offsetY * offsetY <= radius * radius) return 0;
  if (lengthSquared <= EPSILON) return null;

  const b = 2 * (offsetX * dx + offsetY * dy);
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  const discriminant = b * b - 4 * lengthSquared * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * lengthSquared);
  const second = (-b + root) / (2 * lengthSquared);
  if (first >= 0 && first <= 1) return first;
  if (second >= 0 && second <= 1) return second;
  return null;
}

function boundsDistance(projectile, distance, worldBounds) {
  if (!worldBounds) return distance;
  const minX = Number.isFinite(worldBounds.x) ? worldBounds.x : 0;
  const minY = Number.isFinite(worldBounds.y) ? worldBounds.y : 0;
  const maxX = minX + Math.max(0, Number(worldBounds.width) || 0);
  const maxY = minY + Math.max(0, Number(worldBounds.height) || 0);
  let allowed = distance;
  if (projectile.directionX > 0) allowed = Math.min(allowed, (maxX - projectile.x) / projectile.directionX);
  if (projectile.directionX < 0) allowed = Math.min(allowed, (minX - projectile.x) / projectile.directionX);
  if (projectile.directionY > 0) allowed = Math.min(allowed, (maxY - projectile.y) / projectile.directionY);
  if (projectile.directionY < 0) allowed = Math.min(allowed, (minY - projectile.y) / projectile.directionY);
  return Math.max(0, allowed);
}

function blockedDistance(projectile, distance, isBlocked) {
  if (typeof isBlocked !== "function" || distance <= 0) return distance;
  const steps = Math.max(1, Math.ceil(distance / BLOCK_SAMPLE_DISTANCE));
  for (let step = 1; step <= steps; step += 1) {
    const travelled = distance * step / steps;
    const x = projectile.x + projectile.directionX * travelled;
    const y = projectile.y + projectile.directionY * travelled;
    if (isBlocked(x, y, 4)) return travelled;
  }
  return distance;
}

function hitEvent(projectile, target) {
  return {
    projectileId: projectile.id,
    enemyId: target.id,
    targetType: target.isCoopBoss ? "coop-boss" : "enemy",
    kind: projectile.kind,
    classId: projectile.classId,
    weaponId: projectile.weaponId,
    attackKind: projectileAttackKind(projectile.kind),
    direction: projectile.direction,
    damage: projectile.damage,
    knockback: projectile.knockback,
    directionX: projectile.directionX,
    directionY: projectile.directionY,
    hitStun: projectile.hitStun,
    hitStop: projectile.hitStop,
  };
}

function explosionResult(projectile, x, y, enemies) {
  const hits = [];
  const alreadyHit = new Set(projectile.hitEnemyIds);
  for (const enemy of enemies) {
    if (!isLiveTarget(enemy) || alreadyHit.has(enemy.id)) continue;
    const radius = Number.isFinite(enemy.radius) ? Math.max(0, enemy.radius) : 0;
    if (Math.hypot(enemy.x - x, enemy.y - y) > projectile.explosionRadius + radius) continue;
    alreadyHit.add(enemy.id);
    hits.push(hitEvent(projectile, enemy));
  }
  return {
    hits,
    explosion: {
      projectileId: projectile.id,
      x,
      y,
      radius: projectile.explosionRadius,
    },
  };
}

function isValidProjectile(projectile) {
  if (!projectile || typeof projectile.id !== "string" || projectile.id.length === 0) return false;
  for (const value of [
    projectile.prevX,
    projectile.prevY,
    projectile.x,
    projectile.y,
    projectile.directionX,
    projectile.directionY,
    projectile.speed,
    projectile.maxRange,
    projectile.distanceTravelled,
    projectile.damage,
    projectile.maxHits,
    projectile.explosionRadius,
  ]) {
    if (!Number.isFinite(value)) return false;
  }
  if (projectile.directionX === 0 && projectile.directionY === 0) return false;
  if (projectile.speed <= 0 || projectile.maxRange <= 0) return false;
  if (projectile.distanceTravelled < 0 || projectile.distanceTravelled > projectile.maxRange) return false;
  if (projectile.maxHits < 1 || projectile.explosionRadius < 0) return false;
  return Array.isArray(projectile.hitEnemyIds);
}

export function createProjectile({ id, kind, classId, weaponId, x, y, direction }) {
  const normalizedClassId = normalizeClassId(classId);
  const weapon = resolveWeaponDefinition(weaponId, normalizedClassId);
  const definition = attackDefinition(projectileAttackKind(kind), normalizedClassId, weapon.id);
  if (definition.delivery !== "projectile") {
    throw new TypeError("projectile attacks require archer or mage class data");
  }
  const vector = directionVector(direction);
  return {
    id,
    kind: definition.projectileKind,
    classId: normalizedClassId,
    weaponId: weapon.id,
    prevX: x,
    prevY: y,
    x,
    y,
    directionX: vector.x,
    directionY: vector.y,
    direction,
    speed: definition.speed,
    maxRange: definition.range,
    distanceTravelled: 0,
    damage: definition.damage,
    maxHits: definition.maxHits ?? 1,
    explosionRadius: definition.explosionRadius ?? 0,
    knockback: definition.knockback,
    hitStun: definition.hitStun,
    hitStop: definition.hitStop,
    hitEnemyIds: [],
  };
}

export function updateProjectiles(projectiles, dt, options = {}) {
  const survivors = [];
  const hits = [];
  const explosions = [];
  const enemies = [
    ...(Array.isArray(options.enemies) ? options.enemies : []),
    ...(Array.isArray(options.bosses) ? options.bosses : []),
  ];
  const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;

  for (const source of projectiles) {
    if (!isValidProjectile(source)) continue;
    const projectile = {
      ...source,
      prevX: source.x,
      prevY: source.y,
      hitEnemyIds: [...(source.hitEnemyIds || [])],
    };
    const remainingRange = Math.max(0, projectile.maxRange - projectile.distanceTravelled);
    const requestedDistance = Math.min(projectile.speed * elapsed, remainingRange);
    const boundaryDistance = boundsDistance(projectile, requestedDistance, options.worldBounds);
    const obstacleDistance = blockedDistance(projectile, boundaryDistance, options.isBlocked);
    const travelDistance = Math.min(requestedDistance, boundaryDistance, obstacleDistance);
    const endX = projectile.x + projectile.directionX * travelDistance;
    const endY = projectile.y + projectile.directionY * travelDistance;
    const collisions = enemies
      .filter(isLiveTarget)
      .filter(enemy => !projectile.hitEnemyIds.includes(enemy.id))
      .map(enemy => ({ enemy, time: segmentCircleIntersection(projectile.x, projectile.y, endX, endY, enemy) }))
      .filter(collision => collision.time !== null)
      .sort((left, right) => left.time - right.time);
    const stoppedByWorld = boundaryDistance + EPSILON < requestedDistance
      || obstacleDistance + EPSILON < boundaryDistance;
    const reachedRange = requestedDistance + EPSILON >= remainingRange;

    if (projectile.kind === "explosive-bolt") {
      const first = collisions[0];
      const impactX = first
        ? projectile.x + (endX - projectile.x) * first.time
        : endX;
      const impactY = first
        ? projectile.y + (endY - projectile.y) * first.time
        : endY;
      if (first || stoppedByWorld || reachedRange) {
        const result = explosionResult(projectile, impactX, impactY, enemies);
        hits.push(...result.hits);
        explosions.push(result.explosion);
        continue;
      }
    } else if (projectile.kind === "piercing-arrow") {
      for (const collision of collisions) {
        projectile.hitEnemyIds.push(collision.enemy.id);
        hits.push(hitEvent(projectile, collision.enemy));
        if (projectile.hitEnemyIds.length >= projectile.maxHits) break;
      }
      if (projectile.hitEnemyIds.length >= projectile.maxHits || stoppedByWorld || reachedRange) continue;
    } else {
      const first = collisions[0];
      if (first) {
        hits.push(hitEvent(projectile, first.enemy));
        continue;
      }
      if (stoppedByWorld || reachedRange) continue;
    }

    projectile.x = endX;
    projectile.y = endY;
    projectile.distanceTravelled += travelDistance;
    survivors.push(projectile);
  }

  return { projectiles: survivors, hits, explosions };
}
