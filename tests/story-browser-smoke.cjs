const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173";
const screenshotDirectory = path.join(
  __dirname,
  "..",
  ".superpowers",
  "sdd",
  "2026-09-11-story-mode-chapter-1",
  "task-6-screenshots",
);
const storySaveKey = "pixel-world.story.v1";
const rpgSaveKey = "pixel-world.progress.v7:smoke-rpg";
const returnedSignalFile = "02_제01장_지워질 네 이름, 돌아온 신호.png";

function pageDiagnostics(page) {
  const requests = [];
  const errors = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  return { requests, errors };
}

async function waitForScene(page, title) {
  await page.locator("#storySceneTitle").filter({ hasText: title }).waitFor();
}

async function waitForLoadedArt(page) {
  await page.waitForFunction(() => {
    const image = document.querySelector("#storyArt");
    return image.complete && image.naturalWidth > 0;
  });
}

async function startNewChapter(page) {
  await page.locator("#storyNewButton").click();
  await page.locator("#storyScreen").waitFor({ state: "visible" });
  await waitForScene(page, "첫 임무");
}

async function pressNext(page) {
  await page.locator("[data-story-next]").click();
}

async function collect(page, clueIds) {
  for (const clueId of clueIds) {
    const clue = page.locator(`[data-clue-id="${clueId}"]`);
    await clue.click();
    await assert.doesNotReject(async () => clue.getAttribute("aria-pressed"));
    assert.equal(await clue.getAttribute("aria-pressed"), "true", `${clueId} should be selected`);
    assert.match(await clue.textContent(), /확인함/, `${clueId} should have visible selected wording`);
  }
}

async function advanceThroughInvestigation(page) {
  await collect(page, ["rule-five-years", "rule-no-life-signal", "rule-no-recovery"]);
  await pressNext(page);
  await waitForScene(page, "명부와 회수품");

  await collect(page, ["roster-four-names", "recovered-radio", "empty-map-case"]);
  await pressNext(page);
  await waitForScene(page, "통신기 점검");

  await collect(page, ["replay-lengths", "new-received-at", "signal-warning", "metal-pattern"]);
  await pressNext(page);
  await waitForScene(page, "나침반 소리 대조");

  await collect(page, ["main-compass-missing"]);
  await page.locator('[data-comparison-id="metal-to-compass"]').click();
  assert.equal(await page.locator('[data-comparison-id="metal-to-compass"]').getAttribute("aria-pressed"), "true");
  await pressNext(page);
  await waitForScene(page, "세 지역 기록 비교");

  await page.locator('[data-comparison-id="same-final-time"]').click();
  assert.equal(await page.locator('[data-comparison-id="same-final-time"]').getAttribute("aria-pressed"), "true");
  await pressNext(page);
  await waitForScene(page, "폐기 보류 근거 제출");
  await collect(page, ["article-18-4"]);
}

async function selectAcceptedEvidence(page) {
  await page.locator('[data-claim-id="investigate-survival"]').click();
  for (const evidenceId of ["new-received-at", "metal-to-compass", "article-18-4"]) {
    const evidence = page.locator(`[data-evidence-id="${evidenceId}"]`);
    await evidence.click();
    assert.equal(await evidence.getAttribute("aria-pressed"), "true", `${evidenceId} should be selected`);
  }
}

