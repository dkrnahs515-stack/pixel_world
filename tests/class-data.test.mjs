import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASS_IDS,
  CLASSES,
  DEFAULT_CLASS_ID,
  getClassDefinition,
  normalizeClassId,
} from "../src/class-data-20260905-upgrade.js";

test("세 직업만 허용하고 알 수 없는 런타임 직업은 검사로 복구한다", () => {
  assert.deepEqual(CLASS_IDS, ["warrior", "archer", "mage"]);
  assert.equal(DEFAULT_CLASS_ID, "warrior");
  assert.equal(normalizeClassId("warrior"), "warrior");
  assert.equal(normalizeClassId("archer"), "archer");
  assert.equal(normalizeClassId("mage"), "mage");
  assert.equal(normalizeClassId("unknown"), "warrior");
  assert.equal(normalizeClassId(null), "warrior");
});

test("직업 정의는 승인된 이름·스킬·기본 무기·성장 수치를 제공한다", () => {
  assert.deepEqual(Object.fromEntries(CLASS_IDS.map(classId => {
    const definition = getClassDefinition(classId);
    return [classId, {
      name: definition.name,
      basicLabel: definition.basicLabel,
      strongLabel: definition.strongLabel,
      starterWeaponId: definition.starterWeaponId,
      stats: definition.stats,
    }];
  })), {
    warrior: {
      name: "검사",
      basicLabel: "전방 검격",
      strongLabel: "회전 베기",
      starterWeaponId: "starter-sword",
      stats: { baseMaxHp: 120, maxHpPerLevel: 12, baseMaxMp: 80, maxMpPerLevel: 4, attackPerLevel: 2, moveSpeed: 230 },
    },
    archer: {
      name: "궁수",
      basicLabel: "화살",
      strongLabel: "관통 화살",
      starterWeaponId: "training-bow",
      stats: { baseMaxHp: 100, maxHpPerLevel: 10, baseMaxMp: 100, maxMpPerLevel: 5, attackPerLevel: 2, moveSpeed: 265 },
    },
    mage: {
      name: "마법사",
      basicLabel: "마법탄",
      strongLabel: "폭발 마법탄",
      starterWeaponId: "training-staff",
      stats: { baseMaxHp: 80, maxHpPerLevel: 8, baseMaxMp: 140, maxMpPerLevel: 7, attackPerLevel: 3, moveSpeed: 245 },
    },
  });
  assert.equal(getClassDefinition("unknown"), null);
  assert.equal(Object.isFrozen(CLASSES), true);
  assert.ok(CLASS_IDS.every(classId => Object.isFrozen(CLASSES[classId].stats)));
});

test("객체 프로토타입 이름은 직업 ID로 허용하지 않는다", () => {
  for (const inheritedId of ["constructor", "toString", "__proto__"]) {
    assert.equal(getClassDefinition(inheritedId), null, inheritedId);
    assert.equal(normalizeClassId(inheritedId), "warrior", inheritedId);
  }
});
