import test from "node:test";
import assert from "node:assert/strict";
import { WORLD_IDS } from "../src/world-data.js";
import * as worldModule from "../src/world.js";

test("네 지역 배경은 절반 해상도로 한 번씩 사전 렌더링하고 이후 같은 객체를 재사용한다", async () => {
  const { createWorldLayer, prewarmWorldLayers } = worldModule;
  assert.equal(typeof createWorldLayer, "function");
  assert.equal(typeof prewarmWorldLayers, "function");

  const harness = canvasHarness();
  const previousDocument = globalThis.document;
  globalThis.document = harness.document;

  try {
    const layers = await prewarmWorldLayers({ yieldControl: async () => {} });

    assert.deepEqual([...layers.keys()], WORLD_IDS);
    assert.equal(harness.canvases.length, 4);
    assert.deepEqual(
      [...layers.values()].map(layer => [layer.width, layer.height]),
      [[1440, 900], [2160, 1800], [2160, 1800], [2160, 1800]],
    );
    for (const canvas of harness.canvases) {
      assert.deepEqual(canvas.context.scaleCalls, [[0.5, 0.5]]);
      assert.equal(canvas.context.imageSmoothingEnabled, false);
    }

    const coast = createWorldLayer("coast");
    assert.equal(coast, layers.get("coast"));
    assert.equal(harness.canvases.length, 4);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("절반 해상도 배경은 카메라 월드 좌표를 절반으로 읽고 화면 크기는 그대로 그린다", () => {
  const { drawWorldLayerViewport } = worldModule;
  assert.equal(typeof drawWorldLayerViewport, "function");
  const calls = [];
  const context = { drawImage: (...args) => calls.push(args) };
  const layer = { width: 2160, height: 1800 };

  drawWorldLayerViewport(context, layer, "coast", {
    cameraX: 120,
    cameraY: 240,
    width: 800,
    height: 600,
  });

  assert.deepEqual(calls, [[layer, 60, 120, 400, 300, 0, 0, 800, 600]]);
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
  return {
    imageSmoothingEnabled: true,
    scaleCalls: [],
    scale(x, y) { this.scaleCalls.push([x, y]); },
    fillRect() {},
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
