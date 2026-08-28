import test from "node:test";
import assert from "node:assert/strict";
import { drawExplosionEffect, drawProjectile } from "../src/projectile-rendering.js";

function recordingContext() {
  const calls = [];
  const stack = [];
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    save() { stack.push(this.globalAlpha); calls.push(["save"]); },
    restore() { this.globalAlpha = stack.pop(); calls.push(["restore"]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    fillRect(...args) { calls.push(["fillRect", this.fillStyle, ...args]); },
    beginPath() { calls.push(["beginPath"]); },
    arc(...args) { calls.push(["arc", this.fillStyle, this.strokeStyle, ...args]); },
    fill() { calls.push(["fill", this.fillStyle, this.globalAlpha]); },
    stroke() { calls.push(["stroke", this.strokeStyle, this.lineWidth, this.globalAlpha]); },
  };
}

const projectile = (kind, overrides = {}) => ({
  kind,
  prevX: 20,
  prevY: 40,
  x: 100,
  y: 80,
  directionX: 1,
  directionY: 0,
  ...overrides,
});

test("네 투사체는 보간 좌표와 서로 다른 색·형태를 사용한다", () => {
  const contexts = new Map();
  for (const kind of ["arrow", "piercing-arrow", "magic-bolt", "explosive-bolt"]) {
    const context = recordingContext();
    assert.equal(drawProjectile(context, projectile(kind), {
      alpha: 0.25,
      cameraX: 5,
      cameraY: 10,
      viewWidth: 300,
      viewHeight: 200,
    }), true);
    assert.ok(context.calls.some(call => call[0] === "translate" && call[1] === 35 && call[2] === 40));
    contexts.set(kind, context.calls);
  }
  assert.notDeepEqual(contexts.get("arrow"), contexts.get("piercing-arrow"));
  assert.notDeepEqual(contexts.get("magic-bolt"), contexts.get("explosive-bolt"));
  assert.ok(contexts.get("arrow").some(call => call[1] === "#d6b16f"));
  assert.ok(contexts.get("piercing-arrow").some(call => call[1] === "#f4c95d"));
  assert.ok(contexts.get("magic-bolt").some(call => call[1] === "#7dd3fc"));
  assert.ok(contexts.get("explosive-bolt").some(call => call[1] === "#f0abfc"));
});

test("카메라 밖 투사체는 그리지 않는다", () => {
  const context = recordingContext();
  assert.equal(drawProjectile(context, projectile("arrow", { prevX: 500, x: 520 }), {
    alpha: 1,
    viewWidth: 200,
    viewHeight: 100,
  }), false);
  assert.deepEqual(context.calls, []);
});

test("폭발 효과는 승인 반경과 남은 수명에 따른 투명도로 그린다", () => {
  const context = recordingContext();
  assert.equal(drawExplosionEffect(context, {
    x: 160,
    y: 90,
    radius: 144,
    age: 0.175,
    duration: 0.35,
  }, { cameraX: 10, cameraY: 20, scale: 0.5 }), true);
  assert.ok(context.calls.some(call => call[0] === "arc" && call[5] === 72));
  assert.ok(context.calls.some(call => call[0] === "fill" && Math.abs(call.at(-1) - 0.5) < 1e-9));

  const expired = recordingContext();
  assert.equal(drawExplosionEffect(expired, {
    x: 0, y: 0, radius: 100, age: 0.35, duration: 0.35,
  }), false);
  assert.deepEqual(expired.calls, []);
});
