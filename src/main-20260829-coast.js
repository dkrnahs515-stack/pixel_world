import { PixelRPG, interactionKeyAction } from "./game-20260829-coast.js";
import { chatKeyAction } from "./chat-controller-20260829-coast.js";
import { drawClassPreview } from "./class-rendering.js";
import { renderCommunicationLog } from "./communication-log-20260829-coast.js";
import {
  entryButtonLabel,
  getBrowserStorage,
  readStoredClassId,
  storeClassId,
  validateEntrySelection,
} from "./class-selection.js";
import { readStoredPlayMode, storePlayMode } from "./play-mode.js";
import { isQaMode } from "./qa-mode.js";

const qaEnabled = isQaMode(location.search);

const elements = {
  qaEnabled,
  canvas: document.querySelector("#game"),
  minimap: document.querySelector("#minimap"),
  hpBar: document.querySelector("#hpBar"),
  hpText: document.querySelector("#hpText"),
  mpBar: document.querySelector("#mpBar"),
  mpText: document.querySelector("#mpText"),
  fpsText: document.querySelector("#fpsText"),
  averageFpsText: document.querySelector("#averageFpsText"),
  minFpsText: document.querySelector("#minFpsText"),
  frameDropCount: document.querySelector("#frameDropCount"),
  playerCount: document.querySelector("#playerCount"),
  qualityText: document.querySelector("#qualityText"),
  networkBadge: document.querySelector("#networkBadge"),
  onlinePresence: document.querySelector("#onlinePresence"),
  message: document.querySelector("#message"),
  playerSubtitle: document.querySelector(".player-header small"),
  playerName: document.querySelector("#playerName"),
  respawnOverlay: document.querySelector("#respawnOverlay"),
  strongSlot: document.querySelector("#strongSlot"),
  strongSkillName: document.querySelector("#strongSkillName"),
  strongSkillCost: document.querySelector("#strongSkillCost"),
  strongCooldown: document.querySelector("#strongCooldown"),
  portalTransitionOverlay: document.querySelector("#portalTransitionOverlay"),
  portalDestination: document.querySelector("#portalDestination"),
  chatPanel: document.querySelector("#chatPanel"),
  coopBossHud: document.querySelector("#coopBossHud"),
  coopBossName: document.querySelector("#coopBossName"),
  coopBossHpBar: document.querySelector("#coopBossHpBar"),
  coopBossHpText: document.querySelector("#coopBossHpText"),
  coopBossParticipants: document.querySelector("#coopBossParticipants"),
  coopBossStatus: document.querySelector("#coopBossStatus"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatStatus: document.querySelector("#chatStatus"),
  dialogueOverlay: document.querySelector("#dialogueOverlay"),
  dialogueTitle: document.querySelector("#dialogueTitle"),
  dialogueBody: document.querySelector("#dialogueBody"),
  dialogueActionButton: document.querySelector("#dialogueActionButton"),
  dialogueActionContainer: document.querySelector("#dialogueActions"),
  dialogueCloseButton: document.querySelector("#dialogueCloseButton"),
  communicationLogButton: document.querySelector("#communicationLogButton"),
  communicationLogOverlay: document.querySelector("#communicationLogOverlay"),
  communicationLogCloseButton: document.querySelector("#communicationLogCloseButton"),
  communicationLogList: document.querySelector("#communicationLogList"),
  isCommunicationLogOpen: () => !elements.communicationLogOverlay.hidden,
  openCommunicationLogOverlay,
  closeCommunicationLogOverlay,
  renderCommunicationLog: records => renderCommunicationLog(elements.communicationLogList, records),
  npcPrompt: document.querySelector("#npcPrompt"),
  npcPromptText: document.querySelector("#npcPromptText"),
  shopOverlay: document.querySelector("#shopOverlay"),
  shopGoldText: document.querySelector("#shopGoldText"),
  shopCloseButton: document.querySelector("#shopCloseButton"),
  shopDoneButton: document.querySelector("#shopDoneButton"),
  buyHpPotionButton: document.querySelector("#buyHpPotionButton"),
  buyMpPotionButton: document.querySelector("#buyMpPotionButton"),
  shopHpPotionCount: document.querySelector("#shopHpPotionCount"),
  shopMpPotionCount: document.querySelector("#shopMpPotionCount"),
  blacksmithOverlay: document.querySelector("#blacksmithOverlay"),
  blacksmithGoldText: document.querySelector("#blacksmithGoldText"),
  blacksmithEquippedWeaponText: document.querySelector("#blacksmithEquippedWeaponText"),
  blacksmithCloseButton: document.querySelector("#blacksmithCloseButton"),
  blacksmithBuyTab: document.querySelector("#blacksmithBuyTab"),
  blacksmithSellTab: document.querySelector("#blacksmithSellTab"),
  blacksmithBuyPanel: document.querySelector("#blacksmithBuyPanel"),
  blacksmithSellPanel: document.querySelector("#blacksmithSellPanel"),
  blacksmithBuyItems: document.querySelector("#blacksmithBuyItems"),
  blacksmithSellItems: document.querySelector("#blacksmithSellItems"),
  blacksmithEmptySaleText: document.querySelector("#blacksmithEmptySaleText"),
  weaponSaleConfirmOverlay: document.querySelector("#weaponSaleConfirmOverlay"),
  weaponSaleConfirmText: document.querySelector("#weaponSaleConfirmText"),
  weaponSaleCancelButton: document.querySelector("#weaponSaleCancelButton"),
  weaponSaleConfirmButton: document.querySelector("#weaponSaleConfirmButton"),
  inventoryButton: document.querySelector("#inventoryButton"),
  inventoryOverlay: document.querySelector("#inventoryOverlay"),
  inventoryCloseButton: document.querySelector("#inventoryCloseButton"),
  inventoryDoneButton: document.querySelector("#inventoryDoneButton"),
  inventoryHpPotionCount: document.querySelector("#inventoryHpPotionCount"),
  inventoryMpPotionCount: document.querySelector("#inventoryMpPotionCount"),
  inventoryHpUseButton: document.querySelector("#inventoryHpUseButton"),
  inventoryMpUseButton: document.querySelector("#inventoryMpUseButton"),
  inventoryWeaponItems: document.querySelector("#inventoryWeaponItems"),
  qaButton: document.querySelector("#qaButton"),
  qaOverlay: document.querySelector("#qaOverlay"),
  qaCloseButton: document.querySelector("#qaCloseButton"),
  qaDoneButton: document.querySelector("#qaDoneButton"),
  qaWorldButtons: [...document.querySelectorAll("[data-qa-world]")],
  qaMonsterButtons: [...document.querySelectorAll("[data-qa-monster]")],
  qaWeaponButton: document.querySelector("[data-qa-weapons='prepare']"),
  qaBlacksmithButton: document.querySelector("[data-qa-blacksmith='travel']"),
  hpPotionSlot: document.querySelector("#hpPotionSlot"),
  mpPotionSlot: document.querySelector("#mpPotionSlot"),
  hpPotionCount: document.querySelector("#hpPotionCount"),
  mpPotionCount: document.querySelector("#mpPotionCount"),
  questTracker: document.querySelector("#questTracker"),
  questProgress: document.querySelector("#questProgress"),
  chapterObjective: document.querySelector("#chapterObjective"),
  expText: document.querySelector("#expText"),
  expBar: document.querySelector("#expBar"),
  goldText: document.querySelector("#goldText"),
};

elements.qaButton.hidden = !qaEnabled;

const game = new PixelRPG(elements);
const hud = document.querySelector("#hud");
const entryOverlay = document.querySelector("#entryOverlay");
const exitOverlay = document.querySelector("#exitOverlay");
const nicknameForm = document.querySelector("#nicknameForm");
const nicknameInput = document.querySelector("#nicknameInput");
const nicknameLength = document.querySelector("#nicknameLength");
const nicknameError = document.querySelector("#nicknameError");
const classError = document.querySelector("#classError");
const classCards = [...document.querySelectorAll("[data-class-id]")];
const classPreviews = [...document.querySelectorAll("[data-class-preview]")];
const playModeError = document.querySelector("#playModeError");
const playModeCards = [...document.querySelectorAll("[data-play-mode]")];
const enterButton = document.querySelector("#enterButton");
const exitButton = document.querySelector("#exitButton");
const cancelExitButton = document.querySelector("#cancelExitButton");
const confirmExitButton = document.querySelector("#confirmExitButton");
const browserStorage = getBrowserStorage(globalThis);

elements.communicationLogButton?.addEventListener("click", () => {
  game.openCommunicationLog();
});
elements.communicationLogCloseButton?.addEventListener("click", () => {
  game.closeCommunicationLog();
});
elements.communicationLogOverlay?.addEventListener("keydown", event => {
  event.stopPropagation();
  if (event.code === "Escape") {
    event.preventDefault();
    game.closeCommunicationLog();
  } else if (event.code === "Tab") {
    event.preventDefault();
    elements.communicationLogCloseButton?.focus();
  }
});
renderCommunicationLog(elements.communicationLogList, []);

function openCommunicationLogOverlay() {
  elements.communicationLogOverlay.hidden = false;
  elements.communicationLogCloseButton?.focus();
}

function closeCommunicationLogOverlay() {
  elements.communicationLogOverlay.hidden = true;
  elements.communicationLogButton?.focus();
}

const storedName = readStoredNickname();
let selectedClassId = readStoredClassId(browserStorage);
let selectedPlayMode = readStoredPlayMode(browserStorage);
nicknameInput.value = storedName;
updateNicknameLength();
for (const preview of classPreviews) {
  drawClassPreview(preview.getContext("2d"), preview.dataset.classPreview);
}
updateClassSelection();
updatePlayModeSelection();
queueMicrotask(() => nicknameInput.focus());

nicknameInput.addEventListener("input", () => {
  nicknameInput.classList.remove("invalid");
  nicknameError.textContent = "";
  updateNicknameLength();
});

for (const card of classCards) {
  card.addEventListener("click", () => selectClass(card.dataset.classId));
  card.addEventListener("keydown", event => {
    const currentIndex = classCards.indexOf(card);
    const previous = event.code === "ArrowLeft" || event.code === "ArrowUp";
    const next = event.code === "ArrowRight" || event.code === "ArrowDown";
    let targetIndex = currentIndex;
    if (previous) targetIndex = (currentIndex - 1 + classCards.length) % classCards.length;
    else if (next) targetIndex = (currentIndex + 1) % classCards.length;
    else if (event.code === "Home") targetIndex = 0;
    else if (event.code === "End") targetIndex = classCards.length - 1;
    else if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      selectClass(card.dataset.classId, { focus: true });
      return;
    } else {
      return;
    }
    event.preventDefault();
    selectClass(classCards[targetIndex].dataset.classId, { focus: true });
  });
}

