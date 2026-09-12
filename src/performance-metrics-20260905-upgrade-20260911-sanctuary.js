const MAX_TRACKED_FPS = 240;
const MAX_TRACKED_FRAME_SECONDS = 0.25;
const FRAME_DROP_FPS = 45;
const FRAME_DROP_RECOVERY_FPS = 50;

export function createPerformanceMetrics() {
  return {
    frameCount: 0,
    totalSeconds: 0,
    minFps: Number.POSITIVE_INFINITY,
    frameDropCount: 0,
    inFrameDrop: false,
  };
}

export function recordPerformanceFrame(metrics, frameSeconds) {
  const fps = trackedFpsFromFrameSeconds(frameSeconds);
  if (fps === null) return performanceSnapshot(metrics);

  metrics.frameCount += 1;
  metrics.totalSeconds += frameSeconds;
  metrics.minFps = Math.min(metrics.minFps, fps);

  if (fps < FRAME_DROP_FPS && !metrics.inFrameDrop) {
    metrics.frameDropCount += 1;
    metrics.inFrameDrop = true;
  } else if (fps >= FRAME_DROP_RECOVERY_FPS) {
    metrics.inFrameDrop = false;
  }

  return performanceSnapshot(metrics);
}

export function trackedFpsFromFrameSeconds(frameSeconds) {
  if (!Number.isFinite(frameSeconds) || frameSeconds <= 0 || isPerformanceTrackingGap(frameSeconds)) {
    return null;
  }
  const fps = 1 / frameSeconds;
  return fps <= MAX_TRACKED_FPS ? fps : null;
}

export function isPerformanceTrackingGap(frameSeconds) {
  return Number.isFinite(frameSeconds) && frameSeconds > MAX_TRACKED_FRAME_SECONDS;
}

export function performanceSnapshot(metrics) {
  return {
    frameCount: metrics.frameCount,
    averageFps: metrics.totalSeconds > 0 ? metrics.frameCount / metrics.totalSeconds : 0,
    minFps: Number.isFinite(metrics.minFps) ? metrics.minFps : 0,
    frameDropCount: metrics.frameDropCount,
  };
}
