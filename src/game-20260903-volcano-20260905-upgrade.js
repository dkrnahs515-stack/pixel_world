import { questNotifications } from "./quest-notifications-20260905-upgrade.js";
import { storyGuidance } from "./quest-guidance-20260905-upgrade.js";
import { QuestBanner, drawQuestGuidance } from "./quest-banner-20260905-upgrade.js";
import { rewardCodeEffects } from "./reward-codes-20260905-upgrade.js";
import { applyRewardModifiers, drawSlimeBody, drawPencilWeapon } from "./reward-cosmetics-20260905-upgrade.js";
import { createTripleBossController } from "./triple-boss-controller-20260905-upgrade.js";
import { finalizeSkillResource, tickManaRegen, skillAvailability, createSkillCast, advanceSkillCast } from "./skill-runtime-20260905-upgrade.js";
import { GAME_CONFIG as C } from "./config-20260905-upgrade.js";
import { DEFAULT_CLASS_ID, getClassDefinition, normalizeClassId } from "./class-data-20260905-upgrade.js";
import { drawClassEquipment } from "./class-rendering-20260905-upgrade.js";
import { layoutChatBubble, worldToScreen } from "./chat-bubble-layout-20260903-volcano-20260905-upgrade.js";
import { ChatController } from "./chat-controller-20260903-volcano-20260905-upgrade.js";
import { latestBubblesByUid } from "./chat-state-20260903-volcano-20260905-upgrade.js";
import { attackDefinition, directionVector, isTargetInAttackArc } from "./combat-20260903-volcano-20260905-upgrade.js";
import { advanceHitEffects, createHitEffect, drawHitEffects, hitShakeOffset } from "./combat-effects-20260905-upgrade.js";
import { DialogueController } from "./dialogue-controller-20260829-coast-20260905-upgrade.js";
import {
  applyEnemyHitStun,
  createEnemyInstance,
  createMagmaChildren,
  damageEnemy,
  drawEnemy,
  updateEnemies,
} from "./enemies-20260829-coast-20260905-upgrade.js";
import { getEnemyDefinition } from "./enemy-definitions-20260905-upgrade.js";
import { movementVector } from "./input-20260905-upgrade.js";
import { createNetworkAdapter, createOfflineNetworkAdapter } from "./network-20260903-volcano-20260905-upgrade.js";
import { createCoopBossController } from "./coop-boss-controller-20260903-volcano-20260905-upgrade.js";
import { createLocalBossController } from "./local-boss-controller-20260903-volcano-20260905-upgrade.js";
import { validateBossPlayerDamageEvent } from "./coop-boss-state-20260903-volcano-20260905-upgrade.js";
import {
  completeRegion,
  recordChapterBossDefeat,
} from "./chapter-progress-20260903-volcano-20260905-upgrade.js";
import { getRegionForMap } from "./region-data-20260903-volcano-20260905-upgrade.js";
import {
  getCollectedCoastRecords,
} from "./coast-story-data-20260829-coast-20260905-upgrade.js";
import { actorDialogueModel, storyDialogueModel } from "./story-dialogue-20260903-volcano-20260905-upgrade.js";
import {
  ALL_STORY_INTERACTIONS,
  findNearbyStoryInteraction,
  resolveStoryInteraction,
  storyInteractionPrompt,
} from "./story-interactions-20260903-volcano-20260905-upgrade.js";
import { getNpcsForWorld } from "./npc-data-20260903-volcano-20260905-upgrade.js";
import { drawNpc, findNearbyNpc } from "./npcs-20260905-upgrade.js";
import {
  applyPlayerDamage,
  applyPlayerSlow,
  clearPlayerCombatStatuses,
  createCombatStatusEffects,
  playerMovementMultiplier,
  respawnPlayer,
  tickPlayerStatus,
} from "./player-combat-20260905-upgrade.js";
import { advancePortalTransition, canUsePortal, createPortalTransition } from "./portal-transition-20260903-volcano-20260905-upgrade.js";
import { grantCoopBossReward, grantHuntingReward, statsForLevel } from "./player-progression-20260905-upgrade.js";
import { getCoopBossById, getCoopBossForMap } from "./coop-boss-data-20260903-volcano-20260905-upgrade.js";
import {
  createProjectile,
  updateProjectiles as simulateProjectiles,
} from "./projectile-combat-20260903-volcano-20260905-upgrade.js";
import { drawExplosionEffect, drawProjectile } from "./projectile-rendering-20260905-upgrade.js";
import { loadProgressWithStatus, saveProgress } from "./progress-storage-20260903-volcano-20260905-upgrade.js";
import {
  createPerformanceMetrics,
  isPerformanceTrackingGap,
  recordPerformanceFrame,
  trackedFpsFromFrameSeconds,
} from "./performance-metrics-20260905-upgrade.js";
import {
  findQaBossApproachPosition,
  findQaSpawnPosition,
  getQaMonster,
  prepareWeaponQaProgress,
} from "./qa-mode-20260903-volcano-20260905-upgrade.js";
import { SHOP_ITEMS, buyShopItem, usePotion } from "./shop-state-20260905-upgrade.js";
import {
  buyWeapon,
  equipWeapon,
  getClassEquipment,
  grantVolcanoHiddenWeapons,
  normalizeEquipmentByClass,
  sellWeapon,
} from "./equipment-state-20260903-volcano-20260905-upgrade.js";
import {
  equipmentUiModel,
  renderBlacksmithEquipment,
  renderInventoryEquipment,
} from "./equipment-ui-20260903-volcano-20260905-upgrade.js";
import {
  STARTER_WEAPON_ID,
  getWeaponDefinition,
  resolveWeaponDefinition,
} from "./weapon-data-20260903-volcano-20260905-upgrade.js";
import {
  drawScabbard,
  drawWeapon,
} from "./weapon-rendering-20260903-volcano-20260905-upgrade.js";
import {
  ADVENTURE_QUEST,
  acceptAdventureQuest,
  completeAdventureQuest,
  createInitialProgress,
  recordAdventureKill,
} from "./quest-state-20260903-volcano-20260905-upgrade.js";
import { arenDialogueModel } from "./aren-dialogue-20260829-coast-20260905-upgrade.js";
import { getWorldDefinition, normalizeWorldId } from "./world-data-20260903-volcano-20260905-upgrade.js";
import {
  createWorldLayer,
  drawInvestigationZone,
  drawStorySignal,
  drawWorldLayerViewport,
  findActivePortal,
  getBiome,
  getStoryRenderablesForMap,
  getVolcanoChapterObjective,
  isWorldPositionBlocked,
  prewarmWorldLayers,
} from "./world-20260903-volcano-20260905-upgrade.js";
import {
  advanceVolcanoEruption,
  createVolcanoEruptionState,
  drawVolcanoEruption,
} from "./volcano-eruption-20260903-volcano-20260905-upgrade.js";

const PLAYER_RADIUS = 14;
const PROJECTILE_SPAWN_OFFSET = PLAYER_RADIUS + 18;
const MINIMAP_FRAME_MS = 100;

function createEnemies(mapId) {
  return getWorldDefinition(mapId).enemySpawns
    .map((spawn, index) => createEnemyInstance(
      spawn.kind,
      spawn,
      `${mapId}-enemy-${index + 1}`,
      { step: index * 1.7 },
    ))
    .filter(Boolean);
}

export { advanceHitEffects, createHitEffect, drawHitEffects, hitShakeOffset } from "./combat-effects-20260905-upgrade.js";

export function createGameCanvasContext(canvas) {
  return canvas.getContext("2d", { alpha: false });
}

