import test from 'node:test';
import assert from 'node:assert/strict';
import {getCoopBossForMap} from '../src/coop-boss-data-20260903-volcano-20260905-upgrade.js';
import {createBossEncounter,validateBossAttack} from '../src/coop-boss-state-20260903-volcano-20260905-upgrade.js';
import {attackDefinition} from '../src/combat-20260903-volcano-20260905-upgrade.js';
function fixture(classId='warrior',kind='skill-r') {
  const bossDefinition=getCoopBossForMap('forest');const encounter=createBossEncounter(bossDefinition,{encounterId:'e',now:0,partySize:1,authorityUid:'host'});
  const weaponId={warrior:'starter-sword',archer:'training-bow',mage:'training-staff'}[classId];const attack=attackDefinition(kind,classId,weaponId,10);
  const player={uid:'p',mapId:'forest',x:encounter.x-80,y:encounter.y,classId,equippedWeaponId:weaponId,level:10,mp:0};
  player.skillResources={[kind]:{castId:'c',mpBefore:attack.mpCost,mpAfter:0,originX:player.x,originY:player.y,direction:'right',createdAt:1000}};
  const request={uid:'p',mapId:'forest',encounterId:'e',bossId:encounter.bossId,sequence:1,classId,weaponId,attackKind:kind,castId:'c',hitIndex:0,playerX:player.x,playerY:player.y,direction:'right',createdAt:1200};
  return {request,validation:{encounter,bossDefinition,authenticatedUid:'p',player,now:1200}};
}
test('authority requires an exact bounded MP debit record for a paid skill',()=>{
  const f=fixture();assert.equal(validateBossAttack(f.request,f.validation).ok,true);
  f.validation.player.skillResources['skill-r'].mpAfter=32;
  assert.equal(validateBossAttack(f.request,f.validation).ok,false);
  delete f.validation.player.skillResources;f.validation.player.mp=100;
  assert.equal(validateBossAttack(f.request,f.validation).ok,false);
});
test('authority rejects attacks behind a forward slash and moving a multi-hit origin',()=>{
  const f=fixture();f.validation.encounter.x=f.validation.player.x-80;
  assert.equal(validateBossAttack(f.request,f.validation).ok,false);
  f.validation.encounter.x=f.validation.player.x+80;
  const first=validateBossAttack(f.request,f.validation);assert.equal(first.ok,true);
  f.validation.player.skillResources['skill-r'].originX+=10;
  assert.equal(validateBossAttack({...f.request,sequence:2,hitIndex:1},{...f.validation,lastCast:first.castState}).ok,false);
});
test('authority checks fixed area centers and each spread projectile direction',()=>{
  const area=fixture('mage','skill-r');area.validation.encounter.x=area.validation.player.x-50;
  assert.equal(validateBossAttack(area.request,area.validation).ok,false);
  area.validation.encounter.x=area.validation.player.x+210;
  assert.equal(validateBossAttack(area.request,area.validation).ok,true);
  const arrow=fixture('archer','skill-e');arrow.validation.encounter.x=arrow.validation.player.x+300;arrow.validation.encounter.y+=160;
  assert.equal(validateBossAttack({...arrow.request,hitIndex:1},arrow.validation).ok,false);
  arrow.validation.encounter.y=arrow.validation.player.y;
  assert.equal(validateBossAttack({...arrow.request,hitIndex:1},arrow.validation).ok,true);
});

import {createCoopBossController} from '../src/coop-boss-controller-20260903-volcano-20260905-upgrade.js';
test('authority retains an early skill hit until the matching presence arrives, then applies once',async()=>{
  const f=fixture('archer','skill-e');f.request.hitIndex=1;
  let acknowledged=0;const controller=createCoopBossController({uid:'host',wallNow:()=>1200,now:()=>1200,network:{publishState:async()=>{},acknowledgeAttack:async()=>{acknowledged++;}},simulate:enemies=>({enemies,events:[]})});
  controller.receiveSnapshot(f.validation.encounter);controller.mapId='forest';
  controller.players.set('p',{...f.validation.player,skillResources:{}});
  const before=controller.snapshot.hp;
  await controller.receiveAttackRequests({p:{1:f.request}});
  assert.equal(acknowledged,0);assert.equal(controller.snapshot.hp,before);
  controller.update(.01,{remotePlayers:new Map([['p',f.validation.player]])},1200);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(acknowledged,1);assert.ok(controller.snapshot.hp<before);
  const after=controller.snapshot.hp;controller.update(.01,{remotePlayers:new Map([['p',f.validation.player]])},1201);
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(controller.snapshot.hp,after);
  controller.clear();assert.equal(controller.deferredSkillAttacks.size,0);
});
test('unmatched deferred skill hits expire and are acknowledged without damage',async()=>{
  const f=fixture('archer','skill-e');let now=1200,acknowledged=0;
  const controller=createCoopBossController({uid:'host',wallNow:()=>now,now:()=>now,network:{publishState:async()=>{},acknowledgeAttack:async()=>{acknowledged++;}},simulate:enemies=>({enemies,events:[]})});
  controller.receiveSnapshot({...f.validation.encounter,leaseUntil:100000});controller.mapId='forest';
  await controller.receiveAttackRequests({p:{1:f.request}});assert.equal(acknowledged,0);
  now=7000;controller.update(.01,{},now);await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(acknowledged,1);assert.equal(controller.deferredSkillAttacks.size,0);assert.equal(controller.snapshot.hp,f.validation.encounter.hp);
});
test('a basic attack cannot overtake an earlier skill waiting for presence',async()=>{
  const f=fixture();const acknowledged=[];
  const controller=createCoopBossController({uid:'host',wallNow:()=>1200,now:()=>1200,network:{publishState:async()=>{},acknowledgeAttack:async(uid,seq)=>{acknowledged.push(seq);}},simulate:enemies=>({enemies,events:[]})});
  controller.receiveSnapshot(f.validation.encounter);controller.mapId='forest';controller.players.set('p',{...f.validation.player,skillResources:{}});
  const basic={...f.request,attackKind:'basic',sequence:2};delete basic.castId;delete basic.hitIndex;
  await controller.receiveAttackRequests({p:{1:f.request}});await controller.receiveAttackRequests({p:{1:f.request,2:basic}});
  assert.deepEqual(acknowledged,[]);assert.equal(controller.snapshot.hp,600);
  controller.update(.01,{remotePlayers:new Map([['p',f.validation.player]])},1200);await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(acknowledged,['1','2']);assert.equal(controller.snapshot.hp,553.8);
});
