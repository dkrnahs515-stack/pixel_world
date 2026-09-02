import test from "node:test";
import assert from "node:assert/strict";
import {
  COAST_SUPPORT_FOLLOW_UPS,
  coastActorDialogueModel,
  coastStoryDialogueModel,
} from "../src/story-dialogue-20260829-coast.js";
import { completeRegion, chooseChapterSupport } from "../src/chapter-progress-20260829-coast.js";
import { COAST_STORY_INTERACTIONS } from "../src/coast-story-data-20260829-coast.js";
import { createInitialWorldProgress } from "../src/chapter-progress-20260829-coast.js";

function selected(choice) {
  const progress = completeRegion(createInitialWorldProgress(), "forest").progress;
  progress.unlockedMapIds.push("coast-wreck-bay", "coast-flooded-station");
  progress.chapters.coast.repairedDeviceIds.push("flooded-station-main-transceiver");
  progress.chapters.coast.collectedRecordIds.push("flooded-station-deleted-record");
  return chooseChapterSupport(progress, choice).progress;
}

test("story interaction dialogue exposes stable record classification and support action IDs", () => {
  const record = COAST_STORY_INTERACTIONS.find(interaction => interaction.id === "sera-distress-current");
  const support = COAST_STORY_INTERACTIONS.find(interaction => interaction.id === "flooded-station-support");
  assert.deepEqual(coastStoryDialogueModel(record).actions.map(action => action.id), [
    "story-classify-current",
    "story-classify-past",
  ]);
  assert.deepEqual(coastStoryDialogueModel(support).actions.map(action => action.id), [
    "story-support-sera",
    "story-support-echo",
    "story-support-mari",
  ]);
});

test("support choice changes only the approved follow-up line for Mari, Sera and Echo", () => {
  for (const actorId of ["mari", "sera", "echo"]) {
    const models = Object.fromEntries(["sera", "echo", "mari"].map(choice => [
      choice,
      coastActorDialogueModel(actorId, selected(choice)),
    ]));
    assert.equal(models.sera.title, models.echo.title);
    assert.equal(models.echo.title, models.mari.title);
    assert.deepEqual(models.sera.actions, models.echo.actions);
    assert.deepEqual(models.echo.actions, models.mari.actions);
    assert.equal(models.sera.pages[0], models.echo.pages[0]);
    assert.equal(models.echo.pages[0], models.mari.pages[0]);
    for (const choice of ["sera", "echo", "mari"]) {
      assert.equal(models[choice].pages.length, 2);
      assert.equal(models[choice].pages[1], COAST_SUPPORT_FOLLOW_UPS[choice][actorId]);
    }
  }
});

test("without a support decision actor dialogue has no choice-dependent line", () => {
  const initial = createInitialWorldProgress();
  for (const actorId of ["mari", "sera", "echo"]) {
    const model = coastActorDialogueModel(actorId, initial);
    assert.equal(model.pages.length, 1);
    assert.deepEqual(model.actions, [{ id: "story-close", label: "대화 마치기" }]);
  }
});
