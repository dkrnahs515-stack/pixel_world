export function createHitEffect({ x, y, kind = "basic" }) {
  const strong = kind === "strong";
  return {
    x,
    y,
    kind: strong ? "strong" : "basic",
    age: 0,
    duration: strong ? 0.28 : 0.18,
    color: strong ? "#fde047" : "#e0f2fe",
    particleCount: strong ? 10 : 6,
    size: strong ? 10 : 6,
    shake: strong ? 6 : 3,
  };
}

export function advanceHitEffects(effects, dt) {
  return (effects ?? [])
    .map(effect => ({ ...effect, age: effect.age + dt }))
    .filter(effect => effect.age < effect.duration);
}

export function hitShakeOffset(effects) {
  let strongest = null;
  let strongestAmount = 0;
  for (const effect of effects ?? []) {
    const remaining = Math.max(0, 1 - effect.age / effect.duration);
    const amount = effect.shake * remaining;
    if (amount > strongestAmount) {
      strongest = effect;
      strongestAmount = amount;
    }
  }
  if (!strongest) return { x: 0, y: 0 };
  const phase = (strongest.age + 0.031) * 120;
  return {
    x: Math.sin(phase) * strongestAmount,
    y: Math.cos(phase * 1.37) * strongestAmount * 0.65,
  };
}

export function drawHitEffects(ctx, effects, cameraX, cameraY) {
  ctx.save();
  for (const effect of effects ?? []) {
    const progress = Math.max(0, Math.min(1, effect.age / effect.duration));
    const x = effect.x - cameraX;
    const y = effect.y - cameraY;
    const centerSize = effect.size * (1 - progress * 0.4);
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = effect.color;
    ctx.fillRect(
      Math.round(x - centerSize / 2),
      Math.round(y - centerSize / 2),
      Math.round(centerSize),
      Math.round(centerSize),
    );
    for (let index = 0; index < effect.particleCount; index += 1) {
      const angle = index * Math.PI * 2 / effect.particleCount;
      const distance = 7 + progress * (effect.kind === "strong" ? 28 : 20);
      const particleSize = effect.kind === "strong" ? 4 : 3;
      ctx.fillRect(
        Math.round(x + Math.cos(angle) * distance - particleSize / 2),
        Math.round(y + Math.sin(angle) * distance - particleSize / 2),
        particleSize,
        particleSize,
      );
    }
  }
  ctx.restore();
}
