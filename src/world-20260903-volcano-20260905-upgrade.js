import { pointInRect } from "./collision-20260905-upgrade.js";
import {
  createWorldLayer as createCoastWorldLayer,
  drawInvestigationZone as drawCoastInvestigationZone,
  drawStorySignal as drawCoastStorySignal,
  getStoryRenderablesForMap as getCoastStoryRenderablesForMap,
} from "./world-20260829-coast-20260905-upgrade.js";
import { getCoastChapterObjective } from "./coast-story-data-20260829-coast-20260905-upgrade.js";
import { isStoryInteractionEligible } from "./story-interactions-20260903-volcano-20260905-upgrade.js";
import { getVolcanoStoryContent } from "./volcano-story-data-20260903-volcano-20260905-upgrade.js";
import { WORLD_IDS, getWorldDefinition, normalizeWorldId } from "./world-data-20260903-volcano-20260905-upgrade.js";

const WORLD_LAYER_SCALE = 0.5;
const VOLCANO_MAP_IDS = new Set([
  "volcano",
  "volcano-magma-route",
  "volcano-observatory",
  "volcano-core-caldera",
  "sanctuary",
]);
const worldLayerCache = new Map();

function includesAll(values, required) {
  return required.every(value => values.includes(value));
}

function objective(id, label, mapId, interactionIds = []) {
  return Object.freeze({ id, label, mapId, interactionIds: Object.freeze(interactionIds) });
}

export function getVolcanoChapterObjective(worldProgress) {
  const unlocked = worldProgress?.unlockedMapIds || [];
  if (!unlocked.includes("volcano")) return getCoastChapterObjective(worldProgress);
  const completed = worldProgress?.completedRegionIds || [];
  const volcano = worldProgress?.chapters?.volcano || {};
  const repaired = volcano.repairedDeviceIds || [];
  const clues = volcano.collectedClueIds || [];
  const anchors = volcano.coolantAnchorIds || [];
  const anchorStatus = ` · 냉각 쐐기 ${anchors.length}/3`;
  if (completed.includes("volcano") && volcano.coreFragmentObtained) {
    return objective("volcano-completed", "활화산을 완료했다. 픽셀 코어 성역으로 향한다.", "sanctuary");
  }
  if (!repaired.includes("ash-gate-pressure-seal")) {
    return objective("repair-ash-gate-pressure-seal", `잿불 관문의 압력 봉인장치를 복구한다.${anchorStatus}`, "volcano", ["ash-gate-pressure-seal"]);
  }
  if (!clues.includes("garen-scorched-insignia")) {
    return objective("collect-garen-insignia", `가렌의 그을린 인장을 확인한다.${anchorStatus}`, "volcano", ["garen-scorched-insignia"]);
  }
  const valves = ["magma-valve-west", "magma-valve-central", "magma-valve-east"];
  if (!includesAll(repaired, valves)) {
    return objective("repair-magma-valves", `용암 수송로의 세 밸브를 복구한다.${anchorStatus}`, "volcano-magma-route", valves);
  }
  if (!clues.includes("garen-escort-record")) {
    return objective("collect-garen-escort-record", `가렌의 호위 기록을 확인한다.${anchorStatus}`, "volcano-magma-route", ["garen-escort-record"]);
  }
  if (!repaired.includes("observatory-stabilizer")) {
    return objective("repair-observatory-stabilizer", `붕괴한 관측소 안정기를 복구한다.${anchorStatus}`, "volcano-observatory", ["observatory-stabilizer"]);
  }
  const captainRecords = ["captain-transport-order", "captain-core-contact-record"];
  if (!includesAll(clues, captainRecords)) {
    return objective("collect-captain-records", `대장의 운반 명령과 코어 접촉 기록을 확인한다.${anchorStatus}`, "volcano-observatory", captainRecords);
  }
  if (!volcano.routeDecision) {
    return objective("choose-volcano-route", `화구 진입 경로를 확정한다.${anchorStatus}`, "volcano-observatory", ["volcano-route-console"]);
  }
  if (!volcano.coopBossDefeated) {
    return objective("defeat-corrupted-captain", "화구 코어 제단의 오염된 선발대장을 처치한다.", "volcano-core-caldera");
  }
  if (!volcano.captainOutcome) {
    return objective("resolve-captain-outcome", volcano.routeDecision === "rescue"
      ? "냉각 쐐기로 선발대장을 구출한다."
      : "선발대장의 마지막 경고를 확인한다.", "volcano-core-caldera", ["volcano-captain-outcome"]);
  }
  return objective("collect-volcano-core", "세 번째 코어 조각을 회수한다.", "volcano-core-caldera", ["volcano-core-fragment"]);
}

