import { BOSS_STATE_SEND_HZ, getCoopBossForMap } from "./coop-boss-data.js";
import { normalizeBossEncounter } from "./coop-boss-state.js";
import { applyBossAttack, createBossPlayerDamageEvent, createRewardClaims, validateBossAttack } from "./coop-boss-state.js";
import { createBossEnemyView, drawEnemy, updateEnemies } from "./enemies.js";

const AUTHORITY_TAKEOVER_STAGGER_MS = 1_500;

export function selectBossTarget(boss, players, mapId) {
  if (!boss) return null;
  return [...players]
    .filter(player => player && player.mapId === mapId && player.hp > 0
      && Number.isFinite(player.x) && Number.isFinite(player.y))
    .sort((a, b) => Math.hypot(a.x - boss.x, a.y - boss.y) - Math.hypot(b.x - boss.x, b.y - boss.y))[0] || null;
}

export class CoopBossController {
  constructor({
    uid, network, now = () => performance.now(),
    wallNow = () => Date.now(),
    simulate = updateEnemies, createView = createBossEnemyView, drawView = drawEnemy,
  }) {
    this.uid = uid;
    this.network = network;
    this.now = now;
    this.wallNow = wallNow;
    this.simulate = simulate;
    this.createView = createView;
    this.drawView = drawView;
    this.mapId = "village";
    this.snapshot = null;
    this.view = null;
    this.interpolation = null;
    this.lastPublishedAt = null;
    this.pendingEvents = [];
    this.attackSequence = 0;
    this.lastSequences = new Map();
    this.lastAttackTimes = new Map();
    this.players = new Map();
    this.processedBossAttackIds = new Set();
    this.playerDamageSequence = 0;
    this.partySize = 1;
    this.readyPromise = null;
    this.lifecyclePromise = null;
    this.nextLifecycleAttemptAt = 0;
    this.takeoverCandidateUid = uid;
    this.takeoverCandidateRank = 0;
  }

  async setMap(mapId, { partySize = 1, deferEncounter = false } = {}) {
    this.clear();
    this.mapId = getCoopBossForMap(mapId) ? mapId : "village";
    this.setPartySize(partySize);
    const subscribed = await this.network?.setMap?.(this.mapId);
    if (!subscribed) return false;
    return deferEncounter ? true : this.ensureReady();
  }

  setPartySize(value) {
    this.partySize = Math.max(1, Math.min(10, Math.trunc(Number(value) || 1)));
    return this.partySize;
  }

  setParticipants(values) {
    const participants = (Array.isArray(values) ? values : [])
      .filter(value => typeof value?.uid === "string" && value.uid)
      .sort((a, b) => {
        const joinedA = Number.isFinite(a.joinedAt) ? a.joinedAt : Number.POSITIVE_INFINITY;
        const joinedB = Number.isFinite(b.joinedAt) ? b.joinedAt : Number.POSITIVE_INFINITY;
        return joinedA - joinedB || a.uid.localeCompare(b.uid);
      });
    this.setPartySize(participants.length || 1);
    this.takeoverCandidateUid = participants[0]?.uid || this.uid;
    const ownRank = participants.findIndex(participant => participant.uid === this.uid);
    this.takeoverCandidateRank = ownRank >= 0 ? ownRank : participants.length;
    return this.takeoverCandidateUid;
  }

  async ensureReady() {
    if (!getCoopBossForMap(this.mapId)) return false;
    if (this.snapshot) return true;
    if (this.readyPromise) return this.readyPromise;
    const activeMapId = this.mapId;
    const pending = (async () => {
      const encounter = await this.network.ensureEncounter?.({ partySize: this.partySize });
      if (this.mapId !== activeMapId) return false;
      if (encounter) this.receiveSnapshot(encounter);
      if (!this.snapshot) {
        const acquisition = await this.network.tryAcquireAuthority?.();
        if (this.mapId !== activeMapId) return false;
        if (acquisition?.ok && acquisition.encounter) this.receiveSnapshot(acquisition.encounter);
      }
      if (this.isAuthority()) await this.cleanupExpiredSafely();
      return Boolean(this.snapshot);
    })();
    this.readyPromise = pending;
    try {
      return await pending;
    } finally {
      if (this.readyPromise === pending) this.readyPromise = null;
    }
  }

  async cleanupExpiredSafely() {
    try {
      await this.network.cleanupExpired?.();
    } catch {
      // Stale event cleanup is best-effort and must not block entering the region.
    }
  }

