# Pixel Core Sanctuary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 최신 main을 기반으로 네 개의 성역 물리 맵, 개인 서사 퍼즐·기록·결말, 솔로/온라인 무명의 합창 전투를 구현하고 실제 입력 및 Firebase 에뮬레이터로 검증한다.

**Architecture:** 기존 region/world/story interaction/chapter progress/portal 순수 전이 구조를 유지하면서 성역 데이터와 로컬 진행 reducer를 분리한다. 무명의 합창은 기존 COOP_BOSS_MAP_IDS에 추가하지 않고 전용 state/controller/network/rendering 계층을 사용하며, Firebase에는 공유 전투 사실만 저장한다. 기존 78개 활성 모듈은 새 물리 릴리스 URL로 복제하고 index.html의 진입점은 기능과 검증 준비가 끝난 뒤 한 번만 전환한다.

**Tech Stack:** 정적 HTML/CSS, Canvas 2D, ES modules, Node.js node:test, Playwright 1.55.0, Firebase Web SDK 12.16.0, Firebase Auth/Realtime Database Emulator, Firebase CLI 15.26.0

**Spec:** docs/superpowers/specs/2026-09-11-pixel-core-sanctuary-design.md

## Global Constraints

- 구현 기준은 main 커밋 1c802981e2ceeffc68c42b47b39d533cfad86509와 그 커밋에서 분기한 codex/pixel-core-sanctuary다.
- 네 mapId는 sanctuary, sanctuary-memory-archive, sanctuary-return-record, sanctuary-three-futures이며 모두 2160×1800이다.
- 기존 sanctuary mapId와 volcano-core-caldera 왕복 포털을 유지한다.
- 새 물리 릴리스 접미사는 -20260911-sanctuary이며 기존 릴리스 파일을 수정·삭제하지 않는다.
- 기존 진입점에서 도달하는 JavaScript 모듈 78개 전체를 새 물리 URL로 복제하고 신규 성역 모듈도 같은 접미사를 사용한다.
- 진행에 따라 충돌 데이터를 바꾸지 않고 unlockedMapIds와 기존 portal gate로 다음 맵을 연다.
- 저장 버전은 v8이며 v1~v7 데이터를 보존한다.
- boolean은 정확히 true만 참이며, 배열은 허용 ID만 중복 없이 남기고, endingChoice는 seal, restore, release만 허용한다.
- captainOutcome rescued/lost를 보존하고 두 분기 모두 같은 공략·보상·세 결말을 제공한다.
- 무명의 합창의 공유 결속도는 100→70→40→0이고 일반 damage 값으로 감소하지 않는다.
- 개인 오염도는 0~100이며 Firebase나 영구 저장에 쓰지 않는다.
- 공유 전투 경로는 rooms/public/chorus/sanctuary-return-record이고 기존 rooms/public/bosses 경계는 확장하지 않는다.
- 결말 보상은 모두 300 EXP와 200 Gold이며 칭호·기록·시각 효과만 다르다.
- 최종 선택 중 원격 플레이어와 채팅은 로컬로 숨기고 선택 완료 또는 취소 후 복원한다.
- 보스 성공 상태를 저장소나 Firebase에 직접 주입한 브라우저 검사는 완주 증거로 인정하지 않는다.
- 브라우저 검사는 networkidle 단독 판정을 사용하지 않고 HUD, 캔버스, 실제 입력 결과를 기다린다.
- Canvas 상태는 스크린샷으로 검토하고 DOM만 확인한 결과를 시각 검증으로 보고하지 않는다.
- Draft PR만 만들며 main 병합과 운영 배포는 하지 않는다.

---

## File Map

### 신규 런타임 모듈

- src/sanctuary-world-data-20260911-sanctuary.js — 네 맵, 정적 장애물, 포털, 봉인함, 전투 배치 데이터
- src/sanctuary-story-data-20260911-sanctuary.js — 소리, 원본, 모순, 기록 필드, 증언, 미래, 결말 문구
- src/sanctuary-progress-20260911-sanctuary.js — 성역 로컬 상태 생성·정규화·순수 reducer
- src/record-archive-20260911-sanctuary.js — 해안·성역 기록의 범용 모델과 DOM 렌더링
- src/sanctuary-ending-20260911-sanctuary.js — 두 단계 선택 모델과 멱등 보상 ledger
- src/sanctuary-chorus-data-20260911-sanctuary.js — 단계, 파편, 닻, 증언, 패턴, 기록, 결속선 상수
- src/sanctuary-chorus-state-20260911-sanctuary.js — 공유/개인 상태, action 검증, 순수 전이, authority lease
- src/sanctuary-chorus-controller-20260911-sanctuary.js — 솔로/온라인 전투 오케스트레이션과 게임 입력 adapter
- src/sanctuary-chorus-network-20260911-sanctuary.js — 전용 Firebase 구독·action·state·claim transport
- src/sanctuary-chorus-rendering-20260911-sanctuary.js — 합창, 파편, 닻, 검은 선, 공격 예고, 분리 오버레이

### 새 릴리스에서 직접 수정할 기존 모듈

- src/region-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/volcano-world-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/world-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/portal-transition-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/chapter-progress-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/progress-storage-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/quest-state-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/story-interactions-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/communication-log-20260829-coast-20260905-upgrade-20260911-sanctuary.js
- src/enemy-definitions-20260905-upgrade-20260911-sanctuary.js
- src/enemies-20260829-coast-20260905-upgrade-20260911-sanctuary.js
- src/network-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/firebase-config-20260905-upgrade-20260911-sanctuary.js
- src/config-20260905-upgrade-20260911-sanctuary.js
- src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/quest-guidance-20260905-upgrade-20260911-sanctuary.js
- src/quest-banner-20260905-upgrade-20260911-sanctuary.js
- src/npc-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- src/qa-mode-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css
- index.html
- database.rules.json

나머지 활성 모듈은 Task 1에서 동작 변경 없이 새 접미사로 복제하고 import만 새 물리 URL로 재작성한다.

### 신규 및 변경 테스트

- tests/release-rollover-tool.test.mjs
- tests/sanctuary-cache-contract.test.mjs
- tests/sanctuary-world-data.test.mjs
- tests/sanctuary-progress.test.mjs
- tests/sanctuary-storage-v8.test.mjs
- tests/record-archive.test.mjs
- tests/sanctuary-story.test.mjs
- tests/sanctuary-chorus-state.test.mjs
- tests/sanctuary-chorus-controller.test.mjs
- tests/sanctuary-chorus-network.test.mjs
- tests/sanctuary-ending.test.mjs
- tests/sanctuary-browser-smoke.cjs
- tests/sanctuary-network-browser-smoke.cjs
- tests/firebase-rules-emulator.cjs
- tests/network-chat-integration.test.mjs
- tests/world-data.test.mjs
- tests/portal-transition.test.mjs
- tests/progress-storage.test.mjs
- tests/story-interactions.test.mjs
- tests/story-rendering.test.mjs
- .github/workflows/browser-smoke.yml
- .github/workflows/firebase-rules-test.yml
- .github/workflows/sanctuary-network-smoke.yml

---

### Task 1: 새 물리 릴리스 그래프 생성

**Files:**
- Create: scripts/roll-physical-release.mjs
- Create: tests/release-rollover-tool.test.mjs
- Create: src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js 및 현재 진입점에서 도달하는 나머지 77개 모듈의 -20260911-sanctuary 복제본
- Create: styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css
- Do not modify: index.html

**Interfaces:**
- Consumes: sourceEntry, sourceCss, suffix, rootDir
- Produces: rollPhysicalRelease(options) → { sourceEntry, targetEntry, sourceCss, targetCss, files }; 각 target module의 상대 import는 같은 target graph를 가리킨다.

