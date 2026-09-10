from pathlib import Path

SPEC_PATH = Path("docs/superpowers/specs/2026-09-09-pixel-core-sanctuary-design.md")
PLAN_PATH = Path("docs/superpowers/plans/2026-09-10-pixel-core-sanctuary.md")

SPEC_MARKER = "## 추가 승인 설계: 첫 플레이 온보딩 및 출시 경험 (2026-09-10)"
SPEC_ADDENDUM = r'''

## 추가 승인 설계: 첫 플레이 온보딩 및 출시 경험 (2026-09-10)

### 목적
Task 10 출시 단계에서 신규 플레이어가 중앙 초원에 처음 진입하는 순간 세계관, 현재 목표, 기본 조작을 자연스럽게 이해하도록 1회성 인트로와 초심자 가이드를 추가한다. 이 기능은 기존 제1~4장 진행과 성역의 최종 진실을 바꾸지 않으며, 초반에는 주민들이 알고 있는 불완전한 공식 설명만 제공한다.

### 서사 원칙
초반에는 `픽셀 코어에 이상이 생긴 뒤 태고의 숲·푸른 해안·활화산에서 서로 다른 세 코어 반응이 발견되었고 사람들은 이를 세 코어 조각이라 부른다`까지만 확정한다. 코어가 왜 갈라졌는지와 최초 개입자가 누구인지는 알 수 없는 상태로 남긴다. 제4장 원점 기록고에서 아렌이 관리자 권한을 생명·기억·에너지로 분리했고 선발대장의 긴급 접근이 최종 방어 프로토콜을 촉발했다는 진실이 공개되므로, 초반 인트로는 이를 선행 폭로하거나 모순시키지 않는다.

첫 진행 순서는 `아렌 → 모험의 시작 → 태고의 숲 → 푸른 해안 → 활화산 → 픽셀 코어 성역`이다. 신규 HUD가 처음부터 푸른 해안을 현재 목표로 표시하지 않는다.

### 1회성 인트로 상태
플레이어 진행 최상위에 `introSeen: boolean`을 추가한다. `createInitialProgress()`는 `false`로 시작한다. 기존 v1~v7 세이브를 v8로 이전할 때는 기존 이용자에게 업데이트 인트로를 강제하지 않도록 `true`로 이전한다. 현재 개발 중 v8 값에 필드가 없으면 `false`로 정규화한다. 동일 닉네임의 직업 변경과 솔로·온라인 모드 변경은 같은 `introSeen` 값을 공유한다.

인트로 완주 또는 `인트로 건너뛰기`를 선택하면 인메모리 `introSeen=true`로 전환하고 v8 저장을 시도한다. 저장 실패 시 현재 세션에서는 인트로를 다시 열지 않지만 재접속 때 다시 표시될 수 있으며, 기존 진행·장비·퀘스트·Gold를 롤백하거나 손상시키지 않는다. 저장 실패 안내를 표시한다.

### 인트로 화면과 입력 계약
게임 입장 성공 후 HUD를 초기화한 다음, `introSeen=false`인 경우 전체 화면 암전 오버레이를 연다. 인트로 활성 중 이동, 공격, 스킬, 아이템, 인벤토리, 채팅, NPC 상호작용, 포탈, QA 입력을 차단한다.

문자는 프레임별 타이핑 효과로 표시한다. 기본 타이핑 속도는 글자당 `18ms`, 프레임 완성 후 자동 진행 대기는 `800ms`다. `Enter` 또는 `Space`는 타이핑 중이면 현재 프레임을 즉시 완성하고, 이미 완성된 프레임이면 다음 프레임으로 이동한다. `prefers-reduced-motion: reduce` 환경에서는 타이핑 애니메이션 없이 즉시 문장을 표시한다. `인트로 건너뛰기` 버튼은 항상 접근 가능하며 즉시 도착 연출로 넘어간다.

인트로는 `[SYSTEM // WORLD DATA ERROR]`, `[WARNING // PIXEL CORE]`, `[RECOVERY // RESIDUAL SIGNAL]`을 차례대로 표시하고, 픽셀 코어가 대륙의 형태와 생명을 유지해 온 중심부의 심장이었다는 사실, 성역 붕괴 뒤 세 지역에서 세 반응이 발견된 사실, 생명·기억·에너지 계통의 왜곡이 발생한 사실을 전달한다. 코어가 왜 갈라졌는지와 누가 처음 손댔는지는 모른다고 명시한다. 마지막에는 성역의 잔류 광자가 중앙 초원에 닿으며 플레이어가 등장한다.

마지막 타이틀은 `PIXEL WORLD`와 `조각난 데이터의 대륙, 당신의 손끝에서 세계의 형태를 되찾습니다.`를 사용한다. `원래의 형태`라는 표현은 세 엔딩 중 복원만 정답처럼 보이게 하므로 사용하지 않는다.

### 중앙 초원 도착 연출
인트로가 닫히면 기존 `village` 스폰을 그대로 사용한다. `1100ms` 동안 월드 렌더에만 글리치 오버레이를 적용하며 월드 데이터, 충돌, 네트워크 좌표를 수정하지 않는다. 글리치 종료 뒤 기존 중앙 퀘스트 배너를 사용해 `MAIN QUEST / 모험의 시작 / 현자 아렌과 대화하세요 / LOCATION · 중앙 초원 / 방향키 이동 · F 대화 · Ctrl 공격`을 보여준다.

HP/MP는 100/100으로 고정하지 않는다. 실제 선택 직업과 레벨 계산값을 사용한다. Lv.1 기준 검사는 HP 120/MP 80, 궁수는 HP 100/MP 100, 마법사는 HP 80/MP 140이다.

### 현자 아렌 첫 대화
`adventureStart`가 `available`일 때만 장문 첫 만남 대사를 사용한다. 아렌은 플레이어를 성역 쪽 섬광 뒤 중앙 초원에서 발견했다고 설명하고, 대륙에 떠다니는 픽셀 파편과 세 지역의 코어 반응을 소개한다. 아렌은 단순 폭주만이 원인이라고 단정하지 않는다.

아렌은 연금술사 미아에게 `물약 사용법을 확인`하고 대장장이 브란에게 `앞으로 사용할 장비를 살펴보라`고 안내한다. 신규 캐릭터 Gold는 0이므로 무료 물약 지급이나 구매를 약속하는 문구는 사용하지 않는다. 첫 실전 임무는 승인된 슬라임 3마리 처치이며, 태고의 숲 코어 반응을 추적하는 진행으로 이어진다. 푸른 해안의 세라 조난 신호는 다음 장의 장기 목표로 미리 언급하되, 숲을 먼저 안정시켜야 길이 열린다고 명시한다. 첫 버튼 레이블은 `[모험의 시작] 임무 수락`이다.

### 동적 챕터 HUD
고정 HTML 문구 `CHAPTER · 푸른 해안의 신호를 찾는다.`를 제거하고 실제 진행 상태로 계산한다.

- 퀘스트 미수락: `CHAPTER 1 · 아렌에게 대륙의 상황을 듣는다.`
- 퀘스트 진행: `CHAPTER 1 · 외부 지역의 슬라임 3마리를 처치한다.`
- 보고 가능: `CHAPTER 1 · 아렌에게 임무를 보고한다.`
- 퀘스트 완료·숲 미완료: `CHAPTER 1 · 태고의 숲의 코어 반응을 추적한다.`
- 숲 완료: `CHAPTER 2 · 푸른 해안의 세라 신호를 추적한다.`
- 해안 완료: `CHAPTER 3 · 활화산의 선발대를 추적한다.`
- 화산 완료: `CHAPTER 4 · 픽셀 코어 성역으로 향한다.`
- 성역 진행: 기존 성역 세부 objective를 `CHAPTER 4` 아래 표시한다.
- 성역 완료: `EPILOGUE · PIXEL WORLD 제1부 완료`

### 초심자 가이드
HUD에 `?` 도움말 버튼을 추가하며 별도 키 단축키는 만들지 않는다. 도움말은 언제든 다시 열 수 있고 `Esc` 또는 닫기 버튼으로 닫는다. 열려 있는 동안 게임 입력은 정지한다.

가이드는 스포일러 없이 검사·궁수·마법사, 브란의 일반 대장간 장비 21종, 솔로와 최대 10명 온라인 모드, 방향키 이동, Ctrl 기본 공격, Q 직업 기본 스킬, E Lv.5 해금, R Lv.10 해금, F 상호작용, 1/2/3 퀵슬롯, I 인벤토리, Enter 온라인 채팅, Esc 닫기/나가기를 설명한다. 히든 무기와 최종 엔딩은 노출하지 않는다.

### Task 10 출시 검증 성공 조건
- 신규 v8 닉네임은 인트로를 정확히 1회 본다.
- 인트로 중 모든 플레이 입력이 차단된다.
- Enter/Space 빠른 진행, Skip, reduced-motion이 모두 동작한다.
- 인트로 완료/Skip 뒤 실제 직업 HP/MP와 중앙 초원 스폰이 유지된다.
- 재접속·직업 변경·모드 변경 시 인트로가 반복되지 않는다.
- v1~v7 마이그레이션 이용자는 인트로가 강제되지 않는다.
- 첫 아렌 대사는 태고의 숲을 현재 목표, 세라 신호를 이후 목표로 설명한다.
- 신규 Gold 0과 미아 안내 문구가 모순되지 않는다.
- 동적 챕터 HUD가 제1~4장 및 에필로그 상태와 일치한다.
- 도움말은 기존 모달 입력 우선순위를 깨뜨리지 않는다.
- 기존 성역 캐시 계약, 솔로/온라인 성역 완주, Firebase 규칙과 배포 검증 조건은 그대로 유지한다.
'''

