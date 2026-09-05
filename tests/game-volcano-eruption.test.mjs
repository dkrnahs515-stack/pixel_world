import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260903-volcano.js";
import { normalizeWorldProgress } from "../src/chapter-progress-20260903-volcano.js";
import { createInitialProgress } from "../src/quest-state-20260903-volcano.js";
import { createVolcanoEruptionState } from "../src/volcano-eruption-20260903-volcano.js";

function eruptionHarness() {
  const game = Object.create(PixelRPG.prototype);
  game.progress = createInitialProgress();
  game.progress.worldProgress = normalizeWorldProgress({
    chapters: {
      coast: { coreFragmentObtained: true },
      volcano: { routeDecision: "proceed", eruptionTriggered: true },
    },
  });
  game.mapId = "volcano-observatory";
  game.player = {
    x: 1000, y: 900, prevX: 1000, prevY: 900, dir: "right",
    hp: 100, maxHp: 100, mp: 100, maxMp: 100,
    invulnerable: 0, hitFlash: 0, respawnTimer: 0,
    statusEffects: { slow: { multiplier: 1, remaining: 0 } },
  };
  game.portalTransition = null;
  game.volcanoEruptionState = createVolcanoEruptionState();
  game.isInteractionOpen = () => false;
  game.sessionMode = "online";
  game.network = {
    uid: "local-online-player",
    coopBoss: new Proxy({}, {
      get() { throw new Error("eruption must not use cooperative boss network paths"); },
    }),
  };
  return game;
}

test("online eruption damage remains local and hits the player only inside the locked circle", () => {
  const game = eruptionHarness();
  const damage = [];
  game.damagePlayer = (amount, source) => {
    damage.push({ amount, source });
    return { applied: true, died: false };
  };

  game.updateVolcanoEruption(5.5);
  assert.equal(game.volcanoEruptionState.phase, "warning");
  assert.deepEqual(game.volcanoEruptionState.target, { x: 1150, y: 900 });
  game.player.x = 1150;
  game.updateVolcanoEruption(1.5);
  assert.deepEqual(damage, [{ amount: 20, source: { x: 1150, y: 900 } }]);
  game.updateVolcanoEruption(0.1);
  assert.equal(damage.length, 1);
});

test("the eruption clock pauses for interactions, portal travel, and death", () => {
  const game = eruptionHarness();
  game.updateVolcanoEruption(1);
  const state = game.volcanoEruptionState;

  game.isInteractionOpen = () => true;
  game.updateVolcanoEruption(20);
  assert.strictEqual(game.volcanoEruptionState, state);

  game.isInteractionOpen = () => false;
  game.portalTransition = { elapsed: 0 };
  game.updateVolcanoEruption(20);
  assert.strictEqual(game.volcanoEruptionState, state);

  game.portalTransition = null;
  game.player.respawnTimer = 2;
  game.updateVolcanoEruption(20);
  assert.strictEqual(game.volcanoEruptionState, state);
});

test("the hazard runs only in the observatory and caldera after the route and stops at the core", () => {
  const game = eruptionHarness();
  assert.equal(game.isVolcanoEruptionActive(), true);
  game.mapId = "volcano-core-caldera";
  assert.equal(game.isVolcanoEruptionActive(), true);
  game.mapId = "volcano-magma-route";
  assert.equal(game.isVolcanoEruptionActive(), false);
  game.mapId = "volcano-observatory";
  game.progress.worldProgress.chapters.volcano.coreFragmentObtained = true;
  assert.equal(game.isVolcanoEruptionActive(), false);
});

test("a retained eruption flag cannot activate the hazard after normalization rejects the route", () => {
  const game = eruptionHarness();
  game.progress.worldProgress = normalizeWorldProgress({
    chapters: {
      coast: { coreFragmentObtained: true },
      volcano: {
        coolantAnchorIds: ["ash-gate-coolant-anchor"],
        routeDecision: "rescue",
        eruptionTriggered: true,
      },
    },
  });

  assert.equal(game.progress.worldProgress.chapters.volcano.routeDecision, null);
  assert.equal(game.progress.worldProgress.chapters.volcano.eruptionTriggered, true);
  assert.equal(game.isVolcanoEruptionActive(), false);
});

test("the fixed game loop advances the local eruption adapter", () => {
  const game = eruptionHarness();
  let eruptionUpdates = 0;
  game.camera = { x: 0, y: 0, prevX: 0, prevY: 0 };
  game.basicCooldown = 0;
  game.strongCooldown = 0;
  game.portalCooldown = 0;
  game.attackState = null;
  game.projectiles = [];
  game.enemies = [];
  game.damageNumbers = [];
  game.hitEffects = [];
  game.explosionEffects = [];
  game.hitStopRemaining = 0;
  game.remotePlayers = new Map();
  game.updateAttack = () => {};
  game.updateProjectiles = () => {};
  game.applyEnemyEvents = () => {};
  game.updateBossController = () => {};
  game.updateCoopBossHud = () => {};
  game.applyEnemyContactDamage = () => {};
  game.updatePlayerMovement = () => {};
  game.tryEnterPortal = () => {};
  game.updateVolcanoEruption = () => { eruptionUpdates += 1; return []; };
  game.updateDamageNumbers = () => {};
  game.updateCamera = () => {};
  game.updateRemoteInterpolation = () => {};
  game.updateMessage = () => {};
  game.updateBiome = () => {};
  game.updateHud = () => {};
  game.updateNpcPrompt = () => {};
  game.network.publish = () => {};

  game.fixedUpdate(1 / 60);
  assert.equal(eruptionUpdates, 1);
});

function recordingCanvasContext() {
  const arcs = [];
  return new Proxy({ arcs }, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === "arc") return (...args) => arcs.push(args);
      if (property === "measureText") return text => ({ width: String(text).length * 6 });
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
}

test("the game render draws the eruption warning at its world target", () => {
  const game = eruptionHarness();
  game.ctx = recordingCanvasContext();
  game.worldLayer = { width: 1080, height: 900 };
  game.camera = { x: 0, y: 0, prevX: 0, prevY: 0 };
  game.hitEffects = [];
  game.projectiles = [];
  game.explosionEffects = [];
  game.remotePlayers = new Map();
  game.enemies = [];
  game.npcs = [];
  game.coopBossController = null;
  game.attackState = null;
  game.damageNumbers = [];
  game.chatMessages = [];
  game.renderMinimap = () => {};
  game.player = {
    ...game.player,
    prevX: game.player.x,
    prevY: game.player.y,
    moving: false,
    step: 0,
    classId: "warrior",
    equippedWeaponId: "starter-sword",
    name: "분화테스터",
    color: "#4f8e5b",
  };
  game.updateVolcanoEruption(5.5);

  const previousWidth = globalThis.innerWidth;
  const previousHeight = globalThis.innerHeight;
  globalThis.innerWidth = 800;
  globalThis.innerHeight = 600;
  try {
    game.render(0, 0);
  } finally {
    globalThis.innerWidth = previousWidth;
    globalThis.innerHeight = previousHeight;
  }
  assert.equal(game.ctx.arcs.some(([x, y, radius]) => x === 1150 && y === 900 && radius === 110), true);
});
