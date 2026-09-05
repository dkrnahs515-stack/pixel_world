import test from "node:test";
import assert from "node:assert/strict";
import { createPublishPolicyState, nextPublishDecision } from "../src/network-publish-policy-20260905-upgrade.js";
import { createCoopBossController } from "../src/coop-boss-controller-20260902-lease.js";
import { createBossEncounter } from "../src/coop-boss-state-20260829-coast.js";
import { getCoopBossForMap } from "../src/coop-boss-data-20260829-coast.js";

function countPlayerWrites({ moving }) {
  let total = 0;
  for (let playerIndex = 0; playerIndex < 10; playerIndex += 1) {
    let policy = createPublishPolicyState();
    for (let now = 0; now < 60_000; now += 100) {
      const result = nextPublishDecision(policy, {
        x: now / 10, y: playerIndex, hp: 100, dir: "right", moving,
        mapId: "coast", classId: "archer", equippedWeaponId: "training-bow",
      }, now, true);
      policy = result.policy;
      if (result.shouldPublish) total += 1;
    }
  }
  return total;
}

test("10명이 60초 이동해도 플레이어 위치 쓰기는 2Hz 상한을 지킨다", () => {
  assert.equal(countPlayerWrites({ moving: true }), 1200);
});

test("10명이 60초 정지하면 heartbeat는 합계 20회를 넘지 않는다", () => {
  assert.equal(countPlayerWrites({ moving: false }), 20);
});

test("관리자 보스 상태는 60초 동안 2Hz인 120회만 게시한다", () => {
  let writes = 0;
  const controller = createCoopBossController({
    uid: "host",
    network: { publishState: async () => { writes += 1; } },
    simulate: enemies => ({ enemies, events: [] }),
    wallNow: () => 0,
  });
  controller.receiveSnapshot(createBossEncounter(getCoopBossForMap("coast-tide-core-cave"), {
    encounterId: "load", partySize: 10, now: 0, authorityUid: "host", authorityEpoch: 1,
  }));
  const remotePlayers = new Map(Array.from({ length: 9 }, (_, index) => [`p${index}`, {
    uid: `p${index}`, x: 1540 + index, y: 1280, hp: 100, mapId: "coast-tide-core-cave",
  }]));
  for (let frame = 0; frame < 60 * 60; frame += 1) {
    controller.update(1 / 60, {
      player: { uid: "host", x: 1540, y: 1280, hp: 100, mapId: "coast-tide-core-cave" },
      remotePlayers,
      isBlocked: () => false,
    }, frame * (1000 / 60));
  }
  assert.equal(writes, 120);
});
