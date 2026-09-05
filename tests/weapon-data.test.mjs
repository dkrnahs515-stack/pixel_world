import test from "node:test";
import assert from "node:assert/strict";
import {
  STARTER_WEAPON_ID,
  STARTER_WEAPON_IDS,
  WEAPON_ORDER,
  WEAPON_ORDER_BY_CLASS,
  WEAPONS,
  getStarterWeaponId,
  getWeaponDefinition,
  getWeaponsForClass,
  resolveWeaponDefinition,
} from "../src/weapon-data-20260903-volcano-20260905-upgrade.js";

test("무기 카탈로그는 승인된 레벨·가격·전투 수치를 제공한다", () => {
  assert.deepEqual(
    WEAPON_ORDER.map(id => {
      const weapon = WEAPONS[id];
      return [
        id,
        weapon.requiredLevel,
        weapon.price,
        weapon.sellPrice,
        weapon.damage,
        weapon.range,
        weapon.strongCooldown,
      ];
    }),
    [
      ["starter-sword", 1, null, null, 4, 64, 4],
      ["katana", 5, 80, 40, 4, 76, 4],
      ["reinforced-katana", 10, 180, 90, 5.2, 76, 3.8],
      ["superior-katana", 15, 350, 175, 6, 76, 3.5],
      ["elite-katana", 20, 600, 300, 8, 77, 3.3],
      ["masterwork-katana", 25, 900, 450, 8.8, 77, 3.3],
      ["reinforced-masterwork-katana", 30, 1300, 650, 10, 78, 3.1],
      ["volcanic-heartblade", 30, null, null, 11, 80, 3],
      ["heaven-sovereign-sword", 1, null, null, 100, 76, 4],
    ],
  );
  assert.equal(STARTER_WEAPON_ID, "starter-sword");
});

test("모든 무기는 고유한 픽셀 외형을 가지며 명검 계열은 카타나보다 길고 장식이 많다", () => {
  const visuals = WEAPON_ORDER.map(id => WEAPONS[id].visual);
  for (const visual of visuals) {
    assert.equal(typeof visual.bladeLength, "number");
    assert.equal(typeof visual.bladeColor, "string");
    assert.equal(Object.isFrozen(visual), true);
  }
  assert.ok(WEAPONS["masterwork-katana"].visual.bladeLength > WEAPONS.katana.visual.bladeLength);
  assert.ok(
    WEAPONS["reinforced-masterwork-katana"].visual.goldMarks
      > WEAPONS["masterwork-katana"].visual.goldMarks,
  );
  assert.ok(
    WEAPONS["reinforced-masterwork-katana"].visual.redMarks
      > WEAPONS["masterwork-katana"].visual.redMarks,
  );
});

test("등록 조회는 미등록 ID를 구분하고 전투 해석은 시작 검으로 복구한다", () => {
  assert.equal(getWeaponDefinition("katana")?.name, "카타나");
  assert.equal(getWeaponDefinition("unknown"), null);
  assert.equal(getWeaponDefinition(null), null);
  assert.equal(resolveWeaponDefinition("unknown").id, "starter-sword");
  assert.equal(resolveWeaponDefinition().id, "starter-sword");
  assert.equal(Object.isFrozen(WEAPONS), true);
  assert.equal(Object.isFrozen(WEAPON_ORDER), true);
});

test("객체 프로토타입 이름은 카탈로그 무기로 조회되지 않는다", () => {
  for (const inheritedId of ["constructor", "toString", "__proto__"]) {
    assert.equal(getWeaponDefinition(inheritedId), null, inheritedId);
    assert.equal(resolveWeaponDefinition(inheritedId).id, STARTER_WEAPON_ID, inheritedId);
  }
});

