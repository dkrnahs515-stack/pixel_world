const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173";
const SHOT_DIR = path.resolve("test-results", "sanctuary-solo");
const DESKTOP = Object.freeze({ width: 1280, height: 720 });
const MOBILE = Object.freeze({ width: 390, height: 844 });
const DEFAULT_SANCTUARY = Object.freeze({
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
});
const ENDING_TITLES = Object.freeze({
  seal: "sanctuary-title-seal",
  restore: "sanctuary-title-restore",
  release: "sanctuary-title-release",
});
const MEMORY_ORDER = Object.freeze([
  "departure-bell",
  "dawn-bird",
  "tide-bell",
  "mine-shift-bell",
]);
const STORY_TARGETS = Object.freeze({
  "forest-core-casket": [780, 860],
  "coast-core-casket": [1080, 700],
  "volcano-core-casket": [1380, 860],
  "departure-bell": [560, 1240],
  "dawn-bird": [820, 820],
  "tide-bell": [1340, 820],
  "mine-shift-bell": [1600, 1240],
  "memory-sequence-console": [1080, 420],
  "truth-resonance-time": [560, 480],
  "truth-first-archivist-log": [1080, 660],
  "truth-core-self-division": [1600, 480],
  "false-return-garen-unscarred": [560, 1120],
  "false-return-source-erased": [1080, 1280],
  "false-return-resonance-time": [1600, 1120],
  "vanguard-return-state": [480, 520],
  "core-division-cause": [1080, 420],
  "delay-roan": [1680, 520],
  "delay-sera": [480, 1120],
  "delay-garen": [1080, 1220],
  "delay-lumen": [1680, 1120],
  "correction-link-console": [1080, 820],
  "future-testimony-roan": [520, 1080],
  "future-testimony-sera": [1080, 880],
  "future-testimony-garen": [1640, 1080],
  "future-testimony-lumen": [700, 1450],
  "future-testimony-echo": [1460, 1450],
  "future-preview-seal": [520, 560],
  "future-preview-restore": [1080, 420],
  "future-preview-release": [1640, 560],
  "sanctuary-ending-console": [1080, 1280],
});
const RECORD_ANSWERS = Object.freeze({
  "vanguard-return-state": "vanguard-partial-return-garen-scarred",
  "core-division-cause": "conflicting-records-self-division",
  "delay-roan": "roan-held-forest-route",
  "delay-sera": "sera-maintained-coast-signal",
  "delay-garen": "garen-delayed-volcano-collapse-scarred",
  "delay-lumen": "lumen-touched-seal-to-delay-division",
});
const CHORUS_ANCHORS = Object.freeze({
  forest: [700, 1120],
  coast: [1080, 1120],
  volcano: [1460, 1120],
});
const VERDICT_STATIONS = Object.freeze({
  fact: [700, 1120],
  partial: [1080, 1120],
  unsupported: [1340, 1120],
});
const TESTIMONY_VERDICTS = Object.freeze([
  ["core-self-division-original", "fact"],
  ["lumen-caused-core-division", "unsupported"],
  ["lumen-touched-seal-to-delay-eruption", "fact"],
  ["return-delay-was-lumen-alone", "unsupported"],
  ["first-archivist-deletion-protected-everyone", "partial"],
  ["resonance-time-was-incident-time", "unsupported"],
]);
const BONDS = Object.freeze([
  {
    id: "roan", station: [700, 620], attackPosition: [890, 790],
    safeApproach: [[1560, 1120], [1560, 430], [700, 430]],
  },
  {
    id: "sera", station: [1080, 560], attackPosition: [1080, 760],
    safeApproach: [[860, 430], [1080, 430]],
  },
  {
    id: "garen", station: [1460, 620], attackPosition: [1270, 790],
    safeApproach: [[1080, 430], [1460, 430]],
  },
  {
    id: "lumen", station: [1080, 1320], attackPosition: [1080, 1140],
    safeApproach: [[1560, 760], [1560, 1360], [1080, 1360]],
  },
]);
const SCENARIOS = Object.freeze([
  { classId: "warrior", captainOutcome: "rescued", ending: "seal", viewport: DESKTOP },
  { classId: "warrior", captainOutcome: "lost", ending: "restore", viewport: MOBILE },
  { classId: "archer", captainOutcome: "rescued", ending: "release", viewport: DESKTOP },
  { classId: "archer", captainOutcome: "lost", ending: "seal", viewport: MOBILE },
  { classId: "mage", captainOutcome: "rescued", ending: "restore", viewport: DESKTOP },
  { classId: "mage", captainOutcome: "lost", ending: "release", viewport: MOBILE, splitSaveFailure: true },
]);

function slugFor(scenario) {
  return `${scenario.viewport.width}x${scenario.viewport.height}-${scenario.classId}-${scenario.captainOutcome}`;
}

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

async function readState(page) {
  return page.evaluate(() => window.__sanctuarySmokeRead());
}

