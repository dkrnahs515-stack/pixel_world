# 검사·궁수·마법사 및 21종 무기 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 입장할 때마다 검사·궁수·마법사 중 하나를 선택하고, 공통 진행도는 유지하면서 직업별 능력치·공격·Q 스킬과 직업별 7단계 무기 보유·장착 상태를 독립적으로 플레이할 수 있게 한다.

**Architecture:** 직업·무기·장비·투사체 규칙은 DOM과 게임 루프에서 분리한 순수 모듈로 구현한다. `PixelRPG`는 선택된 `classId`를 세션 상태로 소유하고 입력, 전투 결과, 저장, 렌더링, Firebase 동기화를 조정한다. 저장 데이터는 v5의 `equipmentByClass`로 이전하고, 입장 화면의 마지막 직업 선택은 진행 저장과 분리된 브라우저 선호값으로 관리한다.

**Tech Stack:** 정적 HTML/CSS, Canvas 2D, 네이티브 ES modules, Firebase Realtime Database, Node.js 24 내장 테스트 러너(`node:test`), GitHub Actions, GitHub Pages, Firebase Hosting

**Spec:** `docs/superpowers/specs/2026-08-28-class-system-21-weapons-design.md`

## Global Constraints

- 기능 구현은 각 작업의 실패 테스트가 요구사항 때문에 실패하는 것을 확인한 뒤 시작한다.
- 기존 검사 7종 무기의 ID, 가격, 성능, 외형 및 v4 보유 기록을 그대로 유지한다.
- `level`, `exp`, `nextLevelExp`, `gold`, `inventory`, `completedQuests`, `quests`는 직업 공용이다.
- `classId`는 로그인 세션 입력이며 진행 저장에 고정하지 않는다. 장비만 `equipmentByClass` 아래에서 직업별로 보존한다.
- 게임 실행 중 직업 변경, PvP, 원격 투사체 피해, 상태이상·소환·방어구는 추가하지 않는다.
- 알 수 없는 런타임 직업은 `warrior`, 알 수 없거나 직업이 맞지 않는 무기는 그 직업의 기본 무기로 정규화한다. 입장 UI에서는 유효하지 않은 직업 선택을 허용하지 않는다.
- 포탈 전환, 월드 변경, 사망, 부활, 퇴장 시 로컬 투사체를 모두 제거한다.
- 네트워크에서 받은 공격은 시각화하지 않고 `classId`와 `equippedWeaponId`만 원격 외형에 사용한다.
- 엔트리 또는 핵심 모듈 파일을 바꾸면 Firebase의 기존 캐시와 HTML/모듈 불일치를 막기 위해 실제 버전 파일명을 함께 갱신하고 정적 테스트로 연결 경로를 검증한다.
- 각 작업 완료 시 해당 대상 테스트와 전체 테스트를 모두 통과시킨 뒤 작은 커밋을 만든다.

---

## Task 1: 직업 정의와 직업별 성장 능력치 추가

**Files:**

- Create: `src/class-data.js`
- Create: `tests/class-data.test.mjs`
- Modify: `src/player-progression.js`
- Modify: `tests/player-progression.test.mjs`

- [ ] **Step 1: 허용 직업, 기본 직업, 정규화, 직업별 Lv.1/Lv.30 능력치를 고정하는 실패 테스트 작성**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASS_IDS,
  DEFAULT_CLASS_ID,
  getClassDefinition,
  normalizeClassId,
} from "../src/class-data.js";

test("세 직업 ID와 기본 직업을 고정한다", () => {
  assert.deepEqual(CLASS_IDS, ["warrior", "archer", "mage"]);
  assert.equal(DEFAULT_CLASS_ID, "warrior");
  assert.equal(normalizeClassId("archer"), "archer");
  assert.equal(normalizeClassId("unknown"), "warrior");
});

test("궁수 정의는 승인된 전투 수치를 가진다", () => {
  assert.deepEqual(getClassDefinition("archer").stats, {
    baseMaxHp: 100,
    maxHpPerLevel: 10,
    baseMaxMp: 100,
    maxMpPerLevel: 5,
    moveSpeed: 265,
  });
});
```

`tests/player-progression.test.mjs`에는 다음 기대값을 추가한다.

```js
assert.deepEqual(statsForLevel(1, "warrior"), { maxHp: 120, maxMp: 80 });
assert.deepEqual(statsForLevel(30, "archer"), { maxHp: 390, maxMp: 245 });
assert.deepEqual(statsForLevel(30, "mage"), { maxHp: 312, maxMp: 343 });
assert.deepEqual(statsForLevel(1, "invalid"), { maxHp: 120, maxMp: 80 });
```

- [ ] **Step 2: 대상 테스트를 실행해 모듈 부재 또는 기존 공통 능력치 때문에 실패하는지 확인**

Run: `node --test tests/class-data.test.mjs tests/player-progression.test.mjs`

Expected: FAIL — `src/class-data.js`가 없거나 `statsForLevel`이 `classId`를 반영하지 않는다.

- [ ] **Step 3: 직업 데이터를 불변 객체로 구현**

`src/class-data.js`의 공개 API를 다음으로 고정한다.

```js
export const CLASS_IDS = Object.freeze(["warrior", "archer", "mage"]);
export const DEFAULT_CLASS_ID = "warrior";
export const CLASSES = Object.freeze({
  warrior: Object.freeze({
    id: "warrior", name: "검사", role: "근접 전투",
    basicLabel: "전방 검격", strongLabel: "회전 베기",
    starterWeaponId: "starter-sword",
    stats: Object.freeze({ baseMaxHp: 120, maxHpPerLevel: 12, baseMaxMp: 80, maxMpPerLevel: 4, moveSpeed: 230 }),
  }),
  archer: Object.freeze({
    id: "archer", name: "궁수", role: "원거리 전투",
    basicLabel: "화살", strongLabel: "관통 화살",
    starterWeaponId: "training-bow",
    stats: Object.freeze({ baseMaxHp: 100, maxHpPerLevel: 10, baseMaxMp: 100, maxMpPerLevel: 5, moveSpeed: 265 }),
  }),
  mage: Object.freeze({
    id: "mage", name: "마법사", role: "범위 마법",
    basicLabel: "마법탄", strongLabel: "폭발 마법탄",
    starterWeaponId: "training-staff",
    stats: Object.freeze({ baseMaxHp: 80, maxHpPerLevel: 8, baseMaxMp: 140, maxMpPerLevel: 7, moveSpeed: 245 }),
  }),
});

export function getClassDefinition(id) {
  return typeof id === "string" && Object.hasOwn(CLASSES, id) ? CLASSES[id] : null;
}

