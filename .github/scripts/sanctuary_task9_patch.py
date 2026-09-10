from pathlib import Path

root = Path('.')
game_path = root / 'src/game-20260910-sanctuary.js'
game = game_path.read_text()


def replace_required(old, new, name, count=1):
    global game
    if old not in game:
        raise SystemExit(f'{name} marker missing')
    game = game.replace(old, new, count)


replace_required(
    'import { sanctuaryEndingScript } from "./sanctuary-ending-script-20260910-sanctuary.js";\nimport { applyTrinityDamage, createTrinityEncounter } from "./trinity-boss-20260910-sanctuary.js";',
    'import { sanctuaryEndingScript } from "./sanctuary-ending-script-20260910-sanctuary.js";\nimport { SanctuaryEndingController } from "./sanctuary-ending-controller-20260910-sanctuary.js";\nimport { advanceTrinityEncounter, applyTrinityDamage, createTrinityEncounter } from "./trinity-boss-20260910-sanctuary.js";',
    'imports',
)

replace_required(
    '    this.progress = createInitialProgress();\n',
    '''    this.progress = createInitialProgress();
    this.trinityBoss = null;
    this.endingController = elements.sanctuaryEndingOverlay ? new SanctuaryEndingController({
      elements: {
        overlay: elements.sanctuaryEndingOverlay,
        choicePanel: elements.endingChoicePanel,
        confirmPanel: elements.endingConfirmPanel,
        restoreButton: elements.endingRestoreButton,
        sealButton: elements.endingSealButton,
        resonateButton: elements.endingResonateButton,
        deferButton: elements.endingDeferButton,
        confirmButton: elements.endingConfirmButton,
        cancelButton: elements.endingConfirmCancel,
        confirmText: elements.endingConfirmText,
        lockedReason: elements.endingLockedReason,
        subtitle: elements.endingSubtitle,
        credits: elements.endingCredits,
        creditsText: elements.endingCreditsText,
        skipButton: elements.endingCreditsSkip,
      },
      onChoose: choice => this.confirmSanctuaryEnding(choice),
      onDefer: () => {
        if (this.running && this.player.respawnTimer <= 0) this.setInputEnabled(true);
      },
      onCreditsComplete: () => this.completeSanctuaryCredits(),
    }) : null;
''',
    'constructor',
)

replace_required(
    '  receiveBossPlayerDamage(values) {\n    const events = Array.isArray(values) ? values : Object.values(values || {});',
    '  receiveBossPlayerDamage(values) {\n    if (this.isOriginSpectator()) return;\n    const events = Array.isArray(values) ? values : Object.values(values || {});',
    'spectator damage',
)

replace_required(
    '''  handleBossControllerEvents(events) {
    for (const event of events || []) {
      if (event?.type === "damage-player") {
        this.damagePlayer(event.amount ?? event.damage, this.coopBossController?.renderableBoss() || this.player);
      } else if (event?.type === "boss-defeated") {
        this.processBossReward(event, "local-player");
      }
    }
  }''',
    '''  handleBossControllerEvents(events) {
    for (const event of events || []) {
      if (event?.type === "damage-player") {
        if (!this.isOriginSpectator()) {
          this.damagePlayer(event.amount ?? event.damage, this.coopBossController?.renderableBoss() || this.player);
        }
      } else if (event?.type === "boss-defeated") {
        if (event.bossId === "origin-zero") {
          if (this.recordLocalOriginDefeat(event.encounterId)) this.openSanctuaryEndingChoice();
        } else {
          this.processBossReward(event, "local-player");
        }
      }
    }
  }''',
    'boss events',
)

replace_required(
    '  updateBossController(dt, context = {}, timestamp = performance.now()) {\n    const controller = this.coopBossController;',
    '  updateBossController(dt, context = {}, timestamp = performance.now()) {\n    if (this.isOriginSpectator()) return [];\n    const controller = this.coopBossController;',
    'boss spectator',
)

start = game.index('  async receiveBossRewardClaims(values) {')
end = game.index('\n  isDialogueOpen() {', start)
method = game[start:end]
claim_marker = '''      const claimedRewardIds = Array.isArray(this.progress.claimedBossRewardIds)
        ? this.progress.claimedBossRewardIds
        : [];'''
