const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE_URL = process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173";

async function exposeRuntime(page) {
  await page.route("**/src/main-20260910-sanctuary.js", async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({
      response,
      body: `${source}\nwindow.__sanctuaryGame = game; window.__sanctuaryIntro = firstJourneyController;`,
    });
  });
}

async function enter(page, nickname, classId = "warrior", playMode = "solo") {
  await page.locator("#nicknameInput").fill(nickname);
  await page.locator(`[data-class-id="${classId}"]`).click();
  await page.locator(`[data-play-mode="${playMode}"]`).click();
  await page.locator("#enterButton").click();
  await page.locator("#hud").waitFor({ state: "visible" });
  await page.waitForFunction(() => Boolean(window.__sanctuaryGame));
}

async function leave(page) {
  await page.locator("#exitButton").click();
  await page.locator("#confirmExitButton").click();
  await page.locator("#entryOverlay").waitFor({ state: "visible" });
}

async function storedProgress(page) {
  return page.evaluate(() => {
    const activeNickname = window.__sanctuaryGame?.player?.name;
    if (!activeNickname) return null;
    const key = `pixel-world.progress.v8:${encodeURIComponent(activeNickname)}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  });
}

async function runtimeState(page) {
  return page.evaluate(() => {
    const game = window.__sanctuaryGame;
    return {
      mapId: game.mapId,
      sessionMode: game.sessionMode,
      introActive: game.isFirstJourneyActive(),
      inputEnabled: game.inputEnabled,
      player: { x: game.player.x, y: game.player.y, hp: game.player.hp, maxHp: game.player.maxHp, mp: game.player.mp, maxMp: game.player.maxMp },
      attackActive: Boolean(game.player.attack || game.activeSkillCast),
      progress: JSON.parse(JSON.stringify(game.progress)),
      originSpectator: game.isOriginSpectator(),
      hasRenderableBoss: Boolean(game.renderableBoss?.()),
      trinityHp: game.trinityBoss?.hp ?? null,
    };
  });
}

async function qaTravel(page, mapId) {
  await page.locator("#qaButton").click();
  await page.locator(`[data-qa-world="${mapId}"]`).click();
  await page.locator("#qaOverlay").waitFor({ state: "hidden" });
  await page.waitForFunction(expected => window.__sanctuaryGame.mapId === expected, mapId);
}

async function qaSetup(page, setupId) {
  await page.locator("#qaButton").click();
  await page.locator(`[data-qa-sanctuary-setup="${setupId}"]`).click();
  await page.locator("#qaOverlay").waitFor({ state: "hidden" });
}

async function completeOriginRecord(page, mapId, recordId) {
  await qaTravel(page, mapId);
  const completed = await page.evaluate(id => window.__sanctuaryGame.applyStoryInteraction(id, {}), recordId);
  assert.equal(completed, true, `${recordId} should complete through the production story adapter`);
}

async function finishEnding(page, endingId) {
  await page.evaluate(() => { window.__sanctuaryGame.endingController.sceneDurationMs = 5; });
  await page.locator(`#ending${endingId[0].toUpperCase()}${endingId.slice(1)}Button`).click();
  await page.locator("#endingConfirmPanel").waitFor({ state: "visible" });
  await page.locator("#endingConfirmButton").click();
  await page.locator("#endingCredits").waitFor({ state: "visible", timeout: 3000 });
  assert.equal(await page.locator("#endingCreditsSkip").isDisabled(), true, "credit skip must stay locked before five seconds");
  await page.waitForTimeout(5100);
  assert.equal(await page.locator("#endingCreditsSkip").isEnabled(), true, "credit skip must unlock after five seconds");
  await page.locator("#endingCreditsSkip").click();
  await page.waitForFunction(() => window.__sanctuaryGame.mapId === "village", null, { timeout: 5000 });
}

async function firstPlayerJourney(page) {
  const nickname = `신규방랑자-${Date.now()}`;
  await page.goto(`${BASE_URL}/?qa=1`, { waitUntil: "networkidle" });
  await enter(page, nickname, "warrior", "solo");
  await page.locator("#firstJourneyOverlay").waitFor({ state: "visible" });

  const before = await runtimeState(page);
  assert.equal(before.introActive, true);
  assert.equal(before.inputEnabled, false);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(150);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Control");
  const blocked = await runtimeState(page);
  assert.equal(blocked.player.x, before.player.x);
  assert.equal(blocked.player.y, before.player.y);
  assert.equal(blocked.attackActive, false);

  const typingText = await page.locator("#firstJourneyText").textContent();
  await page.keyboard.press("Enter");
  const completedText = await page.locator("#firstJourneyText").textContent();
  assert.ok(completedText.length >= typingText.length);
  assert.match(completedText, /WORLD DATA ERROR/);
  await page.keyboard.press("Space");
  await page.waitForTimeout(30);
  assert.equal((await page.locator("#firstJourneyText").textContent()).includes("WORLD DATA ERROR"), false);

  await page.locator("#firstJourneySkip").click();
  await page.locator("#firstJourneyOverlay").waitFor({ state: "hidden" });
  const arrived = await runtimeState(page);
  assert.equal(arrived.progress.introSeen, true);
  assert.deepEqual(
    { hp: arrived.player.maxHp, mp: arrived.player.maxMp },
    { hp: 120, mp: 80 },
  );
  assert.match(await page.locator("#chapterObjective").textContent(), /CHAPTER 1 · 아렌에게 대륙의 상황을 듣는다/);
  assert.equal((await storedProgress(page)).introSeen, true);

  const helpBefore = await runtimeState(page);
  await page.locator("#helpButton").click();
  await page.locator("#beginnerGuideOverlay").waitFor({ state: "visible" });
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(120);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Escape");
  await page.locator("#beginnerGuideOverlay").waitFor({ state: "hidden" });
  const helpAfter = await runtimeState(page);
  assert.equal(helpAfter.player.x, helpBefore.player.x);
  assert.equal(helpAfter.player.y, helpBefore.player.y);

  const arenLabel = await page.evaluate(() => {
    const game = window.__sanctuaryGame;
    const aren = game.npcs.find(npc => npc.id === "aren");
    game.player.x = aren.x;
    game.player.y = aren.y + 45;
    game.player.dir = "up";
    game.updateNpcPrompt();
    return Boolean(aren);
  });
  assert.equal(arenLabel, true);
  await page.keyboard.press("f");
  await page.locator("#dialogueOverlay").waitFor({ state: "visible" });
  assert.match(await page.locator("#dialogueBody").textContent(), /태고의 숲/);
  assert.match(await page.locator("#dialogueBody").textContent(), /세라/);
  assert.equal(await page.locator("#dialogueActionButton").textContent(), "[모험의 시작] 임무 수락");
  await page.keyboard.press("Escape");

  await leave(page);
  await enter(page, nickname, "archer", "solo");
  assert.equal(await page.locator("#firstJourneyOverlay").isVisible(), false, "same nickname must not replay intro after class change");
  const reentered = await runtimeState(page);
  assert.deepEqual({ hp: reentered.player.maxHp, mp: reentered.player.maxMp }, { hp: 100, mp: 100 });
  await leave(page);
}

async function primaryResonanceEnding(page) {
  const nickname = `공명완주-${Date.now()}`;
  await page.goto(`${BASE_URL}/?qa=1`, { waitUntil: "networkidle" });
  await enter(page, nickname, "mage", "solo");
  if (await page.locator("#firstJourneySkip").isVisible()) await page.locator("#firstJourneySkip").click();

  await qaSetup(page, "trinity-ready");
  await completeOriginRecord(page, "sanctuary-resonance-hall", "origin-record-single-authority");
  await completeOriginRecord(page, "sanctuary-origin-archive", "origin-record-sealed-recovery");
  await qaTravel(page, "sanctuary-zero-boundary");
  await page.waitForFunction(() => window.__sanctuaryGame.trinityBoss?.hp === 800, null, { timeout: 3000 });
  assert.equal((await runtimeState(page)).trinityHp, 800);
  const trinityDefeated = await page.evaluate(() => window.__sanctuaryGame.damageTrinity(800));
  assert.equal(trinityDefeated, true);
  assert.equal((await runtimeState(page)).progress.worldProgress.chapters.sanctuary.trinityDefeated, true);
  const record3 = await page.evaluate(() => window.__sanctuaryGame.applyStoryInteraction("origin-record-mutual-validation", {}));
  assert.equal(record3, true);

  await qaTravel(page, "sanctuary-core-heart");
  await page.waitForTimeout(100);
  const bossBefore = await runtimeState(page);
  assert.equal(bossBefore.hasRenderableBoss, true, "ORIGIN should be present before local defeat receipt");
  const receipt = await page.evaluate(() => {
    const game = window.__sanctuaryGame;
    const boss = game.renderableBoss();
    return game.recordLocalOriginDefeat(boss?.encounterId || "browser-origin-resonance");
  });
  assert.equal(receipt, true);
  const spectator = await runtimeState(page);
  assert.equal(spectator.originSpectator, true);
  assert.equal(spectator.hasRenderableBoss, false);
  assert.equal(await page.evaluate(() => window.__sanctuaryGame.openSanctuaryEndingChoice()), true);
  await page.locator("#endingChoicePanel").waitFor({ state: "visible" });
  assert.equal(await page.locator("#endingResonateButton").isEnabled(), true);
  const goldBefore = (await runtimeState(page)).progress.gold;
  await finishEnding(page, "resonate");
  const completed = await runtimeState(page);
  assert.equal(completed.progress.endingTitle, "세계의 공명자");
  assert.equal(completed.progress.worldProgress.chapters.sanctuary.chapterCompleted, true);
  assert.equal(completed.progress.gold, goldBefore + 1000);
  const persisted = await storedProgress(page);
  assert.equal(persisted.endingTitle, "세계의 공명자");
  assert.equal(persisted.worldProgress.chapters.sanctuary.endingRewardClaimed, true);
  await leave(page);

  await enter(page, nickname, "mage", "solo");
  assert.equal(await page.locator("#firstJourneyOverlay").isVisible(), false);
  const afterReload = await runtimeState(page);
  assert.equal(afterReload.progress.gold, completed.progress.gold, "ending reward must not be paid again on reload");
  assert.equal(afterReload.progress.endingTitle, "세계의 공명자");
  await leave(page);
}

async function deferredRecoveryEnding(page) {
  const nickname = `보류복원-${Date.now()}`;
  await page.goto(`${BASE_URL}/?qa=1`, { waitUntil: "networkidle" });
  await enter(page, nickname, "warrior", "solo");
  if (await page.locator("#firstJourneySkip").isVisible()) await page.locator("#firstJourneySkip").click();

  await qaSetup(page, "ending-restore-ready");
  await page.locator("#endingChoicePanel").waitFor({ state: "visible" });
  assert.equal(await page.locator("#endingResonateButton").isDisabled(), true);
  assert.match(await page.locator("#endingLockedReason").textContent(), /원점 기록 3\/3 필요/);
  await page.locator("#endingDeferButton").click();
  await page.locator("#sanctuaryEndingOverlay").waitFor({ state: "hidden" });

  await qaSetup(page, "origin-records-3");
  await qaTravel(page, "sanctuary-core-heart");
  assert.equal(await page.evaluate(() => window.__sanctuaryGame.openSanctuaryEndingChoice()), true);
  await page.locator("#endingChoicePanel").waitFor({ state: "visible" });
  assert.equal(await page.locator("#endingResonateButton").isEnabled(), true);
  await page.locator("#endingDeferButton").click();
  await page.locator("#sanctuaryEndingOverlay").waitFor({ state: "hidden" });
  await leave(page);
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await exposeRuntime(page);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    await firstPlayerJourney(page);
    await primaryResonanceEnding(page);
    await deferredRecoveryEnding(page);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