function obstacleColor(type) {
  if (type === "lava") return "#d9480f";
  if (type === "coreCrater") return "#3b1720";
  if (type === "observatory") return "#4b464c";
  if (type === "sanctuaryGate") return "#75682e";
  if (type === "sanctuaryWall") return "#273454";
  return "#4a3030";
}

function drawGround(context, world) {
  const sanctuary = world.id === "sanctuary";
  context.fillStyle = sanctuary ? "#182541" : "#2a2024";
  context.fillRect(0, 0, world.width, world.height);
  context.fillStyle = sanctuary ? "#23375d" : "#3a292c";
  for (let y = 0; y < world.height; y += 96) {
    for (let x = (y / 96) % 2 * 48; x < world.width; x += 96) {
      context.fillRect(x, y, 42, 10);
    }
  }
  if (!sanctuary) {
    context.strokeStyle = "#8f3c24";
    context.lineWidth = 18;
    for (let index = 0; index < 7; index++) {
      context.beginPath();
      context.moveTo(260 + index * 280, 0);
      context.lineTo(420 + index * 250, world.height);
      context.stroke();
    }
  }
}

function drawObstacles(context, world) {
  for (const obstacle of world.obstacles) {
    context.fillStyle = obstacleColor(obstacle.type);
    context.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    context.strokeStyle = obstacle.type === "lava" ? "#fb923c" : "#81746f";
    context.lineWidth = 8;
    context.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  }
}

function drawPortals(context, portals) {
  for (const portal of portals) {
    context.fillStyle = "rgba(15, 23, 42, .75)";
    context.fillRect(portal.x, portal.y, portal.w, portal.h);
    context.strokeStyle = portal.color;
    context.lineWidth = 7;
    context.strokeRect(portal.x + 5, portal.y + 5, portal.w - 10, portal.h - 10);
  }
}

function drawWorldTitle(context, world) {
  context.fillStyle = "rgba(12, 15, 24, .78)";
  context.fillRect(world.width / 2 - 190, 38, 380, 70);
  context.fillStyle = world.id === "sanctuary" ? "#fef3c7" : "#ffb199";
  context.font = "bold 28px sans-serif";
  context.textAlign = "center";
  context.fillText(world.name, world.width / 2, 84);
}

function drawVolcanoWorldLayer(context, world) {
  drawGround(context, world);
  drawObstacles(context, world);
  drawPortals(context, world.portals);
  drawWorldTitle(context, world);
}

export function createWorldLayer(mapId = "village") {
  const world = getWorldDefinition(mapId);
  if (!VOLCANO_MAP_IDS.has(world.id)) return createCoastWorldLayer(world.id);
  const cached = worldLayerCache.get(world.id);
  if (cached) return cached;

  const layer = document.createElement("canvas");
  layer.width = Math.ceil(world.width * WORLD_LAYER_SCALE);
  layer.height = Math.ceil(world.height * WORLD_LAYER_SCALE);
  const context = layer.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = false;
  context.scale(WORLD_LAYER_SCALE, WORLD_LAYER_SCALE);
  drawVolcanoWorldLayer(context, world);
  worldLayerCache.set(world.id, layer);
  return layer;
}

