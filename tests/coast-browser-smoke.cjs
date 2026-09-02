const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const NICKNAME = "해안브라우저";
const BASE_URL = process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173";

const roomFullAppModule = `
export const getApps = () => globalThis.__apps || [];
export const getApp = () => globalThis.__apps[0];
export const initializeApp = () => (globalThis.__apps = [{}])[0];`;

const roomFullAuthModule = `
export const getAuth = () => ({ currentUser: { uid: "room-full-user" } });
export const signInAnonymously = async () => ({ user: { uid: "room-full-user" } });`;

const roomFullDatabaseModule = `
export const getDatabase = () => ({});
export const goOnline = () => {};
export const goOffline = () => {};
export const ref = (_db, path) => ({ path });
export const runTransaction = async (_reference, update) => {
  update("occupied");
  return { committed: false, snapshot: { val: () => "occupied" } };
};`;

async function move(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function enterSolo(page) {
  await page.locator("#nicknameInput").fill(NICKNAME);
  await page.locator('[data-class-id="warrior"]').click();
  await page.locator('[data-play-mode="solo"]').click();
  await page.locator("#enterButton").click();
  await page.locator("#hud").waitFor({ state: "visible" });
}

async function expectMap(page, name) {
  await page.locator(".player-header small").filter({ hasText: name }).waitFor({ timeout: 8000 });
}

async function qaTravel(page, mapId, name) {
  await page.locator("#qaButton").click();
  await page.locator(`[data-qa-world="${mapId}"]`).click();
  await expectMap(page, name);
}

async function qaApproachBoss(page) {
  await page.locator("#qaButton").click();
  await page.locator('[data-qa-boss="approach"]').click();
  await page.locator("#qaOverlay").waitFor({ state: "hidden" });
}

async function storedProgress(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith("pixel-world.progress.v6:"));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
}

async function seedCheckpoint(page, worldProgress, extra = {}) {
  await page.evaluate(({ nextWorldProgress, nextExtra }) => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith("pixel-world.progress.v6:"));
    if (!key) throw new Error("v6 progress checkpoint is missing");
    const value = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...value,
      ...nextExtra,
      worldProgress: nextWorldProgress,
    }));
  }, { nextWorldProgress: worldProgress, nextExtra: extra });
}

async function reloadCheckpoint(page) {
  await page.reload({ waitUntil: "networkidle" });
  await enterSolo(page);
}

async function completeStoryInteraction(page, actionId) {
  await page.locator("#npcPrompt").waitFor({ state: "visible", timeout: 8000 });
  await page.keyboard.press("f");
  await page.locator("#dialogueOverlay").waitFor({ state: "visible" });
  await page.locator(`[data-dialogue-action="${actionId}"]`).click();
  await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
}

async function visitAndInteract(page, mapId, mapName, moves, actionId) {
  await qaTravel(page, mapId, mapName);
  for (const [key, milliseconds] of moves) await move(page, key, milliseconds);
  await completeStoryInteraction(page, actionId);
}

async function fightUntilSaved(page, predicate, label) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    await page.keyboard.press("Control");
    if (attempt % 7 === 0) await page.keyboard.press("q");
    if (attempt % 5 === 0) await page.keyboard.press("1");
    await page.waitForTimeout(540);
    if (attempt % 4 === 0) {
      const progress = await storedProgress(page);
      if (predicate(progress)) return;
      assert.equal(await page.locator("#respawnOverlay").isVisible(), false, `${label}: player died before completion`);
    }
  }
  assert.fail(`${label}: saved completion was not observed`);
}

async function saveShot(page, directory, filename) {
  if (!directory) return;
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, filename) });
}

