import { REGION_DEFINITIONS, REGION_IDS, getRegionDefinition, getRegionForMap } from "./region-data-20260829-coast-20260905-upgrade.js";

const COAST_DEVICE_IDS = Object.freeze([
  "coast-beach-transceiver",
  "wreck-relay-west",
  "wreck-relay-deck",
  "wreck-relay-east",
  "flooded-station-main-transceiver",
]);

const COAST_RECORD_IDS = Object.freeze([
  "sera-distress-current",
  "wreck-record-sera",
  "wreck-record-roan",
  "wreck-record-garen",
  "wreck-record-vanguard-captain",
  "flooded-station-deleted-record",
]);

const WRECK_DEVICE_IDS = Object.freeze([
  "wreck-relay-west",
  "wreck-relay-deck",
  "wreck-relay-east",
]);

const WRECK_RECORD_IDS = Object.freeze([
  "wreck-record-sera",
  "wreck-record-roan",
  "wreck-record-garen",
  "wreck-record-vanguard-captain",
]);

const SUPPORT_CHOICES = Object.freeze(["sera", "echo", "mari"]);

function uniqueAllowed(values, allowedIds) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(value => allowedIds.includes(value)))];
}

function requiredUnlocks(values, baselineIds, allowedIds) {
  return uniqueAllowed([
    ...baselineIds,
    ...(Array.isArray(values) ? values : []),
  ], allowedIds);
}

function createInitialCoastChapter() {
  return {
    repairedDeviceIds: [],
    collectedRecordIds: [],
    supportChoice: null,
    seraRescued: false,
    coopBossDefeated: false,
    coreFragmentObtained: false,
    shortcutUnlocked: false,
  };
}

export function createInitialWorldProgress() {
  return {
    unlockedRegionIds: ["village", "forest"],
    completedRegionIds: [],
    unlockedMapIds: ["village", "forest"],
    chapters: { coast: createInitialCoastChapter() },
  };
}

function addUnique(values, value) {
  if (!values.includes(value)) values.push(value);
}

function normalizeWorldProgressValue(value, { repairTerminal = true } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createInitialWorldProgress();
  }
  const initial = createInitialWorldProgress();
  const coast = value.chapters?.coast && typeof value.chapters.coast === "object"
    && !Array.isArray(value.chapters.coast)
    ? value.chapters.coast
    : {};
  const coreFragmentObtained = coast.coreFragmentObtained === true;
  const seraRescued = coast.seraRescued === true || coreFragmentObtained;
  const coopBossDefeated = coast.coopBossDefeated === true || seraRescued;
  const normalized = {
    unlockedRegionIds: requiredUnlocks(
      value.unlockedRegionIds,
      initial.unlockedRegionIds,
      REGION_IDS,
    ),
    completedRegionIds: uniqueAllowed(value.completedRegionIds ?? initial.completedRegionIds, REGION_IDS),
    unlockedMapIds: requiredUnlocks(
      value.unlockedMapIds,
      initial.unlockedMapIds,
      REGION_IDS.flatMap(regionId => REGION_DEFINITIONS[regionId].mapIds),
    ),
    chapters: {
      coast: {
        repairedDeviceIds: uniqueAllowed(coast.repairedDeviceIds, COAST_DEVICE_IDS),
        collectedRecordIds: uniqueAllowed(coast.collectedRecordIds, COAST_RECORD_IDS),
        supportChoice: SUPPORT_CHOICES.includes(coast.supportChoice) ? coast.supportChoice : null,
        seraRescued,
        coopBossDefeated,
        coreFragmentObtained,
        shortcutUnlocked: coreFragmentObtained,
      },
    },
  };
  if (repairTerminal && coreFragmentObtained) {
    addUnique(normalized.unlockedRegionIds, "coast");
    addUnique(normalized.unlockedRegionIds, "volcano");
    addUnique(normalized.completedRegionIds, "coast");
    for (const mapId of [...REGION_DEFINITIONS.coast.mapIds, REGION_DEFINITIONS.volcano.entryMapId]) {
      addUnique(normalized.unlockedMapIds, mapId);
    }
  }
  return normalized;
}

export function normalizeWorldProgress(value) {
  return normalizeWorldProgressValue(value);
}

function transition(progress, apply) {
  const next = normalizeWorldProgressValue(progress, { repairTerminal: false });
  const effects = [];
  apply(next, effects);
  return { progress: next, effects };
}

function unlockMap(progress, effects, mapId) {
  if (progress.unlockedMapIds.includes(mapId)) return;
  progress.unlockedMapIds.push(mapId);
  effects.push({ type: "map-unlocked", mapId });
}

function hasAll(values, requiredValues) {
  return requiredValues.every(value => values.includes(value));
}

function unlockCoastMaps(progress, effects) {
  const coast = progress.chapters.coast;
  if (
    coast.repairedDeviceIds.includes("coast-beach-transceiver")
    && coast.collectedRecordIds.includes("sera-distress-current")
  ) {
    unlockMap(progress, effects, "coast-wreck-bay");
  }
  if (
    hasAll(coast.repairedDeviceIds, WRECK_DEVICE_IDS)
    && hasAll(coast.collectedRecordIds, WRECK_RECORD_IDS)
  ) {
    unlockMap(progress, effects, "coast-flooded-station");
  }
  if (
    coast.repairedDeviceIds.includes("flooded-station-main-transceiver")
    && coast.collectedRecordIds.includes("flooded-station-deleted-record")
    && coast.supportChoice
  ) {
    unlockMap(progress, effects, "coast-tide-core-cave");
  }
}