if claim_marker not in method:
    raise SystemExit('claim scoped marker missing')
method = method.replace(
    claim_marker,
    '''      if (claim.bossId === "origin-zero") {
        const localSaved = this.progress?.worldProgress?.chapters?.sanctuary?.originDefeated === true
          || this.recordLocalOriginDefeat(claim.encounterId);
        if (!localSaved) continue;
        try {
          const claimResult = await this.network.coopBoss.claimReward(claim.encounterId, claim);
          if (claimResult?.ok) {
            this.processedBossRewardIds.add(rewardId);
            this.openSanctuaryEndingChoice();
          }
        } catch {
          // Local receipt is already durable; remote claim cleanup will retry on the next snapshot.
        }
        continue;
      }
''' + claim_marker,
    1,
)
game = game[:start] + method + game[end:]

replace_required(
    '''  targetableBosses() {
    return this.coopBossController?.targetableBosses?.() || [this.coopBossController?.targetableBoss?.()].filter(Boolean);
  }''',
    '''  targetableBosses() {
    if (this.isOriginSpectator()) return [];
    const trinity = this.ensureTrinityEncounter();
    if (trinity) {
      return [{ ...trinity, radius: 38, targetable: true, isTrinity: true, isCoopBoss: false }];
    }
    return this.coopBossController?.targetableBosses?.()
      || [this.coopBossController?.targetableBoss?.()].filter(Boolean);
  }

  updateTrinity(dt) {
    const boss = this.ensureTrinityEncounter();
    if (!boss) return [];
    const tick = advanceTrinityEncounter(boss, dt, {
      player: { ...this.player, uid: this.network?.uid || "local-player" },
      rng: Math.random,
      now: Date.now(),
    });
    this.trinityBoss = tick.state;
    for (const event of tick.events) {
      if (["damage-player", "trinity-projectile", "trinity-eruption"].includes(event.type)) {
        this.damagePlayer(event.amount ?? event.damage, event.source || { x: boss.x, y: boss.y });
      }
    }
    return tick.events;
  }''',
    'trinity targets',
)

replace_required(
    '    this.updateVolcanoEruption(dt);\n\n    if (this.portalTransition) {',
    '    this.updateVolcanoEruption(dt);\n    this.updateTrinity(dt);\n\n    if (this.portalTransition) {',
    'trinity update',
)

replace_required(
    '''          if (target.isCoopBoss) {
            this.coopBossController.requestHit({ targetId: target.id, attackKind: cast.kind, castId: cast.id, hitIndex: pulse.hitIndex, player: { ...cast.player, x: this.player.x, y: this.player.y }, classId: cast.classId, weaponId: cast.weaponId, direction: cast.direction }).catch?.(error => console.warn("스킬 요청 실패", error));
          } else {''',
    '''          if (target.isTrinity) {
            this.damageTrinity(d.damage);
          } else if (target.isCoopBoss) {
            this.coopBossController.requestHit({ targetId: target.id, attackKind: cast.kind, castId: cast.id, hitIndex: pulse.hitIndex, player: { ...cast.player, x: this.player.x, y: this.player.y }, classId: cast.classId, weaponId: cast.weaponId, direction: cast.direction }).catch?.(error => console.warn("스킬 요청 실패", error));
          } else {''',
    'skill trinity',
)

replace_required(
    '''      if (event.targetType === "coop-boss") {
        this.processedProjectileHitIds.add(eventId);
        this.coopBossController?.requestHit({''',
    '''      if (event.targetType === "coop-boss") {
        this.processedProjectileHitIds.add(eventId);
        if (event.enemyId === "trinity") {
          this.damageTrinity(event.damage);
          continue;
        }
        this.coopBossController?.requestHit({''',
    'projectile trinity',
)

replace_required(
    '''      this.coopBossController.requestHit({
        targetId: boss.id,
        attackKind: kind,''',
    '''      if (boss.isTrinity) {
        this.damageTrinity(definition.damage);
        hit = true;
        continue;
      }
      this.coopBossController.requestHit({
        targetId: boss.id,
        attackKind: kind,''',
    'melee trinity',
)

