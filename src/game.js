import { GAME_CONFIG as C } from "./config.js";
import { layoutChatBubble, worldToScreen } from "./chat-bubble-layout.js";
import { ChatController } from "./chat-controller.js";
import { latestBubblesByUid } from "./chat-state.js";
import { attackDefinition, directionVector, isTargetInAttackArc } from "./combat.js";
import { advanceHitEffects, createHitEffect, drawHitEffects, hitShakeOffset } from "./combat-effects.js";
import { DialogueController } from "./dialogue-controller.js";
import {
  applyEnemyHitStun,
  createEnemies,
  createEnemyInstance,
  createMagmaChildren,
  damageEnemy,
  drawEnemy,
  updateEnemies,
} from "./enemies.js";
import { getEnemyDefinition } from "./enemy-definitions.js";
import { movementVector } from "./input.js";
import { createNetworkAdapter } from "./network.js";
import { getNpcsForWorld } from "./npc-data.js";
import { drawNpc, findNearbyNpc } from "./npcs.js";
import {
  applyPlayerDamage,
  applyPlayerSlow,
  clearPlayerCombatStatuses,
  createCombatStatusEffects,
  playerMovementMultiplier,
  respawnPlayer,
  tickPlayerStatus,
} from "./player-combat.js";
import { advancePortalTransition, createPortalTransition } from "./portal-transition.js";
import { grantHuntingReward, statsForLevel } from "./player-progression.js";
import { loadProgressWithStatus, saveProgress } from "./progress-storage.js";
import {
  createPerformanceMetrics,
  isPerformanceTrackingGap,
  recordPerformanceFrame,
  trackedFpsFromFrameSeconds,
} from "./performance-metrics.js";
import {
  findQaSpawnPosition,
  getQaMonster,
  prepareWeaponQaProgress,
} from "./qa-mode.js";
import { SHOP_ITEMS, buyShopItem, usePotion } from "./shop-state.js";
import {
  buyWeapon,
  equipWeapon,
  normalizeEquipment,
  sellWeapon,
} from "./equipment-state.js";
import {
  STARTER_WEAPON_ID,
  getWeaponDefinition,
  resolveWeaponDefinition,
} from "./weapon-data.js";
import {
  drawScabbard,
  drawWeapon,
  drawWeaponPreview,
} from "./weapon-rendering.js";
import {
  ADVENTURE_QUEST,
  acceptAdventureQuest,
  completeAdventureQuest,
  createInitialProgress,
  recordAdventureKill,
} from "./quest-state.js";
import { arenDialogueModel } from "./aren-dialogue.js";
import { getWorldDefinition, normalizeWorldId } from "./world-data.js";
import {
  createWorldLayer,
  drawWorldLayerViewport,
  findActivePortal,
  getBiome,
  isWorldPositionBlocked,
  prewarmWorldLayers,
} from "./world.js";

const PLAYER_RADIUS = 14;
const MINIMAP_FRAME_MS = 100;

export { advanceHitEffects, createHitEffect, drawHitEffects, hitShakeOffset } from "./combat-effects.js";

export function createGameCanvasContext(canvas) {
  return canvas.getContext("2d", { alpha: false });
}

export function fpsSampleFromFrameSeconds(frameSeconds) {
  return trackedFpsFromFrameSeconds(frameSeconds);
}

export function averageFpsFromFrameSeconds(samples) {
  const validSamples = (samples ?? []).filter(sample => fpsSampleFromFrameSeconds(sample) !== null);
  const totalSeconds = validSamples.reduce((total, sample) => total + sample, 0);
  return totalSeconds > 0 ? validSamples.length / totalSeconds : 0;
}

function setTextIfChanged(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function setStyleIfChanged(element, property, value) {
  if (element.style[property] !== value) element.style[property] = value;
}

function setPropertyIfChanged(element, property, value) {
  if (element[property] !== value) element[property] = value;
}

function toggleClassIfChanged(element, className, enabled) {
  if (typeof element.classList.contains !== "function"
    || element.classList.contains(className) !== enabled) {
    element.classList.toggle(className, enabled);
  }
}

function findByDataset(elements, key, value) {
  return (elements || []).find(element => element.dataset?.[key] === value) || null;
}

function withObjectParticle(value) {
  const text = String(value || "");
  const lastCode = text.codePointAt(text.length - 1);
  const hasFinalConsonant = Number.isInteger(lastCode)
    && lastCode >= 0xac00
    && lastCode <= 0xd7a3
    && (lastCode - 0xac00) % 28 !== 0;
  return `${text}${hasFinalConsonant ? "을" : "를"}`;
}

export function dialogueKeyAction(code) {
  if (code === "Escape") return "close";
  if (code === "Enter") return "allow-action";
  return null;
}

export function interactionKeyAction({
  code,
  saleConfirmOpen,
  blacksmithOpen,
  qaOpen,
  inventoryOpen,
  shopOpen,
  dialogueOpen,
}) {
  if (saleConfirmOpen) return code === "Escape" ? "close-sale-confirm" : "block";
  if (blacksmithOpen) return code === "Escape" ? "close-blacksmith" : "block";
  if (qaOpen) return code === "Escape" ? "close-qa" : "block";
  if (inventoryOpen) return code === "Escape" ? "close-inventory" : "block";
  if (shopOpen) return code === "Escape" ? "close-shop" : "block";
  if (dialogueOpen) return code === "Escape" ? "close-dialogue" : "block";
  return null;
}

export function npcInteractionKeyAction({
  saleConfirmOpen,
  blacksmithOpen,
  qaOpen,
  inventoryOpen,
  shopOpen,
  dialogueOpen,
}) {
  if (saleConfirmOpen || qaOpen || inventoryOpen) return "block";
  if (blacksmithOpen) return "close-blacksmith";
  if (shopOpen) return "close-shop";
  if (dialogueOpen) return "close-dialogue";
  return "open-npc";
}

export function nextDialogueFocus(controls, activeElement, reverse = false) {
  if (!controls.length) return null;
  const currentIndex = controls.indexOf(activeElement);
  if (currentIndex < 0) return reverse ? controls.at(-1) : controls[0];
  const offset = reverse ? -1 : 1;
  return controls[(currentIndex + offset + controls.length) % controls.length];
}

export function readableProgressStorage(storage) {
  try {
    if (typeof storage?.getItem !== "function") return null;
    storage.getItem("pixel-world.progress.access-check");
    return storage;
  } catch {
    return null;
  }
}

export function loadPlayerProgress(storage, nickname) {
  const loaded = loadProgressWithStatus(storage, nickname);
  const notice = storage === null
    ? "진행 상황을 브라우저에서 불러오거나 저장할 수 없습니다."
    : loaded.migrationWriteFailed
      ? "진행 상황을 브라우저에 저장할 수 없습니다."
      : `${nickname}님, 방향키로 이동하고 Ctrl로 공격하세요.`;
  return { ...loaded, notice };
}

export function drawPlayerSlowEffect(ctx, player, cameraX, cameraY) {
  if (!(player.statusEffects?.slow?.remaining > 0)) return;
  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y - cameraY);
  ctx.save();
  ctx.fillStyle = "rgba(118,80,143,.75)";
  for (let index = 0; index < 6; index += 1) {
    const angle = player.step + index * Math.PI / 3;
    ctx.fillRect(
      Math.round(x + Math.cos(angle) * 20) - 2,
      Math.round(y + Math.sin(angle) * 12) - 2,
      4,
      4,
    );
  }
  ctx.restore();
}

function shopFailureMessage(reason, item) {
  if (reason === "insufficient_gold") return "Gold가 부족합니다.";
  if (reason === "inventory_full") return "물약을 더 이상 보유할 수 없습니다.";
  if (reason === "out_of_stock") return `${item?.name || "해당 물약"}이 없습니다.`;
  if (reason === "already_full") return item?.resource === "mp"
    ? "MP가 이미 가득 찼습니다."
    : "HP가 이미 가득 찼습니다.";
  return "아이템을 사용할 수 없습니다.";
}

function blacksmithFailureMessage(reason, weapon) {
  if (reason === "level_locked") return `Lv.${weapon?.requiredLevel || "?"}부터 구매할 수 있습니다.`;
  if (reason === "insufficient_gold") return "Gold가 부족합니다.";
  if (reason === "already_owned") return "이미 보유 중인 무기입니다.";
  if (reason === "starter_weapon") return "시작 검은 거래할 수 없습니다.";
  if (reason === "not_owned") return "보유하지 않은 무기입니다.";
  return "무기 정보를 찾을 수 없습니다.";
}