for (const card of playModeCards) {
  card.addEventListener("click", () => selectPlayMode(card.dataset.playMode));
  card.addEventListener("keydown", event => {
    const currentIndex = playModeCards.indexOf(card);
    const previous = event.code === "ArrowLeft" || event.code === "ArrowUp";
    const next = event.code === "ArrowRight" || event.code === "ArrowDown";
    let targetIndex = currentIndex;
    if (previous) targetIndex = (currentIndex - 1 + playModeCards.length) % playModeCards.length;
    else if (next) targetIndex = (currentIndex + 1) % playModeCards.length;
    else if (event.code === "Home") targetIndex = 0;
    else if (event.code === "End") targetIndex = playModeCards.length - 1;
    else if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      selectPlayMode(card.dataset.playMode, { focus: true });
      return;
    } else {
      return;
    }
    event.preventDefault();
    selectPlayMode(playModeCards[targetIndex].dataset.playMode, { focus: true });
  });
}

nicknameForm.addEventListener("submit", async event => {
  event.preventDefault();
  const selection = validateEntrySelection(nicknameInput.value, selectedClassId, selectedPlayMode);
  nicknameError.textContent = "";
  classError.textContent = "";
  playModeError.textContent = "";
  if (!selection.ok) {
    if (selection.field === "classId") {
      classError.textContent = selection.error;
      classCards[0]?.focus();
      return;
    }
    if (selection.field === "playMode") {
      playModeError.textContent = selection.error;
      playModeCards[0]?.focus();
      return;
    }
    nicknameInput.classList.add("invalid");
    nicknameError.textContent = selection.error;
    nicknameInput.focus();
    return;
  }

  enterButton.disabled = true;
  enterButton.textContent = "세계에 접속 중...";
  try {
    storeNickname(selection.nickname);
    storeClassId(browserStorage, selection.classId);
    storePlayMode(browserStorage, selection.playMode);
    await game.enter(selection.nickname, selection.classId, selection.playMode);
    entryOverlay.hidden = true;
    hud.hidden = false;
  } catch (error) {
    console.error(error);
    nicknameError.textContent = "게임 접속에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    enterButton.disabled = selectedClassId === null;
    updateEntryButton();
  }
});

