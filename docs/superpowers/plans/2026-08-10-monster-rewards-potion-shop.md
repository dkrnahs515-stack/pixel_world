# Monster Rewards and Potion Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 몬스터마다 차등 EXP·Gold를 지급하고, 중앙 마을의 미아에게서 Gold로 체력·마력 물약을 구매·사용·저장할 수 있게 한다.

**Architecture:** 몬스터 보상은 `player-progression.js`, 상품과 불변 구매·사용 규칙은 신규 `shop-state.js`, v3 저장 이전은 `progress-storage.js`가 담당한다. `game.js`는 전투·NPC·상점·HUD를 연결하고 DOM 구성은 `index.html`, `main.js`, `styles.css`에 한정한다.

**Tech Stack:** ES modules, HTML5 Canvas, DOM/CSS HUD, browser `localStorage`, Node.js built-in test runner

## Global Constraints

- 불꽃 슬라임은 3 EXP와 1~3 Gold를 지급한다.
- 숲 슬라임은 4 EXP와 2~4 Gold를 지급한다.
- 물방울 슬라임은 5 EXP와 2~5 Gold를 지급한다.
- 멧돼지는 7 EXP와 3~6 Gold를 지급한다.
- 게는 8 EXP와 4~7 Gold를 지급한다.
- 기존 `모험의 시작` 퀘스트 보상 15 EXP와 30 Gold는 유지한다.
- 작은 체력 물약은 10 Gold, HP 30 회복, 최대 99개, 단축키 `1`이다.
- 작은 마력 물약은 15 Gold, MP 25 회복, 최대 99개, 단축키 `2`이다.
- 저장 키는 `pixel-world.progress.v3:`이고 유효한 v2와 v1 저장은 자동 이전한다.
- 외부 패키지를 추가하지 않는다.
- 실패한 구매나 물약 사용은 상태를 변경하거나 저장하지 않는다.
- 기존 아렌 퀘스트, 채팅, 포탈, 전투, 레벨업 완전 회복 규칙을 보존한다.

---

### Task 1: 몬스터별 보상표와 지급 함수

**Files:**
- Modify: `src/player-progression.js`
- Modify: `tests/player-progression.test.mjs`

**Interfaces:**
- Consumes: `grantProgressReward(progress, { exp, gold })`
- Produces: `MONSTER_REWARDS`, `getMonsterReward(enemyKind, random)`, `grantHuntingReward(progress, enemyKind, random)`

- [ ] **Step 1: 다섯 몬스터 보상 경계와 알 수 없는 종류 테스트를 작성한다**

```js
import {
  MONSTER_REWARDS,
  getMonsterReward,
  grantHuntingReward,
} from "../src/player-progression.js";

const cases = [
  ["fire-slime", 3, 1, 3, "불꽃 슬라임"],
  ["forest-slime", 4, 2, 4, "숲 슬라임"],
  ["water-slime", 5, 2, 5, "물방울 슬라임"],
  ["boar", 7, 3, 6, "멧돼지"],
  ["crab", 8, 4, 7, "게"],
];

test("몬스터별 EXP와 Gold 최솟값·최댓값을 계산한다", () => {
  for (const [kind, exp, min, max, label] of cases) {
    assert.deepEqual(getMonsterReward(kind, () => 0), {
      kind, label, exp, gold: min,
    });
    assert.equal(getMonsterReward(kind, () => 0.999999).gold, max);
  }
});

test("등록되지 않은 몬스터는 보상을 만들지 않는다", () => {
  assert.equal(getMonsterReward("unknown", () => 0), null);
  assert.equal(grantHuntingReward(base(), "unknown", () => 0), null);
});
```

- [ ] **Step 2: 보상 테스트를 실행해 기존 단일 슬라임 상수 때문에 실패하는지 확인한다**

Run: `node --test tests/player-progression.test.mjs`

Expected: FAIL because `MONSTER_REWARDS` and `getMonsterReward` are not exported and `grantHuntingReward` does not accept an enemy kind.

- [ ] **Step 3: 고정 보상표와 종류별 보상 지급을 최소 구현한다**

