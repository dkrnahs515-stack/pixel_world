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

export function getNpcsForWorld(mapId = "village") {
  return NPCS_BY_WORLD[mapId] || [];
}
