import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260903-volcano-20260905-upgrade.js";
import { PixelRPG as SanctuaryPixelRPG } from "../src/game-20260903-volcano-20260905-upgrade-20260911-sanctuary.js";
import { createChorusEncounter } from "../src/sanctuary-chorus-state-20260911-sanctuary.js";

function node() {
  return { hidden: false, textContent: "", className: "", style: {}, classList: { add() {}, remove() {} } };
}

function fixture() {
  const game = Object.create(PixelRPG.prototype);
  game.sessionMode = "online";
  game.remotePlayers = new Map([["remote", { uid: "remote" }]]);
  game.chatMessages = [{ uid: "remote", text: "안녕" }];
  game.ui = {
    chatPanel: node(), onlinePresence: node(), networkBadge: node(),
    coopBossHud: node(), coopBossName: node(), coopBossHpBar: node(),
    coopBossHpText: node(), coopBossParticipants: node(), coopBossStatus: node(),
    playerCount: node(),
  };
  const modes = [];
  const rendered = [];
  game.chat = {
    setMode: (mode, label) => modes.push({ mode, label }),
    renderMessages: messages => rendered.push(messages),
  };
  return { game, modes, rendered };
}

test("솔로 세션은 원격 상태와 온라인 UI를 비운다", () => {
  const { game, modes, rendered } = fixture();
  const result = game.setSessionMode("solo", "selected");
  assert.deepEqual(result, { mode: "solo", reason: "selected" });
  assert.equal(game.sessionMode, "solo");
  assert.equal(game.remotePlayers.size, 0);
  assert.deepEqual(game.chatMessages, []);
  assert.equal(game.ui.chatPanel.hidden, true);
  assert.equal(game.ui.onlinePresence.hidden, true);
  assert.equal(game.ui.networkBadge.hidden, true);
  assert.equal(game.ui.coopBossHud.hidden, true);
  assert.equal(game.ui.playerCount.textContent, "1");
  assert.deepEqual(modes.at(-1), { mode: "offline", label: "솔로" });
  assert.deepEqual(rendered.at(-1), []);
});

test("온라인 세션은 온라인 전용 UI를 표시한다", () => {
  const { game } = fixture();
  game.setSessionMode("online", "selected");
  assert.equal(game.ui.chatPanel.hidden, false);
  assert.equal(game.ui.onlinePresence.hidden, false);
  assert.equal(game.ui.networkBadge.hidden, false);
});

test("연결 해제 fallback은 현재 플레이 상태를 유지하고 협동 보스를 새 로컬 보스로 교체한다", async () => {
  const { game } = fixture();
  let stops = 0;
  let clears = 0;
  const notices = [];
  const player = { x: 321, y: 654, hp: 77, mp: 42 };
  const progress = { level: 9, gold: 333 };
  game.player = player;
  game.progress = progress;
  game.sessionMode = "online";
  game.network = { stop: async () => { stops += 1; } };
  game.coopBossController = { clear: () => { clears += 1; } };
  const local = { setMap: async () => true, clear() {} };
  game.createLocalBossController = () => local;
  game.mapId = "forest";
  game.notify = text => notices.push(text);
  assert.equal(await game.fallbackToSolo("connection_lost"), true);
  assert.equal(await game.fallbackToSolo("connection_lost"), false);
  assert.equal(stops, 1);
  assert.equal(clears, 1);
  assert.equal(game.player, player);
  assert.equal(game.progress, progress);
  assert.equal(game.sessionMode, "solo");
  assert.equal(game.coopBossController, local);
  assert.match(notices[0], /솔로 모드로 전환/);
});

