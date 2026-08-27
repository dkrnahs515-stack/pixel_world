# Level Weapons and Blacksmith System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six level-gated weapons sold by Brann, resale at 50%, manual inventory equipping, weapon-specific combat stats and visuals, v4 persistence, and remote-player weapon appearance sync.

**Architecture:** Keep the immutable weapon catalog and pure equipment transitions outside the game controller. The existing `PixelRPG` class remains the integration boundary for modal input, HUD refresh, persistence, combat snapshots, rendering, and network publishing; save migration and Canvas weapon drawing stay in focused modules.

**Tech Stack:** Browser-native ES modules, HTML5 Canvas, DOM/CSS overlays, Firebase Realtime Database adapter, browser `localStorage`, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-27-weapon-blacksmith-system-design.md`

## Global Constraints

- Do not add runtime dependencies or external image assets.
- Keep Mia's HP/MP potion shop and all existing potion behavior unchanged.
- Upper weapons are independently purchasable when their level requirement is met; prior tiers are never prerequisites.
- Buying never auto-equips. Equipping happens only from the inventory equipment section.
- Selling returns exactly 50% of purchase price, requires confirmation, permits selling the equipped weapon, and always equips the starter sword when the sold weapon was equipped.
- The starter sword is always owned and cannot be bought or sold.
- Weapon damage and range modify only the basic attack. Strong damage remains `3`, strong range remains `96px`, and only strong cooldown changes by weapon.
- Persist `equipment.ownedWeaponIds` and `equipment.equippedWeaponId` in save v4 while retaining v3, v2, and v1 recovery.
- Unknown, missing, or unowned equipped IDs fall back to `starter-sword` locally and over the network.
- Render Brann and all seven weapons with the existing Canvas pixel style.
- Maintain modal keyboard trapping, `Escape` priority, mobile one-column layouts, and all existing game input blocking rules.
- Use TDD for every behavior change and commit after each task is green.

---

## File Structure

### New production files

- `src/weapon-data.js` — immutable weapon catalog, IDs, combat values, sale prices, and pixel visual metadata.
- `src/equipment-state.js` — pure initial/normalize/buy/sell/equip transitions over progress state.
- `src/weapon-rendering.js` — shared Canvas weapon renderer for local and remote characters.

### New test files

- `tests/weapon-data.test.mjs` — exact catalog and fallback behavior.
- `tests/equipment-state.test.mjs` — purchase, sale, equip, and normalization rules.
- `tests/weapon-rendering.test.mjs` — visual length, palette, decoration, and direction transforms.
- `tests/game-blacksmith.test.mjs` — Brann interaction, modal state, buying, selling, confirmation, focus, and persistence.
- `tests/blacksmith-ui.static.test.cjs` — blacksmith DOM, labels, accessibility, z-index, and mobile layout.

### Existing files to modify

- `src/quest-state.js` and `tests/quest-state.test.mjs` — include initial equipment.
- `src/progress-storage.js` and `tests/progress-storage.test.mjs` — save v4 validation and v3/v2/v1 migration.
- `src/combat.js`, `src/enemies.js`, `tests/combat.test.mjs`, `tests/enemies.test.mjs`, `tests/enemy-rendering.test.mjs` — weapon attack snapshots and one-decimal HP.
- `src/network-state.js` and `tests/network-state.test.mjs` — serialize and normalize `equippedWeaponId`.
- `database.rules.json` and `tests/database-rules.test.mjs` — validate known weapon IDs while permitting legacy snapshots without the field.
- `src/npc-data.js`, `src/npcs.js`, `src/world.js`, `tests/npcs.test.mjs`, `tests/world-layer-cache.test.mjs` — Brann and forge visuals.
- `index.html`, `styles.css`, `src/main.js`, `src/game.js`, `tests/game-shop.test.mjs`, `tests/inventory-ui.static.test.cjs` — blacksmith and equipment UI integration.
- `src/qa-mode.js`, `tests/qa-mode.test.mjs`, `tests/game-qa.test.mjs`, `tests/qa-ui.static.test.cjs` — Lv.30/Gold QA preparation.

---

### Task 1: Immutable Weapon Catalog and Pure Equipment State

**Files:**
- Create: `src/weapon-data.js`
- Create: `src/equipment-state.js`
- Create: `tests/weapon-data.test.mjs`
- Create: `tests/equipment-state.test.mjs`

**Interfaces:**
- Produces: `STARTER_WEAPON_ID: "starter-sword"`
- Produces: `WEAPON_ORDER: readonly string[]`
- Produces: `WEAPONS: Readonly<Record<string, WeaponDefinition>>`
- Produces: `getWeaponDefinition(id): WeaponDefinition | null`
- Produces: `resolveWeaponDefinition(id): WeaponDefinition`
- Produces: `createInitialEquipment(): { ownedWeaponIds: string[], equippedWeaponId: string }`
- Produces: `normalizeEquipment(value): EquipmentState`
- Produces: `buyWeapon(progress, weaponId): EquipmentResult`
- Produces: `sellWeapon(progress, weaponId): EquipmentResult`
- Produces: `equipWeapon(progress, weaponId): EquipmentResult`

- [ ] **Step 1: Write catalog tests with every exact approved value**

```js
test("무기 카탈로그는 승인된 레벨·가격·전투 수치를 제공한다", () => {
  assert.deepEqual(
    WEAPON_ORDER.map(id => {
      const w = WEAPONS[id];
      return [id, w.requiredLevel, w.price, w.damage, w.range, w.strongCooldown];
    }),
    [
      ["starter-sword", 1, null, 1, 64, 4],
      ["katana", 5, 80, 1, 76, 4],
      ["reinforced-katana", 10, 180, 1.3, 76, 3.8],
      ["superior-katana", 15, 350, 1.5, 76, 3.5],
      ["elite-katana", 20, 600, 2, 77, 3.3],
      ["masterwork-katana", 25, 900, 2.2, 77, 3.3],
      ["reinforced-masterwork-katana", 30, 1300, 2.5, 78, 3.1],
    ],
  );
  assert.deepEqual(WEAPON_ORDER.slice(1).map(id => WEAPONS[id].sellPrice), [40, 90, 175, 300, 450, 650]);
  assert.equal(resolveWeaponDefinition("unknown").id, "starter-sword");
});
```

- [ ] **Step 2: Write equipment transition tests**

```js
const progress = (overrides = {}) => ({
  level: 30,
  gold: 2000,
  equipment: createInitialEquipment(),
  ...overrides,
});

test("상위 무기는 이전 단계를 사지 않아도 구매되며 자동 장착되지 않는다", () => {
  const source = progress();
  const result = buyWeapon(source, "masterwork-katana");
  assert.equal(result.ok, true);
  assert.equal(result.progress.gold, 1100);
  assert.deepEqual(result.progress.equipment.ownedWeaponIds, ["starter-sword", "masterwork-katana"]);
  assert.equal(result.progress.equipment.equippedWeaponId, "starter-sword");
  assert.deepEqual(source.equipment, createInitialEquipment());
});

