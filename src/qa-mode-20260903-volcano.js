import { normalizeClassId } from "./class-data.js";
import { nextLevelExp } from "./player-progression.js";
import {
  WEAPON_ORDER_BY_CLASS,
  getStarterWeaponId,
  getWeaponDefinition,
} from "./weapon-data-20260903-volcano.js";

const QA_MONSTERS = Object.freeze({
  "fang-shark": Object.freeze({ kind: "fang-shark", name: "송곳니 상어", mapId: "coast" }),
  "pirate-shark": Object.freeze({ kind: "pirate-shark", name: "해적선 상어", mapId: "coast" }),
  "magma-slime": Object.freeze({ kind: "magma-slime", name: "마그마 슬라임", mapId: "volcano" }),
  "flame-imp": Object.freeze({ kind: "flame-imp", name: "불꽃 도깨비", mapId: "volcano" }),
  "ancient-boar": Object.freeze({ kind: "ancient-boar", name: "고대 멧돼지", mapId: "forest" }),
  "moss-troll": Object.freeze({ kind: "moss-troll", name: "이끼 트롤", mapId: "forest" }),
  "ancient-mushroom-bug": Object.freeze({ kind: "ancient-mushroom-bug", name: "고대 버섯충", mapId: "forest" }),
});

const DIRECTION_VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  right: Object.freeze({ x: 1, y: 0 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
});

export function isQaMode(search = "") {
  return new URLSearchParams(search).get("qa") === "1";
}

export function getQaMonster(kind) {
  return Object.prototype.hasOwnProperty.call(QA_MONSTERS, kind)
    ? QA_MONSTERS[kind]
    : null;
}

export function prepareWeaponQaProgress(progress, classId = "warrior") {
  const normalizedClassId = normalizeClassId(classId);
  return {
    ...progress,
    inventory: { ...progress.inventory },
    equipmentByClass: Object.fromEntries(Object.entries(progress.equipmentByClass).map(
      ([equipmentClassId, equipment]) => {
        if (equipmentClassId !== normalizedClassId) {
          return [equipmentClassId, {
            ...equipment,
            ownedWeaponIds: [...equipment.ownedWeaponIds],
          }];
        }
        const owned = new Set(equipment.ownedWeaponIds.filter(
          id => getWeaponDefinition(id)?.classId === normalizedClassId,
        ));
        for (const weaponId of WEAPON_ORDER_BY_CLASS[normalizedClassId]) {
          if (!getWeaponDefinition(weaponId).rewardOnly) owned.add(weaponId);
        }
        const ownedWeaponIds = WEAPON_ORDER_BY_CLASS[normalizedClassId].filter(id => owned.has(id));
        const equippedWeaponId = owned.has(equipment.equippedWeaponId)
          ? equipment.equippedWeaponId
          : getStarterWeaponId(normalizedClassId);
        return [equipmentClassId, { ...equipment, ownedWeaponIds, equippedWeaponId }];
      },
    )),
    completedQuests: [...progress.completedQuests],
    quests: Object.fromEntries(
      Object.entries(progress.quests).map(([questId, quest]) => [questId, { ...quest }]),
    ),
    level: 30,
    exp: 0,
    nextLevelExp: nextLevelExp(30),
    gold: Math.max(progress.gold, 5000),
  };
}

function overlapsPortal(x, y, radius, portals) {
  const padding = radius + 24;
  return portals.some(portal => (
    x >= portal.x - padding
    && x <= portal.x + portal.w + padding
    && y >= portal.y - padding
    && y <= portal.y + portal.h + padding
  ));
}

export function findQaSpawnPosition({ player, radius, isBlocked, portals = [] }) {
  const forward = DIRECTION_VECTORS[player?.dir] || DIRECTION_VECTORS.down;
  const directions = [
    forward,
    { x: -forward.y, y: forward.x },
    { x: forward.y, y: -forward.x },
    { x: -forward.x, y: -forward.y },
  ];

  for (const distance of [140, 200]) {
    for (const direction of directions) {
      const x = player.x + direction.x * distance;
      const y = player.y + direction.y * distance;
      if (isBlocked(x, y, radius)) continue;
      if (overlapsPortal(x, y, radius, portals)) continue;
      return { x, y };
    }
  }
  return null;
}

export function findQaBossApproachPosition({ boss, radius, isBlocked, portals = [] }) {
  if (!Number.isFinite(boss?.x) || !Number.isFinite(boss?.y)) return null;
  const offsets = [
    { x: 0, y: 64 },
    { x: -48, y: 64 },
    { x: 48, y: 64 },
    { x: 0, y: 76 },
  ];

  for (const offset of offsets) {
    const x = boss.x + offset.x;
    const y = boss.y + offset.y;
    if (isBlocked(x, y, radius)) continue;
    if (overlapsPortal(x, y, radius, portals)) continue;
    return { x, y };
  }
  return null;
}
