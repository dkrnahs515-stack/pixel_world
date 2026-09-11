import test from "node:test";
import assert from "node:assert/strict";
import {
  SANCTUARY_ARCHIVE_RECORDS,
  SANCTUARY_STORY_INTERACTIONS,
  getCollectedSanctuaryRecords,
  getSanctuaryChapterObjective,
  getSanctuaryStoryContent,
} from "../src/sanctuary-story-data-20260911-sanctuary.js";
import * as sanctuaryStory from "../src/sanctuary-story-data-20260911-sanctuary.js";
import {
  MEMORY_SOUND_IDS,
  RECORD_FIELD_IDS,
  SANCTUARY_CORE_IDS,
} from "../src/sanctuary-progress-20260911-sanctuary.js";
import {
  createInitialWorldProgress,
  progressSanctuary,
} from "../src/chapter-progress-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import {
  resolveStoryInteraction,
} from "../src/story-interactions-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import {
  storyDialogueModel,
} from "../src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import * as sanctuaryDialogue from "../src/story-dialogue-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { PixelRPG } from "../src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { collectRecordArchiveEntries } from "../src/record-archive-20260911-sanctuary.js";

const interaction = id => SANCTUARY_STORY_INTERACTIONS.find(value => value.id === id);

function answerForRecordField(...args) {
  assert.equal(typeof sanctuaryStory.answerForRecordField, "function");
  return sanctuaryStory.answerForRecordField(...args);
}

function chapter12ReadyProgress() {
  let progress = createInitialWorldProgress();
  for (const coreId of SANCTUARY_CORE_IDS) {
    progress = progressSanctuary(progress, { type: "activate-core", coreId }).progress;
  }
  return progress;
}

function collectAllSounds(progress) {
  for (const memoryId of MEMORY_SOUND_IDS) {
    progress = progressSanctuary(progress, { type: "collect-memory", memoryId }).progress;
  }
  return progress;
}

function revealAllTruths(progress) {
  for (const id of ["truth-resonance-time", "truth-first-archivist-log", "truth-core-self-division"]) {
    progress = resolveStoryInteraction(progress, id).progress;
  }
  return progress;
}

function returnRecordReadyProgress(captainOutcome = "rescued") {
  let progress = chapter12ReadyProgress();
  progress = {
    ...progress,
    chapters: {
      ...progress.chapters,
      volcano: { ...progress.chapters.volcano, captainOutcome },
    },
  };
  progress = collectAllSounds(progress);
  progress = resolveStoryInteraction(progress, "memory-sequence-console", { sequence: MEMORY_SOUND_IDS }).progress;
  progress = revealAllTruths(progress);
  for (const id of [
    "false-return-resonance-time",
    "false-return-source-erased",
    "false-return-garen-unscarred",
  ]) {
    progress = resolveStoryInteraction(progress, id).progress;
  }
  return progress;
}

