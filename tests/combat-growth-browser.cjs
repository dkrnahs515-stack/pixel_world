const assert = require('node:assert/strict');
const { chromium } = require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/main-20260903-volcano-20260905-upgrade.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.__combatGame = game;\n'});});
 await page.goto(process.env.PIXEL_WORLD_URL||'http://127.0.0.1:4175/?qa=1');
 await page.locator('#nicknameInput').fill('skill-runtime-proof');
 await page.locator('[data-class-id="warrior"]').click();
 await page.locator('[data-play-mode="solo"]').click();
 await page.locator('#enterButton').click();
 await page.locator('#hud').waitFor({state:'visible'});
 const result=await page.evaluate(async()=>{
  const g=window.__combatGame;g.running=false;
  const {createEnemyInstance}=await import('./src/enemies-20260829-coast-20260905-upgrade.js');
  const {getStarterWeaponId}=await import('./src/weapon-data-20260903-volcano-20260905-upgrade.js');
  const {attackDefinition}=await import('./src/combat-20260903-volcano-20260905-upgrade.js');
  const {tickManaRegen}=await import('./src/skill-runtime-20260905-upgrade.js');
  const results=[];
  for(const classId of ['warrior','archer','mage'])for(const kind of ['skill-e','skill-r']){
   g.configureClassSession(classId);g.progress.level=10;g.applyProgressionStats(true);g.player.dir='right';g.player.x=1000;g.player.y=1000;g.player.prevX=1000;g.player.prevY=1000;g.attackState=null;g.skillCooldowns={};g.skillCasts=[];g.clearProjectiles();g.coopBossController=null;
   const d=attackDefinition(kind,classId,getStarterWeaponId(classId),10);g.player.mp=d.mpCost;
   const distance=d.targetDistance||(d.delivery==='dash'?140:90);
   const target=createEnemyInstance('moss-troll',{x:1000+distance,y:1000},'skill-target',{hp:1000,maxHp:1000});g.enemies=[target];
   g.running=true;g.inputEnabled=true;const accepted=g.tryAttack(kind);g.running=false;
   for(let i=0;i<120;i++){g.updateSkillCasts(1/60);g.updateProjectiles(1/60);}
   results.push({classId,kind,accepted,damage:1000-target.hp,mp:g.player.mp,slow:target.slowRemaining||0,playerX:g.player.x,expected:(Math.round(d.damage*10)/10)*d.hitCount});
  }
  g.player.mp=0;g.player.hp=10;g.player.manaRegenElapsed=0;tickManaRegen(g.player,1.9);const before=g.player.mp;tickManaRegen(g.player,.1);return {skills:results,regenBefore:before,regenAfter:g.player.mp};
 });
 assert.equal(errors.length,0,errors.join('\n'));
 for(const r of result.skills){assert.equal(r.accepted,true,JSON.stringify(r));assert.ok(r.damage>0,JSON.stringify(r));assert.equal(r.mp,0,JSON.stringify(r));if(r.kind==='skill-r')assert.ok(Math.abs(r.damage-r.expected)<1e-6,JSON.stringify(r));if(r.classId==='warrior'&&r.kind==='skill-e')assert.equal(r.playerX,1090);if(r.classId==='mage'&&r.kind==='skill-e')assert.equal(r.slow,2);}
 assert.equal(result.regenBefore,0);assert.ok(result.regenAfter>0);console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
