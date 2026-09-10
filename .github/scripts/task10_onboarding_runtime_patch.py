from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)

# index.html
path = Path("index.html")
html = path.read_text(encoding="utf-8")
html = replace_once(html,
'''  <canvas id="game" tabindex="0" aria-label="2D 픽셀 온라인 RPG 게임 화면"></canvas>\n\n  <div id="entryOverlay" class="screen-overlay">''',
'''  <canvas id="game" tabindex="0" aria-label="2D 픽셀 온라인 RPG 게임 화면"></canvas>\n\n  <section id="firstJourneyOverlay" class="first-journey-overlay" hidden aria-label="픽셀 월드 시작 이야기">\n    <div class="first-journey-card" role="dialog" aria-modal="true" aria-labelledby="firstJourneyTitle" aria-describedby="firstJourneyText">\n      <p class="eyebrow">PIXEL WORLD // BOOT SEQUENCE</p>\n      <h2 id="firstJourneyTitle">세계 연결 복구 중</h2>\n      <p id="firstJourneyText" class="first-journey-text" aria-live="polite"></p>\n      <div class="first-journey-actions">\n        <button id="firstJourneyContinue" class="primary-button" type="button">계속</button>\n        <button id="firstJourneySkip" class="secondary-button" type="button">인트로 건너뛰기</button>\n      </div>\n    </div>\n  </section>\n\n  <section id="beginnerGuideOverlay" class="screen-overlay beginner-guide-overlay" hidden>\n    <div class="modal-card beginner-guide-card" role="dialog" aria-modal="true" aria-labelledby="beginnerGuideTitle">\n      <button id="beginnerGuideClose" class="dialogue-close" type="button" aria-label="초심자 가이드 닫기">×</button>\n      <p class="eyebrow">BEGINNER GUIDE</p>\n      <h2 id="beginnerGuideTitle">픽셀 월드 초심자 가이드</h2>\n      <p class="modal-description">조각난 데이터의 대륙을 탐험하고 세 지역의 코어 반응을 추적하세요.</p>\n      <div class="beginner-guide-grid">\n        <section><h3>직업과 장비</h3><p><b>검사</b> 근접 검격 · <b>궁수</b> 원거리 화살 · <b>마법사</b> 범위 마법. 대장장이 브란의 대장간에서 레벨에 맞는 일반 장비 21종을 구매·판매·장착할 수 있습니다.</p></section>\n        <section><h3>플레이 모드</h3><p><b>솔로</b>는 스토리에 집중하는 오프라인 플레이, <b>온라인</b>은 최대 10명이 채팅과 협동 보스를 함께 즐기는 모드입니다.</p></section>\n        <section class="beginner-guide-controls"><h3>기본 조작</h3><p><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> 이동 · <kbd>Ctrl</kbd> 기본 공격 · <kbd>Q</kbd> 직업 스킬 · <kbd>E</kbd> Lv.5 해금 · <kbd>R</kbd> Lv.10 해금 · <kbd>F</kbd> 대화/조사 · <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd> 퀵슬롯 · <kbd>I</kbd> 인벤토리 · <kbd>Enter</kbd> 온라인 채팅 · <kbd>Esc</kbd> 닫기/나가기</p></section>\n      </div>\n    </div>\n  </section>\n\n  <div id="entryOverlay" class="screen-overlay">''', 'intro overlays')
html = replace_once(html,
'''          <span id="networkBadge" class="status offline">오프라인</span>\n          <button id="qaButton"''',
'''          <span id="networkBadge" class="status offline">오프라인</span>\n          <button id="helpButton" class="qa-button" type="button" aria-label="초심자 가이드 열기">?</button>\n          <button id="qaButton"''', 'help button')
path.write_text(html, encoding="utf-8")