replace_required(
    '''  isInteractionOpen() {
    return this.isSaleConfirmOpen() || this.isBlacksmithOpen()
      || this.isQaOpen() || this.isDialogueOpen() || this.isShopOpen() || this.isInventoryOpen()
      || this.isCommunicationLogOpen();
  }''',
    '''  isInteractionOpen() {
    return this.isSaleConfirmOpen() || this.isBlacksmithOpen()
      || this.isQaOpen() || this.isDialogueOpen() || this.isShopOpen() || this.isInventoryOpen()
      || this.isCommunicationLogOpen() || Boolean(this.endingController?.active);
  }''',
    'interaction ending',
)

replace_required(
    '''  openSanctuaryEndingChoice() {
    const s = this.progress?.worldProgress?.chapters?.sanctuary;
    if (!s?.originDefeated || s.endingChoice || !this.endingController) return false;
    return this.endingController.openChoice({ choices: availableSanctuaryEndings(this.progress), deferAllowed: true }) !== false;
  }''',
    '''  openSanctuaryEndingChoice() {
    const s = this.progress?.worldProgress?.chapters?.sanctuary;
    if (!s?.originDefeated || s.endingChoice || !this.endingController) return false;
    this.keys?.clear?.();
    if (this.player) this.player.moving = false;
    this.attackState = null;
    this.setInputEnabled?.(false);
    return this.endingController.openChoice({
      choices: availableSanctuaryEndings(this.progress),
      deferAllowed: true,
    }) !== false;
  }''',
    'open ending',
)

replace_required(
    '''  completeSanctuaryCredits() {
    this.endingController?.close?.(); this.trinityBoss = null; this.mapId = "village";
    const spawn = getWorldDefinition("village").spawn;
    if (this.player) { this.player.x=spawn.x; this.player.y=spawn.y; this.player.prevX=spawn.x; this.player.prevY=spawn.y; }
    this.notify?.("PIXEL WORLD — 제1부 완료"); return true;
  }''',
    '''  completeSanctuaryCredits() {
    this.endingController?.close?.();
    this.trinityBoss = null;
    const spawn = getWorldDefinition("village").spawn;
    if (typeof this.switchWorld === "function") this.switchWorld("village", spawn.x, spawn.y, false);
    else {
      this.mapId = "village";
      if (this.player) {
        this.player.x = spawn.x;
        this.player.y = spawn.y;
        this.player.prevX = spawn.x;
        this.player.prevY = spawn.y;
      }
    }
    this.resetCombatState?.();
    this.setInputEnabled?.(true);
    this.notify?.("PIXEL WORLD — 제1부 완료");
    return true;
  }''',
    'credits return',
)

replace_required(
    '''    const coopBoss = this.coopBossController?.renderableBoss();
    const visibleBosses = this.coopBossController?.renderableBosses?.() || (coopBoss ? [coopBoss] : []);
    for (const boss of visibleBosses) {
      if (boss.hp > 0) entities.push({ entityType: "coop-boss", enemy: boss, x: boss.x, y: boss.y });
    }''',
    '''    const coopBoss = this.isOriginSpectator() ? null : this.coopBossController?.renderableBoss();
    const visibleBosses = this.isOriginSpectator()
      ? []
      : (this.coopBossController?.renderableBosses?.() || (coopBoss ? [coopBoss] : []));
    for (const boss of visibleBosses) {
      if (boss.hp > 0) entities.push({ entityType: "coop-boss", enemy: boss, x: boss.x, y: boss.y });
    }
    const trinity = this.ensureTrinityEncounter();
    if (trinity?.hp > 0) {
      entities.push({ entityType: "coop-boss", enemy: { ...trinity, radius: 38 }, x: trinity.x, y: trinity.y });
    }''',
    'render bosses',
)

game_path.write_text(game)