async function assertMobileLayout(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    const diagnostics = pageDiagnostics(page);
    await page.goto(`${baseUrl}/story/`, { waitUntil: "networkidle" });
    await startNewChapter(page);
    const layout = await page.locator(".story-layout").evaluate(element => getComputedStyle(element).gridTemplateColumns);
    const positions = await page.evaluate(() => {
      const art = document.querySelector(".story-art-panel").getBoundingClientRect();
      const controls = document.querySelector("#storyActions").getBoundingClientRect();
      const firstButton = document.querySelector("#storyActions button").getBoundingClientRect();
      return {
        artBottom: art.bottom,
        controlsTop: controls.top,
        buttonHeight: firstButton.height,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    assert.equal(layout.split(" ").length, 1, "mobile layout must be one column");
    assert.ok(positions.artBottom <= positions.controlsTop, "art must stay above controls without overlap");
    assert.ok(positions.buttonHeight >= 44, "mobile action target must be at least 44px high");
    assert.ok(positions.scrollWidth <= positions.clientWidth, "mobile view must not horizontally overflow");
    await page.screenshot({ path: path.join(screenshotDirectory, "mobile-opening.png"), fullPage: true });
    assert.deepEqual(diagnostics.errors, []);
  } finally {
    await context.close();
  }
}

async function assertStorageRecovery(browser) {
  const unsupportedBytes = '{ "schemaVersion" : 2, "future" : true }';
  const context = await browser.newContext();
  try {
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: storySaveKey,
      value: unsupportedBytes,
    });
    const page = await context.newPage();
    const diagnostics = pageDiagnostics(page);
    await page.goto(`${baseUrl}/story/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#storyContinueButton").isDisabled(), true);
    assert.equal(await page.locator("#storyStartStatus").isVisible(), true);
    assert.match(await page.locator("#storyStartStatus").textContent(), /보존했습니다/);
    await startNewChapter(page);
    assert.equal(
      await page.evaluate(key => localStorage.getItem(key), storySaveKey),
      unsupportedBytes,
      "unsupported bytes must survive an in-memory start",
    );
    await page.locator("[data-story-next]").click();
    await waitForScene(page, "폐기 기준 확인");
    await advanceThroughInvestigation(page);
    await selectAcceptedEvidence(page);
    await page.locator('[data-story-submit]').click();
    await waitForScene(page, "폐기 보류와 숲 조사 임무");
    await pressNext(page);
    await page.locator("#storyCompletion").waitFor({ state: "visible" });
    await page.locator("#storyReplayButton").click();
    await page.locator("#storyResetOverlay").waitFor({ state: "visible" });
    await page.locator("#storyResetConfirmButton").click();
    await waitForScene(page, "첫 임무");
    assert.equal(
      await page.evaluate(key => localStorage.getItem(key), storySaveKey),
      unsupportedBytes,
      "Replay/reset must never overwrite unsupported bytes",
    );
    await page.locator("[data-story-next]").click();
    await waitForScene(page, "폐기 기준 확인");
    assert.equal(
      await page.evaluate(key => localStorage.getItem(key), storySaveKey),
      unsupportedBytes,
      "unsupported session checkpoints must remain unsaved",
    );
    assert.deepEqual(diagnostics.errors, []);
  } finally {
    await context.close();
  }

  const recoveredContext = await browser.newContext();
  try {
    await recoveredContext.addInitScript(key => localStorage.setItem(key, "{"), storySaveKey);
    const page = await recoveredContext.newPage();
    const diagnostics = pageDiagnostics(page);
    await page.goto(`${baseUrl}/story/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#storyContinueButton").isDisabled(), true);
    assert.equal(await page.locator("#storyStartStatus").isVisible(), true);
    assert.match(await page.locator("#storyStartStatus").textContent(), /손상된 진행을 복구/);
    await startNewChapter(page);
    assert.equal(
      await page.evaluate(key => JSON.parse(localStorage.getItem(key)).sceneId, storySaveKey),
      "duty",
      "recovered malformed data may be replaced on a new start",
    );
    assert.deepEqual(diagnostics.errors, []);
  } finally {
    await recoveredContext.close();
  }
}

(async () => {
  await fs.mkdir(screenshotDirectory, { recursive: true });
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      const diagnostics = pageDiagnostics(page);

      await page.goto(`${baseUrl}/story/`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("#storyStartOverlay").isVisible(), true);
      assert.equal(await page.locator("#storyNewButton").isEnabled(), true);
      assert.equal(await page.locator("#storyContinueButton").isDisabled(), true);
      assert.equal(diagnostics.requests.some(url => url.includes(".png")), false, "initial shell must not request art");
      assert.equal(
        diagnostics.requests.some(url => /firebase|gstatic|googleapis|network-/i.test(url)),
        false,
        "story mode must stay offline",
      );

      await startNewChapter(page);
      await waitForLoadedArt(page);
      await page.locator("#storyArt").evaluate(image => image.dispatchEvent(new Event("error")));
      await page.locator("#storyArtFallback").waitFor({ state: "visible" });
      await page.locator("#storyArtRetryButton").click();
      await page.locator("#storyArt").waitFor({ state: "visible" });
      assert.equal(await page.locator("#storyArtFallback").isHidden(), true, "successful retry clears fallback");
      await page.screenshot({ path: path.join(screenshotDirectory, "desktop-opening.png"), fullPage: true });

      await page.locator("[data-story-next]").focus();
      await page.keyboard.press("Enter");
      await waitForScene(page, "폐기 기준 확인");
      assert.equal(await page.locator("#storySceneTitle").evaluate(element => document.activeElement === element), true);

      await pressNext(page);
      assert.match(await page.locator("#storyStatus").textContent(), /규정 카드/);
      assert.equal(await page.locator("#storyStatus").evaluate(element => document.activeElement === element), true);

      await advanceThroughInvestigation(page);
      assert.equal(
        diagnostics.requests.some(url => decodeURIComponent(url).includes(returnedSignalFile)),
        false,
        "late art must not be requested before accepted evidence",
      );

      const cluesBeforeRejection = await page.locator("#storyClues").textContent();
      await page.locator('[data-claim-id="all-alive"]').click();
      await page.locator('[data-story-submit]').click();
      assert.match(await page.locator("#storyStatus").textContent(), /확정하지 않습니다/);
      assert.match(await page.locator("#storySceneTitle").textContent(), /폐기 보류 근거 제출/);
      assert.equal(await page.locator("#storyClues").textContent(), cluesBeforeRejection, "rejection must preserve clues");

      await selectAcceptedEvidence(page);
      await page.locator('[data-story-submit]').click();
      await waitForScene(page, "폐기 보류와 숲 조사 임무");
      await page.locator("#storyArt").waitFor({ state: "visible" });
      await waitForLoadedArt(page);
      const artPresentation = await page.locator("#storyArt").evaluate(image => ({
        width: image.getAttribute("width"),
        height: image.getAttribute("height"),
        objectFit: getComputedStyle(image).objectFit,
        src: image.currentSrc,
      }));
      assert.deepEqual(artPresentation, {
        width: "1536",
        height: "1024",
        objectFit: "contain",
        src: artPresentation.src,
      });
      assert.match(decodeURIComponent(artPresentation.src), /02_제01장_지워질 네 이름, 돌아온 신호\.png/);
      await page.screenshot({ path: path.join(screenshotDirectory, "desktop-evidence-final-art.png"), fullPage: true });

      await pressNext(page);
      await page.locator("#storyCompletion").waitFor({ state: "visible" });
      assert.equal(await page.locator("#storyCompletionTitle").textContent(), "생존 여부 미확인. 폐기 보류.");
      assert.equal(await page.locator("#storyScreen").isHidden(), true, "completion must hide the investigation screen");
      assert.equal(await page.locator("#storyStartOverlay").isHidden(), true);
      assert.equal(await page.locator("#storyResetOverlay").isHidden(), true);
      assert.equal(
        await page.locator("#storyCompletionTitle").evaluate(element => document.activeElement === element),
        true,
        "completion must receive focus",
      );
      const completionBox = await page.locator("#storyCompletion").boundingBox();
      assert.ok(completionBox.y >= 0 && completionBox.y < 900, "completion must be immediately viewport-visible");
      const checkpoint = await page.evaluate(({ storyKey, rpgKey }) => ({
        story: localStorage.getItem(storyKey),
        rpg: localStorage.getItem(rpgKey),
        keys: Object.keys(localStorage),
      }), { storyKey: storySaveKey, rpgKey: rpgSaveKey });
      assert.ok(checkpoint.story, "completion must save a story checkpoint");
      assert.equal(checkpoint.rpg, null);
      assert.deepEqual(checkpoint.keys.filter(key => key.includes("story") || key.includes("progress")), [storySaveKey]);
      await page.screenshot({ path: path.join(screenshotDirectory, "desktop-completion.png") });

      await page.evaluate(({ rpgKey }) => localStorage.setItem(rpgKey, "rpg-bytes-must-survive"), { rpgKey: rpgSaveKey });
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.locator("#storyContinueButton").isEnabled(), true);
      await page.locator("#storyContinueButton").click();
      await page.locator("#storyCompletion").waitFor({ state: "visible" });
      assert.equal(await page.locator("#storyScreen").isHidden(), true, "Continue must reopen completion directly");
      assert.equal(await page.locator("#storyCompletionTitle").evaluate(element => document.activeElement === element), true);

      await page.locator("#storyReplayButton").click();
      await page.locator("#storyResetOverlay").waitFor({ state: "visible" });
      assert.equal(await page.locator("#storyResetConfirmButton").evaluate(element => document.activeElement === element), true);
      const resetPresentation = await page.locator("#storyResetOverlay").evaluate(element => {
        const box = element.getBoundingClientRect();
        return { position: getComputedStyle(element).position, top: box.top, bottom: box.bottom };
      });
      assert.equal(resetPresentation.position, "fixed");
      assert.ok(resetPresentation.top <= 0 && resetPresentation.bottom >= 900, "reset must cover the viewport");
      assert.equal(await page.locator("#storyCompletion").getAttribute("inert"), "");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator("#storyResetCancelButton").evaluate(element => document.activeElement === element), true);
      await page.keyboard.press("Tab");
      assert.equal(await page.locator("#storyResetConfirmButton").evaluate(element => document.activeElement === element), true);
      await page.keyboard.press("Shift+Tab");
      assert.equal(await page.locator("#storyResetCancelButton").evaluate(element => document.activeElement === element), true);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#storyResetOverlay").isHidden(), true);
      assert.equal(await page.locator("#storyReplayButton").evaluate(element => document.activeElement === element), true);
      await page.locator("#storyReplayButton").click();
      await page.locator("#storyResetCancelButton").click();
      assert.equal(await page.locator("#storyCompletion").isVisible(), true);
      await page.locator("#storyReplayButton").click();
      await page.locator("#storyResetConfirmButton").click();
      await waitForScene(page, "첫 임무");
      const resetKeys = await page.evaluate(({ storyKey, rpgKey }) => ({
        state: JSON.parse(localStorage.getItem(storyKey)),
        rpg: localStorage.getItem(rpgKey),
      }), { storyKey: storySaveKey, rpgKey: rpgSaveKey });
      assert.equal(resetKeys.state.sceneId, "duty");
      assert.equal(resetKeys.rpg, "rpg-bytes-must-survive");

      assert.equal(
        diagnostics.requests.some(url => /firebase|gstatic|googleapis|network-/i.test(url)),
        false,
        "story mode must never request online or RPG network modules",
      );
      assert.deepEqual(diagnostics.errors, []);
    } finally {
      await context.close();
    }
    await assertStorageRecovery(browser);
    await assertMobileLayout(browser);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
