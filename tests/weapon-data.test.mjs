import test from "node:test";
import assert from "node:assert/strict";
import {
  STARTER_WEAPON_ID,
  WEAPON_ORDER,
  WEAPONS,
  getWeaponDefinition,
  resolveWeaponDefinition,
} from "../src/weapon-data.js";

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
      ["starter-sword", 1, null, null, 1, 64, 4],
      ["katana", 5, 80, 40, 1, 76, 4],
      ["reinforced-katana", 10, 180, 90, 1.3, 76, 3.8],
      ["superior-katana", 15, 350, 175, 1.5, 76, 3.5],
      ["elite-katana", 20, 600, 300, 2, 77, 3.3],
      ["masterwork-katana", 25, 900, 450, 2.2, 77, 3.3],
      ["reinforced-masterwork-katana", 30, 1300, 650, 2.5, 78, 3.1],
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
