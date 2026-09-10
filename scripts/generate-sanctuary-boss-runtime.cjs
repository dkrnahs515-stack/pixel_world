const fs = require('node:fs');

function copyWithReplacements(source, target, replacements) {
  let text = fs.readFileSync(source, 'utf8');
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`missing replacement source in ${source}: ${from}`);
    text = text.replaceAll(from, to);
  }
  fs.writeFileSync(target, text);
}

copyWithReplacements(
  'src/enemies-20260829-coast-20260905-upgrade.js',
  'src/enemies-20260910-sanctuary.js',
  [
    ['./world-data-20260829-coast-20260905-upgrade.js', './world-data-20260910-sanctuary.js'],
    ['./enemy-definitions-20260905-upgrade.js', './enemy-definitions-20260910-sanctuary.js'],
    ['./enemy-behaviors-20260905-upgrade.js', './enemy-behaviors-20260910-sanctuary.js'],
  ],
);

let controller = fs.readFileSync('src/coop-boss-controller-20260903-volcano-20260905-upgrade.js', 'utf8');
controller = controller
  .replaceAll('./coop-boss-data-20260903-volcano-20260905-upgrade.js', './coop-boss-data-20260910-sanctuary.js')
  .replaceAll('./coop-boss-state-20260903-volcano-20260905-upgrade.js', './coop-boss-state-20260910-sanctuary.js')
  .replaceAll('./enemies-20260829-coast-20260905-upgrade.js', './enemies-20260910-sanctuary.js');
controller = controller.replace(
  'import { createBossEnemyView, createEnemyContactDamageEvents, drawEnemy, updateEnemies } from "./enemies-20260910-sanctuary.js";\n',
  'import { createBossEnemyView, createEnemyContactDamageEvents, drawEnemy, updateEnemies } from "./enemies-20260910-sanctuary.js";\nimport { advanceOriginAuthorityState } from "./origin-boss-controller-20260910-sanctuary.js";\n',
);

const needle = '    this.players = new Map(activePlayers.map(player => [player.uid, player]));\n    this.replayDeferredSkillAttacks();\n    const target = selectBossTarget(this.view, activePlayers, this.mapId);\n';
if (!controller.includes(needle)) throw new Error('controller insertion point not found');
const replacement = `    this.players = new Map(activePlayers.map(player => [player.uid, player]));
    this.replayDeferredSkillAttacks();

    if (getCoopBossForMap(this.mapId)?.bossClass === "final") {
      const result = advanceOriginAuthorityState(this.snapshot, dt, {
        now: this.wallNow(),
        rng: context.random || Math.random,
        arena: { width: 2160, height: 1800 },
        players: activePlayers,
      });
      this.snapshot = result.encounter;
      if (this.view) {
        this.view.prevX = this.view.x;
        this.view.prevY = this.view.y;
        this.view.x = this.snapshot.x;
        this.view.y = this.snapshot.y;
        this.view.hp = this.snapshot.hp;
        this.view.maxHp = this.snapshot.maxHp;
        this.view.targetable = this.snapshot.status === "alive";
      }
      const events = [];
      for (const event of result.events || []) {
        const isDamage = event && event.targetUid && event.damage > 0
          && ["origin-player-damage", "origin-projectile", "origin-eruption", "rewrite-impact"].includes(event.type);
        if (isDamage) {
          const playerDamage = createBossPlayerDamageEvent({
            encounter: this.snapshot,
            targetUid: event.targetUid,
            damage: event.damage,
            sequence: ++this.playerDamageSequence,
            now: this.wallNow(),
          });
          if (playerDamage) this.network?.sendPlayerDamage?.(event.targetUid, playerDamage).catch?.(() => {});
        }
        this.pendingEvents.push(event);
        events.push(event);
      }
      const interval = 1000 / BOSS_STATE_SEND_HZ;
      if (this.lastPublishedAt === null || timestamp - this.lastPublishedAt >= interval) {
        this.lastPublishedAt = timestamp;
        this.network?.publishState?.(this.snapshot).catch?.(() => {});
      }
      return events;
    }

    const target = selectBossTarget(this.view, activePlayers, this.mapId);
`;
controller = controller.replace(needle, replacement);
fs.writeFileSync('src/coop-boss-controller-20260910-sanctuary.js', controller);