  async maintainLifecycle() {
    if (!this.snapshot || !getCoopBossForMap(this.mapId)) return false;
    if (this.lifecyclePromise) return this.lifecyclePromise;
    const activeMapId = this.mapId;
    const timestamp = this.wallNow();
    const takeoverDue = !this.isAuthority()
      && this.snapshot.leaseUntil + this.takeoverCandidateRank * AUTHORITY_TAKEOVER_STAGGER_MS <= timestamp;
    const respawnDue = this.isAuthority() && this.snapshot.status !== "alive" && this.snapshot.respawnAt <= timestamp;
    if ((!takeoverDue && !respawnDue) || timestamp < this.nextLifecycleAttemptAt) return false;
    this.nextLifecycleAttemptAt = timestamp + 1_000;
    const pending = (async () => {
      let changed = false;
      if (!this.isAuthority() && this.snapshot.leaseUntil <= timestamp) {
        const acquisition = await this.network.tryAcquireAuthority?.();
        if (this.mapId !== activeMapId) return false;
        if (acquisition?.ok && acquisition.encounter) {
          this.receiveSnapshot(acquisition.encounter);
          changed = true;
        }
      }
      if (this.isAuthority() && this.snapshot.status !== "alive" && this.snapshot.respawnAt <= timestamp) {
        const encounter = await this.network.ensureEncounter?.({ partySize: this.partySize });
        if (this.mapId !== activeMapId) return false;
        if (encounter) {
          this.receiveSnapshot(encounter);
          changed = true;
        }
      }
      if (changed && this.isAuthority()) await this.cleanupExpiredSafely();
      return this.isAuthority();
    })();
    this.lifecyclePromise = pending;
    try {
      return await pending;
    } finally {
      if (this.lifecyclePromise === pending) this.lifecyclePromise = null;
    }
  }

  receiveSnapshot(value) {
    const snapshot = normalizeBossEncounter(value);
    if (!snapshot || snapshot.mapId !== this.mapId && this.mapId !== "village") return false;
    const definition = getCoopBossForMap(snapshot.mapId);
    if (this.mapId === "village") this.mapId = snapshot.mapId;
    const previous = this.snapshot;
    this.snapshot = snapshot;
    const nextView = this.createView(definition, snapshot);
    if (!nextView) return false;

    if (snapshot.authorityUid !== this.uid && previous && previous.encounterId === snapshot.encounterId) {
      const fromAt = this.now();
      const toAt = fromAt + 500;
      this.interpolation = {
        fromX: this.view?.x ?? previous.x,
        fromY: this.view?.y ?? previous.y,
        targetX: snapshot.x,
        targetY: snapshot.y,
        fromAt,
        toAt,
      };
      nextView.x = this.interpolation.fromX;
      nextView.y = this.interpolation.fromY;
      nextView.prevX = nextView.x;
      nextView.prevY = nextView.y;
    } else {
      this.interpolation = null;
    }
    this.view = nextView;
    return true;
  }

  isAuthority() {
    return Boolean(this.snapshot && this.snapshot.authorityUid === this.uid);
  }

  targetableBoss() {
    return this.snapshot?.status === "alive" && this.view?.targetable ? this.view : null;
  }

  renderableBoss() {
    return this.view;
  }

  async requestHit({ attackKind, player, classId, weaponId, direction }) {
    if (!this.snapshot || this.snapshot.status !== "alive" || this.snapshot.mapId !== this.mapId) {
      return { ok: false, reason: "boss_unavailable" };
    }
    const sequence = ++this.attackSequence;
    const request = {
      attackId: `${this.uid}:${this.snapshot.encounterId}:${sequence}`,
      sequence,
      uid: this.uid,
      encounterId: this.snapshot.encounterId,
      bossId: this.snapshot.bossId,
      mapId: this.snapshot.mapId,
      classId,
      weaponId,
      attackKind,
      playerX: Math.round(player.x * 10) / 10,
      playerY: Math.round(player.y * 10) / 10,
      direction,
      createdAt: this.wallNow(),
    };
    return this.network?.sendAttack?.(request) ?? { ok: false, reason: "network_unavailable" };
  }