export function isMapUnlocked(progress, mapId) {
  if (!getRegionForMap(mapId)) return false;
  return normalizeWorldProgress(progress).unlockedMapIds.includes(mapId);
}

export function completeRegion(progress, regionId) {
  return transition(progress, (next, effects) => {
    const region = getRegionDefinition(regionId);
    if (
      !region
      || !next.unlockedRegionIds.includes(regionId)
      || next.completedRegionIds.includes(regionId)
      || (regionId === "coast" && !next.chapters.coast.coreFragmentObtained)
    ) {
      return;
    }
    next.completedRegionIds.push(regionId);
    effects.push({ type: "region-completed", regionId });

    const regionIndex = REGION_IDS.indexOf(regionId);
    const nextRegionId = REGION_IDS[regionIndex + 1];
    const nextRegion = getRegionDefinition(nextRegionId);
    if (
      nextRegion
      && nextRegion.prerequisiteRegionId === regionId
      && !next.unlockedRegionIds.includes(nextRegionId)
    ) {
      next.unlockedRegionIds.push(nextRegionId);
      effects.push({ type: "region-unlocked", regionId: nextRegionId });
      unlockMap(next, effects, nextRegion.entryMapId);
    }
  });
}

function isDeviceAvailable(progress, deviceId) {
  if (deviceId === "coast-beach-transceiver") return isMapUnlocked(progress, "coast-beach");
  if (WRECK_DEVICE_IDS.includes(deviceId)) return isMapUnlocked(progress, "coast-wreck-bay");
  return deviceId === "flooded-station-main-transceiver"
    && isMapUnlocked(progress, "coast-flooded-station");
}

export function repairChapterDevice(progress, deviceId) {
  return transition(progress, (next, effects) => {
    const coast = next.chapters.coast;
    if (!COAST_DEVICE_IDS.includes(deviceId) || coast.repairedDeviceIds.includes(deviceId) || !isDeviceAvailable(next, deviceId)) {
      return;
    }
    coast.repairedDeviceIds.push(deviceId);
    unlockCoastMaps(next, effects);
  });
}

function isRecordAvailable(progress, recordId) {
  if (recordId === "sera-distress-current") return isMapUnlocked(progress, "coast-beach");
  if (WRECK_RECORD_IDS.includes(recordId)) return isMapUnlocked(progress, "coast-wreck-bay");
  return recordId === "flooded-station-deleted-record"
    && isMapUnlocked(progress, "coast-flooded-station");
}

export function collectChapterRecord(progress, recordId) {
  return transition(progress, (next, effects) => {
    const coast = next.chapters.coast;
    if (!COAST_RECORD_IDS.includes(recordId) || coast.collectedRecordIds.includes(recordId) || !isRecordAvailable(next, recordId)) {
      return;
    }
    coast.collectedRecordIds.push(recordId);
    unlockCoastMaps(next, effects);
  });
}

export function chooseChapterSupport(progress, choice) {
  return transition(progress, (next, effects) => {
    const coast = next.chapters.coast;
    if (
      coast.supportChoice
      || !SUPPORT_CHOICES.includes(choice)
      || !isMapUnlocked(next, "coast-flooded-station")
      || !coast.repairedDeviceIds.includes("flooded-station-main-transceiver")
      || !coast.collectedRecordIds.includes("flooded-station-deleted-record")
    ) {
      return;
    }
    coast.supportChoice = choice;
    unlockCoastMaps(next, effects);
  });
}

export function recordChapterBossDefeat(progress, regionId) {
  return transition(progress, (next) => {
    const coast = next.chapters.coast;
    if (regionId !== "coast" || coast.coopBossDefeated || !isMapUnlocked(next, "coast-tide-core-cave")) return;
    coast.coopBossDefeated = true;
  });
}

export function rescueSera(progress) {
  return transition(progress, (next) => {
    const coast = next.chapters.coast;
    if (!coast.coopBossDefeated || coast.seraRescued) return;
    coast.seraRescued = true;
  });
}

export function collectCoastCore(progress) {
  const coreCollected = transition(progress, (next) => {
    const coast = next.chapters.coast;
    if (!coast.seraRescued) return;
    coast.coreFragmentObtained = true;
    coast.shortcutUnlocked = true;
  });
  if (!coreCollected.progress.chapters.coast.coreFragmentObtained || !coreCollected.progress.chapters.coast.shortcutUnlocked) {
    return coreCollected;
  }
  const completed = completeRegion(coreCollected.progress, "coast");
  const finalized = normalizeWorldProgress(completed.progress);
  if (completed.effects.length === 0) {
    return { progress: finalized, effects: coreCollected.effects };
  }
  return {
    progress: finalized,
    effects: [...completed.effects, { type: "shortcut-unlocked", shortcutId: "coast-beach-to-tide-core" }],
  };
}
