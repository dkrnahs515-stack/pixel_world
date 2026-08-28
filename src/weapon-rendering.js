import {
  STARTER_WEAPON_ID,
  getWeaponDefinition,
  resolveWeaponDefinition,
} from "./weapon-data.js";

const DIRECTION_ANGLES = Object.freeze({
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resolveDirectionAngle(direction) {
  return Object.hasOwn(DIRECTION_ANGLES, direction)
    ? DIRECTION_ANGLES[direction]
    : DIRECTION_ANGLES.right;
}

function drawGrip(ctx, visual) {
  ctx.fillStyle = visual.gripColor;
  ctx.fillRect(5, -3, 10, 6);
  ctx.fillStyle = visual.spineColor;
  ctx.fillRect(7, -3, 1, 6);
  ctx.fillRect(11, -3, 1, 6);
  ctx.fillStyle = visual.guardColor;
  ctx.fillRect(14, -6, 3, 12);
}

function drawBlade(ctx, visual) {
  const top = -Math.ceil(visual.bladeWidth / 2);
  ctx.fillStyle = visual.spineColor;
  ctx.fillRect(16, top - 1, visual.bladeLength, 1);
  ctx.fillStyle = visual.bladeColor;
  ctx.fillRect(16, top, visual.bladeLength, visual.bladeWidth);
  ctx.fillStyle = visual.highlightColor;
  ctx.fillRect(18, top, Math.max(1, visual.bladeLength - 5), 1);
}

function drawDecorations(ctx, visual) {
  for (let index = 0; index < visual.goldMarks; index += 1) {
    ctx.fillStyle = "#d4a72c";
    ctx.fillRect(19 + index * 4, 1, 2, 2);
  }
  for (let index = 0; index < visual.redMarks; index += 1) {
    ctx.fillStyle = "#9f2f32";
    ctx.fillRect(21 + index * 5, -2, 2, 1);
  }
  ctx.fillStyle = visual.pommelColor;
  ctx.fillRect(3, -4, 3, 8);
}

function resolveRenderedWeapon(weaponId, classId) {
  if (classId) return resolveWeaponDefinition(weaponId, classId);
  return getWeaponDefinition(weaponId) || resolveWeaponDefinition(STARTER_WEAPON_ID);
}

export function drawSword(ctx, { visual }) {
  drawGrip(ctx, visual);
  drawBlade(ctx, visual);
  drawDecorations(ctx, visual);
}

export function drawBow(ctx, { visual }) {
  const limbLength = visual.limbLength;
  const halfLength = Math.floor(limbLength / 2);
  const limbWidth = visual.limbWidth;
  ctx.fillStyle = visual.woodColor;
  ctx.fillRect(8, -10, halfLength, limbWidth);
  ctx.fillRect(8, 10 - limbWidth, halfLength, limbWidth);
  ctx.fillRect(8 + halfLength - limbWidth, -8, limbWidth, 16);
  ctx.fillStyle = visual.stringColor;
  ctx.fillRect(7, -8, 1, 16);
  ctx.fillStyle = visual.accentColor;
  ctx.fillRect(8 + halfLength - 2, -3, 4, 6);
  for (let index = 0; index < visual.goldMarks; index += 1) {
    ctx.fillStyle = "#d4a72c";
    ctx.fillRect(11 + index * 4, -9, 2, 2);
  }
}

export function drawStaff(ctx, { visual }) {
  const shaftTop = Math.max(8, visual.shaftLength - 7);
  ctx.fillStyle = visual.shaftColor;
  ctx.fillRect(7, -Math.ceil(visual.shaftWidth / 2), shaftTop, visual.shaftWidth);
  ctx.fillStyle = visual.glowColor;
  ctx.fillRect(shaftTop + 3, -6, 8, 12);
  ctx.fillStyle = visual.coreColor;
  ctx.fillRect(shaftTop + 5, -4, 4, 8);
  for (let index = 0; index < visual.goldMarks; index += 1) {
    ctx.fillStyle = "#d4a72c";
    ctx.fillRect(10 + index * 5, -2, 2, 4);
  }
}

export function drawWeapon(
  ctx,
  {
    direction = "down",
    attackState = null,
    classId = null,
    weaponId = STARTER_WEAPON_ID,
    idleSwing = 0.55,
  } = {},
) {
  const weapon = resolveRenderedWeapon(weaponId, classId);
  const visual = weapon.visual;
  const baseAngle = resolveDirectionAngle(direction);
  const progress = attackState
    ? clamp(attackState.elapsed / attackState.definition.duration, 0, 1)
    : 0.5;
  const swingSize = attackState?.kind === "strong" ? 2.2 : 1.45;
  const swing = attackState ? -swingSize / 2 + progress * swingSize : idleSwing;
  ctx.save();
  ctx.rotate(baseAngle + swing);
  if (weapon.weaponType === "bow") drawBow(ctx, { visual });
  else if (weapon.weaponType === "staff") drawStaff(ctx, { visual });
  else drawSword(ctx, { visual });
  ctx.restore();
}

export function drawScabbard(
  ctx,
  { classId = null, direction = "down", weaponId = STARTER_WEAPON_ID } = {},
) {
  const weapon = resolveRenderedWeapon(weaponId, classId);
  if (weapon.weaponType !== "sword") return false;
  const visual = weapon.visual;
  if (!visual.scabbardColor || !visual.scabbardLength) return false;
  const baseAngle = resolveDirectionAngle(direction);
  ctx.save();
  ctx.rotate(baseAngle + Math.PI * 0.72);
  ctx.fillStyle = visual.scabbardColor;
  ctx.fillRect(-18, 5, visual.scabbardLength, 5);
  ctx.fillStyle = visual.scabbardAccentColor;
  ctx.fillRect(-13, 6, 8, 2);
  ctx.fillRect(2, 6, 7, 2);
  for (let index = 0; index < visual.scabbardGoldMarks; index += 1) {
    ctx.fillStyle = "#d4a72c";
    ctx.fillRect(-15 + index * 9, 5, 2, 5);
  }
  ctx.restore();
  return true;
}

export function drawWeaponPreview(canvas, weaponId) {
  const ctx = canvas?.getContext?.("2d");
  if (!ctx) return false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(4, canvas.height / 2);
  drawWeapon(ctx, { direction: "right", weaponId, idleSwing: 0 });
  ctx.restore();
  return true;
}
