import test from "node:test";
import assert from "node:assert/strict";
import {
  PixelRPG,
  interactionKeyAction,
  npcInteractionKeyAction,
} from "../src/game-20260828-classes.js";
import { getNpcsForWorld } from "../src/npc-data.js";
import { createInitialProgress } from "../src/quest-state.js";

function fakeNode(documentRef, overrides = {}) {
  const attributes = new Map();
  const classes = new Set();
  return {
    textContent: "",
    hidden: false,
    disabled: false,
    style: {},
    dataset: {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    focus() {
      if (!this.disabled && !this.hidden) documentRef.activeElement = this;
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    ...overrides,
  };
}

function memoryStorage() {
  const values = new Map();
  const writes = [];
  return {
    writes,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      values.set(key, String(value));
      writes.push({ key, value: JSON.parse(value) });
    },
  };
}

function blacksmithHarness(overrides = {}) {
  const documentRef = { activeElement: null };
  globalThis.document = documentRef;
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const notifications = [];
  const initial = createInitialProgress();
  const { equipment: warriorEquipmentOverrides, ...progressOverrides } = overrides;
  const weaponIds = [
    "katana",
    "reinforced-katana",
    "superior-katana",
    "elite-katana",
    "masterwork-katana",
    "reinforced-masterwork-katana",
  ];
  const inventoryWeaponIds = ["starter-sword", ...weaponIds];
  const buyWeaponButtons = weaponIds.map(id => fakeNode(documentRef, { dataset: { buyWeapon: id } }));
  const sellWeaponButtons = weaponIds.map(id => fakeNode(documentRef, { dataset: { sellWeapon: id } }));
  const buyWeaponCards = weaponIds.map(id => fakeNode(documentRef, { dataset: { buyWeaponCard: id } }));
  const sellWeaponCards = weaponIds.map(id => fakeNode(documentRef, { dataset: { sellWeaponCard: id }, hidden: true }));
  const buyWeaponStatuses = weaponIds.map(id => fakeNode(documentRef, { dataset: { buyWeaponStatus: id } }));
  const sellWeaponStatuses = weaponIds.map(id => fakeNode(documentRef, { dataset: { sellWeaponStatus: id } }));
  const inventoryWeaponCards = inventoryWeaponIds.map(id => fakeNode(documentRef, {
    dataset: { inventoryWeapon: id },
    hidden: id !== "starter-sword",
  }));
  const equipWeaponButtons = inventoryWeaponIds.map(id => fakeNode(documentRef, {
    dataset: { equipWeapon: id },
    disabled: id === "starter-sword",
  }));
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "village";
  game.running = true;
  game.inputEnabled = true;
  game.chatInputActive = false;
  game.portalTransition = null;
  game.attackState = null;
  game.keys = new Set();
  game.messageTimer = 0;
  game.qaEnabled = false;
  game.classId = "warrior";
  game.npcs = getNpcsForWorld("village");
  game.nearbyNpc = null;
  game.pendingWeaponSaleId = null;
  game.player = {
    name: "대장간테스터",
    x: 0,
    y: 0,
    moving: false,
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100,
    respawnTimer: 0,
    equippedWeaponId: "starter-sword",
  };
  game.progress = {
    ...initial,
    ...progressOverrides,
    inventory: { ...initial.inventory, ...(overrides.inventory || {}) },
    equipmentByClass: {
      ...initial.equipmentByClass,
      warrior: {
        ...initial.equipmentByClass.warrior,
        ...(warriorEquipmentOverrides || {}),
        ownedWeaponIds: [...(
          warriorEquipmentOverrides?.ownedWeaponIds
          || initial.equipmentByClass.warrior.ownedWeaponIds
        )],
      },
    },
  };
  game.player.equippedWeaponId = game.progress.equipmentByClass.warrior.equippedWeaponId;
  const message = fakeNode(documentRef);
  Object.defineProperty(message, "textContent", {
    get() { return notifications.at(-1) ?? ""; },
    set(value) { notifications.push(value); },
  });
  game.canvas = fakeNode(documentRef);
  game.ui = {
    dialogueOverlay: fakeNode(documentRef, { hidden: true }),
    shopOverlay: fakeNode(documentRef, { hidden: true }),
    inventoryOverlay: fakeNode(documentRef, { hidden: true }),
    inventoryCloseButton: fakeNode(documentRef),
    inventoryDoneButton: fakeNode(documentRef),
    qaOverlay: fakeNode(documentRef, { hidden: true }),
    blacksmithOverlay: fakeNode(documentRef, { hidden: true }),
    blacksmithGoldText: fakeNode(documentRef),
    blacksmithEquippedWeaponText: fakeNode(documentRef),
    blacksmithCloseButton: fakeNode(documentRef),
    blacksmithBuyTab: fakeNode(documentRef),
    blacksmithSellTab: fakeNode(documentRef),
    blacksmithBuyPanel: fakeNode(documentRef),
    blacksmithSellPanel: fakeNode(documentRef, { hidden: true }),
    buyWeaponButtons,
    sellWeaponButtons,
    buyWeaponCards,
    sellWeaponCards,
    buyWeaponStatuses,
    sellWeaponStatuses,
    weaponSaleConfirmOverlay: fakeNode(documentRef, { hidden: true }),
    weaponSaleConfirmText: fakeNode(documentRef),
    weaponSaleCancelButton: fakeNode(documentRef),
    weaponSaleConfirmButton: fakeNode(documentRef),
    npcPrompt: fakeNode(documentRef, { hidden: true }),
    npcPromptText: fakeNode(documentRef),
    expText: fakeNode(documentRef),
    expBar: fakeNode(documentRef),
    goldText: fakeNode(documentRef),
    hpPotionCount: fakeNode(documentRef),
    mpPotionCount: fakeNode(documentRef),
    hpPotionSlot: fakeNode(documentRef),
    mpPotionSlot: fakeNode(documentRef),
    inventoryHpPotionCount: fakeNode(documentRef),
    inventoryMpPotionCount: fakeNode(documentRef),
    inventoryHpUseButton: fakeNode(documentRef),
    inventoryMpUseButton: fakeNode(documentRef),
    inventoryWeaponCards,
    equipWeaponButtons,
    hpText: fakeNode(documentRef),
    mpText: fakeNode(documentRef),
    hpBar: fakeNode(documentRef),
    mpBar: fakeNode(documentRef),
    strongSlot: fakeNode(documentRef),
    strongCooldown: fakeNode(documentRef),
    playerCount: fakeNode(documentRef),
    message,
  };
  return {
    game,
    documentRef,
    storage,
    notifications,
    elements: game.ui,
  };
}

test.afterEach(() => {
  delete globalThis.document;
  delete globalThis.localStorage;
});

test("브란 근처 F 상호작용은 대장간을 열고 미아 상점과 역할을 분리한다", () => {
  const { game, elements } = blacksmithHarness();
  const brann = game.npcs.find(npc => npc.id === "brann");
  Object.assign(game.player, { x: brann.x, y: brann.y });
  game.updateNpcPrompt();
  assert.equal(game.ui.npcPromptText.textContent, "대장장이 브란의 대장간 이용하기");
  assert.equal(game.openNpcInteraction(), true);
  assert.equal(elements.blacksmithOverlay.hidden, false);
  assert.equal(elements.shopOverlay.hidden, true);
  assert.equal(game.isBlacksmithOpen(), true);
});

test("대장간 상단은 시작 검을 포함한 현재 장착 무기를 항상 표시한다", () => {
  const { game, elements } = blacksmithHarness({
    equipment: {
      ownedWeaponIds: ["starter-sword", "elite-katana"],
      equippedWeaponId: "elite-katana",
    },
  });
  game.openBlacksmith(game.npcs.find(npc => npc.id === "brann"));
  assert.equal(elements.blacksmithEquippedWeaponText.textContent, "정예 카타나");

  game.progress.equipmentByClass.warrior.equippedWeaponId = "starter-sword";
  game.updateBlacksmithHud();
  assert.equal(elements.blacksmithEquippedWeaponText.textContent, "시작 검");
});

test("상위 무기 구매는 이전 단계 없이 Gold와 보유 목록만 바꾸고 한 번 저장한다", () => {
  const { game, storage, notifications } = blacksmithHarness({ level: 25, nextLevelExp: 2500, gold: 900 });
  const brann = game.npcs.find(npc => npc.id === "brann");
  game.openBlacksmith(brann);
  assert.equal(game.buyBlacksmithWeapon("masterwork-katana"), true);
  assert.equal(game.progress.gold, 0);
  assert.deepEqual(game.progress.equipmentByClass.warrior.ownedWeaponIds, ["starter-sword", "masterwork-katana"]);
  assert.equal(game.progress.equipmentByClass.warrior.equippedWeaponId, "starter-sword");
  assert.equal(storage.writes.length, 1);
  assert.equal(notifications.at(-1), "명검을 구매했습니다. Gold -900");
});

test("무기 구매 알림은 이름의 받침 유무에 맞는 목적격 조사를 사용한다", () => {
  const vowelEnding = blacksmithHarness({ level: 5, nextLevelExp: 500, gold: 80 });
  vowelEnding.game.openBlacksmith(vowelEnding.game.npcs.find(npc => npc.id === "brann"));
  vowelEnding.game.buyBlacksmithWeapon("katana");
  assert.equal(vowelEnding.notifications.at(-1), "카타나를 구매했습니다. Gold -80");

  const consonantEnding = blacksmithHarness({ level: 25, nextLevelExp: 2500, gold: 900 });
  consonantEnding.game.openBlacksmith(consonantEnding.game.npcs.find(npc => npc.id === "brann"));
  consonantEnding.game.buyBlacksmithWeapon("masterwork-katana");
  assert.equal(consonantEnding.notifications.at(-1), "명검을 구매했습니다. Gold -900");
});

test("레벨·Gold·보유 조건 실패는 상태와 저장을 변경하지 않고 버튼에 이유를 표시한다", () => {
  const locked = blacksmithHarness({ level: 4, gold: 999 });
  locked.game.openBlacksmith(locked.game.npcs.find(npc => npc.id === "brann"));
  assert.equal(locked.game.buyBlacksmithWeapon("katana"), false);
  assert.equal(locked.elements.buyWeaponButtons[0].disabled, true);
  assert.equal(locked.elements.buyWeaponStatuses[0].textContent, "Lv.5 필요");
  assert.equal(locked.storage.writes.length, 0);

  const poor = blacksmithHarness({ level: 5, gold: 79 });
  poor.game.openBlacksmith(poor.game.npcs.find(npc => npc.id === "brann"));
  assert.equal(poor.game.buyBlacksmithWeapon("katana"), false);
  assert.equal(poor.elements.buyWeaponStatuses[0].textContent, "Gold 부족");
  assert.equal(poor.storage.writes.length, 0);

  const owned = blacksmithHarness({
    level: 5,
    gold: 999,
    equipment: { ownedWeaponIds: ["starter-sword", "katana"] },
  });
  owned.game.openBlacksmith(owned.game.npcs.find(npc => npc.id === "brann"));
  assert.equal(owned.game.buyBlacksmithWeapon("katana"), false);
  assert.equal(owned.elements.buyWeaponStatuses[0].textContent, "보유 중");
  assert.equal(owned.storage.writes.length, 0);
});

test("판매는 확인 전까지 변경하지 않고 장착 무기 확정 판매 후 시작 검으로 돌아간다", () => {
  const { game, elements, storage } = blacksmithHarness({
    gold: 0,
    equipment: { ownedWeaponIds: ["starter-sword", "elite-katana"], equippedWeaponId: "elite-katana" },
  });
  game.openBlacksmith(game.npcs.find(npc => npc.id === "brann"));
  assert.equal(game.requestWeaponSale("elite-katana"), true);
  assert.equal(game.progress.gold, 0);
  assert.equal(elements.weaponSaleConfirmOverlay.hidden, false);
  assert.equal(elements.weaponSaleConfirmText.textContent, "정예 카타나를 300 G에 판매할까요?");
  assert.equal(game.confirmWeaponSale(), true);
  assert.equal(game.progress.gold, 300);
  assert.equal(game.progress.equipmentByClass.warrior.equippedWeaponId, "starter-sword");
  assert.equal(game.player.equippedWeaponId, "starter-sword");
  assert.equal(storage.writes.length, 1);
});

test("비장착 상위 무기를 판매하면 현재 장착 무기를 유지한다", () => {
  const { game } = blacksmithHarness({
    equipment: {
      ownedWeaponIds: ["starter-sword", "katana", "elite-katana"],
      equippedWeaponId: "elite-katana",
    },
  });
  game.openBlacksmith(game.npcs.find(npc => npc.id === "brann"));
  game.requestWeaponSale("katana");
  assert.equal(game.confirmWeaponSale(), true);
  assert.equal(game.progress.equipmentByClass.warrior.equippedWeaponId, "elite-katana");
  assert.equal(game.player.equippedWeaponId, "elite-katana");
});

test("판매 취소는 변경하지 않고 판매한 무기는 정가로 재구매할 수 있다", () => {
  const { game, storage } = blacksmithHarness({
    level: 5,
    nextLevelExp: 500,
    gold: 40,
    equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "starter-sword" },
  });
  game.openBlacksmith(game.npcs.find(npc => npc.id === "brann"));
  game.requestWeaponSale("katana");
  assert.equal(game.cancelWeaponSale(), true);
  assert.equal(game.progress.gold, 40);
  assert.equal(storage.writes.length, 0);
  game.requestWeaponSale("katana");
  game.confirmWeaponSale();
  assert.equal(game.progress.gold, 80);
  assert.equal(game.buyBlacksmithWeapon("katana"), true);
  assert.equal(game.progress.gold, 0);
  assert.equal(storage.writes.length, 2);
});

