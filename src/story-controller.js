import { CHAPTER_01, STORY_SCENE_IDS } from "./story-chapter-01-data.js";
import {
  advanceStory,
  completeComparison,
  createInitialStoryState,
  discoverClue,
  submitEvidence,
} from "./story-state.js";
import {
  clearStoryProgress,
  loadStoryProgress,
  saveStoryProgress,
} from "./story-storage.js";

let elements = null;
let storyState = createInitialStoryState();
let storageStatus = "empty";
let selectedClaimId = null;
let selectedEvidenceIds = [];
let modalReturnFocus = null;

function sceneProgress(sceneId) {
  return `${STORY_SCENE_IDS.indexOf(sceneId) + 1}/8`;
}

function currentArt(state) {
  const scene = CHAPTER_01.scenes[state.sceneId];
  if (scene.artId && state.revealedArtIds.includes(scene.artId)) return CHAPTER_01.art[scene.artId];
  return state.revealedArtIds.includes("theo") ? CHAPTER_01.art.theo : null;
}

function setStatus(message, shouldFocus = false) {
  if (!elements) return;
  elements.status.textContent = message;
  if (shouldFocus) {
    elements.status.setAttribute("tabindex", "-1");
    elements.status.focus();
  }
}

function focusSceneTitle() {
  queueMicrotask(() => elements?.sceneTitle.focus());
}

function controlLabel(prefix, completed) {
  return completed ? `${prefix} · 확인함` : prefix;
}

function clueButton(clueId, state) {
  const clue = CHAPTER_01.clues[clueId];
  const discovered = state.discoveredClueIds.includes(clueId);
  return `<button type="button" data-clue-id="${clueId}" aria-pressed="${discovered}">${controlLabel(clue.title, discovered)}<span> — ${clue.document}</span></button>`;
}

function comparisonButton(comparisonId, state) {
  const comparison = CHAPTER_01.comparisons[comparisonId];
  const completed = state.completedComparisonIds.includes(comparisonId);
  return `<button type="button" data-comparison-id="${comparisonId}" aria-pressed="${completed}">${controlLabel(comparison.title, completed)}<span> — ${comparison.result}</span></button>`;
}

function caseSubmissionControls(state) {
  const requiredClues = CHAPTER_01.scenes["case-submit"].requiredClueIds
    .map(clueId => clueButton(clueId, state));
  const claims = Object.entries(CHAPTER_01.claims).map(([claimId, claim]) => {
    const selected = selectedClaimId === claimId;
    return `<button type="button" data-claim-id="${claimId}" aria-pressed="${selected}">${selected ? "선택함 · " : ""}${claim.title}</button>`;
  });
  const evidence = Object.entries(CHAPTER_01.evidence).map(([evidenceId, item]) => {
    const selected = selectedEvidenceIds.includes(evidenceId);
    const available = item.source === "clue"
      ? state.discoveredClueIds.includes(item.sourceId)
      : state.completedComparisonIds.includes(item.sourceId);
    return `<button type="button" data-evidence-id="${evidenceId}" aria-pressed="${selected}"${available ? "" : " disabled"}>${selected ? "선택함 · " : ""}${item.label}</button>`;
  });
  return [...requiredClues, ...claims, ...evidence, '<button type="button" data-story-submit>근거 제출</button>'].join("");
}

function actionsForScene(state) {
  const scene = CHAPTER_01.scenes[state.sceneId];
  if (state.sceneId === "case-submit") return caseSubmissionControls(state);

  const clues = scene.requiredClueIds.map(clueId => clueButton(clueId, state));
  const comparisons = scene.requiredComparisonIds.map(comparisonId => comparisonButton(comparisonId, state));
  return [...clues, ...comparisons, '<button type="button" data-story-next>다음 기록</button>'].join("");
}

