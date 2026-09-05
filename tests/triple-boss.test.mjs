import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorldDefinition} from '../src/world-data-20260903-volcano-20260905-upgrade.js';
import {isWorldPositionBlocked} from '../src/world-20260903-volcano-20260905-upgrade.js';
let api={};try{api=await import('../src/triple-boss-controller-20260905-upgrade.js');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}

test('triple encounters spawn three distinct collision-safe bosses in each boss map',async()=>{
  assert.equal(typeof api.createTripleBossController,'function');
  const c=api.createTripleBossController();
  for(const map of ['forest','coast-tide-core-cave','volcano-core-caldera']){
    await c.setMap(map);const views=c.renderableBosses();assert.equal(views.length,3);
    assert.equal(new Set(views.map(v=>v.id)).size,3);
    for(const view of views){assert.equal(isWorldPositionBlocked(map,view.x,view.y,view.radius),false);const w=getWorldDefinition(map);assert.ok(view.x>=0&&view.x<=w.width);}
    for(let i=0;i<views.length;i++)for(let j=i+1;j<views.length;j++)assert.ok(Math.hypot(views[i].x-views[j].x,views[i].y-views[j].y)>views[i].radius+views[j].radius);
  }
  await c.setMap('village');assert.equal(c.snapshot,null);assert.equal(c.renderableBosses().length,0);
});
test('real attacks address selected boss and only third defeat emits one chapter reward',async()=>{
  assert.equal(typeof api.createTripleBossController,'function');
  let clock=10000;const c=api.createTripleBossController({wallNow:()=>clock,now:()=>clock});await c.setMap('volcano-core-caldera');
  const views=c.renderableBosses();
  for(let i=0;i<3;i++){
    let attempts=0;
    while(c.targetableBosses().some(b=>b.id===views[i].id)&&attempts++<100){
      clock+=1000;const b=c.targetableBosses().find(b=>b.id===views[i].id);
      const result=await c.requestHit({targetId:b.id,attackKind:'basic',classId:'warrior',weaponId:'heaven-sovereign-sword',direction:'up',player:{uid:'local-player',mapId:'volcano-core-caldera',x:b.x,y:b.y+32,hp:100,classId:'warrior',equippedWeaponId:'heaven-sovereign-sword'}});
      assert.equal(result.ok,true);
    }
    assert.ok(attempts<100);
    const events=c.consumeEvents().filter(e=>e.type==='boss-defeated');
    assert.equal(events.length,i===2?1:0);
    if(i<2){assert.equal(c.snapshot.status,'alive');assert.equal(c.targetableBosses().length,2-i);}
  }
  assert.equal(c.snapshot.status,'defeated');assert.equal(c.snapshot.hp,0);
  c.update(0.1,{player:{x:0,y:0,hp:100}});assert.equal(c.consumeEvents().filter(e=>e.type==='boss-defeated').length,0);
});
