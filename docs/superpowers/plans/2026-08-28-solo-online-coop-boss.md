# 솔로·온라인 모드와 지역별 협동 보스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Pages 입장 화면에서 솔로 또는 최대 10명 온라인 공개방을 선택하고, 일반 몬스터는 개인 사냥으로 유지하면서 세 지역 협동 보스만 참가자가 함께 공격·처치·보상받게 한다.

**Architecture:** 세 직업 구현을 선행 기반으로 삼고, 플레이 모드·전송 정책·방 슬롯·협동 보스 상태를 순수 모듈로 분리한다. 온라인에서는 고정 슬롯으로 10명을 제한하고 한 브라우저가 lease 기반 보스 권한을 소유하며, 다른 브라우저는 검증 가능한 공격 요청만 보낸다. 솔로와 연결 해제 후 fallback은 Firebase listener를 모두 제거하고 기존 로컬 시뮬레이션을 그대로 유지한다.

**Tech Stack:** 정적 HTML/CSS, Canvas 2D, 네이티브 ES modules, Firebase Authentication·Realtime Database, Node.js 24 내장 테스트 러너(`node:test`), Playwright smoke tests, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-28-solo-online-coop-boss-design.md`

## Global Constraints

- `feature/class-system-21-weapons`의 검사·궁수·마법사, 직업별 무기 21종, `src/game-20260828-classes.js`, `src/main-20260828-classes.js`가 먼저 병합되어 있어야 한다.
- 공식 플레이 주소와 정적 자산 제공자는 GitHub Pages다. Firebase Hosting은 완료 조건에 포함하지 않는다.
- 솔로 모드는 Firebase SDK import·익명 인증·Database 읽기와 쓰기를 모두 0건으로 유지한다.
- 온라인 공개방은 `public` 하나이며 고정 슬롯 열 개를 넘지 않는다.
- 일반 몬스터는 로컬 전용이다. Firebase에는 해안·활화산·태고의 숲 협동 보스만 기록한다.
- 플레이어 이동과 보스 정기 상태는 각각 초당 2회를 넘지 않는다. 즉시 전송은 이동 시작·정지·방향·맵·직업·장비·보스 체력·phase·사망 변화에만 사용한다.
- 보스 피해량은 공격 요청에서 받지 않고 관리자가 `attackDefinition()`으로 계산한다.
- 유효한 피해를 한 번 이상 준 모든 참가자에게 같은 보상을 encounter별 한 번 지급한다.
- 보스 재등장은 처치 후 정확히 180초다.
- 미수령 보상과 처치된 encounter 관련 데이터는 24시간 후 만료한다.
- 온라인 연결이 5초 연속 끊기면 현재 위치·HP·MP·진행·일반 몬스터를 유지한 채 솔로로 전환하며 같은 세션에서 자동 재연결하지 않는다.
- 모드는 입장 화면에서만 선택하며 게임 중 수동 모드 전환 UI를 추가하지 않는다.
- 각 구현 작업은 요구사항 때문에 실패하는 테스트를 먼저 확인하고 최소 구현 후 대상·전체 테스트를 통과시킨다.
- 기존 사용자 변경과 `feature/class-system-21-weapons` worktree를 보존하고 구현 시 별도 worktree를 만든다.
- 엔트리 파일을 갱신할 때 실제 파일명을 `main-20260828-coop.js`, `game-20260828-coop.js`로 바꾸고 HTML·Firebase cache 회귀 테스트를 함께 수정한다.

---

## File and Interface Map

### 새 순수 모듈

- `src/play-mode.js`: `PLAY_MODES`, `DEFAULT_PLAY_MODE`, `normalizePlayMode()`, `readStoredPlayMode()`, `storePlayMode()`, `validatePlayMode()`
- `src/network-publish-policy.js`: `createPublishPolicyState()`, `nextPublishDecision()`
- `src/coop-boss-data.js`: 지역별 보스 정의, `getCoopBossForMap()`, `scaledBossMaxHp()`, `bossRespawnAt()`
- `src/coop-boss-state.js`: encounter 생성·정규화, authority lease, 공격 검증·피해, reward claim 순수 함수

### 새 Firebase·게임 조정 모듈

- `src/room-capacity.js`: 고정 슬롯 10개의 획득·반납
- `src/coop-boss-network.js`: 보스 Firebase 경로, listener, authority transaction, 공격·보상·정리
- `src/coop-boss-controller.js`: 로컬 관리자 시뮬레이션, 원격 보간, 게임과 네트워크 연결

### 기존 파일

- `src/network.js`: 요청 모드에 따른 adapter, 맵 쿼리, 2Hz 전송, 연결 해제 callback, 슬롯 생명주기
- `src/network-state.js`: 플레이어 스냅샷 정규화 유지
- `src/game-20260828-classes.js`: 세션 모드, 솔로 fallback, 협동 보스 공격·렌더·보상 통합
- `src/main-20260828-classes.js`: 입장 모드 선택과 UI 전달
- `src/enemies.js`: 기존 일반 몬스터 경로를 보존하고 보스 렌더에 필요한 공개 helper만 추가
- `src/player-progression.js`: 고정 협동 보스 보상 적용 helper
- `index.html`, `styles.css`: 모드 카드, 온라인 UI wrapper, 협동 보스 HUD
- `database.rules.json`: 슬롯·맵 인덱스·보스·공격·보상 규칙
- `README.md`, `FIREBASE_SETUP.md`: 운영 모드·무료 사용량·협동 보스 설명

---

## Task 1: 플레이 모드 데이터와 입장 검증

**Files:**

- Create: `src/play-mode.js`
- Create: `tests/play-mode.test.mjs`
- Modify: `src/class-selection.js`
- Modify: `tests/class-selection.test.mjs`

**Interfaces:**

- Consumes: 브라우저 `Storage`와 기존 `validateEntrySelection(nickname, classId)`
- Produces: `validateEntrySelection(nickname, classId, playMode)`이 성공 시 `{ ok: true, nickname, classId, playMode }` 반환

- [ ] **Step 1: 허용 모드·기본 솔로·선호값·통합 입장 검증 실패 테스트 작성**

`tests/play-mode.test.mjs`를 다음 계약으로 작성한다.

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAY_MODE,
  PLAY_MODES,
  normalizePlayMode,
  readStoredPlayMode,
  storePlayMode,
} from "../src/play-mode.js";

function memoryStorage(value = null) {
  return {
    value,
    getItem() { return this.value; },
    setItem(_key, next) { this.value = next; },
  };
}

test("플레이 모드는 솔로와 온라인만 허용하고 기본값은 솔로다", () => {
  assert.deepEqual(PLAY_MODES, ["solo", "online"]);
  assert.equal(DEFAULT_PLAY_MODE, "solo");
  assert.equal(normalizePlayMode("online"), "online");
  assert.equal(normalizePlayMode("invalid"), "solo");
});

test("마지막 유효 모드를 저장하고 잘못된 저장값은 솔로로 읽는다", () => {
  const storage = memoryStorage("invalid");
  assert.equal(readStoredPlayMode(storage), "solo");
  assert.equal(storePlayMode(storage, "online"), true);
  assert.equal(readStoredPlayMode(storage), "online");
});
```

`tests/class-selection.test.mjs`에 다음 기대를 추가한다.

```js
assert.deepEqual(validateEntrySelection("모험가", "mage", "online"), {
  ok: true,
  nickname: "모험가",
  classId: "mage",
  playMode: "online",
});
assert.deepEqual(validateEntrySelection("모험가", "mage", "invalid"), {
  ok: false,
  field: "playMode",
  error: "플레이 모드를 선택해 주세요.",
});
```

- [ ] **Step 2: 대상 테스트를 실행해 모듈과 세 번째 인자가 없어 실패하는지 확인**

Run: `node --test tests/play-mode.test.mjs tests/class-selection.test.mjs`

Expected: FAIL — `src/play-mode.js` 부재 또는 `playMode`가 검증 결과에 없다.

- [ ] **Step 3: 플레이 모드 순수 모듈과 입장 검증 구현**

`src/play-mode.js`의 공개 API를 다음으로 고정한다.

```js
export const PLAY_MODES = Object.freeze(["solo", "online"]);
export const DEFAULT_PLAY_MODE = "solo";
export const PLAY_MODE_PREFERENCE_KEY = "pixel_world_play_mode";

export function normalizePlayMode(value) {
  return PLAY_MODES.includes(value) ? value : DEFAULT_PLAY_MODE;
}

export function readStoredPlayMode(storage) {
  try { return normalizePlayMode(storage?.getItem?.(PLAY_MODE_PREFERENCE_KEY)); }
  catch { return DEFAULT_PLAY_MODE; }
}

export function storePlayMode(storage, value) {
  if (!PLAY_MODES.includes(value)) return false;
  try { storage?.setItem?.(PLAY_MODE_PREFERENCE_KEY, value); return true; }
  catch { return false; }
}

export function validatePlayMode(value) {
  return PLAY_MODES.includes(value)
    ? { ok: true, playMode: value }
    : { ok: false, field: "playMode", error: "플레이 모드를 선택해 주세요." };
}
```

`validateEntrySelection()`은 세 번째 인자를 검증하고 성공 결과에 `playMode`를 포함한다. 기존 두 인자 호출은 테스트 호환을 위해 `DEFAULT_PLAY_MODE`를 기본값으로 사용한다.

- [ ] **Step 4: 대상·전체 테스트 통과 확인**

Run: `node --test tests/play-mode.test.mjs tests/class-selection.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/play-mode.js src/class-selection.js tests/play-mode.test.mjs tests/class-selection.test.mjs
git commit -m "feat: 솔로와 온라인 입장 모드 정의"
```

---

## Task 2: 입장 화면 모드 카드와 온라인 UI 가시성

**Files:**

- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main-20260828-classes.js`
- Create: `tests/play-mode-ui.static.test.cjs`
- Modify: `tests/entry-ui.static.test.cjs`

**Interfaces:**

- Consumes: Task 1의 `readStoredPlayMode()`, `storePlayMode()`, `validateEntrySelection()`
- Produces: `PixelRPG.enter(nickname, classId, playMode)` 호출과 `#chatPanel`, `#networkBadge`, `#onlinePresence`, `#coopBossHud` DOM 참조

- [ ] **Step 1: 입장 카드·접근성·온라인 UI wrapper 실패 테스트 작성**

`tests/play-mode-ui.static.test.cjs`에서 `index.html`과 엔트리 모듈을 읽어 다음을 검증한다.

