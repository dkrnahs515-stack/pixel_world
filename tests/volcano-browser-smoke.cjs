const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173";
const HIDDEN_WEAPONS = Object.freeze({
  warrior: "volcanic-heartblade",
  archer: "ember-tracker-bow",
  mage: "leyflame-core-staff",
});

// Hold real movement input until the observed simulation reaches a waypoint.
// Time is only a failure bound, never the measure of distance travelled.
async function walkAxis(page, axis, target, expectedMap = null) {
  const initial = await page.evaluate(() => window.__volcanoSmokeRead());
  const mapId = initial.mapId;
  const direction = Math.sign(target - initial.player[axis]);
  if (!direction) return;
  const key = axis === "x"
    ? (direction > 0 ? "ArrowRight" : "ArrowLeft")
    : (direction > 0 ? "ArrowDown" : "ArrowUp");
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis, target, direction, mapId, expectedMap }) => {
      const state = window.__volcanoSmokeRead();
      if (state.mapId !== mapId) {
        if (state.mapId === expectedMap) return true;
        throw new Error(`Unexpected map during movement: ${state.mapId}`);
      }
      return direction * (state.player[axis] - target) >= -4;
    }, { axis, target, direction, mapId, expectedMap }, { timeout: 20000 });
  } catch (error) {
    console.error("VOLCANO_MOVEMENT_DIAGNOSTIC", JSON.stringify({
      axis, target, initial, current: await page.evaluate(() => window.__volcanoSmokeRead()),
    }));
    throw error;
  } finally {
    await page.keyboard.up(key);
  }
}

async function enterSolo(page, nickname) {
  await page.locator("#nicknameInput").fill(nickname);
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

async function qaPrepareWeapons(page) {
  await page.locator("#qaButton").click();
  await page.locator('[data-qa-weapons="prepare"]').click();
  await page.locator("#qaOverlay").waitFor({ state: "hidden" });
}

async function storedProgress(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith("pixel-world.progress.v7:"));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
}

async function runtimeProgress(page, nickname) {
  return page.evaluate(async activeNickname => {
    const { loadPlayerProgress } = await import("./src/game-20260903-volcano.js");
    return loadPlayerProgress(localStorage, activeNickname).progress;
  }, nickname);
}

async function seedObservatoryCheckpoint(page, prepared) {
  await page.locator("#qaButton").click();
  await page.locator('[data-qa-weapons="prepare"]').click();
  await page.evaluate(({ withAllAnchors }) => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith("pixel-world.progress.v7:"));
    if (!key) throw new Error("v7 progress checkpoint is missing");
    const value = JSON.parse(localStorage.getItem(key));
    value.inventory = { hpPotion: 99, mpPotion: 99 };
    value.equipmentByClass.warrior.equippedWeaponId = "reinforced-masterwork-katana";
    value.worldProgress = {
      unlockedRegionIds: ["village", "forest", "coast", "volcano"],
      completedRegionIds: ["coast"],
      unlockedMapIds: [
        "village", "forest",
        "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
        "volcano", "volcano-magma-route", "volcano-observatory",
      ],
      chapters: {
        coast: {
          repairedDeviceIds: [], collectedRecordIds: [], supportChoice: null,
          seraRescued: true, coopBossDefeated: true, coreFragmentObtained: true,
          shortcutUnlocked: true,
        },
        volcano: {
          repairedDeviceIds: [
            "ash-gate-pressure-seal", "magma-valve-west", "magma-valve-central",
            "magma-valve-east", "observatory-stabilizer",
          ],
          collectedClueIds: [
            "garen-scorched-insignia", "garen-escort-record",
            "captain-transport-order", "captain-core-contact-record",
          ],
          coolantAnchorIds: withAllAnchors ? [
            "ash-gate-coolant-anchor", "magma-route-coolant-anchor", "observatory-coolant-anchor",
          ] : ["ash-gate-coolant-anchor", "magma-route-coolant-anchor"],
          routeDecision: null,
          eruptionTriggered: false,
          coopBossDefeated: false,
          captainOutcome: null,
          hiddenWeaponRewardClaimed: false,
          coreFragmentObtained: false,
          sanctuaryUnlocked: false,
        },
      },
    };
    localStorage.setItem(key, JSON.stringify(value));
  }, { withAllAnchors: prepared });
}

async function reloadCheckpoint(page, nickname) {
  await page.reload({ waitUntil: "networkidle" });
  await enterSolo(page, nickname);
}

