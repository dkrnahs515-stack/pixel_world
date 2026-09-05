import { getNpcsForWorld as getCoastNpcsForWorld } from "./npc-data-20260829-coast.js";
import { VOLCANO_STORY_ACTORS } from "./volcano-story-data-20260903-volcano.js";

function actorVisible(actor, mapId, worldProgress) {
  if (!worldProgress?.unlockedMapIds?.includes(mapId)) return false;
  if (actor.id !== "vanguard-captain") return true;
  const volcano = worldProgress?.chapters?.volcano;
  return volcano?.coopBossDefeated === true && volcano.captainOutcome !== "lost";
}

function actorNpc(actor, placement) {
  return Object.freeze({
    id: `${actor.id}:${placement.mapId}`,
    actorId: actor.id,
    role: actor.role,
    name: actor.name,
    mapId: placement.mapId,
    x: placement.x,
    y: placement.y,
    interactionRadius: 80,
    coatColor: actor.id === "garen" ? "#9f5f3f" : "#8f394d",
    pages: actor.pages,
  });
}

export function getNpcsForWorld(mapId = "village", worldProgress = null) {
  const standardNpcs = getCoastNpcsForWorld(mapId, worldProgress);
  const volcanoNpcs = VOLCANO_STORY_ACTORS
    .filter(actor => actorVisible(actor, mapId, worldProgress))
    .flatMap(actor => actor.placements
      .filter(placement => placement.mapId === mapId)
      .map(placement => actorNpc(actor, placement)));
  return volcanoNpcs.length > 0
    ? Object.freeze([...standardNpcs, ...volcanoNpcs])
    : standardNpcs;
}