test("chapter 12 requires input order and all contradictions", () => {
  const progress = collectAllSounds(chapter12ReadyProgress());
  const wrong = resolveStoryInteraction(progress, "memory-sequence-console", {
    sequence: ["dawn-bird", "departure-bell", "tide-bell", "mine-shift-bell"],
  });
  assert.equal(wrong.outcome, "retryable");
  assert.equal(wrong.retryable, true);
  assert.equal(wrong.progress.chapters.sanctuary.memoryOrderSolved, false);
  assert.deepEqual(wrong.progress.chapters.sanctuary.collectedMemoryIds, MEMORY_SOUND_IDS);

  const solved = resolveStoryInteraction(progress, "memory-sequence-console", { sequence: MEMORY_SOUND_IDS });
  assert.equal(solved.outcome, "completed");
  assert.equal(solved.progress.chapters.sanctuary.memoryOrderSolved, true);
  const revealed = revealAllTruths(solved.progress);
  assert.equal(revealed.chapters.sanctuary.coreTruthRevealed, true);
  const resonanceFirst = resolveStoryInteraction(revealed, "false-return-resonance-time");
  assert.equal(resonanceFirst.progress.chapters.sanctuary.falseReturnRejected, false);
  assert.equal(resonanceFirst.progress.unlockedMapIds.includes("sanctuary-return-record"), false);
  assert.equal(resonanceFirst.progress.chapters.sanctuary.collectedMemoryIds.includes("false-return-resonance-time"), true);

  const duplicate = resolveStoryInteraction(resonanceFirst.progress, "false-return-resonance-time");
  assert.equal(duplicate.outcome, "unavailable");
  assert.deepEqual(duplicate.progress, resonanceFirst.progress);

  const second = resolveStoryInteraction(resonanceFirst.progress, "false-return-source-erased");
  assert.equal(second.progress.chapters.sanctuary.falseReturnRejected, false);
  const rejected = resolveStoryInteraction(second.progress, "false-return-garen-unscarred").progress;
  assert.equal(rejected.chapters.sanctuary.falseReturnRejected, true);
  assert.equal(rejected.unlockedMapIds.includes("sanctuary-return-record"), true);
  assert.deepEqual(rejected.chapters.sanctuary.collectedMemoryIds.slice(-3), [
    "false-return-resonance-time",
    "false-return-source-erased",
    "false-return-garen-unscarred",
  ]);
});

test("the resonance timestamp is never labeled as incident time", () => {
  const record = SANCTUARY_ARCHIVE_RECORDS.find(value => value.id === "false-return-resonance-time");
  assert.match(record.pages.join(" "), /공명 시각/);
  assert.doesNotMatch(record.pages.join(" "), /사건 시각입니다/);
});

test("memory archive content is map-scoped, immutable, and never gives a clear face to a memory", () => {
  const content = getSanctuaryStoryContent("sanctuary-memory-archive");
  assert.equal(content.mapId, "sanctuary-memory-archive");
  assert.equal(content.interactions.some(value => value.id === "memory-sequence-console"), true);
  assert.equal(getSanctuaryStoryContent("coast-beach"), null);
  assert.equal(Object.isFrozen(SANCTUARY_STORY_INTERACTIONS), true);
  assert.ok(SANCTUARY_STORY_INTERACTIONS.every(value => (
    value.chapterId === "sanctuary"
      && typeof value.mapId === "string"
      && Number.isFinite(value.x)
      && Number.isFinite(value.y)
      && Number.isFinite(value.interactionRadius)
      && typeof value.prompt === "string"
      && Array.isArray(value.pages)
  )));
  const memoryVisuals = SANCTUARY_STORY_INTERACTIONS.filter(value => value.memoryVisual === true);
  assert.ok(memoryVisuals.length > 0);
  assert.ok(memoryVisuals.every(value => ["silhouette", "hand", "architecture", "grave", "light"].includes(value.visualVariant)));
  assert.ok(memoryVisuals.every(value => value.portraitVariant !== "clear-face"));
});

test("the archivist record preserves conflict and the core truth avoids a sole breaker", () => {
  const archivist = SANCTUARY_ARCHIVE_RECORDS.find(value => value.id === "first-archivist-deletion-log");
  const core = SANCTUARY_ARCHIVE_RECORDS.find(value => value.id === "core-self-division-original");
  assert.match(archivist.pages.join(" "), /상충하는 귀환 기록/);
  assert.doesNotMatch(archivist.pages.join(" "), /단순한 악당/);
  assert.match(core.pages.join(" "), /스스로 갈라/);
  assert.doesNotMatch(core.pages.join(" "), /루멘만이.*파괴/);
});