test("fallback immediately installs a fresh local boss even when network stop never settles", async () => {
  const { game } = fixture();
  const order = [];
  game.mapId = "forest";
  game.network = { stop: () => new Promise(() => {}) };
  game.coopBossController = { clear: () => order.push("clear-coop") };
  game.setSessionMode = mode => { order.push(`mode-${mode}`); game.sessionMode = mode; };
  const local = {
    snapshot: null,
    async setMap(mapId) {
      order.push(`local-${mapId}`);
      this.snapshot = { hp: 200, maxHp: 200 };
      return true;
    },
    clear() {},
  };
  game.createLocalBossController = () => local;
  game.updateCoopBossHud = () => {};
  game.notify = () => {};

  let settled = false;
  game.fallbackToSolo("connection_lost").then(value => { settled = value; });
  for (let turn = 0; turn < 4; turn += 1) await Promise.resolve();

  assert.equal(settled, true);
  assert.equal(game.sessionMode, "solo");
  assert.equal(game.coopBossController, local);
  assert.deepEqual(local.snapshot, { hp: 200, maxHp: 200 });
  assert.deepEqual(order, ["clear-coop", "mode-solo", "local-forest"]);
});

test("fallback contains a rejected best-effort network stop after the local mode transition", async () => {
  const { game } = fixture();
  game.mapId = "forest";
  game.network = { stop: async () => { throw new Error("offline"); } };
  game.coopBossController = { clear() {} };
  game.createLocalBossController = () => ({ snapshot: { hp: 200, maxHp: 200 }, async setMap() { return true; }, clear() {} });
  game.updateCoopBossHud = () => {};
  game.notify = () => {};

  await assert.doesNotReject(game.fallbackToSolo("connection_lost"));
  assert.equal(game.sessionMode, "solo");
  assert.deepEqual(game.coopBossController.snapshot, { hp: 200, maxHp: 200 });
});

test("살아 있는 협동 보스와 처치 후 재등장 시간을 HUD에 표시한다", () => {
  const { game } = fixture();
  game.mapId = "coast";
  game.updateCoopBossHud({
    status: "alive", bossId: "coast-core-shark", hp: 75, maxHp: 120,
    contributors: { a: {}, b: {} }, authorityUid: "host", leaseUntil: 7000,
    respawnAt: null,
  }, 1000);
  assert.equal(game.ui.coopBossHud.hidden, false);
  assert.equal(game.ui.coopBossName.textContent, "심해 코어 포식자");
  assert.equal(game.ui.coopBossHpText.textContent, "75 / 120");
  assert.equal(game.ui.coopBossParticipants.textContent, "참여 2명");
  assert.equal(game.ui.coopBossHpBar.style.transform, "scaleX(0.625)");

  game.updateCoopBossHud({
    status: "defeated", bossId: "coast-core-shark", hp: 0, maxHp: 120,
    contributors: {}, respawnAt: 181000,
  }, 1000);
  assert.match(game.ui.coopBossStatus.textContent, /3:00 후 재등장/);
});

test("현재 지역 원격 참가자 수를 협동 보스 생성 인원에 반영한다", async () => {
  const { game } = fixture();
  game.running = true;
  game.network = {};
  game.mapId = "coast";
  game.remotePlayers = new Map();
  let partySize = 0;
  let readyCalls = 0;
  let participants = [];
  game.network = { uid: "me", joinedAt: 500 };
  game.coopBossController = {
    setPartySize: value => { partySize = value; },
    setParticipants: value => { participants = value; },
    ensureReady: async () => { readyCalls += 1; },
  };
  game.receiveRemotePlayers(new Map([
    ["a", { x: 1, y: 1, hp: 100, mapId: "coast", classId: "warrior", equippedWeaponId: "starter-sword" }],
    ["b", { x: 2, y: 2, hp: 100, mapId: "coast", classId: "mage", equippedWeaponId: "training-staff" }],
  ]));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(partySize, 3);
  assert.deepEqual(participants.map(item => item.uid), ["me", "a", "b"]);
  assert.equal(readyCalls, 1);
});

test("online Chorus controller receives the dedicated network transport and authenticated uid", () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const chorus = { setMap: async () => true };
  game.network = { uid: "firebase-user", chorus };

  const controller = game.createChorusControllerForMode("online");

  assert.equal(controller.uid, "firebase-user");
  assert.equal(controller.mode, "online");
  assert.equal(controller.network, chorus);
  assert.equal(controller.seedSnapshot, null);
});