```js
test("입장 화면은 솔로와 온라인 단일 선택 카드를 제공한다", () => {
  assert.match(html, /id="playModeSelection"[^>]*role="radiogroup"/);
  assert.match(html, /data-play-mode="solo"[^>]*aria-checked="false"/);
  assert.match(html, /data-play-mode="online"[^>]*aria-checked="false"/);
  assert.match(html, /id="playModeError"[^>]*role="alert"/);
});

test("온라인 전용 UI는 독립적으로 숨길 수 있다", () => {
  assert.match(html, /id="onlinePresence"/);
  assert.match(html, /id="coopBossHud"[^>]*hidden/);
  assert.match(main, /game\.enter\(selection\.nickname, selection\.classId, selection\.playMode\)/);
});
```

- [ ] **Step 2: 정적 테스트를 실행해 모드 UI 부재로 실패 확인**

Run: `node --test tests/play-mode-ui.static.test.cjs tests/entry-ui.static.test.cjs`

Expected: FAIL — `playModeSelection`, `onlinePresence`, `coopBossHud`가 없다.

- [ ] **Step 3: 모드 카드와 반응형 스타일 구현**

`index.html`에서 직업 선택 아래에 다음 의미 구조를 추가한다.

```html
<h2 id="playModeSelectionLabel" class="play-mode-selection-label">플레이 모드</h2>
<div id="playModeSelection" class="play-mode-grid" role="radiogroup"
     aria-labelledby="playModeSelectionLabel" aria-describedby="playModeError">
  <button type="button" class="play-mode-card" role="radio"
          data-play-mode="solo" aria-checked="false">
    <strong>솔로 플레이</strong><span>혼자 모험 · Firebase 미사용</span>
  </button>
  <button type="button" class="play-mode-card" role="radio"
          data-play-mode="online" aria-checked="false">
    <strong>온라인 플레이</strong><span>최대 10명 · 채팅 · 협동 보스</span>
  </button>
</div>
<p id="playModeError" class="form-error play-mode-error" role="alert"></p>
```

접속자 수 문구를 `<span id="onlinePresence" class="performance-meta">...</span>`로 감싸고 협동 보스 HUD를 기본 `hidden` 상태로 추가한다. `styles.css`는 데스크톱 2열, 520px 이하 1열, 선택 카드 `aria-checked="true"` 강조, reduced-motion 규칙을 제공한다.

- [ ] **Step 4: 엔트리 모듈에서 포인터·키보드 선택과 제출 연결**

직업 카드와 같은 roving tabindex 패턴을 모드 카드에 적용한다. `selectedPlayMode`는 `readStoredPlayMode(browserStorage)`로 시작하고 제출 성공 때 저장한다.

```js
const playModeCards = [...document.querySelectorAll("[data-play-mode]")];
let selectedPlayMode = readStoredPlayMode(browserStorage);

const selection = validateEntrySelection(
  nicknameInput.value,
  selectedClassId,
  selectedPlayMode,
);
storePlayMode(browserStorage, selection.playMode);
await game.enter(selection.nickname, selection.classId, selection.playMode);
```

Space·Enter·방향키·Home·End를 지원하고 모드 오류면 첫 모드 카드로 focus한다. 입장 버튼 문구는 직업 선택이 끝난 경우 `솔로로 시작` 또는 `온라인으로 접속`을 포함한다.

- [ ] **Step 5: 정적·전체 테스트 통과 확인**

Run: `node --test tests/play-mode-ui.static.test.cjs tests/entry-ui.static.test.cjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add index.html styles.css src/main-20260828-classes.js tests/play-mode-ui.static.test.cjs tests/entry-ui.static.test.cjs
git commit -m "feat: 입장 화면에 솔로와 온라인 선택 추가"
```

---

## Task 3: 모드별 네트워크 생성과 솔로 Firebase 0건 계약

**Files:**

- Modify: `src/network.js`
- Modify: `src/game-20260828-classes.js`
- Modify: `tests/network-chat-integration.test.mjs`
- Create: `tests/game-play-mode.test.mjs`

**Interfaces:**

- Consumes: `createNetworkAdapter(callbacks, dependencies)`와 Task 1의 `playMode`
- Produces: `createNetworkAdapter({ ...callbacks, playMode })`, `PixelRPG.sessionMode`, `PixelRPG.setSessionMode(mode, reason)`, `PixelRPG.fallbackToSolo(reason)`

- [ ] **Step 1: 솔로에서 Firebase loader를 호출하지 않는 실패 테스트 작성**

`tests/network-chat-integration.test.mjs`에 다음 테스트를 추가한다.

```js
test("솔로 adapter는 Firebase 모듈을 불러오지 않는다", async () => {
  let loads = 0;
  const adapter = await createNetworkAdapter(
    { playMode: "solo" },
    {
      firebaseConfig: { apiKey: "x", databaseURL: "https://example.invalid" },
      loadFirebaseModules: async () => { loads += 1; throw new Error("should not load"); },
    },
  );
  assert.equal(loads, 0);
  assert.equal(adapter.mode, "solo");
  assert.equal(adapter.uid, "local-player");
});
```

`tests/game-play-mode.test.mjs`는 가짜 UI로 다음을 검증한다.

```js
test("솔로 세션은 원격 상태와 온라인 UI를 비운다", () => {
  const game = createGameFixture();
  game.remotePlayers.set("remote", { uid: "remote" });
  game.chatMessages = [{ uid: "remote", text: "안녕" }];
  game.setSessionMode("solo", "selected");
  assert.equal(game.sessionMode, "solo");
  assert.equal(game.remotePlayers.size, 0);
  assert.deepEqual(game.chatMessages, []);
  assert.equal(game.ui.chatPanel.hidden, true);
  assert.equal(game.ui.onlinePresence.hidden, true);
  assert.equal(game.ui.networkBadge.hidden, true);
});
```

- [ ] **Step 2: 대상 테스트를 실행해 현재 항상 Firebase를 시도하는 동작으로 실패 확인**

Run: `node --test tests/network-chat-integration.test.mjs tests/game-play-mode.test.mjs`

Expected: FAIL — `playMode` 분기와 게임 세션 모드 API가 없다.

- [ ] **Step 3: offline adapter를 솔로 의미로 고정하고 Firebase 이전에 분기**

`createOfflineNetworkAdapter(mode = "solo", reason = "selected")`를 export하고 다음 공개 필드를 제공한다.

```js
return {
  mode,
  reason,
  uid: "local-player",
  publish: () => {},
  chat: createOfflineChatAdapter(),
  coopBoss: null,
  stop: async () => {},
};
```

`createNetworkAdapter()`는 callbacks에서 `playMode`를 읽고 첫 Firebase 설정 검사보다 먼저 다음 분기를 수행한다.

```js
if (playMode !== "online") {
  onStatusChanged?.("solo", "솔로");
  return createOfflineNetworkAdapter("solo", "selected");
}
```

- [ ] **Step 4: PixelRPG 세션 모드와 UI 계약 구현**

생성자에 `sessionMode = "solo"`를 추가하고 다음 메서드를 구현한다.

```js
setSessionMode(mode, reason = "selected") {
  this.sessionMode = mode === "online" ? "online" : "solo";
  const online = this.sessionMode === "online";
  this.ui.chatPanel.hidden = !online;
  this.ui.onlinePresence.hidden = !online;
  this.ui.networkBadge.hidden = !online;
  if (!online) {
    this.remotePlayers.clear();
    this.chatMessages = [];
    this.chat.setMode("offline", "솔로");
    this.receiveChatMessages([]);
    this.ui.playerCount.textContent = "1";
  }
  return { mode: this.sessionMode, reason };
}
```

`enter(nickname, classId, playMode = "solo")`는 `setSessionMode()` 후 adapter를 만든다. 온라인 요청이 offline adapter를 돌려주면 adapter의 `reason`으로 솔로를 확정하고 안내한다.

- [ ] **Step 5: 대상·전체 테스트 통과 확인**

Run: `node --test tests/network-chat-integration.test.mjs tests/game-play-mode.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/network.js src/game-20260828-classes.js tests/network-chat-integration.test.mjs tests/game-play-mode.test.mjs
git commit -m "feat: 솔로 세션에서 Firebase 연결 차단"
```

---

## Task 4: 2Hz 적응형 플레이어 전송과 현재 맵 쿼리

**Files:**

- Create: `src/network-publish-policy.js`
- Create: `tests/network-publish-policy.test.mjs`
- Modify: `src/config.js`
- Modify: `src/network.js`
- Modify: `tests/network-chat-integration.test.mjs`
- Modify: `database.rules.json`
- Modify: `tests/database-rules.test.mjs`

**Interfaces:**

- Consumes: `serializePlayerState(player, mapId)`, `document.visibilityState`, Firebase query API
- Produces: `nextPublishDecision(policy, snapshot, now, visible)`과 맵별 listener 재구독

- [ ] **Step 1: 2Hz·즉시 변경·30초 heartbeat·숨김 문서 정책 실패 테스트 작성**

`tests/network-publish-policy.test.mjs`를 다음 대표 경계값으로 작성한다.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createPublishPolicyState, nextPublishDecision } from "../src/network-publish-policy.js";

const moving = { x: 100, y: 100, dir: "right", moving: true, mapId: "coast", classId: "archer", equippedWeaponId: "training-bow" };

test("이동 위치는 500ms마다 전송한다", () => {
  let policy = createPublishPolicyState();
  let result = nextPublishDecision(policy, moving, 0, true);
  assert.equal(result.shouldPublish, true);
  policy = result.policy;
  assert.equal(nextPublishDecision(policy, { ...moving, x: 120 }, 499, true).shouldPublish, false);
  assert.equal(nextPublishDecision(policy, { ...moving, x: 130 }, 500, true).shouldPublish, true);
});

test("정지·방향·맵·직업·장비 변화는 즉시 전송한다", () => {
  const first = nextPublishDecision(createPublishPolicyState(), moving, 0, true);
  assert.equal(nextPublishDecision(first.policy, { ...moving, moving: false }, 10, true).shouldPublish, true);
  assert.equal(nextPublishDecision(first.policy, { ...moving, dir: "up" }, 10, true).shouldPublish, true);
  assert.equal(nextPublishDecision(first.policy, { ...moving, mapId: "forest" }, 10, true).shouldPublish, true);
});

