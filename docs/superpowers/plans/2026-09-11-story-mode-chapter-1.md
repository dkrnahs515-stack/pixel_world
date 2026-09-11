# Chapter 1 Investigation Story Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separately routed, offline investigation story mode that lets players complete novella Chapter 1 from the root experience selector while preserving the existing RPG.

**Architecture:** Keep the existing RPG on the root page behind a new top-level experience selector, and route story players to an independent `story/` page. Put Chapter 1 facts in immutable data, keep progression and evidence rules in a DOM-free state module, store only story checkpoints under an isolated localStorage key, and let a small controller render the current scene.

**Tech Stack:** Static HTML/CSS, browser ES modules, Node.js 24 built-in test runner, Playwright 1.55.0, GitHub Pages/Firebase Hosting static delivery

**Spec:** `docs/superpowers/specs/2026-09-11-story-mode-chapter-1-design.md`

## Global Constraints

- Implement only Chapter 1 「돌아오지 않은 이름들」 as a complete playable vertical slice.
- Preserve the existing nickname, class, solo/online, reward, RPG progress, combat, and Firebase behavior.
- The story page must not import the RPG game loop, network modules, Firebase configuration, or Firebase SDK.
- Store story progress only under `pixel-world.story.v1`; never read or write `pixel-world.progress.v7:<nickname>`.
- The correct Chapter 1 result is “생존 여부 미확인. 폐기 보류.”, not confirmation that all four missing members are alive.
- Preserve the two supplied PNG files without crop, redraw, re-encoding, aspect-ratio distortion, or OCR-derived evidence.
- Render artwork with `object-fit: contain` and keep dialogue and controls outside the image rectangle.
- Support equivalent mouse, touch, and keyboard completion paths.
- Do not deploy, merge to `main`, or include Chapter 2+ content in this plan.

---

## File Structure

- `index.html`: root experience selector plus the unchanged RPG registration and HUD markup.
- `styles-20260911-story.css`: physical-cache-busted copy of the current active RPG CSS plus selector styles.
- `src/main-20260911-story.js`: physical-cache-busted copy of the current active RPG entry module plus selector bindings.
- `src/story-chapter-01-data.js`: immutable Chapter 1 scenes, clues, evidence, claims, artwork, and copy.
- `src/story-state.js`: deterministic state creation, clue collection, comparison, advancement, evidence evaluation, and completion.
- `src/story-storage.js`: validated `pixel-world.story.v1` persistence and recovery.
- `src/story-controller.js`: story-page DOM binding, rendering, focus movement, image fallback, and checkpoint autosave.
- `story/index.html`: independent start/continue, investigation, reset confirmation, and completion surfaces.
- `story/story.css`: illustration-first responsive story layout.
- `story/assets/chapter-01/01_제01장_고대 숲의 초보 궁수 테오.png`: approved 1024×1536 opening art.
- `story/assets/chapter-01/02_제01장_지워질 네 이름, 돌아온 신호.png`: approved 1536×1024 late reveal art.
- `tests/experience-entry-ui.static.test.cjs`: root selector and RPG-preservation contract.
- `tests/story-chapter-01-data.test.mjs`: source-fact and spoiler-timing contract.
- `tests/story-state.test.mjs`: progression and evidence rules.
- `tests/story-storage.test.mjs`: isolated persistence and failure recovery.
- `tests/story-ui.static.test.cjs`: independent markup, imports, responsive CSS, and asset-integrity contract.
- `tests/story-browser-smoke.cjs`: full Chapter 1 browser journey and restart/resume checks.
- Existing browser smoke scripts: click the RPG choice before interacting with the retained registration form.
- `.github/workflows/browser-smoke.yml`: add the new story browser smoke.
- `README.md`: document the new first-screen choice and Chapter 1 story controls.

---

### Task 1: Add the Root Experience Selector Without Changing RPG Semantics

**Files:**
- Create: `tests/experience-entry-ui.static.test.cjs`
- Create: `styles-20260911-story.css` from `styles-20260903-volcano-20260905-upgrade.css`
- Create: `src/main-20260911-story.js` from `src/main-20260903-volcano-20260905-upgrade.js`
- Modify: `index.html`
- Modify: `tests/firebase-hosting.test.mjs`
- Modify: `tests/entry-ui.static.test.cjs`
- Modify: `tests/play-mode-ui.static.test.cjs`