```js
export const MONSTER_REWARDS = Object.freeze({
  "fire-slime": Object.freeze({ label: "불꽃 슬라임", exp: 3, goldMin: 1, goldMax: 3 }),
  "forest-slime": Object.freeze({ label: "숲 슬라임", exp: 4, goldMin: 2, goldMax: 4 }),
  "water-slime": Object.freeze({ label: "물방울 슬라임", exp: 5, goldMin: 2, goldMax: 5 }),
  boar: Object.freeze({ label: "멧돼지", exp: 7, goldMin: 3, goldMax: 6 }),
  crab: Object.freeze({ label: "게", exp: 8, goldMin: 4, goldMax: 7 }),
});

export function getMonsterReward(enemyKind, random = Math.random) {
  const definition = MONSTER_REWARDS[enemyKind];
  if (!definition) return null;
  const sample = Math.min(0.9999999999999999, Math.max(0, random()));
  const gold = definition.goldMin
    + Math.floor(sample * (definition.goldMax - definition.goldMin + 1));
  return { kind: enemyKind, label: definition.label, exp: definition.exp, gold };
}

export function grantHuntingReward(progress, enemyKind, random = Math.random) {
  const reward = getMonsterReward(enemyKind, random);
  if (!reward) return null;
  const result = grantProgressReward(progress, { exp: reward.exp, gold: reward.gold });
  return {
    ...result,
    enemyKind: reward.kind,
    label: reward.label,
    rewardExp: reward.exp,
    rewardGold: reward.gold,
  };
}
```

Remove `rollSlimeGold` and the `grantSlimeReward` wrapper after changing their tests to the new public interface.

- [ ] **Step 4: 보상 단위 테스트를 다시 실행한다**

Run: `node --test tests/player-progression.test.mjs`

Expected: PASS, including both boundaries for all five monster kinds.

- [ ] **Step 5: 보상표 변경을 커밋한다**

```bash
git add src/player-progression.js tests/player-progression.test.mjs
git commit -m "몬스터별 사냥 보상 차등화"
```

---

### Task 2: 물약 상품과 순수 구매·사용 상태 로직

**Files:**
- Create: `src/shop-state.js`
- Create: `tests/shop-state.test.mjs`
- Modify: `src/quest-state.js`
- Modify: `tests/quest-state.test.mjs`

**Interfaces:**
- Consumes: 진행 데이터의 `gold`와 `inventory`
- Produces: `SHOP_ITEMS`, `createInitialInventory()`, `buyShopItem(progress, itemId)`, `usePotion(progress, { itemId, current, max })`

- [ ] **Step 1: 상품 정의와 구매 성공·실패 테스트를 작성한다**

```js
import {
  SHOP_ITEMS,
  buyShopItem,
  createInitialInventory,
} from "../src/shop-state.js";

const progress = (gold, inventory = createInitialInventory()) => ({ gold, inventory });

test("체력 물약 한 개를 10 Gold에 구매한다", () => {
  const result = buyShopItem(progress(25), "hpPotion");
  assert.equal(result.ok, true);
  assert.equal(result.progress.gold, 15);
  assert.deepEqual(result.progress.inventory, { hpPotion: 1, mpPotion: 0 });
});

test("Gold 부족과 최대 보유 상태에서는 원본을 유지한다", () => {
  const poor = progress(9);
  assert.deepEqual(buyShopItem(poor, "hpPotion"), {
    ok: false, reason: "insufficient_gold", item: SHOP_ITEMS.hpPotion, progress: poor,
  });
  const full = progress(999, { hpPotion: 99, mpPotion: 0 });
  assert.equal(buyShopItem(full, "hpPotion").reason, "inventory_full");
  assert.equal(buyShopItem(full, "hpPotion").progress, full);
});
```

- [ ] **Step 2: 물약 회복·무소비 경계 테스트를 작성한다**

```js
test("체력 물약은 최대 HP까지만 회복하고 한 개를 소비한다", () => {
  const source = progress(0, { hpPotion: 2, mpPotion: 0 });
  const result = usePotion(source, { itemId: "hpPotion", current: 85, max: 100 });
  assert.equal(result.ok, true);
  assert.equal(result.value, 100);
  assert.equal(result.recovered, 15);
  assert.equal(result.progress.inventory.hpPotion, 1);
});

test("물약이 없거나 자원이 가득 차면 소비하지 않는다", () => {
  const empty = progress(0);
  assert.equal(usePotion(empty, { itemId: "hpPotion", current: 50, max: 100 }).reason, "out_of_stock");
  const fullHp = progress(0, { hpPotion: 1, mpPotion: 0 });
  const result = usePotion(fullHp, { itemId: "hpPotion", current: 100, max: 100 });
  assert.equal(result.reason, "already_full");
  assert.equal(result.progress, fullHp);
});
```

- [ ] **Step 3: 신규 테스트를 실행해 모듈 부재로 실패하는지 확인한다**

Run: `node --test tests/shop-state.test.mjs tests/quest-state.test.mjs`

Expected: FAIL with module-not-found for `src/shop-state.js` or missing `inventory` in initial progress.

- [ ] **Step 4: 물약 상태 모듈과 초기 인벤토리를 구현한다**