- [ ] **Step 1: rollover 도구의 실패 테스트 작성**

    import test from "node:test";
    import assert from "node:assert/strict";
    import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
    import { tmpdir } from "node:os";
    import { join } from "node:path";
    import { rollPhysicalRelease } from "../scripts/roll-physical-release.mjs";

    test("rollPhysicalRelease copies the complete reachable graph without touching sources", async () => {
      const rootDir = await mkdtemp(join(tmpdir(), "pixel-release-"));
      await mkdir(join(rootDir, "src"));
      await writeFile(join(rootDir, "src/main-old.js"), 'import "./child-old.js";\n');
      await writeFile(join(rootDir, "src/child-old.js"), "export const value = 1;\n");
      await writeFile(join(rootDir, "styles-old.css"), ":root{--x:1}\n");
      const result = await rollPhysicalRelease({
        rootDir,
        sourceEntry: "src/main-old.js",
        sourceCss: "styles-old.css",
        suffix: "new",
      });
      assert.deepEqual(result.files.sort(), ["src/child-old-new.js", "src/main-old-new.js"]);
      assert.match(await readFile(join(rootDir, "src/main-old-new.js"), "utf8"), /child-old-new\.js/);
      assert.equal(await readFile(join(rootDir, "src/main-old.js"), "utf8"), 'import "./child-old.js";\n');
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/release-rollover-tool.test.mjs  
Expected: FAIL with ERR_MODULE_NOT_FOUND for scripts/roll-physical-release.mjs.

- [ ] **Step 3: import graph copier 구현**

    export async function rollPhysicalRelease({ rootDir, sourceEntry, sourceCss, suffix }) {
      const visited = new Set();
      const queue = [sourceEntry];
      const targetOf = path => path.replace(/\.js$/, "-" + suffix + ".js");
      while (queue.length) {
        const path = queue.shift();
        if (visited.has(path)) continue;
        visited.add(path);
        const source = await readFile(resolve(rootDir, path), "utf8");
        for (const specifier of localModuleSpecifiers(source)) {
          queue.push(normalizeRelativeModule(path, specifier));
        }
      }
      for (const path of visited) {
        const source = await readFile(resolve(rootDir, path), "utf8");
        const rewritten = rewriteLocalImports(source, path, targetOf, visited);
        const target = targetOf(path);
        await writeFile(resolve(rootDir, target), rewritten);
      }
      const targetCss = sourceCss.replace(/\.css$/, "-" + suffix + ".css");
      await copyFile(resolve(rootDir, sourceCss), resolve(rootDir, targetCss));
      return { sourceEntry, targetEntry: targetOf(sourceEntry), sourceCss, targetCss, files: [...visited].map(targetOf) };
    }

localModuleSpecifiers는 import/export from과 side-effect import의 상대 .js URL만 추출한다. normalizeRelativeModule은 POSIX 경로로 정규화하고 rootDir 밖 이동을 거부한다. rewriteLocalImports는 visited 안의 상대 모듈만 targetOf 결과로 바꾸며 원격 Firebase URL과 비 JavaScript URL은 그대로 둔다.

- [ ] **Step 4: 도구 테스트 통과 확인**

Run: node --test tests/release-rollover-tool.test.mjs  
Expected: PASS, 1 test.

- [ ] **Step 5: 현재 78개 그래프와 CSS 복제**

Run: node scripts/roll-physical-release.mjs --entry src/main-20260903-volcano-20260905-upgrade.js --css styles-20260903-volcano-20260905-upgrade.css --suffix 20260911-sanctuary  
Expected: summary reports modules=78, target entry src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js, sourceChanged=0.

Run: node --check scripts/roll-physical-release.mjs  
Expected: exit 0.

- [ ] **Step 6: 기계적 릴리스 커밋**

    git add scripts/roll-physical-release.mjs tests/release-rollover-tool.test.mjs src/*-20260911-sanctuary.js styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css
    git commit -m "chore: start sanctuary physical release graph"

---

### Task 2: 네 성역 맵과 정적 포털

**Files:**
- Create: src/sanctuary-world-data-20260911-sanctuary.js
- Modify: src/region-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/volcano-world-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/world-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/portal-transition-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Test: tests/sanctuary-world-data.test.mjs
- Test: tests/world-data.test.mjs
- Test: tests/portal-transition.test.mjs

**Interfaces:**
- Consumes: 기존 portal shape { id, x, y, w, h, label, color, destination, requirements }
- Produces: SANCTUARY_MAP_IDS, SANCTUARY_WORLD_DEFINITIONS, SANCTUARY_CASKETS, SANCTUARY_OVERLAY_ANCHORS, getSanctuaryWorldDefinition(mapId)

- [ ] **Step 1: 맵 크기·봉인함·포털·충돌 불변 실패 테스트 작성**

    test("sanctuary contains four 2160x1800 maps and exactly three core caskets", () => {
      assert.deepEqual(SANCTUARY_MAP_IDS, [
        "sanctuary",
        "sanctuary-memory-archive",
        "sanctuary-return-record",
        "sanctuary-three-futures",
      ]);
      for (const id of SANCTUARY_MAP_IDS) {
        assert.deepEqual(
          [SANCTUARY_WORLD_DEFINITIONS[id].width, SANCTUARY_WORLD_DEFINITIONS[id].height],
          [2160, 1800],
        );
      }
      assert.deepEqual(SANCTUARY_CASKETS.map(value => value.id), [
        "forest-core-casket", "coast-core-casket", "volcano-core-casket",
      ]);
    });

    test("locked sanctuary portals stay physical and only their usability changes", () => {
      const entrance = SANCTUARY_WORLD_DEFINITIONS.sanctuary;
      const portal = entrance.portals.find(value => value.id === "to-memory-archive");
      assert.equal(Boolean(portal), true);
      assert.equal(canUsePortal(portal, createInitialWorldProgress()), false);
      const ready = progressSanctuary(volcanoCompleteProgress(), { type: "activate-core", coreId: "forest-core-casket" });
      const ready2 = progressSanctuary(ready.progress, { type: "activate-core", coreId: "coast-core-casket" });
      const ready3 = progressSanctuary(ready2.progress, { type: "activate-core", coreId: "volcano-core-casket" });
      assert.equal(canUsePortal(portal, ready3.progress), true);
      assert.deepEqual(entrance.obstacles, SANCTUARY_WORLD_DEFINITIONS.sanctuary.obstacles);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-world-data.test.mjs tests/world-data.test.mjs tests/portal-transition.test.mjs  
Expected: FAIL because sanctuary-world-data module and new map IDs do not exist.

- [ ] **Step 3: 맵 데이터 구현**

    export const SANCTUARY_MAP_IDS = Object.freeze([
      "sanctuary",
      "sanctuary-memory-archive",
      "sanctuary-return-record",
      "sanctuary-three-futures",
    ]);

    export const SANCTUARY_CASKETS = freeze([
      { id: "forest-core-casket", regionId: "forest", x: 780, y: 860, color: "#4ade80" },
      { id: "coast-core-casket", regionId: "coast", x: 1080, y: 700, color: "#38bdf8" },
      { id: "volcano-core-casket", regionId: "volcano", x: 1380, y: 860, color: "#fb923c" },
    ]);

    export const SANCTUARY_WORLD_DEFINITIONS = freeze({
      sanctuary: world("sanctuary", "픽셀 코어 성역 입구", true, [
        portal("to-core-caldera", 1032, 1600, "화구 코어 제단", "#ef4444", "volcano-core-caldera", 1080, 300),
        portal("to-memory-archive", 1032, 100, "기억 회랑", "#67e8f9", "sanctuary-memory-archive", 1080, 1500),
      ]),
      "sanctuary-memory-archive": world("sanctuary-memory-archive", "기억 회랑", false, [
        portal("to-sanctuary", 1032, 1600, "픽셀 코어 성역 입구", "#67e8f9", "sanctuary", 1080, 300),
        portal("to-return-record", 1032, 100, "마지막 귀환 기록실", "#67e8f9", "sanctuary-return-record", 1080, 1500),
      ]),
      "sanctuary-return-record": world("sanctuary-return-record", "마지막 귀환 기록실", false, [
        portal("to-memory-archive", 1032, 1600, "기억 회랑", "#67e8f9", "sanctuary-memory-archive", 1080, 300),
        portal("to-three-futures", 1032, 100, "세 개의 미래", "#f8fafc", "sanctuary-three-futures", 1080, 1500),
      ]),
      "sanctuary-three-futures": world("sanctuary-three-futures", "세 개의 미래", true, [
        portal("to-return-record", 1032, 1600, "마지막 귀환 기록실", "#67e8f9", "sanctuary-return-record", 1080, 300),
      ]),
    });

world은 width=2160, height=1800, spawn, enemySpawns, portals, obstacles를 동결한다. 중앙 이동축과 모든 portal rectangle은 장애물과 겹치지 않게 좌표 테스트를 추가한다.

- [ ] **Step 4: registry와 renderer 연결**

REGION_DEFINITIONS.sanctuary.mapIds를 SANCTUARY_MAP_IDS로 바꾸고 WORLD_DEFINITIONS에 SANCTUARY_WORLD_DEFINITIONS를 합친다. 기존 volcano 정의에서 sanctuary 객체만 제거하되 volcano-core-caldera의 to-sanctuary 포털은 유지한다. world renderer는 SANCTUARY_MAP_IDS를 별도 집합으로 처리하고 백색·청록 바탕을 사용한다.

- [ ] **Step 5: 맵 테스트 통과 확인**

Run: node --test tests/sanctuary-world-data.test.mjs tests/world-data.test.mjs tests/portal-transition.test.mjs  
Expected: PASS; total world area increases by 3 × 2160 × 1800 and old portal assertions remain green.

- [ ] **Step 6: 커밋**

    git add src/sanctuary-world-data-20260911-sanctuary.js src/region-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/volcano-world-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/world-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/portal-transition-20260903-volcano-20260905-upgrade-20260911-sanctuary.js tests/sanctuary-world-data.test.mjs tests/world-data.test.mjs tests/portal-transition.test.mjs
    git commit -m "feat: add connected sanctuary maps"

---

### Task 3: 성역 진행 reducer와 포털 해금

**Files:**
- Create: src/sanctuary-progress-20260911-sanctuary.js
- Modify: src/chapter-progress-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Test: tests/sanctuary-progress.test.mjs
- Test: tests/chapter-progress.test.mjs
- Test: tests/game-chapter-progress.test.mjs

**Interfaces:**
- Produces: createInitialSanctuaryChapter(), normalizeSanctuaryChapter(value), reduceSanctuaryChapter(chapter, action) → { chapter, effects }
- Produces: progressSanctuary(worldProgress, action) → { progress, effects }
- Action types: activate-core, collect-memory, submit-memory-sequence, reveal-truth, reject-false-return, complete-record-field, link-correction, separate-chorus, collect-testimony, preview-future, choose-ending

- [ ] **Step 1: 엄격 정규화와 의존성 실패 테스트 작성**

    test("sanctuary normalization rejects hostile types and dependent terminal flags", () => {
      const chapter = normalizeSanctuaryChapter({
        activatedCoreIds: "forest-core-casket",
        memorySequence: ["departure-bell", "dawn-bird", "tide-bell", "mine-shift-bell"],
        memoryOrderSolved: "true",
        correctionLinked: true,
        chorusSeparated: true,
        endingChoice: "victory",
        completed: true,
      });
      assert.deepEqual(chapter.activatedCoreIds, []);
      assert.equal(chapter.memoryOrderSolved, false);
      assert.equal(chapter.correctionLinked, false);
      assert.equal(chapter.chorusSeparated, false);
      assert.equal(chapter.endingChoice, null);
      assert.equal(chapter.completed, false);
    });

    test("only the canonical memory order unlocks the truth sequence", () => {
      const ready = memoryCollectedChapter();
      assert.equal(reduceSanctuaryChapter(ready, {
        type: "submit-memory-sequence",
        sequence: ["dawn-bird", "departure-bell", "tide-bell", "mine-shift-bell"],
      }).chapter.memoryOrderSolved, false);
      assert.equal(reduceSanctuaryChapter(ready, {
        type: "submit-memory-sequence",
        sequence: MEMORY_SOUND_IDS,
      }).chapter.memoryOrderSolved, true);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-progress.test.mjs tests/chapter-progress.test.mjs tests/game-chapter-progress.test.mjs  
Expected: FAIL because createInitialSanctuaryChapter and progressSanctuary are absent.

- [ ] **Step 3: 기본 상태와 reducer 구현**

    export function createInitialSanctuaryChapter() {
      return {
        activatedCoreIds: [],
        collectedMemoryIds: [],
        memorySequence: [],
        memoryOrderSolved: false,
        coreTruthRevealed: false,
        falseReturnRejected: false,
        completedRecordFieldIds: [],
        correctionLinked: false,
        chorusSeparated: false,
        collectedTestimonyIds: [],
        previewedFutureIds: [],
        endingChoice: null,
        completed: false,
      };
    }

    export function reduceSanctuaryChapter(value, action) {
      const chapter = normalizeSanctuaryChapter(value);
      const next = cloneSanctuaryChapter(chapter);
      const effects = [];
      applySanctuaryAction(next, action, effects);
      return { chapter: normalizeSanctuaryChapter(next), effects };
    }

normalizeSanctuaryChapter는 MEMORY_SOUND_IDS와 배열의 정확한 순서를 비교하고 선행 조건을 순서대로 강등한다. separate-chorus는 claim.uid와 action.uid가 같고 claim.eligible===true이며 encounterId가 비어 있지 않을 때만 적용한다.

- [ ] **Step 4: world progress wrapper와 map unlock 구현**

    export function progressSanctuary(progress, action) {
      return transition(progress, (next, effects) => {
        const result = reduceSanctuaryChapter(next.chapters.sanctuary, action);
        next.chapters.sanctuary = result.chapter;
        effects.push(...result.effects);
        if (result.chapter.activatedCoreIds.length === 3) unlockMap(next, effects, "sanctuary-memory-archive");
        if (result.chapter.falseReturnRejected) unlockMap(next, effects, "sanctuary-return-record");
        if (result.chapter.chorusSeparated) unlockMap(next, effects, "sanctuary-three-futures");
        if (result.chapter.completed && !next.completedRegionIds.includes("sanctuary")) {
          next.completedRegionIds.push("sanctuary");
          effects.push({ type: "region-completed", regionId: "sanctuary" });
        }
      });
    }

createInitialWorldProgress에 chapters.sanctuary를 추가하고 normalizeWorldProgressValue의 repairTerminal 구간도 같은 세 해금 조건을 재구성한다.

- [ ] **Step 5: reducer 및 회귀 테스트 통과 확인**

Run: node --test tests/sanctuary-progress.test.mjs tests/chapter-progress.test.mjs tests/game-chapter-progress.test.mjs  
Expected: PASS; coast와 volcano 기존 테스트 결과가 변하지 않는다.

- [ ] **Step 6: 커밋**

    git add src/sanctuary-progress-20260911-sanctuary.js src/chapter-progress-20260903-volcano-20260905-upgrade-20260911-sanctuary.js tests/sanctuary-progress.test.mjs tests/chapter-progress.test.mjs tests/game-chapter-progress.test.mjs
    git commit -m "feat: add sanctuary progression state machine"

---

### Task 4: v8 저장과 v1~v7 이전

**Files:**
- Modify: src/quest-state-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/progress-storage-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Test: tests/sanctuary-storage-v8.test.mjs
- Test: tests/progress-storage.test.mjs

**Interfaces:**
- Produces: progressStorageKey(nickname) with pixel-world.progress.v8:
- Produces: v7ProgressStorageKey(nickname)
- Player progress additions: earnedTitleIds: string[], claimedNarrativeRewardIds: string[]

- [ ] **Step 1: v1~v7 보존과 v8 손상 입력 실패 테스트 작성**

    for (const version of [1, 2, 3, 4, 5, 6, 7]) {
      test("migrates v" + version + " without losing existing progression", () => {
        const storage = storageWithVersion(version, validFixture(version));
        const loaded = loadProgressWithStatus(storage, "기록자");
        assert.equal(loaded.progress.gold, validFixture(version).gold || 0);
        assert.deepEqual(loaded.progress.worldProgress.chapters.sanctuary, createInitialSanctuaryChapter());
        assert.equal(JSON.parse(storage.getItem(progressStorageKey("기록자"))).version, 8);
      });
    }

    test("v8 normalizes invalid sanctuary arrays booleans and ending choices", () => {
      const storage = storageWithV8({ chapters: { sanctuary: {
        memorySequence: "departure-bell",
        memoryOrderSolved: "true",
        endingChoice: "erase",
        completed: true,
      }}});
      const sanctuary = loadProgress(storage, "오염된저장").worldProgress.chapters.sanctuary;
      assert.deepEqual(sanctuary.memorySequence, []);
      assert.equal(sanctuary.memoryOrderSolved, false);
      assert.equal(sanctuary.endingChoice, null);
      assert.equal(sanctuary.completed, false);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-storage-v8.test.mjs tests/progress-storage.test.mjs  
Expected: FAIL because current STORAGE_VERSION is 7 and v7 key has no migration branch.

- [ ] **Step 3: 저장 스키마 갱신**

    const STORAGE_VERSION = 8;
    const STORAGE_PREFIX = "pixel-world.progress.v8:";
    const V7_STORAGE_PREFIX = "pixel-world.progress.v7:";
    const V7_STORAGE_VERSION = 7;

    function toProgress(value) {
      return {
        ...toBaseAndInventoryProgress(value),
        earnedTitleIds: normalizeIdList(value.earnedTitleIds, SANCTUARY_TITLE_IDS),
        claimedNarrativeRewardIds: normalizeIdList(value.claimedNarrativeRewardIds, SANCTUARY_REWARD_COMPONENT_IDS),
        worldProgress: normalizeWorldProgress(value.worldProgress),
      };
    }

createInitialProgress와 cloneProgress에 두 배열을 추가한다. loadProgressWithStatus는 v8→v7→v6→…→v1 순서로 읽고 성공한 이전 결과를 v8에 저장한다. 이전 키는 삭제하지 않는다.

- [ ] **Step 4: 저장 테스트 통과 확인**

Run: node --test tests/sanctuary-storage-v8.test.mjs tests/progress-storage.test.mjs  
Expected: PASS; malformed JSON은 초기 진행으로 복구되고 migrationWriteFailed 의미가 유지된다.

- [ ] **Step 5: 커밋**

    git add src/quest-state-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/progress-storage-20260903-volcano-20260905-upgrade-20260911-sanctuary.js tests/sanctuary-storage-v8.test.mjs tests/progress-storage.test.mjs
    git commit -m "feat: migrate player saves to sanctuary v8"

---

### Task 5: 범용 기록 보관함

**Files:**
- Create: src/record-archive-20260911-sanctuary.js
- Modify: src/communication-log-20260829-coast-20260905-upgrade-20260911-sanctuary.js
- Modify: src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: index.html
- Modify: styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css
- Test: tests/record-archive.test.mjs
- Test: tests/communication-log.test.mjs

**Interfaces:**
- Produces: collectRecordArchiveEntries(worldProgress) → ArchiveRecord[]
- Produces: orderedArchiveRecords(records), renderRecordArchive(list, records)
- Compatibility: renderCommunicationLog(list, records) delegates to renderRecordArchive.

- [ ] **Step 1: 원본 보존과 정정 연결 실패 테스트 작성**

    test("archive keeps the incorrect source beside its correction", () => {
      const records = collectRecordArchiveEntries(correctedWorldProgress());
      const original = records.find(value => value.id === "first-archivist-deletion-log");
      const correction = records.find(value => value.id === "sanctuary-correction-link");
      assert.equal(Boolean(original), true);
      assert.equal(correction.correctsRecordId, original.id);
      assert.deepEqual(correction.evidenceRecordIds.sort(), [
        "core-self-division-original",
        "false-return-resonance-time",
      ]);
    });

    test("coast records retain timeline order in the generic archive", () => {
      const records = orderedArchiveRecords(coastAndSanctuaryRecords());
      assert.deepEqual(records.filter(value => value.chapterId === "coast").map(value => value.timelineOrder), [10, 20, 30, 40, 50, 60]);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/record-archive.test.mjs tests/communication-log.test.mjs  
Expected: FAIL because record-archive module is absent.

- [ ] **Step 3: 범용 모델과 renderer 구현**

    export function collectRecordArchiveEntries(worldProgress) {
      return orderedArchiveRecords([
        ...getCollectedCoastRecords(worldProgress).map(fromCoastRecord),
        ...getCollectedSanctuaryRecords(worldProgress),
      ]);
    }

    export function renderRecordArchive(list, records) {
      const entries = orderedArchiveRecords(records);
      list.replaceChildren(...(entries.length ? entries.map(record => {
        const item = list.ownerDocument.createElement("li");
        item.className = "record-archive-entry";
        item.dataset.recordId = record.id;
        item.append(recordHeading(record), recordBody(record), correctionLink(record, entries));
        return item;
      }) : [emptyRecord(list.ownerDocument)]));
    }

HTML의 보이는 문구를 “기록 보관함”과 “수집한 통신·기억·정정 기록을 다시 확인합니다.”로 바꾸고 기존 element ID는 회귀 호환을 위해 유지한다. 장문 기록은 overlay 안에서 스크롤하고 평상시 playfield 중앙을 가리지 않는다.

- [ ] **Step 4: game/main 연결**

game.updateChapterUi는 getCollectedCoastRecords 대신 collectRecordArchiveEntries를 호출한다. 기존 communication-log 모듈은 renderCommunicationLog 이름을 유지한 compatibility export로 새 renderer를 호출한다.

- [ ] **Step 5: 기록 UI 테스트 통과 확인**

Run: node --test tests/record-archive.test.mjs tests/communication-log.test.mjs tests/game-coast-story.test.mjs  
Expected: PASS; 해안 기록 재열기 동작도 유지된다.

- [ ] **Step 6: 커밋**

    git add src/record-archive-20260911-sanctuary.js src/communication-log-20260829-coast-20260905-upgrade-20260911-sanctuary.js src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js index.html styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css tests/record-archive.test.mjs tests/communication-log.test.mjs
    git commit -m "feat: generalize the story record archive"

---

### Task 6: 제12장 기억 회랑

**Files:**
- Create: src/sanctuary-story-data-20260911-sanctuary.js
- Modify: src/story-interactions-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/enemy-definitions-20260905-upgrade-20260911-sanctuary.js
- Modify: src/enemies-20260829-coast-20260905-upgrade-20260911-sanctuary.js
- Modify: src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Test: tests/sanctuary-story.test.mjs
- Test: tests/story-interactions.test.mjs
- Test: tests/story-rendering.test.mjs

**Interfaces:**
- Produces: SANCTUARY_STORY_INTERACTIONS, SANCTUARY_ARCHIVE_RECORDS, getSanctuaryStoryContent(mapId), getSanctuaryChapterObjective(worldProgress)
- Extends: resolveStoryInteraction(progress, interactionId, response)

- [ ] **Step 1: 기억 정답·오답·진실·환영 실패 테스트 작성**

    test("chapter 12 requires input order and all contradictions", () => {
      let progress = chapter12ReadyProgress();
      for (const id of MEMORY_SOUND_IDS) progress = progressSanctuary(progress, { type: "collect-memory", memoryId: id }).progress;
      const wrong = resolveStoryInteraction(progress, "memory-sequence-console", {
        sequence: ["dawn-bird", "departure-bell", "tide-bell", "mine-shift-bell"],
      });
      assert.equal(wrong.outcome, "retryable");
      assert.equal(wrong.progress.chapters.sanctuary.memoryOrderSolved, false);
      const solved = resolveStoryInteraction(progress, "memory-sequence-console", { sequence: MEMORY_SOUND_IDS });
      assert.equal(solved.progress.chapters.sanctuary.memoryOrderSolved, true);
      const rejected = rejectAllFalseReturnContradictions(revealAllTruths(solved.progress));
      assert.equal(rejected.chapters.sanctuary.falseReturnRejected, true);
      assert.equal(rejected.unlockedMapIds.includes("sanctuary-return-record"), true);
    });

    test("the resonance timestamp is never labeled as incident time", () => {
      const record = SANCTUARY_ARCHIVE_RECORDS.find(value => value.id === "false-return-resonance-time");
      assert.match(record.pages.join(" "), /공명 시각/);
      assert.doesNotMatch(record.pages.join(" "), /사건 시각입니다/);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-story.test.mjs tests/story-interactions.test.mjs tests/story-rendering.test.mjs  
Expected: FAIL because sanctuary story content is not registered.

- [ ] **Step 3: 상호작용 데이터 작성**

정확한 소리 순서는 departure-bell, dawn-bird, tide-bell, mine-shift-bell이다. 진실 기록은 false-return-resonance-time, first-archivist-deletion-log, core-self-division-original이고 환영 모순은 false-return-garen-unscarred, false-return-source-erased, false-return-resonance-time이다.

    export const SANCTUARY_STORY_INTERACTIONS = freeze([
      ...coreCasketTargets(),
      ...memorySoundTargets(),
      sequenceConsoleTarget(),
      ...truthRecordTargets(),
      ...falseReturnContradictionTargets(),
      ...returnRecordTargets(),
      correctionConsoleTarget(),
      ...futureOpinionTargets(),
      ...futurePreviewTargets(),
      endingConsoleTarget(),
    ]);

각 target은 chapterId="sanctuary", 정확한 mapId, x/y, interactionRadius, prompt, pages를 가진다. 현재 인물만 speaker portrait variant를 받고 기억 record는 silhouette variant를 받는다.

- [ ] **Step 4: dialogue action과 F 입력 전이 구현**

storyDialogueModel은 memory-sequence-console에서 아직 선택하지 않은 네 소리 버튼과 “배열 제출”을 제공한다. game.handleDialogueAction은 story-memory-add-ID와 story-memory-submit을 응답 객체 { sequence }로 바꾼다. 오답 result.retryable은 overlay를 닫지 않고 오류 문구와 재시도 action을 유지한다.

- [ ] **Step 5: 로컬 노이즈 몬스터 추가**

memory-noise는 sanctuary-memory-archive에만 생성되는 브라우저 로컬 enemy다. 공유 boss/network path를 갖지 않고 EXP/Gold를 주지 않으며 환영 모순 확인을 방해하는 짧은 방어 구간에서만 active다. 얼굴 대신 흐릿한 outline renderer를 사용한다.

- [ ] **Step 6: 제12장 테스트 통과 확인**

Run: node --test tests/sanctuary-story.test.mjs tests/story-interactions.test.mjs tests/story-rendering.test.mjs tests/enemy-definitions.test.mjs tests/enemies.test.mjs  
Expected: PASS; 기존 coast/volcano story assertions도 유지된다.

- [ ] **Step 7: 커밋**

    git add src/sanctuary-story-data-20260911-sanctuary.js src/story-interactions-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/enemy-definitions-20260905-upgrade-20260911-sanctuary.js src/enemies-20260829-coast-20260905-upgrade-20260911-sanctuary.js src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js tests/sanctuary-story.test.mjs tests/story-interactions.test.mjs tests/story-rendering.test.mjs tests/enemy-definitions.test.mjs tests/enemies.test.mjs
    git commit -m "feat: implement the sanctuary memory archive"

---

### Task 7: 제13장 보존 후 정정 기록

**Files:**
- Modify: src/sanctuary-story-data-20260911-sanctuary.js
- Modify: src/sanctuary-progress-20260911-sanctuary.js
- Modify: src/story-interactions-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/record-archive-20260911-sanctuary.js
- Modify: src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Test: tests/sanctuary-story.test.mjs
- Test: tests/sanctuary-progress.test.mjs
- Test: tests/record-archive.test.mjs

**Interfaces:**
- Record field IDs: vanguard-return-state, core-division-cause, delay-roan, delay-sera, delay-garen, delay-lumen
- Produces: answerForRecordField(fieldId, captainOutcome), createCorrectionArchiveRecord(chapter)

- [ ] **Step 1: 인물별 책임과 원본 보존 실패 테스트 작성**

    test("all six fields are required and Lumen is not the core split cause", () => {
      let progress = returnRecordReadyProgress("rescued");
      for (const fieldId of RECORD_FIELD_IDS) {
        progress = progressSanctuary(progress, {
          type: "complete-record-field",
          fieldId,
          answerId: answerForRecordField(fieldId, "rescued").id,
        }).progress;
      }
      const linked = progressSanctuary(progress, { type: "link-correction" }).progress;
      assert.equal(linked.chapters.sanctuary.correctionLinked, true);
      assert.equal(
        answerForRecordField("core-division-cause", "rescued").id,
        "conflicting-records-self-division",
      );
      assert.notEqual(
        answerForRecordField("delay-lumen", "rescued").id,
        answerForRecordField("core-division-cause", "rescued").id,
      );
      assert.equal(collectRecordArchiveEntries(linked).some(value => value.id === "first-archivist-deletion-log"), true);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-story.test.mjs tests/sanctuary-progress.test.mjs tests/record-archive.test.mjs  
Expected: FAIL because record field answers and correction record are absent.

- [ ] **Step 3: 여섯 필드와 정정 연결 구현**

각 field의 answer set은 하나의 검증된 답, 한 개 이상의 불완전 답을 갖는다. delay-lumen은 “분화를 늦추기 위해 봉인을 건드린 선택과 자기 몫의 지연 책임”을 정답으로 하고 core-division-cause는 “상충하는 귀환 기록에 의한 코어 자가분열”을 정답으로 한다.

    export function createCorrectionArchiveRecord(chapter) {
      if (normalizeSanctuaryChapter(chapter).correctionLinked !== true) return null;
      return freeze({
        id: "sanctuary-correction-link",
        chapterId: "sanctuary",
        recordKind: "correction",
        correctsRecordId: "first-archivist-deletion-log",
        evidenceRecordIds: ["core-self-division-original", "false-return-resonance-time"],
        title: "보존 후 정정된 마지막 귀환 기록",
        pages: ["기존 기록을 보존한 채 여섯 책임 기록과 원본 근거를 연결했다."],
      });
    }

- [ ] **Step 4: rescued/lost 표시 분리**

lost의 delay-lumen 답과 보관함 출처는 미전송 철수 명령서와 잔류 기억을 사용한다. reducer의 정답 ID와 correctionLinked 전이는 양쪽이 동일하며 현재 인물 루멘을 만들지 않는다.

- [ ] **Step 5: 제13장 테스트 통과 확인**

Run: node --test tests/sanctuary-story.test.mjs tests/sanctuary-progress.test.mjs tests/record-archive.test.mjs  
Expected: PASS; 원본과 correction이 동시에 반환된다.

- [ ] **Step 6: 커밋**

    git add src/sanctuary-story-data-20260911-sanctuary.js src/sanctuary-progress-20260911-sanctuary.js src/story-interactions-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/record-archive-20260911-sanctuary.js src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js tests/sanctuary-story.test.mjs tests/sanctuary-progress.test.mjs tests/record-archive.test.mjs
    git commit -m "feat: preserve and correct the return record"

---

### Task 8: 무명의 합창 순수 상태 머신과 개인 오염도

**Files:**
- Create: src/sanctuary-chorus-data-20260911-sanctuary.js
- Create: src/sanctuary-chorus-state-20260911-sanctuary.js
- Test: tests/sanctuary-chorus-state.test.mjs

**Interfaces:**
- Produces: createChorusEncounter(options), normalizeChorusEncounter(value)
- Produces: createPersonalChorusState(), reducePersonalChorusState(state, event, now)
- Produces: validateChorusAction(action, context), applyChorusAction(encounter, validated, now)
- Produces: acquireChorusAuthority(value, options), renewChorusAuthority(value, options), createChorusCompletionClaims(encounter, now)

- [ ] **Step 1: 단계 경계와 일반 damage 무효 실패 테스트 작성**

    test("cohesion changes only through phase objectives", () => {
      let state = createChorusEncounter({ encounterId: "chorus-1", authorityUid: "host", now: 1000 });
      const strike = validateChorusAction(fragmentStrike("a"), context(state, "a", 1100));
      state = applyChorusAction(state, strike, 1100).encounter;
      assert.equal(state.hp, 100);
      for (const pair of correctAnchorPairs()) {
        state = applyValid(state, anchorAction("a", pair), 1200);
      }
      assert.deepEqual([state.phase, state.hp], ["testimonies", 70]);
      for (const answer of correctTestimonyAnswers()) state = applyValid(state, answer, 1300);
      assert.deepEqual([state.phase, state.hp], ["onslaught", 40]);
      for (const cut of fourVulnerableBondCuts(state)) state = applyValid(state, cut, cut.createdAt);
      assert.deepEqual([state.phase, state.status, state.hp], ["separated", "separated", 0]);
    });

    test("wrong personal actions cannot mutate shared encounter", () => {
      const shared = anchorsEncounter();
      const result = applyChorusAction(shared, validateChorusAction(
        anchorAction("a", { fragmentId: "forest", anchorId: "coast" }),
        context(shared, "a", 2000),
      ), 2000);
      assert.deepEqual(result.encounter, shared);
      assert.equal(result.personalEvent.type, "contamination");
    });

- [ ] **Step 2: 오염도 100 실패 테스트 작성**

    test("contamination overload returns the fragment and recovers to 50", () => {
      const result = reducePersonalChorusState({
        ...createPersonalChorusState(),
        contamination: 90,
        carriedFragmentId: "forest",
      }, { id: "mistake-1", type: "contamination", amount: 10 }, 5000);
      assert.equal(result.state.contamination, 50);
      assert.equal(result.state.carriedFragmentId, null);
      assert.equal(result.state.confusedUntil, 8000);
      assert.equal(result.state.attackLockedUntil, 8000);
      assert.equal(result.state.movementSlowUntil, 8000);
    });

- [ ] **Step 3: 실패 확인**

Run: node --test tests/sanctuary-chorus-state.test.mjs  
Expected: FAIL because chorus data/state modules are absent.

- [ ] **Step 4: 상수와 공유 reducer 구현**

ANCHOR_IDS는 forest, coast, volcano이고 TESTIMONY_VERDICTS는 fact, partial, unsupported다. 여섯 정답과 네 bond ID는 설계 명세의 정확한 목록을 사용한다.

    export function applyChorusAction(value, validated, now = Date.now()) {
      const encounter = normalizeChorusEncounter(value);
      if (!validated?.ok || encounter.status !== "active") {
        return { encounter, events: [], personalEvent: validated?.personalEvent || null };
      }
      const next = cloneEncounter(encounter);
      const events = [];
      applyObjectiveAction(next, validated.action, now, events);
      advancePhaseAtThreshold(next, events, now);
      recordContribution(next, validated.action.uid, validated.action.type, now);
      return { encounter: normalizeChorusEncounter(next), events, personalEvent: null };
    }

중복 anchor/testimony/bond, 취약 시간 밖 bond-cut, 오래된 epoch, 다른 encounterId, 허용되지 않은 ID는 hp를 바꾸지 않는다. phase별 hp는 100/70/40/0 경계를 넘지 않는다.

- [ ] **Step 5: 개인 reducer와 authority 구현**

오염 event ID는 processedContaminationEventIds로 한 번만 적용한다. authority lease는 기존 5초 유예/2초 갱신 패턴을 유지하고 epoch가 증가한 takeover만 허용한다. completion claim은 separated encounter의 contributors UID에만 { encounterId, uid, eligible:true, createdAt }를 만든다.

- [ ] **Step 6: 순수 상태 테스트 통과 확인**

Run: node --test tests/sanctuary-chorus-state.test.mjs  
Expected: PASS for 100→70→40→0, wrong-answer isolation, contamination overload, dedupe, authority takeover, contributor claims.

- [ ] **Step 7: 커밋**

    git add src/sanctuary-chorus-data-20260911-sanctuary.js src/sanctuary-chorus-state-20260911-sanctuary.js tests/sanctuary-chorus-state.test.mjs
    git commit -m "feat: add unnamed chorus state machine"

---

### Task 9: 로컬 전투 컨트롤러, 패턴, 렌더링, 두 게이지

**Files:**
- Create: src/sanctuary-chorus-controller-20260911-sanctuary.js
- Create: src/sanctuary-chorus-rendering-20260911-sanctuary.js
- Modify: src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: index.html
- Modify: styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css
- Test: tests/sanctuary-chorus-controller.test.mjs
- Test: tests/game-boss-controller-events.test.mjs
- Test: tests/story-rendering.test.mjs

**Interfaces:**
- Produces: createSanctuaryChorusController({ uid, mode, network, seedSnapshot, captainOutcome, now })
- Controller methods: setMap(mapId, options), update(dt, context, timestamp), requestAttack(input), interact(player), nearbyInteraction(player), targetableBosses(), renderModel(), receiveSnapshot(value), receiveActions(value), receiveCompletionClaims(value), clear()
- Produces: drawSanctuaryOverlays(ctx, model, camera), updateChorusHud(elements, shared, personal, now)

- [ ] **Step 1: 공격 목적과 회피 가능한 예고 실패 테스트 작성**

    test("basic Q E and R create fragments but never direct cohesion damage", async () => {
      const controller = localAnchorsController();
      for (const attackKind of ["basic", "strong", "skill-e", "skill-r"]) {
        const before = controller.snapshot.hp;
        await controller.requestAttack(validHit(attackKind));
        assert.equal(controller.snapshot.hp, before);
        assert.equal(FRAGMENT_IDS.includes(controller.personalSnapshot.carriedFragmentId), true);
        controller.dropCarriedFragment();
      }
    });

    test("leaving a telegraph before impact avoids damage", () => {
      const controller = onslaughtController({ pattern: "forest-root-sweep", impactAt: 2000 });
      controller.update(1 / 60, { player: { uid: "a", x: 1080, y: 900 } }, 1900);
      const outside = controller.update(1 / 60, { player: { uid: "a", x: 300, y: 300 } }, 2000);
      assert.equal(outside.events.some(value => value.type === "damage-player"), false);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-chorus-controller.test.mjs tests/game-boss-controller-events.test.mjs tests/story-rendering.test.mjs  
Expected: FAIL because controller/rendering modules and chorus HUD do not exist.

- [ ] **Step 3: controller 입력 adapter 구현**

    export function createSanctuaryChorusController(options = {}) {
      return new SanctuaryChorusController({
        uid: options.uid || "local-player",
        mode: options.mode || "solo",
        network: options.network || null,
        seedSnapshot: options.seedSnapshot || null,
        captainOutcome: options.captainOutcome,
        now: options.now || (() => Date.now()),
      });
    }

anchors에서 requestAttack은 fragment-strike를 만들고 carriedFragmentId를 설정한다. nearbyInteraction/interact는 올바른 닻 배치, 증언 선택, 기록 활성화를 F 상호작용으로 보낸다. onslaught에서 targetableBosses는 vulnerableUntil 안의 active bond만 targetable=true로 반환한다.

- [ ] **Step 4: 순환 공격과 개인 피격 구현**

forest-root-sweep, coast-tide-cross, volcano-crack-burst를 순환한다. telegraph rect/circle과 impact timestamp를 render model에 먼저 노출하고 impact 순간 해당 클라이언트의 현재 위치만 판정한다. processed pattern event ID로 같은 공격의 중복 피해를 막는다.

- [ ] **Step 5: Canvas와 DOM HUD 구현**

    <section id="chorusHud" class="chorus-hud glass" aria-live="polite" hidden>
      <div class="chorus-meter">
        <span>노이즈 결속도</span><b id="chorusCohesionText">100 / 100</b>
        <div class="bar cohesion"><i id="chorusCohesionBar"></i></div>
      </div>
      <div class="chorus-meter contamination">
        <span>개인 오염도</span><b id="chorusContaminationText">0 / 100</b>
        <div class="bar contamination"><i id="chorusContaminationBar"></i></div>
      </div>
      <small id="chorusPhaseText">기억 파편을 기록 닻으로 운반하세요.</small>
    </section>

HUD는 우측 상단의 기존 coop boss HUD 위치를 교대로 사용하고 중앙·하단 이동 시야를 가리지 않는다. CSS variables --sanctuary-white, --sanctuary-cyan, --memory-forest, --memory-coast, --memory-volcano, --chorus-black을 정의한다. prefers-reduced-motion에서는 비필수 pulse와 흔들림을 끈다.

- [ ] **Step 6: game 루프 통합**

PixelRPG에 chorusController와 processed completion IDs를 추가한다. switchWorld에서 chorusController.setMap을 호출한다. update에서 chorus controller를 기존 coop boss와 별개로 진행한다. tryAttack/applyAttackHits/applyProjectileHits는 chorus target이면 requestAttack을 호출한다. updateNpcPrompt는 chorus nearby interaction을 story/NPC보다 앞서 F prompt로 표시한다. render는 world layer 뒤, entities 앞에 telegraph를 그리고 entities 뒤에 black bonds와 분리 오버레이를 그린다.

- [ ] **Step 7: 로컬 전투 테스트 통과 확인**

Run: node --test tests/sanctuary-chorus-controller.test.mjs tests/game-boss-controller-events.test.mjs tests/story-rendering.test.mjs  
Expected: PASS; 죽음, 폭발, corpse, boss-defeated event가 separated 결과에 존재하지 않는다.

- [ ] **Step 8: 커밋**

    git add src/sanctuary-chorus-controller-20260911-sanctuary.js src/sanctuary-chorus-rendering-20260911-sanctuary.js src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js index.html styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css tests/sanctuary-chorus-controller.test.mjs tests/game-boss-controller-events.test.mjs tests/story-rendering.test.mjs
    git commit -m "feat: integrate the local unnamed chorus encounter"

---

### Task 10: 루멘 분기와 세 직업 동등성

**Files:**
- Modify: src/sanctuary-chorus-controller-20260911-sanctuary.js
- Modify: src/sanctuary-chorus-rendering-20260911-sanctuary.js
- Modify: src/sanctuary-story-data-20260911-sanctuary.js
- Modify: src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Test: tests/sanctuary-chorus-controller.test.mjs
- Test: tests/sanctuary-story.test.mjs
- Test: tests/hidden-weapons.test.mjs

**Interfaces:**
- Produces: chorusBranchPresentation(captainOutcome), chorusAttackPresentation(classId, actionType)
- Extends controller: requestLumenAssist(anchorId)

- [ ] **Step 1: rescued/lost와 class-neutral 결과 실패 테스트 작성**

    test("captain branches differ in presentation but not encounter solvability", () => {
      assert.equal(chorusBranchPresentation("rescued").lumen.mode, "live-voice");
      assert.equal(chorusBranchPresentation("lost").lumen.mode, "unsent-order");
      assert.equal(chorusBranchPresentation("lost").lumen.presentActor, false);
      assert.deepEqual(
        solveEncounter("rescued", "warrior").final,
        solveEncounter("lost", "mage").final,
      );
    });

    test("all classes apply the same narrative bond cut", () => {
      const results = ["warrior", "archer", "mage"].map(classId => validBondCutFor(classId));
      assert.deepEqual(results.map(value => value.cohesionDelta), [-10, -10, -10]);
      assert.equal(new Set(results.map(value => value.presentationId)).size, 3);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-chorus-controller.test.mjs tests/sanctuary-story.test.mjs tests/hidden-weapons.test.mjs  
Expected: FAIL because branch/class presentation functions are absent.

- [ ] **Step 3: 분기 표현과 일회성 assist 구현**

rescued는 한 번의 false-order-interrupt 음성과 hidden weapon 보유 시 한 번의 lumen-assist를 제공한다. requestLumenAssist는 anchors phase, 미사용 상태, 유효 anchor일 때만 안정화하며 shared lumenAssistUsed를 true로 만든다. lost는 같은 슬롯에 unsent-retreat-order와 residual-memory를 표시하며 assist 버튼을 만들지 않는다.

- [ ] **Step 4: 세 직업 표현 구현**

warrior는 선을 베어 분리하고, archer는 기록 표식을 꿰뚫고, mage는 공명 주파수를 해제한다. action type과 결속도 delta는 동일하고 presentationId만 warrior-sever, archer-pin, mage-dispel로 다르다.

- [ ] **Step 5: 분기/직업 테스트 통과 확인**

Run: node --test tests/sanctuary-chorus-controller.test.mjs tests/sanctuary-story.test.mjs tests/hidden-weapons.test.mjs  
Expected: PASS; lost에도 hidden weapon 요구가 없고 두 분기의 일반 보상/결말 데이터가 같다.

- [ ] **Step 6: 커밋**

    git add src/sanctuary-chorus-controller-20260911-sanctuary.js src/sanctuary-chorus-rendering-20260911-sanctuary.js src/sanctuary-story-data-20260911-sanctuary.js src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js tests/sanctuary-chorus-controller.test.mjs tests/sanctuary-story.test.mjs tests/hidden-weapons.test.mjs
    git commit -m "feat: preserve chorus branches and class parity"

---

### Task 11: 전용 Firebase transport와 연결 해제 솔로 전환

**Files:**
- Create: src/sanctuary-chorus-network-20260911-sanctuary.js
- Modify: src/network-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/firebase-config-20260905-upgrade-20260911-sanctuary.js
- Modify: src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Test: tests/sanctuary-chorus-network.test.mjs
- Test: tests/network-chat-integration.test.mjs
- Test: tests/game-play-mode.test.mjs

**Interfaces:**
- Produces: createChorusNetwork({ dbModule, db, roomId, uid, callbacks, now, timers })
- Network methods: setMap, ensureEncounter, tryAcquireAuthority, renewAuthority, publishState, sendAction, acknowledgeAction, writeCompletionClaims, acknowledgeCompletionClaim, stop
- Extends createNetworkAdapter return: chorus
- Produces: getFirebaseEmulatorConfig(locationRef)

- [ ] **Step 1: 전용 경로·두 UID·authority 이전 실패 테스트 작성**

    test("chorus network uses only the dedicated sanctuary path", async () => {
      const fake = firebaseModulesFake();
      const a = createChorusNetwork(networkOptions(fake, "a"));
      await a.setMap("sanctuary-return-record");
      await a.sendAction({ type: "anchor-stabilize", sequence: 1, encounterId: "e1" });
      assert.equal(fake.sets[0].path, "rooms/public/chorus/sanctuary-return-record/actions/a/1");
      assert.equal(fake.sets.some(value => value.path.includes("/bosses/")), false);
    });

    test("expired authority transfers without replaying acknowledged actions", async () => {
      const fake = firebaseModulesFake({ state: expiredEncounter("a", 2) });
      const b = createChorusNetwork(networkOptions(fake, "b", 10000));
      const result = await b.tryAcquireAuthority();
      assert.equal(result.encounter.authorityUid, "b");
      assert.equal(result.encounter.authorityEpoch, 3);
      assert.deepEqual(result.encounter.stabilizedAnchorIds, ["forest"]);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-chorus-network.test.mjs tests/network-chat-integration.test.mjs tests/game-play-mode.test.mjs  
Expected: FAIL because createChorusNetwork and network.chorus are absent.

- [ ] **Step 3: Firebase transport 구현**

basePath는 항상 rooms/public/chorus/sanctuary-return-record다. setMap은 sanctuary-return-record에서만 state, actions, 자기 completionClaims를 구독하고 다른 맵에서는 모두 해제한다. state publish는 authority UID만 시도한다. action은 uid/sequence 경로로 set하고 authority가 적용 후 remove한다. claim은 authority가 contributor별로 생성하고 각 UID는 자기 claim에 acknowledgedAt만 추가할 수 있다.

- [ ] **Step 4: SDK emulator 연결 선택 구현**

    export function getFirebaseEmulatorConfig(locationRef = globalThis.location) {
      const local = ["127.0.0.1", "localhost"].includes(locationRef?.hostname);
      const enabled = new URLSearchParams(locationRef?.search || "").get("firebaseEmulator") === "1";
      return local && enabled ? {
        authUrl: "http://127.0.0.1:9099",
        databaseHost: "127.0.0.1",
        databasePort: 9000,
      } : null;
    }

createNetworkAdapter는 getAuth/getDatabase 직후 signInAnonymously보다 먼저 connectAuthEmulator와 connectDatabaseEmulator를 호출한다. 운영 hostname에서는 query가 있어도 emulator를 사용하지 않는다.

- [ ] **Step 5: PixelRPG 온라인/솔로 controller 교체 구현**

온라인에서는 network.chorus를 controller에 전달한다. fallbackToSolo는 clear 전에 latestChorusSnapshot을 복사하고 새 로컬 controller의 seedSnapshot으로 넘긴다. 솔로에서 완료된 encounter는 로컬 completion claim만 만들며 재연결 때 공유 encounter에 병합하지 않는다.

- [ ] **Step 6: network 단위 테스트 통과 확인**

Run: node --test tests/sanctuary-chorus-network.test.mjs tests/network-chat-integration.test.mjs tests/game-play-mode.test.mjs  
Expected: PASS; solo adapter의 chorus는 null이고 Firebase module load count는 0이다.

- [ ] **Step 7: 커밋**

    git add src/sanctuary-chorus-network-20260911-sanctuary.js src/network-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/firebase-config-20260905-upgrade-20260911-sanctuary.js src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js tests/sanctuary-chorus-network.test.mjs tests/network-chat-integration.test.mjs tests/game-play-mode.test.mjs
    git commit -m "feat: synchronize the unnamed chorus encounter"

---

### Task 12: Firebase 규칙과 실제 에뮬레이터 경계

**Files:**
- Modify: database.rules.json
- Modify: tests/firebase-rules-emulator.cjs
- Modify: .github/workflows/firebase-rules-test.yml

**Interfaces:**
- Player/chat allowlist adds sanctuary-memory-archive, sanctuary-return-record, sanctuary-three-futures
- Shared subtree: rooms/public/chorus/sanctuary-return-record/{state,actions,completionClaims}

- [ ] **Step 1: 신규 mapId와 공격 경계 실패 테스트 작성**

    for (const mapId of [
      "sanctuary", "sanctuary-memory-archive",
      "sanctuary-return-record", "sanctuary-three-futures",
    ]) {
      await assertSucceeds(set(ref(playerDb, "rooms/public/players/player"), player({ mapId })));
      await assertSucceeds(set(ref(playerDb, "rooms/public/chat/player/1"), chat({ mapId })));
    }
    await assertFails(set(ref(playerDb, "rooms/public/players/player"), player({ mapId: "sanctuary-secret" })));
    await assertFails(set(ref(guestDb, chorusStatePath), chorusEncounter()));
    await assertFails(set(ref(playerDb, chorusStatePath), { ...chorusEncounter(), hp: 0, status: "separated" }));
    await assertFails(set(ref(playerDb, chorusActionPath("other", 1)), validChorusAction("other", 1)));
    await assertFails(set(ref(playerDb, chorusActionPath("player", 2)), { ...validChorusAction("player", 2), damage: 999 }));
    await assertFails(set(ref(playerDb, "rooms/public/chorus/sanctuary-return-record/contamination/player"), 10));
    await assertFails(set(ref(playerDb, "rooms/public/chorus/sanctuary-return-record/endingChoice/player"), "seal"));

- [ ] **Step 2: 에뮬레이터 실패 확인**

Run: npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"  
Expected: FAIL for the new allowed map IDs and missing chorus subtree.

- [ ] **Step 3: 규칙 구현**

state는 인증된 현재 authority의 schema-valid update와 만료 lease takeover만 허용한다. actions/$uid/$sequence는 auth.uid==$uid, 현재 player mapId가 sanctuary-return-record, sequence 양의 정수, timestamp ±5초, 허용 action type/ID, damage/hp/status 부재를 검증한다. completionClaims/$encounterId/$uid 생성은 현재 authority와 separated state와 contributors/$uid 존재를 요구하고, acknowledge는 auth.uid==$uid와 immutable field 보존을 요구한다. 정의하지 않은 chorus child는 .validate=false다.

- [ ] **Step 4: 규칙 에뮬레이터 통과 확인**

Run: npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"  
Expected: PASS for existing boss cases and new chorus/map/chat cases.

- [ ] **Step 5: workflow 경로와 버전 유지**

firebase-rules-test.yml path filter에 src/sanctuary-chorus-*.js와 tests/sanctuary-chorus-network.test.mjs를 추가한다. firebase-tools@15.26.0, @firebase/rules-unit-testing@5.0.0, firebase@12.6.0 버전은 유지한다.

- [ ] **Step 6: 커밋**

    git add database.rules.json tests/firebase-rules-emulator.cjs .github/workflows/firebase-rules-test.yml
    git commit -m "test: enforce sanctuary Firebase boundaries"

---

### Task 13: 제14장 세 미래와 멱등 보상 복구

**Files:**
- Create: src/sanctuary-ending-20260911-sanctuary.js
- Modify: src/sanctuary-story-data-20260911-sanctuary.js
- Modify: src/sanctuary-progress-20260911-sanctuary.js
- Modify: src/story-interactions-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: index.html
- Modify: styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css
- Test: tests/sanctuary-ending.test.mjs
- Test: tests/sanctuary-progress.test.mjs

**Interfaces:**
- Produces: getEndingPreview(choice, captainOutcome), grantSanctuaryEndingReward(progress, choice)
- Produces: missingSanctuaryRewardComponents(progress, choice)
- PixelRPG methods: previewSanctuaryEnding(choice), confirmSanctuaryEnding(choice), recoverSanctuaryEndingReward(), setEndingPresentationActive(active)

- [ ] **Step 1: 세 결말 동일 보상·서사 차이 실패 테스트 작성**

    test("all endings grant equal currency with distinct title and Echo state", () => {
      const results = ["seal", "restore", "release"].map(choice => {
        const result = grantSanctuaryEndingReward(endingReadyProgress(choice), choice);
        return { exp: result.rewardExp, gold: result.rewardGold, title: result.titleId, echo: result.echoState };
      });
      assert.deepEqual(results.map(value => [value.exp, value.gold]), [[300, 200], [300, 200], [300, 200]]);
      assert.equal(new Set(results.map(value => value.title)).size, 3);
      assert.deepEqual(results.map(value => value.echo), ["sealed-survivor", "named-dissolution", "own-voice"]);
    });

    test("reward retry grants no component twice", () => {
      const once = grantSanctuaryEndingReward(endingReadyProgress("seal"), "seal").progress;
      const twice = grantSanctuaryEndingReward(once, "seal");
      assert.equal(twice.rewardExp, 0);
      assert.equal(twice.rewardGold, 0);
      assert.equal(twice.titleGranted, false);
      assert.deepEqual(twice.progress, once);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-ending.test.mjs tests/sanctuary-progress.test.mjs  
Expected: FAIL because sanctuary-ending module is absent.

- [ ] **Step 3: 결말 데이터와 reward ledger 구현**

    export const SANCTUARY_ENDINGS = freeze({
      seal: {
        titleId: "sanctuary-title-seal",
        title: "봉인의 계승자",
        echoState: "sealed-survivor",
        lastLine: "우리는 지워지지 않도록, 문을 지키기로 했다.",
      },
      restore: {
        titleId: "sanctuary-title-restore",
        title: "이름의 복원자",
        echoState: "named-dissolution",
        lastLine: "돌아온 것은 과거가 아니라, 다시 불릴 수 있는 이름이었다.",
      },
      release: {
        titleId: "sanctuary-title-release",
        title: "해방의 기록자",
        echoState: "own-voice",
        lastLine: "에코는 처음으로 누구의 것도 아닌 목소리로 작별을 말했다.",
      },
    });

ledger ID는 sanctuary-ending-CHOICE-exp, sanctuary-ending-CHOICE-gold, sanctuary-ending-CHOICE-title이다. 누락 component만 grantProgressReward와 earnedTitleIds에 적용한 뒤 같은 progress payload에 component ID를 넣는다. 기존 endingChoice와 다른 choice 재지급은 거부한다. 세 preview 모두 가렌의 scarred/chronicAftereffect를 true로 유지한다.

- [ ] **Step 4: 두 단계 저장과 보상 실패 복구 구현**

confirmSanctuaryEnding은 먼저 progressSanctuary의 choose-ending 결과만 persist한다. 이 저장이 실패하면 확정·컷신·보상을 시작하지 않는다. 성공하면 결말 overlay를 열고 보상 결과를 별도 persist한다. 보상 저장 실패 시 메모리 progress를 선택 저장 직후 snapshot으로 되돌리고 pending reward 안내를 남긴다. enter와 F 재상호작용은 endingChoice가 있고 missing component가 있을 때 recoverSanctuaryEndingReward를 호출한다.

- [ ] **Step 5: 최종 연출의 온라인 가시성 구현**

setEndingPresentationActive(true)는 remotePlayers render와 chatPanel을 로컬에서 숨기고 네트워크 publish/수신 자체는 유지한다. overlay를 닫거나 장면이 끝나면 이전 online/solo 표시 규칙대로 복원한다. 보류는 first confirmation만 닫고 endingChoice를 쓰지 않는다.

- [ ] **Step 6: UI/접근성 구현**

결말 overlay는 첫 확인, 두 번째 확인, 컷신의 세 view를 가진다. 버튼은 seal/restore/release 원문만 표시하고 진엔딩, 배드엔딩, 추천, 점수를 사용하지 않는다. Tab/Shift+Tab focus trap, Escape 보류, Enter 확인을 지원한다. reduced-motion에서는 장면 전환 시간을 줄이되 마지막 문장과 상태 변화는 유지한다.

- [ ] **Step 7: 결말 테스트 통과 확인**

Run: node --test tests/sanctuary-ending.test.mjs tests/sanctuary-progress.test.mjs tests/progress-storage.test.mjs  
Expected: PASS for equal rewards, three titles, three Echo states, Garen invariant, save split, retry idempotency, immutable choice.

- [ ] **Step 8: 커밋**

    git add src/sanctuary-ending-20260911-sanctuary.js src/sanctuary-story-data-20260911-sanctuary.js src/sanctuary-progress-20260911-sanctuary.js src/story-interactions-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js index.html styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css tests/sanctuary-ending.test.mjs tests/sanctuary-progress.test.mjs tests/progress-storage.test.mjs
    git commit -m "feat: add three independent sanctuary endings"

---

### Task 14: 성역 목표 안내와 릴리스 진입점 전환

**Files:**
- Modify: src/quest-guidance-20260905-upgrade-20260911-sanctuary.js
- Modify: src/quest-banner-20260905-upgrade-20260911-sanctuary.js
- Modify: src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Modify: index.html
- Create: tests/sanctuary-cache-contract.test.mjs
- Modify: tests/upgrade-cache-contract.test.mjs
- Modify: tests/volcano-cache-contract.test.mjs
- Test: tests/quest-guidance.test.mjs
- Test: tests/quest-ui.static.test.cjs

**Interfaces:**
- Produces: getSanctuaryChapterObjective(worldProgress)
- Active entry: src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js
- Active CSS: styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css

- [ ] **Step 1: 목표 순서와 물리 URL 실패 테스트 작성**

    test("sanctuary objective advances through the approved gates", () => {
      assert.equal(getSanctuaryChapterObjective(entranceProgress()).id, "activate-three-cores");
      assert.equal(getSanctuaryChapterObjective(memoryProgress()).id, "restore-memory-order");
      assert.equal(getSanctuaryChapterObjective(recordProgress()).id, "link-correction");
      assert.equal(getSanctuaryChapterObjective(chorusProgress()).id, "separate-chorus");
      assert.equal(getSanctuaryChapterObjective(futuresProgress()).id, "choose-future");
    });

    test("every reachable local module uses the sanctuary physical suffix", async () => {
      const visited = await reachableLocalModules(new URL(
        "../src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js",
        import.meta.url,
      ));
      assert.equal(visited.size, 88);
      for (const url of visited) assert.match(url.pathname, /-20260911-sanctuary\.js$/);
    });

- [ ] **Step 2: 실패 확인**

Run: node --test tests/sanctuary-cache-contract.test.mjs tests/quest-guidance.test.mjs tests/quest-ui.static.test.cjs  
Expected: FAIL before index and objective routing use the new release.

- [ ] **Step 3: 목표 안내 연결**

getVolcanoChapterObjective가 volcano 완료 뒤 getSanctuaryChapterObjective로 위임하게 한다. 목표는 세 봉인함, 네 소리 수집, 순서 제출, 세 원본, 환영 거부, 여섯 필드, 정정 연결, anchors/testimonies/onslaught, 다섯 의견, 세 preview, 결말 선택 순으로 mapId와 interactionIds를 반환한다.

- [ ] **Step 4: index.html 물리 진입점 전환**

    <link rel="stylesheet" href="./styles-20260903-volcano-20260905-upgrade-20260911-sanctuary.css" />
    <script type="module" src="./src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js"></script>

query parameter cache busting을 넣지 않는다. old suffix에 도달하는 상대 import가 하나라도 있으면 cache contract는 실패해야 한다.

- [ ] **Step 5: import와 정적 UI 검사**

Run: node --test tests/sanctuary-cache-contract.test.mjs tests/upgrade-cache-contract.test.mjs tests/volcano-cache-contract.test.mjs tests/quest-guidance.test.mjs tests/quest-ui.static.test.cjs  
Expected: PASS; active graph count is exactly 88 and index has query-free new CSS/JS URL.

- [ ] **Step 6: 커밋**

    git add src/quest-guidance-20260905-upgrade-20260911-sanctuary.js src/quest-banner-20260905-upgrade-20260911-sanctuary.js src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js src/main-20260903-volcano-20260905-upgrade-20260911-sanctuary.js index.html tests/sanctuary-cache-contract.test.mjs tests/upgrade-cache-contract.test.mjs tests/volcano-cache-contract.test.mjs tests/quest-guidance.test.mjs tests/quest-ui.static.test.cjs
    git commit -m "chore: activate the sanctuary physical release"

---

### Task 15: 솔로 실제 입력 브라우저 완주

**Files:**
- Create: tests/sanctuary-browser-smoke.cjs
- Modify: .github/workflows/browser-smoke.yml

**Interfaces:**
- Browser precondition fixture may set a valid v8 save with volcano completed and captainOutcome rescued 또는 lost.
- The fixture must not set any chapters.sanctuary success field, chorus shared state, completion claim, endingChoice, EXP/Gold/title reward.
- Read-only instrumentation may expose state snapshots; it must not mutate gameplay.

- [ ] **Step 1: 실제 입력 smoke 작성**

    async function waitForPlayable(page) {
      await page.locator("#hud").waitFor({ state: "visible", timeout: 10000 });
      await page.locator("#playerName").filter({ hasText: /.+/ }).waitFor();
      await page.waitForFunction(() => {
        const canvas = document.querySelector("#game");
        return canvas && canvas.width > 0 && canvas.height > 0
          && document.querySelector("#chapterObjective")?.textContent?.length > 0;
      });
    }

    async function interact(page) {
      await page.keyboard.press("KeyF");
      await page.locator("#dialogueOverlay:not([hidden]), #endingOverlay:not([hidden])").waitFor();
    }

    async function attackCycle(page) {
      for (const key of ["Control", "KeyQ", "KeyE", "KeyR"]) {
        await page.keyboard.press(key);
        await page.waitForTimeout(180);
      }
    }

test matrix는 warrior/archer/mage, rescued/lost, memory wrong→retry→correct, correction preservation, anchors/testimonies/onslaught, telegraph escape, contamination overload, separated, defer/reload/F reopen, seal/restore/release를 포함한다. prior chapter fixture는 각 matrix 시작점에서 sanctuary의 모든 필드를 기본값으로 둔다.

- [ ] **Step 2: 저장 실패와 멱등 재시도 시나리오 추가**

localStorage.setItem wrapper는 endingChoice 저장 다음 호출 한 번만 예외를 던진다. 테스트는 choice가 저장되어 컷신이 보이고 reward component는 누락된 상태를 확인한 뒤 wrapper를 복원하고 F로 복구한다. 최종 EXP 증가 300, Gold 증가 200, 칭호 한 개를 확인하고 같은 복구를 다시 눌러 변화가 없음을 확인한다.

- [ ] **Step 3: 시각 증거 저장**

각 실행에서 entrance-three-caskets, memory-sequence-error, correction-linked, chorus-anchors, chorus-testimonies, chorus-telegraph, chorus-separated, ending-CHOICE PNG를 test-results/sanctuary-solo에 저장한다. 1280×720과 390×844에서 HUD가 중앙 전장과 하단 이동축을 가리지 않는지 assertion과 이미지 검토를 수행한다.

- [ ] **Step 4: 로컬 smoke 실행**

Run: npm install --no-save playwright@1.55.0  
Run: npx playwright install chromium  
Run: python -m http.server 4173  
Run in another shell: PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/sanctuary-browser-smoke.cjs  
Expected: PASS; console errors=[], page errors=[], all screenshots non-empty, no test writes sanctuary success directly.

- [ ] **Step 5: browser workflow 연결**

browser-smoke.yml의 기존 smoke 명령 뒤에 PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/sanctuary-browser-smoke.cjs를 추가한다. page.goto의 networkidle은 탐색 옵션으로 사용할 수 있지만 waitForPlayable과 관찰 가능한 전이가 최종 성공 조건이다.

- [ ] **Step 6: 커밋**

    git add tests/sanctuary-browser-smoke.cjs .github/workflows/browser-smoke.yml
    git commit -m "test: cover sanctuary with real browser input"

---

### Task 16: 인증된 두 클라이언트 네트워크 완주

**Files:**
- Create: tests/sanctuary-network-browser-smoke.cjs
- Create: .github/workflows/sanctuary-network-smoke.yml
- Modify: firebase.json when emulator host configuration requires an explicit singleProjectMode setting

**Interfaces:**
- Two isolated Playwright BrowserContext objects
- Each page uses ?firebaseEmulator=1 and the real Firebase SDK 12.16.0
- Auth emulator port 9099, Realtime Database emulator port 9000, static server port 4173

- [ ] **Step 1: 두 컨텍스트 실제 SDK smoke 작성**

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await Promise.all([
      pageA.goto(BASE_URL + "?firebaseEmulator=1"),
      pageB.goto(BASE_URL + "?firebaseEmulator=1"),
    ]);
    await Promise.all([enterOnline(pageA, "기록자A"), enterOnline(pageB, "기록자B")]);
    await Promise.all([waitForPlayable(pageA), waitForPlayable(pageB)]);
    const [uidA, uidB] = await Promise.all([readOwnUid(pageA), readOwnUid(pageB)]);
    assert.notEqual(uidA, uidB);

두 브라우저의 v8 precondition은 sanctuary 기본값과 서로 다른 captainOutcome만 설정한다. 합창 hp/phase/완료는 설정하지 않는다.

- [ ] **Step 2: 공유/개인/기여 assertion 구현**

실제 Control/Q/E/R과 F 입력으로 파편 생성·배치, 여섯 증언, 네 기록/결속선을 분담한다. 양쪽 DOM의 결속도와 phase가 같아질 때까지 기다린다. A의 오배치 후 A contamination만 증가하고 B는 0인지 확인한다. Firebase state의 contributors에 fragment-strike, anchor-stabilize, testimony-resolve, record-activate, bond-cut 기여 종류가 나타나는지 읽기 전용으로 확인한다.

- [ ] **Step 3: authority 종료와 개인 결말 분리 assertion 구현**

현재 authority인 context를 닫고 남은 context가 epoch 증가와 authorityUid 변경을 관찰한 뒤 실제 입력으로 separated를 만든다. 기여 UID의 자기 completion claim만 각 페이지에 적용된다. A는 seal, B는 release를 선택하고 각 localStorage의 endingChoice가 다르며 Firebase chorus subtree에는 endingChoice와 contamination이 없음을 확인한다.

- [ ] **Step 4: 에뮬레이터 smoke 실행**

Run: npm install --no-save firebase-tools@15.26.0 firebase@12.6.0 playwright@1.55.0  
Run: npx playwright install chromium  
Run: npx firebase emulators:exec --only auth,database --project demo-pixel-world-rules "node tests/sanctuary-network-browser-smoke.cjs"  
Expected: PASS with two distinct Auth UIDs, shared cohesion/phase, authority takeover, separated by input, isolated contamination and ending choice.

- [ ] **Step 5: 전용 workflow 작성**

sanctuary-network-smoke.yml은 checkout@v4, setup-node@v5, setup-java@v5, 고정된 세 npm package 버전, Chromium 설치, 로컬 HTTP 서버, firebase emulators:exec를 사용한다. pull_request와 workflow_dispatch에서 실행하고 운영 Firebase credential이나 deploy step을 포함하지 않는다.

- [ ] **Step 6: 커밋**

    git add tests/sanctuary-network-browser-smoke.cjs .github/workflows/sanctuary-network-smoke.yml firebase.json
    git commit -m "test: verify sanctuary with two Firebase clients"

---

### Task 17: 전체 회귀, 시각 검토, Draft PR

**Files:**
- Review: all changed files
- Update only if verification exposes a defect: the owning source and its existing focused test
- Do not modify: main branch, deployment workflows beyond path filters, production Firebase credentials

**Interfaces:**
- Produces verification evidence tied to one final commit SHA.

- [ ] **Step 1: 전체 Node 테스트**

Run: node --test tests/*.test.mjs tests/*.static.test.cjs  
Expected: all tests PASS; record the exact pass/fail/cancelled/skipped totals.

- [ ] **Step 2: 전체 JavaScript 문법 검사**

Run in PowerShell:

    Get-ChildItem -LiteralPath src -Filter *.js | ForEach-Object {
      node --check $_.FullName
      if ($LASTEXITCODE -ne 0) { throw "Syntax failure: $($_.FullName)" }
    }

Expected: every src JavaScript file exits 0.

- [ ] **Step 3: Firebase 규칙 에뮬레이터**

Run: npx firebase emulators:exec --only database --project demo-pixel-world-rules "node tests/firebase-rules-emulator.cjs"  
Expected: PASS with existing boss and new sanctuary boundary assertions.

- [ ] **Step 4: 솔로 및 두 클라이언트 브라우저 smoke**

Run: PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/sanctuary-browser-smoke.cjs  
Run: npx firebase emulators:exec --only auth,database --project demo-pixel-world-rules "node tests/sanctuary-network-browser-smoke.cjs"  
Expected: both PASS; no direct injection of chorus success or ending; console/page errors empty.

- [ ] **Step 5: 스크린샷 검토**

검토 대상은 세 봉인함 수, 연결선 색, 기억 얼굴 비식별성, 현재 인물 선명도, 두 게이지 가독성, 공격 예고와 실제 충돌 일치, separated 비폭력 연출, desktop/mobile HUD 점유, reduced-motion이다. 발견 사항은 simulation, renderer, frontend, asset pipeline 중 소유 영역과 재현 절차를 붙여 수정하고 해당 focused test부터 다시 실행한다.

- [ ] **Step 6: 최종 회귀 재실행 및 커밋**

검토 수정이 있었다면 focused test 뒤 Steps 1~4를 다시 실행한다.

    git add -A
    git commit -m "fix: close sanctuary release verification gaps"

변경이 없으면 빈 커밋을 만들지 않는다. git status --short가 비어 있어야 한다.

- [ ] **Step 7: 원격 반영과 Draft PR**

Run: git push -u origin codex/pixel-core-sanctuary  
Expected: non-force push succeeds.

Draft PR의 base는 main, head는 codex/pixel-core-sanctuary다. 본문에 최종 SHA, Node totals, syntax result, Firebase emulator result, solo smoke result, two-client smoke result, workflow links, 남은 문제를 적는다. 실패하거나 실행하지 못한 검사는 통과로 쓰지 않는다.

- [ ] **Step 8: GitHub Actions 확인**

Game tests and JavaScript syntax, Browser smoke, Firebase rules test, Sanctuary network smoke 네 검사를 최종 SHA에서 확인한다. 녹색 표시뿐 아니라 각 로그가 실제 sanctuary-browser-smoke.cjs와 sanctuary-network-browser-smoke.cjs를 실행했는지 확인한다.

- [ ] **Step 9: 완료 보고**

최종 보고에는 final commit SHA, 검사별 명령과 결과, 실행 링크, 시각 검토 이미지 위치, 남은 문제, Draft 유지, 미병합, 미배포를 명시한다.
