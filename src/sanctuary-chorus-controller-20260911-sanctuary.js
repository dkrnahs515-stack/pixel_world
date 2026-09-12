import {
  ANCHOR_IDS,
  BOND_IDS,
  CHORUS_BOSS_ID,
  CHORUS_MAP_ID,
  CHORUS_TESTIMONIES,
} from "./sanctuary-chorus-data-20260911-sanctuary.js";
import {
  applyChorusAction,
  createChorusCompletionClaims,
  createChorusEncounter,
  createPersonalChorusState,
  createReformedChorusEncounter,
  normalizeChorusEncounter,
  reducePersonalChorusState,
  validateChorusAction,
} from "./sanctuary-chorus-state-20260911-sanctuary.js";
import { chorusBranchPresentation } from "./sanctuary-story-data-20260911-sanctuary.js";
import { VOLCANO_HIDDEN_WEAPON_IDS } from "./weapon-data-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";

const ATTACK_KINDS = Object.freeze(["basic", "strong", "skill-e", "skill-r"]);
const INTERACTION_RADIUS = 105;
const PATTERN_IMPACT_DELAY_MS = 900;
const PATTERN_RECOVERY_MS = 350;
const PATTERN_DAMAGE = 14;
const CHORUS_CENTER = Object.freeze({ x: 1080, y: 820 });
const CLASS_IDS = Object.freeze(["warrior", "archer", "mage"]);

function validFirebaseKey(value, maxLength = 160) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    && /^[A-Za-z0-9:_-]+$/.test(value);
}
const BOND_CUT_PRESENTATIONS = Object.freeze({
  warrior: Object.freeze({
    presentationId: "warrior-sever",
    label: "검의 궤적으로 결속선을 베어 기억을 분리한다.",
  }),
  archer: Object.freeze({
    presentationId: "archer-pin",
    label: "기록 표식을 꿰뚫어 결속선을 고정하고 분리한다.",
  }),
  mage: Object.freeze({
    presentationId: "mage-dispel",
    label: "공명 주파수를 해제해 결속선을 분리한다.",
  }),
});

const ANCHORS = Object.freeze([
  { id: "forest", name: "숲 기록 닻", x: 700, y: 1120, color: "#4ade80" },
  { id: "coast", name: "해안 기록 닻", x: 1080, y: 1120, color: "#38bdf8" },
  { id: "volcano", name: "화산 기록 닻", x: 1460, y: 1120, color: "#fb923c" },
]);

const VERDICT_STATIONS = Object.freeze([
  { verdict: "fact", name: "사실", x: 700, y: 1120 },
  { verdict: "partial", name: "일부 사실", x: 1080, y: 1120 },
  { verdict: "unsupported", name: "근거 없음", x: 1340, y: 1120 },
]);

const RECORD_STATIONS = Object.freeze([
  { id: "roan", name: "로안 기록", x: 700, y: 620 },
  { id: "sera", name: "세라 기록", x: 1080, y: 560 },
  { id: "garen", name: "가렌 기록", x: 1460, y: 620 },
  { id: "lumen", name: "루멘 기록", x: 1080, y: 1320 },
]);

const PATTERNS = Object.freeze([
  {
    id: "forest-root-sweep",
    sharedId: "forest-roots",
    shape: "rect",
    x: 900,
    y: 500,
    width: 360,
    height: 800,
    color: "#4ade80",
  },
  {
    id: "coast-tide-cross",
    sharedId: "coast-tide",
    shape: "cross",
    x: 1080,
    y: 900,
    armWidth: 220,
    armHeight: 180,
    length: 880,
    color: "#38bdf8",
  },
  {
    id: "volcano-crack-burst",
    sharedId: "volcano-rift",
    shape: "circle",
    x: 1080,
    y: 900,
    radius: 260,
    color: "#fb923c",
  },
]);

const PATTERN_BY_SHARED_ID = Object.freeze(Object.fromEntries(
  PATTERNS.map(pattern => [pattern.sharedId, pattern]),
));

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function distance(a, b) {
  return Math.hypot(finite(a?.x) - b.x, finite(a?.y) - b.y);
}

