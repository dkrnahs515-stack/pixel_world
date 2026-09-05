const assert = require('node:assert/strict');
const {chromium}=require("playwright");
const http=require('node:http'),fs=require('node:fs');
const server=http.createServer((req,res)=>{const file='.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
async function installReadAccess(page){
 await page.route('**/main-20260903-volcano-20260905-upgrade.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.__rewardRead=()=>({mapId:game.mapId,player:{...game.player},progress:structuredClone(game.progress),bosses:(game.coopBossController?.renderableBosses?.()||[game.coopBossController?.renderableBoss?.()].filter(Boolean)).map(b=>({id:b.id,hp:b.hp,x:b.x,y:b.y}))});\n'});});
}
(async()=>{
 await new Promise(resolve=>server.listen(4186,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Test-only read access. All mutations below use the production entry/QA/keyboard UI.
  await installReadAccess(page);
  await page.goto('http://127.0.0.1:4186/?qa=1');
  await page.locator('#nicknameInput').fill('특별보상검증');
  await page.locator('[data-class-id="warrior"]').click();await page.locator('[data-play-mode="solo"]').click();
  await page.locator('.reward-code-panel summary').click();
  await page.locator('#rewardCodeInput').fill('JAEHOON MINAH KANGIN JOOHYEONG NOISE SLIME TEACHER BOSSKILLBOSS');
  await page.locator('#rewardCodePreview').click();await page.locator('#rewardCodeRedeem').click();
  await page.locator('#enterButton').click();await page.locator('#hud').waitFor({state:'visible'});
  let state=await page.evaluate(()=>window.__rewardRead());
  assert.equal(state.progress.level,100);assert.equal(state.progress.gold,5000000);assert.equal(state.progress.inventory.hpPotion,105);
  assert.equal(state.player.skinId,'slime');assert.equal(state.player.pencilWeapon,true);assert.equal(state.player.immortal,true);
  const dismiss=page.locator('.quest-banner button');if(await dismiss.isVisible())await dismiss.click();
  await page.screenshot({path:'/tmp/reward-slime-pencil.png'});
  await page.locator('#qaButton').click();await page.locator('[data-qa-world="forest"]').click();
  await page.waitForFunction(()=>window.__rewardRead().bosses.length===3);
  await page.locator('#qaButton').click();await page.locator('[data-qa-boss="approach"]').click();
  const before=await page.evaluate(()=>window.__rewardRead());
  await page.waitForTimeout(1800);
  const surrounded=await page.evaluate(()=>window.__rewardRead());assert.equal(surrounded.player.hp,before.player.hp);
  await page.screenshot({path:'/tmp/reward-triple-bosses.png'});
  await page.keyboard.press('q');
  await page.waitForFunction(hp=>window.__rewardRead().bosses.reduce((n,b)=>n+b.hp,0)<hp,before.bosses.reduce((n,b)=>n+b.hp,0),{timeout:5000});
  state=await page.evaluate(()=>window.__rewardRead());assert.ok(state.player.mp<state.player.maxMp);
  await page.keyboard.press('i');
  await page.locator('[data-equip-weapon="heaven-sovereign-sword"]').click();
  await page.keyboard.press('i');
  assert.equal((await page.evaluate(()=>window.__rewardRead())).player.equippedWeaponId,'heaven-sovereign-sword');
  await page.waitForFunction(()=>!document.querySelector('#strongCooldown').textContent,{},{timeout:15000});
  await page.keyboard.press('q');
  await page.waitForFunction(()=>window.__rewardRead().bosses.every(b=>b.hp===0),{},{timeout:5000});
  await page.waitForFunction(()=>window.__rewardRead().progress.claimedBossRewardIds.length===1,{},{timeout:5000});
  state=await page.evaluate(()=>window.__rewardRead());
  assert.equal(state.progress.claimedBossRewardIds.length,1);
  assert.ok(state.progress.worldProgress.unlockedRegionIds.includes('coast'));
  const classResults=[];
  for(const classId of ['archer','mage']) {
    const peer=await browser.newPage({viewport:{width:1440,height:900}});peer.on('pageerror',e=>errors.push(e.message));await installReadAccess(peer);
    await peer.goto('http://127.0.0.1:4186/?qa=1');await peer.locator('#nicknameInput').fill(`전투${classId}`);
    await peer.locator(`[data-class-id="${classId}"]`).click();await peer.locator('[data-play-mode="solo"]').click();
    await peer.locator('.reward-code-panel summary').click();await peer.locator('#rewardCodeInput').fill('MINAH NOISE');await peer.locator('#rewardCodePreview').click();await peer.locator('#rewardCodeRedeem').click();
    await peer.locator('#enterButton').click();await peer.locator('#hud').waitFor({state:'visible'});await peer.locator('.quest-banner button').click();
    await peer.locator('#qaButton').click();await peer.locator('[data-qa-world="forest"]').click();await peer.locator('#qaButton').click();await peer.locator('[data-qa-boss="approach"]').click();
    await peer.waitForFunction(()=>window.__rewardRead().player.hp<window.__rewardRead().player.maxHp,{},{timeout:6000});
    const beforeAttack=await peer.evaluate(()=>window.__rewardRead());await peer.keyboard.press('q');
    await peer.waitForFunction(hp=>window.__rewardRead().bosses[0].hp<hp,beforeAttack.bosses[0].hp,{timeout:5000});
    const afterAttack=await peer.evaluate(()=>window.__rewardRead());assert.ok(afterAttack.player.mp<afterAttack.player.maxMp);
    assert.equal(afterAttack.player.immortal,false);assert.equal(afterAttack.bosses.length,1);
    classResults.push({classId,hp:afterAttack.player.hp,maxHp:afterAttack.player.maxHp,bossBefore:beforeAttack.bosses[0].hp,bossAfter:afterAttack.bosses[0].hp});
    await peer.screenshot({path:`/tmp/upgrade-${classId}-combat.png`});await peer.close();
  }
  console.log('CLASS_COMBAT',JSON.stringify(classResults));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({level:state.progress.level,gold:state.progress.gold,potions:state.progress.inventory,bosses:state.bosses,skin:state.player.skinId,hp:state.player.hp,errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
