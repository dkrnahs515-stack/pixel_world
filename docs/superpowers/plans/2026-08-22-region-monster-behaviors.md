# 지역별 신규 몬스터와 행동 상태 머신 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 해안가·활화산·태고의 숲에 기존 개체를 유지한 채 신규 몬스터 7종을 추가하고, 예고 가능한 대표 행동·고정 보상·포자 둔화를 데이터 기반 상태 머신으로 구현한다.

**Architecture:** 불변 몬스터 데이터는 `enemy-definitions.js`, 시간 기반 행동과 이벤트 생성은 `enemy-behaviors.js`로 분리한다. `enemies.js`는 인스턴스·공통 이동·피격·사망·Canvas 렌더링을 담당하고, `game.js`는 행동 이벤트를 플레이어 피해·상태이상·분열 생성·저장 흐름에 연결한다.

**Tech Stack:** Vanilla JavaScript ES modules, Canvas 2D, Node.js built-in test runner, 브라우저 localStorage v3, 기존 Firebase 위치·채팅 연결

**Spec:** `docs/superpowers/specs/2026-08-22-region-monster-behaviors-design.md`

## Global Constraints

- 기존 화염 슬라임 8, 숲 슬라임 5, 멧돼지 4, 해안 게 5, 물방울 슬라임 4의 스폰과 능력치를 삭제하거나 이동하지 않는다.
- 신규 지역 총 개체 수는 활화산 13, 태고의 숲 16, 해안가 14다.
- 신규 부모 7종은 확정 고정 EXP·Gold를 지급하고 `magma-slime-small`은 보상과 퀘스트 진행을 지급하지 않는다.
- 마그마 슬라임 부모는 보상을 한 번 지급한 뒤 사망 연출 완료 시 2~3마리로 분열하고 자식은 재분열하지 않는다.
- 고위력 공격은 `telegraph` 뒤 기술 사용당 피해 이벤트를 한 번만 발생시킨다.
- 포자 둔화는 이동속도 배율 0.65, 지속 2.5초이며 중첩하지 않고 남은 시간만 갱신한다.
- 전기·끌어당기기·화상·폭발·장판·지형 변화·속박·별도 독 피해는 구현하지 않는다.
- 저장 형식 v3와 기존 퀘스트·상점·물약·인벤토리·채팅·포털 입력 우선순위를 유지한다.
- 새 외부 패키지와 이미지 파일을 추가하지 않는다.

## 파일 구조

- Create: `src/enemy-definitions.js` — 기존·신규 몬스터의 불변 능력치, 색상, 행동 설정
- Create: `src/enemy-behaviors.js` — 행동 상태 전환과 피해·상태·분열 이벤트 생성
- Modify: `src/enemies.js` — 정의 기반 인스턴스, 공통 시뮬레이션, 자식 생성, 픽셀 렌더링
- Modify: `src/world-data.js` — 기존 스폰 뒤에 신규 15개 스폰 추가
- Modify: `src/player-progression.js` — 신규 부모 7종 고정 보상
- Modify: `src/player-combat.js` — 둔화 적용·갱신·해제
- Modify: `src/game.js` — 이벤트 소비, 피해 중복 방지, 둔화 이동, 상태 이펙트
- Modify: `README.md` — 지역 로스터와 대표 행동
- Create: `tests/enemy-definitions.test.mjs`
- Create: `tests/enemy-behaviors.test.mjs`
- Create: `tests/game-enemy-events.test.mjs`
- Create: `tests/enemy-rendering.test.mjs`
- Modify: `tests/enemies.test.mjs`
- Modify: `tests/world-data.test.mjs`
- Modify: `tests/player-progression.test.mjs`
- Modify: `tests/player-combat.test.mjs`
- Modify: `tests/game-progression.test.mjs`

---

### Task 1: 몬스터 정의·지역 스폰·고정 보상

**Files:**
- Create: `src/enemy-definitions.js`
- Modify: `src/enemies.js:1-63`
- Modify: `src/world-data.js:46-126`
- Modify: `src/player-progression.js:8-14`
- Create: `tests/enemy-definitions.test.mjs`
- Modify: `tests/enemies.test.mjs:5-28`
- Modify: `tests/world-data.test.mjs:21-39`
- Modify: `tests/player-progression.test.mjs:32-60`

**Interfaces:**
- Produces: `getEnemyDefinition(kind: string): Readonly<EnemyDefinition> | null`
- Produces: `createEnemyInstance(kind, spawn, id, overrides = {}): Enemy | null`
- Produces: `Enemy.behavior`, `behaviorState`, `behaviorTime`, `cooldownRemaining`, `attackSequence`, `attackApplied`, `lastDamagedAgo`, `generation`, `targetable`, `contactMode`, `contactCooldownDuration`

