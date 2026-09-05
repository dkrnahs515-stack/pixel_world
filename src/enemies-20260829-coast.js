import { getWorldDefinition } from "./world-data-20260829-coast.js";
import { getEnemyDefinition } from "./enemy-definitions.js";
import { updateEnemyBehavior } from "./enemy-behaviors.js";

const AGGRO_DISTANCE = 360;
const RETURN_DISTANCE = 520;
const DEATH_DURATION = 0.65;
const INFO_DISPLAY_DISTANCE = 420;
const INFO_DISPLAY_AFTER_HIT = 3;

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
    id, kind, name: overrides.name ?? type.name, level: overrides.level ?? type.level,
    x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y,
    homeX: spawn.x, homeY: spawn.y,
    hp, maxHp: overrides.maxHp ?? hp, speed: type.speed,
    contactDamage: type.damage, radius: type.radius,
    color: type.color, accent: type.accent,
    behavior: type.behavior, behaviorState: "idle", behaviorTime: 0,
    cooldownRemaining: 0, attackSequence: 0, attackApplied: false,
    lastDamagedAgo: Number.POSITIVE_INFINITY, infoVisibleRemaining: 0,
    generation: overrides.generation ?? type.generation ?? 0,
    targetable: overrides.targetable ?? true, contactMode: type.contactMode,
    contactCooldownDuration: type.contactCooldown ?? 1,
    state: "idle", moving: false, step: overrides.step ?? 0,
    hitFlash: 0, shake: 0, deathTime: 0, opacity: 1, scale: overrides.scale ?? 1,
    knockbackX: 0, knockbackY: 0, contactCooldown: 0,
    hitStunRemaining: 0,
    ...(overrides.isCoopBoss ? { isCoopBoss: true } : {}),
  };
}

export function createBossEnemyView(definition, snapshot) {
  if (!definition || !snapshot) return null;
  return createEnemyInstance(
    definition.enemyKind,
    { x: snapshot.x, y: snapshot.y },
    snapshot.bossId,
    {
      name: definition.name,
      hp: snapshot.hp,
      maxHp: snapshot.maxHp,
      scale: 1.55,
      targetable: snapshot.status === "alive",
      isCoopBoss: true,
    },
  );
}

export function createEnemyContactDamageEvent(enemy, player) {
  return createEnemyContactDamageEvents(enemy, [player])[0] || null;
}

export function createEnemyContactDamageEvents(enemy, players) {
  if (!enemy || !Array.isArray(players) || enemy.state === "dying" || enemy.targetable === false
    || enemy.contactMode !== "contact" || enemy.contactCooldown > 0
    || enemy.hitStunRemaining > 0) return [];
  const overlapping = players.filter(player => {
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return false;
    const playerRadius = Number.isFinite(player.radius) ? player.radius : 16;
    return Math.hypot(player.x - enemy.x, player.y - enemy.y) < enemy.radius + playerRadius;
  });
  if (overlapping.length === 0) return [];
  enemy.contactCooldown = enemy.contactCooldownDuration;
  enemy.attackSequence += 1;
  return overlapping.map(player => ({
    type: "damage-player",
    enemyId: enemy.id,
    attackId: `${enemy.id}:contact:${enemy.attackSequence}:${player.uid || "local-player"}`,
    targetUid: player.uid,
    amount: enemy.contactDamage,
    source: { x: enemy.x, y: enemy.y },
  }));
}

export function applyEnemyHitStun(enemy, duration) {
  if (!enemy || enemy.state === "dying" || !(duration > 0)) return false;
  enemy.hitStunRemaining = Math.max(enemy.hitStunRemaining ?? 0, duration);
  enemy.moving = false;
  return true;
}

