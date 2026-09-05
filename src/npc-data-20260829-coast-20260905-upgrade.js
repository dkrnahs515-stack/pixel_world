const AREN = Object.freeze({
  id: "aren",
  role: "quest",
  name: "현자 아렌",
  mapId: "village",
  x: 1440,
  y: 520,
  interactionRadius: 80,
  coatColor: "#6f5bd3",
});

const MIA = Object.freeze({
  id: "mia",
  role: "shop",
  name: "연금술사 미아",
  mapId: "village",
  x: 2300,
  y: 1000,
  interactionRadius: 80,
  coatColor: "#0f9f8f",
});

const BRANN = Object.freeze({
  id: "brann",
  role: "blacksmith",
  name: "대장장이 브란",
  mapId: "village",
  x: 2460,
  y: 1000,
  interactionRadius: 80,
  appearance: Object.freeze({
    hairColor: "#6b442b",
    eyeColor: "#4ea5d9",
    apronColor: "#8a5a3b",
  }),
});

const NPCS_BY_WORLD = Object.freeze({
  village: Object.freeze([AREN, MIA, BRANN]),
});

export function getNpcsForWorld(mapId = "village", worldProgress = null) {
  const standardNpcs = NPCS_BY_WORLD[mapId] || [];
  const storyNpcs = COAST_STORY_ACTORS.flatMap(actor => actor.placements
    .filter(placement => placement.mapId === mapId)
    .filter(() => actor.renderMode === "npc")
    .filter(() => isStoryActorVisible(actor, worldProgress))
    .map(placement => Object.freeze({
      id: `${actor.id}:${mapId}`,
      actorId: actor.id,
      role: actor.role,
      name: actor.name,
      mapId,
      x: placement.x,
      y: placement.y,
      interactionRadius: 80,
      coatColor: actor.id === "mari" ? "#3a8ec9" : "#d47998",
      pages: actor.pages,
    })));
  return storyNpcs.length > 0 ? Object.freeze([...standardNpcs, ...storyNpcs]) : standardNpcs;
}

function isStoryActorVisible(actor, worldProgress) {
  if (!actor.visibleAfter) return true;
  return Boolean(worldProgress?.chapters?.coast?.[actor.visibleAfter]);
}
import { COAST_STORY_ACTORS } from "./coast-story-data-20260829-coast-20260905-upgrade.js";