```js
export const SHOP_ITEMS = Object.freeze({
  hpPotion: Object.freeze({
    id: "hpPotion", name: "작은 체력 물약", price: 10,
    resource: "hp", restore: 30, maxQuantity: 99,
  }),
  mpPotion: Object.freeze({
    id: "mpPotion", name: "작은 마력 물약", price: 15,
    resource: "mp", restore: 25, maxQuantity: 99,
  }),
});

export function createInitialInventory() {
  return { hpPotion: 0, mpPotion: 0 };
}

export function buyShopItem(progress, itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item) return { ok: false, reason: "not_found", item: null, progress };
  if (progress.inventory[itemId] >= item.maxQuantity) {
    return { ok: false, reason: "inventory_full", item, progress };
  }
  if (progress.gold < item.price) {
    return { ok: false, reason: "insufficient_gold", item, progress };
  }
  return {
    ok: true,
    reason: null,
    item,
    progress: {
      ...progress,
      gold: progress.gold - item.price,
      inventory: { ...progress.inventory, [itemId]: progress.inventory[itemId] + 1 },
    },
  };
}
```

Implement `usePotion` with the same immutable-return shape, `Math.min(current + item.restore, max)`, and `out_of_stock`, `already_full`, and `not_found` reasons. Add `inventory: createInitialInventory()` to `createInitialProgress()` and clone `inventory` whenever quest state is cloned.

```js
export function usePotion(progress, { itemId, current, max }) {
  const item = SHOP_ITEMS[itemId];
  if (!item) {
    return { ok: false, reason: "not_found", item: null, progress, value: current, recovered: 0 };
  }
  if (progress.inventory[itemId] <= 0) {
    return { ok: false, reason: "out_of_stock", item, progress, value: current, recovered: 0 };
  }
  if (current >= max) {
    return { ok: false, reason: "already_full", item, progress, value: current, recovered: 0 };
  }
  const value = Math.min(current + item.restore, max);
  return {
    ok: true,
    reason: null,
    item,
    value,
    recovered: value - current,
    progress: {
      ...progress,
      inventory: { ...progress.inventory, [itemId]: progress.inventory[itemId] - 1 },
    },
  };
}
```

- [ ] **Step 5: 상점과 퀘스트 상태 테스트를 통과시킨다**

Run: `node --test tests/shop-state.test.mjs tests/quest-state.test.mjs`

Expected: PASS with no mutation of the source progress object.

- [ ] **Step 6: 물약 상태 모듈을 커밋한다**

```bash
git add src/shop-state.js src/quest-state.js tests/shop-state.test.mjs tests/quest-state.test.mjs
git commit -m "물약 구매와 사용 상태 로직 추가"
```

---

### Task 3: localStorage v3와 v2·v1 이전

**Files:**
- Modify: `src/progress-storage.js`
- Modify: `tests/progress-storage.test.mjs`

**Interfaces:**
- Consumes: `createInitialProgress()` and `createInitialInventory()`
- Produces: `progressStorageKey(nickname)` for v3, `v2ProgressStorageKey(nickname)`, existing `legacyProgressStorageKey(nickname)`, v3-aware `loadProgressWithStatus` and `saveProgress`

- [ ] **Step 1: v3 저장·복원과 유효하지 않은 인벤토리 테스트를 작성한다**

```js
test("v3 진행 데이터는 물약 수량을 저장하고 복원한다", () => {
  const storage = memoryStorage();
  const progress = {
    ...createInitialProgress(),
    gold: 40,
    inventory: { hpPotion: 2, mpPotion: 1 },
  };
  assert.deepEqual(saveProgress(storage, "미아", progress), { ok: true });
  assert.deepEqual(JSON.parse(storage.getItem(progressStorageKey("미아"))), {
    version: 3,
    ...progress,
  });
  assert.deepEqual(loadProgress(storage, "미아"), progress);
});

test("v3 물약 수량은 0부터 99 사이의 안전한 정수여야 한다", () => {
  for (const inventory of [
    { hpPotion: -1, mpPotion: 0 },
    { hpPotion: 100, mpPotion: 0 },
    { hpPotion: 1.5, mpPotion: 0 },
    { hpPotion: 0 },
  ]) {
    const storage = memoryStorage();
    storage.setItem(progressStorageKey("미아"), JSON.stringify({
      version: 3,
      ...createInitialProgress(),
      inventory,
    }));
    assert.deepEqual(loadProgress(storage, "미아"), createInitialProgress());
  }
});
```

- [ ] **Step 2: v2와 v1의 v3 이전 및 손상된 v3 폴백 테스트를 작성한다**