test("대장간 탭은 첫 활성 버튼으로 이동하고 판매 확인창은 자체 포커스를 가둔다", () => {
  const { game, documentRef, elements } = blacksmithHarness({
    level: 10,
    nextLevelExp: 1000,
    gold: 180,
    equipment: { ownedWeaponIds: ["starter-sword", "katana"] },
  });
  game.openBlacksmith(game.npcs.find(npc => npc.id === "brann"));
  game.selectBlacksmithTab("buy");
  assert.equal(documentRef.activeElement, elements.buyWeaponButtons[1]);
  game.selectBlacksmithTab("sell");
  assert.equal(documentRef.activeElement, elements.sellWeaponButtons[0]);
  game.requestWeaponSale("katana");
  assert.equal(documentRef.activeElement, elements.weaponSaleCancelButton);
  assert.deepEqual(game.activeBlacksmithFocusControls(), [
    elements.weaponSaleCancelButton,
    elements.weaponSaleConfirmButton,
  ]);
});

test("Escape는 판매 확인창과 대장간을 바깥 모달보다 먼저 닫는다", () => {
  assert.equal(interactionKeyAction({
    code: "Escape",
    saleConfirmOpen: true,
    blacksmithOpen: true,
  }), "close-sale-confirm");
  assert.equal(interactionKeyAction({
    code: "Escape",
    saleConfirmOpen: false,
    blacksmithOpen: true,
  }), "close-blacksmith");
  assert.equal(interactionKeyAction({
    code: "Enter",
    saleConfirmOpen: true,
    blacksmithOpen: true,
  }), "block");
});

