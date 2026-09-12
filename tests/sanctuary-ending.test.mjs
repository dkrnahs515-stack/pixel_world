import test from "node:test";
import assert from "node:assert/strict";
import {
  SANCTUARY_ENDINGS,
  getEndingPreview,
  grantSanctuaryEndingReward,
  missingSanctuaryRewardComponents,
} from "../src/sanctuary-ending-20260911-sanctuary.js";
import {
  PixelRPG,
  appendRemotePlayerEntities,
} from "../src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import {
  FALSE_RETURN_CONTRADICTION_IDS,
  MEMORY_SOUND_IDS,
  RECORD_FIELD_IDS,
  SANCTUARY_CORE_IDS,
  TESTIMONY_IDS,
  FUTURE_IDS,
} from "../src/sanctuary-progress-20260911-sanctuary.js";

const CHOICES = ["seal", "restore", "release"];

function endingReadyProgress(choice = null) {
  const progress = createInitialProgress();
  progress.worldProgress.chapters.sanctuary = {
    activatedCoreIds: [...SANCTUARY_CORE_IDS],
    collectedMemoryIds: [...MEMORY_SOUND_IDS, ...FALSE_RETURN_CONTRADICTION_IDS],
    memorySequence: [...MEMORY_SOUND_IDS],
    memoryOrderSolved: true,
    coreTruthRevealed: true,
    falseReturnRejected: true,
    completedRecordFieldIds: [...RECORD_FIELD_IDS],
    correctionLinked: true,
    chorusSeparated: true,
    collectedTestimonyIds: [...TESTIMONY_IDS],
    previewedFutureIds: [...FUTURE_IDS],
    endingChoice: choice,
    completed: choice !== null,
  };
  progress.worldProgress.chapters.volcano.captainOutcome = "rescued";
  return progress;
}

function fakeElement({ hidden = false, textContent = "" } = {}) {
  return {
    hidden,
    textContent,
    dataset: {},
    disabled: false,
    focusCount: 0,
    clickCount: 0,
    clickResults: [],
    lastClickResult: undefined,
    focus() { this.focusCount += 1; },
    click() {
      if (this.hidden || this.disabled) return;
      this.clickCount += 1;
      this.lastClickResult = this.onClick?.();
      this.clickResults.push(this.lastClickResult);
    },
  };
}

function endingKeyboardEvent(key, { repeat = false, shiftKey = false } = {}) {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    key: { value: key },
    code: { value: key === " " ? "Space" : key },
    repeat: { value: repeat },
    shiftKey: { value: shiftKey },
  });
  return event;
}

