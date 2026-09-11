export function createCombatStatusEffects() {
  return { slow: { multiplier: 1, remaining: 0 } };
}

export function applyPlayerSlow(player, multiplier, duration) {
  if (
    player.respawnTimer > 0
    || !Number.isFinite(multiplier)
    || !(multiplier > 0 && multiplier <= 1)
    || !Number.isFinite(duration)
    || !(duration > 0)
  ) return false;

  player.statusEffects ||= createCombatStatusEffects();
  player.statusEffects.slow ||= { multiplier: 1, remaining: 0 };
  player.statusEffects.slow.multiplier = Math.min(player.statusEffects.slow.multiplier, multiplier);
  player.statusEffects.slow.remaining = Math.max(player.statusEffects.slow.remaining, duration);
  return true;
}

export function clearPlayerCombatStatuses(player) {
  player.statusEffects = createCombatStatusEffects();
}

export function playerMovementMultiplier(player) {
  return player.statusEffects?.slow?.remaining > 0 ? player.statusEffects.slow.multiplier : 1;
}

export function applyPlayerDamage(player, amount) {
  if (player.invulnerable > 0 || player.respawnTimer > 0) {
    return { applied: false, died: false };
  }

  player.hp = Math.max(0, player.hp - amount);
  player.invulnerable = 1;
  player.hitFlash = 0.18;
  const died = player.hp === 0;
  if (died) player.respawnTimer = 1.2;
  return { applied: true, died };
}

export function tickPlayerStatus(player, dt) {
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt);
  if (player.respawnTimer > 0) player.respawnTimer = Math.max(0, player.respawnTimer - dt);
  if (player.statusEffects?.slow) {
    player.statusEffects.slow.remaining = Math.max(0, player.statusEffects.slow.remaining - dt);
    if (player.statusEffects.slow.remaining === 0) player.statusEffects.slow.multiplier = 1;
  }
}

export function respawnPlayer(player, spawn = { x: 1440, y: 1110 }) {
  player.x = spawn.x;
  player.y = spawn.y;
  player.prevX = spawn.x;
  player.prevY = spawn.y;
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  player.invulnerable = 0;
  player.hitFlash = 0;
  player.respawnTimer = 0;
  clearPlayerCombatStatuses(player);
}