**Interfaces:**
- Consumes: existing `#entryOverlay`, `#nicknameForm`, `#hud`, and `PixelRPG.enter(nickname, classId, playMode)`.
- Produces: `#experienceOverlay`, `#rpgExperienceButton`, `#storyExperienceLink`, and `#returnToExperienceButton`.

- [ ] **Step 1: Write the failing root-selector contract**

Create `tests/experience-entry-ui.static.test.cjs`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-20260911-story.css", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main-20260911-story.js", import.meta.url), "utf8");

test("루트 첫 화면은 RPG와 조사형 스토리를 먼저 선택한다", () => {
  assert.match(html, /id="experienceOverlay"[^>]*(?!hidden)/);
  assert.match(html, /id="rpgExperienceButton"/);
  assert.match(html, /id="storyExperienceLink"[^>]*href="\.\/story\/"/);
  assert.match(html, /id="entryOverlay"[^>]*hidden/);
  assert.match(html, /id="returnToExperienceButton"/);
});

test("RPG 선택은 기존 등록 화면만 열고 스토리는 별도 경로다", () => {
  assert.match(main, /rpgExperienceButton\.addEventListener/);
  assert.match(main, /experienceOverlay\.hidden = true/);
  assert.match(main, /entryOverlay\.hidden = false/);
  assert.doesNotMatch(main, /story-controller/);
});

test("선택 화면은 키보드 포커스와 모바일 1열을 지원한다", () => {
  assert.match(css, /\.experience-choice-grid[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /\.experience-choice[^}]*:focus-visible/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*\.experience-choice-grid[^}]*grid-template-columns:\s*1fr/);
});
```

- [ ] **Step 2: Run the selector test and verify RED**

Run:

```powershell
node --test tests/experience-entry-ui.static.test.cjs
```

Expected: FAIL because the new versioned files and `#experienceOverlay` do not exist.

- [ ] **Step 3: Create cache-busted active files and add selector markup**

Copy the current active CSS and main module to the new physical filenames, then update `index.html` to reference:

```html
<link rel="stylesheet" href="./styles-20260911-story.css" />
<script type="module" src="./src/main-20260911-story.js"></script>
```

Insert this before the existing RPG entry overlay and mark `#entryOverlay` hidden initially:

```html
<div id="experienceOverlay" class="screen-overlay">
  <section class="modal-card experience-card" aria-labelledby="experienceTitle">
    <p class="eyebrow">PIXEL WORLD</p>
    <h1 id="experienceTitle">어떤 이야기를 시작할까요?</h1>
    <p class="modal-description">기존 RPG 모험과 소설판 조사 이야기는 서로 다른 진행을 사용합니다.</p>
    <div class="experience-choice-grid">
      <button id="rpgExperienceButton" class="experience-choice" type="button">
        <strong>기존 온라인 RPG</strong>
        <span>직업을 선택하고 픽셀 월드를 탐험합니다.</span>
      </button>
      <a id="storyExperienceLink" class="experience-choice story" href="./story/">
        <strong>소설판 조사 스토리</strong>
        <span>테오와 함께 돌아오지 않은 이름들의 단서를 조사합니다.</span>
      </a>
    </div>
  </section>
</div>
```

Add `#returnToExperienceButton` as a type-button at the top of the retained `#nicknameForm`.

- [ ] **Step 4: Bind the selector in the new active main module**

Add after the existing root DOM lookups:

```js
const experienceOverlay = document.querySelector("#experienceOverlay");
const rpgExperienceButton = document.querySelector("#rpgExperienceButton");
const returnToExperienceButton = document.querySelector("#returnToExperienceButton");

rpgExperienceButton.addEventListener("click", () => {
  experienceOverlay.hidden = true;
  entryOverlay.hidden = false;
  nicknameInput.focus();
});

returnToExperienceButton.addEventListener("click", () => {
  entryOverlay.hidden = true;
  experienceOverlay.hidden = false;
  rpgExperienceButton.focus();
});

queueMicrotask(() => rpgExperienceButton.focus());
```

Remove the old initial `queueMicrotask(() => nicknameInput.focus())` so the hidden form never steals focus. Keep the existing submit and `game.enter(...)` flow unchanged.

- [ ] **Step 5: Update active-file assertions and add selector CSS**

Update tests that name the active main/CSS files to `20260911-story`. Append selector CSS that supplies two desktop columns, one mobile column, visible focus, hover without layout shift, and reduced-motion behavior.

- [ ] **Step 6: Run focused entry tests and verify GREEN**

