import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game-20260828-coop.js";

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

test("연결 해제 fallback은 현재 플레이 상태를 유지하고 온라인 자원만 한 번 정리한다", async () => {
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
  game.notify = text => notices.push(text);
  assert.equal(await game.fallbackToSolo("connection_lost"), true);
  assert.equal(await game.fallbackToSolo("connection_lost"), false);
  assert.equal(stops, 1);
  assert.equal(clears, 1);
  assert.equal(game.player, player);
  assert.equal(game.progress, progress);
  assert.equal(game.sessionMode, "solo");
  assert.match(notices[0], /솔로 모드로 전환/);
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