export class PixelRPG {
  constructor(elements) {
    this.canvas = elements.canvas;
    this.ctx = createGameCanvasContext(this.canvas);
    this.minimap = elements.minimap;
    this.minimapCtx = this.minimap.getContext("2d");
    this.minimapBaseImage = null;
    this.lastMinimapRender = Number.NEGATIVE_INFINITY;
    this.ui = elements;
    this.keys = new Set();
    this.mapId = "village";
    this.worldLayer = createWorldLayer(this.mapId);
    const spawn = getWorldDefinition(this.mapId).spawn;
    this.player = {
      x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y,
      w: 24, h: 31, dir: "down", moving: false, step: 0,
      hp: 100, maxHp: 100, mp: 100, maxMp: 100,
      invulnerable: 0, hitFlash: 0, respawnTimer: 0,
      statusEffects: createCombatStatusEffects(),
      color: "#4f8e5b", name: "모험가",
      equippedWeaponId: STARTER_WEAPON_ID,
    };
    this.camera = { x: 0, y: 0, prevX: 0, prevY: 0 };
    this.remotePlayers = new Map();
    this.enemies = [];
    this.processedEnemyAttackIds = new Set();
    this.processedEnemySpawnIds = new Set();
    this.dynamicEnemySequence = 0;
    this.portalTransition = null;
    this.portalCooldown = 0;
    this.attackState = null;
    this.basicCooldown = 0;
    this.strongCooldown = 0;
    this.damageNumbers = [];
    this.hitEffects = [];
    this.hitStopRemaining = 0;
    this.network = null;
    this.running = false;
    this.inputEnabled = false;
    this.eventsBound = false;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.fixedDt = 1 / C.SIMULATION_HZ;
    this.fpsSamples = [];
    this.lastFpsUpdate = 0;
    this.performanceMetrics = createPerformanceMetrics();
    this.messageTimer = 0;
    this.chatMessages = [];
    this.chatInputActive = false;
    this.qaEnabled = Boolean(elements.qaEnabled);
    this.progress = createInitialProgress();
    this.npcs = getNpcsForWorld(this.mapId);
    this.nearbyNpc = null;
    this.blacksmithTab = "buy";
    this.pendingWeaponSaleId = null;
    for (const preview of elements.weaponPreviewCanvases || []) {
      drawWeaponPreview(preview, preview.dataset.weaponPreview);
    }
    this.dialogue = new DialogueController({
      overlay: elements.dialogueOverlay,
      title: elements.dialogueTitle,
      body: elements.dialogueBody,
      actionButton: elements.dialogueActionButton,
      onAction: action => this.handleDialogueAction(action),
    });
    elements.dialogueCloseButton.addEventListener("click", () => this.closeNpcDialogue());
    elements.dialogueOverlay.addEventListener("keydown", event => {
      if (event.code !== "Tab") return;
      const controls = [elements.dialogueActionButton, elements.dialogueCloseButton];
      event.preventDefault();
      nextDialogueFocus(controls, document.activeElement, event.shiftKey)?.focus();
    });
    elements.shopCloseButton?.addEventListener("click", () => this.closeShop());
    elements.shopDoneButton?.addEventListener("click", () => this.closeShop());
    elements.buyHpPotionButton?.addEventListener("click", () => this.buyItem("hpPotion"));
    elements.buyMpPotionButton?.addEventListener("click", () => this.buyItem("mpPotion"));
    elements.shopOverlay?.addEventListener("keydown", event => {
      if (event.code !== "Tab") return;
      const controls = [
        elements.shopCloseButton,
        elements.buyHpPotionButton,
        elements.buyMpPotionButton,
        elements.shopDoneButton,
      ].filter(control => control && !control.disabled);
      event.preventDefault();
      nextDialogueFocus(controls, document.activeElement, event.shiftKey)?.focus();
    });
    elements.blacksmithCloseButton?.addEventListener("click", () => this.closeBlacksmith());
    elements.blacksmithBuyTab?.addEventListener("click", () => this.selectBlacksmithTab("buy"));
    elements.blacksmithSellTab?.addEventListener("click", () => this.selectBlacksmithTab("sell"));
    for (const button of elements.buyWeaponButtons || []) {
      button.addEventListener("click", () => this.buyBlacksmithWeapon(button.dataset.buyWeapon));
    }
    for (const button of elements.sellWeaponButtons || []) {
      button.addEventListener("click", () => this.requestWeaponSale(button.dataset.sellWeapon));
    }
    elements.weaponSaleCancelButton?.addEventListener("click", () => this.cancelWeaponSale());
    elements.weaponSaleConfirmButton?.addEventListener("click", () => this.confirmWeaponSale());
    const trapBlacksmithFocus = event => {
      if (event.code !== "Tab") return;
      const controls = this.activeBlacksmithFocusControls();
      event.preventDefault();
      nextDialogueFocus(controls, document.activeElement, event.shiftKey)?.focus();
    };
    elements.blacksmithOverlay?.addEventListener("keydown", trapBlacksmithFocus);
    elements.weaponSaleConfirmOverlay?.addEventListener("keydown", trapBlacksmithFocus);
    elements.inventoryButton?.addEventListener("click", () => this.openInventory());
    elements.inventoryCloseButton?.addEventListener("click", () => this.closeInventory());
    elements.inventoryDoneButton?.addEventListener("click", () => this.closeInventory());
    elements.inventoryHpUseButton?.addEventListener("click", () => this.useInventoryItem("hpPotion"));
    elements.inventoryMpUseButton?.addEventListener("click", () => this.useInventoryItem("mpPotion"));
    for (const button of elements.equipWeaponButtons || []) {
      button.addEventListener("click", () => this.equipInventoryWeapon(button.dataset.equipWeapon));
    }
    elements.inventoryOverlay?.addEventListener("keydown", event => {
      if (event.code !== "Tab") return;
      const controls = this.activeInventoryFocusControls();
      event.preventDefault();
      nextDialogueFocus(controls, document.activeElement, event.shiftKey)?.focus();
    });
    elements.qaButton?.addEventListener("click", () => this.openQaPanel());
    elements.qaCloseButton?.addEventListener("click", () => this.closeQaPanel());
    elements.qaDoneButton?.addEventListener("click", () => this.closeQaPanel());
    elements.qaWeaponButton?.addEventListener("click", () => this.qaPrepareWeaponShop());
    for (const button of elements.qaWorldButtons || []) {
      button.addEventListener("click", () => this.qaTravel(button.dataset.qaWorld));
    }
    for (const button of elements.qaMonsterButtons || []) {
      button.addEventListener("click", () => this.qaSpawnMonster(button.dataset.qaMonster));
    }
    elements.qaOverlay?.addEventListener("keydown", event => {
      if (event.code !== "Tab") return;
      const controls = [
        elements.qaCloseButton,
        ...(elements.qaWorldButtons || []),
        ...(elements.qaMonsterButtons || []),
        elements.qaWeaponButton,
        elements.qaDoneButton,
      ].filter(control => control && !control.disabled);
      event.preventDefault();
      nextDialogueFocus(controls, document.activeElement, event.shiftKey)?.focus();
    });
    this.chat = new ChatController({
      panel: elements.chatPanel,
      list: elements.chatMessages,
      form: elements.chatForm,
      input: elements.chatInput,
      status: elements.chatStatus,
      onSend: text => this.sendChat(text),
      onTypingChange: active => {
        this.chatInputActive = active;
        if (active) {
          this.keys.clear();
          this.player.moving = false;
        }
      },
    });
    this.renderScale = Math.min(devicePixelRatio || 1, C.MAX_DPR);
    this.lowFpsSeconds = 0;
    this.highFpsSeconds = 0;
  }

  async enter(nickname) {
    if (this.running) return;
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }

    this.player.name = sanitizeName(nickname);
    const progressStorage = browserStorage();
    const loadedProgress = loadPlayerProgress(progressStorage, this.player.name);
    this.progress = loadedProgress.progress;
    this.syncEquippedWeapon();
    this.applyProgressionStats(true);
    this.ui.playerName.textContent = this.player.name;
    this.ui.playerCount.textContent = "1";
    this.remotePlayers.clear();
    await prewarmWorldLayers();
    this.switchWorld("village", getWorldDefinition("village").spawn.x, getWorldDefinition("village").spawn.y, false);
    this.resetCombatState();
    this.inputEnabled = true;
    this.resize();
    this.drawMinimapBase();
    this.closeNpcDialogue();
    this.closeShop();
    this.closeBlacksmith();
    this.closeInventory();
    this.closeQaPanel();
    this.updateQuestHud();
    this.updateProgressHud();
    this.updateInventoryHud();
    this.updateNpcPrompt();

    if (this.network) await this.network.stop();
    this.chat.reset();
    this.chatMessages = [];
    this.network = await createNetworkAdapter({
      onPlayersChanged: players => this.receiveRemotePlayers(players),
      onStatusChanged: (status, label) => this.updateNetworkStatus(status, label),
      onChatMessagesChanged: messages => this.receiveChatMessages(messages),
    });

