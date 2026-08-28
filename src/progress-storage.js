import {
  ADVENTURE_QUEST,
  createInitialProgress,
} from "./quest-state.js";
import {
  grantProgressReward,
  nextLevelExp,
} from "./player-progression.js";
import {
  createInitialEquipmentByClass,
  normalizeClassEquipment,
  normalizeEquipmentByClass,
} from "./equipment-state.js";

const STORAGE_VERSION = 5;
const STORAGE_PREFIX = "pixel-world.progress.v5:";
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

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isReachableQuest(quest) {
  if (!isRecord(quest) || !VALID_STATUSES.has(quest.status)) return false;
  if (
    !Number.isSafeInteger(quest.progress)
    || quest.progress < 0
    || quest.progress > ADVENTURE_QUEST.required
  ) {
    return false;
  }

  if (quest.status === "available") return quest.progress === 0;
  if (quest.status === "active") return quest.progress < ADVENTURE_QUEST.required;
  return quest.progress === ADVENTURE_QUEST.required;
}

function isValidBaseProgress(progress) {
  if (!isRecord(progress)) return false;
  if (!Number.isSafeInteger(progress.level) || progress.level < 1) return false;
  if (!Number.isSafeInteger(progress.nextLevelExp)
    || progress.nextLevelExp !== nextLevelExp(progress.level)) {
    return false;
  }
  if (!Number.isSafeInteger(progress.exp)
    || progress.exp < 0
    || progress.exp >= progress.nextLevelExp) {
    return false;
  }
  if (!Number.isSafeInteger(progress.gold) || progress.gold < 0) return false;
  if (!Array.isArray(progress.completedQuests)) return false;

  const completedQuestIds = new Set(progress.completedQuests);
  if (completedQuestIds.size !== progress.completedQuests.length
    || [...completedQuestIds].some((id) => id !== ADVENTURE_QUEST.id)) {
    return false;
  }

  const quest = progress.quests?.[ADVENTURE_QUEST.id];
  if (!isRecord(progress.quests) || !isReachableQuest(quest)) return false;

  return completedQuestIds.has(ADVENTURE_QUEST.id)
    === (quest.status === "completed");
}

function isValidInventory(inventory) {
  return isRecord(inventory)
    && ["hpPotion", "mpPotion"].every((itemId) => (
      Number.isSafeInteger(inventory[itemId])
      && inventory[itemId] >= 0
      && inventory[itemId] <= 99
    ));
}

function normalizeClaimedBossRewardIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => typeof id === "string" && id.length > 0 && id.length <= 160))].slice(-2_000);
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
  if (!Number.isSafeInteger(progress.exp) || progress.exp < 0 || progress.exp > 99) {
    return false;
  }

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
    claimedBossRewardIds: normalizeClaimedBossRewardIds(value.claimedBossRewardIds),
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
  const initial = createInitialProgress();
  const rewarded = grantProgressReward(initial, { exp: legacy.exp, gold: 0 });
  const quest = legacy.quests[ADVENTURE_QUEST.id];
  return {
    ...rewarded.progress,
    completedQuests: quest.status === "completed" ? [ADVENTURE_QUEST.id] : [],
    quests: { [ADVENTURE_QUEST.id]: { ...quest } },
  };
}

export function progressStorageKey(nickname) {
  return `${STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}

export function v4ProgressStorageKey(nickname) {
  return `${V4_STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}

export function v3ProgressStorageKey(nickname) {
  return `${V3_STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}

export function legacyProgressStorageKey(nickname) {
  return `${LEGACY_STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}

export function v2ProgressStorageKey(nickname) {
  return `${V2_STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}

function parseStoredValue(raw) {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadProgressWithStatus(storage, nickname) {
  try {
    const v5 = parseStoredValue(storage?.getItem(progressStorageKey(nickname)));
    if (v5?.version === STORAGE_VERSION && isValidProgress(v5)) {
      return {
        progress: toProgress(v5),
        migrationWriteFailed: false,
      };
    }

    const v4 = parseStoredValue(storage?.getItem(v4ProgressStorageKey(nickname)));
    if (v4?.version === V4_STORAGE_VERSION && isValidProgress(v4)) {
      const migrated = migrateV4Progress(v4);
      const migrationSave = saveProgress(storage, nickname, migrated);
      return {
        progress: migrated,
        migrationWriteFailed: !migrationSave.ok,
      };
    }

    const v3 = parseStoredValue(storage?.getItem(v3ProgressStorageKey(nickname)));
    if (v3?.version === V3_STORAGE_VERSION && isValidProgress(v3)) {
      const migrated = migrateV3Progress(v3);
      const migrationSave = saveProgress(storage, nickname, migrated);
      return {
        progress: migrated,
        migrationWriteFailed: !migrationSave.ok,
      };
    }

    const v2 = parseStoredValue(storage?.getItem(v2ProgressStorageKey(nickname)));
    if (v2?.version === V2_STORAGE_VERSION && isValidV2Progress(v2)) {
      const migrated = migrateV2Progress(v2);
      const migrationSave = saveProgress(storage, nickname, migrated);
      return {
        progress: migrated,
        migrationWriteFailed: !migrationSave.ok,
      };
    }

    const v1 = parseStoredValue(storage?.getItem(legacyProgressStorageKey(nickname)));
    if (v1?.version === LEGACY_STORAGE_VERSION && isValidLegacyProgress(v1)) {
      const migrated = migrateLegacyProgress(v1);
      const migrationSave = saveProgress(storage, nickname, migrated);
      return {
        progress: migrated,
        migrationWriteFailed: !migrationSave.ok,
      };
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