Run:

```powershell
node --test tests/experience-entry-ui.static.test.cjs tests/entry-ui.static.test.cjs tests/play-mode-ui.static.test.cjs tests/firebase-hosting.test.mjs
node --check src/main-20260911-story.js
```

Expected: all tests pass and syntax checking exits 0.

- [ ] **Step 7: Commit the root selector**

```powershell
git add index.html styles-20260911-story.css src/main-20260911-story.js tests/experience-entry-ui.static.test.cjs tests/entry-ui.static.test.cjs tests/play-mode-ui.static.test.cjs tests/firebase-hosting.test.mjs
git commit -m "feat: add root experience selector"
```

---

### Task 2: Encode Chapter 1 Source Facts and Artwork Timing

**Files:**
- Create: `src/story-chapter-01-data.js`
- Create: `tests/story-chapter-01-data.test.mjs`

**Interfaces:**
- Produces: `CHAPTER_01`, `STORY_SCENE_IDS`, `STORY_CLUE_IDS`, `STORY_COMPARISON_IDS`, and `STORY_CLAIM_IDS`.
- Consumed by: `src/story-state.js` and `src/story-controller.js`.

- [ ] **Step 1: Write the failing Chapter 1 data contract**

Create tests asserting the exact ordered IDs:

```js
assert.deepEqual(STORY_SCENE_IDS, [
  "duty", "disposal-rule", "roster-items", "radio",
  "compass-compare", "time-compare", "case-submit", "hold-depart",
]);
assert.equal(CHAPTER_01.art.theo.width, 1024);
assert.equal(CHAPTER_01.art.theo.height, 1536);
assert.equal(CHAPTER_01.art.returnedSignal.width, 1536);
assert.equal(CHAPTER_01.art.returnedSignal.height, 1024);
assert.equal(CHAPTER_01.scenes["duty"].artId, "theo");
assert.equal(CHAPTER_01.scenes["hold-depart"].artId, "returnedSignal");
assert.equal(
  Object.values(CHAPTER_01.scenes).filter(scene => scene.artId === "returnedSignal").length,
  1,
);
assert.equal(CHAPTER_01.claims["investigate-survival"].correct, true);
assert.equal(CHAPTER_01.claims["all-alive"].correct, false);
assert.equal(CHAPTER_01.result, "생존 여부 미확인. 폐기 보류.");
```

Also assert these immutable source values:

```js
assert.equal(CHAPTER_01.facts.receivedAt, "오늘 새벽 4시 52분");
assert.equal(CHAPTER_01.facts.lastRecordAt, "5년 전 셋째 달 17일 4시 13분 22초");
assert.deepEqual(CHAPTER_01.facts.replaySeconds, [12, 11]);
assert.deepEqual(CHAPTER_01.facts.metalPattern, [1, 2]);
assert.deepEqual(CHAPTER_01.facts.missingNames, ["루멘", "로안", "세라", "가렌"]);
```

- [ ] **Step 2: Run the data test and verify RED**

```powershell
node --test tests/story-chapter-01-data.test.mjs
```

Expected: FAIL with module-not-found for `src/story-chapter-01-data.js`.

- [ ] **Step 3: Implement immutable story data**

Export frozen scene, clue, comparison, evidence, claim, artwork, and feedback records. Use these exact clue IDs:

```js
export const STORY_CLUE_IDS = Object.freeze([
  "rule-five-years",
  "rule-no-life-signal",
  "rule-no-recovery",
  "roster-four-names",
  "recovered-radio",
  "empty-map-case",
  "replay-lengths",
  "new-received-at",
  "signal-warning",
  "metal-pattern",
  "main-compass-missing",
  "article-18-4",
]);
```

Use `requiredClueIds` and `requiredComparisonIds` on each scene rather than embedding transition logic in copy. Put exact source-backed document text in the data file; do not refer to image text as evidence.

- [ ] **Step 4: Run the data test and verify GREEN**

```powershell
node --test tests/story-chapter-01-data.test.mjs
node --check src/story-chapter-01-data.js
```

Expected: both commands pass.

- [ ] **Step 5: Commit the source data**

```powershell
git add src/story-chapter-01-data.js tests/story-chapter-01-data.test.mjs
git commit -m "feat: add chapter 1 investigation data"
```

---

### Task 3: Implement the Deterministic Investigation State Machine

**Files:**
- Create: `src/story-state.js`
- Create: `tests/story-state.test.mjs`