# main
path = Path("src/main-20260910-sanctuary.js")
main = path.read_text(encoding="utf-8")
main = replace_once(main,
'''import { isQaMode } from "./qa-mode-20260910-sanctuary.js";''',
'''import { isQaMode } from "./qa-mode-20260910-sanctuary.js";\nimport { FirstJourneyController } from "./first-journey-controller-20260910-sanctuary.js";''', 'main import')
main = replace_once(main,
'''  qaEnabled,\n  canvas: document.querySelector("#game"),''',
'''  qaEnabled,\n  firstJourneyOverlay: document.querySelector("#firstJourneyOverlay"),\n  firstJourneyText: document.querySelector("#firstJourneyText"),\n  firstJourneyContinue: document.querySelector("#firstJourneyContinue"),\n  firstJourneySkip: document.querySelector("#firstJourneySkip"),\n  helpButton: document.querySelector("#helpButton"),\n  beginnerGuideOverlay: document.querySelector("#beginnerGuideOverlay"),\n  beginnerGuideClose: document.querySelector("#beginnerGuideClose"),\n  canvas: document.querySelector("#game"),''', 'main elements')
main = replace_once(main,
'''const game = new PixelRPG(elements);\nconst hud = document.querySelector("#hud");''',
'''const game = new PixelRPG(elements);\nconst firstJourneyController = new FirstJourneyController({\n  overlay: elements.firstJourneyOverlay,\n  text: elements.firstJourneyText,\n  continueButton: elements.firstJourneyContinue,\n  skipButton: elements.firstJourneySkip,\n  reducedMotion: matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true,\n  onComplete: result => game.finishFirstJourneyIntro(result),\n});\nelements.firstJourneyContinue?.addEventListener("click", () => firstJourneyController.advanceFrame());\nelements.firstJourneySkip?.addEventListener("click", () => firstJourneyController.skip());\nelements.firstJourneyOverlay?.addEventListener("keydown", event => {\n  if (event.code === "Enter" || event.code === "Space") {\n    event.preventDefault();\n    event.stopPropagation();\n    firstJourneyController.handleKey(event.code);\n  } else if (event.code === "Tab") {\n    event.preventDefault();\n    event.stopPropagation();\n    const controls = [elements.firstJourneyContinue, elements.firstJourneySkip].filter(Boolean);\n    const index = controls.indexOf(document.activeElement);\n    const offset = event.shiftKey ? -1 : 1;\n    controls[(index + offset + controls.length) % controls.length]?.focus();\n  } else {\n    event.stopPropagation();\n  }\n});\nconst hud = document.querySelector("#hud");''', 'controller construction')
main = replace_once(main,
'''    await game.enter(selection.nickname, selection.classId, selection.playMode);\n    entryOverlay.hidden = true;\n    hud.hidden = false;''',
'''    await game.enter(selection.nickname, selection.classId, selection.playMode);\n    entryOverlay.hidden = true;\n    hud.hidden = false;\n    if (game.shouldPlayFirstJourneyIntro()) {\n      game.beginFirstJourneyIntro();\n      firstJourneyController.start();\n    }''', 'start intro after entry')
path.write_text(main, encoding="utf-8")

