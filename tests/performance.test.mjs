import test from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG as C } from "../src/config.js";
import { PixelRPG } from "../src/game-20260827-2.js";
import * as gameModule from "../src/game-20260827-2.js";

test("FPS 측정은 현실적인 프레임 간격만 표본으로 사용한다", () => {
  assert.equal(gameModule.fpsSampleFromFrameSeconds?.(0), null);
  assert.equal(gameModule.fpsSampleFromFrameSeconds?.(1 / 500), null);
  assert.equal(gameModule.fpsSampleFromFrameSeconds?.(1 / 240), 240);
  assert.equal(Math.round(gameModule.fpsSampleFromFrameSeconds?.(1 / 60)), 60);
  assert.equal(gameModule.fpsSampleFromFrameSeconds?.(0.25), 4);
  assert.equal(gameModule.fpsSampleFromFrameSeconds?.(0.251), null);
});

test("히트 스톱 중에는 고정 업데이트 없이 실제 프레임 시간만 소비한다", () => {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    hitStopRemaining: 0.035,
    accumulator: 0,
    fixedDt: 1 / 60,
  });
  let updates = 0;
  game.fixedUpdate = () => { updates += 1; };

  assert.equal(game.runSimulationFrame(1 / 60), 0);
  assert.equal(updates, 0);
  assert.ok(game.hitStopRemaining > 0);
  assert.equal(game.accumulator, 0);
});

test("히트 스톱이 끝나는 프레임은 남은 실제 시간만 시뮬레이션한다", () => {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    hitStopRemaining: 0.01,
    accumulator: 0,
    fixedDt: 1 / 60,
  });
  let updates = 0;
  game.fixedUpdate = () => { updates += 1; };

  assert.equal(game.runSimulationFrame(0.03), 1);
  assert.equal(updates, 1);
  assert.equal(game.hitStopRemaining, 0);
  assert.ok(Math.abs(game.accumulator - (0.02 - 1 / 60)) < 1e-9);
});

test("여러 명중의 히트 스톱은 합산하지 않고 가장 긴 남은 시간만 유지한다", () => {
  const game = Object.create(PixelRPG.prototype);
  game.hitStopRemaining = 0;

  assert.equal(game.requestHitStop(0.065), true);
  assert.equal(game.requestHitStop(0.035), true);
  assert.equal(game.requestHitStop(0), false);
  assert.equal(game.hitStopRemaining, 0.065);
});

test("고정 업데이트 도중 시작된 히트 스톱은 같은 렌더 프레임의 추가 계산을 막는다", () => {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    hitStopRemaining: 0,
    accumulator: 0,
    fixedDt: 1 / 60,
  });
  let updates = 0;
  game.fixedUpdate = () => {
    updates += 1;
    game.hitStopRemaining = 0.035;
  };

  assert.equal(game.runSimulationFrame(0.1), 1);
  assert.equal(updates, 1);
  assert.equal(game.accumulator, 0);
});

test("30 FPS 렌더 프레임은 설정된 시뮬레이션을 정확히 두 번 진행한다", () => {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    hitStopRemaining: 0,
    accumulator: 0,
    fixedDt: 1 / C.SIMULATION_HZ,
  });
  let updates = 0;
  game.fixedUpdate = () => { updates += 1; };

  assert.equal(game.runSimulationFrame(1 / 30), 2);
  assert.equal(updates, 2);
});

test("긴 렌더 프레임도 고정 업데이트를 다섯 번 넘게 따라잡지 않는다", () => {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    hitStopRemaining: 0,
    accumulator: 0,
    fixedDt: 1 / 60,
  });
  let updates = 0;
  game.fixedUpdate = () => { updates += 1; };

  assert.equal(game.runSimulationFrame(0.1), 5);
  assert.equal(updates, 5);
  assert.equal(game.accumulator, 0);
});

test("불규칙 프레임의 FPS는 순간 FPS 평균이 아니라 총 경과 시간으로 계산한다", () => {
  assert.equal(Math.round(gameModule.averageFpsFromFrameSeconds?.([1 / 60, 1 / 20])), 30);
  assert.equal(gameModule.averageFpsFromFrameSeconds?.([]), 0);
});