**Interfaces:**
- Consumes: IDs and prerequisites from `src/story-chapter-01-data.js`.
- Produces:
  - `createInitialStoryState(): StoryState`
  - `discoverClue(state, clueId): StoryState`
  - `completeComparison(state, comparisonId): StoryState`
  - `canAdvance(state): { ok: boolean, missingIds: string[] }`
  - `advanceStory(state): { ok: boolean, state: StoryState, feedback: string }`
  - `submitEvidence(state, { claimId, evidenceIds }): { accepted: boolean, state: StoryState, feedback: string }`
  - `normalizeStoryState(value): StoryState | null`

`StoryState` has this JSON shape:

```js
{
  schemaVersion: 1,
  sceneId: "duty",
  discoveredClueIds: [],
  completedComparisonIds: [],
  submittedEvidenceIds: [],
  revealedArtIds: ["theo"],
  chapterComplete: false,
}
```

- [ ] **Step 1: Write failing state-transition tests**

Cover one behavior per test:

```js
test("초기 상태는 테오 삽화와 첫 임무에서 시작한다", () => {
  assert.deepEqual(createInitialStoryState(), {
    schemaVersion: 1,
    sceneId: "duty",
    discoveredClueIds: [],
    completedComparisonIds: [],
    submittedEvidenceIds: [],
    revealedArtIds: ["theo"],
    chapterComplete: false,
  });
});

test("폐기 기준 세 단서를 모두 확인하기 전에는 진행하지 않는다", () => {
  let state = { ...createInitialStoryState(), sceneId: "disposal-rule" };
  state = discoverClue(state, "rule-five-years");
  assert.equal(canAdvance(state).ok, false);
  state = discoverClue(state, "rule-no-life-signal");
  state = discoverClue(state, "rule-no-recovery");
  assert.equal(canAdvance(state).ok, true);
});

test("전원 생존 확정 주장은 통과하지 않고 단서를 잃지 않는다", () => {
  const state = readyCaseState();
  const result = submitEvidence(state, {
    claimId: "all-alive",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
  });
  assert.equal(result.accepted, false);
  assert.deepEqual(result.state.discoveredClueIds, state.discoveredClueIds);
  assert.match(result.feedback, /확정하지 않습니다/);
});

test("핵심 세 근거는 폐기 보류를 승인한다", () => {
  const result = submitEvidence(readyCaseState(), {
    claimId: "investigate-survival",
    evidenceIds: ["new-received-at", "metal-to-compass", "article-18-4"],
  });
  assert.equal(result.accepted, true);
  assert.equal(result.state.sceneId, "hold-depart");
  assert.deepEqual(result.state.revealedArtIds, ["theo", "returnedSignal"]);
});
```

Also cover unknown IDs, duplicate collection, wrong comparison, scene-order bypass, immutable inputs, and final completion.

- [ ] **Step 2: Run state tests and verify RED**

```powershell
node --test tests/story-state.test.mjs
```

Expected: FAIL because `src/story-state.js` does not exist.

- [ ] **Step 3: Implement minimal immutable transitions**

Use a clone helper that rebuilds arrays with `Set` deduplication. `advanceStory` reads the current scene prerequisites, refuses missing prerequisites with the scene hint, and moves only to the next ordered scene. `submitEvidence` accepts only claim `investigate-survival` with all three IDs `new-received-at`, `metal-to-compass`, and `article-18-4`; `same-final-time` may be present but is not required.

`normalizeStoryState` must reject unknown scene, clue, comparison, evidence, or artwork IDs and impossible combinations such as `chapterComplete: true` outside `hold-depart`.

- [ ] **Step 4: Run state tests and verify GREEN**

```powershell
node --test tests/story-state.test.mjs
node --check src/story-state.js
```

Expected: all pass.

- [ ] **Step 5: Commit the state machine**

```powershell
git add src/story-state.js tests/story-state.test.mjs
git commit -m "feat: add chapter 1 story state machine"
```

---

### Task 4: Add Isolated Story Persistence and Recovery

**Files:**
- Create: `src/story-storage.js`
- Create: `tests/story-storage.test.mjs`

**Interfaces:**
- Consumes: `createInitialStoryState` and `normalizeStoryState`.
- Produces:
  - `STORY_SAVE_KEY = "pixel-world.story.v1"`
  - `loadStoryProgress(storage): { state: StoryState, status: "empty" | "loaded" | "recovered" | "unsupported" }`
  - `saveStoryProgress(storage, state): { ok: boolean, error: string }`
  - `clearStoryProgress(storage): { ok: boolean, error: string }`
  - `hasStoryProgress(storage): boolean`