    this.running = true;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.resetPerformanceMeasurement();
    this.notify(loadedProgress.notice);
    requestAnimationFrame(timestamp => this.loop(timestamp));
  }

  async leave({ silent = false } = {}) {
    if (!this.running && !this.network) return;
    this.running = false;
    this.inputEnabled = false;
    this.keys.clear();
    this.player.moving = false;
    this.lastFrame = 0;
    this.accumulator = 0;

    const network = this.network;
    this.network = null;
    if (network) await network.stop();

    this.chat.reset();
    this.chatMessages = [];
    this.chatInputActive = false;
    this.closeNpcDialogue();
    this.closeShop();
    this.closeBlacksmith();
    this.closeInventory();
    this.closeQaPanel();
    this.nearbyNpc = null;
    this.updateNpcPrompt();

    this.remotePlayers.clear();
    this.portalTransition = null;
    this.portalCooldown = 0;
    this.switchWorld("village", getWorldDefinition("village").spawn.x, getWorldDefinition("village").spawn.y, false);
    this.resetCombatState();
    this.ui.playerCount.textContent = "0";
    this.updateNetworkStatus("offline", "나감");
    if (!silent) this.ui.message.classList.remove("show");
  }

  isRunning() {
    return this.running;
  }

  setInputEnabled(enabled) {
    this.inputEnabled = Boolean(enabled) && this.player.respawnTimer <= 0;
    if (!this.inputEnabled) {
      this.keys.clear();
      this.player.moving = false;
    }
    this.updateNpcPrompt();
  }

  bindEvents() {
    addEventListener("resize", () => this.resize(), { passive: true });
    addEventListener("blur", () => this.keys.clear());
    addEventListener("keydown", event => {
      if (!this.running || this.chatInputActive || isTypingTarget(event.target)) return;

      if (event.code === "KeyI" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (this.isInventoryOpen()) this.closeInventory();
        else if (!this.isInteractionOpen() && this.inputEnabled) this.openInventory();
        event.preventDefault();
        return;
      }

      if (event.code === "KeyF" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const action = npcInteractionKeyAction({
          saleConfirmOpen: this.isSaleConfirmOpen(),
          blacksmithOpen: this.isBlacksmithOpen(),
          qaOpen: this.isQaOpen(),
          inventoryOpen: this.isInventoryOpen(),
          shopOpen: this.isShopOpen(),
          dialogueOpen: this.isDialogueOpen(),
        });
        if (action === "close-dialogue") this.closeNpcDialogue();
        else if (action === "close-shop") this.closeShop();
        else if (action === "close-blacksmith") this.closeBlacksmith();
        else if (action === "open-npc" && this.inputEnabled) this.openNpcInteraction();
        event.preventDefault();
        return;
      }

      if (!this.inputEnabled || this.isInteractionOpen()) return;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        this.keys.add(event.code);
        event.preventDefault();
        return;
      }

      if (["ControlLeft", "ControlRight"].includes(event.code) && !event.repeat) {
        if (!event.altKey && !event.metaKey && !event.shiftKey) this.tryAttack("basic");
        event.preventDefault();
        return;
      }

      if (event.code === "KeyQ" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        this.tryAttack("strong");
        event.preventDefault();
        return;
      }

      if (["KeyE", "KeyR", "Digit1", "Digit2", "Digit3"].includes(event.code) && !event.repeat) {
        if (event.code === "Digit1") this.useItem("hpPotion");
        else if (event.code === "Digit2") this.useItem("mpPotion");
        else this.activateEmptySlot(event.code);
      }
    });
    addEventListener("keyup", event => this.keys.delete(event.code));

    document.querySelectorAll(".slot").forEach(button => {
      button.addEventListener("click", () => {
        if (!this.running || !this.inputEnabled || this.isInteractionOpen()) return;
        if (button.dataset.code === "KeyQ") this.tryAttack("strong");
        else if (button.dataset.code === "Digit1") this.useItem("hpPotion");
        else if (button.dataset.code === "Digit2") this.useItem("mpPotion");
        else this.activateEmptySlot(button.dataset.code);
      });
    });
  }

  resize() {
    const dpr = this.renderScale;
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  loop(timestamp) {
    if (!this.running) return;
    if (!this.lastFrame) this.lastFrame = timestamp;
    const rawFrameSeconds = (timestamp - this.lastFrame) / 1000;
    const frameSeconds = Math.min(rawFrameSeconds, 0.1);
    this.lastFrame = timestamp;
    this.runSimulationFrame(frameSeconds);

    const alpha = this.accumulator / this.fixedDt;
    this.render(alpha, timestamp);
    this.measurePerformance(timestamp, rawFrameSeconds);
    requestAnimationFrame(nextTimestamp => this.loop(nextTimestamp));
  }

  runSimulationFrame(frameSeconds) {
    let simulationSeconds = frameSeconds;
    if (this.hitStopRemaining > 0) {
      const consumed = Math.min(this.hitStopRemaining, simulationSeconds);
      this.hitStopRemaining = Math.max(0, this.hitStopRemaining - consumed);
      simulationSeconds -= consumed;
      this.accumulator = 0;
      if (simulationSeconds <= 0) return 0;
    }

    this.accumulator += simulationSeconds;
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < 5) {
      this.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
      if (this.hitStopRemaining > 0) {
        this.accumulator = 0;
        break;
      }
    }
    if (steps === 5) this.accumulator = 0;
    return steps;
  }

  requestHitStop(duration) {
    if (!(duration > 0)) return false;
    this.hitStopRemaining = Math.max(this.hitStopRemaining ?? 0, duration);
    return true;
  }

  fixedUpdate(dt) {
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    this.camera.prevX = this.camera.x;
    this.camera.prevY = this.camera.y;

    this.basicCooldown = Math.max(0, this.basicCooldown - dt);
    this.strongCooldown = Math.max(0, this.strongCooldown - dt);
    this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    const wasRespawning = this.player.respawnTimer > 0;
    tickPlayerStatus(this.player, dt);
    if (wasRespawning && this.player.respawnTimer === 0) this.finishRespawn();

    if (this.portalTransition) {
      this.updatePortalTransition(dt);
    } else {
      this.updateAttack(dt);
      if (this.hitStopRemaining > 0) return;
      const isBlocked = (x, y, radius) => isWorldPositionBlocked(this.mapId, x, y, radius);
      const simulation = updateEnemies(this.enemies, this.player, dt, {
        isBlocked,
        portals: getWorldDefinition(this.mapId).portals,
        random: Math.random,
      });
      this.enemies = simulation.enemies;
      this.applyEnemyEvents(simulation.events);

      if (this.player.respawnTimer <= 0) {
        this.applyEnemyContactDamage();
        this.updatePlayerMovement(dt);
        this.tryEnterPortal();
      }
    }
    this.updateDamageNumbers(dt);
    this.hitEffects = advanceHitEffects(this.hitEffects, dt);

    this.updateCamera(dt);
    this.network?.publish(this.player, this.mapId);
    this.updateRemoteInterpolation(dt);
    this.updateMessage(dt);
    this.updateBiome();
    this.updateHud();
    this.updateNpcPrompt();
  }

  updatePlayerMovement(dt) {
    const movement = this.inputEnabled && !this.chatInputActive && !this.isInteractionOpen()
      ? movementVector(this.keys)
      : { x: 0, y: 0 };
    const dx = movement.x;
    const dy = movement.y;
    this.player.moving = Boolean(dx || dy);

    if (!this.player.moving) return;
    const speed = C.PLAYER_SPEED * playerMovementMultiplier(this.player);
    const nextX = this.player.x + dx * speed * dt;
    if (!isWorldPositionBlocked(this.mapId, nextX, this.player.y, PLAYER_RADIUS)) this.player.x = nextX;
    const nextY = this.player.y + dy * speed * dt;
    if (!isWorldPositionBlocked(this.mapId, this.player.x, nextY, PLAYER_RADIUS)) this.player.y = nextY;
    this.player.step += dt * 11;
    if (Math.abs(dx) > Math.abs(dy)) this.player.dir = dx > 0 ? "right" : "left";
    else this.player.dir = dy > 0 ? "down" : "up";
  }

  openChatInput() {
    if (this.isInteractionOpen()) return false;
    return this.chat.open();
  }

  cancelChatInput() {
    return this.chat.cancel();
  }

  isChatTyping() {
    return this.chat.isTyping();
  }

  async sendChat(text) {
    return this.network?.chat?.send({
      text,
      name: this.player.name,
      mapId: this.mapId,
    }) || { ok: false, error: "채팅 서버가 오프라인입니다." };
  }

  receiveChatMessages(messages) {
    this.chatMessages = Array.isArray(messages) ? messages : [];
    this.chat.renderMessages(this.chatMessages);
  }

  isDialogueOpen() {
    return !this.ui.dialogueOverlay.hidden;
  }

  isShopOpen() {
    return Boolean(this.ui.shopOverlay && !this.ui.shopOverlay.hidden);
  }

  isBlacksmithOpen() {
    return Boolean(this.ui.blacksmithOverlay && !this.ui.blacksmithOverlay.hidden);
  }

  isSaleConfirmOpen() {
    return Boolean(this.ui.weaponSaleConfirmOverlay && !this.ui.weaponSaleConfirmOverlay.hidden);
  }

  isInventoryOpen() {
    return Boolean(this.ui.inventoryOverlay && !this.ui.inventoryOverlay.hidden);
  }

  isQaOpen() {
    return Boolean(this.qaEnabled && this.ui.qaOverlay && !this.ui.qaOverlay.hidden);
  }

  isInteractionOpen() {
    return this.isSaleConfirmOpen() || this.isBlacksmithOpen()
      || this.isQaOpen() || this.isDialogueOpen() || this.isShopOpen() || this.isInventoryOpen();
  }

  openQaPanel() {
    if (!this.qaEnabled || !this.ui.qaOverlay || !this.running || !this.inputEnabled
      || this.chatInputActive || this.portalTransition || this.player.respawnTimer > 0
      || this.isInteractionOpen()) {
      return false;
    }
    this.keys.clear();
    this.player.moving = false;
    this.attackState = null;
    this.inputEnabled = false;
    this.ui.qaOverlay.hidden = false;
    this.ui.qaCloseButton?.focus();
    this.updateNpcPrompt();
    return true;
  }

  closeQaPanel() {
    if (!this.ui.qaOverlay) return false;
    const wasOpen = this.isQaOpen();
    this.ui.qaOverlay.hidden = true;
    if (wasOpen) {
      this.inputEnabled = this.running && this.player.respawnTimer <= 0;
      this.canvas.focus();
    }
    this.updateNpcPrompt();
    return wasOpen;
  }

  qaTravel(mapId) {
    if (!this.qaEnabled || !this.running) return false;
    const world = getWorldDefinition(mapId);
    if (world.id !== mapId) return false;

    this.switchWorld(world.id, world.spawn.x, world.spawn.y);
    this.portalCooldown = 1;
    this.closeQaPanel();
    return true;
  }

  qaPrepareWeaponShop() {
    if (!this.qaEnabled || !this.running || !this.isQaOpen()) return false;
    this.progress = prepareWeaponQaProgress(this.progress);
    this.syncEquippedWeapon();
    this.applyProgressionStats(true);
    this.updateQuestHud();
    this.updateProgressHud();
    this.updateInventoryHud();
    this.updateBlacksmithHud();
    this.updateHud();
    this.updateBiome();
    this.persistProgress("장비 점검 상태를 저장할 수 없습니다.");
    this.closeQaPanel();
    this.notify("장비 점검 준비 완료 · Lv.30 · 5000 G");
    return true;
  }

  resolveQaSpawnPosition({ mapId, player, radius, portals }) {
    return findQaSpawnPosition({
      player,
      radius,
      portals,
      isBlocked: (x, y, candidateRadius) => isWorldPositionBlocked(mapId, x, y, candidateRadius),
    });
  }

  qaSpawnMonster(kind) {
    if (!this.qaEnabled || !this.running) return null;
    const catalogEntry = getQaMonster(kind);
    const definition = getEnemyDefinition(kind);
    if (!catalogEntry || !definition) return null;

    const world = getWorldDefinition(catalogEntry.mapId);
    const changesWorld = this.mapId !== world.id;
    const targetPlayer = changesWorld
      ? { ...this.player, x: world.spawn.x, y: world.spawn.y }
      : this.player;
    const spawn = this.resolveQaSpawnPosition({
      mapId: world.id,
      player: targetPlayer,
      radius: definition.radius,
      portals: world.portals,
    });
    if (!spawn) {
      this.notify(`${catalogEntry.name}을 소환할 안전한 공간이 없습니다.`);
      return null;
    }

    const nextSequence = changesWorld ? 1 : this.dynamicEnemySequence + 1;
    const id = `${world.id}-qa-${nextSequence}`;
    const enemy = createEnemyInstance(kind, spawn, id);
    if (!enemy) return null;

    if (changesWorld) {
      this.switchWorld(world.id, world.spawn.x, world.spawn.y);
      this.portalCooldown = 1;
    }
    this.dynamicEnemySequence = nextSequence;
    this.enemies.push(enemy);
    this.closeQaPanel();
    this.notify(`${catalogEntry.name}을 소환했습니다.`);
    return enemy;
  }

  openNpcInteraction() {
    if (!this.running || !this.inputEnabled || this.chatInputActive || this.portalTransition || this.player.respawnTimer > 0) return false;
    if (this.mapId !== "village") return false;
    const npc = findNearbyNpc(this.npcs, this.player);
    if (!npc) return false;
    if (npc.role === "blacksmith") return this.openBlacksmith(npc);
    if (npc.role === "shop") return this.openShop(npc);
    if (npc.role === "quest") return this.openNpcDialogue(npc);
    return false;
  }

  openNpcDialogue(npc = findNearbyNpc(this.npcs, this.player)) {
    if (!npc || npc.role !== "quest" || npc.id !== "aren") return false;

    this.keys.clear();
    this.player.moving = false;
    this.attackState = null;
    this.nearbyNpc = npc;
    this.dialogue.open(arenDialogueModel(this.progress));
    this.ui.dialogueActionButton.focus();
    this.updateNpcPrompt();
    return true;
  }

  openShop(npc = findNearbyNpc(this.npcs, this.player)) {
    if (!this.ui.shopOverlay || !npc || npc.role !== "shop") return false;
    this.keys.clear();
    this.player.moving = false;
    this.attackState = null;
    this.nearbyNpc = npc;
    this.ui.shopOverlay.hidden = false;
    this.updateShopHud();
    this.ui.shopCloseButton?.focus();
    this.updateNpcPrompt();
    return true;
  }

  closeNpcDialogue() {
    const wasOpen = this.isDialogueOpen();
    this.dialogue.close();
    if (wasOpen) this.canvas.focus();
    this.updateNpcPrompt();
  }

  closeShop() {
    if (!this.ui.shopOverlay) return false;
    const wasOpen = this.isShopOpen();
    this.ui.shopOverlay.hidden = true;
    if (wasOpen) this.canvas.focus();
    this.updateNpcPrompt();
    return wasOpen;
  }

  openBlacksmith(npc = findNearbyNpc(this.npcs, this.player)) {
    if (!this.ui.blacksmithOverlay || !npc || npc.role !== "blacksmith") return false;
    this.keys.clear();
    this.player.moving = false;
    this.attackState = null;
    this.nearbyNpc = npc;
    this.pendingWeaponSaleId = null;
    this.ui.weaponSaleConfirmOverlay.hidden = true;
    this.ui.blacksmithOverlay.hidden = false;
    this.updateBlacksmithHud();
    this.selectBlacksmithTab("buy");
    this.updateNpcPrompt();
    return true;
  }

  closeBlacksmith() {
    if (!this.ui.blacksmithOverlay) return false;
    const wasOpen = this.isBlacksmithOpen();
    this.pendingWeaponSaleId = null;
    this.ui.weaponSaleConfirmOverlay.hidden = true;
    this.ui.blacksmithOverlay.hidden = true;
    if (wasOpen) this.canvas.focus();
    this.updateNpcPrompt();
    return wasOpen;
  }

  selectBlacksmithTab(tab) {
    if (!this.isBlacksmithOpen() || !["buy", "sell"].includes(tab)) return false;
    this.blacksmithTab = tab;
    const buying = tab === "buy";
    this.ui.blacksmithBuyPanel.hidden = !buying;
    this.ui.blacksmithSellPanel.hidden = buying;
    this.ui.blacksmithBuyTab.setAttribute("aria-selected", String(buying));
    this.ui.blacksmithSellTab.setAttribute("aria-selected", String(!buying));
    const buttons = buying ? this.ui.buyWeaponButtons : this.ui.sellWeaponButtons;
    const firstEnabled = (buttons || []).find(button => !button.hidden && !button.disabled);
    (firstEnabled || (buying ? this.ui.blacksmithBuyTab : this.ui.blacksmithSellTab))?.focus();
    return true;
  }

  activeBlacksmithFocusControls() {
    if (this.isSaleConfirmOpen()) {
      return [this.ui.weaponSaleCancelButton, this.ui.weaponSaleConfirmButton]
        .filter(control => control && !control.disabled && !control.hidden);
    }
    if (!this.isBlacksmithOpen()) return [];
    const tradeButtons = this.blacksmithTab === "sell"
      ? this.ui.sellWeaponButtons
      : this.ui.buyWeaponButtons;
    return [
      this.ui.blacksmithCloseButton,
      this.ui.blacksmithBuyTab,
      this.ui.blacksmithSellTab,
      ...(tradeButtons || []),
    ].filter(control => control && !control.disabled && !control.hidden);
  }

  openInventory() {
    if (!this.ui.inventoryOverlay || !this.running || !this.inputEnabled || this.chatInputActive
      || this.portalTransition || this.player.respawnTimer > 0 || this.isInteractionOpen()) {
      return false;
    }
    this.keys.clear();
    this.player.moving = false;
    this.attackState = null;
    this.ui.inventoryOverlay.hidden = false;
    this.updateInventoryHud();
    this.ui.inventoryCloseButton?.focus();
    this.updateNpcPrompt();
    return true;
  }

  closeInventory() {
    if (!this.ui.inventoryOverlay) return false;
    const wasOpen = this.isInventoryOpen();
    this.ui.inventoryOverlay.hidden = true;
    if (wasOpen) this.canvas.focus();
    this.updateNpcPrompt();
    return wasOpen;
  }

  activeInventoryFocusControls() {
    if (!this.isInventoryOpen()) return [];
    return [
      this.ui.inventoryCloseButton,
      this.ui.inventoryHpUseButton,
      this.ui.inventoryMpUseButton,
      ...(this.ui.equipWeaponButtons || []),
      this.ui.inventoryDoneButton,
    ].filter(control => control && !control.disabled && !control.hidden);
  }

  handleDialogueAction(action) {
    if (action === "accept") {
      const before = this.progress.quests[ADVENTURE_QUEST.id].status;
      this.progress = acceptAdventureQuest(this.progress);
      if (this.progress.quests[ADVENTURE_QUEST.id].status !== before) {
        this.updateQuestHud();
        this.notify("퀘스트 ‘모험의 시작’을 수락했습니다.");
        this.persistProgress();
      }
      this.closeNpcDialogue();
      return;
    }

    if (action === "complete") {
      const result = completeAdventureQuest(this.progress);
      this.progress = result.progress;
      if (result.rewardExp > 0) {
        this.applyProgressionStats(result.levelsGained > 0);
        this.updateQuestHud();
        this.updateProgressHud();
        this.updateHud();
        this.updateBiome();
        this.notify("퀘스트 완료! EXP 15 · Gold 30을 획득했습니다.");
        if (result.levelsGained > 0) {
          this.notify(`LEVEL UP! LV.${this.progress.level} · HP와 MP가 회복되었습니다.`);
        }
        this.persistProgress();
      }
    }
    this.closeNpcDialogue();
  }

  recordQuestKill(enemyKind) {
    const before = this.progress.quests[ADVENTURE_QUEST.id];
    const next = recordAdventureKill(this.progress, enemyKind);
    const after = next.quests[ADVENTURE_QUEST.id];
    this.progress = next;
    return after.status !== before.status || after.progress !== before.progress;
  }

  recordEnemyKill(enemyKind, { deferEffects = false } = {}) {
    this.recordQuestKill(enemyKind);
    const reward = grantHuntingReward(this.progress, enemyKind);
    if (!reward) return null;
    this.progress = reward.progress;
    this.applyProgressionStats(reward.levelsGained > 0);
    if (!deferEffects) this.commitEnemyKillEffects([reward]);
    return reward;
  }

  commitEnemyKillEffects(rewards) {
    if (!rewards.length) return;
    this.updateQuestHud();
    this.updateProgressHud();
    this.updateHud();
    this.updateBiome();
    for (const reward of rewards) {
      const gold = reward.rewardGold > 0 ? ` · Gold +${reward.rewardGold}` : "";
      this.notify(`${reward.label} 처치! EXP +${reward.rewardExp}${gold}`);
    }
    if (rewards.some(reward => reward.levelsGained > 0)) {
      this.notify(`LEVEL UP! LV.${this.progress.level} · HP와 MP가 회복되었습니다.`);
    }
    this.persistProgress();
  }

  persistProgress(failureMessage = "진행 상황을 브라우저에 저장할 수 없습니다.") {
    const result = saveProgress(browserStorage(), this.player.name, this.progress);
    if (!result.ok) this.notify(failureMessage);
    return result.ok;
  }

  updateQuestHud() {
    const quest = this.progress.quests[ADVENTURE_QUEST.id];
    this.ui.questProgress.textContent = {
      available: "현자 아렌과 대화하세요.",
      active: `슬라임 처치 ${quest.progress}/${ADVENTURE_QUEST.required}`,
      ready_to_report: `슬라임 처치 ${quest.progress}/${ADVENTURE_QUEST.required} · 아렌에게 보고`,
      completed: "완료 · EXP 15 · Gold 30 획득",
    }[quest.status];
  }

  updateProgressHud() {
    this.ui.expText.textContent = `${this.progress.exp} / ${this.progress.nextLevelExp}`;
    this.ui.expBar.style.transform = `scaleX(${this.progress.exp / this.progress.nextLevelExp})`;
    this.ui.goldText.textContent = `${this.progress.gold} G`;
  }

  updateInventoryHud() {
    const inventory = this.progress.inventory;
    if (this.ui.hpPotionCount) this.ui.hpPotionCount.textContent = `×${inventory.hpPotion}`;
    if (this.ui.mpPotionCount) this.ui.mpPotionCount.textContent = `×${inventory.mpPotion}`;
    this.ui.hpPotionSlot?.classList.toggle("unavailable", inventory.hpPotion === 0);
    this.ui.mpPotionSlot?.classList.toggle("unavailable", inventory.mpPotion === 0);
    if (this.ui.inventoryHpPotionCount) {
      this.ui.inventoryHpPotionCount.textContent = `${inventory.hpPotion} / ${SHOP_ITEMS.hpPotion.maxQuantity}`;
    }
    if (this.ui.inventoryMpPotionCount) {
      this.ui.inventoryMpPotionCount.textContent = `${inventory.mpPotion} / ${SHOP_ITEMS.mpPotion.maxQuantity}`;
    }
    if (this.ui.inventoryHpUseButton) {
      this.ui.inventoryHpUseButton.disabled = inventory.hpPotion === 0 || this.player.hp >= this.player.maxHp;
    }
    if (this.ui.inventoryMpUseButton) {
      this.ui.inventoryMpUseButton.disabled = inventory.mpPotion === 0 || this.player.mp >= this.player.maxMp;
    }
    const equipment = normalizeEquipment(this.progress.equipment);
    const owned = new Set(equipment.ownedWeaponIds);
    for (const button of this.ui.equipWeaponButtons || []) {
      const weapon = getWeaponDefinition(button.dataset.equipWeapon);
      if (!weapon) continue;
      const isOwned = owned.has(weapon.id);
      const isEquipped = equipment.equippedWeaponId === weapon.id;
      const card = findByDataset(this.ui.inventoryWeaponCards, "inventoryWeapon", weapon.id);
      button.hidden = !isOwned;
      button.disabled = !isOwned || isEquipped;
      button.textContent = isEquipped ? "장착 중" : "장착";
      if (card) card.hidden = !isOwned;
    }
  }

  syncEquippedWeapon() {
    const equipment = normalizeEquipment(this.progress.equipment);
    this.progress.equipment = {
      ...equipment,
      ownedWeaponIds: [...equipment.ownedWeaponIds],
    };
    const weapon = resolveWeaponDefinition(equipment.equippedWeaponId);
    this.player.equippedWeaponId = weapon.id;
    return weapon;
  }

  equipInventoryWeapon(weaponId) {
    if (!this.isInventoryOpen()) return false;
    const result = equipWeapon(this.progress, weaponId);
    if (!result.ok) return false;
    this.progress = result.progress;
    const weapon = this.syncEquippedWeapon();
    this.updateInventoryHud();
    this.updateBlacksmithHud();
    this.notify(`${withObjectParticle(weapon.name)} 장착했습니다.`);
    this.persistProgress("장착했지만 진행 상황을 저장할 수 없습니다.");
    return true;
  }

  updateShopHud() {
    if (!this.ui.shopOverlay) return;
    const inventory = this.progress.inventory;
    this.ui.shopGoldText.textContent = `${this.progress.gold} G`;
    this.ui.shopHpPotionCount.textContent = `${inventory.hpPotion} / ${SHOP_ITEMS.hpPotion.maxQuantity}`;
    this.ui.shopMpPotionCount.textContent = `${inventory.mpPotion} / ${SHOP_ITEMS.mpPotion.maxQuantity}`;
    this.ui.buyHpPotionButton.disabled = this.progress.gold < SHOP_ITEMS.hpPotion.price
      || inventory.hpPotion >= SHOP_ITEMS.hpPotion.maxQuantity;
    this.ui.buyMpPotionButton.disabled = this.progress.gold < SHOP_ITEMS.mpPotion.price
      || inventory.mpPotion >= SHOP_ITEMS.mpPotion.maxQuantity;
  }

  updateBlacksmithHud() {
    if (!this.ui.blacksmithOverlay) return;
    this.ui.blacksmithGoldText.textContent = `${this.progress.gold} G`;
    if (this.ui.blacksmithEquippedWeaponText) {
      this.ui.blacksmithEquippedWeaponText.textContent = resolveWeaponDefinition(
        this.progress.equipment.equippedWeaponId,
      ).name;
    }
    const owned = new Set(this.progress.equipment.ownedWeaponIds);
    for (const button of this.ui.buyWeaponButtons || []) {
      const weapon = getWeaponDefinition(button.dataset.buyWeapon);
      if (!weapon) continue;
      const isOwned = owned.has(weapon.id);
      const locked = this.progress.level < weapon.requiredLevel;
      const poor = this.progress.gold < weapon.price;
      const status = findByDataset(this.ui.buyWeaponStatuses, "buyWeaponStatus", weapon.id);
      const card = findByDataset(this.ui.buyWeaponCards, "buyWeaponCard", weapon.id);
      button.disabled = isOwned || locked || poor;
      button.textContent = isOwned
        ? "보유 중"
        : locked
          ? `Lv.${weapon.requiredLevel} 필요`
          : poor
            ? "Gold 부족"
            : `${weapon.price} G 구매`;
      if (status) status.textContent = isOwned
        ? "보유 중"
        : locked
          ? `Lv.${weapon.requiredLevel} 필요`
          : poor
            ? "Gold 부족"
            : "구매 가능";
      card?.classList.toggle("locked", locked);
      card?.classList.toggle("owned", isOwned);
    }

    let sellableCount = 0;
    for (const button of this.ui.sellWeaponButtons || []) {
      const weapon = getWeaponDefinition(button.dataset.sellWeapon);
      if (!weapon) continue;
      const isOwned = owned.has(weapon.id);
      const equipped = this.progress.equipment.equippedWeaponId === weapon.id;
      const status = findByDataset(this.ui.sellWeaponStatuses, "sellWeaponStatus", weapon.id);
      const card = findByDataset(this.ui.sellWeaponCards, "sellWeaponCard", weapon.id);
      button.hidden = !isOwned;
      button.disabled = !isOwned;
      button.textContent = `${weapon.sellPrice} G 판매`;
      if (card) card.hidden = !isOwned;
      if (status) status.textContent = equipped ? "장착 중" : "보유 중";
      if (isOwned) sellableCount += 1;
    }
    if (this.ui.blacksmithEmptySaleText) this.ui.blacksmithEmptySaleText.hidden = sellableCount > 0;
  }

  buyBlacksmithWeapon(weaponId) {
    if (!this.isBlacksmithOpen()) return false;
    const result = buyWeapon(this.progress, weaponId);
    if (!result.ok) {
      this.notify(blacksmithFailureMessage(result.reason, result.weapon));
      return false;
    }
    this.progress = result.progress;
    this.updateProgressHud();
    this.updateInventoryHud();
    this.updateBlacksmithHud();
    this.notify(`${withObjectParticle(result.weapon.name)} 구매했습니다. Gold -${result.weapon.price}`);
    this.persistProgress("구매했지만 진행 상황을 저장할 수 없습니다.");
    return true;
  }

  requestWeaponSale(weaponId) {
    if (!this.isBlacksmithOpen() || this.isSaleConfirmOpen()) return false;
    const result = sellWeapon(this.progress, weaponId);
    if (!result.ok) {
      this.notify(blacksmithFailureMessage(result.reason, result.weapon));
      return false;
    }
    this.pendingWeaponSaleId = result.weapon.id;
    this.ui.weaponSaleConfirmText.textContent = `${withObjectParticle(result.weapon.name)} ${result.weapon.sellPrice} G에 판매할까요?`;
    this.ui.weaponSaleConfirmOverlay.hidden = false;
    this.ui.weaponSaleCancelButton?.focus();
    return true;
  }

  cancelWeaponSale() {
    if (!this.ui.weaponSaleConfirmOverlay) return false;
    const wasOpen = this.isSaleConfirmOpen();
    const weaponId = this.pendingWeaponSaleId;
    this.pendingWeaponSaleId = null;
    this.ui.weaponSaleConfirmOverlay.hidden = true;
    if (wasOpen && this.isBlacksmithOpen()) {
      const button = findByDataset(this.ui.sellWeaponButtons, "sellWeapon", weaponId);
      (button && !button.disabled && !button.hidden ? button : this.ui.blacksmithSellTab)?.focus();
    }
    return wasOpen;
  }

  confirmWeaponSale() {
    if (!this.isSaleConfirmOpen() || !this.pendingWeaponSaleId) return false;
    const weaponId = this.pendingWeaponSaleId;
    const result = sellWeapon(this.progress, weaponId);
    if (!result.ok) {
      this.cancelWeaponSale();
      this.notify(blacksmithFailureMessage(result.reason, result.weapon));
      return false;
    }
    this.pendingWeaponSaleId = null;
    this.ui.weaponSaleConfirmOverlay.hidden = true;
    this.progress = result.progress;
    this.syncEquippedWeapon();
    this.updateProgressHud();
    this.updateInventoryHud();
    this.updateBlacksmithHud();
    this.notify(`${withObjectParticle(result.weapon.name)} 판매했습니다. Gold +${result.weapon.sellPrice}`);
    this.persistProgress("판매했지만 진행 상황을 저장할 수 없습니다.");
    this.ui.blacksmithSellTab?.focus();
    return true;
  }

  buyItem(itemId) {
    const result = buyShopItem(this.progress, itemId);
    if (!result.ok) {
      this.notify(shopFailureMessage(result.reason, result.item));
      return false;
    }
    this.progress = result.progress;
    this.updateProgressHud();
    this.updateInventoryHud();
    this.updateShopHud();
    this.notify(`${result.item.name}을 구매했습니다. Gold -${result.item.price}`);
    this.persistProgress("구매했지만 진행 상황을 저장할 수 없습니다.");
    return true;
  }

  useItem(itemId, { fromInventory = false } = {}) {
    const blockedInteraction = this.isInteractionOpen() && !(fromInventory && this.isInventoryOpen());
    if (!this.running || !this.inputEnabled || this.chatInputActive
      || this.portalTransition || this.player.respawnTimer > 0 || blockedInteraction) {
      return false;
    }
    const item = SHOP_ITEMS[itemId];
    if (!item) return false;
    const current = this.player[item.resource];
    const max = this.player[item.resource === "hp" ? "maxHp" : "maxMp"];
    const result = usePotion(this.progress, { itemId, current, max });
    if (!result.ok) {
      this.notify(shopFailureMessage(result.reason, result.item));
      return false;
    }
    this.progress = result.progress;
    this.player[item.resource] = result.value;
    this.updateHud();
    this.updateInventoryHud();
    this.updateShopHud();
    this.notify(`${result.item.name} 사용! ${item.resource.toUpperCase()} +${result.recovered}`);
    this.persistProgress();
    return true;
  }

  useInventoryItem(itemId) {
    if (!this.isInventoryOpen()) return false;
    return this.useItem(itemId, { fromInventory: true });
  }

  updateNpcPrompt() {
    const eligible = this.running
      && this.inputEnabled
      && this.mapId === "village"
      && !this.chatInputActive
      && !this.isInteractionOpen()
      && !this.portalTransition
      && this.player.respawnTimer <= 0;
    this.nearbyNpc = eligible ? findNearbyNpc(this.npcs, this.player) : null;
    setPropertyIfChanged(this.ui.npcPrompt, "hidden", !this.nearbyNpc);
    if (this.nearbyNpc && this.ui.npcPromptText) {
      const prompt = {
        shop: "연금술사 미아의 상점 이용하기",
        blacksmith: "대장장이 브란의 대장간 이용하기",
        quest: "현자 아렌과 대화하기",
      }[this.nearbyNpc.role] || `${this.nearbyNpc.name}와 대화하기`;
      setTextIfChanged(this.ui.npcPromptText, prompt);
    }
  }

  tryEnterPortal() {
    if (!this.inputEnabled || this.isInteractionOpen() || this.portalCooldown > 0 || this.portalTransition) return;
    const portal = findActivePortal(this.mapId, this.player.x, this.player.y, PLAYER_RADIUS);
    if (!portal) return;
    if (!portal.destination) {
      this.portalCooldown = 1;
      this.notify("포탈이 불안정합니다.");
      return;
    }

    this.portalTransition = createPortalTransition(portal);
    this.inputEnabled = false;
    this.keys.clear();
    this.player.moving = false;
    const target = getWorldDefinition(portal.destination.mapId);
    if (this.ui.portalDestination) this.ui.portalDestination.textContent = target.name;
    if (this.ui.portalTransitionOverlay) {
      this.ui.portalTransitionOverlay.hidden = false;
      this.ui.portalTransitionOverlay.classList.add("active");
    }
  }

  updatePortalTransition(dt) {
    const tick = advancePortalTransition(this.portalTransition, dt);
    this.portalTransition = tick.state;
    if (tick.shouldSwap) {
      const { mapId, x, y } = tick.state.destination;
      this.switchWorld(mapId, x, y);
    }
    if (!tick.finished) return;

    this.portalCooldown = tick.state.cooldownAfter;
    this.portalTransition = null;
    this.inputEnabled = this.player.respawnTimer <= 0;
    if (this.ui.portalTransitionOverlay) {
      this.ui.portalTransitionOverlay.classList.remove("active");
      this.ui.portalTransitionOverlay.hidden = true;
    }
  }

  switchWorld(mapId, x, y, announce = true) {
    let world = getWorldDefinition(normalizeWorldId(mapId));
    let targetX = x;
    let targetY = y;
    const invalidTarget = !Number.isFinite(targetX)
      || !Number.isFinite(targetY)
      || isWorldPositionBlocked(world.id, targetX, targetY, PLAYER_RADIUS);
    if (invalidTarget) {
      world = getWorldDefinition("village");
      targetX = world.spawn.x;
      targetY = world.spawn.y;
      if (announce) this.notify("포탈이 불안정해 중앙 마을로 돌아왔습니다.");
    }

    this.mapId = world.id;
    this.npcs = getNpcsForWorld(this.mapId);
    this.worldLayer = createWorldLayer(this.mapId);
    this.enemies = createEnemies(this.mapId);
    this.processedEnemyAttackIds = new Set();
    this.processedEnemySpawnIds = new Set();
    this.dynamicEnemySequence = 0;
    this.hitStopRemaining = 0;
    this.player.x = targetX;
    this.player.y = targetY;
    this.player.prevX = targetX;
    this.player.prevY = targetY;
    clearPlayerCombatStatuses(this.player);
    this.remotePlayers.clear();
    this.ui.playerCount.textContent = "1";

    const cameraX = clamp(targetX - innerWidth / 2, 0, Math.max(0, world.width - innerWidth));
    const cameraY = clamp(targetY - innerHeight / 2, 0, Math.max(0, world.height - innerHeight));
    this.camera.x = cameraX;
    this.camera.y = cameraY;
    this.camera.prevX = cameraX;
    this.camera.prevY = cameraY;
    this.drawMinimapBase();
    this.updateBiome();
    if (announce) this.notify(regionEntryMessage(this.mapId));
  }

  tryAttack(kind) {
    if (!this.running || !this.inputEnabled || this.isInteractionOpen() || this.player.respawnTimer > 0 || this.attackState) return;
    const definition = attackDefinition(kind, this.player.equippedWeaponId);
    const cooldown = kind === "strong" ? this.strongCooldown : this.basicCooldown;
    if (cooldown > 0) {
      if (kind === "strong") this.notify(`강한 공격 재사용까지 ${cooldown.toFixed(1)}초`);
      return;
    }
    if (this.player.mp < definition.mpCost) {
      this.notify("강한 공격에 필요한 MP가 부족합니다.");
      return;
    }

    this.player.mp -= definition.mpCost;
    if (kind === "strong") this.strongCooldown = definition.cooldown;
    else this.basicCooldown = definition.cooldown;
    this.attackState = { kind, elapsed: 0, applied: false, definition };
    this.player.moving = false;
    this.updateHud();
  }

  updateAttack(dt) {
    if (!this.attackState) return;
    this.attackState.elapsed += dt;
    if (!this.attackState.applied && this.attackState.elapsed >= this.attackState.definition.windup) {
      this.attackState.applied = true;
      this.applyAttackHits(this.attackState.definition, this.attackState.kind);
    }
    if (this.attackState.elapsed >= this.attackState.definition.duration) this.attackState = null;
  }

  applyAttackHits(definition, kind = "basic") {
    const knockbackDirection = directionVector(this.player.dir);
    const killRewards = [];
    let hit = false;
    for (const enemy of this.enemies) {
      if (enemy.state === "dying") continue;
      if (enemy.targetable === false) continue;
      if (!isTargetInAttackArc(this.player, this.player.dir, enemy, definition.range, definition.arcDegrees)) continue;
      const result = damageEnemy(enemy, definition.damage, knockbackDirection, definition.knockback);
      if (!result.killed) applyEnemyHitStun(enemy, definition.hitStun);
      if (result.killed) {
        const reward = this.recordEnemyKill(enemy.kind, { deferEffects: true });
        if (reward) killRewards.push(reward);
      }
      if (result.damageNumber) {
        hit = true;
        this.damageNumbers.push({ ...result.damageNumber, kind, age: 0, duration: 0.55 });
        this.hitEffects ||= [];
        this.hitEffects.push(createHitEffect({ x: enemy.x, y: enemy.y - enemy.radius * 0.2, kind }));
      }
    }
    if (hit) this.requestHitStop(definition.hitStop);
    this.commitEnemyKillEffects(killRewards);
  }

  applyEnemyContactDamage() {
    for (const enemy of this.enemies) {
      if (enemy.state === "dying" || enemy.targetable === false || enemy.contactMode !== "contact"
        || enemy.contactCooldown > 0 || enemy.hitStunRemaining > 0) continue;
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      if (Math.hypot(dx, dy) >= enemy.radius + PLAYER_RADIUS) continue;
      const result = this.damagePlayer(enemy.contactDamage, enemy);
      if (result.applied) enemy.contactCooldown = enemy.contactCooldownDuration;
      if (result.died) break;
    }
  }

  applyEnemyEvents(events) {
    this.processedEnemyAttackIds ||= new Set();
    this.processedEnemySpawnIds ||= new Set();
    this.dynamicEnemySequence ||= 0;
    for (const event of events) {
      if (event?.type === "apply-player-status") {
        if (
          typeof event.enemyId !== "string"
          || event.enemyId.length === 0
          || event.status !== "slow"
          || !Number.isFinite(event.multiplier)
          || !Number.isFinite(event.duration)
        ) continue;
        if (applyPlayerSlow(this.player, event.multiplier, event.duration)) {
          this.notify("포자에 노출되어 이동속도가 감소했습니다.");
        }
        continue;
      }
      if (event?.type === "spawn-enemies") {
        if (this.processedEnemySpawnIds.has(event.enemyId)) continue;
        this.processedEnemySpawnIds.add(event.enemyId);
        const children = createMagmaChildren(event, {
          isBlocked: (x, y, radius) => isWorldPositionBlocked(this.mapId, x, y, radius),
          createId: () => `${this.mapId}-dynamic-${++this.dynamicEnemySequence}`,
        });
        this.enemies.push(...children);
        continue;
      }
      if (event?.type !== "damage-player" || !event.attackId) continue;
      if (this.processedEnemyAttackIds.has(event.attackId)) continue;
      this.processedEnemyAttackIds.add(event.attackId);
      if (this.damagePlayer(event.amount, event.source).died) break;
    }
  }

  damagePlayer(amount, source) {
    const result = applyPlayerDamage(this.player, amount);
    if (!result.applied) return result;

    const dx = this.player.x - source.x;
    const dy = this.player.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    const pushX = dx / length * 34;
    const pushY = dy / length * 34;
    const nextX = this.player.x + pushX;
    if (!isWorldPositionBlocked(this.mapId, nextX, this.player.y, PLAYER_RADIUS)) this.player.x = nextX;
    const nextY = this.player.y + pushY;
    if (!isWorldPositionBlocked(this.mapId, this.player.x, nextY, PLAYER_RADIUS)) this.player.y = nextY;

    if (result.died) {
      this.inputEnabled = false;
      this.keys.clear();
      this.attackState = null;
      this.player.moving = false;
      this.closeQaPanel();
      this.closeBlacksmith();
      this.closeInventory();
      this.ui.respawnOverlay.hidden = false;
    } else if (this.isInventoryOpen()) {
      this.updateInventoryHud();
    }
    return result;
  }

  finishRespawn() {
    const village = getWorldDefinition("village");
    respawnPlayer(this.player, village.spawn);
    this.switchWorld("village", village.spawn.x, village.spawn.y, false);
    this.ui.respawnOverlay.hidden = true;
    this.inputEnabled = true;
    this.notify("다시 모험을 시작합니다.");
  }

  resetCombatState() {
    const world = getWorldDefinition(this.mapId);
    respawnPlayer(this.player, world.spawn);
    clearPlayerCombatStatuses(this.player);
    this.player.moving = false;
    this.enemies = createEnemies(this.mapId);
    this.processedEnemyAttackIds = new Set();
    this.processedEnemySpawnIds = new Set();
    this.dynamicEnemySequence = 0;
    this.attackState = null;
    this.basicCooldown = 0;
    this.strongCooldown = 0;
    this.damageNumbers = [];
    this.hitEffects = [];
    this.hitStopRemaining = 0;
    this.ui.respawnOverlay.hidden = true;
    this.updateHud();
  }

  updateDamageNumbers(dt) {
    for (const number of this.damageNumbers) {
      number.age += dt;
      number.y -= 24 * dt;
    }
    this.damageNumbers = this.damageNumbers.filter(number => number.age < number.duration);
  }

  updateCamera(dt) {
    const world = getWorldDefinition(this.mapId);
    const targetX = clamp(this.player.x - innerWidth / 2, 0, Math.max(0, world.width - innerWidth));
    const targetY = clamp(this.player.y - innerHeight / 2, 0, Math.max(0, world.height - innerHeight));
    const cameraFactor = 1 - Math.exp(-C.CAMERA_LERP * dt);
    this.camera.x += (targetX - this.camera.x) * cameraFactor;
    this.camera.y += (targetY - this.camera.y) * cameraFactor;
  }

  updateMessage(dt) {
    if (this.messageTimer <= 0) return;
    this.messageTimer -= dt;
    if (this.messageTimer <= 0) this.ui.message.classList.remove("show");
  }

  updateBiome() {
    const biome = getBiome(this.mapId);
    const subtitle = this.ui.playerSubtitle;
    const level = String(this.progress.level);
    if (subtitle.dataset.biome !== biome || subtitle.dataset.level !== level) {
      subtitle.dataset.biome = biome;
      subtitle.dataset.level = level;
      subtitle.textContent = `LV. ${level} · ${biome}`;
    }
  }

  applyProgressionStats(restore = false) {
    const { maxHp, maxMp } = statsForLevel(this.progress.level);
    this.player.maxHp = maxHp;
    this.player.maxMp = maxMp;
    if (restore) {
      this.player.hp = maxHp;
      this.player.mp = maxMp;
    } else {
      this.player.hp = Math.min(this.player.hp, maxHp);
      this.player.mp = Math.min(this.player.mp, maxMp);
    }
  }

  updateHud() {
    setTextIfChanged(this.ui.hpText, `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`);
    setTextIfChanged(this.ui.mpText, `${Math.ceil(this.player.mp)} / ${this.player.maxMp}`);
    setStyleIfChanged(this.ui.hpBar, "transform", `scaleX(${this.player.hp / this.player.maxHp})`);
    setStyleIfChanged(this.ui.mpBar, "transform", `scaleX(${this.player.mp / this.player.maxMp})`);

    const unavailable = this.strongCooldown > 0 || this.player.mp < 20 || this.player.respawnTimer > 0;
    toggleClassIfChanged(this.ui.strongSlot, "unavailable", unavailable);
    setTextIfChanged(this.ui.strongCooldown, this.strongCooldown > 0 ? this.strongCooldown.toFixed(1) : "");
  }

  render(alpha, timestamp = performance.now()) {
    const ctx = this.ctx;
    const world = getWorldDefinition(this.mapId);
    const shake = hitShakeOffset(this.hitEffects);
    const cameraX = clamp(
      lerp(this.camera.prevX, this.camera.x, alpha) + shake.x,
      0,
      Math.max(0, world.width - innerWidth),
    );
    const cameraY = clamp(
      lerp(this.camera.prevY, this.camera.y, alpha) + shake.y,
      0,
      Math.max(0, world.height - innerHeight),
    );
    const viewW = innerWidth;
    const viewH = innerHeight;

    ctx.clearRect(0, 0, viewW, viewH);
    drawWorldLayerViewport(ctx, this.worldLayer, this.mapId, {
      cameraX: Math.floor(cameraX),
      cameraY: Math.floor(cameraY),
      width: viewW,
      height: viewH,
    });

    const entities = [];
    this.remotePlayers.forEach(remote => entities.push({ ...remote, entityType: "player", remote: true }));
    this.enemies.forEach(enemy => entities.push({ entityType: "enemy", enemy, x: enemy.x, y: enemy.y }));
    this.npcs.forEach(npc => entities.push({ entityType: "npc", npc, x: npc.x, y: npc.y }));
    entities.push({
      ...this.player,
      uid: this.network?.uid || "local-player",
      x: lerp(this.player.prevX, this.player.x, alpha),
      y: lerp(this.player.prevY, this.player.y, alpha),
      entityType: "player",
      remote: false,
    });
    entities.sort((a, b) => a.y - b.y);

    const visiblePlayers = [];
    for (const entity of entities) {
      if (entity.x < cameraX - 60 || entity.x > cameraX + viewW + 60 || entity.y < cameraY - 80 || entity.y > cameraY + viewH + 80) continue;
      if (entity.entityType === "enemy") drawEnemy(ctx, entity.enemy, cameraX, cameraY, alpha, { player: this.player });
      else if (entity.entityType === "npc") drawNpc(ctx, entity.npc, cameraX, cameraY);
      else {
        drawPixelCharacter(ctx, entity, cameraX, cameraY, entity.remote ? null : this.attackState);
        visiblePlayers.push(entity);
      }
    }

    drawPlayerSlowEffect(ctx, this.player, cameraX, cameraY);
    if (this.attackState) drawAttackEffect(ctx, this.player, this.attackState, cameraX, cameraY, alpha);
    drawHitEffects(ctx, this.hitEffects, cameraX, cameraY);
    this.drawDamageNumbers(ctx, cameraX, cameraY);
    const bubbles = latestBubblesByUid(this.chatMessages, { mapId: this.mapId, now: Date.now() });
    for (const entity of visiblePlayers) {
      const message = bubbles.get(entity.uid);
      if (message) drawChatBubble(ctx, entity, message, cameraX, cameraY, viewW, viewH);
    }
    this.renderMinimap(timestamp);
  }

  drawDamageNumbers(ctx, cameraX, cameraY) {
    ctx.save();
    ctx.textAlign = "center";
    for (const number of this.damageNumbers) {
      const progress = number.age / number.duration;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = number.value >= 3 ? "#fde047" : "#ffffff";
      const startSize = number.kind === "strong" ? 22 : 19;
      const fontSize = Math.round(15 + (startSize - 15) * Math.max(0, 1 - progress * 2));
      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.fillText(`-${number.value}`, Math.round(number.x - cameraX), Math.round(number.y - cameraY));
    }
    ctx.restore();
  }

  receiveRemotePlayers(players) {
    if (!this.running && !this.network) return;
    const now = performance.now();
    const next = new Map();
    players.forEach((data, uid) => {
      const current = this.remotePlayers.get(uid);
      next.set(uid, {
        uid,
        x: current?.x ?? data.x,
        y: current?.y ?? data.y,
        fromX: current?.x ?? data.x,
        fromY: current?.y ?? data.y,
        targetX: data.x,
        targetY: data.y,
        snapshotAt: now,
        dir: data.dir || "down",
        moving: Boolean(data.moving),
        color: data.color || "#7585d8",
        name: sanitizeName(data.name),
        equippedWeaponId: resolveWeaponDefinition(data.equippedWeaponId).id,
        step: current?.step || 0,
      });
    });
    this.remotePlayers = next;
    this.ui.playerCount.textContent = String(this.remotePlayers.size + 1);
  }

  updateRemoteInterpolation(dt) {
    const now = performance.now();
    this.remotePlayers.forEach(remote => {
      const t = clamp((now - remote.snapshotAt) / C.REMOTE_INTERPOLATION_MS, 0, 1);
      remote.x = lerp(remote.fromX, remote.targetX, easeOutCubic(t));
      remote.y = lerp(remote.fromY, remote.targetY, easeOutCubic(t));
      if (remote.moving) remote.step += dt * 10;
    });
  }

  activateEmptySlot(code) {
    const slot = document.querySelector(`[data-code="${code}"]`);
    if (!slot) return;
    slot.classList.remove("flash");
    void slot.offsetWidth;
    slot.classList.add("flash");
    const isSkill = code.startsWith("Key");
    const key = code.replace("Key", "").replace("Digit", "");
    this.notify(`${key} ${isSkill ? "스킬" : "아이템"} 슬롯은 아직 비어 있습니다.`);
  }

  notify(text) {
    this.ui.message.textContent = text;
    this.ui.message.classList.add("show");
    this.messageTimer = 1.7;
  }

  updateNetworkStatus(status, label) {
    const badge = this.ui.networkBadge;
    badge.className = `status ${status}`;
    badge.textContent = label;
    this.chat.setMode(status === "online" ? "online" : status, status === "online" ? "전체 채팅" : label);
  }

  measurePerformance(timestamp, frameSeconds) {
    this.performanceMetrics ??= createPerformanceMetrics();
    const session = recordPerformanceFrame(this.performanceMetrics, frameSeconds);
    if (isPerformanceTrackingGap(frameSeconds)) {
      this.fpsSamples = [];
      this.lastFpsUpdate = timestamp;
      this.lowFpsSeconds = 0;
      this.highFpsSeconds = 0;
      return;
    }
    if (this.lastFpsUpdate === 0) {
      this.lastFpsUpdate = timestamp;
      this.fpsSamples = [];
      return;
    }
    const fpsSample = fpsSampleFromFrameSeconds(frameSeconds);
    if (fpsSample !== null) this.fpsSamples.push(frameSeconds);
    if (this.fpsSamples.length > 120) this.fpsSamples.shift();
    const elapsedSeconds = (timestamp - this.lastFpsUpdate) / 1000;
    if (elapsedSeconds < 0.5) return;
    this.lastFpsUpdate = timestamp;
    const fps = averageFpsFromFrameSeconds(this.fpsSamples);
    this.fpsSamples = [];
    if (fps === 0) return;
    setTextIfChanged(this.ui.fpsText, String(Math.round(fps)));
    if (this.ui.averageFpsText) setTextIfChanged(this.ui.averageFpsText, String(Math.round(session.averageFps)));
    if (this.ui.minFpsText) setTextIfChanged(this.ui.minFpsText, String(Math.round(session.minFps)));
    if (this.ui.frameDropCount) setTextIfChanged(this.ui.frameDropCount, String(session.frameDropCount));

    if (fps < 45) { this.lowFpsSeconds += elapsedSeconds; this.highFpsSeconds = 0; }
    else if (fps > 57) { this.highFpsSeconds += elapsedSeconds; this.lowFpsSeconds = 0; }
    else {
      this.lowFpsSeconds = Math.max(0, this.lowFpsSeconds - elapsedSeconds / 2);
      this.highFpsSeconds = 0;
    }

    if (this.lowFpsSeconds >= 2 && this.renderScale > C.MIN_RENDER_SCALE) {
      this.renderScale = Math.max(C.MIN_RENDER_SCALE, this.renderScale - 0.25);
      this.lowFpsSeconds = 0;
      this.ui.qualityText.textContent = "성능 우선";
      this.resize();
    } else if (this.highFpsSeconds >= 8 && this.renderScale < Math.min(devicePixelRatio || 1, C.MAX_DPR)) {
      this.renderScale = Math.min(Math.min(devicePixelRatio || 1, C.MAX_DPR), this.renderScale + 0.25);
      this.highFpsSeconds = 0;
      this.ui.qualityText.textContent = "고화질";
      this.resize();
    }
  }

  resetPerformanceMeasurement() {
    this.fpsSamples = [];
    this.lastFpsUpdate = 0;
    this.lowFpsSeconds = 0;
    this.highFpsSeconds = 0;
    this.performanceMetrics = createPerformanceMetrics();
    if (this.ui.fpsText) setTextIfChanged(this.ui.fpsText, "0");
    if (this.ui.averageFpsText) setTextIfChanged(this.ui.averageFpsText, "0");
    if (this.ui.minFpsText) setTextIfChanged(this.ui.minFpsText, "0");
    if (this.ui.frameDropCount) setTextIfChanged(this.ui.frameDropCount, "0");
  }

  drawMinimapBase() {
    const world = getWorldDefinition(this.mapId);
    const context = this.minimapCtx;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, this.minimap.width, this.minimap.height);
    context.drawImage(
      this.worldLayer,
      0,
      0,
      this.worldLayer.width,
      this.worldLayer.height,
      0,
      0,
      this.minimap.width,
      this.minimap.height,
    );
    this.minimapBaseImage = null;
    if (typeof context.getImageData === "function") {
      try {
        this.minimapBaseImage = context.getImageData(0, 0, this.minimap.width, this.minimap.height);
      } catch {
        this.minimapBaseImage = null;
      }
    }
    this.lastMinimapRender = Number.NEGATIVE_INFINITY;
  }

  renderMinimap(timestamp = performance.now()) {
    if (timestamp - this.lastMinimapRender < MINIMAP_FRAME_MS) return;
    this.lastMinimapRender = timestamp;
    const world = getWorldDefinition(this.mapId);
    const context = this.minimapCtx;
    const width = this.minimap.width, height = this.minimap.height;
    if (this.minimapBaseImage && typeof context.putImageData === "function") {
      context.putImageData(this.minimapBaseImage, 0, 0);
    } else {
      context.clearRect(0, 0, width, height);
      context.drawImage(
        this.worldLayer,
        0,
        0,
        this.worldLayer.width,
        this.worldLayer.height,
        0,
        0,
        width,
        height,
      );
    }
    const drawDot = (x, y, color, size) => {
      context.fillStyle = color;
      context.fillRect(Math.round(x / world.width * width - size / 2), Math.round(y / world.height * height - size / 2), size, size);
    };
    this.enemies.forEach(enemy => drawDot(enemy.x, enemy.y, enemy.color, 4));
    this.remotePlayers.forEach(player => drawDot(player.x, player.y, "#f8fafc", 3));
    drawDot(this.player.x, this.player.y, "#ff4d6d", 5);
  }
}