# game
path = Path("src/game-20260910-sanctuary.js")
game = path.read_text(encoding="utf-8")
game = replace_once(game,
'''  createInitialProgress,\n  recordAdventureKill,''',
'''  createInitialProgress,\n  markIntroSeen,\n  recordAdventureKill,''', 'mark intro import')
game = replace_once(game,
'''const MINIMAP_FRAME_MS = 100;''',
'''const MINIMAP_FRAME_MS = 100;\nexport const FIRST_JOURNEY_ARRIVAL_GLITCH_MS = 1100;''', 'glitch constant')
game = replace_once(game,
'''    this.qaEnabled = Boolean(elements.qaEnabled);\n    this.progress = createInitialProgress();''',
'''    this.qaEnabled = Boolean(elements.qaEnabled);\n    this.firstJourneyActive = false;\n    this.arrivalGlitchUntil = 0;\n    this.progress = createInitialProgress();''', 'constructor intro state')
game = replace_once(game,
'''    elements.qaButton?.addEventListener("click", () => this.openQaPanel());''',
'''    elements.helpButton?.addEventListener("click", () => this.openBeginnerGuide());\n    elements.beginnerGuideClose?.addEventListener("click", () => this.closeBeginnerGuide());\n    elements.beginnerGuideOverlay?.addEventListener("keydown", event => {\n      if (event.code === "Escape") {\n        event.preventDefault();\n        event.stopPropagation();\n        this.closeBeginnerGuide();\n      } else if (event.code === "Tab") {\n        event.preventDefault();\n        event.stopPropagation();\n        elements.beginnerGuideClose?.focus();\n      } else {\n        event.stopPropagation();\n      }\n    });\n    elements.qaButton?.addEventListener("click", () => this.openQaPanel());''', 'help listeners')
game = replace_once(game,
'''  isRunning() {\n    return this.running;\n  }''',
'''  isRunning() {\n    return this.running;\n  }\n\n  shouldPlayFirstJourneyIntro() {\n    return this.running && this.progress?.introSeen !== true;\n  }\n\n  isFirstJourneyActive() {\n    return this.firstJourneyActive === true;\n  }\n\n  beginFirstJourneyIntro() {\n    if (!this.shouldPlayFirstJourneyIntro() || this.isInteractionOpen()) return false;\n    this.firstJourneyActive = true;\n    this.setInputEnabled(false);\n    return true;\n  }\n\n  finishFirstJourneyIntro({ skipped = false } = {}) {\n    if (!this.firstJourneyActive) return false;\n    this.firstJourneyActive = false;\n    this.progress = markIntroSeen(this.progress);\n    const saved = this.persistProgress("인트로 확인 상태를 저장하지 못했습니다. 다음 접속 때 다시 표시될 수 있습니다.");\n    this.playArrivalGlitch();\n    if (this.running && this.player.respawnTimer <= 0) this.setInputEnabled(true);\n    this.questBanner?.enqueue([{\n      kind: "main",\n      title: "모험의 시작",\n      body: "현자 아렌과 대화하세요.",\n      location: "중앙 초원",\n      reward: "EXP 15 · Gold 30",\n      next: "태고의 숲의 코어 반응을 추적한다",\n      controls: "방향키 이동 · F 대화 · Ctrl 공격",\n    }]);\n    if (!saved) this.notify("인트로 확인 상태를 저장하지 못했습니다. 다음 접속 때 다시 표시될 수 있습니다.");\n    return { ok: true, saved, skipped: Boolean(skipped) };\n  }\n\n  playArrivalGlitch(duration = FIRST_JOURNEY_ARRIVAL_GLITCH_MS) {\n    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : FIRST_JOURNEY_ARRIVAL_GLITCH_MS;\n    this.arrivalGlitchUntil = performance.now() + safeDuration;\n    return this.arrivalGlitchUntil;\n  }\n\n  isArrivalGlitchActive(timestamp = performance.now()) {\n    return Number.isFinite(this.arrivalGlitchUntil) && timestamp < this.arrivalGlitchUntil;\n  }\n\n  isBeginnerGuideOpen() {\n    return Boolean(this.ui.beginnerGuideOverlay && !this.ui.beginnerGuideOverlay.hidden);\n  }\n\n  openBeginnerGuide() {\n    if (!this.ui.beginnerGuideOverlay || !this.running || !this.inputEnabled || this.chatInputActive\n      || this.portalTransition || this.player.respawnTimer > 0 || this.isInteractionOpen()) return false;\n    this.setInputEnabled(false);\n    this.ui.beginnerGuideOverlay.hidden = false;\n    this.ui.beginnerGuideClose?.focus();\n    return true;\n  }\n\n  closeBeginnerGuide() {\n    if (!this.ui.beginnerGuideOverlay || !this.isBeginnerGuideOpen()) return false;\n    this.ui.beginnerGuideOverlay.hidden = true;\n    this.keys.clear();\n    this.player.moving = false;\n    if (this.running && this.player.respawnTimer <= 0 && !this.isFirstJourneyActive()) this.setInputEnabled(true);\n    this.canvas?.focus?.();\n    return true;\n  }''', 'game intro methods')
game = replace_once(game,
'''    this.closeCommunicationLog();\n    this.nearbyNpc = null;''',
'''    this.closeCommunicationLog();\n    this.firstJourneyActive = false;\n    this.arrivalGlitchUntil = 0;\n    if (this.ui.beginnerGuideOverlay) this.ui.beginnerGuideOverlay.hidden = true;\n    this.nearbyNpc = null;''', 'leave reset')
game = replace_once(game,
'''  isInteractionOpen() {\n    return this.isSaleConfirmOpen() || this.isBlacksmithOpen()\n      || this.isQaOpen() || this.isDialogueOpen() || this.isShopOpen() || this.isInventoryOpen()\n      || this.isCommunicationLogOpen() || Boolean(this.endingController?.active);\n  }''',
'''  isInteractionOpen() {\n    return this.isSaleConfirmOpen() || this.isBlacksmithOpen()\n      || this.isQaOpen() || this.isDialogueOpen() || this.isShopOpen() || this.isInventoryOpen()\n      || this.isCommunicationLogOpen() || this.isBeginnerGuideOpen() || this.isFirstJourneyActive()\n      || Boolean(this.endingController?.active);\n  }''', 'interaction priority')
game = replace_once(game,
'''    for (const entity of visiblePlayers) {\n      const message = bubbles.get(entity.uid);\n      if (message) drawChatBubble(ctx, entity, message, cameraX, cameraY, viewW, viewH);\n    }\n    this.renderMinimap(timestamp);''',
'''    for (const entity of visiblePlayers) {\n      const message = bubbles.get(entity.uid);\n      if (message) drawChatBubble(ctx, entity, message, cameraX, cameraY, viewW, viewH);\n    }\n    this.drawArrivalGlitch(ctx, timestamp, viewW, viewH);\n    this.renderMinimap(timestamp);''', 'render glitch')
game = replace_once(game,
'''  drawDamageNumbers(ctx, cameraX, cameraY) {''',
'''  drawArrivalGlitch(ctx, timestamp, width, height) {\n    if (!this.isArrivalGlitchActive(timestamp)) return false;\n    const remaining = Math.max(0, this.arrivalGlitchUntil - timestamp);\n    const strength = Math.min(1, remaining / FIRST_JOURNEY_ARRIVAL_GLITCH_MS);\n    ctx.save();\n    ctx.globalAlpha = 0.12 + strength * 0.18;\n    for (let index = 0; index < 8; index += 1) {\n      const seed = Math.floor(timestamp / 45) + index * 17;\n      const y = Math.abs(seed * 47) % Math.max(1, height);\n      const h = 2 + Math.abs(seed * 13) % 10;\n      const shift = ((seed % 3) - 1) * (5 + Math.round(strength * 12));\n      ctx.fillStyle = index % 2 ? "#67e8f9" : "#f472b6";\n      ctx.fillRect(shift, y, width, h);\n    }\n    ctx.restore();\n    return true;\n  }\n\n  drawDamageNumbers(ctx, cameraX, cameraY) {''', 'glitch draw method')
path.write_text(game, encoding="utf-8")