export function normalizeClassId(id) {
  return getClassDefinition(id)?.id || DEFAULT_CLASS_ID;
}
```

`statsForLevel(level, classId = DEFAULT_CLASS_ID)`은 정규화된 직업의 `stats`를 사용한다. 기존 `PROGRESSION_RULES` 참조는 제거하거나 직업 데이터로 대체한다.

- [ ] **Step 4: 대상 테스트와 전체 회귀 테스트 실행**

Run: `node --test tests/class-data.test.mjs tests/player-progression.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/class-data.js src/player-progression.js tests/class-data.test.mjs tests/player-progression.test.mjs
git commit -m "feat: 세 직업 능력치 정의 추가"
```

---

## Task 2: 무기 데이터를 세 직업 21종으로 확장

**Files:**

- Modify: `src/weapon-data.js`
- Modify: `tests/weapon-data.test.mjs`

- [ ] **Step 1: 직업별 7종 목록, 기본 무기, 전투 수치, 직업 불일치 정규화 실패 테스트 작성**

```js
assert.deepEqual(STARTER_WEAPON_IDS, {
  warrior: "starter-sword",
  archer: "training-bow",
  mage: "training-staff",
});
assert.equal(getWeaponsForClass("warrior").length, 7);
assert.equal(getWeaponsForClass("archer").length, 7);
assert.equal(getWeaponsForClass("mage").length, 7);
assert.equal(Object.keys(WEAPONS).length, 21);
assert.equal(resolveWeaponDefinition("katana", "archer").id, "training-bow");
assert.equal(resolveWeaponDefinition("missing", "mage").id, "training-staff");
```

각 계열은 요구 레벨 `[1,5,10,15,20,25,30]`, 가격 `[null,80,180,350,600,900,1300]`, 판매가 `[null,40,90,175,300,450,650]`를 공유한다고 검증한다. 활과 지팡이는 설계 문서의 모든 피해·사거리·투사체 속도·폭발 반경·Q 재사용시간을 표 기반 반복 테스트로 고정한다.

테스트와 구현이 공유하지 않는 독립 기대값은 다음 레코드로 작성한다.

```js
const bowExpectations = [
  ["training-bow", 0.9, 360, 560, 4.5],
  ["hunter-bow", 1, 380, 580, 4.5],
  ["reinforced-longbow", 1.2, 400, 600, 4.3],
  ["precision-longbow", 1.45, 420, 620, 4],
  ["elite-war-bow", 1.8, 440, 650, 3.8],
  ["masterwork-bow", 2.1, 460, 680, 3.6],
  ["reinforced-masterwork-bow", 2.4, 480, 720, 3.4],
];
const staffExpectations = [
  ["training-staff", 1, 300, 420, 96, 5],
  ["apprentice-staff", 1.1, 315, 440, 100, 5],
  ["reinforced-wand", 1.35, 330, 460, 108, 4.7],
  ["superior-wand", 1.6, 345, 480, 116, 4.4],
  ["elite-sage-staff", 1.95, 360, 500, 124, 4.1],
  ["archmage-staff", 2.25, 375, 520, 134, 3.8],
  ["reinforced-archmage-staff", 2.6, 390, 550, 144, 3.6],
];
```

- [ ] **Step 2: 현재 7종 전용 구현에서 실패 확인**

Run: `node --test tests/weapon-data.test.mjs`

Expected: FAIL — 직업별 API와 14개 신규 무기가 없다.

- [ ] **Step 3: 21종 데이터와 직업별 조회 API 구현**

기존 검 7종 정의에는 `classId: "warrior"`, `weaponType: "sword"`, `tier`를 추가한다. 활·지팡이는 승인 수치를 그대로 넣고 외형 데이터는 Task 9가 소비할 수 있는 색상·길이·폭 필드를 제공한다.

```js
export const STARTER_WEAPON_IDS = Object.freeze({
  warrior: "starter-sword",
  archer: "training-bow",
  mage: "training-staff",
});
export const STARTER_WEAPON_ID = STARTER_WEAPON_IDS.warrior;

export const WEAPON_ORDER_BY_CLASS = Object.freeze({
  warrior: Object.freeze(["starter-sword", "katana", "reinforced-katana", "superior-katana", "elite-katana", "masterwork-katana", "reinforced-masterwork-katana"]),
  archer: Object.freeze(["training-bow", "hunter-bow", "reinforced-longbow", "precision-longbow", "elite-war-bow", "masterwork-bow", "reinforced-masterwork-bow"]),
  mage: Object.freeze(["training-staff", "apprentice-staff", "reinforced-wand", "superior-wand", "elite-sage-staff", "archmage-staff", "reinforced-archmage-staff"]),
});

export function getStarterWeaponId(classId) {
  return STARTER_WEAPON_IDS[normalizeClassId(classId)];
}

export function getWeaponsForClass(classId) {
  return WEAPON_ORDER_BY_CLASS[normalizeClassId(classId)].map(id => WEAPONS[id]);
}

export function resolveWeaponDefinition(id, classId = DEFAULT_CLASS_ID) {
  const weapon = getWeaponDefinition(id);
  return weapon?.classId === normalizeClassId(classId)
    ? weapon
    : WEAPONS[getStarterWeaponId(classId)];
}
```

`WEAPON_ORDER`는 당장 기존 호출부 호환이 필요하면 검사 목록의 별칭으로 유지하되 Task 3에서 모두 `WEAPON_ORDER_BY_CLASS`로 이전한 후 제거 가능 여부를 테스트로 판단한다.

- [ ] **Step 4: 데이터 테스트와 전체 회귀 테스트 실행**

Run: `node --test tests/weapon-data.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/weapon-data.js tests/weapon-data.test.mjs
git commit -m "feat: 직업별 21종 무기 데이터 추가"
```

---

## Task 3: 장비와 거래 상태를 직업별로 분리

**Files:**

- Modify: `src/equipment-state.js`
- Modify: `tests/equipment-state.test.mjs`

- [ ] **Step 1: 세 직업 기본 장비와 직업 격리 거래 실패 테스트 작성**

```js
const initial = createInitialEquipmentByClass();
assert.deepEqual(initial.warrior, {
  ownedWeaponIds: ["starter-sword"], equippedWeaponId: "starter-sword",
});
assert.deepEqual(initial.archer, {
  ownedWeaponIds: ["training-bow"], equippedWeaponId: "training-bow",
});
assert.deepEqual(initial.mage, {
  ownedWeaponIds: ["training-staff"], equippedWeaponId: "training-staff",
});

const bought = buyWeapon({ ...progress, equipmentByClass: initial }, "archer", "hunter-bow");
assert.equal(bought.ok, true);
assert.deepEqual(bought.progress.equipmentByClass.warrior, initial.warrior);
assert.deepEqual(bought.progress.equipmentByClass.archer.ownedWeaponIds, ["training-bow", "hunter-bow"]);