async function installReadOnlyObserver(page) {
  await page.route("**/src/main-20260911-story.js", async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source + `
window.__sanctuarySmokeRead = () => ({
  running: game.running,
  inputEnabled: game.inputEnabled,
  classId: game.classId,
  mapId: game.mapId,
  player: {
    x: game.player.x,
    y: game.player.y,
    dir: game.player.dir,
    hp: game.player.hp,
    respawnTimer: game.player.respawnTimer,
  },
  progress: structuredClone(game.progress),
  nearbyStoryId: game.nearbyStoryInteraction?.id || null,
  nearbyChorus: game.nearbyChorusInteraction ? structuredClone(game.nearbyChorusInteraction) : null,
  pendingRewardChoice: game.pendingSanctuaryRewardChoice,
  chorus: game.chorusController ? {
    shared: structuredClone(game.chorusController.snapshot),
    personal: structuredClone(game.chorusController.personalSnapshot),
    claims: structuredClone(game.chorusController.completionClaims),
    render: structuredClone(game.chorusController.renderModel?.() || null),
    canAttack: game.chorusController.canAttack?.(Date.now()) !== false,
  } : null,
});
` });
  });
}

async function enterSolo(page, nickname, classId) {
  await page.locator("#rpgExperienceButton").click();
  await page.locator("#entryOverlay").waitFor({ state: "visible" });
  await page.locator("#nicknameInput").fill(nickname);
  await page.locator(`[data-class-id="${classId}"]`).click();
  await page.locator('[data-play-mode="solo"]').click();
  await page.locator("#enterButton").click();
  await waitForPlayable(page);
  await page.waitForFunction(expectedClass => window.__sanctuarySmokeRead().classId === expectedClass, classId);
}

async function seedPriorChapterFixture(page, captainOutcome) {
  await page.evaluate(outcome => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith("pixel-world.progress.v8:"));
    if (!key) throw new Error("v8 progress checkpoint is missing");
    const value = JSON.parse(localStorage.getItem(key));
    const rescued = outcome === "rescued";
    const hiddenWeapons = {
      warrior: "volcanic-heartblade",
      archer: "ember-tracker-bow",
      mage: "leyflame-core-staff",
    };
    if (rescued) {
      for (const [classId, weaponId] of Object.entries(hiddenWeapons)) {
        value.equipmentByClass[classId].ownedWeaponIds = [
          ...new Set([...value.equipmentByClass[classId].ownedWeaponIds, weaponId]),
        ];
      }
    }
    const sanctuary = {
      activatedCoreIds: [], collectedMemoryIds: [], memorySequence: [], memoryOrderSolved: false,
      coreTruthRevealed: false, falseReturnRejected: false, completedRecordFieldIds: [],
      correctionLinked: false, chorusSeparated: false, collectedTestimonyIds: [],
      previewedFutureIds: [], endingChoice: null, completed: false,
    };
    const fixture = {
      ...value,
      level: 1, exp: 0, nextLevelExp: 100, gold: 0,
      earnedTitleIds: [], claimedNarrativeRewardIds: [], claimedBossRewardIds: [],
      worldProgress: {
        unlockedRegionIds: ["village", "forest", "coast", "volcano", "sanctuary"],
        completedRegionIds: ["coast", "volcano"],
        unlockedMapIds: [
          "village", "forest",
          "coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave",
          "volcano", "volcano-magma-route", "volcano-observatory", "volcano-core-caldera",
          "sanctuary",
        ],
        chapters: {
          coast: {
            repairedDeviceIds: [], collectedRecordIds: [], supportChoice: null,
            seraRescued: true, coopBossDefeated: true, coreFragmentObtained: true, shortcutUnlocked: true,
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
            coolantAnchorIds: rescued
              ? ["ash-gate-coolant-anchor", "magma-route-coolant-anchor", "observatory-coolant-anchor"]
              : [],
            routeDecision: rescued ? "rescue" : "proceed",
            eruptionTriggered: true, coopBossDefeated: true, captainOutcome: outcome,
            hiddenWeaponRewardClaimed: rescued, coreFragmentObtained: true, sanctuaryUnlocked: true,
          },
          sanctuary,
        },
      },
    };
    localStorage.setItem(key, JSON.stringify(fixture));
  }, captainOutcome);
}

async function storedProgress(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith("pixel-world.progress.v8:"));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
}

async function reloadAndEnter(page, nickname, classId) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await enterSolo(page, nickname, classId);
}

async function qaTravel(page, mapId, expectedName) {
  await page.locator("#qaButton").click();
  await page.locator(`[data-qa-world="${mapId}"]`).click();
  await page.locator(".player-header small").filter({ hasText: expectedName }).waitFor({ timeout: 10000 });
  await page.waitForFunction(expectedMap => window.__sanctuarySmokeRead().mapId === expectedMap, mapId);
}