test("collected sanctuary records join the archive only after the core truth is revealed", () => {
  const before = collectAllSounds(chapter12ReadyProgress());
  assert.deepEqual(getCollectedSanctuaryRecords(before), []);
  const solved = resolveStoryInteraction(before, "memory-sequence-console", { sequence: MEMORY_SOUND_IDS }).progress;
  const revealed = revealAllTruths(solved);
  assert.deepEqual(getCollectedSanctuaryRecords(revealed).map(value => value.id), [
    "false-return-resonance-time",
    "first-archivist-deletion-log",
    "core-self-division-original",
  ]);
  assert.equal(getSanctuaryChapterObjective(revealed).id, "reject-false-return");
});

test("the core truth stays unrevealed until the final original record is examined", () => {
  const collected = collectAllSounds(chapter12ReadyProgress());
  let progress = resolveStoryInteraction(collected, "memory-sequence-console", { sequence: MEMORY_SOUND_IDS }).progress;
  progress = resolveStoryInteraction(progress, "truth-resonance-time").progress;
  assert.equal(progress.chapters.sanctuary.coreTruthRevealed, false);
  progress = resolveStoryInteraction(progress, "truth-first-archivist-log").progress;
  assert.equal(progress.chapters.sanctuary.coreTruthRevealed, false);
  progress = resolveStoryInteraction(progress, "truth-core-self-division").progress;
  assert.equal(progress.chapters.sanctuary.coreTruthRevealed, true);
});

test("memory sequence dialogue offers only unselected sounds and a submit action", () => {
  const progress = collectAllSounds(chapter12ReadyProgress());
  const model = storyDialogueModel(interaction("memory-sequence-console"), progress, {
    sequence: ["departure-bell", "dawn-bird"],
  });
  assert.deepEqual(model.actions.map(value => value.id), [
    "story-memory-add-tide-bell",
    "story-memory-add-mine-shift-bell",
    "story-memory-submit",
  ]);
});

test("game dialogue accumulates sounds and keeps a wrong order open for immediate retry", () => {
  const game = Object.create(PixelRPG.prototype);
  game.progress = { worldProgress: collectAllSounds(chapter12ReadyProgress()) };
  game.pendingStoryInteraction = interaction("memory-sequence-console");
  game.pendingMemorySequence = [];
  game.npcs = [];
  game.ui = {};
  game.mapId = "sanctuary-memory-archive";
  game.persistProgress = () => true;
  game.updateChapterUi = () => {};
  game.updateNpcPrompt = () => {};
  game.updateInventoryHud = () => {};
  game.updateBlacksmithHud = () => {};
  let closed = 0;
  const models = [];
  game.dialogue = { open(model) { models.push(model); }, actionButtons() { return []; } };
  game.closeNpcDialogue = () => { closed += 1; };
  game.notify = () => {};

  for (const id of ["dawn-bird", "departure-bell", "tide-bell", "mine-shift-bell"]) {
    game.handleDialogueAction(`story-memory-add-${id}`);
  }
  game.handleDialogueAction("story-memory-submit");

  assert.equal(closed, 0);
  assert.deepEqual(game.pendingMemorySequence, []);
  assert.match(models.at(-1).pages.join(" "), /순서.*다시/);
  assert.deepEqual(models.at(-1).actions.map(value => value.id), [
    ...MEMORY_SOUND_IDS.map(id => `story-memory-add-${id}`),
    "story-memory-submit",
  ]);
  assert.deepEqual(game.progress.worldProgress.chapters.sanctuary.collectedMemoryIds, MEMORY_SOUND_IDS);
});

test("chapter UI merges collected coast and sanctuary records", () => {
  const game = Object.create(PixelRPG.prototype);
  const solved = resolveStoryInteraction(collectAllSounds(chapter12ReadyProgress()), "memory-sequence-console", {
    sequence: MEMORY_SOUND_IDS,
  }).progress;
  game.progress = { worldProgress: revealAllTruths(solved) };
  let rendered = null;
  game.ui = {
    chapterObjective: { textContent: "" },
    renderCommunicationLog(records) { rendered = records; },
  };
  game.currentChapterObjective = () => ({ label: "기억 회랑 조사" });

  game.updateChapterUi();

  assert.deepEqual(rendered.map(value => value.id), [
    "false-return-resonance-time",
    "first-archivist-deletion-log",
    "core-self-division-original",
  ]);
});

