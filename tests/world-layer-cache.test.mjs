import test from "node:test";
import assert from "node:assert/strict";
import { WORLD_IDS } from "../src/world-data-20260829-coast-20260905-upgrade.js";
import * as worldModule from "../src/world-20260829-coast-20260905-upgrade.js";
import * as sanctuaryWorldModule from "../src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { SANCTUARY_CASKETS } from "../src/sanctuary-world-data-20260911-sanctuary.js";

test("일곱 물리 맵 배경은 절반 해상도로 한 번씩 사전 렌더링하고 이후 같은 객체를 재사용한다", async () => {
  const { createWorldLayer, prewarmWorldLayers } = worldModule;
  assert.equal(typeof createWorldLayer, "function");
  assert.equal(typeof prewarmWorldLayers, "function");

  const harness = canvasHarness();
  const previousDocument = globalThis.document;
  globalThis.document = harness.document;

  try {
    const layers = await prewarmWorldLayers({ yieldControl: async () => {} });

    assert.deepEqual([...layers.keys()], WORLD_IDS);
    assert.equal(harness.canvases.length, 7);
    assert.deepEqual(
      [...layers.values()].map(layer => [layer.width, layer.height]),
      [
        [1440, 900], [2160, 1800], [2160, 1800],
        [1080, 900], [1080, 900], [1080, 900], [1080, 900],
      ],
    );
    for (const canvas of harness.canvases) {
      assert.deepEqual(canvas.context.scaleCalls, [[0.5, 0.5]]);
      assert.equal(canvas.context.imageSmoothingEnabled, false);
    }

    const coastBeach = createWorldLayer("coast");
    assert.equal(coastBeach, layers.get("coast-beach"));
    assert.equal(harness.canvases.length, 7);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("절반 해상도 배경은 카메라 월드 좌표를 절반으로 읽고 화면 크기는 그대로 그린다", () => {
  const { drawWorldLayerViewport } = worldModule;
  assert.equal(typeof drawWorldLayerViewport, "function");
  const calls = [];
  const context = { drawImage: (...args) => calls.push(args) };
  const layer = { width: 1080, height: 900 };

  drawWorldLayerViewport(context, layer, "coast-beach", {
    cameraX: 120,
    cameraY: 240,
    width: 800,
    height: 600,
  });

  assert.deepEqual(calls, [[layer, 60, 120, 400, 300, 0, 0, 800, 600]]);
});

test("대장간 시설은 모루·화로·세 자루 무기 진열대를 정적 레이어에 그린다", () => {
  const calls = [];
  let fillStyle = "";
  const context = {
    fillRect(x, y, width, height) { calls.push({ fillStyle, x, y, width, height }); },
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
  };
  worldModule.drawForgeDetails(context, 2460, 890);
  assert.ok(calls.some(call => call.fillStyle === "#4b5563" && call.width >= 40));
  assert.ok(calls.some(call => call.fillStyle === "#dc2626"));
  assert.ok(calls.some(call => call.fillStyle === "#f97316"));
  assert.equal(calls.filter(call => call.fillStyle === "#dceeff").length, 3);
  assert.ok(calls.every(call => call.x >= 2340 && call.x <= 2570));
});

test("성역 입구 정적 레이어는 세 코어 봉인함과 청록 벽을 실제로 그린다", () => {
  const harness = canvasHarness();
  const previousDocument = globalThis.document;
  globalThis.document = harness.document;

  try {
    sanctuaryWorldModule.createWorldLayer("sanctuary");
    const context = harness.canvases[0].context;
    const casketAccents = context.fillCalls.filter(call => SANCTUARY_CASKETS.some(casket => (
      call.fillStyle === casket.color && call.x === casket.x - 24 && call.y === casket.y - 14
    )));
    assert.deepEqual(
      casketAccents.map(call => call.fillStyle),
      ["#4ade80", "#38bdf8", "#fb923c"],
    );
    assert.equal(context.fillCalls.some(call => call.fillStyle === "#273454"), false);
    assert.ok(context.fillCalls.some(call => call.fillStyle === "#67e8f9"));
  } finally {
    globalThis.document = previousDocument;
  }
});

function canvasHarness() {
  const canvases = [];
  return {
    canvases,
    document: {
      createElement(tagName) {
        assert.equal(tagName, "canvas");
        const context = drawingContext();
        const canvas = {
          width: 0,
          height: 0,
          context,
          getContext(kind, options) {
            assert.equal(kind, "2d");
            assert.deepEqual(options, { alpha: false });
            return context;
          },
        };
        canvases.push(canvas);
        return canvas;
      },
    },
  };
}

function drawingContext() {
  let fillStyle = "";
  let strokeStyle = "";
  return {
    imageSmoothingEnabled: true,
    scaleCalls: [],
    fillCalls: [],
    strokeCalls: [],
    scale(x, y) { this.scaleCalls.push([x, y]); },
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
    set strokeStyle(value) { strokeStyle = value; },
    get strokeStyle() { return strokeStyle; },
    fillRect(x, y, width, height) { this.fillCalls.push({ fillStyle, x, y, width, height }); },
    strokeRect(x, y, width, height) { this.strokeCalls.push({ strokeStyle, x, y, width, height }); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    arc() {},
    ellipse() {},
    fill() {},
    stroke() {},
    fillText() {},
  };
}