TASK10 = r'''### Task 10: First-player onboarding, cache-safe release graph, browser journeys and documentation

**Files:**
- Create: `src/first-journey-script-20260910-sanctuary.js`
- Create: `src/first-journey-controller-20260910-sanctuary.js`
- Create: `src/aren-dialogue-20260910-sanctuary.js`
- Create: `tests/first-journey-state.test.mjs`
- Create: `tests/first-journey-controller.test.mjs`
- Create: `tests/first-journey-ui.static.test.cjs`
- Create: `tests/campaign-objective.test.mjs`
- Create: `tests/sanctuary-cache-contract.test.mjs`
- Create: `tests/sanctuary-browser-smoke.cjs`
- Modify: `src/quest-state-20260910-sanctuary.js`
- Modify: `src/progress-storage-20260910-sanctuary.js`
- Modify: `src/quest-guidance-20260910-sanctuary.js`
- Modify: `src/game-20260910-sanctuary.js`
- Modify: `src/main-20260910-sanctuary.js`
- Modify: `styles-20260910-sanctuary.css`
- Modify: `index.html`
- Modify: `.github/workflows/browser-smoke.yml`
- Modify: `tests/ci-workflow.test.mjs`
- Modify: `tests/firebase-hosting.test.mjs`
- Modify: `README.md`
- Modify: `FIREBASE_SETUP.md`

**Interfaces:**
- `createInitialProgress()` adds top-level `introSeen: false`.
- `markIntroSeen(progress)` returns a cloned progress object with `introSeen:true` and preserves all other progress.
- v1-v7 migrations set `introSeen:true`; v8 without the field normalizes to `false`.
- `FIRST_JOURNEY_SCRIPT` contains approved spoiler-safe system, narration and title frames.
- `FirstJourneyController` owns `18ms` typing, `800ms` auto-advance, Enter/Space fast-forward, Skip and reduced-motion behavior with injected timers.
- `campaignObjective(progress)` returns `{ eyebrow, text, targetMapId }` for Chapter 1-4 or epilogue.
- `arenDialogueModel(progress)` uses the approved long first-meeting copy only while `adventureStart.status === "available"`.
- Browser entry is exactly `./src/main-20260910-sanctuary.js`; CSS entry is exactly `./styles-20260910-sanctuary.css`.
- Cache contract recursively rejects stale physical import edges for modules changed by Tasks 1-10.
- Browser smoke uses production interaction APIs except explicit QA setup actions.

#### Task 10A: First-player journey and beginner guide

- [ ] **Step 1: Write RED state/persistence tests**
Create `tests/first-journey-state.test.mjs`. Assert new progress has `introSeen:false`; `markIntroSeen()` is immutable/idempotent; valid v8 without the field loads as `false`; each v1-v7 migration loads with `introSeen:true`; save/reload keeps true without changing level, Gold, quests, equipment, codes, boss receipts, world progress or ending title.

Run: `node --test tests/first-journey-state.test.mjs tests/progress-storage.test.mjs`
Expected: RED because the new state contract does not exist.

- [ ] **Step 2: Implement minimal first-journey state and re-run Step 1**
Add `introSeen:false` to `createInitialProgress()`, preserve it in clones, export `markIntroSeen(progress)`, normalize missing v8 to false, and explicitly set migrated v1-v7 values to true. Require zero failures before continuing.

- [ ] **Step 3: Write RED intro script/controller tests**
Create `tests/first-journey-controller.test.mjs`. Assert the three exact system headings, spoiler-safe narration, final tagline, `18ms` typing interval, `800ms` automatic progression, Enter/Space fast-forward, Skip, reduced-motion and one-shot completion callback.

Run: `node --test tests/first-journey-controller.test.mjs`
Expected: RED because the new modules do not exist.

- [ ] **Step 4: Implement intro script/controller and re-run Step 3**
`first-journey-script` exports immutable frames. `FirstJourneyController` writes via `textContent`, handles focus safely, supports injected timers and emits `onComplete({ skipped })` once.

- [ ] **Step 5: Write RED first-play UI/runtime tests**
Create `tests/first-journey-ui.static.test.cjs`. Assert `#firstJourneyOverlay`, text/continue/skip controls, `#helpButton`, `#beginnerGuideOverlay`, runtime input lock, save-on-finish, `1100ms` render-only arrival glitch, MAIN QUEST handoff, save-failure warning and no progression rollback.

Run: `node --test tests/first-journey-ui.static.test.cjs tests/game-qa.test.mjs tests/ui.static.test.cjs`
Expected: RED before runtime wiring.

- [ ] **Step 6: Wire intro, arrival glitch and beginner guide and re-run Step 5**
Add accessible overlays and HUD `?` button; add reduced-motion CSS. `main` opens intro only when `game.shouldPlayFirstJourneyIntro()` is true. `game` adds `finishFirstJourneyIntro`, `playArrivalGlitch`, `openBeginnerGuide`, `closeBeginnerGuide` and includes intro/help in input priority. Help copy covers the three classes, 21 standard Bran weapons, modes and exact controls without hidden weapon/ending spoilers.

#### Task 10B: Aren first meeting and dynamic campaign objective

- [ ] **Step 7: Write RED Aren and campaign objective tests**
Create `tests/campaign-objective.test.mjs` and extend Aren tests. Available-state copy must mention central-meadow rescue, unknown core cause, three regional reactions, Mia usage guidance, Bran equipment inspection, slime-3 first mission, forest-before-coast order, Sera as later signal, and `[모험의 시작] 임무 수락`. It must not promise free potion purchase or make Blue Coast the first destination.

Assert exact runtime HUD outputs:
`CHAPTER 1 · 아렌에게 대륙의 상황을 듣는다.`
`CHAPTER 1 · 외부 지역의 슬라임 3마리를 처치한다.`
`CHAPTER 1 · 아렌에게 임무를 보고한다.`
`CHAPTER 1 · 태고의 숲의 코어 반응을 추적한다.`
`CHAPTER 2 · 푸른 해안의 세라 신호를 추적한다.`
`CHAPTER 3 · 활화산의 선발대를 추적한다.`
`CHAPTER 4 · 픽셀 코어 성역으로 향한다.`
`EPILOGUE · PIXEL WORLD 제1부 완료`.
Active sanctuary progress uses existing sanctuary objectives under `CHAPTER 4`.

Run: `node --test tests/campaign-objective.test.mjs tests/aren-dialogue.test.mjs`
Expected: RED before implementation.

- [ ] **Step 8: Implement Aren dialogue and dynamic HUD and re-run Step 7**
Create `src/aren-dialogue-20260910-sanctuary.js`, changing only the available-state body/label while retaining active/report/completed and coast-return behavior. Export `campaignObjective(progress)` from quest guidance; update game HUD to render returned eyebrow/text. Replace the initial HTML placeholder with Chapter 1 first-contact copy.

#### Task 10C: Cache-safe physical release and browser journeys

- [ ] **Step 9: Write RED cache and HTML-entry tests**
Create `tests/sanctuary-cache-contract.test.mjs` asserting `styles-20260910-sanctuary.css` and `src/main-20260910-sanctuary.js` are the only live entries and recursively rejecting stale changed-module edges.

Run: `node --test tests/sanctuary-cache-contract.test.mjs tests/firebase-hosting.test.mjs tests/ci-workflow.test.mjs`
Expected: RED until live entry and changed transitive imports use the sanctuary graph.

- [ ] **Step 10: Complete physical release graph and re-run Step 9**
Switch `index.html` to the sanctuary CSS/main entries and route the new first-journey/Aren modules through the same physical graph. Do not rename public map, class, weapon, reward-code or boss IDs.

- [ ] **Step 11: Implement first-player browser journey**
With a fresh nickname assert first entry opens intro; movement/attack are blocked; Enter/Space fast-forward and Skip/full completion work; real village spawn and class-derived HP/MP remain correct; `introSeen` persists; MAIN QUEST points to Aren; first Aren dialogue is forest-first; help opens/closes without moving player; reconnect with another class and then another mode does not replay intro.

- [ ] **Step 12: Implement primary solo sanctuary journey**
Completed-volcano QA save → three resonance nodes → three required archives → all three optional origin records → TRINITY → ORIGIN → `resonate` → reward once → credits skip locked before 5s → post-credit → village with `세계의 공명자`.

- [ ] **Step 13: Implement alternate-ending recovery journey**
ORIGIN with two origin records → resonate locked → `결정 보류` → backtrack for record 3 → return without ORIGIN refight → choose `restore` → reload → title persists and EXP 500/Gold 1000 are not duplicated.

- [ ] **Step 14: Implement two-browser online ORIGIN journey**
Two authenticated contexts share ORIGIN HP/phase, authority transfers after owner exit, both receive independent local defeat receipts/spectator state and choose different endings. One nickname never mutates the other. TEACHER/BOSSKILLBOSS never leak into shared presence or alter ORIGIN online behavior.

- [ ] **Step 15: Wire browser CI**
Add `PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/sanctuary-browser-smoke.cjs` after existing volcano smoke. Existing earlier journeys remain gates.

#### Task 10D: Documentation and full release verification

- [ ] **Step 16: Update README and Firebase docs**
README adds spoiler-free beginner guide/tagline, three classes, 21 standard Bran weapons, controls, modes, first-journey behavior, corrected Chapter 1→4 order, 15 maps, TRINITY, ORIGIN, v8 key, endings, 3/3 resonance condition, defer/spectator recovery, credits/post-credit and titles. FIREBASE_SETUP documents the ORIGIN shared path/rules and states `introSeen`, ending choices and titles remain nickname-local browser progress.

- [ ] **Step 17: Run complete Node and syntax verification**
Run:
```bash
node --test tests/*.test.mjs tests/*.static.test.cjs
for file in src/*.js; do node --check "$file"; done
node --check tests/sanctuary-browser-smoke.cjs
git diff --check
```
Expected: all commands exit 0 with zero Node failures.

- [ ] **Step 18: Run Firebase emulator verification**
Run: `npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"`
Expected: exit 0.

- [ ] **Step 19: Run local browser smoke on exact branch head**
Start `python3 -m http.server 4173`, then run existing base/coast/volcano smoke followed by `tests/sanctuary-browser-smoke.cjs`. Expected: all commands exit 0.

- [ ] **Step 20: Commit Task 10 release assets**
Commit the Task 10 source, HTML/CSS, CI, tests and docs as `feat: ship sanctuary release and first-player journey` after all Step 17-19 evidence is green.

'''

spec = SPEC_PATH.read_text(encoding="utf-8")
if SPEC_MARKER not in spec:
    SPEC_PATH.write_text(spec.rstrip() + SPEC_ADDENDUM + "\n", encoding="utf-8")

plan = PLAN_PATH.read_text(encoding="utf-8")
start = plan.index("### Task 10:")
end = plan.index("### Task 11:", start)
PLAN_PATH.write_text(plan[:start] + TASK10 + plan[end:], encoding="utf-8")
