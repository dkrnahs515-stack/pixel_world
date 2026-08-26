# Combat Hit Stop and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add short, readable hit reactions to every targetable monster while reducing the fixed-update, minimap, and HUD work that can amplify low cloud-browser frame rates.

**Architecture:** Enemy-local hit stun lives in `enemies.js` and pauses behavior while preserving knockback. Global hit stop is controlled by the frame loop in `game.js`, so rendering and browser input continue while world simulation briefly freezes. Performance work lowers the fixed simulation to 60 Hz, caps catch-up work, caches the minimap background, and avoids unchanged HUD DOM writes without changing combat stats or monster behavior definitions.

**Tech Stack:** Browser JavaScript ES modules, HTML Canvas 2D, Node.js built-in test runner, GitHub Pages.

**Spec:** Approved in-chat bounded design from 2026-08-26; no separate design document is required.

## Global Constraints

- Basic attack hit stun is 0.10 seconds and hit stop is 0.035 seconds.
- Strong attack hit stun is 0.18 seconds and hit stop is 0.065 seconds.
- Hit stun pauses enemy behavior and contact damage but preserves knockback movement.
- Hit stop freezes world simulation only; rendering and browser input remain active.
- Simultaneous hits use the longest hit stop and never sum durations.
- Existing attack damage, monster stats, rewards, AI state, and save data remain unchanged.
- Fixed simulation runs at 60 Hz with no more than five catch-up steps per rendered frame.
- The minimap background is cached and moving dots refresh at most ten times per second.
- HUD DOM properties are written only when their rendered value changes.

---

### Task 1: Enemy-local hit stun

**Files:**
- Modify: `src/enemies.js`
- Modify: `src/game.js`
- Modify: `src/combat.js`
- Test: `tests/enemies.test.mjs`
- Test: `tests/game-enemy-events.test.mjs`

**Interfaces:**
- Consumes: `attackDefinition(kind)` and the current `damageEnemy(...)` result.
- Produces: `applyEnemyHitStun(enemy, duration): boolean`, `enemy.hitStunRemaining: number`, and `hitStun` on each attack definition.

- [ ] **Step 1: Write failing enemy-state tests**

```js
test("기본 피격 경직은 AI와 접촉 공격을 멈추고 넉백 이동은 유지한다", () => {
  const enemy = createEnemyInstance("crab", { x: 100, y: 100 }, "stunned-crab");
  applyEnemyHitStun(enemy, 0.1);
  updateEnemies([enemy], { x: 140, y: 100 }, 0.05, { isBlocked: () => false });
  assert.equal(enemy.behaviorTime, 0);
  assert.ok(enemy.hitStunRemaining > 0);
});

test("더 짧은 재피격은 남은 경직 시간을 줄이지 않는다", () => {
  const enemy = createEnemyInstance("crab", { x: 100, y: 100 }, "stunned-crab");
  applyEnemyHitStun(enemy, 0.18);
  applyEnemyHitStun(enemy, 0.1);
  assert.equal(enemy.hitStunRemaining, 0.18);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/enemies.test.mjs tests/game-enemy-events.test.mjs`

Expected: FAIL because `applyEnemyHitStun` and attack-definition stun values do not exist.

- [ ] **Step 3: Implement minimal enemy stun state and combat connection**

```js
export function applyEnemyHitStun(enemy, duration) {
  if (!enemy || enemy.state === "dying" || !(duration > 0)) return false;
  enemy.hitStunRemaining = Math.max(enemy.hitStunRemaining ?? 0, duration);
  enemy.moving = false;
  return true;
}
```

Add `hitStun: 0.10` to the basic definition and `hitStun: 0.18` to the strong definition. Apply the duration only after a real, non-lethal player hit. In `updateEnemies`, advance hit feedback and knockback, consume the stun timer, and skip behavior processing for the tick that began stunned. In `applyEnemyContactDamage`, ignore enemies whose stun timer remains positive.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/enemies.test.mjs tests/game-enemy-events.test.mjs tests/combat.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the independently working enemy stun**

```bash
git add src/enemies.js src/game.js src/combat.js tests/enemies.test.mjs tests/game-enemy-events.test.mjs
git commit -m "전투 몬스터 피격 경직 추가"
```

### Task 2: Render-visible global hit stop

**Files:**
- Modify: `src/game.js`
- Test: `tests/performance.test.mjs`
- Test: `tests/game-enemy-events.test.mjs`

