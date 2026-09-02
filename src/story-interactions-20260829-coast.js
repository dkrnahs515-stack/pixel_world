import {
  chooseChapterSupport,
  collectChapterRecord,
  collectCoastCore,
  isMapUnlocked,
  normalizeWorldProgress,
  repairChapterDevice,
  rescueSera,
} from "./chapter-progress-20260829-coast.js";
import { COAST_STORY_INTERACTIONS } from "./coast-story-data-20260829-coast.js";

function chapter(progress) {
  return normalizeWorldProgress(progress).chapters.coast;
}

function isFinitePoint(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function responseValue(response, key) {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  return typeof response[key] === "string" ? response[key] : null;
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function isStoryInteractionEligible(interaction, worldProgress) {
  if (!interaction || typeof interaction !== "object" || !isMapUnlocked(worldProgress, interaction.mapId)) return false;
  const coast = chapter(worldProgress);
  switch (interaction.type) {
    case "device":
      return !coast.repairedDeviceIds.includes(interaction.id);
    case "record":
      return !coast.collectedRecordIds.includes(interaction.id);
    case "support":
      return !coast.supportChoice
        && coast.repairedDeviceIds.includes("flooded-station-main-transceiver")
        && coast.collectedRecordIds.includes("flooded-station-deleted-record");
    case "reveal":
      return Boolean(coast.supportChoice);
    case "rescue":
      return coast.coopBossDefeated && !coast.seraRescued;
    case "core":
      return coast.seraRescued && !coast.coreFragmentObtained;
    default:
      return false;
  }
}

export function findNearbyStoryInteraction(interactions, player, worldProgress) {
  if (!Array.isArray(interactions) || !isFinitePoint(player) || typeof player.mapId !== "string") return null;

  let nearest = null;
  let nearestDistanceSquared = Infinity;
  for (const interaction of interactions) {
    if (
      !isStoryInteractionEligible(interaction, worldProgress)
      || interaction.mapId !== player.mapId
      || !isFinitePoint(interaction)
      || !Number.isFinite(interaction.interactionRadius)
    ) {
      continue;
    }
    const dx = interaction.x - player.x;
    const dy = interaction.y - player.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared <= interaction.interactionRadius ** 2 && distanceSquared < nearestDistanceSquared) {
      nearest = interaction;
      nearestDistanceSquared = distanceSquared;
    }
  }
  return nearest;
}

export function storyInteractionPrompt(interaction) {
  return typeof interaction?.prompt === "string" ? interaction.prompt : "";
}

function interactionResult(progress, interactionId, outcome, retryable = false, effects = []) {
  return {
    progress,
    effects,
    interactionId,
    outcome,
    retryable,
  };
}

export function resolveStoryInteraction(progress, interactionId, response) {
  const initial = normalizeWorldProgress(progress);
  const interaction = COAST_STORY_INTERACTIONS.find(candidate => candidate.id === interactionId);
  if (!interaction || !isStoryInteractionEligible(interaction, initial)) {
    return interactionResult(initial, interactionId, "unavailable");
  }

  if (interaction.type === "record" && responseValue(response, "classification") !== interaction.signalKind) {
    return interactionResult(initial, interactionId, "retryable", true);
  }
  if (interaction.type === "support") {
    const choice = responseValue(response, "choice");
    if (!interaction.choices.some(candidate => candidate.id === choice)) {
      return interactionResult(initial, interactionId, "retryable", true);
    }
    const resolved = chooseChapterSupport(initial, choice);
    return interactionResult(
      resolved.progress,
      interactionId,
      changed(initial, resolved.progress) ? "completed" : "unavailable",
      false,
      resolved.effects,
    );
  }
  if (interaction.type === "reveal") {
    return interactionResult(initial, interactionId, "acknowledged", false, [{
      type: "story-dialogue-acknowledged",
      interactionId,
    }]);
  }

  let resolved;
  switch (interaction.type) {
    case "device":
      resolved = repairChapterDevice(initial, interaction.id);
      break;
    case "record":
      resolved = collectChapterRecord(initial, interaction.id);
      break;
    case "rescue":
      resolved = rescueSera(initial);
      break;
    case "core":
      resolved = collectCoastCore(initial);
      break;
    default:
      return interactionResult(initial, interactionId, "unavailable");
  }
  return interactionResult(
    resolved.progress,
    interactionId,
    changed(initial, resolved.progress) ? "completed" : "unavailable",
    false,
    resolved.effects,
  );
}