- [ ] **Step 1: Write failing persistence tests**

Use a memory storage double that records every key:

```js
test("스토리는 독립 키에만 저장하고 다시 읽는다", () => {
  const storage = memoryStorage();
  const state = { ...createInitialStoryState(), sceneId: "disposal-rule" };
  assert.deepEqual(saveStoryProgress(storage, state), { ok: true, error: "" });
  assert.deepEqual(storage.writes.map(write => write.key), ["pixel-world.story.v1"]);
  assert.equal(loadStoryProgress(storage).state.sceneId, "disposal-rule");
  assert.equal(storage.reads.includes("pixel-world.progress.v7:테오"), false);
});

test("손상 JSON은 초기 상태와 recovered 상태로 복구한다", () => {
  const storage = memoryStorage({ "pixel-world.story.v1": "{" });
  const result = loadStoryProgress(storage);
  assert.equal(result.status, "recovered");
  assert.deepEqual(result.state, createInitialStoryState());
});

test("저장 차단은 현재 상태를 바꾸지 않고 실패를 반환한다", () => {
  const result = saveStoryProgress(throwingStorage(), createInitialStoryState());
  assert.equal(result.ok, false);
  assert.match(result.error, /저장할 수 없습니다/);
});
```

Also test empty storage, valid load, unknown schema version, invalid IDs, and clear failure.

- [ ] **Step 2: Run storage tests and verify RED**

```powershell
node --test tests/story-storage.test.mjs
```

Expected: FAIL because `src/story-storage.js` does not exist.

- [ ] **Step 3: Implement storage functions**

Serialize only normalized state fields. Unsupported versions return `status: "unsupported"` without removing or overwriting the stored value. Parse or validation failures return `status: "recovered"`. Catch `getItem`, `setItem`, and `removeItem` independently.

- [ ] **Step 4: Run storage tests and verify GREEN**

```powershell
node --test tests/story-storage.test.mjs
node --check src/story-storage.js
```

Expected: all pass.

- [ ] **Step 5: Commit isolated persistence**

```powershell
git add src/story-storage.js tests/story-storage.test.mjs
git commit -m "feat: add isolated story progress storage"
```

---

### Task 5: Build the Independent Story Shell and Add Verified Official Art

**Files:**
- Create: `tests/story-ui.static.test.cjs`
- Create: `story/index.html`
- Create: `story/story.css`
- Create: `story/assets/chapter-01/01_제01장_고대 숲의 초보 궁수 테오.png`
- Create: `story/assets/chapter-01/02_제01장_지워질 네 이름, 돌아온 신호.png`

**Interfaces:**
- Consumes: the two approved local source PNGs.
- Produces DOM IDs used by `src/story-controller.js`: `#storyStartOverlay`, `#storyNewButton`, `#storyContinueButton`, `#storyResetOverlay`, `#storyResetConfirmButton`, `#storyScreen`, `#storySceneTitle`, `#storyArt`, `#storyArtFallback`, `#storyDocument`, `#storyActions`, `#storyClues`, `#storyStatus`, `#storyCompletion`, and `#storyReplayButton`.

- [ ] **Step 1: Write the failing story-shell and asset-integrity test**

The test must assert:

```js
assert.match(html, /id="storyNewButton"/);
assert.match(html, /id="storyContinueButton"[^>]*disabled/);
assert.match(html, /id="storyResetOverlay"[^>]*hidden/);
assert.match(html, /id="storyScreen"[^>]*hidden/);
assert.match(html, /\.\.\/src\/story-controller\.js/);
assert.doesNotMatch(html, /firebase|game-2026|network-/i);
assert.match(css, /\.story-layout[^}]*grid-template-columns/);
assert.match(css, /\.story-art[^}]*object-fit:\s*contain/);
assert.match(css, /@media \(max-width:\s*760px\)/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
```

Read PNG width and height from bytes 16–23 of the IHDR chunk and calculate SHA-256. Assert:

```js
assert.deepEqual(pngInfo(theo), {
  width: 1024,
  height: 1536,
  sha256: "f2bceb0fedf479f445989d2b89db2d8ee9382300d8e76fd164f0ed69cd21063b",
});
assert.deepEqual(pngInfo(returnedSignal), {
  width: 1536,
  height: 1024,
  sha256: "6aa870833ac6e440743d2be4c5b5c61b64f521c3a4f852b2606a5925f5e3a896",
});
```

