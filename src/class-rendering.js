import { normalizeClassId } from "./class-data.js";

function drawAdventurer(ctx, centerX, top, color) {
  ctx.fillStyle = "#f1c7a5";
  ctx.fillRect(centerX - 5, top, 10, 10);
  ctx.fillStyle = color;
  ctx.fillRect(centerX - 8, top + 11, 16, 22);
  ctx.fillStyle = "#172033";
  ctx.fillRect(centerX - 8, top + 33, 6, 13);
  ctx.fillRect(centerX + 2, top + 33, 6, 13);
}

function drawWarrior(ctx, centerX, top) {
  drawAdventurer(ctx, centerX, top, "#4f8e5b");
  ctx.fillStyle = "#d4a72c";
  ctx.fillRect(centerX + 8, top + 17, 10, 4);
  ctx.fillStyle = "#e5edf7";
  ctx.fillRect(centerX + 16, top - 2, 4, 24);
  ctx.fillStyle = "#8b5e3c";
  ctx.fillRect(centerX + 16, top + 22, 4, 9);
}

function drawArcher(ctx, centerX, top) {
  drawAdventurer(ctx, centerX, top, "#3f7d63");
  ctx.strokeStyle = "#d6b16f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX + 14, top + 20, 15, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX + 14, top + 5);
  ctx.lineTo(centerX + 14, top + 35);
  ctx.stroke();
  ctx.fillStyle = "#795548";
  ctx.fillRect(centerX - 13, top + 14, 5, 25);
  ctx.fillStyle = "#f4c95d";
  ctx.fillRect(centerX - 15, top + 10, 9, 5);
}

function drawMage(ctx, centerX, top) {
  drawAdventurer(ctx, centerX, top, "#6651a8");
  ctx.fillStyle = "#795548";
  ctx.fillRect(centerX + 15, top + 8, 4, 35);
  ctx.fillStyle = "#c084fc";
  ctx.fillRect(centerX + 11, top + 1, 12, 12);
  ctx.fillStyle = "#f0abfc";
  ctx.fillRect(centerX + 14, top + 4, 6, 6);
}

export function drawClassPreview(ctx, classId) {
  const width = ctx.canvas?.width || 96;
  const height = ctx.canvas?.height || 72;
  const normalizedClassId = normalizeClassId(classId);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#101827";
  ctx.fillRect(0, 0, width, height);
  const centerX = Math.round(width / 2) - 3;
  const top = Math.max(8, Math.round((height - 48) / 2));
  if (normalizedClassId === "archer") drawArcher(ctx, centerX, top);
  else if (normalizedClassId === "mage") drawMage(ctx, centerX, top);
  else drawWarrior(ctx, centerX, top);
  ctx.restore();
}

export function drawClassEquipment(ctx, { classId, direction = "down" } = {}) {
  const normalizedClassId = normalizeClassId(classId);
  if (normalizedClassId === "archer") {
    const side = direction === "left" ? 1 : -1;
    ctx.fillStyle = "#795548";
    ctx.fillRect(side * 9 - (side < 0 ? 5 : 0), -14, 5, 24);
    ctx.fillStyle = "#f4c95d";
    ctx.fillRect(side * 11 - (side < 0 ? 7 : 0), -19, 2, 8);
    ctx.fillRect(side * 7 - (side < 0 ? 3 : 0), -18, 2, 7);
  } else if (normalizedClassId === "mage") {
    ctx.fillStyle = "#c084fc";
    ctx.fillRect(-3, -7, 6, 2);
    ctx.fillRect(-1, -9, 2, 6);
  }
}