function nearestWithin(player, points) {
  let nearest = null;
  let nearestDistance = INTERACTION_RADIUS;
  for (const point of points) {
    const candidateDistance = distance(player, point);
    if (candidateDistance > nearestDistance) continue;
    nearest = point;
    nearestDistance = candidateDistance;
  }
  return nearest;
}

function targetForBond(bondId, vulnerable) {
  const station = RECORD_STATIONS.find(value => value.id === bondId);
  if (!station) return null;
  return {
    id: `chorus-bond-${bondId}`,
    bondId,
    x: Math.round((CHORUS_CENTER.x + station.x) / 2),
    y: Math.round((CHORUS_CENTER.y + station.y) / 2),
    radius: 34,
    hp: vulnerable ? 1 : 0,
    maxHp: 1,
    targetable: vulnerable,
    isCoopBoss: true,
    isChorusTarget: true,
  };
}

function targetIsInsidePattern(player, pattern) {
  if (!player || !pattern) return false;
  const x = finite(player.x);
  const y = finite(player.y);
  if (pattern.shape === "rect") {
    return x >= pattern.x && x <= pattern.x + pattern.width
      && y >= pattern.y && y <= pattern.y + pattern.height;
  }
  if (pattern.shape === "circle") return Math.hypot(x - pattern.x, y - pattern.y) <= pattern.radius;
  if (pattern.shape === "cross") {
    return (Math.abs(x - pattern.x) <= pattern.armWidth / 2 && Math.abs(y - pattern.y) <= pattern.length / 2)
      || (Math.abs(y - pattern.y) <= pattern.armHeight / 2 && Math.abs(x - pattern.x) <= pattern.length / 2);
  }
  return false;
}

function clonePattern(definition, startedAt, impactAt) {
  return { ...definition, startedAt, impactAt, endsAt: impactAt + PATTERN_RECOVERY_MS };
}

function normalizeClassId(classId) {
  return CLASS_IDS.includes(classId) ? classId : "warrior";
}

