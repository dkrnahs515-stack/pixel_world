import test from "node:test";
import assert from "node:assert/strict";
import { SanctuaryEndingController } from "../src/sanctuary-ending-controller-20260910-sanctuary.js";

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const setTimer = (callback, delay) => {
    const id = nextId++;
    timers.set(id, { at: now + delay, callback });
    return id;
  };
  const clearTimer = id => timers.delete(id);
  const advance = ms => {
    const target = now + ms;
    while (true) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, timer] = due;
      timers.delete(id);
      now = timer.at;
      timer.callback();
    }
    now = target;
  };
  return { get now() { return now; }, setTimer, clearTimer, advance };
}

test("credits last 30s and skip unlocks only at 5s", () => {
  const clock = fakeClock();
  let postCreditPlayed = false;
  let completed = false;
  const controller = new SanctuaryEndingController({
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onPostCredit: () => { postCreditPlayed = true; },
    onCreditsComplete: () => { completed = true; },
  });
  controller.startCredits({ lines: ["PIXEL WORLD"], durationMs: 30_000, skipAfterMs: 5_000 }, { lines: ["UNKNOWN"] });
  clock.advance(4_999);
  assert.equal(controller.skipCredits(), false);
  assert.equal(postCreditPlayed, false);
  clock.advance(1);
  assert.equal(controller.skipCredits(), true);
  assert.equal(postCreditPlayed, true);
  assert.equal(completed, false);
  clock.advance(2_000);
  assert.equal(completed, true);
});

test("natural credit completion also passes through post-credit", () => {
  const clock = fakeClock();
  const events = [];
  const controller = new SanctuaryEndingController({
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onPostCredit: () => events.push("post"),
    onCreditsComplete: () => events.push("done"),
  });
  controller.startCredits({ lines: [], durationMs: 30_000, skipAfterMs: 5_000 }, { lines: [] });
  clock.advance(29_999);
  assert.deepEqual(events, []);
  clock.advance(1);
  assert.deepEqual(events, ["post"]);
  clock.advance(2_000);
  assert.deepEqual(events, ["post", "done"]);
});

test("defer closes choice without choosing an ending", () => {
  const events = [];
  const controller = new SanctuaryEndingController({ onDefer: () => events.push("defer") });
  controller.openChoice({ choices: [], deferAllowed: true });
  assert.equal(controller.active, true);
  assert.equal(controller.defer(), true);
  assert.equal(controller.active, false);
  assert.deepEqual(events, ["defer"]);
});

test("ending choice requires explicit second confirmation", () => {
  const choices = [];
  const controller = new SanctuaryEndingController({ onChoose: id => choices.push(id) });
  controller.openChoice({
    choices: [
      { id: "restore", unlocked: true, reason: null },
      { id: "resonate", unlocked: false, reason: "origin_records_3_required" },
    ],
    deferAllowed: true,
  });
  assert.equal(controller.requestChoice("resonate"), false);
  assert.equal(controller.requestChoice("restore"), true);
  assert.equal(controller.pendingChoice, "restore");
  assert.deepEqual(choices, []);
  assert.equal(controller.cancelChoice(), true);
  assert.equal(controller.pendingChoice, null);
  assert.equal(controller.requestChoice("restore"), true);
  assert.equal(controller.confirmChoice(), true);
  assert.deepEqual(choices, ["restore"]);
});