test("정지는 30초 heartbeat만 보내고 숨김 문서는 보내지 않는다", () => {
  const idle = { ...moving, moving: false };
  const first = nextPublishDecision(createPublishPolicyState(), idle, 0, true);
  assert.equal(nextPublishDecision(first.policy, idle, 29999, true).shouldPublish, false);
  assert.equal(nextPublishDecision(first.policy, idle, 30000, true).shouldPublish, true);
  assert.equal(nextPublishDecision(first.policy, idle, 60000, false).shouldPublish, false);
});
```

- [ ] **Step 2: 정책 테스트를 실행해 모듈 부재로 실패 확인**

Run: `node --test tests/network-publish-policy.test.mjs`

Expected: FAIL — `network-publish-policy.js`가 없다.

- [ ] **Step 3: 순수 전송 정책 구현과 설정값 교체**

`src/config.js`에 다음 값을 고정한다.

```js
NETWORK_SEND_HZ: 2,
NETWORK_HEARTBEAT_MS: 30_000,
REMOTE_INTERPOLATION_MS: 500,
REMOTE_STALE_MS: 1_000,
CONNECTION_LOSS_GRACE_MS: 5_000,
```

`nextPublishDecision()`은 좌표를 signature에 넣지 않고 `dir`, `moving`, `mapId`, `classId`, `equippedWeaponId` 변화만 즉시성 판단에 사용한다. 이동 좌표는 500ms 주기, 정지는 30초 주기다. 반환값은 `{ shouldPublish, reason, policy }`로 고정한다.

- [ ] **Step 4: network adapter에 정책과 현재 맵 listener를 연결**

`publish()`은 `documentVisible` dependency를 받을 수 있게 하여 테스트 가능하게 만든다. 현재 `playersRef` 전체 listener는 다음 흐름으로 교체한다.

```js
function subscribePlayersForMap(mapId) {
  unsubscribePlayers?.();
  const playersRef = dbModule.ref(db, `rooms/${ROOM_ID}/players`);
  const query = dbModule.query(
    playersRef,
    dbModule.orderByChild("mapId"),
    dbModule.equalTo(mapId),
  );
  unsubscribePlayers = dbModule.onValue(query, snapshot => {
    onPlayersChanged?.(filterPlayersForMap(snapshot.val() || {}, uid, mapId));
  });
}
```

맵 변경 즉시 기존 playerRef의 `mapId`를 갱신하고 listener를 교체한다. stop에서 현재 unsubscribe 함수만 한 번 호출한다.

- [ ] **Step 5: mapId 인덱스 규칙과 테스트 추가**

`database.rules.json`의 players 노드에 다음을 추가한다.

```json
".indexOn": ["mapId"]
```

`tests/database-rules.test.mjs`에서 배열에 `mapId`가 있는지 검증한다.

- [ ] **Step 6: 대상·전체 테스트 통과 확인**

Run: `node --test tests/network-publish-policy.test.mjs tests/network-chat-integration.test.mjs tests/database-rules.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/network-publish-policy.js src/config.js src/network.js database.rules.json tests/network-publish-policy.test.mjs tests/network-chat-integration.test.mjs tests/database-rules.test.mjs
git commit -m "perf: 온라인 위치 동기화를 2Hz로 최적화"
```

---

## Task 5: 공개방 10개 슬롯과 정원 초과 솔로 fallback

**Files:**

- Create: `src/room-capacity.js`
- Create: `tests/room-capacity.test.mjs`
- Modify: `src/network.js`
- Modify: `tests/network-chat-integration.test.mjs`
- Modify: `database.rules.json`
- Modify: `tests/database-rules.test.mjs`

**Interfaces:**

- Consumes: Firebase `runTransaction`, `ref`, `onDisconnect`, `remove`
- Produces: `claimRoomSlot({ dbModule, db, roomId, uid })`, 반환 `{ ok, slotIndex, slotRef, disconnectHandle, release }`

- [ ] **Step 1: 첫 빈 슬롯·가득 찬 방·해제 실패 테스트 작성**

`tests/room-capacity.test.mjs`는 메모리 기반 가짜 Firebase transaction으로 다음을 고정한다.

```js
test("0부터 첫 빈 슬롯을 자기 UID로 확보한다", async () => {
  const fake = firebaseSlots({ 0: "other", 1: null });
  const result = await claimRoomSlot({ ...fake.dependencies, roomId: "public", uid: "me" });
  assert.equal(result.ok, true);
  assert.equal(result.slotIndex, 1);
  assert.equal(fake.values[1], "me");
});

test("열 슬롯이 모두 차면 room_full을 반환한다", async () => {
  const fake = firebaseSlots(Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index, `u${index}`])));
  const result = await claimRoomSlot({ ...fake.dependencies, roomId: "public", uid: "me" });
  assert.deepEqual(result, { ok: false, reason: "room_full" });
});

test("release는 자기 슬롯만 제거한다", async () => {
  const fake = firebaseSlots({ 0: null });
  const result = await claimRoomSlot({ ...fake.dependencies, roomId: "public", uid: "me" });
  await result.release();
  assert.equal(fake.values[0], null);
});
```

- [ ] **Step 2: 대상 테스트를 실행해 모듈 부재로 실패 확인**

Run: `node --test tests/room-capacity.test.mjs`

Expected: FAIL — `room-capacity.js`가 없다.

- [ ] **Step 3: 고정 슬롯 획득·onDisconnect·반납 구현**

```js
export const PUBLIC_ROOM_CAPACITY = 10;

export async function claimRoomSlot({ dbModule, db, roomId, uid }) {
  for (let slotIndex = 0; slotIndex < PUBLIC_ROOM_CAPACITY; slotIndex += 1) {
    const slotRef = dbModule.ref(db, `rooms/${roomId}/slots/${slotIndex}`);
    let claimedFromEmpty = false;
    const transaction = await dbModule.runTransaction(slotRef, current => {
      if (current != null) return;
      claimedFromEmpty = true;
      return uid;
    });
    if (!claimedFromEmpty || !transaction.committed || transaction.snapshot.val() !== uid) continue;
    const disconnectHandle = dbModule.onDisconnect(slotRef);
    await disconnectHandle.remove();
    let released = false;
    return {
      ok: true,
      slotIndex,
      slotRef,
      disconnectHandle,
      release: async () => {
        if (released) return;
        released = true;
        await disconnectHandle.cancel();
        await dbModule.remove(slotRef);
      },
    };
  }
  return { ok: false, reason: "room_full" };
}
```

transaction 함수는 값이 있는 슬롯에서 `undefined`를 반환해 해당 시도를 중단한다. 따라서 같은 UID가 이미 들어 있더라도 성공으로 간주하지 않고, 현재 세션에서 새로 `null → uid`로 commit한 슬롯만 소유한다.

- [ ] **Step 4: 익명 인증 직후 슬롯을 확보하고 실패 시 Firebase listener 생성 전에 종료**

`network.js`는 user UID를 얻은 직후 `claimRoomSlot()`을 호출한다. 실패하면 `onStatusChanged("solo", "온라인 정원 초과")` 후 `createOfflineNetworkAdapter("solo", "room_full")`을 반환한다. 성공한 adapter는 `slotIndex`를 공개하고 stop에서 player·chat보다 먼저 slot release를 호출한다.

- [ ] **Step 5: 슬롯 보안 규칙과 정적 evaluator 테스트 추가**

`database.rules.json`에 다음 의미를 추가한다.

```json
"slots": {
  ".read": "auth != null",
  "$slot": {
    ".write": "auth != null && $slot.matches(/^[0-9]$/) && (!data.exists() || data.val() === auth.uid) && (!newData.exists() || newData.val() === auth.uid)",
    ".validate": "newData.isString() && newData.val() === auth.uid"
  }
}
```

삭제 시 `.validate`가 실행되지 않는 Firebase 규칙 의미를 테스트 fixture에 반영한다. 슬롯 `10`, 다른 UID 덮어쓰기, 인증 없는 쓰기는 거부한다고 검증한다.

- [ ] **Step 6: 대상·전체 테스트 통과 확인**

Run: `node --test tests/room-capacity.test.mjs tests/network-chat-integration.test.mjs tests/database-rules.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/room-capacity.js src/network.js database.rules.json tests/room-capacity.test.mjs tests/network-chat-integration.test.mjs tests/database-rules.test.mjs
git commit -m "feat: 온라인 공개방을 10명으로 제한"
```

---

## Task 6: 협동 보스 정의와 encounter 순수 상태

**Files:**

- Create: `src/coop-boss-data.js`
- Create: `src/coop-boss-state.js`
- Create: `tests/coop-boss-data.test.mjs`
- Create: `tests/coop-boss-state.test.mjs`

**Interfaces:**

- Consumes: `attackDefinition(kind, classId, weaponId)`, `getWorldDefinition(mapId)`
- Produces: `createBossEncounter()`, `normalizeBossEncounter()`, `acquireAuthority()`, `renewAuthority()`, `validateBossAttack()`, `applyBossAttack()`, `createRewardClaims()`, `claimReward()`

- [ ] **Step 1: 세 보스·HP 배율·3분 재등장 실패 테스트 작성**

`tests/coop-boss-data.test.mjs`에 정확한 초기값을 고정한다.

```js
assert.deepEqual(getCoopBossForMap("coast"), {
  id: "coast-core-shark", mapId: "coast", name: "심해 코어 포식자",
  enemyKind: "pirate-shark", x: 2160, y: 2400,
  baseHp: 120, rewardExp: 150, rewardGold: 100,
});
assert.equal(getCoopBossForMap("village"), null);
assert.equal(scaledBossMaxHp(120, 1), 120);
assert.equal(scaledBossMaxHp(120, 10), 714);
assert.equal(bossRespawnAt(1_000), 181_000);
```

활화산과 숲 정의도 설계 문서 표의 모든 필드를 반복 검증한다.

- [ ] **Step 2: encounter·authority·공격·보상 경계 실패 테스트 작성**

`tests/coop-boss-state.test.mjs`에 다음을 포함한다.

```js
test("encounter는 참가자 수로 HP를 고정하고 6초 authority lease를 만든다", () => {
  const encounter = createBossEncounter(getCoopBossForMap("coast"), {
    encounterId: "coast-1000-a", partySize: 3, now: 1000,
    authorityUid: "host", authorityEpoch: 1,
  });
  assert.equal(encounter.maxHp, 252);
  assert.equal(encounter.hp, 252);
  assert.equal(encounter.leaseUntil, 7000);
  assert.equal(encounter.status, "alive");
});

test("살아 있는 lease는 빼앗지 못하고 만료 후 epoch를 올려 이전한다", () => {
  const current = fixtureEncounter({ authorityUid: "host", authorityEpoch: 4, leaseUntil: 7000 });
  assert.equal(acquireAuthority(current, { uid: "next", now: 6999 }).ok, false);
  const acquired = acquireAuthority(current, { uid: "next", now: 7000 });
  assert.equal(acquired.ok, true);
  assert.equal(acquired.encounter.authorityUid, "next");
  assert.equal(acquired.encounter.authorityEpoch, 5);
});

