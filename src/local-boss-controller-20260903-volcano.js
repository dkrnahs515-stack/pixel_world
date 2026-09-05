import { getCoopBossForMap } from "./coop-boss-data-20260903-volcano.js";
import { applyBossAttack, createBossEncounter, validateBossAttack } from "./coop-boss-state-20260903-volcano.js";
import { createBossEnemyView, createEnemyContactDamageEvent, updateEnemies } from "./enemies-20260829-coast.js";

function regionIdFor(definition) {
  return definition.id.split("-")[0];
}

function createSessionId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizedSessionId(value) {
  const normalized = typeof value === "string"
    ? value.trim().replace(/[^a-zA-Z0-9_-]/g, "-")
    : "";
  return normalized || createSessionId();
}

function localPlayer(player, mapId, classId, weaponId) {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return null;
  return {
    ...player,
    uid: typeof player.uid === "string" && player.uid ? player.uid : "local-player",
    mapId: player.mapId || mapId,
    classId: player.classId || classId,
    equippedWeaponId: player.equippedWeaponId || weaponId,
  };
}

export class LocalBossController {
  constructor({
    now = () => performance.now(), wallNow = () => Date.now(),
    simulate = updateEnemies, createView = createBossEnemyView, sessionId,
  } = {}) {
    this.now = now;
    this.wallNow = wallNow;
    this.simulate = simulate;
    this.createView = createView;
    this.sessionId = normalizedSessionId(sessionId);
    this.mapId = "village";
    this.snapshot = null;
    this.view = null;
    this.pendingEvents = [];
    this.encounterSequence = 0;
    this.attackSequence = 0;
    this.lastAttackAt = Number.NEGATIVE_INFINITY;
    this.attackTimes = new Map();
    this.skillCastStates = new Map();
    this.processedBossAttackIds = new Set();
  }

  async setMap(mapId) {
    this.clear();
    const definition = getCoopBossForMap(mapId);
    this.mapId = definition ? mapId : "village";
    if (!definition) return false;

    const timestamp = this.wallNow();
    this.snapshot = createBossEncounter(definition, {
      encounterId: `local:${regionIdFor(definition)}:${this.sessionId}:${++this.encounterSequence}`,
      partySize: 1,
      now: timestamp,
      authorityUid: "local",
    });
    this.view = this.createView(definition, this.snapshot);
    return Boolean(this.view);
  }

  targetableBoss() {
    return this.snapshot?.status === "alive" && this.view?.targetable ? this.view : null;
  }

  renderableBoss() {
    return this.view;
  }

  async requestHit({ attackKind, player, classId, weaponId, direction, castId, hitIndex } = {}) {
    if (!this.snapshot || this.snapshot.status !== "alive" || this.snapshot.mapId !== this.mapId) {
      return { ok: false, reason: "boss_unavailable" };
    }
    const attacker = localPlayer(player, this.mapId, classId, weaponId);
    const sequence = ++this.attackSequence;
    const request = {
      attackId: `${attacker?.uid || "local-player"}:${this.snapshot.encounterId}:${sequence}`,
      sequence,
      uid: attacker?.uid,
      encounterId: this.snapshot.encounterId,
      bossId: this.snapshot.bossId,
      mapId: this.snapshot.mapId,
      classId,
      weaponId,
      attackKind, castId, hitIndex,
      playerX: attacker?.x,
      playerY: attacker?.y,
      direction,
      createdAt: this.wallNow(),
    };
    const validated = validateBossAttack(request, {
      encounter: this.snapshot,
      bossDefinition: getCoopBossForMap(this.mapId),
      authenticatedUid: attacker?.uid,
      player: attacker,
      lastSequence: sequence - 1,
      lastAttackAt: this.attackTimes.get(attackKind) ?? Number.NEGATIVE_INFINITY,
      lastCast: this.skillCastStates.get(attackKind),
      now: this.wallNow(),
    });
    if (!validated.ok) return validated;

    const result = applyBossAttack(this.snapshot, validated, this.wallNow());
    if (!result.applied) return { ok: false, reason: "boss_unavailable" };
    this.snapshot = result.encounter;
    this.lastAttackAt = validated.attackAt;
    this.attackTimes.set(attackKind, validated.attackAt);
    if (validated.castState) this.skillCastStates.set(attackKind, validated.castState);
    if (this.view && validated.slowDuration) { this.view.slowRemaining = validated.slowDuration; this.view.slowMultiplier = validated.slowMultiplier; }
    if (this.view) {
      this.view.hp = this.snapshot.hp;
      this.view.maxHp = this.snapshot.maxHp;
      this.view.targetable = this.snapshot.status === "alive";
    }
    if (result.defeated) {
      const definition = getCoopBossForMap(this.snapshot.mapId);
      this.pendingEvents.push({
        type: "boss-defeated",
        encounterId: this.snapshot.encounterId,
        bossId: this.snapshot.bossId,
        mapId: this.snapshot.mapId,
        rewardExp: definition.rewardExp,
        rewardGold: definition.rewardGold,
      });
    }
    return { ok: true, damage: validated.damage };
  }

  update(dt, context = {}) {
    if (!this.snapshot || !this.view || this.snapshot.status !== "alive") return [];
    const player = localPlayer(context.player, this.mapId, context.player?.classId, context.player?.equippedWeaponId)
      || { x: this.view.x, y: this.view.y };
    const contactBeforeMove = createEnemyContactDamageEvent(this.view, player);
    const result = this.simulate([this.view], player, dt, {
      isBlocked: context.isBlocked || (() => false),
      portals: context.portals || [],
      random: context.random || Math.random,
    });
    this.view = result.enemies?.[0] || this.view;
    this.view.hp = this.snapshot.hp;
    this.view.maxHp = this.snapshot.maxHp;
    const contactEvent = contactBeforeMove || createEnemyContactDamageEvent(this.view, player);
    const resultEvents = contactEvent ? [...(result.events || []), contactEvent] : result.events || [];
    this.snapshot = {
      ...this.snapshot,
      x: this.view.x,
      y: this.view.y,
      dir: this.view.dir || this.snapshot.dir,
      moving: Boolean(this.view.moving),
      targetUid: player.uid || null,
      updatedAt: this.wallNow(),
    };
    const events = [];
    for (const event of resultEvents) {
      if (event?.type === "damage-player" && event.attackId) {
        if (this.processedBossAttackIds.has(event.attackId)) continue;
        this.processedBossAttackIds.add(event.attackId);
      }
      this.pendingEvents.push(event);
      events.push(event);
    }
    return events;
  }

  consumeEvents() {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  clear() {
    this.mapId = "village";
    this.snapshot = null;
    this.view = null;
    this.pendingEvents = [];
    this.attackSequence = 0;
    this.lastAttackAt = Number.NEGATIVE_INFINITY;
    this.attackTimes = new Map();
    this.skillCastStates = new Map();
    this.processedBossAttackIds.clear();
  }
}

export function createLocalBossController(options) {
  return new LocalBossController(options);
}
