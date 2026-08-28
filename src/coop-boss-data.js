export const BOSS_STATE_SEND_HZ = 2;
export const AUTHORITY_LEASE_MS = 6_000;
export const AUTHORITY_RENEW_MS = 2_000;
export const BOSS_RESPAWN_MS = 180_000;
export const REWARD_RETENTION_MS = 86_400_000;

const BOSSES = Object.freeze({
  coast: Object.freeze({
    id: "coast-core-shark", mapId: "coast", name: "심해 코어 포식자",
    enemyKind: "pirate-shark", x: 2160, y: 2400,
    baseHp: 120, rewardExp: 150, rewardGold: 100,
  }),
  volcano: Object.freeze({
    id: "volcano-core-imp", mapId: "volcano", name: "화염 코어 군주",
    enemyKind: "flame-imp", x: 2160, y: 1500,
    baseHp: 160, rewardExp: 220, rewardGold: 150,
  }),
  forest: Object.freeze({
    id: "forest-core-troll", mapId: "forest", name: "고대 코어 수호자",
    enemyKind: "moss-troll", x: 2160, y: 1400,
    baseHp: 200, rewardExp: 300, rewardGold: 200,
  }),
});

export const COOP_BOSS_MAP_IDS = Object.freeze(Object.keys(BOSSES));

export function getCoopBossForMap(mapId) {
  return typeof mapId === "string" && Object.hasOwn(BOSSES, mapId) ? BOSSES[mapId] : null;
}

export function getCoopBossById(bossId) {
  return Object.values(BOSSES).find(definition => definition.id === bossId) || null;
}

export function scaledBossMaxHp(baseHp, partySize) {
  const hp = Number.isFinite(baseHp) ? Math.max(1, baseHp) : 1;
  const size = Math.max(1, Math.min(10, Math.trunc(Number(partySize) || 1)));
  return Math.round(hp * (1 + 0.55 * (size - 1)));
}

export function bossRespawnAt(defeatedAt) {
  return (Number.isFinite(defeatedAt) ? defeatedAt : 0) + BOSS_RESPAWN_MS;
}