function drawChatBubble(ctx, player, message, cameraX, cameraY, viewportWidth, viewportHeight) {
  const bob = player.moving ? Math.sin(player.step) * 1.6 : 0;
  const screen = worldToScreen({
    worldX: player.x,
    worldY: player.y + bob,
    cameraX,
    cameraY,
    zoom: 1,
  });
  const anchor = {
    x: screen.x,
    topY: screen.y + (player.remote ? -48 : -31),
    bottomY: screen.y + 19,
  };

  ctx.save();
  ctx.font = "700 12px Inter, Pretendard, Arial, sans-serif";
  const layout = layoutChatBubble({
    text: message.text,
    measureText: text => ctx.measureText(text).width,
    anchor,
    viewportWidth,
    viewportHeight,
  });
  const { box, tail, lines } = layout;
  ctx.fillStyle = "rgba(8,15,28,.94)";
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(box.x, box.y, box.width, box.height, 8);
  else ctx.rect(box.x, box.y, box.width, box.height);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tail.x - 7, tail.y);
  ctx.lineTo(tail.x + 7, tail.y);
  ctx.lineTo(tail.x, tail.y + (tail.direction === "down" ? tail.height : -tail.height));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, box.x + box.paddingX, box.y + box.paddingY + index * box.lineHeight + 1);
  });
  ctx.restore();
}