function deferredResult() {
  let resolve;
  let reject;
  const promise = new Promise((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function advanceUntil(predicate) {
  for (let attempt = 0; attempt < 20 && !predicate(); attempt += 1) await Promise.resolve();
  assert.equal(predicate(), true);
}

function endingGame() {
  const game = Object.create(PixelRPG.prototype);
  const choiceButtons = CHOICES.map(choice => ({ ...fakeElement(), dataset: { endingChoice: choice } }));
  game.progress = endingReadyProgress();
  game.player = {
    name: "결말테스터", moving: false, respawnTimer: 0,
    hp: 100, maxHp: 100, mp: 100, maxMp: 100,
  };
  game.mapId = "sanctuary-three-futures";
  game.sessionMode = "online";
  game.running = true;
  game.inputEnabled = true;
  game.keys = new Set();
  game.remotePlayers = new Map([["before", { uid: "before" }]]);
  game.network = { marker: "kept-alive" };
  game.canvas = fakeElement();
  game.ui = {
    endingOverlay: fakeElement({ hidden: true }),
    endingFirstConfirmation: fakeElement(),
    endingSecondConfirmation: fakeElement({ hidden: true }),
    endingCutscene: fakeElement({ hidden: true }),
    endingChoiceButtons: choiceButtons,
    endingPreviewTitle: fakeElement(),
    endingPreviewBody: fakeElement(),
    endingConfirmButton: fakeElement(),
    endingDeferButton: fakeElement(),
    endingBackButton: fakeElement(),
    endingCloseButton: fakeElement(),
    endingCutsceneTitle: fakeElement(),
    endingCutsceneBody: fakeElement(),
    endingLastLine: fakeElement(),
    endingRewardStatus: fakeElement(),
    chatPanel: fakeElement(),
    playerCount: fakeElement(),
    npcPrompt: fakeElement({ hidden: true }),
    npcPromptText: fakeElement(),
    chapterObjective: fakeElement(),
    renderCommunicationLog() {},
  };
  game.npcs = [];
  game.nearbyNpc = null;
  game.nearbyStoryInteraction = null;
  game.pendingStoryInteraction = null;
  game.endingActionInFlight = false;
  game.persistOutcomes = [];
  game.persisted = [];
  game.persistProgress = (_failureMessage, candidate = game.progress) => {
    game.persisted.push(structuredClone(candidate));
    return game.persistOutcomes.length ? game.persistOutcomes.shift() : true;
  };
  game.notifyMessages = [];
  game.notify = message => game.notifyMessages.push(message);
  game.updateProgressHud = () => {};
  game.updateInventoryHud = () => {};
  game.updateBlacksmithHud = () => {};
  game.updateHud = () => {};
  game.updateBiome = () => {};
  game.updateChapterUi = () => {};
  game.updateNpcPrompt = () => {};
  game.applyProgressionStats = () => {};
  for (const button of game.ui.endingChoiceButtons) {
    button.onClick = () => game.previewSanctuaryEnding(button.dataset.endingChoice);
  }
  game.ui.endingDeferButton.onClick = () => game.closeSanctuaryEnding();
  game.ui.endingBackButton.onClick = () => game.showSanctuaryEndingView("first-confirmation");
  game.ui.endingConfirmButton.onClick = () => game.confirmSanctuaryEnding(game.pendingSanctuaryEndingChoice);
  game.ui.endingCloseButton.onClick = () => game.closeSanctuaryEnding();
  game.ui.endingInsideText = fakeElement();
  const endingContents = [
    ...game.ui.endingChoiceButtons,
    game.ui.endingDeferButton,
    game.ui.endingBackButton,
    game.ui.endingConfirmButton,
    game.ui.endingCloseButton,
    game.ui.endingInsideText,
  ];
  game.ui.endingOverlay.contains = element => endingContents.includes(element);
  return game;
}

test("all endings grant equal currency with distinct title and Echo state", () => {
  const results = CHOICES.map(choice => {
    const result = grantSanctuaryEndingReward(endingReadyProgress(choice), choice);
    return { exp: result.rewardExp, gold: result.rewardGold, title: result.titleId, echo: result.echoState };
  });
  assert.deepEqual(results.map(value => [value.exp, value.gold]), [[300, 200], [300, 200], [300, 200]]);
  assert.equal(new Set(results.map(value => value.title)).size, 3);
  assert.deepEqual(results.map(value => value.echo), ["sealed-survivor", "named-dissolution", "own-voice"]);
});

test("each ending has its own scene and final line while preserving Garen's injury", () => {
  const rescued = CHOICES.map(choice => getEndingPreview(choice, "rescued"));
  const lost = CHOICES.map(choice => getEndingPreview(choice, "lost"));
  assert.equal(new Set(rescued.map(value => value.sceneId)).size, 3);
  assert.equal(new Set(rescued.map(value => value.lastLine)).size, 3);
  assert.deepEqual(rescued.map(value => value.lastLine), CHOICES.map(choice => SANCTUARY_ENDINGS[choice].lastLine));
  for (const preview of [...rescued, ...lost]) {
    assert.deepEqual(preview.garen, { scarred: true, chronicAftereffect: true });
    assert.equal(/진엔딩|배드엔딩|추천|점수/u.test(JSON.stringify(preview)), false);
  }
  assert.notDeepEqual(rescued.map(value => value.pages), lost.map(value => value.pages));
});

test("reward retry grants no component twice", () => {
  const once = grantSanctuaryEndingReward(endingReadyProgress("seal"), "seal").progress;
  const twice = grantSanctuaryEndingReward(once, "seal");
  assert.equal(twice.rewardExp, 0);
  assert.equal(twice.rewardGold, 0);
  assert.equal(twice.titleGranted, false);
  assert.deepEqual(twice.progress, once);
});

test("ending rewards preserve unrelated narrative reward receipts", () => {
  const ready = endingReadyProgress("seal");
  ready.claimedNarrativeRewardIds.push("coast-completion-exp");

  const rewarded = grantSanctuaryEndingReward(ready, "seal");

  assert.equal(rewarded.progress.claimedNarrativeRewardIds.includes("coast-completion-exp"), true);
});

test("partial reward ledgers apply only missing components and reject another ending", () => {
  const ready = endingReadyProgress("restore");
  ready.claimedNarrativeRewardIds.push("sanctuary-ending-restore-exp");
  const missing = missingSanctuaryRewardComponents(ready, "restore");
  assert.deepEqual(missing, [
    "sanctuary-ending-restore-gold",
    "sanctuary-ending-restore-title",
  ]);

  const recovered = grantSanctuaryEndingReward(ready, "restore");
  assert.equal(recovered.rewardExp, 0);
  assert.equal(recovered.rewardGold, 200);
  assert.equal(recovered.titleGranted, true);
  assert.deepEqual(recovered.progress.claimedNarrativeRewardIds, [
    "sanctuary-ending-restore-exp",
    "sanctuary-ending-restore-gold",
    "sanctuary-ending-restore-title",
  ]);

  const rejected = grantSanctuaryEndingReward(recovered.progress, "seal");
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "ending_choice_locked");
  assert.deepEqual(rejected.progress, recovered.progress);
});

test("the game persists the choice before opening the cutscene and persists reward separately", async () => {
  const game = endingGame();
  assert.equal(game.openSanctuaryEndingSelection(), true);
  assert.equal(game.ui.endingOverlay.dataset.view, "first-confirmation");
  assert.equal(game.previewSanctuaryEnding("release"), true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
  assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");

  assert.equal(await game.confirmSanctuaryEnding("release"), true);
  assert.equal(game.persisted.length, 2);
  assert.equal(game.persisted[0].worldProgress.chapters.sanctuary.endingChoice, "release");
  assert.deepEqual(game.persisted[0].claimedNarrativeRewardIds, []);
  assert.deepEqual(game.persisted[1].claimedNarrativeRewardIds, [
    "sanctuary-ending-release-exp",
    "sanctuary-ending-release-gold",
    "sanctuary-ending-release-title",
  ]);
  assert.equal(game.ui.endingOverlay.dataset.view, "cutscene");
  assert.equal(game.ui.endingLastLine.textContent, SANCTUARY_ENDINGS.release.lastLine);
});

test("a failed choice save starts neither choice, cutscene, nor reward", async () => {
  const game = endingGame();
  game.openSanctuaryEndingSelection();
  game.previewSanctuaryEnding("seal");
  game.persistOutcomes = [false];

  assert.equal(await game.confirmSanctuaryEnding("seal"), false);
  assert.equal(game.persisted.length, 1);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
  assert.deepEqual(game.progress.claimedNarrativeRewardIds, []);
  assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");
  assert.equal(game.endingPresentationActive, false);
});

test("a failed reward save rolls memory back to the saved choice and leaves recoverable presentation", async () => {
  const game = endingGame();
  game.openSanctuaryEndingSelection();
  game.previewSanctuaryEnding("restore");
  game.persistOutcomes = [true, false];

  assert.equal(await game.confirmSanctuaryEnding("restore"), true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, "restore");
  assert.deepEqual(game.progress.claimedNarrativeRewardIds, []);
  assert.equal(game.pendingSanctuaryRewardChoice, "restore");
  assert.equal(game.ui.endingOverlay.dataset.view, "cutscene");
  assert.equal(game.ui.endingOverlay.hidden, false);

  assert.equal(await game.recoverSanctuaryEndingReward(), true);
  assert.equal(game.pendingSanctuaryRewardChoice, null);
  assert.deepEqual(missingSanctuaryRewardComponents(game.progress, "restore"), []);
  const afterRecovery = structuredClone(game.progress);
  assert.equal(await game.recoverSanctuaryEndingReward(), true);
  assert.deepEqual(game.progress, afterRecovery);
});

test("global F retries a pending ending reward while the cutscene is open", async () => {
  const game = endingGame();
  const previousDocument = globalThis.document;
  const previousAddEventListener = globalThis.addEventListener;
  const previousInputElement = globalThis.HTMLInputElement;
  const previousTextAreaElement = globalThis.HTMLTextAreaElement;
  const previousSelectElement = globalThis.HTMLSelectElement;
  let keydown;
  globalThis.HTMLInputElement = class HTMLInputElement {};
  globalThis.HTMLTextAreaElement = class HTMLTextAreaElement {};
  globalThis.HTMLSelectElement = class HTMLSelectElement {};
  globalThis.document = {
    activeElement: game.ui.endingCloseButton,
    querySelectorAll() { return []; },
  };
  globalThis.addEventListener = (type, listener) => {
    if (type === "keydown") keydown = listener;
  };
  try {
    game.progress = endingReadyProgress("release");
    game.pendingSanctuaryRewardChoice = "release";
    game.presentSanctuaryEnding("release");
    game.isSaleConfirmOpen = () => false;
    game.isBlacksmithOpen = () => false;
    game.isQaOpen = () => false;
    game.isInventoryOpen = () => false;
    game.isShopOpen = () => false;
    game.isDialogueOpen = () => false;
    game.bindEvents();

    keydown({
      code: "KeyF", repeat: false, ctrlKey: false, metaKey: false, altKey: false,
      target: null, preventDefault() {},
    });
    await advanceUntil(() => game.pendingSanctuaryRewardChoice === null);

    assert.deepEqual(missingSanctuaryRewardComponents(game.progress, "release"), []);
    assert.equal(game.progress.gold, 200);
    assert.deepEqual(game.progress.earnedTitleIds, ["sanctuary-title-release"]);
  } finally {
    globalThis.document = previousDocument;
    globalThis.addEventListener = previousAddEventListener;
    globalThis.HTMLInputElement = previousInputElement;
    globalThis.HTMLTextAreaElement = previousTextAreaElement;
    globalThis.HTMLSelectElement = previousSelectElement;
  }
});

test("first-step Escape defers without a write and reopening near the core works", () => {
  const game = endingGame();
  game.nearbyStoryInteraction = { type: "sanctuary-ending-console" };
  game.openSanctuaryEndingSelection();
  const event = {
    code: "Escape", shiftKey: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  };
  game.handleSanctuaryEndingKeyDown(event);
  assert.equal(game.ui.endingOverlay.hidden, true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
  assert.equal(game.persisted.length, 0);
  assert.equal(game.openNpcInteraction(), true);
  assert.equal(game.ui.endingOverlay.dataset.view, "first-confirmation");
});

test("ending overlay traps Tab and supports Enter confirmation without unsafe DOM", async () => {
  const game = endingGame();
  const previousDocument = globalThis.document;
  game.openSanctuaryEndingSelection();
  globalThis.document = { activeElement: game.ui.endingDeferButton };
  try {
    const tab = {
      code: "Tab", shiftKey: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
    };
    game.handleSanctuaryEndingKeyDown(tab);
    assert.equal(tab.prevented, true);
    assert.equal(game.ui.endingChoiceButtons[0].focusCount, 2);

    game.previewSanctuaryEnding("seal");
    globalThis.document.activeElement = game.ui.endingConfirmButton;
    const enter = endingKeyboardEvent("Enter");
    game.handleSanctuaryEndingKeyDown(enter);
    await game.ui.endingConfirmButton.lastClickResult;
    assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, "seal");
    assert.equal(enter.defaultPrevented, true);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("focused defer and back buttons keep their pointer click meaning for Space and Enter", () => {
  const game = endingGame();
  const previousDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  try {
    game.openSanctuaryEndingSelection();
    globalThis.document.activeElement = game.ui.endingDeferButton;
    const defer = endingKeyboardEvent(" ");
    assert.equal(game.handleSanctuaryEndingKeyDown(defer), true);
    assert.equal(defer.defaultPrevented, true);
    assert.equal(game.ui.endingDeferButton.clickCount, 1);
    assert.equal(game.ui.endingOverlay.hidden, true);
    assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);

    game.openSanctuaryEndingSelection();
    game.previewSanctuaryEnding("seal");
    globalThis.document.activeElement = game.ui.endingBackButton;
    const back = endingKeyboardEvent("Enter");
    assert.equal(game.handleSanctuaryEndingKeyDown(back), true);
    assert.equal(game.ui.endingBackButton.clickCount, 1);
    assert.equal(game.ui.endingOverlay.dataset.view, "first-confirmation");
    assert.equal(game.persisted.length, 0);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("focused confirm and cutscene close buttons keep their pointer click meaning", async () => {
  const game = endingGame();
  const previousDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  try {
    game.openSanctuaryEndingSelection();
    game.previewSanctuaryEnding("restore");
    globalThis.document.activeElement = game.ui.endingConfirmButton;
    assert.equal(game.handleSanctuaryEndingKeyDown(endingKeyboardEvent("Enter")), true);
    await game.ui.endingConfirmButton.lastClickResult;
    assert.equal(game.ui.endingConfirmButton.clickCount, 1);
    assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, "restore");
    assert.equal(game.ui.endingOverlay.dataset.view, "cutscene");

    game.pendingSanctuaryRewardChoice = "restore";
    globalThis.document.activeElement = game.ui.endingCloseButton;
    assert.equal(game.handleSanctuaryEndingKeyDown(endingKeyboardEvent("Enter")), true);
    assert.equal(game.ui.endingCloseButton.clickCount, 1);
    assert.equal(game.ui.endingOverlay.hidden, true);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("held Enter cannot cascade beyond one ending view transition", () => {
  const game = endingGame();
  const previousDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  try {
    game.openSanctuaryEndingSelection();
    globalThis.document.activeElement = game.ui.endingChoiceButtons[0];
    assert.equal(game.handleSanctuaryEndingKeyDown(endingKeyboardEvent("Enter")), true);
    assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");

    globalThis.document.activeElement = game.ui.endingConfirmButton;
    const repeated = endingKeyboardEvent("Enter", { repeat: true });
    assert.equal(game.handleSanctuaryEndingKeyDown(repeated), true);
    assert.equal(repeated.defaultPrevented, true);
    assert.equal(game.ui.endingConfirmButton.clickCount, 0);
    assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");
    assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
    assert.equal(game.persisted.length, 0);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("activation defaults run only when focus is outside the ending overlay", () => {
  const game = endingGame();
  const previousDocument = globalThis.document;
  const outside = fakeElement();
  globalThis.document = { activeElement: game.ui.endingInsideText };
  try {
    game.openSanctuaryEndingSelection();
    assert.equal(game.handleSanctuaryEndingKeyDown(endingKeyboardEvent("Enter")), false);
    assert.equal(game.ui.endingOverlay.dataset.view, "first-confirmation");

    globalThis.document.activeElement = outside;
    assert.equal(game.handleSanctuaryEndingKeyDown(endingKeyboardEvent("Enter")), true);
    assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");
    assert.equal(game.pendingSanctuaryEndingChoice, "seal");
  } finally {
    globalThis.document = previousDocument;
  }
});

test("async confirmation serializes choice and reward persistence and blocks reentry", async () => {
  const game = endingGame();
  game.openSanctuaryEndingSelection();
  game.previewSanctuaryEnding("release");
  const liveBefore = game.progress;
  const choiceSave = deferredResult();
  let persistCalls = 0;
  game.persistProgress = (_failureMessage, candidate = game.progress) => {
    persistCalls += 1;
    game.persisted.push(structuredClone(candidate));
    return persistCalls === 1 ? choiceSave.promise : true;
  };

  game.ui.endingConfirmButton.click();
  game.ui.endingConfirmButton.click();
  const [first, reentered] = game.ui.endingConfirmButton.clickResults;
  assert.equal(typeof first?.then, "function");
  assert.equal(await reentered, false);
  assert.equal(persistCalls, 1);
  assert.strictEqual(game.progress, liveBefore);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
  assert.deepEqual(game.progress.claimedNarrativeRewardIds, []);
  assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");
  assert.equal(game.endingPresentationActive, false);
  assert.equal(game.persisted[0].worldProgress.chapters.sanctuary.endingChoice, "release");

  choiceSave.resolve(true);
  assert.equal(await first, true);
  assert.equal(persistCalls, 2);
  assert.deepEqual(missingSanctuaryRewardComponents(game.progress, "release"), []);
});

test("async reward recovery rolls back a failed save and blocks reentry", async () => {
  const game = endingGame();
  game.progress = endingReadyProgress("seal");
  game.pendingSanctuaryRewardChoice = "seal";
  game.presentSanctuaryEnding("seal");
  const before = structuredClone(game.progress);
  const rewardSave = deferredResult();
  let persistCalls = 0;
  game.persistProgress = () => {
    persistCalls += 1;
    return rewardSave.promise;
  };

  const first = game.recoverSanctuaryEndingReward();
  const reentered = game.recoverSanctuaryEndingReward();
  assert.equal(typeof first?.then, "function");
  assert.equal(await reentered, false);
  assert.equal(persistCalls, 1);

  rewardSave.resolve(false);
  assert.equal(await first, false);
  assert.deepEqual(game.progress, before);
  assert.equal(game.pendingSanctuaryRewardChoice, "seal");
});

test("a deferred false choice save keeps live progress isolated and blocks every ending navigation race", async () => {
  const game = endingGame();
  const previousDocument = globalThis.document;
  game.nearbyStoryInteraction = { type: "sanctuary-ending-console" };
  game.openSanctuaryEndingSelection();
  game.previewSanctuaryEnding("seal");
  const liveBefore = game.progress;
  const choiceSave = deferredResult();
  let persistedCandidate;
  game.persistProgress = (_failureMessage, candidate = game.progress) => {
    persistedCandidate = structuredClone(candidate);
    return choiceSave.promise;
  };
  globalThis.document = { activeElement: game.ui.endingConfirmButton };
  try {
    game.ui.endingConfirmButton.click();
    const confirmation = game.ui.endingConfirmButton.lastClickResult;
    assert.strictEqual(game.progress, liveBefore);
    assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
    assert.equal(persistedCandidate.worldProgress.chapters.sanctuary.endingChoice, "seal");

    assert.equal(game.handleSanctuaryEndingKeyDown(endingKeyboardEvent("Escape")), true);
    assert.equal(game.handleSanctuaryEndingKeyDown(endingKeyboardEvent("Enter")), true);
    game.ui.endingBackButton.click();
    game.ui.endingDeferButton.click();
    game.ui.endingCloseButton.click();
    assert.equal(game.openSanctuaryEndingSelection(), false);
    assert.equal(await game.recoverSanctuaryEndingReward(), false);
    assert.equal(game.ui.endingOverlay.hidden, false);
    assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");
    assert.equal(game.endingPresentationActive, false);

    choiceSave.resolve(false);
    assert.equal(await confirmation, false);
    assert.strictEqual(game.progress, liveBefore);
    assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
    assert.deepEqual(game.progress.claimedNarrativeRewardIds, []);
    assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");
    assert.equal(game.notifyMessages.length, 1);

    game.ui.endingBackButton.click();
    assert.equal(game.ui.endingOverlay.dataset.view, "first-confirmation");
  } finally {
    globalThis.document = previousDocument;
  }
});

test("a rejected choice save resolves safely for pointer and keyboard activation", async () => {
  for (const activation of ["pointer", "keyboard"]) {
    const game = endingGame();
    const previousDocument = globalThis.document;
    game.openSanctuaryEndingSelection();
    game.previewSanctuaryEnding("restore");
    const liveBefore = game.progress;
    const choiceSave = deferredResult();
    game.persistProgress = () => choiceSave.promise;
    globalThis.document = { activeElement: game.ui.endingConfirmButton };
    try {
      if (activation === "pointer") game.ui.endingConfirmButton.click();
      else game.handleSanctuaryEndingKeyDown(endingKeyboardEvent("Enter"));
      const confirmation = game.ui.endingConfirmButton.lastClickResult;
      choiceSave.reject(new Error(`${activation} choice storage rejected`));

      assert.equal(await confirmation, false);
      assert.strictEqual(game.progress, liveBefore);
      assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
      assert.deepEqual(game.progress.claimedNarrativeRewardIds, []);
      assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");
      assert.equal(game.endingPresentationActive, false);
      assert.equal(game.pendingSanctuaryRewardChoice, null);
      assert.equal(game.notifyMessages.length, 1);
    } finally {
      globalThis.document = previousDocument;
    }
  }
});

test("a rejected reward save exposes only the persisted choice and keeps recovery pending", async () => {
  const game = endingGame();
  game.openSanctuaryEndingSelection();
  game.previewSanctuaryEnding("release");
  const rewardSave = deferredResult();
  let persistCalls = 0;
  game.persistProgress = () => {
    persistCalls += 1;
    return persistCalls === 1 ? true : rewardSave.promise;
  };
  const before = structuredClone(game.progress);

  const confirmation = game.confirmSanctuaryEnding("release");
  await advanceUntil(() => persistCalls === 2);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, "release");
  assert.equal(game.progress.exp, before.exp);
  assert.equal(game.progress.gold, before.gold);
  assert.deepEqual(game.progress.earnedTitleIds, []);
  assert.deepEqual(game.progress.claimedNarrativeRewardIds, []);
  assert.equal(game.ui.endingOverlay.dataset.view, "cutscene");
  assert.equal(game.pendingSanctuaryRewardChoice, "release");

  rewardSave.reject(new Error("reward storage rejected"));
  assert.equal(await confirmation, true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, "release");
  assert.equal(game.progress.exp, before.exp);
  assert.equal(game.progress.gold, before.gold);
  assert.deepEqual(game.progress.earnedTitleIds, []);
  assert.deepEqual(game.progress.claimedNarrativeRewardIds, []);
  assert.equal(game.ui.endingOverlay.hidden, false);
  assert.equal(game.endingPresentationActive, true);
  assert.equal(game.pendingSanctuaryRewardChoice, "release");
  assert.equal(game.notifyMessages.length, 1);
});

test("a rejected partial reward candidate stays hidden and retry grants only missing components", async () => {
  const game = endingGame();
  const partial = grantSanctuaryEndingReward(endingReadyProgress("restore"), "restore", {
    componentIds: ["sanctuary-ending-restore-exp"],
  }).progress;
  game.progress = partial;
  game.pendingSanctuaryRewardChoice = "restore";
  game.presentSanctuaryEnding("restore");
  const liveBefore = game.progress;
  const expBefore = game.progress.exp;
  const goldBefore = game.progress.gold;
  const rewardSave = deferredResult();
  let persistCalls = 0;
  game.persistProgress = () => {
    persistCalls += 1;
    return persistCalls === 1 ? rewardSave.promise : true;
  };

  const recovery = game.recoverSanctuaryEndingReward();
  assert.strictEqual(game.progress, liveBefore);
  assert.deepEqual(missingSanctuaryRewardComponents(game.progress, "restore"), [
    "sanctuary-ending-restore-gold",
    "sanctuary-ending-restore-title",
  ]);
  rewardSave.reject(new Error("partial reward storage rejected"));
  assert.equal(await recovery, false);
  assert.strictEqual(game.progress, liveBefore);
  assert.equal(game.progress.exp, expBefore);
  assert.equal(game.progress.gold, goldBefore);
  assert.equal(game.pendingSanctuaryRewardChoice, "restore");

  assert.equal(await game.recoverSanctuaryEndingReward(), true);
  assert.equal(game.progress.exp, expBefore);
  assert.equal(game.progress.gold, goldBefore + 200);
  assert.deepEqual(game.progress.claimedNarrativeRewardIds, [
    "sanctuary-ending-restore-exp",
    "sanctuary-ending-restore-gold",
    "sanctuary-ending-restore-title",
  ]);
  assert.equal(new Set(game.progress.claimedNarrativeRewardIds).size, 3);
});

test("final presentation hides only local remote rendering and chat while receive state remains live", () => {
  const game = endingGame();
  const network = game.network;
  const players = game.remotePlayers;
  assert.equal(game.setEndingPresentationActive(true), true);
  assert.strictEqual(game.network, network);
  assert.strictEqual(game.remotePlayers, players);
  assert.equal(game.ui.chatPanel.hidden, true);
  assert.deepEqual(appendRemotePlayerEntities([], game.remotePlayers, game.endingPresentationActive), []);

  assert.equal(game.setEndingPresentationActive(false), false);
  assert.equal(game.ui.chatPanel.hidden, false);
  assert.equal(appendRemotePlayerEntities([], game.remotePlayers, game.endingPresentationActive).length, 1);
  game.sessionMode = "solo";
  game.setEndingPresentationActive(true);
  game.setEndingPresentationActive(false);
  assert.equal(game.ui.chatPanel.hidden, true);
});

test("an online viewer advances only from their own eligible Chorus completion claim", () => {
  const game = endingGame();
  const sanctuary = game.progress.worldProgress.chapters.sanctuary;
  game.progress.worldProgress.chapters.sanctuary = {
    ...sanctuary,
    chorusSeparated: false,
    collectedTestimonyIds: [],
    previewedFutureIds: [],
    endingChoice: null,
    completed: false,
  };
  game.network = { uid: "viewer" };
  game.chorusController = {
    receiveCompletionClaims(claims) {
      return claims.viewer?.uid === "viewer";
    },
  };
  const ownClaim = {
    uid: "viewer", encounterId: "chorus-viewer-1", eligible: true,
  };

  assert.equal(game.receiveSanctuaryChorusCompletionClaims({ other: {
    uid: "other", encounterId: "chorus-viewer-1", eligible: true,
  } }), false);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.chorusSeparated, false);
  assert.equal(game.receiveSanctuaryChorusCompletionClaims({ viewer: ownClaim }), true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.chorusSeparated, true);
  assert.equal(game.persisted.length, 1);
});

test("retained Chorus completion delivery dedupe stays bounded across encounters", () => {
  const game = endingGame();
  game.network = { uid: "viewer" };
  game.chorusController = { receiveCompletionClaims: () => true };

  for (let index = 0; index < 12; index += 1) {
    assert.equal(game.receiveSanctuaryChorusCompletionClaims({
      viewer: {
        uid: "viewer",
        encounterId: `chorus-retained-${index}`,
        eligible: true,
        createdAt: index,
      },
    }), true);
  }

  assert.equal(game.processedChorusCompletionIds.size, 8);
  assert.equal(game.processedChorusCompletionIds.has("chorus-retained-0:viewer"), false);
  assert.equal(game.processedChorusCompletionIds.has("chorus-retained-11:viewer"), true);
});