async function walkAxis(page, axis, target, expectedMap = null) {
  await page.waitForFunction(() => {
    const state = window.__sanctuarySmokeRead();
    return state.running && state.inputEnabled
      && !document.querySelector("#portalTransitionOverlay:not([hidden])")
      && !document.querySelector("#dialogueOverlay:not([hidden]), #endingOverlay:not([hidden])");
  }, null, { timeout: 10000 });
  const initial = await readState(page);
  const mapId = initial.mapId;
  const direction = Math.sign(target - initial.player[axis]);
  if (!direction) return;
  const key = axis === "x"
    ? (direction > 0 ? "ArrowRight" : "ArrowLeft")
    : (direction > 0 ? "ArrowDown" : "ArrowUp");
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis: movedAxis, target: destination, direction: sign, mapId: originMap, expectedMap: destinationMap }) => {
      const state = window.__sanctuarySmokeRead();
      if (state.mapId !== originMap) {
        if (state.mapId === destinationMap) return true;
        throw new Error(`Unexpected map during movement: ${state.mapId}`);
      }
      return sign * (state.player[movedAxis] - destination) >= -5;
    }, { axis, target, direction, mapId, expectedMap }, { timeout: 30000 });
  } catch (error) {
    console.error("SANCTUARY_MOVEMENT_DIAGNOSTIC", JSON.stringify({
      axis, target, initial, current: await readState(page),
    }));
    throw error;
  } finally {
    await page.keyboard.up(key);
  }
}

async function walkTo(page, x, y, options = {}) {
  const order = options.order || ["x", "y"];
  for (const axis of order) {
    await walkAxis(page, axis, axis === "x" ? x : y, options.expectedMap || null);
    if ((await readState(page)).mapId === options.expectedMap) return;
  }
}

async function approachStory(page, interactionId) {
  const [x, y] = STORY_TARGETS[interactionId];
  await walkTo(page, x, y);
  await page.waitForFunction(expected => window.__sanctuarySmokeRead().nearbyStoryId === expected,
    interactionId, { timeout: 5000 });
  await page.locator("#npcPrompt").waitFor({ state: "visible" });
}

async function pressDialogueAction(page, actionId) {
  const button = page.locator(`[data-dialogue-action="${actionId}"]`);
  await button.waitFor({ state: "visible" });
  await button.focus();
  await page.keyboard.press("Enter");
}

async function completeStory(page, interactionId, actionId = "story-complete") {
  await approachStory(page, interactionId);
  await interact(page);
  await page.locator("#dialogueOverlay").waitFor({ state: "visible" });
  await pressDialogueAction(page, actionId);
  await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
}

function rectanglesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function dismissQuestBanners(page) {
  const banner = page.locator(".quest-banner:not(.hidden)");
  for (let index = 0; index < 100 && await banner.isVisible().catch(() => false); index += 1) {
    const button = banner.locator('button[aria-label="퀘스트 알림 닫기"]');
    await button.click();
  }
  await banner.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  assert.equal(await banner.isVisible().catch(() => false), false,
    "quest banner queue did not close through visible browser input");
}

async function assertHudLayout(page, label) {
  await dismissQuestBanners(page);
  const layout = await page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector);
      if (!element || element.hidden || getComputedStyle(element).display === "none") return null;
      const rect = element.getBoundingClientRect();
      return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return {
      width: innerWidth,
      height: innerHeight,
      panels: [".player-panel", ".minimap", "#chorusHud", "#questTracker", ".controls"].map(box).filter(Boolean),
      hotbar: box(".hotbar"),
    };
  });
  assert.ok(layout.hotbar, `${label}: hotbar is not visible`);
  const viewport = { left: 0, top: 0, right: layout.width, bottom: layout.height };
  for (const panel of [...layout.panels, layout.hotbar]) {
    assert.equal(panel.left >= -1 && panel.top >= -1 && panel.right <= layout.width + 1 && panel.bottom <= layout.height + 1,
      true, `${label}: ${panel.selector} leaves the viewport`);
  }
  const corridor = layout.width <= 520
    ? {
      left: layout.width * 0.15,
      right: layout.width * 0.85,
      top: layout.height * 0.45,
      bottom: layout.height * 0.70,
    }
    : {
      left: layout.width * 0.30,
      right: layout.width * 0.70,
      top: layout.height * 0.43,
      bottom: layout.height * 0.70,
    };
  assert.equal(corridor.bottom > corridor.top && corridor.right > corridor.left, true,
    `${label}: invalid fixed central and lower-middle playfield region`);
  for (const panel of layout.panels) {
    assert.equal(rectanglesOverlap(panel, corridor), false,
      `${label}: ${panel.selector} covers the central battlefield or lower movement axis`);
  }
  assert.equal(rectanglesOverlap(layout.hotbar, corridor), false,
    `${label}: hotbar covers the lower movement approach`);
  assert.equal(rectanglesOverlap(viewport, corridor), true, `${label}: invalid battlefield corridor`);
}

