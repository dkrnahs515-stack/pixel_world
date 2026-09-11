import {
  activateSanctuaryResonanceNode,
  chooseChapterSupport,
  chooseVolcanoRoute,
  collectChapterRecord,
  collectCoastCore,
  collectCoolantAnchor,
  collectOriginRecord,
  collectVolcanoClue,
  collectVolcanoCore,
  completeRegion,
  createInitialWorldProgress,
  normalizeWorldProgress,
  recordChapterBossDefeat,
  recordOriginDefeat,
  recordTrinityDefeat,
  repairChapterDevice,
  repairVolcanoDevice,
  rescueSera,
  resolveVolcanoCaptain,
  restoreSanctuaryArchive,
} from "../../src/chapter-progress-20260910-sanctuary.js";

const WRECK_DEVICE_IDS = ["wreck-relay-west", "wreck-relay-deck", "wreck-relay-east"];
const WRECK_RECORD_IDS = [
  "wreck-record-sera",
  "wreck-record-roan",
  "wreck-record-garen",
  "wreck-record-vanguard-captain",
];
const MAGMA_DEVICE_IDS = ["magma-valve-west", "magma-valve-central", "magma-valve-east"];
const OBSERVATORY_CLUE_IDS = ["captain-transport-order", "captain-core-contact-record"];
const COOLANT_IDS = [
  "ash-gate-coolant-anchor",
  "magma-route-coolant-anchor",
  "observatory-coolant-anchor",
];
const RESONANCE_IDS = ["life-resonance", "memory-resonance", "energy-resonance"];
const ARCHIVE_IDS = ["archive-aren-split", "archive-vanguard-entry", "archive-defense-protocol"];
const ORIGIN_RECORD_IDS = [
  "origin-record-single-authority",
  "origin-record-sealed-recovery",
  "origin-record-mutual-validation",
];

function completedCoastProgress() {
  let progress = completeRegion(createInitialWorldProgress(), "forest").progress;
  progress = repairChapterDevice(progress, "coast-beach-transceiver").progress;
  progress = collectChapterRecord(progress, "sera-distress-current").progress;
  for (const id of WRECK_DEVICE_IDS) progress = repairChapterDevice(progress, id).progress;
  for (const id of WRECK_RECORD_IDS) progress = collectChapterRecord(progress, id).progress;
  progress = repairChapterDevice(progress, "flooded-station-main-transceiver").progress;
  progress = collectChapterRecord(progress, "flooded-station-deleted-record").progress;
  progress = chooseChapterSupport(progress, "echo").progress;
  progress = recordChapterBossDefeat(progress, "coast").progress;
  progress = rescueSera(progress).progress;
  return collectCoastCore(progress).progress;
}

function completedVolcanoProgress() {
  let progress = completedCoastProgress();
  progress = repairVolcanoDevice(progress, "ash-gate-pressure-seal").progress;
  progress = collectVolcanoClue(progress, "garen-scorched-insignia").progress;
  progress = collectCoolantAnchor(progress, COOLANT_IDS[0]).progress;
  for (const id of MAGMA_DEVICE_IDS) progress = repairVolcanoDevice(progress, id).progress;
  progress = collectVolcanoClue(progress, "garen-escort-record").progress;
  progress = collectCoolantAnchor(progress, COOLANT_IDS[1]).progress;
  progress = repairVolcanoDevice(progress, "observatory-stabilizer").progress;
  for (const id of OBSERVATORY_CLUE_IDS) progress = collectVolcanoClue(progress, id).progress;
  progress = collectCoolantAnchor(progress, COOLANT_IDS[2]).progress;
  progress = chooseVolcanoRoute(progress, "rescue").progress;
  progress = recordChapterBossDefeat(progress, "volcano").progress;
  progress = resolveVolcanoCaptain(progress).progress;
  return collectVolcanoCore(progress).progress;
}

export function sanctuaryUnlockedProgress(overrides = {}) {
  const progress = completedVolcanoProgress();
  if (!overrides || Object.keys(overrides).length === 0) return progress;
  return normalizeWorldProgress({
    ...progress,
    ...overrides,
    chapters: {
      ...progress.chapters,
      ...(overrides.chapters || {}),
      sanctuary: {
        ...progress.chapters.sanctuary,
        ...(overrides.chapters?.sanctuary || {}),
      },
    },
  });
}

