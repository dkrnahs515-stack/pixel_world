const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const { initializeApp, deleteApp } = require("firebase/app");
const { connectAuthEmulator, getAuth, signInAnonymously, signOut } = require("firebase/auth");
const { connectDatabaseEmulator, get, getDatabase, goOffline, ref } = require("firebase/database");

const BASE_URL = process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173";
const FIREBASE_VERSION = "12.16.0";
const FIREBASE_DATABASE_NAMESPACE = "pixel-world-8cb9b-default-rtdb";
const ACTIVE_FIREBASE_CONFIG_PATH = path.resolve(
  "src/firebase-config-20260905-upgrade-20260911-sanctuary.js",
);
const CHORUS_PATH = "rooms/public/chorus/sanctuary-return-record";
const SHOT_DIR = path.resolve("test-results", "sanctuary-network");
const DEFAULT_SANCTUARY = Object.freeze({
  activatedCoreIds: [],
  collectedMemoryIds: [],
  memorySequence: [],
  memoryOrderSolved: false,
  coreTruthRevealed: false,
  examinedTruthRecordIds: [],
  falseReturnRejected: false,
  completedRecordFieldIds: [],
  correctionLinked: false,
  chorusSeparated: false,
  collectedTestimonyIds: [],
  previewedFutureIds: [],
  endingChoice: null,
  completed: false,
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
const BONDS = Object.freeze({
  roan: {
    station: [700, 620], attackPosition: [890, 760],
    safeApproach: [[1560, 1120], [1560, 430], [700, 430]],
    safeEscape: [[600, 790], [600, 430], [1560, 430], [1560, 1360]],
  },
  sera: {
    station: [1080, 560], attackPosition: [1080, 730],
    safeApproach: [[1560, 430], [1080, 430]],
    safeEscape: [[1560, 760], [1560, 1360]],
  },
  garen: {
    station: [1460, 620], attackPosition: [1270, 760],
    safeApproach: [[1560, 430], [1460, 430]],
    safeEscape: [[1560, 790], [1560, 1360]],
  },
  lumen: {
    station: [1080, 1320], attackPosition: [1080, 1110],
    safeApproach: [[1560, 760], [1560, 1360], [1080, 1360]],
  },
});
const REQUIRED_CONTRIBUTION_TYPES = Object.freeze([
  "fragment-strike",
  "anchor-stabilize",
  "testimony-resolve",
  "record-activate",
  "bond-cut",
]);
const ATTACK_KEYS = Object.freeze(["Control", "KeyQ", "KeyE", "KeyR"]);

function redactUid(uid) {
  return typeof uid === "string" && uid.length > 8
    ? `${uid.slice(0, 4)}...${uid.slice(-4)}`
    : "<redacted>";
}

function observeDiagnostics(page, label) {
  const diagnostics = {
    label,
    pageErrors: [],
    consoleErrors: [],
    consoleErrorDetails: [],
    requestFailures: [],
    httpErrors: [],
    firebaseRequests: [],
    pageRequests: [],
    webSockets: [],
  };
  page.on("pageerror", error => diagnostics.pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") {
      diagnostics.consoleErrors.push(message.text());
      diagnostics.consoleErrorDetails.push({ text: message.text(), location: message.location() });
    }
  });
  page.on("request", request => {
    diagnostics.pageRequests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
    });
    if (request.url().includes("www.gstatic.com/firebasejs/")) diagnostics.firebaseRequests.push(request.url());
  });
  page.on("websocket", socket => diagnostics.webSockets.push(socket.url()));
  page.on("response", response => {
    if (response.status() >= 400) diagnostics.httpErrors.push({ url: response.url(), status: response.status() });
  });
  page.on("requestfailed", request => diagnostics.requestFailures.push({
    url: request.url(),
    errorText: request.failure()?.errorText || "unknown",
  }));
  return diagnostics;
}

function assertPageFirebaseEmulatorTraffic(diagnostics) {
  const requests = diagnostics.pageRequests || [];
  const webSockets = diagnostics.webSockets || [];
  const authEmulatorRequests = requests.filter(({ url }) => {
    const endpoint = new URL(url);
    return endpoint.protocol === "http:"
      && endpoint.hostname === "127.0.0.1"
      && endpoint.port === "9099"
      && /^\/(?:identitytoolkit|securetoken)\.googleapis\.com\//.test(endpoint.pathname);
  });
  const localDatabaseTransports = [...requests, ...webSockets.map(url => ({ url }))]
    .filter(({ url }) => {
      const endpoint = new URL(url);
      return ["http:", "ws:"].includes(endpoint.protocol)
        && endpoint.hostname === "127.0.0.1"
        && endpoint.port === "9000"
        && /^\/(?:\.lp|\.ws)$/.test(endpoint.pathname);
    });
  for (const { url } of localDatabaseTransports) {
    assert.equal(new URL(url).searchParams.get("ns"), FIREBASE_DATABASE_NAMESPACE,
      `${diagnostics.label} used an unexpected RTDB emulator namespace: ${url}`);
  }
  const databaseEmulatorTransports = localDatabaseTransports.filter(({ url }) => (
    new URL(url).searchParams.get("ns") === FIREBASE_DATABASE_NAMESPACE
  ));

  assert.ok(authEmulatorRequests.length > 0,
    `${diagnostics.label} must authenticate through the browser page on 127.0.0.1:9099`);
  assert.ok(databaseEmulatorTransports.length > 0,
    `${diagnostics.label} must open a browser RTDB transport on 127.0.0.1:9000`);
  for (const { url } of requests) {
    const endpoint = new URL(url);
    assert.equal(["identitytoolkit.googleapis.com", "securetoken.googleapis.com"].includes(endpoint.hostname), false,
      `${diagnostics.label} contacted production Auth: ${endpoint.origin}`);
    assert.equal(/(^|\.)firebaseio\.com$|(^|\.)firebasedatabase\.app$/.test(endpoint.hostname), false,
      `${diagnostics.label} contacted production RTDB: ${endpoint.origin}`);
  }
  for (const url of webSockets) {
    const endpoint = new URL(url);
    assert.equal(/(^|\.)firebaseio\.com$|(^|\.)firebasedatabase\.app$/.test(endpoint.hostname), false,
      `${diagnostics.label} opened a production RTDB socket: ${endpoint.origin}`);
  }

  return {
    authEmulatorRequests: authEmulatorRequests.length,
    databaseEmulatorTransports: databaseEmulatorTransports.length,
  };
}