**Interfaces:**
- Consumes: `definition.hitStop` and successful hits from `applyAttackHits`.
- Produces: `PixelRPG.requestHitStop(duration): boolean`, `PixelRPG.runSimulationFrame(frameSeconds): number`, and `hitStopRemaining` state.

- [ ] **Step 1: Write failing frame-loop tests**

```js
test("히트 스톱 중에는 고정 업데이트 없이 실제 프레임 시간만 소비한다", () => {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, { hitStopRemaining: 0.035, accumulator: 0, fixedDt: 1 / 60 });
  let updates = 0;
  game.fixedUpdate = () => { updates += 1; };
  assert.equal(game.runSimulationFrame(1 / 60), 0);
  assert.equal(updates, 0);
  assert.ok(game.hitStopRemaining > 0);
});

test("한 공격이 여러 적을 맞혀도 히트 스톱은 가장 긴 값 하나만 유지한다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.hitStopRemaining = 0.065;
  game.requestHitStop(0.035);
  assert.equal(game.hitStopRemaining, 0.065);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/performance.test.mjs tests/game-enemy-events.test.mjs`

Expected: FAIL because frame-level hit-stop methods are absent.

- [ ] **Step 3: Implement hit-stop timing in the animation-frame loop**

```js
requestHitStop(duration) {
  if (!(duration > 0)) return false;
  this.hitStopRemaining = Math.max(this.hitStopRemaining, duration);
  return true;
}
```

Move fixed-step consumption into `runSimulationFrame(frameSeconds)`. When hit stop is active at frame start, consume real frame time before adding only the leftover time to the accumulator. If a hit starts hit stop during a fixed update, stop further catch-up updates and discard the accumulated backlog. Continue calling `render(...)`, `measurePerformance(...)`, and `requestAnimationFrame(...)` every browser frame.

- [ ] **Step 4: Connect basic and strong hit-stop durations**

Add `hitStop: 0.035` to the basic attack and `hitStop: 0.065` to the strong attack. `applyAttackHits` records whether at least one target was actually damaged and calls `requestHitStop` once after the target loop.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/performance.test.mjs tests/game-enemy-events.test.mjs tests/combat.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the independently working hit stop**

```bash
git add src/game.js src/combat.js tests/performance.test.mjs tests/game-enemy-events.test.mjs
git commit -m "전투 명중 히트 스톱 추가"
```

### Task 3: Fixed-update and FPS measurement optimization

**Files:**
- Modify: `src/config.js`
- Modify: `src/game.js`
- Test: `tests/performance.test.mjs`

**Interfaces:**
- Consumes: frame seconds from `loop(timestamp)`.
- Produces: 60 Hz `fixedDt`, five-step catch-up ceiling, and elapsed-time-weighted FPS reporting.

- [ ] **Step 1: Write failing simulation and FPS tests**

```js
test("30 FPS 렌더 프레임은 60 Hz 시뮬레이션을 정확히 두 번 진행한다", () => {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, { hitStopRemaining: 0, accumulator: 0, fixedDt: 1 / 60 });
  let updates = 0;
  game.fixedUpdate = () => { updates += 1; };
  assert.equal(game.runSimulationFrame(1 / 30), 2);
  assert.equal(updates, 2);
});

test("불규칙 프레임의 FPS는 순간 FPS 평균이 아니라 총 경과 시간으로 계산한다", () => {
  assert.equal(Math.round(averageFpsFromFrameSeconds([1 / 60, 1 / 20])), 30);
});
```

- [ ] **Step 2: Run the performance tests and verify RED**

Run: `node --test tests/performance.test.mjs`

Expected: FAIL because the 60 Hz loop behavior and elapsed-time FPS helper are absent.

- [ ] **Step 3: Implement the minimal cadence changes**

Set `SIMULATION_HZ: 60`, cap catch-up at five fixed updates, and calculate displayed FPS as `sampleCount / totalFrameSeconds`. Keep the existing 0.1-second incoming frame clamp.

- [ ] **Step 4: Correct adaptive quality thresholds for a 60 FPS browser target**

Treat sustained FPS below 45 as low, sustained FPS above 57 as recoverable, lower render scale after 2 seconds, and restore one step only after 8 seconds. Keep `MAX_DPR: 1.5`, `MIN_RENDER_SCALE: 0.75`, and 0.25 scale steps.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/performance.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the cadence optimization**