- [ ] **Step 2: Run the shell test and verify RED**

```powershell
node --test tests/story-ui.static.test.cjs
```

Expected: FAIL because the story page, CSS, and copied assets do not exist.

- [ ] **Step 3: Copy the two approved PNG files without transformation**

Copy exactly:

```text
C:\Users\강서청소년회관\Downloads\pixel-world-official-illustrations-53-20260911\01_본문_삽화\01_제01장_고대 숲의 초보 궁수 테오.png
→ story/assets/chapter-01/01_제01장_고대 숲의 초보 궁수 테오.png

C:\Users\강서청소년회관\Downloads\pixel-world-official-illustrations-53-20260911\01_본문_삽화\02_제01장_지워질 네 이름, 돌아온 신호.png
→ story/assets/chapter-01/02_제01장_지워질 네 이름, 돌아온 신호.png
```

Do not run any image encoder, optimizer, cropper, or generator.

- [ ] **Step 4: Create the semantic story page**

Use four top-level surfaces:

```html
<section id="storyStartOverlay">...</section>
<main id="storyScreen" hidden>...</main>
<section id="storyResetOverlay" role="dialog" aria-modal="true" hidden>...</section>
<section id="storyCompletion" hidden>...</section>
<script type="module" src="../src/story-controller.js"></script>
```

The investigation main contains a header with chapter/progress/back link, an illustration figure, a live scene title, a document article, an action group, a discovered-clue list, and an `aria-live="polite"` status. Put every interactive control in a real button or anchor.

- [ ] **Step 5: Implement illustration-first responsive CSS**

Desktop `.story-layout` uses `minmax(0, 1.35fr) minmax(320px, .65fr)`; mobile below 760px uses one column. Give `.story-art` a bounded viewport height, `width: 100%`, `height: 100%`, and `object-fit: contain`. Keep all copy and buttons outside the figure. Include `:focus-visible`, 44px minimum touch height, non-color selected state, safe-area padding, and reduced-motion overrides.

- [ ] **Step 6: Run shell tests and verify GREEN**

```powershell
node --test tests/story-ui.static.test.cjs
```

Expected: markup, CSS, dimensions, and both hashes pass.

- [ ] **Step 7: Commit the shell and original assets**

```powershell
git add story/index.html story/story.css story/assets/chapter-01 tests/story-ui.static.test.cjs
git commit -m "feat: add chapter 1 story shell and official art"
```

---

### Task 6: Render and Complete the Full Investigation Journey

**Files:**
- Create: `tests/story-browser-smoke.cjs`
- Create: `src/story-controller.js`
- Modify: `story/index.html` only if a browser-tested semantic hook is missing
- Modify: `story/story.css` only if a browser-tested responsive or state style is missing

**Interfaces:**
- Consumes: `CHAPTER_01`, state functions, storage functions, and the Task 5 DOM IDs.
- Produces:
  - `renderScene(state)`
  - autosave after successful scene advancement and evidence acceptance
  - start, continue, reset confirmation, retry, completion, and focus behavior
  - stable action attributes `data-clue-id`, `data-comparison-id`, `data-evidence-id`, `data-claim-id`, and `data-story-next`

- [ ] **Step 1: Write a failing Playwright journey**

The script launches Chromium and:

```js
await page.goto(`${baseUrl}/story/`, { waitUntil: "networkidle" });
await page.locator("#storyNewButton").click();
await page.locator("[data-story-next]").click();

for (const clueId of [
  "rule-five-years", "rule-no-life-signal", "rule-no-recovery",
]) {
  await page.locator(`[data-clue-id="${clueId}"]`).click();
}
await page.locator("[data-story-next]").click();
```

Continue through all required roster, radio, compass, and time actions. First submit `all-alive` and assert the scene remains `case-submit` with feedback containing “확정하지 않습니다”. Then select `investigate-survival` plus `new-received-at`, `metal-to-compass`, and `article-18-4`; assert the late illustration filename is loaded only after acceptance. Finish the chapter and assert the completion screen contains “생존 여부 미확인. 폐기 보류.”

Before the journey, attach a request listener and assert no requested URL contains `firebase`, `gstatic`, `googleapis`, or `network-`.

- [ ] **Step 2: Run the browser journey and verify RED**