test("공격 피해는 요청값이 아니라 직업과 무기 정의로 계산하고 sequence를 중복 처리하지 않는다", () => {
  const context = bossAttackContext({ classId: "archer", weaponId: "training-bow", attackKind: "basic", sequence: 1 });
  const validated = validateBossAttack(context.request, context.validation);
  assert.equal(validated.ok, true);
  assert.equal(validated.damage, 0.9);
  const applied = applyBossAttack(context.encounter, validated, 2000);
  assert.equal(applied.encounter.hp, context.encounter.hp - 0.9);
  assert.equal(validateBossAttack(context.request, { ...context.validation, lastSequence: 1 }).reason, "duplicate_sequence");
});

test("모든 기여자는 동일 claim을 받고 한 번만 수령하며 24시간 뒤 만료한다", () => {
  const claims = createRewardClaims(fixtureDefeated({ contributors: { a: {}, b: {} }, defeatedAt: 1000 }), 1000);
  assert.deepEqual(Object.keys(claims), ["a", "b"]);
  assert.equal(claims.a.exp, claims.b.exp);
  const first = claimReward(claims.a, 2000);
  assert.equal(first.ok, true);
  assert.equal(claimReward(first.claim, 3000).reason, "already_claimed");
  assert.equal(claimReward(claims.b, 86_401_001).reason, "expired");
});
```

- [ ] **Step 3: 테스트를 실행해 두 모듈 부재로 실패 확인**

Run: `node --test tests/coop-boss-data.test.mjs tests/coop-boss-state.test.mjs`

Expected: FAIL — 보스 데이터와 상태 모듈이 없다.

- [ ] **Step 4: 불변 보스 정의와 수치 helper 구현**

`src/coop-boss-data.js`에 설계 표의 세 객체를 `Object.freeze()`로 정의한다. 상수는 다음과 같다.

```js
export const BOSS_STATE_SEND_HZ = 2;
export const AUTHORITY_LEASE_MS = 6_000;
export const AUTHORITY_RENEW_MS = 2_000;
export const BOSS_RESPAWN_MS = 180_000;
export const REWARD_RETENTION_MS = 86_400_000;
```

`scaledBossMaxHp(baseHp, partySize)`는 참가자 수를 1..10으로 clamp하고 `Math.round(baseHp * (1 + 0.55 * (size - 1)))`를 반환한다.

- [ ] **Step 5: encounter와 공격·보상 순수 함수 구현**

`validateBossAttack()`은 다음 순서로 거부한다.

1. encounter·boss·map 불일치
2. 요청 UID와 인증 UID 불일치
3. 플레이어가 같은 맵에 없거나 좌표가 유효하지 않음
4. `sequence <= lastSequence`
5. 직업·무기 조합 불일치
6. 공격별 cooldown 미경과
7. melee 사거리 또는 projectile 최대 사거리 밖

성공 시 `attackDefinition()`으로 `{ damage, cooldown, range }`를 만들어 반환한다. `applyBossAttack()`은 소수 첫째 자리에서 HP를 반올림하고 0 아래로 내리지 않으며 처음 0이 된 호출만 `defeatedAt`, `respawnAt`, `status: "defeated"`를 만든다.

- [ ] **Step 6: 대상·전체 테스트 통과 확인**

Run: `node --test tests/coop-boss-data.test.mjs tests/coop-boss-state.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/coop-boss-data.js src/coop-boss-state.js tests/coop-boss-data.test.mjs tests/coop-boss-state.test.mjs
git commit -m "feat: 지역별 협동 보스 상태 정의"
```

---

## Task 7: Firebase 협동 보스 adapter와 관리자 lease

**Files:**

- Create: `src/coop-boss-network.js`
- Create: `tests/coop-boss-network.test.mjs`
- Modify: `src/network.js`
- Modify: `tests/network-chat-integration.test.mjs`

**Interfaces:**

- Consumes: Task 6의 encounter·authority 함수와 Firebase Realtime Database API
- Produces: `createCoopBossNetwork(options)` 반환 객체의 `setMap()`, `ensureEncounter()`, `tryAcquireAuthority()`, `renewAuthority()`, `publishState()`, `sendAttack()`, `acknowledgeAttack()`, `sendPlayerDamage()`, `writeRewardClaims()`, `claimReward()`, `cleanupExpired()`, `stop()`

- [ ] **Step 1: 맵 listener·권한 transaction·공격 경로·stop 실패 테스트 작성**

`tests/coop-boss-network.test.mjs`는 가짜 Firebase API 호출 기록을 사용한다.

```js
test("setMap은 이전 listener를 해제하고 현재 지역 보스만 구독한다", async () => {
  const fake = firebaseBossFixture();
  const adapter = createCoopBossNetwork({ ...fake.options, uid: "a" });
  await adapter.setMap("coast");
  await adapter.setMap("forest");
  assert.deepEqual(fake.listenedPaths, [
    "rooms/public/bosses/coast",
    "rooms/public/bosses/forest",
  ]);
  assert.equal(fake.unsubscribeCount, 1);
});

test("공격은 자기 UID와 증가 sequence 경로에만 기록한다", async () => {
  const fake = firebaseBossFixture();
  const adapter = createCoopBossNetwork({ ...fake.options, uid: "archer" });
  await adapter.setMap("coast");
  await adapter.sendAttack({ sequence: 7, encounterId: "e", bossId: "coast-core-shark" });
  assert.equal(fake.updates[0].path, "rooms/public/bosses/coast/attacks/archer/7");
});

test("stop은 보스·공격·피해·claim listener와 timer를 한 번만 정리한다", async () => {
  const fake = firebaseBossFixture();
  const adapter = createCoopBossNetwork({ ...fake.options, uid: "a" });
  await adapter.setMap("volcano");
  await adapter.stop();
  await adapter.stop();
  assert.equal(fake.stopCount, fake.expectedListenerCount);
});
```

authority 테스트는 `runTransaction()` update 함수에 살아 있는 lease와 만료 lease snapshot을 각각 전달해 전자는 abort, 후자는 `authorityEpoch + 1`로 commit되는지 검증한다.

- [ ] **Step 2: 대상 테스트를 실행해 adapter 부재로 실패 확인**

Run: `node --test tests/coop-boss-network.test.mjs`

Expected: FAIL — `coop-boss-network.js`가 없다.

- [ ] **Step 3: 맵별 Firebase adapter 구현**

factory signature를 다음으로 고정한다.

```js
export function createCoopBossNetwork({
  dbModule, db, roomId, uid,
  onBossChanged = () => {},
  onAttackRequestsChanged = () => {},
  onPlayerDamageChanged = () => {},
  onRewardClaimsChanged = () => {},
  now = () => Date.now(),
})
```

모든 경로는 `rooms/${roomId}/bosses/${mapId}` 아래에 둔다. `setMap("village")`는 listener를 만들지 않고 `onBossChanged(null)`을 호출한다. 새 맵 전환 때 이전 listener·authority 갱신 timer를 정리한다.

- [ ] **Step 4: encounter 생성과 lease 획득·갱신 구현**

`ensureEncounter({ partySize })`는 `rooms/{roomId}/bosses/{mapId}/state` transaction에서 다음 경우에만 새 encounter를 만든다.

- 현재 값이 없음
- status가 `defeated` 또는 `respawning`이고 `respawnAt <= now`
- 현재 지역에 온라인 참가자가 한 명 이상 있음

`tryAcquireAuthority()`는 Task 6 `acquireAuthority()` 결과를 transaction에 사용한다. 성공하면 2초 interval 대신 재귀 `setTimeout()`으로 갱신하여 stop 때 명시적으로 해제한다. 갱신은 현재 UID·encounterId·epoch가 일치할 때만 lease를 6초 연장한다.

- [ ] **Step 5: 공격·피해·보상 쓰기와 처리 후 삭제 구현**

```js
sendAttack(request)              // attacks/{uid}/{sequence}
acknowledgeAttack(uid, sequence) // 처리한 단일 요청 remove
sendPlayerDamage(uid, event)     // playerDamage/{uid}/{eventId}
acknowledgePlayerDamage(eventId) // 자기 event remove
writeRewardClaims(encounterId, claims)
claimReward(encounterId, claim)  // rewardClaims/{encounterId}/{uid} transaction
```

모든 쓰기는 Promise를 반환하고 실패를 상위 controller에 전달한다. adapter 안에서 UI 알림이나 로컬 진행 저장을 수행하지 않는다.

- [ ] **Step 6: network adapter가 온라인일 때만 coopBoss adapter 노출**

`network.js`의 성공 반환값에 `coopBoss`를 추가하고 `stop()`에서 먼저 `coopBoss.stop()`을 호출한다. 솔로 adapter의 `coopBoss`는 `null`이다. callbacks에 `onBossChanged`, `onBossAttackRequestsChanged`, `onBossPlayerDamageChanged`, `onBossRewardClaimsChanged`를 추가한다.

- [ ] **Step 7: 대상·전체 테스트 통과 확인**

Run: `node --test tests/coop-boss-network.test.mjs tests/network-chat-integration.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add src/coop-boss-network.js src/network.js tests/coop-boss-network.test.mjs tests/network-chat-integration.test.mjs
git commit -m "feat: 협동 보스 Firebase adapter 추가"
```

---

## Task 8: 보스 관리자 시뮬레이션과 원격 보간

**Files:**

- Create: `src/coop-boss-controller.js`
- Create: `tests/coop-boss-controller.test.mjs`
- Modify: `src/enemies.js`
- Modify: `tests/enemies.test.mjs`
- Modify: `src/game-20260828-classes.js`
- Modify: `tests/game-enemy-events.test.mjs`

**Interfaces:**

- Consumes: `createEnemyInstance()`, `updateEnemies()`, `drawEnemy()`, Task 7 `coopBoss` adapter, 원격 플레이어 Map
- Produces: controller의 `setMap()`, `receiveSnapshot()`, `update()`, `draw()`, `targetableBoss()`, `isAuthority()`, `clear()`

- [ ] **Step 1: 관리자와 관전자 상태 전환·2Hz publish·보간 실패 테스트 작성**

`tests/coop-boss-controller.test.mjs`에 가짜 adapter와 시계를 사용한다.

```js
test("관리자는 보스 AI를 갱신하고 500ms마다 상태를 발행한다", async () => {
  const fixture = bossControllerFixture({ authorityUid: "me", uid: "me" });
  fixture.controller.receiveSnapshot(fixture.snapshot);
  fixture.controller.update(1 / 60, fixture.context, 0);
  fixture.controller.update(1 / 60, fixture.context, 499);
  assert.equal(fixture.published.length, 1);
  fixture.controller.update(1 / 60, fixture.context, 500);
  assert.equal(fixture.published.length, 2);
});