exitButton.addEventListener("click", openExitDialog);
cancelExitButton.addEventListener("click", closeExitDialog);
confirmExitButton.addEventListener("click", async () => {
  confirmExitButton.disabled = true;
  confirmExitButton.textContent = "나가는 중...";
  try {
    await game.leave();
    exitOverlay.hidden = true;
    hud.hidden = true;
    entryOverlay.hidden = false;
    nicknameInput.value = readStoredNickname();
    updateNicknameLength();
    nicknameInput.focus();
  } finally {
    confirmExitButton.disabled = false;
    confirmExitButton.textContent = "게임 나가기";
  }
});

addEventListener("keydown", event => {
  if (!["Enter", "Escape"].includes(event.code)) return;
  const interactionAction = interactionKeyAction({
    code: event.code,
    qaOpen: game.isQaOpen(),
    saleConfirmOpen: game.isSaleConfirmOpen(),
    blacksmithOpen: game.isBlacksmithOpen(),
    inventoryOpen: game.isInventoryOpen(),
    shopOpen: game.isShopOpen(),
    dialogueOpen: game.isDialogueOpen(),
  });
  if (interactionAction !== null) {
    if (interactionAction === "close-sale-confirm") game.cancelWeaponSale();
    else if (interactionAction === "close-blacksmith") game.closeBlacksmith();
    else if (interactionAction === "close-qa") game.closeQaPanel();
    else if (interactionAction === "close-inventory") game.closeInventory();
    else if (interactionAction === "close-shop") game.closeShop();
    else if (interactionAction === "close-dialogue") game.closeNpcDialogue();
    if (interactionAction !== "block") event.preventDefault();
    return;
  }
  const action = chatKeyAction({
    code: event.code,
    typing: game.isChatTyping(),
    running: game.isRunning(),
    exitOpen: !exitOverlay.hidden,
  });
  if (action === "open") {
    event.preventDefault();
    game.openChatInput();
    return;
  }
  if (action === "cancel") {
    event.preventDefault();
    game.cancelChatInput();
    return;
  }
  if (event.code !== "Escape") return;
  if (!exitOverlay.hidden) {
    closeExitDialog();
  } else if (game.isRunning()) {
    openExitDialog();
  }
});

