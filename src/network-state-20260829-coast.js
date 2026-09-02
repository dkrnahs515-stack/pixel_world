import { normalizeClassId } from "./class-data.js";
import { WORLD_IDS, getWorldDefinition } from "./world-data-20260829-coast.js";
import { resolveWeaponDefinition } from "./weapon-data.js";

export function serializePlayerState(player, mapId) {
  if (!WORLD_IDS.includes(mapId)) return null;
  const world = getWorldDefinition(mapId);
  if (!Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return null;
  if (player.x < 0 || player.y < 0 || player.x > world.width || player.y > world.height) return null;
  const classId = normalizeClassId(player.classId);
  return {
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    hp: Number.isFinite(player.hp) ? Math.max(0, Math.round(player.hp * 10) / 10) : 100,
    dir: player.dir,
    moving: Boolean(player.moving),
    color: player.color,
    name: player.name,
    mapId,
    classId,
    equippedWeaponId: resolveWeaponDefinition(player.equippedWeaponId, classId).id,
  };
}

export function filterPlayersForMap(rawPlayers, ownUid, activeMapId) {
  if (!WORLD_IDS.includes(activeMapId)) return new Map();
  const mapId = activeMapId;
  const world = getWorldDefinition(mapId);
  const players = new Map();

  Object.entries(rawPlayers || {}).forEach(([uid, raw]) => {
    if (uid === ownUid || raw?.mapId !== mapId) return;
    if (!Number.isFinite(raw?.x) || !Number.isFinite(raw?.y)) return;
    if (raw.x < 0 || raw.y < 0 || raw.x > world.width || raw.y > world.height) return;
    const classId = normalizeClassId(raw.classId);
    players.set(uid, {
      ...raw,
      hp: Number.isFinite(raw.hp) ? Math.max(0, raw.hp) : 100,
      mapId,
      classId,
      equippedWeaponId: resolveWeaponDefinition(raw.equippedWeaponId, classId).id,
    });
  });

  return players;
}
