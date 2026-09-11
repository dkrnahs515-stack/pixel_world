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
    focus() { this.focusCount += 1; },
  };
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
  game.persistOutcomes = [];
  game.persisted = [];
  game.persistProgress = () => {
    game.persisted.push(structuredClone(game.progress));
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

test("the game persists the choice before opening the cutscene and persists reward separately", () => {
  const game = endingGame();
  assert.equal(game.openSanctuaryEndingSelection(), true);
  assert.equal(game.ui.endingOverlay.dataset.view, "first-confirmation");
  assert.equal(game.previewSanctuaryEnding("release"), true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
  assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");

  assert.equal(game.confirmSanctuaryEnding("release"), true);
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

test("a failed choice save starts neither choice, cutscene, nor reward", () => {
  const game = endingGame();
  game.openSanctuaryEndingSelection();
  game.previewSanctuaryEnding("seal");
  game.persistOutcomes = [false];

  assert.equal(game.confirmSanctuaryEnding("seal"), false);
  assert.equal(game.persisted.length, 1);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
  assert.deepEqual(game.progress.claimedNarrativeRewardIds, []);
  assert.equal(game.ui.endingOverlay.dataset.view, "second-confirmation");
  assert.equal(game.endingPresentationActive, false);
});

test("a failed reward save rolls memory back to the saved choice and leaves recoverable presentation", () => {
  const game = endingGame();
  game.openSanctuaryEndingSelection();
  game.previewSanctuaryEnding("restore");
  game.persistOutcomes = [true, false];

  assert.equal(game.confirmSanctuaryEnding("restore"), true);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, "restore");
  assert.deepEqual(game.progress.claimedNarrativeRewardIds, []);
  assert.equal(game.pendingSanctuaryRewardChoice, "restore");
  assert.equal(game.ui.endingOverlay.dataset.view, "cutscene");
  assert.equal(game.ui.endingOverlay.hidden, false);

  assert.equal(game.recoverSanctuaryEndingReward(), true);
  assert.equal(game.pendingSanctuaryRewardChoice, null);
  assert.deepEqual(missingSanctuaryRewardComponents(game.progress, "restore"), []);
  const afterRecovery = structuredClone(game.progress);
  assert.equal(game.recoverSanctuaryEndingReward(), true);
  assert.deepEqual(game.progress, afterRecovery);
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

test("ending overlay traps Tab and supports Enter confirmation without unsafe DOM", () => {
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
    const enter = {
      code: "Enter", shiftKey: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
    };
    game.handleSanctuaryEndingKeyDown(enter);
    assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, "seal");
    assert.equal(enter.prevented, true);
  } finally {
    globalThis.document = previousDocument;
  }
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
