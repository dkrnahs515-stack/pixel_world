function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

function clampedAlpha(alpha) {
  return Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
}

function projectilePosition(projectile, alpha) {
  return {
    x: lerp(Number.isFinite(projectile.prevX) ? projectile.prevX : projectile.x, projectile.x, alpha),
    y: lerp(Number.isFinite(projectile.prevY) ? projectile.prevY : projectile.y, projectile.y, alpha),
  };
}

function inViewport(x, y, width, height, margin = 20) {
  return x >= -margin && y >= -margin && x <= width + margin && y <= height + margin;
}

function drawArrow(ctx, piercing) {
  ctx.fillStyle = piercing ? "#f4c95d" : "#d6b16f";
  ctx.fillRect(-8, -1, 15, piercing ? 3 : 2);
  ctx.fillStyle = piercing ? "#fff3b0" : "#e5e7eb";
  ctx.fillRect(5, -3, 4, 6);
  if (piercing) ctx.fillRect(-10, -2, 3, 5);
}

function drawMagicBolt(ctx, explosive) {
  ctx.fillStyle = explosive ? "#f0abfc" : "#7dd3fc";
  ctx.beginPath();
  ctx.arc(0, 0, explosive ? 7 : 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = explosive ? "#fbbf24" : "#e0f2fe";
  ctx.fillRect(-2, -2, 4, 4);
}

export function drawProjectile(ctx, projectile, options = {}) {
  const kinds = new Set(["arrow", "piercing-arrow", "magic-bolt", "explosive-bolt"]);
  if (!projectile || !kinds.has(projectile.kind)) return false;
  const alpha = clampedAlpha(options.alpha);
  const position = projectilePosition(projectile, alpha);
  const x = position.x - (options.cameraX || 0);
  const y = position.y - (options.cameraY || 0);
  const width = Number.isFinite(options.viewWidth) ? options.viewWidth : Infinity;
  const height = Number.isFinite(options.viewHeight) ? options.viewHeight : Infinity;
  if (!inViewport(x, y, width, height)) return false;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(Math.atan2(projectile.directionY || 0, projectile.directionX || 1));
  if (projectile.kind === "arrow" || projectile.kind === "piercing-arrow") {
    drawArrow(ctx, projectile.kind === "piercing-arrow");
  } else {
    drawMagicBolt(ctx, projectile.kind === "explosive-bolt");
  }
  ctx.restore();
  return true;
}

export function drawExplosionEffect(ctx, effect, options = {}) {
  if (!effect || !(effect.duration > 0) || effect.age >= effect.duration) return false;
  const remaining = Math.max(0, 1 - effect.age / effect.duration);
  const scale = Number.isFinite(options.scale) ? Math.max(0, options.scale) : 1;
  const x = effect.x - (options.cameraX || 0);
  const y = effect.y - (options.cameraY || 0);
  ctx.save();
  ctx.globalAlpha = remaining;
  ctx.fillStyle = "#f0abfc";
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, effect.radius * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  return true;
}