- [ ] **Step 1: 정의와 로스터 실패 테스트 작성**

`tests/enemy-definitions.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getEnemyDefinition } from "../src/enemy-definitions.js";

const expected = {
  "fang-shark": ["송곳니 상어", 25, 50, 100, 20, "fang-charge"],
  "pirate-shark": ["해적선 상어", 35, 55, 106, 21, "pirate-bite"],
  "magma-slime": ["마그마 슬라임", 10, 20, 78, 18, "magma-split"],
  "flame-imp": ["불꽃 도깨비", 40, 60, 148, 16, "flame-teleport"],
  "ancient-boar": ["고대 멧돼지", 55, 45, 105, 23, "burrow-charge"],
  "moss-troll": ["이끼 트롤", 100, 50, 58, 28, "camouflage-regeneration"],
  "ancient-mushroom-bug": ["고대 버섯충", 45, 35, 82, 18, "spore-slow"],
};

test("신규 7종은 확정 능력치와 행동을 가진다", () => {
  for (const [kind, values] of Object.entries(expected)) {
    const type = getEnemyDefinition(kind);
    assert.deepEqual([type.name, type.hp, type.damage, type.speed, type.radius, type.behavior], values);
  }
  assert.equal(getEnemyDefinition("unknown"), null);
});
```

`tests/enemies.test.mjs`에 지역 총수 `13, 16, 14`와 신규 종류별 수 `3·2 / 3·2 / 2·2·3` assertion을 추가한다. `tests/player-progression.test.mjs`에는 다음 표를 0과 0.999999 난수 모두에 대입한다.

```js
const fixedCases = [
  ["fang-shark", 20, 15, "송곳니 상어"],
  ["pirate-shark", 25, 20, "해적선 상어"],
  ["magma-slime", 15, 10, "마그마 슬라임"],
  ["flame-imp", 40, 25, "불꽃 도깨비"],
  ["ancient-boar", 30, 20, "고대 멧돼지"],
  ["moss-troll", 50, 35, "이끼 트롤"],
  ["ancient-mushroom-bug", 35, 25, "고대 버섯충"],
];
assert.equal(progression.getMonsterReward("magma-slime-small", () => 0), null);
```

- [ ] **Step 2: 테스트를 실행해 신규 모듈과 데이터 부재로 실패 확인**

```bash
node --test tests/enemy-definitions.test.mjs tests/enemies.test.mjs tests/world-data.test.mjs tests/player-progression.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` 또는 신규 종류·수량·보상 assertion 실패.

- [ ] **Step 3: 불변 정의 모듈과 인스턴스 팩터리 구현**

`src/enemy-definitions.js`에는 기존 5종을 현재 값 그대로 옮기고 신규 정의를 다음 값으로 추가한다.

```js
const define = value => Object.freeze(value);

export const ENEMY_DEFINITIONS = Object.freeze({
  "fang-shark": define({ name: "송곳니 상어", hp: 25, speed: 100, damage: 50, radius: 20, color: "#159a9c", accent: "#f4f7ed", behavior: "fang-charge", contactMode: "ability" }),
  "pirate-shark": define({ name: "해적선 상어", hp: 35, speed: 106, damage: 55, radius: 21, color: "#11787c", accent: "#7650a8", behavior: "pirate-bite", contactMode: "ability" }),
  "magma-slime": define({ name: "마그마 슬라임", hp: 10, speed: 78, damage: 20, radius: 18, color: "#1b1719", accent: "#f05a24", behavior: "magma-split", contactMode: "contact", contactCooldown: 1 }),
  "magma-slime-small": define({ name: "작은 마그마 슬라임", hp: 3, speed: 95, damage: 20, radius: 12, color: "#1b1719", accent: "#ffc857", behavior: "legacy-contact", contactMode: "contact", contactCooldown: 1, generation: 1 }),
  "flame-imp": define({ name: "불꽃 도깨비", hp: 40, speed: 148, damage: 60, radius: 16, color: "#a91f2c", accent: "#ffc857", behavior: "flame-teleport", contactMode: "contact", contactCooldown: 1.2 }),
  "ancient-boar": define({ name: "고대 멧돼지", hp: 55, speed: 105, damage: 45, radius: 23, color: "#704b32", accent: "#b58a4a", behavior: "burrow-charge", contactMode: "ability" }),
  "moss-troll": define({ name: "이끼 트롤", hp: 100, speed: 58, damage: 50, radius: 28, color: "#704b32", accent: "#6f8f3d", behavior: "camouflage-regeneration", contactMode: "contact", contactCooldown: 1.2 }),
  "ancient-mushroom-bug": define({ name: "고대 버섯충", hp: 45, speed: 82, damage: 35, radius: 18, color: "#234f32", accent: "#76508f", behavior: "spore-slow", contactMode: "contact", contactCooldown: 1 }),
});

export function getEnemyDefinition(kind) {
  return ENEMY_DEFINITIONS[kind] || null;
}
```