export function appendStorySignalEntities(entities, storyRenderables) {
  if (!Array.isArray(entities) || !Array.isArray(storyRenderables?.signals)) return entities;
  for (const signal of storyRenderables.signals) {
    if (!Number.isFinite(signal?.x) || !Number.isFinite(signal?.y)) continue;
    entities.push({ entityType: "story-signal", signal, x: signal.x, y: signal.y });
  }
  return entities;
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
    this.classId = DEFAULT_CLASS_ID;
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
      classId: DEFAULT_CLASS_ID,
      speed: getClassDefinition(DEFAULT_CLASS_ID).stats.moveSpeed,
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
    this.volcanoEruptionState = createVolcanoEruptionState();
    this.attackState = null;
    this.projectiles = [];
    this.skillCasts = [];
    this.explosionEffects = [];
    this.projectileSequence = 0;
    this.processedProjectileHitIds = new Set();
    this.basicCooldown = 0;
    this.strongCooldown = 0;
    this.skillCooldowns = {};
    this.skillCasts = [];
    this.player.manaRegenElapsed = 0;
    this.damageNumbers = [];
    this.hitEffects = [];
    this.hitStopRemaining = 0;
    this.network = null;
    this.sessionMode = "solo";
    this.coopBossController = null;
    this.processedBossPlayerDamageIds = new Set();
    this.processedBossRewardIds = new Set();
    this.bossNetworkGeneration = 0;
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
    this.npcs = getNpcsForWorld(this.mapId, this.progress?.worldProgress);
    this.nearbyNpc = null;
    this.nearbyStoryInteraction = null;
    this.pendingStoryInteraction = null;
    this.blacksmithTab = "buy";
    this.pendingWeaponSaleId = null;
    this.dialogue = new DialogueController({
      overlay: elements.dialogueOverlay,
      title: elements.dialogueTitle,
      body: elements.dialogueBody,
      actionButton: elements.dialogueActionButton,
      actionContainer: elements.dialogueActionContainer,
      onAction: action => this.handleDialogueAction(action),
    });
    elements.dialogueCloseButton.addEventListener("click", () => this.closeNpcDialogue());
    elements.dialogueOverlay.addEventListener("keydown", event => {
      if (event.code !== "Tab") return;
      const controls = [...this.dialogue.actionButtons(), elements.dialogueCloseButton];
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
    elements.blacksmithBuyItems?.addEventListener("click", event => {
      const button = event.target.closest?.("[data-buy-weapon]");
      if (button) this.buyBlacksmithWeapon(button.dataset.buyWeapon);
    });
    elements.blacksmithSellItems?.addEventListener("click", event => {
      const button = event.target.closest?.("[data-sell-weapon]");
      if (button) this.requestWeaponSale(button.dataset.sellWeapon);
    });
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
    elements.inventoryWeaponItems?.addEventListener("click", event => {
      const button = event.target.closest?.("[data-equip-weapon]");
      if (button) this.equipInventoryWeapon(button.dataset.equipWeapon);
    });
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
    elements.qaBlacksmithButton?.addEventListener("click", () => this.qaTravelToBlacksmith());
    elements.qaBossButton?.addEventListener("click", () => this.qaApproachBoss());
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
        elements.qaBlacksmithButton,
        elements.qaBossButton,
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

  async enter(nickname, classId = DEFAULT_CLASS_ID, playMode = "solo") {
    if (this.running) return;
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }

    this.player.name = sanitizeName(nickname);
    this.setSessionMode(playMode, "selected");
    const progressStorage = browserStorage();
    const loadedProgress = loadPlayerProgress(progressStorage, this.player.name);
    this.progress = loadedProgress.progress;
    this.savedQuestProgress = null;
    this.questBanner ||= new QuestBanner(document.body);
    this.questBanner.reset();
    this.configureClassSession(classId);
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
    this.closeCommunicationLog();
    this.updateQuestHud();
    this.updateChapterUi();
    this.updateProgressHud();
    this.updateInventoryHud();
    this.updateNpcPrompt();

    if (this.network) await this.network.stop();
    this.chat.reset();
    this.chatMessages = [];
    let entryFallbackReason = null;
    const bossNetworkGeneration = ++this.bossNetworkGeneration;
    const bossNetworkCallbacks = this.createBossNetworkCallbacks(bossNetworkGeneration);
    this.network = await createNetworkAdapter({
      playMode: this.sessionMode,
      onPlayersChanged: (players, metadata) => this.receiveRemotePlayers(players, metadata),
      onStatusChanged: (status, label) => this.updateNetworkStatus(status, label),
      onChatMessagesChanged: messages => this.receiveChatMessages(messages),
      ...bossNetworkCallbacks,
      onConnectionLost: reason => {
        if (this.bossNetworkGeneration === bossNetworkGeneration) void this.fallbackToSolo(reason);
      },
    });
    if (this.network.mode === "solo") {
      this.setSessionMode("solo", this.network.reason);
      if (playMode === "online") entryFallbackReason = this.network.reason;
    }
    await this.replaceBossControllerForMode(this.sessionMode);

    this.persistProgress();
    this.running = true;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.resetPerformanceMeasurement();
    this.notify(loadedProgress.notice);
    if (entryFallbackReason) {
      this.notify(entryFallbackReason === "room_full"
        ? "온라인 인원이 가득 차 솔로 모드로 시작합니다."
        : "온라인 연결에 실패해 솔로 모드로 시작합니다.");
    }
    requestAnimationFrame(timestamp => this.loop(timestamp));
  }

  async leave({ silent = false } = {}) {
    this.questBanner?.reset();
    if (!this.running && !this.network) {
      this.clearProjectiles();
      return;
    }
    this.running = false;
    this.inputEnabled = false;
    this.keys.clear();
    this.player.moving = false;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.clearProjectiles();

    const network = this.network;
    this.network = null;
    this.bossNetworkGeneration += 1;
    this.coopBossController?.clear();
    this.coopBossController = null;
    if (network) await network.stop();

    this.chat.reset();
    this.chatMessages = [];
    this.chatInputActive = false;
    this.closeNpcDialogue();
    this.closeShop();
    this.closeBlacksmith();
    this.closeInventory();
    this.closeQaPanel();
    this.closeCommunicationLog();
    this.nearbyNpc = null;
    this.updateNpcPrompt();

    this.remotePlayers.clear();
    this.portalTransition = null;
    this.portalCooldown = 0;
    this.volcanoEruptionState = createVolcanoEruptionState();
    this.switchWorld("village", getWorldDefinition("village").spawn.x, getWorldDefinition("village").spawn.y, false);
    this.resetCombatState();
    this.ui.playerCount.textContent = "0";
    this.updateNetworkStatus("offline", "나감");
    if (!silent) this.ui.message.classList.remove("show");
  }

  isRunning() {
    return this.running;
  }

  setSessionMode(mode, reason = "selected") {
    this.sessionMode = mode === "online" ? "online" : "solo";
    if (this.player) applyRewardModifiers(this.player, this.progress, this.sessionMode);
    const online = this.sessionMode === "online";
    if (this.ui.chatPanel) this.ui.chatPanel.hidden = !online;
    if (this.ui.onlinePresence) this.ui.onlinePresence.hidden = !online;
    if (this.ui.networkBadge) this.ui.networkBadge.hidden = !online;
    if (!online) {
      if (this.ui.coopBossHud) this.ui.coopBossHud.hidden = true;
      this.remotePlayers.clear();
      this.chatMessages = [];
      this.chat.setMode("offline", "솔로");
      this.receiveChatMessages([]);
      if (this.ui.playerCount) this.ui.playerCount.textContent = "1";
    }
    return { mode: this.sessionMode, reason };
  }

  async fallbackToSolo(reason = "connection_lost") {
    if (this.sessionMode !== "online") return false;
    const network = this.network;
    this.bossNetworkGeneration += 1;
    this.network = createOfflineNetworkAdapter("solo", reason);
    this.coopBossController?.clear?.();
    this.coopBossController = null;
    this.setSessionMode("solo", reason);
    await this.replaceBossControllerForMode("solo");
    try {
      Promise.resolve(network?.stop?.()).catch(() => {});
    } catch {
      // Network teardown is best-effort after the local encounter is ready.
    }
    this.notify(reason === "room_full"
      ? "온라인 인원이 가득 차 솔로 모드로 시작합니다."
      : "온라인 연결이 끊겨 솔로 모드로 전환되었습니다.");
    return true;
  }

  createLocalBossController() {
    if (rewardCodeEffects(this.progress, this.sessionMode).bossCount === 3) return createTripleBossController();
    return createLocalBossController();
  }

  reportBossCallbackError(message, error) {
    console.warn(message, error);
  }

  isCurrentOnlineBossCallback(generation) {
    return generation === this.bossNetworkGeneration && this.sessionMode === "online";
  }

  runBossNetworkCallback(generation, failureMessage, operation) {
    if (!this.isCurrentOnlineBossCallback(generation)) return false;
    try {
      Promise.resolve(operation()).catch(error => this.reportBossCallbackError(failureMessage, error));
      return true;
    } catch (error) {
      this.reportBossCallbackError(failureMessage, error);
      return false;
    }
  }

  createBossNetworkCallbacks(generation) {
    return {
      onBossChanged: snapshot => {
        if (!this.isCurrentOnlineBossCallback(generation)
          || typeof this.coopBossController?.receiveSnapshot !== "function") {
          return false;
        }
        try {
          this.coopBossController.receiveSnapshot(snapshot);
          this.updateCoopBossHud(snapshot, Date.now());
          return true;
        } catch (error) {
          this.reportBossCallbackError("협동 보스 snapshot 처리 실패", error);
          return false;
        }
      },
      onBossAttackRequestsChanged: requests => this.runBossNetworkCallback(
        generation,
        "협동 보스 공격 요청 처리 실패",
        () => this.coopBossController?.receiveAttackRequests?.(requests),
      ),
      onBossPlayerDamageChanged: events => this.runBossNetworkCallback(
        generation,
        "협동 보스 피해 이벤트 처리 실패",
        () => this.receiveBossPlayerDamage?.(events),
      ),
      onBossRewardClaimsChanged: claims => this.runBossNetworkCallback(
        generation,
        "협동 보스 보상 claim 처리 실패",
        () => this.receiveBossRewardClaims?.(claims),
      ),
    };
  }

  createOnlineBossController() {
    if (!this.network?.coopBoss) return null;
    return createCoopBossController({
      uid: this.network.uid,
      network: this.network.coopBoss,
    });
  }

  async replaceBossControllerForMode(mode = this.sessionMode) {
    this.coopBossController?.clear?.();
    this.coopBossController = mode === "online"
      ? this.createOnlineBossController()
      : this.createLocalBossController();
    if (!this.coopBossController) return false;
    const options = mode === "online"
      ? { partySize: this.remotePlayers?.size + 1 || 1 }
      : { partySize: 1 };
    await this.coopBossController.setMap(this.mapId, options);
    this.updateCoopBossHud(this.coopBossController.snapshot, Date.now());
    return true;
  }

  updateCoopBossHud(snapshot, now = Date.now()) {
    const hud = this.ui.coopBossHud;
    if (!hud) return false;
    const definition = getCoopBossById(snapshot?.bossId);
    const hidden = this.sessionMode !== "online"
      || this.mapId === "village"
      || !snapshot
      || !definition;
    setPropertyIfChanged(hud, "hidden", hidden);
    if (hidden) return false;

    const hp = Math.max(0, Number(snapshot.hp) || 0);
    const maxHp = Math.max(1, Number(snapshot.maxHp) || definition.baseHp);
    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
    const participants = Object.keys(snapshot.contributors || {}).length;
    setTextIfChanged(this.ui.coopBossName, definition.name);
    setTextIfChanged(this.ui.coopBossHpText, `${Math.ceil(hp)} / ${Math.ceil(maxHp)}`);
    setTextIfChanged(this.ui.coopBossParticipants, `참여 ${participants}명`);
    setStyleIfChanged(this.ui.coopBossHpBar, "transform", `scaleX(${hpRatio})`);

    if (snapshot.status === "alive") {
      const transitioning = Number(snapshot.leaseUntil) <= now;
      setTextIfChanged(this.ui.coopBossStatus, transitioning ? "관리자 연결 전환 중" : "공동 전투 진행 중");
    } else {
      const seconds = Math.max(0, Math.ceil(((Number(snapshot.respawnAt) || now) - now) / 1000));
      const minutes = Math.floor(seconds / 60);
      const remainder = String(seconds % 60).padStart(2, "0");
      setTextIfChanged(this.ui.coopBossStatus, `처치 완료 · ${minutes}:${remainder} 후 재등장`);
    }
    return true;
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
        else if (event.code === "KeyE" || event.code === "KeyR") this.tryAttack(event.code === "KeyE" ? "skill-e" : "skill-r");
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
        else if (["KeyE", "KeyR"].includes(button.dataset.code)) this.tryAttack(button.dataset.code === "KeyE" ? "skill-e" : "skill-r");
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
    for (const key of Object.keys(this.skillCooldowns || {})) this.skillCooldowns[key] = Math.max(0, this.skillCooldowns[key] - dt);
    tickManaRegen(this.player, dt);
    const wasRespawning = this.player.respawnTimer > 0;
    tickPlayerStatus(this.player, dt);
    if (wasRespawning && this.player.respawnTimer === 0) this.finishRespawn();
    this.updateVolcanoEruption(dt);

    if (this.portalTransition) {
      this.updatePortalTransition(dt);
    } else {
      this.updateSkillCasts(dt);
      this.updateAttack(dt);
      if (this.hitStopRemaining > 0) return;
      this.updateProjectiles(dt);
      if (this.hitStopRemaining > 0) return;
      const isBlocked = (x, y, radius) => isWorldPositionBlocked(this.mapId, x, y, radius);
      const simulation = updateEnemies(this.enemies, this.player, dt, {
        isBlocked,
        portals: getWorldDefinition(this.mapId).portals,
        random: Math.random,
      });
      this.enemies = simulation.enemies;
      this.applyEnemyEvents(simulation.events);
      this.updateBossController(dt, {
        player: { ...this.player, uid: this.network?.uid, mapId: this.mapId },
        remotePlayers: this.remotePlayers,
        isBlocked,
        portals: getWorldDefinition(this.mapId).portals,
        random: Math.random,
      }, performance.now());
      this.updateCoopBossHud(this.coopBossController?.snapshot, Date.now());

      if (this.player.respawnTimer <= 0) {
        this.applyEnemyContactDamage();
        this.updatePlayerMovement(dt);
        this.tryEnterPortal();
      }
    }
    this.updateDamageNumbers(dt);
    this.hitEffects = advanceHitEffects(this.hitEffects, dt);
    this.explosionEffects = (this.explosionEffects || [])
      .map(effect => ({ ...effect, age: effect.age + dt }))
      .filter(effect => effect.age < effect.duration);

    this.updateCamera(dt);
    this.network?.publish(this.player, this.mapId);
    this.updateRemoteInterpolation(dt);
    this.updateMessage(dt);
    this.updateBiome();
    this.updateHud();
    this.updateNpcPrompt();
  }

  isVolcanoEruptionActive() {
    const volcano = this.progress?.worldProgress?.chapters?.volcano;
    return volcano?.eruptionTriggered === true
      && ["rescue", "proceed"].includes(volcano.routeDecision)
      && volcano.coreFragmentObtained !== true
      && ["volcano-observatory", "volcano-core-caldera"].includes(this.mapId);
  }

  updateVolcanoEruption(dt) {
    this.volcanoEruptionState ||= createVolcanoEruptionState();
    const world = getWorldDefinition(this.mapId);
    const tick = advanceVolcanoEruption(this.volcanoEruptionState, dt, {
      active: this.isVolcanoEruptionActive(),
      paused: Boolean(this.portalTransition || this.player.respawnTimer > 0 || this.isInteractionOpen()),
      player: this.player,
      world,
    });
    this.volcanoEruptionState = tick.state;
    for (const event of tick.events) {
      if (Math.hypot(this.player.x - event.x, this.player.y - event.y) <= event.radius) {
        this.damagePlayer(event.damage, { x: event.x, y: event.y });
      }
    }
    return tick.events;
  }

  updatePlayerMovement(dt) {
    const movement = this.inputEnabled && !this.chatInputActive && !this.isInteractionOpen()
      ? movementVector(this.keys)
      : { x: 0, y: 0 };
    const dx = movement.x;
    const dy = movement.y;
    this.player.moving = Boolean(dx || dy);

    if (!this.player.moving) return;
    const speed = (this.player.speed ?? C.PLAYER_SPEED) * playerMovementMultiplier(this.player);
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

  receiveBossPlayerDamage(values) {
    const events = Array.isArray(values) ? values : Object.values(values || {});
    this.processedBossPlayerDamageIds ||= new Set();
    for (const event of events) {
      if (!event?.eventId || this.processedBossPlayerDamageIds.has(event.eventId)) continue;
      const validation = validateBossPlayerDamageEvent(event, {
        encounter: this.coopBossController?.snapshot,
        targetUid: this.network?.uid,
        now: Date.now(),
      });
      if (!validation.ok) continue;
      this.processedBossPlayerDamageIds.add(event.eventId);
      this.damagePlayer(event.damage, this.coopBossController?.renderableBoss() || this.player);
      this.network?.coopBoss?.acknowledgePlayerDamage(event.eventId).catch?.(error => {
        console.warn("협동 보스 피해 이벤트 정리 실패", error);
      });
    }
  }

  handleBossControllerEvents(events) {
    for (const event of events || []) {
      if (event?.type === "damage-player") {
        this.damagePlayer(event.amount ?? event.damage, this.coopBossController?.renderableBoss() || this.player);
      } else if (event?.type === "boss-defeated") {
        this.processBossReward(event, "local-player");
      }
    }
  }

  updateBossController(dt, context = {}, timestamp = performance.now()) {
    const controller = this.coopBossController;
    if (!controller) return [];
    const returnedEvents = controller.update?.(dt, context, timestamp);
    const consumedEvents = controller.consumeEvents?.();
    const events = Array.isArray(consumedEvents)
      ? consumedEvents
      : Array.isArray(returnedEvents) ? returnedEvents : [];
    this.handleBossControllerEvents(events);
    return events;
  }

  processBossReward(event, recipientUid) {
    const definition = getCoopBossById(event?.bossId);
    const uid = typeof recipientUid === "string" && recipientUid ? recipientUid : null;
    if (!definition || !uid || typeof event?.encounterId !== "string"
      || event.mapId !== definition.mapId
      || event.rewardExp !== definition.rewardExp
      || event.rewardGold !== definition.rewardGold) {
      return false;
    }
    const rewardId = `${event.encounterId}:${uid}`;
    const claimedRewardIds = Array.isArray(this.progress.claimedBossRewardIds)
      ? this.progress.claimedBossRewardIds
      : [];
    if (claimedRewardIds.includes(rewardId)) return false;

    const reward = grantCoopBossReward(this.progress, definition);
    if (!reward) return false;
    const region = getRegionForMap(definition.mapId);
    let worldTransition = { progress: reward.progress.worldProgress, effects: [] };
    if (region?.id === "forest") {
      worldTransition = completeRegion(reward.progress.worldProgress, "forest");
    } else if (["coast", "volcano"].includes(region?.id)) {
      worldTransition = recordChapterBossDefeat(reward.progress.worldProgress, region.id);
    }
    const previousProgress = this.progress;
    this.progress = {
      ...reward.progress,
      worldProgress: worldTransition.progress,
      claimedBossRewardIds: [...claimedRewardIds, rewardId].slice(-2_000),
    };
    this.npcs = getNpcsForWorld(this.mapId, this.progress.worldProgress);
    this.applyProgressionStats?.(reward.levelsGained > 0);
    this.updateProgressHud?.();
    this.updateHud?.();
    this.updateBiome?.();
    this.updateChapterUi?.();
    if (!this.persistProgress("보스 보상을 브라우저에 저장할 수 없습니다.")) {
      this.progress = previousProgress;
      this.npcs = getNpcsForWorld(this.mapId, this.progress.worldProgress);
      this.applyProgressionStats?.(false);
      this.updateProgressHud?.();
      this.updateHud?.();
      this.updateBiome?.();
      this.updateChapterUi?.();
      return false;
    }
    this.notify?.(`${definition.name} 처치! EXP +${reward.rewardExp} · Gold +${reward.rewardGold}`);
    if (reward.levelsGained > 0) this.notify?.(this.levelGrowthNotice(reward.levelsGained));
    return true;
  }

  async receiveBossRewardClaims(values) {
    const claims = [];
    for (const value of Object.values(values || {})) {
      if (value?.encounterId) claims.push(value);
      else for (const claim of Object.values(value || {})) if (claim?.encounterId) claims.push(claim);
    }
    this.processedBossRewardIds ||= new Set();
    const timestamp = this.coopBossNow?.() ?? Date.now();
    for (const claim of claims) {
      if (claim.uid !== this.network?.uid || claim.eligible !== true || claim.claimedAt != null) continue;
      const rewardId = `${claim.encounterId}:${claim.uid}`;
      if (this.processedBossRewardIds.has(rewardId)) continue;
      if (!Number.isFinite(claim.expiresAt) || timestamp > claim.expiresAt) {
        await this.network?.coopBoss?.expireRewardClaim?.(claim.encounterId);
        continue;
      }
      const claimedRewardIds = Array.isArray(this.progress.claimedBossRewardIds)
        ? this.progress.claimedBossRewardIds
        : [];
      if (claimedRewardIds.includes(rewardId)) {
        try {
          const claimResult = await this.network.coopBoss.claimReward(claim.encounterId, claim);
          if (claimResult?.ok) this.processedBossRewardIds.add(rewardId);
        } catch {
          // 로컬 영수증이 있으므로 다음 온라인 수신 때 원격 claim만 다시 시도한다.
        }
        continue;
      }
      if (!this.processBossReward({
        encounterId: claim.encounterId,
        bossId: claim.bossId,
        mapId: getCoopBossById(claim.bossId)?.mapId,
        rewardExp: claim.exp,
        rewardGold: claim.gold,
      }, claim.uid)) continue;
      try {
        const claimResult = await this.network.coopBoss.claimReward(claim.encounterId, claim);
        if (claimResult?.ok) this.processedBossRewardIds.add(rewardId);
      } catch {
        // 저장된 영수증으로 중복 지급을 막고 다음 온라인 수신 때 claim을 재시도한다.
      }
    }
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

  isCommunicationLogOpen() {
    return Boolean(this.ui.isCommunicationLogOpen?.());
  }

  isInteractionOpen() {
    return this.isSaleConfirmOpen() || this.isBlacksmithOpen()
      || this.isQaOpen() || this.isDialogueOpen() || this.isShopOpen() || this.isInventoryOpen()
      || this.isCommunicationLogOpen();
  }

  openCommunicationLog() {
    if (!this.ui.openCommunicationLogOverlay || !this.running || !this.inputEnabled || this.chatInputActive
      || this.portalTransition || this.player.respawnTimer > 0 || this.isInteractionOpen()) {
      return false;
    }
    this.setInputEnabled(false);
    this.attackState = null;
    this.ui.openCommunicationLogOverlay();
    return true;
  }

  closeCommunicationLog() {
    if (!this.ui.closeCommunicationLogOverlay || !this.isCommunicationLogOpen()) return false;
    this.ui.closeCommunicationLogOverlay();
    this.keys.clear();
    this.player.moving = false;
    if (this.running && this.player.respawnTimer <= 0) this.setInputEnabled(true);
    else this.updateNpcPrompt();
    this.canvas.focus();
    return true;
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
    this.progress = prepareWeaponQaProgress(this.progress, this.classId);
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
    this.notify(`${getClassDefinition(this.classId).name} 7종 무기 준비 완료 · Lv.30 · 5000 G`);
    return true;
  }

  qaTravelToBlacksmith() {
    if (!this.qaEnabled || !this.running || !this.isQaOpen()) return false;
    const blacksmith = getNpcsForWorld("village").find(npc => npc.role === "blacksmith");
    if (!blacksmith) return false;

    const targetX = blacksmith.x;
    const targetY = blacksmith.y + Math.min(60, blacksmith.interactionRadius - 1);
    if (isWorldPositionBlocked("village", targetX, targetY, PLAYER_RADIUS)) return false;

    this.switchWorld("village", targetX, targetY);
    this.portalCooldown = 1;
    this.closeQaPanel();
    this.notify("브란 앞으로 이동했습니다 · F로 대장간 열기");
    return true;
  }

  resolveQaBossApproachPosition({ mapId, boss, radius, portals }) {
    return findQaBossApproachPosition({
      boss,
      radius,
      portals,
      isBlocked: (x, y, candidateRadius) => isWorldPositionBlocked(mapId, x, y, candidateRadius),
    });
  }

  qaApproachBoss() {
    if (!this.qaEnabled || !this.running || !this.isQaOpen()) return false;
    const definition = getCoopBossForMap(this.mapId);
    if (!definition) {
      this.notify("현재 지역에는 보스가 없습니다.");
      return false;
    }
    const renderedBoss = this.coopBossController?.renderableBoss?.();
    const boss = Number.isFinite(renderedBoss?.x) && Number.isFinite(renderedBoss?.y)
      ? { ...definition, x: renderedBoss.x, y: renderedBoss.y }
      : definition;

    const world = getWorldDefinition(this.mapId);
    const position = this.resolveQaBossApproachPosition({
      mapId: world.id,
      boss,
      radius: PLAYER_RADIUS,
      portals: world.portals,
    });
    if (!position) {
      this.notify("보스 앞으로 이동할 안전한 공간이 없습니다.");
      return false;
    }

    this.keys.clear();
    this.player.moving = false;
    this.attackState = null;
    this.clearProjectiles();
    this.player.x = position.x;
    this.player.y = position.y;
    this.player.prevX = position.x;
    this.player.prevY = position.y;
    this.player.dir = "up";
    this.closeQaPanel();
    this.notify(`${boss.name} 앞으로 이동했습니다.`);
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
    if (this.nearbyStoryInteraction) return this.openStoryInteraction(this.nearbyStoryInteraction);
    const npc = findNearbyNpc(this.npcs, this.player);
    if (!npc) return false;
    if (npc.role === "blacksmith") return this.openBlacksmith(npc);
    if (npc.role === "shop") return this.openShop(npc);
    if (npc.role === "quest") return this.openNpcDialogue(npc);
    if (npc.actorId) return this.openNpcDialogue(npc);
    return false;
  }

  openStoryInteraction(interaction = this.nearbyStoryInteraction) {
    if (!interaction) return false;
    this.keys.clear();
    this.player.moving = false;
    this.attackState = null;
    this.pendingStoryInteraction = interaction;
    this.dialogue.open(storyDialogueModel(interaction, this.progress.worldProgress));
    this.dialogue.actionButtons()[0]?.focus();
    this.updateNpcPrompt();
    return true;
  }

  openNpcDialogue(npc = findNearbyNpc(this.npcs, this.player)) {
    if (!npc) return false;
    const model = npc.role === "quest" && npc.id === "aren"
      ? arenDialogueModel(this.progress)
      : npc.actorId
        ? actorDialogueModel(npc.actorId, this.progress.worldProgress)
        : null;
    if (!model) return false;

    this.keys.clear();
    this.player.moving = false;
    this.attackState = null;
    this.nearbyNpc = npc;
    this.pendingStoryInteraction = null;
    this.dialogue.open(model);
    this.dialogue.actionButtons()[0]?.focus();
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
    this.pendingStoryInteraction = null;
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
    if (this.pendingStoryInteraction && action.startsWith("story-")) {
      let response;
      if (action === "story-classify-current") response = { classification: "current" };
      else if (action === "story-classify-past") response = { classification: "past" };
      else if (action.startsWith("story-support-")) response = { choice: action.slice("story-support-".length) };
      else if (action.startsWith("story-volcano-route-")) {
        response = { decision: action.slice("story-volcano-route-".length) };
      }
      const completed = this.applyStoryInteraction(this.pendingStoryInteraction.id, response);
      if (completed) this.closeNpcDialogue();
      else this.notify("신호를 다시 확인해 보세요.");
      return;
    }
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
      const previousProgress = this.progress;
      const result = completeAdventureQuest(this.progress);
      this.progress = result.progress;
      if (result.rewardExp > 0) {
        if (!this.persistProgress()) { this.progress = previousProgress; return; }
        this.applyProgressionStats(result.levelsGained > 0);
        this.updateQuestHud();
        this.updateProgressHud();
        this.updateHud();
        this.updateBiome();
        this.notify("퀘스트 완료! EXP 15 · Gold 30을 획득했습니다.");
        if (result.levelsGained > 0) {
          this.notify(this.levelGrowthNotice(result.levelsGained));
        }
      }
    }
    this.closeNpcDialogue();
  }

  applyStoryInteraction(interactionId, response) {
    const result = resolveStoryInteraction(this.progress.worldProgress, interactionId, response);
    if (["acknowledged", "returned"].includes(result.outcome)) return true;
    if (result.outcome !== "completed") return false;
    const previousProgress = this.progress;
    let nextProgress = { ...this.progress, worldProgress: result.progress };
    let hiddenReward = null;
    if (interactionId === "volcano-captain-outcome"
      && result.progress?.chapters?.volcano?.captainOutcome === "rescued") {
      hiddenReward = grantVolcanoHiddenWeapons(nextProgress);
      if (!hiddenReward.ok) return false;
      nextProgress = hiddenReward.progress;
    }
    this.progress = nextProgress;
    this.npcs = getNpcsForWorld(this.mapId, this.progress.worldProgress);
    this.updateChapterUi?.();
    this.updateInventoryHud?.();
    this.updateBlacksmithHud?.();
    if (this.ui?.npcPrompt) this.updateNpcPrompt();
    if (!this.persistProgress("스토리 진행을 브라우저에 저장할 수 없습니다.")) {
      this.progress = previousProgress;
      this.npcs = getNpcsForWorld(this.mapId, this.progress.worldProgress);
      this.updateChapterUi?.();
      this.updateInventoryHud?.();
      this.updateBlacksmithHud?.();
      if (this.ui?.npcPrompt) this.updateNpcPrompt();
      return false;
    }
    if (hiddenReward?.ok) this.notify?.("선발대장 구출 보상으로 세 직업의 히든 무기를 획득했습니다.");
    return true;
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
      this.notify(this.levelGrowthNotice(rewards.reduce((sum, reward) => sum + reward.levelsGained, 0)));
    }
    this.persistProgress();
  }

  persistProgress(failureMessage = "진행 상황을 브라우저에 저장할 수 없습니다.") {
    const events = questNotifications(this.savedQuestProgress ?? null, this.progress, { saved: true });
    const candidate = { ...this.progress, questNotificationIds: events.ids };
    const result = saveProgress(browserStorage(), this.player.name, candidate);
    if (!result.ok) { this.notify(failureMessage); return false; }
    this.progress = candidate;
    this.savedQuestProgress = structuredClone(candidate);
    this.questBanner?.enqueue(events.notifications);
    return true;
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

  updateChapterUi() {
    const worldProgress = this.progress?.worldProgress;
    const objective = this.currentChapterObjective();
    if (this.ui.chapterObjective) {
      this.ui.chapterObjective.textContent = `CHAPTER · ${objective.label}`;
    }
    this.ui.renderCommunicationLog?.(getCollectedCoastRecords(worldProgress));
  }

  currentChapterObjective() {
    return getVolcanoChapterObjective(this.progress?.worldProgress);
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
    const equipment = getClassEquipment(this.progress, this.classId);
    if (this.ui.inventoryWeaponItems) {
      const model = equipmentUiModel({
        classId: this.classId,
        level: this.progress.level,
        gold: this.progress.gold,
        equipment,
      });
      renderInventoryEquipment(this.ui, model);
      this.ui.inventoryWeaponCards = [...this.ui.inventoryWeaponItems.querySelectorAll("[data-inventory-weapon]")];
      this.ui.equipWeaponButtons = [...this.ui.inventoryWeaponItems.querySelectorAll("[data-equip-weapon]")];
      return;
    }
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
    const equipmentByClass = normalizeEquipmentByClass(this.progress.equipmentByClass);
    const equipment = equipmentByClass[this.classId];
    this.progress.equipmentByClass = Object.fromEntries(Object.entries(equipmentByClass).map(
      ([classId, classEquipment]) => [classId, {
        ...classEquipment,
        ownedWeaponIds: [...classEquipment.ownedWeaponIds],
      }],
    ));
    const weapon = resolveWeaponDefinition(equipment.equippedWeaponId, this.classId);
    this.player.equippedWeaponId = weapon.id;
    return weapon;
  }

  configureClassSession(classId) {
    this.player.skillResources = {};
    this.skillCasts = [];
    this.classId = normalizeClassId(classId);
    this.player.classId = this.classId;
    applyRewardModifiers(this.player, this.progress, this.sessionMode);
    this.player.speed = getClassDefinition(this.classId).stats.moveSpeed;
    this.syncEquippedWeapon();
    this.applyProgressionStats(true);
    return this.classId;
  }

  equipInventoryWeapon(weaponId) {
    if (!this.isInventoryOpen()) return false;
    const result = equipWeapon(this.progress, this.classId, weaponId);
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
        getClassEquipment(this.progress, this.classId).equippedWeaponId,
        this.classId,
      ).name;
    }
    const equipment = getClassEquipment(this.progress, this.classId);
    if (this.ui.blacksmithBuyItems && this.ui.blacksmithSellItems) {
      const model = equipmentUiModel({
        classId: this.classId,
        level: this.progress.level,
        gold: this.progress.gold,
        equipment,
      });
      renderBlacksmithEquipment(this.ui, model);
      this.ui.buyWeaponButtons = [...this.ui.blacksmithBuyItems.querySelectorAll("[data-buy-weapon]")];
      this.ui.sellWeaponButtons = [...this.ui.blacksmithSellItems.querySelectorAll("[data-sell-weapon]")];
      this.ui.buyWeaponCards = [...this.ui.blacksmithBuyItems.querySelectorAll("[data-buy-weapon-card]")];
      this.ui.sellWeaponCards = [...this.ui.blacksmithSellItems.querySelectorAll("[data-sell-weapon-card]")];
      this.ui.buyWeaponStatuses = [...this.ui.blacksmithBuyItems.querySelectorAll("[data-buy-weapon-status]")];
      this.ui.sellWeaponStatuses = [...this.ui.blacksmithSellItems.querySelectorAll("[data-sell-weapon-status]")];
      return;
    }
    const owned = new Set(equipment.ownedWeaponIds);
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
      const equipped = equipment.equippedWeaponId === weapon.id;
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
    const result = buyWeapon(this.progress, this.classId, weaponId);
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
    const result = sellWeapon(this.progress, this.classId, weaponId);
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
    const result = sellWeapon(this.progress, this.classId, weaponId);
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
      && !this.chatInputActive
      && !this.isInteractionOpen()
      && !this.portalTransition
      && this.player.respawnTimer <= 0;
    this.nearbyStoryInteraction = eligible
      ? findNearbyStoryInteraction(ALL_STORY_INTERACTIONS, { ...this.player, mapId: this.mapId }, this.progress?.worldProgress)
      : null;
    this.nearbyNpc = eligible && !this.nearbyStoryInteraction ? findNearbyNpc(this.npcs, this.player) : null;
    const nearby = this.nearbyStoryInteraction || this.nearbyNpc;
    setPropertyIfChanged(this.ui.npcPrompt, "hidden", !nearby);
    if (this.nearbyStoryInteraction && this.ui.npcPromptText) {
      setTextIfChanged(this.ui.npcPromptText, storyInteractionPrompt(this.nearbyStoryInteraction));
    } else if (this.nearbyNpc && this.ui.npcPromptText) {
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
    if (!canUsePortal(portal, this.progress.worldProgress)) {
      this.portalCooldown = 1;
      this.notify(`${portal.label || "목적지"} 포탈은 아직 열리지 않았습니다.`);
      return;
    }

    this.portalTransition = createPortalTransition(portal);
    this.clearProjectiles();
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
    this.clearProjectiles();
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
    this.npcs = getNpcsForWorld(this.mapId, this.progress?.worldProgress);
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
    this.updateCoopBossHud(null, Date.now());
    const bossOptions = this.sessionMode === "online"
      ? { partySize: this.remotePlayers.size + 1, deferEncounter: true }
      : { partySize: 1 };
    this.coopBossController?.setMap(this.mapId, bossOptions).catch(error => {
      console.warn("협동 보스 지역 전환 실패", error);
    });

    const cameraX = clamp(targetX - innerWidth / 2, 0, Math.max(0, world.width - innerWidth));
    const cameraY = clamp(targetY - innerHeight / 2, 0, Math.max(0, world.height - innerHeight));
    this.camera.x = cameraX;
    this.camera.y = cameraY;
    this.camera.prevX = cameraX;
    this.camera.prevY = cameraY;
    this.drawMinimapBase();
    this.updateBiome();
    this.updateChapterUi();
    if (announce) this.notify(regionEntryMessage(this.mapId));
  }

  tryAttack(kind) {
    if (!this.running || !this.inputEnabled || this.isInteractionOpen() || this.player.respawnTimer > 0 || this.attackState) return;
    const definition = attackDefinition(kind, this.classId, this.player.equippedWeaponId, this.progress?.level || this.player.level || 1);
    if (kind === "skill-e" || kind === "skill-r") return this.trySkill(kind, definition);
    const cooldown = kind === "strong" ? this.strongCooldown : this.basicCooldown;
    if (cooldown > 0) {
      if (kind === "strong") this.notify(`Q 스킬 재사용까지 ${cooldown.toFixed(1)}초`);
      return false;
    }
    if (this.player.mp < definition.mpCost) {
      this.notify("Q 스킬에 필요한 MP가 부족합니다.");
      return false;
    }

    this.player.mp -= definition.mpCost;
    if (kind === "strong") this.strongCooldown = definition.cooldown;
    else this.basicCooldown = definition.cooldown;
    if (definition.delivery === "melee") {
      this.attackState = { kind, elapsed: 0, applied: false, definition };
    } else {
      const direction = directionVector(this.player.dir);
      this.projectiles ||= [];
      this.projectiles.push(createProjectile({
        id: this.nextProjectileId(),
        kind: definition.projectileKind,
        classId: this.classId,
        weaponId: this.player.equippedWeaponId,
        x: this.player.x + direction.x * PROJECTILE_SPAWN_OFFSET,
        y: this.player.y + direction.y * PROJECTILE_SPAWN_OFFSET,
        direction: this.player.dir,
        level: this.progress?.level || this.player.level || 1,
      }));
      this.attackState = { kind, elapsed: 0, applied: true, definition };
    }
    this.player.moving = false;
    this.updateHud();
    return true;
  }

  targetableBosses() {
    return this.coopBossController?.targetableBosses?.() || [this.coopBossController?.targetableBoss?.()].filter(Boolean);
  }

  trySkill(kind, definition) {
    this.skillCooldowns ||= {};
    const reason = skillAvailability(definition, { ...this.player, level: this.progress.level }, this.skillCooldowns[kind] || 0);
    if (reason) {
      this.notify(reason === "level" ? `${definition.name}: 레벨 ${definition.requiredLevel} 해금` : reason === "mana" ? `MP ${definition.mpCost} 필요` : `${definition.name} 재사용까지 ${this.skillCooldowns[kind].toFixed(1)}초`);
      return false;
    }
    const cast = createSkillCast(kind, this.classId, this.player.equippedWeaponId, this.progress.level, this.player, this.nextProjectileId());
    cast.player = { ...this.player, mapId: this.mapId };
    this.player.mp -= definition.mpCost;
    this.skillCooldowns[kind] = definition.cooldown;
    if (definition.delivery === "dash") {
      const vector = directionVector(this.player.dir);
      for (let distance = 0; distance < definition.dashDistance; distance += 5) {
        const x = this.player.x + vector.x * 5, y = this.player.y + vector.y * 5;
        if (isWorldPositionBlocked(this.mapId, x, y, this.player.radius)) break;
        this.player.x = x; this.player.y = y;
      }
      cast.x = this.player.x; cast.y = this.player.y;
      cast.player.x = this.player.x; cast.player.y = this.player.y;
    }
    finalizeSkillResource(this.player, cast);
    this.skillCasts ||= [];
    this.skillCasts.push(cast);
    this.updateHud();
    return true;
  }

  updateSkillCasts(dt) {
    if (this.player.hp <= 0 || this.player.respawnTimer > 0) { this.skillCasts = []; return; }
    for (const cast of this.skillCasts || []) {
      const d = cast.definition;
      for (const pulse of advanceSkillCast(cast, dt)) {
        if (["spread", "slow"].includes(d.delivery)) {
          const vector = directionVector(cast.direction);
          this.projectiles ||= [];
          this.projectiles.push(createProjectile({ id: pulse.id, castId: cast.id, hitIndex: pulse.hitIndex, kind: d.projectileKind, playerSnapshot: cast.player, classId: cast.classId, weaponId: cast.weaponId, level: cast.level, x: cast.x + vector.x * PROJECTILE_SPAWN_OFFSET, y: cast.y + vector.y * PROJECTILE_SPAWN_OFFSET, direction: cast.direction, angle: d.delivery === "spread" ? (pulse.hitIndex - 1) * 0.22 : 0 }));
          continue;
        }
        const vector = directionVector(cast.direction);
        const targets = [...this.enemies, ...this.targetableBosses()];
        const hits = targets.filter(t => t.hp > 0 && t.targetable !== false && (d.radius ? Math.hypot(t.x - cast.x, t.y - cast.y) <= d.radius + (t.radius || 0) : isTargetInAttackArc(cast, cast.direction, t, d.range, d.arcDegrees)));
        const rewards = [];
        for (const target of hits) {
          if (target.isCoopBoss) {
            this.coopBossController.requestHit({ targetId: target.id, attackKind: cast.kind, castId: cast.id, hitIndex: pulse.hitIndex, player: { ...cast.player, x: this.player.x, y: this.player.y }, classId: cast.classId, weaponId: cast.weaponId, direction: cast.direction }).catch?.(error => console.warn("스킬 요청 실패", error));
          } else {
            const result = damageEnemy(target, d.damage, vector, d.knockback);
            if (!result.killed) applyEnemyHitStun(target, d.hitStun);
            if (result.killed) { const reward = this.recordEnemyKill(target.kind, { deferEffects: true }); if (reward) rewards.push(reward); }
            if (result.damageNumber) this.damageNumbers.push({ ...result.damageNumber, kind: "strong", age: 0, duration: 0.55 });
          }
        }
        this.commitEnemyKillEffects(rewards);
        this.explosionEffects ||= [];
        this.explosionEffects.push({x:cast.x,y:cast.y,radius:d.radius || d.range,delivery:d.delivery,age:0,duration:0.25});
      }
    }
    this.skillCasts = (this.skillCasts || []).filter(cast => cast.elapsed < Math.max(cast.definition.duration, cast.definition.windup + (cast.definition.hitCount - 1) * cast.definition.interval));
  }

  levelGrowthNotice(levels = 1) {
    const rules = getClassDefinition(normalizeClassId(this.classId)).stats;
    return `LEVEL UP! LV.${this.progress.level} · 공격력 +${levels * rules.attackPerLevel} · 최대 HP +${levels * rules.maxHpPerLevel} · 최대 MP +${levels * rules.maxMpPerLevel} · HP·MP 회복`;
  }

  updateSkillHud() {
    if (typeof document === "undefined" || typeof document.querySelector !== "function") return;
    for (const [key, kind] of [["KeyE", "skill-e"], ["KeyR", "skill-r"]]) {
      const slot = document.querySelector(`[data-code="${key}"]`);
      if (!slot) continue;
      const d = attackDefinition(kind, this.classId, this.player.equippedWeaponId, this.progress?.level || this.player.level || 1);
      const cooldown = this.skillCooldowns?.[kind] || 0;
      const locked = this.progress.level < d.requiredLevel;
      setTextIfChanged(slot.querySelector(".skill-name"), d.name);
      setTextIfChanged(slot.querySelector(".skill-damage"), `피해 ${Number(d.damage.toFixed(1))}×${d.hitCount}`);
      setTextIfChanged(slot.querySelector(".skill-cost"), locked ? `Lv.${d.requiredLevel} 해금` : `MP ${d.mpCost} · ${d.cooldown}초`);
      setTextIfChanged(slot.querySelector(".cooldown"), cooldown > 0 ? cooldown.toFixed(1) : "");
      slot.title = `${d.name}: 피해 ${d.damage} × ${d.hitCount}, MP ${d.mpCost}, 재사용 ${d.cooldown}초, Lv.${d.requiredLevel}`;
      toggleClassIfChanged(slot, "unavailable", locked || cooldown > 0 || this.player.mp < d.mpCost);
    }
  }

  nextProjectileId() {
    this.projectileSequence = (this.projectileSequence || 0) + 1;
    return `local-projectile-${this.projectileSequence}`;
  }

  clearProjectiles() {
    this.projectiles = [];
    this.skillCasts = [];
    this.explosionEffects = [];
    this.processedProjectileHitIds = new Set();
  }

  updateProjectiles(dt) {
    if (!(this.projectiles?.length > 0)) return;
    const world = getWorldDefinition(this.mapId);
    const result = simulateProjectiles(this.projectiles, dt, {
      isBlocked: (x, y, radius) => isWorldPositionBlocked(this.mapId, x, y, radius),
      worldBounds: { width: world.width, height: world.height },
      enemies: this.enemies,
      bosses: this.targetableBosses(),
    });
    this.projectiles = result.projectiles;
    this.applyProjectileHits(result.hits);
    this.explosionEffects ||= [];
    this.explosionEffects.push(...result.explosions.map(explosion => ({
      ...explosion,
      age: 0,
      duration: 0.35,
    })));
  }

  applyProjectileHits(events) {
    this.processedProjectileHitIds ||= new Set();
    const killRewards = [];
    let hitStop = 0;
    for (const event of events || []) {
      const eventId = `${event.projectileId}:${event.enemyId}`;
      if (this.processedProjectileHitIds.has(eventId)) continue;
      if (event.targetType === "coop-boss") {
        this.processedProjectileHitIds.add(eventId);
        this.coopBossController?.requestHit({
          targetId: event.enemyId, castId: event.castId, hitIndex: event.hitIndex,
          attackKind: event.attackKind || (event.kind === "piercing-arrow" || event.kind === "explosive-bolt" ? "strong" : "basic"),
          player: { ...this.player, ...event.playerSnapshot, x: this.player.x, y: this.player.y, mapId: this.mapId },
          classId: event.classId || this.classId,
          weaponId: event.weaponId || this.player.equippedWeaponId,
          direction: event.direction || this.player.dir,
        }).catch?.(error => console.warn("협동 보스 공격 요청 실패", error));
        continue;
      }
      const enemy = this.enemies.find(candidate => candidate.id === event.enemyId);
      if (!enemy || enemy.state === "dying" || enemy.targetable === false) continue;
      this.processedProjectileHitIds.add(eventId);
      const direction = { x: event.directionX || 0, y: event.directionY || 0 };
      const result = damageEnemy(enemy, event.damage, direction, event.knockback);
      if (!result.killed) applyEnemyHitStun(enemy, event.hitStun);
      if (!result.killed && event.slowDuration) { enemy.slowRemaining = event.slowDuration; enemy.slowMultiplier = event.slowMultiplier; }
      if (result.killed) {
        const reward = this.recordEnemyKill(enemy.kind, { deferEffects: true });
        if (reward) killRewards.push(reward);
      }
      if (!result.damageNumber) continue;
      const attackKind = event.kind === "piercing-arrow" || event.kind === "explosive-bolt"
        ? "strong"
        : "basic";
      this.damageNumbers.push({ ...result.damageNumber, kind: attackKind, age: 0, duration: 0.55 });
      this.hitEffects ||= [];
      this.hitEffects.push(createHitEffect({
        x: enemy.x,
        y: enemy.y - enemy.radius * 0.2,
        kind: attackKind,
      }));
      hitStop = Math.max(hitStop, event.hitStop || 0);
    }
    if (hitStop > 0) this.requestHitStop(hitStop);
    this.commitEnemyKillEffects(killRewards);
  }

  updateAttack(dt) {
    if (!this.attackState) return;
    this.attackState.elapsed += dt;
    if (this.attackState.definition.delivery === "melee"
      && !this.attackState.applied
      && this.attackState.elapsed >= this.attackState.definition.windup) {
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
    for (const boss of this.targetableBosses()) {
    if (!this.attackState?.requestedBossIds?.has(boss.id) && isTargetInAttackArc(this.player, this.player.dir, boss, definition.range, definition.arcDegrees)) {
      if (this.attackState) { this.attackState.requestedBossIds ||= new Set(); this.attackState.requestedBossIds.add(boss.id); }
      this.coopBossController.requestHit({
        targetId: boss.id,
        attackKind: kind,
        player: { ...this.player, mapId: this.mapId },
        classId: this.classId,
        weaponId: this.player.equippedWeaponId,
        direction: this.player.dir,
      }).catch?.(error => console.warn("협동 보스 공격 요청 실패", error));
      hit = true;
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
    if (rewardCodeEffects(this.progress, this.sessionMode).immortal) return { applied: false, died: false };
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
      this.clearProjectiles();
      this.player.moving = false;
      this.closeQaPanel();
      this.closeBlacksmith();
      this.closeInventory();
      this.closeCommunicationLog();
      this.ui.respawnOverlay.hidden = false;
    } else if (this.isInventoryOpen()) {
      this.updateInventoryHud();
    }
    return result;
  }

  finishRespawn() {
    const village = getWorldDefinition("village");
    this.clearProjectiles();
    respawnPlayer(this.player, village.spawn);
    this.player.manaRegenElapsed = 0;
    this.switchWorld("village", village.spawn.x, village.spawn.y, false);
    this.ui.respawnOverlay.hidden = true;
    this.inputEnabled = true;
    this.notify("다시 모험을 시작합니다.");
  }

  resetCombatState() {
    this.player.skillResources = {};
    const world = getWorldDefinition(this.mapId);
    respawnPlayer(this.player, world.spawn);
    clearPlayerCombatStatuses(this.player);
    this.player.moving = false;
    this.enemies = createEnemies(this.mapId);
    this.processedEnemyAttackIds = new Set();
    this.processedEnemySpawnIds = new Set();
    this.dynamicEnemySequence = 0;
    this.attackState = null;
    this.clearProjectiles();
    this.basicCooldown = 0;
    this.strongCooldown = 0;
    this.skillCooldowns = {};
    this.skillCasts = [];
    this.player.manaRegenElapsed = 0;
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
    const { maxHp, maxMp, attackBonus } = statsForLevel(this.progress.level, this.classId);
    this.player.level = this.progress.level;
    this.player.attackBonus = attackBonus;
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

    const strongDefinition = attackDefinition("strong", this.classId, this.player.equippedWeaponId, this.progress?.level || this.player.level || 1);
    this.updateSkillHud();
    const classDefinition = getClassDefinition(normalizeClassId(this.classId));
    const strongSkillName = this.ui.strongSkillName || this.ui.strongSlot?.querySelector?.(".skill-name");
    const strongSkillCost = this.ui.strongSkillCost || this.ui.strongSlot?.querySelector?.(".skill-cost");
    if (strongSkillName) setTextIfChanged(strongSkillName, classDefinition.strongLabel);
    if (strongSkillCost) setTextIfChanged(strongSkillCost, `MP ${strongDefinition.mpCost}`);
    const unavailable = this.strongCooldown > 0
      || this.player.mp < strongDefinition.mpCost
      || this.player.respawnTimer > 0;
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
    const storyRenderables = getStoryRenderablesForMap(this.mapId, this.progress?.worldProgress);
    if (storyRenderables.objective) drawInvestigationZone(ctx, storyRenderables.objective, cameraX, cameraY);
    drawVolcanoEruption(ctx, this.volcanoEruptionState, {
      cameraX,
      cameraY,
      active: this.isVolcanoEruptionActive(),
    });

    for (const projectile of this.projectiles || []) {
      drawProjectile(ctx, projectile, {
        alpha,
        cameraX,
        cameraY,
        viewWidth: viewW,
        viewHeight: viewH,
      });
    }

    const entities = [];
    this.remotePlayers.forEach(remote => entities.push({ ...remote, entityType: "player", remote: true }));
    this.enemies.forEach(enemy => entities.push({ entityType: "enemy", enemy, x: enemy.x, y: enemy.y }));
    for (const cast of this.skillCasts || []) {
      if (!cast.definition.radius || cast.elapsed >= cast.definition.windup) continue;
      ctx.save(); ctx.strokeStyle = cast.definition.delivery === "meteor" ? "#ff8a42" : "#7dd3fc"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cast.x - cameraX, cast.y - cameraY, cast.definition.radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    const coopBoss = this.coopBossController?.renderableBoss();
    const visibleBosses = this.coopBossController?.renderableBosses?.() || (coopBoss ? [coopBoss] : []);
    for (const boss of visibleBosses) {
      if (boss.hp > 0) entities.push({ entityType: "coop-boss", enemy: boss, x: boss.x, y: boss.y });
    }
    this.npcs.forEach(npc => entities.push({ entityType: "npc", npc, x: npc.x, y: npc.y }));
    appendStorySignalEntities(entities, storyRenderables);
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
      if (entity.entityType === "enemy" || entity.entityType === "coop-boss") drawEnemy(ctx, entity.enemy, cameraX, cameraY, alpha, { player: this.player });
      else if (entity.entityType === "npc") drawNpc(ctx, entity.npc, cameraX, cameraY);
      else if (entity.entityType === "story-signal") drawStorySignal(ctx, entity.signal, cameraX, cameraY);
      else {
        drawPixelCharacter(ctx, entity, cameraX, cameraY, entity.remote ? null : this.attackState);
        visiblePlayers.push(entity);
      }
    }

    drawPlayerSlowEffect(ctx, this.player, cameraX, cameraY);
    if (this.attackState?.definition.delivery === "melee") {
      drawAttackEffect(ctx, this.player, this.attackState, cameraX, cameraY, alpha);
    }
    drawHitEffects(ctx, this.hitEffects, cameraX, cameraY);
    for (const effect of this.explosionEffects || []) {
      drawExplosionEffect(ctx, effect, { cameraX, cameraY });
    }
    this.drawDamageNumbers(ctx, cameraX, cameraY);
    drawQuestGuidance(ctx, this.getStoryGuidance({ x: cameraX, y: cameraY, width: viewW, height: viewH }), cameraX, cameraY, viewW, viewH);
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

  receiveRemotePlayers(players, metadata = {}) {
    if (!this.running && !this.network) return;
    const now = performance.now();
    const next = new Map();
    players.forEach((data, uid) => {
      const current = this.remotePlayers.get(uid);
      const classId = normalizeClassId(data.classId);
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
        classId,
        equippedWeaponId: resolveWeaponDefinition(
          data.equippedWeaponId,
          classId,
        ).id,
        step: current?.step || 0,
        hp: Number.isFinite(data.hp) ? data.hp : 100,
        joinedAt: Number.isFinite(data.joinedAt) ? data.joinedAt : Number.POSITIVE_INFINITY,
        mapId: this.mapId,
      });
    });
    this.remotePlayers = next;
    this.ui.playerCount.textContent = String(this.remotePlayers.size + 1);
    this.coopBossController?.setPartySize(this.remotePlayers.size + 1);
    this.coopBossController?.setParticipants?.([
      { uid: this.network?.uid, joinedAt: metadata.ownJoinedAt ?? this.network?.joinedAt },
      ...this.remotePlayers.values(),
    ]);
    this.coopBossController?.ensureReady?.().catch?.(error => {
      console.warn("협동 보스 생성 준비 실패", error);
    });
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

  getStoryGuidance(camera = { x: 0, y: 0, width: 1, height: 1 }) {
    return storyGuidance({ interactions: ALL_STORY_INTERACTIONS, worldProgress: this.progress?.worldProgress,
      mapId: this.mapId, player: this.player, camera, world: getWorldDefinition(this.mapId),
      minimap: { width: this.minimap?.width ?? 220, height: this.minimap?.height ?? 140 } });
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
    const storyObjective = getStoryRenderablesForMap(this.mapId, this.progress?.worldProgress).objective;
    if (storyObjective) {
      drawInvestigationZone(context, storyObjective, 0, 0, {
        scaleX: width / world.width,
        scaleY: height / world.height,
      });
    }
    for (const marker of this.getStoryGuidance().markers) drawDot(marker.x, marker.y, marker.completed ? "#647a72" : "#ffe090", marker.completed ? 3 : 5);
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
  if (player.skinId === 'slime') {
    drawSlimeBody(ctx, player);
  } else {
  drawClassEquipment(ctx, { classId: player.classId, direction: player.dir });
  if (!player.pencilWeapon || player.remote) drawScabbard(ctx, {
    classId: player.classId,
    direction: player.dir,
    weaponId: player.equippedWeaponId,
  });
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
  }
  if (player.pencilWeapon && !player.remote) drawPencilWeapon(ctx, { dir: player.dir, attackState });
  else drawWeapon(ctx, {
    classId: player.classId,
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
export function regionEntryMessage(mapId) {
  return {
    village: "중앙 마을 안전지대입니다.",
    volcano: "잿불 관문에 도착했습니다. 압력 봉인장치를 복구하세요.",
    forest: "숲길의 몬스터를 조심하세요.",
    "coast-beach": "푸른 해변에 도착했습니다. 게와 물방울 슬라임을 조심하세요.",
    "coast-wreck-bay": "난파선 만에 도착했습니다. 흩어진 중계 신호를 찾으세요.",
    "coast-flooded-station": "침수된 통신소에 도착했습니다. 끊긴 기록을 복구하세요.",
    "coast-tide-core-cave": "조수 코어 동굴에 도착했습니다. 깊은 물결의 보스를 조심하세요.",
    "volcano-magma-route": "용암 수송로에 도착했습니다. 세 용암 밸브를 찾으세요.",
    "volcano-observatory": "붕괴한 관측소에 도착했습니다. 분화 낙하 지점을 조심하세요.",
    "volcano-core-caldera": "화구 코어 제단에 도착했습니다. 오염된 선발대장을 막으세요.",
    sanctuary: "세 코어 조각이 픽셀 코어 성역의 문을 열었습니다.",
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
