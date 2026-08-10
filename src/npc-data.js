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

const NPCS_BY_WORLD = Object.freeze({
  village: Object.freeze([AREN, MIA]),
});

export function getNpcsForWorld(mapId = "village") {
  return NPCS_BY_WORLD[mapId] || [];
}