function assertExpectedOfflineDiagnostics(diagnostics, window) {
  assert.equal(diagnostics.consoleErrorDetails.length, diagnostics.consoleErrors.length,
    `${diagnostics.label} console error detail collection must be complete`);
  assert.deepEqual(diagnostics.pageErrors, [], `${diagnostics.label} page errors`);
  assert.deepEqual(diagnostics.consoleErrors.slice(0, window.consoleStart), [],
    `${diagnostics.label} console errors before the deliberate offline window`);
  assert.deepEqual(diagnostics.requestFailures.slice(0, window.requestStart), [],
    `${diagnostics.label} request failures before the deliberate offline window`);

  const offlineConsoleErrors = diagnostics.consoleErrors.slice(window.consoleStart, window.consoleEnd);
  const offlineConsoleDetails = diagnostics.consoleErrorDetails.slice(window.consoleStart, window.consoleEnd);
  const offlineRequestFailures = diagnostics.requestFailures.slice(window.requestStart, window.requestEnd);
  const websocketFailure = /^WebSocket connection to '(ws:\/\/127\.0\.0\.1:9000\/[^']*)' failed: Error in connection establishment: net::ERR_INTERNET_DISCONNECTED$/;
  const resourceFailure = /^Failed to load resource: net::ERR_INTERNET_DISCONNECTED$/;
  assert.ok(offlineConsoleErrors.length > 0,
    `${diagnostics.label} must expose expected emulator errors while deliberately offline`);
  assert.ok(offlineRequestFailures.length > 0,
    `${diagnostics.label} must expose a failed emulator request while deliberately offline`);
  const genericConsoleUrls = [];
  for (const detail of offlineConsoleDetails) {
    const websocketMatch = detail.text.match(websocketFailure);
    assert.equal(Boolean(websocketMatch) || resourceFailure.test(detail.text), true,
      `${diagnostics.label} emitted an unrelated offline console error: ${detail.text}`);
    if (websocketMatch) {
      const endpoint = new URL(websocketMatch[1]);
      assert.equal(endpoint.hostname, "127.0.0.1");
      assert.equal(endpoint.port, "9000");
      assert.equal(endpoint.pathname, "/.ws");
      assert.equal(endpoint.searchParams.get("ns"), FIREBASE_DATABASE_NAMESPACE);
    } else {
      genericConsoleUrls.push(detail.location.url);
    }
  }

  for (const failure of offlineRequestFailures) {
    const endpoint = new URL(failure.url);
    assert.equal(endpoint.protocol, "http:", `${diagnostics.label} offline failure must use emulator HTTP`);
    assert.equal(endpoint.hostname, "127.0.0.1",
      `${diagnostics.label} offline failure escaped the loopback emulator: ${failure.url}`);
    assert.equal(["9000", "9099"].includes(endpoint.port), true,
      `${diagnostics.label} offline failure used an unapproved port: ${failure.url}`);
    if (endpoint.port === "9000") {
      assert.match(endpoint.pathname, /^\/(?:\.lp|\.ws)$/,
        `${diagnostics.label} offline RTDB failure used an unexpected path`);
      assert.equal(endpoint.searchParams.get("ns"), FIREBASE_DATABASE_NAMESPACE,
        `${diagnostics.label} offline RTDB failure used an unexpected namespace`);
    } else {
      assert.match(endpoint.pathname, /^\/(?:identitytoolkit|securetoken)\.googleapis\.com\//,
        `${diagnostics.label} offline Auth failure used an unexpected path`);
    }
    assert.equal(failure.errorText, "net::ERR_INTERNET_DISCONNECTED",
      `${diagnostics.label} offline request failed for an unexpected reason`);
  }
  assert.deepEqual(genericConsoleUrls.sort(), offlineRequestFailures.map(({ url }) => url).sort(),
    `${diagnostics.label} generic offline console errors must map one-to-one by URL to approved emulator failures`);

  assert.deepEqual(diagnostics.consoleErrors.slice(window.consoleEnd), [],
    `${diagnostics.label} console errors after restoring the BrowserContext online`);
  assert.deepEqual(diagnostics.requestFailures.slice(window.requestEnd), [],
    `${diagnostics.label} request failures after restoring the BrowserContext online`);

  return {
    consoleErrors: offlineConsoleErrors.length,
    websocketErrors: offlineConsoleDetails.filter(({ text }) => websocketFailure.test(text)).length,
    requestFailures: offlineRequestFailures.length,
    endpoints: [...new Set(offlineRequestFailures.map(({ url }) => {
      const endpoint = new URL(url);
      return `${endpoint.protocol}//${endpoint.hostname}:${endpoint.port}${endpoint.pathname}`;
    }))].sort(),
    before: { consoleErrors: window.consoleStart, requestFailures: window.requestStart },
    after: {
      consoleErrors: diagnostics.consoleErrors.length - window.consoleEnd,
      requestFailures: diagnostics.requestFailures.length - window.requestEnd,
    },
  };
}