export function formatHealthValue(value) {
  const rounded = Math.round(Math.max(0, value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function damageEnemy(enemy, damage, direction, knockbackSpeed, random = Math.random) {
  if (enemy.state === "dying") return { killed: false, damageNumber: null };

  if (enemy.behavior === "camouflage-regeneration") {
    enemy.lastDamagedAgo = 0;
    enemy.camouflaged = false;
    enemy.opacity = 1;
  }
  enemy.hp = Math.max(0, Math.round((enemy.hp - damage) * 10) / 10);
  enemy.infoVisibleRemaining = INFO_DISPLAY_AFTER_HIT;
  enemy.hitFlash = 0.16;
  enemy.shake = 0.2;
  enemy.knockbackX = direction.x * knockbackSpeed;
  enemy.knockbackY = direction.y * knockbackSpeed;
  if (enemy.hp === 0) {
    enemy.state = "dying";
    enemy.deathTime = 0;
    enemy.moving = false;
    enemy.knockbackX = 0;
    enemy.knockbackY = 0;
    if (enemy.kind === "magma-slime" && (enemy.generation ?? 0) === 0 && !enemy.splitResolved) {
      enemy.splitCount = random() < 0.5 ? 2 : 3;
      enemy.splitChildHp = enemy.splitCount === 2 ? 20 : 12;
      enemy.splitEventEmitted = false;
      enemy.splitResolved = true;
    }
  }

  return {
    killed: enemy.hp === 0,
    damageNumber: { x: enemy.x, y: enemy.y - 26, value: damage },
  };
}

export function updateEnemies(enemies, player, dt, context) {
  const { isBlocked } = context;
  const events = [];
  for (const enemy of enemies) {
    enemy.baseMoveSpeed ??= enemy.speed;
    enemy.slowRemaining = Math.max(0, (enemy.slowRemaining || 0) - dt);
    enemy.speed = enemy.baseMoveSpeed * (enemy.slowRemaining > 0 ? (enemy.slowMultiplier || 0.5) : 1);
    enemy.prevX = enemy.x;
    enemy.prevY = enemy.y;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.shake = Math.max(0, enemy.shake - dt);
    enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
    enemy.infoVisibleRemaining = Math.max(0, (enemy.infoVisibleRemaining ?? 0) - dt);
    const wasHitStunned = (enemy.hitStunRemaining ?? 0) > 0;
    enemy.hitStunRemaining = Math.max(0, (enemy.hitStunRemaining ?? 0) - dt);

    const hasKnockback = Math.hypot(enemy.knockbackX, enemy.knockbackY) > 1;
    if (hasKnockback) {
      moveWithCollision(
        enemy,
        enemy.knockbackX * dt,
        enemy.knockbackY * dt,
        isBlocked,
      );
      const decay = Math.exp(-8 * dt);
      enemy.knockbackX *= decay;
      enemy.knockbackY *= decay;
    } else {
      enemy.knockbackX = 0;
      enemy.knockbackY = 0;
    }

    if (enemy.state === "dying") {
      enemy.deathTime += dt;
      const progress = Math.min(1, enemy.deathTime / DEATH_DURATION);
      enemy.opacity = 1 - progress;
      enemy.scale = 1 - 0.85 * progress;
      if (enemy.deathTime >= DEATH_DURATION && enemy.splitResolved && !enemy.splitEventEmitted) {
        enemy.splitEventEmitted = true;
        events.push({
          type: "spawn-enemies",
          enemyId: enemy.id,
          kind: "magma-slime-small",
          count: enemy.splitCount,
          childHp: enemy.splitChildHp,
          origin: { x: enemy.x, y: enemy.y },
        });
      }
      continue;
    }

    if (wasHitStunned) {
      enemy.moving = false;
      continue;
    }

    const behaviorContext = {
      ...context,
      suppressMovement: hasKnockback,
      moveEnemy: (candidate, dx, dy, options) => moveWithCollision(
        candidate,
        dx,
        dy,
        isBlocked,
        options,
      ),
    };
    const behavior = updateEnemyBehavior(enemy, player, dt, enemy.behavior === "camouflage-regeneration"
      ? { ...behaviorContext, mossSkipCamouflage: true }
      : behaviorContext);
    events.push(...behavior.events);
    if (!hasKnockback) {
      if (!behavior.handled) updateEnemyMovement(enemy, player, dt, isBlocked);
    }
    if (enemy.behavior === "camouflage-regeneration") {
      updateEnemyBehavior(enemy, player, 0, {
        ...behaviorContext,
        mossCamouflageOnly: true,
      });
    }
    if (enemy.moving) enemy.step += dt * 8;
  }

  return {
    enemies: enemies.filter(enemy => enemy.state !== "dying" || enemy.deathTime < DEATH_DURATION),
    events,
  };
}

export function createMagmaChildren(event, { isBlocked, createId }) {
  if (event?.type !== "spawn-enemies" || event.kind !== "magma-slime-small") return [];
  const count = normalizeMagmaChildCount(event.count);
  if (count === 0) return [];
  const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3, Math.PI, Math.PI / 2, (3 * Math.PI) / 2];
  const children = [];
  for (const angle of angles) {
    if (children.length >= count) break;
    const spawn = {
      x: cleanCoordinate(event.origin.x + Math.cos(angle) * 34),
      y: cleanCoordinate(event.origin.y + Math.sin(angle) * 34),
    };
    const child = createEnemyInstance(event.kind, spawn, "", {
      hp: event.childHp,
      maxHp: event.childHp,
      generation: 1,
    });
    if (isBlocked(spawn.x, spawn.y, child.radius)) continue;
    child.id = createId();
    children.push(child);
  }
  return children;
}

function normalizeMagmaChildCount(count) {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(3, Math.floor(count)));
}

function cleanCoordinate(value) {
  return Math.abs(value) < 1e-9 ? 0 : value;
}

export function shouldShowEnemyInfo(enemy, player) {
  if (!enemy || !player || enemy.state === "dying" || enemy.targetable === false) return false;
  if (enemy.camouflaged) return false;
  if (enemy.kind === "ancient-boar" && enemy.behaviorState === "telegraph") return false;
  if (enemy.kind === "flame-imp" && enemy.behaviorState === "vanish") return false;
  return Math.hypot(player.x - enemy.x, player.y - enemy.y) <= INFO_DISPLAY_DISTANCE
    || (enemy.infoVisibleRemaining ?? 0) > 0;
}

export function drawEnemy(ctx, enemy, cameraX, cameraY, alpha = 1, { player = null } = {}) {
  const x = Math.round(lerp(enemy.prevX, enemy.x, alpha) - cameraX);
  const y = Math.round(lerp(enemy.prevY, enemy.y, alpha) - cameraY);
  const bob = enemy.state === "dying"
    ? -Math.sin(Math.min(1, enemy.deathTime / DEATH_DURATION) * Math.PI) * 16
    : Math.sin(enemy.step) * 2;
  const shake = enemy.shake > 0 ? Math.sin(enemy.shake * 95) * 4 : 0;
  const kindScale = enemy.kind === "magma-slime-small" ? 0.65 : 1;
  const opacity = enemy.camouflaged ? Math.min(enemy.opacity ?? 1, 0.25) : (enemy.opacity ?? 1);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x + shake, y + bob);
  ctx.scale((enemy.scale ?? 1) * kindScale, (enemy.scale ?? 1) * kindScale);
  drawEnemyTelegraph(ctx, enemy);
  const underground = enemy.kind === "ancient-boar" && enemy.behaviorState === "telegraph";
  const vanishing = enemy.kind === "flame-imp" && enemy.behaviorState === "vanish";
  if (!underground && !vanishing) {
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.fillRect(-20, 12, 40, 8);
  }

  if (!underground) {
    (ENEMY_DRAWERS[enemy.kind] || drawSlimeBody)(ctx, enemy);
  }
  ctx.restore();
  if (shouldShowEnemyInfo(enemy, player)) drawEnemyInfo(ctx, enemy, x, y + bob);
}