async function saveShot(page, scenario, name) {
  await dismissQuestBanners(page);
  const message = page.locator("#message.show");
  if (await message.isVisible().catch(() => false)) {
    await message.waitFor({ state: "hidden", timeout: 3000 });
  }
  await fs.mkdir(SHOT_DIR, { recursive: true });
  const filename = `${slugFor(scenario)}-${name}.png`;
  const filenamePath = path.join(SHOT_DIR, filename);
  await page.screenshot({ path: filenamePath });
  const stat = await fs.stat(filenamePath);
  assert.ok(stat.size > 1000, `${filename} is empty`);
  return { filename, path: filenamePath, bytes: stat.size };
}

async function enterSanctuaryWithRealMovement(page) {
  await qaTravel(page, "volcano-core-caldera", "화구 코어 제단");
  await walkAxis(page, "x", 500);
  await walkAxis(page, "y", 320);
  await walkAxis(page, "x", 1080);
  await walkAxis(page, "y", 148, "sanctuary");
  await page.waitForFunction(() => window.__sanctuarySmokeRead().mapId === "sanctuary");
}

async function completeEntrance(page, scenario, screenshots) {
  await walkTo(page, 1080, 700);
  await assertHudLayout(page, `${slugFor(scenario)} entrance`);
  screenshots.push(await saveShot(page, scenario, "entrance-three-caskets"));
  for (const coreId of ["forest-core-casket", "coast-core-casket", "volcano-core-casket"]) {
    await completeStory(page, coreId);
    await page.waitForFunction(expected => {
      const chapter = window.__sanctuarySmokeRead().progress.worldProgress.chapters.sanctuary;
      return chapter.activatedCoreIds.includes(expected);
    }, coreId);
  }
  const chapter = (await readState(page)).progress.worldProgress.chapters.sanctuary;
  assert.deepEqual(chapter.activatedCoreIds, ["forest-core-casket", "coast-core-casket", "volcano-core-casket"]);
  await walkTo(page, 1080, 148, { expectedMap: "sanctuary-memory-archive" });
  await page.waitForFunction(() => window.__sanctuarySmokeRead().mapId === "sanctuary-memory-archive");
}

async function completeMemoryArchive(page, scenario, screenshots) {
  for (const memoryId of MEMORY_ORDER) {
    await completeStory(page, memoryId);
    await page.waitForFunction(expected => window.__sanctuarySmokeRead()
      .progress.worldProgress.chapters.sanctuary.collectedMemoryIds.includes(expected), memoryId);
  }

  await approachStory(page, "memory-sequence-console");
  await interact(page);
  const wrongOrder = ["dawn-bird", "departure-bell", "tide-bell", "mine-shift-bell"];
  for (const memoryId of wrongOrder) await pressDialogueAction(page, `story-memory-add-${memoryId}`);
  await pressDialogueAction(page, "story-memory-submit");
  await page.locator("#dialogueBody").filter({ hasText: "소리 순서가 맞지 않습니다" }).waitFor();
  let chapter = (await readState(page)).progress.worldProgress.chapters.sanctuary;
  assert.equal(chapter.memoryOrderSolved, false);
  assert.deepEqual(chapter.memorySequence, []);
  screenshots.push(await saveShot(page, scenario, "memory-sequence-error"));

  for (const memoryId of MEMORY_ORDER) await pressDialogueAction(page, `story-memory-add-${memoryId}`);
  await pressDialogueAction(page, "story-memory-submit");
  await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
  await page.waitForFunction(() => window.__sanctuarySmokeRead()
    .progress.worldProgress.chapters.sanctuary.memoryOrderSolved === true);

  await completeStory(page, "truth-resonance-time");
  await completeStory(page, "truth-first-archivist-log");
  await completeStory(page, "truth-core-self-division");
  await page.waitForFunction(() => window.__sanctuarySmokeRead()
    .progress.worldProgress.chapters.sanctuary.coreTruthRevealed === true);
  for (const contradictionId of [
    "false-return-garen-unscarred",
    "false-return-source-erased",
    "false-return-resonance-time",
  ]) await completeStory(page, contradictionId);
  await page.waitForFunction(() => window.__sanctuarySmokeRead()
    .progress.worldProgress.chapters.sanctuary.falseReturnRejected === true);
  chapter = (await readState(page)).progress.worldProgress.chapters.sanctuary;
  assert.deepEqual(chapter.memorySequence, MEMORY_ORDER);
  assert.equal(chapter.collectedMemoryIds.length, 7);

  await walkTo(page, 1080, 148, { expectedMap: "sanctuary-return-record" });
  await page.waitForFunction(() => window.__sanctuarySmokeRead().mapId === "sanctuary-return-record");
}