async function readState(page) {
  return page.evaluate(() => window.__sanctuaryNetworkRead());
}

async function waitForPlayable(page) {
  await page.locator("#hud").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => {
    const state = window.__sanctuaryNetworkRead?.();
    const canvas = document.querySelector("#game");
    return state?.running && state.inputEnabled && state.networkMode === "firebase"
      && typeof state.uid === "string" && state.uid.length > 0
      && canvas?.width > 0 && canvas?.height > 0
      && document.querySelector("#networkBadge")?.textContent === "온라인";
  }, null, { timeout: 20_000 });
}

async function enterOnline(page, nickname) {
  await page.waitForFunction(() => typeof window.__sanctuaryNetworkRead === "function");
  await page.locator("#rpgExperienceButton").click();
  await page.locator("#entryOverlay").waitFor({ state: "visible" });
  await page.locator("#nicknameInput").fill(nickname);
  await page.locator('[data-class-id="warrior"]').click();
  await page.locator('[data-play-mode="online"]').click();
  await page.locator("#enterButton").click();
  await waitForPlayable(page);
}

async function seedPriorChapterFixture(page, captainOutcome) {
  await page.evaluate(({ outcome, sanctuaryDefaults }) => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith("pixel-world.progress.v8:"));
    if (!key) throw new Error("v8 progress checkpoint is missing");
    const value = JSON.parse(localStorage.getItem(key));
    value.worldProgress = {
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
          coolantAnchorIds: [
            "ash-gate-coolant-anchor",
            "magma-route-coolant-anchor",
            "observatory-coolant-anchor",
          ],
          routeDecision: "rescue",
          eruptionTriggered: true,
          coopBossDefeated: true,
          captainOutcome: outcome,
          hiddenWeaponRewardClaimed: false,
          coreFragmentObtained: true,
          sanctuaryUnlocked: true,
        },
        sanctuary: structuredClone(sanctuaryDefaults),
      },
    };
    localStorage.setItem(key, JSON.stringify(value));
  }, { outcome: captainOutcome, sanctuaryDefaults: DEFAULT_SANCTUARY });
}

async function storedProgress(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith("pixel-world.progress.v8:"));
    return key ? { key, value: JSON.parse(localStorage.getItem(key)) } : null;
  });
}

function withoutCaptainOutcome(progress) {
  const comparable = structuredClone(progress);
  delete comparable.worldProgress.chapters.volcano.captainOutcome;
  return comparable;
}

async function reloadAndEnterOnline(page, nickname) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await enterOnline(page, nickname);
}

async function waitForInputReady(page) {
  await page.waitForFunction(() => {
    const state = window.__sanctuaryNetworkRead();
    return state.running && state.inputEnabled && state.player.respawnTimer === 0
      && !document.querySelector("#portalTransitionOverlay:not([hidden])")
      && !document.querySelector("#dialogueOverlay:not([hidden]), #endingOverlay:not([hidden])");
  }, null, { timeout: 15_000 });
}

async function walkAxis(page, axis, target, expectedMap = null) {
  await waitForInputReady(page);
  const initial = await readState(page);
  const direction = Math.sign(target - initial.player[axis]);
  if (!direction) return;
  const key = axis === "x"
    ? (direction > 0 ? "ArrowRight" : "ArrowLeft")
    : (direction > 0 ? "ArrowDown" : "ArrowUp");
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ movedAxis, destination, sign, originMap, destinationMap }) => {
      const state = window.__sanctuaryNetworkRead();
      if (state.mapId !== originMap) {
        if (state.mapId === destinationMap) return true;
        throw new Error(`Unexpected map during movement: ${state.mapId}`);
      }
      return sign * (state.player[movedAxis] - destination) >= -5;
    }, {
      movedAxis: axis,
      destination: target,
      sign: direction,
      originMap: initial.mapId,
      destinationMap: expectedMap,
    }, { timeout: 35_000 });
  } catch (error) {
    console.error("SANCTUARY_NETWORK_MOVEMENT_DIAGNOSTIC", JSON.stringify({
      axis, target, expectedMap, initial, current: await readState(page),
    }));
    throw error;
  } finally {
    await page.keyboard.up(key);
  }
}

async function walkTo(page, x, y, options = {}) {
  for (const axis of options.order || ["x", "y"]) {
    await walkAxis(page, axis, axis === "x" ? x : y, options.expectedMap || null);
    if ((await readState(page)).mapId === options.expectedMap) return;
  }
}

