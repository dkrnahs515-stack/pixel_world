import {
  REGION_DEFINITIONS,
  REGION_IDS,
  getRegionDefinition,
  getRegionForMap,
} from "./region-data-20260903-volcano-20260905-upgrade.js";

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

const VOLCANO_DEVICE_IDS = Object.freeze([
  "ash-gate-pressure-seal",
  "magma-valve-west",
  "magma-valve-central",
  "magma-valve-east",
  "observatory-stabilizer",
]);
const VOLCANO_CLUE_IDS = Object.freeze([
  "garen-scorched-insignia",
  "garen-escort-record",
  "captain-transport-order",
  "captain-core-contact-record",
]);
const MAGMA_DEVICE_IDS = Object.freeze([
  "magma-valve-west",
  "magma-valve-central",
  "magma-valve-east",
]);
const OBSERVATORY_CLUE_IDS = Object.freeze([
  "captain-transport-order",
  "captain-core-contact-record",
]);
const VOLCANO_COOLANT_ANCHOR_IDS = Object.freeze([
  "ash-gate-coolant-anchor",
  "magma-route-coolant-anchor",
  "observatory-coolant-anchor",
]);
const ROUTE_DECISIONS = Object.freeze(["rescue", "proceed"]);
const CAPTAIN_OUTCOMES = Object.freeze(["rescued", "lost"]);

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

export function createInitialVolcanoChapter() {
  return {
    repairedDeviceIds: [],
    collectedClueIds: [],
    coolantAnchorIds: [],
    routeDecision: null,
    eruptionTriggered: false,
    coopBossDefeated: false,
    captainOutcome: null,
    hiddenWeaponRewardClaimed: false,
    coreFragmentObtained: false,
    sanctuaryUnlocked: false,
  };
}

export function createInitialWorldProgress() {
  return {
    unlockedRegionIds: ["village", "forest"],
    completedRegionIds: [],
    unlockedMapIds: ["village", "forest"],
    chapters: {
      coast: createInitialCoastChapter(),
      volcano: createInitialVolcanoChapter(),
    },
  };
}

