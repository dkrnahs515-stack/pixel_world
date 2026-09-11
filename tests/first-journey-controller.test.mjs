import test from "node:test";
import assert from "node:assert/strict";
import {
  FIRST_JOURNEY_SCRIPT,
  FIRST_JOURNEY_TIMING,
} from "../src/first-journey-script-20260910-sanctuary.js";
import { FirstJourneyController } from "../src/first-journey-controller-20260910-sanctuary.js";

function fakeElement() {
  return {
    hidden: true,
    disabled: false,
    textContent: "",
    focused: false,
    blurred: false,
    focus() { this.focused = true; this.blurred = false; },
    blur() { this.focused = false; this.blurred = true; },
  };
}

function fakeScheduler() {
  let now = 0;
  let nextId = 1;
  const jobs = new Map();
  return {
    setTimeout(fn, delay) {
      const id = nextId++;
      jobs.set(id, { at: now + delay, fn });
      return id;
    },
    clearTimeout(id) { jobs.delete(id); },
    tick(ms) {
      const end = now + ms;
      while (true) {
        const due = [...jobs.entries()]
          .filter(([, job]) => job.at <= end)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        const [id, job] = due;
        jobs.delete(id);
        now = job.at;
        job.fn();
      }
      now = end;
    },
  };
}

function createHarness({ reducedMotion = false } = {}) {
  const overlay = fakeElement();
  const text = fakeElement();
  const continueButton = fakeElement();
  const skipButton = fakeElement();
  const scheduler = fakeScheduler();
  const completions = [];
  const controller = new FirstJourneyController({
    overlay,
    text,
    continueButton,
    skipButton,
    reducedMotion,
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout,
    onComplete: result => completions.push(result),
  });
  return { controller, overlay, text, continueButton, skipButton, scheduler, completions };
}

test("first journey script keeps the spoiler-safe three system headings and final tagline", () => {
  const headings = FIRST_JOURNEY_SCRIPT.frames
    .filter(frame => frame.kind === "system")
    .map(frame => frame.heading);
  assert.deepEqual(headings, [
    "[SYSTEM // WORLD DATA ERROR]",
    "[WARNING // PIXEL CORE]",
    "[RECOVERY // RESIDUAL SIGNAL]",
  ]);
  const combined = FIRST_JOURNEY_SCRIPT.frames.map(frame => `${frame.heading || ""} ${frame.text}`).join("\n");
  assert.match(combined, /세 개의 코어 반응/);
  assert.match(combined, /왜 갈라졌는지/);
  assert.match(combined, /누가 처음.*손/);
  assert.doesNotMatch(combined, /아렌.*권한.*분리/);
  assert.doesNotMatch(combined, /선발대장.*방어 프로토콜/);
  assert.equal(
    FIRST_JOURNEY_SCRIPT.tagline,
    "조각난 데이터의 대륙, 당신의 손끝에서 세계의 형태를 되찾습니다.",
  );
});

test("default timing is 18ms per character with 800ms auto-advance", () => {
  assert.deepEqual(FIRST_JOURNEY_TIMING, {
    typingIntervalMs: 18,
    autoAdvanceDelayMs: 800,
  });
});

test("Enter and Space complete the current frame then advance it", () => {
  const { controller, text } = createHarness();
  controller.start();
  const firstFullText = controller.currentFrameText;
  assert.notEqual(text.textContent, firstFullText);

  assert.equal(controller.handleKey("Enter"), true);
  assert.equal(text.textContent, firstFullText);
  const firstIndex = controller.frameIndex;
  assert.equal(controller.handleKey("Space"), true);
  assert.equal(controller.frameIndex, firstIndex + 1);
});

test("completed frames auto-advance after 800ms", () => {
  const { controller, scheduler } = createHarness();
  controller.start();
  controller.completeCurrentFrame();
  const before = controller.frameIndex;
  scheduler.tick(799);
  assert.equal(controller.frameIndex, before);
  scheduler.tick(1);
  assert.equal(controller.frameIndex, before + 1);
});

test("Skip completes immediately and completion callback fires once", () => {
  const { controller, overlay, completions } = createHarness();
  controller.start();
  assert.equal(overlay.hidden, false);
  assert.equal(controller.skip(), true);
  assert.equal(controller.active, false);
  assert.equal(overlay.hidden, true);
  assert.deepEqual(completions, [{ skipped: true }]);
  assert.equal(controller.skip(), false);
  assert.deepEqual(completions, [{ skipped: true }]);
});

test("finishing the intro releases focus from controls inside the hidden overlay", () => {
  const { controller, continueButton, skipButton } = createHarness();
  controller.start();
  assert.equal(continueButton.focused, true);
  skipButton.focus();

  controller.skip();

  assert.equal(continueButton.focused, false);
  assert.equal(skipButton.focused, false);
  assert.equal(continueButton.blurred, true);
  assert.equal(skipButton.blurred, true);
});

test("closing an active intro also releases hidden control focus", () => {
  const { controller, continueButton, skipButton } = createHarness();
  controller.start();
  skipButton.focus();

  controller.close();

  assert.equal(continueButton.blurred, true);
  assert.equal(skipButton.blurred, true);
});

test("reduced motion renders a whole frame without per-character timing", () => {
  const { controller, text } = createHarness({ reducedMotion: true });
  controller.start();
  assert.equal(text.textContent, controller.currentFrameText);
});
