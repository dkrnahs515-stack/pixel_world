import test from "node:test";
import assert from "node:assert/strict";
import { createPublishPolicyState, nextPublishDecision } from "../src/network-publish-policy-20260905-upgrade.js";

const moving = { x: 100, y: 100, dir: "right", moving: true, mapId: "coast", classId: "archer", equippedWeaponId: "training-bow" };

test("이동 위치는 500ms마다 전송한다", () => {
  let result = nextPublishDecision(createPublishPolicyState(), moving, 0, true);
  assert.equal(result.shouldPublish, true);
  assert.equal(nextPublishDecision(result.policy, { ...moving, x: 120 }, 499, true).shouldPublish, false);
  assert.equal(nextPublishDecision(result.policy, { ...moving, x: 130 }, 500, true).shouldPublish, true);
});

test("정지·방향·맵·직업·장비 변화는 즉시 전송한다", () => {
  const first = nextPublishDecision(createPublishPolicyState(), moving, 0, true);
  for (const snapshot of [
    { ...moving, moving: false },
    { ...moving, dir: "up" },
    { ...moving, mapId: "forest" },
    { ...moving, classId: "mage", equippedWeaponId: "training-staff" },
    { ...moving, equippedWeaponId: "hunter-bow" },
  ]) {
    assert.equal(nextPublishDecision(first.policy, snapshot, 10, true).shouldPublish, true);
  }
});

test("정지는 30초 heartbeat만 보내고 숨김 문서는 보내지 않는다", () => {
  const idle = { ...moving, moving: false };
  const first = nextPublishDecision(createPublishPolicyState(), idle, 0, true);
  assert.equal(nextPublishDecision(first.policy, idle, 29999, true).shouldPublish, false);
  assert.equal(nextPublishDecision(first.policy, idle, 30000, true).shouldPublish, true);
  assert.equal(nextPublishDecision(first.policy, idle, 60000, false).shouldPublish, false);
});