Start a local server and run:

```powershell
python -m http.server 4173
```

In a second terminal:

```powershell
$env:PIXEL_WORLD_URL='http://127.0.0.1:4173'
node tests/story-browser-smoke.cjs
```

Expected: FAIL because `src/story-controller.js` does not exist and the shell cannot advance.

- [ ] **Step 3: Bind start, continue, and reset**

On load:

```js
const loaded = loadStoryProgress(localStorage);
continueButton.disabled = !hasStoryProgress(localStorage);
status.textContent = loaded.status === "recovered"
  ? "손상된 진행을 복구하고 처음부터 시작할 수 있습니다."
  : loaded.status === "unsupported"
    ? "다른 버전의 진행은 보존했습니다. 이 버전은 처음부터 시작합니다."
    : "";
```

`처음부터` opens the reset confirmation only when a valid save exists; otherwise it starts immediately. Confirming reset calls `clearStoryProgress`, creates initial state, renders `duty`, and saves the checkpoint. Continue renders the validated loaded state.

- [ ] **Step 4: Render scenes from data and dispatch stable actions**

`renderScene` sets the title, copy, document cards, action buttons, clue list, progress text, and approved art from data. All button handling uses event delegation on `#storyActions`. After collecting a clue or completing a comparison, replace its button label with “확인함” and set `aria-pressed="true"`.

Only render `returnedSignal` when `state.revealedArtIds` includes it. Set the image source immediately before displaying the `hold-depart` scene; do not preload it at page startup.

- [ ] **Step 5: Add checkpoint autosave and non-destructive feedback**

Call `saveStoryProgress` only after successful `advanceStory`, accepted `submitEvidence`, explicit completion, or confirmed reset. If saving fails, preserve the in-memory state and announce the returned error. Rejected claims and incomplete prerequisites update `#storyStatus` without removing clues or changing scene.

Move focus to `#storySceneTitle` after a scene transition and to `#storyStatus` after rejected evidence by temporarily assigning `tabindex="-1"`.

- [ ] **Step 6: Add image failure recovery**

On image error, hide the broken image, reveal `#storyArtFallback` with the data-provided description, and show a “삽화 다시 불러오기” button. Retrying assigns the same approved source path again. Investigation controls remain usable while fallback is visible.

- [ ] **Step 7: Complete, replay, and return**

Completing `hold-depart` sets `chapterComplete: true`, saves, and opens `#storyCompletion`. `제1장 다시 보기` opens the same reset confirmation and returns to `duty` only after confirmation. `첫 화면으로` is a normal link to `../` and never clears storage.

- [ ] **Step 8: Run state, storage, static, and browser tests and verify GREEN**

```powershell
node --test tests/story-chapter-01-data.test.mjs tests/story-state.test.mjs tests/story-storage.test.mjs tests/story-ui.static.test.cjs
$env:PIXEL_WORLD_URL='http://127.0.0.1:4173'
node tests/story-browser-smoke.cjs
node --check src/story-controller.js
```

Expected: all tests pass with no page errors or console errors.

- [ ] **Step 9: Commit the playable Chapter 1**

```powershell
git add src/story-controller.js story/index.html story/story.css tests/story-browser-smoke.cjs
git commit -m "feat: implement chapter 1 investigation journey"
```

---

### Task 7: Preserve Existing Browser Journeys and Wire CI

**Files:**
- Modify: `tests/solo-mode-smoke.cjs`
- Modify: `tests/browser-smoke.cjs`
- Modify: `tests/chat-game-smoke.cjs`
- Modify: `tests/coast-browser-smoke.cjs`
- Modify: `tests/volcano-browser-smoke.cjs`
- Modify: `tests/combat-growth-browser.cjs`
- Modify: `tests/reward-browser-smoke.cjs`
- Modify: `.github/workflows/browser-smoke.yml`

**Interfaces:**
- Consumes: `#rpgExperienceButton` from Task 1 and `tests/story-browser-smoke.cjs` from Task 6.
- Produces: preserved RPG smoke entry and CI coverage for story mode.

- [ ] **Step 1: Make existing browser smokes fail against the new launcher**

Run each current browser script against the Task 1 root. Confirm it stops before filling `#nicknameInput` because the RPG registration overlay is hidden.

- [ ] **Step 2: Update every RPG smoke to enter through the public selector**

Immediately after each root `page.goto(...)`, add:

