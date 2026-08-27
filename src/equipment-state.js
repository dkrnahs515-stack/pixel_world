import {
  STARTER_WEAPON_ID,
  WEAPON_ORDER,
  getWeaponDefinition,
} from "./weapon-data.js";

export function createInitialEquipment() {
  return {
    ownedWeaponIds: [STARTER_WEAPON_ID],
    equippedWeaponId: STARTER_WEAPON_ID,
  };
}

export function normalizeEquipment(value) {
  if (!value || !Array.isArray(value.ownedWeaponIds)) return createInitialEquipment();
  const owned = new Set(value.ownedWeaponIds.filter(id => getWeaponDefinition(id)));
  owned.add(STARTER_WEAPON_ID);
  const ownedWeaponIds = WEAPON_ORDER.filter(id => owned.has(id));
  const equippedWeaponId = owned.has(value.equippedWeaponId)
    ? value.equippedWeaponId
    : STARTER_WEAPON_ID;
  return { ownedWeaponIds, equippedWeaponId };
}

function failure(progress, reason, weapon) {
  return { ok: false, reason, weapon, progress };
}

function success(progress, weapon, changes) {
  return {
    ok: true,
    reason: null,
    weapon,
    progress: { ...progress, ...changes },
  };
}

export function buyWeapon(progress, weaponId) {
  const weapon = getWeaponDefinition(weaponId);
  if (!weapon) return failure(progress, "unknown_weapon", null);
  if (weapon.id === STARTER_WEAPON_ID) return failure(progress, "starter_weapon", weapon);
  const equipment = normalizeEquipment(progress.equipment);
  if (equipment.ownedWeaponIds.includes(weapon.id)) {
    return failure(progress, "already_owned", weapon);
  }
  if (progress.level < weapon.requiredLevel) return failure(progress, "level_locked", weapon);
  if (progress.gold < weapon.price) return failure(progress, "insufficient_gold", weapon);
  return success(progress, weapon, {
    gold: progress.gold - weapon.price,
    equipment: {
      ...equipment,
      ownedWeaponIds: WEAPON_ORDER.filter(id => (
        equipment.ownedWeaponIds.includes(id) || id === weapon.id
      )),
    },
  });
}

export function sellWeapon(progress, weaponId) {
  const weapon = getWeaponDefinition(weaponId);
  if (!weapon) return failure(progress, "unknown_weapon", null);
  if (weapon.id === STARTER_WEAPON_ID) return failure(progress, "starter_weapon", weapon);
  const equipment = normalizeEquipment(progress.equipment);
  if (!equipment.ownedWeaponIds.includes(weapon.id)) {
    return failure(progress, "not_owned", weapon);
  }
  return success(progress, weapon, {
    gold: progress.gold + weapon.sellPrice,
    equipment: {
      ownedWeaponIds: equipment.ownedWeaponIds.filter(id => id !== weapon.id),
      equippedWeaponId: STARTER_WEAPON_ID,
    },
  });
}

export function equipWeapon(progress, weaponId) {
  const weapon = getWeaponDefinition(weaponId);
  if (!weapon) return failure(progress, "unknown_weapon", null);
  const equipment = normalizeEquipment(progress.equipment);
  if (!equipment.ownedWeaponIds.includes(weapon.id)) {
    return failure(progress, "not_owned", weapon);
  }
  if (equipment.equippedWeaponId === weapon.id) {
    return failure(progress, "already_equipped", weapon);
  }
  return success(progress, weapon, {
    equipment: { ...equipment, equippedWeaponId: weapon.id },
  });
}
