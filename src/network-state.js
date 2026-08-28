import { normalizeClassId } from "./class-data.js";
import { getWorldDefinition, normalizeWorldId } from "./world-data.js";
import { resolveWeaponDefinition } from "./weapon-data.js";

export function serializePlayerState(player, mapId) {
  const classId = normalizeClassId(player.classId);
  return {
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    dir: player.dir,
    moving: Boolean(player.moving),
    color: player.color,
    name: player.name,
    mapId: normalizeWorldId(mapId),
    classId,
    equippedWeaponId: resolveWeaponDefinition(player.equippedWeaponId, classId).id,
  };
}

export function filterPlayersForMap(rawPlayers, ownUid, activeMapId) {
  const mapId = normalizeWorldId(activeMapId);
  const world = getWorldDefinition(mapId);
  const players = new Map();

  Object.entries(rawPlayers || {}).forEach(([uid, raw]) => {
    if (uid === ownUid || normalizeWorldId(raw?.mapId) !== mapId) return;
    if (!Number.isFinite(raw?.x) || !Number.isFinite(raw?.y)) return;
    if (raw.x < 0 || raw.y < 0 || raw.x > world.width || raw.y > world.height) return;
    const classId = normalizeClassId(raw.classId);
    players.set(uid, {
      ...raw,
      mapId,
      classId,
      equippedWeaponId: resolveWeaponDefinition(raw.equippedWeaponId, classId).id,
    });
  });

  return players;
}