assert.equal(buyWeapon(progress, "archer", "katana").reason, "class_mismatch");
assert.equal(equipWeapon(progress, "mage", "hunter-bow").reason, "class_mismatch");
```

판매 테스트는 장착하지 않은 유료 무기를 판매하면 현재 장착 무기가 유지되고, 장착 중인 무기를 판매할 때만 그 직업 기본 무기로 돌아가는 것을 검증한다.

- [ ] **Step 2: 기존 단일 `equipment` 구현에서 실패 확인**

Run: `node --test tests/equipment-state.test.mjs`

Expected: FAIL — `equipmentByClass` 및 `classId` 인수가 없다.

- [ ] **Step 3: 직업별 장비 정규화와 거래 API 구현**

공개 API를 다음으로 바꾼다.

```js
createInitialClassEquipment(classId)
createInitialEquipmentByClass()
normalizeClassEquipment(classId, value)
normalizeEquipmentByClass(value)
getClassEquipment(progress, classId)
buyWeapon(progress, classId, weaponId)
sellWeapon(progress, classId, weaponId)
equipWeapon(progress, classId, weaponId)
```

`normalizeClassEquipment`은 해당 직업 무기만 허용하고 기본 무기를 항상 첫 항목으로 넣는다. 성공 결과는 공통 진행 객체를 얕게 복제하고 수정 대상 직업 장비만 새 객체로 교체한다.

```js
const equipmentByClass = normalizeEquipmentByClass(progress.equipmentByClass);
return success(progress, weapon, {
  equipmentByClass: {
    ...equipmentByClass,
    [classId]: nextClassEquipment,
  },
});
```

이 작업에서는 아직 기존 게임과 v4 저장이 단일 `equipment`를 사용하므로 `createInitialEquipment()`와 `normalizeEquipment()`를 검사 장비 호환 래퍼로 유지한다. 기존 2인수 거래 호출도 검사 단일 장비 결과를 반환하는 호환 경로로 유지하고, Task 4에서 게임·퀘스트·저장을 동시에 v5 구조로 전환한 뒤 호환 거래 경로를 제거한다. 새 3인수 호출과 기존 2인수 호출을 각각 테스트해 중간 커밋에서도 전체 회귀가 통과하게 한다.

- [ ] **Step 4: 대상 및 전체 테스트 실행**

Run: `node --test tests/equipment-state.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS — 검사 호환 래퍼 때문에 기존 게임 통합 테스트도 유지된다.

- [ ] **Step 5: 커밋**

```bash
git add src/equipment-state.js tests/equipment-state.test.mjs
git commit -m "refactor: 장비 상태를 직업별로 분리"
```

---

## Task 4: 진행 저장 v5와 v4 무손실 마이그레이션 구현

**Files:**

- Modify: `src/progress-storage.js`
- Modify: `src/quest-state.js`
- Modify: `src/qa-mode.js`
- Modify: `src/game-20260827-2.js`
- Modify: `tests/progress-storage.test.mjs`
- Modify: `tests/quest-state.test.mjs`
- Modify: `tests/qa-mode.test.mjs`
- Modify: `tests/game-blacksmith.test.mjs`
- Modify: `tests/game-qa.test.mjs`

- [ ] **Step 1: v5 저장, v4 이전, 부분 손상 복구 실패 테스트 작성**

필수 테스트 사례:

```js
assert.equal(progressStorageKey("용사"), "pixel-world.progress.v5:%EC%9A%A9%EC%82%AC");
assert.equal(v4ProgressStorageKey("용사"), "pixel-world.progress.v4:%EC%9A%A9%EC%82%AC");
```

- 유효한 v4의 `equipment`가 v5 `equipmentByClass.warrior`로 그대로 이전된다.
- 궁수·마법사는 각각 `training-bow`, `training-staff`만 보유·장착한다.
- 레벨·EXP·Gold·물약·퀘스트·완료 퀘스트는 바이트 단위 의미가 유지된다.
- v5의 궁수 장비만 손상되면 공통 진행과 검사·마법사 장비는 유지되고 궁수만 기본 상태로 복구된다.
- v5 공통 필드가 잘못되면 전체 초기 진행으로 복구된다.
- v5 저장 쓰기가 실패해도 메모리에서 이전된 v4 진행을 반환하고 v4 키를 삭제하지 않는다.
- 기존 v3/v2/v1 마이그레이션도 최종적으로 v5 구조를 만든다.

- [ ] **Step 2: 기존 v4 저장 구현에서 실패 확인**

Run: `node --test tests/progress-storage.test.mjs`

Expected: FAIL — 저장 키가 v4이고 `equipmentByClass`를 모른다.

- [ ] **Step 3: 저장 버전과 마이그레이션 구현**

```js
const STORAGE_VERSION = 5;
const STORAGE_PREFIX = "pixel-world.progress.v5:";
const V4_STORAGE_PREFIX = "pixel-world.progress.v4:";
const V4_STORAGE_VERSION = 4;

export function v4ProgressStorageKey(nickname) {
  return `${V4_STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}