async function approachRouteConsole(page) {
  await qaTravel(page, "volcano-observatory", "붕괴한 관측소");
  await walkAxis(page, "y", 1220);
  await walkAxis(page, "x", 1700);
  await walkAxis(page, "y", 900);
  await page.locator("#npcPrompt").waitFor({ state: "visible", timeout: 8000 });
  await page.keyboard.press("f");
  await page.locator("#dialogueOverlay").waitFor({ state: "visible" });
}

async function chooseRoute(page, prepared) {
  await approachRouteConsole(page);
  if (!prepared) {
    const warning = await page.locator("#dialogueBody").textContent();
    assert.match(warning, /대장을 구할 수 없고 히든 무기를 얻지 못한다/);
    await page.locator('[data-dialogue-action="story-volcano-route-return"]').click();
    await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
    const returned = await storedProgress(page);
    assert.equal(returned.worldProgress.chapters.volcano.routeDecision, null);
    assert.equal(returned.worldProgress.chapters.volcano.eruptionTriggered, false);
    await page.locator("#npcPrompt").waitFor({ state: "visible" });
    await page.keyboard.press("f");
    await page.locator("#dialogueOverlay").waitFor({ state: "visible" });
  }
  const actionId = prepared ? "story-volcano-route-rescue" : "story-volcano-route-proceed";
  await page.locator(`[data-dialogue-action="${actionId}"]`).click();
  await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
  await qaTravel(page, "volcano-core-caldera", "화구 코어 제단");
}

async function pressStrongAndAssert(page, label) {
  const beforeText = await page.locator("#mpText").textContent();
  const beforeMp = Number.parseInt(beforeText, 10);
  assert.equal(Number.isFinite(beforeMp), true, `${label}: MP HUD was not numeric before Q`);

  await page.keyboard.press("q");
  await page.waitForFunction(previousMp => {
    const currentMp = Number.parseInt(document.querySelector("#mpText")?.textContent || "", 10);
    const cooldown = Number.parseFloat(document.querySelector("#strongCooldown")?.textContent || "0");
    return currentMp === previousMp - 20 && cooldown > 0;
  }, beforeMp, { timeout: 2000 });

  const afterMp = Number.parseInt(await page.locator("#mpText").textContent(), 10);
  const cooldown = Number.parseFloat(await page.locator("#strongCooldown").textContent());
  assert.equal(afterMp, beforeMp - 20, `${label}: Q did not consume warrior MP`);
  assert.equal(cooldown > 0, true, `${label}: Q cooldown did not start`);
}

async function fightCaptain(page, label) {
  let strongAttackObserved = false;
  let missed = 0;
  const deadline = Date.now() + 180000;
  for (let attempt = 0; Date.now() < deadline; attempt += 1) {
    const before = await page.evaluate(() => window.__volcanoSmokeRead());
    if (before.boss?.status === "defeated") break;
    assert.equal(before.mapId, "volcano-core-caldera", `${label}: left arena`);
    await qaApproachBoss(page);
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await page.waitForFunction(() => {
      const state = window.__volcanoSmokeRead();
      return !state.attacking && state.basicCooldown <= 0;
    }, null, { timeout: 3000 });
    const ready = await page.evaluate(() => window.__volcanoSmokeRead());
    if (ready.strongCooldown <= 0) {
      await pressStrongAndAssert(page, label);
      strongAttackObserved = true;
    } else {
      await page.keyboard.press("Control");
    }
    try {
      await page.waitForFunction(hp => window.__volcanoSmokeRead().boss?.hp < hp,
        before.boss.hp, { timeout: 1800 });
      missed = 0;
    } catch (error) {
      const state = await page.evaluate(() => window.__volcanoSmokeRead());
      console.error("VOLCANO_ATTACK_DIAGNOSTIC", JSON.stringify({ label, attempt, before, state }));
      if (++missed >= 3) throw error;
    }
  }
  await page.waitForFunction(() => {
    const state = window.__volcanoSmokeRead();
    return state.boss?.status === "defeated" && state.events.some(event =>
      event.type === "boss-defeated" && event.encounterId === state.boss.encounterId);
  }, null, { timeout: 3000 });
  await page.waitForFunction(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith("pixel-world.progress.v7:"));
    return key && JSON.parse(localStorage.getItem(key)).worldProgress.chapters.volcano.coopBossDefeated;
  }, null, { timeout: 3000 });
  assert.equal(strongAttackObserved, true, `${label}: no successful Q was observed`);
}