function addUnique(values, value) {
  if (!values.includes(value)) values.push(value);
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeWorldProgressValue(value, { repairTerminal = true } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createInitialWorldProgress();
  }
  const initial = createInitialWorldProgress();
  const coast = recordValue(value.chapters?.coast);
  const volcano = recordValue(value.chapters?.volcano);

  const coastCoreFragmentObtained = coast.coreFragmentObtained === true;
  const seraRescued = coast.seraRescued === true || coastCoreFragmentObtained;
  const coastBossDefeated = coast.coopBossDefeated === true || seraRescued;

  const hiddenWeaponRewardClaimed = volcano.hiddenWeaponRewardClaimed === true;
  const captainOutcome = hiddenWeaponRewardClaimed
    ? "rescued"
    : (CAPTAIN_OUTCOMES.includes(volcano.captainOutcome) ? volcano.captainOutcome : null);
  const volcanoBossDefeated = volcano.coopBossDefeated === true || captainOutcome !== null;
  const volcanoCoreFragmentObtained = volcano.coreFragmentObtained === true;
  const coolantAnchorIds = uniqueAllowed(volcano.coolantAnchorIds, VOLCANO_COOLANT_ANCHOR_IDS);
  const routeDecision = volcano.routeDecision === "proceed"
    || (
      volcano.routeDecision === "rescue"
      && VOLCANO_COOLANT_ANCHOR_IDS.every(anchorId => coolantAnchorIds.includes(anchorId))
    )
    ? volcano.routeDecision
    : null;

  const normalized = {
    unlockedRegionIds: requiredUnlocks(
      value.unlockedRegionIds,
      initial.unlockedRegionIds,
      REGION_IDS,
    ),
    completedRegionIds: uniqueAllowed(
      value.completedRegionIds ?? initial.completedRegionIds,
      REGION_IDS,
    ),
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
        coopBossDefeated: coastBossDefeated,
        coreFragmentObtained: coastCoreFragmentObtained,
        shortcutUnlocked: coastCoreFragmentObtained,
      },
      volcano: {
        repairedDeviceIds: uniqueAllowed(volcano.repairedDeviceIds, VOLCANO_DEVICE_IDS),
        collectedClueIds: uniqueAllowed(volcano.collectedClueIds, VOLCANO_CLUE_IDS),
        coolantAnchorIds,
        routeDecision,
        eruptionTriggered: volcano.eruptionTriggered === true,
        coopBossDefeated: volcanoBossDefeated,
        captainOutcome,
        hiddenWeaponRewardClaimed,
        coreFragmentObtained: volcanoCoreFragmentObtained,
        sanctuaryUnlocked: volcanoCoreFragmentObtained,
      },
    },
  };

  if (repairTerminal && coastCoreFragmentObtained) {
    addUnique(normalized.unlockedRegionIds, "coast");
    addUnique(normalized.unlockedRegionIds, "volcano");
    addUnique(normalized.completedRegionIds, "coast");
    for (const mapId of [...REGION_DEFINITIONS.coast.mapIds, REGION_DEFINITIONS.volcano.entryMapId]) {
      addUnique(normalized.unlockedMapIds, mapId);
    }
  }
  if (repairTerminal && volcanoCoreFragmentObtained) {
    addUnique(normalized.unlockedRegionIds, "volcano");
    addUnique(normalized.unlockedRegionIds, "sanctuary");
    addUnique(normalized.completedRegionIds, "volcano");
    for (const mapId of [...REGION_DEFINITIONS.volcano.mapIds, ...REGION_DEFINITIONS.sanctuary.mapIds]) {
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
      || (regionId === "volcano" && !next.chapters.volcano.coreFragmentObtained)
    ) return;

    next.completedRegionIds.push(regionId);
    effects.push({ type: "region-completed", regionId });

    const nextRegionId = REGION_IDS[REGION_IDS.indexOf(regionId) + 1];
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

function unlockCoastMaps(progress, effects) {
  const coast = progress.chapters.coast;
  if (
    coast.repairedDeviceIds.includes("coast-beach-transceiver")
    && coast.collectedRecordIds.includes("sera-distress-current")
  ) unlockMap(progress, effects, "coast-wreck-bay");
  if (
    hasAll(coast.repairedDeviceIds, WRECK_DEVICE_IDS)
    && hasAll(coast.collectedRecordIds, WRECK_RECORD_IDS)
  ) unlockMap(progress, effects, "coast-flooded-station");
  if (
    coast.repairedDeviceIds.includes("flooded-station-main-transceiver")
    && coast.collectedRecordIds.includes("flooded-station-deleted-record")
    && coast.supportChoice
  ) unlockMap(progress, effects, "coast-tide-core-cave");
}

function isCoastDeviceAvailable(progress, deviceId) {
  if (deviceId === "coast-beach-transceiver") return isMapUnlocked(progress, "coast-beach");
  if (WRECK_DEVICE_IDS.includes(deviceId)) return isMapUnlocked(progress, "coast-wreck-bay");
  return deviceId === "flooded-station-main-transceiver"
    && isMapUnlocked(progress, "coast-flooded-station");
}

export function repairChapterDevice(progress, deviceId) {
  return transition(progress, (next, effects) => {
    const coast = next.chapters.coast;
    if (
      !COAST_DEVICE_IDS.includes(deviceId)
      || coast.repairedDeviceIds.includes(deviceId)
      || !isCoastDeviceAvailable(next, deviceId)
    ) return;
    coast.repairedDeviceIds.push(deviceId);
    unlockCoastMaps(next, effects);
  });
}

function isCoastRecordAvailable(progress, recordId) {
  if (recordId === "sera-distress-current") return isMapUnlocked(progress, "coast-beach");
  if (WRECK_RECORD_IDS.includes(recordId)) return isMapUnlocked(progress, "coast-wreck-bay");
  return recordId === "flooded-station-deleted-record"
    && isMapUnlocked(progress, "coast-flooded-station");
}

export function collectChapterRecord(progress, recordId) {
  return transition(progress, (next, effects) => {
    const coast = next.chapters.coast;
    if (
      !COAST_RECORD_IDS.includes(recordId)
      || coast.collectedRecordIds.includes(recordId)
      || !isCoastRecordAvailable(next, recordId)
    ) return;
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
    ) return;
    coast.supportChoice = choice;
    unlockCoastMaps(next, effects);
  });
}

function isVolcanoDeviceAvailable(progress, deviceId) {
  if (deviceId === "ash-gate-pressure-seal") return isMapUnlocked(progress, "volcano");
  if (MAGMA_DEVICE_IDS.includes(deviceId)) return isMapUnlocked(progress, "volcano-magma-route");
  return deviceId === "observatory-stabilizer"
    && isMapUnlocked(progress, "volcano-observatory");
}

function isVolcanoClueAvailable(progress, clueId) {
  if (clueId === "garen-scorched-insignia") return isMapUnlocked(progress, "volcano");
  if (clueId === "garen-escort-record") return isMapUnlocked(progress, "volcano-magma-route");
  return OBSERVATORY_CLUE_IDS.includes(clueId)
    && isMapUnlocked(progress, "volcano-observatory");
}

function isCoolantAnchorAvailable(progress, anchorId) {
  const mapId = {
    "ash-gate-coolant-anchor": "volcano",
    "magma-route-coolant-anchor": "volcano-magma-route",
    "observatory-coolant-anchor": "volcano-observatory",
  }[anchorId];
  return mapId ? isMapUnlocked(progress, mapId) : false;
}

