import { DEFAULT_CLASS_ID, CLASS_IDS, normalizeClassId } from "./class-data.js";
import {
  VOLCANO_HIDDEN_WEAPON_IDS,
  WEAPON_ORDER_BY_CLASS,
  getStarterWeaponId,
  getWeaponDefinition,
} from "./weapon-data-20260903-volcano.js";
import { resolveVolcanoCaptain } from "./chapter-progress-20260903-volcano.js";

export function createInitialClassEquipment(classId = DEFAULT_CLASS_ID) {
  const starterWeaponId = getStarterWeaponId(classId);
  return { ownedWeaponIds: [starterWeaponId], equippedWeaponId: starterWeaponId };
}

export function createInitialEquipmentByClass() {
  return Object.fromEntries(CLASS_IDS.map(classId => [classId, createInitialClassEquipment(classId)]));
}

export function normalizeClassEquipment(classId, value) {
  const normalizedClassId = normalizeClassId(classId);
  const starterWeaponId = getStarterWeaponId(normalizedClassId);
  if (!value || !Array.isArray(value.ownedWeaponIds)) return createInitialClassEquipment(normalizedClassId);
  const owned = new Set(value.ownedWeaponIds.filter(id => getWeaponDefinition(id)?.classId === normalizedClassId));
  owned.add(starterWeaponId);
  const ownedWeaponIds = WEAPON_ORDER_BY_CLASS[normalizedClassId].filter(id => owned.has(id));
  const equippedWeaponId = owned.has(value.equippedWeaponId) ? value.equippedWeaponId : starterWeaponId;
  return { ownedWeaponIds, equippedWeaponId };
}

export function normalizeEquipmentByClass(value) {
  return Object.fromEntries(CLASS_IDS.map(classId => [
    classId,
    normalizeClassEquipment(classId, value?.[classId]),
  ]));
}

export function getClassEquipment(progress, classId = DEFAULT_CLASS_ID) {
  const normalizedClassId = normalizeClassId(classId);
  return normalizeClassEquipment(normalizedClassId, progress?.equipmentByClass?.[normalizedClassId]);
}

export function createInitialEquipment() {
  return createInitialClassEquipment(DEFAULT_CLASS_ID);
}

export function normalizeEquipment(value) {
  return normalizeClassEquipment(DEFAULT_CLASS_ID, value);
}

function failure(progress, reason, weapon) {
  return { ok: false, reason, weapon, progress };
}

function success(progress, weapon, changes) {
  return { ok: true, reason: null, weapon, progress: { ...progress, ...changes } };
}

function operationContext(progress, classIdOrWeaponId, weaponId) {
  const legacy = weaponId === undefined;
  const classId = legacy ? DEFAULT_CLASS_ID : normalizeClassId(classIdOrWeaponId);
  const resolvedWeaponId = legacy ? classIdOrWeaponId : weaponId;
  const equipmentByClass = legacy ? null : (progress.equipmentByClass || createInitialEquipmentByClass());
  const equipment = legacy
    ? normalizeClassEquipment(classId, progress.equipment)
    : normalizeClassEquipment(classId, equipmentByClass[classId]);
  return { legacy, classId, weaponId: resolvedWeaponId, equipmentByClass, equipment };
}

function equipmentChanges(context, classEquipment) {
  if (context.legacy) return { equipment: classEquipment };
  return {
    equipmentByClass: { ...context.equipmentByClass, [context.classId]: classEquipment },
  };
}

function validateWeaponForContext(progress, context) {
  const weapon = getWeaponDefinition(context.weaponId);
  if (!weapon) return { failure: failure(progress, "unknown_weapon", null), weapon: null };
  if (weapon.classId !== context.classId) {
    return { failure: failure(progress, "class_mismatch", weapon), weapon };
  }
  return { failure: null, weapon };
}