test("판매 확인창에서 F는 내부 확인 상태를 유지하고 바깥 대장간을 닫지 않는다", () => {
  assert.equal(npcInteractionKeyAction({
    saleConfirmOpen: true,
    blacksmithOpen: true,
  }), "block");
  assert.equal(npcInteractionKeyAction({
    saleConfirmOpen: false,
    blacksmithOpen: true,
  }), "close-blacksmith");
});

test("대장간을 닫으면 판매 확인창도 닫히고 진행 데이터는 저장하지 않는다", () => {
  const { game, elements, storage } = blacksmithHarness({
    equipment: { ownedWeaponIds: ["starter-sword", "katana"] },
  });
  game.openBlacksmith(game.npcs.find(npc => npc.id === "brann"));
  game.requestWeaponSale("katana");
  assert.equal(game.closeBlacksmith(), true);
  assert.equal(elements.blacksmithOverlay.hidden, true);
  assert.equal(elements.weaponSaleConfirmOverlay.hidden, true);
  assert.equal(storage.writes.length, 0);
});

test("보유 장비를 인벤토리에서 직접 장착하면 외형 ID와 저장이 즉시 바뀐다", () => {
  const { game, storage, elements } = blacksmithHarness({
    equipment: {
      ownedWeaponIds: ["starter-sword", "reinforced-katana"],
      equippedWeaponId: "starter-sword",
    },
  });
  assert.equal(game.openInventory(), true);
  assert.equal(game.equipInventoryWeapon("reinforced-katana"), true);
  assert.equal(game.progress.equipmentByClass.warrior.equippedWeaponId, "reinforced-katana");
  assert.equal(game.player.equippedWeaponId, "reinforced-katana");
  assert.equal(elements.equipWeaponButtons[2].textContent, "장착 중");
  assert.equal(elements.equipWeaponButtons[2].disabled, true);
  assert.equal(storage.writes.length, 1);
});