addEventListener("pagehide", () => {
  game.leave({ silent: true });
});

function openExitDialog() {
  if (!game.isRunning()) return;
  game.closeNpcDialogue();
  game.closeShop();
  game.closeBlacksmith();
  game.closeInventory();
  game.closeQaPanel();
  game.cancelChatInput();
  game.setInputEnabled(false);
  exitOverlay.hidden = false;
  cancelExitButton.focus();
}

function closeExitDialog() {
  exitOverlay.hidden = true;
  game.setInputEnabled(true);
  exitButton.focus();
}

function updateNicknameLength() {
  nicknameLength.textContent = String(Array.from(nicknameInput.value.trim()).length);
}

function selectClass(classId, { focus = false } = {}) {
  if (!classCards.some(card => card.dataset.classId === classId)) return false;
  selectedClassId = classId;
  classError.textContent = "";
  updateClassSelection();
  if (focus) classCards.find(card => card.dataset.classId === classId)?.focus();
  return true;
}

function updateClassSelection() {
  for (const [index, card] of classCards.entries()) {
    const selected = card.dataset.classId === selectedClassId;
    card.setAttribute("aria-checked", String(selected));
    card.classList.toggle("selected", selected);
    card.tabIndex = selected || (selectedClassId === null && index === 0) ? 0 : -1;
    const state = card.querySelector(".selection-state");
    if (state) state.textContent = selected ? "선택됨" : "선택";
  }
  updateEntryButton();
}

function selectPlayMode(playMode, { focus = false } = {}) {
  if (!playModeCards.some(card => card.dataset.playMode === playMode)) return false;
  selectedPlayMode = playMode;
  playModeError.textContent = "";
  updatePlayModeSelection();
  if (focus) playModeCards.find(card => card.dataset.playMode === playMode)?.focus();
  return true;
}

function updatePlayModeSelection() {
  for (const card of playModeCards) {
    const selected = card.dataset.playMode === selectedPlayMode;
    card.setAttribute("aria-checked", String(selected));
    card.classList.toggle("selected", selected);
    card.tabIndex = selected ? 0 : -1;
  }
  updateEntryButton();
}

function updateEntryButton() {
  enterButton.disabled = selectedClassId === null;
  if (selectedClassId === null) {
    enterButton.textContent = entryButtonLabel(null);
    return;
  }
  const action = selectedPlayMode === "online" ? "온라인으로 접속" : "솔로로 시작";
  enterButton.textContent = `${entryButtonLabel(selectedClassId)} · ${action}`;
}

function normalizeNickname(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 12);
}

function validateNickname(value) {
  const length = Array.from(value).length;
  if (length < 1) return "닉네임을 입력해 주세요.";
  if (length > 12) return "닉네임은 12자 이내로 입력해 주세요.";
  if (/[<>\\/{}\[\]]/.test(value)) return "닉네임에 사용할 수 없는 문자가 포함되어 있습니다.";
  return "";
}

function readStoredNickname() {
  try {
    return browserStorage?.getItem?.("pixelWorldNickname") || "";
  } catch {
    return "";
  }
}

function storeNickname(nickname) {
  try {
    browserStorage?.setItem?.("pixelWorldNickname", nickname);
  } catch {
    // 닉네임 기억 기능이 막혀도 현재 게임 입장은 계속한다.
  }
}