`src/enemies.js`의 팩터리:

```js
export function createEnemyInstance(kind, spawn, id, overrides = {}) {
  const type = getEnemyDefinition(kind);
  if (!type) return null;
  const hp = overrides.hp ?? type.hp;
  return {
    id, kind, name: type.name,
    x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y,
    homeX: spawn.x, homeY: spawn.y,
    hp, maxHp: overrides.maxHp ?? hp, speed: type.speed,
    contactDamage: type.damage, radius: type.radius,
    color: type.color, accent: type.accent,
    behavior: type.behavior, behaviorState: "idle", behaviorTime: 0,
    cooldownRemaining: 0, attackSequence: 0, attackApplied: false,
    lastDamagedAgo: Number.POSITIVE_INFINITY,
    generation: overrides.generation ?? type.generation ?? 0,
    targetable: true, contactMode: type.contactMode,
    contactCooldownDuration: type.contactCooldown ?? 1,
    state: "idle", moving: false, step: overrides.step ?? 0,
    hitFlash: 0, shake: 0, deathTime: 0, opacity: 1, scale: 1,
    knockbackX: 0, knockbackY: 0, contactCooldown: 0,
  };
}
```

설계 문서의 좌표 15개를 기존 `enemySpawns` 뒤에 추가한다. 보상은 `goldMin === goldMax`로 등록하고 자식은 보상표에 넣지 않는다.

- [ ] **Step 4: 정의·스폰·보상 테스트 통과 확인**

```bash
node --test tests/enemy-definitions.test.mjs tests/enemies.test.mjs tests/world-data.test.mjs tests/player-progression.test.mjs
```

Expected: 모든 테스트 PASS. 신규 스폰은 `isWorldPositionBlocked`가 false이고 포털 중심에서 180픽셀보다 멀다.

- [ ] **Step 5: 커밋**

```bash
git add src/enemy-definitions.js src/enemies.js src/world-data.js src/player-progression.js tests/enemy-definitions.test.mjs tests/enemies.test.mjs tests/world-data.test.mjs tests/player-progression.test.mjs
git commit -m "신규 몬스터 정의와 지역 스폰 추가"
```

---

### Task 2: 플레이어 포자 둔화 상태

**Files:**
- Modify: `src/player-combat.js:1-30`
- Modify: `src/game.js:108-114, 204-278, 386-439, 781-815, 905-925`
- Modify: `tests/player-combat.test.mjs`
- Create: `tests/game-enemy-events.test.mjs`

**Interfaces:**
- Produces: `createCombatStatusEffects()`, `applyPlayerSlow(player, multiplier, duration)`
- Produces: `clearPlayerCombatStatuses(player)`, `playerMovementMultiplier(player)`

- [ ] **Step 1: 둔화 실패 테스트 작성**

```js
test("포자 둔화는 0.65 배율로 적용되고 중첩 없이 시간을 갱신한다", () => {
  const target = player({ statusEffects: createCombatStatusEffects() });
  assert.equal(applyPlayerSlow(target, 0.65, 2.5), true);
  tickPlayerStatus(target, 1);
  assert.equal(playerMovementMultiplier(target), 0.65);
  assert.equal(target.statusEffects.slow.remaining, 1.5);
  applyPlayerSlow(target, 0.65, 2.5);
  assert.equal(target.statusEffects.slow.remaining, 2.5);
});

test("둔화는 시간이 끝나거나 부활하면 정상 속도로 복원된다", () => {
  const target = player({ statusEffects: createCombatStatusEffects() });
  applyPlayerSlow(target, 0.65, 0.1);
  tickPlayerStatus(target, 0.2);
  assert.equal(playerMovementMultiplier(target), 1);
  applyPlayerSlow(target, 0.65, 2.5);
  respawnPlayer(target);
  assert.equal(playerMovementMultiplier(target), 1);
});
```

`tests/game-enemy-events.test.mjs`에서 ArrowRight 1초 이동 거리가 `C.PLAYER_SPEED * 0.65`이고 `switchWorld` 뒤 배율이 1인지 검증한다.

- [ ] **Step 2: 신규 export와 이동 배율 부재로 실패 확인**

```bash
node --test tests/player-combat.test.mjs tests/game-enemy-events.test.mjs
```

Expected: 신규 함수 export 부재 또는 이동 거리 assertion 실패.

- [ ] **Step 3: 둔화 상태와 수명주기 구현**