test("관전자는 AI를 실행하지 않고 수신 좌표 사이를 보간한다", () => {
  const fixture = bossControllerFixture({ authorityUid: "host", uid: "me" });
  fixture.controller.receiveSnapshot({ ...fixture.snapshot, x: 100, y: 100, updatedAt: 0 });
  fixture.controller.receiveSnapshot({ ...fixture.snapshot, x: 200, y: 100, updatedAt: 500 });
  fixture.controller.update(1 / 60, fixture.context, 250);
  assert.equal(fixture.controller.targetableBoss().x, 150);
  assert.equal(fixture.simulationCalls, 0);
});

test("authority가 바뀌면 마지막 확정 HP와 위치로 시뮬레이션을 이어간다", () => {
  const fixture = bossControllerFixture({ authorityUid: "old", uid: "me" });
  fixture.controller.receiveSnapshot({ ...fixture.snapshot, hp: 73, x: 800, y: 900 });
  fixture.controller.receiveSnapshot({ ...fixture.snapshot, authorityUid: "me", authorityEpoch: 2, hp: 73, x: 800, y: 900 });
  assert.equal(fixture.controller.isAuthority(), true);
  assert.equal(fixture.controller.targetableBoss().hp, 73);
});
```

- [ ] **Step 2: 대상 테스트를 실행해 controller 부재로 실패 확인**

Run: `node --test tests/coop-boss-controller.test.mjs tests/enemies.test.mjs`

Expected: FAIL — controller와 보스 렌더 helper가 없다.

- [ ] **Step 3: 기존 enemy 인스턴스를 보스 렌더 상태로 만드는 helper 추가**

`src/enemies.js`에 다음 helper를 추가한다.

```js
export function createBossEnemyView(definition, snapshot) {
  return createEnemyInstance(
    definition.enemyKind,
    { x: snapshot.x, y: snapshot.y },
    snapshot.bossId,
    {
      name: definition.name,
      hp: snapshot.hp,
      maxHp: snapshot.maxHp,
      scale: 1.55,
      targetable: snapshot.status === "alive",
      isCoopBoss: true,
    },
  );
}
```

`createEnemyInstance()`가 overrides의 `name`, `hp`, `maxHp`, `scale`, `isCoopBoss`를 마지막에 안전하게 반영하는지 테스트한다. 일반 몬스터 생성 결과는 기존 deepEqual 계약을 유지한다.

- [ ] **Step 4: controller 구현**

controller는 Firebase snapshot과 렌더 enemy view를 분리해 보관한다. 권한자인 경우 같은 지역의 로컬 플레이어와 `remotePlayers` 중 보스와 가장 가까운 생존자를 타깃으로 골라 `updateEnemies([bossView], target, dt, context)`를 실행한다. 관전자는 `fromX/fromY/targetX/targetY/snapshotAt`으로 500ms 보간한다.

```js
export function createCoopBossController({ uid, network, now = () => performance.now() }) {
  return new CoopBossController({ uid, network, now });
}
```

`update()`는 status가 alive가 아니거나 village이면 AI를 실행하지 않는다. `clear()`는 snapshot·view·authority timer·pending visuals를 비운다.

- [ ] **Step 5: PixelRPG 고정 업데이트와 렌더링 연결**

온라인 adapter 생성 후 controller를 만들고 맵 전환 때 `controller.setMap(mapId)`를 호출한다. `fixedUpdate()`에서 일반 `updateEnemies()` 뒤에 controller를 갱신하되 일반 `this.enemies` 배열에는 보스를 넣지 않는다. 렌더 순서는 일반 몬스터 뒤, 플레이어 앞이며 `controller.draw(ctx, cameraX, cameraY, alpha, { player })`를 사용한다.

- [ ] **Step 6: 대상·전체 테스트 통과 확인**

Run: `node --test tests/coop-boss-controller.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/coop-boss-controller.js src/enemies.js src/game-20260828-classes.js tests/coop-boss-controller.test.mjs tests/enemies.test.mjs tests/game-enemy-events.test.mjs
git commit -m "feat: 협동 보스 관리자 시뮬레이션 추가"
```

---

## Task 9: 세 직업 공격을 협동 보스 요청으로 연결

**Files:**

- Modify: `src/coop-boss-controller.js`
- Modify: `src/game-20260828-classes.js`
- Modify: `src/projectile-combat.js`
- Modify: `tests/coop-boss-controller.test.mjs`
- Create: `tests/game-coop-boss-combat.test.mjs`
- Modify: `tests/projectile-combat.test.mjs`

**Interfaces:**

- Consumes: `attackDefinition()`, `isTargetInAttackArc()`, `simulateProjectiles()`와 controller의 `targetableBoss()`
- Produces: `controller.requestHit({ attackKind, player, classId, weaponId, direction })`, 플레이어별 단조 증가 `sequence`

- [ ] **Step 1: 검사·궁수·마법사 보스 적중 실패 테스트 작성**

`tests/game-coop-boss-combat.test.mjs`에서 게임 fixture의 일반 몬스터는 비우고 협동 보스만 배치한다.

```js
for (const scenario of [
  { classId: "warrior", weaponId: "starter-sword", attackKind: "basic", delivery: "melee" },
  { classId: "archer", weaponId: "training-bow", attackKind: "basic", delivery: "projectile" },
  { classId: "mage", weaponId: "training-staff", attackKind: "strong", delivery: "projectile" },
]) {
  test(`${scenario.classId} ${scenario.attackKind} 적중은 보스 공격 요청을 한 번 보낸다`, () => {
    const fixture = coopCombatFixture(scenario);
    fixture.hitBoss();
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].classId, scenario.classId);
    assert.equal(fixture.requests[0].weaponId, scenario.weaponId);
    assert.equal(Object.hasOwn(fixture.requests[0], "damage"), false);
  });
}
```

동일 근접 swing과 동일 projectile가 보스에 두 번 겹쳐도 `attackId` 하나만 쓰고, 일반 몬스터 피해·처치 보상은 기존 경로를 유지한다고 검증한다.

- [ ] **Step 2: 테스트 실행으로 보스 적중 routing 부재 확인**

Run: `node --test tests/game-coop-boss-combat.test.mjs tests/projectile-combat.test.mjs`

Expected: FAIL — 보스가 공격 대상 목록에 없고 `requestHit()`이 없다.

- [ ] **Step 3: controller 공격 요청과 sequence 구현**

`requestHit()`은 다음 payload만 만든다.

```js
{
  attackId: `${uid}:${encounterId}:${sequence}`,
  sequence,
  uid,
  encounterId,
  bossId,
  mapId,
  classId,
  weaponId,
  attackKind,
  playerX: Math.round(player.x * 10) / 10,
  playerY: Math.round(player.y * 10) / 10,
  direction,
  createdAt: Date.now(),
}
```

controller는 encounter가 alive이고 같은 map일 때만 sequence를 증가시킨다. network 실패 시 로컬 보스 HP를 임의로 줄이지 않고 오류를 한 번만 상위에 알린다.

- [ ] **Step 4: 근접 공격 routing 구현**

`applyAttackHits()`에서 일반 몬스터 loop와 별도로 `targetableBoss()`에 `isTargetInAttackArc()`를 적용한다. 같은 swing의 `attackState`에 `coopBossRequested`를 기록해 한 번만 `requestHit()`을 호출한다. 로컬 damage number는 요청 피해가 아니라 보스 snapshot HP 감소를 받을 때 생성한다.

- [ ] **Step 5: 투사체 target과 보스 적중 routing 구현**

`simulateProjectiles()`의 context에 `bosses = []`를 추가하고 일반 enemies와 합쳐 충돌 후보를 만들되 hit event에 `targetType: "enemy" | "coop-boss"`를 포함한다. `applyProjectileHits()`는 `targetType === "coop-boss"`이면 `damageEnemy()`와 `recordEnemyKill()`을 호출하지 않고 controller 요청으로 보낸다. 관통 화살과 폭발 마법탄의 기존 hit ID 집합으로 같은 보스 중복 적중을 막는다.

- [ ] **Step 6: 관리자가 공격 요청을 검증·적용·acknowledge하도록 연결**

controller가 authority일 때 `onAttackRequestsChanged`에서 UID별 sequence 오름차순으로 처리한다. Task 6의 `validateBossAttack()`과 `applyBossAttack()`을 호출하고 성공·거부 모두 해당 요청을 `acknowledgeAttack()`으로 삭제한다. 성공한 첫 피해는 contributor를 상태 갱신에 포함한다.

- [ ] **Step 7: 대상·전체 테스트 통과 확인**

Run: `node --test tests/game-coop-boss-combat.test.mjs tests/coop-boss-controller.test.mjs tests/projectile-combat.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add src/coop-boss-controller.js src/game-20260828-classes.js src/projectile-combat.js tests/coop-boss-controller.test.mjs tests/game-coop-boss-combat.test.mjs tests/projectile-combat.test.mjs
git commit -m "feat: 세 직업 공격을 협동 보스에 연결"
```

---

## Task 10: 보스 공격과 참가자별 피해 이벤트

**Files:**

- Modify: `src/coop-boss-controller.js`
- Modify: `src/coop-boss-state.js`
- Modify: `src/game-20260828-classes.js`
- Modify: `tests/coop-boss-controller.test.mjs`
- Modify: `tests/game-coop-boss-combat.test.mjs`

**Interfaces:**

- Consumes: 관리자 보스 AI events, `PixelRPG.damagePlayer()`, Task 7 `sendPlayerDamage()`
- Produces: `createBossPlayerDamageEvent()`, `validateBossPlayerDamageEvent()`, 대상 브라우저의 eventId 중복 방지

- [ ] **Step 1: 가장 가까운 대상·피해 이벤트·중복 적용 실패 테스트 작성**

```js
test("관리자는 같은 지역의 가장 가까운 생존자를 보스 타깃으로 선택한다", () => {
  const target = selectBossTarget(
    { x: 100, y: 100 },
    [
      { uid: "far", x: 500, y: 500, hp: 100, mapId: "coast" },
      { uid: "near", x: 120, y: 110, hp: 100, mapId: "coast" },
      { uid: "dead", x: 105, y: 105, hp: 0, mapId: "coast" },
    ],
    "coast",
  );
  assert.equal(target.uid, "near");
});

