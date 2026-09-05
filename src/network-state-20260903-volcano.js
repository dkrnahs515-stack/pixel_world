import { normalizeSkillResource } from "./skill-validation.js";
import { statsForLevel } from "./player-progression.js";
import { normalizeClassId } from "./class-data.js";
import { WORLD_IDS, getWorldDefinition } from "./world-data-20260903-volcano.js";
import { WEAPON_ORDER as LEGACY_SWORD_WEAPON_IDS } from "./weapon-data.js";
import { resolveWeaponDefinition } from "./weapon-data-20260903-volcano.js";

function skillResources(player, classId) {
  const maxMp = statsForLevel(Number.isInteger(player.level) && player.level > 0 ? Math.min(10000, player.level) : 1, classId).maxMp;
  return Object.fromEntries(["skill-e", "skill-r"].flatMap(kind => {
    const cast = normalizeSkillResource(player.skillResources?.[kind], maxMp);
    return cast ? [[kind, cast]] : [];
  }));
}

function resolvePresenceWeaponId(weaponId, rawClassId) {
  const classId = normalizeClassId(rawClassId);
  const hasExplicitClass = rawClassId === classId;
  if (!hasExplicitClass && !LEGACY_SWORD_WEAPON_IDS.includes(weaponId)) {
    return resolveWeaponDefinition(undefined, classId).id;
  }
  return resolveWeaponDefinition(weaponId, classId).id;
}

export function serializePlayerState(player, mapId) {
  if (!WORLD_IDS.includes(mapId)) return null;
  const world = getWorldDefinition(mapId);
  if (!Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return null;
  if (player.x < 0 || player.y < 0 || player.x > world.width || player.y > world.height) return null;
  const classId = normalizeClassId(player.classId);
  return {
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    level: Number.isInteger(player.level) && player.level > 0 && player.level <= 10000 ? player.level : 1,
    mp: Number.isFinite(player.mp) ? Math.max(0, Math.min(player.mp, statsForLevel(Number.isInteger(player.level) && player.level > 0 ? Math.min(10000, player.level) : 1, classId).maxMp)) : 0,
    hp: Number.isFinite(player.hp) ? Math.max(0, Math.round(player.hp * 10) / 10) : 100,
    dir: player.dir,
    moving: Boolean(player.moving),
    color: player.color,
    name: player.name,
    mapId,
    skillResources: skillResources(player, classId),
    classId,
    skinId: player.skinId === 'slime' ? 'slime' : 'default',
    equippedWeaponId: resolvePresenceWeaponId(player.equippedWeaponId, player.classId),
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
      skinId: raw.skinId === "slime" ? "slime" : "default",
      immortal: false,
      pencilWeapon: false,
      level: Number.isInteger(raw.level) && raw.level > 0 && raw.level <= 10000 ? raw.level : 1,
      mp: Number.isFinite(raw.mp) ? Math.max(0, Math.min(raw.mp, statsForLevel(Number.isInteger(raw.level) && raw.level > 0 ? Math.min(10000, raw.level) : 1, classId).maxMp)) : 0,
      hp: Number.isFinite(raw.hp) ? Math.max(0, raw.hp) : 100,
      mapId,
      skillResources: skillResources(raw, classId),
      classId,
      equippedWeaponId: resolvePresenceWeaponId(raw.equippedWeaponId, raw.classId),
    });
  });

  return players;
}
