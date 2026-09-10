const fs = require('node:fs');
const path = 'database.rules.json';
const rules = JSON.parse(fs.readFileSync(path, 'utf8'));
const room = rules.rules.rooms.$roomId;
const newMaps = [
  'sanctuary-resonance-hall',
  'sanctuary-origin-archive',
  'sanctuary-zero-boundary',
  'sanctuary-core-heart',
];

function addPlayerMap(expression, mapId) {
  if (expression.includes(`=== '${mapId}'`)) return expression;
  return expression.replaceAll(
    "newData.child('mapId').val() === 'sanctuary'",
    `newData.child('mapId').val() === 'sanctuary' || newData.child('mapId').val() === '${mapId}'`,
  );
}

let playerRule = room.players.$uid['.validate'];
for (const mapId of newMaps) playerRule = addPlayerMap(playerRule, mapId);
room.players.$uid['.validate'] = playerRule;

let chatMapRule = room.chat.$uid.$messageId.mapId['.validate'];
for (const mapId of newMaps) {
  if (!chatMapRule.includes(`=== '${mapId}'`)) {
    chatMapRule = chatMapRule.replace(
      "newData.val() === 'sanctuary'",
      `newData.val() === 'sanctuary' || newData.val() === '${mapId}'`,
    );
  }
}
room.chat.$uid.$messageId.mapId['.validate'] = chatMapRule;

const bosses = room.bosses.$mapId;
if (!bosses['.read'].includes('sanctuary-core-heart')) {
  bosses['.read'] = bosses['.read'].replace(
    "$mapId === 'forest')",
    "$mapId === 'forest' || $mapId === 'sanctuary-core-heart')",
  );
}

const bossIdOld = "($mapId === 'forest' && newData.child('bossId').val() === 'forest-core-troll'))";
const bossIdNew = "($mapId === 'forest' && newData.child('bossId').val() === 'forest-core-troll') || ($mapId === 'sanctuary-core-heart' && newData.child('bossId').val() === 'origin-zero'))";
const smallBoundsOld = "($mapId === 'coast-tide-core-cave' || $mapId === 'volcano-core-caldera')";
const smallBoundsNew = "($mapId === 'coast-tide-core-cave' || $mapId === 'volcano-core-caldera' || $mapId === 'sanctuary-core-heart')";

let stateRule = bosses.state['.validate'];
if (!stateRule.includes("origin-zero")) stateRule = stateRule.replace(bossIdOld, bossIdNew);
if (!stateRule.includes("$mapId === 'sanctuary-core-heart') && newData.child('x').val() <= 2160")) {
  stateRule = stateRule.replace(smallBoundsOld, smallBoundsNew);
}
if (!stateRule.includes("newData.child('originPhase')")) {
  stateRule += " && ($mapId !== 'sanctuary-core-heart' || (newData.hasChildren(['originPhase','rewriteCycle','completionClaimWritten']) && (newData.child('originPhase').val() === 'life' || newData.child('originPhase').val() === 'memory' || newData.child('originPhase').val() === 'energy' || newData.child('originPhase').val() === 'rewrite')))";
}
bosses.state['.validate'] = stateRule;

bosses.state.originPhase = {
  '.validate': "$mapId !== 'sanctuary-core-heart' || (newData.val() === 'life' || newData.val() === 'memory' || newData.val() === 'energy' || newData.val() === 'rewrite')",
};
bosses.state.anchors = {
  '$anchorId': {
    '.validate': "($anchorId === 'origin-anchor-life' || $anchorId === 'origin-anchor-memory' || $anchorId === 'origin-anchor-energy') && newData.hasChildren(['active','hp','maxHp','x','y']) && (newData.child('active').val() === true || newData.child('active').val() === false) && newData.child('hp').isNumber() && newData.child('hp').val() >= 0 && newData.child('maxHp').isNumber() && newData.child('maxHp').val() > 0 && newData.child('hp').val() <= newData.child('maxHp').val() && newData.child('x').isNumber() && newData.child('x').val() >= 0 && newData.child('x').val() <= 2160 && newData.child('y').isNumber() && newData.child('y').val() >= 0 && newData.child('y').val() <= 1800",
  },
};
bosses.state.rewriteCycle = {
  '.validate': "$mapId !== 'sanctuary-core-heart' || (newData.hasChildren(['phase','elapsed','sequence']) && (newData.child('phase').val() === 'idle' || newData.child('phase').val() === 'warning' || newData.child('phase').val() === 'impact' || newData.child('phase').val() === 'recovery') && newData.child('elapsed').isNumber() && newData.child('elapsed').val() >= 0 && newData.child('sequence').isNumber() && newData.child('sequence').val() >= 0 && newData.child('sequence').val() % 1 === 0)",
};
bosses.state.completionClaimWritten = {
  '.validate': "$mapId !== 'sanctuary-core-heart' || newData.val() === true || newData.val() === false",
};

let attackRule = bosses.attacks.$uid.$sequence['.validate'];
if (!attackRule.includes("origin-zero")) attackRule = attackRule.replace(bossIdOld, bossIdNew);
attackRule = attackRule.replace(smallBoundsOld, smallBoundsNew);
bosses.attacks.$uid.$sequence['.validate'] = attackRule;

let claimRule = bosses.rewardClaims.$encounterId.$uid['.validate'];
if (!claimRule.includes("origin-zero")) {
  claimRule = claimRule.replace(
    "($mapId === 'forest' && newData.child('bossId').val() === 'forest-core-troll' && newData.child('exp').val() === 300 && newData.child('gold').val() === 200))",
    "($mapId === 'forest' && newData.child('bossId').val() === 'forest-core-troll' && newData.child('exp').val() === 300 && newData.child('gold').val() === 200) || ($mapId === 'sanctuary-core-heart' && newData.child('bossId').val() === 'origin-zero' && newData.child('exp').val() === 0 && newData.child('gold').val() === 0))",
  );
}
bosses.rewardClaims.$encounterId.$uid['.validate'] = claimRule;

fs.writeFileSync(path, `${JSON.stringify(rules, null, 2)}\n`);
