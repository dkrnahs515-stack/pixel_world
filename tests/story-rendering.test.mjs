import test from "node:test";
import assert from "node:assert/strict";
import {
  drawInvestigationZone,
  drawStorySignal,
  getStoryRenderablesForMap,
} from "../src/world-20260829-coast.js";
import { appendStorySignalEntities, PixelRPG } from "../src/game-20260902-publish.js";
import {
  collectChapterRecord,
  completeRegion,
  createInitialWorldProgress,
  repairChapterDevice,
} from "../src/chapter-progress-20260829-coast.js";

function commandContext() {
  const calls = [];
  let fillStyle = "";
  let strokeStyle = "";
  let lineWidth = 1;
  return {
    calls,
    save() { calls.push({ type: "save" }); },
    restore() { calls.push({ type: "restore" }); },
    beginPath() { calls.push({ type: "beginPath" }); },
    moveTo(x, y) { calls.push({ type: "moveTo", x, y }); },
    lineTo(x, y) { calls.push({ type: "lineTo", x, y }); },
    arc(x, y, radius, start, end) { calls.push({ type: "arc", x, y, radius, start, end }); },
    stroke() { calls.push({ type: "stroke", strokeStyle, lineWidth }); },
    fillRect(x, y, width, height) { calls.push({ type: "fillRect", fillStyle, x, y, width, height }); },
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
    set strokeStyle(value) { strokeStyle = value; },
    get strokeStyle() { return strokeStyle; },
    set lineWidth(value) { lineWidth = value; },
    get lineWidth() { return lineWidth; },
  };
}

test("Echo signal uses a pixel face and a camera-relative waveform", () => {
  const context = commandContext();

  drawStorySignal(context, { actorId: "echo", x: 100, y: 200 }, 20, 40);

  assert.deepEqual(context.calls.find(call => call.type === "moveTo"), { type: "moveTo", x: 52, y: 160 });
  assert.ok(context.calls.some(call => call.type === "lineTo" && call.x === 108 && call.y === 160));
  assert.ok(context.calls.some(call => call.type === "fillRect"
    && call.fillStyle === "#b8f8ff" && call.x === 68 && call.y === 142 && call.width === 24 && call.height === 20));
  assert.equal(context.calls.filter(call => call.type === "fillRect" && call.fillStyle === "#163e5e").length, 2);
});

test("investigation guidance draws only broad concentric zone rings, not an exact target beacon", () => {
  const context = commandContext();

  drawInvestigationZone(context, { x: 1200, y: 780, radius: 220 }, 1000, 600);

  assert.deepEqual(
    context.calls.filter(call => call.type === "arc").map(call => [call.x, call.y, call.radius]),
    [[200, 180, 220], [200, 180, 154]],
  );
  assert.equal(context.calls.some(call => call.type === "fillRect"), false);
  assert.equal(context.calls.filter(call => call.type === "stroke").every(call => call.lineWidth === 3), true);
});

test("coast rendering data keeps signals and objective guidance map-scoped", () => {
  const progress = completeRegion(createInitialWorldProgress(), "forest").progress;
  const beach = getStoryRenderablesForMap("coast-beach", progress);
  const village = getStoryRenderablesForMap("village", progress);

  assert.deepEqual(beach.signals, [{ actorId: "echo", x: 1120, y: 720 }]);
  assert.deepEqual(beach.objective, { x: 1200, y: 780, radius: 220 });
  assert.deepEqual(village, { signals: [], objective: null });
});

test("only the current incomplete map exposes an investigation zone on revisit", () => {
  let progress = completeRegion(createInitialWorldProgress(), "forest").progress;
  assert.deepEqual(getStoryRenderablesForMap("coast-beach", progress).objective, {
    x: 1200,
    y: 780,
    radius: 220,
  });

  progress = repairChapterDevice(progress, "coast-beach-transceiver").progress;
  assert.notEqual(getStoryRenderablesForMap("coast-beach", progress).objective, null);
  progress = collectChapterRecord(progress, "sera-distress-current").progress;

  assert.equal(getStoryRenderablesForMap("coast-beach", progress).objective, null);
  assert.deepEqual(getStoryRenderablesForMap("coast-wreck-bay", progress).objective, {
    x: 1080,
    y: 860,
    radius: 250,
  });

  progress.completedRegionIds.push("coast");
  progress.chapters.coast.coreFragmentObtained = true;
  for (const mapId of ["coast-beach", "coast-wreck-bay", "coast-flooded-station", "coast-tide-core-cave"]) {
    assert.equal(getStoryRenderablesForMap(mapId, progress).objective, null, mapId);
  }
});

test("minimap scales the current broad investigation zone and removes it after objective progress", () => {
  const calls = [];
  const context = {
    imageSmoothingEnabled: true,
    clearRect() {},
    drawImage() {},
    fillRect() {},
    putImageData() {},
    save() {},
    restore() {},
    beginPath() {},
    stroke() {},
    ellipse(x, y, radiusX, radiusY) { calls.push({ x, y, radiusX, radiusY }); },
    set fillStyle(_value) {},
    set strokeStyle(_value) {},
    set lineWidth(_value) {},
  };
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "coast-beach";
  game.worldLayer = { width: 1080, height: 900 };
  game.minimap = { width: 160, height: 100 };
  game.minimapCtx = context;
  game.minimapBaseImage = null;
  game.lastMinimapRender = Number.NEGATIVE_INFINITY;
  game.enemies = [];
  game.remotePlayers = new Map();
  game.player = { x: 100, y: 100 };
  game.progress = { worldProgress: completeRegion(createInitialWorldProgress(), "forest").progress };

  game.renderMinimap(0);

  assert.equal(calls.length, 2);
  assert.ok(Math.abs(calls[0].x - 88.8889) < 0.001);
  assert.ok(Math.abs(calls[0].y - 43.3333) < 0.001);
  assert.ok(Math.abs(calls[0].radiusX - 16.2963) < 0.001);
  assert.ok(Math.abs(calls[0].radiusY - 12.2222) < 0.001);

  game.progress.worldProgress = collectChapterRecord(
    repairChapterDevice(game.progress.worldProgress, "coast-beach-transceiver").progress,
    "sera-distress-current",
  ).progress;
  calls.length = 0;
  game.renderMinimap(1_000);
  assert.deepEqual(calls, []);
});

test("Echo signal enters the existing y-sorted entity list without becoming an NPC", () => {
  const entities = [{ entityType: "player", x: 800, y: 800 }];

  appendStorySignalEntities(entities, getStoryRenderablesForMap("coast-beach", completeRegion(createInitialWorldProgress(), "forest").progress));

  assert.deepEqual(entities, [
    { entityType: "player", x: 800, y: 800 },
    { entityType: "story-signal", signal: { actorId: "echo", x: 1120, y: 720 }, x: 1120, y: 720 },
  ]);
});