test("같은 보스 피해 eventId는 플레이어 HP에 한 번만 적용한다", () => {
  const fixture = coopCombatFixture({ classId: "warrior" });
  const event = { eventId: "e:1", encounterId: "e", authorityEpoch: 2, damage: 12, createdAt: 1000 };
  fixture.game.receiveBossPlayerDamage([event]);
  fixture.game.receiveBossPlayerDamage([event]);
  assert.equal(fixture.game.player.hp, fixture.initialHp - 12);
});
```

- [ ] **Step 2: 대상 테스트를 실행해 피해 이벤트 경로 부재 확인**

Run: `node --test tests/coop-boss-controller.test.mjs tests/game-coop-boss-combat.test.mjs`

Expected: FAIL — 대상 선택과 playerDamage 소비 API가 없다.

- [ ] **Step 3: 보스 공격 이벤트 순수 검증 구현**

```js
export function createBossPlayerDamageEvent({ encounter, targetUid, damage, sequence, now }) {
  return {
    eventId: `${encounter.encounterId}:${encounter.authorityEpoch}:${sequence}`,
    encounterId: encounter.encounterId,
    bossId: encounter.bossId,
    targetUid,
    authorityEpoch: encounter.authorityEpoch,
    damage: Math.max(0, Math.min(50, Math.round(damage * 10) / 10)),
    createdAt: now,
  };
}
```

검증은 현재 encounter·target UID·authority epoch 일치, `0 < damage <= 50`, 생성 시각이 현재보다 5초 이상 미래가 아님을 요구한다.

- [ ] **Step 4: 관리자 AI event를 대상 UID 경로에 전송**

관리자 controller는 `updateEnemies()`가 만든 유효 공격 event 또는 contact 충돌을 player damage event로 바꿔 `sendPlayerDamage(targetUid, event)`를 호출한다. 같은 enemy attack ID는 기존 processed set과 별도 `processedBossAttackIds`로 한 번만 보낸다.

- [ ] **Step 5: 대상 브라우저에서 한 번만 HP 적용 후 acknowledge**

`PixelRPG.receiveBossPlayerDamage(events)`는 `processedBossPlayerDamageIds`를 검사하고 `damagePlayer(event.damage, bossView)`를 호출한다. 적용 성공·무적 무시 여부와 관계없이 event를 acknowledge해 재전송 loop를 막는다. 플레이어가 사망하면 기존 부활 흐름을 재사용한다.

- [ ] **Step 6: 대상·전체 테스트 통과 확인**

Run: `node --test tests/coop-boss-controller.test.mjs tests/game-coop-boss-combat.test.mjs tests/player-combat.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/coop-boss-controller.js src/coop-boss-state.js src/game-20260828-classes.js tests/coop-boss-controller.test.mjs tests/game-coop-boss-combat.test.mjs
git commit -m "feat: 협동 보스 공격 피해 동기화"
```

---

## Task 11: 동일 보상 1회·미수령 보상·3분 재등장

**Files:**

- Modify: `src/player-progression.js`
- Modify: `tests/player-progression.test.mjs`
- Modify: `src/coop-boss-controller.js`
- Modify: `src/coop-boss-network.js`
- Modify: `src/game-20260828-classes.js`
- Create: `tests/game-coop-boss-reward.test.mjs`
- Modify: `tests/coop-boss-network.test.mjs`

**Interfaces:**

- Consumes: Task 6 reward claim, `grantProgressReward()`, 브라우저 `saveProgress()`
- Produces: `grantCoopBossReward(progress, bossDefinition)`, `PixelRPG.receiveBossRewardClaims()`, 24시간 cleanup

- [ ] **Step 1: 고정 보상과 레벨업 실패 테스트 작성**

`tests/player-progression.test.mjs`에 다음을 추가한다.

```js
test("협동 보스 보상은 정의된 EXP와 Gold를 그대로 한 번 적용한다", () => {
  const progress = { ...createInitialProgress(), exp: 90, gold: 10 };
  const result = grantCoopBossReward(progress, getCoopBossForMap("coast"));
  assert.equal(result.rewardExp, 150);
  assert.equal(result.rewardGold, 100);
  assert.equal(result.progress.level, 2);
  assert.equal(result.progress.exp, 140);
  assert.equal(result.progress.gold, 110);
});
```

`tests/game-coop-boss-reward.test.mjs`는 두 참가자 contributor가 같은 수치의 claim을 받고 각자 한 번만 저장하는지 검증한다.

- [ ] **Step 2: 저장 실패·재시도·만료·재등장 실패 테스트 작성**

```js
test("브라우저 저장 실패 시 원격 claim을 완료하지 않아 다음 입장에서 재시도한다", async () => {
  const fixture = rewardFixture({ saveOk: false, now: 2000 });
  await fixture.game.receiveBossRewardClaims([fixture.eligibleClaim]);
  assert.equal(fixture.claimWrites.length, 0);
});

test("24시간이 지난 미수령 보상은 지급하지 않고 만료 처리한다", async () => {
  const fixture = rewardFixture({ now: 86_401_001 });
  await fixture.game.receiveBossRewardClaims([{ ...fixture.eligibleClaim, expiresAt: 86_401_000 }]);
  assert.equal(fixture.game.progress.gold, fixture.initialGold);
  assert.equal(fixture.expiredWrites.length, 1);
});

test("보스는 처치 후 179999ms에는 없고 180000ms에 새 encounter로 재등장한다", async () => {
  const fixture = respawnFixture({ defeatedAt: 1000 });
  assert.equal(await fixture.ensureAt(180999), null);
  assert.notEqual((await fixture.ensureAt(181000)).encounterId, fixture.oldEncounterId);
});
```

- [ ] **Step 3: 테스트를 실행해 보상 통합 부재로 실패 확인**

Run: `node --test tests/player-progression.test.mjs tests/game-coop-boss-reward.test.mjs tests/coop-boss-network.test.mjs`

Expected: FAIL — 협동 보상과 claim 소비 API가 없다.

- [ ] **Step 4: 협동 보상 helper 구현**

```js
export function grantCoopBossReward(progress, bossDefinition) {
  const result = grantProgressReward(progress, {
    exp: bossDefinition.rewardExp,
    gold: bossDefinition.rewardGold,
  });
  return {
    ...result,
    bossId: bossDefinition.id,
    label: bossDefinition.name,
    rewardExp: bossDefinition.rewardExp,
    rewardGold: bossDefinition.rewardGold,
  };
}
```

- [ ] **Step 5: 사망 원자 갱신 뒤 contributor claim 생성**

관리자만 `status: "alive" → "defeated"` transaction 성공 결과에서 `createRewardClaims()`를 호출한다. claim은 contributor UID마다 다음 필드를 가진다.

```js
{
  encounterId, bossId, uid,
  exp, gold,
  eligible: true,
  claimedAt: null,
  expiresAt: defeatedAt + 86_400_000,
}
```

여러 관리자가 handoff 경계에서 write를 시도해도 claim 경로는 encounterId·UID로 고정하고 기존 값이 있으면 덮어쓰지 않는다.

- [ ] **Step 6: 로컬 저장 성공 후에만 claim 완료**

`receiveBossRewardClaims()`는 자기 UID의 eligible·미수령·미만료 claim만 처리한다. 먼저 `grantCoopBossReward()`, HUD 갱신, `persistProgress()`를 수행하고 저장 성공일 때만 claim transaction으로 `claimedAt`을 기록한다. 성공 알림은 `심해 코어 포식자 협동 처치! EXP +150 · Gold +100` 형식으로 한 번 표시한다.

- [ ] **Step 7: 3분 재등장과 24시간 제한 cleanup 구현**

`ensureEncounter()`는 `respawnAt <= now`이고 같은 지역 player query 결과가 한 명 이상일 때만 새 encounter를 만든다. `cleanupExpired()`은 다음 경로만 삭제한다.

- `expiresAt <= now`인 reward claim
- `defeatedAt + 24시간 <= now`인 과거 encounter 부속 event
- 생성 후 10초 지난 처리 완료 attack과 playerDamage

cleanup은 authority 획득 직후와 온라인 입장 시 한 번 실행하며 interval을 만들지 않는다.

- [ ] **Step 8: 대상·전체 테스트 통과 확인**

Run: `node --test tests/player-progression.test.mjs tests/game-coop-boss-reward.test.mjs tests/coop-boss-network.test.mjs tests/coop-boss-state.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 9: 커밋**

```bash
git add src/player-progression.js src/coop-boss-controller.js src/coop-boss-network.js src/game-20260828-classes.js tests/player-progression.test.mjs tests/game-coop-boss-reward.test.mjs tests/coop-boss-network.test.mjs
git commit -m "feat: 협동 보스 동일 보상과 재등장 추가"
```

---

## Task 12: 연결 해제 5초 후 솔로 자동 전환

**Files:**

- Modify: `src/network.js`
- Modify: `src/game-20260828-classes.js`
- Modify: `tests/network-chat-integration.test.mjs`
- Modify: `tests/game-play-mode.test.mjs`

**Interfaces:**

- Consumes: Firebase `/.info/connected`, `C.CONNECTION_LOSS_GRACE_MS`, Task 3 `fallbackToSolo()`
- Produces: `onConnectionLost(reason)` callback과 idempotent 온라인 resource teardown

- [ ] **Step 1: 초기 false·일시 끊김·5초 끊김 실패 테스트 작성**

가짜 timer를 사용해 다음 상태 전이를 고정한다.

```js
test("온라인이 된 적 없는 초기 connected=false는 솔로 전환하지 않는다", async () => {
  const fixture = connectedFixture();
  fixture.emit(false);
  fixture.advance(6000);
  assert.deepEqual(fixture.lostReasons, []);
});

test("온라인 이후 5초 안에 재연결되면 온라인을 유지한다", async () => {
  const fixture = connectedFixture();
  fixture.emit(true);
  fixture.emit(false);
  fixture.advance(4999);
  fixture.emit(true);
  fixture.advance(2);
  assert.deepEqual(fixture.lostReasons, []);
});

test("온라인 이후 5초 연속 끊기면 한 번만 connection_lost를 전달한다", async () => {
  const fixture = connectedFixture();
  fixture.emit(true);
  fixture.emit(false);
  fixture.advance(5000);
  fixture.advance(5000);
  assert.deepEqual(fixture.lostReasons, ["connection_lost"]);
});
```

- [ ] **Step 2: 대상 테스트를 실행해 현재 무한 재연결 표시로 실패 확인**

Run: `node --test tests/network-chat-integration.test.mjs tests/game-play-mode.test.mjs`

Expected: FAIL — 연결 끊김 grace와 솔로 callback이 없다.

- [ ] **Step 3: network adapter에 연결 상태 machine 구현**

상태는 `everConnected`, `disconnectTimer`, `connectionLostDelivered` 세 값으로 제한한다. `connected=true`면 timer를 취소하고 `everConnected=true`로 둔다. 이후 false가 되면 5초 timer를 만들고 만료 시 `onConnectionLost("connection_lost")`를 한 번 호출한다. stop은 timer를 취소한다.

- [ ] **Step 4: PixelRPG fallbackToSolo 구현**