async function installCombatObserver(page) {
  await page.route("**/src/main-20260903-volcano.js", async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source + `
const smokeEvents = [];
const smokeHandleEvents = game.handleBossControllerEvents.bind(game);
game.handleBossControllerEvents = events => {
  smokeEvents.push(...structuredClone(events || []));
  return smokeHandleEvents(events);
};
window.__volcanoSmokeRead = () => ({
  mapId: game.mapId,
  player: { x: game.player.x, y: game.player.y, dir: game.player.dir, hp: game.player.hp },
  boss: structuredClone(game.coopBossController?.snapshot || null),
  view: (() => { const b = game.coopBossController?.renderableBoss(); return b ? { x: b.x, y: b.y, targetable: b.targetable } : null; })(),
  attacking: Boolean(game.attackState),
  basicCooldown: game.basicCooldown,
  strongCooldown: game.strongCooldown,
  events: structuredClone(smokeEvents),
});
` });
  });
}

async function completeNearbyInteraction(page) {
  await page.locator("#npcPrompt").waitFor({ state: "visible", timeout: 8000 });
  await page.keyboard.press("f");
  await page.locator("#dialogueOverlay").waitFor({ state: "visible" });
  await page.locator('[data-dialogue-action="story-complete"]').click();
  await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
}

async function collectCore(page, { prepareWeapons = false } = {}) {
  await walkAxis(page, "x", 1700);
  await walkAxis(page, "y", 780);
  await walkAxis(page, "x", 1600);
  await completeNearbyInteraction(page);
  if (prepareWeapons) await qaPrepareWeapons(page);
  await walkAxis(page, "y", 1230);
  await walkAxis(page, "x", 1080);
  await completeNearbyInteraction(page);
}

async function enterSanctuaryThroughPortal(page) {
  await qaTravel(page, "volcano-core-caldera", "화구 코어 제단");
  await walkAxis(page, "x", 500);
  await walkAxis(page, "y", 320);
  await walkAxis(page, "x", 1080);
  await walkAxis(page, "y", 148, "sanctuary");
  await expectMap(page, "픽셀 코어 성역 입구");
}

async function saveShot(page, filename) {
  if (!process.env.PIXEL_WORLD_SHOTS) return;
  await fs.mkdir(process.env.PIXEL_WORLD_SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(process.env.PIXEL_WORLD_SHOTS, filename) });
}

async function runRoute(browser, { nickname, prepared }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  try {
    await installCombatObserver(page);
    await page.goto(`${BASE_URL}?qa=1`, { waitUntil: "networkidle" });
    await enterSolo(page, nickname);
    await seedObservatoryCheckpoint(page, prepared);
    await reloadCheckpoint(page, nickname);
    await chooseRoute(page, prepared);
    await fightCaptain(page, prepared ? "rescue route" : "proceed route");
    await collectCore(page, { prepareWeapons: prepared });

    const beforeReload = await storedProgress(page);
    assert.equal(beforeReload.version, 7);
    await reloadCheckpoint(page, nickname);
    const loaded = await runtimeProgress(page, nickname);
    const volcano = loaded.worldProgress.chapters.volcano;
    assert.equal(volcano.routeDecision, prepared ? "rescue" : "proceed");
    assert.equal(volcano.eruptionTriggered, true);
    assert.equal(volcano.captainOutcome, prepared ? "rescued" : "lost");
    assert.equal(volcano.hiddenWeaponRewardClaimed, prepared);
    assert.equal(volcano.coreFragmentObtained, true);
    assert.equal(volcano.sanctuaryUnlocked, true);
    assert.match(await page.locator("#chapterObjective").textContent(), /픽셀 코어 성역/);
    for (const [classId, weaponId] of Object.entries(HIDDEN_WEAPONS)) {
      assert.equal(
        loaded.equipmentByClass[classId].ownedWeaponIds.includes(weaponId),
        prepared,
        `${classId} hidden ownership`,
      );
      assert.notEqual(
        loaded.equipmentByClass[classId].equippedWeaponId,
        weaponId,
        `${classId} hidden auto-equip`,
      );
    }
    assert.equal(loaded.equipmentByClass.warrior.equippedWeaponId, "reinforced-masterwork-katana");
    assert.equal(await page.locator('[data-inventory-weapon="volcanic-heartblade"]').count(), prepared ? 1 : 0);
    if (prepared) {
      assert.equal(await page.locator('[data-equip-weapon="volcanic-heartblade"]').isDisabled(), false);
    }
    await enterSanctuaryThroughPortal(page);
    await saveShot(page, prepared ? "volcano-rescue-sanctuary.png" : "volcano-proceed-sanctuary.png");
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    await runRoute(browser, { nickname: "화산구조브라우저", prepared: true });
    await runRoute(browser, { nickname: "화산일반브라우저", prepared: false });
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
