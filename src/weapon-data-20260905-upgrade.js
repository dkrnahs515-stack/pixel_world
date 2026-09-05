import { DEFAULT_CLASS_ID, normalizeClassId } from "./class-data-20260905-upgrade.js";

export const STARTER_WEAPON_IDS = Object.freeze({
  warrior: "starter-sword",
  archer: "training-bow",
  mage: "training-staff",
});
export const STARTER_WEAPON_ID = STARTER_WEAPON_IDS.warrior;

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
    classId: definition.classId ?? "warrior",
    weaponType: definition.weaponType ?? "sword",
    ...definition,
    sellPrice: definition.price === null ? null : definition.price / 2,
  });
}

const WARRIOR_WEAPON_ORDER = Object.freeze([
  STARTER_WEAPON_ID,
  "katana",
  "reinforced-katana",
  "superior-katana",
  "elite-katana",
  "masterwork-katana",
  "reinforced-masterwork-katana",
]);

const ARCHER_WEAPON_ORDER = Object.freeze([
  "training-bow",
  "hunter-bow",
  "reinforced-longbow",
  "precision-longbow",
  "elite-war-bow",
  "masterwork-bow",
  "reinforced-masterwork-bow",
]);

const MAGE_WEAPON_ORDER = Object.freeze([
  "training-staff",
  "apprentice-staff",
  "reinforced-wand",
  "superior-wand",
  "elite-sage-staff",
  "archmage-staff",
  "reinforced-archmage-staff",
]);

export const WEAPON_ORDER = WARRIOR_WEAPON_ORDER;
export const WEAPON_ORDER_BY_CLASS = Object.freeze({
  warrior: WARRIOR_WEAPON_ORDER,
  archer: ARCHER_WEAPON_ORDER,
  mage: MAGE_WEAPON_ORDER,
});

const TIER_LEVELS = Object.freeze([1, 5, 10, 15, 20, 25, 30]);
const TIER_PRICES = Object.freeze([null, 80, 180, 350, 600, 900, 1300]);

const BOW_SPECS = Object.freeze([
  ["training-bow", "훈련용 활", 0.9, 360, 560, 4.5, "#9a6a3a", "#d6b16f"],
  ["hunter-bow", "사냥꾼 활", 1, 380, 580, 4.5, "#7d542f", "#7fb069"],
  ["reinforced-longbow", "강화 장궁", 1.2, 400, 600, 4.3, "#6f4a2a", "#a7b6c2"],
  ["precision-longbow", "정밀 장궁", 1.45, 420, 620, 4, "#5b3b25", "#76c7d9"],
  ["elite-war-bow", "정예 전투궁", 1.8, 440, 650, 3.8, "#49301f", "#d4a72c"],
  ["masterwork-bow", "명궁", 2.1, 460, 680, 3.6, "#34251c", "#d9e7f1"],
  ["reinforced-masterwork-bow", "강화 명궁", 2.4, 480, 720, 3.4, "#241a15", "#f4c95d"],
]);

const STAFF_SPECS = Object.freeze([
  ["training-staff", "수련 지팡이", 1, 300, 420, 96, 5, "#795548", "#7dd3fc"],
  ["apprentice-staff", "견습 지팡이", 1.1, 315, 440, 100, 5, "#6d4c41", "#93c5fd"],
  ["reinforced-wand", "강화 마법봉", 1.35, 330, 460, 108, 4.7, "#5d4037", "#a78bfa"],
  ["superior-wand", "상급 마법봉", 1.6, 345, 480, 116, 4.4, "#4e342e", "#c084fc"],
  ["elite-sage-staff", "정예 현자의 지팡이", 1.95, 360, 500, 124, 4.1, "#3e2b27", "#34d399"],
  ["archmage-staff", "대마도 지팡이", 2.25, 375, 520, 134, 3.8, "#2f2424", "#f0abfc"],
  ["reinforced-archmage-staff", "강화 대마도 지팡이", 2.6, 390, 550, 144, 3.6, "#211a1d", "#fbbf24"],
]);

function bowWeapon(spec, index) {
  const [id, name, damage, range, projectileSpeed, strongCooldown, woodColor, accentColor] = spec;
  return weapon({
    id,
    name,
    classId: "archer",
    weaponType: "bow",
    tier: index + 1,
    requiredLevel: TIER_LEVELS[index],
    price: TIER_PRICES[index],
    damage,
    range,
    projectileSpeed,
    strongCooldown,
    visual: visual({
      limbLength: 24 + index * 2,
      limbWidth: 3 + Math.floor(index / 3),
      woodColor,
      stringColor: "#e5e7eb",
      accentColor,
      goldMarks: Math.max(0, index - 3),
    }),
  });
}

function staffWeapon(spec, index) {
  const [id, name, damage, range, projectileSpeed, explosionRadius, strongCooldown, shaftColor, coreColor] = spec;
  return weapon({
    id,
    name,
    classId: "mage",
    weaponType: "staff",
    tier: index + 1,
    requiredLevel: TIER_LEVELS[index],
    price: TIER_PRICES[index],
    damage,
    range,
    projectileSpeed,
    explosionRadius,
    strongCooldown,
    visual: visual({
      shaftLength: 26 + index * 2,
      shaftWidth: 3 + Math.floor(index / 4),
      shaftColor,
      coreColor,
      glowColor: coreColor,
      goldMarks: Math.max(0, index - 3),
    }),
  });
}

export const WEAPONS = Object.freeze(Object.fromEntries([
  [STARTER_WEAPON_ID, weapon({
    id: STARTER_WEAPON_ID,
    name: "시작 검",
    requiredLevel: 1,
    price: null,
    damage: 1,
    range: 64,
    strongCooldown: 4,
    tier: 1,
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
    tier: 2,
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
    tier: 3,
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
    tier: 4,
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
    tier: 5,
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
    tier: 6,
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
    tier: 7,
    visual: reinforcedMasterworkVisual,
  })],
  ...BOW_SPECS.map((spec, index) => [spec[0], bowWeapon(spec, index)]),
  ...STAFF_SPECS.map((spec, index) => [spec[0], staffWeapon(spec, index)]),
]));

export function getWeaponDefinition(id) {
  if (typeof id !== "string") return null;
  return Object.hasOwn(WEAPONS, id) ? WEAPONS[id] : null;
}

export function getStarterWeaponId(classId = DEFAULT_CLASS_ID) {
  return STARTER_WEAPON_IDS[normalizeClassId(classId)];
}

export function getWeaponsForClass(classId = DEFAULT_CLASS_ID) {
  return WEAPON_ORDER_BY_CLASS[normalizeClassId(classId)].map(id => WEAPONS[id]);
}

export function resolveWeaponDefinition(id, classId = DEFAULT_CLASS_ID) {
  const normalizedClassId = normalizeClassId(classId);
  const weapon = getWeaponDefinition(id);
  return weapon?.classId === normalizedClassId
    ? weapon
    : WEAPONS[getStarterWeaponId(normalizedClassId)];
}