```

`isValidProgress`는 공통 진행과 인벤토리만 엄격히 검증한다. 직업별 장비는 `normalizeEquipmentByClass`에 맡겨 일부 손상이 전체 진행을 폐기하지 않게 한다. `toProgress`는 모든 직업의 배열을 새로 복제한다.

```js
function migrateV4Progress(value) {
  return {
    ...toBaseAndInventoryProgress(value),
    equipmentByClass: {
      ...createInitialEquipmentByClass(),
      warrior: normalizeClassEquipment("warrior", value.equipment),
    },
  };
}
```

검색 순서는 v5 → v4 → v3 → v2 → v1을 유지하고 이전 소스 키는 삭제하지 않는다.

`createInitialProgress()`와 퀘스트 복제 함수는 `equipment` 대신 `equipmentByClass`를 생성·깊은 복제한다. 퀘스트 수락·처치·완료가 세 직업의 장비 객체를 잃거나 공유 참조로 오염하지 않는 테스트를 추가한다. `prepareWeaponQaProgress`도 세 직업 장비를 깊은 복제한다.

게임 런타임은 아직 로그인에서 직업을 받기 전이므로 `this.classId = DEFAULT_CLASS_ID`를 기본값으로 두고 모든 장비 읽기·구매·판매·장착에 그 값을 전달한다. 이 단계에서 검사 동작은 이전과 같지만 내부 진행 구조는 완전히 v5가 된다. `tests/game-blacksmith.test.mjs`와 `tests/game-qa.test.mjs`의 픽스처와 단언을 `equipmentByClass.warrior`로 전환한다. Task 3의 기존 2인수 거래 호환 경로는 이 연결이 끝난 후 제거하고, 더 이상 사용처가 없음을 `rg`로 확인한다.

- [ ] **Step 4: 저장 테스트와 전체 회귀 테스트 실행**

Run: `node --test tests/progress-storage.test.mjs tests/quest-state.test.mjs tests/qa-mode.test.mjs tests/game-blacksmith.test.mjs tests/game-qa.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/progress-storage.js src/quest-state.js src/qa-mode.js src/game-20260827-2.js tests/progress-storage.test.mjs tests/quest-state.test.mjs tests/qa-mode.test.mjs tests/game-blacksmith.test.mjs tests/game-qa.test.mjs
git commit -m "feat: 직업별 장비 저장 v5 마이그레이션 추가"
```

---

## Task 5: 직업별 공격 정의와 순수 투사체 시뮬레이션 구현

**Files:**

- Modify: `src/combat.js`
- Create: `src/projectile-combat.js`
- Modify: `tests/combat.test.mjs`
- Create: `tests/projectile-combat.test.mjs`

- [ ] **Step 1: 검사·궁수·마법사 공격 정의 실패 테스트 작성**

```js
const archerBasic = attackDefinition("basic", "archer", "hunter-bow");
assert.deepEqual({
  delivery: archerBasic.delivery,
  projectileKind: archerBasic.projectileKind,
  cooldown: archerBasic.cooldown,
  damage: archerBasic.damage,
  range: archerBasic.range,
  speed: archerBasic.speed,
  mpCost: archerBasic.mpCost,
}, {
  delivery: "projectile", projectileKind: "arrow", cooldown: 0.55,
  damage: 1, range: 380, speed: 580, mpCost: 0,
});
const mageStrong = attackDefinition("strong", "mage", "training-staff");
assert.deepEqual({
  delivery: mageStrong.delivery,
  projectileKind: mageStrong.projectileKind,
  damage: mageStrong.damage,
  range: mageStrong.range,
  speed: mageStrong.speed,
  explosionRadius: mageStrong.explosionRadius,
  mpCost: mageStrong.mpCost,
  cooldown: mageStrong.cooldown,
}, {
  delivery: "projectile", projectileKind: "explosive-bolt", damage: 2.4,
  range: 375, speed: 420, explosionRadius: 96, mpCost: 30, cooldown: 5,
});
assert.equal(attackDefinition("strong", "warrior", "starter-sword").arcDegrees, 360);
assert.equal(attackDefinition("strong", "warrior", "starter-sword").range, 92);
```

- [ ] **Step 2: 투사체 이동·충돌·중복 적중·제거 실패 테스트 작성**

```js
const arrow = createProjectile({
  id: "p1", kind: "piercing-arrow", classId: "archer",
  weaponId: "training-bow", x: 0, y: 0, direction: "right",
});
const result = updateProjectiles([arrow], 1, {
  isBlocked: () => false,
  worldBounds: { width: 2000, height: 1000 },
  enemies: Array.from({ length: 6 }, (_, index) => ({
    id: `enemy-${index}`, x: 70 + index * 60, y: 0, radius: 12, hp: 10,
  })),
});
assert.deepEqual(result.hits.map(hit => hit.enemyId), [
  "enemy-0", "enemy-1", "enemy-2", "enemy-3", "enemy-4",
]);
assert.equal(result.projectiles.length, 0);
```

별도 테스트로 다음을 고정한다.

- 기본 화살과 기본 마법탄은 선분과 원의 연속 충돌로 첫 적만 맞히고 제거된다.
- 관통 화살은 같은 적 ID를 한 번만 맞히며 서로 다른 적 최대 5개를 맞힌다.
- 폭발 마법탄은 첫 적·벽·경계·최대 사거리에서 폭발하고 반경 내 각 적을 한 번씩 반환한다.
- 사망 또는 `targetable: false` 적은 무시한다.
- 최대 사거리와 월드 경계를 벗어난 투사체는 제거된다.
- `updateProjectiles`는 적 HP나 진행 데이터를 직접 변경하지 않고 `hits`, `explosions` 결과만 반환한다.

- [ ] **Step 3: 대상 테스트 실패 확인**

Run: `node --test tests/combat.test.mjs tests/projectile-combat.test.mjs`

Expected: FAIL — 직업 공격 분기와 투사체 모듈이 없다.

- [ ] **Step 4: 공격 정의와 순수 투사체 모델 구현**

`attackDefinition` 시그니처를 `attackDefinition(kind, classId, weaponId)`로 바꾼다. 검사 기본 공격은 기존 전방 부채꼴과 히트 효과를 유지하고, 검사 Q는 `damage = weapon.damage * 2`, `range = weapon.range + 28`, `arcDegrees = 360`, `mpCost = 20`, `knockback = 520`을 사용한다. 궁수·마법사 수치는 설계 문서 표와 최종 전투 수치를 그대로 계산한다.

`src/projectile-combat.js` 공개 API:

```js
export function createProjectile({ id, kind, classId, weaponId, x, y, direction })
export function updateProjectiles(projectiles, dt, { isBlocked, worldBounds, enemies })
```

투사체 객체는 `prevX`, `prevY`, `x`, `y`, 정규화 방향, `speed`, `maxRange`, `distanceTravelled`, `damage`, `hitEnemyIds`를 소유한다. `updateProjectiles`는 새 배열과 이벤트를 반환한다.

```js
return {
  projectiles: survivors,
  hits: [{ projectileId, enemyId, damage, knockback, hitStun, hitStop }],
  explosions: [{ projectileId, x, y, radius }],
};
```

- [ ] **Step 5: 대상 및 전체 테스트 실행**

Run: `node --test tests/combat.test.mjs tests/projectile-combat.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/combat.js src/projectile-combat.js tests/combat.test.mjs tests/projectile-combat.test.mjs
git commit -m "feat: 직업별 공격과 투사체 시뮬레이션 추가"
```

---

## Task 6: `PixelRPG`에 직업 세션·공격·생명주기 연결

**Files:**

- Modify: `src/game-20260827-2.js`
- Modify: `src/player-combat.js`
- Modify: `src/config.js`
- Modify: `tests/game-progression.test.mjs`
- Modify: `tests/game-enemy-events.test.mjs`
- Modify: `tests/player-combat.test.mjs`
- Create: `tests/game-class-combat.test.mjs`

- [ ] **Step 1: 입장 직업과 직업별 플레이어 상태 실패 테스트 작성**

게임 테스트 하네스를 사용해 다음을 검증한다.

- `await game.enter("CodexQA", "archer")`가 `player.classId === "archer"`, 이동속도 265, 해당 레벨 궁수 최대 HP·MP, 궁수 마지막 장착 활을 복구한다.
- `enter`에 알 수 없는 런타임 값이 들어오면 검사와 시작 검으로 안전하게 정규화한다.
- 레벨업과 부활은 현재 직업·레벨의 최대 HP/MP로 회복한다.
- 저장은 `classId`를 진행 데이터에 넣지 않고 `equipmentByClass` 전체를 보존한다.

- [ ] **Step 2: 공격 실행과 투사체 생명주기 실패 테스트 작성**

- 검사 Ctrl은 기존 `attackState`와 근접 적중 경로를 사용한다.
- 검사 Q는 MP 20과 무기 Q 쿨다운을 소비하고 360도 적을 한 번씩 맞힌다.
- 궁수 Ctrl/Q와 마법사 Ctrl/Q는 플레이어 충돌 반경 밖 무기 끝에서 올바른 투사체를 한 발 만든다.
- MP 부족 또는 쿨다운 중이면 Q를 만들지 않는다.
- 투사체 이벤트가 기존 적 피해·경직·피해 숫자·처치 보상·퀘스트 처치 기록 경로를 한 번만 호출한다.
- `switchWorld`, 사망 시작, `finishRespawn`, `leave`에서 `projectiles`가 빈 배열이 된다.

- [ ] **Step 3: 현재 게임에서 실패 확인**

Run: `node --test tests/game-class-combat.test.mjs tests/game-progression.test.mjs tests/game-enemy-events.test.mjs tests/player-combat.test.mjs`

Expected: FAIL — `enter`가 `classId`를 받지 않고 투사체 상태가 없다.

- [ ] **Step 4: 세션 직업과 능력치 연결**

`PixelRPG.enter`를 다음 형태로 바꾼다.

```js
async enter(nickname, classId) {
  this.classId = normalizeClassId(classId);
  this.player.classId = this.classId;
  this.progress = loadProgress(localStorage, nickname);
  const { maxHp, maxMp } = statsForLevel(this.progress.level, this.classId);
  Object.assign(this.player, {
    maxHp, maxMp, hp: maxHp, mp: maxMp,
    speed: getClassDefinition(this.classId).stats.moveSpeed,
  });
  this.syncEquippedWeapon();
  // 기존 월드·네트워크 시작 흐름 유지
}
```

`syncEquippedWeapon()`은 `getClassEquipment(this.progress, this.classId)`를 사용한다. 모든 거래·장착 호출에 현재 `classId`를 전달한다.

- [ ] **Step 5: 공격 분기와 이벤트 적용 연결**

`tryAttack(kind)`은 공통 입력 차단·MP·쿨다운 검사를 한 뒤 `definition.delivery`로 분기한다.

```js
if (definition.delivery === "melee") {
  this.attackState = createMeleeAttackState(definition, kind);
} else {
  this.projectiles.push(createProjectile({
    id: this.nextProjectileId(),
    kind: definition.projectileKind,
    classId: this.classId,
    weaponId: this.player.equippedWeaponId,
    x: spawn.x, y: spawn.y, direction: this.player.dir,
  }));
}
```

고정 업데이트에서 `updateProjectiles`를 호출하고 반환된 `hits`를 기존 적 피해 함수에 전달한다. 폭발 이벤트는 렌더링용 짧은 효과 상태로만 추가한다. 검사 기존 히트 스톱·경직·피해 숫자와 처치 보상 동작은 바꾸지 않는다.

`clearProjectiles()`를 만들고 포탈 전환 시작/완료, `switchWorld`, 플레이어 사망, 부활, 퇴장에 호출한다.

- [ ] **Step 6: HUD의 직업별 Q 이름·비용·쿨다운 상태 연결**

`strongSlot` 내부 텍스트를 직업 정의의 `strongLabel`과 MP 비용으로 갱신한다. 비활성 조건의 고정 `20`을 현재 공격 정의의 `mpCost`로 바꾼다. 기존 쿨다운 표시 형식은 유지한다.

- [ ] **Step 7: 대상 및 전체 테스트 실행**

Run: `node --test tests/game-class-combat.test.mjs tests/game-progression.test.mjs tests/game-enemy-events.test.mjs tests/player-combat.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add src/game-20260827-2.js src/player-combat.js src/config.js tests/game-class-combat.test.mjs tests/game-progression.test.mjs tests/game-enemy-events.test.mjs tests/player-combat.test.mjs
git commit -m "feat: 게임 루프에 세 직업 전투 연결"
```

---

## Task 7: 로그인 직업 선택 UI와 브라우저 선호 저장 구현

**Files:**

- Create: `src/class-selection.js`
- Create: `src/class-rendering.js`
- Create: `tests/class-selection.test.mjs`
- Create: `tests/class-rendering.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main-20260827-2.js`
- Create: `tests/entry-ui.static.test.cjs`
- Modify: `tests/browser-smoke.cjs`

- [ ] **Step 1: 마지막 직업 선호와 제출 검증 실패 테스트 작성**

`src/class-selection.js`의 공개 API를 테스트로 먼저 고정한다.

```js
assert.equal(readStoredClassId(storageWith("archer")), "archer");
assert.equal(readStoredClassId(storageWith("unknown")), null);
assert.deepEqual(validateEntrySelection("용사", null), { ok: false, field: "classId" });
assert.deepEqual(validateEntrySelection("용사", "mage"), {
  ok: true, nickname: "용사", classId: "mage",
});
assert.equal(entryButtonLabel("warrior"), "검사로 입장");
```

선호 키는 진행 저장과 분리된 `pixelWorldClassId`로 고정한다. 저장 접근 예외는 선택 없음으로 복구한다.

- [ ] **Step 2: 입장 마크업·접근성·반응형 실패 정적 테스트 작성**

다음을 문자열 존재가 아니라 구조 관계까지 검증한다.

- `role="radiogroup"`인 직업 목록과 검사·궁수·마법사 카드 3개
- 각 카드의 유효한 `data-class-id`, 라디오 역할, `aria-checked`, 키보드 포커스
- 각 카드의 직업명·역할·Ctrl 공격·Q 스킬과 미리보기 캔버스
- 선택 전 입장 버튼 비활성 또는 제출 차단
- 데스크톱 3열, 좁은 화면 1열, 모달 내부 스크롤
- `prefers-reduced-motion`에서 선택 전환 제거
- 엔트리 모듈이 `game.enter(nickname, classId)`를 호출

- [ ] **Step 3: 현재 닉네임 전용 입장에서 실패 확인**

Run: `node --test tests/class-selection.test.mjs tests/class-rendering.test.mjs tests/entry-ui.static.test.cjs`

Expected: FAIL — 직업 카드, 선택 모듈, 직업 미리보기 렌더러가 없다.

- [ ] **Step 4: 순수 선택 모듈과 접근 가능한 카드 UI 구현**

`src/class-selection.js`는 DOM에 의존하지 않고 다음을 내보낸다.

```js
export const CLASS_PREFERENCE_KEY = "pixelWorldClassId";
export function readStoredClassId(storage) { /* 유효한 값 또는 null */ }
export function storeClassId(storage, classId) { /* { ok } */ }
export function validateEntrySelection(nickname, classId) { /* 정규화·오류 */ }
export function entryButtonLabel(classId) { /* 선택 전 '직업을 선택해 주세요' */ }
```

`index.html`에는 닉네임 입력 아래 카드 그룹을 추가한다. 첫 접속에는 선택하지 않고, 유효한 브라우저 선호가 있을 때만 기본 선택한다. 클릭, Tab, 방향키, Space, Enter가 단일 선택 패턴으로 동작하며 선택할 때 `aria-checked`, 선택 클래스, 버튼 문구를 함께 갱신한다.

`src/class-rendering.js`에는 DOM과 게임 상태를 변경하지 않는 `drawClassPreview(ctx, classId)`를 먼저 구현한다. 세 카드의 작은 Canvas는 이 함수로 검사 검 실루엣, 궁수 활·화살통, 마법사 지팡이·발광 코어가 구분되게 그린다. `tests/class-rendering.test.mjs`는 Canvas mock으로 세 직업이 서로 다른 색상·도형 명령을 생성하고 알 수 없는 값은 검사 미리보기로 복구하는지 검증한다. Task 9에서는 같은 모듈을 확장해 게임 월드의 직업별 보조 장비를 그린다.

폼 제출 성공 시에만 `storeClassId`를 호출한 뒤 `await game.enter(nickname, selectedClassId)`를 실행한다. 유효하지 않거나 선택하지 않은 경우 게임을 시작하지 않고 직업 오류를 카드 그룹 근처에 표시한다.

- [ ] **Step 5: 스타일과 브라우저 스모크 흐름 갱신**

기존 입장 모달의 시각 언어를 유지하고 `.class-card-grid`를 데스크톱 3열, 좁은 화면 1열로 만든다. 선택 상태는 색상 외에 테두리와 `선택됨` 텍스트로 구분한다. `tests/browser-smoke.cjs`는 닉네임 입력 후 검사 카드를 선택하고 입장하도록 바꾼다.

- [ ] **Step 6: 대상 및 전체 테스트 실행**

Run: `node --test tests/class-selection.test.mjs tests/class-rendering.test.mjs tests/entry-ui.static.test.cjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/class-selection.js src/class-rendering.js index.html styles.css src/main-20260827-2.js tests/class-selection.test.mjs tests/class-rendering.test.mjs tests/entry-ui.static.test.cjs tests/browser-smoke.cjs
git commit -m "feat: 입장 화면에 세 직업 선택 추가"
```

---

## Task 8: 대장간과 인벤토리를 현재 직업 데이터로 렌더링

**Files:**

- Create: `src/equipment-ui.js`
- Create: `tests/equipment-ui.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main-20260827-2.js`
- Modify: `src/game-20260827-2.js`
- Modify: `tests/blacksmith-ui.static.test.cjs`
- Modify: `tests/inventory-ui.static.test.cjs`
- Modify: `tests/game-blacksmith.test.mjs`

- [ ] **Step 1: 현재 직업 전용 UI 모델 실패 테스트 작성**

```js
const model = equipmentUiModel({
  classId: "archer", level: 30, gold: 5000,
  equipment: { ownedWeaponIds: ["training-bow", "hunter-bow"], equippedWeaponId: "hunter-bow" },
});
assert.equal(model.buyItems.length, 6);
assert.equal(model.sellItems.length, 1);
assert.equal(model.inventoryItems.length, 2);
assert.ok(model.buyItems.every(item => item.weapon.classId === "archer"));
assert.equal(model.inventoryItems.find(item => item.weapon.id === "hunter-bow").equipped, true);
```

검사·궁수·마법사 각각에 대해 다른 직업 무기가 모델에 한 개도 포함되지 않는다고 검증한다. 레벨·Gold·보유 조건의 상태 문구와 버튼 비활성도 기존 대장간 규칙과 일치시킨다.

- [ ] **Step 2: HTML 중복 제거를 요구하는 정적 실패 테스트 작성**

- 구매·판매·인벤토리에 21개 고정 카드를 작성하지 않는다.
- `#blacksmithBuyItems`, `#blacksmithSellItems`, `#inventoryWeaponItems` 컨테이너 또는 한 개의 재사용 템플릿만 둔다.
- 동적으로 생성된 버튼은 `data-buy-weapon`, `data-sell-weapon`, `data-equip-weapon`을 유지한다.

