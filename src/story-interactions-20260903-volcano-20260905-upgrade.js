import { COAST_STORY_INTERACTIONS } from "./coast-story-data-20260829-coast-20260905-upgrade.js";
import {
  findNearbyStoryInteraction as findNearbyCoastStoryInteraction,
  isStoryInteractionEligible as isCoastStoryInteractionEligible,
  resolveStoryInteraction as resolveCoastInteraction,
  storyInteractionPrompt,
} from "./story-interactions-20260829-coast-20260905-upgrade.js";
import { VOLCANO_STORY_INTERACTIONS } from "./volcano-story-data-20260903-volcano-20260905-upgrade.js";
import {
  chooseVolcanoRoute,
  collectCoolantAnchor,
  collectVolcanoClue,
  collectVolcanoCore,
  normalizeWorldProgress,
  repairVolcanoDevice,
  resolveVolcanoCaptain,
} from "./chapter-progress-20260903-volcano-20260905-upgrade.js";

export { storyInteractionPrompt };

export const ALL_STORY_INTERACTIONS = Object.freeze([
  ...COAST_STORY_INTERACTIONS,
  ...VOLCANO_STORY_INTERACTIONS,
]);

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function transitionForVolcanoInteraction(progress, interaction, response) {
  switch (interaction.type) {
    case "volcano-device":
      return repairVolcanoDevice(progress, interaction.id);
    case "volcano-clue":
      return collectVolcanoClue(progress, interaction.id);
    case "volcano-coolant":
      return collectCoolantAnchor(progress, interaction.id);
    case "volcano-route":
      return chooseVolcanoRoute(progress, response);
    case "volcano-captain":
      return resolveVolcanoCaptain(progress);
    case "volcano-core":
      return collectVolcanoCore(progress);
    default:
      return { progress, effects: [] };
  }
}

function routeAvailable(progress) {
  return changed(progress, chooseVolcanoRoute(progress, "rescue").progress)
    || changed(progress, chooseVolcanoRoute(progress, "proceed").progress);
}

export function isStoryInteractionEligible(interaction, worldProgress) {
  if (interaction?.chapterId !== "volcano") {
    return isCoastStoryInteractionEligible(interaction, worldProgress);
  }
  const progress = normalizeWorldProgress(worldProgress);
  if (interaction.type === "volcano-route") return routeAvailable(progress);
  return changed(progress, transitionForVolcanoInteraction(progress, interaction).progress);
}

export function findNearbyStoryInteraction(interactions, player, worldProgress) {
  if (!Array.isArray(interactions) || !player || typeof player.mapId !== "string") return null;
  if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) return null;
  let nearest = null;
  let nearestDistanceSquared = Infinity;
  for (const interaction of interactions) {
    if (
      interaction?.mapId !== player.mapId
      || !Number.isFinite(interaction.x)
      || !Number.isFinite(interaction.y)
      || !Number.isFinite(interaction.interactionRadius)
      || !isStoryInteractionEligible(interaction, worldProgress)
    ) continue;
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

function responseValue(response, key) {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  return typeof response[key] === "string" ? response[key] : null;
}

function result(progress, interactionId, outcome, retryable = false, effects = []) {
  return { progress, effects, interactionId, outcome, retryable };
}

function resolveVolcanoInteraction(progress, interaction, response) {
  const initial = normalizeWorldProgress(progress);
  if (!isStoryInteractionEligible(interaction, initial)) {
    return result(initial, interaction.id, "unavailable");
  }
  if (interaction.type === "volcano-route") {
    const decision = responseValue(response, "decision");
    if (decision === "return" && !changed(initial, chooseVolcanoRoute(initial, "rescue").progress)) {
      return result(initial, interaction.id, "returned");
    }
    const prepared = changed(initial, chooseVolcanoRoute(initial, "rescue").progress);
    if ((prepared && decision !== "rescue") || (!prepared && decision !== "proceed")) {
      return result(initial, interaction.id, "retryable", true);
    }
    const resolved = transitionForVolcanoInteraction(initial, interaction, decision);
    return result(resolved.progress, interaction.id, "completed", false, resolved.effects);
  }
  const resolved = transitionForVolcanoInteraction(initial, interaction);
  return result(
    resolved.progress,
    interaction.id,
    changed(initial, resolved.progress) ? "completed" : "unavailable",
    false,
    resolved.effects,
  );
}

export function resolveStoryInteraction(progress, interactionId, response) {
  const interaction = ALL_STORY_INTERACTIONS.find(value => value.id === interactionId);
  if (interaction?.chapterId === "volcano") {
    return resolveVolcanoInteraction(progress, interaction, response);
  }
  const initial = normalizeWorldProgress(progress);
  const coastResult = resolveCoastInteraction(initial, interactionId, response);
  return {
    ...coastResult,
    progress: normalizeWorldProgress({
      ...initial,
      unlockedRegionIds: [...new Set([
        ...initial.unlockedRegionIds,
        ...coastResult.progress.unlockedRegionIds,
      ])],
      completedRegionIds: [...new Set([
        ...initial.completedRegionIds,
        ...coastResult.progress.completedRegionIds,
      ])],
      unlockedMapIds: [...new Set([
        ...initial.unlockedMapIds,
        ...coastResult.progress.unlockedMapIds,
      ])],
      chapters: {
        coast: coastResult.progress.chapters.coast,
        volcano: initial.chapters.volcano,
      },
    }),
  };
}

// Compatibility helper for callers that still pass only coast content.
export function findNearbyCoastInteraction(interactions, player, worldProgress) {
  return findNearbyCoastStoryInteraction(interactions, player, worldProgress);
}