```js
export function createCombatStatusEffects() {
  return { slow: { multiplier: 1, remaining: 0 } };
}

export function applyPlayerSlow(player, multiplier, duration) {
  if (player.respawnTimer > 0 || !(multiplier > 0 && multiplier <= 1) || duration <= 0) return false;
  player.statusEffects ||= createCombatStatusEffects();
  player.statusEffects.slow.multiplier = Math.min(player.statusEffects.slow.multiplier, multiplier);
  player.statusEffects.slow.remaining = Math.max(player.statusEffects.slow.remaining, duration);
  return true;
}

export function clearPlayerCombatStatuses(player) {
  player.statusEffects = createCombatStatusEffects();
}

export function playerMovementMultiplier(player) {
  return player.statusEffects?.slow?.remaining > 0 ? player.statusEffects.slow.multiplier : 1;
}
```

`tickPlayerStatus`에서 남은 시간을 0까지 감소시키고 만료 시 배율 1로 복원한다. `respawnPlayer`, `switchWorld`, `leave`, `resetCombatState`에서 상태를 제거한다. 이동은 다음 식을 사용한다.

```js
const speed = C.PLAYER_SPEED * playerMovementMultiplier(this.player);
const nextX = this.player.x + dx * speed * dt;
const nextY = this.player.y + dy * speed * dt;
```

- [ ] **Step 4: 둔화와 기존 피해·부활 테스트 통과 확인**

```bash
node --test tests/player-combat.test.mjs tests/game-enemy-events.test.mjs
```

Expected: 신규 둔화와 기존 피격·부활 테스트 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/player-combat.js src/game.js tests/player-combat.test.mjs tests/game-enemy-events.test.mjs
git commit -m "플레이어 포자 둔화 상태 추가"
```

---

### Task 3: 행동 이벤트 계약과 해안가 상어

**Files:**
- Create: `src/enemy-behaviors.js`
- Modify: `src/enemies.js:65-121, 193-243`
- Modify: `src/game.js:386-411, 851-903`
- Create: `tests/enemy-behaviors.test.mjs`
- Modify: `tests/enemies.test.mjs`
- Modify: `tests/game-enemy-events.test.mjs`

**Interfaces:**
- Produces: `updateEnemyBehavior(enemy, player, dt, context): {handled:boolean,events:EnemyEvent[]}`
- Produces: `updateEnemies(enemies, player, dt, context): {enemies:Enemy[],events:EnemyEvent[]}`
- Produces: `PixelRPG.applyEnemyEvents(events)`
- Produces: `{type:"damage-player",enemyId,attackId,amount,source}`

- [ ] **Step 1: 상어 상태 전환과 중복 피해 실패 테스트 작성**

```js
test("송곳니 상어는 0.55초 예고 뒤 고정 방향으로 돌진해 한 번 피해를 준다", () => {
  const shark = enemyOf("fang-shark", { x: 0, y: 0 });
  updateEnemyBehavior(shark, { x: 200, y: 0 }, 0.01, openContext());
  assert.equal(shark.behaviorState, "telegraph");
  updateEnemyBehavior(shark, { x: 0, y: 200 }, 0.55, openContext());
  assert.equal(shark.behaviorState, "attack");
  const first = updateEnemyBehavior(shark, { x: shark.x + 5, y: shark.y }, 0.1, openContext());
  const second = updateEnemyBehavior(shark, { x: shark.x + 5, y: shark.y }, 0.1, openContext());
  assert.equal(first.events[0].amount, 50);
  assert.equal(second.events.length, 0);
});

test("해적선 상어는 62픽셀 안에서 0.35초 물기를 예고한다", () => {
  const shark = enemyOf("pirate-shark", { x: 0, y: 0 });
  updateEnemyBehavior(shark, { x: 50, y: 0 }, 0.01, openContext());
  assert.equal(shark.behaviorState, "telegraph");
  updateEnemyBehavior(shark, { x: 50, y: 0 }, 0.35, openContext());
  const result = updateEnemyBehavior(shark, { x: 30, y: 0 }, 0.1, openContext());
  assert.equal(result.events[0].amount, 55);
});
```

게임 통합 테스트는 동일 `attackId` 이벤트 두 개를 전달하고 HP가 한 번만 감소하는지 검증한다.

같은 파일에 다음 경계도 고정한다.

```js
test("알 수 없는 행동은 이벤트 없이 기존 이동으로 위임한다", () => {
  const enemy = enemyOf("fang-shark", { behavior: "unknown-behavior" });
  assert.deepEqual(updateEnemyBehavior(enemy, { x: 10, y: 0 }, 0.1, openContext()), {
    handled: false,
    events: [],
  });
});