Run: `node --test tests/equipment-ui.test.mjs tests/blacksmith-ui.static.test.cjs tests/inventory-ui.static.test.cjs tests/game-blacksmith.test.mjs`

Expected: FAIL — 현재 HTML은 검 7종 카드를 고정 작성한다.

- [ ] **Step 3: 데이터 기반 UI 모델과 DOM 렌더러 구현**

`src/equipment-ui.js`는 순수 모델과 DOM 렌더를 분리한다.

```js
export function equipmentUiModel({ classId, level, gold, equipment })
export function renderBlacksmithEquipment(elements, model)
export function renderInventoryEquipment(elements, model)
```

`equipmentUiModel`은 현재 직업의 7종만 조회하여 기본 무기를 제외한 6종 구매 항목, 보유 유료 무기 판매 항목, 보유 무기 인벤토리 항목을 만든다. 구매·판매·장착 이벤트는 컨테이너 이벤트 위임으로 `weaponId`를 읽고 `PixelRPG`의 기존 메서드에 전달한다.

`src/main-20260827-2.js`의 초기 정적 NodeList 수집은 컨테이너 참조로 바꾼다. 게임의 UI 갱신 시 현재 `classId`와 `getClassEquipment`를 모델에 전달한다. 구매·판매 성공 후 저장, HUD, 대장간, 인벤토리 갱신은 각각 한 번만 수행한다.

