import { skillDefinition } from "./skill-data.js";
import { statsForLevel } from "./player-progression.js";
import { CLASS_IDS, DEFAULT_CLASS_ID, normalizeClassId } from "./class-data.js";
import { resolveWeaponDefinition } from "./weapon-data-20260903-volcano.js";

const BASIC_HIT_EFFECT = Object.freeze({
  windup: 0,
  duration: 0.18,
  mpCost: 0,
  knockback: 230,
  hitStun: 0.1,
  hitStop: 0.035,
});

const STRONG_HIT_EFFECT = Object.freeze({
  windup: 0.22,
  duration: 0.4,
  knockback: 520,
  hitStun: 0.18,
  hitStop: 0.065,
});

function combatNumber(value) {
  return Number(value.toFixed(4));
}

function attackArguments(classId, weaponId) {
  if (weaponId === undefined && !CLASS_IDS.includes(classId)) {
    return { classId: DEFAULT_CLASS_ID, weaponId: classId };
  }
  return { classId: normalizeClassId(classId), weaponId };
}

function warriorAttack(kind, weapon) {
  if (kind === "strong") {
    return {
      delivery: "melee",
      damage: combatNumber(weapon.damage * 2),
      cooldown: weapon.strongCooldown,
      range: weapon.range + 28,
      arcDegrees: 360,
      ...STRONG_HIT_EFFECT,
      mpCost: 20,
    };
  }
  return {
    delivery: "melee",
    damage: weapon.damage,
    cooldown: 0.5,
    range: weapon.range,
    arcDegrees: 120,
    ...BASIC_HIT_EFFECT,
  };
}

function archerAttack(kind, weapon) {
  if (kind === "strong") {
    return {
      delivery: "projectile",
      projectileKind: "piercing-arrow",
      damage: combatNumber(weapon.damage * 2.2),
      cooldown: weapon.strongCooldown,
      range: combatNumber(weapon.range * 1.35),
      speed: combatNumber(weapon.projectileSpeed * 1.1),
      maxHits: 5,
      ...STRONG_HIT_EFFECT,
      mpCost: 25,
    };
  }
  return {
    delivery: "projectile",
    projectileKind: "arrow",
    damage: weapon.damage,
    cooldown: 0.55,
    range: weapon.range,
    speed: weapon.projectileSpeed,
    ...BASIC_HIT_EFFECT,
  };
}

function mageAttack(kind, weapon) {
  if (kind === "strong") {
    return {
      delivery: "projectile",
      projectileKind: "explosive-bolt",
      damage: combatNumber(weapon.damage * 2.4),
      cooldown: weapon.strongCooldown,
      range: combatNumber(weapon.range * 1.25),
      speed: weapon.projectileSpeed,
      explosionRadius: weapon.explosionRadius,
      ...STRONG_HIT_EFFECT,
      mpCost: 30,
    };
  }
  return {
    delivery: "projectile",
    projectileKind: "magic-bolt",
    damage: weapon.damage,
    cooldown: 0.65,
    range: weapon.range,
    speed: weapon.projectileSpeed,
    ...BASIC_HIT_EFFECT,
  };
}

export function directionVector(direction) {
  return {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[direction] || { x: 0, y: 1 };
}

export function attackDefinition(kind, classId = DEFAULT_CLASS_ID, weaponId, level = 1) {
  const normalizedKind = kind === "strong" ? "strong" : "basic";
  const args = attackArguments(classId, weaponId);
  const base = resolveWeaponDefinition(args.weaponId, args.classId);
  const weapon = { ...base, damage: base.damage + statsForLevel(Number.isInteger(level) && level > 0 ? level : 1, args.classId).attackBonus };
  const skill = skillDefinition(kind, args.classId, weapon.damage);
  if (skill) return skill;
  if (args.classId === "archer") return archerAttack(normalizedKind, weapon);
  if (args.classId === "mage") return mageAttack(normalizedKind, weapon);
  return warriorAttack(normalizedKind, weapon);
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