export function buyWeapon(progress, classIdOrWeaponId, weaponId) {
  const context = operationContext(progress, classIdOrWeaponId, weaponId);
  const validation = validateWeaponForContext(progress, context);
  if (validation.failure) return validation.failure;
  const { weapon } = validation;
  if (weapon.rewardOnly) return failure(progress, "reward_only", weapon);
  if (weapon.id === getStarterWeaponId(context.classId)) return failure(progress, "starter_weapon", weapon);
  if (context.equipment.ownedWeaponIds.includes(weapon.id)) return failure(progress, "already_owned", weapon);
  if (progress.level < weapon.requiredLevel) return failure(progress, "level_locked", weapon);
  if (progress.gold < weapon.price) return failure(progress, "insufficient_gold", weapon);
  const owned = new Set([...context.equipment.ownedWeaponIds, weapon.id]);
  const classEquipment = {
    ...context.equipment,
    ownedWeaponIds: WEAPON_ORDER_BY_CLASS[context.classId].filter(id => owned.has(id)),
  };
  return success(progress, weapon, {
    gold: progress.gold - weapon.price,
    ...equipmentChanges(context, classEquipment),
  });
}

export function sellWeapon(progress, classIdOrWeaponId, weaponId) {
  const context = operationContext(progress, classIdOrWeaponId, weaponId);
  const validation = validateWeaponForContext(progress, context);
  if (validation.failure) return validation.failure;
  const { weapon } = validation;
  if (weapon.rewardOnly) return failure(progress, "reward_only", weapon);
  const starterWeaponId = getStarterWeaponId(context.classId);
  if (weapon.id === starterWeaponId) return failure(progress, "starter_weapon", weapon);
  if (!context.equipment.ownedWeaponIds.includes(weapon.id)) return failure(progress, "not_owned", weapon);
  const classEquipment = {
    ownedWeaponIds: context.equipment.ownedWeaponIds.filter(id => id !== weapon.id),
    equippedWeaponId: context.equipment.equippedWeaponId === weapon.id
      ? starterWeaponId
      : context.equipment.equippedWeaponId,
  };
  return success(progress, weapon, {
    gold: progress.gold + weapon.sellPrice,
    ...equipmentChanges(context, classEquipment),
  });
}

export function equipWeapon(progress, classIdOrWeaponId, weaponId) {
  const context = operationContext(progress, classIdOrWeaponId, weaponId);
  const validation = validateWeaponForContext(progress, context);
  if (validation.failure) return validation.failure;
  const { weapon } = validation;
  if (!context.equipment.ownedWeaponIds.includes(weapon.id)) return failure(progress, "not_owned", weapon);
  if (context.equipment.equippedWeaponId === weapon.id) return failure(progress, "already_equipped", weapon);
  return success(progress, weapon, equipmentChanges(context, {
    ...context.equipment,
    equippedWeaponId: weapon.id,
  }));
}

export function grantVolcanoHiddenWeapons(progress) {
  const captain = resolveVolcanoCaptain(progress?.worldProgress);
  const volcano = captain.progress.chapters.volcano;
  if (volcano.captainOutcome === "lost") {
    return { ok: false, reason: "reward_only_rescue", progress };
  }
  if (volcano.captainOutcome !== "rescued" || !volcano.hiddenWeaponRewardClaimed) {
    return { ok: false, reason: "unavailable", progress };
  }
  const alreadyClaimed = CLASS_IDS.every(classId => (
    progress?.equipmentByClass?.[classId]?.ownedWeaponIds?.includes(
      VOLCANO_HIDDEN_WEAPON_IDS[classId],
    )
  ));
  if (alreadyClaimed) return { ok: false, reason: "already_claimed", progress };
  const equipmentByClass = normalizeEquipmentByClass(progress?.equipmentByClass);
  for (const classId of CLASS_IDS) {
    const hiddenWeaponId = VOLCANO_HIDDEN_WEAPON_IDS[classId];
    const owned = new Set([...equipmentByClass[classId].ownedWeaponIds, hiddenWeaponId]);
    equipmentByClass[classId] = {
      ...equipmentByClass[classId],
      ownedWeaponIds: WEAPON_ORDER_BY_CLASS[classId].filter(id => owned.has(id)),
    };
  }
  return {
    ok: true,
    reason: null,
    weaponIds: Object.values(VOLCANO_HIDDEN_WEAPON_IDS),
    progress: { ...progress, worldProgress: captain.progress, equipmentByClass },
    effects: [{ type: "hidden-weapons-granted", weaponIds: Object.values(VOLCANO_HIDDEN_WEAPON_IDS) }],
  };
}