async function completeCorrection(page, scenario, screenshots) {
  const wrongField = "vanguard-return-state";
  await approachStory(page, wrongField);
  await interact(page);
  await pressDialogueAction(page, "story-record-answer-vanguard-returned-unharmed");
  assert.equal((await readState(page)).progress.worldProgress.chapters.sanctuary.completedRecordFieldIds.length, 0);
  assert.equal(await page.locator("#dialogueOverlay").isVisible(), true);
  await pressDialogueAction(page, `story-record-answer-${RECORD_ANSWERS[wrongField]}`);
  await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });

  for (const fieldId of Object.keys(RECORD_ANSWERS).filter(id => id !== wrongField)) {
    await completeStory(page, fieldId, `story-record-answer-${RECORD_ANSWERS[fieldId]}`);
  }
  await page.waitForFunction(() => window.__sanctuarySmokeRead()
    .progress.worldProgress.chapters.sanctuary.completedRecordFieldIds.length === 6);
  await completeStory(page, "correction-link-console");
  await page.waitForFunction(() => window.__sanctuarySmokeRead()
    .progress.worldProgress.chapters.sanctuary.correctionLinked === true);
  const state = await readState(page);
  const chapter = state.progress.worldProgress.chapters.sanctuary;
  assert.equal(chapter.coreTruthRevealed, true);
  assert.equal(chapter.falseReturnRejected, true);
  assert.deepEqual(chapter.memorySequence, MEMORY_ORDER);
  assert.deepEqual(chapter.completedRecordFieldIds, Object.keys(RECORD_ANSWERS));
  assert.equal(state.chorus.shared?.phase, "anchors");
  assert.deepEqual(state.chorus.claims, {});
  await assertHudLayout(page, `${slugFor(scenario)} correction`);
  screenshots.push(await saveShot(page, scenario, "correction-linked"));
}

async function face(page, key) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(directionKey => {
      const current = window.__sanctuarySmokeRead().player;
      const expected = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[directionKey];
      return current.dir === expected;
    }, key, { timeout: 2000 });
  } finally {
    await page.keyboard.up(key);
  }
}

async function carryNextFragment(page) {
  await walkTo(page, 1080, 890);
  await face(page, "ArrowUp");
  const before = (await readState(page)).chorus.shared.stabilizedAnchorIds.length;
  await attackCycle(page);
  await page.waitForFunction(expectedCount => {
    const state = window.__sanctuarySmokeRead();
    return state.chorus.personal.carriedFragmentId
      && state.chorus.shared.stabilizedAnchorIds.length === expectedCount;
  }, before, { timeout: 5000 });
  return (await readState(page)).chorus.personal.carriedFragmentId;
}

async function placeFragment(page, anchorId) {
  const [x, y] = CHORUS_ANCHORS[anchorId];
  await walkTo(page, x, y);
  await page.waitForFunction(expected => window.__sanctuarySmokeRead().nearbyChorus?.anchorId === expected,
    anchorId, { timeout: 5000 });
  await page.keyboard.press("KeyF");
  await page.waitForFunction(expected => window.__sanctuarySmokeRead()
    .chorus.shared.stabilizedAnchorIds.includes(expected), anchorId);
}

async function exerciseOverloadAndAnchors(page, scenario, screenshots) {
  const fragmentId = await carryNextFragment(page);
  assert.equal(fragmentId, "forest");
  await walkTo(page, ...CHORUS_ANCHORS.coast);
  for (let expected = 10; expected <= 90; expected += 10) {
    await page.keyboard.press("KeyF");
    await page.waitForFunction(value => window.__sanctuarySmokeRead().chorus.personal.contamination === value,
      expected);
  }
  await page.keyboard.press("KeyF");
  await page.waitForFunction(() => {
    const personal = window.__sanctuarySmokeRead().chorus.personal;
    return personal.contamination === 50 && personal.carriedFragmentId === null
      && personal.attackLockedUntil > Date.now() && personal.movementSlowUntil > Date.now();
  });
  await walkTo(page, 1080, 890);
  await face(page, "ArrowUp");
  await page.keyboard.press("Control");
  assert.equal((await readState(page)).chorus.personal.carriedFragmentId, null,
    "overload lock accepted an attack");
  await page.waitForFunction(() => window.__sanctuarySmokeRead().chorus.canAttack, null, { timeout: 5000 });

  if (scenario.captainOutcome === "rescued") {
    await walkTo(page, ...CHORUS_ANCHORS.forest);
    await page.waitForFunction(() => window.__sanctuarySmokeRead().nearbyChorus?.type === "lumen-assist");
    await page.keyboard.press("KeyF");
    await page.waitForFunction(() => {
      const shared = window.__sanctuarySmokeRead().chorus.shared;
      return shared.lumenAssistUsed && shared.stabilizedAnchorIds.includes("forest");
    });
  } else {
    assert.equal(await carryNextFragment(page), "forest");
    await placeFragment(page, "forest");
  }
  await assertHudLayout(page, `${slugFor(scenario)} anchors`);
  screenshots.push(await saveShot(page, scenario, "chorus-anchors"));

  for (const anchorId of ["coast", "volcano"]) {
    assert.equal(await carryNextFragment(page), anchorId);
    await placeFragment(page, anchorId);
  }
  await page.waitForFunction(() => window.__sanctuarySmokeRead().chorus.shared.phase === "testimonies");
  if (scenario.captainOutcome === "rescued") {
    await page.locator("#dialogueOverlay").waitFor({ state: "visible" });
    assert.match(await page.locator("#dialogueBody").textContent(), /루멘/);
    await page.keyboard.press("KeyF");
    await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
  } else {
    assert.equal(await page.locator("#dialogueOverlay").isVisible(), false);
  }
}