function drawEnemyInfo(ctx, enemy, x, y) {
  const width = 104;
  const top = Math.round(y - Math.max(52, enemy.radius + 34));
  const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "700 12px Arial, sans-serif";
  ctx.fillStyle = "rgba(10,16,27,.82)";
  ctx.fillRect(x - 62, top - 16, 124, 17);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Lv.${enemy.level} ${enemy.name}`, x, top - 4);

  ctx.fillStyle = "rgba(4,10,7,.9)";
  ctx.fillRect(x - width / 2, top + 4, width, 10);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(x - width / 2, top + 4, width * hpRatio, 10);
  ctx.font = "700 9px Arial, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${formatHealthValue(enemy.hp)} / ${formatHealthValue(enemy.maxHp)}`, x, top + 13);
  ctx.restore();
}

const ENEMY_DRAWERS = Object.freeze({
  boar: drawBoar,
  crab: drawCrab,
  "fang-shark": drawFangShark,
  "pirate-shark": drawPirateShark,
  "magma-slime": drawMagmaSlime,
  "magma-slime-small": drawMagmaSlime,
  "flame-imp": drawFlameImp,
  "ancient-boar": drawAncientBoar,
  "moss-troll": drawMossTroll,
  "ancient-mushroom-bug": drawMushroomBug,
});