async function assertOnlineRoomFullFallback(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js", route => route.fulfill({
    status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: roomFullAppModule,
  }));
  await page.route("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js", route => route.fulfill({
    status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: roomFullAuthModule,
  }));
  await page.route("https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js", route => route.fulfill({
    status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: roomFullDatabaseModule,
  }));
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.locator("#nicknameInput").fill("온라인대체");
  await page.locator('[data-class-id="warrior"]').click();
  await page.locator('[data-play-mode="online"]').click();
  await page.locator("#enterButton").click();
  await page.locator("#hud").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("#chatStatus")?.textContent?.trim() === "솔로",
    null,
    { timeout: 8000 },
  );
  assert.equal(await page.locator("#chatPanel").isHidden(), true);
  await page.close();
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${BASE_URL}?qa=1`, { waitUntil: "networkidle" });
    await enterSolo(page);

    await page.locator("#communicationLogButton").click();
    await page.locator("#communicationLogOverlay").waitFor({ state: "visible" });
    await page.locator("#communicationLogCloseButton").click();
    await page.locator("#communicationLogOverlay").waitFor({ state: "hidden" });

    await page.locator("#qaButton").click();
    await page.locator('[data-qa-weapons="prepare"]').click();
    await page.locator("#inventoryButton").click();
    await page.locator('[data-equip-weapon="reinforced-masterwork-katana"]').click();
    await page.locator("#inventoryDoneButton").click();
    const initial = await storedProgress(page);
    assert.equal(initial.version, 6);
    await seedCheckpoint(page, initial.worldProgress, {
      level: 100,
      exp: 0,
      nextLevelExp: 10000,
      inventory: { hpPotion: 99, mpPotion: 99 },
    });
    await reloadCheckpoint(page);

    await qaTravel(page, "forest", "태고의 숲");
    await qaApproachBoss(page);
    await fightUntilSaved(
      page,
      progress => progress?.worldProgress?.completedRegionIds?.includes("forest"),
      "forest boss",
    );
    assert.equal((await storedProgress(page)).worldProgress.unlockedMapIds.includes("coast-beach"), true);

    await reloadCheckpoint(page);
    await qaTravel(page, "coast-beach", "푸른 해변");
    await saveShot(page, process.env.PIXEL_WORLD_SHOTS, "coast-01-beach.png");
    await visitAndInteract(page, "coast-beach", "푸른 해변", [
      ["ArrowDown", 1740], ["ArrowRight", 175],
    ], "story-complete");
    await visitAndInteract(page, "coast-beach", "푸른 해변", [
      ["ArrowDown", 2175], ["ArrowRight", 1090],
    ], "story-classify-current");
    assert.equal((await storedProgress(page)).worldProgress.unlockedMapIds.includes("coast-wreck-bay"), true);

    await reloadCheckpoint(page);
    await qaTravel(page, "coast-wreck-bay", "난파선 만");
    await saveShot(page, process.env.PIXEL_WORLD_SHOTS, "coast-02-wreck-bay.png");
    await visitAndInteract(page, "coast-wreck-bay", "난파선 만", [
      ["ArrowUp", 400], ["ArrowRight", 1320],
    ], "story-complete");
    await visitAndInteract(page, "coast-wreck-bay", "난파선 만", [
      ["ArrowUp", 1440], ["ArrowRight", 3840],
    ], "story-complete");
    await visitAndInteract(page, "coast-wreck-bay", "난파선 만", [
      ["ArrowDown", 1100], ["ArrowRight", 5600], ["ArrowUp", 1200], ["ArrowRight", 700],
    ], "story-complete");
    await visitAndInteract(page, "coast-wreck-bay", "난파선 만", [
      ["ArrowDown", 1165], ["ArrowRight", 1845],
    ], "story-classify-past");
    await visitAndInteract(page, "coast-wreck-bay", "난파선 만", [
      ["ArrowUp", 1530], ["ArrowRight", 3060],
    ], "story-classify-past");
    await visitAndInteract(page, "coast-wreck-bay", "난파선 만", [
      ["ArrowDown", 1165], ["ArrowRight", 4890],
    ], "story-classify-past");
    await visitAndInteract(page, "coast-wreck-bay", "난파선 만", [
      ["ArrowDown", 1600], ["ArrowRight", 6450],
    ], "story-classify-past");
    assert.equal((await storedProgress(page)).worldProgress.unlockedMapIds.includes("coast-flooded-station"), true);

    await reloadCheckpoint(page);
    await qaTravel(page, "coast-flooded-station", "침수된 통신소");
    await saveShot(page, process.env.PIXEL_WORLD_SHOTS, "coast-03-flooded-station.png");
    await visitAndInteract(page, "coast-flooded-station", "침수된 통신소", [
      ["ArrowUp", 1880], ["ArrowRight", 3840],
    ], "story-complete");
    await visitAndInteract(page, "coast-flooded-station", "침수된 통신소", [
      ["ArrowDown", 1165], ["ArrowRight", 4890],
    ], "story-classify-past");
    await visitAndInteract(page, "coast-flooded-station", "침수된 통신소", [
      ["ArrowDown", 1165], ["ArrowRight", 5580],
    ], "story-support-echo");
    let progress = await storedProgress(page);
    assert.equal(progress.worldProgress.chapters.coast.supportChoice, "echo");
    assert.equal(progress.worldProgress.unlockedMapIds.includes("coast-tide-core-cave"), true);

    await reloadCheckpoint(page);
    await qaTravel(page, "coast-tide-core-cave", "조수 코어 동굴");
    await saveShot(page, process.env.PIXEL_WORLD_SHOTS, "coast-04-tide-core-cave.png");
    await qaApproachBoss(page);
    await fightUntilSaved(
      page,
      value => value?.worldProgress?.chapters?.coast?.coopBossDefeated === true,
      "coast local boss",
    );
    await move(page, "ArrowUp", 2400);
    await completeStoryInteraction(page, "story-complete");
    await move(page, "ArrowDown", 900);
    await completeStoryInteraction(page, "story-complete");
    progress = await storedProgress(page);
    assert.equal(progress.worldProgress.completedRegionIds.includes("coast"), true);
    assert.equal(progress.worldProgress.unlockedMapIds.includes("volcano"), true);
    assert.equal(progress.worldProgress.chapters.coast.shortcutUnlocked, true);

    await assertOnlineRoomFullFallback(browser, errors);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