```js
await page.locator("#rpgExperienceButton").click();
await page.locator("#entryOverlay").waitFor({ state: "visible" });
```

Do not bypass the selector through query parameters or direct DOM mutation. For `reward-browser-smoke.cjs`, add the same two lines after each fresh page load that proceeds to RPG registration.

- [ ] **Step 3: Add the story journey to browser CI**

Append to the workflow’s “Run browser smoke” block:

```bash
PIXEL_WORLD_URL=http://127.0.0.1:4173 node tests/story-browser-smoke.cjs
```

Place it immediately after `tests/solo-mode-smoke.cjs` so an offline-only story failure is easy to identify.

- [ ] **Step 4: Run all browser smokes and verify GREEN**

With the local server still running:

```powershell
$env:PIXEL_WORLD_URL='http://127.0.0.1:4173'
node tests/solo-mode-smoke.cjs
node tests/browser-smoke.cjs
node tests/chat-game-smoke.cjs
node tests/coast-browser-smoke.cjs
node tests/volcano-browser-smoke.cjs
node tests/combat-growth-browser.cjs
node tests/story-browser-smoke.cjs
node tests/reward-browser-smoke.cjs
```

Expected: all exit 0 with no page or console errors.

- [ ] **Step 5: Commit CI and regression updates**

```powershell
git add tests/solo-mode-smoke.cjs tests/browser-smoke.cjs tests/chat-game-smoke.cjs tests/coast-browser-smoke.cjs tests/volcano-browser-smoke.cjs tests/combat-growth-browser.cjs tests/reward-browser-smoke.cjs .github/workflows/browser-smoke.yml
git commit -m "test: cover RPG and story entry journeys"
```

---

### Task 8: Document the Mode and Run the Full Release Gate

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: final public UI, save key, controls, and test commands.
- Produces: user-facing documentation and verified branch state.

- [ ] **Step 1: Write the failing README contract**

Add a focused test to `tests/experience-entry-ui.static.test.cjs` that reads `README.md` and asserts it contains:

```js
for (const text of [
  "소설판 조사 스토리",
  "처음부터",
  "이어하기",
  "pixel-world.story.v1",
  "Firebase를 사용하지 않습니다",
]) {
  assert.match(readme, new RegExp(text));
}
```

- [ ] **Step 2: Run the README contract and verify RED**

```powershell
node --test tests/experience-entry-ui.static.test.cjs
```

Expected: FAIL on the first missing story-mode phrase.

- [ ] **Step 3: Update README with exact behavior**

Document:

- root choice between existing RPG and novella story
- Chapter 1-only scope
- `처음부터`, `이어하기`, autosave, replay, and return behavior
- click/touch/keyboard investigation
- isolated `pixel-world.story.v1` save
- no nickname, class, combat, rewards, or Firebase in story mode
- the two official illustrations and their spoiler-safe reveal timing

- [ ] **Step 4: Run all Node and syntax tests**

```powershell
node --test tests/*.test.mjs tests/*.static.test.cjs
Get-ChildItem -LiteralPath src -Filter '*.js' | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Expected: all tests pass; every source file exits syntax check 0.

- [ ] **Step 5: Run the complete browser workflow locally**

Run the exact scripts from `.github/workflows/browser-smoke.yml` against `http://127.0.0.1:4173`. Confirm the story request log contains no Firebase/network request and that existing RPG journeys still pass.

- [ ] **Step 6: Verify repository scope and assets**

```powershell
git status --short
git diff --check main...HEAD
git diff --stat main...HEAD
Get-FileHash -Algorithm SHA256 -LiteralPath 'story/assets/chapter-01/01_제01장_고대 숲의 초보 궁수 테오.png','story/assets/chapter-01/02_제01장_지워질 네 이름, 돌아온 신호.png'
```

Expected:

- only the files named in this plan are changed
- `git diff --check` prints nothing
- hashes equal `F2BCEB0F...CD21063B` and `6AA87083...F5E3A896`
- no Chapter 2+ image is present under `story/assets`

- [ ] **Step 7: Commit documentation**

```powershell
git add README.md tests/experience-entry-ui.static.test.cjs
git commit -m "docs: explain chapter 1 story mode"
```

- [ ] **Step 8: Perform final branch verification**

```powershell
git status --short
git log --oneline main..HEAD
```

Expected: clean working tree and the design plus eight implementation-task commits on `codex/story-mode-chapter-1`. Do not push to `main`, merge, or deploy.