function drawEnemyTelegraph(ctx, enemy) {
  const direction = enemy.lockedDirection || { x: 0, y: 1 };
  const isCharge = (enemy.kind === "fang-shark" || enemy.kind === "ancient-boar")
    && (enemy.behaviorState === "telegraph" || enemy.behaviorState === "attack");
  if (isCharge) {
    ctx.fillStyle = enemy.kind === "ancient-boar"
      ? "rgba(181,138,74,.65)"
      : enemy.hitFlash > 0
        ? "rgba(255,255,255,.85)"
        : fangTelegraphIsLight(enemy)
          ? "rgba(244,247,237,.7)"
          : "rgba(21,154,156,.75)";
    drawDirectionTelegraph(ctx, direction, enemy.kind === "ancient-boar");
  }

  if (enemy.kind === "ancient-mushroom-bug" && enemy.behaviorState === "telegraph") {
    ctx.save();
    ctx.strokeStyle = "rgba(118,80,143,.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawMushroomSpores(ctx, enemy.behaviorTime);
  }
}

function fangTelegraphIsLight(enemy) {
  const progress = Math.max(0, Math.min(1, (Number.isFinite(enemy.behaviorTime) ? enemy.behaviorTime : 0) / 0.55));
  return Math.floor(progress * 4) % 2 === 0;
}

function drawMushroomSpores(ctx, behaviorTime) {
  const progress = Math.max(0, Math.min(1, (Number.isFinite(behaviorTime) ? behaviorTime : 0) / 0.6));
  const radius = Math.round(18 + 88 * progress);
  ctx.fillStyle = "rgba(118,80,143,.8)";
  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    ctx.fillRect(
      Math.round(Math.cos(angle) * radius) - 2,
      Math.round(Math.sin(angle) * radius) - 2,
      4,
      4,
    );
  }
}

function drawDirectionTelegraph(ctx, direction, drawDust) {
  const isHorizontal = Math.abs(direction.y) <= 0.001;
  const isVertical = Math.abs(direction.x) <= 0.001;
  if (isHorizontal) {
    ctx.fillRect(direction.x >= 0 ? 16 : -84, -3, 68, 6);
    if (drawDust) drawBurrowDust(ctx, direction.x >= 0 ? 1 : -1, 0);
    return;
  }
  if (isVertical) {
    ctx.fillRect(-3, direction.y >= 0 ? 16 : -84, 6, 68);
    if (drawDust) drawBurrowDust(ctx, 0, direction.y >= 0 ? 1 : -1);
    return;
  }

  ctx.save();
  ctx.rotate(Math.atan2(direction.y, direction.x));
  ctx.fillRect(16, -3, 68, 6);
  if (drawDust) drawBurrowDust(ctx, 1, 0);
  ctx.restore();
}