async function resolveTestimonies(page, scenario, screenshots) {
  await walkTo(page, ...VERDICT_STATIONS.partial);
  await page.waitForFunction(() => window.__sanctuarySmokeRead().nearbyChorus?.type === "testimony");
  const contaminationBefore = (await readState(page)).chorus.personal.contamination;
  await page.keyboard.press("KeyF");
  await page.waitForFunction(previous => window.__sanctuarySmokeRead().chorus.personal.contamination === previous + 10,
    contaminationBefore);

  for (let index = 0; index < TESTIMONY_VERDICTS.length; index += 1) {
    const [testimonyId, verdict] = TESTIMONY_VERDICTS[index];
    await walkTo(page, ...VERDICT_STATIONS[verdict]);
    await page.waitForFunction(expected => {
      const nearby = window.__sanctuarySmokeRead().nearbyChorus;
      return nearby?.type === "testimony" && nearby.testimonyId === expected;
    }, testimonyId);
    await page.keyboard.press("KeyF");
    await page.waitForFunction(expected => window.__sanctuarySmokeRead()
      .chorus.shared.resolvedTestimonyIds.includes(expected), testimonyId);
    if (index === 0) {
      await walkTo(page, 1080, 820);
      await assertHudLayout(page, `${slugFor(scenario)} testimonies`);
      screenshots.push(await saveShot(page, scenario, "chorus-testimonies"));
    }
  }
  await page.waitForFunction(() => window.__sanctuarySmokeRead().chorus.shared.phase === "onslaught");
}

async function escapeTelegraph(page, scenario, screenshots) {
  await page.waitForFunction(() => window.__sanctuarySmokeRead().chorus.render?.telegraph?.sharedId === "forest-roots");
  await walkTo(page, 1240, 1120);
  const hpBefore = (await readState(page)).player.hp;
  await assertHudLayout(page, `${slugFor(scenario)} telegraph`);
  screenshots.push(await saveShot(page, scenario, "chorus-telegraph"));
  await walkAxis(page, "x", 1310);
  await page.waitForFunction(() => {
    const telegraph = window.__sanctuarySmokeRead().chorus.render?.telegraph;
    return !telegraph || telegraph.sharedId !== "forest-roots";
  }, null, { timeout: 3000 });
  assert.equal((await readState(page)).player.hp, hpBefore, "telegraph escape still took damage");
}

async function waitForPatternRecovery(page) {
  await page.waitForFunction(() => {
    const telegraph = window.__sanctuarySmokeRead().chorus.render?.telegraph;
    const now = Date.now();
    return telegraph && now >= telegraph.impactAt && now <= telegraph.endsAt;
  }, null, { timeout: 3000 });
}

async function separateChorus(page, scenario, screenshots) {
  for (const { id: bondId, station, attackPosition, safeApproach } of BONDS) {
    console.log(`[sanctuary-smoke] BOND ${slugFor(scenario)} ${bondId}`);
    for (const waypoint of safeApproach) await walkTo(page, ...waypoint);
    await walkTo(page, ...station);
    await page.waitForFunction(expected => {
      const nearby = window.__sanctuarySmokeRead().nearbyChorus;
      return nearby?.type === "record" && nearby.recordId === expected;
    }, bondId, { timeout: 5000 });
    await page.keyboard.press("KeyF");
    await page.waitForFunction(expected => window.__sanctuarySmokeRead().chorus.shared.activeRecordId === expected,
      bondId);
    await waitForPatternRecovery(page);
    await walkTo(page, ...attackPosition);
    await face(page, "ArrowUp");
    await page.keyboard.press("Control");
    await page.waitForFunction(expected => window.__sanctuarySmokeRead()
      .chorus.shared.severedBondIds.includes(expected), bondId, { timeout: 4000 });
  }
  await page.waitForFunction(() => {
    const state = window.__sanctuarySmokeRead();
    return state.chorus.shared.status === "separated"
      && state.chorus.shared.phase === "separated"
      && state.progress.worldProgress.chapters.sanctuary.chorusSeparated === true;
  });
  const state = await readState(page);
  assert.equal(state.chorus.shared.hp, 0);
  assert.equal(state.player.hp > 0, true);
  assert.deepEqual(state.progress.claimedBossRewardIds, []);
  assert.deepEqual(state.chorus.claims["local-player"], {
    encounterId: state.chorus.shared.encounterId,
    uid: "local-player",
    eligible: true,
    createdAt: state.chorus.claims["local-player"].createdAt,
  });
  assert.equal(state.chorus.render.separatedFragments.length, 3);
  await assertHudLayout(page, `${slugFor(scenario)} separated`);
  screenshots.push(await saveShot(page, scenario, "chorus-separated"));
}