test("직업별 무기 목록은 코드 보상 검과 각 직업 기본 무기를 포함한다", () => {
  assert.deepEqual(STARTER_WEAPON_IDS, {
    warrior: "starter-sword",
    archer: "training-bow",
    mage: "training-staff",
  });
  assert.deepEqual(Object.fromEntries(Object.entries(WEAPON_ORDER_BY_CLASS).map(
    ([classId, ids]) => [classId, ids.length],
  )), { warrior: 9, archer: 8, mage: 8 });
  assert.equal(Object.keys(WEAPONS).length, 25);
  assert.equal(getStarterWeaponId("archer"), "training-bow");
  assert.equal(getStarterWeaponId("mage"), "training-staff");
  assert.equal(getStarterWeaponId("invalid"), "starter-sword");
  for (const classId of ["warrior", "archer", "mage"]) {
    const weapons = getWeaponsForClass(classId);
    assert.equal(weapons.length, classId === "warrior" ? 9 : 8);
    assert.ok(weapons.every(weapon => weapon.classId === classId));
    assert.equal(weapons[0].id, STARTER_WEAPON_IDS[classId]);
  }
});

test("활 여덟 종은 승인된 피해·사거리·속도·Q 재사용시간을 가진다", () => {
  const expected = [
    ["training-bow", 3.6, 360, 560, 4.5],
    ["hunter-bow", 4, 380, 580, 4.5],
    ["reinforced-longbow", 4.8, 400, 600, 4.3],
    ["precision-longbow", 5.8, 420, 620, 4],
    ["elite-war-bow", 7.2, 440, 650, 3.8],
    ["masterwork-bow", 8.4, 460, 680, 3.6],
    ["reinforced-masterwork-bow", 9.6, 480, 720, 3.4],
    ["ember-tracker-bow", 10.6, 500, 750, 3.2],
  ];
  assert.deepEqual(getWeaponsForClass("archer").map(weapon => [
    weapon.id, weapon.damage, weapon.range, weapon.projectileSpeed, weapon.strongCooldown,
  ]), expected);
});

test("지팡이 여덟 종은 승인된 피해·사거리·속도·폭발 반경·Q 재사용시간을 가진다", () => {
  const expected = [
    ["training-staff", 4, 300, 420, 96, 5],
    ["apprentice-staff", 4.4, 315, 440, 100, 5],
    ["reinforced-wand", 5.4, 330, 460, 108, 4.7],
    ["superior-wand", 6.4, 345, 480, 116, 4.4],
    ["elite-sage-staff", 7.8, 360, 500, 124, 4.1],
    ["archmage-staff", 9, 375, 520, 134, 3.8],
    ["reinforced-archmage-staff", 10.4, 390, 550, 144, 3.6],
    ["leyflame-core-staff", 11.4, 405, 575, 156, 3.4],
  ];
  assert.deepEqual(getWeaponsForClass("mage").map(weapon => [
    weapon.id,
    weapon.damage,
    weapon.range,
    weapon.projectileSpeed,
    weapon.explosionRadius,
    weapon.strongCooldown,
  ]), expected);
});

test("세 계열은 같은 레벨·가격 단계를 공유하고 기본 무기는 판매할 수 없다", () => {
  const expected = [
    [1, null, null],
    [5, 80, 40],
    [10, 180, 90],
    [15, 350, 175],
    [20, 600, 300],
    [25, 900, 450],
    [30, 1300, 650],
    [30, null, null],
  ];
  for (const classId of ["warrior", "archer", "mage"]) {
    assert.deepEqual(getWeaponsForClass(classId).filter(weapon => weapon.id !== "heaven-sovereign-sword").map(weapon => [
      weapon.requiredLevel, weapon.price, weapon.sellPrice,
    ]), expected, classId);
  }
});

test("전투 무기 해석은 요청 직업과 다른 계열을 그 직업 기본 무기로 복구한다", () => {
  assert.equal(resolveWeaponDefinition("katana", "archer").id, "training-bow");
  assert.equal(resolveWeaponDefinition("hunter-bow", "mage").id, "training-staff");
  assert.equal(resolveWeaponDefinition("training-staff", "warrior").id, "starter-sword");
  assert.equal(resolveWeaponDefinition("missing", "mage").id, "training-staff");
  assert.equal(resolveWeaponDefinition("hunter-bow", "archer").id, "hunter-bow");
});
