import { REWARD_POTION_LIMIT, normalizeRedeemedCodeIds } from "./reward-codes.js";
import {
  ADVENTURE_QUEST,
  createInitialProgress,
} from "./quest-state-20260903-volcano.js";
import {
  grantProgressReward,
  nextLevelExp,
} from "./player-progression.js";
import {
  createInitialEquipmentByClass,
  normalizeClassEquipment,
  normalizeEquipmentByClass,
} from "./equipment-state-20260903-volcano.js";
import { normalizeWorldProgress } from "./chapter-progress-20260903-volcano.js";

const STORAGE_VERSION = 7;
const STORAGE_PREFIX = "pixel-world.progress.v7:";
const V6_STORAGE_PREFIX = "pixel-world.progress.v6:";
const V6_STORAGE_VERSION = 6;
const V5_STORAGE_PREFIX = "pixel-world.progress.v5:";
const V5_STORAGE_VERSION = 5;
const V4_STORAGE_PREFIX = "pixel-world.progress.v4:";
const V4_STORAGE_VERSION = 4;
const V3_STORAGE_PREFIX = "pixel-world.progress.v3:";
const V3_STORAGE_VERSION = 3;
const V2_STORAGE_PREFIX = "pixel-world.progress.v2:";
const V2_STORAGE_VERSION = 2;
const LEGACY_STORAGE_PREFIX = "pixel-world.progress.v1:";
const LEGACY_STORAGE_VERSION = 1;
const VALID_STATUSES = new Set([
  "available",
  "active",
  "ready_to_report",
  "completed",
]);

function normalizeNickname(nickname) {
  return String(nickname ?? "").trim().replace(/\s+/gu, " ");
}

function versionedKey(prefix, nickname) {
  return `${prefix}${encodeURIComponent(normalizeNickname(nickname))}`;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isReachableQuest(quest) {
  if (!isRecord(quest) || !VALID_STATUSES.has(quest.status)) return false;
  if (
    !Number.isSafeInteger(quest.progress)
    || quest.progress < 0
    || quest.progress > ADVENTURE_QUEST.required
  ) return false;
  if (quest.status === "available") return quest.progress === 0;
  if (quest.status === "active") return quest.progress < ADVENTURE_QUEST.required;
  return quest.progress === ADVENTURE_QUEST.required;
}

function isValidBaseProgress(progress) {
  if (!isRecord(progress)) return false;
  if (!Number.isSafeInteger(progress.level) || progress.level < 1) return false;
  if (
    !Number.isSafeInteger(progress.nextLevelExp)
    || progress.nextLevelExp !== nextLevelExp(progress.level)
  ) return false;
  if (
    !Number.isSafeInteger(progress.exp)
    || progress.exp < 0
    || progress.exp >= progress.nextLevelExp
  ) return false;
  if (!Number.isSafeInteger(progress.gold) || progress.gold < 0) return false;
  if (!Array.isArray(progress.completedQuests)) return false;

  const completedQuestIds = new Set(progress.completedQuests);
  if (
    completedQuestIds.size !== progress.completedQuests.length
    || [...completedQuestIds].some(id => id !== ADVENTURE_QUEST.id)
  ) return false;

  const quest = progress.quests?.[ADVENTURE_QUEST.id];
  if (!isRecord(progress.quests) || !isReachableQuest(quest)) return false;
  return completedQuestIds.has(ADVENTURE_QUEST.id) === (quest.status === "completed");
}

function isValidInventory(inventory) {
  return isRecord(inventory)
    && ["hpPotion", "mpPotion"].every(itemId => (
      Number.isSafeInteger(inventory[itemId])
      && inventory[itemId] >= 0
      && inventory[itemId] <= REWARD_POTION_LIMIT
    ));
}

function normalizeClaimedBossRewardIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.filter(id => typeof id === "string" && id.length > 0 && id.length <= 160),
  )].slice(-2_000);
}

