const IDLE_SECONDS = 5.5;
const WARNING_SECONDS = 1.5;
const RECOVERY_SECONDS = 1;
const TARGET_DISTANCE = 150;
const IMPACT_RADIUS = 110;
const IMPACT_DAMAGE = 20;

const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

export function createVolcanoEruptionState() {
  return { phase: "idle", elapsed: 0, target: null, cycle: 0 };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function targetCoordinate(value, size) {
  if (!(size > 0)) return value;
  const minimum = Math.min(IMPACT_RADIUS, size / 2);
  const maximum = Math.max(minimum, size - IMPACT_RADIUS);
  return clamp(value, minimum, maximum);
}

function lockTarget(context) {
  const player = context?.player || {};
  const world = context?.world || {};
  const direction = DIRECTIONS[player.dir] || DIRECTIONS.down;
  const x = Number.isFinite(player.x) ? player.x : Number(world.width) / 2 || 0;
  const y = Number.isFinite(player.y) ? player.y : Number(world.height) / 2 || 0;
  return {
    x: Math.round(targetCoordinate(x + direction.x * TARGET_DISTANCE, Number(world.width))),
    y: Math.round(targetCoordinate(y + direction.y * TARGET_DISTANCE, Number(world.height))),
  };
}

function impactEvent(target) {
  return {
    type: "eruption-impact",
    damage: IMPACT_DAMAGE,
    radius: IMPACT_RADIUS,
    x: target.x,
    y: target.y,
  };
}

function normalizedState(value) {
  if (!value || !["idle", "warning", "impact", "recovery"].includes(value.phase)) {
    return createVolcanoEruptionState();
  }
  return {
    phase: value.phase,
    elapsed: Number.isFinite(value.elapsed) ? Math.max(0, value.elapsed) : 0,
    target: value.target && Number.isFinite(value.target.x) && Number.isFinite(value.target.y)
      ? { x: value.target.x, y: value.target.y }
      : null,
    cycle: Number.isInteger(value.cycle) && value.cycle >= 0 ? value.cycle : 0,
  };
}

export function advanceVolcanoEruption(state, dt, context = {}) {
  if (!context.active || context.paused || !(dt > 0) || !Number.isFinite(dt)) {
    return { state, events: [] };
  }

  let next = normalizedState(state);
  let remaining = dt;
  const events = [];
  while (remaining > 0) {
    if (next.phase === "impact") {
      next = { ...next, phase: "recovery", elapsed: 0 };
      continue;
    }

    const duration = next.phase === "idle"
      ? IDLE_SECONDS
      : next.phase === "warning" ? WARNING_SECONDS : RECOVERY_SECONDS;
    const untilBoundary = Math.max(0, duration - next.elapsed);
    const consumed = Math.min(remaining, untilBoundary);
    next = { ...next, elapsed: next.elapsed + consumed };
    remaining -= consumed;
    if (next.elapsed < duration) break;

    if (next.phase === "idle") {
      next = { ...next, phase: "warning", elapsed: 0, target: lockTarget(context) };
    } else if (next.phase === "warning") {
      const target = next.target || lockTarget(context);
      events.push(impactEvent(target));
      next = { ...next, phase: "impact", elapsed: 0, target };
    } else {
      next = { phase: "idle", elapsed: 0, target: null, cycle: next.cycle + 1 };
    }

    if (remaining === 0) break;
  }
  return { state: next, events };
}

function warningTelegraph(ctx, state, x, y) {
  const progress = Math.max(0, Math.min(1, state.elapsed / WARNING_SECONDS));
  const pulse = 0.7 + Math.sin(progress * Math.PI * 8) * 0.15;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = progress > 0.65 ? "#fff3a3" : "#fb923c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, IMPACT_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(12, IMPACT_RADIUS * (1 - progress)), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 18, y);
  ctx.lineTo(x + 18, y);
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x, y + 18);
  ctx.stroke();
  ctx.restore();
}

function impactFlash(ctx, x, y) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.arc(x, y, IMPACT_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.arc(x, y, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function recoveryDebris(ctx, state, x, y) {
  const progress = Math.max(0, Math.min(1, state.elapsed / RECOVERY_SECONDS));
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.fillStyle = "#7c2d12";
  for (let index = 0; index < 10; index++) {
    const angle = index * Math.PI * 2 / 10;
    const distance = 24 + progress * 74 + index % 3 * 5;
    const size = 9 + index % 4 * 3;
    ctx.fillRect(
      Math.round(x + Math.cos(angle) * distance - size / 2),
      Math.round(y + Math.sin(angle) * distance - size / 2),
      size,
      size,
    );
  }
  ctx.restore();
}

export function drawVolcanoEruption(ctx, state, {
  cameraX = 0,
  cameraY = 0,
  active = true,
} = {}) {
  if (!ctx || !active || !state?.target || state.phase === "idle") return;
  const x = Math.round(state.target.x - cameraX);
  const y = Math.round(state.target.y - cameraY);
  if (state.phase === "warning") warningTelegraph(ctx, state, x, y);
  else if (state.phase === "impact") impactFlash(ctx, x, y);
  else if (state.phase === "recovery") recoveryDebris(ctx, state, x, y);
}