```bash
git add src/config.js src/game.js tests/performance.test.mjs
git commit -m "게임 루프를 60Hz 성능 기준으로 최적화"
```

### Task 4: Cached minimap and change-only HUD writes

**Files:**
- Modify: `src/game.js`
- Test: `tests/performance.test.mjs`

**Interfaces:**
- Consumes: the current `worldLayer`, visible minimap canvas, enemies, remote players, and player.
- Produces: cached 220×140 minimap pixels, `renderMinimap(timestamp)`, and idempotent `updateHud()` writes.

- [ ] **Step 1: Write failing minimap cache test**

```js
test("미니맵은 월드 배경을 한 번만 축소하고 점은 100ms마다 갱신한다", () => {
  const calls = { drawImage: 0, putImageData: 0 };
  const context = {
    clearRect() {}, fillRect() {},
    drawImage() { calls.drawImage += 1; },
    getImageData() { return { cached: true }; },
    putImageData() { calls.putImageData += 1; },
  };
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, minimapFixture(context));
  game.drawMinimapBase();
  game.renderMinimap(0);
  game.renderMinimap(50);
  game.renderMinimap(100);
  assert.equal(calls.drawImage, 1);
  assert.equal(calls.putImageData, 2);
});
```

- [ ] **Step 2: Write failing HUD idempotence test**

Build real property setters that count `textContent` and `style.transform` writes. Call `updateHud()` twice with unchanged HP, MP, respawn state, and formatted cooldown. Assert the second call causes zero additional writes, then change HP and assert only HP text and bar values update.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/performance.test.mjs`

Expected: FAIL because the live minimap redraws the 4320×3600 world each render and HUD assignments repeat unchanged values.

- [ ] **Step 4: Implement the minimap cache and 10 Hz refresh**

`drawMinimapBase()` draws the large world layer once and caches `getImageData(0, 0, 220, 140)`. `renderMinimap(timestamp)` returns before 100 ms has elapsed, restores the small cached pixels with `putImageData`, and draws only enemy/player dots. If pixel caching is unavailable, keep the existing `drawImage` fallback for compatibility.

- [ ] **Step 5: Implement change-only HUD helpers**

```js
function setTextIfChanged(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function setStyleIfChanged(element, property, value) {
  if (element.style[property] !== value) element.style[property] = value;
}
```

Use the helpers for HP, MP, bars, and strong-attack cooldown text. Toggle the unavailable class only if `classList.contains("unavailable")` differs from the desired state.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/performance.test.mjs tests/enemy-rendering.test.mjs tests/game-shop.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the render and DOM optimization**

```bash
git add src/game.js tests/performance.test.mjs
git commit -m "미니맵과 HUD 반복 렌더 비용 절감"
```

### Task 5: Regression verification and Pages playtest

**Files:**
- Modify only if a failing verification exposes a regression covered by a new failing test.

**Interfaces:**
- Consumes: all previous task deliverables.
- Produces: merge-ready evidence for combat behavior, rendering, syntax, and cloud FPS.

- [ ] **Step 1: Run all automated tests**

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Check every source module syntax**

Run one `node --check` invocation per `src/*.js` file.

Expected: every command exits 0.

- [ ] **Step 3: Check the patch for whitespace errors**

Run: `git diff --check origin/main...HEAD`

Expected: no output and exit 0.

- [ ] **Step 4: Run the browser-game playtest checklist**

Serve or deploy the exact verified build. In `?qa=1`, test a normal and strong hit against a summoned monster, verify the monster cannot move or deal contact damage during stun, confirm rendering continues during hit stop, and verify death, split, teleport, burrow, camouflage, and spore behaviors resume correctly after feedback ends.

- [ ] **Step 5: Compare cloud FPS in controlled scenarios**

Record FPS over at least five seconds in the village, the 14-monster coast, and a QA-summoned close combat. Compare against the pre-change observations from the same browser session: village 58–60, coast 59, and active combat 53–58 FPS, while also reporting the earlier variable 16–27 FPS observation separately.

- [ ] **Step 6: Request code review and finish the branch**

Use `superpowers:requesting-code-review`, fix any blocking findings with a new failing test, rerun verification, then use `superpowers:finishing-a-development-branch` for the user-approved push, PR, automatic verification, merge, and Pages validation flow.