async function travelVillageToSanctuary(page) {
  await walkTo(page, 1900, 1110);
  await walkTo(page, 1900, 458);
  await walkTo(page, 2262, 458, { expectedMap: "volcano" });

  await walkTo(page, 1600, 1460);
  await walkTo(page, 1600, 852);
  await walkTo(page, 2012, 852, { expectedMap: "volcano-magma-route" });

  await walkTo(page, 1100, 852);
  await walkTo(page, 1100, 400);
  await walkTo(page, 1600, 400);
  await walkTo(page, 1600, 852);
  await walkTo(page, 2012, 852, { expectedMap: "volcano-observatory" });

  await walkTo(page, 500, 852);
  await walkTo(page, 500, 300);
  await walkTo(page, 1600, 300);
  await walkTo(page, 1600, 852);
  await walkTo(page, 2012, 852, { expectedMap: "volcano-core-caldera" });

  await walkTo(page, 500, 852);
  await walkTo(page, 500, 320);
  await walkTo(page, 1080, 320);
  await walkTo(page, 1080, 148, { expectedMap: "sanctuary" });
  await page.waitForFunction(() => window.__sanctuaryNetworkRead().mapId === "sanctuary");
}

async function approachStory(page, interactionId) {
  const [x, y] = STORY_TARGETS[interactionId];
  await walkTo(page, x, y);
  await page.waitForFunction(expected => window.__sanctuaryNetworkRead().nearbyStoryId === expected,
    interactionId, { timeout: 8_000 });
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
  await page.keyboard.press("KeyF");
  await page.locator("#dialogueOverlay").waitFor({ state: "visible" });
  await pressDialogueAction(page, actionId);
  await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
}

async function completeSanctuaryPrerequisites(page) {
  await travelVillageToSanctuary(page);
  for (const coreId of ["forest-core-casket", "coast-core-casket", "volcano-core-casket"]) {
    await completeStory(page, coreId);
  }
  await walkTo(page, 1080, 148, { expectedMap: "sanctuary-memory-archive" });

  for (const memoryId of MEMORY_ORDER) await completeStory(page, memoryId);
  await approachStory(page, "memory-sequence-console");
  await page.keyboard.press("KeyF");
  await page.locator("#dialogueOverlay").waitFor({ state: "visible" });
  for (const memoryId of MEMORY_ORDER) await pressDialogueAction(page, `story-memory-add-${memoryId}`);
  await pressDialogueAction(page, "story-memory-submit");
  await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
  for (const id of ["truth-resonance-time", "truth-first-archivist-log", "truth-core-self-division"]) {
    await completeStory(page, id);
  }
  for (const id of [
    "false-return-garen-unscarred",
    "false-return-source-erased",
    "false-return-resonance-time",
  ]) await completeStory(page, id);
  await walkTo(page, 1080, 148, { expectedMap: "sanctuary-return-record" });

  for (const [fieldId, answer] of Object.entries(RECORD_ANSWERS)) {
    await completeStory(page, fieldId, `story-record-answer-${answer}`);
  }
  await completeStory(page, "correction-link-console");
  await page.waitForFunction(() => {
    const state = window.__sanctuaryNetworkRead();
    return state.progress.worldProgress.chapters.sanctuary.correctionLinked === true
      && state.chorus.shared?.phase === "anchors";
  }, null, { timeout: 15_000 });
}

async function face(page, key) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(directionKey => {
      const expected = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[directionKey];
      return window.__sanctuaryNetworkRead().player.dir === expected;
    }, key, { timeout: 3_000 });
  } finally {
    await page.keyboard.up(key);
  }
}

async function pressAttackKey(page, key) {
  const before = (await readState(page)).inputCodes.length;
  await page.keyboard.press(key);
  await page.waitForFunction(expected => window.__sanctuaryNetworkRead().inputCodes.length > expected,
    before, { timeout: 3_000 });
  if ((await readState(page)).attackActive) {
    await page.waitForFunction(() => window.__sanctuaryNetworkRead().attackActive === false,
      null, { timeout: 4_000 });
  }
}

async function carryNextFragment(page) {
  await walkTo(page, 1080, 890);
  await face(page, "ArrowUp");
  for (const key of ATTACK_KEYS) await pressAttackKey(page, key);
  await page.waitForFunction(() => Boolean(window.__sanctuaryNetworkRead().chorus.personal.carriedFragmentId),
    null, { timeout: 8_000 });
  return (await readState(page)).chorus.personal.carriedFragmentId;
}

async function placeFragment(page, anchorId, expectedContamination = null) {
  await walkTo(page, ...CHORUS_ANCHORS[anchorId]);
  await page.waitForFunction(expected => window.__sanctuaryNetworkRead().nearbyChorus?.anchorId === expected,
    anchorId, { timeout: 8_000 });
  await page.keyboard.press("KeyF");
  if (expectedContamination !== null) {
    await page.waitForFunction(expected => window.__sanctuaryNetworkRead().chorus.personal.contamination === expected,
      expectedContamination, { timeout: 5_000 });
    return;
  }
  await page.waitForFunction(expected => window.__sanctuaryNetworkRead()
    .chorus.shared.stabilizedAnchorIds.includes(expected), anchorId, { timeout: 10_000 });
}

