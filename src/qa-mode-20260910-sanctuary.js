import { normalizeClassId } from "./class-data-20260905-upgrade.js";
import { nextLevelExp } from "./player-progression-20260905-upgrade.js";
import {
  WEAPON_ORDER_BY_CLASS,
  getStarterWeaponId,
  getWeaponDefinition,
} from "./weapon-data-20260903-volcano-20260905-upgrade.js";
import {
  SANCTUARY_ARCHIVE_IDS,
  SANCTUARY_ORIGIN_RECORD_IDS,
  SANCTUARY_RESONANCE_NODE_IDS,
  activateSanctuaryResonanceNode,
  collectOriginRecord,
  normalizeWorldProgress,
  recordOriginDefeat,
  recordTrinityDefeat,
  restoreSanctuaryArchive,
} from "./chapter-progress-20260910-sanctuary.js";

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

export const SANCTUARY_QA_MAP_IDS = Object.freeze([
  "sanctuary",
  "sanctuary-resonance-hall",
  "sanctuary-origin-archive",
  "sanctuary-zero-boundary",
  "sanctuary-core-heart",
]);

export const SANCTUARY_QA_SETUP_IDS = Object.freeze([
  "origin-records-3",
  "trinity-ready",
  "origin-ready",
  "ending-restore-ready",
  "ending-seal-ready",
  "ending-resonate-ready",
]);

const ENDING_SETUP = Object.freeze({
  "ending-restore-ready": "restore",
  "ending-seal-ready": "seal",
  "ending-resonate-ready": "resonate",
});

const QA_SETUP_LABELS = Object.freeze({
  "origin-records-3": "원점 기록 3/3 QA 상태를 준비했습니다.",
  "trinity-ready": "TRINITY 전투 직전 QA 상태를 준비했습니다.",
  "origin-ready": "ORIGIN-0 전투 직전 QA 상태를 준비했습니다.",
  "ending-restore-ready": "복원 엔딩 선택 QA 상태를 준비했습니다.",
  "ending-seal-ready": "봉인 엔딩 선택 QA 상태를 준비했습니다.",
  "ending-resonate-ready": "공명 엔딩 선택 QA 상태를 준비했습니다.",
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

function sanctuaryQaBase(progress, { preserveCurrentSanctuary = false } = {}) {
  const worldProgress = progress?.worldProgress;
  const currentSanctuary = worldProgress?.chapters?.sanctuary;
  if (currentSanctuary?.endingChoice || currentSanctuary?.chapterCompleted) return null;
  const sanctuary = preserveCurrentSanctuary && currentSanctuary
    ? { ...currentSanctuary }
    : {
      activatedResonanceNodeIds: [],
      restoredArchiveIds: [],
      originRecordIds: [],
      trinityDefeated: false,
      originDefeated: false,
      originDefeatReceiptId: null,
      endingChoice: null,
      endingRewardClaimed: false,
      chapterCompleted: false,
    };
  return {
    ...progress,
    worldProgress: normalizeWorldProgress({
      ...(worldProgress || {}),
      chapters: {
        ...(worldProgress?.chapters || {}),
        volcano: {
          ...(worldProgress?.chapters?.volcano || {}),
          coreFragmentObtained: true,
          sanctuaryUnlocked: true,
        },
        sanctuary,
      },
    }),
  };
}

function prepareThroughArchives(progress) {
  let world = progress.worldProgress;
  for (const nodeId of SANCTUARY_RESONANCE_NODE_IDS) {
    world = activateSanctuaryResonanceNode(world, nodeId).progress;
  }
  for (const archiveId of SANCTUARY_ARCHIVE_IDS) {
    world = restoreSanctuaryArchive(world, archiveId).progress;
  }
  return { ...progress, worldProgress: world };
}

function addOriginRecords(progress) {
  let world = progress.worldProgress;
  for (const recordId of SANCTUARY_ORIGIN_RECORD_IDS) {
    world = collectOriginRecord(world, recordId).progress;
  }
  return { ...progress, worldProgress: world };
}

export function prepareSanctuaryQaProgress(progress, setupId) {
  if (!SANCTUARY_QA_SETUP_IDS.includes(setupId)) {
    return { ok: false, reason: "unknown_setup", progress };
  }

  let next = sanctuaryQaBase(progress, {
    preserveCurrentSanctuary: setupId === "origin-records-3",
  });
  if (!next) return { ok: false, reason: "terminal_state", progress };
  next = prepareThroughArchives(next);

  if (setupId === "origin-records-3") {
    next = addOriginRecords(next);
    return {
      ok: true,
      progress: next,
      mapId: "sanctuary-zero-boundary",
      openEndingChoice: false,
      focusEndingId: null,
      label: QA_SETUP_LABELS[setupId],
    };
  }

  if (setupId === "trinity-ready") {
    return {
      ok: true,
      progress: next,
      mapId: "sanctuary-zero-boundary",
      openEndingChoice: false,
      focusEndingId: null,
      label: QA_SETUP_LABELS[setupId],
    };
  }

  next = {
    ...next,
    worldProgress: recordTrinityDefeat(next.worldProgress).progress,
  };

  if (setupId === "origin-ready") {
    return {
      ok: true,
      progress: next,
      mapId: "sanctuary-core-heart",
      openEndingChoice: false,
      focusEndingId: null,
      label: QA_SETUP_LABELS[setupId],
    };
  }

  const endingId = ENDING_SETUP[setupId];
  if (endingId === "resonate") next = addOriginRecords(next);
  next = {
    ...next,
    worldProgress: recordOriginDefeat(next.worldProgress, `qa-origin-${endingId}`).progress,
  };
  return {
    ok: true,
    progress: next,
    mapId: "sanctuary-core-heart",
    openEndingChoice: true,
    focusEndingId: endingId,
    label: QA_SETUP_LABELS[setupId],
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

export function isSanctuaryQaMap(mapId) {
  return SANCTUARY_QA_MAP_IDS.includes(mapId);
}