function drawBurrowDust(ctx, directionX, directionY) {
  ctx.fillStyle = "rgba(111,143,61,.7)";
  ctx.fillRect(directionX * 28 - 4, directionY * 28 - 4, 8, 8);
  ctx.fillRect(directionX * 48 - 3, directionY * 48 - 3, 6, 6);
}

function drawFangShark(ctx, enemy) {
  const body = enemy.hitFlash > 0
    ? "#ffffff"
    : enemy.behaviorState === "telegraph" && fangTelegraphIsLight(enemy)
      ? "#f4f7ed"
      : enemy.color;
  const fin = body;
  ctx.fillStyle = body;
  ctx.fillRect(-22, -8, 39, 17);
  ctx.fillRect(-15, -15, 20, 8);
  ctx.fillStyle = fin;
  ctx.fillRect(-8, -25, 10, 11);
  ctx.fillRect(15, -4, 12, 8);
  ctx.fillStyle = "#f4f7ed";
  ctx.fillRect(11, 5, 12, 4);
  ctx.fillRect(13, 8, 3, 4);
  ctx.fillRect(19, 8, 3, 4);
  ctx.fillStyle = "#17311e";
  ctx.fillRect(5, -5, 4, 4);
}

function drawPirateShark(ctx, enemy) {
  const body = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  ctx.fillStyle = body;
  ctx.fillRect(-22, -8, 39, 17);
  ctx.fillRect(-15, -15, 20, 8);
  ctx.fillRect(-7, -24, 10, 10);
  ctx.fillRect(15, -4, 12, 8);
  ctx.fillStyle = "#7650a8";
  ctx.fillRect(-16, -21, 23, 6);
  ctx.fillRect(-10, -27, 13, 7);
  ctx.fillStyle = "#f4f7ed";
  ctx.fillRect(11, 5, 12, 4);
  ctx.fillRect(14, 8, 3, 4);
  ctx.fillRect(20, 8, 3, 4);
  ctx.fillStyle = "#17311e";
  ctx.fillRect(5, -5, 4, 4);
  if (enemy.behaviorState === "telegraph") {
    ctx.fillStyle = "#7650a8";
    ctx.fillRect(8, -3, 21, 14);
    ctx.fillStyle = "#f4f7ed";
    ctx.fillRect(12, 0, 4, 3);
    ctx.fillRect(20, 0, 4, 3);
    ctx.fillRect(16, 8, 4, 3);
    ctx.fillRect(24, 8, 3, 3);
  }
  if (enemy.behaviorState === "attack") {
    ctx.fillStyle = "#fde047";
    ctx.fillRect(18, 0, 9, 7);
  }
}

function drawMagmaSlime(ctx, enemy) {
  const body = enemy.hitFlash > 0 ? "#ffffff" : "#1b1719";
  ctx.fillStyle = body;
  ctx.fillRect(-18, -9, 36, 21);
  ctx.fillRect(-13, -16, 26, 8);
  ctx.fillRect(-15, 8, 30, 6);
  ctx.fillStyle = "#f05a24";
  ctx.fillRect(-12, -6, 8, 5);
  ctx.fillRect(3, -2, 7, 5);
  ctx.fillRect(-4, 6, 9, 4);
  ctx.fillStyle = "#ffc857";
  ctx.fillRect(-9, -5, 3, 3);
  ctx.fillRect(6, -1, 3, 3);
  ctx.fillRect(-1, 7, 3, 2);
}