test("connection fallback seeds the local Chorus from the latest shared snapshot before clearing online state", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const latest = {
    ...createChorusEncounter({ encounterId: "shared-e1", authorityUid: "host", now: 1_000 }),
    stabilizedAnchorIds: ["forest"],
  };
  let cleared = 0;
  let capturedSeed = null;
  game.sessionMode = "online";
  game.network = { stop: async () => {}, chorus: { stop: async () => {} } };
  game.latestChorusSnapshot = latest;
  game.chorusController = {
    snapshot: latest,
    clear() {
      cleared += 1;
      this.snapshot = null;
    },
  };
  game.coopBossController = { clear() {} };
  game.createOfflineNetworkAdapter = undefined;
  game.replaceBossControllerForMode = async () => true;
  game.createChorusControllerForMode = (mode, options = {}) => {
    capturedSeed = options.seedSnapshot;
    return { mode, snapshot: options.seedSnapshot, setMap: () => options.seedSnapshot, clear() {} };
  };
  game.mapId = "sanctuary-return-record";
  game.progress = { worldProgress: { chapters: { sanctuary: { correctionLinked: true } } } };
  game.player = {};
  game.remotePlayers = new Map();
  game.chatMessages = [];
  game.ui = { playerCount: node(), coopBossHud: node() };
  game.chat = { setMode() {}, renderMessages() {} };
  game.notify = () => {};
  game.syncChorusMap = () => game.chorusController.setMap(game.mapId, { correctionLinked: true });

  assert.equal(await game.fallbackToSolo("connection_lost"), true);
  assert.equal(cleared, 1);
  assert.deepEqual(capturedSeed, latest);
  assert.notEqual(capturedSeed, latest);
  assert.equal(game.chorusController.snapshot.encounterId, "shared-e1");
  assert.equal(game.chorusController.network, undefined);
});

test("switching back online never seeds shared state from a solo-completed Chorus", () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const chorus = { setMap: async () => true };
  game.network = { uid: "firebase-user", chorus };
  game.chorusController = {
    snapshot: { encounterId: "solo-finished", status: "separated", hp: 0 },
  };

  const online = game.createChorusControllerForMode("online");

  assert.equal(online.seedSnapshot, null);
  assert.equal(online.snapshot, null);
  assert.equal(online.network, chorus);
});

test("authority keeps an applied action queued when publishing the resulting state fails", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const state = createChorusEncounter({ encounterId: "shared-e1", authorityUid: "host", now: 1_000 });
  const acknowledgements = [];
  game.sessionMode = "online";
  game.network = {
    uid: "host",
    chorus: {
      publishState: async () => ({ ok: false, reason: "authority_changed" }),
      acknowledgeAction: async (...args) => { acknowledgements.push(args); return { ok: true }; },
    },
  };
  game.chorusController = game.createChorusControllerForMode("online");
  game.chorusController.receiveSnapshot(state);
  game.chorusController.setMap("sanctuary-return-record", { correctionLinked: true });

  await game.receiveChorusActions({
    remote: {
      1: {
        id: "remote:1:1:anchor-stabilize",
        encounterId: "shared-e1",
        authorityEpoch: 1,
        phase: "anchors",
        uid: "remote",
        type: "anchor-stabilize",
        fragmentId: "forest",
        anchorId: "forest",
        createdAt: 1_100,
      },
    },
  });

  assert.deepEqual(game.chorusController.snapshot.stabilizedAnchorIds, ["forest"]);
  assert.deepEqual(acknowledgements, []);
});

test("a new authority applies actions that arrived before its transferred state snapshot", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const oldState = createChorusEncounter({
    encounterId: "shared-e1",
    authorityUid: "old-host",
    authorityEpoch: 2,
    now: 1_000,
  });
  const transferred = { ...oldState, authorityUid: "new-host", authorityEpoch: 3, leaseUntil: Date.now() + 5_000 };
  const acknowledgements = [];
  game.sessionMode = "online";
  game.mapId = "sanctuary-return-record";
  game.progress = { worldProgress: { chapters: { sanctuary: { correctionLinked: true } } } };
  game.ui = {};
  game.network = {
    uid: "new-host",
    chorus: {
      processedSequenceByUid: {},
      publishState: async snapshot => ({
        ok: true,
        encounter: structuredClone(snapshot),
        processedSequenceByUid: { remote: 1 },
      }),
      acknowledgeAction: async (...args) => { acknowledgements.push(args); return { ok: true }; },
    },
  };
  game.chorusController = game.createChorusControllerForMode("online");
  game.chorusController.receiveSnapshot(oldState);
  game.chorusController.setMap(game.mapId, { correctionLinked: true });
  game.updateChorusHud = () => {};
  const requests = {
    remote: {
      1: {
        id: "remote:3:1:anchor-stabilize",
        encounterId: "shared-e1",
        authorityEpoch: 3,
        phase: "anchors",
        uid: "remote",
        type: "anchor-stabilize",
        fragmentId: "forest",
        anchorId: "forest",
        createdAt: Date.now(),
      },
    },
  };

  assert.equal(await game.receiveChorusActions(requests), false);
  game.receiveChorusSnapshot(transferred);
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(game.chorusController.snapshot.stabilizedAnchorIds, ["forest"]);
  assert.deepEqual(acknowledgements, [["remote", 1, 3]]);
});