- [ ] **Step 4: 반응형 레이아웃 보존**

기존 대장간 최대 폭 800px, 760px 이하 1열, 520px 이하 미리보기·설명·버튼 세로 배치를 동적 카드에도 동일하게 적용한다. 인벤토리의 기존 데스크톱 2열·모바일 1열을 유지한다.

- [ ] **Step 5: 대상 및 전체 테스트 실행**

Run: `node --test tests/equipment-ui.test.mjs tests/blacksmith-ui.static.test.cjs tests/inventory-ui.static.test.cjs tests/game-blacksmith.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/equipment-ui.js index.html styles.css src/main-20260827-2.js src/game-20260827-2.js tests/equipment-ui.test.mjs tests/blacksmith-ui.static.test.cjs tests/inventory-ui.static.test.cjs tests/game-blacksmith.test.mjs
git commit -m "feat: 대장간과 인벤토리를 직업별로 렌더링"
```

---

## Task 9: 세 직업·21종 무기·투사체 Canvas 외형 구현

**Files:**

- Modify: `src/class-rendering.js`
- Create: `src/projectile-rendering.js`
- Modify: `src/weapon-rendering.js`
- Modify: `src/game-20260827-2.js`
- Modify: `tests/class-rendering.test.mjs`
- Create: `tests/projectile-rendering.test.mjs`
- Modify: `tests/weapon-rendering.test.mjs`
- Modify: `tests/player-weapon-rendering.test.mjs`
- Modify: `tests/canvas-renderer.test.mjs`

- [ ] **Step 1: 렌더링 명령과 계열 분기 실패 테스트 작성**

Canvas mock의 호출 기록으로 다음을 고정한다.

- `drawWeapon`이 `weaponType`에 따라 `drawSword`, `drawBow`, `drawStaff` 중 하나만 호출한다.
- 검사 로컬·원격 캐릭터에는 검과 해당 무기에 칼집 정의가 있을 때 칼집을 그린다.
- 궁수에는 활과 등 뒤 화살통을 그린다.
- 마법사에는 지팡이와 발광 코어를 그린다.
- 기본 화살, 관통 화살, 기본 마법탄, 폭발 마법탄은 서로 구별되는 색·형태를 그린다.
- 폭발 효과는 승인된 지팡이 반경을 화면 배율에 맞춰 표시하고 수명 종료 후 제거된다.
- 이전·현재 투사체 좌표와 렌더 보간값을 사용한다.

- [ ] **Step 2: 기존 검 전용 렌더러에서 실패 확인**

Run: `node --test tests/class-rendering.test.mjs tests/projectile-rendering.test.mjs tests/weapon-rendering.test.mjs tests/player-weapon-rendering.test.mjs tests/canvas-renderer.test.mjs`

Expected: FAIL — 활·지팡이·투사체 렌더링이 없다.

- [ ] **Step 3: 무기와 직업 외형 렌더러 구현**

`weapon-rendering.js`의 기존 검 함수는 보존하고 다음 계열 함수를 추가한다.

```js
export function drawSword(ctx, options)
export function drawBow(ctx, options)
export function drawStaff(ctx, options)
export function drawWeapon(ctx, { classId, weaponId, direction, attackProgress })
```

