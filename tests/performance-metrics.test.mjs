import test from "node:test";
import assert from "node:assert/strict";

async function metricsModule() {
  try {
    return await import("../src/performance-metrics-20260905-upgrade.js");
  } catch {
    return {};
  }
}

test("세션 통계는 전체 경과시간 평균과 실제 최저 FPS를 유지한다", async () => {
  const { createPerformanceMetrics, recordPerformanceFrame } = await metricsModule();

  assert.equal(typeof createPerformanceMetrics, "function");
  assert.equal(typeof recordPerformanceFrame, "function");
  const metrics = createPerformanceMetrics();
  recordPerformanceFrame(metrics, 1 / 60);
  recordPerformanceFrame(metrics, 1 / 30);
  const snapshot = recordPerformanceFrame(metrics, 1 / 20);

  assert.equal(Math.round(snapshot.averageFps), 30);
  assert.equal(Math.round(snapshot.minFps), 20);
  assert.equal(snapshot.frameDropCount, 1);
});

test("45 FPS 미만 급락은 회복 전까지 한 번만 세고 50 FPS 회복 뒤 다시 센다", async () => {
  const { createPerformanceMetrics, recordPerformanceFrame } = await metricsModule();
  const metrics = createPerformanceMetrics();

  assert.equal(recordPerformanceFrame(metrics, 1 / 45).frameDropCount, 0);
  assert.equal(recordPerformanceFrame(metrics, 1 / 44).frameDropCount, 1);
  assert.equal(recordPerformanceFrame(metrics, 1 / 30).frameDropCount, 1);
  assert.equal(recordPerformanceFrame(metrics, 1 / 50).frameDropCount, 1);
  assert.equal(recordPerformanceFrame(metrics, 1 / 44).frameDropCount, 2);
});

test("초고속 오표본과 250ms를 넘는 탭 전환 간격은 세션 기록에서 제외한다", async () => {
  const { createPerformanceMetrics, recordPerformanceFrame } = await metricsModule();
  const metrics = createPerformanceMetrics();

  recordPerformanceFrame(metrics, 0);
  recordPerformanceFrame(metrics, 1 / 500);
  recordPerformanceFrame(metrics, 0.251);
  const snapshot = recordPerformanceFrame(metrics, 1 / 60);

  assert.equal(snapshot.frameCount, 1);
  assert.equal(Math.round(snapshot.averageFps), 60);
  assert.equal(Math.round(snapshot.minFps), 60);
  assert.equal(snapshot.frameDropCount, 0);
});

test("새 게임 세션은 평균·최저·급락 횟수를 0으로 시작한다", async () => {
  const { createPerformanceMetrics, performanceSnapshot } = await metricsModule();
  const snapshot = performanceSnapshot(createPerformanceMetrics());

  assert.deepEqual(snapshot, {
    frameCount: 0,
    averageFps: 0,
    minFps: 0,
    frameDropCount: 0,
  });
});
