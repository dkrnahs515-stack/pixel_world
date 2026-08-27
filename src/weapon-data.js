export const STARTER_WEAPON_ID = "starter-sword";

function visual(definition) {
  return Object.freeze({ ...definition });
}

const starterVisual = visual({
  bladeLength: 21,
  bladeWidth: 4,
  bladeColor: "#bec9d4",
  highlightColor: "#eef6ff",
  spineColor: "#7a8794",
  gripColor: "#6b4b2f",
  guardColor: "#4b5563",
  pommelColor: "#5b3b2a",
  goldMarks: 0,
  redMarks: 0,
});

const katanaVisual = visual({
  bladeLength: 29,
  bladeWidth: 3,
  bladeColor: "#dceeff",
  highlightColor: "#f8fafc",
  spineColor: "#4b5563",
  gripColor: "#15191f",
  guardColor: "#252b35",
  pommelColor: "#4b5563",
  goldMarks: 0,
  redMarks: 0,
});

const reinforcedVisual = visual({
  bladeLength: 29,
  bladeWidth: 3,
  bladeColor: "#e7eef5",
  highlightColor: "#ffffff",
  spineColor: "#414854",
  gripColor: "#12161c",
  guardColor: "#202938",
  pommelColor: "#596273",
  goldMarks: 0,
  redMarks: 0,
});

const superiorVisual = visual({
  bladeLength: 29,
  bladeWidth: 4,
  bladeColor: "#e9edf2",
  highlightColor: "#ffffff",
  spineColor: "#323843",
  gripColor: "#11151a",
  guardColor: "#1f2937",
  pommelColor: "#677180",
  goldMarks: 0,
  redMarks: 0,
});

const eliteVisual = visual({
  bladeLength: 30,
  bladeWidth: 3,
  bladeColor: "#eff6ff",
  highlightColor: "#ffffff",
  spineColor: "#3e4652",
  gripColor: "#11151a",
  guardColor: "#d4a72c",
  pommelColor: "#b88b24",
  goldMarks: 1,
  redMarks: 0,
});

const masterworkVisual = visual({
  bladeLength: 31,
  bladeWidth: 3,
  bladeColor: "#f4f7f8",
  highlightColor: "#ffffff",
  spineColor: "#353b45",
  gripColor: "#0d1117",
  guardColor: "#111827",
  pommelColor: "#8b949e",
  goldMarks: 2,
  redMarks: 1,
  scabbardLength: 35,
  scabbardColor: "#101319",
  scabbardAccentColor: "#9f2f32",
  scabbardGoldMarks: 1,
});

const reinforcedMasterworkVisual = visual({
  bladeLength: 32,
  bladeWidth: 3,
  bladeColor: "#f7fafc",
  highlightColor: "#ffffff",
  spineColor: "#2d333d",
  gripColor: "#090d12",
  guardColor: "#111827",
  pommelColor: "#d4a72c",
  goldMarks: 4,
  redMarks: 2,
  scabbardLength: 36,
  scabbardColor: "#090c11",
  scabbardAccentColor: "#9f2f32",
  scabbardGoldMarks: 3,
});

function weapon(definition) {
  return Object.freeze({
    ...definition,
    sellPrice: definition.price === null ? null : definition.price / 2,
  });
}

export const WEAPON_ORDER = Object.freeze([
  STARTER_WEAPON_ID,
  "katana",
  "reinforced-katana",
  "superior-katana",
  "elite-katana",
  "masterwork-katana",
  "reinforced-masterwork-katana",
]);

export const WEAPONS = Object.freeze(Object.fromEntries([
  [STARTER_WEAPON_ID, weapon({
    id: STARTER_WEAPON_ID,
    name: "시작 검",
    requiredLevel: 1,
    price: null,
    damage: 1,
    range: 64,
    strongCooldown: 4,
    visual: starterVisual,
  })],
  ["katana", weapon({
    id: "katana",
    name: "카타나",
    requiredLevel: 5,
    price: 80,
    damage: 1,
    range: 76,
    strongCooldown: 4,
    visual: katanaVisual,
  })],
  ["reinforced-katana", weapon({
    id: "reinforced-katana",
    name: "강화 카타나",
    requiredLevel: 10,
    price: 180,
    damage: 1.3,
    range: 76,
    strongCooldown: 3.8,
    visual: reinforcedVisual,
  })],
  ["superior-katana", weapon({
    id: "superior-katana",
    name: "상급 카타나",
    requiredLevel: 15,
    price: 350,
    damage: 1.5,
    range: 76,
    strongCooldown: 3.5,
    visual: superiorVisual,
  })],
  ["elite-katana", weapon({
    id: "elite-katana",
    name: "정예 카타나",
    requiredLevel: 20,
    price: 600,
    damage: 2,
    range: 77,
    strongCooldown: 3.3,
    visual: eliteVisual,
  })],
  ["masterwork-katana", weapon({
    id: "masterwork-katana",
    name: "명검",
    requiredLevel: 25,
    price: 900,
    damage: 2.2,
    range: 77,
    strongCooldown: 3.3,
    visual: masterworkVisual,
  })],
  ["reinforced-masterwork-katana", weapon({
    id: "reinforced-masterwork-katana",
    name: "강화 명검",
    requiredLevel: 30,
    price: 1300,
    damage: 2.5,
    range: 78,
    strongCooldown: 3.1,
    visual: reinforcedMasterworkVisual,
  })],
]));

export function getWeaponDefinition(id) {
  if (typeof id !== "string") return null;
  return Object.hasOwn(WEAPONS, id) ? WEAPONS[id] : null;
}

export function resolveWeaponDefinition(id) {
  return getWeaponDefinition(id) || WEAPONS[STARTER_WEAPON_ID];
}
