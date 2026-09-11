import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260910-sanctuary.js";
import { LocalBossController } from "../src/local-boss-controller-20260910-sanctuary.js";
import { getCoopBossForMap } from "../src/coop-boss-data-20260910-sanctuary.js";
import { ORIGIN_ANCHOR_IDS } from "../src/origin-boss-state-20260910-sanctuary.js";
import { createInitialProgress } from "../src/quest-state-20260910-sanctuary.js";
import { originReadyProgress, originDefeatedProgress } from "./helpers/sanctuary-fixtures.mjs";

// These are release gates for existing production adapters, not replacements for
// browser journeys. Fixtures arrange a checkpoint; they never inject a successful
// combat result or call a recovery helper on behalf of an ordinary player.
const MAP = "sanctuary-core-heart";

function playerAt(x, y) {
  return {
    uid: "local-player", name: "release-review", mapId: MAP,
    x, y, prevX: x, prevY: y, hp: 120, maxHp: 120,
    mp: 80, maxMp: 80, classId: "warrior", dir: "up",
    moving: false, respawnTimer: 0,
  };
}

function gameAtCore(worldProgress) {
  const definition = getCoopBossForMap(MAP);
  const game = Object.create(PixelRPG.prototype);
  game.mapId = MAP;
  game.progress = { ...createInitialProgress(), introSeen: true, worldProgress };
  game.player = playerAt(definition.x, definition.y + 40);
  game.running = true;
  game.inputEnabled = true;
  game.chatInputActive = false;
  game.portalTransition = null;
  game.keys = new Set();
  game.npcs = [];
  game.nearbyNpc = null;
  game.nearbyStoryInteraction = null;
  game.ui = { npcPrompt: { hidden: true }, npcPromptText: { textContent: "" } };
  // The test substitutes DOM drawing only. Production interaction routing,
  // progression, persistence ordering and reward transitions remain unchanged.
  game.isInteractionOpen = () => false;
  game.setInputEnabled = enabled => { game.inputEnabled = enabled; game.keys.clear(); };
  game.notify = () => {};
  game.updateProgressHud = () => {};
  game.updateChapterUi = () => {};
  return game;
}

async function localOrigin() {
  const controller = new LocalBossController({
    now: () => 10_000, wallNow: () => 10_000, sessionId: "release-review",
  });
  assert.equal(await controller.setMap(MAP), true);
  return controller;
}

test("release gate: live rewrite anchors are reachable by the normal player attack target adapter", async () => {
  const controller = await localOrigin();
  controller.snapshot = { ...controller.snapshot, hp: controller.snapshot.maxHp * 0.2 };
  controller.update(0.1, { player: playerAt(1000, 800) });
  const activeIds = Object.entries(controller.snapshot.anchors)
    .filter(([, anchor]) => anchor.active && anchor.hp > 0)
    .map(([id]) => id).sort();
  assert.deepEqual(activeIds, [...ORIGIN_ANCHOR_IDS].sort(), "checkpoint must really spawn the three anchors");

  const game = gameAtCore(originReadyProgress());
  game.coopBossController = controller;
  const targets = game.targetableBosses();
  const reachableIds = activeIds.filter(id => targets.some(target => target.id === id));
  assert.deepEqual(reachableIds, activeIds,
    "ORIGIN cannot remain invulnerable behind anchors that normal attacks cannot target");
});

test("release gate: the ordinary F interaction reopens a deferred final decision at the core", () => {
  const game = gameAtCore(originDefeatedProgress({ originRecordIds: [] }));
  let opened = 0;
  game.endingController = {
    active: false,
    openChoice() { opened += 1; return true; },
  };
  game.updateNpcPrompt();
  // openNpcInteraction is the production F-key route, unlike calling
  // openSanctuaryEndingChoice directly from a browser evaluation.
  const interacted = game.openNpcInteraction();
  assert.equal(interacted, true, "a returning player must be able to interact with the core without QA or console calls");
  assert.equal(opened, 1);
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, null);
});

test("release gate: leaving the telegraphed ORIGIN eruption avoids its damage", async () => {
  const controller = await localOrigin();
  controller.snapshot = { ...controller.snapshot, hp: controller.snapshot.maxHp * 0.4 };
  const warnedPlayer = playerAt(1080, 900);
  const warning = controller.update(0.1, { player: warnedPlayer });
  assert.equal(warning.some(event => event.type === "origin-telegraph"), true);
  controller.consumeEvents();

  const escapedPlayer = playerAt(64, 64);
  assert.ok(Math.hypot(escapedPlayer.x - warnedPlayer.x, escapedPlayer.y - warnedPlayer.y) > 1000);
  controller.update(0.75, { player: escapedPlayer });
  const hits = controller.consumeEvents().filter(event => event.type === "damage-player"
    && event.targetUid === escapedPlayer.uid);
  assert.deepEqual(hits, [], "damage must use the warned area and hit geometry, not just the selected player UID");
});

test("release gate: a durably saved ending remains viewable when the separate reward save fails", () => {
  const game = gameAtCore(originDefeatedProgress({ originRecordIds: [] }));
  const durable = [];
  const played = [];
  let writes = 0;
  game.persistProgress = () => {
    writes += 1;
    if (writes === 2) return false;
    durable.push(structuredClone(game.progress));
    return true;
  };
  game.endingController = { playEnding(script) { played.push(script); return true; } };
  game.confirmSanctuaryEnding("restore");
  assert.equal(writes, 2);
  assert.equal(durable[0].worldProgress.chapters.sanctuary.endingChoice, "restore");
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingChoice, "restore");
  assert.equal(game.progress.worldProgress.chapters.sanctuary.endingRewardClaimed, false);
  assert.equal(played.length, 1,
    "a failed second write must not strand the player behind an irrevocable choice with no cutscene/recovery UI");
});
