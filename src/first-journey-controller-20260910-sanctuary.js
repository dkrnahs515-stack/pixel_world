import {
  FIRST_JOURNEY_SCRIPT,
  FIRST_JOURNEY_TIMING,
} from "./first-journey-script-20260910-sanctuary.js";

function frameText(frame) {
  return frame.heading ? `${frame.heading}\n\n${frame.text}` : frame.text;
}

export class FirstJourneyController {
  constructor({
    overlay,
    text,
    continueButton,
    skipButton,
    script = FIRST_JOURNEY_SCRIPT,
    timing = FIRST_JOURNEY_TIMING,
    reducedMotion = false,
    setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
    onComplete = () => {},
  }) {
    this.overlay = overlay;
    this.text = text;
    this.continueButton = continueButton;
    this.skipButton = skipButton;
    this.script = script;
    this.timing = timing;
    this.reducedMotion = reducedMotion;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.onComplete = onComplete;
    this.active = false;
    this.frameIndex = 0;
    this.typing = false;
    this.timerId = null;
    this.completionSent = false;
  }

  get currentFrame() {
    return this.script.frames[this.frameIndex] ?? null;
  }

  get currentFrameText() {
    return this.currentFrame ? frameText(this.currentFrame) : "";
  }

  start() {
    if (this.active || !this.script.frames.length) return false;
    this.active = true;
    this.completionSent = false;
    this.frameIndex = 0;
    if (this.overlay) this.overlay.hidden = false;
    if (this.skipButton) this.skipButton.disabled = false;
    if (this.continueButton) this.continueButton.disabled = false;
    this.renderCurrentFrame();
    this.continueButton?.focus?.();
    return true;
  }

  renderCurrentFrame() {
    this.clearTimer();
    const fullText = this.currentFrameText;
    if (!this.text) return;
    if (this.reducedMotion) {
      this.typing = false;
      this.text.textContent = fullText;
      this.scheduleAdvance();
      return;
    }

    this.text.textContent = "";
    this.typing = true;
    let index = 0;
    const typeNext = () => {
      if (!this.active || !this.typing) return;
      index += 1;
      this.text.textContent = fullText.slice(0, index);
      if (index >= fullText.length) {
        this.typing = false;
        this.scheduleAdvance();
        return;
      }
      this.timerId = this.setTimeoutFn?.(typeNext, this.timing.typingIntervalMs) ?? null;
    };
    this.timerId = this.setTimeoutFn?.(typeNext, this.timing.typingIntervalMs) ?? null;
  }

  scheduleAdvance() {
    this.clearTimer();
    this.timerId = this.setTimeoutFn?.(() => {
      this.timerId = null;
      this.advanceFrame();
    }, this.timing.autoAdvanceDelayMs) ?? null;
  }

  clearTimer() {
    if (this.timerId !== null) this.clearTimeoutFn?.(this.timerId);
    this.timerId = null;
  }

  releaseFocus() {
    this.continueButton?.blur?.();
    this.skipButton?.blur?.();
  }

  completeCurrentFrame() {
    if (!this.active || !this.currentFrame) return false;
    this.clearTimer();
    this.typing = false;
    if (this.text) this.text.textContent = this.currentFrameText;
    this.scheduleAdvance();
    return true;
  }

  advanceFrame() {
    if (!this.active) return false;
    this.clearTimer();
    if (this.typing) return this.completeCurrentFrame();
    if (this.frameIndex >= this.script.frames.length - 1) {
      this.finish(false);
      return true;
    }
    this.frameIndex += 1;
    this.renderCurrentFrame();
    return true;
  }

  handleKey(code) {
    if (!this.active || (code !== "Enter" && code !== "Space")) return false;
    if (this.typing) return this.completeCurrentFrame();
    return this.advanceFrame();
  }

  skip() {
    if (!this.active) return false;
    this.finish(true);
    return true;
  }

  finish(skipped) {
    if (!this.active) return false;
    this.clearTimer();
    this.typing = false;
    this.active = false;
    if (this.overlay) this.overlay.hidden = true;
    this.releaseFocus();
    if (!this.completionSent) {
      this.completionSent = true;
      this.onComplete({ skipped });
    }
    return true;
  }

  close() {
    if (!this.active) return false;
    this.clearTimer();
    this.typing = false;
    this.active = false;
    if (this.overlay) this.overlay.hidden = true;
    this.releaseFocus();
    return true;
  }
}