직업 본체의 공통 이동 애니메이션은 유지하고 `class-rendering.js`에서 직업별 색상·보조 장비만 추가한다. 원격 플레이어도 같은 `classId`와 장착 무기로 그리되 공격 판정은 생성하지 않는다.

`projectile-rendering.js`는 시뮬레이션 상태를 변경하지 않고 `drawProjectile`과 `drawExplosionEffect`만 제공한다.

- [ ] **Step 4: 게임 그리기 순서 연결**

투사체는 월드 오브젝트 뒤, 캐릭터 및 적과 시각적으로 자연스러운 레이어에 그린다. 폭발 효과는 피해 계산 이후 별도 효과 목록에서 그린다. 카메라 밖 투사체는 그리지 않되 시뮬레이션에서는 유지한다.

- [ ] **Step 5: 대상 및 전체 테스트 실행**

Run: `node --test tests/class-rendering.test.mjs tests/projectile-rendering.test.mjs tests/weapon-rendering.test.mjs tests/player-weapon-rendering.test.mjs tests/canvas-renderer.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/class-rendering.js src/projectile-rendering.js src/weapon-rendering.js src/game-20260827-2.js tests/class-rendering.test.mjs tests/projectile-rendering.test.mjs tests/weapon-rendering.test.mjs tests/player-weapon-rendering.test.mjs tests/canvas-renderer.test.mjs
git commit -m "feat: 세 직업 무기와 투사체 외형 추가"
```

---

## Task 10: Firebase 직업·장착 무기 동기화와 규칙 강화

**Files:**

- Modify: `src/network-state.js`
- Modify: `src/network.js`
- Modify: `database.rules.json`
- Modify: `tests/network-state.test.mjs`
- Modify: `tests/network-chat-integration.test.mjs`
- Modify: `tests/database-rules.test.mjs`

- [ ] **Step 1: 직업·장착 무기 직렬화와 레거시 수신 실패 테스트 작성**

```js
const serialized = serializePlayerState({
  x: 10, y: 20, dir: "right", moving: false, color: "#fff", name: "궁수",
  classId: "archer", equippedWeaponId: "hunter-bow",
}, "village");
assert.deepEqual({
  classId: serialized.classId,
  equippedWeaponId: serialized.equippedWeaponId,
}, {
  classId: "archer", equippedWeaponId: "hunter-bow",
});

const legacy = filterPlayersForMap({ remote: {
  x: 10, y: 20, dir: "down", moving: false, color: "#fff", name: "기존검사", mapId: "village",
  equippedWeaponId: "katana",
}}, "self", "village").get("remote");
assert.equal(legacy.classId, "warrior");
assert.equal(legacy.equippedWeaponId, "katana");
```

추가로 잘못된 `classId`는 검사, 직업과 맞지 않는 `equippedWeaponId`는 해당 직업 기본 무기로 정규화한다고 검증한다.

- [ ] **Step 2: Firebase 규칙 실패 테스트 작성**

정적 규칙 테스트에 다음 표를 넣는다.

| classId | 허용 무기 예 | 거부 무기 예 |
|---|---|---|
| warrior | `katana` | `hunter-bow` |
| archer | `hunter-bow` | `training-staff` |
| mage | `training-staff` | `starter-sword` |

레거시 클라이언트 호환은 `classId`가 없을 때만 검사로 간주하여 기존 검 ID 또는 무기 필드 생략을 허용한다. 알려지지 않은 직업·무기와 다른 계열 조합은 거부한다.

- [ ] **Step 3: 현재 동기화와 규칙에서 실패 확인**

Run: `node --test tests/network-state.test.mjs tests/network-chat-integration.test.mjs tests/database-rules.test.mjs`

Expected: FAIL — 네트워크 상태와 규칙에 `classId` 관계 검증이 없다.

- [ ] **Step 4: 직렬화·수신 정규화 구현**

```js
const classId = normalizeClassId(player.classId);
return {
  // 기존 위치·방향·이름·맵 필드
  classId,
  equippedWeaponId: resolveWeaponDefinition(player.equippedWeaponId, classId).id,
};
```

원격 수신도 같은 순서로 `classId`를 먼저 정규화한 뒤 무기를 정규화한다. `network.js`의 게시 주기와 채팅 동작은 변경하지 않는다.

- [ ] **Step 5: 데이터베이스 규칙 갱신**

플레이어 레코드의 기존 위치·맵·이름 검증을 유지하면서 `classId`가 있을 때 세 값만 허용하고 계열별 7개 무기와의 관계를 검증한다. `equippedWeaponId`가 생략된 레거시 레코드는 허용하되, 새 클라이언트 직렬화는 두 필드를 항상 보낸다. `$other` 거부 규칙을 추가할 경우 기존 `updatedAt`까지 명시적으로 허용한다.

- [ ] **Step 6: 대상 및 전체 테스트 실행**

Run: `node --test tests/network-state.test.mjs tests/network-chat-integration.test.mjs tests/database-rules.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/network-state.js src/network.js database.rules.json tests/network-state.test.mjs tests/network-chat-integration.test.mjs tests/database-rules.test.mjs
git commit -m "feat: 직업과 무기 네트워크 동기화 추가"
```

---

## Task 11: QA 준비 도구와 문서 갱신

**Files:**

