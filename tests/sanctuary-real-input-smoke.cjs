const assert=require('node:assert/strict');
const {mkdirSync,writeFileSync}=require('node:fs');
const {chromium}=require("playwright");
const {runQaJourney}=require('./helpers/sanctuary-real-input-nickname.cjs');
const {prepareSanctuaryCheckpoint}=require('./helpers/sanctuary-real-input-session.cjs');
const BASE=(process.env.PIXEL_WORLD_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const ONLINE=process.argv.includes('--online');
const OUT='tests/.artifacts';mkdirSync(OUT,{recursive:true});
if(ONLINE && (process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')) throw Error('Authenticated test requires isolated local emulators; production is forbidden');
const evidence={mode:ONLINE?'authenticated-emulators':'real-input-solo',journeys:[]};
let activePages=[];
function markProgress(phase) {evidence.phase=phase;evidence.updatedAt=new Date().toISOString();writeFileSync(OUT+`/progress-${ONLINE?'online':'solo'}.json`,JSON.stringify(evidence,null,2));console.log(`[sanctuary-real-input] ${phase}`);}
function wait(ms) {return new Promise(resolve=>setTimeout(resolve,ms));}
async function expose(page) {
 page.setDefaultTimeout(12000);
 page.on('pageerror',e=>{evidence.errors??=[];evidence.errors.push(e.message);});
 await page.route('**/src/main-20260910-sanctuary.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text())+'\nwindow.__game=game;'});});
 if(ONLINE) await page.route('**/src/network-20260910-sanctuary.js',async route=>{
  const r=await route.fetch();let s=await r.text();
  const start=s.indexOf('async function defaultFirebaseModuleLoader()');const end=s.indexOf('export async function createNetworkAdapter',start);
  assert.ok(start>=0&&end>start);
  s=s.slice(0,start)+`async function defaultFirebaseModuleLoader() {
    const sdk=await import('/tests/.firebase-sdk.mjs');
    const {appModule,authModule,dbModule}=sdk;
    if(!appModule.getApps().length) {
      const app=appModule.initializeApp({apiKey:'demo-key',projectId:'demo-pixel-world-rules',databaseURL:'https://demo-pixel-world-rules.firebaseio.com'});
      authModule.connectAuthEmulator(authModule.getAuth(app),'http://127.0.0.1:9099',{disableWarnings:true});
      dbModule.connectDatabaseEmulator(dbModule.getDatabase(app),'127.0.0.1',9000);
    }
    return sdk;
  }\n`+s.slice(end);
  await route.fulfill({response:r,body:s});
 });
}
async function state(page) {
 return page.evaluate(()=>{const g=window.__game;return {map:g.mapId,uid:g.network?.uid,mode:g.sessionMode,p:{x:g.player.x,y:g.player.y,hp:g.player.hp,maxHp:g.player.maxHp,mp:g.player.mp,maxMp:g.player.maxMp,speed:g.player.moveSpeed},boss:g.coopBossController?.snapshot,trinity:g.trinityBoss,progress:g.progress,spectator:g.isOriginSpectator(),input:g.inputEnabled,transition:Boolean(g.portalTransition)};});
}
async function prepareCheckpoint(page,name,classId,full=false) {
 // Arrange only the *pre-chapter / pre-boss* player checkpoint, before entry.
 // No boss snapshot, damage, receipt or outcome is injected during the journey.
 return prepareSanctuaryCheckpoint({page,baseUrl:BASE,online:ONLINE,name,classId,full,expose});
}
async function enter(page,name,classId) {
 await page.locator('#nicknameInput').fill(name);await page.locator(`[data-class-id="${classId}"]`).click();
 await page.locator(`[data-play-mode="${ONLINE?'online':'solo'}"]`).click();await page.locator('#enterButton').click();
 await page.locator('#hud').waitFor({state:'visible'});
 await page.waitForFunction(()=>window.__game?.running);
 if(ONLINE) {await page.waitForFunction(()=>window.__game.network?.mode==='firebase');assert.equal((await state(page)).mode,'online');}
}
async function exit(page) {await page.locator('#exitButton').click();await page.locator('#confirmExitButton').click();await page.locator('#entryOverlay').waitFor({state:'visible'});}
async function qaTravel(page,map) {await page.locator('#qaButton').click();await page.locator(`[data-qa-world="${map}"]`).click();await page.waitForFunction(m=>window.__game.mapId===m,map);await page.locator('#qaOverlay').waitFor({state:'hidden'});}
async function sustain(page) {
 const s=await state(page);if(s.p.hp<s.p.maxHp*.7)await page.keyboard.press('1');if(s.p.mp<s.p.maxMp*.5)await page.keyboard.press('2');
 assert.ok(s.p.hp>0,'player must remain alive during the journey');
}
async function alignAxis(page,axis,target,startMap) {
 for(let n=0;n<40;n++) {
  const snapshot=await state(page);if(snapshot.transition){await page.waitForFunction(()=>!window.__game.portalTransition);return false;}if(snapshot.map!==startMap)return false;
  const current=snapshot.p[axis],delta=target-current;if(Math.abs(delta)<=12)return true;
  const code=axis==='x'?(delta>0?'ArrowRight':'ArrowLeft'):(delta>0?'ArrowDown':'ArrowUp');
  await page.keyboard.press(code,{delay:25});
 }
 const snapshot=await state(page);if(snapshot.transition||snapshot.map!==startMap)return false;throw Error(`Movement could not align ${axis}=${Math.round(snapshot.p[axis])} to ${target}`);
}
async function walk(page,target,radius=12,routeTolerance=18) {
 // Navigation inspects collision data but never writes player coordinates.
 const startMap=(await state(page)).map;
 const route=await page.evaluate(async({target,radius})=>{
  const {getWorldDefinition}=await import('/src/world-data-20260910-sanctuary.js');
  const {isWorldPositionBlocked}=await import('/src/world-20260910-sanctuary.js');
  const g=window.__game,w=getWorldDefinition(g.mapId),step=32;
  const liveEnemies=(g.enemies||[]).filter(enemy=>enemy.hp>0&&enemy.targetable!==false);
  const valid=(x,y)=>!isWorldPositionBlocked(g.mapId,x,y,32)
   && liveEnemies.every(enemy=>Math.hypot(x-enemy.x,y-enemy.y)>(enemy.radius||20)+150);
  const start={x:Math.round(g.player.x/step)*step,y:Math.round(g.player.y/step)*step};
  const q=[start],seen=new Map([[`${start.x},${start.y}`,null]]);let found;
  for(let i=0;i<q.length;i++) {
   const v=q[i];if(Math.hypot(v.x-target.x,v.y-target.y)<=Math.max(radius,23)){found=v;break;}
   for(const [dx,dy]of [[step,0],[-step,0],[0,step],[0,-step]]) {
    const n={x:v.x+dx,y:v.y+dy},k=`${n.x},${n.y}`;
    if(n.x<32||n.y<32||n.x>w.width-32||n.y>w.height-32||seen.has(k)||!valid(n.x,n.y)||!valid(v.x+dx/2,v.y+dy/2))continue;
    seen.set(k,v);q.push(n);
   }
  }
  if(!found)throw Error(`No walkable path to ${JSON.stringify(target)} in ${g.mapId}`);
  const path=[];for(let v=found;v;v=seen.get(`${v.x},${v.y}`))path.push(v);path.reverse();
  return path.filter((v,i)=>i===0||i===path.length-1||(path[i+1].x-path[i-1].x!==0&&path[i+1].y-path[i-1].y!==0));
 },{target,radius});
 markProgress(`walk:${startMap}:${Math.round(target.x)},${Math.round(target.y)}:route-${route.length}`);
 for(const [pointIndex,point] of route.entries()) {
  const initial=await state(page);
  if(Math.abs(initial.p.x-point.x)<=routeTolerance&&Math.abs(initial.p.y-point.y)<=routeTolerance)continue;
  for(const axis of ['x','y']) {
   const s=await state(page);
   if(s.transition){await page.waitForFunction(()=>!window.__game.portalTransition);return;}
   if(s.map!==startMap)return;
   const delta=point[axis]-s.p[axis];if(Math.abs(delta)<=12)continue;
   const code=axis==='x'?(delta>0?'ArrowRight':'ArrowLeft'):(delta>0?'ArrowDown':'ArrowUp'),direction=Math.sign(delta);
   await page.keyboard.down(code);
   const holdMs=Math.max(25,Math.min(6000,(Math.max(0,Math.abs(delta)-18)/(s.p.speed||245))*1000));
   try {await wait(holdMs);} finally {await page.keyboard.up(code);}
   const afterHold=await state(page);
   if(afterHold.transition){await page.waitForFunction(()=>!window.__game.portalTransition);return;}
   if(afterHold.map!==startMap)return;
   if(!await alignAxis(page,axis,point[axis],startMap))return;
  }
  if(!await alignAxis(page,'x',point.x,startMap)||!await alignAxis(page,'y',point.y,startMap))return;
  const reached=await state(page);
  if(Math.abs(reached.p.x-point.x)>routeTolerance||Math.abs(reached.p.y-point.y)>routeTolerance)throw Error(`Movement did not reach route point ${JSON.stringify(point)} from ${Math.round(reached.p.x)},${Math.round(reached.p.y)}`);
  await sustain(page);
 }
}
async function portal(page,id) {
 const {destination,x,y}=await page.evaluate(async id=>{const {getWorldDefinition}=await import('/src/world-data-20260910-sanctuary.js');const p=getWorldDefinition(window.__game.mapId).portals.find(p=>p.id===id);if(!p)throw Error('Missing portal '+id);return {x:p.x+p.w/2,y:p.y+p.h/2,destination:p.destination};},id);
 await walk(page,{x,y},30);
 await page.waitForFunction(m=>window.__game.mapId===m,destination.mapId);
 await page.waitForFunction(()=>!window.__game.portalTransition&&window.__game.inputEnabled);
 markProgress(`portal:${id}`);
}
async function interact(page,id) {
 const t=await page.evaluate(async id=>{const {ALL_STORY_INTERACTIONS}=await import('/src/story-interactions-20260910-sanctuary.js');return ALL_STORY_INTERACTIONS.find(t=>t.id===id);},id);
 markProgress(`interact:${id}:walking`);
 await walk(page,{x:t.x,y:t.y},65);await page.keyboard.press('f');
 await page.locator('#dialogueOverlay').waitFor({state:'visible'});await page.locator('#dialogueActionButton').click();await page.locator('#dialogueOverlay').waitFor({state:'hidden'});
 markProgress(`interact:${id}`);
}
async function faceUp(page){
 await page.keyboard.down('ArrowUp');
 try {await page.waitForFunction(()=>window.__game.player.dir==='up');}
 finally {await page.keyboard.up('ArrowUp');}
}
async function attack(page,key){await sustain(page);await faceUp(page);await page.keyboard.press(key);await page.waitForTimeout(key==='r'?1200:key==='e'?700:650);}
async function approachBoss(page){await walk(page,{x:1080,y:800},12,48);}
async function trinity(page) {
 await page.waitForFunction(()=>window.__game.trinityBoss?.hp===800);
 await approachBoss(page);for(const k of ['r','e','q','Control'])await attack(page,k);
 for(let n=0;n<65;n++){if((await state(page)).progress.worldProgress.chapters.sanctuary.trinityDefeated){markProgress('trinity:defeated');return;}await approachBoss(page);await attack(page,n%5===0?'q':'Control');if(n%10===9)markProgress(`trinity:attack-${n+1}`);}
 throw Error('TRINITY never defeated through real attacks');
}
async function rewrite(page) {
 await page.waitForFunction(()=>window.__game.coopBossController?.snapshot?.bossId==='origin-zero');
 await approachBoss(page);
 for(const k of ['r','e','q','Control'])await attack(page,k);
 for(let n=0;n<90;n++) {
  const s=await state(page);if(Object.values(s.boss.anchors||{}).some(a=>a.active))return avoidRewriteWarning(page);
  // A ranged strong attack can pierce ORIGIN on the threshold frame and then
  // immediately destroy the newly spawned centre anchor. Use non-piercing basic
  // attacks for the threshold approach so anchor verification starts intact.
  await approachBoss(page);await attack(page,'Control');
  if(n%10===9)markProgress(`origin-rewrite:attack-${n+1}`);
 }
 throw Error('Real attacks did not reach rewrite phase');
}
async function avoidRewriteWarning(page) {
 // The rewrite transition can be observed halfway through an existing warning.
 // Let that cycle finish, then start holding a real movement key before the next
 // warning is created and keep moving through its complete 0.8s telegraph.
 await page.waitForFunction(()=>{const c=window.__game.coopBossController?.snapshot?.rewriteCycle;return c&&c.phase!=='warning';});
 const previousSequence=(await state(page)).boss.rewriteCycle.sequence;
 let before,cycle;
 await page.keyboard.down('ArrowRight');
 try {
  await page.waitForFunction(previous=>{const c=window.__game.coopBossController?.snapshot?.rewriteCycle;return c?.sequence>previous&&c.phase==='warning'&&c.attack?.kind==='rewrite';},previousSequence);
  before=await state(page);cycle=before.boss.rewriteCycle;
  await page.waitForFunction(sequence=>{const c=window.__game.coopBossController?.snapshot?.rewriteCycle;return c?.sequence===sequence&&c.phase!=='warning';},cycle.sequence);
 } finally {await page.keyboard.up('ArrowRight');}
 const attackGeometry=cycle.attack,after=await state(page);
 assert.equal(attackGeometry.kind,'rewrite');
 assert.ok(Math.hypot(after.p.x-attackGeometry.targetX,after.p.y-attackGeometry.targetY)>attackGeometry.radius+14,'real movement must leave the latched warning area before impact');
 assert.equal(after.p.hp,before.p.hp,'leaving the latched rewrite warning must avoid its impact');
 return {warningAvoided:true,warningSequence:cycle.sequence,warningRadius:attackGeometry.radius};
}
const ATTACK_KIND={Control:'basic',q:'strong',e:'skill-e',r:'skill-r'};
// Put wide ranged skills on the isolated centre anchor so they cannot destroy a
// second target and erase the next key's independent attack evidence.
const ANCHOR_KEYS={warrior:['Control','q','r'],archer:['Control','e','q'],mage:['Control','r','q']};
const ENDING_TITLES={restore:'세계의 복원자',seal:'코어의 수호자',resonate:'세계의 공명자'};
async function waitForAttackReady(page,key) {
 const kind=ATTACK_KIND[key];
 await page.waitForFunction(kind=>{
  const g=window.__game;
  if(kind==='basic')return (g.basicCooldown||0)<=0;
  if(kind==='strong')return (g.strongCooldown||0)<=0;
  return (g.skillCooldowns?.[kind]||0)<=0;
 },kind,{timeout:8000});
}
async function waitForOriginRecoveryWindow(page) {
 await sustain(page);
 const previousSequence=(await state(page)).boss.rewriteCycle.sequence;
 await page.waitForFunction(previous=>{
  const c=window.__game.coopBossController?.snapshot?.rewriteCycle;
  return c?.phase==='warning'&&c.sequence>previous;
 },previousSequence,{timeout:5000});
 const warningSequence=(await state(page)).boss.rewriteCycle.sequence;
 await page.waitForFunction(sequence=>{
  const c=window.__game.coopBossController?.snapshot?.rewriteCycle;
  // The controller publishes recovery before the game loop consumes the impact
  // event. Waiting one tenth of a second prevents that queued knockback from
  // invalidating the aim after we realign.
  return c?.sequence===sequence&&c.phase==='recovery'&&c.elapsed>=0.1&&c.elapsed<0.3;
 },warningSequence,{timeout:2000});
}
async function destroyAnchor(page,id,key,classId) {
 const before=(await state(page)).boss.anchors?.[id];assert.ok(before?.active,`Expected active ${id}`);
 // All three real anchor attack paths use actual keyboard input.  The ranged R
 // skills need their targeting offset; every other key is aimed from melee range.
 const rangedClass=['archer','mage'].includes(classId),distance=rangedClass?(key==='r'?220:160):40;
 // Rewrite entry deliberately exercises Q/E/R first. Wait for the real game clock
 // to make that same key available again before walking into position; telegraphed
 // boss impacts during the wait can otherwise knock the player off the aim line.
 await waitForAttackReady(page,key);await walk(page,{x:before.x,y:before.y+distance});
 // Enter a fresh recovery window, then realign after any warning knockback. This
 // keeps the projectile's authenticated current-position check stable on impact.
 await waitForOriginRecoveryWindow(page);await walk(page,{x:before.x,y:before.y+distance},12,48);
 const attackMap=(await state(page)).map;
 await alignAxis(page,'x',before.x,attackMap);await alignAxis(page,'y',before.y+distance,attackMap);
 await attack(page,key);
 await page.waitForFunction(({id,beforeHp})=>{
  const anchor=window.__game.coopBossController?.snapshot?.anchors?.[id];
  return anchor&&anchor.hp<beforeHp;
 },{id,beforeHp:before.hp},{timeout:4000});
 const after=(await state(page)).boss.anchors?.[id];assert.ok(after.hp<before.hp,`${key} must reduce ${id} HP`);assert.equal(after.active,false,`${key} must fully destroy ${id}`);
 return {anchorId:id,key,attackKind:ATTACK_KIND[key],beforeHp:before.hp,afterHp:after.hp,destroyed:!after.active};
}
async function finishFight(page,classId) {
 const attacks=[];
 for(const [index,id] of ['origin-anchor-life','origin-anchor-memory','origin-anchor-energy'].entries()) attacks.push(await destroyAnchor(page,id,ANCHOR_KEYS[classId][index],classId));
 assert.equal(Object.values((await state(page)).boss.anchors).some(a=>a.active),false);
 for(let n=0;n<80;n++) {
  if((await state(page)).progress.worldProgress.chapters.sanctuary.originDefeated)return attacks;
  await approachBoss(page);await attack(page,n%5===0?'q':'Control');
 }
 throw Error('No durable ORIGIN receipt after real combat');
}
async function installSecondRewardWriteFailure(page) {
 await page.evaluate(()=>{
  const key=`pixel-world.progress.v8:${encodeURIComponent(window.__game.player.name)}`,original=Storage.prototype.setItem;let writes=0;
  Storage.prototype.setItem=function(candidateKey,value){if(candidateKey===key&&++writes===2)throw Error('intentional second durable reward write failure');return original.call(this,candidateKey,value);};
  window.__restoreRewardStorageWrite=()=>{Storage.prototype.setItem=original;delete window.__restoreRewardStorageWrite;};
 });
}
async function restoreRewardWrite(page) {await page.evaluate(()=>window.__restoreRewardStorageWrite?.());}
async function choice(page,id,{failRewardSave=false}={}) {
 await page.locator('#endingChoicePanel').waitFor({state:'visible'});
 // Only presentation duration is accelerated. Credit skip keeps its real 5s gate.
 await page.evaluate(()=>{window.__game.endingController.sceneDurationMs=1;});
 const before=(await state(page)).progress;
 if(failRewardSave)await installSecondRewardWriteFailure(page);
 await page.locator(`#ending${id[0].toUpperCase()+id.slice(1)}Button`).click();await page.locator('#endingConfirmButton').click();
 await page.locator('#endingCredits').waitFor({state:'visible'});assert.equal(await page.locator('#endingCreditsSkip').isDisabled(),true);
 if(failRewardSave) {
  const failed=(await state(page)).progress,sanctuary=failed.worldProgress.chapters.sanctuary;
  assert.equal(sanctuary.endingChoice,id,'ending choice must remain durable when its later reward write fails');
  assert.equal(sanctuary.endingRewardClaimed,false);assert.equal(failed.gold,before.gold);assert.equal(failed.exp,before.exp);assert.equal(failed.endingTitle,null);
  const stored=await page.evaluate(()=>{
   const key=`pixel-world.progress.v8:${encodeURIComponent(window.__game.player.name)}`;
   return JSON.parse(localStorage.getItem(key));
  });
  const storedSanctuary=stored.worldProgress.chapters.sanctuary;
  assert.equal(storedSanctuary.endingChoice,id,'the first successful write must durably store the permanent choice');
  assert.equal(storedSanctuary.endingRewardClaimed,false);assert.equal(stored.gold,before.gold);assert.equal(stored.exp,before.exp);assert.equal(stored.endingTitle,null);
  await restoreRewardWrite(page);
 }
 await page.waitForFunction(()=>!document.querySelector('#endingCreditsSkip').disabled);await page.locator('#endingCreditsSkip').click();
 await page.waitForFunction(()=>window.__game.mapId==='village');
 const rewarded=(await state(page)).progress,sanctuary=rewarded.worldProgress.chapters.sanctuary;
 assert.equal(sanctuary.endingRewardClaimed,true);assert.equal(rewarded.gold,before.gold+1000);assert.equal(rewarded.exp,before.exp+500);assert.equal(rewarded.endingTitle,ENDING_TITLES[id]);
 return {before,rewarded,rewardSaveFailureRecovered:failRewardSave};
}
async function recover(page) {
 await page.locator('#endingChoicePanel').waitFor({state:'visible'});const receipt=(await state(page)).progress.worldProgress.chapters.sanctuary.originDefeatReceiptId;
 assert.equal(await page.locator('#endingResonateButton').isDisabled(),true);
 await page.locator('#endingDeferButton').click();await portal(page,'to-zero-boundary');
 await interact(page,'origin-record-mutual-validation');await portal(page,'to-core-heart');await walk(page,{x:1080,y:800});
 await page.keyboard.press('f');await page.locator('#endingChoicePanel').waitFor({state:'visible'});
 assert.equal(await page.locator('#endingResonateButton').isEnabled(),true);assert.equal((await state(page)).progress.worldProgress.chapters.sanctuary.originDefeatReceiptId,receipt);
 await page.screenshot({path:OUT+'/decision-recovery.png'});
}
async function solo(browser) {
 for(const cls of ['warrior','archer','mage']) {
 const context=await browser.newContext({viewport:{width:800,height:500}});const page=await context.newPage();activePages=[page];const full=cls==='warrior',name=await runQaJourney({page,journey:`real-${cls}`,timestamp:Date.now(),classId:cls,full,mapId:full?'sanctuary-resonance-hall':'sanctuary-core-heart',prepareCheckpoint,enter,qaTravel});
  markProgress(`${cls}:entered`);
  if(cls==='warrior') {
   for(const id of ['life-resonance','memory-resonance','energy-resonance','origin-record-single-authority'])await interact(page,id);
   await portal(page,'to-origin-archive');
   for(const id of ['archive-aren-split','archive-vanguard-entry','archive-defense-protocol','origin-record-sealed-recovery'])await interact(page,id);
   await portal(page,'to-zero-boundary');await trinity(page);await portal(page,'to-core-heart');
  }
  const warning=await rewrite(page);markProgress(`${cls}:rewrite-warning-avoided`);await page.screenshot({path:OUT+`/rewrite-${cls}.png`});const anchorAttacks=await finishFight(page,cls);markProgress(`${cls}:anchors-destroyed`);await recover(page);
  const ending=await choice(page,{warrior:'restore',archer:'seal',mage:'resonate'}[cls],{failRewardSave:cls==='warrior'});markProgress(`${cls}:ending-rewarded`);
  await exit(page);await enter(page,name,cls);const reentered=(await state(page)).progress;
  assert.equal(reentered.gold,ending.rewarded.gold);assert.equal(reentered.exp,ending.rewarded.exp);assert.equal(reentered.endingTitle,ending.rewarded.endingTitle);
  evidence.journeys.push({class:cls,actualCombat:true,deferFRecovery:true,...warning,anchorAttacks,rewardSaveFailureRecovered:ending.rewardSaveFailureRecovered,rewardOnce:true});await context.close();
 }
 assert.deepEqual([...new Set(evidence.journeys.flatMap(j=>j.anchorAttacks.map(a=>a.attackKind)))].sort(),['basic','skill-e','skill-r','strong'],'Control/Q/E/R must each be observed destroying a real anchor');
}
async function online(browser) {
 const a=await browser.newContext({viewport:{width:800,height:500}}),b=await browser.newContext({viewport:{width:800,height:500}});
 const A=await a.newPage(),B=await b.newPage();activePages=[A,B];const timestamp=Date.now(),na=await runQaJourney({page:A,journey:'online-a',timestamp,classId:'warrior',full:false,mapId:'sanctuary-core-heart',prepareCheckpoint,enter,qaTravel}),nb=await runQaJourney({page:B,journey:'online-b',timestamp,classId:'warrior',full:false,mapId:'sanctuary-core-heart',prepareCheckpoint,enter,qaTravel});
 const uidA=(await state(A)).uid,uidB=(await state(B)).uid;assert.notEqual(uidA,uidB);assert.notEqual(uidA,'local-player');
 await B.waitForFunction(uid=>window.__game.remotePlayers.has(uid),uidA);
 await walk(B,{x:1080,y:800});const hp=(await state(B)).boss.hp;await attack(B,'Control');
 await A.waitForFunction(hp=>window.__game.coopBossController.snapshot.hp<hp,hp);
 await rewrite(A);const prior=(await state(A)).boss;
 await B.waitForFunction(hp=>Object.keys(window.__game.coopBossController.snapshot.anchors||{}).length===3 && window.__game.coopBossController.snapshot.hp===hp,prior.hp);
 await exit(A);
 await B.waitForFunction(uid=>window.__game.coopBossController.snapshot.authorityUid===uid,uidB,{timeout:20000});
 const after=(await state(B)).boss;assert.equal(after.hp,prior.hp);assert.deepEqual(after.anchors,prior.anchors);assert.equal(after.authorityEpoch,prior.authorityEpoch+1);
 await enter(A,na,'warrior');assert.equal((await state(A)).uid,uidA);await qaTravel(A,'sanctuary-core-heart');
 await A.waitForFunction(uid=>window.__game.coopBossController?.snapshot?.authorityUid===uid,uidB);
 await finishFight(B,'warrior');
 await A.waitForFunction(()=>window.__game.progress.worldProgress.chapters.sanctuary.originDefeated,null,{timeout:15000});
 assert.equal((await state(A)).progress.worldProgress.chapters.sanctuary.originDefeatReceiptId,(await state(B)).progress.worldProgress.chapters.sanctuary.originDefeatReceiptId);
 await recover(B);await choice(A,'restore');await choice(B,'resonate');
 assert.equal((await state(A)).progress.endingTitle,'세계의 복원자');assert.equal((await state(B)).progress.endingTitle,'세계의 공명자');
 const privileges=await B.evaluate(()=>window.__game.rewardEffects);assert.equal(privileges.immortal,false);assert.equal(privileges.bossCount,1);
 evidence.journeys.push({authenticatedContexts:2,distinctUIDs:true,sharedHP:true,authorityHandoff:true,anchorPreserved:true,independentReceipts:true,endings:['restore','resonate']});
 await A.screenshot({path:OUT+'/online-restore.png'});await B.screenshot({path:OUT+'/online-resonate.png'});await a.close();await b.close();
}
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_PATH?{executablePath:process.env.PLAYWRIGHT_BROWSER_PATH}:{})});try{markProgress('browser-launched');
 if(ONLINE)await online(browser);else await solo(browser);
 assert.deepEqual(evidence.errors||[],[]);console.log(JSON.stringify(evidence,null,2));
}catch(error){for(let i=0;i<activePages.length;i++){try{writeFileSync(OUT+`/failure-${i}.json`,JSON.stringify(await state(activePages[i]),null,2));await activePages[i].screenshot({path:OUT+`/failure-${i}.png`});}catch{}}
 throw error;
}finally{writeFileSync(OUT+`/evidence-${ONLINE?'online':'solo'}.json`,JSON.stringify(evidence,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
