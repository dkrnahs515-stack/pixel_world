import test from "node:test";
import assert from "node:assert/strict";
import {
  buyWeapon,
  createInitialClassEquipment,
  createInitialEquipment,
  createInitialEquipmentByClass,
  equipWeapon,
  getClassEquipment,
  normalizeClassEquipment,
  normalizeEquipment,
  normalizeEquipmentByClass,
  sellWeapon,
} from "../src/equipment-state.js";

function progress(overrides = {}) {
  return {
    level: 30,
    gold: 2000,
    inventory: { hpPotion: 2, mpPotion: 3 },
    equipment: createInitialEquipment(),
    ...overrides,
  };
}

test("상위 무기는 이전 단계를 사지 않아도 구매되며 자동 장착되지 않는다", () => {
  const source = progress();
  const result = buyWeapon(source, "masterwork-katana");
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.weapon.id, "masterwork-katana");
  assert.equal(result.progress.gold, 1100);
  assert.deepEqual(result.progress.equipment.ownedWeaponIds, ["starter-sword", "masterwork-katana"]);
  assert.equal(result.progress.equipment.equippedWeaponId, "starter-sword");
  assert.deepEqual(source.equipment, createInitialEquipment());
  assert.deepEqual(result.progress.inventory, source.inventory);
});

test("구매는 레벨·Gold·보유 여부를 검사하고 실패 시 원본을 유지한다", () => {
  const locked = progress({ level: 4 });
  const poor = progress({ level: 5, gold: 79 });
  const owned = progress({
    level: 5,
    equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "starter-sword" },
  });
  for (const [result, reason, source] of [
    [buyWeapon(locked, "katana"), "level_locked", locked],
    [buyWeapon(poor, "katana"), "insufficient_gold", poor],
    [buyWeapon(owned, "katana"), "already_owned", owned],
    [buyWeapon(locked, "starter-sword"), "starter_weapon", locked],
    [buyWeapon(locked, "unknown"), "unknown_weapon", locked],
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.progress, source);
  }
});

test("장착 무기를 팔면 다른 상위 무기가 있어도 시작 검을 장착한다", () => {
  const source = progress({
    equipment: {
      ownedWeaponIds: ["starter-sword", "katana", "masterwork-katana"],
      equippedWeaponId: "masterwork-katana",
    },
  });
  const result = sellWeapon(source, "masterwork-katana");
  assert.equal(result.ok, true);
  assert.equal(result.progress.gold, 2450);
  assert.deepEqual(result.progress.equipment.ownedWeaponIds, ["starter-sword", "katana"]);
  assert.equal(result.progress.equipment.equippedWeaponId, "starter-sword");
  assert.equal(source.equipment.equippedWeaponId, "masterwork-katana");
});

test("비장착 무기를 팔면 현재 장착 무기를 유지한다", () => {
  const result = sellWeapon(progress({
    gold: 10,
    equipment: {
      ownedWeaponIds: ["starter-sword", "katana", "elite-katana"],
      equippedWeaponId: "elite-katana",
    },
  }), "katana");
  assert.equal(result.progress.gold, 50);
  assert.equal(result.progress.equipment.equippedWeaponId, "elite-katana");
});

test("세 직업은 자기 기본 무기만 보유·장착한 독립 장비로 시작한다", () => {
  assert.deepEqual(createInitialEquipmentByClass(), {
    warrior: { ownedWeaponIds: ["starter-sword"], equippedWeaponId: "starter-sword" },
    archer: { ownedWeaponIds: ["training-bow"], equippedWeaponId: "training-bow" },
    mage: { ownedWeaponIds: ["training-staff"], equippedWeaponId: "training-staff" },
  });
  assert.deepEqual(createInitialClassEquipment("invalid"), createInitialEquipment());
});

test("직업 장비 정규화는 다른 계열과 중복을 제거하고 해당 기본 무기로 복구한다", () => {
  assert.deepEqual(normalizeClassEquipment("archer", {
    ownedWeaponIds: ["katana", "hunter-bow", "hunter-bow", "masterwork-bow"],
    equippedWeaponId: "katana",
  }), {
    ownedWeaponIds: ["training-bow", "hunter-bow", "masterwork-bow"],
    equippedWeaponId: "training-bow",
  });
  const normalized = normalizeEquipmentByClass({
    warrior: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "katana" },
    archer: null,
    mage: { ownedWeaponIds: ["training-staff", "hunter-bow"], equippedWeaponId: "hunter-bow" },
  });
  assert.equal(normalized.warrior.equippedWeaponId, "katana");
  assert.deepEqual(normalized.archer, createInitialClassEquipment("archer"));
  assert.deepEqual(normalized.mage, createInitialClassEquipment("mage"));
});

test("직업별 구매는 대상 장비만 변경하고 다른 직업 장비를 보존한다", () => {
  const equipmentByClass = createInitialEquipmentByClass();
  const source = progress({ equipmentByClass });
  const result = buyWeapon(source, "archer", "hunter-bow");
  assert.equal(result.ok, true);
  assert.equal(result.progress.gold, 1920);
  assert.deepEqual(result.progress.equipmentByClass.archer, {
    ownedWeaponIds: ["training-bow", "hunter-bow"],
    equippedWeaponId: "training-bow",
  });
  assert.deepEqual(result.progress.equipmentByClass.warrior, equipmentByClass.warrior);
  assert.deepEqual(result.progress.equipmentByClass.mage, equipmentByClass.mage);
  assert.equal(result.progress.equipmentByClass.warrior, equipmentByClass.warrior);
});