```js
async fallbackToSolo(reason) {
  if (this.sessionMode !== "online") return false;
  const network = this.network;
  this.network = createOfflineNetworkAdapter("solo", reason);
  await network?.stop();
  this.coopBossController?.clear();
  this.coopBossController = null;
  this.setSessionMode("solo", reason);
  this.notify(reason === "room_full"
    ? "온라인 인원이 가득 차 솔로 모드로 시작합니다."
    : "온라인 연결이 끊겨 솔로 모드로 전환되었습니다.");
  return true;
}
```

현재 player·progress·enemies·mapId·HP·MP는 수정하지 않는다. `network` 참조를 먼저 offline adapter로 교체해 teardown 중 재진입을 막는다.

- [ ] **Step 5: 대상·전체 테스트 통과 확인**

Run: `node --test tests/network-chat-integration.test.mjs tests/game-play-mode.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/network.js src/game-20260828-classes.js tests/network-chat-integration.test.mjs tests/game-play-mode.test.mjs
git commit -m "feat: 온라인 연결 해제 시 솔로 전환"
```

---

## Task 13: 협동 보스 Firebase 보안 규칙

**Files:**

- Modify: `database.rules.json`
- Modify: `tests/database-rules.test.mjs`
- Create: `tests/coop-boss-rules.test.mjs`
- Modify: `FIREBASE_SETUP.md`

**Interfaces:**

- Consumes: `rooms/public/bosses/{mapId}` 데이터 구조와 Firebase `auth`, `data`, `newData`, `root`, `now`
- Produces: 인증·authority·소유 UID·값 범위를 강제하는 Realtime Database rules

- [ ] **Step 1: state·attack·playerDamage·claim 권한 실패 테스트 작성**

`tests/coop-boss-rules.test.mjs`는 기존 `snapshot()` fixture를 확장해 `parent()`, `exists()`, `numChildren()`을 지원하고 다음 행렬을 검증한다.

```js
const cases = [
  ["인증 없는 boss 읽기", false],
  ["현재 authority의 state 갱신", true],
  ["다른 UID의 살아 있는 lease state 갱신", false],
  ["만료 lease를 epoch+1로 인수", true],
  ["자기 attack 생성", true],
  ["다른 UID attack 생성", false],
  ["authority의 처리 완료 attack 삭제", true],
  ["authority의 playerDamage 생성", true],
  ["대상 UID의 playerDamage 삭제", true],
  ["대상 UID가 자기 reward 수치 변경", false],
  ["대상 UID가 기존 claim의 claimedAt만 기록", true],
];
```

값 검증은 알 수 없는 map, bossId, classId, weaponId, attackKind, 음수 좌표, sequence 0, 미래 5초 초과 createdAt, damage 필드 포함 공격을 각각 거부한다고 고정한다.

- [ ] **Step 2: 대상 테스트를 실행해 bosses 규칙 부재로 실패 확인**

Run: `node --test tests/database-rules.test.mjs tests/coop-boss-rules.test.mjs`

Expected: FAIL — `bosses` 규칙이 없다.

- [ ] **Step 3: state 읽기·생성·authority 갱신·인수 규칙 구현**

`bosses`의 공통 map 범위와 state write 의미를 다음과 같이 구현한다.

```json
"bosses": {
  "$mapId": {
    ".read": "auth != null && ($mapId === 'coast' || $mapId === 'volcano' || $mapId === 'forest')",
    "state": {
      ".write": "auth != null && ((!data.exists() && newData.child('authorityUid').val() === auth.uid && newData.child('authorityEpoch').val() === 1) || (data.child('authorityUid').val() === auth.uid && newData.child('authorityUid').val() === auth.uid && newData.child('authorityEpoch').val() === data.child('authorityEpoch').val()) || (data.child('leaseUntil').val() <= now && newData.child('authorityUid').val() === auth.uid && newData.child('authorityEpoch').val() === data.child('authorityEpoch').val() + 1))",
      ".validate": "newData.hasChildren(['encounterId','bossId','mapId','status','x','y','hp','maxHp','authorityUid','authorityEpoch','leaseUntil','partySize','spawnedAt']) && newData.child('mapId').val() === $mapId && newData.child('authorityUid').isString() && newData.child('authorityEpoch').isNumber() && newData.child('authorityEpoch').val() >= 1 && newData.child('partySize').isNumber() && newData.child('partySize').val() >= 1 && newData.child('partySize').val() <= 10 && newData.child('hp').isNumber() && newData.child('hp').val() >= 0 && newData.child('hp').val() <= newData.child('maxHp').val()"
    }
  }
}
```

`bossId`는 map별 정확한 한 값, `status`는 alive·defeated·respawning, 좌표는 해당 world bounds, lease는 `now + 10초` 이하로 추가 검증한다. `$other: { ".validate": false }`를 state의 허용된 leaf와 contributors 구조 바깥에 둔다.

- [ ] **Step 4: attack 규칙 구현**

```json
"attacks": {
  "$uid": {
    "$sequence": {
      ".write": "auth != null && ((auth.uid === $uid && !data.exists() && newData.exists()) || (root.child('rooms/' + $roomId + '/bosses/' + $mapId + '/state/authorityUid').val() === auth.uid && !newData.exists()))",
      ".validate": "newData.hasChildren(['attackId','sequence','uid','encounterId','bossId','mapId','classId','weaponId','attackKind','playerX','playerY','direction','createdAt']) && newData.child('uid').val() === auth.uid && newData.child('uid').val() === $uid && newData.child('sequence').isNumber() && newData.child('sequence').val() >= 1 && newData.child('mapId').val() === $mapId && newData.child('createdAt').val() <= now + 5000 && !newData.hasChild('damage')"
    }
  }
}
```

직업별 7개 weaponId 조합과 `basic|strong` attackKind를 기존 player rule과 같은 독립 표현으로 검증한다.

- [ ] **Step 5: playerDamage와 rewardClaims 규칙 구현**

`playerDamage/{targetUid}/{eventId}`는 현재 authority만 생성할 수 있고 target UID는 삭제만 할 수 있다. `damage`는 `0 < value <= 50`, `authorityEpoch`와 encounterId는 state와 일치해야 한다.

`rewardClaims/{encounterId}/{uid}`는 현재 authority가 state contributors에 UID가 있을 때 최초 생성한다. claim 소유자는 기존 `encounterId`, `bossId`, `uid`, `exp`, `gold`, `eligible`, `expiresAt`을 그대로 유지하면서 `claimedAt`만 `null → now` 범위 숫자로 바꿀 수 있다. 소유자와 authority는 만료 claim을 삭제할 수 있다.

- [ ] **Step 6: Firebase 설정 문서에 App Check 운영 순서 추가**

`FIREBASE_SETUP.md`에 코드 변경 없이 다음 순서를 명시한다.

1. Firebase Console의 App Check에 GitHub Pages web app 등록
2. reCAPTCHA Enterprise provider 선택
3. 운영 일반 주소와 QA 주소에서 요청 metric 관찰
4. 유효 요청 비율 확인 후 Realtime Database enforcement 활성화
5. enforcement 전 로컬·CI는 Firebase Emulator 또는 App Check debug token 사용

실제 site key가 등록되기 전에는 임의 키를 저장소에 넣거나 enforcement를 켜지 않는다.

- [ ] **Step 7: 규칙·전체 테스트 통과 확인**

Run: `node --test tests/database-rules.test.mjs tests/coop-boss-rules.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add database.rules.json FIREBASE_SETUP.md tests/database-rules.test.mjs tests/coop-boss-rules.test.mjs
git commit -m "feat: 협동 보스 데이터 규칙 보호"
```

---

## Task 14: 협동 보스 HUD와 모드별 화면 정리

**Files:**

- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/game-20260828-classes.js`
- Create: `tests/coop-boss-ui.static.test.cjs`
- Modify: `tests/game-play-mode.test.mjs`
- Modify: `tests/performance-ui.static.test.cjs`

**Interfaces:**

- Consumes: controller snapshot, 세션 모드, encounter status·respawnAt
- Produces: `PixelRPG.updateCoopBossHud(snapshot, now)`, 솔로·village·alive·defeated HUD 상태

- [ ] **Step 1: HUD 구조·솔로 숨김·재등장 표시 실패 테스트 작성**

```js
test("협동 보스 HUD는 이름·체력·참여자·상태를 가진다", () => {
  assert.match(html, /id="coopBossHud"[^>]*hidden/);
  assert.match(html, /id="coopBossName"/);
  assert.match(html, /id="coopBossHpBar"/);
  assert.match(html, /id="coopBossHpText"/);
  assert.match(html, /id="coopBossParticipants"/);
  assert.match(html, /id="coopBossStatus"/);
});

test("솔로 전환은 보스 HUD와 온라인 전용 UI를 모두 숨긴다", () => {
  const game = createGameFixture();
  game.updateCoopBossHud(aliveBossSnapshot(), 1000);
  game.setSessionMode("solo", "connection_lost");
  assert.equal(game.ui.coopBossHud.hidden, true);
  assert.equal(game.ui.chatPanel.hidden, true);
  assert.equal(game.ui.onlinePresence.hidden, true);
});
```

- [ ] **Step 2: 대상 테스트를 실행해 HUD 연결 부재로 실패 확인**

Run: `node --test tests/coop-boss-ui.static.test.cjs tests/game-play-mode.test.mjs tests/performance-ui.static.test.cjs`

Expected: FAIL — HUD 하위 요소와 상태 렌더가 없다.

- [ ] **Step 3: 접근 가능한 보스 HUD와 반응형 스타일 구현**

```html
<section id="coopBossHud" class="coop-boss-hud glass" aria-live="polite" hidden>
  <div><small>CO-OP BOSS</small><strong id="coopBossName">협동 보스</strong></div>
  <span id="coopBossStatus">대기 중</span>
  <div class="bar boss"><i id="coopBossHpBar"></i></div>
  <div class="coop-boss-meta">
    <b id="coopBossHpText">0 / 0</b>
    <span id="coopBossParticipants">참여 0명</span>
  </div>