function unlockVolcanoMaps(progress, effects) {
  const volcano = progress.chapters.volcano;
  if (
    volcano.repairedDeviceIds.includes("ash-gate-pressure-seal")
    && volcano.collectedClueIds.includes("garen-scorched-insignia")
  ) unlockMap(progress, effects, "volcano-magma-route");
  if (
    hasAll(volcano.repairedDeviceIds, MAGMA_DEVICE_IDS)
    && volcano.collectedClueIds.includes("garen-escort-record")
  ) unlockMap(progress, effects, "volcano-observatory");
}

function isObservatoryReady(progress) {
  const volcano = progress.chapters.volcano;
  return isMapUnlocked(progress, "volcano-observatory")
    && volcano.repairedDeviceIds.includes("observatory-stabilizer")
    && hasAll(volcano.collectedClueIds, OBSERVATORY_CLUE_IDS);
}

export function repairVolcanoDevice(progress, deviceId) {
  return transition(progress, (next, effects) => {
    const volcano = next.chapters.volcano;
    if (
      !VOLCANO_DEVICE_IDS.includes(deviceId)
      || volcano.repairedDeviceIds.includes(deviceId)
      || !isVolcanoDeviceAvailable(next, deviceId)
    ) return;
    volcano.repairedDeviceIds.push(deviceId);
    unlockVolcanoMaps(next, effects);
  });
}

export function collectVolcanoClue(progress, clueId) {
  return transition(progress, (next, effects) => {
    const volcano = next.chapters.volcano;
    if (
      !VOLCANO_CLUE_IDS.includes(clueId)
      || volcano.collectedClueIds.includes(clueId)
      || !isVolcanoClueAvailable(next, clueId)
    ) return;
    volcano.collectedClueIds.push(clueId);
    unlockVolcanoMaps(next, effects);
  });
}

export function collectCoolantAnchor(progress, anchorId) {
  return transition(progress, (next) => {
    const volcano = next.chapters.volcano;
    if (
      volcano.routeDecision
      || !VOLCANO_COOLANT_ANCHOR_IDS.includes(anchorId)
      || volcano.coolantAnchorIds.includes(anchorId)
      || !isCoolantAnchorAvailable(next, anchorId)
    ) return;
    volcano.coolantAnchorIds.push(anchorId);
  });
}

export function chooseVolcanoRoute(progress, decision) {
  return transition(progress, (next, effects) => {
    const volcano = next.chapters.volcano;
    if (!isObservatoryReady(next) || volcano.routeDecision) return;
    const prepared = hasAll(volcano.coolantAnchorIds, VOLCANO_COOLANT_ANCHOR_IDS);
    if ((decision === "rescue" && !prepared) || !ROUTE_DECISIONS.includes(decision)) return;
    volcano.routeDecision = decision;
    volcano.eruptionTriggered = true;
    unlockMap(next, effects, "volcano-core-caldera");
  });
}

export function recordChapterBossDefeat(progress, regionId) {
  return transition(progress, (next) => {
    if (regionId === "coast") {
      const coast = next.chapters.coast;
      if (!coast.coopBossDefeated && isMapUnlocked(next, "coast-tide-core-cave")) {
        coast.coopBossDefeated = true;
      }
      return;
    }
    const volcano = next.chapters.volcano;
    if (
      regionId === "volcano"
      && !volcano.coopBossDefeated
      && volcano.routeDecision
      && isMapUnlocked(next, "volcano-core-caldera")
    ) volcano.coopBossDefeated = true;
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
  if (!coreCollected.progress.chapters.coast.coreFragmentObtained) return coreCollected;
  const completed = completeRegion(coreCollected.progress, "coast");
  const finalized = normalizeWorldProgress(completed.progress);
  if (completed.effects.length === 0) return { progress: finalized, effects: coreCollected.effects };
  return {
    progress: finalized,
    effects: [...completed.effects, { type: "shortcut-unlocked", shortcutId: "coast-beach-to-tide-core" }],
  };
}

export function resolveVolcanoCaptain(progress) {
  return transition(progress, (next) => {
    const volcano = next.chapters.volcano;
    if (!volcano.coopBossDefeated || !volcano.routeDecision || volcano.captainOutcome) return;
    volcano.captainOutcome = volcano.routeDecision === "rescue" ? "rescued" : "lost";
    volcano.hiddenWeaponRewardClaimed = volcano.captainOutcome === "rescued";
  });
}

export function collectVolcanoCore(progress) {
  const coreCollected = transition(progress, (next) => {
    const volcano = next.chapters.volcano;
    if (!volcano.captainOutcome || volcano.coreFragmentObtained) return;
    volcano.coreFragmentObtained = true;
    volcano.sanctuaryUnlocked = true;
  });
  if (!coreCollected.progress.chapters.volcano.coreFragmentObtained) return coreCollected;
  const completed = completeRegion(coreCollected.progress, "volcano");
  return {
    progress: normalizeWorldProgress(completed.progress),
    effects: [...coreCollected.effects, ...completed.effects],
  };
}
