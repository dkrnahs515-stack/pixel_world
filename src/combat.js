const ATTACK_DEFINITIONS = Object.freeze({
  basic: Object.freeze({
    damage: 1,
    cooldown: 0.5,
    range: 64,
    arcDegrees: 120,
    windup: 0,
    duration: 0.18,
    mpCost: 0,
    knockback: 230,
    hitStun: 0.1,
    hitStop: 0.035,
  }),
  strong: Object.freeze({
    damage: 3,
    cooldown: 4,
    range: 96,
    arcDegrees: 150,
    windup: 0.22,
    duration: 0.4,
    mpCost: 20,
    knockback: 520,
    hitStun: 0.18,
    hitStop: 0.065,
  }),
});

export function directionVector(direction) {
  return {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[direction] || { x: 0, y: 1 };
}

export function attackDefinition(kind) {
  return ATTACK_DEFINITIONS[kind] || ATTACK_DEFINITIONS.basic;
}

export function isTargetInAttackArc(origin, direction, target, range, arcDegrees) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const targetRadius = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
  if (distance > range + targetRadius) return false;
  if (distance <= targetRadius) return true;

  const facing = directionVector(direction);
  const cosine = Math.max(-1, Math.min(1, (facing.x * dx + facing.y * dy) / distance));
  const halfArcRadians = (arcDegrees * Math.PI / 180) / 2;
  if (halfArcRadians >= Math.PI || Math.acos(cosine) <= halfArcRadians) return true;

  const side = facing.x * dy - facing.y * dx >= 0 ? 1 : -1;
  const boundaryCosine = Math.cos(halfArcRadians);
  const boundarySine = Math.sin(halfArcRadians) * side;
  const boundaryX = facing.x * boundaryCosine - facing.y * boundarySine;
  const boundaryY = facing.x * boundarySine + facing.y * boundaryCosine;
  const projection = Math.max(0, Math.min(range, dx * boundaryX + dy * boundaryY));
  return Math.hypot(dx - boundaryX * projection, dy - boundaryY * projection) <= targetRadius;
}
