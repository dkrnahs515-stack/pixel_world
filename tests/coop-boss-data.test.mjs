import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORITY_LEASE_MS, BOSS_RESPAWN_MS, REWARD_RETENTION_MS,
  COOP_BOSS_MAP_IDS, bossRespawnAt, getCoopBossForMap, scaledBossMaxHp,
} from "../src/coop-boss-data-20260903-volcano.js";
import { createBossEnemyView } from "../src/enemies-20260829-coast.js";
import { isWorldPositionBlocked } from "../src/world-20260903-volcano.js";
import { getWorldDefinition } from "../src/world-data-20260903-volcano.js";

test("활화산 레거시 bossId는 화구 코어 제단에서만 유지된다", () => {
  assert.deepEqual(getCoopBossForMap("coast-tide-core-cave"), {
    id: "coast-core-shark", mapId: "coast-tide-core-cave", name: "심해 코어 포식자",
    enemyKind: "pirate-shark", x: 1600, y: 1280,
    baseHp: 120, rewardExp: 150, rewardGold: 100,
  });
  assert.deepEqual(getCoopBossForMap("volcano-core-caldera"), {
    id: "volcano-core-imp", mapId: "volcano-core-caldera", name: "오염된 선발대장",
    enemyKind: "flame-imp", x: 1560, y: 780,
    baseHp: 160, rewardExp: 220, rewardGold: 150,
  });
  assert.deepEqual(getCoopBossForMap("forest"), {
    id: "forest-core-troll", mapId: "forest", name: "고대 코어 수호자",
    enemyKind: "moss-troll", x: 2160, y: 1400,
    baseHp: 200, rewardExp: 300, rewardGold: 200,
  });
  assert.deepEqual(COOP_BOSS_MAP_IDS, ["coast-tide-core-cave", "volcano-core-caldera", "forest"]);
  assert.equal(getCoopBossForMap("volcano"), null);
  assert.equal(getCoopBossForMap("coast"), null);
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

test("regional boss spawns remain inside their physical map and traversable at runtime collision radius", () => {
  for (const mapId of COOP_BOSS_MAP_IDS) {
    const boss = getCoopBossForMap(mapId);
    const world = getWorldDefinition(mapId);
    const view = createBossEnemyView(boss, { ...boss, hp: boss.baseHp, maxHp: boss.baseHp, status: "alive" });
    const radius = Math.max(14, view.radius);

    assert.ok(boss.x >= radius && boss.x <= world.width - radius, `${mapId} boss must fit horizontally`);
    assert.ok(boss.y >= radius && boss.y <= world.height - radius, `${mapId} boss must fit vertically`);
    assert.equal(isWorldPositionBlocked(mapId, boss.x, boss.y, radius), false, `${mapId} boss must be traversable`);
  }
});