export function oneResonanceProgress() {
  return activateSanctuaryResonanceNode(sanctuaryUnlockedProgress(), "life-resonance").progress;
}

export function threeResonanceProgress() {
  let progress = sanctuaryUnlockedProgress();
  for (const id of RESONANCE_IDS) progress = activateSanctuaryResonanceNode(progress, id).progress;
  return progress;
}

export function zeroBoundaryUnlockedProgress({ originRecordIds = [] } = {}) {
  let progress = threeResonanceProgress();
  for (const id of ARCHIVE_IDS) progress = restoreSanctuaryArchive(progress, id).progress;
  for (const id of originRecordIds) progress = collectOriginRecord(progress, id).progress;
  return progress;
}

export function originReadyProgress({ originRecordIds = [] } = {}) {
  return recordTrinityDefeat(zeroBoundaryUnlockedProgress({ originRecordIds })).progress;
}

export function originDefeatedProgress({ originRecordIds = [], receiptId = "origin-encounter-1" } = {}) {
  return recordOriginDefeat(originReadyProgress({ originRecordIds }), receiptId).progress;
}

export function resonanceReadyProgress() {
  return originDefeatedProgress({ originRecordIds: ORIGIN_RECORD_IDS });
}

export function validWarriorBossAttack(overrides = {}) {
  return {
    attackId: "fixture-attack-1",
    sequence: 1,
    uid: "player-a",
    encounterId: "forest-fixture",
    bossId: "forest-core-troll",
    mapId: "forest",
    classId: "warrior",
    weaponId: "starter-sword",
    attackKind: "basic",
    playerX: 2100,
    playerY: 1400,
    direction: "right",
    createdAt: 10_000,
    ...overrides,
  };
}

export function regionalBossValidation(overrides = {}) {
  return {
    authenticatedUid: "player-a",
    now: 10_000,
    lastSequence: 0,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    player: {
      uid: "player-a",
      mapId: "forest",
      x: 2100,
      y: 1400,
      level: 1,
      classId: "warrior",
      equippedWeaponId: "starter-sword",
      skillResources: {},
    },
    bossDefinition: {
      id: "forest-core-troll",
      mapId: "forest",
      x: 2160,
      y: 1400,
      baseHp: 600,
    },
    encounter: {
      encounterId: "forest-fixture",
      bossId: "forest-core-troll",
      mapId: "forest",
      status: "alive",
      x: 2160,
      y: 1400,
      dir: "down",
      moving: false,
      hp: 600,
      maxHp: 600,
      phase: 1,
      targetUid: null,
      authorityUid: "authority-a",
      authorityEpoch: 1,
      leaseUntil: 20_000,
      partySize: 1,
      spawnedAt: 0,
      defeatedAt: null,
      respawnAt: null,
      contributors: {},
      updatedAt: 10_000,
    },
    ...overrides,
  };
}

export function rewriteOriginEncounter(overrides = {}) {
  return {
    encounterId: "origin-fixture",
    bossId: "origin-zero",
    mapId: "sanctuary-core-heart",
    status: "alive",
    x: 1080,
    y: 760,
    dir: "down",
    moving: false,
    hp: 240,
    maxHp: 1200,
    phase: 4,
    originPhase: "rewrite",
    anchors: {},
    rewriteCycle: { phase: "idle", elapsed: 0, sequence: 0 },
    completionClaimWritten: false,
    targetUid: "player-a",
    authorityUid: "authority-a",
    authorityEpoch: 1,
    leaseUntil: 20_000,
    partySize: 1,
    spawnedAt: 0,
    defeatedAt: null,
    respawnAt: null,
    contributors: {},
    updatedAt: 10_000,
    ...overrides,
  };
}

export function fixedOriginContext(overrides = {}) {
  return {
    now: 10_000,
    rng: () => 0.25,
    arena: { width: 2160, height: 1800 },
    players: [
      { uid: "player-a", x: 900, y: 900, hp: 120, alive: true },
      { uid: "player-b", x: 1260, y: 900, hp: 100, alive: true },
    ],
    ...overrides,
  };
}