</section>
```

HUD는 데스크톱 상단 중앙, 760px 이하 player panel 아래에 배치하고 playfield를 과도하게 가리지 않도록 최대 폭 520px을 사용한다. `prefers-reduced-motion`에서 HP bar transition을 제거한다.

- [ ] **Step 4: alive·defeated·respawning 렌더 구현**

- alive: 이름, `hp / maxHp`, HP 비율, contributor 수
- defeated: `처치 완료 · 3:00 후 재등장`에서 남은 시간을 초 단위 갱신
- village·솔로·snapshot 없음: `hidden = true`
- authority handoff: `관리자 연결 전환 중` 상태를 최대 6초 표시

동일 텍스트·style은 기존 `setTextIfChanged()`, `setStyleIfChanged()`로 DOM write를 줄인다.

- [ ] **Step 5: 대상·전체 테스트 통과 확인**

Run: `node --test tests/coop-boss-ui.static.test.cjs tests/game-play-mode.test.mjs tests/performance-ui.static.test.cjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add index.html styles.css src/game-20260828-classes.js tests/coop-boss-ui.static.test.cjs tests/game-play-mode.test.mjs tests/performance-ui.static.test.cjs
git commit -m "feat: 협동 보스 상태 HUD 추가"
```

---

## Task 15: 엔트리 버전화·문서·CI·브라우저 회귀

**Files:**

- Rename: `src/game-20260828-classes.js` → `src/game-20260828-coop.js`
- Rename: `src/main-20260828-classes.js` → `src/main-20260828-coop.js`
- Modify: `index.html`
- Modify: `firebase.json`
- Modify: `README.md`
- Modify: `tests/firebase-hosting.test.mjs`
- Modify: `tests/browser-smoke.cjs`
- Modify: `tests/chat-game-smoke.cjs`
- Create: `tests/solo-mode-smoke.cjs`
- Create: `tests/coop-boss-load.test.mjs`
- Modify: `tests/ci-workflow.test.mjs`

**Interfaces:**

- Consumes: 완성된 세션 모드·협동 보스 API
- Produces: 실제 배포 엔트리, 솔로 네트워크 0건 smoke, 10명 상태 부하 검증, 사용자 문서

- [ ] **Step 1: 실제 파일명·솔로 요청 0건·10명 전송 한도 실패 테스트 작성**

`tests/firebase-hosting.test.mjs`와 정적 테스트는 HTML이 다음 경로만 참조한다고 요구한다.

```js
assert.match(html, /src="\.\/src\/main-20260828-coop\.js"/);
assert.doesNotMatch(html, /main-20260828-classes\.js/);
assert.match(mainSource, /from "\.\/game-20260828-coop\.js"/);
```

`tests/solo-mode-smoke.cjs`는 Playwright request listener로 `gstatic.com/firebase`, `firebaseio.com`, `firebasedatabase.app` 요청 수를 기록한다. 솔로 카드 선택 후 게임에 입장해 다음을 검증한다.

```js
assert.equal(firebaseRequests.length, 0);
await expect(page.locator("#chatPanel")).toBeHidden();
await expect(page.locator("#onlinePresence")).toBeHidden();
await expect(page.locator("#coopBossHud")).toBeHidden();
```

`tests/coop-boss-load.test.mjs`는 가짜 시계로 10명의 이동 snapshot과 지역 보스 관리자 업데이트를 60초 시뮬레이션하고 player writes `<= 1200`, boss periodic writes `<= 120`, idle heartbeat `<= 20`을 검증한다.

- [ ] **Step 2: 대상 테스트를 실행해 이전 엔트리와 smoke 부재로 실패 확인**

Run: `node --test tests/firebase-hosting.test.mjs tests/coop-boss-load.test.mjs tests/ci-workflow.test.mjs`

Expected: FAIL — coop 엔트리 파일과 load test가 없다.

- [ ] **Step 3: 실제 엔트리 파일명 변경과 모든 import 갱신**

```bash
git mv src/game-20260828-classes.js src/game-20260828-coop.js
git mv src/main-20260828-classes.js src/main-20260828-coop.js
```

`index.html`, 테스트 import, main의 game import를 모두 새 실제 파일명으로 바꾼다. CSS query version은 `20260828-coop`으로 바꾼다. `firebase.json`은 HTML과 JS/CSS의 `no-cache, must-revalidate` 정책을 유지하고 `docs`, `tests`, `.worktrees`가 배포 대상에서 제외되는지 고정한다.

- [ ] **Step 4: README와 Firebase 운영 문서 갱신**

README에 다음을 명시한다.

- 공식 주소: GitHub Pages 일반 URL
- 솔로: Firebase 미사용, 온라인 UI 없음
- 온라인: 최대 10명, 2Hz 위치 보간, 채팅, 세 지역 협동 보스
- 일반 몬스터는 개인 사냥
- 협동 보스 참여자는 동일 보상 1회
- 보스 재등장 3분
- 연결 해제 시 솔로 전환
- Firebase 무료 사용량 보호 정책과 Usage dashboard 확인 위치

- [ ] **Step 5: CI가 새 테스트와 JavaScript 문법 검사를 실행하도록 확인**

현재 wildcard test 명령이 새 `.test.mjs`, `.static.test.cjs`를 포함하는지 `tests/ci-workflow.test.mjs`로 검증한다. smoke workflow가 정적 서버를 시작해 `tests/solo-mode-smoke.cjs`, 기존 browser/chat smoke를 실행하도록 workflow를 수정하거나 기존 명령의 glob 포함을 고정한다.

- [ ] **Step 6: 대상·전체·문법·diff 검증**

Run: `node --test tests/firebase-hosting.test.mjs tests/coop-boss-load.test.mjs tests/ci-workflow.test.mjs`

Expected: PASS

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

Run: `for file in src/*.js; do node --check "$file"; done`

Expected: 모든 파일 exit 0

Run: `git diff --check`

Expected: 출력 없음

- [ ] **Step 7: 로컬 브라우저 smoke 실행**

Run: `python3 -m http.server 4173`

별도 셸에서 Run: `PIXEL_WORLD_URL=http://127.0.0.1:4173 node --test tests/solo-mode-smoke.cjs tests/browser-smoke.cjs tests/chat-game-smoke.cjs`

Expected: PASS, 솔로 Firebase 요청 0건, 브라우저 콘솔 error 0건

- [ ] **Step 8: 커밋**

```bash
git add index.html firebase.json README.md FIREBASE_SETUP.md src tests
git commit -m "docs: 솔로와 협동 보스 배포 계약 완성"
```

---

## Task 16: PR·배포·다중 브라우저 실플레이 검증

**Files:**

- Modify only if a verified defect is found; defect fixes use a separate failing regression test and commit.

**Interfaces:**

- Consumes: Task 1~15의 완성 브랜치와 GitHub Actions/Firebase Realtime Database
- Produces: CI 증거, GitHub Pages 배포, 2·3·10명 협동 전투 QA 기록

- [ ] **Step 1: 전체 검증을 깨끗한 상태에서 다시 실행**

Run: `node --test tests/*.test.mjs tests/*.static.test.cjs`

Expected: PASS

Run: `for file in src/*.js; do node --check "$file"; done`

Expected: 모든 파일 exit 0

Run: `git diff --check && git status --short`

Expected: diff 오류 없음, 의도한 파일 외 변경 없음

- [ ] **Step 2: 기능 브랜치를 push하고 PR 생성**

PR 본문에 다음 검증표를 포함한다.

- 솔로 Firebase 요청 0건
- 온라인 위치 2Hz·정지 heartbeat
- 공개방 10명 제한
- 세 지역 협동 보스
- 관리자 lease handoff
- 세 직업 공동 피해
- 동일 보상 1회·24시간 미수령
- 연결 해제 솔로 fallback
- 180초 재등장

- [ ] **Step 3: PR CI 성공과 병합 가능 상태 확인 후 병합**

Verify game·Pages workflow가 모두 성공하고 branch protection 조건을 만족해야 병합한다. 실패하면 로그에서 첫 실패 원인을 고정하고 별도 회귀 테스트를 먼저 만든다.

- [ ] **Step 4: GitHub Pages 일반 주소에서 솔로 검증**

`?qa=1` 없는 공식 주소에서 닉네임·직업·솔로를 선택한다.

- 채팅·온라인 배지·접속자 수·협동 보스 HUD 없음
- DevTools network에서 Firebase SDK·Database 요청 없음
- 일반 몬스터·퀘스트·대장간·직업 전투 정상
- 새로고침 후 진행 복원

- [ ] **Step 5: 2명과 3명 온라인 협동 전투 검증**

서로 다른 브라우저 context에서 검사·궁수·마법사로 같은 지역에 입장한다.

- 같은 보스 위치·HP·phase 표시
- 각 직업 Ctrl·Q 피해가 한 체력에 반영
- 한 번이라도 유효 피해를 준 세 명에게 동일 보상
- 일반 몬스터는 각자 독립 상태
- 동시 막타에도 보상·사망 1회

- [ ] **Step 6: 관리자 이탈·연결 해제·재등장 검증**

- 관리자 context를 닫고 6초 안에 다음 참가자가 동일 HP·위치·encounterId를 이어받음
- 비관리자 네트워크를 차단하고 5초 후 솔로 전환, 위치·HP·진행 유지
- 끊긴 참여자의 보상은 다음 온라인 입장 때 한 번 지급
- 처치 179초에는 미등장, 180초 이후 참가자가 있는 지역에 새 encounter 등장

- [ ] **Step 7: 10명 정원과 11번째 fallback 검증**

10개 context가 슬롯 0~9를 각각 하나씩 확보하고 11번째 context가 `온라인 인원이 가득 차 솔로 모드로 시작합니다.` 안내와 함께 Firebase listener 없이 솔로로 들어가는지 확인한다.

- [ ] **Step 8: Firebase Usage와 잔존 데이터 확인**

- 플레이어·보스 periodic write가 각각 2Hz 상한을 지킴
- 종료한 UID의 slot·player 경로가 삭제됨
- 처리한 attack·playerDamage가 남지 않음
- claim은 encounter별 UID 하나
- 24시간 기준 cleanup predicate가 만료 전 데이터를 지우지 않음
- 앱 콘솔 error 0건

- [ ] **Step 9: 완료 보고**

PR URL, merge SHA, Pages workflow URL, 전체 테스트 수, 2·3·10명 QA 결과, Firebase 요청·Usage 관찰값, 발견된 제한을 함께 보고한다.

---

## Plan Self-Review Checklist

- [ ] 설계 문서의 솔로·온라인·정원·2Hz·협동 보스·권한 이전·세 직업 공격·동일 보상·3분 재등장·24시간 만료·연결 해제 요구가 각각 Task 1~16에 대응한다.
- [ ] 새 공개 함수 이름과 payload 필드가 모든 task에서 동일하다.
- [ ] 미확정 자리표시자 문구가 없다.
- [ ] 솔로 경로가 Firebase module loader 이전에 반환된다.
- [ ] 일반 몬스터 배열과 협동 보스 상태가 섞이지 않는다.
- [ ] 보상은 로컬 저장 성공 뒤 원격 claim 완료 순서다.
- [ ] 실제 버전 파일명 변경과 모든 import·cache 테스트가 마지막 구현 task에 포함된다.
