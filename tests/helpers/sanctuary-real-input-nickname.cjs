const PREFIX_BY_JOURNEY = Object.freeze({
  "real-warrior": "RW",
  "real-archer": "RA",
  "real-mage": "RM",
  "online-a": "OA",
  "online-b": "OB",
});
const MAX_SEQUENCE = 36 ** 2;
const sequenceByJourneyTimestamp = new Map();

function createQaNickname(journey, timestamp) {
  const prefix = PREFIX_BY_JOURNEY[journey];
  if (!prefix) throw new Error(`Unknown real-input journey: ${journey}`);
  const nonce = Math.max(0, Math.trunc(Number(timestamp) || 0)).toString(36).slice(-8);
  const allocationKey = `${journey}:${nonce}`;
  const sequence = sequenceByJourneyTimestamp.get(allocationKey) || 0;
  if (sequence >= MAX_SEQUENCE) throw new Error(`QA nickname capacity exhausted for ${journey}`);
  sequenceByJourneyTimestamp.set(allocationKey, sequence + 1);
  return `${prefix}${nonce}${sequence.toString(36)}`;
}

async function runQaJourney({
  page,
  journey,
  timestamp,
  classId,
  full,
  mapId,
  prepareCheckpoint,
  enter,
  qaTravel,
}) {
  const name = createQaNickname(journey, timestamp);
  await prepareCheckpoint(page, name, classId, full);
  await enter(page, name, classId);
  await qaTravel(page, mapId);
  return name;
}

module.exports = { createQaNickname, runQaJourney };