function isValidClaimedBossRewardIds(value) {
  return Array.isArray(value)
    && value.length <= 2_000
    && value.every(id => typeof id === "string" && id.length > 0 && id.length <= 160)
    && new Set(value).size === value.length;
}

function isValidProgress(progress) {
  return isValidBaseProgress(progress)
    && isValidInventory(progress.inventory)
    && (!Object.hasOwn(progress, "claimedBossRewardIds")
      || isValidClaimedBossRewardIds(progress.claimedBossRewardIds));
}

function isValidV2Progress(progress) {
  return isValidBaseProgress(progress);
}

function isValidLegacyProgress(progress) {
  if (!isRecord(progress)) return false;
  if (!Number.isSafeInteger(progress.exp) || progress.exp < 0 || progress.exp > 99) return false;
  return isRecord(progress.quests)
    && isReachableQuest(progress.quests[ADVENTURE_QUEST.id]);
}

function toBaseAndInventoryProgress(value) {
  return {
    level: value.level,
    exp: value.exp,
    nextLevelExp: value.nextLevelExp,
    gold: value.gold,
    inventory: {
      hpPotion: value.inventory.hpPotion,
      mpPotion: value.inventory.mpPotion,
    },
    ...(Object.hasOwn(value, "redeemedCodeIds") ? { redeemedCodeIds: normalizeRedeemedCodeIds(value.redeemedCodeIds) } : {}),
    ...(Array.isArray(value.questNotificationIds) ? { questNotificationIds: [...new Set(value.questNotificationIds.filter(id => typeof id === "string" && id.length < 120))].slice(0, 200) } : {}),
    claimedBossRewardIds: normalizeClaimedBossRewardIds(value.claimedBossRewardIds),
    worldProgress: normalizeWorldProgress(value.worldProgress),
    completedQuests: [...value.completedQuests],
    quests: {
      [ADVENTURE_QUEST.id]: {
        status: value.quests[ADVENTURE_QUEST.id].status,
        progress: value.quests[ADVENTURE_QUEST.id].progress,
      },
    },
  };
}

function toProgress(value) {
  const equipmentByClass = normalizeEquipmentByClass(value.equipmentByClass);
  return {
    ...toBaseAndInventoryProgress(value),
    equipmentByClass: Object.fromEntries(Object.entries(equipmentByClass).map(
      ([classId, equipment]) => [classId, {
        ownedWeaponIds: [...equipment.ownedWeaponIds],
        equippedWeaponId: equipment.equippedWeaponId,
      }],
    )),
  };
}

function migrateV4Progress(value) {
  return {
    ...toBaseAndInventoryProgress(value),
    equipmentByClass: {
      ...createInitialEquipmentByClass(),
      warrior: normalizeClassEquipment("warrior", value.equipment),
    },
  };
}

function migrateV3Progress(value) {
  return {
    ...toBaseAndInventoryProgress(value),
    equipmentByClass: createInitialEquipmentByClass(),
  };
}

function migrateV2Progress(value) {
  return {
    level: value.level,
    exp: value.exp,
    nextLevelExp: value.nextLevelExp,
    gold: value.gold,
    inventory: { hpPotion: 0, mpPotion: 0 },
    claimedBossRewardIds: [],
    worldProgress: normalizeWorldProgress(value.worldProgress),
    equipmentByClass: createInitialEquipmentByClass(),
    completedQuests: [...value.completedQuests],
    quests: {
      [ADVENTURE_QUEST.id]: {
        status: value.quests[ADVENTURE_QUEST.id].status,
        progress: value.quests[ADVENTURE_QUEST.id].progress,
      },
    },
  };
}

function migrateLegacyProgress(legacy) {
  const rewarded = grantProgressReward(createInitialProgress(), { exp: legacy.exp, gold: 0 });
  const quest = legacy.quests[ADVENTURE_QUEST.id];
  return {
    ...rewarded.progress,
    completedQuests: quest.status === "completed" ? [ADVENTURE_QUEST.id] : [],
    quests: { [ADVENTURE_QUEST.id]: { ...quest } },
  };
}