test("revealing and rejecting the false return refreshes the local defense immediately", () => {
  const solved = resolveStoryInteraction(collectAllSounds(chapter12ReadyProgress()), "memory-sequence-console", {
    sequence: MEMORY_SOUND_IDS,
  }).progress;
  const game = Object.create(PixelRPG.prototype);
  game.progress = { worldProgress: solved };
  game.mapId = "sanctuary-memory-archive";
  game.enemies = [];
  game.npcs = [];
  game.ui = {};
  game.persistProgress = () => true;
  game.updateChapterUi = () => {};
  game.updateNpcPrompt = () => {};
  game.updateInventoryHud = () => {};
  game.updateBlacksmithHud = () => {};

  assert.equal(game.applyStoryInteraction("truth-core-self-division"), true);
  assert.equal(game.enemies.length, 3);
  assert.ok(game.enemies.every(value => value.kind === "memory-noise"));
  assert.equal(game.applyStoryInteraction("false-return-resonance-time"), true);
  assert.equal(game.enemies.length, 3);
  assert.equal(game.applyStoryInteraction("false-return-garen-unscarred"), true);
  assert.equal(game.enemies.length, 3);
  assert.equal(game.applyStoryInteraction("false-return-source-erased"), true);
  assert.deepEqual(game.enemies, []);
});

test("a failed browser save rolls the local defense back with chapter progress", () => {
  const solved = resolveStoryInteraction(collectAllSounds(chapter12ReadyProgress()), "memory-sequence-console", {
    sequence: MEMORY_SOUND_IDS,
  }).progress;
  const game = Object.create(PixelRPG.prototype);
  game.progress = { worldProgress: solved };
  game.mapId = "sanctuary-memory-archive";
  game.enemies = [];
  game.npcs = [];
  game.ui = {};
  game.persistProgress = () => false;
  game.updateChapterUi = () => {};
  game.updateNpcPrompt = () => {};
  game.updateInventoryHud = () => {};
  game.updateBlacksmithHud = () => {};

  assert.equal(game.applyStoryInteraction("truth-core-self-division"), false);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.coreTruthRevealed, false);
  assert.deepEqual(game.enemies, []);
});

test("all six fields are required and Lumen is not the core split cause", () => {
  let progress = returnRecordReadyProgress("rescued");
  for (const fieldId of RECORD_FIELD_IDS) {
    progress = progressSanctuary(progress, {
      type: "complete-record-field",
      fieldId,
      answerId: answerForRecordField(fieldId, "rescued").id,
    }).progress;
  }
  const linked = progressSanctuary(progress, { type: "link-correction" }).progress;
  assert.equal(linked.chapters.sanctuary.correctionLinked, true);
  assert.equal(
    answerForRecordField("core-division-cause", "rescued").id,
    "conflicting-records-self-division",
  );
  assert.notEqual(
    answerForRecordField("delay-lumen", "rescued").id,
    answerForRecordField("core-division-cause", "rescued").id,
  );
  assert.equal(collectRecordArchiveEntries({
    coastRecords: [],
    sanctuaryRecords: getCollectedSanctuaryRecords(linked),
  }).some(value => value.id === "first-archivist-deletion-log"), true);
});

test("rescued and lost records use distinct Lumen sources without changing the facts", () => {
  const field = interaction("delay-lumen");
  const rescued = storyDialogueModel(field, returnRecordReadyProgress("rescued"));
  const lost = storyDialogueModel(field, returnRecordReadyProgress("lost"));

  assert.equal(rescued.actions.length >= 2, true);
  assert.deepEqual(rescued.actions.map(value => value.id), lost.actions.map(value => value.id));
  assert.match(rescued.pages.join(" "), /현재 생존한 루멘의 증언/);
  assert.match(lost.pages.join(" "), /미전송 철수 명령서/);
  assert.match(lost.pages.join(" "), /잔류 기억/);
  assert.doesNotMatch(lost.pages.join(" "), /유령|되살아|현재 생존한 루멘/);
  assert.equal(
    answerForRecordField("delay-lumen", "rescued").id,
    answerForRecordField("delay-lumen", "lost").id,
  );
});

