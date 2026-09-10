import {
  AUTHORITY_LEASE_MS,
  bossRespawnAt,
  getCoopBossForMap,
  scaledBossMaxHp,
} from "./coop-boss-data-20260910-sanctuary.js";

export const ORIGIN_ANCHOR_IDS = Object.freeze([
  "origin-anchor-life",
  "origin-anchor-memory",
  "origin-anchor-energy",
]);

const STATUSES = new Set(["alive", "defeated", "respawning"]);
const DIRECTIONS = new Set(["up", "down", "left", "right"]);

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function rounded(value) {
  return Math.round(value * 10) / 10;
}

export function originPhaseForHp(hp, maxHp) {
  const max = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : 1200;
  const ratio = Math.max(0, Math.min(1, finite(hp, max) / max));
  if (ratio > 0.75) return "life";
  if (ratio > 0.5) return "memory";
  if (ratio > 0.25) return "energy";
  return "rewrite";
}

function normalizeAnchor(value) {
  if (!value || typeof value !== "object") return null;
  const maxHp = Math.max(1, rounded(finite(value.maxHp, 40)));
  const hp = rounded(Math.max(0, Math.min(maxHp, finite(value.hp, maxHp))));
  return {
    active: value.active === true && hp > 0,
    hp,
    maxHp,
    x: Math.max(0, Math.min(2160, finite(value.x))),
    y: Math.max(0, Math.min(1800, finite(value.y))),
  };
}

function normalizeAnchors(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(ORIGIN_ANCHOR_IDS.flatMap(id => {
    const anchor = normalizeAnchor(value[id]);
    return anchor ? [[id, anchor]] : [];
  }));
}

function normalizeRewriteCycle(value) {
  const cycle = value && typeof value === "object" ? value : {};
  const phase = ["idle", "warning", "impact", "recovery"].includes(cycle.phase)
    ? cycle.phase
    : "idle";
  return {
    phase,
    elapsed: Math.max(0, finite(cycle.elapsed)),
    sequence: Math.max(0, Math.trunc(finite(cycle.sequence))),
  };
}

export function createOriginEncounter(definition, {
  encounterId,
  partySize = 1,
  now = Date.now(),
  authorityUid,
  authorityEpoch = 1,
} = {}) {
  if (
    !definition
    || definition.id !== "origin-zero"
    || definition.mapId !== "sanctuary-core-heart"
    || getCoopBossForMap(definition.mapId)?.id !== definition.id
    || typeof authorityUid !== "string"
    || !authorityUid
  ) return null;
  const normalizedPartySize = Math.max(1, Math.min(10, Math.trunc(Number(partySize) || 1)));
  const maxHp = scaledBossMaxHp(definition.baseHp, normalizedPartySize);
  return {
    encounterId: String(encounterId || `${definition.mapId}-${now}`),
    bossId: definition.id,
    mapId: definition.mapId,
    status: "alive",
    x: definition.x,
    y: definition.y,
    dir: "down",
    moving: false,
    hp: maxHp,
    maxHp,
    phase: 1,
    originPhase: "life",
    anchors: {},
    rewriteCycle: { phase: "idle", elapsed: 0, sequence: 0 },
    completionClaimWritten: false,
    targetUid: null,
    authorityUid,
    authorityEpoch: Math.max(1, Math.trunc(authorityEpoch || 1)),
    leaseUntil: now + AUTHORITY_LEASE_MS,
    partySize: normalizedPartySize,
    spawnedAt: now,
    defeatedAt: null,
    respawnAt: null,
    contributors: {},
    updatedAt: now,
  };
}

export function normalizeOriginEncounter(value) {
  if (!value || typeof value !== "object") return null;
  const definition = getCoopBossForMap(value.mapId);
  if (
    !definition
    || definition.bossClass !== "final"
    || value.bossId !== definition.id
    || typeof value.encounterId !== "string"
    || !value.encounterId
  ) return null;
  const maxHp = Math.max(1, rounded(finite(value.maxHp, definition.baseHp)));
  const hp = rounded(Math.max(0, Math.min(maxHp, finite(value.hp, maxHp))));
  const status = STATUSES.has(value.status) ? value.status : "alive";
  const phaseName = originPhaseForHp(hp, maxHp);
  return {
    ...value,
    status,
    x: Math.max(0, Math.min(2160, finite(value.x, definition.x))),
    y: Math.max(0, Math.min(1800, finite(value.y, definition.y))),
    dir: DIRECTIONS.has(value.dir) ? value.dir : "down",
    moving: Boolean(value.moving),
    hp,
    maxHp,
    phase: { life: 1, memory: 2, energy: 3, rewrite: 4 }[phaseName],
    originPhase: phaseName,
    anchors: normalizeAnchors(value.anchors),
    rewriteCycle: normalizeRewriteCycle(value.rewriteCycle),
    completionClaimWritten: value.completionClaimWritten === true,
    authorityEpoch: Math.max(1, Math.trunc(finite(value.authorityEpoch, 1))),
    leaseUntil: finite(value.leaseUntil),
    partySize: Math.max(1, Math.min(10, Math.trunc(finite(value.partySize, 1)))),
    contributors: value.contributors && typeof value.contributors === "object" && !Array.isArray(value.contributors)
      ? { ...value.contributors }
      : {},
  };
}

