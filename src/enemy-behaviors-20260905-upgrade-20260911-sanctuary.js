const PLAYER_RADIUS = 14;
const TIME_EPSILON = 1e-9;

const FANG_CHARGE = Object.freeze({
  triggerRange: 320,
  telegraphDuration: 0.55,
  attackDuration: 0.45,
  attackSpeed: 420,
  cooldownDuration: 2.4,
});

const PIRATE_BITE = Object.freeze({
  triggerRange: 62,
  telegraphDuration: 0.35,
  attackDuration: 0.18,
  lungeDistance: 34,
  arcDegrees: 120,
  cooldownDuration: 1.8,
});

const FLAME_TELEPORT = Object.freeze({
  vanish: 0.4,
  reappear: 0.25,
  cooldown: 3,
  minRadius: 110,
  maxRadius: 180,
  attempts: 8,
  portalSafety: 180,
  playerSafety: 80,
  triggerRange: 360,
});

const BURROW_CHARGE = Object.freeze({
  triggerRange: 330,
  telegraphDuration: 0.7,
  attackDuration: 0.5,
  attackSpeed: 440,
  cooldownDuration: 3.4,
});

const TROLL_REGEN = Object.freeze({
  revealDistance: 280,
  delay: 3,
  hpPerSecond: 4,
  hiddenOpacity: 0.25,
});

const SPORE_SLOW = Object.freeze({
  triggerRange: 240,
  telegraphDuration: 0.6,
  radius: 120,
  multiplier: 0.65,
  duration: 2.5,
  cooldownDuration: 4,
});

export function updateEnemyBehavior(enemy, player, dt, context) {
  if (enemy.behavior === "fang-charge") return updateFangCharge(enemy, player, dt, context);
  if (enemy.behavior === "pirate-bite") return updatePirateBite(enemy, player, dt, context);
  if (enemy.behavior === "flame-teleport") return updateFlameTeleport(enemy, player, dt, context);
  if (enemy.behavior === "burrow-charge") return updateBurrowCharge(enemy, player, dt, context);
  if (enemy.behavior === "camouflage-regeneration") return updateMossTroll(enemy, player, dt, context);
  if (enemy.behavior === "spore-slow") return updateSporeSlow(enemy, player, dt);
  return { handled: false, events: [] };
}

function updateFlameTeleport(enemy, player, dt, context) {
  let remaining = positiveFiniteDuration(dt);
  let handled = enemy.behaviorState === "vanish" || enemy.behaviorState === "reappear";

  while (remaining > TIME_EPSILON) {
    if (enemy.behaviorState === "idle") {
      if (distanceTo(enemy, player) > FLAME_TELEPORT.triggerRange) return { handled: false, events: [] };
      handled = true;
      enemy.behaviorState = "vanish";
      enemy.behaviorTime = 0;
      enemy.targetable = false;
      enemy.moving = false;
      continue;
    }

    if (enemy.behaviorState === "vanish") {
      const time = Math.min(remaining, Math.max(0, FLAME_TELEPORT.vanish - enemy.behaviorTime));
      enemy.behaviorTime += time;
      remaining -= time;
      if (enemy.behaviorTime + TIME_EPSILON < FLAME_TELEPORT.vanish) break;
      if (context.suppressMovement) {
        enemy.behaviorTime = FLAME_TELEPORT.vanish;
        break;
      }
      moveFlameTeleport(enemy, player, context);
      enemy.behaviorState = "reappear";
      enemy.behaviorTime = 0;
      continue;
    }

    if (enemy.behaviorState === "reappear") {
      const time = Math.min(remaining, Math.max(0, FLAME_TELEPORT.reappear - enemy.behaviorTime));
      enemy.behaviorTime += time;
      remaining -= time;
      if (enemy.behaviorTime + TIME_EPSILON < FLAME_TELEPORT.reappear) break;
      enemy.targetable = true;
      beginCooldown(enemy, FLAME_TELEPORT.cooldown);
      continue;
    }

    if (enemy.behaviorState === "cooldown") {
      const time = Math.min(remaining, Math.max(0, enemy.cooldownRemaining));
      enemy.cooldownRemaining -= time;
      remaining -= time;
      if (enemy.cooldownRemaining > TIME_EPSILON) break;
      enemy.cooldownRemaining = 0;
      enemy.behaviorState = "idle";
      enemy.behaviorTime = 0;
      continue;
    }

    enemy.behaviorState = "idle";
    enemy.behaviorTime = 0;
  }

  return { handled, events: [] };
}

