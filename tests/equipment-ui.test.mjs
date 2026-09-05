import test from "node:test";
import assert from "node:assert/strict";
import { equipmentUiModel } from "../src/equipment-ui-20260903-volcano.js";
import { createInitialEquipmentByClass } from "../src/equipment-state-20260903-volcano.js";

test("궁수 대장간과 인벤토리는 현재 직업의 보유 활만 표시한다", () => {
  const model = equipmentUiModel({
    classId: "archer",
    level: 30,
    gold: 5000,
    equipment: {
      ownedWeaponIds: ["training-bow", "hunter-bow"],
      equippedWeaponId: "hunter-bow",
    },
  });

  assert.equal(model.buyItems.length, 6);
  assert.equal(model.sellItems.length, 1);
  assert.equal(model.inventoryItems.length, 2);
  assert.ok(model.buyItems.every(item => item.weapon.classId === "archer"));
  assert.ok(model.sellItems.every(item => item.weapon.classId === "archer"));
  assert.ok(model.inventoryItems.every(item => item.weapon.classId === "archer"));
  assert.equal(model.inventoryItems.find(item => item.weapon.id === "hunter-bow").equipped, true);
});

test("세 직업 장비 모델에는 다른 직업 무기가 섞이지 않는다", () => {
  const equipmentByClass = createInitialEquipmentByClass();
  for (const classId of ["warrior", "archer", "mage"]) {
    const model = equipmentUiModel({
      classId,
      level: 30,
      gold: 5000,
      equipment: equipmentByClass[classId],
    });
    assert.equal(model.classId, classId);
    assert.ok([...model.buyItems, ...model.sellItems, ...model.inventoryItems]
      .every(item => item.weapon.classId === classId));
  }
});

test("구매 항목은 레벨·Gold·보유 조건을 기존 대장간 문구로 구분한다", () => {
  const equipment = {
    ownedWeaponIds: ["training-staff", "apprentice-staff"],
    equippedWeaponId: "training-staff",
  };
  const model = equipmentUiModel({ classId: "mage", level: 4, gold: 79, equipment });
  const owned = model.buyItems.find(item => item.weapon.id === "apprentice-staff");
  const locked = model.buyItems.find(item => item.weapon.id === "reinforced-wand");
  assert.deepEqual(
    { disabled: owned.disabled, status: owned.status, buttonLabel: owned.buttonLabel },
    { disabled: true, status: "보유 중", buttonLabel: "보유 중" },
  );
  assert.deepEqual(
    { disabled: locked.disabled, status: locked.status, buttonLabel: locked.buttonLabel },
    { disabled: true, status: "Lv.10 필요", buttonLabel: "Lv.10 필요" },
  );

  const poor = equipmentUiModel({
    classId: "mage",
    level: 30,
    gold: 79,
    equipment: { ownedWeaponIds: ["training-staff"], equippedWeaponId: "training-staff" },
  }).buyItems[0];
  assert.equal(poor.status, "Gold 부족");
  assert.equal(poor.disabled, true);
});

test("판매·인벤토리 항목은 장착 상태와 직업별 전투 설명을 제공한다", () => {
  const model = equipmentUiModel({
    classId: "mage",
    level: 30,
    gold: 5000,
    equipment: {
      ownedWeaponIds: ["training-staff", "archmage-staff"],
      equippedWeaponId: "archmage-staff",
    },
  });
  assert.deepEqual(model.sellItems.map(item => [item.weapon.id, item.status, item.buttonLabel]), [
    ["archmage-staff", "장착 중", "450 G 판매"],
  ]);
  assert.match(model.inventoryItems[1].statsLabel, /투사체 520px\/s/);
  assert.match(model.inventoryItems[1].statsLabel, /폭발 134px/);
  assert.equal(model.inventoryItems[1].buttonLabel, "장착 중");
  assert.equal(model.inventoryItems[1].disabled, true);
});