test("큰 dt도 같은 공격의 피해 이벤트를 두 번 만들지 않는다", () => {
  const shark = enemyOf("fang-shark", { behaviorState: "telegraph", behaviorTime: 0.5, lockedDirection: { x: 1, y: 0 } });
  const result = updateEnemyBehavior(shark, { x: 5, y: 0 }, 1.2, openContext());
  assert.ok(result.events.filter(event => event.type === "damage-player").length <= 1);
});
```

- [ ] **Step 2: 행동 모듈과 새 반환 계약 부재로 실패 확인**

```bash
node --test tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs
```

Expected: 모듈 부재, 반환형 또는 상태 assertion 실패.

- [ ] **Step 3: 공통 헬퍼·상어 행동·게임 이벤트 소비 구현**

```js
function beginTelegraph(enemy, player) {
  enemy.behaviorState = "telegraph";
  enemy.behaviorTime = 0;
  enemy.attackApplied = false;
  enemy.attackSequence += 1;
  enemy.lockedDirection = normalize(player.x - enemy.x, player.y - enemy.y);
  enemy.moving = false;
}

function damageEvent(enemy) {
  enemy.attackApplied = true;
  return {
    type: "damage-player",
    enemyId: enemy.id,
    attackId: `${enemy.id}:${enemy.attackSequence}`,
    amount: enemy.contactDamage,
    source: { x: enemy.x, y: enemy.y },
  };
}

export function updateEnemyBehavior(enemy, player, dt, context) {
  if (enemy.behavior === "fang-charge") return updateFangCharge(enemy, player, dt, context);
  if (enemy.behavior === "pirate-bite") return updatePirateBite(enemy, player, dt, context);
  return { handled: false, events: [] };
}
```

송곳니 상어는 거리 320, 예고 0.55초, 공격 0.45초, 속도 420, 쿨다운 2.4초를 사용한다. 해적선 상어는 거리 62, 예고 0.35초, 공격 0.18초, 최대 전진 34픽셀, 정면 120도 부채꼴, 쿨다운 1.8초를 사용한다. 두 공격 모두 `attackApplied`가 false일 때만 이벤트를 반환한다.

`updateEnemies`는 `{enemies, events}`를 반환하고 `context.moveEnemy`는 `stopOnBlock`일 때 어느 축이든 막히면 false를 반환한다. `game.js`:

```js
const simulation = updateEnemies(this.enemies, this.player, dt, {
  isBlocked,
  portals: getWorldDefinition(this.mapId).portals,
  random: Math.random,
});
this.enemies = simulation.enemies;
this.applyEnemyEvents(simulation.events);
```

`processedEnemyAttackIds`로 같은 공격을 건너뛰고 지역 전환에서 Set을 비운다. 알 수 없는 이벤트는 상태를 바꾸지 않고 무시한다. `contactMode !== "contact"`는 기존 접촉 피해에서 제외하고 `targetable === false`는 플레이어 공격 대상에서 제외한다. 접촉 피해 성공 시 `enemy.contactCooldown = enemy.contactCooldownDuration`을 사용해 도깨비와 트롤은 1.2초, 마그마와 버섯충은 1초를 적용한다.

- [ ] **Step 4: 상어·이벤트와 기존 적 회귀 통과 확인**

```bash
node --test tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs tests/game-progression.test.mjs
```

Expected: 상어 예고·1회 공격·장애물 종료와 기존 보상 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/enemy-behaviors.js src/enemies.js src/game.js tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs
git commit -m "해안가 상어 행동 상태 머신 추가"
```

---

### Task 4: 활화산 분열과 순간이동

**Files:**
- Modify: `src/enemy-behaviors.js`
- Modify: `src/enemies.js`
- Modify: `src/game.js`
- Modify: `tests/enemy-behaviors.test.mjs`
- Modify: `tests/enemies.test.mjs`
- Modify: `tests/game-enemy-events.test.mjs`
- Modify: `tests/game-progression.test.mjs`

**Interfaces:**
- Produces: `damageEnemy(..., random = Math.random)`의 분열 수 고정
- Produces: `createMagmaChildren(event, context): Enemy[]`
- Produces: `{type:"spawn-enemies",enemyId,kind,count,childHp,origin}`

- [ ] **Step 1: 분열과 순간이동 실패 테스트 작성**

```js
for (const [sample, count, childHp] of [[0, 2, 5], [0.5, 3, 3]]) {
  const parent = createEnemyInstance("magma-slime", { x: 100, y: 100 }, `parent-${count}`);
  damageEnemy(parent, 10, { x: 1, y: 0 }, 0, () => sample);
  const result = updateEnemies([parent], { x: 0, y: 0 }, 0.66, {
    isBlocked: () => false, random: () => sample, portals: [],
  });
  assert.deepEqual(result.events[0], {
    type: "spawn-enemies", enemyId: `parent-${count}`, kind: "magma-slime-small",
    count, childHp, origin: { x: 100, y: 100 },
  });
}
```

