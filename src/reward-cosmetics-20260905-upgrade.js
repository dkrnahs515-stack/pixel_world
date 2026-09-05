import { rewardCodeEffects } from './reward-codes-20260905-upgrade.js';

// Recompute on every entry and mode transition so solo privileges never leak online.
export function applyRewardModifiers(player, progress, mode) {
  const effects = rewardCodeEffects(progress, mode);
  player.skinId = effects.skinId;
  player.immortal = effects.immortal;
  player.pencilWeapon = effects.pencilWeapon;
  player.rewardMode = mode;
  return effects;
}

// Coordinates are relative to the character's feet, as in the ordinary body renderer.
export function drawSlimeBody(ctx, player) {
  ctx.save();
  ctx.fillStyle = player.hitFlash > 0 ? '#fca5a5' : '#6ee7b7';
  ctx.fillRect(-15, -8, 30, 23);
  ctx.fillRect(-11, -15, 22, 8);
  ctx.fillRect(-6, -19, 12, 5);
  ctx.fillRect(-19, 1, 5, 12);
  ctx.fillRect(14, 1, 5, 12);
  ctx.fillStyle = '#059669';
  ctx.fillRect(-14, 12, 28, 5);
  ctx.fillStyle = '#d1fae5';
  ctx.fillRect(-9, -12, 7, 4);
  ctx.fillRect(-13, -6, 3, 5);
  const facing = player.dir === 'left' ? -4 : player.dir === 'right' ? 4 : 0;
  if (player.dir !== 'up') {
    ctx.fillStyle = '#123b38';
    ctx.fillRect(facing - 6, -3, 3, 5);
    ctx.fillRect(facing + 4, -3, 3, 5);
    ctx.fillRect(facing - 2, 5, 5, 2);
  }
  ctx.restore();
}

export function drawPencilWeapon(ctx, { dir = 'down', attackState = null } = {}) {
  ctx.save();
  const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir] ?? Math.PI / 2;
  ctx.rotate(angle);
  ctx.translate(12, -5);
  if (attackState) ctx.rotate(-0.25);
  ctx.fillStyle = '#facc15'; ctx.fillRect(0, -3, 27, 6);
  ctx.fillStyle = '#ca8a04'; ctx.fillRect(0, 2, 27, 2);
  ctx.fillStyle = '#fde68a'; ctx.fillRect(27, -2, 5, 4);
  ctx.fillStyle = '#1f2937'; ctx.fillRect(32, -1, 4, 2);
  ctx.fillStyle = '#d1d5db'; ctx.fillRect(-4, -3, 4, 6);
  ctx.fillStyle = '#fb7185'; ctx.fillRect(-9, -3, 5, 6);
  ctx.restore();
}
