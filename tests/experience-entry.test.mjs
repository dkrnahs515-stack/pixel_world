import test from "node:test";
import assert from "node:assert/strict";

import { bindExperienceSelector } from "../src/experience-entry.js";

function createElement({ hidden = false } = {}) {
  const element = new EventTarget();
  element.hidden = hidden;
  element.focusCount = 0;
  element.focus = () => {
    element.focusCount += 1;
  };
  return element;
}

function createSelector() {
  return {
    experienceOverlay: createElement(),
    entryOverlay: createElement({ hidden: true }),
    rpgExperienceButton: createElement(),
    returnToExperienceButton: createElement(),
    nicknameInput: createElement(),
  };
}

test("RPG choice opens registration and focuses the nickname input", () => {
  const selector = createSelector();
  bindExperienceSelector(selector);

  selector.rpgExperienceButton.dispatchEvent(new Event("click"));

  assert.equal(selector.experienceOverlay.hidden, true);
  assert.equal(selector.entryOverlay.hidden, false);
  assert.equal(selector.nicknameInput.focusCount, 1);
});

test("return choice restores the experience selector and focuses the RPG choice", () => {
  const selector = createSelector();
  selector.experienceOverlay.hidden = true;
  selector.entryOverlay.hidden = false;
  bindExperienceSelector(selector);

  selector.returnToExperienceButton.dispatchEvent(new Event("click"));

  assert.equal(selector.entryOverlay.hidden, true);
  assert.equal(selector.experienceOverlay.hidden, false);
  assert.equal(selector.rpgExperienceButton.focusCount, 1);
});

test("cleanup stops selector clicks from changing overlays or focus", () => {
  const selector = createSelector();
  const cleanup = bindExperienceSelector(selector);
  cleanup();

  selector.rpgExperienceButton.dispatchEvent(new Event("click"));
  selector.returnToExperienceButton.dispatchEvent(new Event("click"));

  assert.equal(selector.experienceOverlay.hidden, false);
  assert.equal(selector.entryOverlay.hidden, true);
  assert.equal(selector.nicknameInput.focusCount, 0);
  assert.equal(selector.rpgExperienceButton.focusCount, 0);
});

test("a missing required element names its field in a TypeError", () => {
  const selector = createSelector();
  selector.nicknameInput = null;

  assert.throws(() => bindExperienceSelector(selector), {
    name: "TypeError",
    message: /nicknameInput/,
  });
});