도깨비 테스트는 0.4초 사라짐, 안전 후보 이동, 0.25초 재등장, 3초 cooldown과 8개 후보 실패 시 원위치 유지를 검증한다. 진행 테스트는 부모를 두 번 공격해도 EXP 15·Gold 10이 한 번이며 자식 종류는 무보상인지 검증한다.

- [ ] **Step 2: 분열 이벤트와 순간이동 분기 부재로 실패 확인**

```bash
node --test tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs tests/game-progression.test.mjs
```

Expected: 분열 이벤트 또는 도깨비 위치·상태 assertion 실패.

- [ ] **Step 3: 부모 사망 이벤트·자식 생성·순간이동 구현**

```js
if (enemy.hp === 0 && enemy.kind === "magma-slime" && enemy.generation === 0) {
  enemy.splitCount = random() < 0.5 ? 2 : 3;
  enemy.splitChildHp = enemy.splitCount === 2 ? 5 : 3;
  enemy.splitEventEmitted = false;
}
```

사망 연출이 0.65초에 도달한 프레임에 `spawn-enemies`를 한 번 발생시킨다. 자식 후보는 부모 중심 34픽셀의 각도 `0, 2π/3, 4π/3, π, π/2, 3π/2` 순서로 검사하고 통행 가능한 위치만 `createEnemyInstance`로 생성한다. 동적 ID는 `${mapId}-dynamic-${++dynamicEnemySequence}`를 사용한다.

도깨비 상수:

```js
const FLAME_TELEPORT = Object.freeze({
  vanish: 0.4, reappear: 0.25, cooldown: 3,
  minRadius: 110, maxRadius: 180, attempts: 8,
  portalSafety: 180, playerSafety: 80,
});
```

후보는 주입된 난수로 각도와 거리를 계산하고 월드 충돌, 포털 180픽셀, 플레이어 80픽셀 조건을 모두 통과해야 한다. 순간이동 자체는 피해를 주지 않는다.

- [ ] **Step 4: 활화산 행동과 보상 테스트 통과 확인**

```bash
node --test tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs tests/game-progression.test.mjs tests/player-progression.test.mjs
```

Expected: 2·3마리 분열, 안전 순간이동, 부모 1회 보상, 자식 무보상 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/enemy-behaviors.js src/enemies.js src/game.js tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs tests/game-progression.test.mjs
git commit -m "활화산 몬스터 분열과 순간이동 추가"
```

---

### Task 5: 태고의 숲 잠복·위장·재생·포자

**Files:**
- Modify: `src/enemy-behaviors.js`
- Modify: `src/enemies.js`
- Modify: `src/game.js`
- Modify: `tests/enemy-behaviors.test.mjs`
- Modify: `tests/enemies.test.mjs`
- Modify: `tests/game-enemy-events.test.mjs`

**Interfaces:**
- Consumes: Task 2의 `applyPlayerSlow`
- Produces: `{type:"apply-player-status",enemyId,status:"slow",multiplier:0.65,duration:2.5}`
- Produces: 잠복 `targetable=false`, 트롤 `camouflaged`, `lastDamagedAgo`

- [ ] **Step 1: 숲 행동 실패 테스트 작성**

```js
test("고대 멧돼지는 0.7초 잠복 후 한 번 돌진한다", () => {
  const boar = enemyOf("ancient-boar", { x: 0, y: 0 });
  updateEnemyBehavior(boar, { x: 200, y: 0 }, 0.01, openContext());
  assert.equal(boar.targetable, false);
  updateEnemyBehavior(boar, { x: 0, y: 200 }, 0.7, openContext());
  const hit = updateEnemyBehavior(boar, { x: boar.x + 5, y: boar.y }, 0.1, openContext());
  assert.equal(hit.events[0].amount, 45);
});

test("이끼 트롤은 피격 3초 뒤 초당 4를 재생한다", () => {
  const troll = enemyOf("moss-troll", { hp: 80, maxHp: 100, lastDamagedAgo: 0 });
  updateEnemyBehavior(troll, { x: 500, y: 0 }, 3, openContext());
  assert.equal(troll.camouflaged, true);
  assert.equal(troll.hp, 80);
  updateEnemyBehavior(troll, { x: 500, y: 0 }, 1, openContext());
  assert.equal(troll.hp, 84);
  damageEnemy(troll, 1, { x: 1, y: 0 }, 0);
  assert.equal(troll.lastDamagedAgo, 0);
});

