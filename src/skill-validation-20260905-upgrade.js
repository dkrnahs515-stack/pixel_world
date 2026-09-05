import { directionVector, isTargetInAttackArc } from './combat-20260903-volcano-20260905-upgrade.js';
import { getEnemyDefinition } from './enemy-definitions-20260905-upgrade.js';
import { isWorldPositionBlocked } from './world-20260903-volcano-20260905-upgrade.js';

export function normalizeSkillResource(value, maxMp) {
  if (!value || typeof value.castId !== 'string' || !value.castId || value.castId.length > 120
    || !['up','down','left','right'].includes(value.direction)
    || ![value.mpBefore,value.mpAfter,value.originX,value.originY,value.createdAt].every(Number.isFinite)
    || value.mpBefore < 0 || value.mpBefore > maxMp || value.mpAfter < 0 || value.mpAfter > maxMp
    || value.originX < 0 || value.originX > 4320 || value.originY < 0 || value.originY > 3600) return null;
  return {castId:value.castId,mpBefore:value.mpBefore,mpAfter:value.mpAfter,originX:value.originX,originY:value.originY,direction:value.direction,createdAt:value.createdAt};
}

export function isBossInSkillGeometry(resource, attack, hitIndex, encounter, definition) {
  const origin = {x:resource.originX,y:resource.originY};
  if (isWorldPositionBlocked(encounter.mapId, origin.x, origin.y, 14)) return false;
  const vector = directionVector(resource.direction);
  const radius = getEnemyDefinition(definition.enemyKind)?.radius || 24;
  // A small positional allowance accommodates the two-Hz shared boss snapshot.
  const target = {...encounter,radius:radius + 12};
  if (attack.radius) {
    return Math.hypot(encounter.x-origin.x-vector.x*attack.targetDistance,encounter.y-origin.y-vector.y*attack.targetDistance) <= attack.radius + target.radius;
  }
  if (!['spread','slow'].includes(attack.delivery)) return isTargetInAttackArc(origin,resource.direction,target,attack.range,attack.arcDegrees);
  const angle = attack.delivery === 'spread' ? (hitIndex-1)*0.22 : 0;
  const dx=vector.x*Math.cos(angle)-vector.y*Math.sin(angle),dy=vector.x*Math.sin(angle)+vector.y*Math.cos(angle);
  const startX=origin.x+vector.x*32,startY=origin.y+vector.y*32;
  const toX=encounter.x-startX,toY=encounter.y-startY;
  const along=toX*dx+toY*dy,across=Math.abs(toX*dy-toY*dx);
  if (along < -target.radius || along > attack.range+target.radius || across > target.radius+6) return false;
  // Stop the reconstructed ray at the boss's near edge, before any wall behind it.
  for (let distance=0;distance<Math.max(0,along-radius);distance+=8) {
    if (isWorldPositionBlocked(encounter.mapId,startX+dx*distance,startY+dy*distance,3)) return false;
  }
  return true;
}