test("장착 무기를 팔면 다른 상위 무기가 있어도 시작 검을 장착한다", () => {
  const source = progress({
    equipment: {
      ownedWeaponIds: ["starter-sword", "katana", "masterwork-katana"],
      equippedWeaponId: "masterwork-katana",
    },
  });
  const result = sellWeapon(source, "masterwork-katana");
  assert.equal(result.progress.gold, 2450);
  assert.deepEqual(result.progress.equipment.ownedWeaponIds, ["starter-sword", "katana"]);
  assert.equal(result.progress.equipment.equippedWeaponId, "starter-sword");
});

test("비장착 무기를 팔아도 판매할 때마다 항상 시작 검으로 교체한다", () => {
  const source = progress({
    equipment: {
      ownedWeaponIds: ["starter-sword", "katana", "elite-katana"],
      equippedWeaponId: "elite-katana",
    },
  });
  const result = sellWeapon(source, "katana");
  assert.equal(result.progress.equipment.equippedWeaponId, "starter-sword");
});
```

```js
test("실패한 구매·판매·장착은 원본과 Gold를 바꾸지 않는다", () => {
  const locked = progress({ level: 4, gold: 2000 });
  assert.equal(buyWeapon(locked, "katana").reason, "level_locked");
  assert.equal(buyWeapon(progress({ gold: 79 }), "katana").reason, "insufficient_gold");
  assert.equal(buyWeapon(progress({ equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "starter-sword" } }), "katana").reason, "already_owned");
  assert.equal(buyWeapon(progress(), "starter-sword").reason, "starter_weapon");
  assert.equal(buyWeapon(progress(), "unknown").reason, "unknown_weapon");
  assert.equal(sellWeapon(progress(), "katana").reason, "not_owned");
  assert.equal(equipWeapon(progress(), "katana").reason, "not_owned");
  assert.equal(locked.gold, 2000);
  assert.deepEqual(locked.equipment, createInitialEquipment());
});

test("정규화는 중복과 미등록 ID를 제거하고 잘못된 장착을 시작 검으로 복구한다", () => {
  assert.deepEqual(normalizeEquipment({
    ownedWeaponIds: ["katana", "katana", "unknown"],
    equippedWeaponId: "unknown",
  }), {
    ownedWeaponIds: ["starter-sword", "katana"],
    equippedWeaponId: "starter-sword",
  });
});

test("판매 후 원래 가격으로 재구매할 수 있고 같은 무기 재장착은 no-op이다", () => {
  const source = progress({
    gold: 0,
    equipment: {
      ownedWeaponIds: ["starter-sword", "katana"],
      equippedWeaponId: "katana",
    },
  });
  const sold = sellWeapon(source, "katana");
  assert.equal(sold.progress.gold, 40);
  const repurchased = buyWeapon({ ...sold.progress, gold: 80 }, "katana");
  assert.equal(repurchased.progress.gold, 0);
  assert.equal(repurchased.progress.equipment.equippedWeaponId, "starter-sword");
  const unchanged = equipWeapon(repurchased.progress, "starter-sword");
  assert.equal(unchanged.ok, false);
  assert.equal(unchanged.reason, "already_equipped");
  assert.equal(unchanged.progress, repurchased.progress);
});
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run: `node --test tests/weapon-data.test.mjs tests/equipment-state.test.mjs`

Expected: FAIL because both production modules are missing.

- [ ] **Step 4: Implement `weapon-data.js`**

```js
export const STARTER_WEAPON_ID = "starter-sword";

export const WEAPON_ORDER = Object.freeze([
  STARTER_WEAPON_ID,
  "katana",
  "reinforced-katana",
  "superior-katana",
  "elite-katana",
  "masterwork-katana",
  "reinforced-masterwork-katana",
]);

export const WEAPONS = Object.freeze(Object.fromEntries([
  [STARTER_WEAPON_ID, weapon({ id: STARTER_WEAPON_ID, name: "시작 검", requiredLevel: 1, price: null, damage: 1, range: 64, strongCooldown: 4, visual: starterVisual })],
  ["katana", weapon({ id: "katana", name: "카타나", requiredLevel: 5, price: 80, damage: 1, range: 76, strongCooldown: 4, visual: katanaVisual })],
  ["reinforced-katana", weapon({ id: "reinforced-katana", name: "강화 카타나", requiredLevel: 10, price: 180, damage: 1.3, range: 76, strongCooldown: 3.8, visual: reinforcedVisual })],
  ["superior-katana", weapon({ id: "superior-katana", name: "상급 카타나", requiredLevel: 15, price: 350, damage: 1.5, range: 76, strongCooldown: 3.5, visual: superiorVisual })],
  ["elite-katana", weapon({ id: "elite-katana", name: "정예 카타나", requiredLevel: 20, price: 600, damage: 2, range: 77, strongCooldown: 3.3, visual: eliteVisual })],
  ["masterwork-katana", weapon({ id: "masterwork-katana", name: "명검", requiredLevel: 25, price: 900, damage: 2.2, range: 77, strongCooldown: 3.3, visual: masterworkVisual })],
  ["reinforced-masterwork-katana", weapon({ id: "reinforced-masterwork-katana", name: "강화 명검", requiredLevel: 30, price: 1300, damage: 2.5, range: 78, strongCooldown: 3.1, visual: reinforcedMasterworkVisual })],
]));
```

Define every referenced visual object before the catalog with exact blade length, blade/spine/grip/guard colors, and gold/red decoration counts. `weapon()` must freeze the definition and set `sellPrice` to `null` for the starter or `price / 2` otherwise.

```js
const starterVisual = visual({ bladeLength: 21, bladeWidth: 4, bladeColor: "#bec9d4", highlightColor: "#eef6ff", spineColor: "#7a8794", gripColor: "#6b4b2f", guardColor: "#4b5563", pommelColor: "#5b3b2a", goldMarks: 0, redMarks: 0 });
const katanaVisual = visual({ bladeLength: 29, bladeWidth: 3, bladeColor: "#dceeff", highlightColor: "#f8fafc", spineColor: "#4b5563", gripColor: "#15191f", guardColor: "#252b35", pommelColor: "#4b5563", goldMarks: 0, redMarks: 0 });
const reinforcedVisual = visual({ bladeLength: 29, bladeWidth: 3, bladeColor: "#e7eef5", highlightColor: "#ffffff", spineColor: "#414854", gripColor: "#12161c", guardColor: "#202938", pommelColor: "#596273", goldMarks: 0, redMarks: 0 });
const superiorVisual = visual({ bladeLength: 29, bladeWidth: 4, bladeColor: "#e9edf2", highlightColor: "#ffffff", spineColor: "#323843", gripColor: "#11151a", guardColor: "#1f2937", pommelColor: "#677180", goldMarks: 0, redMarks: 0 });
const eliteVisual = visual({ bladeLength: 30, bladeWidth: 3, bladeColor: "#eff6ff", highlightColor: "#ffffff", spineColor: "#3e4652", gripColor: "#11151a", guardColor: "#d4a72c", pommelColor: "#b88b24", goldMarks: 1, redMarks: 0 });
const masterworkVisual = visual({ bladeLength: 31, bladeWidth: 3, bladeColor: "#f4f7f8", highlightColor: "#ffffff", spineColor: "#353b45", gripColor: "#0d1117", guardColor: "#111827", pommelColor: "#8b949e", goldMarks: 2, redMarks: 1 });
const reinforcedMasterworkVisual = visual({ bladeLength: 32, bladeWidth: 3, bladeColor: "#f7fafc", highlightColor: "#ffffff", spineColor: "#2d333d", gripColor: "#090d12", guardColor: "#111827", pommelColor: "#d4a72c", goldMarks: 4, redMarks: 2 });
```

