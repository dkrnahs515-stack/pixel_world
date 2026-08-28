import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORITY_LEASE_MS, BOSS_RESPAWN_MS, REWARD_RETENTION_MS,
  bossRespawnAt, getCoopBossForMap, scaledBossMaxHp,
} from "../src/coop-boss-data.js";

test("세 전투 지역은 확정 협동 보스를 하나씩 제공한다", () => {
  assert.deepEqual(getCoopBossForMap("coast"), {
    id: "coast-core-shark", mapId: "coast", name: "심해 코어 포식자",
    enemyKind: "pirate-shark", x: 2160, y: 2400,
    baseHp: 120, rewardExp: 150, rewardGold: 100,
  });
  assert.deepEqual(getCoopBossForMap("volcano"), {
    id: "volcano-core-imp", mapId: "volcano", name: "화염 코어 군주",
    enemyKind: "flame-imp", x: 2160, y: 1500,
    baseHp: 160, rewardExp: 220, rewardGold: 150,
  });
  assert.deepEqual(getCoopBossForMap("forest"), {
    id: "forest-core-troll", mapId: "forest", name: "고대 코어 수호자",
    enemyKind: "moss-troll", x: 2160, y: 1400,
    baseHp: 200, rewardExp: 300, rewardGold: 200,
  });
  assert.equal(getCoopBossForMap("village"), null);
});

test("보스 HP는 1~10명에서 고정 배율을 쓰고 재등장은 정확히 3분이다", () => {
  assert.equal(scaledBossMaxHp(120, 1), 120);
  assert.equal(scaledBossMaxHp(120, 3), 252);
  assert.equal(scaledBossMaxHp(120, 10), 714);
  assert.equal(scaledBossMaxHp(120, 99), 714);
  assert.equal(bossRespawnAt(1000), 181000);
  assert.equal(AUTHORITY_LEASE_MS, 6000);
  assert.equal(BOSS_RESPAWN_MS, 180000);
  assert.equal(REWARD_RETENTION_MS, 86400000);
});