test("게임 루프는 시뮬레이션만 0.1초로 제한하고 성능 통계에는 실제 프레임 간격을 전달한다", () => {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    running: true,
    lastFrame: 100,
    accumulator: 0,
    fixedDt: 1 / 60,
  });
  let simulatedSeconds = null;
  let measuredSeconds = null;
  game.runSimulationFrame = seconds => { simulatedSeconds = seconds; };
  game.render = () => {};
  game.measurePerformance = (_timestamp, seconds) => { measuredSeconds = seconds; };
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;

  try {
    game.loop(400);
  } finally {
    globalThis.requestAnimationFrame = previousRequestAnimationFrame;
  }

  assert.equal(simulatedSeconds, 0.1);
  assert.equal(measuredSeconds, 0.3);
});

test("성능 패널은 현재 구간과 세션 평균·최저·급락 횟수를 함께 갱신한다", () => {
  const game = performanceGame(1);
  game.resetPerformanceMeasurement();
  game.measurePerformance(100, 0);

  let timestamp = 100;
  for (let index = 0; index < 28; index += 1) {
    timestamp += 1000 / 60;
    game.measurePerformance(timestamp, 1 / 60);
  }
  timestamp += 1000 / 30;
  game.measurePerformance(timestamp, 1 / 30);

  assert.equal(game.ui.fpsText.textContent, "58");
  assert.equal(game.ui.averageFpsText.textContent, "58");
  assert.equal(game.ui.minFpsText.textContent, "30");
  assert.equal(game.ui.frameDropCount.textContent, "1");

  game.resetPerformanceMeasurement();
  assert.equal(game.ui.averageFpsText.textContent, "0");
  assert.equal(game.ui.minFpsText.textContent, "0");
  assert.equal(game.ui.frameDropCount.textContent, "0");
});

test("60 FPS가 유지되면 동적 해상도를 성능 우선으로 잘못 낮추지 않는다", () => {
  const game = performanceGame(1);

  for (let index = 1; index <= 8; index += 1) {
    game.measurePerformance(100 + index * 500, 1 / 60);
  }

  assert.equal(game.renderScale, 1);
  assert.equal(game.resizeCalls, 0);
});

test("30 FPS는 2초 뒤 해상도를 낮추고 60 FPS는 8초 뒤 한 단계 복원한다", () => {
  const slowGame = performanceGame(1);
  for (let index = 1; index <= 4; index += 1) {
    slowGame.measurePerformance(100 + index * 500, 1 / 30);
  }
  assert.equal(slowGame.renderScale, 0.75);
  assert.equal(slowGame.ui.qualityText.textContent, "성능 우선");

  const recoveredGame = performanceGame(0.75);
  for (let index = 1; index <= 16; index += 1) {
    recoveredGame.measurePerformance(100 + index * 500, 1 / 60);
  }
  assert.equal(recoveredGame.renderScale, 1);
  assert.equal(recoveredGame.ui.qualityText.textContent, "고화질");
});

test("이전 60 FPS 표본이 있어도 30 FPS가 시작된 뒤 정확히 2초에 해상도를 낮춘다", () => {
  const game = performanceGame(1);
  let timestamp = 100;
  for (let index = 0; index < 8; index += 1) {
    timestamp += 500;
    game.measurePerformance(timestamp, 1 / 60);
  }
  for (let index = 0; index < 4; index += 1) {
    timestamp += 500;
    game.measurePerformance(timestamp, 1 / 30);
  }

  assert.equal(game.renderScale, 0.75);
});

test("품질 누적 시간은 고정 0.5초가 아니라 실제 측정 간격을 사용한다", () => {
  const game = performanceGame(1);

  game.measurePerformance(1100, 1 / 30);

  assert.equal(game.lowFpsSeconds, 1);
});