```js
test("v2 진행은 기존 상태를 유지하고 빈 인벤토리를 추가해 v3로 이전한다", () => {
  const storage = memoryStorage();
  const v2 = {
    version: 2,
    level: 2,
    exp: 10,
    nextLevelExp: 200,
    gold: 35,
    completedQuests: [],
    quests: { adventureStart: { status: "active", progress: 1 } },
  };
  storage.setItem(v2ProgressStorageKey("미아"), JSON.stringify(v2));
  const loaded = loadProgress(storage, "미아");
  assert.equal(loaded.level, 2);
  assert.equal(loaded.gold, 35);
  assert.deepEqual(loaded.inventory, { hpPotion: 0, mpPotion: 0 });
  assert.equal(JSON.parse(storage.getItem(progressStorageKey("미아"))).version, 3);
});

test("손상된 v3가 있어도 유효한 v2로 폴백한다", () => {
  const storage = memoryStorage();
  const validV2 = {
    version: 2,
    level: 1,
    exp: 12,
    nextLevelExp: 100,
    gold: 18,
    completedQuests: [],
    quests: { adventureStart: { status: "available", progress: 0 } },
  };
  storage.setItem(progressStorageKey("미아"), "{broken");
  storage.setItem(v2ProgressStorageKey("미아"), JSON.stringify(validV2));
  assert.equal(loadProgress(storage, "미아").gold, validV2.gold);
});
```

- [ ] **Step 3: 저장 테스트를 실행해 버전과 인벤토리 불일치로 실패하는지 확인한다**

Run: `node --test tests/progress-storage.test.mjs`

Expected: FAIL because the current key and payload version are 2 and inventory is not serialized.

- [ ] **Step 4: v3 우선 로드와 단계별 이전을 구현한다**

```js
const STORAGE_VERSION = 3;
const STORAGE_PREFIX = "pixel-world.progress.v3:";
const V2_STORAGE_PREFIX = "pixel-world.progress.v2:";
const LEGACY_STORAGE_PREFIX = "pixel-world.progress.v1:";

function isValidInventory(inventory) {
  return isRecord(inventory)
    && ["hpPotion", "mpPotion"].every((id) =>
      Number.isSafeInteger(inventory[id])
      && inventory[id] >= 0
      && inventory[id] <= 99);
}

export function v2ProgressStorageKey(nickname) {
  return `${V2_STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}
```

Update `toProgress` to deep-copy `inventory`. Split the current v2 validator from the v3 validator, probe keys in v3 → v2 → v1 order, add empty inventory during either migration, save the migrated result under v3, and retain `migrationWriteFailed` when migration persistence fails.

- [ ] **Step 5: 저장 테스트와 기존 퀘스트 테스트를 통과시킨다**

Run: `node --test tests/progress-storage.test.mjs tests/quest-state.test.mjs`

Expected: PASS for v3 round trips, v2/v1 migrations, corrupted v3 fallback, and storage failures.

- [ ] **Step 6: 저장 버전 이전을 커밋한다**

```bash
git add src/progress-storage.js tests/progress-storage.test.mjs
git commit -m "물약 인벤토리 저장 v3 이전 추가"
```

---

### Task 4: 중앙 마을의 연금술사 미아

**Files:**
- Modify: `src/npc-data.js`
- Modify: `tests/npcs.test.mjs`

**Interfaces:**
- Consumes: existing `getNpcsForWorld(mapId)` and `findNearbyNpc(npcs, player)`
- Produces: village NPC records with `role: "quest" | "shop"`; Mia at `{ x: 2300, y: 1000 }`

- [ ] **Step 1: 미아 배치·역할·최근접 선택 테스트를 작성한다**

```js
test("중앙 마을에 아렌과 상점 역할의 미아가 배치된다", () => {
  const village = getNpcsForWorld("village");
  assert.deepEqual(village.map(npc => [npc.id, npc.role]), [
    ["aren", "quest"],
    ["mia", "shop"],
  ]);
  const mia = village.find(npc => npc.id === "mia");
  assert.deepEqual({ x: mia.x, y: mia.y, interactionRadius: mia.interactionRadius }, {
    x: 2300, y: 1000, interactionRadius: 80,
  });
});

test("두 NPC 범위가 겹치면 더 가까운 NPC를 선택한다", () => {
  const npcs = [
    { id: "aren", x: 0, y: 0, interactionRadius: 100 },
    { id: "mia", x: 40, y: 0, interactionRadius: 100 },
  ];
  assert.equal(findNearbyNpc(npcs, { x: 35, y: 0 }).id, "mia");
});
```

- [ ] **Step 2: NPC 테스트를 실행해 미아 부재로 실패하는지 확인한다**

Run: `node --test tests/npcs.test.mjs`

Expected: FAIL because the village currently contains only Aren and has no `role` field.

- [ ] **Step 3: 아렌 역할과 미아 NPC를 등록한다**

```js
const AREN = Object.freeze({
  id: "aren", role: "quest", name: "현자 아렌", mapId: "village",
  x: 1440, y: 520, interactionRadius: 80, coatColor: "#6f5bd3",
});