function drawFlameImp(ctx, enemy) {
  if (enemy.behaviorState === "vanish") {
    const progress = Math.max(0, Math.min(1, (Number.isFinite(enemy.behaviorTime) ? enemy.behaviorTime : 0) / 0.4));
    ctx.save();
    ctx.globalAlpha *= Math.max(0.05, 0.18 * (1 - progress));
    ctx.fillStyle = "#1b1719";
    ctx.fillRect(-17, -2, 21, 18);
    ctx.fillRect(-12, -16, 15, 14);
    ctx.fillRect(-5, -23, 8, 8);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= Math.max(0.35, 0.75 * (1 - progress));
    ctx.fillStyle = "#f05a24";
    ctx.fillRect(-19, 1, 5, 5);
    ctx.fillRect(10, -10, 5, 5);
    ctx.fillRect(-3, -24, 4, 6);
    ctx.fillStyle = "#ffc857";
    ctx.fillRect(-13, -12, 4, 4);
    ctx.fillRect(15, 6, 4, 4);
    ctx.fillRect(4, -19, 3, 5);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#a91f2c";
  ctx.fillRect(-11, -4, 22, 20);
  ctx.fillRect(-8, -12, 16, 9);
  ctx.fillRect(-16, 1, 6, 11);
  ctx.fillRect(10, 1, 6, 11);
  ctx.fillStyle = "#f05a24";
  ctx.fillRect(-9, -20, 18, 9);
  ctx.fillRect(-5, -27, 10, 8);
  ctx.fillStyle = "#ffc857";
  ctx.fillRect(-5, -17, 10, 8);
  ctx.fillRect(-2, -25, 4, 8);
  ctx.fillStyle = "#241711";
  ctx.fillRect(-5, -7, 3, 3);
  ctx.fillRect(3, -7, 3, 3);
  if (enemy.behaviorState === "reappear") {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffc857";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 8, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawAncientBoar(ctx, enemy) {
  const body = enemy.hitFlash > 0 ? "#ffffff" : "#704b32";
  ctx.fillStyle = body;
  ctx.fillRect(-23, -13, 37, 27);
  ctx.fillRect(10, -9, 18, 19);
  ctx.fillRect(-17, 11, 7, 9);
  ctx.fillRect(6, 11, 7, 9);
  ctx.fillStyle = "#b58a4a";
  ctx.fillRect(-18, -17, 24, 6);
  ctx.fillRect(16, -15, 5, 8);
  ctx.fillStyle = "#f4f7ed";
  ctx.fillRect(22, 5, 8, 4);
  ctx.fillRect(22, 10, 8, 4);
  ctx.fillStyle = "#241711";
  ctx.fillRect(19, -4, 4, 4);
}

function drawMossTroll(ctx, enemy) {
  const bark = enemy.hitFlash > 0 ? "#ffffff" : "#704b32";
  ctx.fillStyle = bark;
  ctx.fillRect(-14, -28, 28, 43);
  ctx.fillRect(-22, -19, 8, 27);
  ctx.fillRect(14, -19, 8, 27);
  ctx.fillRect(-10, 13, 8, 12);
  ctx.fillRect(3, 13, 8, 12);
  ctx.fillStyle = "#6f8f3d";
  ctx.fillRect(-15, -33, 30, 8);
  ctx.fillRect(-20, -12, 9, 10);
  ctx.fillRect(11, -4, 10, 11);
  ctx.fillStyle = "#b58a4a";
  ctx.fillRect(-8, -8, 16, 5);
  ctx.fillStyle = "#241711";
  ctx.fillRect(-7, -17, 4, 4);
  ctx.fillRect(4, -17, 4, 4);
}

function drawMushroomBug(ctx, enemy) {
  const forest = enemy.hitFlash > 0 ? "#ffffff" : "#234f32";
  ctx.fillStyle = forest;
  ctx.fillRect(-13, -3, 26, 19);
  ctx.fillRect(-20, 4, 7, 7);
  ctx.fillRect(13, 4, 7, 7);
  ctx.fillRect(-10, 14, 7, 7);
  ctx.fillRect(3, 14, 7, 7);
  ctx.fillStyle = "#76508f";
  ctx.fillRect(-24, -18, 48, 15);
  ctx.fillRect(-17, -25, 34, 8);
  ctx.fillRect(-28, -12, 56, 8);
  ctx.fillStyle = "#b58a4a";
  ctx.fillRect(-13, -17, 6, 5);
  ctx.fillRect(5, -21, 6, 5);
  ctx.fillRect(14, -12, 5, 4);
  ctx.fillStyle = "#241711";
  ctx.fillRect(-7, 2, 4, 4);
  ctx.fillRect(4, 2, 4, 4);
}

function drawSlimeBody(ctx, enemy) {
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  ctx.fillRect(-18, -10, 36, 22);
  ctx.fillRect(-13, -16, 26, 8);
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.accent;
  ctx.fillRect(-15, 7, 30, 7);
  ctx.fillRect(-9, -11, 7, 5);
  ctx.fillStyle = "#17311e";
  ctx.fillRect(-9, -6, 4, 5);
  ctx.fillRect(5, -6, 4, 5);
  ctx.fillRect(-4, 3, 8, 3);
}

function drawBoar(ctx, enemy) {
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  ctx.fillRect(-22, -13, 38, 27);
  ctx.fillRect(10, -9, 17, 19);
  ctx.fillRect(-17, 11, 7, 9);
  ctx.fillRect(7, 11, 7, 9);
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.accent;
  ctx.fillRect(17, 7, 14, 4);
  ctx.fillRect(16, -14, 5, 8);
  ctx.fillStyle = "#241711";
  ctx.fillRect(18, -4, 4, 4);
}

function drawCrab(ctx, enemy) {
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  ctx.fillRect(-18, -10, 36, 23);
  ctx.fillRect(-30, -13, 12, 10);
  ctx.fillRect(18, -13, 12, 10);
  ctx.fillRect(-27, 9, 12, 5);
  ctx.fillRect(15, 9, 12, 5);
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.accent;
  ctx.fillRect(-13, -15, 8, 8);
  ctx.fillRect(5, -15, 8, 8);
  ctx.fillStyle = "#2d1714";
  ctx.fillRect(-10, -13, 3, 3);
  ctx.fillRect(7, -13, 3, 3);
}

function updateEnemyMovement(enemy, player, dt, isBlocked) {
  const distanceToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  const distanceFromHome = Math.hypot(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
  let target = null;

  if (distanceFromHome > RETURN_DISTANCE) {
    enemy.state = "returning";
    target = { x: enemy.homeX, y: enemy.homeY };
  } else if (distanceToPlayer <= AGGRO_DISTANCE) {
    enemy.state = "chasing";
    target = player;
  } else if (distanceFromHome > 2) {
    enemy.state = "returning";
    target = { x: enemy.homeX, y: enemy.homeY };
  } else {
    enemy.state = "idle";
    enemy.moving = false;
    return;
  }

  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) {
    enemy.moving = false;
    return;
  }

  const step = Math.min(enemy.speed * dt, distance);
  enemy.moving = moveWithCollision(
    enemy,
    dx / distance * step,
    dy / distance * step,
    isBlocked,
  );
}

function moveWithCollision(enemy, dx, dy, isBlocked, { stopOnBlock = false } = {}) {
  if (stopOnBlock) {
    const nextX = enemy.x + dx;
    const nextY = enemy.y + dy;
    if (isBlocked(nextX, enemy.y, enemy.radius)
      || isBlocked(enemy.x, nextY, enemy.radius)
      || isBlocked(nextX, nextY, enemy.radius)) return false;
    enemy.x = nextX;
    enemy.y = nextY;
    return true;
  }

  let moved = false;
  const nextX = enemy.x + dx;
  if (!isBlocked(nextX, enemy.y, enemy.radius)) {
    enemy.x = nextX;
    moved = true;
  }
  const nextY = enemy.y + dy;
  if (!isBlocked(enemy.x, nextY, enemy.radius)) {
    enemy.y = nextY;
    moved = true;
  }
  return moved;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Temporary compatibility exports keep the game runnable until its orchestration is
// switched to region-aware names in the portal integration task.
export const createSlimes = () => createEnemies("village");
export const damageSlime = damageEnemy;
export const updateSlimes = updateEnemies;
export const drawSlime = drawEnemy;