world_path = root / 'src/world-20260910-sanctuary.js'
world = world_path.read_text()
if 'SANCTUARY_STORY_INTERACTIONS' not in world:
    world = world.replace(
        'import { getVolcanoStoryContent } from "./volcano-story-data-20260903-volcano-20260905-upgrade.js";',
        'import { getVolcanoStoryContent } from "./volcano-story-data-20260903-volcano-20260905-upgrade.js";\nimport { SANCTUARY_STORY_INTERACTIONS } from "./sanctuary-story-data-20260910-sanctuary.js";\nimport { sanctuaryObjective } from "./quest-guidance-20260910-sanctuary.js";',
    )
old = 'export function getStoryRenderablesForMap(mapId, worldProgress = null) {\n  const content = getVolcanoStoryContent(mapId);'
new = '''export function getStoryRenderablesForMap(mapId, worldProgress = null) {
  if (mapId.startsWith("sanctuary")) {
    const interactions = SANCTUARY_STORY_INTERACTIONS.filter(value => value.mapId === mapId);
    const active = interactions.find(value => isStoryInteractionEligible(value, worldProgress));
    return {
      signals: interactions.map(interaction => ({
        id: interaction.id,
        interactionId: interaction.id,
        chapterId: "sanctuary",
        signalKind: interaction.type,
        x: interaction.x,
        y: interaction.y,
        active: isStoryInteractionEligible(interaction, worldProgress),
      })),
      objective: active ? { x: active.x, y: active.y, radius: Math.max(96, active.interactionRadius) } : null,
      chapterObjective: sanctuaryObjective(worldProgress),
    };
  }
  const content = getVolcanoStoryContent(mapId);'''
if old not in world:
    raise SystemExit('world story marker missing')
world = world.replace(old, new, 1)
old = 'export function drawStorySignal(context, signal, cameraX = 0, cameraY = 0) {\n  if (signal?.chapterId !== "volcano") {'
new = '''export function drawStorySignal(context, signal, cameraX = 0, cameraY = 0) {
  if (signal?.chapterId === "sanctuary") {
    if (!context || !Number.isFinite(signal.x) || !Number.isFinite(signal.y)) return;
    const x = Math.round(signal.x - cameraX);
    const y = Math.round(signal.y - cameraY);
    context.save();
    context.globalAlpha = signal.active ? 1 : 0.42;
    context.fillStyle = "#c4b5fd";
    context.strokeStyle = "#f5f3ff";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, 14, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
    return;
  }
  if (signal?.chapterId !== "volcano") {'''
if old not in world:
    raise SystemExit('world draw marker missing')
world = world.replace(old, new, 1)
world = world.replace('const sanctuary = world.id === "sanctuary";', 'const sanctuary = world.id.startsWith("sanctuary");')
world = world.replace('context.fillStyle = world.id === "sanctuary" ? "#fef3c7" : "#ffb199";', 'context.fillStyle = world.id.startsWith("sanctuary") ? "#fef3c7" : "#ffb199";')
world_path.write_text(world)

main_path = root / 'src/main-20260910-sanctuary.js'
main = main_path.read_text()
marker = '  goldText: document.querySelector("#goldText"),\n};'
insert = '''  goldText: document.querySelector("#goldText"),
  sanctuaryEndingOverlay: document.querySelector("#sanctuaryEndingOverlay"),
  endingChoicePanel: document.querySelector("#endingChoicePanel"),
  endingConfirmPanel: document.querySelector("#endingConfirmPanel"),
  endingRestoreButton: document.querySelector("#endingRestoreButton"),
  endingSealButton: document.querySelector("#endingSealButton"),
  endingResonateButton: document.querySelector("#endingResonateButton"),
  endingDeferButton: document.querySelector("#endingDeferButton"),
  endingConfirmButton: document.querySelector("#endingConfirmButton"),
  endingConfirmCancel: document.querySelector("#endingConfirmCancel"),
  endingConfirmText: document.querySelector("#endingConfirmText"),
  endingLockedReason: document.querySelector("#endingLockedReason"),
  endingSubtitle: document.querySelector("#endingSubtitle"),
  endingCredits: document.querySelector("#endingCredits"),
  endingCreditsText: document.querySelector("#endingCreditsText"),
  endingCreditsSkip: document.querySelector("#endingCreditsSkip"),
};'''
if marker not in main:
    raise SystemExit('main ending marker missing')
main_path.write_text(main.replace(marker, insert, 1))