test("authority writes completion claims when a remote contributor separates the final bond", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const now = Date.now();
  const ready = {
    ...createChorusEncounter({ encounterId: "shared-e1", authorityUid: "host", now: now - 100 }),
    stabilizedAnchorIds: ["forest", "coast", "volcano"],
    resolvedTestimonyIds: [
      "core-self-division-original",
      "lumen-caused-core-division",
      "lumen-touched-seal-to-delay-eruption",
      "return-delay-was-lumen-alone",
      "first-archivist-deletion-protected-everyone",
      "resonance-time-was-incident-time",
    ],
    severedBondIds: ["roan", "sera", "garen"],
    activeRecordId: "lumen",
    vulnerableUntil: now + 3_000,
    contributors: {
      remote: { firstContributedAt: now - 50, lastContributedAt: now - 50, actionTypes: ["bond-cut"] },
    },
    updatedAt: now - 10,
  };
  const writes = [];
  game.sessionMode = "online";
  game.network = {
    uid: "host",
    chorus: {
      processedSequenceByUid: {},
      publishState: async snapshot => ({
        ok: true,
        encounter: structuredClone(snapshot),
        processedSequenceByUid: { remote: 9 },
      }),
      acknowledgeAction: async () => ({ ok: true }),
      writeCompletionClaims: async (...args) => { writes.push(args); return { ok: true }; },
    },
  };
  game.chorusController = game.createChorusControllerForMode("online");
  game.chorusController.receiveSnapshot(ready);
  game.chorusController.setMap("sanctuary-return-record", { correctionLinked: true });

  await game.receiveChorusActions({
    remote: {
      9: {
        id: "remote:1:9:bond-cut",
        encounterId: "shared-e1",
        authorityEpoch: 1,
        phase: "onslaught",
        uid: "remote",
        type: "bond-cut",
        bondId: "lumen",
        createdAt: now,
      },
    },
  });

  assert.equal(game.chorusController.snapshot.status, "separated");
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "shared-e1");
  assert.deepEqual(Object.keys(writes[0][1]), ["remote"]);
});

test("a failed publish never replaces the last Firebase-confirmed fallback seed with optimistic local state", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const confirmed = createChorusEncounter({ encounterId: "shared-e1", authorityUid: "host", now: 1_000 });
  game.sessionMode = "online";
  game.latestChorusSnapshot = structuredClone(confirmed);
  game.network = {
    uid: "host",
    chorus: {
      publishState: async () => ({ ok: false, reason: "authority_changed" }),
      acknowledgeAction: async () => ({ ok: true }),
    },
  };
  game.chorusController = game.createChorusControllerForMode("online");
  game.chorusController.receiveSnapshot(confirmed);
  game.chorusController.setMap("sanctuary-return-record", { correctionLinked: true });

  await game.receiveChorusActions({
    remote: {
      1: {
        id: "remote-action-1",
        encounterId: "shared-e1",
        authorityEpoch: 1,
        phase: "anchors",
        uid: "remote",
        type: "anchor-stabilize",
        fragmentId: "forest",
        anchorId: "forest",
        createdAt: 1_100,
      },
    },
  });

  assert.deepEqual(game.chorusController.snapshot.stabilizedAnchorIds, ["forest"]);
  assert.deepEqual(game.latestChorusSnapshot.stabilizedAnchorIds, []);
  assert.notEqual(game.latestChorusSnapshot, game.chorusController.snapshot);
});

