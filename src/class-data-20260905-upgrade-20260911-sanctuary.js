export const CLASS_IDS = Object.freeze(["warrior", "archer", "mage"]);
export const DEFAULT_CLASS_ID = "warrior";

function classDefinition(definition) {
  return Object.freeze({
    ...definition,
    stats: Object.freeze({ ...definition.stats }),
  });
}

export const CLASSES = Object.freeze({
  warrior: classDefinition({
    id: "warrior",
    name: "검사",
    role: "근접 전투",
    basicLabel: "전방 검격",
    strongLabel: "회전 베기",
    starterWeaponId: "starter-sword",
    stats: {
      baseMaxHp: 120,
      maxHpPerLevel: 12,
      baseMaxMp: 80,
      maxMpPerLevel: 4,
      attackPerLevel: 2,
      moveSpeed: 230,
    },
  }),
  archer: classDefinition({
    id: "archer",
    name: "궁수",
    role: "원거리 전투",
    basicLabel: "화살",
    strongLabel: "관통 화살",
    starterWeaponId: "training-bow",
    stats: {
      baseMaxHp: 100,
      maxHpPerLevel: 10,
      baseMaxMp: 100,
      maxMpPerLevel: 5,
      attackPerLevel: 2,
      moveSpeed: 265,
    },
  }),
  mage: classDefinition({
    id: "mage",
    name: "마법사",
    role: "범위 마법",
    basicLabel: "마법탄",
    strongLabel: "폭발 마법탄",
    starterWeaponId: "training-staff",
    stats: {
      baseMaxHp: 80,
      maxHpPerLevel: 8,
      baseMaxMp: 140,
      maxMpPerLevel: 7,
      attackPerLevel: 3,
      moveSpeed: 245,
    },
  }),
});

export function getClassDefinition(id) {
  if (typeof id !== "string") return null;
  return Object.hasOwn(CLASSES, id) ? CLASSES[id] : null;
}

export function normalizeClassId(id) {
  return getClassDefinition(id)?.id || DEFAULT_CLASS_ID;
}
