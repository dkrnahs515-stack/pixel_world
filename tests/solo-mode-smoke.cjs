const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const firebaseRequests = [];
    const errors = [];
    page.on("request", request => {
      if (/(?:gstatic\.com\/firebase|firebaseio\.com|firebasedatabase\.app)/.test(request.url())) {
        firebaseRequests.push(request.url());
      }
    });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173", { waitUntil: "networkidle" });
    await page.locator("#nicknameInput").fill("솔로테스터");
    await page.locator('[data-class-id="mage"]').click();
    await page.locator('[data-play-mode="solo"]').click();
    await page.locator("#enterButton").click();
    await page.locator("#hud").waitFor({ state: "visible" });
    assert.equal(await page.locator("#chatPanel").isHidden(), true);
    assert.equal(await page.locator("#onlinePresence").isHidden(), true);
    assert.equal(await page.locator("#coopBossHud").isHidden(), true);
    assert.deepEqual(firebaseRequests, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
