import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG, interactionKeyAction } from "../src/game-20260828-classes.js";
import { createCombatStatusEffects } from "../src/player-combat.js";
import { createInitialProgress } from "../src/quest-state.js";
import { WEAPON_ORDER_BY_CLASS } from "../src/weapon-data.js";

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

function eventNode(documentRef, overrides = {}) {
  const listeners = new Map();
  const node = fakeNode({
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    },
    click() {
      node.dispatch("click", { target: node });
    },
    focus() {
      if (!node.disabled) documentRef.activeElement = node;
    },
    ...overrides,
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

function installCanvasDocument() {
  const context = new Proxy({}, {
    get(target, property) {
      if (!(property in target)) target[property] = () => ({ addColorStop() {} });
      return target[property];
    },
  });
  globalThis.document = {
    createElement() {
      return { getContext: () => context };
    },
  };
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
}

function constructedQaGame() {
  const context = new Proxy({}, {
    get(target, property) {
      if (!(property in target)) target[property] = () => ({ addColorStop() {} });
      return target[property];
    },
  });
  const documentRef = {
    activeElement: null,
    createDocumentFragment() { return { append() {} }; },
    createElement(tagName) {
      return eventNode(documentRef, {
        append() {},
        ...(tagName === "canvas" ? { getContext: () => context } : {}),
      });
    },
    querySelectorAll() { return []; },
  };
  globalThis.document = documentRef;
  globalThis.devicePixelRatio = 1;
  globalThis.HTMLInputElement = class {};
  globalThis.HTMLTextAreaElement = class {};
  globalThis.HTMLSelectElement = class {};
  globalThis.addEventListener = () => {};

  const canvas = eventNode(documentRef, { getContext: () => context });
  const minimap = eventNode(documentRef, { getContext: () => context });
  const chatSubmitButton = eventNode(documentRef);
  const chatForm = eventNode(documentRef, { querySelector: () => chatSubmitButton });
  const qaWorldButton = eventNode(documentRef, { dataset: { qaWorld: "forest" } });
  const qaMonsterButton = eventNode(documentRef, { dataset: { qaMonster: "fang-shark" } });
  const qaWeaponButton = eventNode(documentRef, { dataset: { qaWeapons: "prepare" } });
  const qaBlacksmithButton = eventNode(documentRef, { dataset: { qaBlacksmith: "travel" } });
  const elements = {
    qaEnabled: true,
    canvas,
    minimap,
    dialogueOverlay: eventNode(documentRef, { hidden: true }),
    dialogueTitle: eventNode(documentRef),
    dialogueBody: eventNode(documentRef),
    dialogueActionButton: eventNode(documentRef),
    dialogueCloseButton: eventNode(documentRef),
    shopOverlay: eventNode(documentRef, { hidden: true }),
    shopCloseButton: eventNode(documentRef),
    shopDoneButton: eventNode(documentRef),
    buyHpPotionButton: eventNode(documentRef),
    buyMpPotionButton: eventNode(documentRef),
    inventoryButton: eventNode(documentRef),
    inventoryOverlay: eventNode(documentRef, { hidden: true }),
    inventoryCloseButton: eventNode(documentRef),
    inventoryDoneButton: eventNode(documentRef),
    inventoryHpUseButton: eventNode(documentRef),
    inventoryMpUseButton: eventNode(documentRef),
    qaButton: eventNode(documentRef),
    qaOverlay: eventNode(documentRef, { hidden: true }),
    qaCloseButton: eventNode(documentRef),
    qaDoneButton: eventNode(documentRef),
    qaWorldButtons: [qaWorldButton],
    qaMonsterButtons: [qaMonsterButton],
    qaWeaponButton,
    qaBlacksmithButton,
    hpPotionSlot: eventNode(documentRef, { dataset: { code: "Digit1" } }),
    mpPotionSlot: eventNode(documentRef, { dataset: { code: "Digit2" } }),
    chatPanel: eventNode(documentRef),
    chatMessages: eventNode(documentRef, { replaceChildren() {}, scrollHeight: 0, scrollTop: 0 }),
    chatForm,
    chatInput: eventNode(documentRef, { value: "" }),
    chatStatus: eventNode(documentRef),
    npcPrompt: eventNode(documentRef, { hidden: true }),
    npcPromptText: eventNode(documentRef),
    playerCount: eventNode(documentRef),
  };
  documentRef.querySelectorAll = selector => selector === ".slot"
    ? [elements.hpPotionSlot, elements.mpPotionSlot]
    : [];
  const game = new PixelRPG(elements);
  game.running = true;
  game.inputEnabled = true;
  game.drawMinimapBase = () => {};
  game.updateBiome = () => {};
  game.updateNpcPrompt = () => {};
  game.notify = () => {};
  return {
    game,
    elements,
    documentRef,
    qaWorldButton,
    qaMonsterButton,
    qaWeaponButton,
    qaBlacksmithButton,
  };
}

function qaGame() {
  installCanvasDocument();
  const game = Object.create(PixelRPG.prototype);
  game.qaEnabled = true;
  game.running = true;
  game.inputEnabled = false;
  game.chatInputActive = false;
  game.mapId = "village";
  game.classId = "warrior";
  game.player = {
    name: "QA테스터",
    x: 1440,
    y: 1110,
    prevX: 1440,
    prevY: 1110,
    dir: "down",
    moving: false,
    step: 0,
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100,
    respawnTimer: 0,
    statusEffects: createCombatStatusEffects(),
    equippedWeaponId: "starter-sword",
  };
  game.keys = new Set();
  game.attackState = null;
  game.remotePlayers = new Map();
  game.enemies = [];
  game.npcs = [];
  game.processedEnemyAttackIds = new Set();
  game.processedEnemySpawnIds = new Set();
  game.dynamicEnemySequence = 0;
  game.camera = { x: 0, y: 0, prevX: 0, prevY: 0 };
  game.progress = createInitialProgress();
  game.damageNumbers = [];
  game.strongCooldown = 0;
  game.messageTimer = 0;
  game.ui = {
    qaOverlay: fakeNode({ hidden: false }),
    qaCloseButton: fakeNode(),
    qaWeaponButton: fakeNode({ dataset: { qaWeapons: "prepare" } }),
    dialogueOverlay: fakeNode({ hidden: true }),
    shopOverlay: fakeNode({ hidden: true }),
    inventoryOverlay: fakeNode({ hidden: true }),
    respawnOverlay: fakeNode({ hidden: true }),
    playerCount: fakeNode(),
    playerSubtitle: fakeNode(),
    questProgress: fakeNode(),
    expText: fakeNode(),
    expBar: fakeNode(),
    goldText: fakeNode(),
    hpText: fakeNode(),
    mpText: fakeNode(),
    hpBar: fakeNode(),
    mpBar: fakeNode(),
    strongSlot: fakeNode(),
    strongCooldown: fakeNode(),
    message: fakeNode(),
    npcPrompt: fakeNode({ hidden: true }),
    npcPromptText: fakeNode(),
  };
  game.canvas = fakeNode();
  game.drawMinimapBase = () => {};
  game.updateBiome = () => {};
  game.updateNpcPrompt = () => {};
  game.notify = message => {
    game.lastNotice = message;
  };
  return game;
}

test("QA 패널은 활성화된 실행 중 게임에서만 열리고 모든 전투 입력을 멈춘다", () => {
  const game = qaGame();
  game.ui.qaOverlay.hidden = true;
  game.inputEnabled = true;
  game.keys.add("ArrowRight");
  game.player.moving = true;
  game.attackState = { kind: "basic" };

  assert.equal(typeof game.openQaPanel, "function");
  assert.equal(game.openQaPanel(), true);
  assert.equal(game.ui.qaOverlay.hidden, false);
  assert.equal(game.inputEnabled, false);
  assert.equal(game.keys.size, 0);
  assert.equal(game.player.moving, false);
  assert.equal(game.attackState, null);
  assert.equal(game.isInteractionOpen(), true);

  assert.equal(game.closeQaPanel(), true);
  assert.equal(game.ui.qaOverlay.hidden, true);
  assert.equal(game.inputEnabled, true);

  game.qaEnabled = false;
  assert.equal(game.openQaPanel(), false);
  assert.equal(game.ui.qaOverlay.hidden, true);
});

test("실제 QA 버튼과 닫기 버튼은 패널 상태와 포커스를 게임 입력에 연결한다", () => {
  const { game, elements, documentRef } = constructedQaGame();

  elements.qaButton.click();
  assert.equal(elements.qaOverlay.hidden, false);
  assert.equal(game.inputEnabled, false);
  assert.equal(documentRef.activeElement, elements.qaCloseButton);

  elements.qaCloseButton.click();
  assert.equal(elements.qaOverlay.hidden, true);
  assert.equal(game.inputEnabled, true);
  assert.equal(documentRef.activeElement, elements.canvas);
});

test("QA 패널의 Tab 포커스는 지역·몬스터·장비·브란 이동 버튼 안에서만 순환한다", () => {
  const {
    elements,
    documentRef,
    qaWorldButton,
    qaMonsterButton,
    qaWeaponButton,
    qaBlacksmithButton,
  } = constructedQaGame();
  elements.qaButton.click();
  let prevented = false;

  elements.qaOverlay.dispatch("keydown", {
    code: "Tab",
    shiftKey: false,
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(documentRef.activeElement, qaWorldButton);

  elements.qaOverlay.dispatch("keydown", {
    code: "Tab",
    shiftKey: false,
    preventDefault() {},
  });
  assert.equal(documentRef.activeElement, qaMonsterButton);

  elements.qaOverlay.dispatch("keydown", {
    code: "Tab",
    shiftKey: false,
    preventDefault() {},
  });
  assert.equal(documentRef.activeElement, qaWeaponButton);

  elements.qaOverlay.dispatch("keydown", {
    code: "Tab",
    shiftKey: false,
    preventDefault() {},
  });
  assert.equal(documentRef.activeElement, qaBlacksmithButton);
});

test("실제 QA 브란 이동 버튼은 플레이어를 브란 상호작용 거리로 보내고 안내를 표시한다", () => {
  const { game, elements } = constructedQaGame();
  game.updateNpcPrompt = PixelRPG.prototype.updateNpcPrompt.bind(game);
  elements.qaButton.click();

  elements.qaBlacksmithButton.click();

  assert.equal(game.mapId, "village");
  assert.deepEqual({ x: game.player.x, y: game.player.y }, { x: 2460, y: 1060 });
  assert.equal(game.nearbyNpc?.id, "brann");
  assert.equal(elements.npcPrompt.hidden, false);
  assert.equal(elements.npcPromptText.textContent, "대장장이 브란의 대장간 이용하기");
  assert.equal(elements.qaOverlay.hidden, true);
  assert.equal(game.inputEnabled, true);
});

test("QA 장비 준비는 Lv.30·5000G와 최대 HP·MP를 반영하고 한 번 저장한 뒤 닫힌다", () => {
  const game = qaGame();
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  game.progress.inventory = { hpPotion: 2, mpPotion: 3 };
  game.progress.equipmentByClass.warrior = {
    ownedWeaponIds: ["starter-sword", "katana"],
    equippedWeaponId: "katana",
  };
  game.player.equippedWeaponId = "katana";

  assert.equal(game.qaPrepareWeaponShop(), true);
  assert.equal(game.progress.level, 30);
  assert.equal(game.progress.exp, 0);
  assert.equal(game.progress.nextLevelExp, 3000);
  assert.equal(game.progress.gold, 5000);
  assert.deepEqual(game.progress.inventory, { hpPotion: 2, mpPotion: 3 });
  assert.deepEqual(game.progress.equipmentByClass.warrior, {
    ownedWeaponIds: WEAPON_ORDER_BY_CLASS.warrior,
    equippedWeaponId: "katana",
  });
  assert.equal(game.player.maxHp, 468);
  assert.equal(game.player.maxMp, 196);
  assert.equal(game.player.hp, 468);
  assert.equal(game.player.mp, 196);
  assert.equal(game.ui.expText.textContent, "0 / 3000");
  assert.equal(game.ui.goldText.textContent, "5000 G");
  assert.equal(game.ui.qaOverlay.hidden, true);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.writes[0].value.version, 5);
  assert.equal(game.lastNotice, "검사 7종 무기 준비 완료 · Lv.30 · 5000 G");
  delete globalThis.localStorage;
});

test("QA 장비 준비는 선택 직업 일곱 무기만 준비하고 다른 직업 장비를 유지한다", () => {
  const game = qaGame();
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  game.classId = "mage";
  game.player.classId = "mage";
  game.player.equippedWeaponId = "training-staff";
  const warriorBefore = structuredClone(game.progress.equipmentByClass.warrior);
  game.progress.equipmentByClass.archer = {
    ownedWeaponIds: ["training-bow", "hunter-bow"],
    equippedWeaponId: "hunter-bow",
  };
  const archerBefore = structuredClone(game.progress.equipmentByClass.archer);

  assert.equal(game.qaPrepareWeaponShop(), true);
  assert.deepEqual(game.progress.equipmentByClass.mage, {
    ownedWeaponIds: WEAPON_ORDER_BY_CLASS.mage,
    equippedWeaponId: "training-staff",
  });
  assert.deepEqual(game.progress.equipmentByClass.warrior, warriorBefore);
  assert.deepEqual(game.progress.equipmentByClass.archer, archerBefore);
  assert.equal(game.lastNotice, "마법사 7종 무기 준비 완료 · Lv.30 · 5000 G");
  delete globalThis.localStorage;
});

test("QA가 비활성화됐거나 패널이 닫혀 있으면 장비 준비가 진행·저장을 바꾸지 않는다", () => {
  const game = qaGame();
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const before = structuredClone(game.progress);

  game.qaEnabled = false;
  assert.equal(game.qaPrepareWeaponShop(), false);
  game.qaEnabled = true;
  game.ui.qaOverlay.hidden = true;
  assert.equal(game.qaPrepareWeaponShop(), false);
  assert.deepEqual(game.progress, before);
  assert.equal(storage.writes.length, 0);
  delete globalThis.localStorage;
});

test("QA 브란 이동은 열린 패널에서만 작동하며 진행 데이터와 저장값을 바꾸지 않는다", () => {
  const game = qaGame();
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const progressBefore = structuredClone(game.progress);

  game.ui.qaOverlay.hidden = true;
  assert.equal(game.qaTravelToBlacksmith(), false);
  assert.deepEqual({ x: game.player.x, y: game.player.y }, { x: 1440, y: 1110 });

  game.ui.qaOverlay.hidden = false;
  assert.equal(game.qaTravelToBlacksmith(), true);
  assert.deepEqual(game.progress, progressBefore);
  assert.equal(storage.writes.length, 0);
  delete globalThis.localStorage;
});

test("QA 지역 이동은 선택한 지역의 안전한 기본 위치와 전체 로스터를 불러온다", () => {
  const game = qaGame();

  assert.equal(typeof game.qaTravel, "function");
  assert.equal(game.qaTravel("forest"), true);
  assert.equal(game.mapId, "forest");
  assert.deepEqual({ x: game.player.x, y: game.player.y }, { x: 2160, y: 3260 });
  assert.equal(game.enemies.length, 16);
  assert.equal(game.ui.qaOverlay.hidden, true);
  assert.equal(game.inputEnabled, true);
});

test("QA 몬스터 소환은 고유 지역으로 이동한 뒤 플레이어 앞 안전 위치에 한 마리를 추가한다", () => {
  const game = qaGame();

  assert.equal(typeof game.qaSpawnMonster, "function");
  const enemy = game.qaSpawnMonster("fang-shark");

  assert.equal(game.mapId, "coast");
  assert.equal(game.enemies.length, 15);
  assert.equal(enemy, game.enemies.at(-1));
  assert.deepEqual({
    id: enemy.id,
    kind: enemy.kind,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    x: enemy.x,
    y: enemy.y,
  }, {
    id: "coast-qa-1",
    kind: "fang-shark",
    hp: 25,
    maxHp: 25,
    x: 2160,
    y: 480,
  });
  assert.equal(game.ui.qaOverlay.hidden, true);
  assert.equal(game.inputEnabled, true);
});

test("등록되지 않은 QA 지역과 몬스터는 현재 게임 상태를 바꾸지 않는다", () => {
  const game = qaGame();

  assert.equal(typeof game.qaTravel, "function");
  assert.equal(typeof game.qaSpawnMonster, "function");
  assert.equal(game.qaTravel("unknown"), false);
  assert.equal(game.qaSpawnMonster("magma-slime-small"), null);
  assert.equal(game.mapId, "village");
  assert.equal(game.enemies.length, 0);
  assert.equal(game.ui.qaOverlay.hidden, false);
});

test("다른 지역 QA 소환의 안전 위치가 없으면 현재 지역과 전투 상태를 보존한다", () => {
  const game = qaGame();
  const originalEnemies = [{ id: "village-training-dummy" }];
  game.enemies = originalEnemies;
  game.resolveQaSpawnPosition = () => null;

  const enemy = game.qaSpawnMonster("fang-shark");

  assert.equal(enemy, null);
  assert.equal(game.mapId, "village");
  assert.deepEqual({ x: game.player.x, y: game.player.y }, { x: 1440, y: 1110 });
  assert.equal(game.enemies, originalEnemies);
  assert.equal(game.dynamicEnemySequence, 0);
  assert.equal(game.ui.qaOverlay.hidden, false);
});

test("QA 소환 몬스터 처치 보상은 일반 진행 데이터에 지급되고 v5 저장소에 기록된다", () => {
  const game = qaGame();
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  assert.equal(typeof game.qaSpawnMonster, "function");
  const enemy = game.qaSpawnMonster("fang-shark");
  game.enemies = [enemy];
  game.player.dir = "down";

  game.applyAttackHits({ damage: 100, range: 200, arcDegrees: 180, knockback: 0 });

  assert.equal(game.progress.exp, 20);
  assert.equal(game.progress.gold, 15);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.writes[0].value.version, 5);
  assert.equal(storage.writes[0].value.exp, 20);
  assert.equal(storage.writes[0].value.gold, 15);
  delete globalThis.localStorage;
});

test("Escape는 다른 상호작용보다 열린 QA 패널을 먼저 닫는다", () => {
  assert.equal(interactionKeyAction({
    code: "Escape",
    qaOpen: true,
    inventoryOpen: false,
    shopOpen: false,
    dialogueOpen: false,
  }), "close-qa");
});

test("QA 패널을 연 채 쓰러지면 패널을 닫고 부활 입력 상태를 유지한다", () => {
  const game = qaGame();
  game.projectiles = [{ id: "before-death" }];
  game.inputEnabled = true;
  game.player.hp = 1;
  game.player.invulnerable = 0;
  game.player.hitFlash = 0;
  game.closeInventory = () => false;
  game.updateInventoryHud = () => {};

  const result = game.damagePlayer(50, { x: game.player.x - 10, y: game.player.y });

  assert.equal(result.died, true);
  assert.equal(game.ui.qaOverlay.hidden, true);
  assert.equal(game.ui.respawnOverlay.hidden, false);
  assert.equal(game.inputEnabled, false);
  assert.deepEqual(game.projectiles, []);
});