  async receiveAttackRequests(requestTree) {
    if (!this.isAuthority() || !requestTree || typeof requestTree !== "object") return 0;
    const requests = [];
    for (const [requestUid, sequences] of Object.entries(requestTree)) {
      for (const [sequence, request] of Object.entries(sequences || {})) {
        requests.push({ ...request, uid: requestUid, sequence: Number(request.sequence ?? sequence) });
      }
    }
    requests.sort((a, b) => a.sequence - b.sequence);
    let appliedCount = 0;
    for (const request of requests) {
      const player = this.players.get(request.uid);
      const validated = validateBossAttack(request, {
        encounter: this.snapshot,
        bossDefinition: getCoopBossForMap(this.mapId),
        authenticatedUid: request.uid,
        player,
        lastSequence: this.lastSequences.get(request.uid) || 0,
        lastAttackAt: this.lastAttackTimes.get(request.uid) ?? Number.NEGATIVE_INFINITY,
        now: this.wallNow(),
      });
      if (validated.ok) {
        const result = applyBossAttack(this.snapshot, validated, this.wallNow());
        this.snapshot = result.encounter;
        if (this.view) {
          this.view.hp = this.snapshot.hp;
          this.view.maxHp = this.snapshot.maxHp;
          this.view.targetable = this.snapshot.status === "alive";
        }
        this.lastSequences.set(request.uid, request.sequence);
        this.lastAttackTimes.set(request.uid, validated.attackAt);
        await this.network?.publishState?.(this.snapshot);
        if (result.defeated) {
          await this.network?.writeRewardClaims?.(
            this.snapshot.encounterId,
            createRewardClaims(this.snapshot, this.snapshot.defeatedAt),
          );
        }
        appliedCount += 1;
      }
      await this.network?.acknowledgeAttack?.(request.uid, request.sequence);
    }
    return appliedCount;
  }

  update(dt, context = {}, timestamp = this.now()) {
    this.maintainLifecycle().catch?.(() => {});
    if (!this.snapshot || !this.view || this.snapshot.status !== "alive") return [];
    if (!this.isAuthority()) {
      if (this.interpolation) {
        const duration = Math.max(1, this.interpolation.toAt - this.interpolation.fromAt);
        const t = Math.max(0, Math.min(1, (timestamp - this.interpolation.fromAt) / duration));
        this.view.prevX = this.view.x;
        this.view.prevY = this.view.y;
        this.view.x = this.interpolation.fromX + (this.interpolation.targetX - this.interpolation.fromX) * t;
        this.view.y = this.interpolation.fromY + (this.interpolation.targetY - this.interpolation.fromY) * t;
      }
      return [];
    }

    const localPlayer = context.player ? {
      ...context.player,
      uid: context.player.uid || this.uid,
      mapId: context.player.mapId || this.mapId,
    } : null;
    const remotePlayers = context.remotePlayers instanceof Map
      ? [...context.remotePlayers.values()].map(player => ({ ...player, mapId: player.mapId || this.mapId, hp: player.hp ?? 100 }))
      : [];
    this.players = new Map([localPlayer, ...remotePlayers].filter(Boolean).map(player => [player.uid, player]));
    const target = selectBossTarget(this.view, [localPlayer, ...remotePlayers].filter(Boolean), this.mapId);
    const result = this.simulate([this.view], target || localPlayer || { x: this.view.x, y: this.view.y }, dt, {
      isBlocked: context.isBlocked || (() => false),
      portals: context.portals || [],
      random: context.random || Math.random,
    });
    this.view = result.enemies?.[0] || this.view;
    for (const event of result.events || []) {
      if (event?.type === "damage-player" && target && event.attackId) {
        if (this.processedBossAttackIds.has(event.attackId)) continue;
        this.processedBossAttackIds.add(event.attackId);
        const playerDamage = createBossPlayerDamageEvent({
          encounter: this.snapshot,
          targetUid: target.uid,
          damage: event.amount,
          sequence: ++this.playerDamageSequence,
          now: this.wallNow(),
        });
        if (playerDamage) this.network?.sendPlayerDamage?.(target.uid, playerDamage).catch?.(() => {});
        continue;
      }
      this.pendingEvents.push(event);
    }

    const interval = 1000 / BOSS_STATE_SEND_HZ;
    if (this.lastPublishedAt === null || timestamp - this.lastPublishedAt >= interval) {
      this.lastPublishedAt = timestamp;
      this.snapshot = {
        ...this.snapshot,
        x: this.view.x,
        y: this.view.y,
        dir: this.view.dir || this.snapshot.dir,
        moving: Boolean(this.view.moving),
        targetUid: target?.uid || null,
        updatedAt: this.wallNow(),
      };
      this.network?.publishState?.(this.snapshot).catch?.(() => {});
    }
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  draw(ctx, cameraX, cameraY, alpha, options = {}) {
    if (!this.view) return false;
    this.drawView(ctx, this.view, cameraX, cameraY, alpha, options);
    return true;
  }

  clear() {
    this.snapshot = null;
    this.view = null;
    this.interpolation = null;
    this.pendingEvents = [];
    this.lastPublishedAt = null;
    this.players.clear();
    this.processedBossAttackIds.clear();
    this.playerDamageSequence = 0;
    this.readyPromise = null;
    this.lifecyclePromise = null;
    this.nextLifecycleAttemptAt = 0;
    this.takeoverCandidateUid = this.uid;
    this.takeoverCandidateRank = 0;
  }
}

export function createCoopBossController(options) {
  return new CoopBossController(options);
}