function yieldToMainThread() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

export async function prewarmWorldLayers({ yieldControl = yieldToMainThread } = {}) {
  const layers = new Map();
  for (const mapId of WORLD_IDS) {
    if (VOLCANO_MAP_IDS.has(mapId) && !worldLayerCache.has(mapId)) await yieldControl();
    layers.set(mapId, createWorldLayer(mapId));
  }
  return layers;
}

export function drawWorldLayerViewport(context, layer, mapId, viewport) {
  const world = getWorldDefinition(mapId);
  const scaleX = layer.width / world.width;
  const scaleY = layer.height / world.height;
  context.drawImage(
    layer,
    viewport.cameraX * scaleX,
    viewport.cameraY * scaleY,
    viewport.width * scaleX,
    viewport.height * scaleY,
    0,
    0,
    viewport.width,
    viewport.height,
  );
}

export function getStoryRenderablesForMap(mapId, worldProgress = null) {
  const content = getVolcanoStoryContent(mapId);
  if (!content) return getCoastStoryRenderablesForMap(mapId, worldProgress);
  const activeObjective = getVolcanoChapterObjective(worldProgress);
  const objectiveTargets = activeObjective.mapId === mapId
    ? content.interactions.filter(value => activeObjective.interactionIds.includes(value.id))
    : [];
  const target = objectiveTargets.find(value => isStoryInteractionEligible(value, worldProgress));
  return {
    signals: content.interactions.map(interaction => ({
      id: interaction.id,
      interactionId: interaction.id,
      chapterId: "volcano",
      signalKind: interaction.type,
      x: interaction.x,
      y: interaction.y,
      active: isStoryInteractionEligible(interaction, worldProgress),
    })),
    objective: target ? { x: target.x, y: target.y, radius: Math.max(96, target.interactionRadius) } : null,
  };
}

export function drawStorySignal(context, signal, cameraX = 0, cameraY = 0) {
  if (signal?.chapterId !== "volcano") {
    drawCoastStorySignal(context, signal, cameraX, cameraY);
    return;
  }
  if (!context || !Number.isFinite(signal.x) || !Number.isFinite(signal.y)) return;
  const x = Math.round(signal.x - cameraX);
  const y = Math.round(signal.y - cameraY);
  context.save();
  context.globalAlpha = signal.active ? 1 : 0.42;
  context.fillStyle = signal.signalKind === "volcano-coolant" ? "#67e8f9" : "#fb923c";
  context.strokeStyle = "#fff7ed";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x, y - 18);
  context.lineTo(x + 16, y);
  context.lineTo(x, y + 18);
  context.lineTo(x - 16, y);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

export function drawInvestigationZone(context, zone, cameraX = 0, cameraY = 0, options) {
  drawCoastInvestigationZone(context, zone, cameraX, cameraY, options);
}

export function getBiome(mapId = "village") {
  return getWorldDefinition(mapId).name;
}

export function getObstacles(mapId = "village") {
  return getWorldDefinition(mapId).obstacles;
}

export function findActivePortal(mapId, x, y, radius = 0) {
  return getWorldDefinition(mapId).portals.find(portal => pointInRect(x, y, portal, radius)) || null;
}

export function isWorldPositionBlocked(mapIdOrX, xOrY, yOrRadius, radius = 0) {
  const usesRegionSignature = typeof mapIdOrX === "string";
  const mapId = usesRegionSignature ? normalizeWorldId(mapIdOrX) : "village";
  const x = usesRegionSignature ? xOrY : mapIdOrX;
  const y = usesRegionSignature ? yOrRadius : xOrY;
  const padding = usesRegionSignature ? radius : yOrRadius || 0;
  const world = getWorldDefinition(mapId);
  if (x - padding < 0 || y - padding < 0 || x + padding > world.width || y + padding > world.height) {
    return true;
  }
  return world.obstacles.some(rect => pointInRect(x, y, rect, padding));
}