async function finishThreeFutures(page) {
  await walkTo(page, 1080, 148, { expectedMap: "sanctuary-three-futures" });
  await page.waitForFunction(() => window.__sanctuarySmokeRead().mapId === "sanctuary-three-futures");
  for (const testimonyId of ["roan", "sera", "garen", "lumen", "echo"]) {
    await completeStory(page, `future-testimony-${testimonyId}`);
  }
  for (const futureId of ["seal", "restore", "release"]) {
    await completeStory(page, `future-preview-${futureId}`);
  }
  const chapter = (await readState(page)).progress.worldProgress.chapters.sanctuary;
  assert.deepEqual(chapter.collectedTestimonyIds, ["roan", "sera", "garen", "lumen", "echo"]);
  assert.deepEqual(chapter.previewedFutureIds, ["seal", "restore", "release"]);
}

async function installSplitSaveFailure(page, choice) {
  await page.evaluate(expectedChoice => {
    const original = Storage.prototype.setItem;
    let choiceSaved = false;
    let thrown = false;
    window.__restoreSanctuarySetItem = () => {
      Storage.prototype.setItem = original;
      return { choiceSaved, thrown };
    };
    Storage.prototype.setItem = function(key, value) {
      if (this === localStorage && choiceSaved && !thrown && String(key).startsWith("pixel-world.progress.v8:")) {
        thrown = true;
        throw new DOMException("intentional reward save failure", "QuotaExceededError");
      }
      const result = original.call(this, key, value);
      if (this === localStorage && String(key).startsWith("pixel-world.progress.v8:")) {
        try {
          const parsed = JSON.parse(value);
          const chapter = parsed.worldProgress?.chapters?.sanctuary;
          const rewards = parsed.claimedNarrativeRewardIds || [];
          if (chapter?.endingChoice === expectedChoice
            && !rewards.some(id => id.startsWith(`sanctuary-ending-${expectedChoice}-`))) {
            choiceSaved = true;
          }
        } catch {
          // Only the valid progress payload can arm this one-shot fault.
        }
      }
      return result;
    };
  }, choice);
}

async function restoreSplitSaveFailure(page) {
  return page.evaluate(() => window.__restoreSanctuarySetItem?.());
}