test("a duplicate listener action is acknowledged only after its id exists in Firebase-confirmed state", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const actionId = "host-session-action-1";
  const confirmed = createChorusEncounter({ encounterId: "shared-e1", authorityUid: "host", now: 1_000 });
  const optimistic = { ...confirmed, processedActionIds: [actionId] };
  const acknowledgements = [];
  game.sessionMode = "online";
  game.latestChorusSnapshot = confirmed;
  const chorusNetwork = {
    processedSequenceByUid: {},
    publishState: async () => ({ ok: false, reason: "not_confirmed" }),
    acknowledgeAction: async (...args) => { acknowledgements.push(args); return { ok: true }; },
  };
  game.network = {
    uid: "host",
    chorus: chorusNetwork,
  };
  game.chorusController = game.createChorusControllerForMode("online");
  game.chorusController.receiveSnapshot(optimistic);
  game.chorusController.setMap("sanctuary-return-record", { correctionLinked: true });
  const requests = {
    host: {
      7: {
        id: actionId,
        encounterId: "shared-e1",
        authorityEpoch: 1,
        phase: "anchors",
        uid: "host",
        type: "fragment-strike",
        fragmentId: "forest",
        createdAt: 1_100,
      },
    },
  };

  await game.receiveChorusActions(requests);
  assert.deepEqual(acknowledgements, []);

  chorusNetwork.processedSequenceByUid = { host: 7 };
  await game.receiveChorusActions(requests);
  assert.deepEqual(acknowledgements, [["host", 7, 1]]);
});

test("same-time action results remain paired by action id before acknowledgement", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const state = createChorusEncounter({ encounterId: "shared-e1", authorityUid: "host", now: 1_000 });
  const acknowledgements = [];
  game.sessionMode = "online";
  game.latestChorusSnapshot = state;
  game.network = {
    uid: "host",
    chorus: {
      processedSequenceByUid: {},
      publishState: async snapshot => ({
        ok: true,
        encounter: structuredClone(snapshot),
        processedSequenceByUid: { b: 2 },
      }),
      acknowledgeAction: async (...args) => { acknowledgements.push(args); return { ok: true }; },
    },
  };
  game.chorusController = game.createChorusControllerForMode("online");
  game.chorusController.receiveSnapshot(state);
  game.chorusController.setMap("sanctuary-return-record", { correctionLinked: true });

  await game.receiveChorusActions({
    a: {
      1: {
        id: "z-wrong-action",
        encounterId: "shared-e1",
        authorityEpoch: 1,
        phase: "anchors",
        uid: "a",
        type: "anchor-stabilize",
        fragmentId: "forest",
        anchorId: "coast",
        createdAt: 1_100,
      },
    },
    b: {
      2: {
        id: "a-valid-action",
        encounterId: "shared-e1",
        authorityEpoch: 1,
        phase: "anchors",
        uid: "b",
        type: "anchor-stabilize",
        fragmentId: "forest",
        anchorId: "forest",
        createdAt: 1_100,
      },
    },
  });

  assert.deepEqual(acknowledgements, [["b", 2, 1]]);
});