test("거래와 장착은 현재 직업과 다른 계열 무기를 거부한다", () => {
  const source = progress({ equipmentByClass: createInitialEquipmentByClass() });
  assert.equal(buyWeapon(source, "archer", "katana").reason, "class_mismatch");
  assert.equal(sellWeapon(source, "mage", "hunter-bow").reason, "class_mismatch");
  assert.equal(equipWeapon(source, "warrior", "training-staff").reason, "class_mismatch");
});

test("직업별 판매와 장착은 대상 직업 상태만 갱신한다", () => {
  const source = progress({
    gold: 0,
    equipmentByClass: {
      ...createInitialEquipmentByClass(),
      mage: {
        ownedWeaponIds: ["training-staff", "apprentice-staff", "superior-wand"],
        equippedWeaponId: "superior-wand",
      },
    },
  });
  const sold = sellWeapon(source, "mage", "apprentice-staff");
  assert.equal(sold.ok, true);
  assert.equal(sold.progress.gold, 40);
  assert.equal(sold.progress.equipmentByClass.mage.equippedWeaponId, "superior-wand");
  const equipped = equipWeapon(sold.progress, "mage", "training-staff");
  assert.equal(equipped.ok, true);
  assert.equal(equipped.progress.equipmentByClass.mage.equippedWeaponId, "training-staff");
  assert.deepEqual(getClassEquipment(equipped.progress, "archer"), createInitialClassEquipment("archer"));
});

test("시작 검과 미보유·미등록 무기는 판매할 수 없다", () => {
  const source = progress();
  assert.equal(sellWeapon(source, "starter-sword").reason, "starter_weapon");
  assert.equal(sellWeapon(source, "katana").reason, "not_owned");
  assert.equal(sellWeapon(source, "unknown").reason, "unknown_weapon");
  assert.equal(sellWeapon(source, "katana").progress, source);
});

test("보유 무기는 자유롭게 장착하고 미보유·동일 장착은 변경하지 않는다", () => {
  const source = progress({
    equipment: { ownedWeaponIds: ["starter-sword", "reinforced-katana"], equippedWeaponId: "starter-sword" },
  });
  const equipped = equipWeapon(source, "reinforced-katana");
  assert.equal(equipped.ok, true);
  assert.equal(equipped.progress.equipment.equippedWeaponId, "reinforced-katana");
  assert.equal(source.equipment.equippedWeaponId, "starter-sword");
  const same = equipWeapon(equipped.progress, "reinforced-katana");
  assert.equal(same.reason, "already_equipped");
  assert.equal(same.progress, equipped.progress);
  assert.equal(equipWeapon(source, "masterwork-katana").reason, "not_owned");
  assert.equal(equipWeapon(source, "unknown").reason, "unknown_weapon");
});

test("판매한 무기는 요구 레벨을 충족하면 원래 가격으로 재구매할 수 있다", () => {
  const source = progress({
    level: 5,
    gold: 40,
    equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "katana" },
  });
  const sold = sellWeapon(source, "katana");
  assert.equal(sold.progress.gold, 80);
  const repurchased = buyWeapon(sold.progress, "katana");
  assert.equal(repurchased.ok, true);
  assert.equal(repurchased.progress.gold, 0);
  assert.equal(repurchased.progress.equipment.equippedWeaponId, "starter-sword");
});

test("장비 정규화는 카탈로그 순서로 중복·미등록 ID를 제거하고 잘못된 장착을 복구한다", () => {
  assert.deepEqual(normalizeEquipment({
    ownedWeaponIds: ["masterwork-katana", "katana", "katana", "unknown"],
    equippedWeaponId: "unknown",
  }), {
    ownedWeaponIds: ["starter-sword", "katana", "masterwork-katana"],
    equippedWeaponId: "starter-sword",
  });
  assert.deepEqual(normalizeEquipment({
    ownedWeaponIds: ["elite-katana"],
    equippedWeaponId: "elite-katana",
  }), {
    ownedWeaponIds: ["starter-sword", "elite-katana"],
    equippedWeaponId: "elite-katana",
  });
  assert.deepEqual(normalizeEquipment(null), createInitialEquipment());
});

test("상속 프로퍼티 이름은 구매·보유·장착 무기 ID로 받아들이지 않는다", () => {
  for (const inheritedId of ["constructor", "toString", "__proto__"]) {
    const source = progress();
    const purchase = buyWeapon(source, inheritedId);
    assert.equal(purchase.ok, false, inheritedId);
    assert.equal(purchase.reason, "unknown_weapon", inheritedId);
    assert.equal(purchase.progress, source, inheritedId);
    assert.deepEqual(normalizeEquipment({
      ownedWeaponIds: [inheritedId],
      equippedWeaponId: inheritedId,
    }), {
      ownedWeaponIds: ["starter-sword"],
      equippedWeaponId: "starter-sword",
    });
  }
});