test("첫 0초 프레임은 저FPS로 계산하지 않고 새 입장은 이전 표본을 초기화한다", () => {
  const game = performanceGame(1);
  game.lastFpsUpdate = 0;
  game.fpsSamples = [1 / 20];
  game.lowFpsSeconds = 1.5;
  game.highFpsSeconds = 3;

  game.resetPerformanceMeasurement();
  assert.deepEqual(game.fpsSamples, []);
  assert.equal(game.lastFpsUpdate, 0);
  assert.equal(game.lowFpsSeconds, 0);
  assert.equal(game.highFpsSeconds, 0);

  game.measurePerformance(500, 0);
  assert.equal(game.lowFpsSeconds, 0);
  assert.equal(game.highFpsSeconds, 0);
});

test("250ms를 넘는 공백은 현재 FPS 창과 연속 품질 판정을 재동기화한다", () => {
  const game = performanceGame(1);
  game.measurePerformance(200, 1 / 30);
  game.lowFpsSeconds = 1.5;
  game.highFpsSeconds = 3;

  game.measurePerformance(5200, 5);

  assert.deepEqual(game.fpsSamples, []);
  assert.equal(game.lastFpsUpdate, 5200);
  assert.equal(game.lowFpsSeconds, 0);
  assert.equal(game.highFpsSeconds, 0);
  assert.equal(game.renderScale, 1);
  assert.equal(game.resizeCalls, 0);
  assert.equal(game.ui.fpsText.textContent, "");
  assert.equal(game.performanceMetrics.frameCount, 1);
});

test("미니맵은 큰 월드 배경을 한 번만 축소하고 위치 점은 100ms마다 갱신한다", () => {
  const calls = { drawImage: 0, getImageData: 0, putImageData: 0, fillRect: 0 };
  const context = {
    imageSmoothingEnabled: true,
    clearRect() {},
    drawImage() { calls.drawImage += 1; },
    getImageData() { calls.getImageData += 1; return { cached: true }; },
    putImageData() { calls.putImageData += 1; },
    fillRect() { calls.fillRect += 1; },
  };
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    mapId: "coast",
    minimap: { width: 220, height: 140 },
    minimapCtx: context,
    worldLayer: { width: 4320, height: 3600 },
    enemies: [{ x: 100, y: 200, color: "#fff" }],
    remotePlayers: new Map(),
    player: { x: 200, y: 300 },
    minimapBaseImage: null,
    lastMinimapRender: Number.NEGATIVE_INFINITY,
  });

  game.drawMinimapBase();
  game.renderMinimap(0);
  game.renderMinimap(50);
  game.renderMinimap(100);

  assert.equal(calls.drawImage, 1);
  assert.equal(calls.getImageData, 1);
  assert.equal(calls.putImageData, 2);
  assert.equal(calls.fillRect, 4);
});

test("미니맵 픽셀 캐시 읽기가 실패하면 지역 전환을 중단하지 않고 축소 그리기로 폴백한다", () => {
  const calls = { drawImage: 0 };
  const context = {
    clearRect() {},
    drawImage() { calls.drawImage += 1; },
    getImageData() { throw new Error("pixel read blocked"); },
    fillRect() {},
  };
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    mapId: "coast",
    minimap: { width: 220, height: 140 },
    minimapCtx: context,
    worldLayer: { width: 4320, height: 3600 },
    enemies: [],
    remotePlayers: new Map(),
    player: { x: 200, y: 300 },
    minimapBaseImage: null,
    lastMinimapRender: Number.NEGATIVE_INFINITY,
  });

  assert.doesNotThrow(() => game.drawMinimapBase());
  game.renderMinimap(0);

  assert.equal(game.minimapBaseImage, null);
  assert.equal(calls.drawImage, 2);
});