const MIA = Object.freeze({
  id: "mia", role: "shop", name: "연금술사 미아", mapId: "village",
  x: 2300, y: 1000, interactionRadius: 80, coatColor: "#0f9f8f",
});
```

Set `NPCS_BY_WORLD.village` to `[AREN, MIA]` and keep all non-village results empty.

- [ ] **Step 4: NPC 테스트를 통과시킨다**

Run: `node --test tests/npcs.test.mjs tests/world.test.mjs`

Expected: PASS, including existing camera-relative NPC label rendering.

- [ ] **Step 5: 미아 NPC를 커밋한다**

```bash
git add src/npc-data.js tests/npcs.test.mjs
git commit -m "중앙 마을 연금술사 미아 추가"
```

---

### Task 5: 전투 보상·상점·물약 게임 통합

**Files:**
- Modify: `src/game.js`
- Modify: `tests/game-progression.test.mjs`
- Create: `tests/game-shop.test.mjs`

**Interfaces:**
- Consumes: `grantHuntingReward(progress, enemyKind, random)`, `buyShopItem`, `usePotion`, NPC `role`
- Produces: `isShopOpen()`, `openNpcInteraction()`, `openShop()`, `closeShop()`, `buyItem(itemId)`, `useItem(itemId)`, `updateInventoryHud()`, `updateShopHud()`

- [ ] **Step 1: 종류별 전투 보상과 다중 처치 저장 한 번 테스트를 갱신한다**

```js
test("퀘스트 없이 멧돼지를 처치하면 7 EXP와 3 Gold를 얻는다", async () => {
  await withMinimumGold(() => {
    const { game, notifications, storage } = gameHarness({ progress: createInitialProgress() });
    game.recordEnemyKill("boar");
    assert.equal(game.progress.exp, 7);
    assert.equal(game.progress.gold, 3);
    assert.equal(game.progress.quests.adventureStart.progress, 0);
    assert.equal(storage.writes.length, 1);
    assert.equal(notifications.at(-1), "멧돼지 처치! EXP +7 · Gold +3");
  });
});
```

Retain the existing multi-kill fixture, but use two different kinds and assert combined EXP/Gold plus one `setItem` call.

- [ ] **Step 2: 미아 상점 진입과 구매 테스트를 작성한다**

Extend the existing test harness with concrete shop state and DOM doubles:

```js
import { getNpcsForWorld } from "../src/npc-data.js";

function shopHarness(overrides = {}) {
  const initial = createInitialProgress();
  const progress = {
    ...initial,
    ...overrides,
    inventory: { ...initial.inventory, ...(overrides.inventory || {}) },
  };
  const harness = gameHarness({ progress });
  const { game } = harness;
  Object.assign(game, {
    mapId: "village",
    running: true,
    inputEnabled: true,
    chatInputActive: false,
    portalTransition: null,
    attackState: null,
    keys: new Set(),
    npcs: getNpcsForWorld("village"),
  });
  Object.assign(game.ui, {
    dialogueOverlay: { ...fakeNode(), hidden: true },
    shopOverlay: { ...fakeNode(), hidden: true },
    shopGoldText: fakeNode(),
    shopCloseButton: { ...fakeNode(), focus() {} },
    buyHpPotionButton: { ...fakeNode(), disabled: false },
    buyMpPotionButton: { ...fakeNode(), disabled: false },
    shopHpPotionCount: fakeNode(),
    shopMpPotionCount: fakeNode(),
    hpPotionCount: fakeNode(),
    mpPotionCount: fakeNode(),
    npcPrompt: { ...fakeNode(), hidden: true },
  });
  game.canvas = { focus() {} };
  return harness;
}
```

```js
test("미아 근처에서 F 상호작용을 열고 체력 물약을 구매한다", () => {
  const { game, storage } = shopHarness({ gold: 20 });
  const mia = game.npcs.find(npc => npc.id === "mia");
  Object.assign(game.player, { x: mia.x, y: mia.y });
  assert.equal(game.openNpcInteraction(), true);
  assert.equal(game.isShopOpen(), true);
  assert.equal(game.buyItem("hpPotion"), true);
  assert.equal(game.progress.gold, 10);
  assert.equal(game.progress.inventory.hpPotion, 1);
  assert.equal(storage.writes.length, 1);
});

test("Gold 부족 구매는 저장하지 않는다", () => {
  const { game, storage, notifications } = shopHarness({ gold: 9 });
  assert.equal(game.buyItem("hpPotion"), false);
  assert.equal(game.progress.gold, 9);
  assert.equal(storage.writes.length, 0);
  assert.equal(notifications.at(-1), "Gold가 부족합니다.");
});
```

- [ ] **Step 3: 물약 성공·실패와 상호작용 차단 테스트를 작성한다**

```js
test("체력 물약 사용은 HP와 수량을 갱신하고 저장한다", () => {
  const { game, storage } = shopHarness({ inventory: { hpPotion: 2, mpPotion: 0 } });
  game.player.hp = 85;
  assert.equal(game.useItem("hpPotion"), true);
  assert.equal(game.player.hp, 100);
  assert.equal(game.progress.inventory.hpPotion, 1);
  assert.equal(storage.writes.length, 1);
});