async function deferReloadAndChooseEnding(page, scenario, nickname, screenshots) {
  await approachStory(page, "sanctuary-ending-console");
  await interact(page);
  await page.waitForFunction(() => document.querySelector("#endingOverlay")?.dataset.view === "first-confirmation");
  await page.keyboard.press("Escape");
  await page.locator("#endingOverlay").waitFor({ state: "hidden" });
  assert.equal((await readState(page)).progress.worldProgress.chapters.sanctuary.endingChoice, null);

  await reloadAndEnter(page, nickname, scenario.classId);
  await qaTravel(page, "sanctuary-three-futures", "세 개의 미래");
  await approachStory(page, "sanctuary-ending-console");
  await interact(page);
  await page.waitForFunction(() => document.querySelector("#endingOverlay")?.dataset.view === "first-confirmation");
  if (scenario.splitSaveFailure) await installSplitSaveFailure(page, scenario.ending);

  const choiceButton = page.locator(`[data-ending-choice="${scenario.ending}"]`);
  await choiceButton.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#endingOverlay")?.dataset.view === "second-confirmation");
  await page.locator("#endingConfirmButton").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(expected => {
    const state = window.__sanctuarySmokeRead();
    return state.progress.worldProgress.chapters.sanctuary.endingChoice === expected
      && document.querySelector("#endingOverlay")?.dataset.view === "cutscene";
  }, scenario.ending);

  if (scenario.splitSaveFailure) {
    await page.waitForFunction(expected => {
      const state = window.__sanctuarySmokeRead();
      return state.pendingRewardChoice === expected
        && state.progress.claimedNarrativeRewardIds.length === 0;
    }, scenario.ending);
    const storedChoice = await storedProgress(page);
    assert.equal(storedChoice.worldProgress.chapters.sanctuary.endingChoice, scenario.ending);
    assert.deepEqual(storedChoice.claimedNarrativeRewardIds, []);
    assert.equal(storedChoice.gold, 0);
    assert.deepEqual(storedChoice.earnedTitleIds, []);
    assert.match(await page.locator("#endingRewardStatus").textContent(), /다시 시도/);
    assert.deepEqual(await restoreSplitSaveFailure(page), { choiceSaved: true, thrown: true });
    await page.keyboard.press("KeyF");
  }

  await page.waitForFunction(expected => {
    const progress = window.__sanctuarySmokeRead().progress;
    return progress.worldProgress.chapters.sanctuary.endingChoice === expected
      && progress.claimedNarrativeRewardIds.length === 3
      && progress.earnedTitleIds.length === 1
      && progress.gold === 200;
  }, scenario.ending);
  const final = await readState(page);
  assert.equal(final.progress.level, 3, "EXP 300 should advance the default level 1 fixture to level 3");
  assert.equal(final.progress.exp, 0, "EXP 300 should leave zero carried EXP at level 3");
  assert.equal(final.progress.nextLevelExp, 300);
  assert.equal(final.progress.gold, 200);
  assert.deepEqual(final.progress.earnedTitleIds, [ENDING_TITLES[scenario.ending]]);
  assert.deepEqual(final.progress.claimedNarrativeRewardIds, [
    `sanctuary-ending-${scenario.ending}-exp`,
    `sanctuary-ending-${scenario.ending}-gold`,
    `sanctuary-ending-${scenario.ending}-title`,
  ]);
  screenshots.push(await saveShot(page, scenario, `ending-${scenario.ending}`));

  const beforeRetry = await storedProgress(page);
  await page.keyboard.press("KeyF");
  assert.deepEqual(await storedProgress(page), beforeRetry, "completed ending recovery was not idempotent");
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext({ viewport: scenario.viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const screenshots = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const nickname = `${scenario.classId.slice(0, 2)}${scenario.captainOutcome === "rescued" ? "구조" : "상실"}${scenario.ending}`;
  try {
    await installReadOnlyObserver(page);
    await page.goto(`${BASE_URL}?qa=1`, { waitUntil: "domcontentloaded" });
    await enterSolo(page, nickname, scenario.classId);
    await seedPriorChapterFixture(page, scenario.captainOutcome);
    await reloadAndEnter(page, nickname, scenario.classId);

    const initial = await readState(page);
    assert.deepEqual(initial.progress.worldProgress.chapters.sanctuary, DEFAULT_SANCTUARY,
      `${slugFor(scenario)} fixture pre-completed sanctuary state`);
    assert.equal(initial.chorus.shared, null);
    assert.deepEqual(initial.chorus.claims, {});
    assert.equal(initial.progress.level, 1);
    assert.equal(initial.progress.exp, 0);
    assert.equal(initial.progress.gold, 0);
    assert.deepEqual(initial.progress.earnedTitleIds, []);
    assert.deepEqual(initial.progress.claimedNarrativeRewardIds, []);

    await enterSanctuaryWithRealMovement(page);
    await completeEntrance(page, scenario, screenshots);
    await completeMemoryArchive(page, scenario, screenshots);
    await completeCorrection(page, scenario, screenshots);
    await exerciseOverloadAndAnchors(page, scenario, screenshots);
    await resolveTestimonies(page, scenario, screenshots);
    await escapeTelegraph(page, scenario, screenshots);
    await separateChorus(page, scenario, screenshots);
    await finishThreeFutures(page);
    await deferReloadAndChooseEnding(page, scenario, nickname, screenshots);

    const stored = await storedProgress(page);
    assert.equal(stored.worldProgress.chapters.sanctuary.completed, true);
    assert.equal(stored.worldProgress.chapters.sanctuary.endingChoice, scenario.ending);
    assert.equal(screenshots.length, 8);
    assert.deepEqual(pageErrors, [], `${slugFor(scenario)} page errors`);
    assert.deepEqual(consoleErrors, [], `${slugFor(scenario)} console errors`);
    return { scenario: slugFor(scenario), ending: scenario.ending, screenshots, pageErrors, consoleErrors };
  } finally {
    if (scenario.splitSaveFailure) await restoreSplitSaveFailure(page).catch(() => {});
    await context.close();
  }
}

(async () => {
  await fs.mkdir(SHOT_DIR, { recursive: true });
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const results = [];
  const requestedScenario = process.env.SANCTUARY_SMOKE_SCENARIO;
  const scenarios = requestedScenario
    ? SCENARIOS.filter(scenario => slugFor(scenario) === requestedScenario)
    : SCENARIOS;
  assert.ok(scenarios.length > 0, `Unknown SANCTUARY_SMOKE_SCENARIO: ${requestedScenario}`);
  try {
    for (const scenario of scenarios) {
      console.log(`[sanctuary-smoke] RUN ${slugFor(scenario)}`);
      results.push(await runScenario(browser, scenario));
      console.log(`[sanctuary-smoke] PASS ${slugFor(scenario)}`);
    }
  } finally {
    await browser.close();
  }
  const screenshots = results.flatMap(result => result.screenshots);
  assert.equal(screenshots.length, scenarios.length * 8);
  console.log(JSON.stringify({
    status: "PASS",
    scenarios: results.map(({ scenario, ending, pageErrors, consoleErrors }) => ({
      scenario, ending, pageErrors, consoleErrors,
    })),
    screenshots: screenshots.map(({ filename, bytes }) => ({ filename, bytes })),
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