test("HUD는 표시값이 바뀌지 않으면 텍스트·막대·클래스를 다시 쓰지 않는다", () => {
  const hpText = trackedText();
  const mpText = trackedText();
  const cooldownText = trackedText();
  const hpStyle = trackedStyle();
  const mpStyle = trackedStyle();
  const unavailable = trackedClassList();
  const game = Object.create(PixelRPG.prototype);
  game.player = { hp: 100, maxHp: 100, mp: 100, maxMp: 100, respawnTimer: 0 };
  game.strongCooldown = 0;
  game.ui = {
    hpText,
    mpText,
    hpBar: { style: hpStyle },
    mpBar: { style: mpStyle },
    strongSlot: { classList: unavailable },
    strongCooldown: cooldownText,
  };

  game.updateHud();
  const afterFirst = hudWriteCounts({ hpText, mpText, cooldownText, hpStyle, mpStyle, unavailable });
  game.updateHud();
  assert.deepEqual(
    hudWriteCounts({ hpText, mpText, cooldownText, hpStyle, mpStyle, unavailable }),
    afterFirst,
  );

  game.player.hp = 90;
  game.updateHud();
  const afterDamage = hudWriteCounts({ hpText, mpText, cooldownText, hpStyle, mpStyle, unavailable });
  assert.equal(afterDamage.hpText, afterFirst.hpText + 1);
  assert.equal(afterDamage.hpStyle, afterFirst.hpStyle + 1);
  assert.equal(afterDamage.mpText, afterFirst.mpText);
  assert.equal(afterDamage.mpStyle, afterFirst.mpStyle);
  assert.equal(afterDamage.cooldownText, afterFirst.cooldownText);
  assert.equal(afterDamage.unavailable, afterFirst.unavailable);
});

test("NPC 안내는 상태가 유지되는 동안 hidden 속성을 반복해서 쓰지 않는다", () => {
  const npcPrompt = trackedHidden(false);
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    running: true,
    inputEnabled: true,
    mapId: "coast",
    chatInputActive: false,
    portalTransition: null,
    player: { respawnTimer: 0 },
    nearbyNpc: null,
    ui: { npcPrompt, npcPromptText: trackedText() },
  });
  game.isInteractionOpen = () => false;

  game.updateNpcPrompt();
  const afterFirst = npcPrompt.writes;
  game.updateNpcPrompt();

  assert.equal(npcPrompt.writes, afterFirst);
  assert.equal(npcPrompt.hidden, true);
});

function performanceGame(renderScale) {
  const game = Object.create(PixelRPG.prototype);
  Object.assign(game, {
    fpsSamples: [],
    lastFpsUpdate: 100,
    lowFpsSeconds: 0,
    highFpsSeconds: 0,
    renderScale,
    resizeCalls: 0,
    ui: {
      fpsText: { textContent: "" },
      averageFpsText: { textContent: "" },
      minFpsText: { textContent: "" },
      frameDropCount: { textContent: "" },
      qualityText: { textContent: "" },
    },
  });
  game.resize = () => { game.resizeCalls += 1; };
  globalThis.devicePixelRatio = 1;
  return game;
}

function trackedText(initialValue = "") {
  let value = initialValue;
  const node = { writes: 0 };
  Object.defineProperty(node, "textContent", {
    get: () => value,
    set: next => { value = next; node.writes += 1; },
  });
  return node;
}

function trackedStyle(initialValue = "") {
  let value = initialValue;
  const style = { writes: 0 };
  Object.defineProperty(style, "transform", {
    get: () => value,
    set: next => { value = next; style.writes += 1; },
  });
  return style;
}

function trackedClassList() {
  let enabled = false;
  return {
    writes: 0,
    contains: () => enabled,
    toggle(_name, next) {
      enabled = next;
      this.writes += 1;
    },
  };
}

function trackedHidden(initialValue) {
  let value = initialValue;
  const node = { writes: 0 };
  Object.defineProperty(node, "hidden", {
    get: () => value,
    set: next => { value = next; node.writes += 1; },
  });
  return node;
}

function hudWriteCounts({ hpText, mpText, cooldownText, hpStyle, mpStyle, unavailable }) {
  return {
    hpText: hpText.writes,
    mpText: mpText.writes,
    cooldownText: cooldownText.writes,
    hpStyle: hpStyle.writes,
    mpStyle: mpStyle.writes,
    unavailable: unavailable.writes,
  };
}