- [ ] **Step 5: Implement immutable equipment transitions**

```js
export function createInitialEquipment() {
  return { ownedWeaponIds: [STARTER_WEAPON_ID], equippedWeaponId: STARTER_WEAPON_ID };
}

export function buyWeapon(progress, weaponId) {
  const weapon = getWeaponDefinition(weaponId);
  if (!weapon) return failure(progress, "unknown_weapon", null);
  if (weapon.id === STARTER_WEAPON_ID) return failure(progress, "starter_weapon", weapon);
  if (progress.equipment.ownedWeaponIds.includes(weapon.id)) return failure(progress, "already_owned", weapon);
  if (progress.level < weapon.requiredLevel) return failure(progress, "level_locked", weapon);
  if (progress.gold < weapon.price) return failure(progress, "insufficient_gold", weapon);
  return success(progress, weapon, {
    gold: progress.gold - weapon.price,
    equipment: {
      ...progress.equipment,
      ownedWeaponIds: [...progress.equipment.ownedWeaponIds, weapon.id],
    },
  });
}
```

Implement `sellWeapon` and `equipWeapon` with the same result shape `{ ok, reason, weapon, progress }`. Every successful sale resets the equipped weapon to the starter, including sales of a weapon that was not equipped. Preserve unrelated progress fields and never mutate input arrays or objects. `normalizeEquipment` must return owned IDs in `WEAPON_ORDER` order, always insert the starter first, and reset an unknown or unowned equipped ID to the starter.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `node --test tests/weapon-data.test.mjs tests/equipment-state.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/weapon-data.js src/equipment-state.js tests/weapon-data.test.mjs tests/equipment-state.test.mjs
git commit -m "무기 카탈로그와 장비 상태 로직 추가"
```

---

### Task 2: Save v4 and Legacy Migration

**Files:**
- Modify: `src/quest-state.js`
- Modify: `src/progress-storage.js`
- Modify: `tests/quest-state.test.mjs`
- Modify: `tests/progress-storage.test.mjs`

**Interfaces:**
- Consumes: `createInitialEquipment()`, `normalizeEquipment(value)`
- Produces: v4 `progressStorageKey(nickname)`
- Produces: `v3ProgressStorageKey(nickname)` for migration tests and loading
- Preserves: `legacyProgressStorageKey`, `v2ProgressStorageKey`, `loadProgress`, `loadProgressWithStatus`, `saveProgress`

- [ ] **Step 1: Update initial-progress and storage tests for v4**

```js
test("초기 진행 데이터는 시작 검을 보유하고 장착한다", () => {
  assert.deepEqual(createInitialProgress().equipment, {
    ownedWeaponIds: ["starter-sword"],
    equippedWeaponId: "starter-sword",
  });
});

test("v3 진행은 기존 값을 유지하고 초기 장비를 추가해 v4로 이전한다", () => {
  const storage = memoryStorage();
  storage.setItem(v3ProgressStorageKey("아렌"), JSON.stringify({ version: 3, ...validV3() }));
  const loaded = loadProgress(storage, "아렌");
  assert.equal(loaded.gold, validV3().gold);
  assert.deepEqual(loaded.inventory, validV3().inventory);
  assert.deepEqual(loaded.equipment, createInitialEquipment());
  assert.deepEqual(JSON.parse(storage.getItem(progressStorageKey("아렌"))), { version: 4, ...loaded });
});
```

Change all existing key/version expectations from v3 to v4 while retaining explicit v3 fixtures. Add cases for valid v4 round-trip, corrupted equipment normalization, corrupt v4 base/inventory fallback to valid v3, and v1/v2 direct migration to v4. An otherwise valid v4 entry with only malformed equipment must remain the source and normalize that equipment instead of discarding the whole entry.

- [ ] **Step 2: Run storage tests and confirm RED**

Run: `node --test tests/quest-state.test.mjs tests/progress-storage.test.mjs`

Expected: FAIL because equipment and v4 keys do not exist.

- [ ] **Step 3: Add equipment to initial progress and cloning**

```js
import { createInitialEquipment } from "./equipment-state.js";

export function createInitialProgress() {
  return {
    level: 1,
    exp: 0,
    nextLevelExp: 100,
    gold: 0,
    inventory: createInitialInventory(),
    equipment: createInitialEquipment(),
    completedQuests: [],
    quests: { [ADVENTURE_QUEST.id]: { status: "available", progress: 0 } },
  };
}
```

`cloneProgress` must clone both `inventory` and `equipment.ownedWeaponIds`.

- [ ] **Step 4: Implement v4 storage and migrations**

Set `STORAGE_VERSION = 4`, `STORAGE_PREFIX = "pixel-world.progress.v4:"`, and add explicit v3 constants. Split validation into base, inventory, and equipment normalization. `toProgress()` must include a cloned normalized equipment object. Load order must be v4 → v3 → v2 → v1, and every legacy success writes v4 without deleting its source.

```js
function migrateV3Progress(value) {
  return {
    ...toBaseAndInventoryProgress(value),
    equipment: createInitialEquipment(),
  };
}

function toBaseAndInventoryProgress(value) {
  return {
    level: value.level,
    exp: value.exp,
    nextLevelExp: value.nextLevelExp,
    gold: value.gold,
    inventory: { hpPotion: value.inventory.hpPotion, mpPotion: value.inventory.mpPotion },
    completedQuests: [...value.completedQuests],
    quests: {
      [ADVENTURE_QUEST.id]: { ...value.quests[ADVENTURE_QUEST.id] },
    },
  };
}

export function v3ProgressStorageKey(nickname) {
  return `${V3_STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}