# CSS
path = Path("styles-20260910-sanctuary.css")
css = path.read_text(encoding="utf-8")
if ".first-journey-overlay" not in css:
    css += r'''

.first-journey-overlay {
  position: fixed; inset: 0; z-index: 140; display: grid; place-items: center;
  padding: clamp(18px, 4vw, 48px); background: #02050a; color: #e8f4ff;
}
.first-journey-overlay[hidden], .beginner-guide-overlay[hidden] { display: none !important; }
.first-journey-card { width: min(760px, 100%); display: grid; gap: 22px; }
.first-journey-card h2 { margin: 0; font-size: clamp(26px, 4vw, 44px); letter-spacing: .05em; }
.first-journey-text { min-height: 11rem; margin: 0; white-space: pre-wrap; font-size: clamp(16px, 2.2vw, 22px); line-height: 1.8; text-wrap: pretty; }
.first-journey-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.first-journey-actions button { min-width: 150px; }
.beginner-guide-overlay { z-index: 135; }
.beginner-guide-card { width: min(820px, calc(100vw - 28px)); max-height: min(86vh, 760px); overflow: auto; }
.beginner-guide-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; text-align: left; }
.beginner-guide-grid section { padding: 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; background: rgba(5,14,25,.45); }
.beginner-guide-grid h3 { margin: 0 0 8px; }
.beginner-guide-grid p { margin: 0; line-height: 1.7; }
.beginner-guide-controls { grid-column: 1 / -1; }
.beginner-guide-controls kbd { margin-inline: 2px; }
/* arrival-glitch is canvas-only; this hook keeps reduced-motion semantics explicit. */
@media (max-width: 680px) { .beginner-guide-grid { grid-template-columns: 1fr; } .beginner-guide-controls { grid-column: auto; } }
@media (prefers-reduced-motion: reduce) {
  .first-journey-overlay *, .beginner-guide-overlay * { animation: none !important; transition: none !important; }
}
'''
path.write_text(css, encoding="utf-8")
