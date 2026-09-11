export const SANCTUARY_CORE_IDS = Object.freeze([
  "forest-core-casket",
  "coast-core-casket",
  "volcano-core-casket",
]);
export const MEMORY_SOUND_IDS = Object.freeze([
  "departure-bell",
  "dawn-bird",
  "tide-bell",
  "mine-shift-bell",
]);
export const FALSE_RETURN_CONTRADICTION_IDS = Object.freeze([
  "false-return-garen-unscarred",
  "false-return-source-erased",
  "false-return-resonance-time",
]);
const COLLECTIBLE_MEMORY_IDS = Object.freeze([
  ...MEMORY_SOUND_IDS,
  ...FALSE_RETURN_CONTRADICTION_IDS,
]);
export const RECORD_FIELD_IDS = Object.freeze(["departure", "witness", "seal"]);
export const TESTIMONY_IDS = Object.freeze(["forest", "coast", "volcano"]);
export const FUTURE_IDS = Object.freeze(["seal", "restore", "release"]);
const ENDING_CHOICES = Object.freeze(["seal", "restore", "release"]);

function allowedUnique(values, allowed) {
  return Array.isArray(values) ? [...new Set(values.filter(value => allowed.includes(value)))] : [];
}

function hasAll(values, required) {
  return required.every(value => values.includes(value));
}

function isExactOrder(values, expected) {
  return Array.isArray(values)
    && values.length === expected.length
    && values.every((value, index) => value === expected[index]);
}

export function createInitialSanctuaryChapter() {
  return {
    activatedCoreIds: [],
    collectedMemoryIds: [],
    memorySequence: [],
    memoryOrderSolved: false,
    coreTruthRevealed: false,
    falseReturnRejected: false,
    completedRecordFieldIds: [],
    correctionLinked: false,
    chorusSeparated: false,
    collectedTestimonyIds: [],
    previewedFutureIds: [],
    endingChoice: null,
    completed: false,
  };
}

export function normalizeSanctuaryChapter(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const activatedCoreIds = allowedUnique(source.activatedCoreIds, SANCTUARY_CORE_IDS);
  const collectedMemoryIds = allowedUnique(source.collectedMemoryIds, COLLECTIBLE_MEMORY_IDS);
  const memorySequence = allowedUnique(source.memorySequence, MEMORY_SOUND_IDS);
  const memoryOrderSolved = source.memoryOrderSolved === true
    && hasAll(collectedMemoryIds, MEMORY_SOUND_IDS)
    && isExactOrder(memorySequence, MEMORY_SOUND_IDS);
  const coreTruthRevealed = source.coreTruthRevealed === true
    && memoryOrderSolved
    && hasAll(activatedCoreIds, SANCTUARY_CORE_IDS);
  const falseReturnRejected = source.falseReturnRejected === true
    && coreTruthRevealed
    && hasAll(collectedMemoryIds, FALSE_RETURN_CONTRADICTION_IDS);
  const completedRecordFieldIds = allowedUnique(source.completedRecordFieldIds, RECORD_FIELD_IDS);
  const correctionLinked = source.correctionLinked === true
    && falseReturnRejected
    && hasAll(completedRecordFieldIds, RECORD_FIELD_IDS);
  const chorusSeparated = source.chorusSeparated === true && correctionLinked;
  const collectedTestimonyIds = allowedUnique(source.collectedTestimonyIds, TESTIMONY_IDS);
  const previewedFutureIds = allowedUnique(source.previewedFutureIds, FUTURE_IDS);
  const endingChoice = ENDING_CHOICES.includes(source.endingChoice)
    && chorusSeparated
    && hasAll(collectedTestimonyIds, TESTIMONY_IDS)
    && hasAll(previewedFutureIds, FUTURE_IDS)
    ? source.endingChoice
    : null;
  return {
    activatedCoreIds,
    collectedMemoryIds,
    memorySequence,
    memoryOrderSolved,
    coreTruthRevealed,
    falseReturnRejected,
    completedRecordFieldIds,
    correctionLinked,
    chorusSeparated,
    collectedTestimonyIds,
    previewedFutureIds,
    endingChoice,
    completed: source.completed === true && endingChoice !== null,
  };
}

