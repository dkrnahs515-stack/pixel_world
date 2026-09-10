import { isStoryInteractionEligible } from "./story-interactions-20260910-sanctuary.js";
import { SANCTUARY_STORY_INTERACTIONS } from "./sanctuary-story-data-20260910-sanctuary.js";
import {
  SANCTUARY_ARCHIVE_IDS,
  SANCTUARY_ORIGIN_RECORD_IDS,
  SANCTUARY_RESONANCE_NODE_IDS,
} from "./chapter-progress-20260910-sanctuary.js";

function countAllowed(values, allowed) {
  const ids = new Set(Array.isArray(values) ? values : []);
  return allowed.filter(id => ids.has(id)).length;
}

function missingOriginRecord(worldProgress) {
  const collected = new Set(worldProgress?.chapters?.sanctuary?.originRecordIds || []);
  const missingId = SANCTUARY_ORIGIN_RECORD_IDS.find(id => !collected.has(id));
  if (!missingId) return null;
  return SANCTUARY_STORY_INTERACTIONS.find(value => value.id === missingId) || null;
}

export function sanctuaryObjective(worldProgress) {
  const sanctuary = worldProgress?.chapters?.sanctuary || {};
  const resonanceCount = countAllowed(
    sanctuary.activatedResonanceNodeIds,
    SANCTUARY_RESONANCE_NODE_IDS,
  );
  if (resonanceCount < SANCTUARY_RESONANCE_NODE_IDS.length) {
    return {
      text: `공명 장치를 활성화하세요 (${resonanceCount}/3)`,
      targetMapId: "sanctuary-resonance-hall",
    };
  }

  const archiveCount = countAllowed(sanctuary.restoredArchiveIds, SANCTUARY_ARCHIVE_IDS);
  if (archiveCount < SANCTUARY_ARCHIVE_IDS.length) {
    return {
      text: `원점 기록고의 핵심 기록을 복원하세요 (${archiveCount}/3)`,
      targetMapId: "sanctuary-origin-archive",
    };
  }

  if (sanctuary.trinityDefeated !== true) {
    return { text: "TRINITY를 쓰러뜨리세요", targetMapId: "sanctuary-zero-boundary" };
  }

  if (sanctuary.originDefeated !== true) {
    return { text: "ORIGIN-0을 쓰러뜨리세요", targetMapId: "sanctuary-core-heart" };
  }

  if (!sanctuary.endingChoice) {
    const originCount = countAllowed(sanctuary.originRecordIds, SANCTUARY_ORIGIN_RECORD_IDS);
    if (originCount < SANCTUARY_ORIGIN_RECORD_IDS.length) {
      const missing = missingOriginRecord(worldProgress);
      return {
        text: `결정 보류 가능 · 원점 기록 ${originCount}/3`,
        targetMapId: missing?.mapId || "sanctuary-core-heart",
      };
    }
    return { text: "최종 관리자 결정을 선택하세요", targetMapId: "sanctuary-core-heart" };
  }

  if (sanctuary.chapterCompleted !== true) {
    return { text: "선택한 세계의 결말을 확인하세요", targetMapId: "sanctuary-core-heart" };
  }

  return { text: "PIXEL WORLD — 제1부 완료", targetMapId: "village" };
}

function completedStoryIds(chapters) {
  return new Set(Object.values(chapters || {}).flatMap(chapter => [
    ...(chapter.collectedRecordIds ?? []),
    ...(chapter.collectedClueIds ?? []),
    ...(chapter.repairedDeviceIds ?? []),
    ...(chapter.coolantAnchorIds ?? []),
    ...(chapter.activatedResonanceNodeIds ?? []),
    ...(chapter.restoredArchiveIds ?? []),
    ...(chapter.originRecordIds ?? []),
  ]));
}

export function storyGuidance({ interactions, worldProgress, mapId, player, camera, world, minimap }) {
  const completedIds = completedStoryIds(worldProgress?.chapters);
  const markers = interactions.filter(item => item.mapId === mapId && (
    completedIds.has(item.id) || isStoryInteractionEligible(item, worldProgress)
  )).map(item => ({
    ...item,
    completed: completedIds.has(item.id),
    label: item.name ?? (item.speaker
      ? `${item.speaker}의 ${item.signalKind === "current" ? "구조 신호" : "기록"}`
      : item.prompt?.replace(/^F\s*·\s*/, "") ?? "조사"),
    minimapX: item.x * minimap.width / world.width,
    minimapY: item.y * minimap.height / world.height,
  }));

  const nearest = markers
    .filter(item => !item.completed)
    .sort((a, b) => (
      Math.hypot(a.x - player.x, a.y - player.y)
      - Math.hypot(b.x - player.x, b.y - player.y)
    ))[0];

  let direction = null;
  if (nearest) {
    const x = nearest.x - camera.x;
    const y = nearest.y - camera.y;
    if (x < 0 || y < 0 || x > camera.width || y > camera.height) {
      const dx = x - camera.width / 2;
      const dy = y - camera.height / 2;
      const scale = Math.min(
        (camera.width / 2 - 24) / Math.max(Math.abs(dx), 1),
        (camera.height / 2 - 24) / Math.max(Math.abs(dy), 1),
      );
      direction = {
        id: nearest.id,
        label: nearest.label,
        x: camera.width / 2 + dx * scale,
        y: camera.height / 2 + dy * scale,
        angle: Math.atan2(dy, dx),
        distance: Math.round(Math.hypot(nearest.x - player.x, nearest.y - player.y)),
      };
    }
  }

  return {
    markers,
    direction,
    objective: sanctuaryObjective(worldProgress),
  };
}
