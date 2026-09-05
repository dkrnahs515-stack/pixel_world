import { DEFAULT_CLASS_ID, normalizeClassId } from "./class-data.js";
import {
  STARTER_WEAPON_ID,
  STARTER_WEAPON_IDS,
  WEAPONS as COAST_WEAPONS,
  WEAPON_ORDER_BY_CLASS as COAST_WEAPON_ORDER_BY_CLASS,
} from "./weapon-data.js";

export { STARTER_WEAPON_ID, STARTER_WEAPON_IDS };

const visual = definition => Object.freeze({ ...definition });
const hiddenWeapon = definition => Object.freeze({
  requiredLevel: 30,
  price: null,
  sellPrice: null,
  rewardOnly: true,
  tier: 8,
  ...definition,
});

export const VOLCANO_HIDDEN_WEAPON_IDS = Object.freeze({
  warrior: "volcanic-heartblade",
  archer: "ember-tracker-bow",
  mage: "leyflame-core-staff",
});

const VOLCANO_HIDDEN_WEAPONS = Object.freeze({
  "volcanic-heartblade": hiddenWeapon({
    id: "volcanic-heartblade",
    name: "불굴의 화심검",
    classId: "warrior",
    weaponType: "sword",
    damage: 2.75,
    range: 80,
    strongCooldown: 3,
    visual: visual({
      bladeLength: 34,
      bladeWidth: 4,
      bladeColor: "#ffb347",
      highlightColor: "#fff1b8",
      spineColor: "#8f2d24",
      gripColor: "#24130f",
      guardColor: "#f97316",
      pommelColor: "#ef4444",
      goldMarks: 4,
      redMarks: 3,
      scabbardLength: 38,
      scabbardColor: "#35120e",
      scabbardAccentColor: "#f97316",
      scabbardGoldMarks: 4,
    }),
  }),
  "ember-tracker-bow": hiddenWeapon({
    id: "ember-tracker-bow",
    name: "불굴의 잿불궁",
    classId: "archer",
    weaponType: "bow",
    damage: 2.65,
    range: 500,
    projectileSpeed: 750,
    strongCooldown: 3.2,
    visual: visual({
      limbLength: 38,
      limbWidth: 5,
      woodColor: "#7c2d12",
      stringColor: "#fde68a",
      accentColor: "#fb923c",
      goldMarks: 4,
    }),
  }),
  "leyflame-core-staff": hiddenWeapon({
    id: "leyflame-core-staff",
    name: "불굴의 용맥지팡이",
    classId: "mage",
    weaponType: "staff",
    damage: 2.85,
    range: 405,
    projectileSpeed: 575,
    explosionRadius: 156,
    strongCooldown: 3.4,
    visual: visual({
      shaftLength: 40,
      shaftWidth: 4,
      shaftColor: "#431407",
      coreColor: "#fbbf24",
      glowColor: "#fb7185",
      goldMarks: 4,
    }),
  }),
});

const CODE_WEAPON = Object.freeze({
  ...COAST_WEAPONS["starter-sword"],
  id: "heaven-sovereign-sword", name: "천상천하 유아독존",
  damage: 100, range: 76, requiredLevel: 1, tier: 9,
  price: null, sellPrice: null, rewardOnly: true,
  visual: Object.freeze({ ...COAST_WEAPONS["starter-sword"].visual,
    bladeLength: 32, bladeWidth: 5, bladeColor: "#fff5bb", highlightColor: "#ffffff",
    guardColor: "#eab308", pommelColor: "#eab308" }),
});
export const WEAPONS = Object.freeze({ ...Object.fromEntries(Object.entries({ ...COAST_WEAPONS, ...VOLCANO_HIDDEN_WEAPONS }).map(([id, weapon]) => [id, Object.freeze({ ...weapon, damage: Number((weapon.damage * 4).toFixed(4)) })])), [CODE_WEAPON.id]: CODE_WEAPON });

export const WEAPON_ORDER_BY_CLASS = Object.freeze(Object.fromEntries(
  Object.entries(COAST_WEAPON_ORDER_BY_CLASS).map(([classId, ids]) => [
    classId,
    Object.freeze([...ids, VOLCANO_HIDDEN_WEAPON_IDS[classId], ...(classId === "warrior" ? [CODE_WEAPON.id] : [])]),
  ]),
));
export const WEAPON_ORDER = WEAPON_ORDER_BY_CLASS.warrior;

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
