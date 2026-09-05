import { BOSS_STATE_SEND_HZ, getCoopBossForMap } from "./coop-boss-data-20260903-volcano-20260905-upgrade.js";
import { normalizeBossEncounter } from "./coop-boss-state-20260903-volcano-20260905-upgrade.js";
import { applyBossAttack, createBossPlayerDamageEvent, createRewardClaims, validateBossAttack } from "./coop-boss-state-20260903-volcano-20260905-upgrade.js";
import { createBossEnemyView, createEnemyContactDamageEvents, drawEnemy, updateEnemies } from "./enemies-20260829-coast-20260905-upgrade.js";

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
    reportError = (message, error) => console.warn(message, error),
    simulate = updateEnemies, createView = createBossEnemyView, drawView = drawEnemy,
  }) {
    this.uid = uid;
    this.network = network;
    this.now = now;
    this.wallNow = wallNow;
    this.reportError = reportError;
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
    this.skillCastStates = new Map();
    this.players = new Map();
    this.deferredSkillAttacks = new Map();
    this.skillReplayPromise = null;
    this.nextSkillReplayAt = 0;
    this.processedBossAttackIds = new Set();
    this.playerDamageSequence = 0;
    this.partySize = 1;
    this.readyPromise = null;
    this.lifecyclePromise = null;
    this.nextLifecycleAttemptAt = 0;
    this.takeoverCandidateUid = uid;
    this.takeoverCandidateRank = 0;
    this.rewardClaimPromise = null;
    this.nextRewardClaimAttemptAt = 0;
    this.reconciledRewardEncounterIds = new Set();
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
    const reconcileCurrentEncounter = async () => {
      const encounterId = this.snapshot?.encounterId;
      const reconciled = await this.reconcileRewardClaims();
      return reconciled && this.snapshot?.encounterId === encounterId
        && this.reconciledRewardEncounterIds.has(encounterId)
        ? encounterId
        : null;
    };
    let reconciledEncounterId = null;
    if (this.isAuthority() && this.snapshot.status === "defeated") {
      reconciledEncounterId = await reconcileCurrentEncounter();
    }
    const takeoverDue = !this.isAuthority()
      && this.snapshot.leaseUntil + this.takeoverCandidateRank * AUTHORITY_TAKEOVER_STAGGER_MS <= timestamp;
    const respawnDue = this.isAuthority()
      && (this.snapshot.status !== "defeated" || reconciledEncounterId === this.snapshot.encounterId)
      && this.snapshot.status !== "alive" && this.snapshot.respawnAt <= timestamp;
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
      if (this.isAuthority() && this.snapshot.status === "defeated") {
        reconciledEncounterId = await reconcileCurrentEncounter();
      }
      const rewardClaimsReady = this.snapshot.status !== "defeated"
        || reconciledEncounterId === this.snapshot.encounterId;
      if (rewardClaimsReady && this.isAuthority()
        && this.snapshot.status !== "alive" && this.snapshot.respawnAt <= timestamp) {
        const encounter = await this.network.ensureEncounter?.({
          partySize: this.partySize,
          reconciledEncounterId,
        });
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
    const retainsAuthoritySimulation = Boolean(this.view && previous
      && previous.encounterId === snapshot.encounterId
      && previous.authorityUid === this.uid && snapshot.authorityUid === this.uid
      && previous.authorityEpoch === snapshot.authorityEpoch);
    if (retainsAuthoritySimulation) {
      this.view.hp = snapshot.hp;
      this.view.maxHp = snapshot.maxHp;
      this.view.targetable = snapshot.status === "alive";
      this.interpolation = null;
      if (snapshot.status === "defeated") void this.reconcileRewardClaims();
      return true;
    }
    const nextView = this.createView(definition, snapshot);
    if (!nextView) return false;
    this.processedBossAttackIds.clear();
    this.playerDamageSequence = 0;

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
    if (this.isAuthority() && snapshot.status === "defeated") {
      void this.reconcileRewardClaims();
    }
    return true;
  }

  async reconcileRewardClaims({ force = false } = {}) {
    const encounter = this.snapshot;
    if (!encounter || encounter.status !== "defeated" || !this.isAuthority()
      || typeof this.network?.writeRewardClaims !== "function") {
      return false;
    }
    if (this.reconciledRewardEncounterIds.has(encounter.encounterId)) return true;
    if (this.rewardClaimPromise) return this.rewardClaimPromise;
    const timestamp = this.wallNow();
    if (!force && timestamp < this.nextRewardClaimAttemptAt) return false;
    this.nextRewardClaimAttemptAt = timestamp + 1_000;
    const activeMapId = this.mapId;
    const activeEncounterId = encounter.encounterId;
    const pending = (async () => {
      try {
        const result = await this.network.writeRewardClaims(
          activeEncounterId,
          createRewardClaims(encounter, encounter.defeatedAt),
        );
        if (result?.ok === false) {
          this.reportError("협동 보스 보상 claim 일부 기록 실패", new Error(
            `failed contributors: ${(result.failedUids || []).join(", ") || "unknown"}`,
          ));
          return false;
        }
        if (this.mapId === activeMapId && this.snapshot?.encounterId === activeEncounterId) {
          this.reconciledRewardEncounterIds.add(activeEncounterId);
        }
        return true;
      } catch (error) {
        this.reportError("협동 보스 보상 claim 기록 실패", error);
        return false;
      }
    })();
    this.rewardClaimPromise = pending;
    try {
      return await pending;
    } finally {
      if (this.rewardClaimPromise === pending) this.rewardClaimPromise = null;
    }
  }

  isAuthority() {
    return Boolean(this.snapshot && this.snapshot.authorityUid === this.uid
      && this.snapshot.leaseUntil > this.wallNow());
  }

  targetableBoss() {
    return this.snapshot?.status === "alive" && this.view?.targetable ? this.view : null;
  }

  renderableBoss() {
    return this.view;
  }

  async requestHit({ attackKind, player, classId, weaponId, direction, castId, hitIndex }) {
    if (!this.snapshot || this.snapshot.status !== "alive" || this.snapshot.mapId !== this.mapId) {
      return { ok: false, reason: "boss_unavailable" };
    }
    if (player?.mapId !== this.mapId) {
      return { ok: false, reason: "wrong_arena" };
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
      attackKind, ...(castId ? { castId, hitIndex } : {}),
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
      for (const [pathSequence, request] of Object.entries(sequences || {})) {
        requests.push({ ...request, uid: requestUid, pathSequence });
      }
    }
    requests.sort((a, b) => Number(a.pathSequence) - Number(b.pathSequence));
    let appliedCount = 0;
    for (const request of requests) {
      const player = this.players.get(request.uid);
      const pathMatchesPayload = Number.isInteger(request.sequence)
        && String(request.sequence) === request.pathSequence;
      const deferredKey = `${request.uid}:${request.pathSequence}`;
      const needsResource = pathMatchesPayload && ["skill-e", "skill-r"].includes(request.attackKind)
        && request.encounterId === this.snapshot?.encounterId
        && player?.skillResources?.[request.attackKind]?.castId !== request.castId
        && Number.isFinite(request.createdAt) && this.wallNow() - request.createdAt <= 5000;
      const earlierPending = [...this.deferredSkillAttacks.values()].some(pending => pending.uid === request.uid && pending.sequence < request.sequence);
      const canWait = request.sequence > (this.lastSequences.get(request.uid) || 0)
        && Number.isFinite(request.createdAt) && this.wallNow() - request.createdAt <= 5000;
      if (canWait && (needsResource || earlierPending)) {
        if (this.deferredSkillAttacks.has(deferredKey) || this.deferredSkillAttacks.size < 128) this.deferredSkillAttacks.set(deferredKey, request);
        continue;
      }
      this.deferredSkillAttacks.delete(deferredKey);
      const validated = pathMatchesPayload
        ? validateBossAttack(request, {
          encounter: this.snapshot,
          bossDefinition: getCoopBossForMap(this.mapId),
          authenticatedUid: request.uid,
          player,
          lastSequence: this.lastSequences.get(request.uid) || 0,
          lastAttackAt: this.lastAttackTimes.get(`${request.uid}:${request.attackKind}`) ?? Number.NEGATIVE_INFINITY,
          lastCast: this.skillCastStates.get(`${request.uid}:${request.attackKind}`),
          now: this.wallNow(),
        })
        : { ok: false, reason: "sequence_path_mismatch" };
      if (validated.ok) {
        const result = applyBossAttack(this.snapshot, validated, this.wallNow());
        this.snapshot = result.encounter;
        if (this.view) {
          this.view.hp = this.snapshot.hp;
          this.view.maxHp = this.snapshot.maxHp;
          this.view.targetable = this.snapshot.status === "alive";
        }
        this.lastSequences.set(request.uid, request.sequence);
        this.lastAttackTimes.set(`${request.uid}:${request.attackKind}`, validated.attackAt);
        if (validated.castState) this.skillCastStates.set(`${request.uid}:${request.attackKind}`, validated.castState);
        if (this.view && validated.slowDuration) { this.view.slowRemaining = validated.slowDuration; this.view.slowMultiplier = validated.slowMultiplier; }
        await this.network?.publishState?.(this.snapshot);
        if (result.defeated) {
          await this.reconcileRewardClaims({ force: true });
        }
        appliedCount += 1;
      }
      await this.network?.acknowledgeAttack?.(request.uid, request.pathSequence);
    }
    return appliedCount;
  }

  replayDeferredSkillAttacks() {
    if (!this.deferredSkillAttacks.size || this.skillReplayPromise || this.wallNow() < this.nextSkillReplayAt) return;
    this.nextSkillReplayAt = this.wallNow() + 50;
    const tree = {};
    for (const request of this.deferredSkillAttacks.values()) {
      tree[request.uid] ||= {};
      tree[request.uid][request.pathSequence] = request;
    }
    const replay = this.receiveAttackRequests(tree);
    this.skillReplayPromise = replay;
    replay.catch(error => this.reportError?.(error)).finally(() => {
      if (this.skillReplayPromise === replay) this.skillReplayPromise = null;
    });
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
    const activePlayers = [localPlayer, ...remotePlayers].filter(Boolean);
    this.players = new Map(activePlayers.map(player => [player.uid, player]));
    this.replayDeferredSkillAttacks();
    const target = selectBossTarget(this.view, activePlayers, this.mapId);
    const collisionPlayers = activePlayers.filter(player => player.mapId === this.mapId && player.hp > 0);
    const contactBeforeMove = createEnemyContactDamageEvents(this.view, collisionPlayers);
    const result = this.simulate([this.view], target || localPlayer || { x: this.view.x, y: this.view.y }, dt, {
      isBlocked: context.isBlocked || (() => false),
      portals: context.portals || [],
      random: context.random || Math.random,
    });
    this.view = result.enemies?.[0] || this.view;
    this.view.hp = this.snapshot.hp;
    this.view.maxHp = this.snapshot.maxHp;
    const contactEvents = contactBeforeMove.length > 0
      ? contactBeforeMove
      : createEnemyContactDamageEvents(this.view, collisionPlayers);
    const resultEvents = [...(result.events || []), ...contactEvents];
    const events = [];
    for (const event of resultEvents) {
      const damageTarget = event?.targetUid ? this.players.get(event.targetUid) : target;
      if (event?.type === "damage-player" && damageTarget && event.attackId) {
        if (this.processedBossAttackIds.has(event.attackId)) continue;
        this.processedBossAttackIds.add(event.attackId);
        const playerDamage = createBossPlayerDamageEvent({
          encounter: this.snapshot,
          targetUid: damageTarget.uid,
          damage: event.amount,
          sequence: ++this.playerDamageSequence,
          now: this.wallNow(),
        });
        if (playerDamage) this.network?.sendPlayerDamage?.(damageTarget.uid, playerDamage).catch?.(() => {});
        continue;
      }
      this.pendingEvents.push(event);
      events.push(event);
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
    return events;
  }

  consumeEvents() {
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
    this.deferredSkillAttacks.clear();
    this.skillReplayPromise = null;
    this.nextSkillReplayAt = 0;
    this.processedBossAttackIds.clear();
    this.playerDamageSequence = 0;
    this.readyPromise = null;
    this.lifecyclePromise = null;
    this.nextLifecycleAttemptAt = 0;
    this.takeoverCandidateUid = this.uid;
    this.takeoverCandidateRank = 0;
    this.rewardClaimPromise = null;
    this.nextRewardClaimAttemptAt = 0;
    this.reconciledRewardEncounterIds.clear();
  }
}

export function createCoopBossController(options) {
  return new CoopBossController(options);
}