```

- [ ] **Step 5: Run storage tests and the existing shop/quest regressions**

Run: `node --test tests/quest-state.test.mjs tests/progress-storage.test.mjs tests/shop-state.test.mjs tests/game-progression.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/quest-state.js src/progress-storage.js tests/quest-state.test.mjs tests/progress-storage.test.mjs
git commit -m "장비 상태를 저장 형식 v4로 이전"
```

---

### Task 3: Weapon Combat Profiles and Decimal Damage

**Files:**
- Modify: `src/combat.js`
- Modify: `src/enemies.js`
- Modify: `tests/combat.test.mjs`
- Modify: `tests/enemies.test.mjs`
- Modify: `tests/enemy-rendering.test.mjs`

**Interfaces:**
- Consumes: `resolveWeaponDefinition(weaponId)`
- Changes: `attackDefinition(kind, weaponId = STARTER_WEAPON_ID)`
- Produces: `formatHealthValue(value): string`
- Preserves: all hit-stun, hit-stop, knockback, MP, arc, windup, and duration values

- [ ] **Step 1: Write attack-profile tests**

```js
test("장착 무기는 기본 공격 피해·사거리와 강공격 쿨다운만 바꾼다", () => {
  const basic = attackDefinition("basic", "reinforced-masterwork-katana");
  assert.deepEqual(
    { damage: basic.damage, range: basic.range, cooldown: basic.cooldown, arcDegrees: basic.arcDegrees },
    { damage: 2.5, range: 78, cooldown: 0.5, arcDegrees: 120 },
  );
  const strong = attackDefinition("strong", "reinforced-masterwork-katana");
  assert.deepEqual(
    { damage: strong.damage, range: strong.range, cooldown: strong.cooldown, mpCost: strong.mpCost },
    { damage: 3, range: 96, cooldown: 3.1, mpCost: 20 },
  );
  assert.equal(attackDefinition("basic", "unknown").range, 64);
});
```

- [ ] **Step 2: Write fractional damage and HP label tests**

```js
test("소수 피해는 한 자리로 정규화하고 0 이하에서 처치한다", () => {
  const enemy = createEnemyInstance("fire-slime", { x: 0, y: 0 }, "fraction", { hp: 3 });
  damageEnemy(enemy, 1.3, { x: 1, y: 0 }, 0);
  assert.equal(enemy.hp, 1.7);
  damageEnemy(enemy, 2.2, { x: 1, y: 0 }, 0);
  assert.equal(enemy.hp, 0);
  assert.equal(enemy.state, "dying");
  assert.equal(formatHealthValue(8), "8");
  assert.equal(formatHealthValue(8.7), "8.7");
});
```

Update the rendering fake context assertion so an enemy with `hp: 8.7` draws `8.7 / 10`, while integer HP still draws `8 / 10`.

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `node --test tests/combat.test.mjs tests/enemies.test.mjs tests/enemy-rendering.test.mjs`

Expected: FAIL on weapon-aware profiles and decimal HP formatting.

- [ ] **Step 4: Implement weapon-aware immutable attack profiles**

```js
export function attackDefinition(kind, weaponId = STARTER_WEAPON_ID) {
  const base = ATTACK_DEFINITIONS[kind] || ATTACK_DEFINITIONS.basic;
  const weapon = resolveWeaponDefinition(weaponId);
  if (kind === "strong") return { ...base, cooldown: weapon.strongCooldown };
  return { ...base, damage: weapon.damage, range: weapon.range };
}
```

- [ ] **Step 5: Normalize enemy HP and labels to one decimal**

```js
export function formatHealthValue(value) {
  const rounded = Math.round(Math.max(0, value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

enemy.hp = Math.max(0, Math.round((enemy.hp - damage) * 10) / 10);
```

Use `formatHealthValue(enemy.hp)` and `formatHealthValue(enemy.maxHp)` in `drawEnemyInfo`.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `node --test tests/combat.test.mjs tests/enemies.test.mjs tests/enemy-rendering.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/combat.js src/enemies.js tests/combat.test.mjs tests/enemies.test.mjs tests/enemy-rendering.test.mjs
git commit -m "장착 무기 전투 수치와 소수 피해 적용"
```

---

### Task 4: Weapon Canvas Rendering and Network State

**Files:**
- Create: `src/weapon-rendering.js`
- Create: `tests/weapon-rendering.test.mjs`
- Modify: `src/network-state.js`
- Modify: `tests/network-state.test.mjs`
- Modify: `database.rules.json`
- Modify: `tests/database-rules.test.mjs`

**Interfaces:**
- Consumes: `resolveWeaponDefinition(weaponId)` and each definition's `visual`
- Produces: `drawWeapon(ctx, { direction, attackState, weaponId }): void`
- Changes: `serializePlayerState(player, mapId)` includes normalized `equippedWeaponId`
- Changes: `filterPlayersForMap(...)` normalizes remote `equippedWeaponId`
- Changes: Firebase player validation accepts a missing legacy field or one of the seven known IDs

- [ ] **Step 1: Write renderer tests with a recording Canvas context**

```js
function recordingContext() {
  const calls = [];
  let fillStyle = "";
  return {
    calls,
    ctx: {
      save() { calls.push({ type: "save" }); },
      restore() { calls.push({ type: "restore" }); },
      rotate(angle) { calls.push({ type: "rotate", angle }); },
      fillRect(x, y, width, height) { calls.push({ type: "fillRect", fillStyle, x, y, width, height }); },
      set fillStyle(value) { fillStyle = value; },
      get fillStyle() { return fillStyle; },
    },
  };
}

const maxBladeEnd = calls => Math.max(...calls.filter(call => call.type === "fillRect" && call.x >= 14).map(call => call.x + call.width));
const countFill = (calls, color) => calls.filter(call => call.type === "fillRect" && call.fillStyle === color).length;

test("명검 계열은 카타나보다 길고 금장·붉은 장식이 증가한다", () => {
  const katana = recordingContext();
  const masterwork = recordingContext();
  const reinforced = recordingContext();
  drawWeapon(katana.ctx, { direction: "right", weaponId: "katana" });
  drawWeapon(masterwork.ctx, { direction: "right", weaponId: "masterwork-katana" });
  drawWeapon(reinforced.ctx, { direction: "right", weaponId: "reinforced-masterwork-katana" });
  assert.ok(maxBladeEnd(masterwork.calls) > maxBladeEnd(katana.calls));
  assert.ok(countFill(reinforced.calls, "#d4a72c") > countFill(masterwork.calls, "#d4a72c"));
  assert.ok(countFill(reinforced.calls, "#9f2f32") > 0);
});
```

```js
test("방향과 공격 상태는 회전만 바꾸고 선택 무기의 색상은 유지한다", () => {
  const idle = recordingContext();
  const attacking = recordingContext();
  const fallback = recordingContext();
  drawWeapon(idle.ctx, { direction: "up", weaponId: "katana" });
  drawWeapon(attacking.ctx, {
    direction: "right",
    weaponId: "katana",
    attackState: { kind: "basic", elapsed: 0.09, definition: { duration: 0.18 } },
  });
  drawWeapon(fallback.ctx, { direction: "right", weaponId: "unknown" });
  assert.notEqual(idle.calls.find(call => call.type === "rotate").angle, attacking.calls.find(call => call.type === "rotate").angle);
  for (const color of ["#15191f", "#dceeff", "#4b5563"]) {
    assert.ok(countFill(idle.calls, color) > 0);
    assert.ok(countFill(attacking.calls, color) > 0);
  }
  assert.ok(countFill(fallback.calls, "#6b4b2f") > 0);
});
```

- [ ] **Step 2: Extend network tests**

```js
test("장착 무기 ID는 직렬화되고 잘못된 원격 ID는 시작 검으로 복구된다", () => {
  assert.equal(serializePlayerState({ ...player, equippedWeaponId: "elite-katana" }, "village").equippedWeaponId, "elite-katana");
  const players = filterPlayersForMap({ other: { ...remote, equippedWeaponId: "unknown" } }, "own", "village");
  assert.equal(players.get("other").equippedWeaponId, "starter-sword");
});
```

```js
test("플레이어 규칙은 레거시 장착값 누락을 허용하고 알려진 무기 ID만 검증한다", () => {
  const expression = rules.rules.rooms.$roomId.players.$uid[".validate"];
  assert.match(expression, /!newData\.hasChild\('equippedWeaponId'\)/);
  assert.match(expression, /child\('equippedWeaponId'\)\.isString\(\)/);
  for (const id of WEAPON_ORDER) assert.match(expression, new RegExp(id));
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `node --test tests/weapon-rendering.test.mjs tests/network-state.test.mjs tests/database-rules.test.mjs`

Expected: FAIL because the renderer and network field do not exist.

- [ ] **Step 4: Implement the shared pixel renderer**

`drawWeapon` must rotate from right-facing zero, compute the existing basic/strong swing progress, then draw in this order: wrapped grip, guard, dark spine, silver blade, highlight, gold decorations, red decorations, pommel. Use only Canvas primitives and the visual metadata from `weapon-data.js`.

```js
export function drawWeapon(ctx, { direction = "down", attackState = null, weaponId = STARTER_WEAPON_ID } = {}) {
  const weapon = resolveWeaponDefinition(weaponId);
  const visual = weapon.visual;
  const baseAngle = DIRECTION_ANGLES[direction] ?? 0;
  const progress = attackState ? clamp(attackState.elapsed / attackState.definition.duration, 0, 1) : 0.5;
  const swingSize = attackState?.kind === "strong" ? 2.2 : 1.45;
  const swing = attackState ? -swingSize / 2 + progress * swingSize : 0.55;
  ctx.save();
  ctx.rotate(baseAngle + swing);
  drawGrip(ctx, visual);
  drawBlade(ctx, visual);
  drawDecorations(ctx, visual);
  ctx.restore();
}
```

- [ ] **Step 5: Add normalized weapon IDs to network state**

Use `resolveWeaponDefinition(player.equippedWeaponId).id` during serialization and remote filtering. Preserve every existing field and legacy region behavior.

Update the Firebase player `.validate` expression without requiring the new child from legacy clients:

```text
(!newData.hasChild('equippedWeaponId') || (newData.child('equippedWeaponId').isString() && (newData.child('equippedWeaponId').val() === 'starter-sword' || newData.child('equippedWeaponId').val() === 'katana' || newData.child('equippedWeaponId').val() === 'reinforced-katana' || newData.child('equippedWeaponId').val() === 'superior-katana' || newData.child('equippedWeaponId').val() === 'elite-katana' || newData.child('equippedWeaponId').val() === 'masterwork-katana' || newData.child('equippedWeaponId').val() === 'reinforced-masterwork-katana')))
```

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `node --test tests/weapon-rendering.test.mjs tests/network-state.test.mjs tests/database-rules.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/weapon-rendering.js src/network-state.js database.rules.json tests/weapon-rendering.test.mjs tests/network-state.test.mjs tests/database-rules.test.mjs
git commit -m "무기 픽셀 외형과 네트워크 동기화 추가"
```

---

### Task 5: Brann NPC and Forge World Details

**Files:**
- Modify: `src/npc-data.js`
- Modify: `src/npcs.js`
- Modify: `src/world.js`
- Modify: `tests/npcs.test.mjs`
- Modify: `tests/world-layer-cache.test.mjs`

**Interfaces:**
- Produces NPC: `{ id: "brann", role: "blacksmith", name: "대장장이 브란", mapId: "village", x: 2460, y: 1000, interactionRadius: 80, appearance: { hairColor: "#6b442b", eyeColor: "#4ea5d9", apronColor: "#8a5a3b" } }`
- Preserves: `getNpcsForWorld`, `findNearbyNpc`, `drawNpc`, cached world-layer behavior

- [ ] **Step 1: Write Brann data and rendering tests**

```js
test("브란은 안전한 대장간 위치에 배치되고 미아 역할을 바꾸지 않는다", () => {
  const village = getNpcsForWorld("village");
  assert.deepEqual(village.map(npc => [npc.id, npc.role]), [
    ["aren", "quest"], ["mia", "shop"], ["brann", "blacksmith"],
  ]);
  const brann = village.find(npc => npc.id === "brann");
  assert.deepEqual([brann.x, brann.y, brann.interactionRadius], [2460, 1000, 80]);
  assert.equal(isWorldPositionBlocked("village", brann.x, brann.y, 32), false);
  assert.equal(brann.appearance.hairColor, "#6b442b");
  assert.equal(brann.appearance.eyeColor, "#4ea5d9");
  assert.equal(brann.appearance.apronColor, "#8a5a3b");
});
```

Record `fillStyle` and rectangles in `drawNpc` tests to prove blue eyes and a leather-apron layer are drawn for Brann while Aren/Mia retain generic rendering.

- [ ] **Step 2: Add a world-layer test for forge details**

```js
test("마을 캐시 레이어는 대장간 모루·화로·무기 진열대를 한 번 그린다", () => {
  const { contexts, factory } = recordingLayerFactory();
  const layers = prewarmWorldLayers(factory);
  assert.equal(layers.size, 4);
  const villageCalls = contexts.get("village").calls;
  assert.ok(villageCalls.some(call => call.fillStyle === "#4b5563" && call.width >= 24));
  assert.ok(villageCalls.some(call => ["#f97316", "#dc2626"].includes(call.fillStyle)));
  assert.ok(villageCalls.filter(call => call.fillStyle === "#dceeff").length >= 3);
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `node --test tests/npcs.test.mjs tests/world-layer-cache.test.mjs`

Expected: FAIL because Brann and forge detail calls are missing.

- [ ] **Step 4: Implement Brann and role-aware NPC rendering**

Add Brann after Mia in the village list. In `drawNpc`, branch only on `npc.role === "blacksmith"` to draw brown hair, two blue eye pixels, a brown leather apron, and darker boots. Keep the existing name label and camera positioning.

- [ ] **Step 5: Replace the decorative duplicate blacksmith with forge props**

Remove the static `drawNpc(context, 2440, 1080, "대장장이", "#53677d")` call from `drawVillage`; the live Brann now occupies that role. Add `drawForgeDetails(context, 2460, 890)` that renders an anvil, a contained orange forge, and a three-sword rack inside/around the existing shop block. Because this runs into the cached world layer, do not allocate animation objects or add per-frame work.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `node --test tests/npcs.test.mjs tests/world-layer-cache.test.mjs tests/world.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/npc-data.js src/npcs.js src/world.js tests/npcs.test.mjs tests/world-layer-cache.test.mjs
git commit -m "브란 NPC와 대장간 시설 추가"
```

---

### Task 6: Blacksmith Buy/Sell UI and Game Flow

**Files:**
- Create: `tests/blacksmith-ui.static.test.cjs`
- Create: `tests/game-blacksmith.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main.js`
- Modify: `src/game.js`
- Modify: `tests/game-shop.test.mjs`

**Interfaces:**
- Consumes: `WEAPON_ORDER`, `WEAPONS`, `buyWeapon`, `sellWeapon`
- Produces game methods: `isBlacksmithOpen`, `isSaleConfirmOpen`, `openBlacksmith`, `closeBlacksmith`, `selectBlacksmithTab`, `buyBlacksmithWeapon`, `requestWeaponSale`, `cancelWeaponSale`, `confirmWeaponSale`, `updateBlacksmithHud`
- Changes: `interactionKeyAction` accepts `saleConfirmOpen` and `blacksmithOpen`

- [ ] **Step 1: Write static UI tests**

Assert exact IDs and accessible relationships for:

```js
[
  "blacksmithOverlay", "blacksmithTitle", "blacksmithGoldText", "blacksmithCloseButton",
  "blacksmithBuyTab", "blacksmithSellTab", "blacksmithBuyPanel", "blacksmithSellPanel",
  "weaponSaleConfirmOverlay", "weaponSaleConfirmTitle", "weaponSaleConfirmText",
  "weaponSaleCancelButton", "weaponSaleConfirmButton",
]
```

Assert six `data-buy-weapon` buttons, six `data-sell-weapon` buttons, every approved stat string, locked/owned status hooks, `aria-selected` tabs, blacksmith z-index above HUD but below sale confirmation and QA, and a one-column layout at `max-width: 520px`.

- [ ] **Step 2: Write game-flow RED tests**

Build `blacksmithHarness` with event-capable fake nodes for the IDs above, arrays of buttons carrying exact `dataset.buyWeapon`/`dataset.sellWeapon`, `progress` overrides, a save-spy storage, and a Brann object.

```js
test("F로 브란 대장간을 열고 미아 상점과 역할을 분리한다", () => {
  const { game, elements, brann } = blacksmithHarness();
  game.running = true;
  game.inputEnabled = true;
  game.npcs = [brann];
  game.player.x = brann.x;
  game.player.y = brann.y;
  assert.equal(game.openNpcInteraction(), true);
  assert.equal(elements.blacksmithOverlay.hidden, false);
  assert.equal(elements.shopOverlay.hidden, true);
});

test("구매는 Gold와 보유 목록만 바꾸고 저장은 한 번 수행한다", () => {
  const { game, storage } = blacksmithHarness({ level: 25, gold: 900 });
  assert.equal(game.buyBlacksmithWeapon("masterwork-katana"), true);
  assert.equal(game.progress.gold, 0);
  assert.equal(game.progress.equipment.equippedWeaponId, "starter-sword");
  assert.equal(storage.writes.length, 1);
});

test("판매는 확인 전까지 변경하지 않고 장착 무기 확정 판매 후 시작 검으로 돌아간다", () => {
  const { game, elements, storage } = blacksmithHarness({
    gold: 0,
    equipment: { ownedWeaponIds: ["starter-sword", "elite-katana"], equippedWeaponId: "elite-katana" },
  });
  game.requestWeaponSale("elite-katana");
  assert.equal(game.progress.gold, 0);
  assert.equal(elements.weaponSaleConfirmOverlay.hidden, false);
  game.confirmWeaponSale();
  assert.equal(game.progress.gold, 300);
  assert.equal(game.progress.equipment.equippedWeaponId, "starter-sword");
  assert.equal(storage.writes.length, 1);
});
```

```js
test("레벨·Gold·보유 조건 실패는 저장하지 않는다", () => {
  const locked = blacksmithHarness({ level: 4, gold: 999 });
  const poor = blacksmithHarness({ level: 5, gold: 79 });
  const owned = blacksmithHarness({
    level: 5,
    gold: 999,
    equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "starter-sword" },
  });
  assert.equal(locked.game.buyBlacksmithWeapon("katana"), false);
  assert.equal(poor.game.buyBlacksmithWeapon("katana"), false);
  assert.equal(owned.game.buyBlacksmithWeapon("katana"), false);
  assert.deepEqual([locked.storage.writes.length, poor.storage.writes.length, owned.storage.writes.length], [0, 0, 0]);
});

test("판매 취소와 Escape는 확인창만 닫고 장비를 유지한다", () => {
  const { game, elements, storage } = blacksmithHarness({
    equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "katana" },
  });
  game.requestWeaponSale("katana");
  assert.equal(interactionKeyAction({ code: "Escape", saleConfirmOpen: true, blacksmithOpen: true }), "close-sale-confirm");
  game.cancelWeaponSale();
  assert.equal(elements.weaponSaleConfirmOverlay.hidden, true);
  assert.equal(game.progress.equipment.equippedWeaponId, "katana");
  assert.equal(storage.writes.length, 0);
});

test("판매품은 정가로 재구매되고 떠날 때 대장간 모달이 모두 닫힌다", () => {
  const { game, elements } = blacksmithHarness({
    level: 30,
    gold: 80,
    equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "starter-sword" },
  });
  game.openBlacksmith({ id: "brann", role: "blacksmith" });
  game.selectBlacksmithTab("sell");
  game.requestWeaponSale("katana");
  game.confirmWeaponSale();
  assert.equal(game.progress.gold, 120);
  game.selectBlacksmithTab("buy");
  assert.equal(game.buyBlacksmithWeapon("katana"), true);
  assert.equal(game.progress.gold, 40);
  game.requestWeaponSale("katana");
  game.closeForLeave();
  assert.equal(elements.blacksmithOverlay.hidden, true);
  assert.equal(elements.weaponSaleConfirmOverlay.hidden, true);
});

test("대장간 탭과 확인창은 활성 모달 내부에서 포커스를 순환한다", () => {
  const { game, elements } = blacksmithHarness();
  game.openBlacksmith({ id: "brann", role: "blacksmith" });
  game.selectBlacksmithTab("buy");
  assert.equal(elements.activeElement, elements.buyWeaponButtons.find(button => !button.disabled));
  assert.equal(game.handleModalTab({ shiftKey: false }), "wrapped");
  assert.equal(game.handleModalTab({ shiftKey: true }), "wrapped");
  game.requestWeaponSale("katana");
  assert.equal(elements.activeElement, elements.weaponSaleCancelButton);
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `node --test tests/blacksmith-ui.static.test.cjs tests/game-blacksmith.test.mjs tests/game-shop.test.mjs`

Expected: FAIL because the blacksmith DOM and game methods do not exist.

- [ ] **Step 4: Add blacksmith and sale-confirmation DOM/CSS**

Use a separate `section#blacksmithOverlay` with two tab buttons and two panels. Add six fixed purchase cards and six fixed sale cards keyed by the same weapon IDs; keep the starter sword out of both lists. Each purchase card contains name, level, price, damage, basic range, strong cooldown, status text, and button. Each sale card starts hidden and contains name, sale price, equipped marker, and sale button.

Add `section#weaponSaleConfirmOverlay` as a separate confirmation dialog with cancel and confirm buttons. Use text nodes only; never inject weapon names with `innerHTML`.

- [ ] **Step 5: Map DOM elements in `main.js` and extend global Escape handling**

Add arrays from `[data-buy-weapon]`, `[data-sell-weapon]`, `[data-buy-weapon-card]`, `[data-sell-weapon-card]`, and status elements. Pass `saleConfirmOpen` and `blacksmithOpen` to `interactionKeyAction`. Handle `close-sale-confirm` before `close-blacksmith`. `openExitDialog` and leave cleanup must close both overlays.

- [ ] **Step 6: Implement Brann interaction and blacksmith state methods**

```js
openNpcInteraction() {
  // existing guards
  const npc = findNearbyNpc(this.npcs, this.player);
  if (!npc) return false;
  if (npc.role === "blacksmith") return this.openBlacksmith(npc);
  if (npc.role === "shop") return this.openShop(npc);
  if (npc.role === "quest") return this.openNpcDialogue(npc);
  return false;
}
```

`updateBlacksmithHud` must derive every hidden/disabled/status state from current progress and the catalog. Successful buy/sell actions update progress HUD, blacksmith HUD, inventory HUD, runtime equipped weapon, notification, and persistence exactly once. Failed actions display the approved message without saving.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run: `node --test tests/blacksmith-ui.static.test.cjs tests/game-blacksmith.test.mjs tests/game-shop.test.mjs tests/shop-ui.static.test.cjs`

Expected: all tests PASS and Mia regressions remain green.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css src/main.js src/game.js tests/blacksmith-ui.static.test.cjs tests/game-blacksmith.test.mjs tests/game-shop.test.mjs
git commit -m "브란 대장간 구매와 판매 화면 구현"
```

---

### Task 7: Inventory Equipping and Runtime Combat/Visual Integration

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main.js`
- Modify: `src/game.js`
- Modify: `tests/inventory-ui.static.test.cjs`
- Modify: `tests/game-blacksmith.test.mjs`
- Modify: `tests/game-enemy-events.test.mjs`
- Modify: `tests/network-state.test.mjs`

**Interfaces:**
- Consumes: `equipWeapon`, `attackDefinition(kind, weaponId)`, `drawWeapon(...)`
- Produces game methods: `equipInventoryWeapon`, `syncEquippedWeapon`, updated `updateInventoryHud`
- Runtime player field: `player.equippedWeaponId`

- [ ] **Step 1: Write inventory and runtime RED tests**

```js
test("보유 장비를 인벤토리에서 직접 장착하면 외형 ID와 저장이 즉시 바뀐다", () => {
  const { game, storage } = blacksmithHarness({
    equipment: { ownedWeaponIds: ["starter-sword", "reinforced-katana"], equippedWeaponId: "starter-sword" },
  });
  game.ui.inventoryOverlay.hidden = false;
  assert.equal(game.equipInventoryWeapon("reinforced-katana"), true);
  assert.equal(game.progress.equipment.equippedWeaponId, "reinforced-katana");
  assert.equal(game.player.equippedWeaponId, "reinforced-katana");
  assert.equal(storage.writes.length, 1);
});

test("공격 생성 시 장착 무기 수치를 스냅샷하고 이후 장착 변경에 흔들리지 않는다", () => {
  game.player.equippedWeaponId = "reinforced-katana";
  game.tryAttack("basic");
  assert.equal(game.attackState.definition.damage, 1.3);
  assert.equal(game.attackState.definition.range, 76);
  game.player.equippedWeaponId = "starter-sword";
  assert.equal(game.attackState.definition.damage, 1.3);
});

test("장착 실패·강공격·외형·판매 초기화가 같은 무기 ID를 사용한다", () => {
  const { game, storage, drawCalls } = blacksmithHarness({
    equipment: {
      ownedWeaponIds: ["starter-sword", "reinforced-katana"],
      equippedWeaponId: "reinforced-katana",
    },
  });
  game.ui.inventoryOverlay.hidden = false;
  assert.equal(game.equipInventoryWeapon("masterwork-katana"), false);
  assert.equal(game.equipInventoryWeapon("reinforced-katana"), false);
  assert.equal(storage.writes.length, 0);
  game.tryAttack("strong");
  assert.equal(game.attackState.definition.cooldown, 3.8);
  game.drawPlayer(game.player);
  assert.equal(drawCalls.at(-1).weaponId, "reinforced-katana");
  game.drawRemotePlayer({ equippedWeaponId: "masterwork-katana" });
  assert.equal(drawCalls.at(-1).weaponId, "masterwork-katana");
  game.requestWeaponSale("reinforced-katana");
  game.confirmWeaponSale();
  assert.equal(game.player.equippedWeaponId, "starter-sword");
});

test("인벤토리 포커스는 보이고 활성화된 장비 버튼과 닫기 버튼만 순환한다", () => {
  const { game, elements } = blacksmithHarness({
    equipment: { ownedWeaponIds: ["starter-sword", "katana"], equippedWeaponId: "starter-sword" },
  });
  game.openInventory();
  const focusable = game.getInventoryFocusableElements();
  assert.deepEqual(focusable, [elements.equipWeaponButtons[1], elements.inventoryCloseButton]);
  assert.equal(game.handleModalTab({ shiftKey: false }), "wrapped");
  assert.equal(game.handleModalTab({ shiftKey: true }), "wrapped");
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test tests/inventory-ui.static.test.cjs tests/game-blacksmith.test.mjs tests/game-enemy-events.test.mjs tests/network-state.test.mjs`

Expected: FAIL because equipment cards and runtime integration are missing.

- [ ] **Step 3: Add the inventory equipment section**

Keep the existing potion cards under a `물약` heading. Add seven fixed equipment cards keyed with `data-inventory-weapon`; only the starter starts visible. Each card shows name and main stats and has a `data-equip-weapon` button. `updateInventoryHud` hides unowned cards, toggles `장착`/`장착 중`, disables the equipped button, and includes visible equip buttons in focus trapping.

- [ ] **Step 4: Implement manual equip and runtime synchronization**

```js
syncEquippedWeapon() {
  const equipped = resolveWeaponDefinition(this.progress.equipment.equippedWeaponId);
  this.progress.equipment.equippedWeaponId = equipped.id;
  this.player.equippedWeaponId = equipped.id;
  return equipped;
}

equipInventoryWeapon(weaponId) {
  if (!this.isInventoryOpen()) return false;
  const result = equipWeapon(this.progress, weaponId);
  if (!result.ok) return false;
  this.progress = result.progress;
  const weapon = this.syncEquippedWeapon();
  this.updateInventoryHud();
  this.notify(`${weapon.name}을 장착했습니다.`);
  this.persistProgress("장착했지만 진행 상황을 저장할 수 없습니다.");
  return true;
}
```

Call `syncEquippedWeapon` after loading progress and after successful sale. Do not publish separately with an unthrottled Firebase write; the existing fixed update loop publishes the updated player field on its next allowed network interval.

- [ ] **Step 5: Connect combat and drawing**

Change `tryAttack` to `attackDefinition(kind, this.player.equippedWeaponId)`. Replace the local `drawSword` call with `drawWeapon(ctx, { direction: player.dir, attackState, weaponId: player.equippedWeaponId })` and remove the old private `drawSword`. Pass the same field through remote-player mapping. Attack effect arcs already read the snapshot range and must remain unchanged.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `node --test tests/inventory-ui.static.test.cjs tests/game-blacksmith.test.mjs tests/game-enemy-events.test.mjs tests/network-state.test.mjs tests/weapon-rendering.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css src/main.js src/game.js tests/inventory-ui.static.test.cjs tests/game-blacksmith.test.mjs tests/game-enemy-events.test.mjs tests/network-state.test.mjs
git commit -m "인벤토리 장착과 전투 외형을 연결"
```

---

### Task 8: QA Preparation, Full Regression, and Browser Verification

**Files:**
- Modify: `src/qa-mode.js`
- Modify: `src/game.js`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/qa-mode.test.mjs`
- Modify: `tests/game-qa.test.mjs`
- Modify: `tests/qa-ui.static.test.cjs`

**Interfaces:**
- Produces: `prepareWeaponQaProgress(progress): progress`
- Produces game method: `qaPrepareWeaponShop(): boolean`
- QA target: level `30`, exp `0`, nextLevelExp `3000`, Gold at least `5000`

- [ ] **Step 1: Write QA state and UI tests**

```js
test("장비 QA 준비는 기존 퀘스트·물약·장비를 보존하고 Lv.30과 충분한 Gold를 설정한다", () => {
  const source = { ...createInitialProgress(), inventory: { hpPotion: 2, mpPotion: 3 } };
  const prepared = prepareWeaponQaProgress(source);
  assert.equal(prepared.level, 30);
  assert.equal(prepared.exp, 0);
  assert.equal(prepared.nextLevelExp, 3000);
  assert.equal(prepared.gold, 5000);
  assert.deepEqual(prepared.inventory, source.inventory);
  assert.deepEqual(prepared.equipment, source.equipment);
  assert.deepEqual(source, createInitialProgress());
});
```

Assert a `data-qa-weapons` button exists only inside the already hidden QA overlay, is mapped in `main.js`, participates in QA focus trapping, saves once, refreshes max HP/MP and all relevant HUDs, closes the QA panel, and does nothing outside QA mode.

- [ ] **Step 2: Run QA tests and confirm RED**

Run: `node --test tests/qa-mode.test.mjs tests/game-qa.test.mjs tests/qa-ui.static.test.cjs`

Expected: FAIL because the preparation action is missing.

- [ ] **Step 3: Implement pure QA preparation and game integration**

```js
export function prepareWeaponQaProgress(progress) {
  return {
    ...progress,
    inventory: { ...progress.inventory },
    equipment: {
      ...progress.equipment,
      ownedWeaponIds: [...progress.equipment.ownedWeaponIds],
    },
    completedQuests: [...progress.completedQuests],
    quests: Object.fromEntries(
      Object.entries(progress.quests).map(([questId, quest]) => [questId, { ...quest }]),
    ),
    level: 30,
    exp: 0,
    nextLevelExp: nextLevelExp(30),
    gold: Math.max(progress.gold, 5000),
  };
}
```

The explicit quest clone avoids relying on `structuredClone`, so current browser support and test fakes remain unchanged. `qaPrepareWeaponShop` applies progression stats, refreshes progress/inventory/blacksmith/HUD, saves once, closes QA, and announces `장비 점검 준비 완료 · Lv.30 · 5000 G`.

- [ ] **Step 4: Run QA tests and confirm GREEN**

Run: `node --test tests/qa-mode.test.mjs tests/game-qa.test.mjs tests/qa-ui.static.test.cjs`

Expected: all tests PASS.

- [ ] **Step 5: Run the entire automated suite and syntax checks**

Run:

```bash
node --test tests/*.test.mjs tests/*.static.test.cjs
for source_file in src/*.js; do node --check "$source_file"; done
git diff --check
```

Expected: all tests PASS, every source parses, and `git diff --check` prints nothing.

- [ ] **Step 6: Perform local browser smoke verification**

Serve the exact worktree with `python3 -m http.server 4173`. Open `http://127.0.0.1:4173/?qa=1` and verify:

1. QA preparation produces Lv.30 and at least 5000G.
2. Brann, anvil, forge, and weapon rack are visible in the village.
3. Brann opens the blacksmith; Mia still opens potions.
4. All six weapons can be bought independently and none auto-equips.
5. Inventory equip changes the held weapon and the listed combat stats.
6. Basic damage/range and strong cooldown match the approved table.
7. Sale cancel changes nothing; confirmed sale grants 50%; selling equipped resets to starter.
8. Sold weapons can be rebought at full price.
9. Reload restores equipment.
10. Two browser sessions show each other's equipped weapon appearance.
11. Desktop and 520px mobile layouts remain operable with no game-code console errors.

If the cloud browser cannot reach localhost, record that environmental limitation and defer only the browser portion to the deployed PR; do not weaken automated completion criteria.

- [ ] **Step 7: Commit**

```bash
git add src/qa-mode.js src/game.js src/main.js index.html styles.css tests/qa-mode.test.mjs tests/game-qa.test.mjs tests/qa-ui.static.test.cjs
git commit -m "무기 상점 QA 준비와 통합 검증 추가"
```

- [ ] **Step 8: Final branch verification**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
node --test tests/*.test.mjs tests/*.static.test.cjs
for source_file in src/*.js; do node --check "$source_file"; done
git diff --check origin/main...HEAD
```

Expected: clean worktree, design plus eight implementation commits ahead of `origin/main`, all tests passing, all JavaScript parsing, and no whitespace errors.
