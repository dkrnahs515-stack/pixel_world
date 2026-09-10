const assert=require('node:assert/strict');
const {mkdirSync,writeFileSync}=require('node:fs');
const {chromium}=require("playwright");
const BASE=(process.env.PIXEL_WORLD_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const ONLINE=process.argv.includes('--online');
const OUT='tests/.artifacts';mkdirSync(OUT,{recursive:true});
if(ONLINE && (process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')) throw Error('Authenticated test requires isolated local emulators; production is forbidden');
const evidence={mode:ONLINE?'authenticated-emulators':'real-input-solo',journeys:[]};
let activePages=[];
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
async function prepare(page,name,classId,full=false) {
 await expose(page);await page.goto(BASE+'/?qa=1'+(ONLINE?'&onlineFixture=1':''),{waitUntil:'networkidle'});
 // Arrange only the *pre-chapter / pre-boss* player checkpoint, before entry.
 // No boss snapshot, damage, receipt or outcome is injected during the journey.
 await page.evaluate(async({name,classId,full})=>{
  const {createInitialProgress}=await import('/src/quest-state-20260910-sanctuary.js');
  const {prepareWeaponQaProgress}=await import('/src/qa-mode-20260910-sanctuary.js');
  const f=await import('/tests/helpers/sanctuary-fixtures.mjs');
  const {saveProgress}=await import('/src/progress-storage-20260910-sanctuary.js');
  let p=prepareWeaponQaProgress(createInitialProgress(),classId);
  p.introSeen=true;p.inventory={...p.inventory,hpPotion:99,mpPotion:99};
  p.redeemedCodeIds=(location.search.includes('onlineFixture=1')?['TEACHER','BOSSKILLBOSS']:[]);
  p.worldProgress=full?f.sanctuaryUnlockedProgress():f.originReadyProgress({originRecordIds:['origin-record-single-authority','origin-record-sealed-recovery']});
  if(!saveProgress(localStorage,name,p).ok)throw Error('Cannot save checkpoint');
 },{name,classId,full});
 await enter(page,name,classId);
 await qaTravel(page,full?'sanctuary-resonance-hall':'sanctuary-core-heart');
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
async function walk(page,target,radius=12) {
 // Navigation inspects collision data but never writes player coordinates.
 const startMap=(await state(page)).map;
 const route=await page.evaluate(async({target,radius})=>{
  const {getWorldDefinition}=await import('/src/world-data-20260910-sanctuary.js');
  const {isWorldPositionBlocked}=await import('/src/world-20260910-sanctuary.js');
  const g=window.__game,w=getWorldDefinition(g.mapId),step=32;
  const valid=(x,y)=>!isWorldPositionBlocked(g.mapId,x,y,16);
  const start={x:Math.round(g.player.x/step)*step,y:Math.round(g.player.y/step)*step};
  const q=[start],seen=new Map([[`${start.x},${start.y}`,null]]);let found;
  for(let i=0;i<q.length;i++) {
   const v=q[i];if(Math.hypot(v.x-target.x,v.y-target.y)<=Math.max(radius,23)){found=v;break;}
   for(const [dx,dy]of [[step,0],[-step,0],[0,step],[0,-step]]) {
    const n={x:v.x+dx,y:v.y+dy},k=`${n.x},${n.y}`;
    if(n.x<16||n.y<16||n.x>w.width-16||n.y>w.height-16||seen.has(k)||!valid(n.x,n.y)||!valid(v.x+dx/2,v.y+dy/2))continue;
    seen.set(k,v);q.push(n);
   }
  }
  if(!found)throw Error(`No walkable path to ${JSON.stringify(target)} in ${g.mapId}`);
  const path=[];for(let v=found;v;v=seen.get(`${v.x},${v.y}`))path.push(v);path.reverse();
  return path.filter((v,i)=>i===0||i===path.length-1||(path[i+1].x-path[i-1].x!==0&&path[i+1].y-path[i-1].y!==0));
 },{target,radius});
 for(const point of route) {
  let last='',stuck=0;
  for(let n=0;n<110;n++) {
   const s=await state(page);
   if(s.transition){await page.waitForFunction(()=>!window.__game.portalTransition);return;}
   if(s.map!==startMap)return;
   const dx=point.x-s.p.x,dy=point.y-s.p.y;
   if(Math.abs(dx)<=6&&Math.abs(dy)<=6)break;
   const code=Math.abs(dx)>6?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');
   const d=Math.abs(dx)>6?Math.abs(dx):Math.abs(dy);
   await page.keyboard.down(code);await page.waitForTimeout(Math.max(25,Math.min(180,d/(s.p.speed||245)*1000)));await page.keyboard.up(code);
   const k=`${Math.round(s.p.x)},${Math.round(s.p.y)}`;stuck=k===last?stuck+1:0;last=k;
   if(stuck>12)throw Error(`Movement blocked at ${k}, towards ${JSON.stringify(point)}`);
   if(n%10===0)await sustain(page);
  }
 }
}
async function portal(page,id) {
 const {destination,x,y}=await page.evaluate(async id=>{const {getWorldDefinition}=await import('/src/world-data-20260910-sanctuary.js');const p=getWorldDefinition(window.__game.mapId).portals.find(p=>p.id===id);if(!p)throw Error('Missing portal '+id);return {x:p.x+p.w/2,y:p.y+p.h/2,destination:p.destination};},id);
 await walk(page,{x,y},30);
 await page.waitForFunction(m=>window.__game.mapId===m,destination.mapId);
 await page.waitForFunction(()=>!window.__game.portalTransition&&window.__game.inputEnabled);
}
async function interact(page,id) {
 const t=await page.evaluate(async id=>{const {ALL_STORY_INTERACTIONS}=await import('/src/story-interactions-20260910-sanctuary.js');return ALL_STORY_INTERACTIONS.find(t=>t.id===id);},id);
 await walk(page,{x:t.x,y:t.y},65);await page.keyboard.press('f');
 await page.locator('#dialogueOverlay').waitFor({state:'visible'});await page.locator('#dialogueActionButton').click();await page.locator('#dialogueOverlay').waitFor({state:'hidden'});
}
async function faceUp(page){await page.keyboard.press('ArrowUp');}
async function attack(page,key){await sustain(page);await faceUp(page);await page.keyboard.press(key);await page.waitForTimeout(key==='r'?1200:key==='e'?700:650);}
async function trinity(page) {
 await page.waitForFunction(()=>window.__game.trinityBoss?.hp===800);
 await walk(page,{x:1080,y:800});for(const k of ['r','e','q','Control'])await attack(page,k);
 for(let n=0;n<65;n++){if((await state(page)).progress.worldProgress.chapters.sanctuary.trinityDefeated)return;await walk(page,{x:1080,y:800});await attack(page,n%5===0?'q':'Control');}
 throw Error('TRINITY never defeated through real attacks');
}
async function rewrite(page) {
 await page.waitForFunction(()=>window.__game.coopBossController?.snapshot?.bossId==='origin-zero');
 await walk(page,{x:1080,y:800});
 for(const k of ['r','e','q','Control'])await attack(page,k);
 for(let n=0;n<90;n++) {
  const s=await state(page);if(Object.values(s.boss.anchors||{}).some(a=>a.active))return;
  await walk(page,{x:1080,y:800});await attack(page,n%5===0?'q':'Control');
 }
 throw Error('Real attacks did not reach rewrite phase');
}
async function finishFight(page) {
 for(const id of ['origin-anchor-life','origin-anchor-memory','origin-anchor-energy']) {
  for(let n=0;n<20;n++){
   const a=(await state(page)).boss.anchors?.[id];if(!a?.active)break;
   await walk(page,{x:a.x,y:a.y+40});await attack(page,'Control');
   if(n===19)throw Error('Anchor not damaged: '+id);
  }
 }
 assert.equal(Object.values((await state(page)).boss.anchors).some(a=>a.active),false);
 for(let n=0;n<80;n++) {
  if((await state(page)).progress.worldProgress.chapters.sanctuary.originDefeated)return;
  await walk(page,{x:1080,y:800});await attack(page,n%5===0?'q':'Control');
 }
 throw Error('No durable ORIGIN receipt after real combat');
}
async function choice(page,id) {
 await page.locator('#endingChoicePanel').waitFor({state:'visible'});
 // Only presentation duration is accelerated. Credit skip keeps its real 5s gate.
 await page.evaluate(()=>{window.__game.endingController.sceneDurationMs=1;});
 await page.locator(`#ending${id[0].toUpperCase()+id.slice(1)}Button`).click();await page.locator('#endingConfirmButton').click();
 await page.locator('#endingCredits').waitFor({state:'visible'});assert.equal(await page.locator('#endingCreditsSkip').isDisabled(),true);
 await page.waitForFunction(()=>!document.querySelector('#endingCreditsSkip').disabled);await page.locator('#endingCreditsSkip').click();
 await page.waitForFunction(()=>window.__game.mapId==='village');
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
  const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();activePages=[page];const name='Real-'+cls+'-'+Date.now();
  await prepare(page,name,cls,cls==='warrior');
  if(cls==='warrior') {
   for(const id of ['life-resonance','memory-resonance','energy-resonance','origin-record-single-authority'])await interact(page,id);
   await portal(page,'to-origin-archive');
   for(const id of ['archive-aren-split','archive-vanguard-entry','archive-defense-protocol','origin-record-sealed-recovery'])await interact(page,id);
   await portal(page,'to-zero-boundary');await trinity(page);await portal(page,'to-core-heart');
  }
  await rewrite(page);await page.screenshot({path:OUT+`/rewrite-${cls}.png`});await finishFight(page);await recover(page);
  const gold=(await state(page)).progress.gold;await choice(page,{warrior:'restore',archer:'seal',mage:'resonate'}[cls]);
  assert.equal((await state(page)).progress.gold,gold+1000);
  await exit(page);await enter(page,name,cls);assert.equal((await state(page)).progress.gold,gold+1000);
  evidence.journeys.push({class:cls,actualCombat:true,deferFRecovery:true,rewardOnce:true});await context.close();
 }
}
async function online(browser) {
 const a=await browser.newContext({viewport:{width:1440,height:900}}),b=await browser.newContext({viewport:{width:1440,height:900}});
 const A=await a.newPage(),B=await b.newPage();activePages=[A,B];const na='Online-A-'+Date.now(),nb='Online-B-'+Date.now();
 await prepare(A,na,'warrior');await prepare(B,nb,'warrior');
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
 await finishFight(B);
 await A.waitForFunction(()=>window.__game.progress.worldProgress.chapters.sanctuary.originDefeated,null,{timeout:15000});
 assert.equal((await state(A)).progress.worldProgress.chapters.sanctuary.originDefeatReceiptId,(await state(B)).progress.worldProgress.chapters.sanctuary.originDefeatReceiptId);
 await recover(B);await choice(A,'restore');await choice(B,'resonate');
 assert.equal((await state(A)).progress.endingTitle,'세계의 복원자');assert.equal((await state(B)).progress.endingTitle,'세계의 공명자');
 const privileges=await B.evaluate(()=>window.__game.rewardEffects);assert.equal(privileges.immortal,false);assert.equal(privileges.bossCount,1);
 evidence.journeys.push({authenticatedContexts:2,distinctUIDs:true,sharedHP:true,authorityHandoff:true,anchorPreserved:true,independentReceipts:true,endings:['restore','resonate']});
 await A.screenshot({path:OUT+'/online-restore.png'});await B.screenshot({path:OUT+'/online-resonate.png'});await a.close();await b.close();
}
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_PATH?{executablePath:process.env.PLAYWRIGHT_BROWSER_PATH}:{})});try{
 if(ONLINE)await online(browser);else await solo(browser);
 assert.deepEqual(evidence.errors||[],[]);console.log(JSON.stringify(evidence,null,2));
}catch(error){for(let i=0;i<activePages.length;i++){try{writeFileSync(OUT+`/failure-${i}.json`,JSON.stringify(await state(activePages[i]),null,2));await activePages[i].screenshot({path:OUT+`/failure-${i}.png`});}catch{}}
 throw error;
}finally{writeFileSync(OUT+`/evidence-${ONLINE?'online':'solo'}.json`,JSON.stringify(evidence,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
