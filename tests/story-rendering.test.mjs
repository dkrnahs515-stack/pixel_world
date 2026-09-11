import test from "node:test";
import assert from "node:assert/strict";
import {
  drawInvestigationZone,
  drawStorySignal,
  getStoryRenderablesForMap,
} from "../src/world-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { appendStorySignalEntities, PixelRPG } from "../src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import {
  collectChapterRecord,
  completeRegion,
  createInitialWorldProgress,
  repairChapterDevice,
  progressSanctuary,
} from "../src/chapter-progress-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { SANCTUARY_CORE_IDS } from "../src/sanctuary-progress-20260911-sanctuary.js";
import {
  drawSanctuaryOverlays,
  updateChorusHud,
} from "../src/sanctuary-chorus-rendering-20260911-sanctuary.js";

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
    closePath() { calls.push({ type: "closePath" }); },
    arc(x, y, radius, start, end) { calls.push({ type: "arc", x, y, radius, start, end }); },
    stroke() { calls.push({ type: "stroke", strokeStyle, lineWidth }); },
    fill() { calls.push({ type: "fill", fillStyle }); },
    setLineDash(value) { calls.push({ type: "setLineDash", value }); },
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

test("chorus telegraphs and black bonds render on independently selectable layers", () => {
  const context = commandContext();
  const model = {
    active: true,
    telegraph: {
      id: "forest-root-sweep",
      shape: "rect",
      x: 900,
      y: 500,
      width: 360,
      height: 800,
      impactAt: 2000,
    },
    body: { x: 1080, y: 780, radius: 92 },
    bonds: [{ id: "roan", x1: 1080, y1: 780, x2: 700, y2: 620, vulnerable: true }],
    fragments: [{ id: "forest", x: 1000, y: 820 }],
    separated: false,
  };

  drawSanctuaryOverlays(context, model, { x: 100, y: 200 }, { layer: "telegraph", now: 1500 });
  assert.ok(context.calls.some(call => call.type === "fillRect" && call.x === 800 && call.y === 300));
  assert.equal(context.calls.some(call => call.type === "lineTo"), false);

  context.calls.length = 0;
  drawSanctuaryOverlays(context, model, { x: 100, y: 200 }, { layer: "foreground", now: 1500 });
  assert.ok(context.calls.some(call => call.type === "lineTo" && call.x === 600 && call.y === 420));
  assert.equal(context.calls.some(call => call.type === "fillRect" && call.x === 800 && call.y === 300), false);
});

test("chorus HUD exposes separate cohesion and personal contamination gauges", () => {
  const element = () => ({ textContent: "", hidden: false, style: {} });
  const elements = {
    coopBossHud: element(),
    chorusHud: element(),
    chorusCohesionText: element(),
    chorusCohesionBar: element(),
    chorusContaminationText: element(),
    chorusContaminationBar: element(),
    chorusPhaseText: element(),
  };

  assert.equal(updateChorusHud(elements, { hp: 70, maxHp: 100, phase: "testimonies" }, {
    contamination: 35,
    confusedUntil: 0,
  }, 1000), true);
  assert.equal(elements.chorusHud.hidden, false);
  assert.equal(elements.coopBossHud.hidden, true);
  assert.equal(elements.chorusCohesionText.textContent, "70 / 100");
  assert.equal(elements.chorusCohesionBar.style.transform, "scaleX(0.7)");
  assert.equal(elements.chorusContaminationText.textContent, "35 / 100");
  assert.equal(elements.chorusContaminationBar.style.transform, "scaleX(0.35)");
  assert.match(elements.chorusPhaseText.textContent, /증언/);

  updateChorusHud(elements, null, null, 1000);
  assert.equal(elements.chorusHud.hidden, true);
});

test("sanctuary memory signals render as face-free archive silhouettes", () => {
  let progress = createInitialWorldProgress();
  for (const coreId of SANCTUARY_CORE_IDS) {
    progress = progressSanctuary(progress, { type: "activate-core", coreId }).progress;
  }
  const renderables = getStoryRenderablesForMap("sanctuary-memory-archive", progress);
  const signal = renderables.signals.find(value => value.id === "departure-bell");
  assert.equal(signal.chapterId, "sanctuary");
  assert.equal(signal.visualVariant, "architecture");

  const context = commandContext();
  drawStorySignal(context, signal, 0, 0);
  assert.ok(context.calls.some(call => call.type === "stroke"));
  assert.equal(context.calls.some(call => call.type === "fillRect" && call.fillStyle === "#163e5e"), false);
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