function createActionSessionId(value) {
  if (typeof value === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(value)) return value;
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replaceAll("-", "");
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function isExpectedReformedEncounter(current, incoming) {
  if (!current || !incoming || current.phase !== "separated"
    || !["separated", "reforming"].includes(current.status)
    || incoming.phase !== "anchors" || incoming.status !== "active"
    || incoming.combatRevision !== 0 || incoming.authorityEpoch !== current.authorityEpoch + 1
    || !Number.isFinite(current.reformAt) || incoming.spawnedAt < current.reformAt) return false;
  const expected = createReformedChorusEncounter(current, {
    uid: incoming.authorityUid,
    now: incoming.spawnedAt,
  });
  return Boolean(expected && expected.encounterId === incoming.encounterId);
}

export function chorusAttackPresentation(classId, actionType = "bond-cut") {
  if (actionType !== "bond-cut") return null;
  const normalizedClassId = normalizeClassId(classId);
  return Object.freeze({
    classId: normalizedClassId,
    actionType: "bond-cut",
    cohesionDelta: -10,
    ...BOND_CUT_PRESENTATIONS[normalizedClassId],
  });
}

class SanctuaryChorusController {
  constructor(options = {}) {
    this.uid = typeof options.uid === "string" && options.uid ? options.uid : "local-player";
    this.mode = options.mode === "online" ? "online" : "solo";
    this.network = options.network || null;
    this.captainOutcome = "lost";
    this.classId = "warrior";
    this.ownedWeaponIds = new Set();
    this.hiddenWeaponOwned = false;
    this.setPlayerContext(options);
    this.now = typeof options.now === "function" ? options.now : () => Date.now();
    this.seedSnapshot = normalizeChorusEncounter(options.seedSnapshot);
    this.savedSnapshot = this.seedSnapshot;
    this.snapshot = null;
    this.personalSnapshot = createPersonalChorusState();
    this.mapId = null;
    this.correctionLinked = false;
    this.actionSequence = 0;
    this.actionSessionId = createActionSessionId(options.actionSessionId);
    this.patternSequence = 0;
    this.activePattern = null;
    this.processedPatternEventIds = new Set();
    this.pendingEvents = [];
    this.completionClaims = {};
    this.confirmedCompletionClaim = null;
    this.lastPlayer = null;
    this.falseOrderInterruptEncounterId = null;
    this.lastAttackPresentation = null;
  }

  setPlayerContext(options = {}) {
    this.captainOutcome = options.captainOutcome === "rescued" ? "rescued" : "lost";
    this.classId = normalizeClassId(options.classId);
    const equipmentOwnedIds = options.equipmentByClass?.[this.classId]?.ownedWeaponIds;
    this.ownedWeaponIds = new Set([
      ...(Array.isArray(options.ownedWeaponIds) ? options.ownedWeaponIds : []),
      ...(Array.isArray(equipmentOwnedIds) ? equipmentOwnedIds : []),
    ]);
    this.hiddenWeaponOwned = options.hiddenWeaponOwned === true
      || this.ownedWeaponIds.has(VOLCANO_HIDDEN_WEAPON_IDS[this.classId]);
    return {
      captainOutcome: this.captainOutcome,
      classId: this.classId,
      hiddenWeaponOwned: this.hiddenWeaponOwned,
    };
  }

  setMap(mapId, options = {}) {
    this.mapId = mapId;
    this.correctionLinked = options.correctionLinked === true;
    if (mapId !== CHORUS_MAP_ID || !this.correctionLinked) {
      if (this.snapshot) this.savedSnapshot = this.snapshot;
      this.snapshot = null;
      this.activePattern = null;
      this.lastAttackPresentation = null;
      return null;
    }
    if (!this.savedSnapshot) {
      const timestamp = this.now();
      this.savedSnapshot = createChorusEncounter({
        encounterId: `sanctuary-chorus-${this.uid}-${Math.trunc(timestamp)}`,
        authorityUid: this.uid,
        now: timestamp,
      });
    }
    this.snapshot = normalizeChorusEncounter(this.savedSnapshot);
    this.restorePatternFromSnapshot();
    return this.snapshot;
  }

  restorePatternFromSnapshot() {
    const definition = PATTERN_BY_SHARED_ID[this.snapshot?.currentPatternId];
    this.activePattern = definition && this.snapshot.patternEndsAt > 0
      ? clonePattern(definition, this.snapshot.patternStartedAt, this.snapshot.patternEndsAt)
      : null;
    if (definition) this.patternSequence = (PATTERNS.indexOf(definition) + 1) % PATTERNS.length;
  }

  nextAction(type, fields, timestamp) {
    this.actionSequence += 1;
    return {
      id: `${this.actionSessionId}:${this.snapshot.authorityEpoch}:${this.actionSequence}:${type}`,
      encounterId: this.snapshot.encounterId,
      authorityEpoch: this.snapshot.authorityEpoch,
      phase: this.snapshot.phase,
      uid: this.uid,
      type,
      createdAt: timestamp,
      ...fields,
    };
  }

  applyRequest(request, timestamp, authenticatedUid = this.uid, context = {}) {
    if (!this.snapshot) return { ok: false, reason: "inactive", events: [] };
    const validation = validateChorusAction(request, {
      encounter: this.snapshot,
      authenticatedUid,
      now: timestamp,
      lumenAssistEligible: context.lumenAssistEligible === true,
    });
    if (!validation.ok) {
      if (validation.personalEvent && request.uid === this.uid && authenticatedUid === this.uid) {
        const personal = reducePersonalChorusState(this.personalSnapshot, validation.personalEvent, timestamp);
        this.personalSnapshot = personal.state;
        this.pendingEvents.push(...personal.events);
      }
      return { ...validation, events: [] };
    }
    const applied = applyChorusAction(this.snapshot, validation, timestamp);
    this.snapshot = applied.encounter;
    if (this.snapshot.phase !== "onslaught") this.activePattern = null;
    this.savedSnapshot = this.snapshot;
    this.pendingEvents.push(...applied.events);
    if (this.snapshot.status === "separated" && Object.keys(this.completionClaims).length === 0) {
      this.completionClaims = createChorusCompletionClaims(this.snapshot, timestamp);
      const ownClaim = this.completionClaims[this.uid];
      if (ownClaim) this.pendingEvents.push({
        type: "chorus-completion-claim",
        claimId: `${ownClaim.encounterId}:${ownClaim.uid}`,
        ...ownClaim,
      });
    }
    return { ok: true, reason: null, events: applied.events, snapshot: this.snapshot };
  }

  async requestAttack(input = {}, timestamp = this.now()) {
    if (!this.snapshot || !this.canAttack(timestamp) || !ATTACK_KINDS.includes(input.attackKind)) {
      return { ok: false, reason: !this.canAttack(timestamp) ? "attack_locked" : "invalid_attack", events: [] };
    }
    if (this.snapshot.phase === "anchors") {
      if (input.targetId !== CHORUS_BOSS_ID) return { ok: false, reason: "invalid_target", events: [] };
      if (this.personalSnapshot.carriedFragmentId) return { ok: false, reason: "carrying_fragment", events: [] };
      const fragmentId = ANCHOR_IDS.includes(input.fragmentId)
        ? input.fragmentId
        : ANCHOR_IDS.find(id => !this.snapshot.stabilizedAnchorIds.includes(id)) || ANCHOR_IDS[0];
      const result = this.applyRequest(this.nextAction("fragment-strike", { fragmentId }, timestamp), timestamp);
      if (result.ok) this.personalSnapshot.carriedFragmentId = fragmentId;
      if (input.player) this.lastPlayer = { ...input.player };
      return result;
    }
    if (this.snapshot.phase === "onslaught") {
      const target = this.targetableBosses().find(value => value.id === input.targetId);
      if (!target) return { ok: false, reason: "bond_not_vulnerable", events: [] };
      const result = this.applyRequest(this.nextAction("bond-cut", { bondId: target.bondId }, timestamp), timestamp);
      if (!result.ok) return result;
      const presentation = chorusAttackPresentation(input.classId || this.classId, "bond-cut");
      this.lastAttackPresentation = {
        ...presentation,
        bondId: target.bondId,
        x: target.x,
        y: target.y,
        createdAt: timestamp,
      };
      return { ...result, presentation };
    }
    return { ok: false, reason: "phase_not_attackable", events: [] };
  }

  dropCarriedFragment() {
    const fragmentId = this.personalSnapshot.carriedFragmentId;
    this.personalSnapshot.carriedFragmentId = null;
    return fragmentId;
  }

  async requestLumenAssist(anchorId, timestamp = this.now()) {
    if (!this.snapshot) return { ok: false, reason: "inactive", events: [] };
    if (this.captainOutcome !== "rescued" || !this.hiddenWeaponOwned) {
      return { ok: false, reason: "assist_ineligible", events: [] };
    }
    return this.applyRequest(
      this.nextAction("lumen-assist", { anchorId }, timestamp),
      timestamp,
      this.uid,
      { lumenAssistEligible: true },
    );
  }

  canMutateSharedState(timestamp = this.now()) {
    return this.mode !== "online" || Boolean(
      this.snapshot?.authorityUid === this.uid
      && Number.isInteger(this.snapshot.authorityEpoch)
      && this.snapshot.leaseUntil > timestamp,
    );
  }

  expireRecordWindow(timestamp = this.now()) {
    if (!this.snapshot || this.snapshot.status !== "active" || this.snapshot.phase !== "onslaught"
      || !this.snapshot.activeRecordId || this.snapshot.vulnerableUntil >= timestamp
      || !this.canMutateSharedState(timestamp)) return false;
    this.snapshot = normalizeChorusEncounter({
      ...this.snapshot,
      activeRecordId: null,
      vulnerableUntil: 0,
      combatRevision: this.snapshot.combatRevision + 1,
      updatedAt: timestamp,
    });
    this.savedSnapshot = this.snapshot;
    return true;
  }

  nearbyInteraction(player, timestamp = this.now()) {
    this.expireRecordWindow(timestamp);
    if (!this.snapshot || this.snapshot.status !== "active") return null;
    if (this.snapshot.phase === "anchors") {
      const anchor = nearestWithin(player, ANCHORS);
      if (this.personalSnapshot.carriedFragmentId) {
        return anchor ? { type: "anchor", anchorId: anchor.id, prompt: `${anchor.name}에 기억 파편 놓기` } : null;
      }
      if (anchor && this.captainOutcome === "rescued" && this.hiddenWeaponOwned
        && this.snapshot.lumenAssistUsed !== true
        && !this.snapshot.stabilizedAnchorIds.includes(anchor.id)) {
        return {
          type: "lumen-assist",
          anchorId: anchor.id,
          prompt: `F · 루멘의 ${anchor.name} 안정화`,
        };
      }
      return null;
    }
    if (this.snapshot.phase === "testimonies") {
      const station = nearestWithin(player, VERDICT_STATIONS);
      const testimony = CHORUS_TESTIMONIES.find(value => !this.snapshot.resolvedTestimonyIds.includes(value.id));
      return station && testimony ? {
        type: "testimony",
        testimonyId: testimony.id,
        verdict: station.verdict,
        prompt: `증언 판정: ${station.name}`,
      } : null;
    }
    if (this.snapshot.phase === "onslaught" && !this.snapshot.activeRecordId) {
      const nextBondId = BOND_IDS.find(id => !this.snapshot.severedBondIds.includes(id));
      const station = RECORD_STATIONS.find(value => value.id === nextBondId);
      return station && distance(player, station) <= INTERACTION_RADIUS ? {
        type: "record",
        recordId: station.id,
        prompt: `${station.name} 활성화`,
      } : null;
    }
    return null;
  }

  async interact(player, timestamp = this.now()) {
    const nearby = this.nearbyInteraction(player, timestamp);
    if (!nearby) return { ok: false, reason: "no_interaction", events: [] };
    this.lastPlayer = player ? { ...player } : null;
    if (nearby.type === "anchor") {
      const result = this.applyRequest(this.nextAction("anchor-stabilize", {
        fragmentId: this.personalSnapshot.carriedFragmentId,
        anchorId: nearby.anchorId,
      }, timestamp), timestamp);
      if (result.ok) this.personalSnapshot.carriedFragmentId = null;
      return result;
    }
    if (nearby.type === "testimony") {
      return this.applyRequest(this.nextAction("testimony-resolve", {
        testimonyId: nearby.testimonyId,
        verdict: nearby.verdict,
      }, timestamp), timestamp);
    }
    if (nearby.type === "lumen-assist") return this.requestLumenAssist(nearby.anchorId, timestamp);
    return this.applyRequest(this.nextAction("record-activate", { recordId: nearby.recordId }, timestamp), timestamp);
  }

  canAttack(timestamp = this.now()) {
    return !this.personalSnapshot || finite(this.personalSnapshot.attackLockedUntil) <= timestamp;
  }

  movementMultiplier(timestamp = this.now()) {
    return finite(this.personalSnapshot?.movementSlowUntil) > timestamp ? 0.45 : 1;
  }

  targetableBosses() {
    if (!this.snapshot || this.snapshot.status !== "active") return [];
    if (this.snapshot.phase === "anchors") return [{
      id: CHORUS_BOSS_ID,
      x: CHORUS_CENTER.x,
      y: CHORUS_CENTER.y,
      radius: 92,
      hp: this.snapshot.hp,
      maxHp: this.snapshot.maxHp,
      targetable: true,
      isCoopBoss: true,
      isChorusTarget: true,
    }];
    if (this.snapshot.phase !== "onslaught" || !this.snapshot.activeRecordId
      || this.snapshot.vulnerableUntil < this.now()) return [];
    return [targetForBond(this.snapshot.activeRecordId, true)].filter(Boolean);
  }

  startPattern(timestamp) {
    if (!this.canMutateSharedState(timestamp)) return false;
    const definition = PATTERNS[this.patternSequence % PATTERNS.length];
    this.patternSequence += 1;
    this.activePattern = clonePattern(definition, timestamp, timestamp + PATTERN_IMPACT_DELAY_MS);
    this.snapshot = normalizeChorusEncounter({
      ...this.snapshot,
      currentPatternId: definition.sharedId,
      patternStartedAt: timestamp,
      patternEndsAt: this.activePattern.impactAt,
      combatRevision: this.snapshot.combatRevision + 1,
      updatedAt: timestamp,
    });
    this.savedSnapshot = this.snapshot;
    return true;
  }

  update(_dt, context = {}, timestamp = this.now()) {
    if (context.player) this.lastPlayer = { ...context.player };
    const events = this.pendingEvents.splice(0);
    this.expireRecordWindow(timestamp);
    const branch = chorusBranchPresentation(this.captainOutcome);
    if (this.snapshot?.status === "active" && this.snapshot.phase === "testimonies"
      && branch.lumen.interruptionId
      && this.falseOrderInterruptEncounterId !== this.snapshot.encounterId) {
      this.falseOrderInterruptEncounterId = this.snapshot.encounterId;
      events.push({
        type: "chorus-branch-interruption",
        eventId: `${this.snapshot.encounterId}:${branch.lumen.interruptionId}`,
        presentationId: branch.lumen.interruptionId,
        speaker: "lumen",
        pages: [...branch.lumen.pages],
      });
    }
    if (!this.snapshot || this.snapshot.phase !== "onslaught" || this.snapshot.status !== "active") {
      return { events, shared: this.snapshot, personal: this.personalSnapshot };
    }
    if (!this.activePattern && !this.startPattern(timestamp)) {
      return { events, shared: this.snapshot, personal: this.personalSnapshot };
    }
    const eventId = `${this.snapshot.encounterId}:pattern:${this.activePattern.startedAt}:${this.activePattern.id}`;
    if (timestamp >= this.activePattern.impactAt && timestamp <= this.activePattern.endsAt
      && !this.processedPatternEventIds.has(eventId)) {
      this.processedPatternEventIds.add(eventId);
      if (targetIsInsidePattern(context.player, this.activePattern)) events.push({
        type: "damage-player",
        eventId,
        amount: PATTERN_DAMAGE,
        source: { x: this.activePattern.x, y: this.activePattern.y },
      });
    }
    if (timestamp > this.activePattern.endsAt) {
      if (!this.startPattern(timestamp)) this.activePattern = null;
    }
    return { events, shared: this.snapshot, personal: this.personalSnapshot };
  }

  renderModel() {
    if (!this.snapshot) return { active: false, shared: null, personal: this.personalSnapshot };
    const activeRecordId = this.snapshot.activeRecordId;
    const vulnerable = activeRecordId && this.snapshot.vulnerableUntil >= this.now();
    const bonds = RECORD_STATIONS
      .filter(station => !this.snapshot.severedBondIds.includes(station.id))
      .map(station => ({
        id: station.id,
        x1: CHORUS_CENTER.x,
        y1: CHORUS_CENTER.y,
        x2: station.x,
        y2: station.y,
        vulnerable: vulnerable && activeRecordId === station.id,
      }));
    const fragments = this.personalSnapshot.carriedFragmentId ? [{
      id: this.personalSnapshot.carriedFragmentId,
      x: finite(this.lastPlayer?.x, CHORUS_CENTER.x),
      y: finite(this.lastPlayer?.y, CHORUS_CENTER.y - 72),
    }] : [];
    const separated = this.snapshot.status === "separated";
    const branch = chorusBranchPresentation(this.captainOutcome);
    const lumenAssist = branch.captainOutcome === "rescued"
      && this.hiddenWeaponOwned
      && this.snapshot.phase === "anchors"
      && this.snapshot.lumenAssistUsed !== true
      ? {
          actionId: "chorus-lumen-assist",
          prompt: "루멘의 기록 닻 안정화",
          availableAnchorIds: ANCHOR_IDS.filter(id => !this.snapshot.stabilizedAnchorIds.includes(id)),
        }
      : null;
    return {
      active: true,
      shared: this.snapshot,
      personal: this.personalSnapshot,
      branch,
      lumenAssist,
      attackPresentation: this.lastAttackPresentation ? { ...this.lastAttackPresentation } : null,
      body: separated ? null : { ...CHORUS_CENTER, radius: 92 },
      anchors: ANCHORS.map(value => ({ ...value, stabilized: this.snapshot.stabilizedAnchorIds.includes(value.id) })),
      testimony: this.snapshot.phase === "testimonies"
        ? CHORUS_TESTIMONIES.find(value => !this.snapshot.resolvedTestimonyIds.includes(value.id)) || null
        : null,
      verdictStations: this.snapshot.phase === "testimonies" ? VERDICT_STATIONS : [],
      recordStations: RECORD_STATIONS,
      bonds,
      fragments,
      telegraph: this.activePattern ? { ...this.activePattern } : null,
      separated,
      statusLabel: separated ? "기억 분리 완료" : null,
      separatedFragments: separated ? ANCHORS.map((anchor, index) => ({
        id: anchor.id,
        x: CHORUS_CENTER.x + (index - 1) * 145,
        y: CHORUS_CENTER.y + (index % 2 ? 70 : -55),
      })) : [],
      message: separated
        ? "무명의 합창의 결속이 풀렸습니다.\n기억들은 아직 어느 곳에도 귀속되지 않았습니다.\n이제 남겨진 기억의 운명을 결정해야 합니다."
        : null,
    };
  }

  receiveSnapshot(value) {
    const snapshot = normalizeChorusEncounter(value);
    if (!snapshot || (this.snapshot && snapshot.encounterId !== this.snapshot.encounterId
      && !isExpectedReformedEncounter(this.snapshot, snapshot))) return false;
    if (snapshot.status === "active") {
      this.completionClaims = this.confirmedCompletionClaim
        ? { [this.uid]: { ...this.confirmedCompletionClaim } }
        : {};
      this.pendingEvents = this.pendingEvents.filter(event => event?.type !== "chorus-completion-claim");
    }
    this.savedSnapshot = snapshot;
    if (this.mapId === CHORUS_MAP_ID && this.correctionLinked) {
      this.snapshot = snapshot;
      this.restorePatternFromSnapshot();
    }
    return true;
  }

  receiveActions(value) {
    const actions = (Array.isArray(value) ? value : Object.values(value || {}))
      .filter(action => action && typeof action === "object")
      .sort((a, b) => finite(a.createdAt) - finite(b.createdAt) || String(a.id).localeCompare(String(b.id)));
    const results = [];
    for (const action of actions) results.push(this.applyRequest(action, finite(action.createdAt, this.now()), action.uid));
    return results;
  }

  receiveCompletionClaims(value) {
    const claims = value && typeof value === "object" ? value : {};
    const own = claims[this.uid];
    if (!own || own.uid !== this.uid || !validFirebaseKey(own.encounterId)
      || own.eligible !== true || !Number.isFinite(own.createdAt)
      || own.createdAt < 0 || (this.confirmedCompletionClaim
        && own.createdAt < this.confirmedCompletionClaim.createdAt)) return false;
    this.confirmedCompletionClaim = { ...own };
    this.completionClaims = { [this.uid]: { ...own } };
    return true;
  }

  clear() {
    this.snapshot = null;
    this.savedSnapshot = null;
    this.activePattern = null;
    this.pendingEvents = [];
    this.completionClaims = {};
    this.confirmedCompletionClaim = null;
    this.processedPatternEventIds.clear();
    this.personalSnapshot = createPersonalChorusState();
    this.falseOrderInterruptEncounterId = null;
    this.lastAttackPresentation = null;
  }
}

export function createSanctuaryChorusController(options = {}) {
  return new SanctuaryChorusController({
    uid: options.uid || "local-player",
    mode: options.mode || "solo",
    network: options.network || null,
    seedSnapshot: options.seedSnapshot || null,
    captainOutcome: options.captainOutcome,
    classId: options.classId,
    ownedWeaponIds: options.ownedWeaponIds,
    equipmentByClass: options.equipmentByClass,
    hiddenWeaponOwned: options.hiddenWeaponOwned,
    actionSessionId: options.actionSessionId,
    now: options.now || (() => Date.now()),
  });
}
