import { updateEnemyBehavior as updateLegacyEnemyBehavior } from "./enemy-behaviors-20260905-upgrade.js";

const EPSILON = 1e-9;

const DEFECT_DASH = Object.freeze({
  triggerRange: 300,
  telegraph: 0.35,
  dashDuration: 0.28,
  dashSpeed: 380,
  cooldown: 1.8,
});

const CORE_BOLT = Object.freeze({
  triggerRange: 420,
  telegraph: 0.45,
  cooldown: 2.2,
  projectileSpeed: 360,
  projectileRadius: 7,
});

const REWRITE_BLINK = Object.freeze({
  triggerRange: 360,
  telegraph: 0.4,
  cooldown: 2.8,
  minRadius: 70,
  maxRadius: 105,
});

function distance(a, b) {
  return Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
}

function direction(from, to) {
  const dx = (to?.x ?? from.x) - from.x;
  const dy = (to?.y ?? from.y) - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function beginCooldown(enemy, duration) {
  enemy.behaviorState = "cooldown";
  enemy.behaviorTime = 0;
  enemy.cooldownRemaining = duration;
  enemy.moving = false;
}

function advanceCooldown(enemy, dt) {
  enemy.cooldownRemaining = Math.max(0, (enemy.cooldownRemaining || 0) - dt);
  if (enemy.cooldownRemaining <= EPSILON) {
    enemy.behaviorState = "idle";
    enemy.behaviorTime = 0;
  }
}

function updateDefectDash(enemy, player, dt, context = {}) {
  const events = [];
  let remaining = Math.max(0, Number.isFinite(dt) ? dt : 0);

  if (enemy.behaviorState === "idle") {
    if (distance(enemy, player) > DEFECT_DASH.triggerRange) return { handled: false, events };
    enemy.behaviorState = "telegraph";
    enemy.behaviorTime = 0;
    enemy.lockedDirection = direction(enemy, player);
    enemy.moving = false;
    events.push({ type: "defect-warning", enemyId: enemy.id, direction: { ...enemy.lockedDirection } });
  }

  while (remaining > EPSILON) {
    if (enemy.behaviorState === "telegraph") {
      const step = Math.min(remaining, DEFECT_DASH.telegraph - enemy.behaviorTime);
      enemy.behaviorTime += step;
      remaining -= step;
      if (enemy.behaviorTime + EPSILON < DEFECT_DASH.telegraph) break;
      enemy.behaviorState = "attack";
      enemy.behaviorTime = 0;
      enemy.attackApplied = false;
      continue;
    }
    if (enemy.behaviorState === "attack") {
      const step = Math.min(remaining, DEFECT_DASH.dashDuration - enemy.behaviorTime);
      const movement = DEFECT_DASH.dashSpeed * step;
      const locked = enemy.lockedDirection || direction(enemy, player);
      if (typeof context.moveEnemy === "function") {
        context.moveEnemy(enemy, locked.x * movement, locked.y * movement);
      } else {
        enemy.x += locked.x * movement;
        enemy.y += locked.y * movement;
      }
      enemy.moving = movement > 0;
      enemy.behaviorTime += step;
      remaining -= step;
      if (!enemy.attackApplied && distance(enemy, player) <= enemy.radius + (player?.radius ?? 14) + 24) {
        enemy.attackApplied = true;
        enemy.attackSequence = (enemy.attackSequence || 0) + 1;
        events.push({
          type: "damage-player",
          enemyId: enemy.id,
          attackId: `${enemy.id}:defect-dash:${enemy.attackSequence}`,
          targetUid: player?.uid,
          amount: enemy.contactDamage,
          source: { x: enemy.x, y: enemy.y },
        });
      }
      if (enemy.behaviorTime + EPSILON < DEFECT_DASH.dashDuration) break;
      if (!enemy.attackApplied) {
        enemy.attackApplied = true;
        enemy.attackSequence = (enemy.attackSequence || 0) + 1;
        events.push({
          type: "damage-player",
          enemyId: enemy.id,
          attackId: `${enemy.id}:defect-dash:${enemy.attackSequence}`,
          targetUid: player?.uid,
          amount: enemy.contactDamage,
          source: { x: enemy.x, y: enemy.y },
        });
      }
      beginCooldown(enemy, DEFECT_DASH.cooldown);
      continue;
    }
    if (enemy.behaviorState === "cooldown") {
      const step = Math.min(remaining, enemy.cooldownRemaining || 0);
      advanceCooldown(enemy, step);
      remaining -= step;
      if (enemy.behaviorState === "cooldown") break;
      continue;
    }
    enemy.behaviorState = "idle";
  }
  return { handled: true, events };
}

function updateCoreBolt(enemy, player, dt) {
  const events = [];
  let remaining = Math.max(0, Number.isFinite(dt) ? dt : 0);

  if (enemy.behaviorState === "idle") {
    if (distance(enemy, player) > CORE_BOLT.triggerRange) return { handled: false, events };
    enemy.behaviorState = "telegraph";
    enemy.behaviorTime = 0;
    enemy.lockedDirection = direction(enemy, player);
    enemy.moving = false;
    events.push({ type: "core-bolt-telegraph", enemyId: enemy.id, targetUid: player?.uid });
  }

  while (remaining > EPSILON) {
    if (enemy.behaviorState === "telegraph") {
      const step = Math.min(remaining, CORE_BOLT.telegraph - enemy.behaviorTime);
      enemy.behaviorTime += step;
      remaining -= step;
      if (enemy.behaviorTime + EPSILON < CORE_BOLT.telegraph) break;
      enemy.attackSequence = (enemy.attackSequence || 0) + 1;
      events.push({
        type: "enemy-projectile",
        enemyId: enemy.id,
        projectileId: `${enemy.id}:core-bolt:${enemy.attackSequence}`,
        targetUid: player?.uid,
        x: enemy.x,
        y: enemy.y,
        direction: { ...(enemy.lockedDirection || direction(enemy, player)) },
        speed: CORE_BOLT.projectileSpeed,
        radius: CORE_BOLT.projectileRadius,
        damage: enemy.contactDamage,
      });
      beginCooldown(enemy, CORE_BOLT.cooldown);
      continue;
    }
    if (enemy.behaviorState === "cooldown") {
      const step = Math.min(remaining, enemy.cooldownRemaining || 0);
      advanceCooldown(enemy, step);
      remaining -= step;
      if (enemy.behaviorState === "cooldown") break;
      continue;
    }
    enemy.behaviorState = "idle";
  }
  return { handled: true, events };
}

function updateRewriteBlink(enemy, player, dt, context = {}) {
  const events = [];
  let remaining = Math.max(0, Number.isFinite(dt) ? dt : 0);

  if (enemy.behaviorState === "idle") {
    if (distance(enemy, player) > REWRITE_BLINK.triggerRange) return { handled: false, events };
    enemy.behaviorState = "telegraph";
    enemy.behaviorTime = 0;
    enemy.targetable = false;
    enemy.moving = false;
    events.push({ type: "rewrite-blink-warning", enemyId: enemy.id, targetUid: player?.uid });
  }

  while (remaining > EPSILON) {
    if (enemy.behaviorState === "telegraph") {
      const step = Math.min(remaining, REWRITE_BLINK.telegraph - enemy.behaviorTime);
      enemy.behaviorTime += step;
      remaining -= step;
      if (enemy.behaviorTime + EPSILON < REWRITE_BLINK.telegraph) break;
      const random = context.random || Math.random;
      const angle = random() * Math.PI * 2;
      const blinkDistance = REWRITE_BLINK.minRadius
        + random() * (REWRITE_BLINK.maxRadius - REWRITE_BLINK.minRadius);
      const candidateX = (player?.x ?? enemy.x) + Math.cos(angle) * blinkDistance;
      const candidateY = (player?.y ?? enemy.y) + Math.sin(angle) * blinkDistance;
      if (typeof context.isBlocked !== "function" || !context.isBlocked(candidateX, candidateY, enemy.radius)) {
        enemy.x = candidateX;
        enemy.y = candidateY;
      }
      enemy.targetable = true;
      enemy.attackSequence = (enemy.attackSequence || 0) + 1;
      events.push({
        type: "damage-player",
        enemyId: enemy.id,
        attackId: `${enemy.id}:rewrite-blink:${enemy.attackSequence}`,
        targetUid: player?.uid,
        amount: enemy.contactDamage,
        source: { x: enemy.x, y: enemy.y },
      });
      beginCooldown(enemy, REWRITE_BLINK.cooldown);
      continue;
    }
    if (enemy.behaviorState === "cooldown") {
      const step = Math.min(remaining, enemy.cooldownRemaining || 0);
      advanceCooldown(enemy, step);
      remaining -= step;
      if (enemy.behaviorState === "cooldown") break;
      continue;
    }
    enemy.behaviorState = "idle";
  }
  return { handled: true, events };
}

export function updateEnemyBehavior(enemy, player, dt, context = {}) {
  if (enemy?.behavior === "defect-dash") return updateDefectDash(enemy, player, dt, context);
  if (enemy?.behavior === "core-bolt") return updateCoreBolt(enemy, player, dt, context);
  if (enemy?.behavior === "rewrite-blink") return updateRewriteBlink(enemy, player, dt, context);
  return updateLegacyEnemyBehavior(enemy, player, dt, context);
}