function moveFlameTeleport(enemy, player, context) {
  const random = context.random || Math.random;
  const portals = context.portals || [];
  for (let attempt = 0; attempt < FLAME_TELEPORT.attempts; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const distance = FLAME_TELEPORT.minRadius
      + random() * (FLAME_TELEPORT.maxRadius - FLAME_TELEPORT.minRadius);
    const candidate = {
      x: player.x + Math.cos(angle) * distance,
      y: player.y + Math.sin(angle) * distance,
    };
    if (context.isBlocked(candidate.x, candidate.y, enemy.radius)) continue;
    if (Math.hypot(candidate.x - player.x, candidate.y - player.y) < FLAME_TELEPORT.playerSafety) continue;
    if (portals.some(portal => {
      const center = portalCenter(portal);
      return Math.hypot(candidate.x - center.x, candidate.y - center.y) < FLAME_TELEPORT.portalSafety;
    })) continue;
    enemy.x = candidate.x;
    enemy.y = candidate.y;
    return;
  }
}

function portalCenter(portal) {
  const x = Number.isFinite(portal?.x) ? portal.x : 0;
  const y = Number.isFinite(portal?.y) ? portal.y : 0;
  const width = Number.isFinite(portal?.w) ? portal.w : 0;
  const height = Number.isFinite(portal?.h) ? portal.h : 0;
  return { x: x + width / 2, y: y + height / 2 };
}

function updateFangCharge(enemy, player, dt, context) {
  return updateAttackState(enemy, player, dt, context, FANG_CHARGE, {
    distanceForTime(_enemy, time) {
      return FANG_CHARGE.attackSpeed * time;
    },
    move(enemy, distance, context) {
      return moveLocked(enemy, distance, context);
    },
    endOnHit: true,
  });
}

function updatePirateBite(enemy, player, dt, context) {
  return updateAttackState(enemy, player, dt, context, PIRATE_BITE, {
    distanceForTime(enemy, time) {
      const remaining = Math.max(0, PIRATE_BITE.lungeDistance - (enemy.attackDistance || 0));
      return Math.min(remaining, PIRATE_BITE.lungeDistance / PIRATE_BITE.attackDuration * time);
    },
    move(enemy, distance, context) {
      if (distance <= 0) return true;
      const moved = moveLocked(enemy, distance, context);
      if (moved) enemy.attackDistance = (enemy.attackDistance || 0) + distance;
      return moved;
    },
    canAttemptHit(enemy, player) {
      return isInLockedArc(enemy, player, PIRATE_BITE.arcDegrees);
    },
    endOnHit: true,
  });
}

function updateBurrowCharge(enemy, player, dt, context) {
  return updateAttackState(enemy, player, dt, context, BURROW_CHARGE, {
    distanceForTime(_enemy, time) {
      return BURROW_CHARGE.attackSpeed * time;
    },
    move(candidate, distance, movementContext) {
      return moveLocked(candidate, distance, movementContext);
    },
    onBeginTelegraph(candidate) {
      candidate.targetable = false;
    },
    onBeginAttack(candidate) {
      candidate.targetable = true;
    },
    onBeginCooldown(candidate) {
      candidate.targetable = true;
    },
    endOnHit: true,
  });
}

function updateMossTroll(enemy, player, dt, context = {}) {
  if (!context.mossCamouflageOnly) updateMossTrollRegeneration(enemy, dt);
  if (!context.mossSkipCamouflage) updateMossTrollCamouflage(enemy, player);

  return { handled: false, events: [] };
}

