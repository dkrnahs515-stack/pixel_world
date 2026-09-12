export function findNearbyNpc(npcs, player) {
  if (!Array.isArray(npcs) || !player) return null;

  let nearest = null;
  let nearestDistance = Infinity;
  for (const npc of npcs) {
    if (!npc || !Number.isFinite(npc.x) || !Number.isFinite(npc.y)) continue;
    const distance = Math.hypot(player.x - npc.x, player.y - npc.y);
    if (distance <= npc.interactionRadius && distance < nearestDistance) {
      nearest = npc;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function drawNpc(ctx, npc, cameraX = 0, cameraY = 0) {
  if (!ctx || !npc) return;

  const x = Math.round(npc.x - cameraX);
  const y = Math.round(npc.y - cameraY);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(x - 13, y + 14, 26, 7);
  if (npc.role === "blacksmith") drawBlacksmith(ctx, npc, x, y);
  else drawGenericNpc(ctx, npc, x, y);
  drawLabel(ctx, npc.name, x, y - 38);
  ctx.restore();
}

function drawGenericNpc(ctx, npc, x, y) {
  ctx.fillStyle = "#51372a";
  ctx.fillRect(x - 10, y + 7, 8, 14);
  ctx.fillRect(x + 2, y + 7, 8, 14);
  ctx.fillStyle = npc.coatColor || "#6f5bd3";
  ctx.fillRect(x - 13, y - 12, 26, 21);
  ctx.fillStyle = "#e8b78c";
  ctx.fillRect(x - 8, y - 25, 16, 14);
  ctx.fillStyle = "#4a3328";
  ctx.fillRect(x - 9, y - 29, 18, 6);
}

function drawBlacksmith(ctx, npc, x, y) {
  const appearance = npc.appearance;
  ctx.fillStyle = "#302820";
  ctx.fillRect(x - 10, y + 7, 8, 14);
  ctx.fillRect(x + 2, y + 7, 8, 14);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(x - 13, y - 12, 26, 21);
  ctx.fillStyle = appearance.apronColor;
  ctx.fillRect(x - 11, y - 8, 22, 20);
  ctx.fillRect(x - 4, y + 9, 8, 7);
  ctx.fillStyle = "#e8b78c";
  ctx.fillRect(x - 8, y - 25, 16, 14);
  ctx.fillStyle = appearance.hairColor;
  ctx.fillRect(x - 9, y - 29, 18, 7);
  ctx.fillRect(x - 9, y - 23, 4, 7);
  ctx.fillStyle = appearance.eyeColor;
  ctx.fillRect(x - 5, y - 19, 2, 2);
  ctx.fillRect(x + 3, y - 19, 2, 2);
}

function drawLabel(ctx, text, x, y) {
  ctx.textAlign = "center";
  ctx.font = "900 21px sans-serif";
  ctx.fillStyle = "rgba(6, 10, 20, .82)";
  ctx.fillText(text, x + 2, y + 3);
  ctx.fillStyle = "#fff7db";
  ctx.fillText(text, x, y);
}