export function progressStorageKey(nickname) {
  return versionedKey(STORAGE_PREFIX, nickname);
}

export function v6ProgressStorageKey(nickname) {
  return versionedKey(V6_STORAGE_PREFIX, nickname);
}

export function v5ProgressStorageKey(nickname) {
  return versionedKey(V5_STORAGE_PREFIX, nickname);
}

export function v4ProgressStorageKey(nickname) {
  return versionedKey(V4_STORAGE_PREFIX, nickname);
}

export function v3ProgressStorageKey(nickname) {
  return versionedKey(V3_STORAGE_PREFIX, nickname);
}

export function v2ProgressStorageKey(nickname) {
  return versionedKey(V2_STORAGE_PREFIX, nickname);
}

export function legacyProgressStorageKey(nickname) {
  return versionedKey(LEGACY_STORAGE_PREFIX, nickname);
}

function parseStoredValue(raw) {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function migratedResult(storage, nickname, migrated) {
  const migrationSave = saveProgress(storage, nickname, migrated);
  return {
    progress: migrated,
    migrationWriteFailed: !migrationSave.ok,
  };
}

export function loadProgressWithStatus(storage, nickname) {
  try {
    const v7 = parseStoredValue(storage?.getItem(progressStorageKey(nickname)));
    if (v7?.version === STORAGE_VERSION && isValidProgress(v7)) {
      return { progress: toProgress(v7), migrationWriteFailed: false };
    }

    const v6 = parseStoredValue(storage?.getItem(v6ProgressStorageKey(nickname)));
    if (v6?.version === V6_STORAGE_VERSION && isValidProgress(v6)) {
      return migratedResult(storage, nickname, toProgress(v6));
    }

    const v5 = parseStoredValue(storage?.getItem(v5ProgressStorageKey(nickname)));
    if (v5?.version === V5_STORAGE_VERSION && isValidProgress(v5)) {
      return migratedResult(storage, nickname, toProgress(v5));
    }

    const v4 = parseStoredValue(storage?.getItem(v4ProgressStorageKey(nickname)));
    if (v4?.version === V4_STORAGE_VERSION && isValidProgress(v4)) {
      return migratedResult(storage, nickname, migrateV4Progress(v4));
    }

    const v3 = parseStoredValue(storage?.getItem(v3ProgressStorageKey(nickname)));
    if (v3?.version === V3_STORAGE_VERSION && isValidProgress(v3)) {
      return migratedResult(storage, nickname, migrateV3Progress(v3));
    }

    const v2 = parseStoredValue(storage?.getItem(v2ProgressStorageKey(nickname)));
    if (v2?.version === V2_STORAGE_VERSION && isValidV2Progress(v2)) {
      return migratedResult(storage, nickname, migrateV2Progress(v2));
    }

    const v1 = parseStoredValue(storage?.getItem(legacyProgressStorageKey(nickname)));
    if (v1?.version === LEGACY_STORAGE_VERSION && isValidLegacyProgress(v1)) {
      return migratedResult(storage, nickname, migrateLegacyProgress(v1));
    }
  } catch {
    // Storage access and malformed JSON both recover to initial progress.
  }
  return {
    progress: createInitialProgress(),
    migrationWriteFailed: false,
  };
}

export function loadProgress(storage, nickname) {
  return loadProgressWithStatus(storage, nickname).progress;
}

export function saveProgress(storage, nickname, progress) {
  try {
    if (!isValidProgress(progress) || typeof storage?.setItem !== "function") {
      return { ok: false };
    }
    const payload = { version: STORAGE_VERSION, ...toProgress(progress) };
    storage.setItem(progressStorageKey(nickname), JSON.stringify(payload));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