async function waitForSharedObjective(pageA, pageB, field, id) {
  await Promise.all([pageA, pageB].map(page => page.waitForFunction(({ objectiveField, objectiveId }) => (
    window.__sanctuaryNetworkRead().chorus.shared?.[objectiveField]?.includes(objectiveId)
  ), { objectiveField: field, objectiveId: id }, { timeout: 12_000 })));
}

async function assertDomConvergence(pageA, pageB, phase) {
  await Promise.all([pageA, pageB].map(page => page.waitForFunction(expected => (
    window.__sanctuaryNetworkRead().chorus.shared?.phase === expected
  ), phase, { timeout: 12_000 })));
  const [domA, domB] = await Promise.all([pageA, pageB].map(page => page.evaluate(() => ({
    cohesion: document.querySelector("#chorusCohesionText")?.textContent,
    phase: document.querySelector("#chorusPhaseText")?.textContent,
  }))));
  assert.deepEqual(domA, domB, `${phase}: both DOMs must show the same cohesion and phase`);
  return domA;
}

async function resolveTestimony(page, pageA, pageB, testimonyId, verdict) {
  await walkTo(page, ...VERDICT_STATIONS[verdict]);
  await page.waitForFunction(expected => {
    const nearby = window.__sanctuaryNetworkRead().nearbyChorus;
    return nearby?.type === "testimony" && nearby.testimonyId === expected;
  }, testimonyId, { timeout: 8_000 });
  await page.keyboard.press("KeyF");
  await waitForSharedObjective(pageA, pageB, "resolvedTestimonyIds", testimonyId);
}

async function dismissRescuedInterruption(page) {
  await page.locator("#dialogueOverlay").waitFor({ state: "visible", timeout: 8_000 });
  assert.match(await page.locator("#dialogueBody").textContent(), /루멘/);
  await page.keyboard.press("KeyF");
  await page.locator("#dialogueOverlay").waitFor({ state: "hidden" });
}

async function cutBond(page, pageA, pageB, bondId) {
  const bond = BONDS[bondId];
  for (const waypoint of bond.safeApproach) await walkTo(page, ...waypoint);
  await walkTo(page, ...bond.station);
  await page.waitForFunction(expected => {
    const nearby = window.__sanctuaryNetworkRead().nearbyChorus;
    return nearby?.type === "record" && nearby.recordId === expected;
  }, bondId, { timeout: 8_000 });
  await page.keyboard.press("KeyF");
  await Promise.all([pageA, pageB].map(candidate => candidate.waitForFunction(expected => (
    window.__sanctuaryNetworkRead().chorus.shared?.activeRecordId === expected
  ), bondId, { timeout: 12_000 })));
  await walkTo(page, ...bond.attackPosition);
  await face(page, "ArrowUp");
  await pressAttackKey(page, "Control");
  await waitForSharedObjective(pageA, pageB, "severedBondIds", bondId);
  for (const waypoint of bond.safeEscape || []) await walkTo(page, ...waypoint);
}

async function bounceReturnRecordSubscription(page) {
  await walkTo(page, 1080, 1648, { expectedMap: "sanctuary-memory-archive" });
  await walkTo(page, 1080, 148, { expectedMap: "sanctuary-return-record" });
}

async function travelSanctuaryToReturnRecord(page) {
  await walkTo(page, 1080, 148, { expectedMap: "sanctuary-memory-archive" });
  await walkTo(page, 1080, 148, { expectedMap: "sanctuary-return-record" });
}

async function finishThreeFutures(page) {
  await walkTo(page, 1080, 148, { expectedMap: "sanctuary-three-futures" });
  for (const id of ["roan", "sera", "garen", "lumen", "echo"]) {
    await completeStory(page, `future-testimony-${id}`);
  }
  for (const id of ["seal", "restore", "release"]) {
    await completeStory(page, `future-preview-${id}`);
  }
}

async function chooseEnding(page, endingChoice) {
  await approachStory(page, "sanctuary-ending-console");
  await page.keyboard.press("KeyF");
  await page.waitForFunction(() => document.querySelector("#endingOverlay")?.dataset.view === "first-confirmation");
  const choice = page.locator(`[data-ending-choice="${endingChoice}"]`);
  await choice.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#endingOverlay")?.dataset.view === "second-confirmation");
  await page.locator("#endingConfirmButton").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(expected => {
    const state = window.__sanctuaryNetworkRead();
    return state.progress.worldProgress.chapters.sanctuary.endingChoice === expected
      && document.querySelector("#endingOverlay")?.dataset.view === "cutscene";
  }, endingChoice, { timeout: 10_000 });
}

async function createFirebaseReader() {
  const app = initializeApp({
    apiKey: "demo-api-key",
    authDomain: "pixel-world-8cb9b.firebaseapp.com",
    databaseURL: "https://pixel-world-8cb9b-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pixel-world-8cb9b",
    appId: "1:244334952755:web:task16read",
  }, `task16-reader-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
  await signInAnonymously(auth);
  return {
    read: async suffix => (await get(ref(db, suffix ? `${CHORUS_PATH}/${suffix}` : CHORUS_PATH))).val(),
    close: async () => {
      goOffline(db);
      await signOut(auth).catch(() => {});
      await deleteApp(app);
    },
  };
}

function findForbiddenKeys(value, forbidden, currentPath = CHORUS_PATH, found = []) {
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}/${key}`;
    if (forbidden.has(key)) found.push(childPath);
    findForbiddenKeys(child, forbidden, childPath, found);
  }
  return found;
}

