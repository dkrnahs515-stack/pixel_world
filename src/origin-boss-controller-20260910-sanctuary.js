import {
  ORIGIN_ANCHOR_IDS,
  normalizeOriginEncounter,
  originPhaseForHp,
} from "./origin-boss-state-20260910-sanctuary.js";

const WARNING_SECONDS = 0.8;
const RECOVERY_SECONDS = 1.2;

const ANCHOR_LAYOUT = Object.freeze({
  "origin-anchor-life": Object.freeze({ active: true, hp: 40, maxHp: 40, x: 520, y: 620 }),
  "origin-anchor-memory": Object.freeze({ active: true, hp: 40, maxHp: 40, x: 1080, y: 500 }),
  "origin-anchor-energy": Object.freeze({ active: true, hp: 40, maxHp: 40, x: 1640, y: 620 }),
});

function cloneAnchors(anchors) {
  return Object.fromEntries(Object.entries(anchors || {}).map(([id, value]) => [id, { ...value }]));
}

function activePlayers(context) {
  return (context.players || []).filter(player => (
    player
    && player.alive !== false
    && typeof player.uid === "string"
    && Number.isFinite(player.x)
    && Number.isFinite(player.y)
  ));
}

function targetPlayer(encounter, context) {
  const players = activePlayers(context);
  if (players.length === 0) return null;
  const previous = players.find(player => player.uid === encounter.targetUid);
  if (previous) return previous;
  return [...players].sort((a, b) => (
    Math.hypot(a.x - encounter.x, a.y - encounter.y)
    - Math.hypot(b.x - encounter.x, b.y - encounter.y)
  ))[0];
}

function phaseDamageEvent(encounter, target) {
  const base = {
    bossId: encounter.bossId,
    encounterId: encounter.encounterId,
    targetUid: target?.uid ?? null,
    authorityEpoch: encounter.authorityEpoch,
    sequence: encounter.rewriteCycle.sequence,
    source: { x: encounter.x, y: encounter.y },
  };
  if (encounter.originPhase === "memory") {
    return {
      ...base,
      type: "origin-projectile",
      damage: 36,
      speed: 460,
      target: { x: target?.x ?? encounter.x, y: target?.y ?? encounter.y },
    };
  }
  if (encounter.originPhase === "energy") {
    return {
      ...base,
      type: "origin-eruption",
      damage: 42,
      radius: 130,
      target: { x: target?.x ?? encounter.x, y: target?.y ?? encounter.y },
    };
  }
  return {
    ...base,
    type: "origin-player-damage",
    damage: 34,
  };
}

function ensureRewriteAnchors(encounter, events) {
  if (encounter.originPhase !== "rewrite" || Object.keys(encounter.anchors).length > 0) return;
  encounter.anchors = Object.fromEntries(ORIGIN_ANCHOR_IDS.map(id => [id, { ...ANCHOR_LAYOUT[id] }]));
  encounter.rewriteCycle = {
    phase: "warning",
    elapsed: 0,
    sequence: encounter.rewriteCycle.sequence + 1,
  };
  events.push({
    type: "rewrite-warning",
    bossId: encounter.bossId,
    encounterId: encounter.encounterId,
    sequence: encounter.rewriteCycle.sequence,
    target: { x: encounter.x, y: encounter.y },
  });
}

function beginWarning(encounter, target, events) {
  encounter.rewriteCycle = {
    phase: "warning",
    elapsed: 0,
    sequence: encounter.rewriteCycle.sequence + 1,
  };
  events.push({
    type: encounter.originPhase === "rewrite" ? "rewrite-warning" : "origin-telegraph",
    bossId: encounter.bossId,
    encounterId: encounter.encounterId,
    phase: encounter.originPhase,
    sequence: encounter.rewriteCycle.sequence,
    targetUid: target?.uid ?? null,
    target: { x: target?.x ?? encounter.x, y: target?.y ?? encounter.y },
  });
}

function emitImpact(encounter, target, events) {
  if (encounter.originPhase === "rewrite") {
    events.push({
      type: "rewrite-impact",
      bossId: encounter.bossId,
      encounterId: encounter.encounterId,
      authorityEpoch: encounter.authorityEpoch,
      sequence: encounter.rewriteCycle.sequence,
      damage: 48,
      radius: 145,
      targetUid: target?.uid ?? null,
      target: { x: target?.x ?? encounter.x, y: target?.y ?? encounter.y },
    });
  } else {
    events.push(phaseDamageEvent(encounter, target));
  }
  encounter.rewriteCycle = {
    ...encounter.rewriteCycle,
    phase: "recovery",
    elapsed: 0,
  };
}

export function advanceOriginAuthorityState(value, dt, context = {}) {
  const normalized = normalizeOriginEncounter(value);
  if (!normalized || normalized.status !== "alive") {
    return { encounter: normalized || value, events: [] };
  }

  const encounter = {
    ...normalized,
    anchors: cloneAnchors(normalized.anchors),
    rewriteCycle: { ...normalized.rewriteCycle },
  };
  const events = [];
  const target = targetPlayer(encounter, context);
  if (target) encounter.targetUid = target.uid;
  encounter.originPhase = originPhaseForHp(encounter.hp, encounter.maxHp);
  encounter.phase = { life: 1, memory: 2, energy: 3, rewrite: 4 }[encounter.originPhase];

  ensureRewriteAnchors(encounter, events);
  let remaining = Math.max(0, Number.isFinite(dt) ? dt : 0);

  if (encounter.rewriteCycle.phase === "idle") {
    beginWarning(encounter, target, events);
  }

  if (encounter.rewriteCycle.phase === "warning" && remaining > 0) {
    const step = Math.min(remaining, Math.max(0, WARNING_SECONDS - encounter.rewriteCycle.elapsed));
    encounter.rewriteCycle.elapsed += step;
    remaining -= step;
    if (encounter.rewriteCycle.elapsed >= WARNING_SECONDS - 1e-9) {
      emitImpact(encounter, target, events);
    }
  }

  if (encounter.rewriteCycle.phase === "recovery" && remaining > 0) {
    const step = Math.min(remaining, Math.max(0, RECOVERY_SECONDS - encounter.rewriteCycle.elapsed));
    encounter.rewriteCycle.elapsed += step;
    if (encounter.rewriteCycle.elapsed >= RECOVERY_SECONDS - 1e-9) {
      encounter.rewriteCycle = {
        ...encounter.rewriteCycle,
        phase: "idle",
        elapsed: 0,
      };
    }
  }

  encounter.updatedAt = Number.isFinite(context.now) ? context.now : encounter.updatedAt;
  return { encounter, events };
}