test("최대 HP와 상점 열린 상태에서는 물약을 소비하지 않는다", () => {
  const { game } = shopHarness({ inventory: { hpPotion: 1, mpPotion: 0 } });
  game.player.hp = game.player.maxHp;
  assert.equal(game.useItem("hpPotion"), false);
  assert.equal(game.progress.inventory.hpPotion, 1);
  game.player.hp = 50;
  game.ui.shopOverlay.hidden = false;
  assert.equal(game.useItem("hpPotion"), false);
  assert.equal(game.progress.inventory.hpPotion, 1);
});
```

- [ ] **Step 4: 통합 테스트를 실행해 현재 분기와 빈 슬롯 처리 때문에 실패하는지 확인한다**

Run: `node --test tests/game-progression.test.mjs tests/game-shop.test.mjs`

Expected: FAIL because combat still uses a generic reward and `PixelRPG` has no shop or item methods.

- [ ] **Step 5: 몬스터 종류별 지급과 실제 이름 알림을 연결한다**

Replace the slime/generic branch in `recordEnemyKill` with:

```js
const reward = grantHuntingReward(this.progress, enemyKind);
if (!reward) return null;
this.progress = reward.progress;
this.applyProgressionStats(reward.levelsGained > 0);
if (!deferEffects) this.commitEnemyKillEffects([reward]);
return reward;
```

Render each kill notification from `reward.label`, `reward.rewardExp`, and `reward.rewardGold`. Keep `recordQuestKill(enemyKind)` before reward lookup so the quest rule remains independent.

- [ ] **Step 6: NPC 역할 분기와 상점 생명주기를 구현한다**

Add `isInteractionOpen()` returning dialogue-or-shop, then use it in movement, attacks, chat opening, portals, and NPC prompt eligibility. `openNpcInteraction()` resolves the nearest NPC: `quest` calls the existing Aren dialogue path and `shop` calls `openShop()`.

`openShop()` clears keys and attack state, stops movement, reveals `shopOverlay`, refreshes the shop HUD, focuses `shopCloseButton`, and returns `true`. `closeShop()` hides the overlay, returns focus to the Canvas, refreshes the NPC prompt, and returns whether it was open. The `F` key closes whichever NPC interaction is already open; otherwise it calls `openNpcInteraction()`.

- [ ] **Step 7: 구매와 물약 사용을 연결한다**

```js
buyItem(itemId) {
  const result = buyShopItem(this.progress, itemId);
  if (!result.ok) {
    this.notify(shopFailureMessage(result.reason));
    return false;
  }
  this.progress = result.progress;
  this.updateProgressHud();
  this.updateInventoryHud();
  this.updateShopHud();
  this.notify(`${result.item.name}을 구매했습니다. Gold -${result.item.price}`);
  this.persistProgress("구매했지만 진행 상황을 저장할 수 없습니다.");
  return true;
}
```

Change persistence to accept one exact failure message so purchase failures do not emit duplicate notices:

```js
persistProgress(failureMessage = "진행 상황을 브라우저에 저장할 수 없습니다.") {
  const result = saveProgress(browserStorage(), this.player.name, this.progress);
  if (!result.ok) this.notify(failureMessage);
  return result.ok;
}
```

Add an explicit message mapper in `game.js`:

```js
function shopFailureMessage(reason) {
  return {
    insufficient_gold: "Gold가 부족합니다.",
    inventory_full: "물약을 더 이상 보유할 수 없습니다.",
    out_of_stock: "해당 물약이 없습니다.",
    already_full: "이미 최대로 회복되어 있습니다.",
  }[reason] || "아이템을 사용할 수 없습니다.";
}
```

Implement `useItem` with the same result-driven flow. Map `hpPotion` to `player.hp` and `mpPotion` to `player.mp`, reject use when the game is not running, input is disabled, the player is respawning, or an interaction/chat/portal is active, and call `updateHud`, `updateInventoryHud`, and `persistProgress` only on success.

- [ ] **Step 8: 통합 테스트를 통과시킨다**

Run: `node --test tests/game-progression.test.mjs tests/game-shop.test.mjs tests/quest-state.test.mjs`

Expected: PASS for differentiated rewards, quest isolation, shop purchases, potion use, state blocking, and persistence counts.

- [ ] **Step 9: 게임 통합을 커밋한다**

```bash
git add src/game.js tests/game-progression.test.mjs tests/game-shop.test.mjs
git commit -m "미아 상점과 물약 사용 게임 흐름 연결"
```

---

### Task 6: 상점 모달과 물약 단축 슬롯 UI

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `styles.css`
- Modify: `tests/quest-ui-smoke.cjs`
- Create: `tests/shop-ui-smoke.cjs`

**Interfaces:**
- Consumes: Task 5 `PixelRPG` shop and item methods
- Produces DOM elements: `shopOverlay`, `shopGoldText`, `shopCloseButton`, `buyHpPotionButton`, `buyMpPotionButton`, `shopHpPotionCount`, `shopMpPotionCount`, `hpPotionSlot`, `mpPotionSlot`, `hpPotionCount`, `mpPotionCount`

- [ ] **Step 1: 상점 접근성·상품·물약 슬롯 마크업 스모크 테스트를 작성한다**

```js
test("상점 모달과 두 상품이 접근 가능한 이름으로 렌더링된다", () => {
  assert.match(html, /id="shopOverlay"[^>]*hidden/);
  assert.match(html, /aria-labelledby="shopTitle"/);
  assert.match(html, /id="buyHpPotionButton"/);
  assert.match(html, /작은 체력 물약/);
  assert.match(html, /10 G/);
  assert.match(html, /id="buyMpPotionButton"/);
  assert.match(html, /15 G/);
});