test("미보유·동일 무기 장착은 상태나 저장을 변경하지 않는다", () => {
  const { game, storage } = blacksmithHarness({
    equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "katana" },
  });
  game.openInventory();
  assert.equal(game.equipInventoryWeapon("masterwork-katana"), false);
  assert.equal(game.equipInventoryWeapon("katana"), false);
  assert.equal(game.progress.equipmentByClass.warrior.equippedWeaponId, "katana");
  assert.equal(storage.writes.length, 0);
});

test("공격 생성 시 장착 무기 수치를 스냅샷하고 이후 장착 변경에 흔들리지 않는다", () => {
  const { game } = blacksmithHarness({
    equipment: { ownedWeaponIds: ["starter-sword", "reinforced-katana"], equippedWeaponId: "reinforced-katana" },
  });
  game.basicCooldown = 0;
  game.strongCooldown = 0;
  game.tryAttack("basic");
  assert.equal(game.attackState.definition.damage, 1.3);
  assert.equal(game.attackState.definition.range, 76);
  game.player.equippedWeaponId = "starter-sword";
  assert.equal(game.attackState.definition.damage, 1.3);
  game.attackState = null;
  game.tryAttack("strong");
  assert.equal(game.attackState.definition.cooldown, 4);
  game.attackState = null;
  game.player.equippedWeaponId = "reinforced-katana";
  game.strongCooldown = 0;
  game.tryAttack("strong");
  assert.equal(game.attackState.definition.cooldown, 3.8);
});

test("인벤토리 포커스는 보유 중이며 장착 가능하게 표시된 장비 버튼만 포함한다", () => {
  const { game, elements } = blacksmithHarness({
    inventory: { hpPotion: 1 },
    equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "starter-sword" },
  });
  game.player.hp = 80;
  game.openInventory();
  assert.deepEqual(game.activeInventoryFocusControls(), [
    elements.inventoryCloseButton,
    elements.inventoryHpUseButton,
    elements.equipWeaponButtons[1],
    elements.inventoryDoneButton,
  ]);
});

test("원격 플레이어 보간 상태는 직업과 정규화된 장착 무기를 함께 유지한다", () => {
  const { game } = blacksmithHarness();
  game.remotePlayers = new Map();
  game.receiveRemotePlayers(new Map([["remote", {
    x: 100,
    y: 100,
    dir: "right",
    moving: false,
    color: "#fff",
    name: "원격",
    classId: "archer",
    equippedWeaponId: "masterwork-bow",
  }]]));
  assert.equal(game.remotePlayers.get("remote").classId, "archer");
  assert.equal(game.remotePlayers.get("remote").equippedWeaponId, "masterwork-bow");
});
