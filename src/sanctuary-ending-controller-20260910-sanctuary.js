const DEFAULT_POST_CREDIT_MS = 2_000;
const DEFAULT_SCENE_DURATION_MS = 1_500;

function setHidden(element, hidden) {
  if (element) element.hidden = hidden;
}

function setText(element, text) {
  if (element) element.textContent = text ?? "";
}

export class SanctuaryEndingController {
  constructor({
    elements = {},
    now = () => Date.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = handle => clearTimeout(handle),
    sceneDurationMs = DEFAULT_SCENE_DURATION_MS,
    onChoose = () => {},
    onDefer = () => {},
    onPostCredit = () => {},
    onCreditsComplete = () => {},
  } = {}) {
    this.elements = elements;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.sceneDurationMs = Number.isFinite(sceneDurationMs) && sceneDurationMs > 0
      ? sceneDurationMs
      : DEFAULT_SCENE_DURATION_MS;
    this.onChoose = onChoose;
    this.onDefer = onDefer;
    this.onPostCredit = onPostCredit;
    this.onCreditsComplete = onCreditsComplete;
    this.mode = "idle";
    this.choiceModel = null;
    this.pendingChoice = null;
    this.creditsStartedAt = null;
    this.creditTimer = null;
    this.postCreditTimer = null;
    this.sceneTimer = null;
    this.postCredit = null;
    this._bindDom();
  }

  get active() {
    return this.mode !== "idle";
  }

  get inputLocked() {
    return this.active;
  }

  _bindDom() {
    const { restoreButton, sealButton, resonateButton, deferButton, confirmButton, cancelButton, skipButton } = this.elements;
    restoreButton?.addEventListener?.("click", () => this.requestChoice("restore"));
    sealButton?.addEventListener?.("click", () => this.requestChoice("seal"));
    resonateButton?.addEventListener?.("click", () => this.requestChoice("resonate"));
    deferButton?.addEventListener?.("click", () => this.defer());
    confirmButton?.addEventListener?.("click", () => this.confirmChoice());
    cancelButton?.addEventListener?.("click", () => this.cancelChoice());
    skipButton?.addEventListener?.("click", () => this.skipCredits());
  }

  openChoice(model) {
    this._clearTimers();
    this.mode = "choice";
    this.choiceModel = model || { choices: [], deferAllowed: false };
    this.pendingChoice = null;
    this._renderChoice();
    return true;
  }

  _renderChoice() {
    const { overlay, choicePanel, confirmPanel, lockedReason, restoreButton, sealButton, resonateButton, deferButton } = this.elements;
    setHidden(overlay, false);
    setHidden(choicePanel, false);
    setHidden(confirmPanel, true);
    setHidden(this.elements.credits, true);
    const byId = new Map((this.choiceModel?.choices || []).map(choice => [choice.id, choice]));
    for (const [id, button] of [["restore", restoreButton], ["seal", sealButton], ["resonate", resonateButton]]) {
      if (!button) continue;
      const choice = byId.get(id);
      button.disabled = choice?.unlocked !== true;
      button.dataset.reason = choice?.reason || "";
    }
    if (deferButton) deferButton.disabled = this.choiceModel?.deferAllowed !== true;
    const resonate = byId.get("resonate");
    setText(lockedReason, resonate?.unlocked === false && resonate.reason === "origin_records_3_required"
      ? "원점 기록 3/3 필요"
      : "");
  }

  requestChoice(choiceId) {
    if (this.mode !== "choice") return false;
    const choice = (this.choiceModel?.choices || []).find(value => value.id === choiceId);
    if (!choice?.unlocked) return false;
    this.pendingChoice = choiceId;
    const { choicePanel, confirmPanel, confirmText } = this.elements;
    setHidden(choicePanel, true);
    setHidden(confirmPanel, false);
    setText(confirmText, "이 선택은 이 닉네임의 정식 엔딩으로 기록되며 되돌릴 수 없습니다. 확정하시겠습니까?");
    return true;
  }

  cancelChoice() {
    if (this.mode !== "choice" || !this.pendingChoice) return false;
    this.pendingChoice = null;
    this._renderChoice();
    return true;
  }

  confirmChoice() {
    if (this.mode !== "choice" || !this.pendingChoice) return false;
    const choice = this.pendingChoice;
    this.pendingChoice = null;
    this.onChoose(choice);
    return true;
  }

