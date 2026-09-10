import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalBossController } from '../src/local-boss-controller-20260910-sanctuary.js';
import { CoopBossController } from '../src/coop-boss-controller-20260910-sanctuary.js';
import { acquireOriginAuthority, applyOriginAttack } from '../src/origin-boss-state-20260910-sanctuary.js';
import { advanceOriginAuthorityState } from '../src/origin-boss-controller-20260910-sanctuary.js';
const MAP='sanctuary-core-heart';
const player=(x=1080,y=900)=>({uid:'p',x,y,mapId:MAP,hp:100,classId:'warrior',level:10,equippedWeaponId:'starter-sword',dir:'up'});
async function setup(hp=240) {
 const c=new LocalBossController({wallNow:()=>10000,now:()=>10000,sessionId:'test'});
 await c.setMap(MAP); c.snapshot={...c.snapshot,hp}; c.update(.1,{player:player()}); c.consumeEvents(); return c;
}
test('active anchor receives geometry-validated local basic damage, not boss HP',async()=>{
 const c=await setup(); const id='origin-anchor-life';const a=c.snapshot.anchors[id]; const hp=c.snapshot.hp;
 const p=player(a.x,a.y+40);
 const hit=await c.requestHit({targetId:id,attackKind:'basic',classId:p.classId,weaponId:p.equippedWeaponId,player:p,direction:'up'});
 assert.equal(hit.ok,true);assert.ok(c.snapshot.anchors[id].hp<a.hp);assert.equal(c.snapshot.hp,hp);
});
test('invalid or far-away anchor request is rejected without mutation',async()=>{
 const c=await setup();const before=structuredClone(c.snapshot);
 for(const targetId of ['origin-anchor-life','forged-anchor']) {
 const p=player(64,64);
 const r=await c.requestHit({targetId,attackKind:'basic',classId:p.classId,weaponId:p.equippedWeaponId,player:p,direction:'up'});
 assert.equal(r.ok,false);assert.deepEqual(c.snapshot,before);
 }
});
test('one-shot boss damage cannot bypass the rewrite anchor phase',async()=>{
 const c=await setup(1200);
 const r=applyOriginAttack(c.snapshot,{ok:true,damage:100000,uid:'p'},10000);
 assert.equal(r.defeated,false);assert.equal(r.encounter.hp,1);assert.equal(Object.keys(r.encounter.anchors).length,3);
});
test('online request transmits target ID and authority applies only anchor damage',async()=>{
 const local=await setup();let sent;const c=new CoopBossController({uid:'p',wallNow:()=>10000,network:{sendAttack:async r=>(sent=r,{ok:true}),publishState:async()=>{},acknowledgeAttack:async()=>{}}});
 c.receiveSnapshot({...local.snapshot,authorityUid:'p',leaseUntil:16000});const a=c.snapshot.anchors['origin-anchor-life'];const p=player(a.x,a.y+40);c.players.set('p',p);
 await c.requestHit({targetId:'origin-anchor-life',attackKind:'basic',player:p,classId:p.classId,weaponId:p.equippedWeaponId,direction:'up'});
 assert.equal(sent.targetId,'origin-anchor-life');const hp=c.snapshot.hp;
 assert.equal(await c.receiveAttackRequests({p:{[sent.sequence]:sent}}),1);assert.ok(c.snapshot.anchors['origin-anchor-life'].hp<a.hp);assert.equal(c.snapshot.hp,hp);
});
test('staying in an eruption warning receives exactly one hit',async()=>{
 const c=await setup(480);c.update(.75,{player:player()});const hits=c.consumeEvents().filter(e=>e.type==='damage-player');assert.equal(hits.length,1);assert.equal(hits[0].amount,42);
 c.update(.1,{player:player()});assert.equal(c.consumeEvents().filter(e=>e.type==='damage-player').length,0);
});
test('latched warning position survives authority handoff and cannot chase the player',async()=>{
 const c=await setup(480);const warning=c.snapshot.rewriteCycle.attack;assert.ok(warning);
 const acquired=acquireOriginAuthority({...c.snapshot,leaseUntil:0},{uid:'other',now:10000});
 assert.deepEqual(acquired.encounter.rewriteCycle.attack,warning);
 const r=advanceOriginAuthorityState(acquired.encounter,.75,{players:[player(64,64)],now:10000});
 assert.equal(r.events.filter(e=>e.damage>0&&e.targetUid).length,0);
});
test('dead or different-arena players never receive an ORIGIN impact',async()=>{
 for(const changes of [{hp:0},{alive:false},{mapId:'forest'}]) {
 const c=await setup(480);c.update(.75,{player:{...player(),...changes}});
 assert.equal(c.consumeEvents().filter(e=>e.type==='damage-player').length,0);
 }
});
import { PixelRPG } from '../src/game-20260910-sanctuary.js';
import { isWorldPositionBlocked } from '../src/world-20260910-sanctuary.js';
import { originDefeatedProgress } from './helpers/sanctuary-fixtures.mjs';
import { createInitialProgress } from '../src/quest-state-20260910-sanctuary.js';
test('ORIGIN core platform does not block real melee and projectile access',()=>{
 assert.equal(isWorldPositionBlocked(MAP,1080,800,14),false);
 assert.equal(isWorldPositionBlocked(MAP,1080,760,4),false);
});
test('reward retry from the credits lifecycle pays only once after a failed second save',()=>{
 const g=Object.create(PixelRPG.prototype);g.progress={...createInitialProgress(),worldProgress:originDefeatedProgress()};
 g.player={name:'recovery'};g.endingController={playEnding(){},close(){}};
 g.updateProgressHud=()=>{};g.updateChapterUi=()=>{};g.switchWorld=()=>{};g.resetCombatState=()=>{};g.setInputEnabled=()=>{};g.notify=()=>{};
 let n=0;g.persistProgress=()=>++n!==2;
 g.confirmSanctuaryEnding('restore');g.completeSanctuaryCredits();
 assert.equal(g.progress.worldProgress.chapters.sanctuary.endingRewardClaimed,true);assert.equal(g.progress.gold,1000);
 g.completeSanctuaryCredits();assert.equal(g.progress.gold,1000);
});
test('online interpolation retains level, MP and skill payment evidence for authority validation',()=>{
 const g=Object.create(PixelRPG.prototype);g.running=true;g.mapId=MAP;g.network={uid:'self'};g.remotePlayers=new Map();g.ui={playerCount:{textContent:''}};
 const resource={'skill-e':{castId:'paid',mpBefore:150,mpAfter:128,originX:1000,originY:900,direction:'up',createdAt:10000}};
 g.receiveRemotePlayers(new Map([['remote',{...player(),name:'Mage',level:30,mp:128,skillResources:resource}]]));
 assert.equal(g.remotePlayers.get('remote').level,30);assert.equal(g.remotePlayers.get('remote').mp,128);assert.deepEqual(g.remotePlayers.get('remote').skillResources,resource);
});
import { readFileSync } from 'node:fs';
test('live game portal gating uses the sanctuary progress module rather than the legacy gate',()=>{
 const s=readFileSync(new URL('../src/game-20260910-sanctuary.js',import.meta.url),'utf8');
 assert.match(s,/import \{ advancePortalTransition, canUsePortal, createPortalTransition \} from "\.\/portal-transition-20260910-sanctuary.js"/);
});
test('BOSSKILLBOSS still selects exactly one working ORIGIN controller',async()=>{
 const g=Object.create(PixelRPG.prototype);g.mapId=MAP;g.sessionMode='solo';g.progress={...createInitialProgress(),redeemedCodeIds:['BOSSKILLBOSS']};
 const c=g.createLocalBossController();assert.equal(await c.setMap(MAP),true);assert.equal(c.snapshot.bossId,'origin-zero');
});