test("아이템 슬롯 1과 2가 물약 이름·효과·수량을 표시한다", () => {
  assert.match(html, /id="hpPotionSlot"[^>]*data-code="Digit1"/);
  assert.match(html, /id="hpPotionCount">×0/);
  assert.match(html, /id="mpPotionSlot"[^>]*data-code="Digit2"/);
  assert.match(html, /id="mpPotionCount">×0/);
});
```

- [ ] **Step 2: UI 테스트를 실행해 현재 빈 아이템 슬롯 때문에 실패하는지 확인한다**

Run: `node --test tests/shop-ui-smoke.cjs tests/quest-ui-smoke.cjs`

Expected: FAIL because the shop overlay and potion slot IDs do not exist.

- [ ] **Step 3: 상점 모달과 아이템 슬롯 마크업을 추가한다**

Add a `shop-overlay` section beside the dialogue overlay with a dialog card, title, live Gold value, two `.shop-item` rows, owned counts, purchase buttons, and a close button. Replace item slots 1 and 2 with named potion buttons and retain slot 3 as empty.

The purchase buttons must be `type="button"`, and the dialog must use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="shopTitle"`.

```html
<section id="shopOverlay" class="shop-overlay" hidden>
  <div class="modal-card shop-card" role="dialog" aria-modal="true" aria-labelledby="shopTitle">
    <button id="shopCloseButton" class="dialogue-close" type="button" aria-label="상점 닫기">×</button>
    <p class="eyebrow">ALCHEMIST SHOP</p>
    <h2 id="shopTitle">연금술사 미아의 상점</h2>
    <div class="shop-gold"><span>보유 Gold</span><b id="shopGoldText">0 G</b></div>
    <div class="shop-items">
      <article class="shop-item">
        <div><strong>작은 체력 물약</strong><small>HP 30 회복 · 보유 <b id="shopHpPotionCount">0 / 99</b></small></div>
        <button id="buyHpPotionButton" type="button">10 G 구매</button>
      </article>
      <article class="shop-item">
        <div><strong>작은 마력 물약</strong><small>MP 25 회복 · 보유 <b id="shopMpPotionCount">0 / 99</b></small></div>
        <button id="buyMpPotionButton" type="button">15 G 구매</button>
      </article>
    </div>
  </div>
</section>
```

```html
<button id="hpPotionSlot" class="slot item" data-code="Digit1" type="button">
  <span class="key">1</span><span class="slot-type">ITEM</span>
  <span class="item-name">작은 체력 물약</span><span class="skill-cost">HP +30</span>
  <span id="hpPotionCount" class="item-count">×0</span>
</button>
<button id="mpPotionSlot" class="slot item" data-code="Digit2" type="button">
  <span class="key">2</span><span class="slot-type">ITEM</span>
  <span class="item-name">작은 마력 물약</span><span class="skill-cost">MP +25</span>
  <span id="mpPotionCount" class="item-count">×0</span>
</button>
```

- [ ] **Step 4: DOM 요소 연결과 Escape·종료 우선순위를 갱신한다**

Add all Task 6 element IDs to the `elements` object in `main.js`. In the global keydown handler, close the shop on Escape before chat or exit handling. In `openExitDialog`, close both the Aren dialogue and the shop before disabling game input.

```js
if (game.isShopOpen() && event.code === "Escape") {
  event.preventDefault();
  game.closeShop();
  return;
}
```

- [ ] **Step 5: 상점과 물약 슬롯 스타일을 추가한다**

Use the existing `.dialogue-overlay`, `.modal-card`, `.slot.item`, and color variables. Add:

```css
.shop-overlay { pointer-events: auto; position: absolute; inset: 0; z-index: 36; display: grid; place-items: center; padding: 20px; background: rgba(5,9,17,.8); backdrop-filter: blur(5px); }
.shop-card { width: min(100%, 560px); text-align: left; }
.shop-gold { display: flex; justify-content: space-between; color: var(--item); font-weight: 900; }
.shop-items { display: grid; gap: 10px; margin: 16px 0; }
.shop-item { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; align-items: center; padding: 13px; border: 1px solid var(--line); border-radius: 12px; background: rgba(3,8,18,.42); }
.shop-item button:disabled { cursor: not-allowed; opacity: .48; }
.slot .item-name { position: absolute; inset: 24px 2px auto; font-size: 9px; font-weight: 900; }
.slot .item-count { position: absolute; right: 5px; bottom: 4px; color: #fde68a; font-size: 11px; font-weight: 900; }
```

At widths below 520px, keep the shop card within the viewport and stack each product action beneath its description.

- [ ] **Step 6: UI 스모크 테스트와 문법 검사를 통과시킨다**

Run: `node --test tests/shop-ui-smoke.cjs tests/quest-ui-smoke.cjs && node --check src/main.js && node --check src/game.js`

Expected: PASS with all queried element IDs present and no syntax errors.

- [ ] **Step 7: UI를 커밋한다**

```bash
git add index.html src/main.js styles.css tests/shop-ui-smoke.cjs tests/quest-ui-smoke.cjs
git commit -m "미아 상점 모달과 물약 단축 슬롯 추가"
```

---

### Task 7: 전체 회귀 검증과 브라우저 플레이테스트

**Files:**
- Modify only if verification exposes an in-scope defect: files from Tasks 1–6 and their matching tests

**Interfaces:**
- Consumes: complete feature from Tasks 1–6
- Produces: verified feature branch ready for review and publication

- [ ] **Step 1: 전체 자동화 테스트를 실행한다**

Run: `node --test tests/*.test.mjs tests/*.cjs`

Expected: all tests PASS with zero failures, cancellations, or skips.

- [ ] **Step 2: 모든 변경 JavaScript의 문법을 검사한다**

Run: `node --check src/player-progression.js && node --check src/shop-state.js && node --check src/quest-state.js && node --check src/progress-storage.js && node --check src/npc-data.js && node --check src/game.js && node --check src/main.js`

Expected: exit code 0 and no output.

- [ ] **Step 3: diff 위생을 검사한다**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intentional feature files are modified before the final verification commit.

- [ ] **Step 4: 로컬 브라우저에서 핵심 플레이 흐름을 점검한다**

Run a static server from the repository root and verify:

1. Existing nickname으로 접속하면 v2 진행이 유지되고 물약은 0개다.
2. 불꽃·숲·물방울 슬라임, 멧돼지, 게가 확정된 범위의 보상을 지급한다.
3. 퀘스트 미수락 사냥도 EXP와 Gold를 지급한다.
4. 미아에게 접근하면 동적 `F` 안내가 표시되고 상점이 열린다.
5. Gold 부족과 99개 보유 상태의 버튼이 비활성화된다.
6. 구매 성공 후 Gold와 물약 수량이 즉시 갱신된다.
7. `1`, `2` 키와 슬롯 클릭으로 HP·MP가 회복된다.
8. 최대 HP·MP 상태에서는 물약이 줄지 않는다.
9. 상점, 아렌 대화, 채팅, 사망, 포탈 전환 중에는 물약을 사용할 수 없다.
10. 같은 닉네임으로 재접속하면 인벤토리가 복원된다.
11. Canvas 렌더링 깜빡임과 브라우저 콘솔 오류가 없다.

- [ ] **Step 5: 검증 중 수정이 있었다면 해당 실패를 재현하는 테스트와 함께 커밋한다**

```bash
git add src/player-progression.js src/shop-state.js src/quest-state.js \
  src/progress-storage.js src/npc-data.js src/game.js src/main.js \
  index.html styles.css tests/player-progression.test.mjs \
  tests/shop-state.test.mjs tests/quest-state.test.mjs \
  tests/progress-storage.test.mjs tests/npcs.test.mjs \
  tests/game-progression.test.mjs tests/game-shop.test.mjs \
  tests/quest-ui-smoke.cjs tests/shop-ui-smoke.cjs
git commit -m "상점 실플레이 검증 문제 수정"
```

Skip this commit only when Step 4 exposes no defect and the worktree is already clean.

- [ ] **Step 6: 최종 변경 범위와 커밋 기록을 확인한다**

Run: `git status --short --branch && git log --oneline --decorate -10`

Expected: a clean feature branch containing the design, plan, and focused implementation commits.