test("game record answer actions validate a field and keep an incomplete answer retryable", () => {
  const game = Object.create(PixelRPG.prototype);
  game.progress = { worldProgress: returnRecordReadyProgress("lost") };
  game.pendingStoryInteraction = interaction("delay-lumen");
  game.npcs = [];
  game.ui = {};
  game.mapId = "sanctuary-return-record";
  game.persistProgress = () => true;
  game.updateChapterUi = () => {};
  game.updateNpcPrompt = () => {};
  game.updateInventoryHud = () => {};
  game.updateBlacksmithHud = () => {};
  let closed = 0;
  game.dialogue = { open() {}, actionButtons() { return []; } };
  game.closeNpcDialogue = () => { closed += 1; };
  game.notify = () => {};

  game.handleDialogueAction("story-record-answer-lumen-broke-core-alone");
  assert.equal(closed, 0);
  assert.deepEqual(game.progress.worldProgress.chapters.sanctuary.completedRecordFieldIds, []);

  game.handleDialogueAction(`story-record-answer-${answerForRecordField("delay-lumen", "lost").id}`);
  assert.equal(closed, 1);
  assert.deepEqual(game.progress.worldProgress.chapters.sanctuary.completedRecordFieldIds, ["delay-lumen"]);
});

test("rescued and lost Chorus branches preserve access while presenting Lumen differently", () => {
  assert.equal(typeof sanctuaryStory.chorusBranchPresentation, "function");
  const rescued = sanctuaryStory.chorusBranchPresentation("rescued");
  const lost = sanctuaryStory.chorusBranchPresentation("lost");

  assert.equal(rescued.lumen.mode, "live-voice");
  assert.equal(rescued.lumen.presentActor, false);
  assert.equal(rescued.lumen.interruptionId, "false-order-interrupt");
  assert.equal(lost.lumen.mode, "unsent-order");
  assert.equal(lost.lumen.presentActor, false);
  assert.deepEqual(lost.lumen.sourceRecordIds, ["lumen-unsent-retreat-order", "lumen-residual-memory"]);
  assert.deepEqual(rescued.completionAccess, lost.completionAccess);
  assert.deepEqual(lost.completionAccess, {
    hiddenWeaponRequired: false,
    endingIds: ["seal", "restore", "release"],
    rewardProfileId: "sanctuary-standard",
  });
});

test("lost Chorus dialogue exposes records instead of an assist or resurrected Lumen", () => {
  assert.equal(typeof sanctuaryDialogue.chorusBranchDialogueModel, "function");
  const rescued = sanctuaryDialogue.chorusBranchDialogueModel("rescued", {
    phase: "anchors",
    hiddenWeaponOwned: true,
    lumenAssistUsed: false,
  });
  const lost = sanctuaryDialogue.chorusBranchDialogueModel("lost", {
    phase: "anchors",
    hiddenWeaponOwned: true,
    lumenAssistUsed: false,
  });

  assert.deepEqual(rescued.actions, [{ id: "chorus-lumen-assist", label: "루멘의 기록 닻 안정화" }]);
  assert.equal(rescued.title, "루멘의 생존 통신");
  assert.deepEqual(lost.actions, []);
  assert.match(lost.pages.join(" "), /미전송 철수 명령서/);
  assert.match(lost.pages.join(" "), /잔류 기억/);
  assert.doesNotMatch(lost.pages.join(" "), /현재 생존한 루멘|되살아|부활/);
});