function renderClues(state) {
  if (state.discoveredClueIds.length === 0) {
    elements.clues.innerHTML = "<li>아직 확인한 단서가 없습니다.</li>";
    return;
  }
  elements.clues.innerHTML = state.discoveredClueIds
    .map(clueId => `<li><strong>${CHAPTER_01.clues[clueId].title}</strong> — ${CHAPTER_01.clues[clueId].document}</li>`)
    .join("");
}

function showArt(art) {
  if (!art) {
    elements.art.hidden = true;
    return;
  }
  elements.art.width = art.width;
  elements.art.height = art.height;
  elements.art.alt = art.alt;
  elements.art.hidden = false;
  elements.artFallback.querySelector("p").textContent = art.description;
  if (elements.art.getAttribute("src") !== art.path) elements.art.src = art.path;
}

export function renderScene(state) {
  if (!elements) return;
  const scene = CHAPTER_01.scenes[state.sceneId];
  elements.chapterLabel.textContent = `제01장 · 길드 기록 보관실 · ${CHAPTER_01.title}`;
  elements.progress.textContent = `조사 진행 ${sceneProgress(state.sceneId)}`;
  elements.narrative.textContent = scene.copy;
  elements.sceneTitle.textContent = scene.title;
  elements.document.innerHTML = `<p class="story-document-stamp">공식 기록</p><p>${scene.document}</p>`;
  elements.actions.innerHTML = actionsForScene(state);
  renderClues(state);
  showArt(currentArt(state));
}

function saveCheckpoint() {
  if (storageStatus === "unsupported") return;
  const saved = saveStoryProgress(window.localStorage, storyState);
  if (!saved.ok) setStatus(saved.error, true);
}

function beginChapter() {
  selectedClaimId = null;
  selectedEvidenceIds = [];
  storyState = createInitialStoryState();
  elements.startOverlay.hidden = true;
  elements.screen.hidden = false;
  elements.completion.hidden = true;
  renderScene(storyState);
  saveCheckpoint();
  focusSceneTitle();
}

function closeResetDialog() {
  elements.resetOverlay.hidden = true;
  modalReturnFocus?.focus();
  modalReturnFocus = null;
}

function openResetDialog(trigger) {
  modalReturnFocus = trigger;
  elements.resetOverlay.hidden = false;
  queueMicrotask(() => elements.resetConfirm.focus());
}

function confirmReset() {
  const cleared = storageStatus === "unsupported"
    ? { ok: true, error: "" }
    : clearStoryProgress(window.localStorage);
  if (!cleared.ok) setStatus(cleared.error, true);
  storageStatus = "empty";
  beginChapter();
  elements.resetOverlay.hidden = true;
  modalReturnFocus = null;
}

function handleNew() {
  if (storageStatus === "loaded") {
    openResetDialog(elements.newButton);
    return;
  }
  beginChapter();
}

function handleContinue() {
  const loaded = loadStoryProgress(window.localStorage);
  if (loaded.status !== "loaded") return;
  storageStatus = loaded.status;
  storyState = loaded.state;
  selectedClaimId = null;
  selectedEvidenceIds = [];
  elements.startOverlay.hidden = true;
  elements.screen.hidden = false;
  renderScene(storyState);
  if (storyState.chapterComplete) elements.completion.hidden = false;
  else focusSceneTitle();
}

function handleNext() {
  const result = advanceStory(storyState);
  storyState = result.state;
  if (!result.ok) {
    setStatus(result.feedback, true);
    return;
  }
  renderScene(storyState);
  setStatus(result.feedback);
  saveCheckpoint();
  if (storyState.chapterComplete) {
    elements.completion.hidden = false;
    return;
  }
  focusSceneTitle();
}

function handleEvidenceSubmit() {
  const result = submitEvidence(storyState, {
    claimId: selectedClaimId,
    evidenceIds: selectedEvidenceIds,
  });
  storyState = result.state;
  if (!result.accepted) {
    setStatus(result.feedback, true);
    return;
  }
  selectedClaimId = null;
  selectedEvidenceIds = [];
  renderScene(storyState);
  setStatus(result.feedback);
  saveCheckpoint();
  focusSceneTitle();
}