function cloneSanctuaryChapter(chapter) {
  return {
    ...chapter,
    activatedCoreIds: [...chapter.activatedCoreIds],
    collectedMemoryIds: [...chapter.collectedMemoryIds],
    memorySequence: [...chapter.memorySequence],
    completedRecordFieldIds: [...chapter.completedRecordFieldIds],
    collectedTestimonyIds: [...chapter.collectedTestimonyIds],
    previewedFutureIds: [...chapter.previewedFutureIds],
  };
}

function addIfAllowed(values, value, allowed) {
  if (allowed.includes(value) && !values.includes(value)) values.push(value);
}

function applySanctuaryAction(chapter, action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) return;
  switch (action.type) {
    case "activate-core":
      addIfAllowed(chapter.activatedCoreIds, action.coreId, SANCTUARY_CORE_IDS);
      break;
    case "collect-memory":
      addIfAllowed(chapter.collectedMemoryIds, action.memoryId, COLLECTIBLE_MEMORY_IDS);
      break;
    case "submit-memory-sequence":
      if (hasAll(chapter.collectedMemoryIds, MEMORY_SOUND_IDS) && isExactOrder(action.sequence, MEMORY_SOUND_IDS)) {
        chapter.memorySequence = [...MEMORY_SOUND_IDS];
        chapter.memoryOrderSolved = true;
      }
      break;
    case "reveal-truth":
      if (chapter.memoryOrderSolved && hasAll(chapter.activatedCoreIds, SANCTUARY_CORE_IDS)) chapter.coreTruthRevealed = true;
      break;
    case "reject-false-return":
      if (chapter.coreTruthRevealed && hasAll(chapter.collectedMemoryIds, FALSE_RETURN_CONTRADICTION_IDS)) {
        chapter.falseReturnRejected = true;
      }
      break;
    case "complete-record-field":
      if (chapter.falseReturnRejected) addIfAllowed(chapter.completedRecordFieldIds, action.fieldId, RECORD_FIELD_IDS);
      break;
    case "link-correction":
      if (chapter.falseReturnRejected && hasAll(chapter.completedRecordFieldIds, RECORD_FIELD_IDS)) chapter.correctionLinked = true;
      break;
    case "separate-chorus": {
      const claim = action.claim && typeof action.claim === "object" && !Array.isArray(action.claim) ? action.claim : null;
      if (
        chapter.correctionLinked
        && typeof action.uid === "string" && action.uid.length > 0
        && typeof action.encounterId === "string" && action.encounterId.length > 0
        && claim?.eligible === true
        && claim.uid === action.uid
        && typeof claim.encounterId === "string" && claim.encounterId.length > 0
        && claim.encounterId === action.encounterId
      ) chapter.chorusSeparated = true;
      break;
    }
    case "collect-testimony":
      if (chapter.chorusSeparated) addIfAllowed(chapter.collectedTestimonyIds, action.testimonyId, TESTIMONY_IDS);
      break;
    case "preview-future":
      if (chapter.chorusSeparated && hasAll(chapter.collectedTestimonyIds, TESTIMONY_IDS)) {
        addIfAllowed(chapter.previewedFutureIds, action.futureId, FUTURE_IDS);
      }
      break;
    case "choose-ending":
      if (chapter.chorusSeparated && hasAll(chapter.collectedTestimonyIds, TESTIMONY_IDS) && hasAll(chapter.previewedFutureIds, FUTURE_IDS) && ENDING_CHOICES.includes(action.endingChoice)) {
        chapter.endingChoice = action.endingChoice;
        chapter.completed = true;
      }
      break;
  }
}

export function reduceSanctuaryChapter(value, action) {
  const chapter = normalizeSanctuaryChapter(value);
  const next = cloneSanctuaryChapter(chapter);
  const effects = [];
  applySanctuaryAction(next, action, effects);
  return { chapter: normalizeSanctuaryChapter(next), effects };
}
