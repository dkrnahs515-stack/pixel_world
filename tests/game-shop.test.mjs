import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game.js";
import { getNpcsForWorld } from "../src/npc-data.js";
import { createInitialProgress } from "../src/quest-state.js";

function fakeNode(overrides = {}) {
  return {
    textContent: "",
    hidden: false,
    disabled: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    focus() {},
    ...overrides,
  };
}

function messageNode(notifications) {
  const node = fakeNode();
  Object.defineProperty(node, "textContent", {
    get() { return notifications.at(-1) ?? ""; },
    set(value) { notifications.push(value); },
  });
  return node;
}

function memoryStorage() {
  const values = new Map();
  const writes = [];
  return {
    writes,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
      writes.push({ key, value: JSON.parse(value) });
    },
  };
}

function shopHarness(overrides = {}) {
  const notifications = [];
  const storage = memoryStorage();
  const initial = createInitialProgress();
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "village";
  game.running = true;
  game.inputEnabled = true;
  game.chatInputActive = false;
  game.portalTransition = null;
  game.attackState = null;
  game.keys = new Set();
  game.messageTimer = 0;
  game.npcs = getNpcsForWorld("village");
  game.nearbyNpc = null;
  game.player = {
    name: "상점테스터",
    x: 0,
    y: 0,
    moving: false,
    hp: 85,
    maxHp: 100,
    mp: 50,
    maxMp: 100,
    respawnTimer: 0,
  };
  game.progress = {
    ...initial,
    ...overrides,
    inventory: { ...initial.inventory, ...(overrides.inventory || {}) },
  };
  game.canvas = { focus() {} };
  game.ui = {
    dialogueOverlay: fakeNode({ hidden: true }),
    shopOverlay: fakeNode({ hidden: true }),
    shopGoldText: fakeNode(),
    shopCloseButton: fakeNode(),
    buyHpPotionButton: fakeNode(),
    buyMpPotionButton: fakeNode(),
    shopHpPotionCount: fakeNode(),
    shopMpPotionCount: fakeNode(),
    hpPotionCount: fakeNode(),
    mpPotionCount: fakeNode(),
    hpPotionSlot: fakeNode(),
    mpPotionSlot: fakeNode(),
    npcPrompt: fakeNode({ hidden: true }),
    npcPromptText: fakeNode(),
    expText: fakeNode(),
    expBar: fakeNode(),
    goldText: fakeNode(),
    hpText: fakeNode(),
    mpText: fakeNode(),
    hpBar: fakeNode(),
    mpBar: fakeNode(),
    strongSlot: fakeNode(),
    strongCooldown: fakeNode(),
    playerSubtitle: fakeNode(),
    message: messageNode(notifications),
  };
  globalThis.localStorage = storage;
  return { game, notifications, storage };
}

test.afterEach(() => {
  delete globalThis.localStorage;
});

test("미아 근처의 F 상호작용은 상점을 열고 동적 안내를 표시한다", () => {
  const { game } = shopHarness({ gold: 20 });
  const mia = game.npcs.find(npc => npc.id === "mia");
  Object.assign(game.player, { x: mia.x, y: mia.y });

  game.updateNpcPrompt();
  assert.equal(game.ui.npcPromptText.textContent, "연금술사 미아의 상점 이용하기");
  assert.equal(game.openNpcInteraction?.(), true);
  assert.equal(game.isShopOpen?.(), true);
  assert.equal(game.ui.shopOverlay.hidden, false);
  assert.equal(game.inputEnabled, true);
});

test("체력 물약 구매는 Gold와 수량을 갱신하고 한 번 저장한다", () => {
  const { game, notifications, storage } = shopHarness({ gold: 20 });

  assert.equal(game.buyItem?.("hpPotion"), true);
  assert.equal(game.progress.gold, 10);
  assert.equal(game.progress.inventory.hpPotion, 1);
  assert.equal(game.ui.goldText.textContent, "10 G");
  assert.equal(game.ui.hpPotionCount.textContent, "×1");
  assert.equal(storage.writes.length, 1);
  assert.equal(notifications.at(-1), "작은 체력 물약을 구매했습니다. Gold -10");
});

test("Gold 부족과 최대 보유 상태의 구매는 저장하지 않는다", () => {
  const poor = shopHarness({ gold: 9 });
  assert.equal(poor.game.buyItem?.("hpPotion"), false);
  assert.equal(poor.game.progress.gold, 9);
  assert.equal(poor.storage.writes.length, 0);
  assert.equal(poor.notifications.at(-1), "Gold가 부족합니다.");

  const full = shopHarness({ gold: 999, inventory: { hpPotion: 99 } });
  assert.equal(full.game.buyItem?.("hpPotion"), false);
  assert.equal(full.game.progress.inventory.hpPotion, 99);
  assert.equal(full.storage.writes.length, 0);
  assert.equal(full.notifications.at(-1), "물약을 더 이상 보유할 수 없습니다.");
});

test("체력·마력 물약 사용은 자원과 수량을 갱신하고 저장한다", () => {
  const hp = shopHarness({ inventory: { hpPotion: 2 } });
  assert.equal(hp.game.useItem?.("hpPotion"), true);
  assert.equal(hp.game.player.hp, 100);
  assert.equal(hp.game.progress.inventory.hpPotion, 1);
  assert.equal(hp.storage.writes.length, 1);

  const mp = shopHarness({ inventory: { mpPotion: 1 } });
  assert.equal(mp.game.useItem?.("mpPotion"), true);
  assert.equal(mp.game.player.mp, 75);
  assert.equal(mp.game.progress.inventory.mpPotion, 0);
  assert.equal(mp.storage.writes.length, 1);
});

test("최대 자원·물약 없음·상점 열린 상태에서는 물약을 소비하지 않는다", () => {
  const fullHp = shopHarness({ inventory: { hpPotion: 1 } });
  fullHp.game.player.hp = 100;
  assert.equal(fullHp.game.useItem?.("hpPotion"), false);
  assert.equal(fullHp.game.progress.inventory.hpPotion, 1);
  assert.equal(fullHp.storage.writes.length, 0);
  assert.equal(fullHp.notifications.at(-1), "HP가 이미 가득 찼습니다.");

  const empty = shopHarness();
  assert.equal(empty.game.useItem?.("hpPotion"), false);
  assert.equal(empty.storage.writes.length, 0);
  assert.equal(empty.notifications.at(-1), "작은 체력 물약이 없습니다.");

  const blocked = shopHarness({ inventory: { hpPotion: 1 } });
  blocked.game.ui.shopOverlay.hidden = false;
  assert.equal(blocked.game.useItem?.("hpPotion"), false);
  assert.equal(blocked.game.progress.inventory.hpPotion, 1);
  assert.equal(blocked.storage.writes.length, 0);
});

test("상점이 열려 있으면 공격과 채팅 입력을 시작하지 않는다", () => {
  const { game } = shopHarness();
  game.basicCooldown = 0;
  game.strongCooldown = 0;
  game.ui.shopOverlay.hidden = false;
  game.chat = { open() { return true; } };

  game.tryAttack("basic");

  assert.equal(game.attackState, null);
  assert.equal(game.openChatInput(), false);
});