export function acquireOriginAuthority(value, { uid, now = Date.now() } = {}) {
  const encounter = normalizeOriginEncounter(value);
  if (!encounter || typeof uid !== "string" || !uid) {
    return { ok: false, reason: "invalid_authority" };
  }
  if (encounter.authorityUid !== uid && encounter.leaseUntil > now) {
    return { ok: false, reason: "lease_active" };
  }
  const changedOwner = encounter.authorityUid !== uid;
  return {
    ok: true,
    encounter: {
      ...encounter,
      authorityUid: uid,
      authorityEpoch: changedOwner ? encounter.authorityEpoch + 1 : encounter.authorityEpoch,
      leaseUntil: now + AUTHORITY_LEASE_MS,
      updatedAt: now,
    },
  };
}

export function renewOriginAuthority(value, { uid, authorityEpoch, now = Date.now() } = {}) {
  const encounter = normalizeOriginEncounter(value);
  if (!encounter || encounter.authorityUid !== uid || encounter.authorityEpoch !== authorityEpoch) {
    return { ok: false, reason: "authority_mismatch" };
  }
  return {
    ok: true,
    encounter: {
      ...encounter,
      leaseUntil: now + AUTHORITY_LEASE_MS,
      updatedAt: now,
    },
  };
}

export function hasActiveOriginAnchors(value) {
  const encounter = normalizeOriginEncounter(value);
  return Boolean(encounter && Object.values(encounter.anchors).some(anchor => anchor.active && anchor.hp > 0));
}

export function applyOriginAttack(value, validated, now = Date.now()) {
  const encounter = normalizeOriginEncounter(value);
  if (!encounter || encounter.status !== "alive" || !validated?.ok || !(validated.damage > 0)) {
    return {
      encounter: encounter || value,
      applied: false,
      defeated: false,
      blockedByAnchors: false,
    };
  }

  const activeAnchors = Object.values(encounter.anchors).some(anchor => anchor.active && anchor.hp > 0);
  let hp = rounded(Math.max(0, encounter.hp - validated.damage));
  const blockedByAnchors = activeAnchors && hp === 0;
  if (blockedByAnchors) hp = 1;

  const previous = encounter.contributors[validated.uid];
  const contributors = {
    ...encounter.contributors,
    [validated.uid]: {
      firstHitAt: previous?.firstHitAt ?? now,
      lastHitAt: now,
    },
  };
  const defeated = !blockedByAnchors && encounter.hp > 0 && hp === 0;
  const originPhase = originPhaseForHp(hp, encounter.maxHp);

  return {
    applied: true,
    defeated,
    blockedByAnchors,
    encounter: {
      ...encounter,
      hp,
      phase: { life: 1, memory: 2, energy: 3, rewrite: 4 }[originPhase],
      originPhase,
      contributors,
      status: defeated ? "defeated" : encounter.status,
      defeatedAt: defeated ? now : encounter.defeatedAt,
      respawnAt: defeated ? bossRespawnAt(now) : encounter.respawnAt,
      moving: defeated ? false : encounter.moving,
      updatedAt: now,
    },
  };
}

export function applyOriginAnchorDamage(value, anchorId, damage) {
  const encounter = normalizeOriginEncounter(value);
  if (!encounter || encounter.status !== "alive" || !ORIGIN_ANCHOR_IDS.includes(anchorId) || !(damage > 0)) {
    return { encounter: encounter || value, applied: false, destroyed: false };
  }
  const anchor = encounter.anchors[anchorId];
  if (!anchor?.active || !(anchor.hp > 0)) return { encounter, applied: false, destroyed: false };
  const hp = rounded(Math.max(0, anchor.hp - damage));
  const destroyed = anchor.hp > 0 && hp === 0;
  return {
    applied: true,
    destroyed,
    encounter: {
      ...encounter,
      anchors: {
        ...encounter.anchors,
        [anchorId]: { ...anchor, hp, active: hp > 0 },
      },
    },
  };
}