- Modify: `src/game-20260827-2.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `tests/game-qa.test.mjs`
- Modify: `tests/qa-ui.static.test.cjs`

- [ ] **Step 1: 현재 직업용 QA 준비 실패 테스트 작성**

기존 `data-qa-weapons="prepare"` 동작을 현재 직업 기준으로 바꾸고 다음을 검증한다.

- 레벨 30·Gold 5000·공통 퀘스트 상태 준비 동작은 유지한다.
- 검사로 실행하면 검 7종, 궁수면 활 7종, 마법사면 지팡이 7종만 해당 직업 장비에 준비된다.
- 다른 두 직업의 기존 보유·장착 상태는 변경하지 않는다.
- `?qa=1`, 게임 실행 중, QA 패널 열림 조건을 유지한다.
- 기존 `브란 앞으로 이동` 버튼은 선택 직업과 무관하게 정상 동작한다.

- [ ] **Step 2: README 요구사항 실패 테스트 또는 정적 검증 추가**

README에 다음 내용이 모두 있는지 검증한다.

- 입장 시 검사·궁수·마법사 선택과 재접속 시 변경 가능
- 공통 진행과 직업별 장비 보존 규칙
- 직업별 Ctrl 공격, Q 스킬, MP 비용
- 활 7종, 지팡이 7종을 포함한 21종 무기 단계
- 대장간은 현재 직업 무기만 표시
- Firebase는 직업·장착 무기 외형만 동기화하고 원격 공격 피해는 동기화하지 않음

- [ ] **Step 3: 현재 검 전용 QA와 문서에서 실패 확인**

Run: `node --test tests/game-qa.test.mjs tests/qa-ui.static.test.cjs`

Expected: FAIL — QA 준비가 검 전용이며 문서에 새 직업 내용이 없다.

- [ ] **Step 4: QA와 README 구현**

QA 버튼 문구를 `현재 직업 7종 무기 준비`로 바꾸고 현재 `classId`의 `WEAPON_ORDER_BY_CLASS`만 사용한다. README에는 확정 수치와 조작법을 표로 정리하되 설계 범위를 넘어 새 기능을 약속하지 않는다.

- [ ] **Step 5: 대상 및 전체 테스트 실행**

Run: `node --test tests/game-qa.test.mjs tests/qa-ui.static.test.cjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/game-20260827-2.js index.html README.md tests/game-qa.test.mjs tests/qa-ui.static.test.cjs
git commit -m "docs: 세 직업 QA와 플레이 안내 갱신"
```

---

## Task 12: 엔트리 모듈 버전화, 전체 검증, PR 및 실서비스 플레이테스트

**Files:**

- Rename: `src/main-20260827-2.js` → `src/main-20260828-classes.js`
- Rename: `src/game-20260827-2.js` → `src/game-20260828-classes.js`
- Modify: `src/main-20260828-classes.js`
- Modify: `index.html`
- Modify: `firebase.json`
- Modify: `tests/firebase-hosting.test.mjs`
- Modify: `tests/ci-workflow.test.mjs`
- Modify: 관련 정적 테스트의 엔트리 파일 경로

- [ ] **Step 1: 모든 런타임 모듈 연결과 Firebase 캐시 계약 실패 테스트 작성**

다음을 정적으로 검증한다.

- `index.html`은 실제 존재하는 `src/main-20260828-classes.js`를 로드한다.
- 새 엔트리는 실제 존재하는 `src/game-20260828-classes.js`를 가져온다.
- 이전 `main-20260827-2.js`, `game-20260827-2.js`를 HTML 또는 새 엔트리가 참조하지 않는다.
- Firebase는 HTML·JS·CSS에 `no-cache, must-revalidate`를 유지한다.
- GitHub Actions 검증은 `tests/*.test.mjs tests/*.static.test.cjs`와 모든 `src/*.js` 구문 검사를 실행한다.

Run: `node --test tests/firebase-hosting.test.mjs tests/ci-workflow.test.mjs tests/*.static.test.cjs`

Expected: FAIL — 아직 새 물리 파일명과 연결이 없다.

- [ ] **Step 2: 실제 파일명 변경과 모든 import·테스트 참조 갱신**

`git mv`로 두 파일명을 바꾸고 `index.html`, 새 엔트리 import, 소스 텍스트를 읽는 테스트의 경로를 함께 갱신한다. 쿼리 문자열만 추가하지 않는다. `firebase.json`의 기존 재검증 헤더는 유지한다.

- [ ] **Step 3: 전체 자동 검증 실행**

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: 전체 PASS

Run: `for file in src/*.js; do node --check "$file"; done`

Expected: 출력 없이 exit 0

Run: `git diff --check`

Expected: 출력 없이 exit 0

Run: `git status --short`

Expected: 계획된 파일만 수정 또는 추가됨

- [ ] **Step 4: 로컬 브라우저 스모크 테스트**

정적 서버를 열고 `tests/browser-smoke.cjs`가 현재 환경에서 실행 가능하면 수행한다. Playwright 또는 브라우저 의존성이 없으면 이를 코드 실패로 처리하지 말고 PR 배포 후 실서비스 검증으로 넘긴다.

필수 수동 스모크:

1. 첫 접속에서 닉네임만 입력하면 입장이 차단된다.
2. 검사 선택 → 입장 → 검 Ctrl/Q → 대장간 검 구매·장착·판매.
3. 같은 닉네임으로 궁수 선택 → 기존 레벨·Gold·퀘스트 유지 → 활 Ctrl/Q 관통 최대 5개 → 활 구매·장착·판매.
4. 같은 닉네임으로 마법사 선택 → 공통 진행 유지 → 마법탄/Q 폭발 범위 → 지팡이 구매·장착·판매.
5. 다시 검사로 접속해 검사 보유 목록과 마지막 장착 검이 복구되는지 확인.
6. 포탈·사망·부활·퇴장 후 화면과 시뮬레이션에 투사체가 남지 않는지 확인.
7. 두 브라우저에서 서로 다른 직업으로 접속해 원격 직업·무기는 보이되 원격 공격이 로컬 적에게 피해를 주지 않는지 확인.

- [ ] **Step 5: 최종 구현 커밋**

```bash
git add -A
git commit -m "chore: 세 직업 배포 엔트리 갱신"
```

- [ ] **Step 6: 코드 리뷰와 브랜치 마무리**

`superpowers:requesting-code-review`를 적용해 설계 문서의 포함·제외 범위, v4→v5 무손실 이전, 21종 수치, 투사체 중복 적중, Firebase 규칙 관계를 우선 검토한다. 지적 사항은 `superpowers:receiving-code-review`로 재현·검증한 뒤 수정한다.

모든 자동 검증을 새로 실행한 후 `superpowers:verification-before-completion`과 `superpowers:finishing-a-development-branch`를 적용한다. 사용자가 승인한 원격 저장소에 기능 브랜치를 푸시하고 PR을 생성한다.

- [ ] **Step 7: CI·병합·양쪽 배포 검증**

PR의 `Verify game`과 Firebase Database Rules 검증이 성공하고 병합 가능 상태인지 확인한다. 승인된 연속 진행 범위가 유지되면 병합하고, 병합 SHA에서 다음 워크플로가 모두 성공할 때까지 확인한다.

- Verify game
- Deploy game to GitHub Pages
- Deploy to Firebase Hosting
- Firebase Database Rules

- [ ] **Step 8: GitHub Pages와 Firebase에서 3직업 실플레이**

`game-studio:game-playtest`와 `control-browser` 절차로 두 배포본을 각각 검증한다. `?qa=1`에서 현재 직업 7종 준비와 브란 이동을 사용하되 거래·장착·전투는 실제 UI와 입력으로 수행한다.

각 호스트에서 확인할 증거:

- 데스크톱 3열 및 모바일 1열 입장 카드 화면
- 검사·궁수·마법사 각각의 입장, Ctrl, Q, HP·MP·이동속도
- 직업별 대장간 6개 구매 목록, 보유 무기 판매 목록, 인벤토리 장착
- 같은 닉네임 직업 전환 후 공통 진행 유지와 직업별 장비 복구
- 포탈·사망·재접속의 투사체 제거
- 원격 플레이어 직업·무기 외형
- 콘솔 오류·경고 0건 또는 게임과 무관한 외부 경고의 분리 기록

검증 중 결함을 발견하면 현재 브랜치에 즉흥 수정하지 않는다. `superpowers:systematic-debugging`으로 재현하고 실패 회귀 테스트를 먼저 추가한 별도 수정 브랜치·PR로 처리한다.

- [ ] **Step 9: 최종 완료 보고**

최종 보고에는 병합 PR, 병합 SHA, 전체 테스트 통과 수, 네 배포/검증 워크플로 상태, 두 배포 주소, 세 직업 실플레이 결과, 저장 마이그레이션 결과, 발견·해결한 예외, 증빙 화면 링크를 포함한다.