test("버섯충 포자는 반경 120에 0.65 둔화를 요청한다", () => {
  const bug = enemyOf("ancient-mushroom-bug", { x: 0, y: 0 });
  updateEnemyBehavior(bug, { x: 100, y: 0 }, 0.01, openContext());
  const result = updateEnemyBehavior(bug, { x: 100, y: 0 }, 0.6, openContext());
  assert.deepEqual(result.events, [{
    type: "apply-player-status", enemyId: bug.id,
    status: "slow", multiplier: 0.65, duration: 2.5,
  }]);
  assert.equal(bug.cooldownRemaining, 4);
});
```

- [ ] **Step 2: 숲 행동 분기 부재로 실패 확인**

```bash
node --test tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs tests/player-combat.test.mjs
```

Expected: 멧돼지 상태, 트롤 HP 또는 포자 이벤트 assertion 실패.

- [ ] **Step 3: 숲 행동과 slow 이벤트 연결 구현**

```js
const BURROW_CHARGE = Object.freeze({ trigger: 330, telegraph: 0.7, attack: 0.5, speed: 440, cooldown: 3.4 });
const TROLL_REGEN = Object.freeze({ revealDistance: 280, delay: 3, hpPerSecond: 4, hiddenOpacity: 0.25 });
const SPORE_SLOW = Object.freeze({ trigger: 240, telegraph: 0.6, radius: 120, multiplier: 0.65, duration: 2.5, cooldown: 4 });
```

멧돼지는 잠복 중 비대상이며 방향을 고정하고, 적중·0.5초 경과·장애물 중 하나에서 cooldown으로 전환한다. 트롤은 거리 280 밖의 idle·returning에서 위장하고 접근·피격 때 해제한다. 재생은 3초 대기 경계를 지난 시간에만 적용한다.

```js
const before = enemy.lastDamagedAgo;
enemy.lastDamagedAgo += dt;
const regenSeconds = Math.max(0, enemy.lastDamagedAgo - Math.max(before, 3));
enemy.hp = Math.min(enemy.maxHp, enemy.hp + 4 * regenSeconds);
```

`damageEnemy`는 모든 피격에서 `lastDamagedAgo=0`과 `camouflaged=false`를 적용한다.

버섯충은 거리 240에서 예고를 시작하고 0.6초 후 거리 120을 다시 검사해 slow 이벤트를 한 번 반환한다. `PixelRPG.applyEnemyEvents`는 `applyPlayerSlow`가 true일 때만 `포자에 노출되어 이동속도가 감소했습니다.`를 알린다.

- [ ] **Step 4: 숲 행동과 전체 상태 테스트 통과 확인**

```bash
node --test tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs tests/player-combat.test.mjs
```

Expected: 잠복·장애물 종료, 위장·재생·피격 중단, 포자·비중첩 둔화 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/enemy-behaviors.js src/enemies.js src/game.js tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs
git commit -m "태고의 숲 몬스터 대표 행동 추가"
```

---

### Task 6: 픽셀 외형·전투 예고·문서·전체 검증

**Files:**
- Modify: `src/enemies.js:124-191`
- Modify: `src/game.js:985-1031, 1208 이후`
- Modify: `README.md:23-68`
- Create: `tests/enemy-rendering.test.mjs`
- Modify: `tests/game-enemy-events.test.mjs`

**Interfaces:**
- Consumes: 신규 종류, 색상, `behaviorState`, `lockedDirection`, `targetable`, `camouflaged`
- Produces: 모든 신규 종류와 대표 예고를 처리하는 `drawEnemy`
- Produces: `drawPlayerSlowEffect(ctx, player, cameraX, cameraY)`

- [ ] **Step 1: 외형과 예고 실패 테스트 작성**

```js
const kinds = [
  "fang-shark", "pirate-shark", "magma-slime", "magma-slime-small",
  "flame-imp", "ancient-boar", "moss-troll", "ancient-mushroom-bug",
];

test("신규 몬스터와 자식은 픽셀 팔레트로 렌더링된다", () => {
  for (const kind of kinds) {
    const ctx = recordingContext();
    const enemy = createEnemyInstance(kind, { x: 100, y: 100 }, kind);
    assert.doesNotThrow(() => drawEnemy(ctx, enemy, 0, 0, 1));
    assert.ok(ctx.fills.length >= 5);
    assert.ok(ctx.colors.includes(enemy.color));
  }
});

test("돌진 예고는 몸 외에 긴 바닥 표시를 그린다", () => {
  const ctx = recordingContext();
  const enemy = createEnemyInstance("fang-shark", { x: 100, y: 100 }, "fang");
  enemy.behaviorState = "telegraph";
  enemy.lockedDirection = { x: 1, y: 0 };
  drawEnemy(ctx, enemy, 0, 0, 1);
  assert.ok(ctx.fills.some(fill => fill.w >= 60 && fill.h <= 8));
});
```

