import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceVolcanoEruption,
  createVolcanoEruptionState,
  drawVolcanoEruption,
} from "../src/volcano-eruption-20260903-volcano-20260905-upgrade.js";

const context = (overrides = {}) => ({
  active: true,
  paused: false,
  player: { x: 1000, y: 900, dir: "right" },
  world: { width: 2160, height: 1800 },
  ...overrides,
});

test("the eight-second eruption cycle locks a forward target and emits one impact", () => {
  const warning = advanceVolcanoEruption(createVolcanoEruptionState(), 5.5, context());
  assert.equal(warning.state.phase, "warning");
  assert.deepEqual(warning.state.target, { x: 1150, y: 900 });
  assert.deepEqual(warning.events, []);

  const impact = advanceVolcanoEruption(warning.state, 1.5, context({
    player: { x: 300, y: 300, dir: "left" },
  }));
  assert.equal(impact.state.phase, "impact");
  assert.deepEqual(impact.state.target, { x: 1150, y: 900 });
  assert.deepEqual(impact.events, [{
    type: "eruption-impact", damage: 20, radius: 110, x: 1150, y: 900,
  }]);

  const recovery = advanceVolcanoEruption(impact.state, 0.5, context());
  assert.equal(recovery.state.phase, "recovery");
  assert.deepEqual(recovery.events, []);
  const reset = advanceVolcanoEruption(recovery.state, 0.5, context());
  assert.equal(reset.state.phase, "idle");
  assert.equal(reset.state.target, null);
  assert.deepEqual(reset.events, []);
});

test("warning targets are clamped so the full 110px impact fits inside the world", () => {
  const upperLeft = advanceVolcanoEruption(createVolcanoEruptionState(), 5.5, context({
    player: { x: 20, y: 20, dir: "left" },
  }));
  assert.deepEqual(upperLeft.state.target, { x: 110, y: 110 });

  const lowerRight = advanceVolcanoEruption(createVolcanoEruptionState(), 5.5, context({
    player: { x: 2140, y: 1780, dir: "down" },
  }));
  assert.deepEqual(lowerRight.state.target, { x: 2050, y: 1690 });
});

test("large deterministic steps consume complete cycles without duplicate impacts", () => {
  const tick = advanceVolcanoEruption(createVolcanoEruptionState(), 16, context());
  assert.equal(tick.state.phase, "idle");
  assert.equal(tick.state.cycle, 2);
  assert.equal(tick.events.length, 2);
  assert.deepEqual(tick.events[0], {
    type: "eruption-impact", damage: 20, radius: 110, x: 1150, y: 900,
  });
  assert.deepEqual(tick.events[1], tick.events[0]);
});

test("inactive and paused hazards preserve the exact local state", () => {
  const warning = advanceVolcanoEruption(createVolcanoEruptionState(), 5.5, context()).state;
  const inactive = advanceVolcanoEruption(warning, 20, context({ active: false }));
  const paused = advanceVolcanoEruption(warning, 20, context({ paused: true }));
  assert.strictEqual(inactive.state, warning);
  assert.strictEqual(paused.state, warning);
  assert.deepEqual(inactive.events, []);
  assert.deepEqual(paused.events, []);
});

function recordingContext() {
  const arcs = [];
  const fills = [];
  const ctx = new Proxy({ arcs, fills }, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === "arc") return (...args) => arcs.push(args);
      if (property === "fillRect") return (...args) => fills.push(args);
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
  return ctx;
}

test("canvas telegraph draws the warning radius in camera space and recovery debris", () => {
  const ctx = recordingContext();
  const warning = advanceVolcanoEruption(createVolcanoEruptionState(), 5.5, context()).state;
  drawVolcanoEruption(ctx, warning, { cameraX: 100, cameraY: 200, active: true });
  assert.equal(ctx.arcs.some(([x, y, radius]) => x === 1050 && y === 700 && radius === 110), true);

  const impact = advanceVolcanoEruption(warning, 1.5, context()).state;
  const recovery = advanceVolcanoEruption(impact, 0.25, context()).state;
  drawVolcanoEruption(ctx, recovery, { cameraX: 100, cameraY: 200, active: true });
  assert.equal(ctx.fills.length > 0, true);

  const idleCtx = recordingContext();
  drawVolcanoEruption(idleCtx, createVolcanoEruptionState(), { active: true });
  assert.deepEqual(idleCtx.arcs, []);
  assert.deepEqual(idleCtx.fills, []);
});