test("an authority publishes at most one applied action per combat revision", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const state = createChorusEncounter({ encounterId: "shared-e1", authorityUid: "host", now: 1_000 });
  const publishCalls = [];
  const acknowledgements = [];
  game.sessionMode = "online";
  game.latestChorusSnapshot = state;
  game.network = {
    uid: "host",
    chorus: {
      processedSequenceByUid: {},
      publishState: async (...args) => {
        publishCalls.push(args);
        const processedAction = args[1].processedAction;
        return {
          ok: true,
          encounter: structuredClone(args[0]),
          processedSequenceByUid: { [processedAction.uid]: processedAction.sequence },
        };
      },
      acknowledgeAction: async (...args) => { acknowledgements.push(args); return { ok: true }; },
    },
  };
  game.chorusController = game.createChorusControllerForMode("online");
  game.chorusController.receiveSnapshot(state);
  game.chorusController.setMap("sanctuary-return-record", { correctionLinked: true });
  const first = {
    id: "a-session:1:1:fragment-strike",
    encounterId: "shared-e1",
    authorityEpoch: 1,
    phase: "anchors",
    uid: "a",
    sequence: 1,
    type: "fragment-strike",
    fragmentId: "forest",
    createdAt: 1_100,
  };
  const second = {
    ...first,
    id: "b-session:1:1:fragment-strike",
    uid: "b",
    fragmentId: "coast",
    createdAt: 1_200,
  };

  await game.receiveChorusActions({ a: { 1: first }, b: { 1: second } });

  assert.equal(publishCalls.length, 1);
  assert.equal(publishCalls[0][0].combatRevision, 1);
  assert.deepEqual(publishCalls[0][0].processedActionIds, [first.id]);
  assert.deepEqual(publishCalls[0][1], { processedAction: first });
  assert.deepEqual(acknowledgements, [["a", 1, 1]]);
});

test("authority couples the applied Firebase action sequence to its state publish", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const state = createChorusEncounter({ encounterId: "shared-e1", authorityUid: "host", now: 1_000 });
  const publishCalls = [];
  const acknowledgements = [];
  game.sessionMode = "online";
  game.latestChorusSnapshot = state;
  game.network = {
    uid: "host",
    chorus: {
      processedSequenceByUid: {},
      publishState: async (...args) => {
        publishCalls.push(args);
        return {
          ok: true,
          encounter: structuredClone(args[0]),
          processedSequenceByUid: { remote: 987 },
        };
      },
      acknowledgeAction: async (...args) => { acknowledgements.push(args); return { ok: true }; },
    },
  };
  game.chorusController = game.createChorusControllerForMode("online");
  game.chorusController.receiveSnapshot(state);
  game.chorusController.setMap("sanctuary-return-record", { correctionLinked: true });
  const action = {
    id: "remote-session:1:987:fragment-strike",
    encounterId: "shared-e1",
    authorityEpoch: 1,
    phase: "anchors",
    uid: "remote",
    sequence: 987,
    type: "fragment-strike",
    fragmentId: "forest",
    createdAt: 1_100,
  };

  await game.receiveChorusActions({ remote: { 987: action } });

  assert.equal(publishCalls.length, 1);
  assert.deepEqual(publishCalls[0][1], { processedAction: action });
  assert.deepEqual(acknowledgements, [["remote", 987, 1]]);
});

test("local authority waits for the allocated Firebase sequence before publishing", async () => {
  const game = Object.create(SanctuaryPixelRPG.prototype);
  const state = createChorusEncounter({ encounterId: "shared-e1", authorityUid: "host", now: 1_000 });
  const events = [];
  const publishCalls = [];
  game.sessionMode = "online";
  game.latestChorusSnapshot = state;
  game.lastPublishedChorusSignature = null;
  game.reportBossCallbackError = error => { throw error; };
  game.network = {
    uid: "host",
    chorus: {
      processedSequenceByUid: {},
      sendAction: async request => {
        events.push("send");
        return { ok: true, action: { ...request, sequence: 321 } };
      },
      publishState: async (...args) => {
        events.push("publish");
        publishCalls.push(args);
        return {
          ok: true,
          encounter: structuredClone(args[0]),
          processedSequenceByUid: { host: 321 },
        };
      },
    },
  };
  game.chorusController = game.createChorusControllerForMode("online");
  game.wireOnlineChorusController(game.chorusController);
  game.chorusController.receiveSnapshot(state);
  game.chorusController.setMap("sanctuary-return-record", { correctionLinked: true });

  const result = await game.chorusController.requestAttack({
    targetId: "unnamed-chorus",
    attackKind: "basic",
    fragmentId: "forest",
  }, 1_100);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(result.ok, true);
  assert.deepEqual(events, ["send", "publish"]);
  assert.equal(publishCalls.length, 1);
  assert.equal(publishCalls[0][1].processedAction.sequence, 321);
  assert.equal(publishCalls[0][1].processedAction.uid, "host");
  assert.equal(publishCalls[0][0].processedActionIds.includes(
    publishCalls[0][1].processedAction.id,
  ), true);
});