  defer() {
    if (this.mode !== "choice" || this.choiceModel?.deferAllowed !== true) return false;
    this.close();
    this.onDefer();
    return true;
  }

  showSubtitle(speaker, text) {
    const { subtitle } = this.elements;
    setText(subtitle, speaker ? `${speaker}\n${text}` : text);
  }

  playEnding(script) {
    if (!script) return false;
    this._clearTimers();
    this.mode = "ending";
    setHidden(this.elements.overlay, false);
    setHidden(this.elements.choicePanel, true);
    setHidden(this.elements.confirmPanel, true);
    setHidden(this.elements.credits, true);
    const frames = [...(script.commonIntro || []), ...(script.scenes || [])];
    if (!frames.length) {
      return this.startCredits(script.credits, script.postCredit);
    }
    let index = 0;
    const showFrame = () => {
      if (this.mode !== "ending") return;
      const frame = frames[index];
      this.showSubtitle(frame?.speaker, frame?.text);
      index += 1;
      if (index >= frames.length) {
        this.sceneTimer = this.setTimer(() => {
          this.sceneTimer = null;
          if (this.mode === "ending") this.startCredits(script.credits, script.postCredit);
        }, Number.isFinite(frame?.durationMs) ? frame.durationMs : this.sceneDurationMs);
        return;
      }
      this.sceneTimer = this.setTimer(() => {
        this.sceneTimer = null;
        showFrame();
      }, Number.isFinite(frame?.durationMs) ? frame.durationMs : this.sceneDurationMs);
    };
    showFrame();
    return true;
  }

  startCredits(credits, postCredit) {
    this._clearTimers();
    this.mode = "credits";
    this.postCredit = postCredit || { lines: [], durationMs: DEFAULT_POST_CREDIT_MS };
    this.creditsStartedAt = this.now();
    setHidden(this.elements.overlay, false);
    setHidden(this.elements.credits, false);
    if (this.elements.creditsText) {
      this.elements.creditsText.replaceChildren?.();
      setText(this.elements.creditsText, (credits?.lines || []).join("\n"));
    }
    if (this.elements.skipButton) this.elements.skipButton.disabled = true;
    const skipAfterMs = Number.isFinite(credits?.skipAfterMs) ? credits.skipAfterMs : 5_000;
    this.setTimer(() => {
      if (this.mode === "credits" && this.elements.skipButton) this.elements.skipButton.disabled = false;
    }, skipAfterMs);
    const duration = Number.isFinite(credits?.durationMs) ? credits.durationMs : 30_000;
    this.creditTimer = this.setTimer(() => this._beginPostCredit(), duration);
    return true;
  }

  skipCredits() {
    if (this.mode !== "credits" || this.creditsStartedAt === null) return false;
    if (this.now() - this.creditsStartedAt < 5_000) return false;
    this._beginPostCredit();
    return true;
  }

  _beginPostCredit() {
    if (this.mode !== "credits") return false;
    if (this.creditTimer !== null) this.clearTimer(this.creditTimer);
    this.creditTimer = null;
    this.mode = "post-credit";
    setHidden(this.elements.credits, true);
    setText(this.elements.subtitle, (this.postCredit?.lines || []).join("\n"));
    this.onPostCredit(this.postCredit);
    const duration = Number.isFinite(this.postCredit?.durationMs)
      ? this.postCredit.durationMs
      : DEFAULT_POST_CREDIT_MS;
    this.postCreditTimer = this.setTimer(() => {
      this.postCreditTimer = null;
      this.mode = "idle";
      setHidden(this.elements.overlay, true);
      this.onCreditsComplete();
    }, duration);
    return true;
  }

  _clearTimers() {
    if (this.sceneTimer !== null) this.clearTimer(this.sceneTimer);
    if (this.creditTimer !== null) this.clearTimer(this.creditTimer);
    if (this.postCreditTimer !== null) this.clearTimer(this.postCreditTimer);
    this.sceneTimer = null;
    this.creditTimer = null;
    this.postCreditTimer = null;
  }

  close() {
    this._clearTimers();
    this.mode = "idle";
    this.choiceModel = null;
    this.pendingChoice = null;
    this.creditsStartedAt = null;
    setHidden(this.elements.overlay, true);
  }
}