export function drawPixelCharacter(ctx, player, cameraX, cameraY, attackState = null) {
  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y - cameraY);
  const bob = player.moving ? Math.sin(player.step) * 1.6 : 0;
  ctx.save();
  ctx.translate(x, y + bob);

  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(-13, 14, 26, 7);
  drawScabbard(ctx, { direction: player.dir, weaponId: player.equippedWeaponId });
  ctx.fillStyle = "#5b3b2a";
  ctx.fillRect(-9, 6, 7, 12);
  ctx.fillRect(2, 6, 7, 12);
  ctx.fillStyle = player.hitFlash > 0 ? "#ef4444" : "#b88a4e";
  ctx.fillRect(-10, -9, 20, 18);
  ctx.fillStyle = player.hitFlash > 0 ? "#fca5a5" : player.color || "#4f8e5b";
  ctx.fillRect(-14, -11, 6, 20);
  ctx.fillRect(8, -11, 6, 20);
  ctx.fillRect(-12, -14, 24, 5);
  ctx.fillStyle = player.hitFlash > 0 ? "#fecaca" : "#f0c39a";
  ctx.fillRect(-9, -24, 18, 14);
  ctx.fillStyle = "#493329";
  ctx.fillRect(-10, -27, 20, 7);
  ctx.fillRect(-10, -22, 5, 9);
  ctx.fillStyle = "#202938";
  if (player.dir === "left") ctx.fillRect(-7, -18, 2, 2);
  else if (player.dir === "right") ctx.fillRect(5, -18, 2, 2);
  else { ctx.fillRect(-5, -18, 2, 2); ctx.fillRect(3, -18, 2, 2); }
  drawWeapon(ctx, {
    direction: player.dir,
    attackState,
    weaponId: player.equippedWeaponId,
  });

  if (player.remote) {
    const name = sanitizeName(player.name);
    ctx.font = "11px sans-serif";
    const width = Math.ceil(ctx.measureText(name).width) + 10;
    ctx.fillStyle = "rgba(10,16,27,.78)";
    ctx.fillRect(-width / 2, -44, width, 15);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(name, 0, -33);
  }
  ctx.restore();
}