- [ ] **Step 2: 신규 종류별 외형과 예고 부재로 실패 확인**

```bash
node --test tests/enemy-rendering.test.mjs tests/game-enemy-events.test.mjs
```

Expected: 신규 팔레트 또는 예고 표시 assertion 실패.

- [ ] **Step 3: 종류별 픽셀 외형과 상태 이펙트 구현**

```js
const ENEMY_DRAWERS = Object.freeze({
  boar: drawBoar,
  crab: drawCrab,
  "fang-shark": drawFangShark,
  "pirate-shark": drawPirateShark,
  "magma-slime": drawMagmaSlime,
  "magma-slime-small": drawMagmaSlime,
  "flame-imp": drawFlameImp,
  "ancient-boar": drawAncientBoar,
  "moss-troll": drawMossTroll,
  "ancient-mushroom-bug": drawMushroomBug,
});
drawEnemyTelegraph(ctx, enemy);
(ENEMY_DRAWERS[enemy.kind] || drawSlimeBody)(ctx, enemy);
```

실루엣은 상어의 등지느러미·흰 이빨·보라 두건, 마그마 균열, 도깨비 3단 불꽃, 고대 멧돼지 쌍엄니, 트롤의 긴 나무껍질 몸·이끼, 버섯충의 큰 보라 갓을 각각 최소 5개 정수 좌표 사각형으로 구분한다. 예고는 돌진 방향선, 물기 입 점멸, 순간이동 잔상·재등장 링, 포자 반경 원을 그린다.

둔화 상태 이펙트:

```js
function drawPlayerSlowEffect(ctx, player, cameraX, cameraY) {
  if (!(player.statusEffects?.slow?.remaining > 0)) return;
  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y - cameraY);
  ctx.save();
  ctx.fillStyle = "rgba(118,80,143,.75)";
  for (let index = 0; index < 6; index++) {
    const angle = player.step + index * Math.PI / 3;
    ctx.fillRect(Math.round(x + Math.cos(angle) * 20) - 2, Math.round(y + Math.sin(angle) * 12) - 2, 4, 4);
  }
  ctx.restore();
}
```

README의 세 지역 행과 전투 설명에 신규 로스터, 대표 기술 예고, 자식 무보상, 포자 둔화를 추가한다.

- [ ] **Step 4: 기능별 렌더링 테스트 통과 확인**

```bash
node --test tests/enemy-rendering.test.mjs tests/enemy-definitions.test.mjs tests/enemy-behaviors.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs tests/player-combat.test.mjs tests/player-progression.test.mjs tests/game-progression.test.mjs tests/world-data.test.mjs
```

Expected: 모든 기능별 테스트 PASS.

- [ ] **Step 5: 지원되는 전체 자동 검증 실행**

```bash
node --test tests/*.test.mjs tests/quest-ui-smoke.cjs tests/shop-ui-smoke.cjs tests/inventory-ui-smoke.cjs
for file in src/*.js; do node --check "$file"; done
git diff --check
```

Expected: 모든 테스트 PASS, 모든 구문 검사 종료 코드 0, diff 검사 출력 없음.

- [ ] **Step 6: 브라우저 플레이 점검**

공개 PR 미리보기 또는 병합 후 Pages에서 다음을 순서대로 확인한다.

1. 세 지역에서 기존 몬스터와 신규 몬스터가 확정 수량으로 함께 보인다.
2. 돌진선·물기·분열·순간이동 잔상·흙먼지·위장·재생·포자 범위를 식별할 수 있다.
3. 고위력 기술은 예고 뒤 한 번만 피해를 준다.
4. 마그마 부모는 2 또는 3마리로 분열하고 자식은 보상·퀘스트 진행이 없다.
5. 포자 둔화의 이동 차이와 사망·지역 이동 시 해제를 확인한다.
6. 신규 부모 처치 보상이 HUD와 재접속 저장에 반영된다.
7. 최대 16개체와 자식 3개 상황에서 목표 50~60 FPS, 지속 45 FPS 이상을 확인한다.
8. 게임 페이지 출처의 console error와 warn이 없다.

- [ ] **Step 7: 최종 구현 커밋**

```bash
git add src/enemies.js src/game.js README.md tests/enemy-rendering.test.mjs tests/game-enemy-events.test.mjs
git commit -m "신규 몬스터 외형과 전투 예고 완성"
git status --short
```

Expected: 커밋 성공 후 `git status --short` 출력 없음. 브랜치 통합은 `superpowers:finishing-a-development-branch` 절차로 최종 테스트 증거를 재확인한 뒤 진행한다.