async function capture(page, filename) {
  await fs.mkdir(SHOT_DIR, { recursive: true });
  const destination = path.join(SHOT_DIR, filename);
  await page.screenshot({ path: destination });
  const stat = await fs.stat(destination);
  assert.ok(stat.size > 1_000, `${filename} is empty`);
  return { filename, bytes: stat.size };
}

async function captureFailure(pageA, pageB, reader, error, diagnostics = []) {
  await fs.mkdir(SHOT_DIR, { recursive: true });
  const evidence = { error: error?.stack || String(error), diagnostics };
  for (const [label, page] of [["A", pageA], ["B", pageB]]) {
    evidence[label] = await readState(page).catch(readError => ({ readError: readError.message }));
    await page.screenshot({ path: path.join(SHOT_DIR, `failure-${label}.png`) }).catch(() => {});
  }
  evidence.firebase = await reader?.read("").catch(readError => ({ readError: readError.message }));
  await fs.writeFile(path.join(SHOT_DIR, "failure.json"), JSON.stringify(evidence, null, 2));
}

(async () => {
  const { FIREBASE_CONFIG } = await import(pathToFileURL(ACTIVE_FIREBASE_CONFIG_PATH).href);
  assert.equal(new URL(FIREBASE_CONFIG.databaseURL).hostname.split(".")[0], FIREBASE_DATABASE_NAMESPACE,
    "smoke namespace must match the active checked-in Firebase config");
  const localFirebasePackage = JSON.parse(await fs.readFile(path.resolve("node_modules/firebase/package.json"), "utf8"));
  assert.equal(localFirebasePackage.version, "12.6.0", "Node Firebase reader must stay pinned to 12.6.0");

  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const diagnosticsA = observeDiagnostics(pageA, "A");
  const diagnosticsB = observeDiagnostics(pageB, "B");
  let reader = null;
  const screenshots = [];
  let evidence = null;

  try {
    await Promise.all([
      pageA.goto(`${BASE_URL}?firebaseEmulator=1`, { waitUntil: "domcontentloaded" }),
      pageB.goto(`${BASE_URL}?firebaseEmulator=1`, { waitUntil: "domcontentloaded" }),
    ]);
    await Promise.all([enterOnline(pageA, "기록자A"), enterOnline(pageB, "기록자B")]);
    const [authenticatedA, authenticatedB] = await Promise.all([readState(pageA), readState(pageB)]);
    const pageFirebaseTraffic = [diagnosticsA, diagnosticsB].map(assertPageFirebaseEmulatorTraffic);
    const [uidA, uidB] = [authenticatedA.uid, authenticatedB.uid];
    assert.notEqual(uidA, uidB, "isolated BrowserContexts must receive distinct anonymous Auth UIDs");

    for (const diagnostics of [diagnosticsA, diagnosticsB]) {
      const firebaseModuleUrls = new Set(diagnostics.firebaseRequests);
      for (const moduleName of ["firebase-app.js", "firebase-auth.js", "firebase-database.js"]) {
        assert.equal([...firebaseModuleUrls].some(url => url.includes(`/firebasejs/${FIREBASE_VERSION}/${moduleName}`)), true,
          `${diagnostics.label} did not load the real Firebase ${FIREBASE_VERSION} ${moduleName}`);
      }
      assert.equal([...firebaseModuleUrls].every(url => url.includes(`/firebasejs/${FIREBASE_VERSION}/`)), true,
        `${diagnostics.label} requested an unexpected Firebase Web SDK version`);
    }

    await Promise.all([
      seedPriorChapterFixture(pageA, "rescued"),
      seedPriorChapterFixture(pageB, "lost"),
    ]);
    await Promise.all([
      reloadAndEnterOnline(pageA, "기록자A"),
      reloadAndEnterOnline(pageB, "기록자B"),
    ]);
    const reloadedA = await readState(pageA);
    const reloadedB = await readState(pageB);
    assert.equal(reloadedA.uid, uidA, "A must retain its anonymous Auth UID after reload");
    assert.equal(reloadedB.uid, uidB, "B must retain its anonymous Auth UID after reload");
    assert.deepEqual(reloadedA.progress.worldProgress.chapters.sanctuary, DEFAULT_SANCTUARY);
    assert.deepEqual(reloadedB.progress.worldProgress.chapters.sanctuary, DEFAULT_SANCTUARY);
    assert.equal(reloadedA.progress.worldProgress.chapters.volcano.captainOutcome, "rescued");
    assert.equal(reloadedB.progress.worldProgress.chapters.volcano.captainOutcome, "lost");
    assert.deepEqual(withoutCaptainOutcome(reloadedA.progress), withoutCaptainOutcome(reloadedB.progress),
      "A/B preconditions must differ only by volcano captainOutcome");
    assert.equal(reloadedA.chorus.shared, null, "A must not seed shared chorus success");
    assert.equal(reloadedB.chorus.shared, null, "B must not seed shared chorus success");

    reader = await createFirebaseReader();

    console.log("[sanctuary-network] prerequisites A");
    await completeSanctuaryPrerequisites(pageA);
    await pageA.waitForFunction(expected => window.__sanctuaryNetworkRead().chorus.shared?.authorityUid === expected,
      uidA, { timeout: 12_000 });
    console.log("[sanctuary-network] prerequisites B");
    await completeSanctuaryPrerequisites(pageB);
    await assertDomConvergence(pageA, pageB, "anchors");

    console.log("[sanctuary-network] shared anchors");
    assert.equal(await carryNextFragment(pageA), "forest");
    await placeFragment(pageA, "coast", 10);
    assert.equal((await readState(pageB)).chorus.personal.contamination, 0,
      "A's wrong placement must not contaminate B");
    await placeFragment(pageA, "forest");
    await waitForSharedObjective(pageA, pageB, "stabilizedAnchorIds", "forest");

    assert.equal(await carryNextFragment(pageB), "coast");
    await placeFragment(pageB, "coast");
    await waitForSharedObjective(pageA, pageB, "stabilizedAnchorIds", "coast");

    assert.equal(await carryNextFragment(pageA), "volcano");
    await placeFragment(pageA, "volcano");
    await waitForSharedObjective(pageA, pageB, "stabilizedAnchorIds", "volcano");
    const testimonyDom = await assertDomConvergence(pageA, pageB, "testimonies");
    assert.equal(testimonyDom.cohesion, "70 / 100");
    await dismissRescuedInterruption(pageA);

    console.log("[sanctuary-network] shared testimonies");
    for (const [index, [testimonyId, verdict]] of TESTIMONY_VERDICTS.entries()) {
      const actor = index % 2 === 0 ? pageA : pageB;
      await resolveTestimony(actor, pageA, pageB, testimonyId, verdict);
    }
    const onslaughtDom = await assertDomConvergence(pageA, pageB, "onslaught");
    assert.equal(onslaughtDom.cohesion, "40 / 100");

    console.log("[sanctuary-network] split bonds before takeover");
    await walkTo(pageB, 1560, 1360);
    await cutBond(pageA, pageA, pageB, "roan");
    await walkTo(pageA, 1560, 1360);
    await cutBond(pageB, pageA, pageB, "sera");
    await walkTo(pageB, 1560, 1360);
    await cutBond(pageA, pageA, pageB, "garen");
    screenshots.push(await capture(pageA, "01-before-takeover-A.png"));
    screenshots.push(await capture(pageB, "02-before-takeover-B.png"));

    const inputCodesBeforeReconnectA = (await readState(pageA)).inputCodes;
    const beforeTakeover = (await readState(pageB)).chorus.firebaseState;
    assert.equal(beforeTakeover.authorityUid, uidA, "A must be the authority before disconnect");
    const offlineDiagnosticWindowA = {
      consoleStart: diagnosticsA.consoleErrors.length,
      requestStart: diagnosticsA.requestFailures.length,
    };
    console.log("[sanctuary-network] authority takeover A -> B");
    await contextA.setOffline(true);
    await pageB.waitForFunction(leaseUntil => Date.now() > leaseUntil, beforeTakeover.leaseUntil, { timeout: 12_000 });
    await bounceReturnRecordSubscription(pageB);
    await pageB.waitForFunction(({ previousEpoch, expectedUid }) => {
      const shared = window.__sanctuaryNetworkRead().chorus.firebaseState;
      return shared?.authorityUid === expectedUid && shared.authorityEpoch > previousEpoch;
    }, { previousEpoch: beforeTakeover.authorityEpoch, expectedUid: uidB }, { timeout: 15_000 });
    const takeover = (await readState(pageB)).chorus.firebaseState;
    assert.equal(takeover.authorityUid, uidB);
    assert.ok(takeover.authorityEpoch > beforeTakeover.authorityEpoch);

    console.log("[sanctuary-network] separated by B input");
    await cutBond(pageB, pageB, pageB, "lumen");
    await pageB.waitForFunction(() => {
      const state = window.__sanctuaryNetworkRead();
      return state.chorus.shared?.status === "separated"
        && state.chorus.shared.phase === "separated"
        && state.progress.worldProgress.chapters.sanctuary.chorusSeparated === true;
    }, null, { timeout: 15_000 });

    const firebaseState = await reader.read("state");
    assert.equal(firebaseState.status, "separated");
    assert.equal(firebaseState.phase, "separated");
    assert.equal(firebaseState.hp, 0);
    assert.equal(firebaseState.authorityUid, uidB);
    assert.ok(firebaseState.authorityEpoch > beforeTakeover.authorityEpoch);
    const contributorEntries = Object.entries(firebaseState.contributors || {});
    assert.deepEqual(contributorEntries.map(([uid]) => uid).sort(), [uidA, uidB].sort());
    const observedTypes = new Set(contributorEntries.flatMap(([, contributor]) => (
      Object.entries(contributor.actionTypes || {}).filter(([, included]) => included === true).map(([type]) => type)
    )));
    for (const type of REQUIRED_CONTRIBUTION_TYPES) {
      assert.equal(observedTypes.has(type), true, `Firebase contributors missing ${type}`);
    }
    const encounterId = firebaseState.encounterId;
    const claims = await reader.read(`completionClaims/${encounterId}`);
    assert.equal(claims?.[uidA]?.eligible, true, "authority must create A's completion claim");
    assert.equal(claims?.[uidB]?.eligible, true, "authority must create B's completion claim");
    assert.equal(claims[uidA].uid, uidA);
    assert.equal(claims[uidB].uid, uidB);
    assert.doesNotMatch(await pageB.locator("#message").textContent(), /온라인 동기화가 거절/,
      "a Firebase-confirmed separation must not show retry feedback");
    screenshots.push(await capture(pageB, "03-separated-by-B.png"));

    const savedBeforeReconnectA = await storedProgress(pageA);
    assert.equal(savedBeforeReconnectA.value.worldProgress.chapters.sanctuary.chorusSeparated, false);
    offlineDiagnosticWindowA.consoleEnd = diagnosticsA.consoleErrors.length;
    offlineDiagnosticWindowA.requestEnd = diagnosticsA.requestFailures.length;
    await contextA.setOffline(false);
    console.log("[sanctuary-network] reconnect A and receive own claim");
    await reloadAndEnterOnline(pageA, "기록자A");
    const returnedA = await readState(pageA);
    assert.equal(returnedA.uid, uidA, "A must retain its Auth UID in the same BrowserContext");
    assert.deepEqual(await storedProgress(pageA), savedBeforeReconnectA,
      "A must retain its localStorage while offline and re-entering");
    await travelVillageToSanctuary(pageA);
    await travelSanctuaryToReturnRecord(pageA);
    await pageA.waitForFunction(expectedUid => {
      const state = window.__sanctuaryNetworkRead();
      return state.chorus.claims?.[expectedUid]?.eligible === true
        && state.progress.worldProgress.chapters.sanctuary.chorusSeparated === true;
    }, uidA, { timeout: 15_000 });

    console.log("[sanctuary-network] isolated endings");
    await Promise.all([finishThreeFutures(pageA), finishThreeFutures(pageB)]);
    await Promise.all([chooseEnding(pageA, "seal"), chooseEnding(pageB, "release")]);
    const [storedA, storedB] = await Promise.all([storedProgress(pageA), storedProgress(pageB)]);
    assert.notEqual(storedA.key, storedB.key);
    assert.equal(storedA.value.worldProgress.chapters.sanctuary.endingChoice, "seal");
    assert.equal(storedB.value.worldProgress.chapters.sanctuary.endingChoice, "release");
    assert.notDeepEqual(storedA.value.worldProgress.chapters.sanctuary.endingChoice,
      storedB.value.worldProgress.chapters.sanctuary.endingChoice);
    screenshots.push(await capture(pageA, "04-ending-seal-A.png"));
    screenshots.push(await capture(pageB, "05-ending-release-B.png"));

    const chorusTree = await reader.read("");
    assert.deepEqual(findForbiddenKeys(chorusTree, new Set(["endingChoice", "contamination"])), [],
      "personal endingChoice/contamination must never enter the Firebase chorus subtree");

    const [finalA, finalB] = await Promise.all([readState(pageA), readState(pageB)]);
    const inputHistories = [
      [...inputCodesBeforeReconnectA, ...finalA.inputCodes],
      finalB.inputCodes,
    ];
    for (const inputCodes of inputHistories) {
      for (const code of ["ControlLeft", "KeyQ", "KeyE", "KeyR", "KeyF", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
        assert.equal(inputCodes.includes(code), true, `${code} was not exercised through browser input`);
      }
    }
    assert.equal(finalA.chorus.personal.contamination, 0,
      "A's personal contamination resets after a real page re-entry and must remain local");
    assert.equal(finalB.chorus.personal.contamination, 0);
    const offlineDiagnostics = assertExpectedOfflineDiagnostics(diagnosticsA, offlineDiagnosticWindowA);
    assert.deepEqual(diagnosticsB.pageErrors, [], "B page errors");
    assert.deepEqual(diagnosticsB.consoleErrors, [], "B console errors");
    assert.deepEqual(diagnosticsB.requestFailures, [], "B request failures");
    assert.deepEqual(diagnosticsA.httpErrors, [], "A HTTP errors");
    assert.deepEqual(diagnosticsB.httpErrors, [], "B HTTP errors");
    [diagnosticsA, diagnosticsB].map(assertPageFirebaseEmulatorTraffic);

    evidence = {
      status: "PASS",
      uids: { A: redactUid(uidA), B: redactUid(uidB), distinct: uidA !== uidB },
      sdkVersion: FIREBASE_VERSION,
      pageFirebaseTraffic,
      offlineDiagnostics,
      cohesion: { testimonies: testimonyDom.cohesion, onslaught: onslaughtDom.cohesion, separated: "0 / 100" },
      phase: firebaseState.phase,
      takeover: {
        from: redactUid(beforeTakeover.authorityUid),
        to: redactUid(takeover.authorityUid),
        epochBefore: beforeTakeover.authorityEpoch,
        epochAfter: takeover.authorityEpoch,
      },
      contributionTypes: [...observedTypes].sort(),
      claims: [uidA, uidB].map(redactUid),
      endings: { A: "seal", B: "release" },
      forbiddenSharedKeys: [],
      screenshots,
    };
    console.log(JSON.stringify(evidence, null, 2));
  } catch (error) {
    await captureFailure(pageA, pageB, reader, error, [diagnosticsA, diagnosticsB]);
    throw error;
  } finally {
    await reader?.close().catch(() => {});
    await contextA.close().catch(() => {});
    await contextB.close().catch(() => {});
    await browser.close().catch(() => {});
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