function updateMossTrollRegeneration(enemy, dt) {
  const before = enemy.lastDamagedAgo;
  if (!Number.isFinite(before)) return;
  enemy.lastDamagedAgo = Math.max(0, before + Math.max(0, dt));
  const regenSeconds = Math.max(0, enemy.lastDamagedAgo - Math.max(before, TROLL_REGEN.delay));
  enemy.hp = Math.min(enemy.maxHp, enemy.hp + TROLL_REGEN.hpPerSecond * regenSeconds);
}

function updateMossTrollCamouflage(enemy, player) {
  const canCamouflage = (enemy.state === "idle" || enemy.state === "returning")
    && distanceTo(enemy, player) > TROLL_REGEN.revealDistance;
  enemy.camouflaged = canCamouflage;
  enemy.opacity = canCamouflage ? TROLL_REGEN.hiddenOpacity : 1;
}

function updateSporeSlow(enemy, player, dt) {
  const events = [];
  let remaining = positiveFiniteDuration(dt);

  while (remaining > TIME_EPSILON) {
    if (enemy.behaviorState === "idle") {
      if (distanceTo(enemy, player) > SPORE_SLOW.triggerRange) return { handled: false, events };
      beginTelegraph(enemy, player);
      continue;
    }

    if (enemy.behaviorState === "telegraph") {
      const time = Math.min(remaining, Math.max(0, SPORE_SLOW.telegraphDuration - enemy.behaviorTime));
      enemy.behaviorTime += time;
      remaining -= time;
      if (enemy.behaviorTime + TIME_EPSILON < SPORE_SLOW.telegraphDuration) break;
      if (!enemy.attackApplied && distanceTo(enemy, player) <= SPORE_SLOW.radius) {
        enemy.attackApplied = true;
        events.push({
          type: "apply-player-status",
          enemyId: enemy.id,
          status: "slow",
          multiplier: SPORE_SLOW.multiplier,
          duration: SPORE_SLOW.duration,
        });
      }
      beginCooldown(enemy, SPORE_SLOW.cooldownDuration);
      continue;
    }

    if (enemy.behaviorState === "cooldown") {
      const time = Math.min(remaining, Math.max(0, enemy.cooldownRemaining));
      enemy.cooldownRemaining -= time;
      remaining -= time;
      if (enemy.cooldownRemaining > TIME_EPSILON) break;
      enemy.cooldownRemaining = 0;
      enemy.behaviorState = "idle";
      enemy.behaviorTime = 0;
      continue;
    }

    enemy.behaviorState = "idle";
    enemy.behaviorTime = 0;
  }

  return { handled: true, events };
}

function updateAttackState(enemy, player, dt, context, rules, attack) {
  const events = [];
  let remaining = positiveFiniteDuration(dt);

  while (remaining > TIME_EPSILON) {
    if (enemy.behaviorState === "idle") {
      if (distanceTo(enemy, player) > rules.triggerRange) {
        enemy.moving = false;
        break;
      }
      beginTelegraph(enemy, player);
      attack.onBeginTelegraph?.(enemy);
      continue;
    }

    if (enemy.behaviorState === "telegraph") {
      const time = Math.min(remaining, Math.max(0, rules.telegraphDuration - enemy.behaviorTime));
      enemy.behaviorTime += time;
      remaining -= time;
      if (enemy.behaviorTime + TIME_EPSILON < rules.telegraphDuration) break;
      beginAttack(enemy);
      attack.onBeginAttack?.(enemy);
      continue;
    }

    if (enemy.behaviorState === "attack") {
      const time = Math.min(remaining, Math.max(0, rules.attackDuration - enemy.behaviorTime));
      const beforeMove = { x: enemy.x, y: enemy.y };
      const intendedDistance = context.suppressMovement ? 0 : attack.distanceForTime(enemy, time);
      const impact = !context.suppressMovement && !enemy.attackApplied && (!attack.canAttemptHit || attack.canAttemptHit(enemy, player))
        ? firstSegmentCircleHit(beforeMove, enemy.lockedDirection, intendedDistance, player, enemy.radius + playerRadius(player))
        : null;
      const movementDistance = impact?.distance ?? intendedDistance;
      if (!context.suppressMovement && !attack.move(enemy, movementDistance, context)) {
        beginCooldown(enemy, rules.cooldownDuration);
        attack.onBeginCooldown?.(enemy);
        break;
      }
      enemy.moving = movementDistance > 0;
      const didHit = impact !== null;
      if (didHit) {
        events.push(damageEvent(enemy));
      }
      enemy.behaviorTime += time;
      remaining -= time;
      if (didHit && attack.endOnHit) {
        beginCooldown(enemy, rules.cooldownDuration);
        attack.onBeginCooldown?.(enemy);
        continue;
      }
      if (enemy.behaviorTime + TIME_EPSILON < rules.attackDuration) break;
      beginCooldown(enemy, rules.cooldownDuration);
      attack.onBeginCooldown?.(enemy);
      continue;
    }

    if (enemy.behaviorState === "cooldown") {
      const time = Math.min(remaining, Math.max(0, enemy.cooldownRemaining));
      enemy.cooldownRemaining -= time;
      remaining -= time;
      enemy.moving = false;
      if (enemy.cooldownRemaining > TIME_EPSILON) break;
      enemy.cooldownRemaining = 0;
      enemy.behaviorState = "idle";
      enemy.behaviorTime = 0;
      continue;
    }

    enemy.behaviorState = "idle";
    enemy.behaviorTime = 0;
  }

  return { handled: true, events };
}

