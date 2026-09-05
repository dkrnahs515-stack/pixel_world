import test from 'node:test';
import assert from 'node:assert/strict';
let api={};try {api=await import('../src/reward-cosmetics-20260905-upgrade.js');} catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
test('reward modifiers reset solo privileges on online entry without changing class or equipment',()=>{
  assert.equal(typeof api.applyRewardModifiers,'function');
  const player={classId:'mage',equippedWeaponId:'starter-staff'};
  const progress={redeemedCodeIds:['SLIME','TEACHER','BOSSKILLBOSS']};
  assert.equal(api.applyRewardModifiers(player,progress,'solo').bossCount,3);
  assert.equal(player.immortal,true);assert.equal(player.pencilWeapon,true);assert.equal(player.skinId,'slime');
  api.applyRewardModifiers(player,progress,'online');
  assert.equal(player.immortal,false);assert.equal(player.pencilWeapon,false);assert.equal(player.skinId,'slime');
  assert.equal(player.classId,'mage');assert.equal(player.equippedWeaponId,'starter-staff');
  api.applyRewardModifiers(player,{redeemedCodeIds:[]},'solo');assert.equal(player.skinId,'default');
});
test('slime and pencil render pixel shapes with balanced canvas state',()=>{
  assert.equal(typeof api.drawSlimeBody,'function');assert.equal(typeof api.drawPencilWeapon,'function');
  let saves=0,rects=0;const ctx={save(){saves++;},restore(){saves--;},translate(){},rotate(){},fillRect(){rects++;}};
  api.drawSlimeBody(ctx,{dir:'left',hitFlash:0});api.drawPencilWeapon(ctx,{dir:'up'});
  assert.equal(saves,0);assert.ok(rects>10);
});