function drawAttackEffect(ctx, player, attackState, cameraX, cameraY, alpha) {
  const x = lerp(player.prevX, player.x, alpha) - cameraX;
  const y = lerp(player.prevY, player.y, alpha) - cameraY;
  const definition = attackState.definition;
  const baseAngle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[player.dir] || 0;
  const halfArc = definition.arcDegrees * Math.PI / 360;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.lineCap = "square";
  if (attackState.elapsed < definition.windup) {
    const charge = definition.windup ? attackState.elapsed / definition.windup : 1;
    ctx.globalAlpha = 0.3 + charge * 0.5;
    ctx.strokeStyle = "#fde047";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24 + charge * 10, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const activeProgress = clamp((attackState.elapsed - definition.windup) / Math.max(0.01, definition.duration - definition.windup), 0, 1);
    ctx.globalAlpha = 1 - activeProgress * 0.75;
    ctx.strokeStyle = attackState.kind === "strong" ? "#fde047" : "#e0f2fe";
    const baseWidth = attackState.kind === "strong" ? 10 : 6;
    ctx.lineWidth = baseWidth * (1 - activeProgress * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, definition.range, baseAngle - halfArc, baseAngle + halfArc);
    ctx.stroke();
  }
  ctx.restore();
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function regionEntryMessage(mapId) {
  return {
    village: "중앙 마을 안전지대입니다.",
    volcano: "화산의 열기와 화염 슬라임을 조심하세요.",
    forest: "숲길의 몬스터를 조심하세요.",
    coast: "해안의 게와 물방울 슬라임을 조심하세요.",
  }[mapId] || "중앙 마을 안전지대입니다.";
}
function sanitizeName(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 12) || "모험가" : "모험가";
}
function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
}
function browserStorage() {
  try {
    return readableProgressStorage(globalThis.localStorage);
  } catch {
    return null;
  }
}