function positiveFiniteDuration(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function beginTelegraph(enemy, player) {
  enemy.behaviorState = "telegraph";
  enemy.behaviorTime = 0;
  enemy.attackApplied = false;
  enemy.attackSequence += 1;
  enemy.attackDistance = 0;
  enemy.lockedDirection = normalize(player.x - enemy.x, player.y - enemy.y);
  enemy.moving = false;
}

function beginAttack(enemy) {
  enemy.behaviorState = "attack";
  enemy.behaviorTime = 0;
  enemy.moving = false;
}

function beginCooldown(enemy, duration) {
  enemy.behaviorState = "cooldown";
  enemy.behaviorTime = 0;
  enemy.cooldownRemaining = duration;
  enemy.moving = false;
}

function damageEvent(enemy) {
  enemy.attackApplied = true;
  return {
    type: "damage-player",
    enemyId: enemy.id,
    attackId: `${enemy.id}:${enemy.attackSequence}`,
    amount: enemy.contactDamage,
    source: { x: enemy.x, y: enemy.y },
  };
}

function moveLocked(enemy, distance, context) {
  const direction = enemy.lockedDirection || { x: 0, y: 0 };
  return context.moveEnemy(
    enemy,
    direction.x * distance,
    direction.y * distance,
    { stopOnBlock: true },
  );
}

function isTouching(enemy, player) {
  return Math.hypot(player.x - enemy.x, player.y - enemy.y) < enemy.radius + playerRadius(player);
}

function playerRadius(player) {
  return Number.isFinite(player.radius) ? player.radius : PLAYER_RADIUS;
}

function firstSegmentCircleHit(start, direction, distance, player, radius) {
  const dx = direction.x * distance;
  const dy = direction.y * distance;
  const offsetX = start.x - player.x;
  const offsetY = start.y - player.y;
  const radiusSquared = radius * radius;
  const startDistanceSquared = offsetX * offsetX + offsetY * offsetY;
  if (startDistanceSquared <= radiusSquared) return { distance: 0 };

  const segmentLengthSquared = dx * dx + dy * dy;
  if (segmentLengthSquared <= TIME_EPSILON) return null;
  const projection = offsetX * dx + offsetY * dy;
  const discriminant = projection * projection - segmentLengthSquared * (startDistanceSquared - radiusSquared);
  if (discriminant < 0) return null;
  const t = (-projection - Math.sqrt(discriminant)) / segmentLengthSquared;
  if (t < 0 || t > 1) return null;
  return { distance: distance * t };
}

function isInLockedArc(enemy, player, degrees) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) return true;
  const direction = enemy.lockedDirection || { x: 0, y: 0 };
  const cosine = (direction.x * dx + direction.y * dy) / distance;
  return cosine >= Math.cos((degrees * Math.PI / 180) / 2);
}

function distanceTo(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 0, y: 1 };
}