function retryArt() {
  const art = currentArt(storyState);
  if (!art) return;
  elements.art.hidden = false;
  elements.artFallback.hidden = true;
  elements.artRetry.hidden = true;
  elements.art.removeAttribute("src");
  elements.art.src = art.path;
}

function handleActionClick(event) {
  const button = event.target.closest("button");
  if (!button || !elements.actions.contains(button)) return;
  if (button.dataset.clueId) {
    storyState = discoverClue(storyState, button.dataset.clueId);
    renderScene(storyState);
    return;
  }
  if (button.dataset.comparisonId) {
    storyState = completeComparison(storyState, button.dataset.comparisonId);
    renderScene(storyState);
    return;
  }
  if (button.dataset.claimId) {
    selectedClaimId = button.dataset.claimId;
    renderScene(storyState);
    return;
  }
  if (button.dataset.evidenceId) {
    const evidenceId = button.dataset.evidenceId;
    selectedEvidenceIds = selectedEvidenceIds.includes(evidenceId)
      ? selectedEvidenceIds.filter(id => id !== evidenceId)
      : [...selectedEvidenceIds, evidenceId];
    renderScene(storyState);
    return;
  }
  if (button.hasAttribute("data-story-submit")) {
    handleEvidenceSubmit();
    return;
  }
  if (button.hasAttribute("data-story-next")) handleNext();
}

function bindPage() {
  elements = {
    startOverlay: document.querySelector("#storyStartOverlay"),
    newButton: document.querySelector("#storyNewButton"),
    continueButton: document.querySelector("#storyContinueButton"),
    screen: document.querySelector("#storyScreen"),
    chapterLabel: document.querySelector("#storyChapterLabel"),
    progress: document.querySelector("#storyProgress"),
    narrative: document.querySelector("#storyNarrative"),
    sceneTitle: document.querySelector("#storySceneTitle"),
    document: document.querySelector("#storyDocument"),
    actions: document.querySelector("#storyActions"),
    clues: document.querySelector("#storyClues"),
    status: document.querySelector("#storyStatus"),
    art: document.querySelector("#storyArt"),
    artFallback: document.querySelector("#storyArtFallback"),
    artRetry: document.querySelector("#storyArtRetryButton"),
    resetOverlay: document.querySelector("#storyResetOverlay"),
    resetConfirm: document.querySelector("#storyResetConfirmButton"),
    resetCancel: document.querySelector("#storyResetCancelButton"),
    completion: document.querySelector("#storyCompletion"),
    replay: document.querySelector("#storyReplayButton"),
  };

  const loaded = loadStoryProgress(window.localStorage);
  storageStatus = loaded.status;
  elements.continueButton.disabled = loaded.status !== "loaded";
  if (loaded.status === "recovered") setStatus("손상된 진행을 복구하고 처음부터 시작할 수 있습니다.");
  if (loaded.status === "unsupported") setStatus("다른 버전의 진행은 보존했습니다. 이 버전은 처음부터 시작합니다.");

  elements.newButton.addEventListener("click", handleNew);
  elements.continueButton.addEventListener("click", handleContinue);
  elements.actions.addEventListener("click", handleActionClick);
  elements.resetConfirm.addEventListener("click", confirmReset);
  elements.resetCancel.addEventListener("click", closeResetDialog);
  elements.replay.addEventListener("click", () => openResetDialog(elements.replay));
  elements.artRetry.addEventListener("click", retryArt);
  elements.art.addEventListener("error", () => {
    elements.art.hidden = true;
    elements.artFallback.hidden = false;
    elements.artRetry.hidden = false;
  });
  elements.art.addEventListener("load", () => {
    elements.art.hidden = false;
    elements.artFallback.hidden = true;
    elements.artRetry.hidden = true;
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !elements.resetOverlay.hidden) {
      event.preventDefault();
      closeResetDialog();
    }
  });
}

if (typeof document !== "undefined") bindPage();
